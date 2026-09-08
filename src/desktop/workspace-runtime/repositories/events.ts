import { compareEventOutlineOrderKeys } from "../../../application/structure/event-outline-order";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readNullableInteger,readNullableString,readRequiredInteger,readRequiredString } from "./scalars";

export type StoredEventBlockRow = {
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
  readonly parentEventId: EntityId<"EventBlock"> | null;
  readonly outlineOrderKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredEventSourceAnchorRow = {
  readonly anchorId: EntityId<"Anchor">;
  readonly documentId: EntityId<"Document">;
  readonly exactQuote: string;
};

export type StoredEventSourceRow = {
  readonly eventSourceId: EntityId<"EventSource">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly rangeGroupId: EntityId<"RangeGroup">;
  readonly role: "primary" | "supporting";
  readonly anchors: readonly StoredEventSourceAnchorRow[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export const EVENT_BLOCK_ROWS_SQL = `
SELECT
  e.id AS "eventBlockId",
  e.revision AS "revision",
  e.work_id AS "workId",
  e.title AS "title",
  COALESCE(e.note, '') AS "note",
  e.parent_event_id AS "parentEventId",
  e.order_key AS "outlineOrderKey",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  e.retired_at AS "retiredAt"
FROM event_blocks AS e
WHERE
  e.work_id = ?
  AND e.retired_at IS NULL
ORDER BY e.order_key ASC
`;

export const EVENT_BLOCK_ROW_BY_ID_SQL = `
SELECT
  e.id AS "eventBlockId",
  e.revision AS "revision",
  e.work_id AS "workId",
  e.title AS "title",
  COALESCE(e.note, '') AS "note",
  e.parent_event_id AS "parentEventId",
  e.order_key AS "outlineOrderKey",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  e.retired_at AS "retiredAt"
FROM event_blocks AS e
WHERE e.work_id = ? AND e.id = ?
`;

export const EVENT_SOURCE_ROWS_SQL = `
SELECT
  es.id AS "eventSourceId",
  es.revision AS "revision",
  es.work_id AS "workId",
  es.event_block_id AS "eventBlockId",
  es.range_group_id AS "rangeGroupId",
  es.role AS "role",
  es.created_at AS "createdAt",
  es.updated_at AS "updatedAt",
  es.retired_at AS "retiredAt",
  rga.order_index AS "anchorOrderIndex",
  a.id AS "anchorId",
  a.document_id AS "documentId",
  a.exact_quote AS "exactQuote"
FROM event_sources AS es
JOIN event_blocks AS e
  ON e.work_id = es.work_id
  AND e.id = es.event_block_id
  AND e.retired_at IS NULL
JOIN range_groups AS rg
  ON rg.work_id = es.work_id
  AND rg.id = es.range_group_id
LEFT JOIN range_group_anchors AS rga
  ON rga.work_id = rg.work_id
  AND rga.range_group_id = rg.id
LEFT JOIN anchors AS a
  ON a.work_id = rga.work_id
  AND a.id = rga.anchor_id
WHERE
  es.work_id = ?
  AND es.retired_at IS NULL
ORDER BY
  es.created_at ASC,
  es.id ASC,
  rga.order_index ASC
`;

export function parseStoredEventBlockRow(
  row: Record<string, unknown>,
  label: string,
): StoredEventBlockRow {
  const note = row.note;
  if (typeof note !== "string") {
    throw new Error(`${label}.note must be a string`);
  }
  const parentEventId = readNullableString(
    row,
    "parentEventId",
    label,
  );
  return Object.freeze({
    eventBlockId: entityId<"EventBlock">(
      readRequiredString(row, "eventBlockId", label),
    ),
    revision: readRequiredInteger(row, "revision", label),
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    title: readRequiredString(row, "title", label),
    note,
    parentEventId:
      parentEventId === null
        ? null
        : entityId<"EventBlock">(parentEventId),
    outlineOrderKey: readRequiredString(
      row,
      "outlineOrderKey",
      label,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredEventBlockRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredEventBlockRow[] {
  return Object.freeze(
    database
      .prepare(EVENT_BLOCK_ROWS_SQL)
      .all(workId)
      .map((row, index) => parseStoredEventBlockRow(
        row,
        `EventBlock rows[${index}]`,
      ))
      .sort((left, right) =>
        compareEventOutlineOrderKeys(
          left.outlineOrderKey,
          right.outlineOrderKey,
        ) || left.eventBlockId.localeCompare(right.eventBlockId)),
  );
}

export function readStoredEventBlockRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  eventBlockId: EntityId<"EventBlock">,
): StoredEventBlockRow | null {
  const rows = database.prepare(EVENT_BLOCK_ROW_BY_ID_SQL).all(
    workId,
    eventBlockId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`EventBlock lookup returned duplicate rows: ${eventBlockId}`);
  }
  return parseStoredEventBlockRow(rows[0] ?? {}, "EventBlock lookup");
}

export function readStoredEventSourceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredEventSourceRow[] {
  const grouped = new Map<
    EntityId<"EventSource">,
    {
      readonly eventSourceId: EntityId<"EventSource">;
      readonly revision: number;
      readonly workId: EntityId<"Work">;
      readonly eventBlockId: EntityId<"EventBlock">;
      readonly rangeGroupId: EntityId<"RangeGroup">;
      readonly role: "primary" | "supporting";
      readonly anchors: StoredEventSourceAnchorRow[];
      readonly createdAt: string;
      readonly updatedAt: string;
      readonly retiredAt: string | null;
    }
  >();
  database
    .prepare(EVENT_SOURCE_ROWS_SQL)
    .all(workId)
    .forEach((row, index) => {
      const label = `EventSource rows[${index}]`;
      const eventSourceId = entityId<"EventSource">(
        readRequiredString(row, "eventSourceId", label),
      );
      const role = readRequiredString(row, "role", label);
      if (role !== "primary" && role !== "supporting") {
        throw new Error(`${label}.role is invalid`);
      }
      let source = grouped.get(eventSourceId);
      if (source === undefined) {
        source = {
          eventSourceId,
          revision: readRequiredInteger(row, "revision", label),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          eventBlockId: entityId<"EventBlock">(
            readRequiredString(row, "eventBlockId", label),
          ),
          rangeGroupId: entityId<"RangeGroup">(
            readRequiredString(row, "rangeGroupId", label),
          ),
          role,
          anchors: [],
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          retiredAt: readNullableString(row, "retiredAt", label),
        };
        grouped.set(eventSourceId, source);
      }
      const anchorId = readNullableString(row, "anchorId", label);
      const documentId = readNullableString(row, "documentId", label);
      const exactQuote = row.exactQuote;
      const orderIndex = readNullableInteger(row, "anchorOrderIndex", label);
      if (anchorId === null) {
        if (documentId !== null || exactQuote !== null || orderIndex !== null) {
          throw new Error(`${label} contains a partial EventSource anchor`);
        }
        return;
      }
      if (
        documentId === null ||
        typeof exactQuote !== "string" ||
        exactQuote.length === 0 ||
        orderIndex === null
      ) {
        throw new Error(`${label} contains an invalid EventSource anchor`);
      }
      source.anchors.push(Object.freeze({
        anchorId: entityId<"Anchor">(anchorId),
        documentId: entityId<"Document">(documentId),
        exactQuote,
      }));
    });
  return Object.freeze(
    [...grouped.values()].map((source) => Object.freeze({
      ...source,
      anchors: Object.freeze([...source.anchors]),
    })),
  );
}

