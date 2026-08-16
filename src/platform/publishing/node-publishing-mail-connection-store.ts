import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type PublishingMailCredentialCipher = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plainText: string) => Uint8Array;
  readonly decryptString: (encrypted: Uint8Array) => string;
};

export type PublishingMailInternalConnection = {
  readonly connectorKind: string;
  readonly clientId: string;
  readonly accountLabel: string;
  readonly scopes: readonly string[];
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
  readonly lastSyncedAt: string | null;
};

export type PublishingMailConnectionStore = {
  readConnection(): PublishingMailInternalConnection | null;
  saveConnection(value: Omit<PublishingMailInternalConnection, "lastSyncedAt">): Promise<void>;
  saveLastSyncedAt(value: string): Promise<void>;
  clear(): Promise<void>;
};

type StoredConnection = {
  readonly schemaVersion: 1;
  readonly connectorKind: string;
  readonly clientId: string;
  readonly accountLabel: string;
  readonly scopes: readonly string[];
  readonly encryptedTokens: string;
  readonly expiresAt: string;
  readonly lastSyncedAt: string | null;
};

type StoredTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

function instant(value: unknown, label: string): string {
  const text = nonEmpty(value, label);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) {
    throw new Error(`${label} must be a canonical ISO instant`);
  }
  return text;
}

function parseStoredConnection(value: unknown): StoredConnection {
  const label = "Stored publishing mail connection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "connectorKind",
    "clientId",
    "accountLabel",
    "scopes",
    "encryptedTokens",
    "expiresAt",
    "lastSyncedAt",
  ], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  if (!Array.isArray(input.scopes)) throw new Error(`${label}.scopes must be an array`);
  const encryptedTokens = nonEmpty(input.encryptedTokens, `${label}.encryptedTokens`);
  if (Buffer.from(encryptedTokens, "base64").toString("base64") !== encryptedTokens) {
    throw new Error(`${label}.encryptedTokens must be canonical base64 text`);
  }
  return Object.freeze({
    schemaVersion: 1,
    connectorKind: nonEmpty(input.connectorKind, `${label}.connectorKind`),
    clientId: nonEmpty(input.clientId, `${label}.clientId`),
    accountLabel: nonEmpty(input.accountLabel, `${label}.accountLabel`),
    scopes: Object.freeze(input.scopes.map((scope, index) =>
      nonEmpty(scope, `${label}.scopes[${index}]`)
    )),
    encryptedTokens,
    expiresAt: instant(input.expiresAt, `${label}.expiresAt`),
    lastSyncedAt: input.lastSyncedAt === null
      ? null
      : instant(input.lastSyncedAt, `${label}.lastSyncedAt`),
  });
}

function parseStoredTokens(value: unknown): StoredTokens {
  const label = "Stored publishing mail tokens";
  const input = record(value, label);
  exact(input, ["accessToken", "refreshToken"], label);
  return Object.freeze({
    accessToken: nonEmpty(input.accessToken, `${label}.accessToken`),
    refreshToken: nonEmpty(input.refreshToken, `${label}.refreshToken`),
  });
}

class NodePublishingMailConnectionStore implements PublishingMailConnectionStore {
  readonly #cipher: PublishingMailCredentialCipher;
  readonly #filePath: string;
  #state: StoredConnection | null;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(input: {
    readonly cipher: PublishingMailCredentialCipher;
    readonly filePath: string;
    readonly initialState: StoredConnection | null;
  }) {
    this.#cipher = input.cipher;
    this.#filePath = input.filePath;
    this.#state = input.initialState;
  }

  readConnection(): PublishingMailInternalConnection | null {
    if (this.#state === null) return null;
    const tokens = parseStoredTokens(JSON.parse(this.#cipher.decryptString(
      Buffer.from(this.#state.encryptedTokens, "base64"),
    )));
    return Object.freeze({
      connectorKind: this.#state.connectorKind,
      clientId: this.#state.clientId,
      accountLabel: this.#state.accountLabel,
      scopes: this.#state.scopes,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: this.#state.expiresAt,
      lastSyncedAt: this.#state.lastSyncedAt,
    });
  }

  saveConnection(value: Omit<PublishingMailInternalConnection, "lastSyncedAt">): Promise<void> {
    return this.#serialize(async () => {
      if (!this.#cipher.isEncryptionAvailable()) {
        throw new Error("Publishing mail credential encryption is unavailable");
      }
      const encryptedTokens = Buffer.from(this.#cipher.encryptString(JSON.stringify({
        accessToken: nonEmpty(value.accessToken, "Publishing mail accessToken"),
        refreshToken: nonEmpty(value.refreshToken, "Publishing mail refreshToken"),
      }))).toString("base64");
      await this.#publish(Object.freeze({
        schemaVersion: 1,
        connectorKind: nonEmpty(value.connectorKind, "Publishing mail connectorKind"),
        clientId: nonEmpty(value.clientId, "Publishing mail clientId"),
        accountLabel: nonEmpty(value.accountLabel, "Publishing mail accountLabel"),
        scopes: Object.freeze(value.scopes.map((scope, index) =>
          nonEmpty(scope, `Publishing mail scopes[${index}]`)
        )),
        encryptedTokens,
        expiresAt: instant(value.expiresAt, "Publishing mail expiresAt"),
        lastSyncedAt:
          this.#state?.connectorKind === value.connectorKind &&
          this.#state.accountLabel === value.accountLabel
            ? this.#state.lastSyncedAt
            : null,
      }));
    });
  }

  saveLastSyncedAt(value: string): Promise<void> {
    return this.#serialize(async () => {
      if (this.#state === null) throw new Error("Publishing mail account is not connected");
      await this.#publish(Object.freeze({
        ...this.#state,
        lastSyncedAt: instant(value, "Publishing mail lastSyncedAt"),
      }));
    });
  }

  clear(): Promise<void> {
    return this.#serialize(async () => {
      await rm(this.#filePath, { force: true });
      this.#state = null;
    });
  }

  #serialize(operation: () => Promise<void>): Promise<void> {
    const result = this.#writeQueue.then(operation, operation);
    this.#writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async #publish(next: StoredConnection): Promise<void> {
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

export async function openNodePublishingMailConnectionStore(input: {
  readonly rootDirectoryPath: string;
  readonly cipher: PublishingMailCredentialCipher;
}): Promise<PublishingMailConnectionStore> {
  if (!path.isAbsolute(input.rootDirectoryPath)) {
    throw new Error("Publishing mail connection rootDirectoryPath must be absolute");
  }
  await mkdir(input.rootDirectoryPath, { recursive: true });
  const filePath = path.join(input.rootDirectoryPath, "connection.json");
  let initialState: StoredConnection | null = null;
  try {
    initialState = parseStoredConnection(JSON.parse(await readFile(filePath, "utf8")));
  } catch (reason) {
    if (!(reason instanceof Error) || !("code" in reason) || reason.code !== "ENOENT") {
      throw reason;
    }
  }
  return new NodePublishingMailConnectionStore({
    cipher: input.cipher,
    filePath,
    initialState,
  });
}
