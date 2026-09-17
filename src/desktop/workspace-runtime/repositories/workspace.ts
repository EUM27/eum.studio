import type { LocalWorkspaceDefaults } from "../../../application/workspace/local-workspace-defaults";
import type { CreateFirstWorkCommand } from "../../../application/workspace/workspace-contract";
import type { Poc3LedgerRecord } from "../../../domain/poc-3-storage-ledger";
import type { Document,EntityId,Work } from "../../../domain/writing";
import { createWritingCatalog,entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { createRecordMeta } from "./record-builders";
import { readNullableIdentity,readNullableInteger,readNullableString,readRequiredInteger,readRequiredString } from "./scalars";

export type StoredDocumentRow = {
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
  readonly folderId: EntityId<"DocumentFolder"> | null;
  readonly manuscriptId: EntityId<"Manuscript">;
  readonly currentRevisionId:
    EntityId<"DocumentRevision">;
  readonly completionRevision: number | null;
  readonly completionCompletedAt: string | null;
  readonly completionCompletedDate: string | null;
  readonly completionCompletedTimeZone: string | null;
  readonly completionDocumentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly completionUpdatedAt: string | null;
};

export type StoredDocumentFolderRow = {
  readonly folderId: EntityId<"DocumentFolder">;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly workId: EntityId<"Work">;
  readonly parentFolderId: EntityId<"DocumentFolder"> | null;
  readonly title: string;
  readonly orderKey: string;
};

export type StoredWorkRow = {
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly workUpdatedAt: string;
};

export const DOCUMENT_ROWS_SQL = `
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
  d.folder_id AS "folderId",
  d.manuscript_id AS "manuscriptId",
  m.current_revision_id AS "currentRevisionId",
  dc.revision AS "completionRevision",
  dc.completed_at AS "completionCompletedAt",
  dc.completed_date AS "completionCompletedDate",
  dc.completed_time_zone AS "completionCompletedTimeZone",
  dc.completed_document_revision_id AS "completionDocumentRevisionId",
  dc.updated_at AS "completionUpdatedAt"
FROM works AS w
JOIN documents AS d
  ON d.work_id = w.id
JOIN manuscripts AS m
  ON m.id = d.manuscript_id
  AND m.work_id = w.id
  AND m.document_id = d.id
LEFT JOIN document_completion_status AS dc
  ON dc.work_id = w.id
  AND dc.document_id = d.id
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

export const DOCUMENT_FOLDER_ROWS_SQL = `
SELECT
  f.id AS "folderId",
  f.schema_version AS "schemaVersion",
  f.revision AS "revision",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  f.work_id AS "workId",
  f.parent_folder_id AS "parentFolderId",
  f.title AS "title",
  f.order_key AS "orderKey"
FROM document_folders AS f
JOIN works AS w
  ON w.id = f.work_id
WHERE
  w.retired_at IS NULL
  AND f.retired_at IS NULL
ORDER BY
  f.order_key ASC,
  f.created_at ASC
`;

export const WORK_ROWS_SQL = `
SELECT
  id AS "workId",
  title AS "workTitle",
  updated_at AS "workUpdatedAt"
FROM works
WHERE retired_at IS NULL
ORDER BY updated_at DESC, order_key DESC
`;

export const STUDIO_ROWS_SQL = `
SELECT id
FROM studios
ORDER BY created_at ASC, id ASC
`;

export function createInitialRecords(input: {
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
  readonly plotBoardId: string;
  readonly plotLaneId: string;
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
      kind: "plotBoard",
      ...meta,
      id: input.plotBoardId,
      workId: input.workId,
      title: input.defaults.plotBoard.defaultBoardTitle,
      mode: "sequence",
    },
    {
      kind: "plotLane",
      ...meta,
      id: input.plotLaneId,
      workId: input.workId,
      plotBoardId: input.plotBoardId,
      title: input.defaults.plotBoard.defaultLaneTitle,
      laneKind: "default",
      orderKey: "0/1",
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
      kind: "sceneRuleSet",
      ...meta,
      id: input.sceneRuleSetId,
      workId: input.workId,
      displayName: input.defaults.sceneRuleSet.displayName,
      boundaryRulesJson: JSON.stringify(
        input.defaults.sceneRuleSet.boundaryRules,
      ),
      normalizationPolicy: input.defaults.sceneRuleSet.normalizationPolicy,
      enabled: input.defaults.sceneRuleSet.enabled,
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

export function createDocumentRecords(input: {
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

export function readStoredDocumentRows(
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
        folderId: readNullableIdentity<"DocumentFolder">(
          row,
          "folderId",
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
        completionRevision: readNullableInteger(
          row,
          "completionRevision",
          label,
        ),
        completionCompletedAt: readNullableString(
          row,
          "completionCompletedAt",
          label,
        ),
        completionCompletedDate: readNullableString(
          row,
          "completionCompletedDate",
          label,
        ),
        completionCompletedTimeZone: readNullableString(
          row,
          "completionCompletedTimeZone",
          label,
        ),
        completionDocumentRevisionId: readNullableIdentity<"DocumentRevision">(
          row,
          "completionDocumentRevisionId",
          label,
        ),
        completionUpdatedAt: readNullableString(
          row,
          "completionUpdatedAt",
          label,
        ),
      };
      }),
  );
}

export function readStoredDocumentFolderRows(
  database: NodeSqliteDatabase,
): readonly StoredDocumentFolderRow[] {
  return Object.freeze(
    database
      .prepare(DOCUMENT_FOLDER_ROWS_SQL)
      .all()
      .map((row, index) => {
        const label = `Document folder rows[${index}]`;
        return Object.freeze({
          folderId: entityId<"DocumentFolder">(
            readRequiredString(row, "folderId", label),
          ),
          schemaVersion: readRequiredInteger(row, "schemaVersion", label),
          revision: readRequiredInteger(row, "revision", label),
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          parentFolderId: readNullableIdentity<"DocumentFolder">(
            row,
            "parentFolderId",
            label,
          ),
          title: readRequiredString(row, "title", label),
          orderKey: readRequiredString(row, "orderKey", label),
        });
      }),
  );
}

export function readStoredWorkRows(
  database: NodeSqliteDatabase,
): readonly StoredWorkRow[] {
  return Object.freeze(
    database
      .prepare(WORK_ROWS_SQL)
      .all()
      .map((row, index) => {
        const label = `Work rows[${index}]`;
        return Object.freeze({
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          workTitle: readRequiredString(row, "workTitle", label),
          workUpdatedAt: readRequiredString(
            row,
            "workUpdatedAt",
            label,
          ),
        });
      }),
  );
}

export function createCatalogFromStoredRows(
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
      ...(row.folderId === null ? {} : { folderId: row.folderId }),
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

