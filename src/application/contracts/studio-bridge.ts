import {
  parseManuscriptInputProfile,
  type ManuscriptInputProfile,
} from "../editor/manuscript-input-profile";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../editor/manuscript-document-profile";
import {
  parseChangeBatch,
  type ChangeBatch,
} from "../persistence/change-batch";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptPersistenceProfile,
} from "../persistence/manuscript-persistence-profile";
import {
  parseSaveReceipt,
  type SaveReceipt,
} from "../persistence/save-change-batch";
import {
  parseApplyStartupRecoveryAcknowledgement,
  parseApplyStartupRecoveryCommand,
  parseStartupRecoveryProjection,
  type ApplyStartupRecoveryAcknowledgement,
  type ApplyStartupRecoveryCommand,
  type StartupRecoveryProjection,
} from "../persistence/startup-recovery-contract";
import {
  parseManuscriptResumeCheckpointProjection,
  type ManuscriptResumeCheckpointProjection,
} from "../checkpoints/manuscript-resume-checkpoint-projection";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateFirstWorkResult,
  parseCreateWorkCommand,
  parseCreateWorkResult,
  parseWorkspaceCatalogProjection,
  type ActivateWorkspaceLocationCommand,
  type CaptureWorkspaceResumeCommand,
  type CreateDocumentCommand,
  type CreateDocumentResult,
  type CreateFirstWorkCommand,
  type CreateFirstWorkResult,
  type CreateWorkCommand,
  type CreateWorkResult,
  type WorkspaceCatalogProjection,
} from "../workspace/workspace-contract";
import {
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseEventBlockProjection,
  parseListEventBlocksCommand,
  type CreateEventBlockCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
  type ListEventBlocksCommand,
} from "../structure/event-block-contract";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  parseSceneOverrideProjection,
  type CreateSceneOverrideCommand,
  type ListSceneOverridesCommand,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../structure/scene-override-contract";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type ListWorkActivityCommand,
  type StartFocusCycleCommand,
  type StartWritingSessionCommand,
  type StopFocusCycleCommand,
  type StopWritingSessionCommand,
  type WorkActivityProjection,
} from "../activity/work-activity-contract";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseRestoreDocumentRevisionCommand,
  parseRestoreDocumentRevisionResult,
  parseWorkSnapshotListProjection,
  parseWorkSnapshotProjection,
  type CreateWorkSnapshotCommand,
  type DocumentRevisionListProjection,
  type ListDocumentRevisionsCommand,
  type ListWorkSnapshotsCommand,
  type RestoreDocumentRevisionCommand,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../revisions/work-version-contract";
import {
  parseLocalWorkspaceBackupActionResult,
  parseLocalWorkspaceBackupStatusProjection,
  type LocalWorkspaceBackupActionResult,
  type LocalWorkspaceBackupStatusProjection,
} from "../storage/local-workspace-backup-contract";
import {
  parseLegacyLoreImportRehearsalActionResult,
  type LegacyLoreImportRehearsalActionResult,
} from "../migration/legacy-lore-import-contract";

export const RUNTIME_INFO_CHANNEL = "studio:system:get-runtime-info";
export const MANUSCRIPT_INPUT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-input-profile";
export const MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-document-profile";
export const MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL =
  "studio:editor:save-change-batch";
export const MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-persistence-profile";
export const MANUSCRIPT_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:get-manuscript-startup-recovery";
export const MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL =
  "studio:editor:get-manuscript-resume-checkpoint";
export const MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:apply-manuscript-startup-recovery";
export const MANUSCRIPT_CLOSE_REQUEST_CHANNEL =
  "studio:editor:manuscript-close-request";
export const MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL =
  "studio:editor:complete-manuscript-close-request";
export const WORKSPACE_CATALOG_CHANNEL =
  "studio:workspace:get-catalog";
export const WORKSPACE_CREATE_FIRST_WORK_CHANNEL =
  "studio:workspace:create-first-work";
export const WORKSPACE_CREATE_WORK_CHANNEL =
  "studio:workspace:create-work";
export const WORKSPACE_CREATE_DOCUMENT_CHANNEL =
  "studio:workspace:create-document";
export const WORKSPACE_ACTIVATE_LOCATION_CHANNEL =
  "studio:workspace:activate-location";
export const WORKSPACE_CAPTURE_RESUME_CHANNEL =
  "studio:workspace:capture-resume";
export const STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL =
  "studio:structure:create-event-block";
export const STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL =
  "studio:structure:list-event-blocks";
export const STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL =
  "studio:structure:create-scene-override";
export const STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL =
  "studio:structure:list-scene-overrides";
export const ACTIVITY_LIST_WORK_CHANNEL =
  "studio:activity:list-work";
export const ACTIVITY_START_SESSION_CHANNEL =
  "studio:activity:start-session";
export const ACTIVITY_STOP_SESSION_CHANNEL =
  "studio:activity:stop-session";
export const ACTIVITY_START_FOCUS_CHANNEL =
  "studio:activity:start-focus";
export const ACTIVITY_STOP_FOCUS_CHANNEL =
  "studio:activity:stop-focus";
export const VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL =
  "studio:version:list-document-revisions";
export const VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL =
  "studio:version:restore-document-revision";
export const VERSION_CREATE_WORK_SNAPSHOT_CHANNEL =
  "studio:version:create-work-snapshot";
export const VERSION_LIST_WORK_SNAPSHOTS_CHANNEL =
  "studio:version:list-work-snapshots";
export const BACKUP_GET_STATUS_CHANNEL =
  "studio:backup:get-status";
export const BACKUP_CREATE_CHANNEL =
  "studio:backup:create";
export const BACKUP_RESTORE_CHANNEL =
  "studio:backup:restore";
export const MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL =
  "studio:migration:run-legacy-rehearsal";

export type RuntimeInfo = {
  appName: string;
  appVersion: string;
  platform: string;
  architecture: string;
};

export type ManuscriptCloseRequest = {
  readonly schemaVersion: 1;
  readonly requestId: string;
};

export type ManuscriptCloseResult = {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly status: "saved" | "failed";
};

export type StudioBridge = {
  system: {
    getRuntimeInfo: () => Promise<RuntimeInfo>;
  };
  workspace: {
    getCatalog: () => Promise<WorkspaceCatalogProjection>;
    activateLocation: (
      command: ActivateWorkspaceLocationCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    createWork: (
      command: CreateWorkCommand,
    ) => Promise<CreateWorkResult>;
    createFirstWork: (
      command: CreateFirstWorkCommand,
    ) => Promise<CreateFirstWorkResult>;
    createDocument: (
      command: CreateDocumentCommand,
    ) => Promise<CreateDocumentResult>;
    captureResume: (
      command: CaptureWorkspaceResumeCommand,
    ) => Promise<ManuscriptResumeCheckpointProjection>;
  };
  structure: {
    createEventBlock: (
      command: CreateEventBlockCommand,
    ) => Promise<EventBlockProjection>;
    listEventBlocks: (
      command: ListEventBlocksCommand,
    ) => Promise<EventBlockListProjection>;
    createSceneOverride: (
      command: CreateSceneOverrideCommand,
    ) => Promise<SceneOverrideProjection>;
    listSceneOverrides: (
      command: ListSceneOverridesCommand,
    ) => Promise<SceneOverrideListProjection>;
  };
  activity: {
    listWork: (
      command: ListWorkActivityCommand,
    ) => Promise<WorkActivityProjection>;
    startSession: (
      command: StartWritingSessionCommand,
    ) => Promise<WorkActivityProjection>;
    stopSession: (
      command: StopWritingSessionCommand,
    ) => Promise<WorkActivityProjection>;
    startFocus: (
      command: StartFocusCycleCommand,
    ) => Promise<WorkActivityProjection>;
    stopFocus: (
      command: StopFocusCycleCommand,
    ) => Promise<WorkActivityProjection>;
  };
  version: {
    listDocumentRevisions: (
      command: ListDocumentRevisionsCommand,
    ) => Promise<DocumentRevisionListProjection>;
    restoreDocumentRevision: (
      command: RestoreDocumentRevisionCommand,
    ) => Promise<RestoreDocumentRevisionResult>;
    createWorkSnapshot: (
      command: CreateWorkSnapshotCommand,
    ) => Promise<WorkSnapshotProjection>;
    listWorkSnapshots: (
      command: ListWorkSnapshotsCommand,
    ) => Promise<WorkSnapshotListProjection>;
  };
  backup: {
    getStatus: () => Promise<LocalWorkspaceBackupStatusProjection>;
    create: () => Promise<LocalWorkspaceBackupActionResult>;
    restore: () => Promise<LocalWorkspaceBackupActionResult>;
  };
  migration: {
    runLegacyLoreRehearsal: () => Promise<LegacyLoreImportRehearsalActionResult>;
  };
  editor: {
    getManuscriptInputProfile: () => Promise<ManuscriptInputProfile>;
    getManuscriptDocumentProfile: () => Promise<ManuscriptDocumentProfile>;
    getManuscriptPersistenceProfile: () => Promise<ManuscriptPersistenceProfile | null>;
    getManuscriptStartupRecovery: () => Promise<StartupRecoveryProjection>;
    getManuscriptResumeCheckpoint: () => Promise<ManuscriptResumeCheckpointProjection>;
    saveChangeBatch: (batch: ChangeBatch) => Promise<SaveReceipt>;
    applyManuscriptStartupRecovery: (
      command: ApplyStartupRecoveryCommand,
    ) => Promise<ApplyStartupRecoveryAcknowledgement>;
    onManuscriptCloseRequest: (
      listener: (
        request: ManuscriptCloseRequest,
      ) => void,
    ) => () => void;
    completeManuscriptCloseRequest: (
      result: ManuscriptCloseResult,
    ) => Promise<ManuscriptCloseResult>;
  };
};

export type BridgeInvoke = (
  channel:
    | typeof RUNTIME_INFO_CHANNEL
    | typeof MANUSCRIPT_INPUT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL
    | typeof MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL
    | typeof MANUSCRIPT_STARTUP_RECOVERY_CHANNEL
    | typeof MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL
    | typeof MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL
    | typeof MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL
    | typeof WORKSPACE_CATALOG_CHANNEL
    | typeof WORKSPACE_CREATE_FIRST_WORK_CHANNEL
    | typeof WORKSPACE_CREATE_WORK_CHANNEL
    | typeof WORKSPACE_CREATE_DOCUMENT_CHANNEL
    | typeof WORKSPACE_ACTIVATE_LOCATION_CHANNEL
    | typeof WORKSPACE_CAPTURE_RESUME_CHANNEL
    | typeof STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL
    | typeof STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL
    | typeof STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL
    | typeof STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL
    | typeof ACTIVITY_LIST_WORK_CHANNEL
    | typeof ACTIVITY_START_SESSION_CHANNEL
    | typeof ACTIVITY_STOP_SESSION_CHANNEL
    | typeof ACTIVITY_START_FOCUS_CHANNEL
    | typeof ACTIVITY_STOP_FOCUS_CHANNEL
    | typeof VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL
    | typeof VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL
    | typeof VERSION_CREATE_WORK_SNAPSHOT_CHANNEL
    | typeof VERSION_LIST_WORK_SNAPSHOTS_CHANNEL
    | typeof BACKUP_GET_STATUS_CHANNEL
    | typeof BACKUP_CREATE_CHANNEL
    | typeof BACKUP_RESTORE_CHANNEL
    | typeof MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
  payload?:
    | ChangeBatch
    | ApplyStartupRecoveryCommand
    | ManuscriptCloseResult
    | CreateFirstWorkCommand
    | CreateWorkCommand
    | CreateDocumentCommand
    | ActivateWorkspaceLocationCommand
    | CaptureWorkspaceResumeCommand
    | CreateEventBlockCommand
    | ListEventBlocksCommand
    | CreateSceneOverrideCommand
    | ListSceneOverridesCommand
    | ListWorkActivityCommand
    | StartWritingSessionCommand
    | StopWritingSessionCommand
    | StartFocusCycleCommand
    | StopFocusCycleCommand
    | ListDocumentRevisionsCommand
    | RestoreDocumentRevisionCommand
    | CreateWorkSnapshotCommand
    | ListWorkSnapshotsCommand,
) => Promise<unknown>;

export type BridgeListen = (
  channel: typeof MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  listener: (payload: unknown) => void,
) => () => void;

function parseCloseContractRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
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
      throw new Error(
        `Unsupported ${recordName} field: ${field}`,
      );
    }
  }
}

function parseCloseRequestId(
  value: unknown,
  recordName: string,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${recordName}.requestId must be a non-empty string`,
    );
  }
  return value;
}

export function parseManuscriptCloseRequest(
  value: unknown,
): ManuscriptCloseRequest {
  const input = parseCloseContractRecord(
    value,
    "ManuscriptCloseRequest",
  );
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
    requestId: parseCloseRequestId(
      input.requestId,
      "ManuscriptCloseRequest",
    ),
  });
}

export function parseManuscriptCloseResult(
  value: unknown,
): ManuscriptCloseResult {
  const input = parseCloseContractRecord(
    value,
    "ManuscriptCloseResult",
  );
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
  if (
    input.status !== "saved" &&
    input.status !== "failed"
  ) {
    throw new Error(
      `Unsupported ManuscriptCloseResult status: ${String(
        input.status,
      )}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(
      input.requestId,
      "ManuscriptCloseResult",
    ),
    status: input.status,
  });
}

export function isRuntimeInfo(value: unknown): value is RuntimeInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.appName === "string" &&
    typeof candidate.appVersion === "string" &&
    typeof candidate.platform === "string" &&
    typeof candidate.architecture === "string"
  );
}

export function createStudioBridge(
  invoke: BridgeInvoke,
  listen: BridgeListen,
): StudioBridge {
  return {
    system: {
      getRuntimeInfo: async () => {
        const value = await invoke(RUNTIME_INFO_CHANNEL);
        if (!isRuntimeInfo(value)) {
          throw new Error("Invalid runtime information");
        }
        return value;
      },
    },
    workspace: {
      getCatalog: async () => {
        const value = await invoke(WORKSPACE_CATALOG_CHANNEL);
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid workspace catalog");
        }
      },
      activateLocation: async (input) => {
        const command = parseActivateWorkspaceLocationCommand(input);
        const value = await invoke(
          WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid workspace activation result");
        }
      },
      createWork: async (input) => {
        const command = parseCreateWorkCommand(input);
        const value = await invoke(WORKSPACE_CREATE_WORK_CHANNEL, command);
        try {
          return parseCreateWorkResult(value);
        } catch {
          throw new Error("Invalid Work creation result");
        }
      },
      createFirstWork: async (input) => {
        const command = parseCreateFirstWorkCommand(input);
        const value = await invoke(
          WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
          command,
        );
        try {
          return parseCreateFirstWorkResult(value);
        } catch {
          throw new Error("Invalid first Work creation result");
        }
      },
      createDocument: async (input) => {
        const command = parseCreateDocumentCommand(input);
        const value = await invoke(
          WORKSPACE_CREATE_DOCUMENT_CHANNEL,
          command,
        );
        try {
          return parseCreateDocumentResult(value);
        } catch {
          throw new Error("Invalid Document creation result");
        }
      },
      captureResume: async (input) => {
        const command = parseCaptureWorkspaceResumeCommand(input);
        const value = await invoke(
          WORKSPACE_CAPTURE_RESUME_CHANNEL,
          command,
        );
        try {
          return parseManuscriptResumeCheckpointProjection(value);
        } catch {
          throw new Error("Invalid workspace resume result");
        }
      },
    },
    structure: {
      createEventBlock: async (input) => {
        const command = parseCreateEventBlockCommand(input);
        const value = await invoke(
          STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
          command,
        );
        try {
          return parseEventBlockProjection(value);
        } catch {
          throw new Error("Invalid EventBlock creation result");
        }
      },
      listEventBlocks: async (input) => {
        const command = parseListEventBlocksCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
          command,
        );
        try {
          return parseEventBlockListProjection(value);
        } catch {
          throw new Error("Invalid EventBlock list");
        }
      },
      createSceneOverride: async (input) => {
        const command = parseCreateSceneOverrideCommand(input);
        const value = await invoke(
          STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
          command,
        );
        try {
          return parseSceneOverrideProjection(value);
        } catch {
          throw new Error("Invalid SceneOverride creation result");
        }
      },
      listSceneOverrides: async (input) => {
        const command = parseListSceneOverridesCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
          command,
        );
        try {
          return parseSceneOverrideListProjection(value);
        } catch {
          throw new Error("Invalid SceneOverride list");
        }
      },
    },
    activity: {
      listWork: async (input) => {
        const command = parseListWorkActivityCommand(input);
        const value = await invoke(ACTIVITY_LIST_WORK_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid Work activity projection");
        }
      },
      startSession: async (input) => {
        const command = parseStartWritingSessionCommand(input);
        const value = await invoke(ACTIVITY_START_SESSION_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid WritingSession result");
        }
      },
      stopSession: async (input) => {
        const command = parseStopWritingSessionCommand(input);
        const value = await invoke(ACTIVITY_STOP_SESSION_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid WritingSession result");
        }
      },
      startFocus: async (input) => {
        const command = parseStartFocusCycleCommand(input);
        const value = await invoke(ACTIVITY_START_FOCUS_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid FocusCycle result");
        }
      },
      stopFocus: async (input) => {
        const command = parseStopFocusCycleCommand(input);
        const value = await invoke(ACTIVITY_STOP_FOCUS_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid FocusCycle result");
        }
      },
    },
    version: {
      listDocumentRevisions: async (input) => {
        const command = parseListDocumentRevisionsCommand(input);
        const value = await invoke(
          VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
          command,
        );
        try {
          return parseDocumentRevisionListProjection(value);
        } catch {
          throw new Error("Invalid Document revision list");
        }
      },
      restoreDocumentRevision: async (input) => {
        const command = parseRestoreDocumentRevisionCommand(input);
        const value = await invoke(
          VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
          command,
        );
        try {
          return parseRestoreDocumentRevisionResult(value);
        } catch {
          throw new Error("Invalid Document revision restore result");
        }
      },
      createWorkSnapshot: async (input) => {
        const command = parseCreateWorkSnapshotCommand(input);
        const value = await invoke(
          VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
          command,
        );
        try {
          return parseWorkSnapshotProjection(value);
        } catch {
          throw new Error("Invalid WorkSnapshot creation result");
        }
      },
      listWorkSnapshots: async (input) => {
        const command = parseListWorkSnapshotsCommand(input);
        const value = await invoke(
          VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
          command,
        );
        try {
          return parseWorkSnapshotListProjection(value);
        } catch {
          throw new Error("Invalid WorkSnapshot list");
        }
      },
    },
    backup: {
      getStatus: async () => {
        const value = await invoke(BACKUP_GET_STATUS_CHANNEL);
        try {
          return parseLocalWorkspaceBackupStatusProjection(value);
        } catch {
          throw new Error("Invalid local workspace backup status");
        }
      },
      create: async () => {
        const value = await invoke(BACKUP_CREATE_CHANNEL);
        try {
          return parseLocalWorkspaceBackupActionResult(value);
        } catch {
          throw new Error("Invalid local workspace backup result");
        }
      },
      restore: async () => {
        const value = await invoke(BACKUP_RESTORE_CHANNEL);
        try {
          return parseLocalWorkspaceBackupActionResult(value);
        } catch {
          throw new Error("Invalid local workspace restore result");
        }
      },
    },
    migration: {
      runLegacyLoreRehearsal: async () => {
        const value = await invoke(MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL);
        try {
          return parseLegacyLoreImportRehearsalActionResult(value);
        } catch {
          throw new Error("Invalid legacy import rehearsal result");
        }
      },
    },
    editor: {
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
      getManuscriptPersistenceProfile: async () => {
        const value = await invoke(
          MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
        );
        try {
          return parseManuscriptPersistenceProfile(value);
        } catch {
          throw new Error(
            "Invalid manuscript persistence profile",
          );
        }
      },
      getManuscriptStartupRecovery: async () => {
        const value = await invoke(
          MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
        );
        try {
          return parseStartupRecoveryProjection(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript startup recovery",
          );
        }
      },
      getManuscriptResumeCheckpoint: async () => {
        const value = await invoke(
          MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
        );
        try {
          return parseManuscriptResumeCheckpointProjection(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript resume checkpoint",
          );
        }
      },
      saveChangeBatch: async (input) => {
        const batch = parseChangeBatch(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
          batch,
        );
        try {
          return parseSaveReceipt(value);
        } catch {
          throw new Error("Invalid save receipt");
        }
      },
      applyManuscriptStartupRecovery: async (
        input,
      ) => {
        const command =
          parseApplyStartupRecoveryCommand(input);
        const value = await invoke(
          MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
          command,
        );
        try {
          return parseApplyStartupRecoveryAcknowledgement(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript recovery acknowledgement",
          );
        }
      },
      onManuscriptCloseRequest: (
        listener,
      ) =>
        listen(
          MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
          (value) => {
            listener(
              parseManuscriptCloseRequest(
                value,
              ),
            );
          },
        ),
      completeManuscriptCloseRequest: async (
        input,
      ) => {
        const result =
          parseManuscriptCloseResult(input);
        const value = await invoke(
          MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
          result,
        );
        try {
          return parseManuscriptCloseResult(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript close result",
          );
        }
      },
    },
  };
}
