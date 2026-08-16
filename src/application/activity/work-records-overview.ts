import type { EntityId } from "../../domain/writing";
import type {
  WorkActivityProjection,
  WritingSessionProjection,
} from "./work-activity-contract";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DAY_MS = 24 * 60 * 60 * 1_000;

export type WorkRecordsDocumentInput = {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
};

export type WorkRecordsSessionRow = Pick<
  WritingSessionProjection,
  | "sessionId"
  | "documentId"
  | "state"
  | "startedAt"
  | "endedAt"
  | "activeDurationMs"
  | "characterDelta"
  | "note"
> & {
  readonly documentTitle: string | null;
  readonly date: string;
};

export type WorkRecordsOverviewProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly filter: {
    readonly fromDate: string;
    readonly toDate: string;
  };
  readonly totals: {
    readonly sessionCount: number;
    readonly activeDurationMs: number;
    readonly characterDelta: number;
    readonly characterDeltaKnownCount: number;
    readonly focusCycleCount: number;
  };
  readonly streak: {
    readonly currentDays: number;
    readonly longestDays: number;
  };
  readonly days: readonly {
    readonly date: string;
    readonly sessionCount: number;
    readonly activeDurationMs: number;
    readonly characterDelta: number;
  }[];
  readonly documents: readonly {
    readonly documentId: EntityId<"Document">;
    readonly title: string;
    readonly sessionCount: number;
    readonly activeDurationMs: number;
    readonly characterDelta: number;
    readonly characterDeltaKnownCount: number;
  }[];
  readonly sessions: readonly WorkRecordsSessionRow[];
};

export type DeriveWorkRecordsOverviewInput = {
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly documents: readonly WorkRecordsDocumentInput[];
  readonly activity: WorkActivityProjection;
  readonly filter: {
    readonly fromDate: string;
    readonly toDate: string;
  };
  readonly calendar: {
    readonly today: string;
    readonly dateKey: (timestamp: string) => string;
  };
};

function assertDateKey(value: string, label: string, allowEmpty = false): void {
  if ((allowEmpty && value.length === 0) || DATE_KEY_PATTERN.test(value)) {
    return;
  }
  throw new Error(`${label} must be empty or YYYY-MM-DD`);
}

function dayOrdinal(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / DAY_MS);
}

function dateKeyFromOrdinal(ordinal: number): string {
  return new Date(ordinal * DAY_MS).toISOString().slice(0, 10);
}

function sessionDate(
  session: WritingSessionProjection,
  dateKey: (timestamp: string) => string,
): string {
  const value = dateKey(session.endedAt ?? session.startedAt);
  assertDateKey(value, `WritingSession ${session.sessionId} calendar date`);
  return value;
}

function inRange(
  date: string,
  filter: DeriveWorkRecordsOverviewInput["filter"],
): boolean {
  return (
    (filter.fromDate.length === 0 || date >= filter.fromDate) &&
    (filter.toDate.length === 0 || date <= filter.toDate)
  );
}

function deriveStreak(
  sessions: readonly WritingSessionProjection[],
  calendar: DeriveWorkRecordsOverviewInput["calendar"],
): WorkRecordsOverviewProjection["streak"] {
  const activeDays = new Set(
    sessions
      .filter(
        (session) =>
          session.activeDurationMs > 0 || session.characterDelta !== 0,
      )
      .map((session) => sessionDate(session, calendar.dateKey)),
  );
  if (activeDays.size === 0) {
    return Object.freeze({ currentDays: 0, longestDays: 0 });
  }
  const ordinals = [...activeDays]
    .map(dayOrdinal)
    .sort((left, right) => left - right);
  let longestDays = 0;
  let runDays = 0;
  let previous: number | null = null;
  for (const ordinal of ordinals) {
    runDays = previous !== null && ordinal === previous + 1 ? runDays + 1 : 1;
    longestDays = Math.max(longestDays, runDays);
    previous = ordinal;
  }
  const today = dayOrdinal(calendar.today);
  let cursor = activeDays.has(calendar.today) ? today : today - 1;
  let currentDays = 0;
  while (activeDays.has(dateKeyFromOrdinal(cursor))) {
    currentDays += 1;
    cursor -= 1;
  }
  return Object.freeze({ currentDays, longestDays });
}

export function deriveWorkRecordsOverview(
  input: DeriveWorkRecordsOverviewInput,
): WorkRecordsOverviewProjection {
  assertDateKey(input.filter.fromDate, "filter.fromDate", true);
  assertDateKey(input.filter.toDate, "filter.toDate", true);
  assertDateKey(input.calendar.today, "calendar.today");
  if (
    input.filter.fromDate.length > 0 &&
    input.filter.toDate.length > 0 &&
    input.filter.fromDate > input.filter.toDate
  ) {
    throw new Error("filter.fromDate must not be after filter.toDate");
  }
  if (input.activity.workId !== input.workId) {
    throw new Error(`Work activity is outside Work ${input.workId}`);
  }

  const documentsById = new Map<
    EntityId<"Document">,
    WorkRecordsDocumentInput
  >();
  for (const document of input.documents) {
    if (documentsById.has(document.documentId)) {
      throw new Error(`Duplicate Document ${document.documentId}`);
    }
    documentsById.set(document.documentId, document);
  }
  const sessionsById = new Map(
    input.activity.sessions.map((session) => [session.sessionId, session] as const),
  );
  for (const session of input.activity.sessions) {
    if (session.workId !== input.workId) {
      throw new Error(`WritingSession ${session.sessionId} is outside Work`);
    }
    if (
      session.documentId !== null &&
      !documentsById.has(session.documentId)
    ) {
      throw new Error(
        `WritingSession ${session.sessionId} references unknown Document ${session.documentId}`,
      );
    }
  }
  for (const cycle of input.activity.focusCycles) {
    if (cycle.workId !== input.workId) {
      throw new Error(`FocusCycle ${cycle.focusCycleId} is outside Work`);
    }
    if (cycle.sessionId !== null && !sessionsById.has(cycle.sessionId)) {
      throw new Error(
        `FocusCycle ${cycle.focusCycleId} references unknown WritingSession ${cycle.sessionId}`,
      );
    }
  }

  const filteredSessions = input.activity.sessions
    .map((session) => ({
      session,
      date: sessionDate(session, input.calendar.dateKey),
    }))
    .filter(({ date }) => inRange(date, input.filter));
  const filteredFocusCycles = input.activity.focusCycles.filter((cycle) => {
    const date = input.calendar.dateKey(cycle.startedAt);
    assertDateKey(date, `FocusCycle ${cycle.focusCycleId} calendar date`);
    return inRange(date, input.filter);
  });
  const characterDeltaKnown = filteredSessions.filter(
    ({ session }) => session.characterDelta !== null,
  );

  const valuesByDate = new Map<
    string,
    { sessionCount: number; activeDurationMs: number; characterDelta: number }
  >();
  for (const { session, date } of filteredSessions) {
    const current = valuesByDate.get(date) ?? {
      sessionCount: 0,
      activeDurationMs: 0,
      characterDelta: 0,
    };
    valuesByDate.set(date, {
      sessionCount: current.sessionCount + 1,
      activeDurationMs: current.activeDurationMs + session.activeDurationMs,
      characterDelta: current.characterDelta + (session.characterDelta ?? 0),
    });
  }
  const orderedDates = [...valuesByDate.keys()].sort();
  const days: Array<WorkRecordsOverviewProjection["days"][number]> = [];
  if (orderedDates.length > 0) {
    const first = dayOrdinal(orderedDates[0]!);
    const last = dayOrdinal(orderedDates[orderedDates.length - 1]!);
    for (let ordinal = first; ordinal <= last; ordinal += 1) {
      const date = dateKeyFromOrdinal(ordinal);
      const value = valuesByDate.get(date) ?? {
        sessionCount: 0,
        activeDurationMs: 0,
        characterDelta: 0,
      };
      days.push(Object.freeze({ date, ...value }));
    }
  }

  const documents = input.documents.map((document) => {
    const matching = filteredSessions.filter(
      ({ session }) => session.documentId === document.documentId,
    );
    const known = matching.filter(
      ({ session }) => session.characterDelta !== null,
    );
    return Object.freeze({
      documentId: document.documentId,
      title: document.title,
      sessionCount: matching.length,
      activeDurationMs: matching.reduce(
        (total, { session }) => total + session.activeDurationMs,
        0,
      ),
      characterDelta: known.reduce(
        (total, { session }) => total + (session.characterDelta ?? 0),
        0,
      ),
      characterDeltaKnownCount: known.length,
    });
  });
  const sessions = filteredSessions
    .map(({ session, date }) => Object.freeze({
      sessionId: session.sessionId,
      documentId: session.documentId,
      documentTitle:
        session.documentId === null
          ? null
          : (documentsById.get(session.documentId)?.title ?? null),
      state: session.state,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      activeDurationMs: session.activeDurationMs,
      characterDelta: session.characterDelta,
      note: session.note,
      date,
    }))
    .sort(
      (left, right) =>
        Date.parse(right.startedAt) - Date.parse(left.startedAt),
    );

  return Object.freeze({
    schemaVersion: 1,
    workId: input.workId,
    workTitle: input.workTitle,
    filter: Object.freeze({ ...input.filter }),
    totals: Object.freeze({
      sessionCount: filteredSessions.length,
      activeDurationMs: filteredSessions.reduce(
        (total, { session }) => total + session.activeDurationMs,
        0,
      ),
      characterDelta: characterDeltaKnown.reduce(
        (total, { session }) => total + (session.characterDelta ?? 0),
        0,
      ),
      characterDeltaKnownCount: characterDeltaKnown.length,
      focusCycleCount: filteredFocusCycles.length,
    }),
    streak: deriveStreak(input.activity.sessions, input.calendar),
    days: Object.freeze(days),
    documents: Object.freeze(documents),
    sessions: Object.freeze(sessions),
  });
}
