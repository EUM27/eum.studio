import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type EventBlockRange = {
  readonly from: number;
  readonly to: number;
};

export type CreateEventBlockCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactQuote: string;
  readonly title: string;
  readonly note: string;
};

export type ListEventBlocksCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type EventBlockProjection = {
  readonly schemaVersion: 1;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly anchorId: EntityId<"Anchor">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly title: string;
  readonly note: string;
  readonly exactQuote: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: EventBlockRange | null;
  readonly createdAt: string;
};

export type EventBlockListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly eventBlocks: readonly EventBlockProjection[];
};

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function readNonEmptyString(
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

function readString(
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

function readOffset(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function readSchemaVersion(
  input: Record<string, unknown>,
  label: string,
): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
  }
}

function readEntityId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(readNonEmptyString(input, field, label));
}

export function parseCreateEventBlockCommand(
  value: unknown,
): CreateEventBlockCommand {
  const label = "CreateEventBlockCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "selection",
      "exactQuote",
      "title",
      "note",
    ],
    label,
  );
  readSchemaVersion(input, label);
  const selectionLabel = `${label}.selection`;
  const selection = readRecord(input.selection, selectionLabel);
  assertExactFields(selection, ["anchor", "head"], selectionLabel);
  const anchor = readOffset(selection, "anchor", selectionLabel);
  const head = readOffset(selection, "head", selectionLabel);
  if (anchor === head) {
    throw new Error(`${label}.selection must not be empty`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    documentId: readEntityId<"Document">(input, "documentId", label),
    selection: Object.freeze({ anchor, head }),
    exactQuote: readNonEmptyString(input, "exactQuote", label),
    title: readNonEmptyString(input, "title", label).trim(),
    note: readString(input, "note", label),
  });
}

export function parseListEventBlocksCommand(
  value: unknown,
): ListEventBlocksCommand {
  const label = "ListEventBlocksCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
  });
}

function parseRange(value: unknown, label: string): EventBlockRange | null {
  if (value === null) {
    return null;
  }
  const input = readRecord(value, label);
  assertExactFields(input, ["from", "to"], label);
  const from = readOffset(input, "from", label);
  const to = readOffset(input, "to", label);
  if (to < from) {
    throw new Error(`${label}.to must not precede from`);
  }
  return Object.freeze({ from, to });
}

export function parseEventBlockProjection(
  value: unknown,
): EventBlockProjection {
  const label = "EventBlockProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "eventBlockId",
      "anchorId",
      "workId",
      "documentId",
      "documentRevisionId",
      "title",
      "note",
      "exactQuote",
      "integrity",
      "range",
      "createdAt",
    ],
    label,
  );
  readSchemaVersion(input, label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  const range = parseRange(input.range, `${label}.range`);
  if (input.integrity === "resolved" && range === null) {
    throw new Error(`${label}.range is required when resolved`);
  }
  if (input.integrity !== "resolved" && range !== null) {
    throw new Error(`${label}.range must be null when unresolved`);
  }
  return Object.freeze({
    schemaVersion: 1,
    eventBlockId: readEntityId<"EventBlock">(
      input,
      "eventBlockId",
      label,
    ),
    anchorId: readEntityId<"Anchor">(input, "anchorId", label),
    workId: readEntityId<"Work">(input, "workId", label),
    documentId: readEntityId<"Document">(input, "documentId", label),
    documentRevisionId: readEntityId<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    title: readNonEmptyString(input, "title", label),
    note: readString(input, "note", label),
    exactQuote: readNonEmptyString(input, "exactQuote", label),
    integrity: input.integrity,
    range,
    createdAt: readNonEmptyString(input, "createdAt", label),
  });
}

export function parseEventBlockListProjection(
  value: unknown,
): EventBlockListProjection {
  const label = "EventBlockListProjection";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "eventBlocks"], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.eventBlocks)) {
    throw new Error(`${label}.eventBlocks must be an array`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const eventBlocks = Object.freeze(
    input.eventBlocks.map((eventBlock, index) => {
      const parsed = parseEventBlockProjection(eventBlock);
      if (parsed.workId !== workId) {
        throw new Error(
          `${label}.eventBlocks[${index}] is outside Work ${workId}`,
        );
      }
      return parsed;
    }),
  );
  return Object.freeze({ schemaVersion: 1, workId, eventBlocks });
}
