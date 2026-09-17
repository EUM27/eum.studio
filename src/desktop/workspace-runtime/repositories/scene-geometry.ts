import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { CreateSceneOverrideCommand } from "../../../application/structure/scene-override-contract";
import type { SceneEventOverrideProjection,SceneRuleSetProjection } from "../../../application/structure/scene-projection";
import type { LocalWorkspaceDefaults } from "../../../application/workspace/local-workspace-defaults";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { createRecordMeta } from "./record-builders";
import { readNullableString,readRequiredInteger,readRequiredString } from "./scalars";

export type StoredSceneOverrideRow = {
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

export type StoredSceneEpisodeSegmentRow = {
  readonly segmentId: EntityId<"EpisodeSceneSegment">;
  readonly sceneId: EntityId<"Scene">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly anchorId: EntityId<"Anchor">;
};

export type StoredSceneRuleSetRow = {
  readonly sceneRuleSetId: EntityId<"SceneRuleSet">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly displayName: string;
  readonly boundaryRulesJson: string;
  readonly normalizationPolicy: SceneRuleSetProjection["normalizationPolicy"];
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StoredSceneEventOverrideRow = {
  readonly sceneEventOverrideId: EntityId<"SceneEventOverride">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly operation: SceneEventOverrideProjection["operation"];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly binding: StoredSceneMetadataBindingRow;
};

export type StoredSceneMetadataSourceRow = {
  readonly metadataKind: "annotation" | "event-override" | "music-queue";
  readonly metadataId: string;
  readonly workId: EntityId<"Work">;
  readonly sourceSceneKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredSceneMetadataBindingRow = {
  readonly bindingId: string;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly metadataKind: StoredSceneMetadataSourceRow["metadataKind"];
  readonly metadataId: string;
  readonly sourceSceneKey: string;
  readonly sceneId: EntityId<"Scene"> | null;
  readonly status: "current" | "needs-review" | "detached";
  readonly proposedSceneId: EntityId<"Scene"> | null;
  readonly lineageOperationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export const SCENE_OVERRIDE_ROWS_SQL = `
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

export const SCENE_RULE_SET_ROW_BY_WORK_SQL = `
SELECT
  srs.id AS "sceneRuleSetId",
  srs.revision AS "revision",
  srs.work_id AS "workId",
  srs.display_name AS "displayName",
  srs.boundary_rules_json AS "boundaryRulesJson",
  srs.normalization_policy AS "normalizationPolicy",
  srs.enabled AS "enabled",
  srs.created_at AS "createdAt",
  srs.updated_at AS "updatedAt"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
JOIN scene_rule_sets AS srs
  ON srs.work_id = ws.work_id
  AND srs.id = ws.scene_rule_set_id
WHERE
  w.id = ?
  AND w.retired_at IS NULL
  AND srs.retired_at IS NULL
`;

export const SCENE_EVENT_OVERRIDE_ROWS_SQL = `
SELECT
  seo.id AS "sceneEventOverrideId",
  seo.revision AS "revision",
  seo.work_id AS "workId",
  seo.scene_key AS "sceneKey",
  seo.event_block_id AS "eventBlockId",
  seo.operation AS "operation",
  seo.created_at AS "createdAt",
  seo.updated_at AS "updatedAt",
  binding.id AS "bindingId",
  binding.revision AS "bindingRevision",
  binding.source_scene_key AS "bindingSourceSceneKey",
  binding.scene_id AS "bindingSceneId",
  binding.status AS "bindingStatus",
  binding.proposed_scene_id AS "bindingProposedSceneId",
  binding.lineage_operation_id AS "bindingLineageOperationId",
  binding.created_at AS "bindingCreatedAt",
  binding.updated_at AS "bindingUpdatedAt"
FROM scene_event_overrides AS seo
JOIN scene_metadata_bindings AS binding
  ON binding.work_id = seo.work_id
  AND binding.metadata_kind = 'event-override'
  AND binding.metadata_id = seo.id
  AND binding.retired_at IS NULL
WHERE seo.work_id = ? AND seo.retired_at IS NULL
ORDER BY seo.created_at ASC, seo.id ASC
`;

export const SCENE_EPISODE_SEGMENT_ROWS_SQL = `
SELECT
  segment.id AS "segmentId",
  segment.scene_id AS "sceneId",
  segment.work_id AS "workId",
  segment.document_id AS "documentId",
  segment.anchor_id AS "anchorId"
FROM scene_episode_segments AS segment
JOIN scene_identities AS scene
  ON scene.work_id = segment.work_id
  AND scene.id = segment.scene_id
  AND scene.retired_at IS NULL
JOIN documents AS document
  ON document.work_id = segment.work_id
  AND document.id = segment.document_id
  AND document.retired_at IS NULL
  AND document.archived_at IS NULL
WHERE
  segment.work_id = ?
  AND segment.retired_at IS NULL
ORDER BY segment.created_at, segment.id
`;

export const SCENE_METADATA_SOURCE_ROWS_SQL = `
SELECT
  'annotation' AS "metadataKind",
  annotation.id AS "metadataId",
  annotation.work_id AS "workId",
  annotation.scene_key AS "sourceSceneKey",
  annotation.created_at AS "createdAt",
  annotation.updated_at AS "updatedAt",
  NULL AS "retiredAt"
FROM scene_annotations AS annotation
WHERE annotation.work_id = ?
UNION ALL
SELECT
  'event-override',
  event_override.id,
  event_override.work_id,
  event_override.scene_key,
  event_override.created_at,
  event_override.updated_at,
  event_override.retired_at
FROM scene_event_overrides AS event_override
WHERE event_override.work_id = ?
UNION ALL
SELECT
  'music-queue',
  music_queue.id,
  music_queue.work_id,
  music_queue.scene_key,
  music_queue.created_at,
  music_queue.updated_at,
  NULL
FROM scene_music_queue_candidates AS music_queue
WHERE music_queue.work_id = ?
ORDER BY "metadataKind", "createdAt", "metadataId"
`;

export const SCENE_METADATA_BINDING_ROWS_SQL = `
SELECT
  binding.id AS "bindingId",
  binding.revision AS "revision",
  binding.work_id AS "workId",
  binding.metadata_kind AS "metadataKind",
  binding.metadata_id AS "metadataId",
  binding.source_scene_key AS "sourceSceneKey",
  binding.scene_id AS "sceneId",
  binding.status AS "status",
  binding.proposed_scene_id AS "proposedSceneId",
  binding.lineage_operation_id AS "lineageOperationId",
  binding.created_at AS "createdAt",
  binding.updated_at AS "updatedAt",
  binding.retired_at AS "retiredAt"
FROM scene_metadata_bindings AS binding
WHERE binding.work_id = ?
ORDER BY binding.created_at, binding.id
`;

export const WORK_SCENE_RULE_REVISION_SQL = `
SELECT srs.revision AS "baseRuleSetRevision"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
JOIN scene_rule_sets AS srs
  ON srs.work_id = ws.work_id
  AND srs.id = ws.scene_rule_set_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

export function readStoredSceneOverrideRows(
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
          operation !== "delete" &&
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

export function readStoredSceneRuleSetRow(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): StoredSceneRuleSetRow {
  const rows = database.prepare(SCENE_RULE_SET_ROW_BY_WORK_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Work must have exactly one active SceneRuleSet: ${workId}`);
  }
  const row = rows[0] ?? {};
  const label = "SceneRuleSet row";
  const normalizationPolicy = readRequiredString(
    row,
    "normalizationPolicy",
    label,
  );
  if (
    normalizationPolicy !== "preserve" &&
    normalizationPolicy !== "trim-line-whitespace"
  ) {
    throw new Error(`${label}.normalizationPolicy is invalid`);
  }
  const enabled = readRequiredInteger(row, "enabled", label);
  if (enabled !== 0 && enabled !== 1) {
    throw new Error(`${label}.enabled must be 0 or 1`);
  }
  return Object.freeze({
    sceneRuleSetId: entityId<"SceneRuleSet">(
      readRequiredString(row, "sceneRuleSetId", label),
    ),
    revision: readRequiredInteger(row, "revision", label),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    displayName: readRequiredString(row, "displayName", label),
    boundaryRulesJson: readRequiredString(row, "boundaryRulesJson", label),
    normalizationPolicy,
    enabled: enabled === 1,
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

export function readStoredSceneEventOverrideRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneEventOverrideRow[] {
  return Object.freeze(
    database.prepare(SCENE_EVENT_OVERRIDE_ROWS_SQL).all(workId)
      .map((row, index) => {
        const label = `SceneEventOverride rows[${index}]`;
        const operation = readRequiredString(row, "operation", label);
        if (operation !== "include" && operation !== "exclude") {
          throw new Error(`${label}.operation is invalid`);
        }
        const bindingStatus = readRequiredString(row, "bindingStatus", label);
        if (
          bindingStatus !== "current" &&
          bindingStatus !== "needs-review" &&
          bindingStatus !== "detached"
        ) {
          throw new Error(`${label}.bindingStatus is invalid`);
        }
        const bindingSceneId = readNullableString(row, "bindingSceneId", label);
        const bindingProposedSceneId = readNullableString(
          row,
          "bindingProposedSceneId",
          label,
        );
        const sceneEventOverrideId = entityId<"SceneEventOverride">(
          readRequiredString(row, "sceneEventOverrideId", label),
        );
        const rowWorkId = entityId<"Work">(
          readRequiredString(row, "workId", label),
        );
        return Object.freeze({
          sceneEventOverrideId,
          revision: readRequiredInteger(row, "revision", label),
          workId: rowWorkId,
          sceneKey: readRequiredString(row, "sceneKey", label),
          eventBlockId: entityId<"EventBlock">(
            readRequiredString(row, "eventBlockId", label),
          ),
          operation,
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          binding: Object.freeze({
            bindingId: readRequiredString(row, "bindingId", label),
            revision: readRequiredInteger(row, "bindingRevision", label),
            workId: rowWorkId,
            metadataKind: "event-override" as const,
            metadataId: sceneEventOverrideId,
            sourceSceneKey: readRequiredString(
              row,
              "bindingSourceSceneKey",
              label,
            ),
            sceneId: bindingSceneId === null
              ? null
              : entityId<"Scene">(bindingSceneId),
            status: bindingStatus,
            proposedSceneId: bindingProposedSceneId === null
              ? null
              : entityId<"Scene">(bindingProposedSceneId),
            lineageOperationId: readNullableString(
              row,
              "bindingLineageOperationId",
              label,
            ),
            createdAt: readRequiredString(row, "bindingCreatedAt", label),
            updatedAt: readRequiredString(row, "bindingUpdatedAt", label),
            retiredAt: null,
          }),
        });
      }),
  );
}

export async function ensureSceneRuleSetState(input: Readonly<{
  database: NodeSqliteDatabase;
  ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  defaults: LocalWorkspaceDefaults;
}>): Promise<void> {
  const missingRows = input.database.prepare(`
    SELECT
      ws.work_id AS "workId",
      ws.scene_rule_set_id AS "sceneRuleSetId"
    FROM work_settings AS ws
    LEFT JOIN scene_rule_sets AS srs
      ON srs.work_id = ws.work_id
      AND srs.id = ws.scene_rule_set_id
      AND srs.retired_at IS NULL
    WHERE srs.id IS NULL
    ORDER BY ws.work_id ASC
  `).all();
  if (missingRows.length === 0) return;
  const now = new Date().toISOString();
  await input.ledger.transaction(async (transaction: StorageTransaction) => {
    missingRows.forEach((row, index) => {
      const label = `Missing SceneRuleSet rows[${index}]`;
      transaction.write({
        kind: "sceneRuleSet",
        ...createRecordMeta(now),
        id: readRequiredString(row, "sceneRuleSetId", label),
        workId: readRequiredString(row, "workId", label),
        displayName: input.defaults.sceneRuleSet.displayName,
        boundaryRulesJson: JSON.stringify(
          input.defaults.sceneRuleSet.boundaryRules,
        ),
        normalizationPolicy: input.defaults.sceneRuleSet.normalizationPolicy,
        enabled: input.defaults.sceneRuleSet.enabled,
      });
    });
  });
}

