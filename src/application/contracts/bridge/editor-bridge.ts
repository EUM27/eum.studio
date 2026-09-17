import {
  parseManuscriptInputProfile,
  type ManuscriptInputProfile,
} from "../../editor/manuscript-input-profile";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../../editor/manuscript-document-profile";
import {
  parseManuscriptFormattingProfile,
  parseSaveManuscriptDocumentChangeCommand,
  parseSaveManuscriptFormattingCommand,
  parseSaveManuscriptFormattingReceipt,
  type ManuscriptFormattingProfile,
  type SaveManuscriptDocumentChangeCommand,
  type SaveManuscriptFormattingCommand,
  type SaveManuscriptFormattingReceipt,
} from "../../editor/manuscript-formatting";
import {
  parseGetWorkManuscriptLayoutSettingsCommand,
  parseSaveWorkManuscriptLayoutSettingsCommand,
  parseWorkManuscriptLayoutSettingsProjection,
  type GetWorkManuscriptLayoutSettingsCommand,
  type SaveWorkManuscriptLayoutSettingsCommand,
  type WorkManuscriptLayoutSettingsProjection,
} from "../../editor/work-manuscript-layout-settings";
import {
  parseExportManuscriptTextCommand,
  parseExportManuscriptTextResult,
  parseGetManuscriptPreflightSettingsCommand,
  parseManuscriptPreflightProfile,
  parseManuscriptPreflightSettingsProjection,
  parseSaveManuscriptPreflightSettingsCommand,
  type ExportManuscriptTextCommand,
  type ExportManuscriptTextResult,
  type GetManuscriptPreflightSettingsCommand,
  type ManuscriptPreflightProfile,
  type ManuscriptPreflightSettingsProjection,
  type SaveManuscriptPreflightSettingsCommand,
} from "../../editor/manuscript-preflight";
import {
  parseManuscriptTextImportResult,
  parseSelectManuscriptTextImportCommand,
  type ManuscriptTextImportResult,
  type SelectManuscriptTextImportCommand,
} from "../../editor/manuscript-text-import";
import {
  parseGetContinuousReadingProgressCommand,
  parseSaveContinuousReadingProgressCommand,
  parseWorkContinuousReadingProgressProjection,
  type GetContinuousReadingProgressCommand,
  type SaveContinuousReadingProgressCommand,
  type WorkContinuousReadingProgressProjection,
} from "../../editor/continuous-reading-progress";
import { parseChangeBatch, type ChangeBatch } from "../../persistence/change-batch";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptPersistenceProfile,
} from "../../persistence/manuscript-persistence-profile";
import { parseSaveReceipt, type SaveReceipt } from "../../persistence/save-change-batch";
import {
  parseApplyStartupRecoveryAcknowledgement,
  parseApplyStartupRecoveryCommand,
  parseStartupRecoveryProjection,
  type ApplyStartupRecoveryAcknowledgement,
  type ApplyStartupRecoveryCommand,
  type StartupRecoveryProjection,
} from "../../persistence/startup-recovery-contract";
import {
  parseManuscriptResumeCheckpointProjection,
  type ManuscriptResumeCheckpointProjection,
} from "../../checkpoints/manuscript-resume-checkpoint-projection";
import {
  parseMoveRangeToEpisodeCommand,
  parseMoveRangeToEpisodeReceipt,
  parseUndoMoveRangeToEpisodeCommand,
  type MoveRangeToEpisodeCommand,
  type MoveRangeToEpisodeReceipt,
  type UndoMoveRangeToEpisodeCommand,
} from "../../editor/move-range-to-episode";

export const MANUSCRIPT_INPUT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-input-profile";
export const MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-document-profile";
export const MANUSCRIPT_FORMATTING_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-formatting-profile";
export const MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-preflight-profile";
export const MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL =
  "studio:editor:get-manuscript-preflight-settings";
export const MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL =
  "studio:editor:save-manuscript-preflight-settings";
export const MANUSCRIPT_EXPORT_TEXT_CHANNEL =
  "studio:editor:export-manuscript-text";
export const MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL =
  "studio:editor:select-manuscript-text-import";
export const MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL =
  "studio:editor:save-change-batch";
export const MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL =
  "studio:editor:save-document-change";
export const MANUSCRIPT_SAVE_FORMATTING_CHANNEL =
  "studio:editor:save-formatting";
export const MANUSCRIPT_MOVE_RANGE_TO_EPISODE_CHANNEL =
  "studio:editor:move-range-to-episode";
export const MANUSCRIPT_UNDO_MOVE_RANGE_TO_EPISODE_CHANNEL =
  "studio:editor:undo-move-range-to-episode";
export const MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL =
  "studio:editor:get-work-layout-settings";
export const MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL =
  "studio:editor:save-work-layout-settings";
export const MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-persistence-profile";
export const MANUSCRIPT_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:get-manuscript-startup-recovery";
export const MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL =
  "studio:editor:get-manuscript-resume-checkpoint";
export const MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL =
  "studio:editor:get-continuous-reading-progress";
export const MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL =
  "studio:editor:save-continuous-reading-progress";
export const MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:apply-manuscript-startup-recovery";
export const MANUSCRIPT_CLOSE_REQUEST_CHANNEL =
  "studio:editor:manuscript-close-request";
export const MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL =
  "studio:editor:complete-manuscript-close-request";

export type ManuscriptCloseRequest = {
  readonly schemaVersion: 1;
  readonly requestId: string;
};

export type ManuscriptCloseResult = {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly status: "saved" | "failed";
};

export type EditorBridgeChannel =
  | typeof MANUSCRIPT_INPUT_PROFILE_CHANNEL
  | typeof MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL
  | typeof MANUSCRIPT_FORMATTING_PROFILE_CHANNEL
  | typeof MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL
  | typeof MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL
  | typeof MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL
  | typeof MANUSCRIPT_EXPORT_TEXT_CHANNEL
  | typeof MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL
  | typeof MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL
  | typeof MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL
  | typeof MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL
  | typeof MANUSCRIPT_SAVE_FORMATTING_CHANNEL
  | typeof MANUSCRIPT_MOVE_RANGE_TO_EPISODE_CHANNEL
  | typeof MANUSCRIPT_UNDO_MOVE_RANGE_TO_EPISODE_CHANNEL
  | typeof MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL
  | typeof MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL
  | typeof MANUSCRIPT_STARTUP_RECOVERY_CHANNEL
  | typeof MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL
  | typeof MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL
  | typeof MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL
  | typeof MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL
  | typeof MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL;

export type EditorBridgePayload =
  | ChangeBatch
  | SaveManuscriptDocumentChangeCommand
  | SaveManuscriptFormattingCommand
  | MoveRangeToEpisodeCommand
  | UndoMoveRangeToEpisodeCommand
  | GetWorkManuscriptLayoutSettingsCommand
  | SaveWorkManuscriptLayoutSettingsCommand
  | GetManuscriptPreflightSettingsCommand
  | SaveManuscriptPreflightSettingsCommand
  | ExportManuscriptTextCommand
  | SelectManuscriptTextImportCommand
  | ApplyStartupRecoveryCommand
  | ManuscriptCloseResult
  | GetContinuousReadingProgressCommand
  | SaveContinuousReadingProgressCommand;

export type EditorBridge = Readonly<{
  getManuscriptInputProfile: () => Promise<ManuscriptInputProfile>;
  getManuscriptDocumentProfile: () => Promise<ManuscriptDocumentProfile>;
  getManuscriptFormattingProfile: () => Promise<ManuscriptFormattingProfile>;
  getManuscriptPreflightProfile: () => Promise<ManuscriptPreflightProfile>;
  getManuscriptPreflightSettings: (
    command: GetManuscriptPreflightSettingsCommand,
  ) => Promise<ManuscriptPreflightSettingsProjection>;
  saveManuscriptPreflightSettings: (
    command: SaveManuscriptPreflightSettingsCommand,
  ) => Promise<ManuscriptPreflightSettingsProjection>;
  exportManuscriptText: (
    command: ExportManuscriptTextCommand,
  ) => Promise<ExportManuscriptTextResult>;
  selectManuscriptTextImport: (
    command: SelectManuscriptTextImportCommand,
  ) => Promise<ManuscriptTextImportResult>;
  getManuscriptPersistenceProfile: () => Promise<ManuscriptPersistenceProfile | null>;
  getManuscriptStartupRecovery: () => Promise<StartupRecoveryProjection>;
  getManuscriptResumeCheckpoint: () => Promise<ManuscriptResumeCheckpointProjection>;
  getContinuousReadingProgress: (
    command: GetContinuousReadingProgressCommand,
  ) => Promise<WorkContinuousReadingProgressProjection>;
  saveContinuousReadingProgress: (
    command: SaveContinuousReadingProgressCommand,
  ) => Promise<WorkContinuousReadingProgressProjection>;
  saveChangeBatch: (batch: ChangeBatch) => Promise<SaveReceipt>;
  saveDocumentChange: (
    command: SaveManuscriptDocumentChangeCommand,
  ) => Promise<SaveReceipt>;
  saveFormatting: (
    command: SaveManuscriptFormattingCommand,
  ) => Promise<SaveManuscriptFormattingReceipt>;
  moveRangeToEpisode: (
    command: MoveRangeToEpisodeCommand,
  ) => Promise<MoveRangeToEpisodeReceipt>;
  undoMoveRangeToEpisode: (
    command: UndoMoveRangeToEpisodeCommand,
  ) => Promise<MoveRangeToEpisodeReceipt>;
  getWorkManuscriptLayoutSettings: (
    command: GetWorkManuscriptLayoutSettingsCommand,
  ) => Promise<WorkManuscriptLayoutSettingsProjection>;
  saveWorkManuscriptLayoutSettings: (
    command: SaveWorkManuscriptLayoutSettingsCommand,
  ) => Promise<WorkManuscriptLayoutSettingsProjection>;
  applyManuscriptStartupRecovery: (
    command: ApplyStartupRecoveryCommand,
  ) => Promise<ApplyStartupRecoveryAcknowledgement>;
  onManuscriptCloseRequest: (
    listener: (request: ManuscriptCloseRequest) => void,
  ) => () => void;
  completeManuscriptCloseRequest: (
    result: ManuscriptCloseResult,
  ) => Promise<ManuscriptCloseResult>;
}>;

export type EditorBridgeInvoke = (
  channel: EditorBridgeChannel,
  payload?: EditorBridgePayload,
) => Promise<unknown>;

export type BridgeListen = (
  channel: typeof MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  listener: (payload: unknown) => void,
) => () => void;

function parseCloseContractRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${recordName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertCloseContractFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  recordName: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(`Unsupported ${recordName} field: ${field}`);
    }
  }
}

function parseCloseRequestId(value: unknown, recordName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${recordName}.requestId must be a non-empty string`);
  }
  return value;
}

export function parseManuscriptCloseRequest(
  value: unknown,
): ManuscriptCloseRequest {
  const input = parseCloseContractRecord(value, "ManuscriptCloseRequest");
  assertCloseContractFields(
    input,
    ["schemaVersion", "requestId"],
    "ManuscriptCloseRequest",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ManuscriptCloseRequest schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(input.requestId, "ManuscriptCloseRequest"),
  });
}

export function parseManuscriptCloseResult(
  value: unknown,
): ManuscriptCloseResult {
  const input = parseCloseContractRecord(value, "ManuscriptCloseResult");
  assertCloseContractFields(
    input,
    ["schemaVersion", "requestId", "status"],
    "ManuscriptCloseResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ManuscriptCloseResult schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }
  if (input.status !== "saved" && input.status !== "failed") {
    throw new Error(
      `Unsupported ManuscriptCloseResult status: ${String(input.status)}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(input.requestId, "ManuscriptCloseResult"),
    status: input.status,
  });
}

export function createEditorBridge(
  invoke: EditorBridgeInvoke,
  listen: BridgeListen,
): EditorBridge {
  return Object.freeze({
    getManuscriptInputProfile: async () => {
      const value = await invoke(MANUSCRIPT_INPUT_PROFILE_CHANNEL);
      try {
        return parseManuscriptInputProfile(value);
      } catch {
        throw new Error("Invalid manuscript input profile");
      }
    },
    getManuscriptDocumentProfile: async () => {
      const value = await invoke(MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL);
      try {
        return parseManuscriptDocumentProfile(value);
      } catch {
        throw new Error("Invalid manuscript document profile");
      }
    },
    getManuscriptFormattingProfile: async () => {
      const value = await invoke(MANUSCRIPT_FORMATTING_PROFILE_CHANNEL);
      try {
        return parseManuscriptFormattingProfile(value);
      } catch {
        throw new Error("Invalid manuscript formatting profile");
      }
    },
    getManuscriptPreflightProfile: async () => {
      const value = await invoke(MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL);
      try {
        return parseManuscriptPreflightProfile(value);
      } catch {
        throw new Error("Invalid manuscript preflight profile");
      }
    },
    getManuscriptPreflightSettings: async (input) => {
      const command = parseGetManuscriptPreflightSettingsCommand(input);
      const value = await invoke(
        MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
        command,
      );
      try {
        return parseManuscriptPreflightSettingsProjection(value);
      } catch {
        throw new Error("Invalid manuscript preflight settings");
      }
    },
    saveManuscriptPreflightSettings: async (input) => {
      const command = parseSaveManuscriptPreflightSettingsCommand(input);
      const value = await invoke(
        MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
        command,
      );
      try {
        return parseManuscriptPreflightSettingsProjection(value);
      } catch {
        throw new Error("Invalid saved manuscript preflight settings");
      }
    },
    exportManuscriptText: async (input) => {
      const command = parseExportManuscriptTextCommand(input);
      const value = await invoke(MANUSCRIPT_EXPORT_TEXT_CHANNEL, command);
      try {
        return parseExportManuscriptTextResult(value);
      } catch {
        throw new Error("Invalid manuscript text export result");
      }
    },
    selectManuscriptTextImport: async (input) => {
      const command = parseSelectManuscriptTextImportCommand(input);
      const value = await invoke(MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL, command);
      try {
        return parseManuscriptTextImportResult(value);
      } catch {
        throw new Error("Invalid manuscript text import result");
      }
    },
    getManuscriptPersistenceProfile: async () => {
      const value = await invoke(MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL);
      try {
        return parseManuscriptPersistenceProfile(value);
      } catch {
        throw new Error("Invalid manuscript persistence profile");
      }
    },
    getManuscriptStartupRecovery: async () => {
      const value = await invoke(MANUSCRIPT_STARTUP_RECOVERY_CHANNEL);
      try {
        return parseStartupRecoveryProjection(value);
      } catch {
        throw new Error("Invalid manuscript startup recovery");
      }
    },
    getManuscriptResumeCheckpoint: async () => {
      const value = await invoke(MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL);
      try {
        return parseManuscriptResumeCheckpointProjection(value);
      } catch {
        throw new Error("Invalid manuscript resume checkpoint");
      }
    },
    getContinuousReadingProgress: async (input) => {
      const command = parseGetContinuousReadingProgressCommand(input);
      const value = await invoke(
        MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
        command,
      );
      try {
        return parseWorkContinuousReadingProgressProjection(value);
      } catch {
        throw new Error("Invalid continuous reading progress projection");
      }
    },
    saveContinuousReadingProgress: async (input) => {
      const command = parseSaveContinuousReadingProgressCommand(input);
      const value = await invoke(
        MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
        command,
      );
      try {
        return parseWorkContinuousReadingProgressProjection(value);
      } catch {
        throw new Error("Invalid saved continuous reading progress projection");
      }
    },
    saveChangeBatch: async (input) => {
      const batch = parseChangeBatch(input);
      const value = await invoke(MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL, batch);
      try {
        return parseSaveReceipt(value);
      } catch {
        throw new Error("Invalid save receipt");
      }
    },
    saveDocumentChange: async (input) => {
      const command = parseSaveManuscriptDocumentChangeCommand(input);
      const value = await invoke(
        MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL,
        command,
      );
      try {
        return parseSaveReceipt(value);
      } catch {
        throw new Error("Invalid document change save receipt");
      }
    },
    saveFormatting: async (input) => {
      const command = parseSaveManuscriptFormattingCommand(input);
      const value = await invoke(MANUSCRIPT_SAVE_FORMATTING_CHANNEL, command);
      try {
        return parseSaveManuscriptFormattingReceipt(value);
      } catch {
        throw new Error("Invalid manuscript formatting save receipt");
      }
    },
    moveRangeToEpisode: async (input) => {
      const command = parseMoveRangeToEpisodeCommand(input);
      const value = await invoke(
        MANUSCRIPT_MOVE_RANGE_TO_EPISODE_CHANNEL,
        command,
      );
      try {
        return parseMoveRangeToEpisodeReceipt(value);
      } catch {
        throw new Error("Invalid Episode range move receipt");
      }
    },
    undoMoveRangeToEpisode: async (input) => {
      const command = parseUndoMoveRangeToEpisodeCommand(input);
      const value = await invoke(
        MANUSCRIPT_UNDO_MOVE_RANGE_TO_EPISODE_CHANNEL,
        command,
      );
      try {
        return parseMoveRangeToEpisodeReceipt(value);
      } catch {
        throw new Error("Invalid Episode range move undo receipt");
      }
    },
    getWorkManuscriptLayoutSettings: async (input) => {
      const command = parseGetWorkManuscriptLayoutSettingsCommand(input);
      const value = await invoke(
        MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL,
        command,
      );
      try {
        return parseWorkManuscriptLayoutSettingsProjection(value);
      } catch {
        throw new Error("Invalid Work manuscript layout settings projection");
      }
    },
    saveWorkManuscriptLayoutSettings: async (input) => {
      const command = parseSaveWorkManuscriptLayoutSettingsCommand(input);
      const value = await invoke(
        MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL,
        command,
      );
      try {
        return parseWorkManuscriptLayoutSettingsProjection(value);
      } catch {
        throw new Error(
          "Invalid saved Work manuscript layout settings projection",
        );
      }
    },
    applyManuscriptStartupRecovery: async (input) => {
      const command = parseApplyStartupRecoveryCommand(input);
      const value = await invoke(
        MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
        command,
      );
      try {
        return parseApplyStartupRecoveryAcknowledgement(value);
      } catch {
        throw new Error("Invalid manuscript recovery acknowledgement");
      }
    },
    onManuscriptCloseRequest: (listener) =>
      listen(MANUSCRIPT_CLOSE_REQUEST_CHANNEL, (value) => {
        listener(parseManuscriptCloseRequest(value));
      }),
    completeManuscriptCloseRequest: async (input) => {
      const result = parseManuscriptCloseResult(input);
      const value = await invoke(
        MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
        result,
      );
      try {
        return parseManuscriptCloseResult(value);
      } catch {
        throw new Error("Invalid manuscript close result");
      }
    },
  });
}
