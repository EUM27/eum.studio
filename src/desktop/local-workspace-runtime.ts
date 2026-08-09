import {
  createHash,
  randomUUID,
} from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import {
  CreateAnchor,
} from "../application/anchors/create-anchor";
import {
  ResolveAnchor,
} from "../application/anchors/resolve-anchor";
import {
  CaptureResumeCheckpointWithAnchors,
  type ResumeCheckpointWithAnchorsCaptureTransaction,
} from "../application/checkpoints/capture-resume-checkpoint-with-anchors";
import {
  ResolveResumeCheckpointForWork,
  ResumeAnchorIntegrityError,
  type ResumeCheckpointResolution,
} from "../application/checkpoints/resolve-resume-checkpoint-for-work";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../application/editor/manuscript-document-profile";
import {
  applyChangeBatch,
} from "../application/persistence/apply-change-batch";
import {
  classifyChangeBatchIdentity,
  encodeDurableText,
  parseChangeBatch,
  type ChangeBatch,
} from "../application/persistence/change-batch";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptBatchingPolicy,
  type ManuscriptPersistenceProfile,
} from "../application/persistence/manuscript-persistence-profile";
import {
  DurableChangeBatchSaveConflictError,
  type RevisionSaveReceipt,
  type SaveReceipt,
} from "../application/persistence/save-change-batch";
import type {
  ApplyStartupRecoveryAcknowledgement,
  StartupRecoveryProjection,
} from "../application/persistence/startup-recovery-contract";
import type {
  RevisionBlobProfile,
  RevisionStore,
} from "../application/revisions/revision-store";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseRestoreDocumentRevisionCommand,
  parseRestoreDocumentRevisionResult,
  parseWorkSnapshotListProjection,
  type CreateWorkSnapshotCommand,
  type DocumentRevisionListProjection,
  type ListDocumentRevisionsCommand,
  type ListWorkSnapshotsCommand,
  type RestoreDocumentRevisionCommand,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../application/revisions/work-version-contract";
import type {
  StorageTransaction,
} from "../application/storage/storage-service";
import type {
  LocalWorkspaceBackupStatusProjection,
  LocalWorkspaceBackupSummary,
} from "../application/storage/local-workspace-backup-contract";
import type {
  LocalWorkspaceBackupProfile,
} from "../application/storage/local-workspace-backup-profile";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type FocusCycleProjection,
  type ListWorkActivityCommand,
  type StartFocusCycleCommand,
  type StartWritingSessionCommand,
  type StopFocusCycleCommand,
  type StopWritingSessionCommand,
  type WorkActivityProjection,
  type WritingSessionProjection,
} from "../application/activity/work-activity-contract";
import {
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseEventBlockProjection,
  parseListEventBlocksCommand,
  type CreateEventBlockCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
  type ListEventBlocksCommand,
} from "../application/structure/event-block-contract";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  parseSceneOverrideProjection,
  type CreateSceneOverrideCommand,
  type ListSceneOverridesCommand,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../application/structure/scene-override-contract";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateWorkCommand,
  parseCreateWorkResult,
  parseWorkspaceCatalogProjection,
  type ActivateWorkspaceLocationCommand,
  type CaptureWorkspaceResumeCommand,
  type CreateDocumentResult,
  type CreateFirstWorkCommand,
  type CreateFirstWorkResult,
  type CreateWorkResult,
  type WorkspaceCatalogProjection,
} from "../application/workspace/workspace-contract";
import type {
  LocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import type {
  Poc3LedgerRecord,
} from "../domain/poc-3-storage-ledger";
import {
  createWritingCatalog,
  entityId,
  type Anchor,
  type Document,
  type EntityId,
  type Work,
} from "../domain/writing";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../platform/anchors/node-crypto-anchor-evidence";
import {
  createNodeImmutableBlobStore,
} from "../platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../platform/storage/node-immutable-blob-store-profile";
import {
  openNodeSqliteLedger,
} from "../platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../platform/storage/node-sqlite-ledger-profile";
import type {
  ManuscriptRuntimeCoordinator,
} from "./manuscript-runtime-coordinator";
import {
  createLocalWorkspaceBackupService,
  type LocalWorkspaceBackupService,
} from "./local-workspace-backup-service";

type NodeSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
  run(
    ...parameters: readonly unknown[]
  ): {
    readonly changes: number | bigint;
  };
};

type NodeSqliteDatabase = {
  prepare(sql: string): NodeSqliteStatement;
  exec(sql: string): void;
  close(): void;
};

type NodeSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
  ) => NodeSqliteDatabase;
};

type StoredDocumentRow = {
  readonly workId: EntityId<"Work">;
  readonly workSchemaVersion: number;
  readonly workRevision: number;
  readonly workCreatedAt: string;
  readonly workTitle: string;
  readonly workUpdatedAt: string;
  readonly workStudioId: EntityId<"Studio">;
  readonly workOrderKey: string;
  readonly workResumeCheckpointId:
    EntityId<"ResumeCheckpoint"> | null;
  readonly workSettingsId: EntityId<"WorkSettings">;
  readonly documentId: EntityId<"Document">;
  readonly documentSchemaVersion: number;
  readonly documentRevision: number;
  readonly documentCreatedAt: string;
  readonly documentUpdatedAt: string;
  readonly documentTitle: string;
  readonly documentOrderKey: string;
  readonly manuscriptId: EntityId<"Manuscript">;
  readonly currentRevisionId:
    EntityId<"DocumentRevision">;
};

type MutableDocumentSaveTarget = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  baseRevisionId:
    EntityId<"DocumentRevision">;
  currentRevisionId:
    EntityId<"DocumentRevision">;
  nextSequence: number;
  text: string;
};

type AcceptedBatch = {
  readonly batch: ChangeBatch;
  readonly receipt: RevisionSaveReceipt;
};

type StoredEventBlockRow = {
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly anchorId: EntityId<"Anchor">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly title: string;
  readonly note: string;
  readonly exactQuote: string;
  readonly createdAt: string;
};

type StoredSceneOverrideRow = {
  readonly sceneOverrideId: EntityId<"SceneOverride">;
  readonly anchorId: EntityId<"Anchor">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly operation: CreateSceneOverrideCommand["operation"];
  readonly baseRuleSetRevision: number;
  readonly note: string;
  readonly exactQuote: string;
  readonly orderIndex: number;
  readonly createdAt: string;
};

type StoredWritingSessionRow = {
  readonly sessionId: EntityId<"WritingSession">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document"> | null;
  readonly state: "active" | "completed";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly startRevisionId: EntityId<"DocumentRevision"> | null;
  readonly endRevisionId: EntityId<"DocumentRevision"> | null;
  readonly note: string;
};

type StoredActivityIntervalRow = {
  readonly sessionId: EntityId<"WritingSession">;
  readonly startedAt: string;
  readonly endedAt: string;
};

type StoredFocusCycleRow = {
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession"> | null;
  readonly state: "running" | "stopped";
  readonly phaseRef: string;
  readonly targetDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string;
  readonly completedAt: string | null;
  readonly note: string;
};

export type LocalWorkspaceRuntime =
  ManuscriptRuntimeCoordinator & {
    getWorkspaceCatalog(): WorkspaceCatalogProjection;
    activateWorkspaceLocation(
      value: unknown,
    ): Promise<WorkspaceCatalogProjection>;
    createWork(value: unknown): Promise<CreateWorkResult>;
    createFirstWork(
      value: unknown,
    ): Promise<CreateFirstWorkResult>;
    createDocument(
      value: unknown,
    ): Promise<CreateDocumentResult>;
    captureWorkspaceResume(
      value: unknown,
    ): Promise<ManuscriptResumeCheckpointProjection>;
    createEventBlock(value: unknown): Promise<EventBlockProjection>;
    listEventBlocks(value: unknown): Promise<EventBlockListProjection>;
    createSceneOverride(value: unknown): Promise<SceneOverrideProjection>;
    listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection>;
    startWritingSession(value: unknown): Promise<WorkActivityProjection>;
    stopWritingSession(value: unknown): Promise<WorkActivityProjection>;
    startFocusCycle(value: unknown): Promise<WorkActivityProjection>;
    stopFocusCycle(value: unknown): Promise<WorkActivityProjection>;
    listWorkActivity(value: unknown): Promise<WorkActivityProjection>;
    listDocumentRevisions(
      value: unknown,
    ): Promise<DocumentRevisionListProjection>;
    restoreDocumentRevision(
      value: unknown,
    ): Promise<RestoreDocumentRevisionResult>;
    createWorkSnapshot(value: unknown): Promise<WorkSnapshotProjection>;
    listWorkSnapshots(value: unknown): Promise<WorkSnapshotListProjection>;
    getBackupStatus(): Promise<LocalWorkspaceBackupStatusProjection>;
    createBackupBundle(finalBundleRoot: string): Promise<LocalWorkspaceBackupSummary>;
    restoreBackupBundle(
      finalBundleRoot: string,
      targetFinalRoot: string,
    ): Promise<LocalWorkspaceBackupSummary>;
    close(): void;
  };

export type LocalWorkspaceRuntimeOptions = {
  readonly rootDirectoryPath: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly batchingPolicy:
    ManuscriptBatchingPolicy;
  readonly emptyDocumentProfile:
    ManuscriptDocumentProfile;
  readonly defaults: LocalWorkspaceDefaults;
  readonly backupProfile: LocalWorkspaceBackupProfile;
};

export const LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION = 1;
export const LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY =
  "eum-studio-ledger-sha256-v1";
export const LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY =
  "eum-studio-manuscript-utf16le-v1";
export const LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM = "sha256";

const DOCUMENT_ROWS_SQL = `
SELECT
  w.id AS "workId",
  w.schema_version AS "workSchemaVersion",
  w.revision AS "workRevision",
  w.created_at AS "workCreatedAt",
  w.title AS "workTitle",
  w.updated_at AS "workUpdatedAt",
  w.studio_id AS "workStudioId",
  w.order_key AS "workOrderKey",
  w.resume_checkpoint_id AS "workResumeCheckpointId",
  w.settings_id AS "workSettingsId",
  d.id AS "documentId",
  d.schema_version AS "documentSchemaVersion",
  d.revision AS "documentRevision",
  d.created_at AS "documentCreatedAt",
  d.updated_at AS "documentUpdatedAt",
  d.title AS "documentTitle",
  d.order_key AS "documentOrderKey",
  d.manuscript_id AS "manuscriptId",
  m.current_revision_id AS "currentRevisionId"
FROM works AS w
JOIN documents AS d
  ON d.work_id = w.id
JOIN manuscripts AS m
  ON m.id = d.manuscript_id
  AND m.work_id = w.id
  AND m.document_id = d.id
WHERE
  w.retired_at IS NULL
  AND d.retired_at IS NULL
  AND d.archived_at IS NULL
ORDER BY
  w.updated_at DESC,
  w.order_key DESC,
  d.order_key ASC,
  d.created_at ASC
`;

const EVENT_BLOCK_ROWS_SQL = `
SELECT
  e.id AS "eventBlockId",
  a.id AS "anchorId",
  e.work_id AS "workId",
  a.document_id AS "documentId",
  e.title AS "title",
  COALESCE(e.note, '') AS "note",
  a.exact_quote AS "exactQuote",
  e.created_at AS "createdAt"
FROM event_blocks AS e
JOIN range_groups AS rg
  ON rg.work_id = e.work_id
  AND rg.id = e.range_group_id
JOIN range_group_anchors AS rga
  ON rga.work_id = rg.work_id
  AND rga.range_group_id = rg.id
  AND rga.order_index = 0
JOIN anchors AS a
  ON a.work_id = rga.work_id
  AND a.id = rga.anchor_id
WHERE
  e.work_id = ?
  AND e.retired_at IS NULL
ORDER BY e.order_key ASC
`;

const SCENE_OVERRIDE_ROWS_SQL = `
SELECT
  so.id AS "sceneOverrideId",
  soa.anchor_id AS "anchorId",
  so.work_id AS "workId",
  so.document_id AS "documentId",
  so.operation AS "operation",
  so.base_rule_set_revision AS "baseRuleSetRevision",
  COALESCE(so.note, '') AS "note",
  a.exact_quote AS "exactQuote",
  soa.order_index AS "orderIndex",
  so.created_at AS "createdAt"
FROM scene_overrides AS so
JOIN scene_override_anchors AS soa
  ON soa.work_id = so.work_id
  AND soa.document_id = so.document_id
  AND soa.scene_override_id = so.id
JOIN anchors AS a
  ON a.work_id = soa.work_id
  AND a.document_id = soa.document_id
  AND a.id = soa.anchor_id
WHERE
  so.work_id = ?
  AND so.retired_at IS NULL
ORDER BY so.created_at ASC, so.id ASC, soa.order_index ASC
`;

const WORK_SCENE_RULE_REVISION_SQL = `
SELECT ws.revision AS "baseRuleSetRevision"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

const WORK_ACTIVITY_POLICY_ROWS_SQL = `
SELECT
  ws.activity_policy_id AS "activityPolicyId",
  ws.focus_policy_id AS "focusPolicyId"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

const WRITING_SESSION_ROWS_SQL = `
SELECT
  id AS "sessionId",
  work_id AS "workId",
  document_id AS "documentId",
  state AS "state",
  started_at AS "startedAt",
  ended_at AS "endedAt",
  start_revision_id AS "startRevisionId",
  end_revision_id AS "endRevisionId",
  COALESCE(note, '') AS "note"
FROM writing_sessions
WHERE work_id = ? AND retired_at IS NULL
ORDER BY started_at DESC, id DESC
`;

const ACTIVITY_INTERVAL_ROWS_SQL = `
SELECT
  session_id AS "sessionId",
  started_at AS "startedAt",
  ended_at AS "endedAt"
FROM activity_intervals
WHERE work_id = ?
ORDER BY started_at ASC, id ASC
`;

const FOCUS_CYCLE_ROWS_SQL = `
SELECT
  id AS "focusCycleId",
  work_id AS "workId",
  session_id AS "sessionId",
  state AS "state",
  phase_ref AS "phaseRef",
  target_duration AS "targetDurationMs",
  started_at AS "startedAt",
  deadline_at AS "deadlineAt",
  completed_at AS "completedAt",
  COALESCE(note, '') AS "note"
FROM focus_cycles
WHERE work_id = ? AND retired_at IS NULL
ORDER BY created_at DESC, id DESC
`;

const DOCUMENT_REVISION_ROWS_SQL = `
SELECT
  dr.id AS "revisionId",
  dr.work_id AS "workId",
  dr.document_id AS "documentId",
  dr.parent_revision_id AS "parentRevisionId",
  dr.length AS "length",
  dr.cause AS "cause",
  dr.created_at AS "createdAt",
  dr.durable_at AS "durableAt",
  CASE WHEN m.current_revision_id = dr.id THEN 1 ELSE 0 END AS "isCurrent"
FROM document_revisions AS dr
JOIN manuscripts AS m
  ON m.work_id = dr.work_id
  AND m.document_id = dr.document_id
WHERE dr.work_id = ? AND dr.document_id = ?
ORDER BY dr.created_at DESC, dr.id DESC
`;

const WORK_SNAPSHOT_ROWS_SQL = `
SELECT
  ws.id AS "workSnapshotId",
  ws.work_id AS "workId",
  ws.label AS "label",
  ws.cause AS "cause",
  ws.manifest_hash AS "manifestHash",
  ws.created_at AS "createdAt",
  wsdr.document_id AS "documentId",
  wsdr.document_revision_id AS "documentRevisionId"
FROM work_snapshots AS ws
LEFT JOIN work_snapshot_document_revisions AS wsdr
  ON wsdr.work_id = ws.work_id
  AND wsdr.work_snapshot_id = ws.id
WHERE ws.work_id = ?
ORDER BY ws.created_at DESC, ws.id DESC, wsdr.document_id ASC
`;

const WORK_STRUCTURE_REVISION_ROWS_SQL = `
SELECT 'Anchor' AS "entityKind", id AS "entityId", revision AS "revision"
FROM anchors
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'EventBlock', id, revision
FROM event_blocks
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'RangeGroup', id, revision
FROM range_groups
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'SceneOverride', id, revision
FROM scene_overrides
WHERE work_id = ? AND retired_at IS NULL
ORDER BY "entityKind" ASC, "entityId" ASC
`;

const STUDIO_ROWS_SQL = `
SELECT id
FROM studios
ORDER BY created_at ASC, id ASC
`;

function loadNodeSqlite(): NodeSqliteModule {
  const loaded = process.getBuiltinModule(
    "node:sqlite",
  ) as NodeSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error("node:sqlite is unavailable");
  }
  return loaded;
}

function readRequiredString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readRequiredInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = row[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(`${label}.${field} must be a safe integer`);
  }
  return value;
}

function readNullableIdentity<TEntity extends string>(
  row: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function decodeDurableText(bytes: Uint8Array): string {
  if (bytes.byteLength % 2 !== 0) {
    throw new Error("Durable manuscript bytes must contain complete UTF-16 code units");
  }
  const codeUnits = new Uint16Array(bytes.byteLength / 2);
  for (let index = 0; index < codeUnits.length; index += 1) {
    codeUnits[index] =
      (bytes[index * 2] ?? 0) |
      ((bytes[index * 2 + 1] ?? 0) << 8);
  }
  const chunks: string[] = [];
  const chunkSize = 16_384;
  for (let index = 0; index < codeUnits.length; index += chunkSize) {
    chunks.push(
      String.fromCharCode(
        ...codeUnits.subarray(index, index + chunkSize),
      ),
    );
  }
  return chunks.join("");
}

export function createLocalWorkspaceRevisionBlobProfile(
  findStoredManifestCreatedAt: (blobRef: string) => string | null = () => null,
): RevisionBlobProfile {
  const manifestCreatedAtByBlobRef = new Map<string, string>();
  const blobRefForAddress = (address: {
    readonly checksumIdentity: string;
    readonly checksumValue: string;
  }) =>
    JSON.stringify([
      LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY,
      address.checksumIdentity,
      address.checksumValue,
    ]);
  return Object.freeze({
    codec: Object.freeze({
      identity: LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY,
      encode: encodeDurableText,
      decode: decodeDurableText,
      describe: (content: string) => {
        const bytes = encodeDurableText(content);
        return Object.freeze({
          contentHash: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
            .update(bytes)
            .digest("hex"),
          length: content.length,
        });
      },
    }),
    blobRefForAddress,
    addressForBlobRef: (blobRef) => {
      const decoded = JSON.parse(blobRef) as readonly unknown[];
      if (
        decoded.length !== 3 ||
        decoded[0] !== LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY ||
        typeof decoded[1] !== "string" ||
        typeof decoded[2] !== "string"
      ) {
        throw new Error("Stored manuscript blob reference is invalid");
      }
      return Object.freeze({
        checksumIdentity: decoded[1],
        checksumValue: decoded[2],
      });
    },
    metadataForAppend: (input) =>
      Object.freeze({
        kind: "manuscript-revision",
        workId: input.workId,
        documentId: input.documentId,
        revisionId: input.revisionId,
      }),
    temporaryEntryIdentityForAppend: (input) =>
      input.revisionId,
    manifestMetadataForAppend: (input) => {
      const bytes = encodeDurableText(input.content);
      const blobRef = blobRefForAddress({
        checksumIdentity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
        checksumValue: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(bytes)
          .digest("hex"),
      });
      let createdAt = manifestCreatedAtByBlobRef.get(blobRef);
      if (createdAt === undefined) {
        createdAt = findStoredManifestCreatedAt(blobRef) ?? input.createdAt;
        manifestCreatedAtByBlobRef.set(blobRef, createdAt);
      }
      return Object.freeze({
        createdAt,
        mediaType: "text/plain; charset=utf-16le",
      });
    },
  });
}

export function createLocalWorkspaceStorageProfiles(
  rootDirectoryPath: string,
) {
  const databasePath = path.join(
    rootDirectoryPath,
    "workspace.sqlite3",
  );
  const ledgerProfile = parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
    requestedSettings: {
      journalMode: {
        applySql: "PRAGMA journal_mode = WAL",
        verifySql: "PRAGMA journal_mode",
        expectedRows: [{ journal_mode: "wal" }],
      },
      synchronous: {
        applySql: "PRAGMA synchronous = FULL",
        verifySql: "PRAGMA synchronous",
        expectedRows: [{ synchronous: 2 }],
      },
      foreignKeys: {
        applySql: "PRAGMA foreign_keys = ON",
        verifySql: "PRAGMA foreign_keys",
        expectedRows: [{ foreign_keys: 1 }],
      },
    },
    targetSchemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
  });
  const blobStoreProfile = parseNodeImmutableBlobStoreProfile({
    rootDirectoryPath,
    checksum: {
      identity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
      algorithm: LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    },
    publishedLayout: {
      directorySegments: ["blobs", "published"],
      shardWidths: [2, 2],
      fileNamePrefix: "",
      fileNameSuffix: ".blob",
    },
    temporaryLayout: {
      directorySegments: ["blobs", "temporary"],
    },
  });
  return Object.freeze({
    databasePath,
    ledgerProfile,
    blobStoreProfile,
  });
}

function createRecordMeta(now: string) {
  return Object.freeze({
    schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });
}

function createAnchorLedgerRecord(
  workId: EntityId<"Work">,
  anchor: Anchor,
): Poc3LedgerRecord {
  return Object.freeze({
    kind: "anchor",
    ...anchor.meta,
    workId,
    documentId: anchor.documentId,
    originRevisionId: anchor.originRevisionId,
    resolvedRevisionId: anchor.resolvedRevisionId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    exactQuote: anchor.exactQuote,
    prefixContext: anchor.prefixContext,
    suffixContext: anchor.suffixContext,
    quoteHash: anchor.quoteHash,
    contextHash: anchor.contextHash,
    ...(anchor.lineageRef === undefined
      ? {}
      : { lineageRef: anchor.lineageRef }),
    status: anchor.status,
    resolutionEvidenceJson: JSON.stringify(
      anchor.resolutionEvidence,
    ),
  });
}

function createInitialRecords(input: {
  readonly includeStudio: boolean;
  readonly studioId: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly command: CreateFirstWorkCommand;
  readonly now: string;
  readonly workId: string;
  readonly settingsId: string;
  readonly activityPolicyId: string;
  readonly focusPolicyId: string;
  readonly sceneRuleSetId: string;
  readonly documentId: string;
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly blobRef: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly contentHash: string;
  readonly defaults: LocalWorkspaceDefaults;
  readonly includeBlobManifest: boolean;
}): readonly Poc3LedgerRecord[] {
  const meta = createRecordMeta(input.now);
  return Object.freeze([
    ...(input.includeStudio
      ? [
          {
            kind: "studio" as const,
            id: input.studioId,
            displayName: input.studioDisplayName,
            locale: input.locale,
            timezone: input.timezone,
            settingsRevision: 1,
            createdAt: input.now,
          },
        ]
      : []),
    {
      kind: "work",
      ...meta,
      id: input.workId,
      studioId: input.studioId,
      title: input.command.title,
      orderKey: JSON.stringify([input.now, input.workId]),
      settingsId: input.settingsId,
    },
    {
      kind: "activityPolicy",
      ...meta,
      id: input.activityPolicyId,
      workId: input.workId,
      ...input.defaults.activityPolicy,
    },
    {
      kind: "focusPolicy",
      ...meta,
      id: input.focusPolicyId,
      workId: input.workId,
      ...input.defaults.focusPolicy,
    },
    {
      kind: "workSettings",
      id: input.settingsId,
      workId: input.workId,
      sceneRuleSetId: input.sceneRuleSetId,
      activityPolicyId: input.activityPolicyId,
      focusPolicyId: input.focusPolicyId,
      railPreferencesJson: input.defaults.railPreferencesJson,
      revision: 1,
    },
    ...(input.includeBlobManifest
      ? [{
          kind: "blobManifest" as const,
          blobRef: input.blobRef,
          checksumIdentity: input.checksumIdentity,
          checksumValue: input.checksumValue,
          byteLength: input.byteLength,
          createdAt: input.now,
          mediaType: "text/plain; charset=utf-16le",
        }]
      : []),
    {
      kind: "document",
      ...meta,
      id: input.documentId,
      workId: input.workId,
      title: input.command.firstDocumentTitle,
      orderKey: JSON.stringify([input.now, input.documentId]),
      manuscriptId: input.manuscriptId,
    },
    {
      kind: "documentRevision",
      id: input.revisionId,
      workId: input.workId,
      documentId: input.documentId,
      contentRef: input.blobRef,
      contentHash: input.contentHash,
      length: 0,
      cause: "create-first-document",
      createdAt: input.now,
      durableAt: input.now,
    },
    {
      kind: "manuscript",
      id: input.manuscriptId,
      workId: input.workId,
      documentId: input.documentId,
      currentRevisionId: input.revisionId,
      durableRevisionId: input.revisionId,
      updatedAt: input.now,
    },
  ]);
}

function createDocumentRecords(input: {
  readonly now: string;
  readonly workId: string;
  readonly title: string;
  readonly documentId: string;
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly blobRef: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly contentHash: string;
  readonly includeBlobManifest: boolean;
}): readonly Poc3LedgerRecord[] {
  const meta = createRecordMeta(input.now);
  return Object.freeze([
    ...(input.includeBlobManifest
      ? [{
          kind: "blobManifest" as const,
          blobRef: input.blobRef,
          checksumIdentity: input.checksumIdentity,
          checksumValue: input.checksumValue,
          byteLength: input.byteLength,
          createdAt: input.now,
          mediaType: "text/plain; charset=utf-16le",
        }]
      : []),
    {
      kind: "document",
      ...meta,
      id: input.documentId,
      workId: input.workId,
      title: input.title,
      orderKey: JSON.stringify([input.now, input.documentId]),
      manuscriptId: input.manuscriptId,
    },
    {
      kind: "documentRevision",
      id: input.revisionId,
      workId: input.workId,
      documentId: input.documentId,
      contentRef: input.blobRef,
      contentHash: input.contentHash,
      length: 0,
      cause: "create-document",
      createdAt: input.now,
      durableAt: input.now,
    },
    {
      kind: "manuscript",
      id: input.manuscriptId,
      workId: input.workId,
      documentId: input.documentId,
      currentRevisionId: input.revisionId,
      durableRevisionId: input.revisionId,
      updatedAt: input.now,
    },
  ]);
}

function shouldInsertBlobManifest(
  database: NodeSqliteDatabase,
  input: {
    readonly blobRef: string;
    readonly checksumIdentity: string;
    readonly checksumValue: string;
    readonly byteLength: number;
  },
): boolean {
  const rows = database
    .prepare(`
      SELECT
        checksum_identity AS "checksumIdentity",
        checksum_value AS "checksumValue",
        byte_length AS "byteLength"
      FROM blob_manifests
      WHERE blob_ref = ?
    `)
    .all(input.blobRef);
  if (rows.length === 0) {
    return true;
  }
  if (rows.length !== 1) {
    throw new Error(`Blob manifest identity is ambiguous: ${input.blobRef}`);
  }
  const row = rows[0] ?? {};
  if (
    row.checksumIdentity !== input.checksumIdentity ||
    row.checksumValue !== input.checksumValue ||
    row.byteLength !== input.byteLength
  ) {
    throw new Error(`Blob manifest content conflict: ${input.blobRef}`);
  }
  return false;
}

class DefaultLocalWorkspaceRuntime
  implements LocalWorkspaceRuntime
{
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #revisionStore: RevisionStore;
  readonly #blobStore: Awaited<
    ReturnType<typeof createNodeImmutableBlobStore>
  >;
  readonly #blobProfile: RevisionBlobProfile;
  readonly #backupService: LocalWorkspaceBackupService;
  readonly #options: LocalWorkspaceRuntimeOptions;
  readonly #documentTargets = new Map<
    EntityId<"Document">,
    MutableDocumentSaveTarget
  >();
  readonly #acceptedByBatchId = new Map<
    EntityId<"ChangeBatch">,
    AcceptedBatch
  >();
  #documentProfile: ManuscriptDocumentProfile;
  #catalog: WorkspaceCatalogProjection;
  #resumeProjection: ManuscriptResumeCheckpointProjection;
  #savePending: Promise<void> = Promise.resolve();
  #createPending: Promise<void> = Promise.resolve();
  #closed = false;

  constructor(input: {
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
      ReturnType<typeof openNodeSqliteLedger>
    >;
    readonly revisionStore: RevisionStore;
    readonly blobStore: Awaited<
      ReturnType<typeof createNodeImmutableBlobStore>
    >;
    readonly blobProfile: RevisionBlobProfile;
    readonly backupService: LocalWorkspaceBackupService;
    readonly options: LocalWorkspaceRuntimeOptions;
    readonly documentProfile: ManuscriptDocumentProfile;
    readonly catalog: WorkspaceCatalogProjection;
    readonly resumeProjection: ManuscriptResumeCheckpointProjection;
    readonly documentTargets:
      readonly MutableDocumentSaveTarget[];
  }) {
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#revisionStore = input.revisionStore;
    this.#blobStore = input.blobStore;
    this.#blobProfile = input.blobProfile;
    this.#backupService = input.backupService;
    this.#options = input.options;
    this.#documentProfile = input.documentProfile;
    this.#catalog = input.catalog;
    this.#resumeProjection = input.resumeProjection;
    for (const target of input.documentTargets) {
      this.#documentTargets.set(target.documentId, target);
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("Local workspace runtime is closed");
    }
  }

  getWorkspaceCatalog(): WorkspaceCatalogProjection {
    this.#assertOpen();
    return this.#catalog;
  }

  activateWorkspaceLocation(
    value: unknown,
  ): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseActivateWorkspaceLocationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      await this.#reload(command);
      return this.#catalog;
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getManuscriptDocumentProfile(): ManuscriptDocumentProfile {
    this.#assertOpen();
    return this.#documentProfile;
  }

  getManuscriptPersistenceProfile(): ManuscriptPersistenceProfile | null {
    this.#assertOpen();
    if (this.#documentTargets.size === 0) {
      return null;
    }
    return parseManuscriptPersistenceProfile({
      schemaVersion: 1,
      batching: this.#options.batchingPolicy,
      documentSequences: [...this.#documentTargets.values()].map(
        (target) => ({
          documentId: target.documentId,
          nextSequence: target.nextSequence,
        }),
      ),
    });
  }

  getManuscriptStartupRecovery(): StartupRecoveryProjection {
    this.#assertOpen();
    return Object.freeze({
      schemaVersion: 1,
      status: "clean",
      issues: Object.freeze([]),
    });
  }

  getManuscriptResumeCheckpoint(): ManuscriptResumeCheckpointProjection {
    this.#assertOpen();
    return this.#resumeProjection;
  }

  captureWorkspaceResume(
    value: unknown,
  ): Promise<ManuscriptResumeCheckpointProjection> {
    this.#assertOpen();
    const command = parseCaptureWorkspaceResumeCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#captureWorkspaceResumeSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createEventBlock(value: unknown): Promise<EventBlockProjection> {
    this.#assertOpen();
    const command = parseCreateEventBlockCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createEventBlockSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listEventBlocks(value: unknown): Promise<EventBlockListProjection> {
    this.#assertOpen();
    const command = parseListEventBlocksCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listEventBlocksSerially(command),
    );
  }

  createSceneOverride(value: unknown): Promise<SceneOverrideProjection> {
    this.#assertOpen();
    const command = parseCreateSceneOverrideCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createSceneOverrideSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection> {
    this.#assertOpen();
    const command = parseListSceneOverridesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneOverridesSerially(command),
    );
  }

  startWritingSession(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStartWritingSessionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#startWritingSessionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  stopWritingSession(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStopWritingSessionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#stopWritingSessionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  startFocusCycle(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStartFocusCycleCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#startFocusCycleSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  stopFocusCycle(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStopFocusCycleCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#stopFocusCycleSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listWorkActivity(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseListWorkActivityCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listWorkActivitySerially(command),
    );
  }

  listDocumentRevisions(
    value: unknown,
  ): Promise<DocumentRevisionListProjection> {
    this.#assertOpen();
    const command = parseListDocumentRevisionsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listDocumentRevisionsSerially(command),
    );
  }

  restoreDocumentRevision(
    value: unknown,
  ): Promise<RestoreDocumentRevisionResult> {
    this.#assertOpen();
    const command = parseRestoreDocumentRevisionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#restoreDocumentRevisionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createWorkSnapshot(value: unknown): Promise<WorkSnapshotProjection> {
    this.#assertOpen();
    const command = parseCreateWorkSnapshotCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createWorkSnapshotSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listWorkSnapshots(value: unknown): Promise<WorkSnapshotListProjection> {
    this.#assertOpen();
    const command = parseListWorkSnapshotsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listWorkSnapshotsSerially(command),
    );
  }

  getBackupStatus(): Promise<LocalWorkspaceBackupStatusProjection> {
    this.#assertOpen();
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#backupService.getStatus(),
    );
  }

  createBackupBundle(
    finalBundleRoot: string,
  ): Promise<LocalWorkspaceBackupSummary> {
    this.#assertOpen();
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#backupService.createBundle(finalBundleRoot);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  restoreBackupBundle(
    finalBundleRoot: string,
    targetFinalRoot: string,
  ): Promise<LocalWorkspaceBackupSummary> {
    this.#assertOpen();
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#backupService.restoreBundle(
        finalBundleRoot,
        targetFinalRoot,
      );
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  #listDocumentRevisionsSerially(
    command: ListDocumentRevisionsCommand,
  ): DocumentRevisionListProjection {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const revisions = this.#database
      .prepare(DOCUMENT_REVISION_ROWS_SQL)
      .all(command.workId, command.documentId)
      .map((row, index) => {
        const label = `Document revision rows[${index}]`;
        const isCurrent = readRequiredInteger(row, "isCurrent", label);
        if (isCurrent !== 0 && isCurrent !== 1) {
          throw new Error(`${label}.isCurrent must be zero or one`);
        }
        return {
          schemaVersion: 1,
          revisionId: readRequiredString(row, "revisionId", label),
          workId: readRequiredString(row, "workId", label),
          documentId: readRequiredString(row, "documentId", label),
          parentRevisionId: readNullableIdentity<"DocumentRevision">(
            row,
            "parentRevisionId",
            label,
          ),
          length: readRequiredInteger(row, "length", label),
          cause: readRequiredString(row, "cause", label),
          createdAt: readRequiredString(row, "createdAt", label),
          durableAt: readRequiredString(row, "durableAt", label),
          isCurrent: isCurrent === 1,
        };
      });
    return parseDocumentRevisionListProjection({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      revisions,
    });
  }

  async #restoreDocumentRevisionSerially(
    command: RestoreDocumentRevisionCommand,
  ): Promise<RestoreDocumentRevisionResult> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const revisions = this.#listDocumentRevisionsSerially(command);
    if (
      !revisions.revisions.some(
        (revision) => revision.revisionId === command.targetRevisionId,
      )
    ) {
      throw new Error(
        `DocumentRevision is outside its Document: ${command.targetRevisionId}`,
      );
    }
    const restoredText = await this.#revisionStore.materialize(
      command.targetRevisionId,
    );
    const restoredAt = new Date().toISOString();
    const restored = await this.#revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: command.workId,
      documentId: command.documentId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: restoredText,
      cause: JSON.stringify({
        kind: "restore-document-revision",
        targetRevisionId: command.targetRevisionId,
      }),
      createdAt: restoredAt,
      durableAt: restoredAt,
    });
    target.baseRevisionId = restored.id;
    target.currentRevisionId = restored.id;
    target.nextSequence = 0;
    target.text = restoredText;
    await this.#reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
    });
    return parseRestoreDocumentRevisionResult({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      targetRevisionId: command.targetRevisionId,
      restoredRevisionId: restored.id,
    });
  }

  async #createWorkSnapshotSerially(
    command: CreateWorkSnapshotCommand,
  ): Promise<WorkSnapshotProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const documentRevisions = [...this.#documentTargets.values()]
      .filter((target) => target.workId === command.workId)
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map((target) => ({
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
      }));
    const structureRevisionRefs = this.#database
      .prepare(WORK_STRUCTURE_REVISION_ROWS_SQL)
      .all(command.workId, command.workId, command.workId, command.workId)
      .map((row, index) => {
        const label = `Work structure revision rows[${index}]`;
        return {
          entityKind: readRequiredString(row, "entityKind", label),
          entityId: readRequiredString(row, "entityId", label),
          revision: readRequiredInteger(row, "revision", label),
        };
      });
    const structureRevisionRefsJson = JSON.stringify(structureRevisionRefs);
    const manifest = JSON.stringify({
      schemaVersion: 1,
      workId: command.workId,
      documentRevisions,
      structureRevisionRefs,
    });
    const manifestHash = createHash(
      LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    )
      .update(manifest, "utf8")
      .digest("hex");
    const createdAt = new Date().toISOString();
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "workSnapshot",
        id: workSnapshotId,
        workId: command.workId,
        documentRevisions,
        structureRevisionRefsJson,
        manifestHash,
        label: command.label,
        cause: "manual",
        createdAt,
      });
    });
    const snapshots = this.#listWorkSnapshotsSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = snapshots.snapshots.find(
      (snapshot) => snapshot.workSnapshotId === workSnapshotId,
    );
    if (created === undefined) {
      throw new Error(`Stored WorkSnapshot is missing: ${workSnapshotId}`);
    }
    return created;
  }

  #listWorkSnapshotsSerially(
    command: ListWorkSnapshotsCommand,
  ): WorkSnapshotListProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = this.#database
      .prepare(WORK_SNAPSHOT_ROWS_SQL)
      .all(command.workId);
    const snapshots = new Map<
      EntityId<"WorkSnapshot">,
      {
        readonly schemaVersion: 1;
        readonly workSnapshotId: EntityId<"WorkSnapshot">;
        readonly workId: EntityId<"Work">;
        readonly label: string;
        readonly cause: string;
        readonly manifestHash: string;
        readonly createdAt: string;
        readonly documentRevisions: Array<{
          readonly documentId: EntityId<"Document">;
          readonly documentRevisionId: EntityId<"DocumentRevision">;
        }>;
      }
    >();
    rows.forEach((row, index) => {
      const label = `Work snapshot rows[${index}]`;
      const workSnapshotId = entityId<"WorkSnapshot">(
        readRequiredString(row, "workSnapshotId", label),
      );
      let snapshot = snapshots.get(workSnapshotId);
      if (snapshot === undefined) {
        snapshot = {
          schemaVersion: 1,
          workSnapshotId,
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          label: readRequiredString(row, "label", label),
          cause: readRequiredString(row, "cause", label),
          manifestHash: readRequiredString(row, "manifestHash", label),
          createdAt: readRequiredString(row, "createdAt", label),
          documentRevisions: [],
        };
        snapshots.set(workSnapshotId, snapshot);
      }
      const documentId = row.documentId;
      const documentRevisionId = row.documentRevisionId;
      if (documentId === null && documentRevisionId === null) {
        return;
      }
      if (
        typeof documentId !== "string" ||
        documentId.length === 0 ||
        typeof documentRevisionId !== "string" ||
        documentRevisionId.length === 0
      ) {
        throw new Error(`${label} has an incomplete DocumentRevision entry`);
      }
      snapshot.documentRevisions.push({
        documentId: entityId<"Document">(documentId),
        documentRevisionId: entityId<"DocumentRevision">(
          documentRevisionId,
        ),
      });
    });
    return parseWorkSnapshotListProjection({
      schemaVersion: 1,
      workId: command.workId,
      snapshots: [...snapshots.values()],
    });
  }

  async #startWritingSessionSerially(
    command: StartWritingSessionCommand,
  ): Promise<WorkActivityProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const sessions = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    );
    if (sessions.some((session) => session.state === "active")) {
      throw new Error(`Work already has an active WritingSession: ${command.workId}`);
    }
    const policies = readWorkActivityPolicyIds(this.#database, command.workId);
    const now = new Date().toISOString();
    const sessionId = entityId<"WritingSession">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "writingSession",
        ...createRecordMeta(now),
        id: sessionId,
        workId: command.workId,
        documentId: command.documentId,
        policyId: policies.activityPolicyId,
        state: "active",
        startedAt: now,
        lastDurableHeartbeatAt: now,
        startRevisionId: target.currentRevisionId,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
    });
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #stopWritingSessionSerially(
    command: StopWritingSessionCommand,
  ): Promise<WorkActivityProjection> {
    const session = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    ).find((candidate) => candidate.sessionId === command.sessionId);
    if (session === undefined) {
      throw new Error(`Unknown WritingSession: ${command.sessionId}`);
    }
    if (session.state !== "active") {
      throw new Error(`WritingSession is not active: ${command.sessionId}`);
    }
    if (session.documentId === null) {
      throw new Error(`WritingSession has no Document: ${command.sessionId}`);
    }
    const target = this.#documentTargets.get(session.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${session.documentId}`,
      );
    }
    const endedAt = new Date().toISOString();
    const intervalId = entityId<"ActivityInterval">(randomUUID());
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE writing_sessions
        SET
          revision = revision + 1,
          updated_at = ?,
          state = 'completed',
          ended_at = ?,
          last_durable_heartbeat_at = ?,
          end_revision_id = ?
        WHERE id = ? AND work_id = ? AND state = 'active'
      `).run(
        endedAt,
        endedAt,
        endedAt,
        target.currentRevisionId,
        command.sessionId,
        command.workId,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`WritingSession changed before stop: ${command.sessionId}`);
      }
      this.#database.prepare(`
        INSERT INTO activity_intervals (
          id,
          work_id,
          session_id,
          activity_class,
          started_at,
          ended_at,
          document_id,
          evidence_count,
          source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        intervalId,
        command.workId,
        command.sessionId,
        "manuscript",
        session.startedAt,
        endedAt,
        session.documentId,
        0,
        "manual",
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #startFocusCycleSerially(
    command: StartFocusCycleCommand,
  ): Promise<WorkActivityProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const cycles = readStoredFocusCycleRows(this.#database, command.workId);
    if (cycles.some((cycle) => cycle.state === "running")) {
      throw new Error(`Work already has a running FocusCycle: ${command.workId}`);
    }
    const activeSession = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    ).find((session) => session.state === "active");
    const policies = readWorkActivityPolicyIds(this.#database, command.workId);
    const startedAt = new Date().toISOString();
    const deadlineAt = new Date(
      Date.parse(startedAt) + command.targetDurationMs,
    ).toISOString();
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "focusCycle",
        ...createRecordMeta(startedAt),
        id: focusCycleId,
        workId: command.workId,
        ...(activeSession === undefined
          ? {}
          : { sessionId: activeSession.sessionId }),
        policyId: policies.focusPolicyId,
        phaseRef: command.phaseRef,
        state: "running",
        targetDuration: command.targetDurationMs,
        startedAt,
        deadlineAt,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
    });
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #stopFocusCycleSerially(
    command: StopFocusCycleCommand,
  ): Promise<WorkActivityProjection> {
    const focusCycle = readStoredFocusCycleRows(
      this.#database,
      command.workId,
    ).find((candidate) => candidate.focusCycleId === command.focusCycleId);
    if (focusCycle === undefined) {
      throw new Error(`Unknown FocusCycle: ${command.focusCycleId}`);
    }
    if (focusCycle.state !== "running") {
      throw new Error(`FocusCycle is not running: ${command.focusCycleId}`);
    }
    const completedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE focus_cycles
        SET
          revision = revision + 1,
          updated_at = ?,
          state = 'stopped',
          completed_at = ?
        WHERE id = ? AND work_id = ? AND state = 'running'
      `).run(
        completedAt,
        completedAt,
        command.focusCycleId,
        command.workId,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`FocusCycle changed before stop: ${command.focusCycleId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #listWorkActivitySerially(
    command: ListWorkActivityCommand,
  ): Promise<WorkActivityProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const sessionRows = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    );
    const intervals = readStoredActivityIntervalRows(
      this.#database,
      command.workId,
    );
    const intervalDurationBySession = new Map<string, number>();
    for (const interval of intervals) {
      const durationMs = Math.max(
        0,
        readTimestamp(interval.endedAt, "ActivityInterval.endedAt") -
          readTimestamp(interval.startedAt, "ActivityInterval.startedAt"),
      );
      intervalDurationBySession.set(
        interval.sessionId,
        (intervalDurationBySession.get(interval.sessionId) ?? 0) + durationMs,
      );
    }
    const sessions: WritingSessionProjection[] = await Promise.all(
      sessionRows.map(async (session) => {
        let characterDelta: number | null = null;
        if (
          session.startRevisionId !== null &&
          session.endRevisionId !== null
        ) {
          const [startText, endText] = await Promise.all([
            this.#revisionStore.materialize(session.startRevisionId),
            this.#revisionStore.materialize(session.endRevisionId),
          ]);
          characterDelta = endText.length - startText.length;
        }
        const activeDurationMs =
          session.state === "active"
            ? Math.max(
                intervalDurationBySession.get(session.sessionId) ?? 0,
                Date.now() - readTimestamp(session.startedAt, "WritingSession.startedAt"),
              )
            : (intervalDurationBySession.get(session.sessionId) ?? 0);
        return {
          schemaVersion: 1,
          sessionId: session.sessionId,
          workId: session.workId,
          documentId: session.documentId,
          state: session.state,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          activeDurationMs,
          startRevisionId: session.startRevisionId,
          endRevisionId: session.endRevisionId,
          characterDelta,
          note: session.note,
        };
      }),
    );
    const focusCycles: FocusCycleProjection[] = readStoredFocusCycleRows(
      this.#database,
      command.workId,
    ).map((cycle) => ({
      schemaVersion: 1,
      focusCycleId: cycle.focusCycleId,
      workId: cycle.workId,
      sessionId: cycle.sessionId,
      state: cycle.state,
      phaseRef: cycle.phaseRef,
      targetDurationMs: cycle.targetDurationMs,
      startedAt: cycle.startedAt,
      deadlineAt: cycle.deadlineAt,
      completedAt: cycle.completedAt,
      note: cycle.note,
    }));
    return parseWorkActivityProjection({
      schemaVersion: 1,
      workId: command.workId,
      activeSessionId:
        sessions.find((session) => session.state === "active")?.sessionId ?? null,
      activeFocusCycleId:
        focusCycles.find((cycle) => cycle.state === "running")?.focusCycleId ?? null,
      sessions,
      focusCycles,
    });
  }

  async #createEventBlockSerially(
    command: CreateEventBlockCommand,
  ): Promise<EventBlockProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("EventBlock selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactQuote) {
      throw new Error(
        "EventBlock selected quote does not match the current durable revision",
      );
    }
    const storedRows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(storedRows);
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const rangeGroupId = entityId<"RangeGroup">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: eventBlockId,
      actorRef: work.studioId,
    });
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "rangeGroup",
        ...meta,
        id: rangeGroupId,
        workId: command.workId,
        orderedAnchorIds: [anchorId],
      });
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        rangeGroupId,
        title: command.title,
        ...(command.note.length === 0 ? {} : { note: command.note }),
        orderKey: JSON.stringify([createdAt, eventBlockId]),
        collapsed: false,
      });
    });
    const projection = await this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventBlocks.find(
      (eventBlock) => eventBlock.eventBlockId === eventBlockId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventBlock is missing: ${eventBlockId}`);
    }
    return created;
  }

  async #listEventBlocksSerially(
    command: ListEventBlocksCommand,
  ): Promise<EventBlockListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = readStoredEventBlockRows(this.#database, command.workId);
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const eventBlocks = await Promise.all(
      rows.map(async (row) => {
        const target = this.#documentTargets.get(row.documentId);
        if (target === undefined || target.workId !== row.workId) {
          throw new Error(
            `EventBlock document is outside its Work: ${row.eventBlockId}`,
          );
        }
        const resolution = await resolver.execute({
          workId: row.workId,
          anchorId: row.anchorId,
          targetRevisionId: target.currentRevisionId,
        });
        const integrity =
          resolution.status === "resolved"
            ? "resolved"
            : resolution.status === "needsReview"
              ? "needsReview"
              : "broken";
        return parseEventBlockProjection({
          schemaVersion: 1,
          eventBlockId: row.eventBlockId,
          anchorId: row.anchorId,
          workId: row.workId,
          documentId: row.documentId,
          documentRevisionId: target.currentRevisionId,
          title: row.title,
          note: row.note,
          exactQuote: row.exactQuote,
          integrity,
          range:
            resolution.status === "resolved"
              ? {
                  from: resolution.range.startOffset,
                  to: resolution.range.endOffset,
                }
              : null,
          createdAt: row.createdAt,
        });
      }),
    );
    return parseEventBlockListProjection({
      schemaVersion: 1,
      workId: command.workId,
      eventBlocks,
    });
  }

  async #createSceneOverrideSerially(
    command: CreateSceneOverrideCommand,
  ): Promise<SceneOverrideProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("SceneOverride boundary is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactQuote) {
      throw new Error(
        "SceneOverride boundary quote does not match the current durable revision",
      );
    }
    const storedRows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(storedRows);
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const settingsRows = this.#database
      .prepare(WORK_SCENE_RULE_REVISION_SQL)
      .all(command.workId);
    const settingsRow = settingsRows[0];
    if (settingsRows.length !== 1 || settingsRow === undefined) {
      throw new Error(`Work scene settings are missing: ${command.workId}`);
    }
    const baseRuleSetRevision = readRequiredInteger(
      settingsRow,
      "baseRuleSetRevision",
      "Work scene settings",
    );
    const createdAt = new Date().toISOString();
    const sceneOverrideId = entityId<"SceneOverride">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: sceneOverrideId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "sceneOverride",
        ...createRecordMeta(createdAt),
        id: sceneOverrideId,
        workId: command.workId,
        documentId: command.documentId,
        operation: command.operation,
        anchorIds: [anchorId],
        baseRuleSetRevision,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
    });
    const projection = await this.#listSceneOverridesSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.sceneOverrides.find(
      (sceneOverride) => sceneOverride.sceneOverrideId === sceneOverrideId,
    );
    if (created === undefined) {
      throw new Error(`Stored SceneOverride is missing: ${sceneOverrideId}`);
    }
    return created;
  }

  async #listSceneOverridesSerially(
    command: ListSceneOverridesCommand,
  ): Promise<SceneOverrideListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = readStoredSceneOverrideRows(this.#database, command.workId);
    const grouped = new Map<
      EntityId<"SceneOverride">,
      StoredSceneOverrideRow[]
    >();
    for (const row of rows) {
      const existing = grouped.get(row.sceneOverrideId);
      if (existing === undefined) {
        grouped.set(row.sceneOverrideId, [row]);
      } else {
        existing.push(row);
      }
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const sceneOverrides = await Promise.all(
      [...grouped.values()].map(async (groupRows) => {
        const first = groupRows[0];
        if (first === undefined) {
          throw new Error("SceneOverride must contain at least one Anchor");
        }
        const target = this.#documentTargets.get(first.documentId);
        if (target === undefined || target.workId !== first.workId) {
          throw new Error(
            `SceneOverride document is outside its Work: ${first.sceneOverrideId}`,
          );
        }
        const boundaries = await Promise.all(
          groupRows.map(async (row) => {
            const resolution = await resolver.execute({
              workId: row.workId,
              anchorId: row.anchorId,
              targetRevisionId: target.currentRevisionId,
            });
            const integrity =
              resolution.status === "resolved"
                ? "resolved"
                : resolution.status === "needsReview"
                  ? "needsReview"
                  : "broken";
            return {
              anchorId: row.anchorId,
              documentRevisionId: target.currentRevisionId,
              exactQuote: row.exactQuote,
              integrity,
              range:
                resolution.status === "resolved"
                  ? {
                      from: resolution.range.startOffset,
                      to: resolution.range.endOffset,
                    }
                  : null,
            } as const;
          }),
        );
        return parseSceneOverrideProjection({
          schemaVersion: 1,
          sceneOverrideId: first.sceneOverrideId,
          workId: first.workId,
          documentId: first.documentId,
          operation: first.operation,
          baseRuleSetRevision: first.baseRuleSetRevision,
          note: first.note,
          boundaries,
          createdAt: first.createdAt,
        });
      }),
    );
    return parseSceneOverrideListProjection({
      schemaVersion: 1,
      workId: command.workId,
      sceneOverrides,
    });
  }

  async #captureWorkspaceResumeSerially(
    command: CaptureWorkspaceResumeCommand,
  ): Promise<ManuscriptResumeCheckpointProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (
      command.selection.anchor > target.text.length ||
      command.selection.head > target.text.length
    ) {
      throw new Error("Resume selection is outside the current manuscript");
    }
    const rows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(rows);
    const transaction =
      this.#ledger.createResumeCheckpointCaptureTransaction({});
    const work = await transaction.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const capturedAt = new Date().toISOString();
    const commandRef = randomUUID();
    const checkpointId = entityId<"ResumeCheckpoint">(randomUUID());
    const cursorAnchorId = entityId<"Anchor">(randomUUID());
    const selectionAnchorId =
      command.selection.anchor === command.selection.head
        ? null
        : entityId<"Anchor">(randomUUID());
    const createAnchor = new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const recordMeta = (id: EntityId<"Anchor">) => ({
      id,
      schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
      revision: 1,
      createdAt: capturedAt,
      updatedAt: capturedAt,
    });
    const cursorAnchor = await createAnchor.execute({
      meta: recordMeta(cursorAnchorId),
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: command.selection.head,
      endOffset: command.selection.head,
      policy: this.#options.defaults.anchorPolicy,
      commandRef,
      actorRef: work.studioId,
    });
    const selectionAnchor =
      selectionAnchorId === null
        ? undefined
        : await createAnchor.execute({
            meta: recordMeta(selectionAnchorId),
            workId: command.workId,
            documentId: command.documentId,
            documentRevisionId: target.currentRevisionId,
            startOffset: Math.min(
              command.selection.anchor,
              command.selection.head,
            ),
            endOffset: Math.max(
              command.selection.anchor,
              command.selection.head,
            ),
            policy: this.#options.defaults.anchorPolicy,
            commandRef,
            actorRef: work.studioId,
          });
    await new CaptureResumeCheckpointWithAnchors({
      catalog,
      revisionStore: this.#revisionStore,
      transaction,
    }).execute({
      checkpoint: {
        meta: {
          id: checkpointId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: capturedAt,
          updatedAt: capturedAt,
        },
        workId: command.workId,
        documentId: command.documentId,
        documentRevisionId: target.currentRevisionId,
        cursorAnchorId,
        ...(selectionAnchorId === null
          ? {}
          : { selectionAnchorId }),
        workspaceMode: command.workspaceMode,
        capturedAt,
      },
      cursorAnchor,
      ...(selectionAnchor === undefined ? {} : { selectionAnchor }),
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: work.resumeCheckpointId ?? null,
      expectedDocumentRevisionId: target.currentRevisionId,
    });
    this.#resumeProjection = Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: command.workId,
      documentId: command.documentId,
      targetRevisionId: target.currentRevisionId,
      selection: Object.freeze({ ...command.selection }),
    });
    this.#catalog = parseWorkspaceCatalogProjection({
      ...this.#catalog,
      works: this.#catalog.works.map((candidate) =>
        candidate.workId === command.workId
          ? { ...candidate, updatedAt: capturedAt }
          : candidate,
      ),
      activeWorkId: command.workId,
      activeDocumentId: command.documentId,
    });
    return this.#resumeProjection;
  }

  saveChangeBatch(value: unknown): Promise<SaveReceipt> {
    this.#assertOpen();
    const execution = this.#savePending.then(() =>
      this.#saveChangeBatchSerially(value),
    );
    this.#savePending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #saveChangeBatchSerially(value: unknown): Promise<SaveReceipt> {
    const batch = parseChangeBatch(value);
    const accepted = this.#acceptedByBatchId.get(batch.batchId);
    if (accepted !== undefined) {
      if (
        classifyChangeBatchIdentity(accepted.batch, batch) ===
        "duplicate"
      ) {
        return accepted.receipt;
      }
      throw new DurableChangeBatchSaveConflictError(
        `Batch identity conflict: ${batch.batchId}`,
      );
    }
    const target = this.#documentTargets.get(batch.documentId);
    if (target === undefined) {
      throw new DurableChangeBatchSaveConflictError(
        `Unknown local workspace document: ${batch.documentId}`,
      );
    }
    if (target.workId !== batch.workId) {
      throw new DurableChangeBatchSaveConflictError(
        `Work/document boundary violation: ${batch.workId}/${batch.documentId}`,
      );
    }
    if (target.baseRevisionId !== batch.baseRevisionId) {
      throw new DurableChangeBatchSaveConflictError(
        `Base revision conflict for document ${batch.documentId}`,
      );
    }
    if (target.nextSequence !== batch.sequence) {
      throw new DurableChangeBatchSaveConflictError(
        `Sequence conflict for document ${batch.documentId}: expected ${target.nextSequence}, received ${batch.sequence}`,
      );
    }
    const nextText = applyChangeBatch(target.text, batch);
    const now = new Date().toISOString();
    const revision = await this.#revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: target.workId,
      documentId: target.documentId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: nextText,
      cause: JSON.stringify({
        kind: "manuscript-edit",
        batchId: batch.batchId,
      }),
      createdAt: now,
      durableAt: now,
    });
    const receipt = Object.freeze({
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      revisionId: revision.id,
    });
    target.currentRevisionId = revision.id;
    target.nextSequence += 1;
    target.text = nextText;
    this.#acceptedByBatchId.set(batch.batchId, {
      batch,
      receipt,
    });
    return receipt;
  }

  async applyManuscriptStartupRecovery(): Promise<ApplyStartupRecoveryAcknowledgement> {
    this.#assertOpen();
    throw new Error("Local workspace startup recovery is not pending");
  }

  createDocument(value: unknown): Promise<CreateDocumentResult> {
    this.#assertOpen();
    const execution = this.#createPending.then(() =>
      this.#createDocumentSerially(value),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #createDocumentSerially(value: unknown): Promise<CreateDocumentResult> {
    const command = parseCreateDocumentCommand(value);
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const now = new Date().toISOString();
    const documentId = randomUUID();
    const manuscriptId = randomUUID();
    const revisionId = randomUUID();
    const revisionInput = Object.freeze({
      revisionId: entityId<"DocumentRevision">(revisionId),
      workId: command.workId,
      documentId: entityId<"Document">(documentId),
      expectedCurrentRevisionId: null,
      content: "",
      cause: "create-document",
      createdAt: now,
      durableAt: now,
    });
    const published = await this.#blobStore.append({
      bytes: this.#blobProfile.codec.encode(revisionInput.content),
      metadata: this.#blobProfile.metadataForAppend(revisionInput),
      temporaryEntryIdentity:
        this.#blobProfile.temporaryEntryIdentityForAppend(revisionInput),
    });
    const blobRef = this.#blobProfile.blobRefForAddress(published.address);
    const descriptor = this.#blobProfile.codec.describe("");
    const records = createDocumentRecords({
      now,
      workId: command.workId,
      title: command.title,
      documentId,
      manuscriptId,
      revisionId,
      blobRef,
      checksumIdentity: published.address.checksumIdentity,
      checksumValue: published.address.checksumValue,
      byteLength: published.byteLength,
      contentHash: descriptor.contentHash,
      includeBlobManifest: shouldInsertBlobManifest(this.#database, {
        blobRef,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
      }),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });
    const location = parseActivateWorkspaceLocationCommand({
      schemaVersion: 1,
      workId: command.workId,
      documentId,
    });
    await this.#reload(location);
    return parseCreateDocumentResult({
      schemaVersion: 1,
      workId: command.workId,
      documentId,
      revisionId,
    });
  }

  createFirstWork(value: unknown): Promise<CreateFirstWorkResult> {
    this.#assertOpen();
    const execution = this.#createPending.then(() =>
      this.#createWorkSerially(
        parseCreateFirstWorkCommand(value),
        true,
      ),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createWork(value: unknown): Promise<CreateWorkResult> {
    this.#assertOpen();
    const execution = this.#createPending.then(() =>
      this.#createWorkSerially(
        parseCreateWorkCommand(value),
        false,
      ),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #createWorkSerially(
    command: CreateFirstWorkCommand,
    requireEmptyCatalog: boolean,
  ): Promise<CreateWorkResult> {
    if (requireEmptyCatalog && !this.#catalog.canCreateFirstWork) {
      throw new Error("The local workspace already contains a Work");
    }
    const studioRows = this.#database
      .prepare(STUDIO_ROWS_SQL)
      .all();
    if (studioRows.length > 1) {
      throw new Error("Local workspace has more than one Studio owner");
    }
    const includeStudio = studioRows.length === 0;
    const studioId = includeStudio
      ? randomUUID()
      : readRequiredString(
          studioRows[0] ?? {},
          "id",
          "Studio lookup",
        );
    const now = new Date().toISOString();
    const workId = randomUUID();
    const settingsId = randomUUID();
    const activityPolicyId = randomUUID();
    const focusPolicyId = randomUUID();
    const sceneRuleSetId = randomUUID();
    const documentId = randomUUID();
    const manuscriptId = randomUUID();
    const revisionId = randomUUID();
    const revisionInput = Object.freeze({
      revisionId: entityId<"DocumentRevision">(revisionId),
      workId: entityId<"Work">(workId),
      documentId: entityId<"Document">(documentId),
      expectedCurrentRevisionId: null,
      content: "",
      cause: "create-first-document",
      createdAt: now,
      durableAt: now,
    });
    const published = await this.#blobStore.append({
      bytes: this.#blobProfile.codec.encode(revisionInput.content),
      metadata: this.#blobProfile.metadataForAppend(revisionInput),
      temporaryEntryIdentity:
        this.#blobProfile.temporaryEntryIdentityForAppend(revisionInput),
    });
    const blobRef = this.#blobProfile.blobRefForAddress(
      published.address,
    );
    const descriptor = this.#blobProfile.codec.describe("");
    const records = createInitialRecords({
      includeStudio,
      studioId,
      studioDisplayName: this.#options.studioDisplayName,
      locale: this.#options.locale,
      timezone: this.#options.timezone,
      command,
      now,
      workId,
      settingsId,
      activityPolicyId,
      focusPolicyId,
      sceneRuleSetId,
      documentId,
      manuscriptId,
      revisionId,
      blobRef,
      checksumIdentity: published.address.checksumIdentity,
      checksumValue: published.address.checksumValue,
      byteLength: published.byteLength,
      contentHash: descriptor.contentHash,
      defaults: this.#options.defaults,
      includeBlobManifest: shouldInsertBlobManifest(this.#database, {
        blobRef,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
      }),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });
    await this.#reload({
      schemaVersion: 1,
      workId: entityId<"Work">(workId),
      documentId: entityId<"Document">(documentId),
    });
    return parseCreateWorkResult({
      schemaVersion: 1,
      workId,
      documentId,
      revisionId,
    });
  }

  async #reload(
    preferredLocation?: ActivateWorkspaceLocationCommand,
  ): Promise<void> {
    const existingTargets = new Map(this.#documentTargets);
    const loaded = await loadWorkspaceState(
      this.#database,
      this.#revisionStore,
      this.#options.emptyDocumentProfile,
      this.#ledger.createResumeCheckpointCaptureTransaction({}),
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      preferredLocation,
    );
    this.#catalog = loaded.catalog;
    this.#documentProfile = loaded.documentProfile;
    this.#resumeProjection = loaded.resumeProjection;
    this.#documentTargets.clear();
    for (const loadedTarget of loaded.documentTargets) {
      const existingTarget = existingTargets.get(
        loadedTarget.documentId,
      );
      if (existingTarget === undefined) {
        this.#documentTargets.set(
          loadedTarget.documentId,
          loadedTarget,
        );
        continue;
      }
      if (
        existingTarget.currentRevisionId !==
          loadedTarget.currentRevisionId ||
        existingTarget.text !== loadedTarget.text ||
        existingTarget.workId !== loadedTarget.workId
      ) {
        throw new Error(
          `Workspace reload diverged from the active durable target: ${loadedTarget.documentId}`,
        );
      }
      this.#documentTargets.set(
        existingTarget.documentId,
        existingTarget,
      );
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#database.close();
    this.#ledger.close();
  }
}

function readStoredDocumentRows(
  database: NodeSqliteDatabase,
): readonly StoredDocumentRow[] {
  return Object.freeze(
    database
      .prepare(DOCUMENT_ROWS_SQL)
      .all()
      .map((row, index) => {
        const label = `Document rows[${index}]`;
        return {
        workId: entityId<"Work">(
          readRequiredString(row, "workId", label),
        ),
        workSchemaVersion: readRequiredInteger(
          row,
          "workSchemaVersion",
          label,
        ),
        workRevision: readRequiredInteger(row, "workRevision", label),
        workCreatedAt: readRequiredString(row, "workCreatedAt", label),
        workTitle: readRequiredString(
          row,
          "workTitle",
          label,
        ),
        workUpdatedAt: readRequiredString(
          row,
          "workUpdatedAt",
          label,
        ),
        workStudioId: entityId<"Studio">(
          readRequiredString(row, "workStudioId", label),
        ),
        workOrderKey: readRequiredString(row, "workOrderKey", label),
        workResumeCheckpointId: readNullableIdentity<"ResumeCheckpoint">(
          row,
          "workResumeCheckpointId",
          label,
        ),
        workSettingsId: entityId<"WorkSettings">(
          readRequiredString(row, "workSettingsId", label),
        ),
        documentId: entityId<"Document">(
          readRequiredString(row, "documentId", label),
        ),
        documentSchemaVersion: readRequiredInteger(
          row,
          "documentSchemaVersion",
          label,
        ),
        documentRevision: readRequiredInteger(
          row,
          "documentRevision",
          label,
        ),
        documentCreatedAt: readRequiredString(
          row,
          "documentCreatedAt",
          label,
        ),
        documentUpdatedAt: readRequiredString(
          row,
          "documentUpdatedAt",
          label,
        ),
        documentTitle: readRequiredString(
          row,
          "documentTitle",
          label,
        ),
        documentOrderKey: readRequiredString(
          row,
          "documentOrderKey",
          label,
        ),
        manuscriptId: entityId<"Manuscript">(
          readRequiredString(row, "manuscriptId", label),
        ),
        currentRevisionId: entityId<"DocumentRevision">(
          readRequiredString(
            row,
            "currentRevisionId",
            label,
          ),
        ),
      };
      }),
  );
}

function readStoredEventBlockRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredEventBlockRow[] {
  return Object.freeze(
    database
      .prepare(EVENT_BLOCK_ROWS_SQL)
      .all(workId)
      .map((row, index) => {
        const label = `EventBlock rows[${index}]`;
        const note = row.note;
        if (typeof note !== "string") {
          throw new Error(`${label}.note must be a string`);
        }
        return Object.freeze({
          eventBlockId: entityId<"EventBlock">(
            readRequiredString(row, "eventBlockId", label),
          ),
          anchorId: entityId<"Anchor">(
            readRequiredString(row, "anchorId", label),
          ),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          documentId: entityId<"Document">(
            readRequiredString(row, "documentId", label),
          ),
          title: readRequiredString(row, "title", label),
          note,
          exactQuote: readRequiredString(row, "exactQuote", label),
          createdAt: readRequiredString(row, "createdAt", label),
        });
      }),
  );
}

function readStoredSceneOverrideRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneOverrideRow[] {
  return Object.freeze(
    database
      .prepare(SCENE_OVERRIDE_ROWS_SQL)
      .all(workId)
      .map((row, index) => {
        const label = `SceneOverride rows[${index}]`;
        const operation = readRequiredString(row, "operation", label);
        if (
          operation !== "add" &&
          operation !== "ignore" &&
          operation !== "merge" &&
          operation !== "split"
        ) {
          throw new Error(`${label}.operation is invalid`);
        }
        const note = row.note;
        const exactQuote = row.exactQuote;
        if (typeof note !== "string") {
          throw new Error(`${label}.note must be a string`);
        }
        if (typeof exactQuote !== "string") {
          throw new Error(`${label}.exactQuote must be a string`);
        }
        const baseRuleSetRevision = readRequiredInteger(
          row,
          "baseRuleSetRevision",
          label,
        );
        const orderIndex = readRequiredInteger(row, "orderIndex", label);
        if (baseRuleSetRevision < 0 || orderIndex < 0) {
          throw new Error(`${label} contains a negative revision or order`);
        }
        return Object.freeze({
          sceneOverrideId: entityId<"SceneOverride">(
            readRequiredString(row, "sceneOverrideId", label),
          ),
          anchorId: entityId<"Anchor">(
            readRequiredString(row, "anchorId", label),
          ),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          documentId: entityId<"Document">(
            readRequiredString(row, "documentId", label),
          ),
          operation,
          baseRuleSetRevision,
          note,
          exactQuote,
          orderIndex,
          createdAt: readRequiredString(row, "createdAt", label),
        });
      }),
  );
}

function readString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function readNullableString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return value;
}

function readTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return timestamp;
}

function readWorkActivityPolicyIds(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): {
  readonly activityPolicyId: string;
  readonly focusPolicyId: string;
} {
  const rows = database.prepare(WORK_ACTIVITY_POLICY_ROWS_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Work activity settings are missing: ${workId}`);
  }
  const row = rows[0] ?? {};
  return Object.freeze({
    activityPolicyId: readRequiredString(
      row,
      "activityPolicyId",
      "Work activity settings",
    ),
    focusPolicyId: readRequiredString(
      row,
      "focusPolicyId",
      "Work activity settings",
    ),
  });
}

function readStoredWritingSessionRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredWritingSessionRow[] {
  return Object.freeze(
    database.prepare(WRITING_SESSION_ROWS_SQL).all(workId).map((row, index) => {
      const label = `WritingSession rows[${index}]`;
      const state = readRequiredString(row, "state", label);
      if (state !== "active" && state !== "completed") {
        throw new Error(`${label}.state is unsupported`);
      }
      const endedAt = readNullableString(row, "endedAt", label);
      const startRevisionId = readNullableIdentity<"DocumentRevision">(
        row,
        "startRevisionId",
        label,
      );
      const endRevisionId = readNullableIdentity<"DocumentRevision">(
        row,
        "endRevisionId",
        label,
      );
      return Object.freeze({
        sessionId: entityId<"WritingSession">(
          readRequiredString(row, "sessionId", label),
        ),
        workId: entityId<"Work">(readRequiredString(row, "workId", label)),
        documentId: readNullableIdentity<"Document">(
          row,
          "documentId",
          label,
        ),
        state,
        startedAt: readRequiredString(row, "startedAt", label),
        endedAt,
        startRevisionId,
        endRevisionId,
        note: readString(row, "note", label),
      });
    }),
  );
}

function readStoredActivityIntervalRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredActivityIntervalRow[] {
  return Object.freeze(
    database.prepare(ACTIVITY_INTERVAL_ROWS_SQL).all(workId).map((row, index) => {
      const label = `ActivityInterval rows[${index}]`;
      return Object.freeze({
        sessionId: entityId<"WritingSession">(
          readRequiredString(row, "sessionId", label),
        ),
        startedAt: readRequiredString(row, "startedAt", label),
        endedAt: readRequiredString(row, "endedAt", label),
      });
    }),
  );
}

function readStoredFocusCycleRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredFocusCycleRow[] {
  return Object.freeze(
    database.prepare(FOCUS_CYCLE_ROWS_SQL).all(workId).map((row, index) => {
      const label = `FocusCycle rows[${index}]`;
      const state = readRequiredString(row, "state", label);
      if (state !== "running" && state !== "stopped") {
        throw new Error(`${label}.state is unsupported`);
      }
      return Object.freeze({
        focusCycleId: entityId<"FocusCycle">(
          readRequiredString(row, "focusCycleId", label),
        ),
        workId: entityId<"Work">(readRequiredString(row, "workId", label)),
        sessionId: readNullableIdentity<"WritingSession">(
          row,
          "sessionId",
          label,
        ),
        state,
        phaseRef: readRequiredString(row, "phaseRef", label),
        targetDurationMs: readRequiredInteger(
          row,
          "targetDurationMs",
          label,
        ),
        startedAt: readRequiredString(row, "startedAt", label),
        deadlineAt: readRequiredString(row, "deadlineAt", label),
        completedAt: readNullableString(row, "completedAt", label),
        note: readString(row, "note", label),
      });
    }),
  );
}

function createCatalogFromStoredRows(
  rows: readonly StoredDocumentRow[],
) {
  const works = new Map<EntityId<"Work">, Work>();
  const documents: Document[] = [];
  for (const row of rows) {
    if (!works.has(row.workId)) {
      works.set(row.workId, {
        meta: {
          id: row.workId,
          schemaVersion: row.workSchemaVersion,
          revision: row.workRevision,
          createdAt: row.workCreatedAt,
          updatedAt: row.workUpdatedAt,
        },
        studioId: row.workStudioId,
        title: row.workTitle,
        orderKey: row.workOrderKey,
        ...(row.workResumeCheckpointId === null
          ? {}
          : { resumeCheckpointId: row.workResumeCheckpointId }),
        settingsId: row.workSettingsId,
      });
    }
    documents.push({
      meta: {
        id: row.documentId,
        schemaVersion: row.documentSchemaVersion,
        revision: row.documentRevision,
        createdAt: row.documentCreatedAt,
        updatedAt: row.documentUpdatedAt,
      },
      workId: row.workId,
      title: row.documentTitle,
      orderKey: row.documentOrderKey,
      manuscriptId: row.manuscriptId,
    });
  }
  return createWritingCatalog({
    works: [...works.values()],
    documents,
  });
}

function projectResumeResolution(
  resolution: ResumeCheckpointResolution,
): ManuscriptResumeCheckpointProjection {
  if (resolution.status === "missing") {
    return Object.freeze({
      schemaVersion: 1,
      status: "missing",
      workId: resolution.workId,
    });
  }
  if (
    resolution.status === "needsReview" ||
    resolution.status === "broken"
  ) {
    return Object.freeze({
      schemaVersion: 1,
      status: resolution.status,
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      move: null,
    });
  }
  const selection = resolution.selection;
  if (selection === undefined) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: resolution.cursorOffset,
        head: resolution.cursorOffset,
      }),
    });
  }
  if (resolution.cursorOffset === selection.startOffset) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.endOffset,
        head: selection.startOffset,
      }),
    });
  }
  if (resolution.cursorOffset === selection.endOffset) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.startOffset,
        head: selection.endOffset,
      }),
    });
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "invalid",
    workId: resolution.workId,
    reason: "selection-shape-conflict",
    move: null,
  });
}

async function loadWorkspaceState(
  database: NodeSqliteDatabase,
  revisionStore: RevisionStore,
  emptyDocumentProfile: ManuscriptDocumentProfile,
  resumeReader: ResumeCheckpointWithAnchorsCaptureTransaction,
  anchorEvidenceChecksumAlgorithm: string,
  preferredLocation?: ActivateWorkspaceLocationCommand,
): Promise<{
  readonly catalog: WorkspaceCatalogProjection;
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly resumeProjection: ManuscriptResumeCheckpointProjection;
  readonly documentTargets:
    readonly MutableDocumentSaveTarget[];
}> {
  const rows = readStoredDocumentRows(database);
  if (rows.length === 0) {
    return Object.freeze({
      catalog: parseWorkspaceCatalogProjection({
        schemaVersion: 1,
        works: [],
        activeWorkId: null,
        activeDocumentId: null,
        canCreateFirstWork: true,
      }),
      documentProfile: emptyDocumentProfile,
      resumeProjection: Object.freeze({
        schemaVersion: 1,
        status: "unavailable",
      }),
      documentTargets: Object.freeze([]),
    });
  }
  const materialized = await Promise.all(
    rows.map(async (row) => ({
      row,
      text: await revisionStore.materialize(row.currentRevisionId),
    })),
  );
  const worksById = new Map<
    EntityId<"Work">,
    {
      readonly workId: EntityId<"Work">;
      readonly title: string;
      readonly updatedAt: string;
      readonly documents: Array<{
        readonly documentId: EntityId<"Document">;
        readonly title: string;
        readonly currentRevisionId:
          EntityId<"DocumentRevision">;
      }>;
    }
  >();
  for (const { row } of materialized) {
    let work = worksById.get(row.workId);
    if (work === undefined) {
      work = {
        workId: row.workId,
        title: row.workTitle,
        updatedAt: row.workUpdatedAt,
        documents: [],
      };
      worksById.set(row.workId, work);
    }
    work.documents.push({
      documentId: row.documentId,
      title: row.documentTitle,
      currentRevisionId: row.currentRevisionId,
    });
  }
  const works = [...worksById.values()];
  const activeWork =
    preferredLocation === undefined
      ? works[0]
      : works.find((work) => work.workId === preferredLocation.workId);
  if (preferredLocation !== undefined && activeWork === undefined) {
    throw new Error(`Unknown workspace Work: ${preferredLocation.workId}`);
  }
  const writingCatalog = createCatalogFromStoredRows(rows);
  let resumeProjection: ManuscriptResumeCheckpointProjection;
  if (activeWork === undefined) {
    resumeProjection = Object.freeze({
      schemaVersion: 1,
      status: "unavailable",
    });
  } else {
    try {
      resumeProjection = projectResumeResolution(
        await new ResolveResumeCheckpointForWork({
          catalog: writingCatalog,
          revisionStore,
          reader: resumeReader,
          describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
            anchorEvidenceChecksumAlgorithm,
          ),
        }).execute(activeWork.workId),
      );
    } catch (error) {
      if (!(error instanceof ResumeAnchorIntegrityError)) {
        throw error;
      }
      resumeProjection = Object.freeze({
        schemaVersion: 1,
        status: "invalid",
        workId: activeWork.workId,
        reason: "anchor-integrity-conflict",
        move: null,
      });
    }
  }
  const explicitDocument =
    preferredLocation?.documentId === null ||
    preferredLocation?.documentId === undefined
      ? undefined
      : activeWork?.documents.find(
          (document) =>
            document.documentId === preferredLocation.documentId,
        );
  if (
    preferredLocation?.documentId !== null &&
    preferredLocation?.documentId !== undefined &&
    explicitDocument === undefined
  ) {
    throw new Error(
      `Work/document boundary violation: ${preferredLocation.workId}/${preferredLocation.documentId}`,
    );
  }
  const resumeDocument =
    resumeProjection.status === "resolved" ||
    resumeProjection.status === "needsReview" ||
    resumeProjection.status === "broken"
      ? activeWork?.documents.find(
          (document) =>
            document.documentId === resumeProjection.documentId,
        )
      : undefined;
  const activeDocument =
    explicitDocument ??
    resumeDocument ??
    activeWork?.documents[0];
  if (activeWork === undefined || activeDocument === undefined) {
    throw new Error("Stored workspace has no active manuscript document");
  }
  const catalog = parseWorkspaceCatalogProjection({
    schemaVersion: 1,
    works,
    activeWorkId: activeWork.workId,
    activeDocumentId: activeDocument.documentId,
    canCreateFirstWork: false,
  });
  const documentProfile = parseManuscriptDocumentProfile({
    schemaVersion: 1,
    initialDocumentId: activeDocument.documentId,
    documents: materialized.map(({ row, text }) => ({
      workId: row.workId,
      documentId: row.documentId,
      documentRevisionId: row.currentRevisionId,
      label: row.documentTitle,
      initialText: text,
    })),
  });
  return Object.freeze({
    catalog,
    documentProfile,
    resumeProjection,
    documentTargets: Object.freeze(
      materialized.map(({ row, text }) => ({
        workId: row.workId,
        documentId: row.documentId,
        baseRevisionId: row.currentRevisionId,
        currentRevisionId: row.currentRevisionId,
        nextSequence: 0,
        text,
      })),
    ),
  });
}

export async function openLocalWorkspaceRuntime(
  options: LocalWorkspaceRuntimeOptions,
): Promise<LocalWorkspaceRuntime> {
  if (!path.isAbsolute(options.rootDirectoryPath)) {
    throw new Error("Local workspace root path must be absolute");
  }
  await mkdir(options.rootDirectoryPath, { recursive: true });
  const profiles = createLocalWorkspaceStorageProfiles(
    options.rootDirectoryPath,
  );
  const ledger = await openNodeSqliteLedger(profiles.ledgerProfile);
  const blobStore = await createNodeImmutableBlobStore(
    profiles.blobStoreProfile,
  );
  const { DatabaseSync } = loadNodeSqlite();
  const database = new DatabaseSync(profiles.databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const blobProfile = createLocalWorkspaceRevisionBlobProfile((blobRef) => {
      const rows = database
        .prepare(`
          SELECT created_at AS "createdAt"
          FROM blob_manifests
          WHERE blob_ref = ?
        `)
        .all(blobRef);
      if (rows.length === 0) {
        return null;
      }
      if (rows.length !== 1) {
        throw new Error(`Blob manifest identity is ambiguous: ${blobRef}`);
      }
      return readRequiredString(
        rows[0] ?? {},
        "createdAt",
        "Blob manifest lookup",
      );
    });
    const revisionStore = ledger.createRevisionStore({
      blobStore,
      blobProfile,
    });
    const backupService = createLocalWorkspaceBackupService({
      rootDirectoryPath: options.rootDirectoryPath,
      sourceBlobStore: blobStore,
      profile: options.backupProfile,
    });
    const loaded = await loadWorkspaceState(
      database,
      revisionStore,
      options.emptyDocumentProfile,
      ledger.createResumeCheckpointCaptureTransaction({}),
      options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    return new DefaultLocalWorkspaceRuntime({
      database,
      ledger,
      revisionStore,
      blobStore,
      blobProfile,
      backupService,
      options,
      ...loaded,
    });
  } catch (error) {
    database.close();
    ledger.close();
    throw error;
  }
}
