import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assistantConnectionId,
  openNodeAssistantConnectionStore,
  type AssistantCredentialCipher,
} from "./node-assistant-connection-store";

const temporaryDirectories: string[] = [];

function cipher(): AssistantCredentialCipher {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) =>
      Buffer.from(Array.from(plainText).reverse().join(""), "utf8"),
    decryptString: (encrypted) =>
      Array.from(Buffer.from(encrypted).toString("utf8")).reverse().join(""),
  };
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-assistant-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

describe("node assistant connection store", () => {
  it("persists user metadata and an encrypted credential across reopen", async () => {
    const rootDirectoryPath = await temporaryDirectory();
    const connectionId = assistantConnectionId(randomUUID());
    const credential = `credential-${randomUUID()}`;
    const firstInstant = new Date().toISOString();
    const first = await openNodeAssistantConnectionStore({
      rootDirectoryPath,
      cipher: cipher(),
      now: () => firstInstant,
    });

    const saved = await first.save({
      schemaVersion: 1,
      connectionId,
      expectedRevision: 0,
      connectorKind: "eum-structured-json-v1",
      label: `connection-${randomUUID()}`,
      endpoint: `https://${randomUUID()}.invalid/rpc`,
      model: `model-${randomUUID()}`,
      credential: { mode: "replace", value: credential },
    });

    expect(saved).toMatchObject({
      connectionId,
      revision: 1,
      credentialConfigured: true,
    });
    expect(first.readCredential(connectionId)).toBe(credential);
    const persistedText = await readFile(
      path.join(rootDirectoryPath, "connections.json"),
      "utf8",
    );
    expect(persistedText).not.toContain(credential);

    const reopened = await openNodeAssistantConnectionStore({
      rootDirectoryPath,
      cipher: cipher(),
    });
    expect(reopened.list().connections).toEqual([saved]);
    expect(reopened.readCredential(connectionId)).toBe(credential);
    expect(JSON.stringify(reopened.list())).not.toContain(credential);
  });

  it("keeps or removes the existing credential only when explicitly requested", async () => {
    const rootDirectoryPath = await temporaryDirectory();
    const connectionId = assistantConnectionId(randomUUID());
    const credential = `credential-${randomUUID()}`;
    const store = await openNodeAssistantConnectionStore({
      rootDirectoryPath,
      cipher: cipher(),
    });
    const created = await store.save({
      schemaVersion: 1,
      connectionId,
      expectedRevision: 0,
      connectorKind: "eum-structured-json-v1",
      label: `connection-${randomUUID()}`,
      endpoint: `https://${randomUUID()}.invalid/rpc`,
      model: `model-${randomUUID()}`,
      credential: { mode: "replace", value: credential },
    });
    const kept = await store.save({
      schemaVersion: 1,
      connectionId,
      expectedRevision: created.revision,
      connectorKind: created.connectorKind,
      label: created.label,
      endpoint: created.endpoint,
      model: created.model,
      credential: { mode: "keep" },
    });
    expect(store.readCredential(connectionId)).toBe(credential);

    const removed = await store.save({
      schemaVersion: 1,
      connectionId,
      expectedRevision: kept.revision,
      connectorKind: kept.connectorKind,
      label: kept.label,
      endpoint: kept.endpoint,
      model: kept.model,
      credential: { mode: "remove" },
    });
    expect(removed.credentialConfigured).toBe(false);
    expect(store.readCredential(connectionId)).toBeNull();

    await store.delete({
      schemaVersion: 1,
      connectionId,
      expectedRevision: removed.revision,
    });
    expect(store.list().connections).toEqual([]);
  });
});
