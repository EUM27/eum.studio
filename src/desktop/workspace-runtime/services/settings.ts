import type { SaveWorkReadthroughCommand,WorkReadthroughProjection } from "../../../application/activity/work-readthrough-calculator";
import { createUnsetWorkReadthrough,parseGetWorkReadthroughCommand,parseSaveWorkReadthroughCommand,parseWorkReadthroughProjection } from "../../../application/activity/work-readthrough-calculator";
import type { SaveWorkRecordsGoalsCommand,WorkRecordsGoalsProjection } from "../../../application/activity/work-records-preferences";
import { createUnsetWorkRecordsGoals,parseGetWorkRecordsGoalsCommand,parseSaveWorkRecordsGoalsCommand,parseWorkRecordsGoals,parseWorkRecordsGoalsProjection } from "../../../application/activity/work-records-preferences";
import type { SaveContinuousReadingProgressCommand,WorkContinuousReadingProgressProjection } from "../../../application/editor/continuous-reading-progress";
import { createUnsetContinuousReadingProgress,parseGetContinuousReadingProgressCommand,parseSaveContinuousReadingProgressCommand,parseWorkContinuousReadingProgressProjection,splitContinuousReadingLines } from "../../../application/editor/continuous-reading-progress";
import { parseManuscriptEditorDocumentState } from "../../../application/editor/manuscript-formatting";
import type { ManuscriptPreflightProfile,ManuscriptPreflightSettingsProjection } from "../../../application/editor/manuscript-preflight";
import { createDefaultManuscriptPreflightSettings,parseGetManuscriptPreflightSettingsCommand,parseManuscriptPreflightSettings,parseManuscriptPreflightSettingsProjection,parseSaveManuscriptPreflightSettingsCommand } from "../../../application/editor/manuscript-preflight";
import type { SaveWorkManuscriptLayoutSettingsCommand,WorkManuscriptLayoutSettingsProjection } from "../../../application/editor/work-manuscript-layout-settings";
import { createDefaultWorkManuscriptLayoutSettingsProjection,parseGetWorkManuscriptLayoutSettingsCommand,parseManuscriptLayoutSettings,parseSaveWorkManuscriptLayoutSettingsCommand,parseWorkManuscriptLayoutSettingsProjection,readManuscriptLayoutSettings } from "../../../application/editor/work-manuscript-layout-settings";
import type { SaveWorkInspirationSettingsCommand,WorkInspirationSettingsProjection } from "../../../application/inspiration/work-inspiration-settings";
import { createDefaultWorkInspirationSettingsProjection,parseGetWorkInspirationSettingsCommand,parseSaveWorkInspirationSettingsCommand,parseWorkInspirationSettings,parseWorkInspirationSettingsProjection } from "../../../application/inspiration/work-inspiration-settings";
import type { SaveWorkQuickMemoCommand,WorkQuickMemoProjection } from "../../../application/quick-tools/work-quick-memo";
import { parseGetWorkQuickMemoCommand,parseSaveWorkQuickMemoCommand,parseWorkQuickMemoProjection } from "../../../application/quick-tools/work-quick-memo";
import type { AppSettingsProjection,SaveAppSettingsCommand } from "../../../application/settings/app-settings";
import { createDefaultAppSettingsProjection,parseAppSettingsProjection,parseSaveAppSettingsCommand } from "../../../application/settings/app-settings";
import type { EntityId } from "../../../domain/writing";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { readNullableIdentity,readRequiredInteger,readRequiredString,readString } from "../repositories/scalars";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns settings commands and their existing transaction boundaries. */
export class SettingsService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "preflightProfile" | "appSettingsProfile" | "formattingProfile">;
  readonly #database: NodeSqliteDatabase;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "preflightProfile" | "appSettingsProfile" | "formattingProfile">;
    readonly database: NodeSqliteDatabase;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#database = input.database;
    this.#infrastructure = input.infrastructure;
  }

  #getPreflightProfile(): ManuscriptPreflightProfile {
    const profile = this.#options.preflightProfile;
    if (profile === undefined) {
      throw new Error("Manuscript preflight profile is not configured");
    }
    return profile;
  }

  getContinuousReadingProgress(
    value: unknown,
  ): Promise<WorkContinuousReadingProgressProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetContinuousReadingProgressCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getContinuousReadingProgressSerially(command.workId),
    );
  }

  saveContinuousReadingProgress(
    value: unknown,
  ): Promise<WorkContinuousReadingProgressProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveContinuousReadingProgressCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveContinuousReadingProgressSerially(command);
    });

    return execution;
  }

  getWorkRecordsGoals(value: unknown): Promise<WorkRecordsGoalsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkRecordsGoalsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkRecordsGoalsSerially(command.workId),
    );
  }

  saveWorkRecordsGoals(value: unknown): Promise<WorkRecordsGoalsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkRecordsGoalsCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkRecordsGoalsSerially(command);
    });

    return execution;
  }

  getWorkReadthrough(value: unknown): Promise<WorkReadthroughProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkReadthroughCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkReadthroughSerially(command.workId),
    );
  }

  saveWorkReadthrough(value: unknown): Promise<WorkReadthroughProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkReadthroughCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkReadthroughSerially(command);
    });

    return execution;
  }

  getAppSettings(): Promise<AppSettingsProjection> {
    this.#infrastructure.assertOpen();
    return this.#operations.readBarrier().then(() =>
      this.getAppSettingsSerially(),
    );
  }

  saveAppSettings(value: unknown): Promise<AppSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveAppSettingsCommand(
      value,
      this.#options.appSettingsProfile,
    );
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveAppSettingsSerially(command);
    });

    return execution;
  }

  getWorkManuscriptLayoutSettings(
    value: unknown,
  ): Promise<WorkManuscriptLayoutSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkManuscriptLayoutSettingsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkManuscriptLayoutSettingsSerially(command.workId),
    );
  }

  saveWorkManuscriptLayoutSettings(
    value: unknown,
  ): Promise<WorkManuscriptLayoutSettingsProjection> {
    this.#infrastructure.assertOpen();
    const parsed = parseSaveWorkManuscriptLayoutSettingsCommand(value);
    const command: SaveWorkManuscriptLayoutSettingsCommand = Object.freeze({
      ...parsed,
      settings: parseManuscriptLayoutSettings(
        parsed.settings,
        this.#options.formattingProfile,
      ),
    });
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkManuscriptLayoutSettingsSerially(command);
    });

    return execution;
  }

  getWorkInspirationSettings(
    value: unknown,
  ): Promise<WorkInspirationSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkInspirationSettingsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkInspirationSettingsSerially(command.workId),
    );
  }

  saveWorkInspirationSettings(
    value: unknown,
  ): Promise<WorkInspirationSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkInspirationSettingsCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkInspirationSettingsSerially(command);
    });

    return execution;
  }

  getWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkQuickMemoCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkQuickMemoSerially(command.workId),
    );
  }

  saveWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkQuickMemoCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkQuickMemoSerially(command);
    });

    return execution;
  }

  getManuscriptPreflightSettings(
    value: unknown,
  ): Promise<ManuscriptPreflightSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetManuscriptPreflightSettingsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.getManuscriptPreflightSettingsSerially(command.workId),
    );
  }

  saveManuscriptPreflightSettings(
    value: unknown,
  ): Promise<ManuscriptPreflightSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveManuscriptPreflightSettingsCommand(
      value,
      this.#getPreflightProfile(),
    );
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveManuscriptPreflightSettingsSerially(command);
    });

    return execution;
  }

  #getWorkQuickMemoSerially(
    workId: EntityId<"Work">,
  ): WorkQuickMemoProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          memo_text AS "text",
          updated_at AS "updatedAt"
        FROM work_quick_memos
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkQuickMemoProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        text: "",
        updatedAt: null,
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Work quick memo identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    return parseWorkQuickMemoProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work quick memo row",
      ),
      workId,
      revision: readRequiredInteger(row, "revision", "Work quick memo row"),
      text: readString(row, "text", "Work quick memo row"),
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work quick memo row",
      ),
    });
  }

  #deriveWorkManuscriptLayoutSettings(
    workId: EntityId<"Work">,
  ): WorkManuscriptLayoutSettingsProjection {
    const defaults = createDefaultWorkManuscriptLayoutSettingsProjection(
      workId,
      this.#options.formattingProfile,
    );
    const workDocuments = this.#state.documentProfile.documents.filter(
      (document) => document.workId === workId,
    );
    const activeDocument =
      this.#state.catalog.activeWorkId === workId &&
      this.#state.catalog.activeDocumentId !== null
        ? workDocuments.find(
            (document) =>
              document.documentId === this.#state.catalog.activeDocumentId,
          )
        : undefined;
    const source = activeDocument?.editorStateJson === undefined
      ? workDocuments.find((document) => document.editorStateJson !== undefined)
      : activeDocument;
    if (source?.editorStateJson === undefined) return defaults;
    const state = parseManuscriptEditorDocumentState(
      JSON.parse(source.editorStateJson),
      this.#options.formattingProfile,
      source.initialText.length,
    );
    return Object.freeze({
      ...defaults,
      settings: readManuscriptLayoutSettings(state),
    });
  }

  #getWorkManuscriptLayoutSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkManuscriptLayoutSettingsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT
        schema_version AS "schemaVersion",
        revision,
        settings_json AS "settingsJson"
      FROM work_manuscript_layout_settings
      WHERE work_id = ?
    `).all(workId);
    if (rows.length === 0) {
      return this.#deriveWorkManuscriptLayoutSettings(workId);
    }
    if (rows.length !== 1) {
      throw new Error(`Work manuscript layout identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const settings = parseManuscriptLayoutSettings(
      JSON.parse(
        readRequiredString(
          row,
          "settingsJson",
          "Work manuscript layout settings row",
        ),
      ),
      this.#options.formattingProfile,
    );
    return parseWorkManuscriptLayoutSettingsProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work manuscript layout settings row",
      ),
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work manuscript layout settings row",
      ),
      settings,
    });
  }

  #saveWorkManuscriptLayoutSettingsSerially(
    command: SaveWorkManuscriptLayoutSettingsCommand,
  ): WorkManuscriptLayoutSettingsProjection {
    const current = this.#getWorkManuscriptLayoutSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work manuscript layout revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const nextRevision = current.revision + 1;
    const updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(command.settings);
    if (current.revision === 0) {
      this.#database.prepare(`
        INSERT INTO work_manuscript_layout_settings (
          work_id,
          schema_version,
          revision,
          settings_json,
          updated_at
        ) VALUES (?, 1, ?, ?, ?)
      `).run(command.workId, nextRevision, serialized, updatedAt);
    } else {
      const updated = this.#database.prepare(`
        UPDATE work_manuscript_layout_settings
        SET revision = ?, settings_json = ?, updated_at = ?
        WHERE work_id = ? AND revision = ?
      `).run(
        nextRevision,
        serialized,
        updatedAt,
        command.workId,
        command.expectedRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error("Work manuscript layout changed before save completed");
      }
    }
    return this.#getWorkManuscriptLayoutSettingsSerially(command.workId);
  }

  getAppSettingsSerially(): AppSettingsProjection {
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          default_episode_characters AS "defaultEpisodeCharacters",
          updated_at AS "updatedAt"
        FROM app_settings
        WHERE singleton = 1
      `)
      .all();
    if (rows.length === 0) {
      return createDefaultAppSettingsProjection(
        this.#options.appSettingsProfile,
      );
    }
    if (rows.length !== 1) {
      throw new Error("App settings identity is ambiguous");
    }
    const row = rows[0] ?? {};
    return parseAppSettingsProjection(
      {
        schemaVersion: readRequiredInteger(
          row,
          "schemaVersion",
          "App settings row",
        ),
        revision: readRequiredInteger(row, "revision", "App settings row"),
        settings: {
          defaultEpisodeCharacters: readRequiredInteger(
            row,
            "defaultEpisodeCharacters",
            "App settings row",
          ),
        },
        updatedAt: readRequiredString(row, "updatedAt", "App settings row"),
      },
      this.#options.appSettingsProfile,
    );
  }

  #saveAppSettingsSerially(
    command: SaveAppSettingsCommand,
  ): AppSettingsProjection {
    const current = this.getAppSettingsSerially();
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `App settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const updatedAt = new Date().toISOString();
    if (current.revision === 0) {
      this.#database
        .prepare(`
          INSERT INTO app_settings (
            singleton,
            schema_version,
            revision,
            default_episode_characters,
            updated_at
          ) VALUES (1, 1, 1, ?, ?)
        `)
        .run(command.settings.defaultEpisodeCharacters, updatedAt);
    } else {
      const updated = this.#database
        .prepare(`
          UPDATE app_settings
          SET
            revision = revision + 1,
            default_episode_characters = ?,
            updated_at = ?
          WHERE singleton = 1 AND revision = ?
        `)
        .run(
          command.settings.defaultEpisodeCharacters,
          updatedAt,
          command.expectedRevision,
        );
      if (Number(updated.changes) !== 1) {
        throw new Error("App settings changed before the save completed");
      }
    }
    return this.getAppSettingsSerially();
  }

  #getWorkInspirationSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkInspirationSettingsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT
        schema_version AS "schemaVersion",
        revision,
        settings_json AS "settingsJson",
        updated_at AS "updatedAt"
      FROM work_inspiration_settings
      WHERE work_id = ?
    `).all(workId);
    if (rows.length === 0) {
      return createDefaultWorkInspirationSettingsProjection(workId);
    }
    if (rows.length !== 1) {
      throw new Error(`Work inspiration settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    return parseWorkInspirationSettingsProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work inspiration settings row",
      ),
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work inspiration settings row",
      ),
      settings: parseWorkInspirationSettings(JSON.parse(readRequiredString(
        row,
        "settingsJson",
        "Work inspiration settings row",
      ))),
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work inspiration settings row",
      ),
    });
  }

  #saveWorkInspirationSettingsSerially(
    command: SaveWorkInspirationSettingsCommand,
  ): WorkInspirationSettingsProjection {
    const current = this.#getWorkInspirationSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work inspiration settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const updatedAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const updated = this.#database.prepare(`
      INSERT INTO work_inspiration_settings (
        work_id,
        schema_version,
        revision,
        settings_json,
        updated_at
      ) VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(work_id) DO UPDATE SET
        revision = excluded.revision,
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
      WHERE work_inspiration_settings.revision = ?
    `).run(
      command.workId,
      nextRevision,
      JSON.stringify(command.settings),
      updatedAt,
      command.expectedRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(
        `Work inspiration settings changed before save: ${command.workId}`,
      );
    }
    return this.#getWorkInspirationSettingsSerially(command.workId);
  }

  #saveWorkQuickMemoSerially(
    command: SaveWorkQuickMemoCommand,
  ): WorkQuickMemoProjection {
    const current = this.#getWorkQuickMemoSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work quick memo revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (command.text === "") {
      if (current.revision === 0) return current;
      const removed = this.#database
        .prepare(`
          DELETE FROM work_quick_memos
          WHERE work_id = ? AND revision = ?
        `)
        .run(command.workId, command.expectedRevision);
      if (Number(removed.changes) !== 1) {
        throw new Error(`Work quick memo changed: ${command.workId}`);
      }
      return this.#getWorkQuickMemoSerially(command.workId);
    }
    const updatedAt = new Date().toISOString();
    if (current.revision === 0) {
      this.#database
        .prepare(`
          INSERT INTO work_quick_memos (
            work_id,
            schema_version,
            revision,
            memo_text,
            updated_at
          ) VALUES (?, 1, 1, ?, ?)
        `)
        .run(command.workId, command.text, updatedAt);
    } else {
      const updated = this.#database
        .prepare(`
          UPDATE work_quick_memos
          SET revision = revision + 1, memo_text = ?, updated_at = ?
          WHERE work_id = ? AND revision = ?
        `)
        .run(
          command.text,
          updatedAt,
          command.workId,
          command.expectedRevision,
        );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work quick memo changed: ${command.workId}`);
      }
    }
    return this.#getWorkQuickMemoSerially(command.workId);
  }

  #getWorkRecordsGoalsSerially(
    workId: EntityId<"Work">,
  ): WorkRecordsGoalsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          goals_json AS "goalsJson"
        FROM work_records_goals
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkRecordsGoalsProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        goals: createUnsetWorkRecordsGoals(),
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Work records goals identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Work records goals row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Work records goals schemaVersion must be 1");
    }
    return parseWorkRecordsGoalsProjection({
      schemaVersion,
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work records goals row",
      ),
      goals: parseWorkRecordsGoals(
        JSON.parse(
          readRequiredString(
            row,
            "goalsJson",
            "Work records goals row",
          ),
        ),
      ),
    });
  }

  #saveWorkRecordsGoalsSerially(
    command: SaveWorkRecordsGoalsCommand,
  ): WorkRecordsGoalsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const serializedGoals = JSON.stringify(command.goals);
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const currentRows = this.#database
        .prepare(`
          SELECT revision
          FROM work_records_goals
          WHERE work_id = ?
        `)
        .all(command.workId);
      if (currentRows.length > 1) {
        throw new Error(
          `Work records goals identity is ambiguous: ${command.workId}`,
        );
      }
      const currentRevision =
        currentRows.length === 0
          ? 0
          : readRequiredInteger(
              currentRows[0] ?? {},
              "revision",
              "Work records goals row",
            );
      if (currentRevision !== command.expectedRevision) {
        throw new Error(
          `Work records goals revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
        );
      }
      if (currentRevision === 0) {
        this.#database
          .prepare(`
            INSERT INTO work_records_goals (
              work_id,
              schema_version,
              revision,
              goals_json,
              updated_at
            ) VALUES (?, 1, 1, ?, ?)
          `)
          .run(command.workId, serializedGoals, updatedAt);
      } else {
        this.#database
          .prepare(`
            UPDATE work_records_goals
            SET
              revision = revision + 1,
              goals_json = ?,
              updated_at = ?
            WHERE work_id = ?
          `)
          .run(serializedGoals, updatedAt, command.workId);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getWorkRecordsGoalsSerially(command.workId);
  }

  #getContinuousReadingProgressSerially(
    workId: EntityId<"Work">,
  ): WorkContinuousReadingProgressProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          document_id AS "documentId",
          document_revision_id AS "documentRevisionId",
          text_offset AS "textOffset"
        FROM work_continuous_reading_progress
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkContinuousReadingProgressProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        location: createUnsetContinuousReadingProgress(),
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Continuous reading progress identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Continuous reading progress row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Continuous reading progress schemaVersion must be 1");
    }
    const documentId = readNullableIdentity<"Document">(
      row,
      "documentId",
      "Continuous reading progress row",
    );
    const documentRevisionId = readNullableIdentity<"DocumentRevision">(
      row,
      "documentRevisionId",
      "Continuous reading progress row",
    );
    const textOffsetValue = row.textOffset;
    if (
      (textOffsetValue !== null &&
        (!Number.isSafeInteger(textOffsetValue) || (textOffsetValue as number) < 0)) ||
      ((documentId === null || documentRevisionId === null) !==
        (textOffsetValue === null)) ||
      ((documentId === null) !== (documentRevisionId === null))
    ) {
      throw new Error("Continuous reading progress row location is invalid");
    }
    return parseWorkContinuousReadingProgressProjection({
      schemaVersion,
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Continuous reading progress row",
      ),
      location:
        documentId === null ||
        documentRevisionId === null ||
        textOffsetValue === null
          ? null
          : {
              documentId,
              documentRevisionId,
              textOffset: textOffsetValue,
            },
    });
  }

  #saveContinuousReadingProgressSerially(
    command: SaveContinuousReadingProgressCommand,
  ): WorkContinuousReadingProgressProjection {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (command.location !== null) {
      const document = work.documents.find(
        (candidate) => candidate.documentId === command.location?.documentId,
      );
      if (document === undefined) {
        throw new Error(
          `Continuous reading Document is outside Work: ${command.location.documentId}`,
        );
      }
      const source = this.#state.documentProfile.documents.find(
        (candidate) => candidate.documentId === document.documentId,
      );
      if (
        source === undefined ||
        source.documentRevisionId !== command.location.documentRevisionId ||
        !splitContinuousReadingLines(source.initialText).some(
          (line) => line.textOffset === command.location?.textOffset,
        )
      ) {
        throw new Error(
          `Continuous reading text offset is stale for Document ${document.documentId}`,
        );
      }
    }

    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const currentRows = this.#database
        .prepare(`
          SELECT revision
          FROM work_continuous_reading_progress
          WHERE work_id = ?
        `)
        .all(command.workId);
      if (currentRows.length > 1) {
        throw new Error(
          `Continuous reading progress identity is ambiguous: ${command.workId}`,
        );
      }
      const currentRevision =
        currentRows.length === 0
          ? 0
          : readRequiredInteger(
              currentRows[0] ?? {},
              "revision",
              "Continuous reading progress row",
            );
      if (currentRevision !== command.expectedRevision) {
        throw new Error(
          `Continuous reading progress revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
        );
      }
      const location = command.location;
      if (currentRevision === 0) {
        this.#database
          .prepare(`
            INSERT INTO work_continuous_reading_progress (
              work_id,
              schema_version,
              revision,
              document_id,
              document_revision_id,
              text_offset,
              updated_at
            ) VALUES (?, 1, 1, ?, ?, ?, ?)
          `)
          .run(
            command.workId,
            location?.documentId ?? null,
            location?.documentRevisionId ?? null,
            location?.textOffset ?? null,
            updatedAt,
          );
      } else {
        this.#database
          .prepare(`
            UPDATE work_continuous_reading_progress
            SET
              revision = revision + 1,
              document_id = ?,
              document_revision_id = ?,
              text_offset = ?,
              updated_at = ?
            WHERE work_id = ?
          `)
          .run(
            location?.documentId ?? null,
            location?.documentRevisionId ?? null,
            location?.textOffset ?? null,
            updatedAt,
            command.workId,
          );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getContinuousReadingProgressSerially(command.workId);
  }

  #getWorkReadthroughSerially(
    workId: EntityId<"Work">,
  ): WorkReadthroughProjection {
    const work = this.#state.catalog.works.find((candidate) => candidate.workId === workId);
    if (work === undefined) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          entries_json AS "entriesJson"
        FROM work_readthrough_settings
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkReadthroughProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        entries: createUnsetWorkReadthrough(),
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Work readthrough identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Work readthrough row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Work readthrough schemaVersion must be 1");
    }
    const projection = parseWorkReadthroughProjection({
      schemaVersion,
      workId,
      revision: readRequiredInteger(row, "revision", "Work readthrough row"),
      entries: JSON.parse(
        readRequiredString(row, "entriesJson", "Work readthrough row"),
      ),
    });
    const ownedDocumentIds = new Set(
      work.documents.map((document) => document.documentId),
    );
    for (const entry of projection.entries) {
      if (!ownedDocumentIds.has(entry.documentId)) {
        throw new Error(
          `Work readthrough Document is outside Work: ${entry.documentId}`,
        );
      }
    }
    return projection;
  }

  #saveWorkReadthroughSerially(
    command: SaveWorkReadthroughCommand,
  ): WorkReadthroughProjection {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const ownedDocumentIds = new Set(
      work.documents.map((document) => document.documentId),
    );
    for (const entry of command.entries) {
      if (!ownedDocumentIds.has(entry.documentId)) {
        throw new Error(
          `Work readthrough Document is outside Work: ${entry.documentId}`,
        );
      }
    }

    const serializedEntries = JSON.stringify(command.entries);
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const currentRows = this.#database
        .prepare(`
          SELECT revision
          FROM work_readthrough_settings
          WHERE work_id = ?
        `)
        .all(command.workId);
      if (currentRows.length > 1) {
        throw new Error(
          `Work readthrough identity is ambiguous: ${command.workId}`,
        );
      }
      const currentRevision =
        currentRows.length === 0
          ? 0
          : readRequiredInteger(
              currentRows[0] ?? {},
              "revision",
              "Work readthrough row",
            );
      if (currentRevision !== command.expectedRevision) {
        throw new Error(
          `Work readthrough revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
        );
      }
      if (currentRevision === 0) {
        this.#database
          .prepare(`
            INSERT INTO work_readthrough_settings (
              work_id,
              schema_version,
              revision,
              entries_json,
              updated_at
            ) VALUES (?, 1, 1, ?, ?)
          `)
          .run(command.workId, serializedEntries, updatedAt);
      } else {
        this.#database
          .prepare(`
            UPDATE work_readthrough_settings
            SET
              revision = revision + 1,
              entries_json = ?,
              updated_at = ?
            WHERE work_id = ?
          `)
          .run(serializedEntries, updatedAt, command.workId);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getWorkReadthroughSerially(command.workId);
  }

  getManuscriptPreflightSettingsSerially(
    workId: EntityId<"Work">,
  ): ManuscriptPreflightSettingsProjection {
    const preflightProfile = this.#getPreflightProfile();
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          settings_json AS "settingsJson"
        FROM manuscript_preflight_settings
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseManuscriptPreflightSettingsProjection(
        {
          schemaVersion: 1,
          workId,
          revision: 0,
          settings: createDefaultManuscriptPreflightSettings(
            preflightProfile,
          ),
        },
        preflightProfile,
      );
    }
    if (rows.length !== 1) {
      throw new Error(`Preflight settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Manuscript preflight settings row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Manuscript preflight settings schemaVersion must be 1");
    }
    const settingsJson = readRequiredString(
      row,
      "settingsJson",
      "Manuscript preflight settings row",
    );
    return parseManuscriptPreflightSettingsProjection(
      {
        schemaVersion,
        workId,
        revision: readRequiredInteger(
          row,
          "revision",
          "Manuscript preflight settings row",
        ),
        settings: parseManuscriptPreflightSettings(
          JSON.parse(settingsJson),
          preflightProfile,
        ),
      },
      preflightProfile,
    );
  }

  #saveManuscriptPreflightSettingsSerially(
    command: ReturnType<typeof parseSaveManuscriptPreflightSettingsCommand>,
  ): ManuscriptPreflightSettingsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const serializedSettings = JSON.stringify(command.settings);
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO manuscript_preflight_settings (
            work_id,
            schema_version,
            revision,
            settings_json,
            updated_at
          ) VALUES (?, 1, 1, ?, ?)
          ON CONFLICT(work_id) DO UPDATE SET
            revision = manuscript_preflight_settings.revision + 1,
            settings_json = excluded.settings_json,
            updated_at = excluded.updated_at
        `)
        .run(command.workId, serializedSettings, updatedAt);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.getManuscriptPreflightSettingsSerially(command.workId);
  }
}

