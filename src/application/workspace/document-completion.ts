import { entityId, type EntityId } from "../../domain/writing";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/u;

export function deriveDocumentCompletionDate(
  completedAt: string,
  timeZone: string,
): string {
  const date = new Date(completedAt);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Document completion timestamp must be an absolute instant");
  }
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Document completion date could not be derived");
  }
  return `${year}-${month}-${day}`;
}

export type DocumentCompletionState =
  | "incomplete"
  | "current"
  | "edited-after-completion";

export type DocumentCompletionProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly revision: number;
  readonly completedAt: string | null;
  readonly completedDate: string | null;
  readonly completedTimeZone: string | null;
  readonly completedDocumentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly state: DocumentCompletionState;
  readonly updatedAt: string | null;
};

export type GetDocumentCompletionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
};

export type SetDocumentCompletionCommand = GetDocumentCompletionCommand & {
  readonly expectedCompletionRevision: number;
  readonly expectedDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly completed: boolean;
};

export type DocumentCompletionOccurrence = {
  readonly occurrenceId: string;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentTitle: string;
  readonly kind: "document-completion";
  readonly label: string;
  readonly date: string;
  readonly time: null;
  readonly completed: true;
  readonly completedAt: string;
  readonly completedDocumentRevisionId: EntityId<"DocumentRevision">;
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

function identity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
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

export function parseGetDocumentCompletionCommand(
  value: unknown,
): GetDocumentCompletionCommand {
  const input = record(value, "GetDocumentCompletionCommand");
  exact(
    input,
    ["schemaVersion", "workId", "documentId"],
    "GetDocumentCompletionCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("GetDocumentCompletionCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: identity<"Work">(input.workId, "GetDocumentCompletionCommand.workId"),
    documentId: identity<"Document">(
      input.documentId,
      "GetDocumentCompletionCommand.documentId",
    ),
  });
}

export function parseSetDocumentCompletionCommand(
  value: unknown,
): SetDocumentCompletionCommand {
  const input = record(value, "SetDocumentCompletionCommand");
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "expectedCompletionRevision",
      "expectedDocumentRevisionId",
      "completed",
    ],
    "SetDocumentCompletionCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SetDocumentCompletionCommand.schemaVersion must be 1");
  }
  if (typeof input.completed !== "boolean") {
    throw new Error("SetDocumentCompletionCommand.completed must be a boolean");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: identity<"Work">(input.workId, "SetDocumentCompletionCommand.workId"),
    documentId: identity<"Document">(
      input.documentId,
      "SetDocumentCompletionCommand.documentId",
    ),
    expectedCompletionRevision: nonNegativeInteger(
      input.expectedCompletionRevision,
      "SetDocumentCompletionCommand.expectedCompletionRevision",
    ),
    expectedDocumentRevisionId: identity<"DocumentRevision">(
      input.expectedDocumentRevisionId,
      "SetDocumentCompletionCommand.expectedDocumentRevisionId",
    ),
    completed: input.completed,
  });
}

export function parseDocumentCompletionProjection(
  value: unknown,
): DocumentCompletionProjection {
  const input = record(value, "DocumentCompletionProjection");
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "revision",
      "completedAt",
      "completedDate",
      "completedTimeZone",
      "completedDocumentRevisionId",
      "state",
      "updatedAt",
    ],
    "DocumentCompletionProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("DocumentCompletionProjection.schemaVersion must be 1");
  }
  const revision = nonNegativeInteger(
    input.revision,
    "DocumentCompletionProjection.revision",
  );
  const state = input.state;
  if (
    state !== "incomplete" &&
    state !== "current" &&
    state !== "edited-after-completion"
  ) {
    throw new Error("DocumentCompletionProjection.state is invalid");
  }
  const completionValues = [
    input.completedAt,
    input.completedDate,
    input.completedTimeZone,
    input.completedDocumentRevisionId,
  ];
  const allNull = completionValues.every((entry) => entry === null);
  const allPresent = completionValues.every(
    (entry) => typeof entry === "string" && entry.length > 0,
  );
  if (!allNull && !allPresent) {
    throw new Error("DocumentCompletionProjection completion fields must be all null or all present");
  }
  if ((state === "incomplete") !== allNull) {
    throw new Error("DocumentCompletionProjection.state conflicts with completion fields");
  }
  if ((revision === 0) !== (input.updatedAt === null)) {
    throw new Error("DocumentCompletionProjection revision 0 must have no updatedAt");
  }
  if (revision === 0 && !allNull) {
    throw new Error("DocumentCompletionProjection revision 0 must be incomplete");
  }
  if (allPresent && !DATE_KEY.test(input.completedDate as string)) {
    throw new Error("DocumentCompletionProjection.completedDate must be YYYY-MM-DD");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: identity<"Work">(input.workId, "DocumentCompletionProjection.workId"),
    documentId: identity<"Document">(
      input.documentId,
      "DocumentCompletionProjection.documentId",
    ),
    revision,
    completedAt: allNull
      ? null
      : instant(input.completedAt, "DocumentCompletionProjection.completedAt"),
    completedDate: allNull ? null : input.completedDate as string,
    completedTimeZone: allNull ? null : input.completedTimeZone as string,
    completedDocumentRevisionId: allNull
      ? null
      : identity<"DocumentRevision">(
          input.completedDocumentRevisionId,
          "DocumentCompletionProjection.completedDocumentRevisionId",
        ),
    state,
    updatedAt: input.updatedAt === null
      ? null
      : instant(input.updatedAt, "DocumentCompletionProjection.updatedAt"),
  });
}

export function parseDocumentCompletionOccurrence(
  value: unknown,
): DocumentCompletionOccurrence {
  const input = record(value, "DocumentCompletionOccurrence");
  exact(
    input,
    [
      "occurrenceId",
      "workId",
      "documentId",
      "documentTitle",
      "kind",
      "label",
      "date",
      "time",
      "completed",
      "completedAt",
      "completedDocumentRevisionId",
    ],
    "DocumentCompletionOccurrence",
  );
  if (input.kind !== "document-completion") {
    throw new Error("DocumentCompletionOccurrence.kind must be document-completion");
  }
  if (input.time !== null || input.completed !== true) {
    throw new Error("DocumentCompletionOccurrence must be an untimed completed fact");
  }
  const workId = identity<"Work">(input.workId, "DocumentCompletionOccurrence.workId");
  const documentId = identity<"Document">(
    input.documentId,
    "DocumentCompletionOccurrence.documentId",
  );
  if (input.occurrenceId !== `document-completion:${documentId}`) {
    throw new Error("DocumentCompletionOccurrence.occurrenceId is not deterministic");
  }
  if (
    typeof input.documentTitle !== "string" ||
    input.documentTitle.trim().length === 0 ||
    typeof input.label !== "string" ||
    input.label.trim().length === 0 ||
    typeof input.date !== "string" ||
    !DATE_KEY.test(input.date)
  ) {
    throw new Error("DocumentCompletionOccurrence text or date is invalid");
  }
  return Object.freeze({
    occurrenceId: input.occurrenceId,
    workId,
    documentId,
    documentTitle: input.documentTitle.trim(),
    kind: "document-completion",
    label: input.label.trim(),
    date: input.date,
    time: null,
    completed: true,
    completedAt: instant(input.completedAt, "DocumentCompletionOccurrence.completedAt"),
    completedDocumentRevisionId: identity<"DocumentRevision">(
      input.completedDocumentRevisionId,
      "DocumentCompletionOccurrence.completedDocumentRevisionId",
    ),
  });
}
