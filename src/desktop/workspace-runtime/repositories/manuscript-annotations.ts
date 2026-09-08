import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { parseStoredStringArray,readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";

export type StoredManuscriptAnnotationRow = {
  readonly annotationId: EntityId<"ManuscriptAnnotation">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly body: string;
  readonly tags: readonly string[];
  readonly exactText: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export const ACTIVE_MANUSCRIPT_ANNOTATION_ROWS_SQL = `
SELECT
  annotation.id AS "annotationId",
  annotation.revision AS "revision",
  annotation.work_id AS "workId",
  annotation.source_document_id AS "sourceDocumentId",
  anchor.origin_revision_id AS "sourceDocumentRevisionId",
  annotation.source_anchor_id AS "sourceAnchorId",
  annotation.body AS "body",
  annotation.tags_json AS "tagsJson",
  anchor.exact_quote AS "exactText",
  annotation.created_at AS "createdAt",
  annotation.updated_at AS "updatedAt",
  annotation.retired_at AS "retiredAt"
FROM manuscript_annotations AS annotation
JOIN anchors AS anchor
  ON anchor.work_id = annotation.work_id
  AND anchor.document_id = annotation.source_document_id
  AND anchor.id = annotation.source_anchor_id
WHERE annotation.work_id = ? AND annotation.retired_at IS NULL
ORDER BY annotation.updated_at DESC, annotation.id ASC
`;

export const MANUSCRIPT_ANNOTATION_ROW_BY_ID_SQL = `
SELECT
  annotation.id AS "annotationId",
  annotation.revision AS "revision",
  annotation.work_id AS "workId",
  annotation.source_document_id AS "sourceDocumentId",
  anchor.origin_revision_id AS "sourceDocumentRevisionId",
  annotation.source_anchor_id AS "sourceAnchorId",
  annotation.body AS "body",
  annotation.tags_json AS "tagsJson",
  anchor.exact_quote AS "exactText",
  annotation.created_at AS "createdAt",
  annotation.updated_at AS "updatedAt",
  annotation.retired_at AS "retiredAt"
FROM manuscript_annotations AS annotation
JOIN anchors AS anchor
  ON anchor.work_id = annotation.work_id
  AND anchor.document_id = annotation.source_document_id
  AND anchor.id = annotation.source_anchor_id
WHERE annotation.work_id = ? AND annotation.id = ?
`;

export function parseStoredManuscriptAnnotationRow(
  row: Record<string, unknown>,
  label: string,
): StoredManuscriptAnnotationRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    annotationId: entityId<"ManuscriptAnnotation">(
      readRequiredString(row, "annotationId", label),
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
    body: readString(row, "body", label),
    tags: parseStoredStringArray(
      readRequiredString(row, "tagsJson", label),
      `${label}.tagsJson`,
    ),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredManuscriptAnnotationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredManuscriptAnnotationRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_MANUSCRIPT_ANNOTATION_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredManuscriptAnnotationRow(
        row,
        `Manuscript annotation rows[${index}]`,
      )),
  );
}

export function readStoredManuscriptAnnotationRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  annotationId: EntityId<"ManuscriptAnnotation">,
): StoredManuscriptAnnotationRow | null {
  const rows = database.prepare(MANUSCRIPT_ANNOTATION_ROW_BY_ID_SQL).all(
    workId,
    annotationId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Manuscript annotation lookup returned duplicate rows: ${annotationId}`,
    );
  }
  return parseStoredManuscriptAnnotationRow(
    rows[0] ?? {},
    "Manuscript annotation lookup",
  );
}

