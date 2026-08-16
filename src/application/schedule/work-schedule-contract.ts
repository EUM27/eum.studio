import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import {
  parseWorkEpisodeCharacterProgress,
  type WorkEpisodeCharacterProgress,
} from "../settings/app-settings";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const TIME_KEY = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const DAY_MS = 86_400_000;

export type WorkScheduleDateRange = {
  readonly from: string;
  readonly to: string;
};

export type WorkScheduleTaskInput = {
  readonly kind: "task";
  readonly label: string;
  readonly date: string;
  readonly time: string | null;
};

export type WorkScheduleRoutineInput = {
  readonly kind: "routine";
  readonly label: string;
  readonly startDate: string;
  readonly time: string | null;
};

export type WorkScheduleDdayWorkload =
  | { readonly mode: "none" }
  | {
      readonly mode: "totalCharacters";
      readonly targetCharacters: number;
    }
  | {
      readonly mode: "episodeCount";
      readonly targetEpisodeCount: number;
      readonly baselineCompletedCount: number;
    }
  | {
      readonly mode: "episodeNumber";
      readonly targetEpisodeNumber: number;
    };

export type WorkScheduleDdayInput = {
  readonly kind: "dday";
  readonly label: string;
  readonly date: string;
  readonly time: string | null;
  readonly workload: WorkScheduleDdayWorkload;
};

export type WorkScheduleItemInput =
  | WorkScheduleTaskInput
  | WorkScheduleRoutineInput
  | WorkScheduleDdayInput;

type WorkScheduleItemBase = {
  readonly schemaVersion: 1;
  readonly itemId: EntityId<"WorkScheduleItem">;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly label: string;
  readonly time: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WorkScheduleTaskProjection = WorkScheduleItemBase & {
  readonly kind: "task";
  readonly date: string;
  readonly completedAt: string | null;
};

export type WorkScheduleRoutineProjection = WorkScheduleItemBase & {
  readonly kind: "routine";
  readonly startDate: string;
};

export type WorkScheduleDdayProjection = WorkScheduleItemBase & {
  readonly kind: "dday";
  readonly date: string;
  readonly workload: WorkScheduleDdayWorkload;
};

export type WorkScheduleItemProjection =
  | WorkScheduleTaskProjection
  | WorkScheduleRoutineProjection
  | WorkScheduleDdayProjection;

export type WorkRoutineCompletion = {
  readonly itemId: EntityId<"WorkScheduleItem">;
  readonly date: string;
  readonly completedAt: string;
};

export type WorkScheduleOccurrence = {
  readonly occurrenceId: string;
  readonly itemId: EntityId<"WorkScheduleItem">;
  readonly workId: EntityId<"Work">;
  readonly kind: "task" | "routine";
  readonly label: string;
  readonly date: string;
  readonly time: string | null;
  readonly completed: boolean;
  readonly completedAt: string | null;
};

export type WorkScheduleProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly range: WorkScheduleDateRange;
  readonly items: readonly WorkScheduleItemProjection[];
  readonly occurrences: readonly WorkScheduleOccurrence[];
  readonly episodeProgress: WorkEpisodeCharacterProgress;
};

export type ListWorkScheduleCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly range: WorkScheduleDateRange;
};

export type CreateWorkScheduleItemCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly item: WorkScheduleItemInput;
};

export type UpdateWorkScheduleItemCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly itemId: EntityId<"WorkScheduleItem">;
  readonly expectedRevision: number;
  readonly item: WorkScheduleItemInput;
};

export type RetireWorkScheduleItemCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly itemId: EntityId<"WorkScheduleItem">;
  readonly expectedRevision: number;
};

export type SetWorkScheduleCompletionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly itemId: EntityId<"WorkScheduleItem">;
  readonly expectedRevision: number;
  readonly date: string;
  readonly completed: boolean;
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
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(value: unknown, label: string): 1 {
  if (value !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return 1;
}

function identity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function revision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} must not be blank`);
  return normalized;
}

function date(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a date key`);
  const match = DATE_KEY.exec(value);
  if (match === null) throw new Error(`${label} must use YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a real calendar date`);
  }
  return value;
}

function time(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !TIME_KEY.test(value)) {
    throw new Error(`${label} must be null or HH:mm`);
  }
  return value;
}

function instant(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be an absolute instant`);
  }
  return new Date(value).toISOString();
}

function nullableInstant(value: unknown, label: string): string | null {
  return value === null ? null : instant(value, label);
}

export function parseWorkScheduleDateRange(
  value: unknown,
): WorkScheduleDateRange {
  const input = record(value, "Work schedule date range");
  exact(input, ["from", "to"], "Work schedule date range");
  const from = date(input.from, "Work schedule range.from");
  const to = date(input.to, "Work schedule range.to");
  if (from > to) throw new Error("Work schedule range.from must not follow to");
  return Object.freeze({ from, to });
}

export function parseWorkScheduleDdayWorkload(
  value: unknown,
): WorkScheduleDdayWorkload {
  const input = record(value, "D-DAY workload");
  switch (input.mode) {
    case "none":
      exact(input, ["mode"], "D-DAY workload");
      return Object.freeze({ mode: "none" });
    case "totalCharacters":
      exact(input, ["mode", "targetCharacters"], "D-DAY workload");
      return Object.freeze({
        mode: "totalCharacters",
        targetCharacters: positiveInteger(
          input.targetCharacters,
          "D-DAY workload.targetCharacters",
        ),
      });
    case "episodeCount":
      exact(
        input,
        ["mode", "targetEpisodeCount", "baselineCompletedCount"],
        "D-DAY workload",
      );
      return Object.freeze({
        mode: "episodeCount",
        targetEpisodeCount: positiveInteger(
          input.targetEpisodeCount,
          "D-DAY workload.targetEpisodeCount",
        ),
        baselineCompletedCount: nonNegativeInteger(
          input.baselineCompletedCount,
          "D-DAY workload.baselineCompletedCount",
        ),
      });
    case "episodeNumber":
      exact(input, ["mode", "targetEpisodeNumber"], "D-DAY workload");
      return Object.freeze({
        mode: "episodeNumber",
        targetEpisodeNumber: positiveInteger(
          input.targetEpisodeNumber,
          "D-DAY workload.targetEpisodeNumber",
        ),
      });
    default:
      throw new Error("Unsupported D-DAY workload mode");
  }
}

export function parseWorkScheduleItemInput(
  value: unknown,
): WorkScheduleItemInput {
  const input = record(value, "Work schedule item");
  switch (input.kind) {
    case "task":
      exact(input, ["kind", "label", "date", "time"], "Schedule task");
      return Object.freeze({
        kind: "task",
        label: text(input.label, "Schedule task.label"),
        date: date(input.date, "Schedule task.date"),
        time: time(input.time, "Schedule task.time"),
      });
    case "routine":
      exact(
        input,
        ["kind", "label", "startDate", "time"],
        "Schedule routine",
      );
      return Object.freeze({
        kind: "routine",
        label: text(input.label, "Schedule routine.label"),
        startDate: date(input.startDate, "Schedule routine.startDate"),
        time: time(input.time, "Schedule routine.time"),
      });
    case "dday":
      exact(
        input,
        ["kind", "label", "date", "time", "workload"],
        "Schedule D-DAY",
      );
      return Object.freeze({
        kind: "dday",
        label: text(input.label, "Schedule D-DAY.label"),
        date: date(input.date, "Schedule D-DAY.date"),
        time: time(input.time, "Schedule D-DAY.time"),
        workload: parseWorkScheduleDdayWorkload(input.workload),
      });
    default:
      throw new Error("Unsupported Work schedule item kind");
  }
}

export function parseListWorkScheduleCommand(
  value: unknown,
): ListWorkScheduleCommand {
  const input = record(value, "ListWorkScheduleCommand");
  exact(input, ["schemaVersion", "workId", "range"], "ListWorkScheduleCommand");
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "ListWorkScheduleCommand"),
    workId: identity<"Work">(input.workId, "ListWorkScheduleCommand.workId"),
    range: parseWorkScheduleDateRange(input.range),
  });
}

export function parseCreateWorkScheduleItemCommand(
  value: unknown,
): CreateWorkScheduleItemCommand {
  const input = record(value, "CreateWorkScheduleItemCommand");
  exact(
    input,
    ["schemaVersion", "workId", "item"],
    "CreateWorkScheduleItemCommand",
  );
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "CreateWorkScheduleItemCommand"),
    workId: identity<"Work">(
      input.workId,
      "CreateWorkScheduleItemCommand.workId",
    ),
    item: parseWorkScheduleItemInput(input.item),
  });
}

export function parseUpdateWorkScheduleItemCommand(
  value: unknown,
): UpdateWorkScheduleItemCommand {
  const input = record(value, "UpdateWorkScheduleItemCommand");
  exact(
    input,
    ["schemaVersion", "workId", "itemId", "expectedRevision", "item"],
    "UpdateWorkScheduleItemCommand",
  );
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "UpdateWorkScheduleItemCommand"),
    workId: identity<"Work">(
      input.workId,
      "UpdateWorkScheduleItemCommand.workId",
    ),
    itemId: identity<"WorkScheduleItem">(
      input.itemId,
      "UpdateWorkScheduleItemCommand.itemId",
    ),
    expectedRevision: revision(
      input.expectedRevision,
      "UpdateWorkScheduleItemCommand.expectedRevision",
    ),
    item: parseWorkScheduleItemInput(input.item),
  });
}

export function parseRetireWorkScheduleItemCommand(
  value: unknown,
): RetireWorkScheduleItemCommand {
  const input = record(value, "RetireWorkScheduleItemCommand");
  exact(
    input,
    ["schemaVersion", "workId", "itemId", "expectedRevision"],
    "RetireWorkScheduleItemCommand",
  );
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "RetireWorkScheduleItemCommand"),
    workId: identity<"Work">(
      input.workId,
      "RetireWorkScheduleItemCommand.workId",
    ),
    itemId: identity<"WorkScheduleItem">(
      input.itemId,
      "RetireWorkScheduleItemCommand.itemId",
    ),
    expectedRevision: revision(
      input.expectedRevision,
      "RetireWorkScheduleItemCommand.expectedRevision",
    ),
  });
}

export function parseSetWorkScheduleCompletionCommand(
  value: unknown,
): SetWorkScheduleCompletionCommand {
  const input = record(value, "SetWorkScheduleCompletionCommand");
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "itemId",
      "expectedRevision",
      "date",
      "completed",
    ],
    "SetWorkScheduleCompletionCommand",
  );
  if (typeof input.completed !== "boolean") {
    throw new Error("SetWorkScheduleCompletionCommand.completed must be boolean");
  }
  return Object.freeze({
    schemaVersion: schema(
      input.schemaVersion,
      "SetWorkScheduleCompletionCommand",
    ),
    workId: identity<"Work">(
      input.workId,
      "SetWorkScheduleCompletionCommand.workId",
    ),
    itemId: identity<"WorkScheduleItem">(
      input.itemId,
      "SetWorkScheduleCompletionCommand.itemId",
    ),
    expectedRevision: revision(
      input.expectedRevision,
      "SetWorkScheduleCompletionCommand.expectedRevision",
    ),
    date: date(input.date, "SetWorkScheduleCompletionCommand.date"),
    completed: input.completed,
  });
}

export function parseWorkScheduleItemProjection(
  value: unknown,
): WorkScheduleItemProjection {
  const input = record(value, "Work schedule item projection");
  const commonFields = [
    "schemaVersion",
    "itemId",
    "workId",
    "revision",
    "kind",
    "label",
    "time",
    "createdAt",
    "updatedAt",
  ] as const;
  const base = {
    schemaVersion: schema(input.schemaVersion, "Work schedule item projection"),
    itemId: identity<"WorkScheduleItem">(
      input.itemId,
      "Work schedule item projection.itemId",
    ),
    workId: identity<"Work">(
      input.workId,
      "Work schedule item projection.workId",
    ),
    revision: revision(
      input.revision,
      "Work schedule item projection.revision",
    ),
    label: text(input.label, "Work schedule item projection.label"),
    time: time(input.time, "Work schedule item projection.time"),
    createdAt: instant(
      input.createdAt,
      "Work schedule item projection.createdAt",
    ),
    updatedAt: instant(
      input.updatedAt,
      "Work schedule item projection.updatedAt",
    ),
  } as const;
  switch (input.kind) {
    case "task":
      exact(
        input,
        [...commonFields, "date", "completedAt"],
        "Work schedule task projection",
      );
      return Object.freeze({
        ...base,
        kind: "task",
        date: date(input.date, "Work schedule task projection.date"),
        completedAt: nullableInstant(
          input.completedAt,
          "Work schedule task projection.completedAt",
        ),
      });
    case "routine":
      exact(
        input,
        [...commonFields, "startDate"],
        "Work schedule routine projection",
      );
      return Object.freeze({
        ...base,
        kind: "routine",
        startDate: date(
          input.startDate,
          "Work schedule routine projection.startDate",
        ),
      });
    case "dday":
      exact(
        input,
        [...commonFields, "date", "workload"],
        "Work schedule D-DAY projection",
      );
      return Object.freeze({
        ...base,
        kind: "dday",
        date: date(input.date, "Work schedule D-DAY projection.date"),
        workload: parseWorkScheduleDdayWorkload(input.workload),
      });
    default:
      throw new Error("Unsupported Work schedule item projection kind");
  }
}

function parseOccurrence(value: unknown): WorkScheduleOccurrence {
  const input = record(value, "Work schedule occurrence");
  exact(
    input,
    [
      "occurrenceId",
      "itemId",
      "workId",
      "kind",
      "label",
      "date",
      "time",
      "completed",
      "completedAt",
    ],
    "Work schedule occurrence",
  );
  if (input.kind !== "task" && input.kind !== "routine") {
    throw new Error("Work schedule occurrence kind must be task or routine");
  }
  if (typeof input.occurrenceId !== "string" || input.occurrenceId.length === 0) {
    throw new Error("Work schedule occurrence.occurrenceId must be non-empty");
  }
  if (typeof input.completed !== "boolean") {
    throw new Error("Work schedule occurrence.completed must be boolean");
  }
  return Object.freeze({
    occurrenceId: input.occurrenceId,
    itemId: identity<"WorkScheduleItem">(
      input.itemId,
      "Work schedule occurrence.itemId",
    ),
    workId: identity<"Work">(input.workId, "Work schedule occurrence.workId"),
    kind: input.kind,
    label: text(input.label, "Work schedule occurrence.label"),
    date: date(input.date, "Work schedule occurrence.date"),
    time: time(input.time, "Work schedule occurrence.time"),
    completed: input.completed,
    completedAt: nullableInstant(
      input.completedAt,
      "Work schedule occurrence.completedAt",
    ),
  });
}

export function parseWorkScheduleProjection(
  value: unknown,
): WorkScheduleProjection {
  const input = record(value, "Work schedule projection");
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "range",
      "items",
      "occurrences",
      "episodeProgress",
    ],
    "Work schedule projection",
  );
  if (!Array.isArray(input.items) || !Array.isArray(input.occurrences)) {
    throw new Error("Work schedule projection collections must be arrays");
  }
  const workId = identity<"Work">(input.workId, "Work schedule projection.workId");
  const items = input.items.map(parseWorkScheduleItemProjection);
  const occurrences = input.occurrences.map(parseOccurrence);
  if (
    items.some((item) => item.workId !== workId) ||
    occurrences.some((item) => item.workId !== workId)
  ) {
    throw new Error("Work schedule projection crosses the Work boundary");
  }
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "Work schedule projection"),
    workId,
    range: parseWorkScheduleDateRange(input.range),
    items: Object.freeze(items),
    occurrences: Object.freeze(occurrences),
    episodeProgress: parseWorkEpisodeCharacterProgress(input.episodeProgress),
  });
}

function dateEpoch(dateKey: string): number {
  const match = DATE_KEY.exec(dateKey);
  if (match === null) throw new Error("Invalid date key");
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

export function deriveWorkScheduleOccurrences(input: {
  readonly workId: EntityId<"Work">;
  readonly range: WorkScheduleDateRange;
  readonly items: readonly WorkScheduleItemProjection[];
  readonly routineCompletions: readonly WorkRoutineCompletion[];
}): readonly WorkScheduleOccurrence[] {
  const range = parseWorkScheduleDateRange(input.range);
  if (input.items.some((item) => item.workId !== input.workId)) {
    throw new Error("Cannot derive occurrences across the Work boundary");
  }
  const completions = new Map<string, string>();
  for (const completion of input.routineCompletions) {
    const completionDate = date(completion.date, "Routine completion.date");
    const completedAt = instant(
      completion.completedAt,
      "Routine completion.completedAt",
    );
    const key = `${completion.itemId}:${completionDate}`;
    if (completions.has(key)) {
      throw new Error(`Duplicate routine completion: ${key}`);
    }
    completions.set(key, completedAt);
  }

  const occurrences: WorkScheduleOccurrence[] = [];
  for (const item of input.items) {
    if (item.kind === "task") {
      if (item.date >= range.from && item.date <= range.to) {
        occurrences.push({
          occurrenceId: `task:${item.itemId}`,
          itemId: item.itemId,
          workId: input.workId,
          kind: "task",
          label: item.label,
          date: item.date,
          time: item.time,
          completed: item.completedAt !== null,
          completedAt: item.completedAt,
        });
      }
      continue;
    }
    if (item.kind !== "routine") continue;
    const firstDate = item.startDate > range.from ? item.startDate : range.from;
    for (
      let epoch = dateEpoch(firstDate), end = dateEpoch(range.to);
      epoch <= end;
      epoch += DAY_MS
    ) {
      const occurrenceDate = formatDate(epoch);
      const completedAt =
        completions.get(`${item.itemId}:${occurrenceDate}`) ?? null;
      occurrences.push({
        occurrenceId: `routine:${item.itemId}:${occurrenceDate}`,
        itemId: item.itemId,
        workId: input.workId,
        kind: "routine",
        label: item.label,
        date: occurrenceDate,
        time: item.time,
        completed: completedAt !== null,
        completedAt,
      });
    }
  }
  occurrences.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.time ?? "").localeCompare(right.time ?? "") ||
      left.label.localeCompare(right.label) ||
      left.occurrenceId.localeCompare(right.occurrenceId),
  );
  return Object.freeze(occurrences.map((item) => Object.freeze(item)));
}
