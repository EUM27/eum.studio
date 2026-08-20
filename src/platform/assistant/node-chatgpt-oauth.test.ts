import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseChatGptOAuthProfile } from "../../application/assistant/chatgpt-oauth";
import {
  createNodeChatGptOAuthLogin,
  openNodeChatGptOAuthStore,
  type ChatGptOAuthCredentialCipher,
} from "./node-chatgpt-oauth";

const temporaryDirectories: string[] = [];

function cipher(): ChatGptOAuthCredentialCipher {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) =>
      Buffer.from(Array.from(plainText).reverse().join(""), "utf8"),
    decryptString: (encrypted) =>
      Array.from(Buffer.from(encrypted).toString("utf8")).reverse().join(""),
  };
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "string" || address === null) {
        server.close();
        reject(new Error("Failed to reserve test port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("node ChatGPT OAuth", () => {
  it("uses localhost PKCE callback and persists tokens only as encrypted data", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-chatgpt-oauth-"),
    );
    temporaryDirectories.push(rootDirectoryPath);
    const port = await reservePort();
    const profile = parseChatGptOAuthProfile({
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
        portRange: { start: port, end: port },
      },
      upstream: {
        baseUrl: "https://chatgpt.com/backend-api/codex",
        originator: "runtime-originator",
        clientVersion: "runtime-version",
        model: "runtime-model",
      },
    });
    const store = await openNodeChatGptOAuthStore({
      rootDirectoryPath,
      providerId: profile.providerId,
      displayName: profile.displayName,
      modelId: profile.upstream.model,
      cipher: cipher(),
      now: () => "2026-08-13T00:00:00.000Z",
    });
    let authorizeUrl: string | null = null;
    let releaseAuthorizeUrl: ((url: string) => void) | null = null;
    const authorizeUrlReady = new Promise<string>((resolve) => {
      releaseAuthorizeUrl = resolve;
    });
    const login = createNodeChatGptOAuthLogin({
      profile,
      store,
      openExternal: async (url) => {
        authorizeUrl = url;
        releaseAuthorizeUrl?.(url);
      },
      requestToken: async (input) => {
        expect(input.code).toBe("authorization-code");
        expect(input.codeVerifier.length).toBeGreaterThan(30);
        expect(input.redirectUri).toBe(`http://localhost:${port}/auth/callback`);
        return {
          accessToken: "access-secret",
          refreshToken: "refresh-secret",
          idToken: "id-secret",
          accountId: "account-id",
          email: "writer@example.com",
          planType: "plus",
        };
      },
    });

    const pending = login.startLogin();
    const openedUrl = new URL(await authorizeUrlReady);
    expect(authorizeUrl).not.toBeNull();
    expect(openedUrl.hostname).toBe("auth.openai.com");
    expect(openedUrl.searchParams.get("code_challenge_method")).toBe("S256");
    const callback = new URL(`http://127.0.0.1:${port}/auth/callback`);
    callback.searchParams.set("code", "authorization-code");
    callback.searchParams.set("state", openedUrl.searchParams.get("state") ?? "");
    const response = await fetch(callback);
    expect(response.ok).toBe(true);

    const status = await pending;
    expect(status).toMatchObject({
      connected: true,
      email: "writer@example.com",
      planType: "plus",
    });
    expect(JSON.stringify(status)).not.toContain("access-secret");
    const stored = await readFile(
      path.join(rootDirectoryPath, "connection.json"),
      "utf8",
    );
    expect(stored).not.toContain("access-secret");
    expect(stored).not.toContain("refresh-secret");
    expect(store.readTokens()?.accessToken).toBe("access-secret");
  });
});
