export type ChatGptOAuthProfile = {
  readonly schemaVersion: 1;
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
};

export type ChatGptOAuthConnectionStatus = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly displayName: string;
  readonly connected: boolean;
  readonly email: string | null;
  readonly planType: string | null;
  readonly updatedAt: string | null;
};

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
      "displayName",
      "issuer",
      "clientId",
      "authorizationPath",
      "tokenPath",
      "scopes",
      "authorizeParameters",
      "callback",
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
  return Object.freeze({
    schemaVersion: 1,
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
      "displayName",
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
    displayName: text(input.displayName, "ChatGptOAuthConnectionStatus.displayName"),
    connected: input.connected,
    email: input.email as string | null,
    planType: input.planType as string | null,
    updatedAt: input.updatedAt as string | null,
  });
}
