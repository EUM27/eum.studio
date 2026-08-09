import { contextBridge, ipcRenderer } from "electron";

import {
  ACTIVITY_LIST_WORK_CHANNEL,
  ACTIVITY_START_FOCUS_CHANNEL,
  ACTIVITY_START_SESSION_CHANNEL,
  ACTIVITY_STOP_FOCUS_CHANNEL,
  ACTIVITY_STOP_SESSION_CHANNEL,
  BACKUP_CREATE_CHANNEL,
  BACKUP_GET_STATUS_CHANNEL,
  BACKUP_RESTORE_CHANNEL,
  type BridgeListen,
  createStudioBridge,
  MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
  MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
  MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
  MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
  MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
  RUNTIME_INFO_CHANNEL,
  STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
  STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
  STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
  VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
  VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
  VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
  VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
  WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
  WORKSPACE_CATALOG_CHANNEL,
  WORKSPACE_CAPTURE_RESUME_CHANNEL,
  WORKSPACE_CREATE_DOCUMENT_CHANNEL,
  WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
  WORKSPACE_CREATE_WORK_CHANNEL,
} from "../application/contracts/studio-bridge";

const manuscriptCloseRequestListeners = new Set<
  Parameters<BridgeListen>[1]
>();
let pendingManuscriptCloseRequest: unknown;
let hasPendingManuscriptCloseRequest = false;

ipcRenderer.on(
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  (
    _event: Electron.IpcRendererEvent,
    payload: unknown,
  ) => {
    if (
      manuscriptCloseRequestListeners.size === 0
    ) {
      pendingManuscriptCloseRequest = payload;
      hasPendingManuscriptCloseRequest = true;
      return;
    }
    for (const listener of manuscriptCloseRequestListeners) {
      listener(payload);
    }
  },
);

const studioBridge = createStudioBridge(
  (channel, payload) => {
    if (
      channel !== RUNTIME_INFO_CHANNEL &&
      channel !== MANUSCRIPT_INPUT_PROFILE_CHANNEL &&
      channel !== MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL &&
      channel !== MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL &&
      channel !== MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL &&
      channel !== MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL &&
      channel !== MANUSCRIPT_STARTUP_RECOVERY_CHANNEL &&
      channel !==
        MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL &&
      channel !==
        MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL &&
      channel !== WORKSPACE_CATALOG_CHANNEL &&
      channel !== WORKSPACE_CREATE_FIRST_WORK_CHANNEL &&
      channel !== WORKSPACE_CREATE_WORK_CHANNEL &&
      channel !== WORKSPACE_CREATE_DOCUMENT_CHANNEL &&
      channel !== WORKSPACE_ACTIVATE_LOCATION_CHANNEL &&
      channel !== WORKSPACE_CAPTURE_RESUME_CHANNEL &&
      channel !== STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL &&
      channel !== STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL &&
      channel !== STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL &&
      channel !== STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL &&
      channel !== ACTIVITY_LIST_WORK_CHANNEL &&
      channel !== ACTIVITY_START_SESSION_CHANNEL &&
      channel !== ACTIVITY_STOP_SESSION_CHANNEL &&
      channel !== ACTIVITY_START_FOCUS_CHANNEL &&
      channel !== ACTIVITY_STOP_FOCUS_CHANNEL &&
      channel !== VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL &&
      channel !== VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL &&
      channel !== VERSION_CREATE_WORK_SNAPSHOT_CHANNEL &&
      channel !== VERSION_LIST_WORK_SNAPSHOTS_CHANNEL &&
      channel !== BACKUP_GET_STATUS_CHANNEL &&
      channel !== BACKUP_CREATE_CHANNEL &&
      channel !== BACKUP_RESTORE_CHANNEL &&
      channel !== MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL
    ) {
      return Promise.reject(
        new Error(
          "Unsupported bridge channel",
        ),
      );
    }
    return payload === undefined
      ? ipcRenderer.invoke(channel)
      : ipcRenderer.invoke(
          channel,
          payload,
        );
  },
  (channel, listener) => {
    if (
      channel !==
      MANUSCRIPT_CLOSE_REQUEST_CHANNEL
    ) {
      throw new Error(
        "Unsupported bridge event channel",
      );
    }
    manuscriptCloseRequestListeners.add(listener);
    if (hasPendingManuscriptCloseRequest) {
      const payload =
        pendingManuscriptCloseRequest;
      pendingManuscriptCloseRequest =
        undefined;
      hasPendingManuscriptCloseRequest = false;
      listener(payload);
    }
    return () => {
      manuscriptCloseRequestListeners.delete(
        listener,
      );
    };
  },
);

contextBridge.exposeInMainWorld("eumStudio", studioBridge);
