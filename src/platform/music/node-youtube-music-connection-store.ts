import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseSaveYouTubeMusicConnectionCommand,
  parseYouTubeMusicConnectionStatus,
  type SaveYouTubeMusicConnectionCommand,
  type YouTubeMusicConnectionStatus,
} from "../../application/music/youtube-music-connection";

export type YouTubeMusicCredentialCipher = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plainText: string) => Uint8Array;
  readonly decryptString: (encrypted: Uint8Array) => string;
};

export type YouTubeMusicConnectionStore = {
  getStatus(): YouTubeMusicConnectionStatus;
  save(value: unknown): Promise<YouTubeMusicConnectionStatus>;
  readApiKey(): string | null;
};

type StoredConnection = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly encryptedApiKey: string | null;
  readonly updatedAt: string | null;
};

function parseStoredConnection(value: unknown): StoredConnection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Stored YouTube music connection must be an object");
  }
  const input = value as Record<string, unknown>;
  const expected = new Set(["schemaVersion", "revision", "encryptedApiKey", "updatedAt"]);
  if (Object.keys(input).length !== expected.size || Object.keys(input).some((field) => !expected.has(field))) {
    throw new Error("Stored YouTube music connection fields do not match the schema");
  }
  const status = parseYouTubeMusicConnectionStatus({
    schemaVersion: input.schemaVersion,
    revision: input.revision,
    apiKeyConfigured: input.encryptedApiKey !== null,
    updatedAt: input.updatedAt,
  });
  if (input.encryptedApiKey !== null && (typeof input.encryptedApiKey !== "string" || input.encryptedApiKey.length === 0)) {
    throw new Error("Stored YouTube music connection key must be encrypted text or null");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: status.revision,
    encryptedApiKey: input.encryptedApiKey as string | null,
    updatedAt: status.updatedAt,
  });
}

class NodeYouTubeMusicConnectionStore implements YouTubeMusicConnectionStore {
  readonly #cipher: YouTubeMusicCredentialCipher;
  readonly #filePath: string;
  readonly #now: () => string;
  #state: StoredConnection;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(input: { cipher: YouTubeMusicCredentialCipher; filePath: string; now: () => string; state: StoredConnection }) {
    this.#cipher = input.cipher;
    this.#filePath = input.filePath;
    this.#now = input.now;
    this.#state = input.state;
  }

  getStatus(): YouTubeMusicConnectionStatus {
    return parseYouTubeMusicConnectionStatus({
      schemaVersion: 1,
      revision: this.#state.revision,
      apiKeyConfigured: this.#state.encryptedApiKey !== null,
      updatedAt: this.#state.updatedAt,
    });
  }

  save(value: unknown): Promise<YouTubeMusicConnectionStatus> {
    const command = parseSaveYouTubeMusicConnectionCommand(value);
    const result = this.#writeQueue.then(() => this.#saveSerially(command));
    this.#writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  readApiKey(): string | null {
    return this.#state.encryptedApiKey === null
      ? null
      : this.#cipher.decryptString(Buffer.from(this.#state.encryptedApiKey, "base64"));
  }

  async #saveSerially(command: SaveYouTubeMusicConnectionCommand): Promise<YouTubeMusicConnectionStatus> {
    if (command.expectedRevision !== this.#state.revision) {
      throw new Error(`YouTube music connection revision conflict: expected ${command.expectedRevision}, current ${this.#state.revision}`);
    }
    let encryptedApiKey: string | null;
    if (command.apiKey.mode === "replace") {
      if (!this.#cipher.isEncryptionAvailable()) throw new Error("YouTube music credential encryption is unavailable");
      encryptedApiKey = Buffer.from(this.#cipher.encryptString(command.apiKey.value)).toString("base64");
    } else {
      encryptedApiKey = null;
    }
    const next = Object.freeze({
      schemaVersion: 1 as const,
      revision: this.#state.revision + 1,
      encryptedApiKey,
      updatedAt: this.#now(),
    });
    const temporaryPath = `${this.#filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(next)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, this.#filePath);
      this.#state = next;
    } finally {
      await rm(temporaryPath, { force: true });
    }
    return this.getStatus();
  }
}

export async function openNodeYouTubeMusicConnectionStore(input: {
  readonly rootDirectoryPath: string;
  readonly cipher: YouTubeMusicCredentialCipher;
  readonly now?: () => string;
}): Promise<YouTubeMusicConnectionStore> {
  if (!path.isAbsolute(input.rootDirectoryPath)) throw new Error("YouTube music connection rootDirectoryPath must be absolute");
  await mkdir(input.rootDirectoryPath, { recursive: true });
  const filePath = path.join(input.rootDirectoryPath, "connection.json");
  let state: StoredConnection = Object.freeze({ schemaVersion: 1, revision: 0, encryptedApiKey: null, updatedAt: null });
  try {
    state = parseStoredConnection(JSON.parse(await readFile(filePath, "utf8")));
  } catch (reason) {
    if (!(reason instanceof Error) || !("code" in reason) || reason.code !== "ENOENT") throw reason;
  }
  return new NodeYouTubeMusicConnectionStore({
    cipher: input.cipher,
    filePath,
    now: input.now ?? (() => new Date().toISOString()),
    state,
  });
}
