import type { AppendRevisionInput } from "../revisions/revision-store";
import { entityId, type Anchor, type EntityId } from "../../domain/writing";

export type SceneDeletionTarget = Readonly<{
  sceneId: EntityId<"Scene"> | null;
  documentId: EntityId<"Document">;
  sceneKey: string;
}>;

export type PrepareSceneDeletionCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  target: SceneDeletionTarget;
}>;

export type SceneDeletionDocumentPreview = Readonly<{
  documentId: EntityId<"Document">;
  documentTitle: string;
  expectedDocumentRevisionId: EntityId<"DocumentRevision">;
  sceneKey: string;
  sceneRange: Readonly<{ start: number; end: number }>;
  deletionRange: Readonly<{ start: number; end: number }>;
  removedBoundaryAnchorId: EntityId<"Anchor"> | null;
  sceneContentUtf16Length: number;
  deletedUtf16Length: number;
  firstExcerpt: string;
  lastExcerpt: string;
}>;

export type SceneDeletionMetadataPreview = Readonly<{
  kind: "event" | "annotation" | "music-queue";
  metadataId: string;
  label: string;
}>;

export type SceneDeletionPreview = Readonly<{
  schemaVersion: 1;
  previewFingerprint: string;
  workId: EntityId<"Work">;
  target: SceneDeletionTarget;
  sceneRuleSetRevision: number;
  documents: readonly SceneDeletionDocumentPreview[];
  metadata: readonly SceneDeletionMetadataPreview[];
}>;

export type DeleteSceneCommand = Readonly<{
  schemaVersion: 1;
  preview: SceneDeletionPreview;
}>;

export type ListSceneTrashCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type RestoreSceneTrashCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  sceneTrashEntryId: EntityId<"SceneTrashEntry">;
  expectedRevision: number;
}>;

export type UndoSceneDeletionCommand = RestoreSceneTrashCommand;

export type SceneTrashDocumentProjection = Readonly<{
  sceneTrashDocumentId: EntityId<"SceneTrashDocument">;
  documentId: EntityId<"Document">;
  documentTitle: string;
  ordinal: number;
  beforeRevisionId: EntityId<"DocumentRevision">;
  deletedRevisionId: EntityId<"DocumentRevision">;
  restoredRevisionId: EntityId<"DocumentRevision"> | null;
  sceneRange: Readonly<{ start: number; end: number }>;
  deletionRange: Readonly<{ start: number; end: number }>;
  deletedUtf16Length: number;
  firstExcerpt: string;
  lastExcerpt: string;
}>;

export type SceneTrashEntryProjection = Readonly<{
  schemaVersion: 1;
  sceneTrashEntryId: EntityId<"SceneTrashEntry">;
  revision: number;
  workId: EntityId<"Work">;
  sceneId: EntityId<"Scene">;
  sourceSceneKey: string;
  sceneRuleSetRevision: number;
  status: "active" | "restored" | "undone";
  documents: readonly SceneTrashDocumentProjection[];
  metadata: readonly SceneDeletionMetadataPreview[];
  canRestore: boolean;
  conflictReason: string | null;
  deletedAt: string;
  restoredAt: string | null;
}>;

export type SceneTrashListProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  entries: readonly SceneTrashEntryProjection[];
}>;

export type SceneDeletionReceipt = Readonly<{
  schemaVersion: 1;
  status: "deleted" | "restored" | "undone";
  entry: SceneTrashEntryProjection;
  documentRevisions: readonly Readonly<{
    documentId: EntityId<"Document">;
    revisionId: EntityId<"DocumentRevision">;
  }>[];
}>;

export type PreparedSceneTrashDocument = Readonly<{
  sceneTrashDocumentId: EntityId<"SceneTrashDocument">;
  documentId: EntityId<"Document">;
  ordinal: number;
  beforeRevisionId: EntityId<"DocumentRevision">;
  deletedRevision: AppendRevisionInput;
  sceneKey: string;
  sceneRange: Readonly<{ start: number; end: number }>;
  deletionRange: Readonly<{ start: number; end: number }>;
  deletedTextHash: string;
  deletedUtf16Length: number;
  firstExcerpt: string;
  lastExcerpt: string;
}>;

export type PreparedSceneTrashIdentity = Readonly<{
  sceneId: EntityId<"Scene">;
  expectedRevision: number | null;
  createdAnchor: Anchor | null;
  createdSegmentId: EntityId<"EpisodeSceneSegment"> | null;
  createdSegmentDocumentId: EntityId<"Document"> | null;
}>;

export type PreparedSceneTrashSegment = Readonly<{
  sceneTrashSegmentId: EntityId<"SceneTrashSegment">;
  segmentId: EntityId<"EpisodeSceneSegment">;
  expectedRevision: number;
  documentId: EntityId<"Document">;
  ordinal: number;
}>;

export type PreparedSceneTrashOverride = Readonly<{
  sceneTrashOverrideId: EntityId<"SceneTrashOverride">;
  sceneOverrideId: EntityId<"SceneOverride">;
  expectedRevision: number;
  ordinal: number;
}>;

export type PreparedSceneTrashBinding = Readonly<{
  sceneTrashBindingId: EntityId<"SceneTrashBinding">;
  sceneMetadataBindingId: EntityId<"SceneMetadataBinding">;
  expectedRevision: number;
  ordinal: number;
  sceneId: EntityId<"Scene"> | null;
  status: "current" | "needs-review" | "detached";
  proposedSceneId: EntityId<"Scene"> | null;
  lineageOperationId: EntityId<"SceneLineageOperation"> | null;
}>;

export type CommitSceneDeletionInput = Readonly<{
  sceneTrashEntryId: EntityId<"SceneTrashEntry">;
  workId: EntityId<"Work">;
  identity: PreparedSceneTrashIdentity;
  sourceSceneKey: string;
  sceneRuleSetRevision: number;
  previewFingerprint: string;
  metadataJson: string;
  deleteLineageOperationId: EntityId<"SceneLineageOperation">;
  deleteLineageParentMemberId: EntityId<"SceneLineageMember">;
  documents: readonly PreparedSceneTrashDocument[];
  segments: readonly PreparedSceneTrashSegment[];
  overrides: readonly PreparedSceneTrashOverride[];
  bindings: readonly PreparedSceneTrashBinding[];
  createdAt: string;
}>;

export type RestoreSceneDeletionInput = Readonly<{
  sceneTrashEntryId: EntityId<"SceneTrashEntry">;
  workId: EntityId<"Work">;
  expectedRevision: number;
  status: "restored" | "undone";
  restoreLineageOperationId: EntityId<"SceneLineageOperation">;
  restoreLineageParentMemberId: EntityId<"SceneLineageMember">;
  restoreLineageChildMemberId: EntityId<"SceneLineageMember">;
  documentRevisions: readonly AppendRevisionInput[];
  restoredAt: string;
}>;

export type SceneTrashStoreReceipt = Readonly<{
  sceneTrashEntryId: EntityId<"SceneTrashEntry">;
  workId: EntityId<"Work">;
  sceneId: EntityId<"Scene">;
  entryRevision: number;
  documentRevisions: readonly Readonly<{
    documentId: EntityId<"Document">;
    revisionId: EntityId<"DocumentRevision">;
  }>[];
}>;

export type SceneTrashStore = Readonly<{
  commit(input: CommitSceneDeletionInput): Promise<SceneTrashStoreReceipt>;
  restore(input: RestoreSceneDeletionInput): Promise<SceneTrashStoreReceipt>;
}>;

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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  return value;
}

function nonEmpty(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (parsed.length === 0) throw new Error(`${label} must be non-empty text`);
  return parsed;
}

function id<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(value, label));
}

function nullableId<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> | null {
  return value === null ? null : id<TEntity>(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function instant(value: unknown, label: string): string {
  const parsed = nonEmpty(value, label);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new Error(`${label} must be a valid instant`);
  }
  return parsed;
}

function range(value: unknown, label: string): Readonly<{ start: number; end: number }> {
  const input = record(value, label);
  exact(input, ["start", "end"], label);
  const start = integer(input.start, `${label}.start`);
  const end = integer(input.end, `${label}.end`);
  if (end <= start) throw new Error(`${label}.end must be greater than start`);
  return Object.freeze({ start, end });
}

function target(value: unknown, label: string): SceneDeletionTarget {
  const input = record(value, label);
  exact(input, ["sceneId", "documentId", "sceneKey"], label);
  return Object.freeze({
    sceneId: nullableId<"Scene">(input.sceneId, `${label}.sceneId`),
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    sceneKey: nonEmpty(input.sceneKey, `${label}.sceneKey`),
  });
}

function metadata(value: unknown, label: string): SceneDeletionMetadataPreview {
  const input = record(value, label);
  exact(input, ["kind", "metadataId", "label"], label);
  if (
    input.kind !== "event" &&
    input.kind !== "annotation" &&
    input.kind !== "music-queue"
  ) {
    throw new Error(`${label}.kind is unsupported`);
  }
  return Object.freeze({
    kind: input.kind,
    metadataId: nonEmpty(input.metadataId, `${label}.metadataId`),
    label: nonEmpty(input.label, `${label}.label`),
  });
}

function documentPreview(
  value: unknown,
  label: string,
): SceneDeletionDocumentPreview {
  const input = record(value, label);
  exact(input, [
    "documentId",
    "documentTitle",
    "expectedDocumentRevisionId",
    "sceneKey",
    "sceneRange",
    "deletionRange",
    "removedBoundaryAnchorId",
    "sceneContentUtf16Length",
    "deletedUtf16Length",
    "firstExcerpt",
    "lastExcerpt",
  ], label);
  const sceneRange = range(input.sceneRange, `${label}.sceneRange`);
  const deletionRange = range(input.deletionRange, `${label}.deletionRange`);
  if (
    input.sceneContentUtf16Length !== sceneRange.end - sceneRange.start ||
    input.deletedUtf16Length !== deletionRange.end - deletionRange.start
  ) {
    throw new Error(`${label} length fields do not match their ranges`);
  }
  return Object.freeze({
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    documentTitle: nonEmpty(input.documentTitle, `${label}.documentTitle`),
    expectedDocumentRevisionId: id<"DocumentRevision">(
      input.expectedDocumentRevisionId,
      `${label}.expectedDocumentRevisionId`,
    ),
    sceneKey: nonEmpty(input.sceneKey, `${label}.sceneKey`),
    sceneRange,
    deletionRange,
    removedBoundaryAnchorId: nullableId<"Anchor">(
      input.removedBoundaryAnchorId,
      `${label}.removedBoundaryAnchorId`,
    ),
    sceneContentUtf16Length: integer(
      input.sceneContentUtf16Length,
      `${label}.sceneContentUtf16Length`,
      1,
    ),
    deletedUtf16Length: integer(
      input.deletedUtf16Length,
      `${label}.deletedUtf16Length`,
      1,
    ),
    firstExcerpt: nonEmpty(input.firstExcerpt, `${label}.firstExcerpt`),
    lastExcerpt: nonEmpty(input.lastExcerpt, `${label}.lastExcerpt`),
  });
}

export function parsePrepareSceneDeletionCommand(
  value: unknown,
): PrepareSceneDeletionCommand {
  const label = "PrepareSceneDeletionCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "target"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    target: target(input.target, `${label}.target`),
  });
}

export function parseSceneDeletionPreview(value: unknown): SceneDeletionPreview {
  const label = "SceneDeletionPreview";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "previewFingerprint",
    "workId",
    "target",
    "sceneRuleSetRevision",
    "documents",
    "metadata",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.documents) || input.documents.length === 0) {
    throw new Error(`${label}.documents must be a non-empty array`);
  }
  if (!Array.isArray(input.metadata)) {
    throw new Error(`${label}.metadata must be an array`);
  }
  const documents = input.documents.map((document, index) =>
    documentPreview(document, `${label}.documents[${index}]`)
  );
  if (new Set(documents.map((document) => document.documentId)).size !== documents.length) {
    throw new Error(`${label}.documents must be unique by documentId`);
  }
  return Object.freeze({
    schemaVersion: 1,
    previewFingerprint: nonEmpty(
      input.previewFingerprint,
      `${label}.previewFingerprint`,
    ),
    workId: id<"Work">(input.workId, `${label}.workId`),
    target: target(input.target, `${label}.target`),
    sceneRuleSetRevision: integer(
      input.sceneRuleSetRevision,
      `${label}.sceneRuleSetRevision`,
      1,
    ),
    documents: Object.freeze(documents),
    metadata: Object.freeze(input.metadata.map((item, index) =>
      metadata(item, `${label}.metadata[${index}]`)
    )),
  });
}

export function parseDeleteSceneCommand(value: unknown): DeleteSceneCommand {
  const label = "DeleteSceneCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "preview"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    preview: parseSceneDeletionPreview(input.preview),
  });
}

export function parseListSceneTrashCommand(value: unknown): ListSceneTrashCommand {
  const label = "ListSceneTrashCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
  });
}

function parseRestoreCommand(
  value: unknown,
  label: string,
): RestoreSceneTrashCommand {
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "sceneTrashEntryId",
    "expectedRevision",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    sceneTrashEntryId: id<"SceneTrashEntry">(
      input.sceneTrashEntryId,
      `${label}.sceneTrashEntryId`,
    ),
    expectedRevision: integer(input.expectedRevision, `${label}.expectedRevision`, 1),
  });
}

export function parseRestoreSceneTrashCommand(
  value: unknown,
): RestoreSceneTrashCommand {
  return parseRestoreCommand(value, "RestoreSceneTrashCommand");
}

export function parseUndoSceneDeletionCommand(
  value: unknown,
): UndoSceneDeletionCommand {
  return parseRestoreCommand(value, "UndoSceneDeletionCommand");
}

function trashDocument(
  value: unknown,
  label: string,
): SceneTrashDocumentProjection {
  const input = record(value, label);
  exact(input, [
    "sceneTrashDocumentId",
    "documentId",
    "documentTitle",
    "ordinal",
    "beforeRevisionId",
    "deletedRevisionId",
    "restoredRevisionId",
    "sceneRange",
    "deletionRange",
    "deletedUtf16Length",
    "firstExcerpt",
    "lastExcerpt",
  ], label);
  const deletionRange = range(input.deletionRange, `${label}.deletionRange`);
  if (input.deletedUtf16Length !== deletionRange.end - deletionRange.start) {
    throw new Error(`${label}.deletedUtf16Length does not match deletionRange`);
  }
  return Object.freeze({
    sceneTrashDocumentId: id<"SceneTrashDocument">(
      input.sceneTrashDocumentId,
      `${label}.sceneTrashDocumentId`,
    ),
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    documentTitle: nonEmpty(input.documentTitle, `${label}.documentTitle`),
    ordinal: integer(input.ordinal, `${label}.ordinal`),
    beforeRevisionId: id<"DocumentRevision">(
      input.beforeRevisionId,
      `${label}.beforeRevisionId`,
    ),
    deletedRevisionId: id<"DocumentRevision">(
      input.deletedRevisionId,
      `${label}.deletedRevisionId`,
    ),
    restoredRevisionId: nullableId<"DocumentRevision">(
      input.restoredRevisionId,
      `${label}.restoredRevisionId`,
    ),
    sceneRange: range(input.sceneRange, `${label}.sceneRange`),
    deletionRange,
    deletedUtf16Length: integer(
      input.deletedUtf16Length,
      `${label}.deletedUtf16Length`,
      1,
    ),
    firstExcerpt: nonEmpty(input.firstExcerpt, `${label}.firstExcerpt`),
    lastExcerpt: nonEmpty(input.lastExcerpt, `${label}.lastExcerpt`),
  });
}

export function parseSceneTrashEntryProjection(
  value: unknown,
): SceneTrashEntryProjection {
  const label = "SceneTrashEntryProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "sceneTrashEntryId",
    "revision",
    "workId",
    "sceneId",
    "sourceSceneKey",
    "sceneRuleSetRevision",
    "status",
    "documents",
    "metadata",
    "canRestore",
    "conflictReason",
    "deletedAt",
    "restoredAt",
  ], label);
  schema(input, label);
  if (
    input.status !== "active" &&
    input.status !== "restored" &&
    input.status !== "undone"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  if (!Array.isArray(input.documents) || input.documents.length === 0) {
    throw new Error(`${label}.documents must be a non-empty array`);
  }
  if (!Array.isArray(input.metadata)) {
    throw new Error(`${label}.metadata must be an array`);
  }
  if (typeof input.canRestore !== "boolean") {
    throw new Error(`${label}.canRestore must be boolean`);
  }
  const conflictReason = input.conflictReason === null
    ? null
    : nonEmpty(input.conflictReason, `${label}.conflictReason`);
  if (input.canRestore === (conflictReason !== null)) {
    throw new Error(`${label}.canRestore conflicts with conflictReason`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sceneTrashEntryId: id<"SceneTrashEntry">(
      input.sceneTrashEntryId,
      `${label}.sceneTrashEntryId`,
    ),
    revision: integer(input.revision, `${label}.revision`, 1),
    workId: id<"Work">(input.workId, `${label}.workId`),
    sceneId: id<"Scene">(input.sceneId, `${label}.sceneId`),
    sourceSceneKey: nonEmpty(input.sourceSceneKey, `${label}.sourceSceneKey`),
    sceneRuleSetRevision: integer(
      input.sceneRuleSetRevision,
      `${label}.sceneRuleSetRevision`,
      1,
    ),
    status: input.status,
    documents: Object.freeze(input.documents.map((document, index) =>
      trashDocument(document, `${label}.documents[${index}]`)
    )),
    metadata: Object.freeze(input.metadata.map((item, index) =>
      metadata(item, `${label}.metadata[${index}]`)
    )),
    canRestore: input.canRestore,
    conflictReason,
    deletedAt: instant(input.deletedAt, `${label}.deletedAt`),
    restoredAt: input.restoredAt === null
      ? null
      : instant(input.restoredAt, `${label}.restoredAt`),
  });
}

export function parseSceneTrashListProjection(
  value: unknown,
): SceneTrashListProjection {
  const label = "SceneTrashListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "entries"], label);
  schema(input, label);
  if (!Array.isArray(input.entries)) throw new Error(`${label}.entries must be an array`);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const entries = input.entries.map(parseSceneTrashEntryProjection);
  if (entries.some((entry) => entry.workId !== workId)) {
    throw new Error(`${label} contains an entry outside its Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, entries: Object.freeze(entries) });
}

export function parseSceneDeletionReceipt(value: unknown): SceneDeletionReceipt {
  const label = "SceneDeletionReceipt";
  const input = record(value, label);
  exact(input, ["schemaVersion", "status", "entry", "documentRevisions"], label);
  schema(input, label);
  if (
    input.status !== "deleted" &&
    input.status !== "restored" &&
    input.status !== "undone"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  if (!Array.isArray(input.documentRevisions) || input.documentRevisions.length === 0) {
    throw new Error(`${label}.documentRevisions must be a non-empty array`);
  }
  const entry = parseSceneTrashEntryProjection(input.entry);
  const documentRevisions = input.documentRevisions.map((value, index) => {
    const revisionLabel = `${label}.documentRevisions[${index}]`;
    const revision = record(value, revisionLabel);
    exact(revision, ["documentId", "revisionId"], revisionLabel);
    return Object.freeze({
      documentId: id<"Document">(revision.documentId, `${revisionLabel}.documentId`),
      revisionId: id<"DocumentRevision">(
        revision.revisionId,
        `${revisionLabel}.revisionId`,
      ),
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    status: input.status,
    entry,
    documentRevisions: Object.freeze(documentRevisions),
  });
}
