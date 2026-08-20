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
        providerId: "runtime-chatgpt",
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
        upstream: {
          baseUrl: "https://chatgpt.com/backend-api/codex",
          originator: "runtime-originator",
          clientVersion: "runtime-version",
          model: "runtime-model",
        },
      }),
    ).toMatchObject({
      displayName: "GPT",
      providerId: "runtime-chatgpt",
      issuer: "https://auth.openai.com",
      callback: { redirectHost: "localhost" },
      upstream: { model: "runtime-model" },
    });
  });

  it("keeps renderer-visible status free of OAuth tokens", () => {
    const status = parseChatGptOAuthConnectionStatus({
      schemaVersion: 1,
      revision: 2,
      providerId: "runtime-chatgpt",
      displayName: "GPT",
      modelId: "runtime-model",
      connected: true,
      email: "writer@example.com",
      planType: "plus",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    expect(status.connected).toBe(true);
    expect(status).toMatchObject({
      providerId: "runtime-chatgpt",
      modelId: "runtime-model",
    });
    expect(JSON.stringify(status)).not.toMatch(/accessToken|refreshToken|idToken/u);
  });
});
