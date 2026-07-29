import {
  app,
  BrowserWindow,
  ipcMain,
  type IpcMainInvokeEvent,
} from "electron";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
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
  parseManuscriptCloseResult,
  type ManuscriptCloseRequest,
  type RuntimeInfo,
} from "../application/contracts/studio-bridge";
import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import { parseManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import {
  parseManuscriptBatchingPolicy,
} from "../application/persistence/manuscript-persistence-profile";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  createManuscriptRuntimeCoordinator,
} from "./manuscript-runtime-coordinator";
import {
  createPoc2CrashGate,
  parsePoc2CrashGateProfile,
  type Poc2CrashGateStage,
} from "./poc-2-crash-gate-profile";
import { parsePocRecoveryApplyRuntimeProfile } from "./poc-recovery-apply-runtime-profile";
import {
  parsePocResumeCheckpointRuntimeProfile,
} from "./poc-resume-checkpoint-runtime-profile";
import { readRuntimeProfileValue } from "./runtime-profile-source";
import {
  createSecureWebPreferences,
  isAllowedRendererNavigation,
  isTrustedRendererIpcSender,
  shouldShowMainWindow,
} from "./window-policy";

let mainWindow: BrowserWindow | null = null;
let configuredRendererTarget: string | null =
  null;
let pendingCloseRequest:
  ManuscriptCloseRequest | null = null;
let allowMainWindowClose = false;

function assertTrustedRendererSender(
  event: IpcMainInvokeEvent,
): void {
  const window = mainWindow;
  const rendererTarget =
    configuredRendererTarget;
  const senderFrame =
    event.senderFrame;
  if (
    window === null ||
    rendererTarget === null ||
    senderFrame === null ||
    !isTrustedRendererIpcSender({
      senderWebContentsId:
        event.sender.id,
      trustedWebContentsId:
        window.webContents.id,
      senderFrameUrl:
        senderFrame.url,
      senderMainFrameUrl:
        event.sender.mainFrame.url,
      configuredRendererTarget:
        rendererTarget,
    })
  ) {
    throw new Error(
      "Rejected untrusted renderer IPC sender",
    );
  }
}

async function registerApplicationHandlers(): Promise<void> {
  const ephemeralWorkId = randomUUID();
  const ephemeralDocumentId = randomUUID();
  const ephemeralDocumentProfile = parseManuscriptDocumentProfile({
    schemaVersion: 1,
    initialDocumentId: ephemeralDocumentId,
    documents: [
      {
        workId: ephemeralWorkId,
        documentId: ephemeralDocumentId,
        documentRevisionId: null,
        label: randomUUID(),
        initialText: "",
      },
    ],
  });
  const documentProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const documentProfile =
    documentProfileValue === null
      ? ephemeralDocumentProfile
      : parseManuscriptDocumentProfile(documentProfileValue);
  const journalProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const journalProfile =
    journalProfileValue === null
      ? null
      : parseManuscriptJournalRuntimeProfile(
          journalProfileValue,
        );
  const batchingProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const batchingPolicy =
    batchingProfileValue === null
      ? null
      : parseManuscriptBatchingPolicy(
          batchingProfileValue,
        );
  const crashGateProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_POC_2_CRASH_GATE_PROFILE,
    filePath:
      process.env.EUM_STUDIO_POC_2_CRASH_GATE_PROFILE_PATH,
    readTextFile: (filePath) =>
      readFileSync(filePath, "utf8"),
  });
  const crashGate =
    crashGateProfileValue === null
      ? null
      : createPoc2CrashGate({
          profile: parsePoc2CrashGateProfile(
            crashGateProfileValue,
          ),
          enterPending: () =>
            new Promise<void>(() => undefined),
        });
  const recoveryApplyProfileValue =
    readRuntimeProfileValue({
      inlineJson:
        process.env
          .EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE,
      filePath:
        process.env
          .EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE_PATH,
      readTextFile: (filePath) =>
        readFileSync(filePath, "utf8"),
    });
  const recoveryApplyProfile =
    recoveryApplyProfileValue === null
      ? null
      : parsePocRecoveryApplyRuntimeProfile(
          recoveryApplyProfileValue,
        );
  const resumeCheckpointProfileValue =
    readRuntimeProfileValue({
      inlineJson:
        process.env
          .EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE,
      filePath:
        process.env
          .EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE_PATH,
      readTextFile: (filePath) =>
        readFileSync(filePath, "utf8"),
    });
  const resumeCheckpointProfile =
    resumeCheckpointProfileValue === null
      ? null
      : parsePocResumeCheckpointRuntimeProfile(
          resumeCheckpointProfileValue,
        );
  const manuscriptRuntime =
    await createManuscriptRuntimeCoordinator({
      documentProfile,
      journalProfile,
      batchingPolicy,
      recoveryApplyProfile,
      resumeCheckpointProfile,
      ...(crashGate === null
        ? {}
        : {
            onSaveStage: (stage) => {
              const crashStage:
                Poc2CrashGateStage =
                stage === "target-validated"
                  ? "save-target-validated"
                  : "before-journal-append";
              return crashGate.reach(crashStage);
            },
            onJournalStage: () =>
              crashGate.reach(
                "journal-frame-written-before-sync",
              ),
          }),
    });

  ipcMain.handle(RUNTIME_INFO_CHANNEL, (): RuntimeInfo => {
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      architecture: process.arch,
    };
  });
  ipcMain.handle(MANUSCRIPT_INPUT_PROFILE_CHANNEL, () => {
    const serializedProfile =
      process.env.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE;
    const value =
      serializedProfile === undefined
        ? {
            schemaVersion: 1,
            autoClosePairs: [],
            textReplacements: [],
          }
        : JSON.parse(serializedProfile);
    return parseManuscriptInputProfile(value);
  });
  ipcMain.handle(MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptDocumentProfile();
  });
  ipcMain.handle(MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptPersistenceProfile();
  });
  ipcMain.handle(MANUSCRIPT_STARTUP_RECOVERY_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptStartupRecovery();
  });
  ipcMain.handle(MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptResumeCheckpoint();
  });
  ipcMain.handle(
    MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return manuscriptRuntime.saveChangeBatch(value);
    },
  );
  ipcMain.handle(
    MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return manuscriptRuntime.applyManuscriptStartupRecovery(
        value,
      );
    },
  );
  ipcMain.handle(
    MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const result =
        parseManuscriptCloseResult(value);
      const request = pendingCloseRequest;
      if (
        request === null ||
        request.requestId !==
          result.requestId
      ) {
        throw new Error(
          "Manuscript close result does not identify the pending request",
        );
      }
      pendingCloseRequest = null;
      if (result.status === "saved") {
        const window = mainWindow;
        if (window !== null) {
          allowMainWindowClose = true;
          setImmediate(() => {
            if (!window.isDestroyed()) {
              window.close();
            }
          });
        }
      }
      return result;
    },
  );
}

async function createMainWindow(): Promise<BrowserWindow> {
  const preloadPath = path.join(__dirname, "../preload/index.js");
  const rendererFile = path.join(
    __dirname,
    "../../dist-renderer/index.html",
  );
  const configuredRendererUrl = process.env.EUM_STUDIO_RENDERER_URL;
  const rendererTarget =
    configuredRendererUrl ?? pathToFileURL(rendererFile).toString();
  configuredRendererTarget =
    rendererTarget;
  pendingCloseRequest = null;
  allowMainWindowClose = false;

  const window = new BrowserWindow({
    show: false,
    webPreferences: createSecureWebPreferences(preloadPath),
  });
  mainWindow = window;

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, requestedTarget) => {
    if (!isAllowedRendererNavigation(requestedTarget, rendererTarget)) {
      event.preventDefault();
    }
  });
  window.once("ready-to-show", () => {
    if (shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)) {
      window.show();
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
      configuredRendererTarget =
        null;
      pendingCloseRequest = null;
      allowMainWindowClose = false;
    }
  });
  window.on("close", (event) => {
    if (allowMainWindowClose) {
      return;
    }
    event.preventDefault();
    if (
      pendingCloseRequest !== null
    ) {
      return;
    }
    const request: ManuscriptCloseRequest =
      Object.freeze({
        schemaVersion: 1,
        requestId: randomUUID(),
      });
    pendingCloseRequest = request;
    window.webContents.send(
      MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
      request,
    );
  });

  if (configuredRendererUrl === undefined) {
    await window.loadFile(rendererFile);
  } else {
    await window.loadURL(configuredRendererUrl);
  }

  return window;
}

app.enableSandbox();

app.whenReady().then(async () => {
  await registerApplicationHandlers();
  mainWindow = await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
