export type YouTubeMusicConnectionStatus = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly apiKeyConfigured: boolean;
  readonly updatedAt: string | null;
};

export type SaveYouTubeMusicConnectionCommand = {
  readonly schemaVersion: 1;
  readonly expectedRevision: number;
  readonly apiKey:
    | Readonly<{ mode: "replace"; value: string }>
    | Readonly<{ mode: "remove" }>;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  const allowed = new Set(fields);
  if (Object.keys(value).length !== fields.length || Object.keys(value).some((field) => !allowed.has(field))) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function parseYouTubeMusicConnectionStatus(value: unknown): YouTubeMusicConnectionStatus {
  const input = record(value, "YouTubeMusicConnectionStatus");
  exact(input, ["schemaVersion", "revision", "apiKeyConfigured", "updatedAt"], "YouTubeMusicConnectionStatus");
  if (input.schemaVersion !== 1) throw new Error("YouTubeMusicConnectionStatus.schemaVersion must be 1");
  if (typeof input.apiKeyConfigured !== "boolean") throw new Error("YouTubeMusicConnectionStatus.apiKeyConfigured must be a boolean");
  const parsedRevision = revision(input.revision, "YouTubeMusicConnectionStatus.revision");
  if (input.updatedAt !== null && (typeof input.updatedAt !== "string" || Number.isNaN(Date.parse(input.updatedAt)))) {
    throw new Error("YouTubeMusicConnectionStatus.updatedAt must be null or an ISO timestamp");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: parsedRevision,
    apiKeyConfigured: input.apiKeyConfigured,
    updatedAt: input.updatedAt as string | null,
  });
}

export function parseSaveYouTubeMusicConnectionCommand(value: unknown): SaveYouTubeMusicConnectionCommand {
  const input = record(value, "SaveYouTubeMusicConnectionCommand");
  exact(input, ["schemaVersion", "expectedRevision", "apiKey"], "SaveYouTubeMusicConnectionCommand");
  if (input.schemaVersion !== 1) throw new Error("SaveYouTubeMusicConnectionCommand.schemaVersion must be 1");
  const apiKey = record(input.apiKey, "SaveYouTubeMusicConnectionCommand.apiKey");
  if (apiKey.mode === "replace") {
    exact(apiKey, ["mode", "value"], "SaveYouTubeMusicConnectionCommand.apiKey");
    if (typeof apiKey.value !== "string" || apiKey.value.length === 0) {
      throw new Error("SaveYouTubeMusicConnectionCommand.apiKey.value must be non-empty text");
    }
    return Object.freeze({
      schemaVersion: 1,
      expectedRevision: revision(input.expectedRevision, "SaveYouTubeMusicConnectionCommand.expectedRevision"),
      apiKey: Object.freeze({ mode: "replace", value: apiKey.value }),
    });
  }
  exact(apiKey, ["mode"], "SaveYouTubeMusicConnectionCommand.apiKey");
  if (apiKey.mode !== "remove") throw new Error("SaveYouTubeMusicConnectionCommand.apiKey.mode is not supported");
  return Object.freeze({
    schemaVersion: 1,
    expectedRevision: revision(input.expectedRevision, "SaveYouTubeMusicConnectionCommand.expectedRevision"),
    apiKey: Object.freeze({ mode: "remove" }),
  });
}
