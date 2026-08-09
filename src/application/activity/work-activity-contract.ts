import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type StartWritingSessionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly note: string;
};

export type StopWritingSessionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession">;
};

export type StartFocusCycleCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly phaseRef: string;
  readonly targetDurationMs: number;
  readonly note: string;
};

export type StopFocusCycleCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly focusCycleId: EntityId<"FocusCycle">;
};

export type ListWorkActivityCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type WritingSessionProjection = {
  readonly schemaVersion: 1;
  readonly sessionId: EntityId<"WritingSession">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document"> | null;
  readonly state: "active" | "completed";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly activeDurationMs: number;
  readonly startRevisionId: EntityId<"DocumentRevision"> | null;
  readonly endRevisionId: EntityId<"DocumentRevision"> | null;
  readonly characterDelta: number | null;
  readonly note: string;
};

export type FocusCycleProjection = {
  readonly schemaVersion: 1;
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession"> | null;
  readonly state: "running" | "stopped";
  readonly phaseRef: string;
  readonly targetDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string;
  readonly completedAt: string | null;
  readonly note: string;
};

export type WorkActivityProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly activeSessionId: EntityId<"WritingSession"> | null;
  readonly activeFocusCycleId: EntityId<"FocusCycle"> | null;
  readonly sessions: readonly WritingSessionProjection[];
  readonly focusCycles: readonly FocusCycleProjection[];
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
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = stringValue(input, field, label);
  if (value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function duration(
  input: Record<string, unknown>,
  field: string,
  label: string,
  allowZero = true,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1)
  ) {
    throw new Error(`${label}.${field} must be a valid duration`);
  }
  return value;
}

function nullableString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return value;
}

export function parseStartWritingSessionCommand(
  value: unknown,
): StartWritingSessionCommand {
  const label = "StartWritingSessionCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "documentId", "note"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    note: stringValue(input, "note", label),
  });
}

export function parseStopWritingSessionCommand(
  value: unknown,
): StopWritingSessionCommand {
  const label = "StopWritingSessionCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "sessionId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    sessionId: id<"WritingSession">(input, "sessionId", label),
  });
}

export function parseStartFocusCycleCommand(
  value: unknown,
): StartFocusCycleCommand {
  const label = "StartFocusCycleCommand";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "phaseRef",
      "targetDurationMs",
      "note",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    phaseRef: nonEmptyString(input, "phaseRef", label).trim(),
    targetDurationMs: duration(input, "targetDurationMs", label, false),
    note: stringValue(input, "note", label),
  });
}

export function parseStopFocusCycleCommand(
  value: unknown,
): StopFocusCycleCommand {
  const label = "StopFocusCycleCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "focusCycleId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    focusCycleId: id<"FocusCycle">(input, "focusCycleId", label),
  });
}

export function parseListWorkActivityCommand(
  value: unknown,
): ListWorkActivityCommand {
  const label = "ListWorkActivityCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseWritingSessionProjection(
  value: unknown,
): WritingSessionProjection {
  const label = "WritingSessionProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "sessionId",
      "workId",
      "documentId",
      "state",
      "startedAt",
      "endedAt",
      "activeDurationMs",
      "startRevisionId",
      "endRevisionId",
      "characterDelta",
      "note",
    ],
    label,
  );
  schema(input, label);
  if (input.state !== "active" && input.state !== "completed") {
    throw new Error(`${label}.state is invalid`);
  }
  const documentId = nullableString(input, "documentId", label);
  const startRevisionId = nullableString(input, "startRevisionId", label);
  const endRevisionId = nullableString(input, "endRevisionId", label);
  const characterDelta = input.characterDelta;
  if (
    characterDelta !== null &&
    (typeof characterDelta !== "number" || !Number.isSafeInteger(characterDelta))
  ) {
    throw new Error(`${label}.characterDelta is invalid`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sessionId: id<"WritingSession">(input, "sessionId", label),
    workId: id<"Work">(input, "workId", label),
    documentId:
      documentId === null ? null : entityId<"Document">(documentId),
    state: input.state,
    startedAt: nonEmptyString(input, "startedAt", label),
    endedAt: nullableString(input, "endedAt", label),
    activeDurationMs: duration(input, "activeDurationMs", label),
    startRevisionId:
      startRevisionId === null
        ? null
        : entityId<"DocumentRevision">(startRevisionId),
    endRevisionId:
      endRevisionId === null
        ? null
        : entityId<"DocumentRevision">(endRevisionId),
    characterDelta,
    note: stringValue(input, "note", label),
  });
}

export function parseFocusCycleProjection(
  value: unknown,
): FocusCycleProjection {
  const label = "FocusCycleProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "focusCycleId",
      "workId",
      "sessionId",
      "state",
      "phaseRef",
      "targetDurationMs",
      "startedAt",
      "deadlineAt",
      "completedAt",
      "note",
    ],
    label,
  );
  schema(input, label);
  if (input.state !== "running" && input.state !== "stopped") {
    throw new Error(`${label}.state is invalid`);
  }
  const sessionId = nullableString(input, "sessionId", label);
  return Object.freeze({
    schemaVersion: 1,
    focusCycleId: id<"FocusCycle">(input, "focusCycleId", label),
    workId: id<"Work">(input, "workId", label),
    sessionId:
      sessionId === null ? null : entityId<"WritingSession">(sessionId),
    state: input.state,
    phaseRef: nonEmptyString(input, "phaseRef", label),
    targetDurationMs: duration(input, "targetDurationMs", label, false),
    startedAt: nonEmptyString(input, "startedAt", label),
    deadlineAt: nonEmptyString(input, "deadlineAt", label),
    completedAt: nullableString(input, "completedAt", label),
    note: stringValue(input, "note", label),
  });
}

export function parseWorkActivityProjection(
  value: unknown,
): WorkActivityProjection {
  const label = "WorkActivityProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "activeSessionId",
      "activeFocusCycleId",
      "sessions",
      "focusCycles",
    ],
    label,
  );
  schema(input, label);
  if (!Array.isArray(input.sessions) || !Array.isArray(input.focusCycles)) {
    throw new Error(`${label} lists must be arrays`);
  }
  const workId = id<"Work">(input, "workId", label);
  const activeSessionId = nullableString(input, "activeSessionId", label);
  const activeFocusCycleId = nullableString(
    input,
    "activeFocusCycleId",
    label,
  );
  const sessions = Object.freeze(
    input.sessions.map((session, index) => {
      const parsed = parseWritingSessionProjection(session);
      if (parsed.workId !== workId) {
        throw new Error(`${label}.sessions[${index}] is outside its Work`);
      }
      return parsed;
    }),
  );
  const focusCycles = Object.freeze(
    input.focusCycles.map((cycle, index) => {
      const parsed = parseFocusCycleProjection(cycle);
      if (parsed.workId !== workId) {
        throw new Error(`${label}.focusCycles[${index}] is outside its Work`);
      }
      return parsed;
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    workId,
    activeSessionId:
      activeSessionId === null
        ? null
        : entityId<"WritingSession">(activeSessionId),
    activeFocusCycleId:
      activeFocusCycleId === null
        ? null
        : entityId<"FocusCycle">(activeFocusCycleId),
    sessions,
    focusCycles,
  });
}
