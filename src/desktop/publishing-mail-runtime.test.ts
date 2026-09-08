import { describe, expect, it, vi } from "vitest";

import type {
  PublishingMailConnectorAdapter,
  PublishingMailConnectorConnection,
} from "../application/publishing/publishing-mail-connector";
import type { RecordPublishingMailCandidateCommand } from "../application/publishing/publishing-mail-candidate-contract";
import type { PublishingMailInternalConnection } from "../platform/publishing/node-publishing-mail-connection-store";
import { createPublishingMailRuntime } from "./publishing-mail-runtime";

const connected: PublishingMailConnectorConnection = Object.freeze({
  connectorKind: "mail-test-v1",
  clientId: "desktop-client",
  accountLabel: "writer@example.test",
  scopes: ["mail.readonly"],
  accessToken: "access-secret",
  refreshToken: "refresh-secret",
  expiresAt: "2026-08-10T11:00:00.000Z",
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function lifecycleFixture() {
  let stored: PublishingMailInternalConnection | null = { ...connected, lastSyncedAt: null };
  const synchronization = deferred<Awaited<ReturnType<PublishingMailConnectorAdapter["sync"]>>>();
  const nextConnection = { ...connected, accountLabel: "next@example.test" };
  const adapter = { connectorKind: connected.connectorKind, connect: vi.fn(async () => nextConnection), sync: vi.fn(() => synchronization.promise), disconnect: vi.fn(async () => undefined) };
  const writes = {
    saveConnection: vi.fn(async (value: PublishingMailConnectorConnection) => { stored = { ...value, lastSyncedAt: stored?.lastSyncedAt ?? null }; }),
    saveLastSyncedAt: vi.fn(async (value: string) => { if (stored === null) throw new Error("missing connection"); stored = { ...stored, lastSyncedAt: value }; }),
    clearConnection: vi.fn(async () => { stored = null; }),
    recordCandidate: vi.fn(async () => undefined),
  };
  const runtime = createPublishingMailRuntime({
    profile: { schemaVersion: 1, connectors: [{ connectorKind: connected.connectorKind, displayName: "Mail fixture", authorizationEndpoint: "https://identity.invalid/authorize", tokenEndpoint: "https://identity.invalid/token", revocationEndpoint: "https://identity.invalid/revoke", apiBaseUrl: "https://mail.invalid/me", scope: "mail.readonly" }] },
    adapters: [adapter], openAuthorizationUrl: async () => undefined, readConnection: () => stored,
    ...writes, listPartnerSenderAddresses: async () => [], listCandidateSourceKeys: async () => [],
  });
  return { runtime, synchronization, adapter, nextConnection, writes, read: () => stored };
}

describe("publishing mail runtime", () => {
  it("does not revive a connection when sync starts while token revocation is pending", async () => {
    const fixture = lifecycleFixture();
    const revoke = deferred<void>();
    fixture.adapter.disconnect.mockImplementationOnce(async () => { await revoke.promise; });
    const disconnect = fixture.runtime.disconnect({ schemaVersion: 1 });
    const sync = fixture.runtime.sync({ schemaVersion: 1 });
    await vi.waitFor(() => expect(fixture.adapter.sync).toHaveBeenCalledOnce());
    revoke.resolve(); await disconnect;
    fixture.synchronization.resolve({ connection: connected, messages: [], syncedAt: new Date().toISOString() });
    await expect(sync).rejects.toThrow("메일 연결이 변경");
    expect(fixture.read()).toBeNull();
    expect(fixture.writes.saveConnection).not.toHaveBeenCalled();
  });

  it.each(["disconnect", "replace"] as const)("discards a sync response after its connection is changed by %s", async (action) => {
    const fixture = lifecycleFixture();
    const sync = fixture.runtime.sync({ schemaVersion: 1 });
    await vi.waitFor(() => expect(fixture.adapter.sync).toHaveBeenCalledOnce());
    if (action === "disconnect") await fixture.runtime.disconnect({ schemaVersion: 1 });
    else await fixture.runtime.connect({ schemaVersion: 1, connectorKind: connected.connectorKind, clientId: connected.clientId });
    const connectionWrites = fixture.writes.saveConnection.mock.calls.length;
    fixture.synchronization.resolve({ connection: connected, messages: [], syncedAt: new Date().toISOString() });
    await expect(sync).rejects.toThrow("메일 연결이 변경");
    expect(fixture.writes.saveConnection).toHaveBeenCalledTimes(connectionWrites);
    expect(fixture.writes.saveLastSyncedAt).not.toHaveBeenCalled();
    expect(fixture.writes.recordCandidate).not.toHaveBeenCalled();
    expect(fixture.read()?.accountLabel ?? null).toBe(action === "disconnect" ? null : fixture.nextConnection.accountLabel);
  });

  it("finishes an in-flight connection write before completing disconnect", async () => {
    const fixture = lifecycleFixture();
    const writeStarted = deferred<void>(); const releaseWrite = deferred<void>();
    const save = fixture.writes.saveConnection.getMockImplementation()!;
    fixture.writes.saveConnection.mockImplementationOnce(async (value) => { writeStarted.resolve(); await releaseWrite.promise; await save(value); });
    const sync = fixture.runtime.sync({ schemaVersion: 1 });
    const obsolete = expect(sync).rejects.toThrow("메일 연결이 변경");
    fixture.synchronization.resolve({ connection: connected, messages: [], syncedAt: new Date().toISOString() });
    await writeStarted.promise;
    const disconnect = fixture.runtime.disconnect({ schemaVersion: 1 });
    releaseWrite.resolve(); await Promise.all([obsolete, disconnect]);
    expect(fixture.read()).toBeNull();
    expect(fixture.writes.saveLastSyncedAt).not.toHaveBeenCalled();
  });

  it("connects, manually syncs metadata-only candidates idempotently, and disconnects", async () => {
    let stored: PublishingMailInternalConnection | null = null;
    const candidateKeys = new Set<string>();
    const recorded: RecordPublishingMailCandidateCommand[] = [];
    const adapter: PublishingMailConnectorAdapter = {
      connectorKind: "mail-test-v1",
      connect: vi.fn(async () => connected),
      sync: vi.fn(async (input) => ({
        connection: input.connection,
        messages: [{
          messageId: "message-1",
          threadId: "thread-1",
          from: "editor@example.test",
          subject: "투고 회신",
          receivedAt: "2026-08-10T10:30:00.000Z",
          snippet: "회신이 도착했습니다.",
          bodyFingerprint: "f".repeat(64),
        }],
        syncedAt: "2026-08-10T10:30:01.000Z",
      })),
      disconnect: vi.fn(async () => undefined),
    };
    const runtime = createPublishingMailRuntime({
      profile: {
        schemaVersion: 1,
        connectors: [{
          connectorKind: "mail-test-v1",
          displayName: "테스트 메일",
          authorizationEndpoint: "https://identity.invalid/authorize",
          tokenEndpoint: "https://identity.invalid/token",
          revocationEndpoint: "https://identity.invalid/revoke",
          apiBaseUrl: "https://mail.invalid/v1/users/me",
          scope: "mail.readonly",
        }],
      },
      adapters: [adapter],
      openAuthorizationUrl: vi.fn(async () => undefined),
      readConnection: () => stored,
      saveConnection: async (value) => {
        stored = Object.freeze({ ...value, lastSyncedAt: stored?.lastSyncedAt ?? null });
      },
      saveLastSyncedAt: async (value) => {
        if (stored === null) throw new Error("missing connection");
        stored = Object.freeze({ ...stored, lastSyncedAt: value });
      },
      clearConnection: async () => { stored = null; },
      listPartnerSenderAddresses: async () => ["editor@example.test"],
      listCandidateSourceKeys: async () => [...candidateKeys],
      recordCandidate: async (command) => {
        recorded.push(command);
        candidateKeys.add(`${command.sourceAccountId}\u0000${command.messageId}`);
      },
    });

    expect(await runtime.status({ schemaVersion: 1 })).toMatchObject({
      state: "disconnected",
      connectors: [{ connectorKind: "mail-test-v1", displayName: "테스트 메일" }],
    });
    const status = await runtime.connect({
      schemaVersion: 1,
      connectorKind: "mail-test-v1",
      clientId: "desktop-client",
    });
    expect(status).toMatchObject({
      state: "connected",
      accountLabel: "writer@example.test",
      lastSyncedAt: null,
    });
    expect(JSON.stringify(status)).not.toContain("access-secret");

    const first = await runtime.sync({ schemaVersion: 1 });
    expect(first).toEqual({
      schemaVersion: 1,
      discoveredCount: 1,
      newCandidateCount: 1,
      syncedAt: "2026-08-10T10:30:01.000Z",
    });
    expect(recorded[0]).toEqual({
      schemaVersion: 1,
      sourceAccountId: "writer@example.test",
      messageId: "message-1",
      threadId: "thread-1",
      from: "editor@example.test",
      subject: "투고 회신",
      receivedAt: "2026-08-10T10:30:00.000Z",
      snippet: "회신이 도착했습니다.",
      bodyFingerprint: "f".repeat(64),
      matchReason: "",
      proposedStatus: "",
      proposedResult: "",
      proposedRespondedOn: null,
      proposedNote: "",
      classificationConnectionId: null,
      classificationModel: "",
    });
    expect(JSON.stringify(recorded[0])).not.toContain("body\"");
    expect(adapter.sync).toHaveBeenCalledWith(expect.objectContaining({
      senderAddresses: ["editor@example.test"],
      since: null,
    }));

    const second = await runtime.sync({ schemaVersion: 1 });
    expect(second.newCandidateCount).toBe(0);
    expect(adapter.sync).toHaveBeenLastCalledWith(expect.objectContaining({
      since: "2026-08-10T10:30:01.000Z",
    }));

    expect(await runtime.disconnect({ schemaVersion: 1 })).toMatchObject({
      state: "disconnected",
    });
    expect(stored).toBeNull();
  });
});
