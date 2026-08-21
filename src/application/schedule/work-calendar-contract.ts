import type { WorkEpisodeCharacterProgress } from "../settings/app-settings";
import {
  parseWorkScheduleProjection,
  type WorkScheduleDateRange,
  type WorkScheduleItemProjection,
  type WorkScheduleOccurrence,
} from "./work-schedule-contract";
import {
  parseDocumentCompletionOccurrence,
  type DocumentCompletionOccurrence,
} from "../workspace/document-completion";
import type { EntityId } from "../../domain/writing";

export type WorkCalendarOccurrence =
  | WorkScheduleOccurrence
  | DocumentCompletionOccurrence;

export type WorkCalendarProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly range: WorkScheduleDateRange;
  readonly items: readonly WorkScheduleItemProjection[];
  readonly occurrences: readonly WorkCalendarOccurrence[];
  readonly episodeProgress: WorkEpisodeCharacterProgress;
  readonly completedDocumentCount: number;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Work calendar projection must be an object");
  }
  return value as Record<string, unknown>;
}

export function parseWorkCalendarProjection(
  value: unknown,
): WorkCalendarProjection {
  const input = record(value);
  const fields = [
    "schemaVersion",
    "workId",
    "range",
    "items",
    "occurrences",
    "episodeProgress",
    "completedDocumentCount",
  ];
  if (
    Object.keys(input).length !== fields.length ||
    Object.keys(input).some((field) => !fields.includes(field)) ||
    !Array.isArray(input.occurrences)
  ) {
    throw new Error("Work calendar projection fields do not match the schema");
  }
  const scheduleOccurrences = input.occurrences.filter((occurrence) =>
    record(occurrence).kind !== "document-completion"
  );
  const schedule = parseWorkScheduleProjection({
    schemaVersion: input.schemaVersion,
    workId: input.workId,
    range: input.range,
    items: input.items,
    occurrences: scheduleOccurrences,
    episodeProgress: input.episodeProgress,
  });
  const completionOccurrences = input.occurrences
    .filter((occurrence) => record(occurrence).kind === "document-completion")
    .map(parseDocumentCompletionOccurrence);
  if (completionOccurrences.some((occurrence) => occurrence.workId !== schedule.workId)) {
    throw new Error("Work calendar completion crosses the Work boundary");
  }
  if (
    !Number.isSafeInteger(input.completedDocumentCount) ||
    (input.completedDocumentCount as number) < 0
  ) {
    throw new Error("Work calendar completedDocumentCount must be non-negative");
  }
  const occurrences = Object.freeze([
    ...schedule.occurrences,
    ...completionOccurrences,
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.time ?? "").localeCompare(right.time ?? "") ||
      left.label.localeCompare(right.label) ||
      left.occurrenceId.localeCompare(right.occurrenceId),
  ));
  return Object.freeze({
    schemaVersion: 1,
    workId: schedule.workId,
    range: schedule.range,
    items: schedule.items,
    occurrences,
    episodeProgress: schedule.episodeProgress,
    completedDocumentCount: input.completedDocumentCount as number,
  });
}
