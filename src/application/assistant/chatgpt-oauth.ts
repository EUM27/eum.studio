import { entityId, type EntityId } from "../../domain/writing";

export type ChatGptOAuthProfile = {
  readonly schemaVersion: 1;
  readonly providerId: string;
  readonly displayName: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly authorizationPath: string;
  readonly tokenPath: string;
  readonly scopes: readonly string[];
  readonly authorizeParameters: Readonly<Record<string, string>>;
  readonly callback: Readonly<{
    listenHost: string;
    redirectHost: "localhost";
    path: string;
    portRange: Readonly<{ start: number; end: number }>;
  }>;
  readonly upstream: Readonly<{
    baseUrl: string;
    originator: string;
    clientVersion: string;
    model: string;
  }>;
};

export type ChatGptOAuthConnectionStatus = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly providerId: string;
  readonly displayName: string;
  readonly modelId: string;
  readonly connected: boolean;
  readonly email: string | null;
  readonly planType: string | null;
  readonly updatedAt: string | null;
};

export function createChatGptOAuthAssistantConnectionId(
  providerId: string,
): EntityId<"AssistantConnection"> {
  if (providerId.trim().length === 0) {
    throw new Error("ChatGPT OAuth providerId must be non-empty text");
  }
  return entityId<"AssistantConnection">(`oauth:${providerId.trim()}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((field) => !allowed.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value;
}

function port(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 65_535
  ) {
    throw new Error(`${label} must be a valid port`);
  }
  return value;
}

export function parseChatGptOAuthProfile(value: unknown): ChatGptOAuthProfile {
  const input = record(value, "ChatGptOAuthProfile");
  exact(
    input,
    [
      "schemaVersion",
      "providerId",
      "displayName",
      "issuer",
      "clientId",
      "authorizationPath",
      "tokenPath",
      "scopes",
      "authorizeParameters",
      "callback",
      "upstream",
    ],
    "ChatGptOAuthProfile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("ChatGptOAuthProfile.schemaVersion must be 1");
  }
  const issuer = text(input.issuer, "ChatGptOAuthProfile.issuer");
  const issuerUrl = new URL(issuer);
  if (issuerUrl.protocol !== "https:") {
    throw new Error("ChatGptOAuthProfile.issuer must use HTTPS");
  }
  if (!Array.isArray(input.scopes) || input.scopes.length === 0) {
    throw new Error("ChatGptOAuthProfile.scopes must be a non-empty array");
  }
  const scopes = input.scopes.map((scope, index) =>
    text(scope, `ChatGptOAuthProfile.scopes[${index}]`),
  );
  const authorizeParametersInput = record(
    input.authorizeParameters,
    "ChatGptOAuthProfile.authorizeParameters",
  );
  const authorizeParameters = Object.fromEntries(
    Object.entries(authorizeParametersInput).map(([key, parameterValue]) => [
      key,
      text(parameterValue, `ChatGptOAuthProfile.authorizeParameters.${key}`),
    ]),
  );
  const callback = record(input.callback, "ChatGptOAuthProfile.callback");
  exact(
    callback,
    ["listenHost", "redirectHost", "path", "portRange"],
    "ChatGptOAuthProfile.callback",
  );
  if (callback.redirectHost !== "localhost") {
    throw new Error("ChatGptOAuthProfile.callback.redirectHost must be localhost");
  }
  const portRange = record(
    callback.portRange,
    "ChatGptOAuthProfile.callback.portRange",
  );
  exact(
    portRange,
    ["start", "end"],
    "ChatGptOAuthProfile.callback.portRange",
  );
  const start = port(portRange.start, "ChatGptOAuthProfile.callback.portRange.start");
  const end = port(portRange.end, "ChatGptOAuthProfile.callback.portRange.end");
  if (start > end) {
    throw new Error("ChatGptOAuthProfile.callback.portRange must be ascending");
  }
  const upstream = record(input.upstream, "ChatGptOAuthProfile.upstream");
  exact(
    upstream,
    ["baseUrl", "originator", "clientVersion", "model"],
    "ChatGptOAuthProfile.upstream",
  );
  const upstreamBaseUrl = new URL(
    text(upstream.baseUrl, "ChatGptOAuthProfile.upstream.baseUrl"),
  );
  const loopbackUpstream =
    upstreamBaseUrl.hostname === "localhost" ||
    upstreamBaseUrl.hostname === "127.0.0.1" ||
    upstreamBaseUrl.hostname === "[::1]";
  if (
    upstreamBaseUrl.protocol !== "https:" &&
    !(upstreamBaseUrl.protocol === "http:" && loopbackUpstream)
  ) {
    throw new Error(
      "ChatGptOAuthProfile.upstream.baseUrl must use HTTPS or loopback HTTP",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    providerId: text(input.providerId, "ChatGptOAuthProfile.providerId"),
    displayName: text(input.displayName, "ChatGptOAuthProfile.displayName"),
    issuer,
    clientId: text(input.clientId, "ChatGptOAuthProfile.clientId"),
    authorizationPath: text(
      input.authorizationPath,
      "ChatGptOAuthProfile.authorizationPath",
    ),
    tokenPath: text(input.tokenPath, "ChatGptOAuthProfile.tokenPath"),
    scopes: Object.freeze(scopes),
    authorizeParameters: Object.freeze(authorizeParameters),
    callback: Object.freeze({
      listenHost: text(
        callback.listenHost,
        "ChatGptOAuthProfile.callback.listenHost",
      ),
      redirectHost: "localhost",
      path: text(callback.path, "ChatGptOAuthProfile.callback.path"),
      portRange: Object.freeze({ start, end }),
    }),
    upstream: Object.freeze({
      baseUrl: upstreamBaseUrl.toString().replace(/\/$/u, ""),
      originator: text(
        upstream.originator,
        "ChatGptOAuthProfile.upstream.originator",
      ),
      clientVersion: text(
        upstream.clientVersion,
        "ChatGptOAuthProfile.upstream.clientVersion",
      ),
      model: text(upstream.model, "ChatGptOAuthProfile.upstream.model"),
    }),
  });
}

export function parseChatGptOAuthConnectionStatus(
  value: unknown,
): ChatGptOAuthConnectionStatus {
  const input = record(value, "ChatGptOAuthConnectionStatus");
  exact(
    input,
    [
      "schemaVersion",
      "revision",
      "providerId",
      "displayName",
      "modelId",
      "connected",
      "email",
      "planType",
      "updatedAt",
    ],
    "ChatGptOAuthConnectionStatus",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("ChatGptOAuthConnectionStatus.schemaVersion must be 1");
  }
  if (
    typeof input.revision !== "number" ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  ) {
    throw new Error("ChatGptOAuthConnectionStatus.revision must be non-negative");
  }
  if (typeof input.connected !== "boolean") {
    throw new Error("ChatGptOAuthConnectionStatus.connected must be a boolean");
  }
  for (const field of ["email", "planType"] as const) {
    if (input[field] !== null && typeof input[field] !== "string") {
      throw new Error(`ChatGptOAuthConnectionStatus.${field} must be text or null`);
    }
  }
  if (
    input.updatedAt !== null &&
    (typeof input.updatedAt !== "string" || Number.isNaN(Date.parse(input.updatedAt)))
  ) {
    throw new Error(
      "ChatGptOAuthConnectionStatus.updatedAt must be an ISO timestamp or null",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: input.revision,
    providerId: text(input.providerId, "ChatGptOAuthConnectionStatus.providerId"),
    displayName: text(input.displayName, "ChatGptOAuthConnectionStatus.displayName"),
    modelId: text(input.modelId, "ChatGptOAuthConnectionStatus.modelId"),
    connected: input.connected,
    email: input.email as string | null,
    planType: input.planType as string | null,
    updatedAt: input.updatedAt as string | null,
  });
}
