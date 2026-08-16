import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

import type {
  PublishingMailConnectorAdapter,
  PublishingMailConnectorConnection,
  PublishingMailMessageEnvelope,
} from "../../application/publishing/publishing-mail-connector";

type GoogleMailConnectorOptions = {
  readonly fetcher?: typeof fetch;
  readonly now?: () => Date;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

async function jsonResponse(response: Response, label: string): Promise<Record<string, unknown>> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
  return record(payload, `${label} response`);
}

function tokenScopes(value: unknown, fallback: readonly string[]): readonly string[] {
  if (typeof value !== "string") return Object.freeze([...fallback]);
  return Object.freeze(value.split(/\s+/u).map((scope) => scope.trim()).filter(Boolean));
}

function expiresAt(now: Date, seconds: unknown): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Mail token expires_in must be a non-negative number");
  }
  return new Date(now.valueOf() + seconds * 1_000).toISOString();
}

function header(payload: Record<string, unknown>, name: string): string {
  if (!Array.isArray(payload.headers)) return "";
  for (const value of payload.headers) {
    const item = record(value, "Mail message header");
    if (
      typeof item.name === "string" &&
      item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    ) {
      return typeof item.value === "string" ? item.value : "";
    }
  }
  return "";
}

function collectEncodedBodies(value: unknown, bodies: string[]): void {
  const payload = record(value, "Mail message payload");
  if (typeof payload.body === "object" && payload.body !== null && !Array.isArray(payload.body)) {
    const body = payload.body as Record<string, unknown>;
    if (typeof body.data === "string") bodies.push(body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) collectEncodedBodies(part, bodies);
  }
}

function bodyFingerprint(payload: unknown): string {
  const bodies: string[] = [];
  collectEncodedBodies(payload, bodies);
  return createHash("sha256").update(bodies.join("\n"), "utf8").digest("hex");
}

function readMessage(value: unknown): PublishingMailMessageEnvelope {
  const message = record(value, "Mail message");
  const payload = record(message.payload, "Mail message.payload");
  const milliseconds = Number(nonEmpty(message.internalDate, "Mail message.internalDate"));
  if (!Number.isFinite(milliseconds)) throw new Error("Mail message.internalDate must be numeric");
  const receivedAt = new Date(milliseconds);
  if (Number.isNaN(receivedAt.valueOf())) throw new Error("Mail message.internalDate is invalid");
  return Object.freeze({
    messageId: nonEmpty(message.id, "Mail message.id"),
    threadId: nonEmpty(message.threadId, "Mail message.threadId"),
    from: header(payload, "From"),
    subject: header(payload, "Subject"),
    receivedAt: receivedAt.toISOString(),
    snippet: typeof message.snippet === "string" ? message.snippet : "",
    bodyFingerprint: bodyFingerprint(payload),
  });
}

function connectionWithTokens(input: {
  readonly base: Pick<PublishingMailConnectorConnection, "connectorKind" | "clientId" | "accountLabel">;
  readonly payload: Record<string, unknown>;
  readonly previousRefreshToken?: string;
  readonly fallbackScopes: readonly string[];
  readonly now: Date;
}): PublishingMailConnectorConnection {
  const refreshToken = typeof input.payload.refresh_token === "string" && input.payload.refresh_token.trim()
    ? input.payload.refresh_token.trim()
    : input.previousRefreshToken;
  if (!refreshToken) throw new Error("Mail authorization did not return a refresh token");
  return Object.freeze({
    connectorKind: input.base.connectorKind,
    clientId: input.base.clientId,
    accountLabel: input.base.accountLabel,
    scopes: tokenScopes(input.payload.scope, input.fallbackScopes),
    accessToken: nonEmpty(input.payload.access_token, "Mail token access_token"),
    refreshToken,
    expiresAt: expiresAt(input.now, input.payload.expires_in),
  });
}

async function authorizeThroughLoopback(input: {
  readonly authorizationEndpoint: string;
  readonly clientId: string;
  readonly scope: string;
  readonly openAuthorizationUrl: (url: string) => Promise<void>;
}): Promise<{ readonly code: string; readonly codeVerifier: string; readonly redirectUri: string }> {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
  const state = randomBytes(24).toString("base64url");
  let settle: ((value: { readonly code: string; readonly redirectUri: string }) => void) | null = null;
  let reject: ((reason: Error) => void) | null = null;
  const callback = new Promise<{ readonly code: string; readonly redirectUri: string }>((resolve, rejectPromise) => {
    settle = resolve;
    reject = rejectPromise;
  });
  const server = createServer((request, response) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      response.statusCode = 500;
      response.end("Mail authorization listener is unavailable.");
      reject?.(new Error("Mail authorization listener is unavailable"));
      return;
    }
    const redirectUri = `http://127.0.0.1:${address.port}`;
    const callbackUrl = new URL(request.url ?? "/", redirectUri);
    if (callbackUrl.searchParams.get("state") !== state) {
      response.statusCode = 400;
      response.end("Mail authorization state does not match.");
      reject?.(new Error("Mail authorization state does not match"));
      return;
    }
    const code = callbackUrl.searchParams.get("code") ?? "";
    if (!code) {
      response.statusCode = 400;
      response.end("Mail authorization was not completed.");
      reject?.(new Error("Mail authorization was not completed"));
      return;
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end("<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\"><title>메일 연결</title><body><p>메일 계정 연결이 완료되었습니다. 이 창을 닫고 이음 스튜디오로 돌아가세요.</p></body></html>");
    settle?.({ code, redirectUri });
  });
  try {
    await new Promise<void>((resolve, rejectListen) => {
      server.once("error", rejectListen);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Mail authorization listener is unavailable");
    }
    const redirectUri = `http://127.0.0.1:${address.port}`;
    const authorizationUrl = new URL(input.authorizationEndpoint);
    authorizationUrl.search = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: input.scope,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
    }).toString();
    await input.openAuthorizationUrl(authorizationUrl.toString());
    const authorized = await callback;
    return Object.freeze({
      code: authorized.code,
      codeVerifier,
      redirectUri: authorized.redirectUri,
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export function createGoogleMailConnector(
  options: GoogleMailConnectorOptions = {},
): PublishingMailConnectorAdapter {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());

  async function authorizedJson(
    connection: PublishingMailConnectorConnection,
    url: string,
    label: string,
  ): Promise<Record<string, unknown>> {
    return jsonResponse(await fetcher(url, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    }), label);
  }

  async function freshConnection(
    manifest: Parameters<PublishingMailConnectorAdapter["sync"]>[0]["manifest"],
    connection: PublishingMailConnectorConnection,
  ): Promise<PublishingMailConnectorConnection> {
    if (new Date(connection.expiresAt).valueOf() > now().valueOf()) return connection;
    const payload = await jsonResponse(await fetcher(manifest.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: connection.clientId,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      }),
    }), "Mail token refresh");
    return connectionWithTokens({
      base: connection,
      payload,
      previousRefreshToken: connection.refreshToken,
      fallbackScopes: connection.scopes,
      now: now(),
    });
  }

  return Object.freeze({
    connectorKind: "google-mail-oauth-v1",
    async connect(input) {
      const authorization = await authorizeThroughLoopback({
        authorizationEndpoint: input.manifest.authorizationEndpoint,
        clientId: input.clientId,
        scope: input.manifest.scope,
        openAuthorizationUrl: input.openAuthorizationUrl,
      });
      const payload = await jsonResponse(await fetcher(input.manifest.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: input.clientId,
          code: authorization.code,
          code_verifier: authorization.codeVerifier,
          redirect_uri: authorization.redirectUri,
          grant_type: "authorization_code",
        }),
      }), "Mail authorization code exchange");
      const accessToken = nonEmpty(payload.access_token, "Mail token access_token");
      const profile = await jsonResponse(await fetcher(`${input.manifest.apiBaseUrl}/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }), "Mail account profile");
      return connectionWithTokens({
        base: {
          connectorKind: input.manifest.connectorKind,
          clientId: input.clientId,
          accountLabel: nonEmpty(profile.emailAddress, "Mail account emailAddress"),
        },
        payload,
        fallbackScopes: [input.manifest.scope],
        now: now(),
      });
    },
    async sync(input) {
      const connection = await freshConnection(input.manifest, input.connection);
      const senderAddresses = [...new Set(input.senderAddresses
        .map((address) => address.trim().toLocaleLowerCase())
        .filter(Boolean))];
      const syncedAt = now().toISOString();
      if (senderAddresses.length === 0) {
        return Object.freeze({ connection, messages: Object.freeze([]), syncedAt });
      }
      const terms = senderAddresses.map((address) => `from:${address}`);
      const since = input.since === null
        ? ""
        : `after:${Math.floor(new Date(input.since).valueOf() / 1_000)} `;
      const query = `${since}{${terms.join(" OR ")}}`;
      const messageIds: string[] = [];
      let pageToken: string | null = null;
      do {
        const search = new URLSearchParams({ q: query });
        if (pageToken !== null) search.set("pageToken", pageToken);
        const list = await authorizedJson(
          connection,
          `${input.manifest.apiBaseUrl}/messages?${search}`,
          "Mail message list",
        );
        if (Array.isArray(list.messages)) {
          for (const value of list.messages) {
            const reference = record(value, "Mail message reference");
            messageIds.push(nonEmpty(reference.id, "Mail message reference.id"));
          }
        }
        pageToken = typeof list.nextPageToken === "string" && list.nextPageToken
          ? list.nextPageToken
          : null;
      } while (pageToken !== null);
      const messages: PublishingMailMessageEnvelope[] = [];
      for (const messageId of messageIds) {
        const search = new URLSearchParams({ format: "full" });
        const message = await authorizedJson(
          connection,
          `${input.manifest.apiBaseUrl}/messages/${encodeURIComponent(messageId)}?${search}`,
          "Mail message detail",
        );
        messages.push(readMessage(message));
      }
      return Object.freeze({
        connection,
        messages: Object.freeze(messages),
        syncedAt,
      });
    },
    async disconnect(input) {
      const body = new URLSearchParams({ token: input.connection.refreshToken });
      const response = await fetcher(input.manifest.revocationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new Error(`Mail token revocation failed with HTTP ${response.status}`);
    },
  });
}
