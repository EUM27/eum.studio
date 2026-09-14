import { randomUUID } from "node:crypto";
import type { ConfigureAndStartPomodoroCommand,GetPomodoroCommand,PomodoroPhaseCommand,PomodoroProjection,UpdatePomodoroNoteCommand } from "../../../application/activity/pomodoro-contract";
import { createPomodoroPolicyPlan,parseConfigureAndStartPomodoroCommand,parseGetPomodoroCommand,parsePomodoroPhaseCommand,parseUpdatePomodoroNoteCommand,serializePomodoroPolicyPlan } from "../../../application/activity/pomodoro-contract";
import type { FocusCycleProjection,ListWorkActivityCommand,StartFocusCycleCommand,StartWritingSessionCommand,StopFocusCycleCommand,StopWritingSessionCommand,WorkActivityProjection,WritingSessionProjection } from "../../../application/activity/work-activity-contract";
import { parseListWorkActivityCommand,parseStartFocusCycleCommand,parseStartWritingSessionCommand,parseStopFocusCycleCommand,parseStopWritingSessionCommand,parseWorkActivityProjection } from "../../../application/activity/work-activity-contract";
import type { PreparedWorkRecordsExport } from "../../../application/activity/work-records-export";
import { parseExportWorkRecordsCommand,prepareWorkRecordsExport } from "../../../application/activity/work-records-export";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { WorkCalendarProjection } from "../../../application/schedule/work-calendar-contract";
import { parseWorkCalendarProjection } from "../../../application/schedule/work-calendar-contract";
import type { CreateWorkScheduleItemCommand,ListWorkScheduleCommand,RetireWorkScheduleItemCommand,SetWorkScheduleCompletionCommand,UpdateWorkScheduleItemCommand,WorkRoutineCompletion,WorkScheduleItemInput,WorkScheduleItemProjection,WorkScheduleProjection } from "../../../application/schedule/work-schedule-contract";
import { deriveWorkScheduleOccurrences,parseCreateWorkScheduleItemCommand,parseListWorkScheduleCommand,parseRetireWorkScheduleItemCommand,parseSetWorkScheduleCompletionCommand,parseUpdateWorkScheduleItemCommand,parseWorkScheduleDdayWorkload,parseWorkScheduleItemProjection,parseWorkScheduleProjection } from "../../../application/schedule/work-schedule-contract";
import { deriveWorkEpisodeCharacterProgress } from "../../../application/settings/app-settings";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { GetStudioTodayCommand,StudioTodayProjection } from "../../../application/today/studio-today-contract";
import { parseGetStudioTodayCommand,projectStudioToday } from "../../../application/today/studio-today-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { deriveStoredPomodoroProjection,findPomodoroPhaseDefinition,insertPomodoroCycle,readActiveWritingSessionId,readCurrentFocusPolicyRow,readFocusPolicyRowById,readPomodoroPolicyPlan,readStoredActivityIntervalRows,readStoredFocusCycleRows,readStoredWritingSessionRows,readWorkActivityPolicyIds,transitionCompletedPomodoroPhase } from "../repositories/activity";
import { createRecordMeta } from "../repositories/record-builders";
import { readNullableString,readRequiredInteger,readRequiredString,readTimestamp } from "../repositories/scalars";
import { createTimeZoneDateKey } from "../repositories/time";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";
import type { SettingsService } from "./settings";
import { workspaceWindowContext } from "../../workspace-window-context";

/** Owns activity commands and their existing transaction boundaries. */
export class ActivityService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "timezone">;
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #settings: Pick<SettingsService, "getAppSettingsSerially">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "timezone">;
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly settings: Pick<SettingsService, "getAppSettingsSerially">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
    this.#settings = input.settings;
  }

  startWritingSession(value: unknown): Promise<WorkActivityProjection> {
    this.#infrastructure.assertOpen();
    const command = parseStartWritingSessionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#startWritingSessionSerially(command);
    });

    return execution;
  }

  stopWritingSession(value: unknown): Promise<WorkActivityProjection> {
    this.#infrastructure.assertOpen();
    const command = parseStopWritingSessionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#stopWritingSessionSerially(command);
    });

    return execution;
  }

  startFocusCycle(value: unknown): Promise<WorkActivityProjection> {
    this.#infrastructure.assertOpen();
    const command = parseStartFocusCycleCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#startFocusCycleSerially(command);
    });

    return execution;
  }

  stopFocusCycle(value: unknown): Promise<WorkActivityProjection> {
    this.#infrastructure.assertOpen();
    const command = parseStopFocusCycleCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#stopFocusCycleSerially(command);
    });

    return execution;
  }

  listWorkActivity(value: unknown): Promise<WorkActivityProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListWorkActivityCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listWorkActivitySerially(command),
    );
  }

  getPomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetPomodoroCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getPomodoroSerially(command),
    );
  }

  configureAndStartPomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parseConfigureAndStartPomodoroCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#configureAndStartPomodoroSerially(command);
    });

    return execution;
  }

  pausePomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#pausePomodoroSerially(command);
    });

    return execution;
  }

  resumePomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#resumePomodoroSerially(command);
    });

    return execution;
  }

  reconcilePomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#reconcilePomodoroSerially(command);
    });

    return execution;
  }

  updatePomodoroNote(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePomodoroNoteCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePomodoroNoteSerially(command);
    });

    return execution;
  }

  stopPomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#stopPomodoroSerially(command);
    });

    return execution;
  }

  prepareWorkRecordsExport(value: unknown): Promise<PreparedWorkRecordsExport> {
    this.#infrastructure.assertOpen();
    const command = parseExportWorkRecordsCommand(value);
    return this.#operations.readBarrier().then(async () => {
      const work = this.#state.catalog.works.find(
        (candidate) => candidate.workId === command.workId,
      );
      if (work === undefined) {
        throw new Error(`Unknown Work: ${command.workId}`);
      }
      const activity = await this.#listWorkActivitySerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      return prepareWorkRecordsExport({
        command,
        workTitle: work.title,
        documents: work.documents.map((document) => ({
          documentId: document.documentId,
          title: document.title,
        })),
        activity,
        dateKey: createTimeZoneDateKey(this.#options.timezone),
      });
    });
  }

  listWorkSchedule(value: unknown): Promise<WorkScheduleProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListWorkScheduleCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listWorkScheduleSerially(command),
    );
  }

  listWorkCalendar(value: unknown): Promise<WorkCalendarProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListWorkScheduleCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listWorkCalendarSerially(command),
    );
  }

  getStudioToday(value: unknown): Promise<StudioTodayProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetStudioTodayCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getStudioTodaySerially(command),
    );
  }

  createWorkScheduleItem(
    value: unknown,
  ): Promise<WorkScheduleItemProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateWorkScheduleItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createWorkScheduleItemSerially(command);
    });

    return execution;
  }

  updateWorkScheduleItem(
    value: unknown,
  ): Promise<WorkScheduleItemProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateWorkScheduleItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateWorkScheduleItemSerially(command);
    });

    return execution;
  }

  retireWorkScheduleItem(value: unknown): Promise<void> {
    this.#infrastructure.assertOpen();
    const command = parseRetireWorkScheduleItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      this.#retireWorkScheduleItemSerially(command);
    });

    return execution;
  }

  setWorkScheduleCompletion(
    value: unknown,
  ): Promise<WorkScheduleItemProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSetWorkScheduleCompletionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#setWorkScheduleCompletionSerially(command);
    });

    return execution;
  }

  #scheduleItemStorageValues(item: WorkScheduleItemInput): {
    readonly kind: WorkScheduleItemInput["kind"];
    readonly label: string;
    readonly scheduleDate: string;
    readonly scheduleTime: string | null;
    readonly workloadJson: string | null;
  } {
    if (item.kind === "routine") {
      return {
        kind: item.kind,
        label: item.label,
        scheduleDate: item.startDate,
        scheduleTime: item.time,
        workloadJson: null,
      };
    }
    return {
      kind: item.kind,
      label: item.label,
      scheduleDate: item.date,
      scheduleTime: item.time,
      workloadJson:
        item.kind === "dday" ? JSON.stringify(item.workload) : null,
    };
  }

  #parseWorkScheduleRow(
    row: Record<string, unknown>,
  ): WorkScheduleItemProjection {
    const label = "Work schedule item row";
    const kind = readRequiredString(row, "kind", label);
    const common = {
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      itemId: readRequiredString(row, "itemId", label),
      workId: readRequiredString(row, "workId", label),
      revision: readRequiredInteger(row, "revision", label),
      kind,
      label: readRequiredString(row, "label", label),
      time: readNullableString(row, "scheduleTime", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    };
    const scheduleDate = readRequiredString(row, "scheduleDate", label);
    const workloadJson = readNullableString(row, "workloadJson", label);
    const completedAt = readNullableString(row, "completedAt", label);
    if (kind === "task") {
      if (workloadJson !== null) {
        throw new Error("Schedule task must not contain D-DAY workload");
      }
      return parseWorkScheduleItemProjection({
        ...common,
        kind,
        date: scheduleDate,
        completedAt,
      });
    }
    if (kind === "routine") {
      if (workloadJson !== null || completedAt !== null) {
        throw new Error("Schedule routine row contains unsupported state");
      }
      return parseWorkScheduleItemProjection({
        ...common,
        kind,
        startDate: scheduleDate,
      });
    }
    if (kind === "dday") {
      if (workloadJson === null || completedAt !== null) {
        throw new Error("Schedule D-DAY row is incomplete");
      }
      return parseWorkScheduleItemProjection({
        ...common,
        kind,
        date: scheduleDate,
        workload: parseWorkScheduleDdayWorkload(JSON.parse(workloadJson)),
      });
    }
    throw new Error(`Unsupported Work schedule item kind: ${kind}`);
  }

  #readWorkScheduleItems(
    workId: EntityId<"Work">,
  ): readonly WorkScheduleItemProjection[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            id AS "itemId",
            schema_version AS "schemaVersion",
            revision,
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            work_id AS "workId",
            kind,
            label,
            schedule_date AS "scheduleDate",
            schedule_time AS "scheduleTime",
            workload_json AS "workloadJson",
            completed_at AS "completedAt"
          FROM work_schedule_items
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY schedule_date, COALESCE(schedule_time, ''), created_at, id
        `)
        .all(workId)
        .map((row) => this.#parseWorkScheduleRow(row)),
    );
  }

  #readWorkScheduleItem(
    workId: EntityId<"Work">,
    itemId: EntityId<"WorkScheduleItem">,
  ): WorkScheduleItemProjection {
    const item = this.#readWorkScheduleItems(workId).find(
      (candidate) => candidate.itemId === itemId,
    );
    if (item === undefined) {
      throw new Error(`Unknown Work schedule item: ${workId}/${itemId}`);
    }
    return item;
  }

  #listWorkScheduleSerially(
    command: ListWorkScheduleCommand,
  ): WorkScheduleProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const items = this.#readWorkScheduleItems(command.workId);
    const routineCompletions: WorkRoutineCompletion[] = this.#database
      .prepare(`
        SELECT
          c.routine_id AS "itemId",
          c.occurrence_date AS "date",
          c.completed_at AS "completedAt"
        FROM work_routine_completions AS c
        JOIN work_schedule_items AS i
          ON i.work_id = c.work_id
          AND i.id = c.routine_id
        WHERE
          c.work_id = ?
          AND c.occurrence_date >= ?
          AND c.occurrence_date <= ?
          AND i.kind = 'routine'
          AND i.retired_at IS NULL
        ORDER BY c.occurrence_date, c.routine_id
      `)
      .all(command.workId, command.range.from, command.range.to)
      .map((row) => ({
        itemId: entityId<"WorkScheduleItem">(
          readRequiredString(row, "itemId", "Routine completion row"),
        ),
        date: readRequiredString(row, "date", "Routine completion row"),
        completedAt: readRequiredString(
          row,
          "completedAt",
          "Routine completion row",
        ),
      }));
    return parseWorkScheduleProjection({
      schemaVersion: 1,
      workId: command.workId,
      range: command.range,
      items,
      occurrences: deriveWorkScheduleOccurrences({
        workId: command.workId,
        range: command.range,
        items,
        routineCompletions,
      }),
      episodeProgress: deriveWorkEpisodeCharacterProgress({
        workId: command.workId,
        defaultEpisodeCharacters:
          this.#settings.getAppSettingsSerially().settings.defaultEpisodeCharacters,
        documents: work.documents.map((document) => {
          const target = this.#state.documentTargets.get(document.documentId);
          if (target === undefined || target.workId !== command.workId) {
            throw new Error(
              `Work/document boundary violation: ${command.workId}/${document.documentId}`,
            );
          }
          return {
            workId: target.workId,
            documentId: target.documentId,
            text: target.text,
          };
        }),
      }),
    });
  }

  #listWorkCalendarSerially(
    command: ListWorkScheduleCommand,
  ): WorkCalendarProjection {
    const schedule = this.#listWorkScheduleSerially(command);
    const completedDocumentCount = readRequiredInteger(
      this.#database.prepare(`
        SELECT COUNT(*) AS count
        FROM document_completion_status AS dc
        JOIN documents AS d
          ON d.work_id = dc.work_id
          AND d.id = dc.document_id
        JOIN works AS w
          ON w.id = dc.work_id
        WHERE
          dc.work_id = ?
          AND dc.completed_at IS NOT NULL
          AND w.retired_at IS NULL
          AND d.retired_at IS NULL
          AND d.archived_at IS NULL
      `).all(command.workId)[0] ?? {},
      "count",
      "Completed Document count row",
    );
    const completionOccurrences = this.#database
      .prepare(`
        SELECT
          dc.document_id AS "documentId",
          d.title AS "documentTitle",
          dc.completed_at AS "completedAt",
          dc.completed_date AS "completedDate",
          dc.completed_document_revision_id AS "completedDocumentRevisionId",
          m.current_revision_id AS "currentDocumentRevisionId"
        FROM document_completion_status AS dc
        JOIN documents AS d
          ON d.work_id = dc.work_id
          AND d.id = dc.document_id
        JOIN manuscripts AS m
          ON m.work_id = d.work_id
          AND m.document_id = d.id
          AND m.id = d.manuscript_id
        JOIN works AS w
          ON w.id = dc.work_id
        WHERE
          dc.work_id = ?
          AND dc.completed_at IS NOT NULL
          AND dc.completed_date >= ?
          AND dc.completed_date <= ?
          AND w.retired_at IS NULL
          AND d.retired_at IS NULL
          AND d.archived_at IS NULL
        ORDER BY dc.completed_date, dc.completed_at, dc.document_id
      `)
      .all(command.workId, command.range.from, command.range.to)
      .map((row) => {
        const documentId = entityId<"Document">(
          readRequiredString(
            row,
            "documentId",
            "Document completion occurrence row",
          ),
        );
        const documentTitle = readRequiredString(
          row,
          "documentTitle",
          "Document completion occurrence row",
        );
        const completedDocumentRevisionId = entityId<"DocumentRevision">(
          readRequiredString(
            row,
            "completedDocumentRevisionId",
            "Document completion occurrence row",
          ),
        );
        const currentDocumentRevisionId = entityId<"DocumentRevision">(
          readRequiredString(
            row,
            "currentDocumentRevisionId",
            "Document completion occurrence row",
          ),
        );
        return {
          occurrenceId: `document-completion:${documentId}`,
          workId: command.workId,
          documentId,
          documentTitle,
          kind: "document-completion" as const,
          label: `${documentTitle} 완료`,
          date: readRequiredString(
            row,
            "completedDate",
            "Document completion occurrence row",
          ),
          time: null,
          completed: true,
          completedAt: readRequiredString(
            row,
            "completedAt",
            "Document completion occurrence row",
          ),
          completedDocumentRevisionId,
          state: completedDocumentRevisionId === currentDocumentRevisionId
            ? "current" as const
            : "edited-after-completion" as const,
        };
      });
    return parseWorkCalendarProjection({
      ...schedule,
      occurrences: [...schedule.occurrences, ...completionOccurrences],
      completedDocumentCount,
    });
  }

  #getStudioTodaySerially(
    command: GetStudioTodayCommand,
  ): StudioTodayProjection {
    return projectStudioToday({
      date: command.date,
      works: this.#state.catalog.works.map((work) => ({
        workId: work.workId,
        workTitle: work.title,
        calendar: this.#listWorkCalendarSerially({
          schemaVersion: 1,
          workId: work.workId,
          range: { from: command.date, to: command.date },
        }),
      })),
    });
  }

  #createWorkScheduleItemSerially(
    command: CreateWorkScheduleItemCommand,
  ): WorkScheduleItemProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const itemId = entityId<"WorkScheduleItem">(randomUUID());
    const now = new Date().toISOString();
    const values = this.#scheduleItemStorageValues(command.item);
    this.#database
      .prepare(`
        INSERT INTO work_schedule_items (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          work_id,
          kind,
          label,
          schedule_date,
          schedule_time,
          workload_json,
          completed_at
        ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)
      `)
      .run(
        itemId,
        now,
        now,
        command.workId,
        values.kind,
        values.label,
        values.scheduleDate,
        values.scheduleTime,
        values.workloadJson,
      );
    return this.#readWorkScheduleItem(command.workId, itemId);
  }

  #updateWorkScheduleItemSerially(
    command: UpdateWorkScheduleItemCommand,
  ): WorkScheduleItemProjection {
    const current = this.#readWorkScheduleItem(command.workId, command.itemId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work schedule item revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (current.kind !== command.item.kind) {
      throw new Error("Work schedule item kind cannot be changed");
    }
    const values = this.#scheduleItemStorageValues(command.item);
    const updated = this.#database
      .prepare(`
        UPDATE work_schedule_items
        SET
          revision = revision + 1,
          updated_at = ?,
          label = ?,
          schedule_date = ?,
          schedule_time = ?,
          workload_json = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `)
      .run(
        new Date().toISOString(),
        values.label,
        values.scheduleDate,
        values.scheduleTime,
        values.workloadJson,
        command.workId,
        command.itemId,
        command.expectedRevision,
      );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Work schedule item changed: ${command.itemId}`);
    }
    return this.#readWorkScheduleItem(command.workId, command.itemId);
  }

  #retireWorkScheduleItemSerially(
    command: RetireWorkScheduleItemCommand,
  ): void {
    const current = this.#readWorkScheduleItem(command.workId, command.itemId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work schedule item revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const now = new Date().toISOString();
    const retired = this.#database
      .prepare(`
        UPDATE work_schedule_items
        SET revision = revision + 1, updated_at = ?, retired_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `)
      .run(
        now,
        now,
        command.workId,
        command.itemId,
        command.expectedRevision,
      );
    if (Number(retired.changes) !== 1) {
      throw new Error(`Work schedule item changed: ${command.itemId}`);
    }
  }

  #setWorkScheduleCompletionSerially(
    command: SetWorkScheduleCompletionCommand,
  ): WorkScheduleItemProjection {
    const current = this.#readWorkScheduleItem(command.workId, command.itemId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work schedule item revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (current.kind === "dday") {
      throw new Error("D-DAY does not support completion state");
    }
    if (current.kind === "task") {
      if (command.date !== current.date) {
        throw new Error("Schedule task completion date must match its date");
      }
      if ((current.completedAt !== null) === command.completed) return current;
      const now = new Date().toISOString();
      const updated = this.#database
        .prepare(`
          UPDATE work_schedule_items
          SET revision = revision + 1, updated_at = ?, completed_at = ?
          WHERE
            work_id = ?
            AND id = ?
            AND revision = ?
            AND retired_at IS NULL
        `)
        .run(
          now,
          command.completed ? now : null,
          command.workId,
          command.itemId,
          command.expectedRevision,
        );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work schedule item changed: ${command.itemId}`);
      }
      return this.#readWorkScheduleItem(command.workId, command.itemId);
    }
    if (command.date < current.startDate) {
      throw new Error("Routine completion date precedes its start date");
    }
    if (command.completed) {
      this.#database
        .prepare(`
          INSERT OR IGNORE INTO work_routine_completions (
            work_id,
            routine_id,
            occurrence_date,
            completed_at
          ) VALUES (?, ?, ?, ?)
        `)
        .run(
          command.workId,
          command.itemId,
          command.date,
          new Date().toISOString(),
        );
    } else {
      this.#database
        .prepare(`
          DELETE FROM work_routine_completions
          WHERE work_id = ? AND routine_id = ? AND occurrence_date = ?
        `)
        .run(command.workId, command.itemId, command.date);
    }
    return current;
  }

  async #startWritingSessionSerially(
    command: StartWritingSessionCommand,
  ): Promise<WorkActivityProjection> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const sessions = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    );
    const activeSession = sessions.find((session) => session.state === "active");
    if (activeSession !== undefined) {
      if (workspaceWindowContext.getStore() === undefined || command.note.length !== 0) {
        throw new Error(`Work already has an active WritingSession: ${command.workId}`);
      }
      if (activeSession.documentId === command.documentId) {
        return this.#listWorkActivitySerially({ schemaVersion: 1, workId: command.workId });
      }
      await this.#stopWritingSessionSerially({ schemaVersion: 1, workId: command.workId, sessionId: activeSession.sessionId });
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
      if (workspaceWindowContext.getStore() !== undefined) {
        return this.#listWorkActivitySerially({ schemaVersion: 1, workId: command.workId });
      }
      throw new Error(`WritingSession is not active: ${command.sessionId}`);
    }
    if (session.documentId === null) {
      throw new Error(`WritingSession has no Document: ${command.sessionId}`);
    }
    const target = this.#state.documentTargets.get(session.documentId);
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
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const cycles = readStoredFocusCycleRows(this.#database, command.workId);
    if (cycles.some((cycle) => cycle.state === "running" || cycle.state === "paused")) {
      throw new Error(`Work already has an active FocusCycle: ${command.workId}`);
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
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const availableDocumentIds = new Set(
      work.documents.map((document) => document.documentId),
    );
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
    const revisionDetails = new Map<EntityId<"DocumentRevision">, ReturnType<RevisionStore["getRevision"]>>();
    const readRevisionLength = (revisionId: EntityId<"DocumentRevision">, documentId: EntityId<"Document"> | null): Promise<number> => {
      let pending = revisionDetails.get(revisionId);
      if (pending === undefined) {
        pending = this.#revisionStore.getRevision(revisionId);
        revisionDetails.set(revisionId, pending);
      }
      return pending.then((revision) => {
        if (revision === null || (documentId !== null && revision.documentId !== documentId)) {
          throw new Error(`WritingSession revision does not belong to its Document: ${revisionId}`);
        }
        return revision.length;
      });
    };
    const sessions: WritingSessionProjection[] = await Promise.all(
      sessionRows.map(async (session) => {
        let characterDelta: number | null = null;
        if (
          session.startRevisionId !== null &&
          session.endRevisionId !== null
        ) {
          const [startLength, endLength] = await Promise.all([
            readRevisionLength(session.startRevisionId, session.documentId),
            readRevisionLength(session.endRevisionId, session.documentId),
          ]);
          characterDelta = endLength - startLength;
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
          documentId:
            session.documentId !== null &&
            availableDocumentIds.has(session.documentId)
              ? session.documentId
              : null,
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
    ).map((cycle) => {
      const policy = readFocusPolicyRowById(
        this.#database,
        command.workId,
        cycle.policyId,
      );
      const pomodoroPlan = readPomodoroPolicyPlan(policy);
      return {
        schemaVersion: 1,
        focusCycleId: cycle.focusCycleId,
        workId: cycle.workId,
        sessionId: cycle.sessionId,
        state: cycle.state,
        phaseRef:
          pomodoroPlan === null
            ? cycle.phaseRef
            : findPomodoroPhaseDefinition(pomodoroPlan, cycle.phaseRef).phase,
        targetDurationMs: cycle.targetDurationMs,
        startedAt: cycle.startedAt,
        deadlineAt: cycle.deadlineAt,
        remainingDurationMs: cycle.remainingAtPause,
        pauseReason: cycle.pauseReason,
        completedAt: cycle.completedAt,
        note: cycle.note,
      };
    });
    return parseWorkActivityProjection({
      schemaVersion: 1,
      workId: command.workId,
      activeSessionId:
        sessions.find((session) => session.state === "active")?.sessionId ?? null,
      activeFocusCycleId:
        focusCycles.find(
          (cycle) => cycle.state === "running" || cycle.state === "paused",
        )?.focusCycleId ?? null,
      sessions,
      focusCycles,
    });
  }

  #getPomodoroSerially(command: GetPomodoroCommand): PomodoroProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs: Date.now(),
    });
  }

  #configureAndStartPomodoroSerially(
    command: ConfigureAndStartPomodoroCommand,
  ): PomodoroProjection {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const active = readStoredFocusCycleRows(this.#database, command.workId).find(
      (cycle) => cycle.state === "running" || cycle.state === "paused",
    );
    if (active !== undefined) {
      throw new Error(`Work already has an active FocusCycle: ${command.workId}`);
    }
    const currentPolicy = readCurrentFocusPolicyRow(
      this.#database,
      command.workId,
    );
    const plan = createPomodoroPolicyPlan(
      {
        workDurationMs: command.workDurationMs,
        breakDurationMs: command.breakDurationMs,
        workCycleCount: command.workCycleCount,
        autoAdvance: command.autoAdvance,
      },
      () => randomUUID(),
    );
    const firstPhase = plan.phases.find((phase) => phase.phase === "work");
    if (firstPhase === undefined) {
      throw new Error("Configured Pomodoro has no work phase");
    }
    const policyId = randomUUID();
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    const nowMs = Date.now();
    const startedAt = new Date(nowMs).toISOString();
    const phaseDefinitionsJson = serializePomodoroPolicyPlan(plan);
    const completionPolicy = plan.settings.autoAdvance
      ? "auto-advance"
      : "manual";
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const insertedPolicy = this.#database.prepare(`
        INSERT INTO focus_policies (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          work_id,
          phase_definitions_json,
          background_policy,
          music_start_policy,
          completion_policy,
          visibility
        )
        SELECT
          ?,
          schema_version,
          1,
          ?,
          ?,
          NULL,
          work_id,
          ?,
          background_policy,
          music_start_policy,
          ?,
          visibility
        FROM focus_policies
        WHERE work_id = ? AND id = ? AND retired_at IS NULL
      `).run(
        policyId,
        startedAt,
        startedAt,
        phaseDefinitionsJson,
        completionPolicy,
        command.workId,
        currentPolicy.policyId,
      );
      if (Number(insertedPolicy.changes) !== 1) {
        throw new Error(`Current Work focus policy changed: ${command.workId}`);
      }
      const updatedSettings = this.#database.prepare(`
        UPDATE work_settings
        SET focus_policy_id = ?, revision = revision + 1
        WHERE work_id = ? AND focus_policy_id = ?
      `).run(policyId, command.workId, currentPolicy.policyId);
      if (Number(updatedSettings.changes) !== 1) {
        throw new Error(`Work focus settings changed: ${command.workId}`);
      }
      insertPomodoroCycle({
        database: this.#database,
        focusCycleId,
        workId: command.workId,
        sessionId: readActiveWritingSessionId(this.#database, command.workId),
        policyId,
        phaseRef: firstPhase.phaseRef,
        state: "running",
        pauseReason: null,
        targetDurationMs: firstPhase.targetDurationMs,
        startedAt,
        deadlineAt: new Date(nowMs + firstPhase.targetDurationMs).toISOString(),
        remainingAtPause: null,
        note: command.note,
      });
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #pausePomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    const policy = readCurrentFocusPolicyRow(this.#database, command.workId);
    if (readPomodoroPolicyPlan(policy) === null) {
      throw new Error(`Current Work has no configured Pomodoro: ${command.workId}`);
    }
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (
      cycle === undefined ||
      cycle.policyId !== policy.policyId ||
      cycle.state !== "running" ||
      cycle.deadlineAt === null
    ) {
      throw new Error(`Pomodoro phase is not running: ${command.focusCycleId}`);
    }
    const remainingDurationMs = Math.max(
      0,
      readTimestamp(cycle.deadlineAt, "FocusCycle.deadlineAt") - nowMs,
    );
    if (remainingDurationMs === 0) {
      transitionCompletedPomodoroPhase({
        database: this.#database,
        workId: command.workId,
        focusCycleId: command.focusCycleId,
        nowMs,
        restore: false,
      });
    } else {
      const updatedAt = new Date(nowMs).toISOString();
      const updated = this.#database.prepare(`
        UPDATE focus_cycles
        SET
          revision = revision + 1,
          updated_at = ?,
          state = 'paused',
          pause_reason = 'manual',
          deadline_at = NULL,
          remaining_at_pause = ?
        WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'running'
      `).run(
        updatedAt,
        remainingDurationMs,
        command.focusCycleId,
        command.workId,
        policy.policyId,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Pomodoro phase changed before pause: ${command.focusCycleId}`);
      }
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #resumePomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    const policy = readCurrentFocusPolicyRow(this.#database, command.workId);
    if (readPomodoroPolicyPlan(policy) === null) {
      throw new Error(`Current Work has no configured Pomodoro: ${command.workId}`);
    }
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (
      cycle === undefined ||
      cycle.policyId !== policy.policyId ||
      cycle.state !== "paused" ||
      cycle.remainingAtPause === null ||
      cycle.remainingAtPause <= 0
    ) {
      throw new Error(`Pomodoro phase is not paused: ${command.focusCycleId}`);
    }
    const updatedAt = new Date(nowMs).toISOString();
    const deadlineAt = new Date(nowMs + cycle.remainingAtPause).toISOString();
    const updated = this.#database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'running',
        pause_reason = NULL,
        deadline_at = ?,
        remaining_at_pause = NULL
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'paused'
    `).run(
      updatedAt,
      deadlineAt,
      command.focusCycleId,
      command.workId,
      policy.policyId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before resume: ${command.focusCycleId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #reconcilePomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    transitionCompletedPomodoroPhase({
      database: this.#database,
      workId: command.workId,
      focusCycleId: command.focusCycleId,
      nowMs,
      restore: false,
    });
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #updatePomodoroNoteSerially(
    command: UpdatePomodoroNoteCommand,
  ): PomodoroProjection {
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (cycle === undefined) {
      throw new Error(`Unknown Pomodoro phase: ${command.focusCycleId}`);
    }
    if (cycle.state !== "running" && cycle.state !== "paused") {
      throw new Error(`Pomodoro phase is not active: ${command.focusCycleId}`);
    }
    const nowMs = Date.now();
    const updatedAt = new Date(nowMs).toISOString();
    const updated = this.#database.prepare(`
      UPDATE focus_cycles
      SET revision = revision + 1, updated_at = ?, note = ?
      WHERE id = ? AND work_id = ? AND state IN ('running', 'paused')
    `).run(
      updatedAt,
      command.note.length === 0 ? null : command.note,
      command.focusCycleId,
      command.workId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before note save: ${command.focusCycleId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #stopPomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    const policy = readCurrentFocusPolicyRow(this.#database, command.workId);
    if (readPomodoroPolicyPlan(policy) === null) {
      throw new Error(`Current Work has no configured Pomodoro: ${command.workId}`);
    }
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (
      cycle === undefined ||
      cycle.policyId !== policy.policyId ||
      (cycle.state !== "running" && cycle.state !== "paused")
    ) {
      throw new Error(`Pomodoro phase is not active: ${command.focusCycleId}`);
    }
    const remainingDurationMs = cycle.state === "paused"
      ? cycle.remainingAtPause
      : cycle.deadlineAt === null
        ? null
        : Math.max(
            0,
            readTimestamp(cycle.deadlineAt, "FocusCycle.deadlineAt") - nowMs,
          );
    const completedAt = new Date(nowMs).toISOString();
    const updated = this.#database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'stopped',
        pause_reason = NULL,
        deadline_at = NULL,
        remaining_at_pause = ?,
        completed_at = ?
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state IN ('running', 'paused')
    `).run(
      completedAt,
      remainingDurationMs,
      completedAt,
      command.focusCycleId,
      command.workId,
      policy.policyId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before stop: ${command.focusCycleId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }
}
