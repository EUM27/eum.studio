import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import type { WorkActivityProjection } from "./work-activity-contract";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type WorkRecordsGoals = {
  readonly dailyActiveMinutes: number | null;
  readonly dailyCharacters: number | null;
  readonly weeklyActiveMinutes: number | null;
  readonly weeklyCharacters: number | null;
};

export type GetWorkRecordsGoalsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveWorkRecordsGoalsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly expectedRevision: number;
  readonly goals: WorkRecordsGoals;
};

export type WorkRecordsGoalsProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly goals: WorkRecordsGoals;
};

export type WorkRecordsGoalProgressValue = {
  readonly value: number;
  readonly target: number | null;
  readonly ratio: number | null;
};

export type WorkRecordsGoalProgress = {
  readonly dailyActiveMinutes: WorkRecordsGoalProgressValue;
  readonly dailyCharacters: WorkRecordsGoalProgressValue;
  readonly weeklyActiveMinutes: WorkRecordsGoalProgressValue;
  readonly weeklyCharacters: WorkRecordsGoalProgressValue;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function readSchemaVersion(value: unknown, label: string): 1 {
  if (value !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  return 1;
}

function readRevision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function readGoal(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be null or a positive safe integer`);
  }
  return value as number;
}

export function createUnsetWorkRecordsGoals(): WorkRecordsGoals {
  return Object.freeze({
    dailyActiveMinutes: null,
    dailyCharacters: null,
    weeklyActiveMinutes: null,
    weeklyCharacters: null,
  });
}

export function parseWorkRecordsGoals(value: unknown): WorkRecordsGoals {
  const record = readRecord(value, "Work records goals");
  assertExactFields(
    record,
    [
      "dailyActiveMinutes",
      "dailyCharacters",
      "weeklyActiveMinutes",
      "weeklyCharacters",
    ],
    "Work records goals",
  );
  return Object.freeze({
    dailyActiveMinutes: readGoal(
      record.dailyActiveMinutes,
      "dailyActiveMinutes",
    ),
    dailyCharacters: readGoal(record.dailyCharacters, "dailyCharacters"),
    weeklyActiveMinutes: readGoal(
      record.weeklyActiveMinutes,
      "weeklyActiveMinutes",
    ),
    weeklyCharacters: readGoal(record.weeklyCharacters, "weeklyCharacters"),
  });
}

export function parseGetWorkRecordsGoalsCommand(
  value: unknown,
): GetWorkRecordsGoalsCommand {
  const record = readRecord(value, "Get Work records goals command");
  assertExactFields(
    record,
    ["schemaVersion", "workId"],
    "Get Work records goals command",
  );
  if (typeof record.workId !== "string" || record.workId.length === 0) {
    throw new Error("workId must be a non-empty string");
  }
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Get Work records goals command",
    ),
    workId: entityId<"Work">(record.workId),
  });
}

export function parseSaveWorkRecordsGoalsCommand(
  value: unknown,
): SaveWorkRecordsGoalsCommand {
  const record = readRecord(value, "Save Work records goals command");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "expectedRevision", "goals"],
    "Save Work records goals command",
  );
  if (typeof record.workId !== "string" || record.workId.length === 0) {
    throw new Error("workId must be a non-empty string");
  }
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Save Work records goals command",
    ),
    workId: entityId<"Work">(record.workId),
    expectedRevision: readRevision(record.expectedRevision, "expectedRevision"),
    goals: parseWorkRecordsGoals(record.goals),
  });
}

export function parseWorkRecordsGoalsProjection(
  value: unknown,
): WorkRecordsGoalsProjection {
  const record = readRecord(value, "Work records goals projection");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "revision", "goals"],
    "Work records goals projection",
  );
  if (typeof record.workId !== "string" || record.workId.length === 0) {
    throw new Error("workId must be a non-empty string");
  }
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Work records goals projection",
    ),
    workId: entityId<"Work">(record.workId),
    revision: readRevision(record.revision, "revision"),
    goals: parseWorkRecordsGoals(record.goals),
  });
}

function progress(
  value: number,
  target: number | null,
): WorkRecordsGoalProgressValue {
  return Object.freeze({
    value,
    target,
    ratio: target === null ? null : Math.max(0, value) / target,
  });
}

export function deriveWorkRecordsGoalProgress(input: {
  readonly workId: EntityId<"Work">;
  readonly activity: WorkActivityProjection;
  readonly settings: WorkRecordsGoalsProjection;
  readonly nowMs?: number;
  readonly calendar: {
    readonly today: string;
    readonly weekStart: string;
    readonly dateKey: (timestamp: string) => string;
  };
}): WorkRecordsGoalProgress {
  if (
    !DATE_KEY_PATTERN.test(input.calendar.today) ||
    !DATE_KEY_PATTERN.test(input.calendar.weekStart) ||
    input.calendar.weekStart > input.calendar.today
  ) {
    throw new Error("Work records goal calendar is invalid");
  }
  if (
    input.activity.workId !== input.workId ||
    input.settings.workId !== input.workId
  ) {
    throw new Error(`Work records goals are outside Work ${input.workId}`);
  }

  let dailyFocusDurationMs = 0;
  let dailyCharacters = 0;
  let weeklyFocusDurationMs = 0;
  let weeklyCharacters = 0;
  for (const session of input.activity.sessions) {
    if (session.workId !== input.workId) {
      throw new Error(`WritingSession ${session.sessionId} is outside Work`);
    }
    const date = input.calendar.dateKey(session.endedAt ?? session.startedAt);
    if (!DATE_KEY_PATTERN.test(date)) {
      throw new Error(`WritingSession ${session.sessionId} calendar date is invalid`);
    }
    if (date >= input.calendar.weekStart && date <= input.calendar.today) {
      weeklyFocusDurationMs +=
        session.state === "active" && Number.isFinite(input.nowMs)
          ? Math.max(
              session.activeDurationMs,
              (input.nowMs as number) - Date.parse(session.startedAt),
            )
          : session.activeDurationMs;
      weeklyCharacters += session.characterDelta ?? 0;
    }
    if (date === input.calendar.today) {
      dailyFocusDurationMs +=
        session.state === "active" && Number.isFinite(input.nowMs)
          ? Math.max(
              session.activeDurationMs,
              (input.nowMs as number) - Date.parse(session.startedAt),
            )
          : session.activeDurationMs;
      dailyCharacters += session.characterDelta ?? 0;
    }
  }

  for (const cycle of input.activity.focusCycles) {
    if (cycle.workId !== input.workId) {
      throw new Error(`FocusCycle ${cycle.focusCycleId} is outside Work`);
    }
  }

  return Object.freeze({
    dailyActiveMinutes: progress(
      Math.floor(dailyFocusDurationMs / 60_000),
      input.settings.goals.dailyActiveMinutes,
    ),
    dailyCharacters: progress(
      dailyCharacters,
      input.settings.goals.dailyCharacters,
    ),
    weeklyActiveMinutes: progress(
      Math.floor(weeklyFocusDurationMs / 60_000),
      input.settings.goals.weeklyActiveMinutes,
    ),
    weeklyCharacters: progress(
      weeklyCharacters,
      input.settings.goals.weeklyCharacters,
    ),
  });
}
