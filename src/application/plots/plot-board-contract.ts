import { entityId, type EntityId } from "../../domain/writing";
import {
  parsePlotThreadProjection,
  type PlotThreadProjection,
} from "./plot-contract";

export type PlotBoardMode = "sequence" | "time-map";

export type PlotLaneKind =
  | "default"
  | "main"
  | "subplot"
  | "stage"
  | "custom";

export type GetDefaultPlotBoardCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type MovePlotPlacementCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotPlacementId: EntityId<"PlotPlacement">;
  readonly targetBoardId: EntityId<"PlotBoard">;
  readonly targetLaneId: EntityId<"PlotLane">;
  readonly beforePlacementId?: EntityId<"PlotPlacement">;
  readonly afterPlacementId?: EntityId<"PlotPlacement">;
  readonly expectedPlacementRevision: number;
  readonly expectedBoardRevision: number;
};

export type SetPlotPlacementStoryTimeCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotPlacementId: EntityId<"PlotPlacement">;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly storyTime: number;
  readonly storyTimeEnd: number | null;
  readonly expectedPlacementRevision: number;
  readonly expectedBoardRevision: number;
};

export type PlotPlacementProjection = {
  readonly schemaVersion: 1;
  readonly plotPlacementId: EntityId<"PlotPlacement">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly plotLaneId: EntityId<"PlotLane">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly orderKey: string;
  readonly storyTime: number | null;
  readonly storyTimeEnd: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly plotBeat: PlotThreadProjection;
};

export type PlotLaneProjection = {
  readonly schemaVersion: 1;
  readonly plotLaneId: EntityId<"PlotLane">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly title: string;
  readonly kind: PlotLaneKind;
  readonly orderKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly placements: readonly PlotPlacementProjection[];
};

export type PlotBoardProjection = {
  readonly schemaVersion: 1;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly mode: PlotBoardMode;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lanes: readonly PlotLaneProjection[];
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
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function assertCommandFields(
  input: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of required) {
    if (!(field in input)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function readSchemaVersion(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
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

function readRevision(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function readNormalizedStoryTime(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${field} must be a finite number`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${label}.${field} must be between 0 and 100`);
  }
  return value;
}

function readNormalizedStoryTimeEnd(
  input: Record<string, unknown>,
  storyTime: number,
  label: string,
): number | null {
  const value = input.storyTimeEnd;
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < storyTime ||
    value > 100
  ) {
    throw new Error(
      `${label}.storyTimeEnd must be between storyTime and 100 or null`,
    );
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

export function parseGetDefaultPlotBoardCommand(
  value: unknown,
): GetDefaultPlotBoardCommand {
  const label = "GetDefaultPlotBoardCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
  });
}

export function parseMovePlotPlacementCommand(
  value: unknown,
): MovePlotPlacementCommand {
  const label = "MovePlotPlacementCommand";
  const input = readRecord(value, label);
  assertCommandFields(
    input,
    [
      "schemaVersion",
      "workId",
      "plotPlacementId",
      "targetBoardId",
      "targetLaneId",
      "expectedPlacementRevision",
      "expectedBoardRevision",
    ],
    ["beforePlacementId", "afterPlacementId"],
    label,
  );
  readSchemaVersion(input, label);
  const beforePlacementId = Object.hasOwn(input, "beforePlacementId")
    ? readEntityId<"PlotPlacement">(input, "beforePlacementId", label)
    : undefined;
  const afterPlacementId = Object.hasOwn(input, "afterPlacementId")
    ? readEntityId<"PlotPlacement">(input, "afterPlacementId", label)
    : undefined;
  if (
    beforePlacementId !== undefined &&
    afterPlacementId !== undefined &&
    beforePlacementId === afterPlacementId
  ) {
    throw new Error(`${label} neighbors must be different placements`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    plotPlacementId: readEntityId<"PlotPlacement">(
      input,
      "plotPlacementId",
      label,
    ),
    targetBoardId: readEntityId<"PlotBoard">(input, "targetBoardId", label),
    targetLaneId: readEntityId<"PlotLane">(input, "targetLaneId", label),
    ...(beforePlacementId === undefined ? {} : { beforePlacementId }),
    ...(afterPlacementId === undefined ? {} : { afterPlacementId }),
    expectedPlacementRevision: readRevision(
      input,
      "expectedPlacementRevision",
      label,
    ),
    expectedBoardRevision: readRevision(
      input,
      "expectedBoardRevision",
      label,
    ),
  });
}

export function parseSetPlotPlacementStoryTimeCommand(
  value: unknown,
): SetPlotPlacementStoryTimeCommand {
  const label = "SetPlotPlacementStoryTimeCommand";
  const input = readRecord(value, label);
  assertCommandFields(
    input,
    [
      "schemaVersion",
      "workId",
      "plotPlacementId",
      "plotBoardId",
      "storyTime",
      "storyTimeEnd",
      "expectedPlacementRevision",
      "expectedBoardRevision",
    ],
    [],
    label,
  );
  readSchemaVersion(input, label);
  const storyTime = readNormalizedStoryTime(input, "storyTime", label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    plotPlacementId: readEntityId<"PlotPlacement">(
      input,
      "plotPlacementId",
      label,
    ),
    plotBoardId: readEntityId<"PlotBoard">(input, "plotBoardId", label),
    storyTime,
    storyTimeEnd: readNormalizedStoryTimeEnd(input, storyTime, label),
    expectedPlacementRevision: readRevision(
      input,
      "expectedPlacementRevision",
      label,
    ),
    expectedBoardRevision: readRevision(input, "expectedBoardRevision", label),
  });
}

export function parsePlotPlacementProjection(
  value: unknown,
): PlotPlacementProjection {
  const label = "PlotPlacementProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "plotPlacementId",
      "revision",
      "workId",
      "plotBoardId",
      "plotLaneId",
      "plotBeatId",
      "orderKey",
      "storyTime",
      "storyTimeEnd",
      "createdAt",
      "updatedAt",
      "retiredAt",
      "plotBeat",
    ],
    label,
  );
  readSchemaVersion(input, label);
  const workId = readEntityId<"Work">(input, "workId", label);
  const plotBeatId = readEntityId<"PlotThread">(input, "plotBeatId", label);
  const plotBeat = parsePlotThreadProjection(input.plotBeat);
  if (plotBeat.workId !== workId || plotBeat.plotThreadId !== plotBeatId) {
    throw new Error(`${label}.plotBeat does not match its placement`);
  }
  const storyTime = input.storyTime === null
    ? null
    : readNormalizedStoryTime(input, "storyTime", label);
  if (storyTime === null && input.storyTimeEnd !== null) {
    throw new Error(`${label}.storyTimeEnd requires storyTime`);
  }
  const storyTimeEnd = storyTime === null
    ? null
    : readNormalizedStoryTimeEnd(input, storyTime, label);
  return Object.freeze({
    schemaVersion: 1,
    plotPlacementId: readEntityId<"PlotPlacement">(
      input,
      "plotPlacementId",
      label,
    ),
    revision: readRevision(input, "revision", label),
    workId,
    plotBoardId: readEntityId<"PlotBoard">(input, "plotBoardId", label),
    plotLaneId: readEntityId<"PlotLane">(input, "plotLaneId", label),
    plotBeatId,
    orderKey: readNonEmptyString(input, "orderKey", label),
    storyTime,
    storyTimeEnd,
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    retiredAt: readNullableString(input, "retiredAt", label),
    plotBeat,
  });
}

export function parsePlotLaneProjection(value: unknown): PlotLaneProjection {
  const label = "PlotLaneProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "plotLaneId",
      "revision",
      "workId",
      "plotBoardId",
      "title",
      "kind",
      "orderKey",
      "createdAt",
      "updatedAt",
      "placements",
    ],
    label,
  );
  readSchemaVersion(input, label);
  if (!Array.isArray(input.placements)) {
    throw new Error(`${label}.placements must be an array`);
  }
  if (
    input.kind !== "default" &&
    input.kind !== "main" &&
    input.kind !== "subplot" &&
    input.kind !== "stage" &&
    input.kind !== "custom"
  ) {
    throw new Error(`${label}.kind is invalid`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const plotBoardId = readEntityId<"PlotBoard">(input, "plotBoardId", label);
  const plotLaneId = readEntityId<"PlotLane">(input, "plotLaneId", label);
  const placements = Object.freeze(input.placements.map((placement, index) => {
    const parsed = parsePlotPlacementProjection(placement);
    if (
      parsed.workId !== workId ||
      parsed.plotBoardId !== plotBoardId ||
      parsed.plotLaneId !== plotLaneId
    ) {
      throw new Error(`${label}.placements[${index}] is outside its lane`);
    }
    return parsed;
  }));
  return Object.freeze({
    schemaVersion: 1,
    plotLaneId,
    revision: readRevision(input, "revision", label),
    workId,
    plotBoardId,
    title: readNonEmptyString(input, "title", label),
    kind: input.kind,
    orderKey: readNonEmptyString(input, "orderKey", label),
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    placements,
  });
}

export function parsePlotBoardProjection(value: unknown): PlotBoardProjection {
  const label = "PlotBoardProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "plotBoardId",
      "revision",
      "workId",
      "title",
      "mode",
      "createdAt",
      "updatedAt",
      "lanes",
    ],
    label,
  );
  readSchemaVersion(input, label);
  if (input.mode !== "sequence" && input.mode !== "time-map") {
    throw new Error(`${label}.mode is invalid`);
  }
  if (!Array.isArray(input.lanes)) {
    throw new Error(`${label}.lanes must be an array`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const plotBoardId = readEntityId<"PlotBoard">(input, "plotBoardId", label);
  const lanes = Object.freeze(input.lanes.map((lane, index) => {
    const parsed = parsePlotLaneProjection(lane);
    if (parsed.workId !== workId || parsed.plotBoardId !== plotBoardId) {
      throw new Error(`${label}.lanes[${index}] is outside its board`);
    }
    return parsed;
  }));
  return Object.freeze({
    schemaVersion: 1,
    plotBoardId,
    revision: readRevision(input, "revision", label),
    workId,
    title: readNonEmptyString(input, "title", label),
    mode: input.mode,
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    lanes,
  });
}
