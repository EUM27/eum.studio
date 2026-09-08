import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";

export type StoredFragmentRow = {
  readonly fragmentId: EntityId<"Fragment">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly kindId: string;
  readonly title: string;
  readonly pinned: boolean;
  readonly useCount: number;
  readonly exactText: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export const ACTIVE_FRAGMENT_ROWS_SQL = `
SELECT
  f.id AS "fragmentId",
  f.revision AS "revision",
  f.work_id AS "workId",
  f.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  f.source_anchor_id AS "sourceAnchorId",
  f.kind_id AS "kindId",
  f.title AS "title",
  f.pinned AS "pinned",
  f.use_count AS "useCount",
  a.exact_quote AS "exactText",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  f.retired_at AS "retiredAt"
FROM fragments AS f
JOIN anchors AS a
  ON a.work_id = f.work_id
  AND a.document_id = f.source_document_id
  AND a.id = f.source_anchor_id
WHERE f.work_id = ? AND f.retired_at IS NULL
ORDER BY f.pinned DESC, f.updated_at DESC, f.id ASC
`;

export const FRAGMENT_ROW_BY_ID_SQL = `
SELECT
  f.id AS "fragmentId",
  f.revision AS "revision",
  f.work_id AS "workId",
  f.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  f.source_anchor_id AS "sourceAnchorId",
  f.kind_id AS "kindId",
  f.title AS "title",
  f.pinned AS "pinned",
  f.use_count AS "useCount",
  a.exact_quote AS "exactText",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  f.retired_at AS "retiredAt"
FROM fragments AS f
JOIN anchors AS a
  ON a.work_id = f.work_id
  AND a.document_id = f.source_document_id
  AND a.id = f.source_anchor_id
WHERE f.work_id = ? AND f.id = ?
`;

export function parseStoredFragmentRow(
  row: Record<string, unknown>,
  label: string,
): StoredFragmentRow {
  const pinned = readRequiredInteger(row, "pinned", label);
  const useCount = readRequiredInteger(row, "useCount", label);
  const revision = readRequiredInteger(row, "revision", label);
  if ((pinned !== 0 && pinned !== 1) || useCount < 0 || revision < 1) {
    throw new Error(`${label} contains invalid fragment metadata`);
  }
  return Object.freeze({
    fragmentId: entityId<"Fragment">(
      readRequiredString(row, "fragmentId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    kindId: readRequiredString(row, "kindId", label),
    title: readString(row, "title", label),
    pinned: pinned === 1,
    useCount,
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredFragmentRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredFragmentRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_FRAGMENT_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredFragmentRow(
        row,
        `Fragment rows[${index}]`,
      )),
  );
}

export function readStoredFragmentRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  fragmentId: EntityId<"Fragment">,
): StoredFragmentRow | null {
  const rows = database.prepare(FRAGMENT_ROW_BY_ID_SQL).all(workId, fragmentId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Fragment lookup returned duplicate rows: ${fragmentId}`);
  }
  return parseStoredFragmentRow(rows[0] ?? {}, "Fragment lookup");
}

