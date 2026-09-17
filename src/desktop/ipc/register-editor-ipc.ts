import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL,
  MANUSCRIPT_EXPORT_TEXT_CHANNEL,
  MANUSCRIPT_FORMATTING_PROFILE_CHANNEL,
  MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
  MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  MANUSCRIPT_MOVE_RANGE_TO_EPISODE_CHANNEL,
  MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
  MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
  MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL,
  MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
  MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
  MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
  MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
  MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL,
  MANUSCRIPT_SAVE_FORMATTING_CHANNEL,
  MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL,
  MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
  MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_UNDO_MOVE_RANGE_TO_EPISODE_CHANNEL,
  parseManuscriptCloseResult,
  type ManuscriptCloseResult,
} from "../../application/contracts/studio-bridge";
import type { ManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import type { ManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import type {
  ManuscriptFormattingProfile,
  SaveManuscriptFormattingReceipt,
} from "../../application/editor/manuscript-formatting";
import {
  parseExportManuscriptTextCommand,
  parseGetManuscriptPreflightSettingsCommand,
  parseSaveManuscriptPreflightSettingsCommand,
  type ExportManuscriptTextCommand,
  type ExportManuscriptTextResult,
  type GetManuscriptPreflightSettingsCommand,
  type ManuscriptPreflightProfile,
  type ManuscriptPreflightSettingsProjection,
  type SaveManuscriptPreflightSettingsCommand,
} from "../../application/editor/manuscript-preflight";
import {
  parseSelectManuscriptTextImportCommand,
  type ManuscriptTextImportResult,
  type SelectManuscriptTextImportCommand,
} from "../../application/editor/manuscript-text-import";
import {
  parseGetContinuousReadingProgressCommand,
  parseSaveContinuousReadingProgressCommand,
  type GetContinuousReadingProgressCommand,
  type SaveContinuousReadingProgressCommand,
  type WorkContinuousReadingProgressProjection,
} from "../../application/editor/continuous-reading-progress";
import type { WorkManuscriptLayoutSettingsProjection } from "../../application/editor/work-manuscript-layout-settings";
import type { ManuscriptPersistenceProfile } from "../../application/persistence/manuscript-persistence-profile";
import type { SaveReceipt } from "../../application/persistence/save-change-batch";
import type {
  ApplyStartupRecoveryAcknowledgement,
  StartupRecoveryProjection,
} from "../../application/persistence/startup-recovery-contract";
import type { ManuscriptResumeCheckpointProjection } from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { MoveRangeToEpisodeReceipt } from "../../application/editor/move-range-to-episode";

export type EditorIpcRuntime = Readonly<{
  getManuscriptDocumentProfile: () => ManuscriptDocumentProfile;
  getManuscriptPersistenceProfile: () => ManuscriptPersistenceProfile | null;
  getManuscriptStartupRecovery: () => StartupRecoveryProjection;
  getManuscriptResumeCheckpoint: () => ManuscriptResumeCheckpointProjection;
  getManuscriptPreflightSettings: (
    command: GetManuscriptPreflightSettingsCommand,
  ) => Promise<ManuscriptPreflightSettingsProjection>;
  saveManuscriptPreflightSettings: (
    command: SaveManuscriptPreflightSettingsCommand,
  ) => Promise<ManuscriptPreflightSettingsProjection>;
  getContinuousReadingProgress: (
    command: GetContinuousReadingProgressCommand,
  ) => Promise<WorkContinuousReadingProgressProjection>;
  saveContinuousReadingProgress: (
    command: SaveContinuousReadingProgressCommand,
  ) => Promise<WorkContinuousReadingProgressProjection>;
  saveChangeBatch: (value: unknown) => Promise<SaveReceipt>;
  saveDocumentChange: (value: unknown) => Promise<SaveReceipt>;
  saveFormatting: (value: unknown) => Promise<SaveManuscriptFormattingReceipt>;
  moveRangeToEpisode: (value: unknown) => Promise<MoveRangeToEpisodeReceipt>;
  undoMoveRangeToEpisode: (value: unknown) => Promise<MoveRangeToEpisodeReceipt>;
  getWorkManuscriptLayoutSettings: (
    value: unknown,
  ) => Promise<WorkManuscriptLayoutSettingsProjection>;
  saveWorkManuscriptLayoutSettings: (
    value: unknown,
  ) => Promise<WorkManuscriptLayoutSettingsProjection>;
  applyManuscriptStartupRecovery: (
    value: unknown,
  ) => Promise<ApplyStartupRecoveryAcknowledgement>;
}>;

export function registerEditorIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: EditorIpcRuntime;
  profiles: Readonly<{
    input: ManuscriptInputProfile;
    formatting: ManuscriptFormattingProfile;
    preflight: ManuscriptPreflightProfile;
  }>;
  exportText: (
    command: ExportManuscriptTextCommand,
  ) => Promise<ExportManuscriptTextResult>;
  selectTextImport: (
    command: SelectManuscriptTextImportCommand,
  ) => Promise<ManuscriptTextImportResult>;
  completeCloseRequest: (
    result: ManuscriptCloseResult,
  ) => Promise<ManuscriptCloseResult> | ManuscriptCloseResult;
}>): void {
  input.ipcMain.handle(MANUSCRIPT_INPUT_PROFILE_CHANNEL, () =>
    input.profiles.input);
  input.ipcMain.handle(MANUSCRIPT_FORMATTING_PROFILE_CHANNEL, () =>
    input.profiles.formatting);
  input.ipcMain.handle(MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL, () =>
    input.profiles.preflight);
  input.ipcMain.handle(MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL, () =>
    input.runtime.getManuscriptDocumentProfile());
  input.ipcMain.handle(MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL, () =>
    input.runtime.getManuscriptPersistenceProfile());
  input.ipcMain.handle(MANUSCRIPT_STARTUP_RECOVERY_CHANNEL, () =>
    input.runtime.getManuscriptStartupRecovery());
  input.ipcMain.handle(MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL, () =>
    input.runtime.getManuscriptResumeCheckpoint());

  input.ipcMain.handle(
    MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.getManuscriptPreflightSettings(
        parseGetManuscriptPreflightSettingsCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.saveManuscriptPreflightSettings(
        parseSaveManuscriptPreflightSettingsCommand(
          value,
          input.profiles.preflight,
        ),
      );
    },
  );
  input.ipcMain.handle(MANUSCRIPT_EXPORT_TEXT_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.exportText(parseExportManuscriptTextCommand(value));
  });
  input.ipcMain.handle(
    MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.selectTextImport(parseSelectManuscriptTextImportCommand(value));
    },
  );
  input.ipcMain.handle(
    MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.getContinuousReadingProgress(
        parseGetContinuousReadingProgressCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.saveContinuousReadingProgress(
        parseSaveContinuousReadingProgressCommand(value),
      );
    },
  );

  const rawHandle = (
    channel: string,
    run: (value: unknown) => Promise<unknown>,
  ): void => {
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(value);
    });
  };
  rawHandle(MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
    (value) => input.runtime.saveChangeBatch(value));
  rawHandle(MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL,
    (value) => input.runtime.saveDocumentChange(value));
  rawHandle(MANUSCRIPT_SAVE_FORMATTING_CHANNEL,
    (value) => input.runtime.saveFormatting(value));
  rawHandle(MANUSCRIPT_MOVE_RANGE_TO_EPISODE_CHANNEL,
    (value) => input.runtime.moveRangeToEpisode(value));
  rawHandle(MANUSCRIPT_UNDO_MOVE_RANGE_TO_EPISODE_CHANNEL,
    (value) => input.runtime.undoMoveRangeToEpisode(value));
  rawHandle(MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL,
    (value) => input.runtime.getWorkManuscriptLayoutSettings(value));
  rawHandle(MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL,
    (value) => input.runtime.saveWorkManuscriptLayoutSettings(value));
  rawHandle(MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
    (value) => input.runtime.applyManuscriptStartupRecovery(value));

  input.ipcMain.handle(
    MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.completeCloseRequest(parseManuscriptCloseResult(value));
    },
  );
}
