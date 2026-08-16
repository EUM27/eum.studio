import { describe, expect, it } from "vitest";

import {
  parseChatGptOAuthConnectionStatus,
  parseChatGptOAuthProfile,
} from "./chatgpt-oauth";

describe("ChatGPT OAuth contract", () => {
  it("parses a runtime-owned official OAuth profile", () => {
    expect(
      parseChatGptOAuthProfile({
        schemaVersion: 1,
        displayName: "GPT",
        issuer: "https://auth.openai.com",
        clientId: "runtime-client-id",
        authorizationPath: "/oauth/authorize",
        tokenPath: "/oauth/token",
        scopes: ["openid", "profile", "email", "offline_access"],
        authorizeParameters: { originator: "eum_studio" },
        callback: {
          listenHost: "127.0.0.1",
          redirectHost: "localhost",
          path: "/auth/callback",
          portRange: { start: 1455, end: 1475 },
        },
      }),
    ).toMatchObject({
      displayName: "GPT",
      issuer: "https://auth.openai.com",
      callback: { redirectHost: "localhost" },
    });
  });

  it("keeps renderer-visible status free of OAuth tokens", () => {
    const status = parseChatGptOAuthConnectionStatus({
      schemaVersion: 1,
      revision: 2,
      displayName: "GPT",
      connected: true,
      email: "writer@example.com",
      planType: "plus",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    expect(status.connected).toBe(true);
    expect(JSON.stringify(status)).not.toMatch(/accessToken|refreshToken|idToken/u);
  });
});
