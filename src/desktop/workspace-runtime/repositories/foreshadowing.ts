import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";

export type StoredForeshadowLineRow = {
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredForeshadowPointRow = {
  readonly pointId: EntityId<"ForeshadowPoint">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly roleId: string;
  readonly note: string;
  readonly exactText: string;
  readonly createdAt: string;
};

export const ACTIVE_FORESHADOW_LINE_ROWS_SQL = `
SELECT
  id AS "lineId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM foreshadow_lines
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

export const FORESHADOW_LINE_ROW_BY_ID_SQL = `
SELECT
  id AS "lineId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM foreshadow_lines
WHERE work_id = ? AND id = ?
`;

export const ACTIVE_FORESHADOW_POINT_ROWS_SQL = `
SELECT
  fp.id AS "pointId",
  fp.revision AS "revision",
  fp.work_id AS "workId",
  fp.line_id AS "lineId",
  fp.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  fp.source_anchor_id AS "sourceAnchorId",
  fp.role_id AS "roleId",
  fp.note AS "note",
  a.exact_quote AS "exactText",
  fp.created_at AS "createdAt"
FROM foreshadow_points AS fp
JOIN foreshadow_lines AS fl
  ON fl.work_id = fp.work_id
  AND fl.id = fp.line_id
  AND fl.retired_at IS NULL
JOIN anchors AS a
  ON a.work_id = fp.work_id
  AND a.document_id = fp.source_document_id
  AND a.id = fp.source_anchor_id
WHERE fp.work_id = ? AND fp.retired_at IS NULL
ORDER BY fp.created_at ASC, fp.id ASC
`;

export const FORESHADOW_POINT_ROW_BY_ID_SQL = `
SELECT
  fp.id AS "pointId",
  fp.revision AS "revision",
  fp.work_id AS "workId",
  fp.line_id AS "lineId",
  fp.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  fp.source_anchor_id AS "sourceAnchorId",
  fp.role_id AS "roleId",
  fp.note AS "note",
  a.exact_quote AS "exactText",
  fp.created_at AS "createdAt"
FROM foreshadow_points AS fp
JOIN anchors AS a
  ON a.work_id = fp.work_id
  AND a.document_id = fp.source_document_id
  AND a.id = fp.source_anchor_id
WHERE fp.work_id = ? AND fp.id = ?
`;

export function parseStoredForeshadowLineRow(
  row: Record<string, unknown>,
  label: string,
): StoredForeshadowLineRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    lineId: entityId<"ForeshadowLine">(
      readRequiredString(row, "lineId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    title: readRequiredString(row, "title", label),
    note: readString(row, "note", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredForeshadowLineRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredForeshadowLineRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_FORESHADOW_LINE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredForeshadowLineRow(
        row,
        `Foreshadow line rows[${index}]`,
      )),
  );
}

export function readStoredForeshadowLineRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  lineId: EntityId<"ForeshadowLine">,
): StoredForeshadowLineRow | null {
  const rows = database.prepare(FORESHADOW_LINE_ROW_BY_ID_SQL).all(
    workId,
    lineId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Foreshadow line lookup returned duplicate rows: ${lineId}`);
  }
  return parseStoredForeshadowLineRow(
    rows[0] ?? {},
    "Foreshadow line lookup",
  );
}

export function parseStoredForeshadowPointRow(
  row: Record<string, unknown>,
  label: string,
): StoredForeshadowPointRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    pointId: entityId<"ForeshadowPoint">(
      readRequiredString(row, "pointId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    lineId: entityId<"ForeshadowLine">(
      readRequiredString(row, "lineId", label),
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
    roleId: readRequiredString(row, "roleId", label),
    note: readString(row, "note", label),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

export function readStoredForeshadowPointRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredForeshadowPointRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_FORESHADOW_POINT_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredForeshadowPointRow(
        row,
        `Foreshadow point rows[${index}]`,
      )),
  );
}

export function readStoredForeshadowPointRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  pointId: EntityId<"ForeshadowPoint">,
): StoredForeshadowPointRow | null {
  const rows = database.prepare(FORESHADOW_POINT_ROW_BY_ID_SQL).all(
    workId,
    pointId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Foreshadow point lookup returned duplicate rows: ${pointId}`);
  }
  return parseStoredForeshadowPointRow(
    rows[0] ?? {},
    "Foreshadow point lookup",
  );
}

