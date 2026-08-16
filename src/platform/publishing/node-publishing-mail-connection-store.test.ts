import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  openNodePublishingMailConnectionStore,
  type PublishingMailCredentialCipher,
} from "./node-publishing-mail-connection-store";

const temporaryDirectories: string[] = [];

function cipher(): PublishingMailCredentialCipher {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) => Buffer.from(Array.from(plainText).reverse().join(""), "utf8"),
    decryptString: (encrypted) => Array.from(Buffer.from(encrypted).toString("utf8")).reverse().join(""),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("node publishing mail connection store", () => {
  it("encrypts OAuth tokens and restores connection and manual-sync metadata", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-mail-connection-"));
    temporaryDirectories.push(directory);
    const store = await openNodePublishingMailConnectionStore({
      rootDirectoryPath: directory,
      cipher: cipher(),
    });

    await store.saveConnection({
      connectorKind: "mail-test-v1",
      clientId: "desktop-client",
      accountLabel: "writer@example.test",
      scopes: ["mail.readonly"],
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2026-08-10T11:00:00.000Z",
    });
    await store.saveLastSyncedAt("2026-08-10T10:30:00.000Z");

    const persisted = await readFile(path.join(directory, "connection.json"), "utf8");
    expect(persisted).not.toContain("access-secret");
    expect(persisted).not.toContain("refresh-secret");
    expect(persisted).toContain("writer@example.test");

    const reopened = await openNodePublishingMailConnectionStore({
      rootDirectoryPath: directory,
      cipher: cipher(),
    });
    expect(reopened.readConnection()).toEqual({
      connectorKind: "mail-test-v1",
      clientId: "desktop-client",
      accountLabel: "writer@example.test",
      scopes: ["mail.readonly"],
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2026-08-10T11:00:00.000Z",
      lastSyncedAt: "2026-08-10T10:30:00.000Z",
    });

    await reopened.clear();
    expect(reopened.readConnection()).toBeNull();
  });
});
