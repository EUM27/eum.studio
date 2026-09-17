import { entityId, type EntityId } from "../../domain/writing";
import {
  parseWorkCalendarProjection,
  type WorkCalendarProjection,
} from "../schedule/work-calendar-contract";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/u;

export type GetStudioTodayCommand = {
  readonly schemaVersion: 1;
  readonly date: string;
};

export type StudioTodayWorkCalendar = {
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly calendar: WorkCalendarProjection;
};

export type StudioTodayProjection = {
  readonly schemaVersion: 1;
  readonly date: string;
  readonly works: readonly StudioTodayWorkCalendar[];
  readonly completedDocumentCount: number;
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

function dateKey(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a date`);
  const match = DATE_KEY.exec(value);
  if (match === null) throw new Error(`${label} must use YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a real calendar date`);
  }
  return value;
}

export function parseGetStudioTodayCommand(
  value: unknown,
): GetStudioTodayCommand {
  const input = record(value, "GetStudioTodayCommand");
  exact(input, ["schemaVersion", "date"], "GetStudioTodayCommand");
  if (input.schemaVersion !== 1) {
    throw new Error("GetStudioTodayCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    date: dateKey(input.date, "GetStudioTodayCommand.date"),
  });
}

export function parseStudioTodayProjection(
  value: unknown,
): StudioTodayProjection {
  const input = record(value, "StudioTodayProjection");
  exact(
    input,
    ["schemaVersion", "date", "works", "completedDocumentCount"],
    "StudioTodayProjection",
  );
  if (input.schemaVersion !== 1 || !Array.isArray(input.works)) {
    throw new Error("StudioTodayProjection schema is invalid");
  }
  const date = dateKey(input.date, "StudioTodayProjection.date");
  const seen = new Set<string>();
  const works = input.works.map((value) => {
    const work = record(value, "StudioTodayWorkCalendar");
    exact(
      work,
      ["workId", "workTitle", "calendar"],
      "StudioTodayWorkCalendar",
    );
    if (
      typeof work.workId !== "string" ||
      work.workId.length === 0 ||
      typeof work.workTitle !== "string" ||
      work.workTitle.trim().length === 0
    ) {
      throw new Error("StudioTodayWorkCalendar identity is invalid");
    }
    const workId = entityId<"Work">(work.workId);
    if (seen.has(workId)) {
      throw new Error(`Duplicate Studio Today Work: ${workId}`);
    }
    seen.add(workId);
    const calendar = parseWorkCalendarProjection(work.calendar);
    if (
      calendar.workId !== workId ||
      calendar.range.from !== date ||
      calendar.range.to !== date
    ) {
      throw new Error("Studio Today calendar crosses its Work or date boundary");
    }
    return Object.freeze({
      workId,
      workTitle: work.workTitle.trim(),
      calendar,
    });
  });
  const derivedCompletedDocumentCount = works.reduce(
    (total, work) =>
      total +
      work.calendar.occurrences.filter(
        (occurrence) => occurrence.kind === "document-completion",
      ).length,
    0,
  );
  if (input.completedDocumentCount !== derivedCompletedDocumentCount) {
    throw new Error("StudioTodayProjection completed count is not derived");
  }
  return Object.freeze({
    schemaVersion: 1,
    date,
    works: Object.freeze(works),
    completedDocumentCount: derivedCompletedDocumentCount,
  });
}

export function projectStudioToday(input: {
  readonly date: string;
  readonly works: readonly StudioTodayWorkCalendar[];
}): StudioTodayProjection {
  const completedDocumentCount = input.works.reduce(
    (total, work) =>
      total +
      work.calendar.occurrences.filter(
        (occurrence) => occurrence.kind === "document-completion",
      ).length,
    0,
  );
  return parseStudioTodayProjection({
    schemaVersion: 1,
    date: input.date,
    works: input.works,
    completedDocumentCount,
  });
}
