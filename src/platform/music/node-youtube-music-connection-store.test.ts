import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  openNodeYouTubeMusicConnectionStore,
  type YouTubeMusicCredentialCipher,
} from "./node-youtube-music-connection-store";

const temporaryDirectories: string[] = [];

function cipher(): YouTubeMusicCredentialCipher {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) =>
      Buffer.from(Array.from(plainText).reverse().join(""), "utf8"),
    decryptString: (encrypted) =>
      Array.from(Buffer.from(encrypted).toString("utf8")).reverse().join(""),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("node YouTube music connection store", () => {
  it("persists only an encrypted API key and returns status without the key", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-youtube-music-"),
    );
    temporaryDirectories.push(rootDirectoryPath);
    const apiKey = `youtube-${randomUUID()}`;
    const store = await openNodeYouTubeMusicConnectionStore({
      rootDirectoryPath,
      cipher: cipher(),
      now: () => "2026-08-13T00:00:00.000Z",
    });

    const saved = await store.save({
      schemaVersion: 1,
      expectedRevision: 0,
      apiKey: { mode: "replace", value: apiKey },
    });

    expect(saved).toEqual({
      schemaVersion: 1,
      revision: 1,
      apiKeyConfigured: true,
      updatedAt: "2026-08-13T00:00:00.000Z",
    });
    expect(JSON.stringify(saved)).not.toContain(apiKey);
    expect(store.readApiKey()).toBe(apiKey);
    expect(
      await readFile(path.join(rootDirectoryPath, "connection.json"), "utf8"),
    ).not.toContain(apiKey);

    const reopened = await openNodeYouTubeMusicConnectionStore({
      rootDirectoryPath,
      cipher: cipher(),
    });
    expect(reopened.getStatus()).toMatchObject({
      revision: 1,
      apiKeyConfigured: true,
    });
    expect(reopened.readApiKey()).toBe(apiKey);
  });

  it("removes the API key only through an explicit remove command", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-youtube-music-"),
    );
    temporaryDirectories.push(rootDirectoryPath);
    const store = await openNodeYouTubeMusicConnectionStore({
      rootDirectoryPath,
      cipher: cipher(),
    });
    const created = await store.save({
      schemaVersion: 1,
      expectedRevision: 0,
      apiKey: { mode: "replace", value: `youtube-${randomUUID()}` },
    });

    const removed = await store.save({
      schemaVersion: 1,
      expectedRevision: created.revision,
      apiKey: { mode: "remove" },
    });

    expect(removed.apiKeyConfigured).toBe(false);
    expect(store.readApiKey()).toBeNull();
  });
});
