import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseAssistantConnectionListProjection,
  parseAssistantConnectionProjection,
  parseDeleteAssistantConnectionCommand,
  parseSaveAssistantConnectionCommand,
  type AssistantConnectionListProjection,
  type AssistantConnectionProjection,
  type DeleteAssistantConnectionCommand,
  type SaveAssistantConnectionCommand,
} from "../../application/assistant/assistant-connection";
import { entityId, type EntityId } from "../../domain/writing";

export type AssistantCredentialCipher = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plainText: string) => Uint8Array;
  readonly decryptString: (encrypted: Uint8Array) => string;
};

export type AssistantConnectionStore = {
  list(): AssistantConnectionListProjection;
  save(value: unknown): Promise<AssistantConnectionProjection>;
  delete(value: unknown): Promise<void>;
  readCredential(
    connectionId: EntityId<"AssistantConnection">,
  ): string | null;
};

type StoredAssistantConnection = {
  readonly schemaVersion: 1;
  readonly connectionId: string;
  readonly revision: number;
  readonly connectorKind: string | null;
  readonly label: string;
  readonly endpoint: string;
  readonly model: string;
  readonly encryptedCredential: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredAssistantConnections = {
  readonly schemaVersion: 1;
  readonly connections: readonly StoredAssistantConnection[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function parseEncryptedCredential(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be null or base64 text`);
  }
  if (Buffer.from(value, "base64").toString("base64") !== value) {
    throw new Error(`${label} must be canonical base64 text`);
  }
  return value;
}

function parseStoredConnection(
  value: unknown,
  index: number,
): StoredAssistantConnection {
  const label = `Stored assistant connections.connections[${index}]`;
  const input = record(value, label);
  const hasConnectorKind = Object.prototype.hasOwnProperty.call(
    input,
    "connectorKind",
  );
  exact(input, [
    "schemaVersion",
    "connectionId",
    "revision",
    ...(hasConnectorKind ? ["connectorKind"] : []),
    "label",
    "endpoint",
    "model",
    "encryptedCredential",
    "createdAt",
    "updatedAt",
  ], label);
  const encryptedCredential = parseEncryptedCredential(
    input.encryptedCredential,
    `${label}.encryptedCredential`,
  );
  const projection = parseAssistantConnectionProjection({
    schemaVersion: input.schemaVersion,
    connectionId: input.connectionId,
    revision: input.revision,
    connectorKind: hasConnectorKind ? input.connectorKind : null,
    label: input.label,
    endpoint: input.endpoint,
    model: input.model,
    credentialConfigured: encryptedCredential !== null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
  return Object.freeze({
    ...projection,
    connectorKind: projection.connectorKind,
    encryptedCredential,
  });
}

function parseStoredConnections(value: unknown): StoredAssistantConnections {
  const label = "Stored assistant connections";
  const input = record(value, label);
  exact(input, ["schemaVersion", "connections"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (!Array.isArray(input.connections)) {
    throw new Error(`${label}.connections must be an array`);
  }
  const connections = Object.freeze(
    input.connections.map((connection, index) =>
      parseStoredConnection(connection, index)
    ),
  );
  if (
    new Set(connections.map((connection) => connection.connectionId)).size !==
    connections.length
  ) {
    throw new Error(`${label}.connections contains duplicate identities`);
  }
  return Object.freeze({ schemaVersion: 1, connections });
}

function projectConnection(
  connection: StoredAssistantConnection,
): AssistantConnectionProjection {
  return parseAssistantConnectionProjection({
    schemaVersion: 1,
    connectionId: connection.connectionId,
    revision: connection.revision,
    connectorKind: connection.connectorKind,
    label: connection.label,
    endpoint: connection.endpoint,
    model: connection.model,
    credentialConfigured: connection.encryptedCredential !== null,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  });
}

class NodeAssistantConnectionStore implements AssistantConnectionStore {
  readonly #cipher: AssistantCredentialCipher;
  readonly #filePath: string;
  readonly #now: () => string;
  #state: StoredAssistantConnections;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(input: {
    readonly cipher: AssistantCredentialCipher;
    readonly filePath: string;
    readonly initialState: StoredAssistantConnections;
    readonly now: () => string;
  }) {
    this.#cipher = input.cipher;
    this.#filePath = input.filePath;
    this.#state = input.initialState;
    this.#now = input.now;
  }

  list(): AssistantConnectionListProjection {
    return parseAssistantConnectionListProjection({
      schemaVersion: 1,
      connections: this.#state.connections.map(projectConnection),
    });
  }

  save(value: unknown): Promise<AssistantConnectionProjection> {
    const command = parseSaveAssistantConnectionCommand(value);
    return this.#serialize(async () => this.#saveSerially(command));
  }

  delete(value: unknown): Promise<void> {
    const command = parseDeleteAssistantConnectionCommand(value);
    return this.#serialize(async () => this.#deleteSerially(command));
  }

  readCredential(
    connectionId: EntityId<"AssistantConnection">,
  ): string | null {
    const connection = this.#state.connections.find(
      (entry) => entry.connectionId === connectionId,
    );
    if (connection?.encryptedCredential === null || connection === undefined) {
      return null;
    }
    return this.#cipher.decryptString(
      Buffer.from(connection.encryptedCredential, "base64"),
    );
  }

  #serialize<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = this.#writeQueue.then(operation, operation);
    this.#writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async #saveSerially(
    command: SaveAssistantConnectionCommand,
  ): Promise<AssistantConnectionProjection> {
    const currentIndex = this.#state.connections.findIndex(
      (connection) => connection.connectionId === command.connectionId,
    );
    const current = this.#state.connections[currentIndex];
    const currentRevision = current?.revision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      throw new Error(
        `Assistant connection revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
      );
    }
    let encryptedCredential = current?.encryptedCredential ?? null;
    if (command.credential.mode === "replace") {
      if (!this.#cipher.isEncryptionAvailable()) {
        throw new Error("Assistant credential encryption is unavailable");
      }
      encryptedCredential = Buffer.from(
        this.#cipher.encryptString(command.credential.value),
      ).toString("base64");
    } else if (command.credential.mode === "remove") {
      encryptedCredential = null;
    }
    const updatedAt = this.#now();
    const next: StoredAssistantConnection = Object.freeze({
      schemaVersion: 1,
      connectionId: command.connectionId,
      revision: currentRevision + 1,
      connectorKind: command.connectorKind,
      label: command.label,
      endpoint: command.endpoint,
      model: command.model,
      encryptedCredential,
      createdAt: current?.createdAt ?? updatedAt,
      updatedAt,
    });
    const connections = [...this.#state.connections];
    if (currentIndex === -1) connections.push(next);
    else connections[currentIndex] = next;
    await this.#publish(Object.freeze({
      schemaVersion: 1,
      connections: Object.freeze(connections),
    }));
    return projectConnection(next);
  }

  async #deleteSerially(
    command: DeleteAssistantConnectionCommand,
  ): Promise<void> {
    const current = this.#state.connections.find(
      (connection) => connection.connectionId === command.connectionId,
    );
    if (current === undefined) {
      throw new Error(`Assistant connection is missing: ${command.connectionId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Assistant connection revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    await this.#publish(Object.freeze({
      schemaVersion: 1,
      connections: Object.freeze(
        this.#state.connections.filter(
          (connection) => connection.connectionId !== command.connectionId,
        ),
      ),
    }));
  }

  async #publish(next: StoredAssistantConnections): Promise<void> {
    const temporaryPath = `${this.#filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(next)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#filePath);
      this.#state = next;
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
}

export async function openNodeAssistantConnectionStore(input: {
  readonly rootDirectoryPath: string;
  readonly cipher: AssistantCredentialCipher;
  readonly now?: () => string;
}): Promise<AssistantConnectionStore> {
  if (!path.isAbsolute(input.rootDirectoryPath)) {
    throw new Error("Assistant connection rootDirectoryPath must be absolute");
  }
  await mkdir(input.rootDirectoryPath, { recursive: true });
  const filePath = path.join(input.rootDirectoryPath, "connections.json");
  let initialState: StoredAssistantConnections = Object.freeze({
    schemaVersion: 1,
    connections: Object.freeze([]),
  });
  try {
    initialState = parseStoredConnections(
      JSON.parse(await readFile(filePath, "utf8")),
    );
  } catch (reason) {
    if (
      !(reason instanceof Error) ||
      !("code" in reason) ||
      reason.code !== "ENOENT"
    ) {
      throw reason;
    }
  }
  return new NodeAssistantConnectionStore({
    cipher: input.cipher,
    filePath,
    initialState,
    now: input.now ?? (() => new Date().toISOString()),
  });
}

export function assistantConnectionId(
  value: string,
): EntityId<"AssistantConnection"> {
  return entityId<"AssistantConnection">(value);
}
