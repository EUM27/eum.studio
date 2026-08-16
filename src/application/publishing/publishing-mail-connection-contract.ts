export type PublishingMailConnectorManifestEntry = {
  readonly connectorKind: string;
  readonly displayName: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly revocationEndpoint: string;
  readonly apiBaseUrl: string;
  readonly scope: string;
};

export type PublishingMailConnectorProfile = {
  readonly schemaVersion: 1;
  readonly connectors: readonly PublishingMailConnectorManifestEntry[];
};

export type PublishingMailConnectorOption = Pick<
  PublishingMailConnectorManifestEntry,
  "connectorKind" | "displayName"
>;

export type PublishingMailConnectionProjection = {
  readonly schemaVersion: 1;
  readonly connectors: readonly PublishingMailConnectorOption[];
  readonly state: "disconnected" | "connected";
  readonly activeConnectorKind: string | null;
  readonly accountLabel: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly lastSyncedAt: string | null;
};

export type GetPublishingMailConnectionCommand = { readonly schemaVersion: 1 };

export type ConnectPublishingMailCommand = {
  readonly schemaVersion: 1;
  readonly connectorKind: string;
  readonly clientId: string;
};

export type DisconnectPublishingMailCommand = { readonly schemaVersion: 1 };
export type SyncPublishingMailCommand = { readonly schemaVersion: 1 };

export type PublishingMailSyncResult = {
  readonly schemaVersion: 1;
  readonly discoveredCount: number;
  readonly newCandidateCount: number;
  readonly syncedAt: string;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

function optionalInstant(value: unknown, label: string): string | null {
  if (value === null) return null;
  return instant(value, label);
}

function instant(value: unknown, label: string): string {
  const text = nonEmpty(value, label);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) {
    throw new Error(`${label} must be a canonical ISO instant`);
  }
  return text;
}

function url(value: unknown, label: string): string {
  const text = nonEmpty(value, label);
  const parsed = new URL(text);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  return parsed.toString().replace(/\/$/u, "");
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function parseConnector(
  value: unknown,
  index: number,
): PublishingMailConnectorManifestEntry {
  const label = `PublishingMailConnectorProfile.connectors[${index}]`;
  const input = record(value, label);
  exact(input, [
    "connectorKind",
    "displayName",
    "authorizationEndpoint",
    "tokenEndpoint",
    "revocationEndpoint",
    "apiBaseUrl",
    "scope",
  ], label);
  return Object.freeze({
    connectorKind: nonEmpty(input.connectorKind, `${label}.connectorKind`),
    displayName: nonEmpty(input.displayName, `${label}.displayName`),
    authorizationEndpoint: url(input.authorizationEndpoint, `${label}.authorizationEndpoint`),
    tokenEndpoint: url(input.tokenEndpoint, `${label}.tokenEndpoint`),
    revocationEndpoint: url(input.revocationEndpoint, `${label}.revocationEndpoint`),
    apiBaseUrl: url(input.apiBaseUrl, `${label}.apiBaseUrl`),
    scope: nonEmpty(input.scope, `${label}.scope`),
  });
}

export function parsePublishingMailConnectorProfile(
  value: unknown,
): PublishingMailConnectorProfile {
  const label = "PublishingMailConnectorProfile";
  const input = record(value, label);
  exact(input, ["schemaVersion", "connectors"], label);
  schema(input, label);
  if (!Array.isArray(input.connectors)) {
    throw new Error(`${label}.connectors must be an array`);
  }
  const connectors = Object.freeze(input.connectors.map(parseConnector));
  if (new Set(connectors.map((entry) => entry.connectorKind)).size !== connectors.length) {
    throw new Error(`${label}.connectorKind must be unique`);
  }
  return Object.freeze({ schemaVersion: 1, connectors });
}

function parseSchemaOnly(value: unknown, label: string): { readonly schemaVersion: 1 } {
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parseGetPublishingMailConnectionCommand(
  value: unknown,
): GetPublishingMailConnectionCommand {
  return parseSchemaOnly(value, "GetPublishingMailConnectionCommand");
}

export function parseConnectPublishingMailCommand(
  value: unknown,
): ConnectPublishingMailCommand {
  const label = "ConnectPublishingMailCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "connectorKind", "clientId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    connectorKind: nonEmpty(input.connectorKind, `${label}.connectorKind`),
    clientId: nonEmpty(input.clientId, `${label}.clientId`),
  });
}

export function parseDisconnectPublishingMailCommand(
  value: unknown,
): DisconnectPublishingMailCommand {
  return parseSchemaOnly(value, "DisconnectPublishingMailCommand");
}

export function parseSyncPublishingMailCommand(
  value: unknown,
): SyncPublishingMailCommand {
  return parseSchemaOnly(value, "SyncPublishingMailCommand");
}

export function parsePublishingMailConnectionProjection(
  value: unknown,
): PublishingMailConnectionProjection {
  const label = "PublishingMailConnectionProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "connectors",
    "state",
    "activeConnectorKind",
    "accountLabel",
    "clientId",
    "scopes",
    "lastSyncedAt",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.connectors)) throw new Error(`${label}.connectors must be an array`);
  const connectors = Object.freeze(input.connectors.map((value, index) => {
    const itemLabel = `${label}.connectors[${index}]`;
    const item = record(value, itemLabel);
    exact(item, ["connectorKind", "displayName"], itemLabel);
    return Object.freeze({
      connectorKind: nonEmpty(item.connectorKind, `${itemLabel}.connectorKind`),
      displayName: nonEmpty(item.displayName, `${itemLabel}.displayName`),
    });
  }));
  if (input.state !== "disconnected" && input.state !== "connected") {
    throw new Error(`${label}.state is unsupported`);
  }
  const activeConnectorKind = input.activeConnectorKind === null
    ? null
    : nonEmpty(input.activeConnectorKind, `${label}.activeConnectorKind`);
  if (!Array.isArray(input.scopes)) throw new Error(`${label}.scopes must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    connectors,
    state: input.state,
    activeConnectorKind,
    accountLabel: typeof input.accountLabel === "string" ? input.accountLabel : nonEmpty(input.accountLabel, `${label}.accountLabel`),
    clientId: typeof input.clientId === "string" ? input.clientId : nonEmpty(input.clientId, `${label}.clientId`),
    scopes: Object.freeze(input.scopes.map((scope, index) => nonEmpty(scope, `${label}.scopes[${index}]`))),
    lastSyncedAt: optionalInstant(input.lastSyncedAt, `${label}.lastSyncedAt`),
  });
}

export function parsePublishingMailSyncResult(value: unknown): PublishingMailSyncResult {
  const label = "PublishingMailSyncResult";
  const input = record(value, label);
  exact(input, ["schemaVersion", "discoveredCount", "newCandidateCount", "syncedAt"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    discoveredCount: nonNegativeInteger(input.discoveredCount, `${label}.discoveredCount`),
    newCandidateCount: nonNegativeInteger(input.newCandidateCount, `${label}.newCandidateCount`),
    syncedAt: instant(input.syncedAt, `${label}.syncedAt`),
  });
}
