import { describe, expect, it, vi } from "vitest";

import type { PublishingMailConnectorManifestEntry } from "../../application/publishing/publishing-mail-connection-contract";
import { createGoogleMailConnector } from "./google-mail-connector";

const manifest: PublishingMailConnectorManifestEntry = Object.freeze({
  connectorKind: "google-mail-oauth-v1",
  displayName: "Google Mail",
  authorizationEndpoint: "https://identity.example.test/authorize",
  tokenEndpoint: "https://identity.example.test/token",
  revocationEndpoint: "https://identity.example.test/revoke",
  apiBaseUrl: "https://mail.example.test/v1/users/me",
  scope: "mail.readonly",
});

describe("Google mail connector", () => {
  it("connects through loopback PKCE and returns tokens only to the main-owned adapter", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === manifest.tokenEndpoint) {
        return Response.json({
          access_token: "access-secret",
          refresh_token: "refresh-secret",
          expires_in: 3600,
          scope: manifest.scope,
        });
      }
      if (url === `${manifest.apiBaseUrl}/profile`) {
        return Response.json({ emailAddress: "writer@example.test" });
      }
      return new Response(null, { status: 404 });
    });
    const connector = createGoogleMailConnector({
      fetcher,
      now: () => new Date("2026-08-10T10:00:00.000Z"),
    });

    const connection = await connector.connect({
      manifest,
      clientId: "desktop-client-id",
      openAuthorizationUrl: async (authorizationUrl) => {
        const authorization = new URL(authorizationUrl);
        expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
        expect(authorization.searchParams.get("scope")).toBe(manifest.scope);
        const callback = new URL(authorization.searchParams.get("redirect_uri") ?? "");
        callback.searchParams.set("state", authorization.searchParams.get("state") ?? "");
        callback.searchParams.set("code", "authorization-code");
        await fetch(callback);
      },
    });

    expect(connection).toEqual({
      connectorKind: manifest.connectorKind,
      clientId: "desktop-client-id",
      accountLabel: "writer@example.test",
      scopes: [manifest.scope],
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2026-08-10T11:00:00.000Z",
    });
    const tokenRequest = fetcher.mock.calls.find(([url]) => String(url) === manifest.tokenEndpoint);
    expect(String(tokenRequest?.[1]?.body)).toContain("code_verifier=");
  });

  it("collects exact sender mail manually and returns fingerprints without raw bodies", async () => {
    const body = "회신 본문은 저장되지 않습니다.";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/messages")) {
        expect(url.searchParams.get("q")).toContain("from:editor@example.test");
        expect(url.searchParams.get("q")).toContain("after:1786356000");
        return Response.json({ messages: [{ id: "message-1" }] });
      }
      if (url.pathname.endsWith("/messages/message-1")) {
        expect(url.searchParams.get("format")).toBe("full");
        return Response.json({
          id: "message-1",
          threadId: "thread-1",
          internalDate: "1786357800000",
          snippet: "회신 본문은 저장되지",
          payload: {
            headers: [
              { name: "From", value: "editor@example.test" },
              { name: "Subject", value: "투고 회신" },
            ],
            mimeType: "text/plain",
            body: { data: Buffer.from(body, "utf8").toString("base64url") },
          },
        });
      }
      return new Response(null, { status: 404 });
    });
    const connector = createGoogleMailConnector({
      fetcher,
      now: () => new Date("2026-08-10T10:30:00.000Z"),
    });

    const result = await connector.sync({
      manifest,
      connection: {
        connectorKind: manifest.connectorKind,
        clientId: "desktop-client-id",
        accountLabel: "writer@example.test",
        scopes: [manifest.scope],
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        expiresAt: "2026-08-10T11:00:00.000Z",
      },
      senderAddresses: ["editor@example.test"],
      since: "2026-08-10T10:00:00.000Z",
    });

    expect(result.messages).toEqual([{
      messageId: "message-1",
      threadId: "thread-1",
      from: "editor@example.test",
      subject: "투고 회신",
      receivedAt: "2026-08-10T10:30:00.000Z",
      snippet: "회신 본문은 저장되지",
      bodyFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }]);
    expect(JSON.stringify(result.messages)).not.toContain(body);
    expect(JSON.stringify(result.messages)).not.toContain("body\"");
  });
});
