import { describe, expect, it } from "vitest";

import {
  parseConnectPublishingMailCommand,
  parsePublishingMailConnectorProfile,
  parsePublishingMailConnectionProjection,
  parsePublishingMailSyncResult,
} from "./publishing-mail-connection-contract";

describe("publishing mail connection contract", () => {
  it("keeps connector endpoints in a runtime profile and exposes no token fields", () => {
    const profile = parsePublishingMailConnectorProfile({
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
    });

    expect(profile.connectors).toHaveLength(1);
    expect(parseConnectPublishingMailCommand({
      schemaVersion: 1,
      connectorKind: "mail-test-v1",
      clientId: "desktop-client-id",
    })).toEqual({
      schemaVersion: 1,
      connectorKind: "mail-test-v1",
      clientId: "desktop-client-id",
    });

    const projection = parsePublishingMailConnectionProjection({
      schemaVersion: 1,
      connectors: profile.connectors.map(({ connectorKind, displayName }) => ({
        connectorKind,
        displayName,
      })),
      state: "connected",
      activeConnectorKind: "mail-test-v1",
      accountLabel: "writer@example.test",
      clientId: "desktop-client-id",
      scopes: ["mail.readonly"],
      lastSyncedAt: null,
    });
    expect(JSON.stringify(projection)).not.toMatch(/accessToken|refreshToken|authorizationUrl/u);
  });

  it("reports an explicit manual sync result without returning message bodies", () => {
    const result = parsePublishingMailSyncResult({
      schemaVersion: 1,
      discoveredCount: 3,
      newCandidateCount: 2,
      syncedAt: "2026-08-10T10:20:30.000Z",
    });

    expect(result).toEqual({
      schemaVersion: 1,
      discoveredCount: 3,
      newCandidateCount: 2,
      syncedAt: "2026-08-10T10:20:30.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(/body|message/u);
  });
});
