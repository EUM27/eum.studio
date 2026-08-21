import type {
  WorkScheduleDdayProjection,
} from "../../application/schedule/work-schedule-contract";
import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { WorkHeaderScheduleSummary } from "../workspace/WorkHeader";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function utcDay(dateKey: string): number {
  const match = DATE_KEY.exec(dateKey);
  if (match === null) throw new Error(`Invalid schedule date: ${dateKey}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function deriveWorkScheduleSummary(
  projection: WorkCalendarProjection,
  today = localDateKey(),
): WorkHeaderScheduleSummary {
  const nearestDday = projection.items
    .filter(
      (item): item is WorkScheduleDdayProjection =>
        item.kind === "dday" && item.date >= today,
    )
    .sort((left, right) => left.date.localeCompare(right.date))[0];

  return Object.freeze({
    todayCount: projection.occurrences.filter(
      (occurrence) => occurrence.date === today && !occurrence.completed,
    ).length,
    nearestDday: nearestDday === undefined
      ? null
      : Object.freeze({
          label: nearestDday.label,
          days: Math.round((utcDay(nearestDday.date) - utcDay(today)) / 86_400_000),
        }),
  });
}
