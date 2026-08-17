import { entityId, type EntityId } from "../../domain/writing";
import {
  parseEventBlockProjection,
  parseEventSourceProjection,
  type EventBlockProjection,
  type EventSourceProjection,
} from "../structure/event-block-contract";
import {
  parsePlotThreadProjection,
  type PlotThreadProjection,
} from "./plot-contract";

export type PlotEventLinkRole = "primary" | "supporting";

export type PlotEventLinkCreatedFrom =
  | "event-to-plot"
  | "plot-to-event"
  | "manual-link";

export type PlotEventTitleMatch = "matched" | "mismatched";

export type CreatePlotFromEventCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly eventBlockId: EntityId<"EventBlock">;
};

export type CreateEventFromPlotSource =
  | {
      readonly kind: "anchorless";
    }
  | {
      readonly kind: "exact-selection";
      readonly documentId: EntityId<"Document">;
      readonly selection: {
        readonly anchor: number;
        readonly head: number;
      };
      readonly exactQuote: string;
    };

export type CreateEventFromPlotCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly source: CreateEventFromPlotSource;
};

export type LinkPlotEventCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly role: PlotEventLinkRole;
};

export type UnlinkPlotEventCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotEventLinkId: EntityId<"PlotEventLink">;
  readonly expectedRevision: number;
};

export type ListPlotEventLinksCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type PlotEventLinkProjection = {
  readonly schemaVersion: 1;
  readonly plotEventLinkId: EntityId<"PlotEventLink">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly role: PlotEventLinkRole;
  readonly createdFrom: PlotEventLinkCreatedFrom;
  readonly plotTitle: string;
  readonly eventTitle: string;
  readonly titleMatch: PlotEventTitleMatch;
  readonly plotRetiredAt: string | null;
  readonly eventRetiredAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type PlotEventLinkMutationStatus =
  | "created"
  | "existing"
  | "retired";

export type PlotEventLinkMutationProjection = {
  readonly schemaVersion: 1;
  readonly status: PlotEventLinkMutationStatus;
  readonly plotBeat: PlotThreadProjection;
  readonly eventBlock: EventBlockProjection;
  readonly eventSources: readonly EventSourceProjection[];
  readonly link: PlotEventLinkProjection;
};

export type PlotEventLinkListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly links: readonly PlotEventLinkProjection[];
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
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

function readSchemaVersion(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
  }
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

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = readString(input, field, label);
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readNullableString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string or null`);
  }
  return value;
}

function readEntityId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  const value = readNonEmptyString(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function readOffset(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function readRevision(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = readOffset(input, field, label);
  if (value < 1) {
    throw new Error(`${label}.${field} must be at least 1`);
  }
  return value;
}

function readRole(
  input: Record<string, unknown>,
  field: string,
  label: string,
): PlotEventLinkRole {
  const value = input[field];
  if (value !== "primary" && value !== "supporting") {
    throw new Error(`${label}.${field} is invalid`);
  }
  return value;
}

function readCreatedFrom(
  input: Record<string, unknown>,
  field: string,
  label: string,
): PlotEventLinkCreatedFrom {
  const value = input[field];
  if (
    value !== "event-to-plot" &&
    value !== "plot-to-event" &&
    value !== "manual-link"
  ) {
    throw new Error(`${label}.${field} is invalid`);
  }
  return value;
}

export function parseCreatePlotFromEventCommand(
  value: unknown,
): CreatePlotFromEventCommand {
  const label = "CreatePlotFromEventCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "eventBlockId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    eventBlockId: readEntityId<"EventBlock">(input, "eventBlockId", label),
  });
}

export function parseCreateEventFromPlotCommand(
  value: unknown,
): CreateEventFromPlotCommand {
  const label = "CreateEventFromPlotCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    ["schemaVersion", "workId", "plotBeatId", "source"],
    label,
  );
  readSchemaVersion(input, label);
  const sourceLabel = `${label}.source`;
  const sourceInput = readRecord(input.source, sourceLabel);
  const kind = sourceInput.kind;
  let source: CreateEventFromPlotSource;
  if (kind === "anchorless") {
    assertExactFields(sourceInput, ["kind"], sourceLabel);
    source = Object.freeze({ kind });
  } else if (kind === "exact-selection") {
    assertExactFields(
      sourceInput,
      ["kind", "documentId", "selection", "exactQuote"],
      sourceLabel,
    );
    const selectionLabel = `${sourceLabel}.selection`;
    const selectionInput = readRecord(sourceInput.selection, selectionLabel);
    assertExactFields(selectionInput, ["anchor", "head"], selectionLabel);
    const anchor = readOffset(selectionInput, "anchor", selectionLabel);
    const head = readOffset(selectionInput, "head", selectionLabel);
    if (anchor === head) {
      throw new Error(`${selectionLabel} must not be empty`);
    }
    source = Object.freeze({
      kind,
      documentId: readEntityId<"Document">(
        sourceInput,
        "documentId",
        sourceLabel,
      ),
      selection: Object.freeze({ anchor, head }),
      exactQuote: readNonEmptyString(sourceInput, "exactQuote", sourceLabel),
    });
  } else {
    throw new Error(`${sourceLabel}.kind is invalid`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    plotBeatId: readEntityId<"PlotThread">(input, "plotBeatId", label),
    source,
  });
}

export function parseLinkPlotEventCommand(value: unknown): LinkPlotEventCommand {
  const label = "LinkPlotEventCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    ["schemaVersion", "workId", "plotBeatId", "eventBlockId", "role"],
    label,
  );
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    plotBeatId: readEntityId<"PlotThread">(input, "plotBeatId", label),
    eventBlockId: readEntityId<"EventBlock">(input, "eventBlockId", label),
    role: readRole(input, "role", label),
  });
}

export function parseUnlinkPlotEventCommand(
  value: unknown,
): UnlinkPlotEventCommand {
  const label = "UnlinkPlotEventCommand";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    ["schemaVersion", "workId", "plotEventLinkId", "expectedRevision"],
    label,
  );
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    plotEventLinkId: readEntityId<"PlotEventLink">(
      input,
      "plotEventLinkId",
      label,
    ),
    expectedRevision: readRevision(input, "expectedRevision", label),
  });
}

export function parseListPlotEventLinksCommand(
  value: unknown,
): ListPlotEventLinksCommand {
  const label = "ListPlotEventLinksCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
  });
}

export function parsePlotEventLinkProjection(
  value: unknown,
): PlotEventLinkProjection {
  const label = "PlotEventLinkProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "plotEventLinkId",
      "revision",
      "workId",
      "plotBeatId",
      "eventBlockId",
      "role",
      "createdFrom",
      "plotTitle",
      "eventTitle",
      "titleMatch",
      "plotRetiredAt",
      "eventRetiredAt",
      "createdAt",
      "updatedAt",
      "retiredAt",
    ],
    label,
  );
  readSchemaVersion(input, label);
  const plotTitle = readNonEmptyString(input, "plotTitle", label);
  const eventTitle = readNonEmptyString(input, "eventTitle", label);
  const titleMatch = plotTitle === eventTitle ? "matched" : "mismatched";
  if (input.titleMatch !== titleMatch) {
    throw new Error(`${label}.titleMatch does not match the current titles`);
  }
  return Object.freeze({
    schemaVersion: 1,
    plotEventLinkId: readEntityId<"PlotEventLink">(
      input,
      "plotEventLinkId",
      label,
    ),
    revision: readRevision(input, "revision", label),
    workId: readEntityId<"Work">(input, "workId", label),
    plotBeatId: readEntityId<"PlotThread">(input, "plotBeatId", label),
    eventBlockId: readEntityId<"EventBlock">(input, "eventBlockId", label),
    role: readRole(input, "role", label),
    createdFrom: readCreatedFrom(input, "createdFrom", label),
    plotTitle,
    eventTitle,
    titleMatch,
    plotRetiredAt: readNullableString(input, "plotRetiredAt", label),
    eventRetiredAt: readNullableString(input, "eventRetiredAt", label),
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    retiredAt: readNullableString(input, "retiredAt", label),
  });
}

export function parsePlotEventLinkMutationProjection(
  value: unknown,
): PlotEventLinkMutationProjection {
  const label = "PlotEventLinkMutationProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    ["schemaVersion", "status", "plotBeat", "eventBlock", "eventSources", "link"],
    label,
  );
  readSchemaVersion(input, label);
  if (
    input.status !== "created" &&
    input.status !== "existing" &&
    input.status !== "retired"
  ) {
    throw new Error(`${label}.status is invalid`);
  }
  if (!Array.isArray(input.eventSources)) {
    throw new Error(`${label}.eventSources must be an array`);
  }
  const plotBeat = parsePlotThreadProjection(input.plotBeat);
  const eventBlock = parseEventBlockProjection(input.eventBlock);
  const eventSources = Object.freeze(
    input.eventSources.map((source) => parseEventSourceProjection(source)),
  );
  const link = parsePlotEventLinkProjection(input.link);
  if (
    plotBeat.workId !== link.workId ||
    eventBlock.workId !== link.workId ||
    plotBeat.plotThreadId !== link.plotBeatId ||
    eventBlock.eventBlockId !== link.eventBlockId ||
    eventSources.some(
      (source) =>
        source.workId !== link.workId ||
        source.eventBlockId !== link.eventBlockId,
    )
  ) {
    throw new Error(`${label} contains inconsistent linked projections`);
  }
  if (input.status === "retired" && link.retiredAt === null) {
    throw new Error(`${label}.link must be retired when status is retired`);
  }
  if (input.status !== "retired" && link.retiredAt !== null) {
    throw new Error(`${label}.link must be active when status is not retired`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: input.status,
    plotBeat,
    eventBlock,
    eventSources,
    link,
  });
}

export function parsePlotEventLinkListProjection(
  value: unknown,
): PlotEventLinkListProjection {
  const label = "PlotEventLinkListProjection";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "links"], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.links)) {
    throw new Error(`${label}.links must be an array`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const links = Object.freeze(input.links.map((link, index) => {
    const parsed = parsePlotEventLinkProjection(link);
    if (parsed.workId !== workId) {
      throw new Error(`${label}.links[${index}] is outside Work ${workId}`);
    }
    return parsed;
  }));
  return Object.freeze({ schemaVersion: 1, workId, links });
}
