import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";

import {
  parseChatGptOAuthConnectionStatus,
  type ChatGptOAuthConnectionStatus,
  type ChatGptOAuthProfile,
} from "../../application/assistant/chatgpt-oauth";

export type ChatGptOAuthCredentialCipher = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plainText: string) => Uint8Array;
  readonly decryptString: (encrypted: Uint8Array) => string;
};

export type ChatGptOAuthTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly idToken: string;
  readonly accountId: string | null;
  readonly email: string | null;
  readonly planType: string | null;
};

export type ChatGptOAuthConnectionStore = {
  getStatus(): ChatGptOAuthConnectionStatus;
  saveTokens(tokens: ChatGptOAuthTokens): Promise<ChatGptOAuthConnectionStatus>;
  readTokens(): ChatGptOAuthTokens | null;
};

type StoredConnection = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly encryptedCredential: string | null;
  readonly updatedAt: string | null;
};

type TokenRequest = {
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
};

function parseTokens(value: unknown): ChatGptOAuthTokens {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Stored ChatGPT OAuth tokens must be an object");
  }
  const input = value as Record<string, unknown>;
  const fields = [
    "accessToken",
    "refreshToken",
    "idToken",
    "accountId",
    "email",
    "planType",
  ] as const;
  if (
    Object.keys(input).length !== fields.length ||
    Object.keys(input).some((field) => !fields.includes(field as never))
  ) {
    throw new Error("Stored ChatGPT OAuth token fields do not match the schema");
  }
  for (const field of ["accessToken", "refreshToken", "idToken"] as const) {
    if (typeof input[field] !== "string" || input[field].length === 0) {
      throw new Error(`Stored ChatGPT OAuth ${field} must be non-empty text`);
    }
  }
  for (const field of ["accountId", "email", "planType"] as const) {
    if (input[field] !== null && typeof input[field] !== "string") {
      throw new Error(`Stored ChatGPT OAuth ${field} must be text or null`);
    }
  }
  return Object.freeze({
    accessToken: input.accessToken as string,
    refreshToken: input.refreshToken as string,
    idToken: input.idToken as string,
    accountId: input.accountId as string | null,
    email: input.email as string | null,
    planType: input.planType as string | null,
  });
}

function parseStoredConnection(
  value: unknown,
  profile: Readonly<{
    providerId: string;
    displayName: string;
    modelId: string;
  }>,
): StoredConnection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Stored ChatGPT OAuth connection must be an object");
  }
  const input = value as Record<string, unknown>;
  const fields = [
    "schemaVersion",
    "revision",
    "encryptedCredential",
    "updatedAt",
  ] as const;
  if (
    Object.keys(input).length !== fields.length ||
    Object.keys(input).some((field) => !fields.includes(field as never))
  ) {
    throw new Error("Stored ChatGPT OAuth connection fields do not match the schema");
  }
  const status = parseChatGptOAuthConnectionStatus({
    schemaVersion: input.schemaVersion,
    revision: input.revision,
    providerId: profile.providerId,
    displayName: profile.displayName,
    modelId: profile.modelId,
    connected: input.encryptedCredential !== null,
    email: null,
    planType: null,
    updatedAt: input.updatedAt,
  });
  if (
    input.encryptedCredential !== null &&
    (typeof input.encryptedCredential !== "string" ||
      input.encryptedCredential.length === 0)
  ) {
    throw new Error("Stored ChatGPT OAuth credential must be encrypted text or null");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: status.revision,
    encryptedCredential: input.encryptedCredential as string | null,
    updatedAt: status.updatedAt,
  });
}

class NodeChatGptOAuthStore implements ChatGptOAuthConnectionStore {
  readonly #cipher: ChatGptOAuthCredentialCipher;
  readonly #providerId: string;
  readonly #displayName: string;
  readonly #modelId: string;
  readonly #filePath: string;
  readonly #now: () => string;
  #state: StoredConnection;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(input: {
    cipher: ChatGptOAuthCredentialCipher;
    providerId: string;
    displayName: string;
    modelId: string;
    filePath: string;
    now: () => string;
    state: StoredConnection;
  }) {
    this.#cipher = input.cipher;
    this.#providerId = input.providerId;
    this.#displayName = input.displayName;
    this.#modelId = input.modelId;
    this.#filePath = input.filePath;
    this.#now = input.now;
    this.#state = input.state;
  }

  getStatus(): ChatGptOAuthConnectionStatus {
    const tokens = this.readTokens();
    return parseChatGptOAuthConnectionStatus({
      schemaVersion: 1,
      revision: this.#state.revision,
      providerId: this.#providerId,
      displayName: this.#displayName,
      modelId: this.#modelId,
      connected: tokens !== null,
      email: tokens?.email ?? null,
      planType: tokens?.planType ?? null,
      updatedAt: this.#state.updatedAt,
    });
  }

  readTokens(): ChatGptOAuthTokens | null {
    if (this.#state.encryptedCredential === null) return null;
    return parseTokens(
      JSON.parse(
        this.#cipher.decryptString(
          Buffer.from(this.#state.encryptedCredential, "base64"),
        ),
      ),
    );
  }

  saveTokens(tokens: ChatGptOAuthTokens): Promise<ChatGptOAuthConnectionStatus> {
    const parsed = parseTokens(tokens);
    const result = this.#writeQueue.then(() => this.#saveSerially(parsed));
    this.#writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async #saveSerially(
    tokens: ChatGptOAuthTokens,
  ): Promise<ChatGptOAuthConnectionStatus> {
    if (!this.#cipher.isEncryptionAvailable()) {
      throw new Error("ChatGPT OAuth credential encryption is unavailable");
    }
    const next = Object.freeze({
      schemaVersion: 1 as const,
      revision: this.#state.revision + 1,
      encryptedCredential: Buffer.from(
        this.#cipher.encryptString(JSON.stringify(tokens)),
      ).toString("base64"),
      updatedAt: this.#now(),
    });
    const temporaryPath = `${this.#filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(next)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#filePath);
      this.#state = next;
    } finally {
      await rm(temporaryPath, { force: true });
    }
    return this.getStatus();
  }
}

export async function openNodeChatGptOAuthStore(input: {
  readonly rootDirectoryPath: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly modelId: string;
  readonly cipher: ChatGptOAuthCredentialCipher;
  readonly now?: () => string;
}): Promise<ChatGptOAuthConnectionStore> {
  if (!path.isAbsolute(input.rootDirectoryPath)) {
    throw new Error("ChatGPT OAuth rootDirectoryPath must be absolute");
  }
  await mkdir(input.rootDirectoryPath, { recursive: true });
  const filePath = path.join(input.rootDirectoryPath, "connection.json");
  let state: StoredConnection = Object.freeze({
    schemaVersion: 1,
    revision: 0,
    encryptedCredential: null,
    updatedAt: null,
  });
  try {
    state = parseStoredConnection(
      JSON.parse(await readFile(filePath, "utf8")),
      {
        providerId: input.providerId,
        displayName: input.displayName,
        modelId: input.modelId,
      },
    );
  } catch (reason) {
    if (!(reason instanceof Error) || !("code" in reason) || reason.code !== "ENOENT") {
      throw reason;
    }
  }
  return new NodeChatGptOAuthStore({
    cipher: input.cipher,
    providerId: input.providerId,
    displayName: input.displayName,
    modelId: input.modelId,
    filePath,
    now: input.now ?? (() => new Date().toISOString()),
    state,
  });
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

async function listenOnConfiguredPort(
  server: Server,
  profile: ChatGptOAuthProfile,
): Promise<number> {
  for (
    let port = profile.callback.portRange.start;
    port <= profile.callback.portRange.end;
    port += 1
  ) {
    const result = await new Promise<"listening" | "unavailable">((resolve, reject) => {
      const onError = (reason: NodeJS.ErrnoException) => {
        server.removeListener("listening", onListening);
        if (reason.code === "EADDRINUSE" || reason.code === "EACCES") {
          resolve("unavailable");
          return;
        }
        reject(reason);
      };
      const onListening = () => {
        server.removeListener("error", onError);
        resolve("listening");
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, profile.callback.listenHost);
    });
    if (result === "listening") return port;
  }
  throw new Error("No configured ChatGPT OAuth callback port is available");
}

function decodeIdToken(idToken: string): Record<string, unknown> {
  const segments = idToken.split(".");
  if (segments.length !== 3) return {};
  try {
    const value = JSON.parse(Buffer.from(segments[1] ?? "", "base64url").toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function requestOfficialTokens(
  profile: ChatGptOAuthProfile,
  input: TokenRequest,
): Promise<ChatGptOAuthTokens> {
  const response = await fetch(new URL(profile.tokenPath, profile.issuer), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: profile.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`ChatGPT OAuth token exchange failed (${response.status})`);
  }
  const value = await response.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ChatGPT OAuth token response must be an object");
  }
  const token = value as Record<string, unknown>;
  for (const field of ["access_token", "refresh_token", "id_token"] as const) {
    if (typeof token[field] !== "string" || token[field].length === 0) {
      throw new Error(`ChatGPT OAuth token response ${field} is missing`);
    }
  }
  const idClaims = decodeIdToken(token.id_token as string);
  const authClaim =
    typeof idClaims["https://api.openai.com/auth"] === "object" &&
    idClaims["https://api.openai.com/auth"] !== null
      ? (idClaims["https://api.openai.com/auth"] as Record<string, unknown>)
      : {};
  return parseTokens({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    idToken: token.id_token,
    accountId:
      typeof authClaim.chatgpt_account_id === "string"
        ? authClaim.chatgpt_account_id
        : null,
    email: typeof idClaims.email === "string" ? idClaims.email : null,
    planType:
      typeof authClaim.chatgpt_plan_type === "string"
        ? authClaim.chatgpt_plan_type
        : null,
  });
}

export function createNodeChatGptOAuthLogin(input: {
  readonly profile: ChatGptOAuthProfile;
  readonly store: ChatGptOAuthConnectionStore;
  readonly openExternal: (url: string) => Promise<void>;
  readonly requestToken?: (input: TokenRequest) => Promise<ChatGptOAuthTokens>;
}): { startLogin(): Promise<ChatGptOAuthConnectionStatus> } {
  let activeLogin: Promise<ChatGptOAuthConnectionStatus> | null = null;

  return {
    startLogin(): Promise<ChatGptOAuthConnectionStatus> {
      if (activeLogin !== null) return activeLogin;
      activeLogin = (async () => {
        const state = base64Url(randomBytes(32));
        const codeVerifier = base64Url(randomBytes(64));
        const codeChallenge = base64Url(
          createHash("sha256").update(codeVerifier).digest(),
        );
        let resolveCode: ((code: string) => void) | null = null;
        let rejectCode: ((reason: Error) => void) | null = null;
        const authorizationCode = new Promise<string>((resolve, reject) => {
          resolveCode = resolve;
          rejectCode = reject;
        });
        const server = createServer((request, response) => {
          const requestUrl = new URL(request.url ?? "/", "http://localhost");
          if (requestUrl.pathname !== input.profile.callback.path) {
            response.writeHead(404).end();
            return;
          }
          const returnedState = requestUrl.searchParams.get("state");
          const code = requestUrl.searchParams.get("code");
          const oauthError = requestUrl.searchParams.get("error");
          if (oauthError !== null) {
            response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
            response.end("<p>GPT 로그인이 취소되었습니다. 이 창을 닫아도 됩니다.</p>");
            rejectCode?.(new Error(`ChatGPT OAuth failed: ${oauthError}`));
            return;
          }
          if (returnedState !== state || code === null || code.length === 0) {
            response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
            response.end("<p>GPT 로그인 응답을 확인할 수 없습니다.</p>");
            rejectCode?.(new Error("Invalid ChatGPT OAuth callback"));
            return;
          }
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end("<p>GPT 로그인이 완료되었습니다. 이 창을 닫아도 됩니다.</p>");
          resolveCode?.(code);
        });
        const port = await listenOnConfiguredPort(server, input.profile);
        const redirectUri = `http://${input.profile.callback.redirectHost}:${port}${input.profile.callback.path}`;
        const authorizeUrl = new URL(
          input.profile.authorizationPath,
          input.profile.issuer,
        );
        authorizeUrl.search = new URLSearchParams({
          response_type: "code",
          client_id: input.profile.clientId,
          redirect_uri: redirectUri,
          scope: input.profile.scopes.join(" "),
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          ...input.profile.authorizeParameters,
        }).toString();
        try {
          await input.openExternal(authorizeUrl.toString());
          const code = await authorizationCode;
          const tokens = await (input.requestToken ?? ((request) =>
            requestOfficialTokens(input.profile, request)))({
            code,
            codeVerifier,
            redirectUri,
          });
          return await input.store.saveTokens(tokens);
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      })().finally(() => {
        activeLogin = null;
      });
      return activeLogin;
    },
  };
}
