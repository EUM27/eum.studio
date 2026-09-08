import {
  parseConnectPublishingMailCommand,
  parseDisconnectPublishingMailCommand,
  parseGetPublishingMailConnectionCommand,
  parsePublishingMailConnectionProjection,
  parsePublishingMailSyncResult,
  parseSyncPublishingMailCommand,
  type PublishingMailConnectionProjection,
  type PublishingMailConnectorProfile,
  type PublishingMailSyncResult,
} from "../application/publishing/publishing-mail-connection-contract";
import type {
  PublishingMailConnectorAdapter,
  PublishingMailConnectorConnection,
} from "../application/publishing/publishing-mail-connector";
import {
  parseRecordPublishingMailCandidateCommand,
  type RecordPublishingMailCandidateCommand,
} from "../application/publishing/publishing-mail-candidate-contract";
import type { PublishingMailInternalConnection } from "../platform/publishing/node-publishing-mail-connection-store";

function connectorConnection(
  value: PublishingMailInternalConnection,
): PublishingMailConnectorConnection {
  return Object.freeze({
    connectorKind: value.connectorKind,
    clientId: value.clientId,
    accountLabel: value.accountLabel,
    scopes: value.scopes,
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
  });
}

export function createPublishingMailRuntime(input: {
  readonly profile: PublishingMailConnectorProfile;
  readonly adapters: readonly PublishingMailConnectorAdapter[];
  readonly openAuthorizationUrl: (url: string) => Promise<void>;
  readonly readConnection: () => PublishingMailInternalConnection | null;
  readonly saveConnection: (
    value: Omit<PublishingMailInternalConnection, "lastSyncedAt">,
  ) => Promise<void>;
  readonly saveLastSyncedAt: (value: string) => Promise<void>;
  readonly clearConnection: () => Promise<void>;
  readonly listPartnerSenderAddresses: () => Promise<readonly string[]>;
  readonly listCandidateSourceKeys: () => Promise<readonly string[]>;
  readonly recordCandidate: (command: RecordPublishingMailCandidateCommand) => Promise<void>;
}): {
  status(value: unknown): Promise<PublishingMailConnectionProjection>;
  connect(value: unknown): Promise<PublishingMailConnectionProjection>;
  disconnect(value: unknown): Promise<PublishingMailConnectionProjection>;
  sync(value: unknown): Promise<PublishingMailSyncResult>;
} {
  const adapters = new Map(input.adapters.map((adapter) => [adapter.connectorKind, adapter]));
  let connectionGeneration = 0;
  let publicationTail: Promise<void> = Promise.resolve();

  function assertCurrent(generation: number): void {
    if (generation !== connectionGeneration) {
      throw new Error("메일 연결이 변경되어 이전 요청 결과를 저장하지 않았습니다.");
    }
  }

  function publish<T>(generation: number, run: () => Promise<T>): Promise<T> {
    const execution = publicationTail.then(async () => {
      assertCurrent(generation);
      const result = await run();
      assertCurrent(generation);
      return result;
    });
    publicationTail = execution.then(() => undefined, () => undefined);
    return execution;
  }

  function projection(): PublishingMailConnectionProjection {
    const connection = input.readConnection();
    return parsePublishingMailConnectionProjection({
      schemaVersion: 1,
      connectors: input.profile.connectors.map(({ connectorKind, displayName }) => ({
        connectorKind,
        displayName,
      })),
      state: connection === null ? "disconnected" : "connected",
      activeConnectorKind: connection?.connectorKind ?? null,
      accountLabel: connection?.accountLabel ?? "",
      clientId: connection?.clientId ?? "",
      scopes: connection?.scopes ?? [],
      lastSyncedAt: connection?.lastSyncedAt ?? null,
    });
  }

  function connected() {
    const connection = input.readConnection();
    if (connection === null) throw new Error("메일 계정을 먼저 연결해 주세요.");
    const manifest = input.profile.connectors.find(
      (entry) => entry.connectorKind === connection.connectorKind,
    );
    if (manifest === undefined) {
      throw new Error(`연결된 메일 커넥터를 찾을 수 없습니다: ${connection.connectorKind}`);
    }
    const adapter = adapters.get(connection.connectorKind);
    if (adapter === undefined) {
      throw new Error(`메일 커넥터 실행기를 찾을 수 없습니다: ${connection.connectorKind}`);
    }
    return { connection, manifest, adapter };
  }

  return Object.freeze({
    async status(value) {
      parseGetPublishingMailConnectionCommand(value);
      return projection();
    },
    async connect(value) {
      const command = parseConnectPublishingMailCommand(value);
      const manifest = input.profile.connectors.find(
        (entry) => entry.connectorKind === command.connectorKind,
      );
      if (manifest === undefined) {
        throw new Error(`알 수 없는 메일 커넥터입니다: ${command.connectorKind}`);
      }
      const adapter = adapters.get(command.connectorKind);
      if (adapter === undefined) {
        throw new Error(`메일 커넥터 실행기를 찾을 수 없습니다: ${command.connectorKind}`);
      }
      const generation = ++connectionGeneration;
      const connection = await adapter.connect({
        manifest,
        clientId: command.clientId,
        openAuthorizationUrl: input.openAuthorizationUrl,
      });
      return publish(generation, async () => {
        await input.saveConnection(connection);
        return projection();
      });
    },
    async disconnect(value) {
      parseDisconnectPublishingMailCommand(value);
      const current = connected();
      const generation = ++connectionGeneration;
      await current.adapter.disconnect({
        manifest: current.manifest,
        connection: connectorConnection(current.connection),
      });
      return publish(generation, async () => {
        await input.clearConnection();
        return projection();
      });
    },
    async sync(value) {
      parseSyncPublishingMailCommand(value);
      const generation = connectionGeneration;
      const current = connected();
      const assertSyncCurrent = () => {
        assertCurrent(generation);
        const live = input.readConnection();
        if (live === null || live.connectorKind !== current.connection.connectorKind ||
          live.clientId !== current.connection.clientId || live.accountLabel !== current.connection.accountLabel) {
          throw new Error("메일 연결이 변경되어 이전 요청 결과를 저장하지 않았습니다.");
        }
      };
      const existingKeys = new Set(await input.listCandidateSourceKeys());
      assertSyncCurrent();
      const senderAddresses = await input.listPartnerSenderAddresses();
      assertSyncCurrent();
      const synchronized = await current.adapter.sync({
        manifest: current.manifest,
        connection: connectorConnection(current.connection),
        senderAddresses,
        since: current.connection.lastSyncedAt,
      });
      return publish(generation, async () => {
        assertSyncCurrent();
        let newCandidateCount = 0;
        const countedKeys = new Set(existingKeys);
        for (const message of synchronized.messages) {
          assertSyncCurrent();
          const key = `${synchronized.connection.accountLabel}\u0000${message.messageId}`;
          if (!countedKeys.has(key)) {
            countedKeys.add(key);
            newCandidateCount += 1;
          }
          await input.recordCandidate(parseRecordPublishingMailCandidateCommand({
            schemaVersion: 1,
            sourceAccountId: synchronized.connection.accountLabel,
            messageId: message.messageId,
            threadId: message.threadId,
            from: message.from,
            subject: message.subject,
            receivedAt: message.receivedAt,
            snippet: message.snippet,
            bodyFingerprint: message.bodyFingerprint,
            matchReason: "",
            proposedStatus: "",
            proposedResult: "",
            proposedRespondedOn: null,
            proposedNote: "",
            classificationConnectionId: null,
            classificationModel: "",
          }));
        }
        assertSyncCurrent();
        await input.saveConnection(synchronized.connection);
        assertSyncCurrent();
        await input.saveLastSyncedAt(synchronized.syncedAt);
        return parsePublishingMailSyncResult({
          schemaVersion: 1,
          discoveredCount: synchronized.messages.length,
          newCandidateCount,
          syncedAt: synchronized.syncedAt,
        });
      });
    },
  });
}
