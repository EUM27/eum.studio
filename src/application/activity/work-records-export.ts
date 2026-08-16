import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import type {
  WorkActivityProjection,
  WritingSessionProjection,
} from "./work-activity-contract";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const WINDOWS_INVALID_FILE_NAME_CHARACTERS = new Set('<>:"/\\|?*');

export type WorkRecordsExportFormat = "json" | "csv";

export type ExportWorkRecordsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly format: WorkRecordsExportFormat;
  readonly fromDate: string;
  readonly toDate: string;
};

export type PreparedWorkRecordsExport = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly format: WorkRecordsExportFormat;
  readonly suggestedFileName: string;
  readonly mediaType: "application/json" | "text/csv";
  readonly text: string;
  readonly sessionCount: number;
};

export type ExportWorkRecordsResult =
  | Readonly<{
      schemaVersion: 1;
      status: "completed";
      byteLength: number;
      sessionCount: number;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "cancelled";
    }>;

export type PrepareWorkRecordsExportInput = {
  readonly command: ExportWorkRecordsCommand;
  readonly workTitle: string;
  readonly documents: readonly {
    readonly documentId: EntityId<"Document">;
    readonly title: string;
  }[];
  readonly activity: WorkActivityProjection;
  readonly dateKey: (timestamp: string) => string;
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

function requiredString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function dateFilter(
  input: Record<string, unknown>,
  field: "fromDate" | "toDate",
  label: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    (value.length > 0 && !DATE_KEY_PATTERN.test(value))
  ) {
    throw new Error(`${label}.${field} must be empty or YYYY-MM-DD`);
  }
  return value;
}

export function parseExportWorkRecordsCommand(
  value: unknown,
): ExportWorkRecordsCommand {
  const label = "ExportWorkRecordsCommand";
  const input = record(value, label);
  exact(
    input,
    ["schemaVersion", "workId", "format", "fromDate", "toDate"],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  if (input.format !== "json" && input.format !== "csv") {
    throw new Error(`${label}.format must be json or csv`);
  }
  const fromDate = dateFilter(input, "fromDate", label);
  const toDate = dateFilter(input, "toDate", label);
  if (fromDate.length > 0 && toDate.length > 0 && fromDate > toDate) {
    throw new Error(`${label} date range is reversed`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">(requiredString(input, "workId", label)),
    format: input.format,
    fromDate,
    toDate,
  });
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

export function parseExportWorkRecordsResult(
  value: unknown,
): ExportWorkRecordsResult {
  const label = "ExportWorkRecordsResult";
  const input = record(value, label);
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    if (input.schemaVersion !== 1) {
      throw new Error(`Unsupported ${label} schemaVersion`);
    }
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  exact(
    input,
    ["schemaVersion", "status", "byteLength", "sessionCount"],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  if (input.status !== "completed") {
    throw new Error(`${label}.status is invalid`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "completed",
    byteLength: nonNegativeInteger(input.byteLength, `${label}.byteLength`),
    sessionCount: nonNegativeInteger(
      input.sessionCount,
      `${label}.sessionCount`,
    ),
  });
}

function sessionDate(
  session: WritingSessionProjection,
  dateKey: (timestamp: string) => string,
): string {
  const value = dateKey(session.endedAt ?? session.startedAt);
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error(
      `WritingSession ${session.sessionId} calendar date must be YYYY-MM-DD`,
    );
  }
  return value;
}

function isSelectedDate(
  date: string,
  command: ExportWorkRecordsCommand,
): boolean {
  return (
    (command.fromDate.length === 0 || date >= command.fromDate) &&
    (command.toDate.length === 0 || date <= command.toDate)
  );
}

function safeFileBaseName(workTitle: string): string {
  const value = [...workTitle]
    .map((character) =>
      character.charCodeAt(0) < 32 ||
      WINDOWS_INVALID_FILE_NAME_CHARACTERS.has(character)
        ? " "
        : character,
    )
    .join("")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[. ]+$/gu, "");
  return value.length > 0 ? value : "records";
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function prepareWorkRecordsExport(
  input: PrepareWorkRecordsExportInput,
): PreparedWorkRecordsExport {
  const command = parseExportWorkRecordsCommand(input.command);
  if (input.activity.workId !== command.workId) {
    throw new Error("Work records export activity is outside Work");
  }
  if (typeof input.workTitle !== "string") {
    throw new Error("Work records export title must be a string");
  }

  const documentTitles = new Map<EntityId<"Document">, string>();
  for (const document of input.documents) {
    if (documentTitles.has(document.documentId)) {
      throw new Error(
        `Work records export document is duplicated: ${document.documentId}`,
      );
    }
    if (typeof document.title !== "string") {
      throw new Error("Work records export document title must be a string");
    }
    documentTitles.set(document.documentId, document.title);
  }

  const sessions = input.activity.sessions
    .map((session) => {
      if (session.workId !== command.workId) {
        throw new Error(
          `WritingSession ${session.sessionId} is outside Work`,
        );
      }
      return {
        session,
        date: sessionDate(session, input.dateKey),
      };
    })
    .filter(({ date }) => isSelectedDate(date, command))
    .sort(
      (left, right) =>
        left.session.startedAt.localeCompare(right.session.startedAt) ||
        left.session.sessionId.localeCompare(right.session.sessionId),
    )
    .map(({ session }) =>
      Object.freeze({
        sessionId: session.sessionId,
        documentId: session.documentId,
        documentTitle:
          session.documentId === null
            ? null
            : (documentTitles.get(session.documentId) ?? null),
        state: session.state,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        activeDurationMs: session.activeDurationMs,
        characterDelta: session.characterDelta,
        note: session.note,
      }),
    );

  const extension = command.format;
  const suggestedFileName = `${safeFileBaseName(input.workTitle)}-records.${extension}`;
  if (command.format === "json") {
    const text = `${JSON.stringify(
      {
        schemaVersion: 1,
        work: { workId: command.workId, title: input.workTitle },
        period: {
          fromDate: command.fromDate,
          toDate: command.toDate,
        },
        sessions,
      },
      null,
      2,
    )}\n`;
    return Object.freeze({
      schemaVersion: 1,
      workId: command.workId,
      format: command.format,
      suggestedFileName,
      mediaType: "application/json",
      text,
      sessionCount: sessions.length,
    });
  }

  const rows = [
    [
      "sessionId",
      "documentId",
      "documentTitle",
      "state",
      "startedAt",
      "endedAt",
      "activeDurationMs",
      "characterDelta",
      "note",
    ],
    ...sessions.map((session) => [
      session.sessionId,
      session.documentId,
      session.documentTitle,
      session.state,
      session.startedAt,
      session.endedAt,
      session.activeDurationMs,
      session.characterDelta,
      session.note,
    ]),
  ];
  const text = `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  return Object.freeze({
    schemaVersion: 1,
    workId: command.workId,
    format: command.format,
    suggestedFileName,
    mediaType: "text/csv",
    text,
    sessionCount: sessions.length,
  });
}
