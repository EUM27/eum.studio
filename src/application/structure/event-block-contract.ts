import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type EventBlockRange = {
  readonly from: number;
  readonly to: number;
};

export type EventSourceRole = "primary" | "supporting";

export type EventSourceIntegrity =
  | "resolved"
  | "needsReview"
  | "broken";

export type EventBlockSourceState =
  | "unlinked"
  | EventSourceIntegrity;

type ExactEventSourceSelection = {
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactQuote: string;
};

export type CreateEventBlockCommand = ExactEventSourceSelection & {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
};

export type CreateAnchorlessEventCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
};

export type LinkEventSourceCommand = ExactEventSourceSelection & {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly role: EventSourceRole;
};

export type ReplaceEventSourceCommand = ExactEventSourceSelection & {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly eventSourceId: EntityId<"EventSource">;
  readonly expectedRevision: number;
};

export type RetireEventSourceCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly eventSourceId: EntityId<"EventSource">;
  readonly expectedRevision: number;
};

export type ListEventBlocksCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type EventBlockProjection = {
  readonly schemaVersion: 1;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
  readonly parentEventId: EntityId<"EventBlock"> | null;
  readonly outlineOrderKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type EventSourceAnchorProjection = {
  readonly anchorId: EntityId<"Anchor">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly exactQuote: string;
  readonly integrity: EventSourceIntegrity;
  readonly range: EventBlockRange | null;
};

export type EventSourceProjection = {
  readonly schemaVersion: 1;
  readonly eventSourceId: EntityId<"EventSource">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly rangeGroupId: EntityId<"RangeGroup">;
  readonly role: EventSourceRole;
  readonly anchors: readonly EventSourceAnchorProjection[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type EventBlockListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly eventBlocks: readonly EventBlockProjection[];
  readonly eventSources: readonly EventSourceProjection[];
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

function readNullableString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string or null`);
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

function readPositiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
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

function readNullableEntityId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  const value = readNullableString(input, field, label);
  return value === null ? null : entityId<TEntity>(value);
}

function readRole(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EventSourceRole {
  const value = input[field];
  if (value !== "primary" && value !== "supporting") {
    throw new Error(`${label}.${field} is invalid`);
  }
  return value;
}

function parseExactSelection(
  input: Record<string, unknown>,
  label: string,
): ExactEventSourceSelection {
  const selectionLabel = `${label}.selection`;
  const selection = readRecord(input.selection, selectionLabel);
  assertExactFields(selection, ["anchor", "head"], selectionLabel);
  const anchor = readOffset(selection, "anchor", selectionLabel);
  const head = readOffset(selection, "head", selectionLabel);
  if (anchor === head) {
    throw new Error(`${label}.selection must not be empty`);
  }
  return Object.freeze({
    documentId: readEntityId<"Document">(input, "documentId", label),
    selection: Object.freeze({ anchor, head }),
    exactQuote: readNonEmptyString(input, "exactQuote", label),
  });
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
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    ...parseExactSelection(input, label),
    title: readNonEmptyString(input, "title", label).trim(),
    note: readString(input, "note", label),
  });
}

export function parseCreateAnchorlessEventCommand(
  value: unknown,
): CreateAnchorlessEventCommand {
  const label = "CreateAnchorlessEventCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "title", "note"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    title: readNonEmptyString(input, "title", label).trim(),
    note: readString(input, "note", label),
  });
}

export function parseLinkEventSourceCommand(
  value: unknown,
): LinkEventSourceCommand {
  const label = "LinkEventSourceCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "eventBlockId",
      "role",
      "documentId",
      "selection",
      "exactQuote",
    ],
    label,
  );
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    eventBlockId: readEntityId<"EventBlock">(input, "eventBlockId", label),
    role: readRole(input, "role", label),
    ...parseExactSelection(input, label),
  });
}

export function parseReplaceEventSourceCommand(
  value: unknown,
): ReplaceEventSourceCommand {
  const label = "ReplaceEventSourceCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "eventSourceId",
      "expectedRevision",
      "documentId",
      "selection",
      "exactQuote",
    ],
    label,
  );
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    eventSourceId: readEntityId<"EventSource">(
      input,
      "eventSourceId",
      label,
    ),
    expectedRevision: readPositiveInteger(input, "expectedRevision", label),
    ...parseExactSelection(input, label),
  });
}

export function parseRetireEventSourceCommand(
  value: unknown,
): RetireEventSourceCommand {
  const label = "RetireEventSourceCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    ["schemaVersion", "workId", "eventSourceId", "expectedRevision"],
    label,
  );
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    eventSourceId: readEntityId<"EventSource">(
      input,
      "eventSourceId",
      label,
    ),
    expectedRevision: readPositiveInteger(input, "expectedRevision", label),
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

function readIntegrity(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EventSourceIntegrity {
  const value = input[field];
  if (
    value !== "resolved" &&
    value !== "needsReview" &&
    value !== "broken"
  ) {
    throw new Error(`${label}.${field} is invalid`);
  }
  return value;
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
      "revision",
      "workId",
      "title",
      "note",
      "parentEventId",
      "outlineOrderKey",
      "createdAt",
      "updatedAt",
      "retiredAt",
    ],
    label,
  );
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    eventBlockId: readEntityId<"EventBlock">(
      input,
      "eventBlockId",
      label,
    ),
    revision: readPositiveInteger(input, "revision", label),
    workId: readEntityId<"Work">(input, "workId", label),
    title: readNonEmptyString(input, "title", label),
    note: readString(input, "note", label),
    parentEventId: readNullableEntityId<"EventBlock">(
      input,
      "parentEventId",
      label,
    ),
    outlineOrderKey: readNonEmptyString(input, "outlineOrderKey", label),
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    retiredAt: readNullableString(input, "retiredAt", label),
  });
}

export function parseEventSourceAnchorProjection(
  value: unknown,
  label = "EventSourceAnchorProjection",
): EventSourceAnchorProjection {
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "anchorId",
      "documentId",
      "documentRevisionId",
      "exactQuote",
      "integrity",
      "range",
    ],
    label,
  );
  const integrity = readIntegrity(input, "integrity", label);
  const range = parseRange(input.range, `${label}.range`);
  if (integrity === "resolved" && range === null) {
    throw new Error(`${label}.range is required when resolved`);
  }
  if (integrity !== "resolved" && range !== null) {
    throw new Error(`${label}.range must be null when unresolved`);
  }
  return Object.freeze({
    anchorId: readEntityId<"Anchor">(input, "anchorId", label),
    documentId: readEntityId<"Document">(input, "documentId", label),
    documentRevisionId: readEntityId<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    exactQuote: readNonEmptyString(input, "exactQuote", label),
    integrity,
    range,
  });
}

export function parseEventSourceProjection(
  value: unknown,
): EventSourceProjection {
  const label = "EventSourceProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "eventSourceId",
      "revision",
      "workId",
      "eventBlockId",
      "rangeGroupId",
      "role",
      "anchors",
      "createdAt",
      "updatedAt",
      "retiredAt",
    ],
    label,
  );
  readSchemaVersion(input, label);
  if (!Array.isArray(input.anchors)) {
    throw new Error(`${label}.anchors must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    eventSourceId: readEntityId<"EventSource">(
      input,
      "eventSourceId",
      label,
    ),
    revision: readPositiveInteger(input, "revision", label),
    workId: readEntityId<"Work">(input, "workId", label),
    eventBlockId: readEntityId<"EventBlock">(
      input,
      "eventBlockId",
      label,
    ),
    rangeGroupId: readEntityId<"RangeGroup">(
      input,
      "rangeGroupId",
      label,
    ),
    role: readRole(input, "role", label),
    anchors: Object.freeze(
      input.anchors.map((anchor, index) =>
        parseEventSourceAnchorProjection(
          anchor,
          `${label}.anchors[${index}]`,
        ),
      ),
    ),
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    retiredAt: readNullableString(input, "retiredAt", label),
  });
}

export function parseEventBlockListProjection(
  value: unknown,
): EventBlockListProjection {
  const label = "EventBlockListProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    ["schemaVersion", "workId", "eventBlocks", "eventSources"],
    label,
  );
  readSchemaVersion(input, label);
  if (!Array.isArray(input.eventBlocks)) {
    throw new Error(`${label}.eventBlocks must be an array`);
  }
  if (!Array.isArray(input.eventSources)) {
    throw new Error(`${label}.eventSources must be an array`);
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
  const eventBlockIds = new Set(
    eventBlocks.map((eventBlock) => eventBlock.eventBlockId),
  );
  const eventSources = Object.freeze(
    input.eventSources.map((eventSource, index) => {
      const parsed = parseEventSourceProjection(eventSource);
      if (parsed.workId !== workId) {
        throw new Error(
          `${label}.eventSources[${index}] is outside Work ${workId}`,
        );
      }
      if (!eventBlockIds.has(parsed.eventBlockId)) {
        throw new Error(
          `${label}.eventSources[${index}] references unknown EventBlock ${parsed.eventBlockId}`,
        );
      }
      return parsed;
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    workId,
    eventBlocks,
    eventSources,
  });
}

export function deriveEventBlockSourceState(
  eventBlockId: EntityId<"EventBlock">,
  eventSources: readonly EventSourceProjection[],
): EventBlockSourceState {
  const activeSources = eventSources.filter(
    (source) =>
      source.eventBlockId === eventBlockId && source.retiredAt === null,
  );
  if (activeSources.length === 0) {
    return "unlinked";
  }
  if (activeSources.some((source) => source.anchors.length === 0)) {
    return "broken";
  }
  const anchors = activeSources.flatMap((source) => source.anchors);
  if (anchors.some((anchor) => anchor.integrity === "broken")) {
    return "broken";
  }
  if (anchors.some((anchor) => anchor.integrity === "needsReview")) {
    return "needsReview";
  }
  return "resolved";
}
