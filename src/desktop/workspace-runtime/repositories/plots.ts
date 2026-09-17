import { randomUUID } from "node:crypto";
import type { PlotLaneKind } from "../../../application/plots/plot-board-contract";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { LocalWorkspaceDefaults } from "../../../application/workspace/local-workspace-defaults";
import { compareFractionalOrderKeys,createOrderKeyBetween } from "../../../domain/fractional-order-key";
import type { Poc3LedgerRecord } from "../../../domain/poc-3-storage-ledger";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { createRecordMeta } from "./record-builders";
import { readNullableFiniteNumber,readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";

export type StoredPlotThreadRow = {
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredPlotEventLinkRow = {
  readonly plotEventLinkId: EntityId<"PlotEventLink">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly role: "primary" | "supporting";
  readonly createdFrom:
    | "event-to-plot"
    | "plot-to-event"
    | "manual-link";
  readonly plotTitle: string;
  readonly eventTitle: string;
  readonly plotRetiredAt: string | null;
  readonly eventRetiredAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredPlotBoardRow = {
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly mode: "sequence" | "time-map";
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StoredPlotLaneRow = {
  readonly plotLaneId: EntityId<"PlotLane">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly title: string;
  readonly kind: PlotLaneKind;
  readonly orderKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StoredPlotPlacementRow = {
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
  readonly plotTitle: string;
  readonly plotStage: string;
  readonly plotSummary: string;
  readonly plotNote: string;
  readonly plotCreatedAt: string;
  readonly plotUpdatedAt: string;
  readonly plotRetiredAt: string | null;
  readonly plotRevision: number;
};

export type StoredPlotThreadSourceRow = {
  readonly sourceId: EntityId<"PlotThreadSource">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly createdAt: string;
  readonly retiredAt: string | null;
};

export const ACTIVE_PLOT_THREAD_ROWS_SQL = `
SELECT
  id AS "plotThreadId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  stage AS "stage",
  summary AS "summary",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM plot_threads
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

export const PLOT_THREAD_ROW_BY_ID_SQL = `
SELECT
  id AS "plotThreadId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  stage AS "stage",
  summary AS "summary",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM plot_threads
WHERE work_id = ? AND id = ?
`;

export const DEFAULT_PLOT_BOARD_ROWS_SQL = `
SELECT
  id AS "plotBoardId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  mode AS "mode",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM plot_boards
WHERE work_id = ? AND mode = 'sequence'
ORDER BY created_at ASC, id ASC
`;

export const PLOT_LANE_ROWS_SQL = `
SELECT
  id AS "plotLaneId",
  revision AS "revision",
  work_id AS "workId",
  plot_board_id AS "plotBoardId",
  title AS "title",
  kind AS "kind",
  order_key AS "orderKey",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM plot_lanes
WHERE work_id = ? AND plot_board_id = ?
`;

export const PLOT_PLACEMENT_SELECT_SQL = `
SELECT
  placement.id AS "plotPlacementId",
  placement.revision AS "revision",
  placement.work_id AS "workId",
  placement.plot_board_id AS "plotBoardId",
  placement.plot_lane_id AS "plotLaneId",
  placement.plot_thread_id AS "plotBeatId",
  placement.order_key AS "orderKey",
  placement.story_time AS "storyTime",
  placement.story_time_end AS "storyTimeEnd",
  placement.created_at AS "createdAt",
  placement.updated_at AS "updatedAt",
  placement.retired_at AS "retiredAt",
  plot.title AS "plotTitle",
  plot.stage AS "plotStage",
  plot.summary AS "plotSummary",
  plot.note AS "plotNote",
  plot.created_at AS "plotCreatedAt",
  plot.updated_at AS "plotUpdatedAt",
  plot.retired_at AS "plotRetiredAt",
  plot.revision AS "plotRevision"
FROM plot_placements AS placement
JOIN plot_threads AS plot
  ON plot.work_id = placement.work_id
  AND plot.id = placement.plot_thread_id
`;

export const ACTIVE_PLOT_PLACEMENT_ROWS_SQL = `
${PLOT_PLACEMENT_SELECT_SQL}
WHERE placement.work_id = ?
  AND placement.plot_board_id = ?
  AND placement.retired_at IS NULL
`;

export const PLOT_PLACEMENT_ROW_BY_ID_SQL = `
${PLOT_PLACEMENT_SELECT_SQL}
WHERE placement.work_id = ? AND placement.id = ?
`;

export const PLOT_EVENT_LINK_SELECT_SQL = `
SELECT
  link.id AS "plotEventLinkId",
  link.revision AS "revision",
  link.work_id AS "workId",
  link.plot_thread_id AS "plotBeatId",
  link.event_block_id AS "eventBlockId",
  link.role AS "role",
  link.created_from AS "createdFrom",
  plot.title AS "plotTitle",
  event.title AS "eventTitle",
  plot.retired_at AS "plotRetiredAt",
  event.retired_at AS "eventRetiredAt",
  link.created_at AS "createdAt",
  link.updated_at AS "updatedAt",
  link.retired_at AS "retiredAt"
FROM plot_event_links AS link
JOIN plot_threads AS plot
  ON plot.work_id = link.work_id
  AND plot.id = link.plot_thread_id
JOIN event_blocks AS event
  ON event.work_id = link.work_id
  AND event.id = link.event_block_id
`;

export const ACTIVE_PLOT_EVENT_LINK_ROWS_SQL = `
${PLOT_EVENT_LINK_SELECT_SQL}
WHERE link.work_id = ? AND link.retired_at IS NULL
ORDER BY link.created_at ASC, link.id ASC
`;

export const PLOT_EVENT_LINK_ROW_BY_ID_SQL = `
${PLOT_EVENT_LINK_SELECT_SQL}
WHERE link.work_id = ? AND link.id = ?
`;

export const ACTIVE_PLOT_THREAD_SOURCE_ROWS_SQL = `
SELECT
  pts.id AS "sourceId",
  pts.revision AS "revision",
  pts.work_id AS "workId",
  pts.plot_thread_id AS "plotThreadId",
  pts.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  pts.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  pts.created_at AS "createdAt",
  pts.retired_at AS "retiredAt"
FROM plot_thread_sources AS pts
JOIN plot_threads AS pt
  ON pt.work_id = pts.work_id
  AND pt.id = pts.plot_thread_id
  AND pt.retired_at IS NULL
JOIN anchors AS a
  ON a.work_id = pts.work_id
  AND a.document_id = pts.source_document_id
  AND a.id = pts.source_anchor_id
WHERE pts.work_id = ? AND pts.retired_at IS NULL
ORDER BY pts.created_at ASC, pts.id ASC
`;

export const ACTIVE_PLOT_THREAD_SOURCE_BY_PLOT_SQL = `
SELECT
  pts.id AS "sourceId",
  pts.revision AS "revision",
  pts.work_id AS "workId",
  pts.plot_thread_id AS "plotThreadId",
  pts.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  pts.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  pts.created_at AS "createdAt",
  pts.retired_at AS "retiredAt"
FROM plot_thread_sources AS pts
JOIN anchors AS a
  ON a.work_id = pts.work_id
  AND a.document_id = pts.source_document_id
  AND a.id = pts.source_anchor_id
WHERE
  pts.work_id = ?
  AND pts.plot_thread_id = ?
  AND pts.retired_at IS NULL
`;

export function parseStoredPlotThreadRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotThreadRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    plotThreadId: entityId<"PlotThread">(
      readRequiredString(row, "plotThreadId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    title: readRequiredString(row, "title", label),
    stage: readString(row, "stage", label),
    summary: readString(row, "summary", label),
    note: readString(row, "note", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredPlotThreadRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredPlotThreadRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_THREAD_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredPlotThreadRow(
        row,
        `Plot rows[${index}]`,
      )),
  );
}

export function readStoredPlotThreadRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotThreadId: EntityId<"PlotThread">,
): StoredPlotThreadRow | null {
  const rows = database.prepare(PLOT_THREAD_ROW_BY_ID_SQL).all(
    workId,
    plotThreadId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Plot lookup returned duplicate rows: ${plotThreadId}`);
  }
  return parseStoredPlotThreadRow(rows[0] ?? {}, "Plot lookup");
}

export function parseStoredPlotBoardRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotBoardRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const mode = readRequiredString(row, "mode", label);
  if (mode !== "sequence" && mode !== "time-map") {
    throw new Error(`${label}.mode is invalid`);
  }
  return Object.freeze({
    plotBoardId: entityId<"PlotBoard">(
      readRequiredString(row, "plotBoardId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    title: readRequiredString(row, "title", label),
    mode,
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

export function readStoredDefaultPlotBoardRow(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): StoredPlotBoardRow {
  const rows = database.prepare(DEFAULT_PLOT_BOARD_ROWS_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(
      `Work must have exactly one default sequence PlotBoard: ${workId}`,
    );
  }
  return parseStoredPlotBoardRow(rows[0] ?? {}, "Default PlotBoard lookup");
}

export function parseStoredPlotLaneRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotLaneRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const kind = readRequiredString(row, "kind", label);
  if (
    kind !== "default" &&
    kind !== "main" &&
    kind !== "subplot" &&
    kind !== "stage" &&
    kind !== "custom"
  ) {
    throw new Error(`${label}.kind is invalid`);
  }
  return Object.freeze({
    plotLaneId: entityId<"PlotLane">(
      readRequiredString(row, "plotLaneId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    plotBoardId: entityId<"PlotBoard">(
      readRequiredString(row, "plotBoardId", label),
    ),
    title: readRequiredString(row, "title", label),
    kind,
    orderKey: readRequiredString(row, "orderKey", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

export function readStoredPlotLaneRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotBoardId: EntityId<"PlotBoard">,
): readonly StoredPlotLaneRow[] {
  return Object.freeze(
    database.prepare(PLOT_LANE_ROWS_SQL).all(workId, plotBoardId)
      .map((row, index) => parseStoredPlotLaneRow(row, `PlotLane rows[${index}]`))
      .sort((left, right) =>
        compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
        left.plotLaneId.localeCompare(right.plotLaneId)),
  );
}

export function parseStoredPlotPlacementRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotPlacementRow {
  const revision = readRequiredInteger(row, "revision", label);
  const plotRevision = readRequiredInteger(row, "plotRevision", label);
  if (revision < 1 || plotRevision < 1) {
    throw new Error(`${label} revisions must be at least 1`);
  }
  return Object.freeze({
    plotPlacementId: entityId<"PlotPlacement">(
      readRequiredString(row, "plotPlacementId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    plotBoardId: entityId<"PlotBoard">(
      readRequiredString(row, "plotBoardId", label),
    ),
    plotLaneId: entityId<"PlotLane">(
      readRequiredString(row, "plotLaneId", label),
    ),
    plotBeatId: entityId<"PlotThread">(
      readRequiredString(row, "plotBeatId", label),
    ),
    orderKey: readRequiredString(row, "orderKey", label),
    storyTime: readNullableFiniteNumber(row, "storyTime", label),
    storyTimeEnd: readNullableFiniteNumber(row, "storyTimeEnd", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
    plotTitle: readRequiredString(row, "plotTitle", label),
    plotStage: readString(row, "plotStage", label),
    plotSummary: readString(row, "plotSummary", label),
    plotNote: readString(row, "plotNote", label),
    plotCreatedAt: readRequiredString(row, "plotCreatedAt", label),
    plotUpdatedAt: readRequiredString(row, "plotUpdatedAt", label),
    plotRetiredAt: readNullableString(row, "plotRetiredAt", label),
    plotRevision,
  });
}

export function readStoredActivePlotPlacementRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotBoardId: EntityId<"PlotBoard">,
): readonly StoredPlotPlacementRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_PLACEMENT_ROWS_SQL).all(workId, plotBoardId)
      .map((row, index) =>
        parseStoredPlotPlacementRow(row, `PlotPlacement rows[${index}]`)),
  );
}

export function readStoredPlotPlacementRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotPlacementId: EntityId<"PlotPlacement">,
): StoredPlotPlacementRow | null {
  const rows = database.prepare(PLOT_PLACEMENT_ROW_BY_ID_SQL).all(
    workId,
    plotPlacementId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`PlotPlacement lookup returned duplicate rows: ${plotPlacementId}`);
  }
  return parseStoredPlotPlacementRow(rows[0] ?? {}, "PlotPlacement lookup");
}

export function parseStoredPlotEventLinkRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotEventLinkRow {
  const role = readRequiredString(row, "role", label);
  if (role !== "primary" && role !== "supporting") {
    throw new Error(`${label}.role is invalid`);
  }
  const createdFrom = readRequiredString(row, "createdFrom", label);
  if (
    createdFrom !== "event-to-plot" &&
    createdFrom !== "plot-to-event" &&
    createdFrom !== "manual-link"
  ) {
    throw new Error(`${label}.createdFrom is invalid`);
  }
  return Object.freeze({
    plotEventLinkId: entityId<"PlotEventLink">(
      readRequiredString(row, "plotEventLinkId", label),
    ),
    revision: readRequiredInteger(row, "revision", label),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    plotBeatId: entityId<"PlotThread">(
      readRequiredString(row, "plotBeatId", label),
    ),
    eventBlockId: entityId<"EventBlock">(
      readRequiredString(row, "eventBlockId", label),
    ),
    role,
    createdFrom,
    plotTitle: readRequiredString(row, "plotTitle", label),
    eventTitle: readRequiredString(row, "eventTitle", label),
    plotRetiredAt: readNullableString(row, "plotRetiredAt", label),
    eventRetiredAt: readNullableString(row, "eventRetiredAt", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredPlotEventLinkRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredPlotEventLinkRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_EVENT_LINK_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredPlotEventLinkRow(
        row,
        `PlotEventLink rows[${index}]`,
      )),
  );
}

export function readStoredPlotEventLinkRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotEventLinkId: EntityId<"PlotEventLink">,
): StoredPlotEventLinkRow | null {
  const rows = database.prepare(PLOT_EVENT_LINK_ROW_BY_ID_SQL).all(
    workId,
    plotEventLinkId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`PlotEventLink lookup returned duplicate rows: ${plotEventLinkId}`);
  }
  return parseStoredPlotEventLinkRow(rows[0] ?? {}, "PlotEventLink lookup");
}

export function parseStoredPlotThreadSourceRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotThreadSourceRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    sourceId: entityId<"PlotThreadSource">(
      readRequiredString(row, "sourceId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    plotThreadId: entityId<"PlotThread">(
      readRequiredString(row, "plotThreadId", label),
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
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredPlotThreadSourceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredPlotThreadSourceRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_THREAD_SOURCE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredPlotThreadSourceRow(
        row,
        `Plot source rows[${index}]`,
      )),
  );
}

export function readStoredActivePlotThreadSourceByPlot(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotThreadId: EntityId<"PlotThread">,
): StoredPlotThreadSourceRow | null {
  const rows = database.prepare(ACTIVE_PLOT_THREAD_SOURCE_BY_PLOT_SQL).all(
    workId,
    plotThreadId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Plot source lookup returned duplicate rows: ${plotThreadId}`,
    );
  }
  return parseStoredPlotThreadSourceRow(
    rows[0] ?? {},
    "Plot source lookup",
  );
}

export async function ensureDefaultPlotBoardState(input: Readonly<{
  database: NodeSqliteDatabase;
  ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  defaults: LocalWorkspaceDefaults;
}>): Promise<void> {
  const workRows = input.database.prepare(`
    SELECT id AS "workId"
    FROM works
    ORDER BY created_at ASC, id ASC
  `).all();
  for (const [workIndex, workRow] of workRows.entries()) {
    const workId = entityId<"Work">(
      readRequiredString(workRow, "workId", `Work rows[${workIndex}]`),
    );
    const boardRows = input.database.prepare(DEFAULT_PLOT_BOARD_ROWS_SQL).all(workId);
    if (boardRows.length > 1) {
      throw new Error(`Work has more than one default sequence PlotBoard: ${workId}`);
    }

    const now = new Date().toISOString();
    const board = boardRows.length === 0
      ? Object.freeze({
          plotBoardId: entityId<"PlotBoard">(randomUUID()),
          revision: 1,
          workId,
          title: input.defaults.plotBoard.defaultBoardTitle,
          mode: "sequence" as const,
          createdAt: now,
          updatedAt: now,
        })
      : parseStoredPlotBoardRow(boardRows[0] ?? {}, "Default PlotBoard bootstrap");
    const existingLanes = boardRows.length === 0
      ? []
      : [...readStoredPlotLaneRows(input.database, workId, board.plotBoardId)];
    const defaultLanes = existingLanes.filter((lane) => lane.kind === "default");
    if (boardRows.length !== 0 && defaultLanes.length !== 1) {
      throw new Error(
        `Default PlotBoard must have exactly one default PlotLane: ${board.plotBoardId}`,
      );
    }
    const defaultLane = defaultLanes[0] ?? Object.freeze({
      plotLaneId: entityId<"PlotLane">(randomUUID()),
      revision: 1,
      workId,
      plotBoardId: board.plotBoardId,
      title: input.defaults.plotBoard.defaultLaneTitle,
      kind: "default" as const,
      orderKey: "0/1",
      createdAt: now,
      updatedAt: now,
    });

    const existingPlacements = boardRows.length === 0
      ? []
      : readStoredActivePlotPlacementRows(
          input.database,
          workId,
          board.plotBoardId,
        ).filter((placement) => placement.plotLaneId === defaultLane.plotLaneId)
          .sort((left, right) =>
            compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
            left.plotPlacementId.localeCompare(right.plotPlacementId));
    const missingPlotRows = input.database.prepare(`
      SELECT plot.id AS "plotThreadId"
      FROM plot_threads AS plot
      WHERE
        plot.work_id = ?
        AND plot.retired_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM plot_placements AS placement
          WHERE
            placement.work_id = plot.work_id
            AND placement.plot_thread_id = plot.id
        )
      ORDER BY plot.created_at ASC, plot.id ASC
    `).all(workId);
    const placementRecords: Poc3LedgerRecord[] = [];
    let previousKey = existingPlacements.at(-1)?.orderKey ?? null;
    for (const [plotIndex, plotRow] of missingPlotRows.entries()) {
      const plotThreadId = readRequiredString(
        plotRow,
        "plotThreadId",
        `Unplaced plot rows[${plotIndex}]`,
      );
      const orderKey = createOrderKeyBetween(previousKey, null);
      placementRecords.push({
        kind: "plotPlacement",
        ...createRecordMeta(now),
        id: randomUUID(),
        workId,
        plotBoardId: board.plotBoardId,
        plotLaneId: defaultLane.plotLaneId,
        plotThreadId,
        orderKey,
      });
      previousKey = orderKey;
    }
    if (boardRows.length !== 0 && placementRecords.length === 0) continue;

    await input.ledger.transaction(async (transaction: StorageTransaction) => {
      if (boardRows.length === 0) {
        transaction.write({
          kind: "plotBoard",
          ...createRecordMeta(now),
          id: board.plotBoardId,
          workId,
          title: board.title,
          mode: board.mode,
        });
        transaction.write({
          kind: "plotLane",
          ...createRecordMeta(now),
          id: defaultLane.plotLaneId,
          workId,
          plotBoardId: board.plotBoardId,
          title: defaultLane.title,
          laneKind: defaultLane.kind,
          orderKey: defaultLane.orderKey,
        });
      }
      for (const record of placementRecords) transaction.write(record);
      if (placementRecords.length > 0) {
        transaction.write({
          kind: "plotBoardTouch",
          id: board.plotBoardId,
          workId,
          expectedRevision: board.revision,
          updatedAt: now,
        });
      }
    });
  }
}

