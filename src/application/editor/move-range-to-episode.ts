import {
  entityId,
  type Anchor,
  type DocumentRevision,
  type EntityId,
} from "../../domain/writing";
import type {
  AppendRevisionInput,
} from "../revisions/revision-store";
import type {
  ManuscriptEditorDocumentState,
  ManuscriptFormattingRange,
  ManuscriptParagraphAlignmentEntry,
} from "./manuscript-formatting";

export type MoveRangeToEpisodePlacement = "start" | "end";

export type MoveRangeToEpisodeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  sourceEpisodeId: EntityId<"Document">;
  targetEpisodeId: EntityId<"Document">;
  expectedSourceRevisionId: EntityId<"DocumentRevision">;
  expectedTargetRevisionId: EntityId<"DocumentRevision">;
  from: number;
  to: number;
  placement: MoveRangeToEpisodePlacement;
}>;

export type UndoMoveRangeToEpisodeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  moveId: EntityId<"EpisodeRangeMove">;
  expectedSourceRevisionId: EntityId<"DocumentRevision">;
  expectedTargetRevisionId: EntityId<"DocumentRevision">;
}>;

export type MoveRangeToEpisodeReceipt = Readonly<{
  schemaVersion: 1;
  status: "moved" | "undone";
  moveId: EntityId<"EpisodeRangeMove">;
  workId: EntityId<"Work">;
  sourceEpisodeId: EntityId<"Document">;
  targetEpisodeId: EntityId<"Document">;
  sourceRevisionId: EntityId<"DocumentRevision">;
  targetRevisionId: EntityId<"DocumentRevision">;
  sceneIds: readonly EntityId<"Scene">[];
}>;

export type SceneEpisodeSegmentRange = Readonly<{
  segmentId: EntityId<"EpisodeSceneSegment">;
  sceneId: EntityId<"Scene">;
  documentId: EntityId<"Document">;
  range: Readonly<{ start: number; end: number }>;
}>;

export type EpisodeSceneIdentityChangePlan = Readonly<{
  createdSceneIds: readonly EntityId<"Scene">[];
  retiredSegmentIds: readonly EntityId<"EpisodeSceneSegment">[];
  createdSegments: readonly SceneEpisodeSegmentRange[];
}>;

export type PreparedEpisodeSceneSegment = Readonly<{
  segmentId: EntityId<"EpisodeSceneSegment">;
  sceneId: EntityId<"Scene">;
  anchor: Anchor;
}>;

export type CommitEpisodeRangeMoveInput = Readonly<{
  moveId: EntityId<"EpisodeRangeMove">;
  workId: EntityId<"Work">;
  sourceEpisodeId: EntityId<"Document">;
  targetEpisodeId: EntityId<"Document">;
  from: number;
  to: number;
  placement: MoveRangeToEpisodePlacement;
  sourceRevision: AppendRevisionInput;
  targetRevision: AppendRevisionInput;
  createdSceneIds: readonly EntityId<"Scene">[];
  retiredSegmentIds: readonly EntityId<"EpisodeSceneSegment">[];
  createdSegments: readonly PreparedEpisodeSceneSegment[];
}>;

export type UndoEpisodeRangeMoveInput = Readonly<{
  moveId: EntityId<"EpisodeRangeMove">;
  workId: EntityId<"Work">;
  sourceRevision: AppendRevisionInput;
  targetRevision: AppendRevisionInput;
}>;

export type EpisodeRangeMoveStoreReceipt = Readonly<{
  sourceRevision: DocumentRevision;
  targetRevision: DocumentRevision;
  sceneIds: readonly EntityId<"Scene">[];
  sourceEpisodeId: EntityId<"Document">;
  targetEpisodeId: EntityId<"Document">;
}>;

export type EpisodeRangeMoveStore = Readonly<{
  commit(input: CommitEpisodeRangeMoveInput): Promise<EpisodeRangeMoveStoreReceipt>;
  undo(input: UndoEpisodeRangeMoveInput): Promise<EpisodeRangeMoveStoreReceipt>;
}>;

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
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${label}.${field} is required`);
    }
  }
}

function id<TKind extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TKind> {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return entityId<TKind>(value);
}

function offset(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value as number;
}

export function parseMoveRangeToEpisodeCommand(
  value: unknown,
): MoveRangeToEpisodeCommand {
  const label = "MoveRangeToEpisodeCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "sourceEpisodeId",
    "targetEpisodeId",
    "expectedSourceRevisionId",
    "expectedTargetRevisionId",
    "from",
    "to",
    "placement",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  const from = offset(input, "from", label);
  const to = offset(input, "to", label);
  if (to <= from) {
    throw new Error(`${label} must move a non-empty range`);
  }
  if (input.placement !== "start" && input.placement !== "end") {
    throw new Error(`${label}.placement must be start or end`);
  }
  const sourceEpisodeId = id<"Document">(input, "sourceEpisodeId", label);
  const targetEpisodeId = id<"Document">(input, "targetEpisodeId", label);
  if (sourceEpisodeId === targetEpisodeId) {
    throw new Error(`${label} requires two different episodes`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    sourceEpisodeId,
    targetEpisodeId,
    expectedSourceRevisionId: id<"DocumentRevision">(
      input,
      "expectedSourceRevisionId",
      label,
    ),
    expectedTargetRevisionId: id<"DocumentRevision">(
      input,
      "expectedTargetRevisionId",
      label,
    ),
    from,
    to,
    placement: input.placement,
  });
}

export function parseUndoMoveRangeToEpisodeCommand(
  value: unknown,
): UndoMoveRangeToEpisodeCommand {
  const label = "UndoMoveRangeToEpisodeCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "moveId",
    "expectedSourceRevisionId",
    "expectedTargetRevisionId",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    moveId: id<"EpisodeRangeMove">(input, "moveId", label),
    expectedSourceRevisionId: id<"DocumentRevision">(
      input,
      "expectedSourceRevisionId",
      label,
    ),
    expectedTargetRevisionId: id<"DocumentRevision">(
      input,
      "expectedTargetRevisionId",
      label,
    ),
  });
}

export function parseMoveRangeToEpisodeReceipt(
  value: unknown,
): MoveRangeToEpisodeReceipt {
  const label = "MoveRangeToEpisodeReceipt";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "status",
    "moveId",
    "workId",
    "sourceEpisodeId",
    "targetEpisodeId",
    "sourceRevisionId",
    "targetRevisionId",
    "sceneIds",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (input.status !== "moved" && input.status !== "undone") {
    throw new Error(`${label}.status must be moved or undone`);
  }
  if (!Array.isArray(input.sceneIds)) {
    throw new Error(`${label}.sceneIds must be an array`);
  }
  const sceneIds = input.sceneIds.map((sceneId, index) => {
    if (typeof sceneId !== "string" || sceneId.length === 0) {
      throw new Error(`${label}.sceneIds[${index}] must be a non-empty string`);
    }
    return entityId<"Scene">(sceneId);
  });
  if (new Set(sceneIds).size !== sceneIds.length) {
    throw new Error(`${label}.sceneIds must be unique`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: input.status,
    moveId: id<"EpisodeRangeMove">(input, "moveId", label),
    workId: id<"Work">(input, "workId", label),
    sourceEpisodeId: id<"Document">(input, "sourceEpisodeId", label),
    targetEpisodeId: id<"Document">(input, "targetEpisodeId", label),
    sourceRevisionId: id<"DocumentRevision">(
      input,
      "sourceRevisionId",
      label,
    ),
    targetRevisionId: id<"DocumentRevision">(
      input,
      "targetRevisionId",
      label,
    ),
    sceneIds: Object.freeze(sceneIds),
  });
}

function assertRange(from: number, to: number, length: number): void {
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    !Number.isSafeInteger(length) ||
    from < 0 ||
    to <= from ||
    to > length
  ) {
    throw new Error("Episode move range must stay inside the source manuscript");
  }
}

export function resolveHereToEpisodeEndRange(
  selection: Readonly<{ from: number; to: number }>,
  documentLength: number,
): Readonly<{ from: number; to: number }> {
  if (
    !Number.isSafeInteger(selection.from) ||
    !Number.isSafeInteger(selection.to) ||
    !Number.isSafeInteger(documentLength) ||
    selection.from < 0 ||
    selection.to < selection.from ||
    selection.to > documentLength ||
    documentLength < 0
  ) {
    throw new Error("Manuscript selection must stay inside the current episode");
  }
  return Object.freeze({ from: selection.from, to: documentLength });
}

export function moveRangeToEpisodeText(input: Readonly<{
  sourceText: string;
  targetText: string;
  from: number;
  to: number;
  placement: MoveRangeToEpisodePlacement;
}>): Readonly<{
  sourceText: string;
  targetText: string;
  movedText: string;
  targetInsertOffset: number;
}> {
  assertRange(input.from, input.to, input.sourceText.length);
  if (input.to !== input.sourceText.length) {
    throw new Error("Episode move must continue from the selected point to the episode end");
  }
  const movedText = input.sourceText.slice(input.from, input.to);
  const targetInsertOffset = input.placement === "start"
    ? 0
    : input.targetText.length;
  return Object.freeze({
    sourceText: input.sourceText.slice(0, input.from),
    targetText: input.targetText.slice(0, targetInsertOffset) +
      movedText +
      input.targetText.slice(targetInsertOffset),
    movedText,
    targetInsertOffset,
  });
}

function freezeRange(range: ManuscriptFormattingRange): ManuscriptFormattingRange {
  return Object.freeze({
    from: range.from,
    to: range.to,
    style: Object.freeze({ ...range.style }),
  });
}

function lineStartAt(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  return text.lastIndexOf("\n", Math.max(0, clamped - 1)) + 1;
}

function normalizeParagraphAlignments(
  entries: readonly ManuscriptParagraphAlignmentEntry[],
): readonly ManuscriptParagraphAlignmentEntry[] {
  const byPosition = new Map<number, ManuscriptParagraphAlignmentEntry>();
  for (const entry of entries) {
    byPosition.set(entry.at, Object.freeze({ ...entry }));
  }
  return Object.freeze([...byPosition.values()].sort(
    (left, right) => left.at - right.at,
  ));
}

function freezeState(
  state: ManuscriptEditorDocumentState,
  ranges: readonly ManuscriptFormattingRange[],
  paragraphAlignments: readonly ManuscriptParagraphAlignmentEntry[],
): ManuscriptEditorDocumentState {
  return Object.freeze({
    ...state,
    ranges: Object.freeze(ranges.map(freezeRange)),
    paragraphAlignments: normalizeParagraphAlignments(paragraphAlignments),
  });
}

export function moveManuscriptEditorStateRange(input: Readonly<{
  sourceText: string;
  targetText: string;
  sourceState: ManuscriptEditorDocumentState;
  targetState: ManuscriptEditorDocumentState;
  from: number;
  to: number;
  placement: MoveRangeToEpisodePlacement;
}>): Readonly<{
  sourceState: ManuscriptEditorDocumentState;
  targetState: ManuscriptEditorDocumentState;
}> {
  const moved = moveRangeToEpisodeText(input);
  const movedLength = input.to - input.from;
  const sourceRanges: ManuscriptFormattingRange[] = [];
  const movedRanges: ManuscriptFormattingRange[] = [];
  for (const range of input.sourceState.ranges) {
    const retainedEnd = Math.min(range.to, input.from);
    if (range.from < retainedEnd) {
      sourceRanges.push({ ...range, to: retainedEnd });
    }
    const movedStart = Math.max(range.from, input.from);
    const movedEnd = Math.min(range.to, input.to);
    if (movedStart < movedEnd) {
      movedRanges.push({
        ...range,
        from: moved.targetInsertOffset + movedStart - input.from,
        to: moved.targetInsertOffset + movedEnd - input.from,
      });
    }
  }
  const targetRanges = input.targetState.ranges.map((range) => {
    if (input.placement === "end") return range;
    return Object.freeze({
      ...range,
      from: range.from + movedLength,
      to: range.to + movedLength,
    });
  });

  const sourceParagraphAlignments = input.sourceState.paragraphAlignments
    .filter((entry) => entry.at < input.from)
    .map((entry) => ({
      ...entry,
      at: lineStartAt(moved.sourceText, entry.at),
    }));
  const movedParagraphAlignments = input.sourceState.paragraphAlignments
    .filter((entry) => entry.at >= input.from && entry.at < input.to)
    .map((entry) => ({
      ...entry,
      at: lineStartAt(
        moved.targetText,
        moved.targetInsertOffset + entry.at - input.from,
      ),
    }));
  const sourceLineStart = lineStartAt(input.sourceText, input.from);
  const activeSourceAlignment = input.sourceState.paragraphAlignments.find(
    (entry) => entry.at === sourceLineStart,
  );
  if (
    activeSourceAlignment !== undefined &&
    !movedParagraphAlignments.some(
      (entry) => entry.at === lineStartAt(moved.targetText, moved.targetInsertOffset),
    )
  ) {
    movedParagraphAlignments.push({
      at: lineStartAt(moved.targetText, moved.targetInsertOffset),
      alignment: activeSourceAlignment.alignment,
    });
  }
  const targetParagraphAlignments = input.targetState.paragraphAlignments.map(
    (entry) => {
      const mapped = input.placement === "start"
        ? entry.at + movedLength
        : entry.at;
      return {
        ...entry,
        at: lineStartAt(moved.targetText, mapped),
      };
    },
  );

  return Object.freeze({
    sourceState: freezeState(
      input.sourceState,
      sourceRanges,
      sourceParagraphAlignments,
    ),
    targetState: freezeState(
      input.targetState,
      [...movedRanges, ...targetRanges].sort(
        (left, right) => left.from - right.from || left.to - right.to,
      ),
      [...movedParagraphAlignments, ...targetParagraphAlignments],
    ),
  });
}

function overlap(
  left: Readonly<{ start: number; end: number }>,
  right: Readonly<{ start: number; end: number }>,
): Readonly<{ start: number; end: number }> | null {
  const start = Math.max(left.start, right.start);
  const end = Math.min(left.end, right.end);
  return start < end ? Object.freeze({ start, end }) : null;
}

export function planEpisodeSceneIdentityChanges(input: Readonly<{
  sourceEpisodeId: EntityId<"Document">;
  targetEpisodeId: EntityId<"Document">;
  from: number;
  to: number;
  targetInsertOffset: number;
  scenes: readonly Readonly<{
    sceneKey: string;
    sceneId: EntityId<"Scene"> | null;
    range: Readonly<{ start: number; end: number }>;
    explicitlyStructured: boolean;
    existingSegments: readonly SceneEpisodeSegmentRange[];
  }>[];
  createSceneId: () => EntityId<"Scene">;
  createSegmentId: () => EntityId<"EpisodeSceneSegment">;
}>): EpisodeSceneIdentityChangePlan {
  const movedRange = Object.freeze({ start: input.from, end: input.to });
  const createdSceneIds = new Set<EntityId<"Scene">>();
  const retiredSegmentIds = new Set<EntityId<"EpisodeSceneSegment">>();
  const createdSegments: SceneEpisodeSegmentRange[] = [];
  for (const scene of input.scenes) {
    if (!scene.explicitlyStructured && scene.sceneId === null) continue;
    if (overlap(scene.range, movedRange) === null) continue;
    const sceneId = scene.sceneId ?? input.createSceneId();
    if (scene.sceneId === null) createdSceneIds.add(sceneId);
    const existingSourceSegments = scene.existingSegments.filter(
      (segment) =>
        segment.sceneId === sceneId &&
        segment.documentId === input.sourceEpisodeId &&
        overlap(segment.range, movedRange) !== null,
    );
    const ranges = existingSourceSegments.length === 0
      ? [scene.range]
      : existingSourceSegments.map((segment) => segment.range);
    for (const segment of existingSourceSegments) {
      retiredSegmentIds.add(segment.segmentId);
    }
    for (const range of ranges) {
      if (range.start < input.from) {
        createdSegments.push(Object.freeze({
          segmentId: input.createSegmentId(),
          sceneId,
          documentId: input.sourceEpisodeId,
          range: Object.freeze({
            start: range.start,
            end: Math.min(range.end, input.from),
          }),
        }));
      }
      const moved = overlap(range, movedRange);
      if (moved !== null) {
        createdSegments.push(Object.freeze({
          segmentId: input.createSegmentId(),
          sceneId,
          documentId: input.targetEpisodeId,
          range: Object.freeze({
            start: input.targetInsertOffset + moved.start - input.from,
            end: input.targetInsertOffset + moved.end - input.from,
          }),
        }));
      }
    }
  }
  return Object.freeze({
    createdSceneIds: Object.freeze([...createdSceneIds]),
    retiredSegmentIds: Object.freeze([...retiredSegmentIds]),
    createdSegments: Object.freeze(createdSegments),
  });
}
