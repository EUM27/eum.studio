import type { PublishingMailConnectorManifestEntry } from "./publishing-mail-connection-contract";

export type PublishingMailConnectorConnection = {
  readonly connectorKind: string;
  readonly clientId: string;
  readonly accountLabel: string;
  readonly scopes: readonly string[];
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
};

export type PublishingMailMessageEnvelope = {
  readonly messageId: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly receivedAt: string;
  readonly snippet: string;
  readonly bodyFingerprint: string;
};

export type PublishingMailConnectorAdapter = {
  readonly connectorKind: string;
  connect(input: {
    readonly manifest: PublishingMailConnectorManifestEntry;
    readonly clientId: string;
    readonly openAuthorizationUrl: (url: string) => Promise<void>;
  }): Promise<PublishingMailConnectorConnection>;
  sync(input: {
    readonly manifest: PublishingMailConnectorManifestEntry;
    readonly connection: PublishingMailConnectorConnection;
    readonly senderAddresses: readonly string[];
    readonly since: string | null;
  }): Promise<{
    readonly connection: PublishingMailConnectorConnection;
    readonly messages: readonly PublishingMailMessageEnvelope[];
    readonly syncedAt: string;
  }>;
  disconnect(input: {
    readonly manifest: PublishingMailConnectorManifestEntry;
    readonly connection: PublishingMailConnectorConnection;
  }): Promise<void>;
};
