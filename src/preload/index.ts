import { contextBridge, ipcRenderer } from "electron";

import {
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
  RUNTIME_INFO_CHANNEL,
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
        MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL
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
