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

describe("publishing mail runtime", () => {
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
