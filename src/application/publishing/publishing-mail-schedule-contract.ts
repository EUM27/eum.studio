export type PublishingMailScheduleAttemptStatus = "succeeded" | "failed" | null;

export type PublishingMailScheduleProjection = {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly localTime: string | null;
  readonly lastAttemptedAt: string | null;
  readonly lastSuccessfulAt: string | null;
  readonly lastAttemptStatus: PublishingMailScheduleAttemptStatus;
};

export type GetPublishingMailScheduleCommand = { readonly schemaVersion: 1 };

export type SavePublishingMailScheduleCommand = {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly localTime: string | null;
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

function localTime(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${label} must be local HH:mm text or null`);
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (match === null || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error(`${label} must be local HH:mm text or null`);
  }
  return value;
}

function instant(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a canonical ISO instant`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant`);
  }
  return value;
}

function optionalInstant(value: unknown, label: string): string | null {
  return value === null ? null : instant(value, label);
}

function scheduledAt(now: Date, value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
  ).getTime();
}

export function parseGetPublishingMailScheduleCommand(
  value: unknown,
): GetPublishingMailScheduleCommand {
  const label = "GetPublishingMailScheduleCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parseSavePublishingMailScheduleCommand(
  value: unknown,
): SavePublishingMailScheduleCommand {
  const label = "SavePublishingMailScheduleCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "enabled", "localTime"], label);
  schema(input, label);
  if (typeof input.enabled !== "boolean") {
    throw new Error(`${label}.enabled must be boolean`);
  }
  return Object.freeze({
    schemaVersion: 1,
    enabled: input.enabled,
    localTime: localTime(input.localTime, `${label}.localTime`),
  });
}

export function parsePublishingMailScheduleProjection(
  value: unknown,
): PublishingMailScheduleProjection {
  const label = "PublishingMailScheduleProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "enabled",
    "localTime",
    "lastAttemptedAt",
    "lastSuccessfulAt",
    "lastAttemptStatus",
  ], label);
  schema(input, label);
  if (typeof input.enabled !== "boolean") {
    throw new Error(`${label}.enabled must be boolean`);
  }
  if (
    input.lastAttemptStatus !== null &&
    input.lastAttemptStatus !== "succeeded" &&
    input.lastAttemptStatus !== "failed"
  ) {
    throw new Error(`${label}.lastAttemptStatus is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    enabled: input.enabled,
    localTime: localTime(input.localTime, `${label}.localTime`),
    lastAttemptedAt: optionalInstant(input.lastAttemptedAt, `${label}.lastAttemptedAt`),
    lastSuccessfulAt: optionalInstant(input.lastSuccessfulAt, `${label}.lastSuccessfulAt`),
    lastAttemptStatus: input.lastAttemptStatus,
  });
}

export function isPublishingMailScheduleDue(
  schedule: PublishingMailScheduleProjection,
  nowValue = Date.now(),
): boolean {
  if (!schedule.enabled || schedule.localTime === null) return false;
  const scheduled = scheduledAt(new Date(nowValue), schedule.localTime);
  const lastHandledAt = Math.max(
    schedule.lastAttemptedAt === null ? -1 : Date.parse(schedule.lastAttemptedAt),
    schedule.lastSuccessfulAt === null ? -1 : Date.parse(schedule.lastSuccessfulAt),
  );
  return nowValue >= scheduled && lastHandledAt < scheduled;
}

export function getNextPublishingMailScheduleAt(
  schedule: PublishingMailScheduleProjection,
  nowValue = Date.now(),
): number | null {
  if (!schedule.enabled || schedule.localTime === null) return null;
  if (isPublishingMailScheduleDue(schedule, nowValue)) return nowValue;
  const now = new Date(nowValue);
  const today = scheduledAt(now, schedule.localTime);
  if (today > nowValue) return today;
  return scheduledAt(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    schedule.localTime,
  );
}
