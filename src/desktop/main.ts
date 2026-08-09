import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
} from "electron";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACTIVITY_LIST_WORK_CHANNEL,
  ACTIVITY_START_FOCUS_CHANNEL,
  ACTIVITY_START_SESSION_CHANNEL,
  ACTIVITY_STOP_FOCUS_CHANNEL,
  ACTIVITY_STOP_SESSION_CHANNEL,
  BACKUP_CREATE_CHANNEL,
  BACKUP_GET_STATUS_CHANNEL,
  BACKUP_RESTORE_CHANNEL,
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
  parseManuscriptCloseResult,
  type ManuscriptCloseRequest,
  type RuntimeInfo,
} from "../application/contracts/studio-bridge";
import {
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseListEventBlocksCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
} from "../application/structure/event-block-contract";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../application/structure/scene-override-contract";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type WorkActivityProjection,
} from "../application/activity/work-activity-contract";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseRestoreDocumentRevisionCommand,
  parseWorkSnapshotListProjection,
  type DocumentRevisionListProjection,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../application/revisions/work-version-contract";
import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import { parseManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import {
  parseManuscriptBatchingPolicy,
} from "../application/persistence/manuscript-persistence-profile";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentCommand,
  parseCreateWorkCommand,
  parseCreateFirstWorkCommand,
  parseWorkspaceCatalogProjection,
  type CreateDocumentResult,
  type CreateFirstWorkResult,
  type CreateWorkResult,
  type WorkspaceCatalogProjection,
} from "../application/workspace/workspace-contract";
import {
  parseLocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import {
  parseLocalWorkspaceBackupProfile,
} from "../application/storage/local-workspace-backup-profile";
import {
  parseLegacyLoreImportProfile,
} from "../application/migration/legacy-lore-import-profile";
import type {
  LocalWorkspaceBackupStatusProjection,
  LocalWorkspaceBackupSummary,
} from "../application/storage/local-workspace-backup-contract";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  createManuscriptRuntimeCoordinator,
  type ManuscriptRuntimeCoordinator,
} from "./manuscript-runtime-coordinator";
import {
  openLocalWorkspaceRuntime,
  type LocalWorkspaceRuntime,
} from "./local-workspace-runtime";
import { runLegacyLoreImportRehearsal } from "./legacy-lore-import-rehearsal";
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
let activeApplicationRuntime: ApplicationRuntime | null = null;

type ApplicationRuntime = {
  readonly manuscript: ManuscriptRuntimeCoordinator;
  getWorkspaceCatalog(): WorkspaceCatalogProjection;
  activateWorkspaceLocation(value: unknown): Promise<WorkspaceCatalogProjection>;
  createWork(value: unknown): Promise<CreateWorkResult>;
  createFirstWork(value: unknown): Promise<CreateFirstWorkResult>;
  createDocument(value: unknown): Promise<CreateDocumentResult>;
  captureWorkspaceResume(value: unknown): Promise<ManuscriptResumeCheckpointProjection>;
  createEventBlock(value: unknown): Promise<EventBlockProjection>;
  listEventBlocks(value: unknown): Promise<EventBlockListProjection>;
  createSceneOverride(value: unknown): Promise<SceneOverrideProjection>;
  listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection>;
  startWritingSession(value: unknown): Promise<WorkActivityProjection>;
  stopWritingSession(value: unknown): Promise<WorkActivityProjection>;
  startFocusCycle(value: unknown): Promise<WorkActivityProjection>;
  stopFocusCycle(value: unknown): Promise<WorkActivityProjection>;
  listWorkActivity(value: unknown): Promise<WorkActivityProjection>;
  listDocumentRevisions(value: unknown): Promise<DocumentRevisionListProjection>;
  restoreDocumentRevision(value: unknown): Promise<RestoreDocumentRevisionResult>;
  createWorkSnapshot(value: unknown): Promise<WorkSnapshotProjection>;
  listWorkSnapshots(value: unknown): Promise<WorkSnapshotListProjection>;
  getBackupStatus(): Promise<LocalWorkspaceBackupStatusProjection>;
  createBackupBundle(bundlePath: string): Promise<LocalWorkspaceBackupSummary>;
  restoreBackupBundle(
    bundlePath: string,
    targetPath: string,
  ): Promise<LocalWorkspaceBackupSummary>;
  close(): void;
};

function projectConfiguredWorkspaceCatalog(
  documentProfile: ReturnType<typeof parseManuscriptDocumentProfile>,
): WorkspaceCatalogProjection {
  const projectedAt = new Date().toISOString();
  const works = new Map<
    string,
    {
      workId: string;
      title: string;
      updatedAt: string;
      documents: Array<{
        documentId: string;
        title: string;
        currentRevisionId: string;
      }>;
    }
  >();
  for (const document of documentProfile.documents) {
    let work = works.get(document.workId);
    if (work === undefined) {
      work = {
        workId: document.workId,
        title: document.label,
        updatedAt: projectedAt,
        documents: [],
      };
      works.set(document.workId, work);
    }
    work.documents.push({
      documentId: document.documentId,
      title: document.label,
      currentRevisionId:
        document.documentRevisionId ??
        `configured-${document.documentId}`,
    });
  }
  const activeDocument = documentProfile.documents.find(
    (document) =>
      document.documentId === documentProfile.initialDocumentId,
  );
  if (activeDocument === undefined) {
    throw new Error("Configured manuscript profile has no active document");
  }
  return parseWorkspaceCatalogProjection({
    schemaVersion: 1,
    works: [...works.values()],
    activeWorkId: activeDocument.workId,
    activeDocumentId: activeDocument.documentId,
    canCreateFirstWork: false,
  });
}

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
  const ephemeralRevisionId = randomUUID();
  const ephemeralDocumentProfile = parseManuscriptDocumentProfile({
    schemaVersion: 1,
    initialDocumentId: ephemeralDocumentId,
    documents: [
      {
        workId: ephemeralWorkId,
        documentId: ephemeralDocumentId,
        documentRevisionId: ephemeralRevisionId,
        label: "새 원고",
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
  const useEphemeralTestWorkspace =
    process.env.EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE === "1";
  const hasConfiguredManuscriptRuntime =
    documentProfileValue !== null ||
    journalProfileValue !== null ||
    batchingProfileValue !== null ||
    recoveryApplyProfileValue !== null ||
    resumeCheckpointProfileValue !== null ||
    crashGateProfileValue !== null;
  let applicationRuntime: ApplicationRuntime;
  if (
    !hasConfiguredManuscriptRuntime &&
    !useEphemeralTestWorkspace
  ) {
    const configuredRoot =
      process.env.EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH;
    if (
      configuredRoot !== undefined &&
      !path.isAbsolute(configuredRoot)
    ) {
      throw new Error(
        "EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH must be absolute",
      );
    }
    const localRuntime: LocalWorkspaceRuntime =
      await openLocalWorkspaceRuntime({
        rootDirectoryPath:
          configuredRoot ??
          path.join(app.getPath("userData"), "workspace-v1"),
        studioDisplayName: app.getName(),
        locale: app.getLocale(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        batchingPolicy: parseManuscriptBatchingPolicy({
          schemaVersion: 1,
          maxTransactionsPerBatch: 1,
          maxDelayMs: 0,
        }),
        emptyDocumentProfile: ephemeralDocumentProfile,
        defaults: parseLocalWorkspaceDefaults(
          JSON.parse(
            readFileSync(
              process.env.EUM_STUDIO_LOCAL_WORKSPACE_DEFAULTS_PATH ??
                path.join(
                  app.getAppPath(),
                  "config",
                  "local-workspace-defaults.json",
                ),
              "utf8",
            ),
          ),
        ),
        backupProfile: parseLocalWorkspaceBackupProfile(
          JSON.parse(
            readFileSync(
              process.env.EUM_STUDIO_LOCAL_WORKSPACE_BACKUP_PROFILE_PATH ??
                path.join(
                  app.getAppPath(),
                  "config",
                  "local-workspace-backup.json",
                ),
              "utf8",
            ),
          ),
        ),
      });
    applicationRuntime = {
      manuscript: localRuntime,
      getWorkspaceCatalog: () =>
        localRuntime.getWorkspaceCatalog(),
      activateWorkspaceLocation: (value) =>
        localRuntime.activateWorkspaceLocation(value),
      createWork: (value) =>
        localRuntime.createWork(value),
      createFirstWork: (value) =>
        localRuntime.createFirstWork(value),
      createDocument: (value) =>
        localRuntime.createDocument(value),
      captureWorkspaceResume: (value) =>
        localRuntime.captureWorkspaceResume(value),
      createEventBlock: (value) =>
        localRuntime.createEventBlock(value),
      listEventBlocks: (value) =>
        localRuntime.listEventBlocks(value),
      createSceneOverride: (value) =>
        localRuntime.createSceneOverride(value),
      listSceneOverrides: (value) =>
        localRuntime.listSceneOverrides(value),
      startWritingSession: (value) =>
        localRuntime.startWritingSession(value),
      stopWritingSession: (value) =>
        localRuntime.stopWritingSession(value),
      startFocusCycle: (value) =>
        localRuntime.startFocusCycle(value),
      stopFocusCycle: (value) =>
        localRuntime.stopFocusCycle(value),
      listWorkActivity: (value) =>
        localRuntime.listWorkActivity(value),
      listDocumentRevisions: (value) =>
        localRuntime.listDocumentRevisions(value),
      restoreDocumentRevision: (value) =>
        localRuntime.restoreDocumentRevision(value),
      createWorkSnapshot: (value) =>
        localRuntime.createWorkSnapshot(value),
      listWorkSnapshots: (value) =>
        localRuntime.listWorkSnapshots(value),
      getBackupStatus: () =>
        localRuntime.getBackupStatus(),
      createBackupBundle: (bundlePath) =>
        localRuntime.createBackupBundle(bundlePath),
      restoreBackupBundle: (bundlePath, targetPath) =>
        localRuntime.restoreBackupBundle(bundlePath, targetPath),
      close: () => localRuntime.close(),
    };
  } else {
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
    const workspaceCatalog =
      projectConfiguredWorkspaceCatalog(documentProfile);
    applicationRuntime = {
      manuscript: manuscriptRuntime,
      getWorkspaceCatalog: () => workspaceCatalog,
      activateWorkspaceLocation: async () => {
        throw new Error(
          "Workspace activation is unavailable in a configured manuscript runtime",
        );
      },
      createWork: async () => {
        throw new Error(
          "Work creation is unavailable in a configured manuscript runtime",
        );
      },
      createFirstWork: async () => {
        throw new Error(
          "First Work creation is unavailable in a configured manuscript runtime",
        );
      },
      createDocument: async () => {
        throw new Error(
          "Document creation is unavailable in a configured manuscript runtime",
        );
      },
      captureWorkspaceResume: async () => {
        throw new Error(
          "Workspace resume capture is unavailable in a configured manuscript runtime",
        );
      },
      createEventBlock: async () => {
        throw new Error(
          "EventBlock creation is unavailable in a configured manuscript runtime",
        );
      },
      listEventBlocks: async (value) => {
        const command = parseListEventBlocksCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseEventBlockListProjection({
          schemaVersion: 1,
          workId: command.workId,
          eventBlocks: [],
        });
      },
      createSceneOverride: async () => {
        throw new Error(
          "SceneOverride creation is unavailable in a configured manuscript runtime",
        );
      },
      listSceneOverrides: async (value) => {
        const command = parseListSceneOverridesCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseSceneOverrideListProjection({
          schemaVersion: 1,
          workId: command.workId,
          sceneOverrides: [],
        });
      },
      startWritingSession: async () => {
        throw new Error(
          "WritingSession is unavailable in a configured manuscript runtime",
        );
      },
      stopWritingSession: async () => {
        throw new Error(
          "WritingSession is unavailable in a configured manuscript runtime",
        );
      },
      startFocusCycle: async () => {
        throw new Error(
          "FocusCycle is unavailable in a configured manuscript runtime",
        );
      },
      stopFocusCycle: async () => {
        throw new Error(
          "FocusCycle is unavailable in a configured manuscript runtime",
        );
      },
      listWorkActivity: async (value) => {
        const command = parseListWorkActivityCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseWorkActivityProjection({
          schemaVersion: 1,
          workId: command.workId,
          activeSessionId: null,
          activeFocusCycleId: null,
          sessions: [],
          focusCycles: [],
        });
      },
      listDocumentRevisions: async (value) => {
        const command = parseListDocumentRevisionsCommand(value);
        const document = workspaceCatalog.works
          .find((work) => work.workId === command.workId)
          ?.documents.find(
            (candidate) => candidate.documentId === command.documentId,
          );
        if (document === undefined) {
          throw new Error(
            `Work/document boundary violation: ${command.workId}/${command.documentId}`,
          );
        }
        return parseDocumentRevisionListProjection({
          schemaVersion: 1,
          workId: command.workId,
          documentId: command.documentId,
          revisions: [],
        });
      },
      restoreDocumentRevision: async () => {
        throw new Error(
          "Document revision restore is unavailable in a configured manuscript runtime",
        );
      },
      createWorkSnapshot: async () => {
        throw new Error(
          "WorkSnapshot creation is unavailable in a configured manuscript runtime",
        );
      },
      listWorkSnapshots: async (value) => {
        const command = parseListWorkSnapshotsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseWorkSnapshotListProjection({
          schemaVersion: 1,
          workId: command.workId,
          snapshots: [],
        });
      },
      getBackupStatus: async () => ({
        schemaVersion: 1,
        lastVerified: null,
      }),
      createBackupBundle: async () => {
        throw new Error(
          "Backup creation is unavailable in a configured manuscript runtime",
        );
      },
      restoreBackupBundle: async () => {
        throw new Error(
          "Backup restore is unavailable in a configured manuscript runtime",
        );
      },
      close: () => undefined,
    };
  }
  activeApplicationRuntime = applicationRuntime;
  const manuscriptRuntime = applicationRuntime.manuscript;

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
  ipcMain.handle(WORKSPACE_CATALOG_CHANNEL, () => {
    return applicationRuntime.getWorkspaceCatalog();
  });
  ipcMain.handle(
    WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.activateWorkspaceLocation(
        parseActivateWorkspaceLocationCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createWork(
        parseCreateWorkCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createFirstWork(
        parseCreateFirstWorkCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_DOCUMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createDocument(
        parseCreateDocumentCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CAPTURE_RESUME_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.captureWorkspaceResume(
        parseCaptureWorkspaceResumeCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createEventBlock(
        parseCreateEventBlockCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listEventBlocks(
        parseListEventBlocksCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createSceneOverride(
        parseCreateSceneOverrideCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneOverrides(
        parseListSceneOverridesCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_LIST_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listWorkActivity(
        parseListWorkActivityCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_START_SESSION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.startWritingSession(
        parseStartWritingSessionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_STOP_SESSION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.stopWritingSession(
        parseStopWritingSessionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_START_FOCUS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.startFocusCycle(
        parseStartFocusCycleCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_STOP_FOCUS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.stopFocusCycle(
        parseStopFocusCycleCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listDocumentRevisions(
        parseListDocumentRevisionsCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.restoreDocumentRevision(
        parseRestoreDocumentRevisionCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createWorkSnapshot(
        parseCreateWorkSnapshotCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listWorkSnapshots(
        parseListWorkSnapshotsCommand(value),
      );
    },
  );
  ipcMain.handle(
    BACKUP_GET_STATUS_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getBackupStatus();
    },
  );
  ipcMain.handle(
    BACKUP_CREATE_CHANNEL,
    async (event) => {
      assertTrustedRendererSender(event);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selected = await dialog.showSaveDialog(owner, {
        title: "새 백업",
        buttonLabel: "백업 만들기",
      });
      if (selected.canceled || selected.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const summary = await applicationRuntime.createBackupBundle(
        selected.filePath,
      );
      return { schemaVersion: 1, status: "completed", summary } as const;
    },
  );
  ipcMain.handle(
    BACKUP_RESTORE_CHANNEL,
    async (event) => {
      assertTrustedRendererSender(event);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selectedBundle = await dialog.showOpenDialog(owner, {
        title: "복원할 백업 선택",
        buttonLabel: "백업 선택",
        properties: ["openDirectory"],
      });
      const bundlePath = selectedBundle.filePaths[0];
      if (selectedBundle.canceled || bundlePath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const selectedTarget = await dialog.showSaveDialog(owner, {
        title: "복원할 새 작업실 위치",
        buttonLabel: "새 위치에 복원",
      });
      if (selectedTarget.canceled || selectedTarget.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const summary = await applicationRuntime.restoreBackupBundle(
        bundlePath,
        selectedTarget.filePath,
      );
      return { schemaVersion: 1, status: "completed", summary } as const;
    },
  );
  ipcMain.handle(
    MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
    async (event) => {
      assertTrustedRendererSender(event);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selectedSource = await dialog.showOpenDialog(owner, {
        title: "기존 이음 에디터 폴더 선택",
        buttonLabel: "원본 폴더 선택",
        properties: ["openDirectory"],
      });
      const sourceRootPath = selectedSource.filePaths[0];
      if (selectedSource.canceled || sourceRootPath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const selectedTarget = await dialog.showSaveDialog(owner, {
        title: "가져오기 리허설을 저장할 새 위치",
        buttonLabel: "리허설 위치 선택",
      });
      if (selectedTarget.canceled || selectedTarget.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const profile = parseLegacyLoreImportProfile(
        JSON.parse(
          readFileSync(
            process.env.EUM_STUDIO_LEGACY_LORE_IMPORT_PROFILE_PATH ??
              path.join(
                app.getAppPath(),
                "config",
                "legacy-lore-import.json",
              ),
            "utf8",
          ),
        ),
      );
      const summary = await runLegacyLoreImportRehearsal({
        sourceRootPath,
        targetRootPath: selectedTarget.filePath,
        studioDisplayName: app.getName(),
        locale: app.getLocale(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        profile,
      });
      return { schemaVersion: 1, status: "completed", summary } as const;
    },
  );
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
    autoHideMenuBar: true,
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

app.on("will-quit", () => {
  activeApplicationRuntime?.close();
  activeApplicationRuntime = null;
});
