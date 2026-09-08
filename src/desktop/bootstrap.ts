import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  safeStorage,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { ApplicationRuntime } from "./runtime/application-runtime-contract";
import { sendManuscriptCloseRequest } from "./ipc/send-manuscript-close-request";
import { createConfiguredApplicationRuntime } from "./runtime/create-configured-application-runtime";
import { loadApplicationProfiles } from "./runtime/load-application-profiles";

if (process.env.EUM_STUDIO_DISABLE_SANDBOX === "1") {
  app.commandLine.appendSwitch("no-sandbox");
}

import { registerStudioIpc } from "./ipc/register-studio-ipc";
import { createApplicationRuntimes } from "./runtime/create-application-runtimes";
import { pickEditorRuntime } from "./runtime/editor-runtime";

import {
  createAssistantConnectorExecutor
} from "../application/assistant/assistant-connector-manifest";
import {
  createChatGptOAuthAssistantConnectionId
} from "../application/assistant/chatgpt-oauth";
import {
  type ManuscriptCloseRequest,
} from "../application/contracts/studio-bridge";
import {
  normalizeImportedManuscriptText,
} from "../application/editor/manuscript-text-import";
import {
  parseLegacyBrowserSourceExportProfile,
} from "../application/migration/browser-source-export";
import {
  parseLegacyLoreImportProfile,
} from "../application/migration/legacy-lore-import-profile";
import {
  parsePublishingPartnerCsvSelectionProjection
} from "../application/publishing/publishing-partner-csv-import";
import {
  parsePublishingSubmissionCsvSelectionProjection
} from "../application/publishing/publishing-submission-csv-import";
import {
  parseLocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import { entityId } from "../domain/writing";
import {
  openNodeAssistantConnectionStore,
} from "../platform/assistant/node-assistant-connection-store";
import {
  createNodeChatGptCodexClient,
} from "../platform/assistant/node-chatgpt-codex";
import {
  createNodeChatGptOAuthLogin,
  openNodeChatGptOAuthStore,
} from "../platform/assistant/node-chatgpt-oauth";
import { createStructuredJsonHttpConnector } from "../platform/assistant/structured-json-http-connector";
import { exportNodeCanonicalMarkdownBundle } from "../platform/export/node-canonical-markdown-export";
import { exportNodeManuscriptText } from "../platform/export/node-manuscript-text-export";
import { openNodeLocalMediaLibrary } from "../platform/music/node-local-media-library";
import { createNodeLocalMediaResponse } from "../platform/music/node-local-media-response";
import { openNodeYouTubeMusicConnectionStore } from "../platform/music/node-youtube-music-connection-store";
import { createNodeYouTubeMusicSearchClient } from "../platform/music/node-youtube-music-search";
import { createGoogleMailConnector } from "../platform/publishing/google-mail-connector";
import {
  openNodePublishingMailConnectionStore,
} from "../platform/publishing/node-publishing-mail-connection-store";
import {
  openNodePublishingMailScheduleStore,
} from "../platform/publishing/node-publishing-mail-schedule-store";
import { openNodeUiPreferencesStore } from "../platform/settings/node-ui-preferences-store";
import {
  createChatGptOAuthWindowLauncher,
  createChatGptOAuthWindowOptions,
} from "./chatgpt-oauth-window";
import { runLegacyLoreImportRehearsal } from "./legacy-lore-import-rehearsal";
import {
  openLocalWorkspaceRuntime,
  type LocalWorkspaceRuntime,
} from "./local-workspace-runtime";
import { createPublishingMailRuntime } from "./publishing-mail-runtime";
import { createPublishingMailScheduleRuntime } from "./publishing-mail-schedule-runtime";
import {
  canActivateMainWindow,
  createSecureWebPreferences,
  isAllowedRendererNavigation,
  isTrustedRendererIpcSender,
  shouldDisableHardwareAcceleration,
  shouldRecoverMainWindowRenderer,
  shouldShowMainWindow,
} from "./window-policy";
import {
  withYouTubePlayerReferer,
  YOUTUBE_PLAYER_REQUEST_FILTER,
} from "./youtube-player-request-policy";

let mainWindow: BrowserWindow | null = null;
let configuredRendererTarget: string | null =
  null;
let pendingCloseRequest:
  ManuscriptCloseRequest | null = null;
let allowMainWindowClose = false;
let applicationHandlersRegistered = false;
let applicationIsQuitting = false;
let rendererRecoveryPromise: Promise<void> | null = null;
let activeApplicationRuntime: ApplicationRuntime | null = null;
let activeYouTubePlayerReferer: string | null = null;

protocol.registerSchemesAsPrivileged([{
  scheme: "eum-media",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

function mediaTypeForWorkCover(filePath: string): string {
  switch (path.extname(filePath).toLocaleLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    default:
      throw new Error("Unsupported Work cover image type");
  }
}

function configuredLocalMediaSelectionPaths(value: string): readonly string[] {
  const parsed = JSON.parse(value) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string" || !path.isAbsolute(entry))
  ) {
    throw new Error(
      "EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS must be a JSON array of absolute paths",
    );
  }
  return Object.freeze([...parsed]);
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
  const { ephemeralDocumentProfile, documentProfile, manuscriptInputProfile, formattingProfile, appSettingsProfile, musicSettingsProfile, assistantDestinationProfile, assistantConnectorProfile, chatGptOAuthProfile, youtubeMusicProfile, publishingMailConnectorProfile, preflightProfile, fragmentProfile, foreshadowPointProfile, journalProfile, batchingPolicy, crashGate, recoveryApplyProfile, resumeCheckpointProfile, useEphemeralTestWorkspace, hasConfiguredManuscriptRuntime, configuredLocalWorkspaceRoot, localWorkspaceBackupProfile } = loadApplicationProfiles({
    environment: process.env,
    getAppPath: () => app.getAppPath(),
    onYouTubePlayerReferer: (referer) => { activeYouTubePlayerReferer = referer; },
  });
  const localMediaLibraryRootDirectoryPath =
    configuredLocalWorkspaceRoot === undefined
      ? path.join(app.getPath("userData"), "local-media-library-v1")
      : path.join(
          configuredLocalWorkspaceRoot,
          ...localWorkspaceBackupProfile.localMedia.restoreRootSegments,
        );
  const youtubeMusicConnectionStore =
    await openNodeYouTubeMusicConnectionStore({
      rootDirectoryPath: path.join(
        app.getPath("userData"),
        "youtube-music-connection-v1",
      ),
      cipher: {
        isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
        encryptString: (plainText) => safeStorage.encryptString(plainText),
        decryptString: (encrypted) =>
          safeStorage.decryptString(Buffer.from(encrypted)),
      },
    });
  const localMediaLibrary = await openNodeLocalMediaLibrary({
    rootDirectoryPath: localMediaLibraryRootDirectoryPath,
    checksum: localWorkspaceBackupProfile.checksum,
  });
  protocol.handle("eum-media", async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405 });
    }
    try {
      const source = await localMediaLibrary.resolvePlaybackUrl(request.url);
      return createNodeLocalMediaResponse({
        filePath: source.filePath,
        mediaType: source.mediaType,
        method: request.method,
        rangeHeader: request.headers.get("range"),
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  const uiPreferencesStore = await openNodeUiPreferencesStore({
    rootDirectoryPath: path.join(app.getPath("userData"), "ui-preferences-v2"),
  });
  const chatGptOAuthStore = await openNodeChatGptOAuthStore({
    rootDirectoryPath: path.join(app.getPath("userData"), "chatgpt-oauth-v1"),
    providerId: chatGptOAuthProfile.providerId,
    displayName: chatGptOAuthProfile.displayName,
    modelId: chatGptOAuthProfile.upstream.model,
    cipher: {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (plainText) => safeStorage.encryptString(plainText),
      decryptString: (encrypted) =>
        safeStorage.decryptString(Buffer.from(encrypted)),
    },
  });
  const chatGptOAuthWindowLauncher = createChatGptOAuthWindowLauncher({
    createWindow: () => {
      const window = new BrowserWindow(
        createChatGptOAuthWindowOptions(mainWindow ?? undefined),
      );
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      return {
        close: () => window.close(),
        focus: () => window.focus(),
        isDestroyed: () => window.isDestroyed(),
        loadURL: (url) => window.loadURL(url),
        onceClosed: (listener) => {
          window.once("closed", listener);
        },
      };
    },
  });
  const chatGptOAuthLogin = createNodeChatGptOAuthLogin({
    profile: chatGptOAuthProfile,
    store: chatGptOAuthStore,
    openExternal: (url) => chatGptOAuthWindowLauncher.open(url),
  });
  const chatGptCodexClient = createNodeChatGptCodexClient({
    profile: chatGptOAuthProfile,
    store: chatGptOAuthStore,
  });
  const chatGptAssistantConnectionId =
    createChatGptOAuthAssistantConnectionId(chatGptOAuthProfile.providerId);
  const youtubeMusicSearchClient = createNodeYouTubeMusicSearchClient({
    profile: youtubeMusicProfile,
    store: youtubeMusicConnectionStore,
  });
  let applicationRuntime: ApplicationRuntime;
  if (
    !hasConfiguredManuscriptRuntime &&
    !useEphemeralTestWorkspace
  ) {
    const configuredRoot = configuredLocalWorkspaceRoot;
    const configuredAssistantConnectionRoot =
      process.env.EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH;
    if (
      configuredAssistantConnectionRoot !== undefined &&
      !path.isAbsolute(configuredAssistantConnectionRoot)
    ) {
      throw new Error(
        "EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH must be absolute",
      );
    }
    const configuredPublishingMailConnectionRoot =
      process.env.EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH;
    if (
      configuredPublishingMailConnectionRoot !== undefined &&
      !path.isAbsolute(configuredPublishingMailConnectionRoot)
    ) {
      throw new Error(
        "EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH must be absolute",
      );
    }
    const assistantConnectionStore =
      await openNodeAssistantConnectionStore({
        rootDirectoryPath:
          configuredAssistantConnectionRoot ??
          path.join(app.getPath("userData"), "assistant-connections-v1"),
        cipher: {
          isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
          encryptString: (plainText) => safeStorage.encryptString(plainText),
          decryptString: (encrypted) =>
            safeStorage.decryptString(Buffer.from(encrypted)),
        },
      });
    const publishingMailRootDirectory =
      configuredPublishingMailConnectionRoot ??
      path.join(app.getPath("userData"), "publishing-mail-connection-v1");
    const publishingMailConnectionStore =
      await openNodePublishingMailConnectionStore({
        rootDirectoryPath: publishingMailRootDirectory,
        cipher: {
          isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
          encryptString: (plainText) => safeStorage.encryptString(plainText),
          decryptString: (encrypted) =>
            safeStorage.decryptString(Buffer.from(encrypted)),
        },
      });
    const publishingMailScheduleStore =
      await openNodePublishingMailScheduleStore({
        rootDirectoryPath: publishingMailRootDirectory,
      });
    const assistantConnectorExecutor = createAssistantConnectorExecutor({
      manifestProfile: assistantConnectorProfile,
      adapters: [createStructuredJsonHttpConnector()],
      readConnection: (connectionId) => {
        const connection = assistantConnectionStore.list().connections.find(
          (entry) => entry.connectionId === connectionId,
        );
        if (connection === undefined) {
          throw new Error(`Unknown assistant connection: ${connectionId}`);
        }
        if (connection.connectorKind === null) {
          throw new Error(`Assistant connection kind is not configured: ${connectionId}`);
        }
        return Object.freeze({
          connectionId,
          connectorKind: connection.connectorKind,
          endpoint: connection.endpoint,
          model: connection.model,
          credential: assistantConnectionStore.readCredential(connectionId),
        });
      },
      createReceiptId: () => entityId<"ConnectorReceipt">(randomUUID()),
      now: () => new Date().toISOString(),
    });
    const chatGptContextConnector = assistantConnectorProfile.connectors.find(
      (entry) => entry.connectorKind === chatGptOAuthProfile.providerId,
    );
    if (
      chatGptContextConnector === undefined ||
      !chatGptContextConnector.capabilities.includes("canon.review") ||
      !chatGptContextConnector.capabilities.includes("continuity.review") ||
      !chatGptContextConnector.capabilities.includes("narrative.digest")
    ) {
      throw new Error(
        `Assistant connector manifest is missing Canon/Continuity/NarrativeDigest context budget: ${chatGptOAuthProfile.providerId}`,
      );
    }
    const localWorkspaceDefaults = parseLocalWorkspaceDefaults(
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
    );
    const localRuntime: LocalWorkspaceRuntime =
      await openLocalWorkspaceRuntime({
        rootDirectoryPath:
          configuredRoot ??
          path.join(app.getPath("userData"), "workspace-v1"),
        localMediaLibraryRootDirectoryPath,
        studioDisplayName: app.getName(),
        locale: app.getLocale(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        batchingPolicy: localWorkspaceDefaults.manuscriptBatchingPolicy,
        formattingProfile,
        appSettingsProfile,
        musicSettingsProfile,
        preflightProfile,
        fragmentProfile,
        foreshadowPointProfile,
        assistantDestinationProfile,
        executeAssistantVocabularySuggestion: async (input) => {
          const requestFingerprint = `sha256:${createHash("sha256")
            .update(JSON.stringify({
              query: input.query,
              context: input.context,
            }))
            .digest("hex")}`;
          if (input.connectionId === chatGptAssistantConnectionId) {
            const startedAt = new Date().toISOString();
            const payload = await chatGptCodexClient.suggestVocabulary({
              query: input.query,
              context: input.context,
            });
            return Object.freeze({
              receipt: Object.freeze({
                schemaVersion: 1 as const,
                receiptId: entityId<"ConnectorReceipt">(randomUUID()),
                requestId: entityId<"AssistantConnectorRequest">(
                  input.requestId,
                ),
                connectionId: input.connectionId,
                connectorKind: chatGptOAuthProfile.providerId,
                operation: "vocabulary-suggestions" as const,
                requestFingerprint,
                startedAt,
                completedAt: new Date().toISOString(),
                resultState: "succeeded" as const,
              }),
              payload,
            });
          }
          const execution = await assistantConnectorExecutor.execute({
            signal: input.signal,
            schemaVersion: 1,
            requestId: entityId<"AssistantConnectorRequest">(input.requestId),
            connectionId: input.connectionId,
            capability: "vocabulary-lookup",
            operation: "vocabulary-suggestions",
            requestFingerprint,
            input: Object.freeze({
              query: input.query,
              context: input.context,
            }),
          });
          return Object.freeze({
            receipt: execution.receipt,
            payload: execution.payload,
          });
        },
        executeAssistantExternalSettingReview: async (input) => {
          const connectorInput = Object.freeze({
            query: input.query,
            manuscript: Object.freeze({
              documentId: input.sourceRange.documentId,
              documentRevisionId: input.sourceRange.documentRevisionId,
              from: input.sourceRange.from,
              to: input.sourceRange.to,
              text: input.manuscript,
            }),
            settings: input.settings,
          });
          const requestFingerprint = `sha256:${createHash("sha256")
            .update(JSON.stringify(connectorInput))
            .digest("hex")}`;
          if (input.connectionId === chatGptAssistantConnectionId) {
            const startedAt = new Date().toISOString();
            const payload = await chatGptCodexClient.reviewSettings(
              connectorInput,
            );
            return Object.freeze({
              receipt: Object.freeze({
                schemaVersion: 1 as const,
                receiptId: entityId<"ConnectorReceipt">(randomUUID()),
                requestId: entityId<"AssistantConnectorRequest">(
                  input.requestId,
                ),
                connectionId: input.connectionId,
                connectorKind: chatGptOAuthProfile.providerId,
                operation: "setting-review" as const,
                requestFingerprint,
                startedAt,
                completedAt: new Date().toISOString(),
                resultState: "succeeded" as const,
              }),
              payload,
            });
          }
          const execution = await assistantConnectorExecutor.execute({
            signal: input.signal,
            schemaVersion: 1,
            requestId: entityId<"AssistantConnectorRequest">(input.requestId),
            connectionId: input.connectionId,
            capability: "lore-review",
            operation: "setting-review",
            requestFingerprint,
            input: connectorInput,
          });
          return Object.freeze({
            receipt: execution.receipt,
            payload: execution.payload,
          });
        },
        characterExtraction: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ paragraphs }) =>
            chatGptCodexClient.extractCharacters(paragraphs),
        }),
        canonReview: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          contextTokenBudget: chatGptContextConnector.contextTokenBudget,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.reviewCanon(input),
        }),
        continuityReview: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          contextTokenBudget: chatGptContextConnector.contextTokenBudget,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.reviewContinuity(input),
        }),
        narrativeDigest: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          contextTokenBudget: chatGptContextConnector.contextTokenBudget,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.generateNarrativeDigest(input),
        }),
        sceneInformationUpdate: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.updateSceneInformation(input),
        }),
        characterGeneration: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ brief }) =>
            chatGptCodexClient.generateCharacters(brief),
        }),
        sceneExtraction: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ paragraphs }) =>
            chatGptCodexClient.extractScenes(paragraphs),
        }),
        sceneDraft: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ context }) => chatGptCodexClient.draftScene(context),
        }),
        sceneMusicSearch: Object.freeze({
          providerId: youtubeMusicProfile.providerId,
          searchLimit: youtubeMusicProfile.searchLimit,
          tracksPerOption: youtubeMusicProfile.videosPerOption,
          isConnected: () =>
            youtubeMusicConnectionStore.getStatus().apiKeyConfigured,
          execute: ({ query, limit }) =>
            youtubeMusicSearchClient.searchVideos(query, limit),
        }),
        executePublishingAssistantIntent: async (input) => {
          const connectorInput = Object.freeze({
            statement: input.statement,
            currentDate: input.currentDate,
            registry: input.registry,
          });
          const execution = await assistantConnectorExecutor.execute({
            schemaVersion: 1,
            requestId: input.requestId,
            connectionId: input.connectionId,
            capability: "publishing-operations",
            operation: "publishing-intent",
            requestFingerprint: `sha256:${createHash("sha256")
              .update(JSON.stringify(connectorInput))
              .digest("hex")}`,
            input: connectorInput,
          });
          return Object.freeze({
            receipt: execution.receipt,
            payload: execution.payload,
          });
        },
        emptyDocumentProfile: ephemeralDocumentProfile,
        defaults: localWorkspaceDefaults,
        backupProfile: localWorkspaceBackupProfile,
      });
    const publishingMailRuntime = createPublishingMailRuntime({
      profile: publishingMailConnectorProfile,
      adapters: [createGoogleMailConnector()],
      openAuthorizationUrl: (url) => shell.openExternal(url),
      readConnection: () => publishingMailConnectionStore.readConnection(),
      saveConnection: (value) =>
        publishingMailConnectionStore.saveConnection(value),
      saveLastSyncedAt: (value) =>
        publishingMailConnectionStore.saveLastSyncedAt(value),
      clearConnection: () => publishingMailConnectionStore.clear(),
      listPartnerSenderAddresses: async () => {
        const projection = await localRuntime.listPublishingPartners({
          schemaVersion: 1,
        });
        return projection.partners.map((partner) => partner.email);
      },
      listCandidateSourceKeys: async () => {
        const projection = await localRuntime.listPublishingMailCandidates({
          schemaVersion: 1,
        });
        return projection.candidates.map(
          (candidate) => `${candidate.sourceAccountId}\u0000${candidate.messageId}`,
        );
      },
      recordCandidate: async (command) => {
        await localRuntime.recordPublishingMailCandidate(command);
      },
    });
    const publishingMailScheduleRuntime = createPublishingMailScheduleRuntime({
      readSchedule: () => publishingMailScheduleStore.readSchedule(),
      saveSettings: (value) => publishingMailScheduleStore.saveSettings(value),
      recordAttempt: (value) => publishingMailScheduleStore.recordAttempt(value),
      isConnected: () => publishingMailConnectionStore.readConnection() !== null,
      sync: (value) => publishingMailRuntime.sync(value),
    });
    publishingMailScheduleRuntime.reconcile();
    applicationRuntime = {
      manuscript: localRuntime,
      getWorkManuscriptLayoutSettings: (value) =>
        localRuntime.getWorkManuscriptLayoutSettings(value),
      saveWorkManuscriptLayoutSettings: (value) =>
        localRuntime.saveWorkManuscriptLayoutSettings(value),
      getWorkspaceCatalog: () =>
        localRuntime.getWorkspaceCatalog(),
      getDocumentCompletion: (value) =>
        localRuntime.getDocumentCompletion(value),
      completeDocument: (value) =>
        localRuntime.completeDocument(value),
      clearDocumentCompletion: (value) =>
        localRuntime.clearDocumentCompletion(value),
      getWorkFavorites: () =>
        localRuntime.getWorkFavorites(),
      setWorkFavorite: (value) =>
        localRuntime.setWorkFavorite(value),
      getWorkCovers: () =>
        localRuntime.getWorkCovers(),
      saveWorkCover: (value) =>
        localRuntime.saveWorkCover(value),
      activateWorkspaceLocation: (value) =>
        localRuntime.activateWorkspaceLocation(value),
      createWork: (value) =>
        localRuntime.createWork(value),
      createFirstWork: (value) =>
        localRuntime.createFirstWork(value),
      createDocument: (value) =>
        localRuntime.createDocument(value),
      renameWork: (value) =>
        localRuntime.renameWork(value),
      renameDocument: (value) =>
        localRuntime.renameDocument(value),
      retireWork: (value) =>
        localRuntime.retireWork(value),
      retireDocument: (value) =>
        localRuntime.retireDocument(value),
      retireAllDocuments: (value) =>
        localRuntime.retireAllDocuments(value),
      moveDocument: (value) =>
        localRuntime.moveDocument(value),
      createDocumentFolder: (value) =>
        localRuntime.createDocumentFolder(value),
      renameDocumentFolder: (value) =>
        localRuntime.renameDocumentFolder(value),
      placeDocumentInFolder: (value) =>
        localRuntime.placeDocumentInFolder(value),
      retireDocumentFolder: (value) =>
        localRuntime.retireDocumentFolder(value),
      captureWorkspaceResume: (value) =>
        localRuntime.captureWorkspaceResume(value),
      moveRangeToEpisode: (value) =>
        localRuntime.moveRangeToEpisode(value),
      undoMoveRangeToEpisode: (value) =>
        localRuntime.undoMoveRangeToEpisode(value),
      createEventBlock: (value) =>
        localRuntime.createEventBlock(value),
      createAnchorlessEvent: (value) =>
        localRuntime.createAnchorlessEvent(value),
      moveEventBlock: (value) =>
        localRuntime.moveEventBlock(value),
      linkEventSource: (value) =>
        localRuntime.linkEventSource(value),
      replaceEventSource: (value) =>
        localRuntime.replaceEventSource(value),
      retireEventSource: (value) =>
        localRuntime.retireEventSource(value),
      listEventBlocks: (value) =>
        localRuntime.listEventBlocks(value),
      listEventRail: (value) =>
        localRuntime.listEventRail(value),
      createSceneOverride: (value) =>
        localRuntime.createSceneOverride(value),
      relocateSceneSegment: (value) =>
        localRuntime.relocateSceneSegment(value),
      listSceneOverrides: (value) =>
        localRuntime.listSceneOverrides(value),
      listSceneProjection: (value) =>
        localRuntime.listSceneProjection(value),
      listSceneCanonContexts: (value) =>
        localRuntime.listSceneCanonContexts(value),
      finalizeSceneCanonCheck: (value) =>
        localRuntime.finalizeSceneCanonCheck(value),
      updateSceneRuleSet: (value) =>
        localRuntime.updateSceneRuleSet(value),
      setSceneEventOverride: (value) =>
        localRuntime.setSceneEventOverride(value),
      rebindSceneMetadata: (value) =>
        localRuntime.rebindSceneMetadata(value),
      prepareSceneDeletion: (value) =>
        localRuntime.prepareSceneDeletion(value),
      deleteScene: (value) => localRuntime.deleteScene(value),
      listSceneTrash: (value) => localRuntime.listSceneTrash(value),
      restoreSceneTrash: (value) => localRuntime.restoreSceneTrash(value),
      undoSceneDeletion: (value) => localRuntime.undoSceneDeletion(value),
      runSceneExtraction: (value) =>
        localRuntime.runSceneExtraction(value),
      listSceneExtractionCandidates: (value) =>
        localRuntime.listSceneExtractionCandidates(value),
      decideSceneExtractionBoundary: (value) =>
        localRuntime.decideSceneExtractionBoundary(value),
      listSceneAnnotations: (value) =>
        localRuntime.listSceneAnnotations(value),
      decideSceneExtractionAnnotation: (value) =>
        localRuntime.decideSceneExtractionAnnotation(value),
      runSceneDraft: (value) => localRuntime.runSceneDraft(value),
      listSceneDraftCandidates: (value) =>
        localRuntime.listSceneDraftCandidates(value),
      updateSceneDraftCandidate: (value) =>
        localRuntime.updateSceneDraftCandidate(value),
      prepareSceneDraftInsertion: (value) =>
        localRuntime.prepareSceneDraftInsertion(value),
      completeSceneDraftInsertion: (value) =>
        localRuntime.completeSceneDraftInsertion(value),
      searchSceneMusicQueues: (value) =>
        localRuntime.searchSceneMusicQueues(value),
      listSceneMusicQueueCandidates: (value) =>
        localRuntime.listSceneMusicQueueCandidates(value),
      selectSceneMusicQueue: (value) =>
        localRuntime.selectSceneMusicQueue(value),
      captureFragment: (value) =>
        localRuntime.captureFragment(value),
      listFragments: (value) =>
        localRuntime.listFragments(value),
      updateFragment: (value) =>
        localRuntime.updateFragment(value),
      recordFragmentUse: (value) =>
        localRuntime.recordFragmentUse(value),
      retireFragment: (value) =>
        localRuntime.retireFragment(value),
      createManuscriptAnnotation: (value) =>
        localRuntime.createManuscriptAnnotation(value),
      listManuscriptAnnotations: (value) =>
        localRuntime.listManuscriptAnnotations(value),
      updateManuscriptAnnotation: (value) =>
        localRuntime.updateManuscriptAnnotation(value),
      retireManuscriptAnnotation: (value) =>
        localRuntime.retireManuscriptAnnotation(value),
      createCharacter: (value) =>
        localRuntime.createCharacter(value),
      listCharacters: (value) =>
        localRuntime.listCharacters(value),
      updateCharacter: (value) =>
        localRuntime.updateCharacter(value),
      addCharacterEvidence: (value) =>
        localRuntime.addCharacterEvidence(value),
      retireCharacter: (value) =>
        localRuntime.retireCharacter(value),
      createCharacterRelation: (value) =>
        localRuntime.createCharacterRelation(value),
      listCharacterRelations: (value) =>
        localRuntime.listCharacterRelations(value),
      updateCharacterRelation: (value) =>
        localRuntime.updateCharacterRelation(value),
      retireCharacterRelation: (value) =>
        localRuntime.retireCharacterRelation(value),
      createLoreEntry: (value) =>
        localRuntime.createLoreEntry(value),
      listLoreEntries: (value) =>
        localRuntime.listLoreEntries(value),
      updateLoreEntry: (value) =>
        localRuntime.updateLoreEntry(value),
      addLoreEntryEvidence: (value) =>
        localRuntime.addLoreEntryEvidence(value),
      retireLoreEntry: (value) =>
        localRuntime.retireLoreEntry(value),
      createLoreCandidate: (value) =>
        localRuntime.createLoreCandidate(value),
      listLoreCandidates: (value) =>
        localRuntime.listLoreCandidates(value),
      approveLoreCandidate: (value) =>
        localRuntime.approveLoreCandidate(value),
      rejectLoreCandidate: (value) =>
        localRuntime.rejectLoreCandidate(value),
      linkLoreForeshadow: (value) =>
        localRuntime.linkLoreForeshadow(value),
      listLoreForeshadowLinks: (value) =>
        localRuntime.listLoreForeshadowLinks(value),
      unlinkLoreForeshadow: (value) =>
        localRuntime.unlinkLoreForeshadow(value),
      createPublishingPartner: (value) =>
        localRuntime.createPublishingPartner(value),
      listPublishingPartners: (value) =>
        localRuntime.listPublishingPartners(value),
      updatePublishingPartner: (value) =>
        localRuntime.updatePublishingPartner(value),
      createPublishingFormTemplate: (value) =>
        localRuntime.createPublishingFormTemplate(value),
      listPublishingFormTemplates: (value) =>
        localRuntime.listPublishingFormTemplates(value),
      updatePublishingFormTemplate: (value) =>
        localRuntime.updatePublishingFormTemplate(value),
      listPublishingFormResponses: (value) =>
        localRuntime.listPublishingFormResponses(value),
      savePublishingFormResponse: (value) =>
        localRuntime.savePublishingFormResponse(value),
      createPublishingSubmission: (value) =>
        localRuntime.createPublishingSubmission(value),
      listPublishingSubmissions: (value) =>
        localRuntime.listPublishingSubmissions(value),
      updatePublishingSubmission: (value) =>
        localRuntime.updatePublishingSubmission(value),
      createPublishingContract: (value) =>
        localRuntime.createPublishingContract(value),
      listPublishingContracts: (value) =>
        localRuntime.listPublishingContracts(value),
      updatePublishingContract: (value) =>
        localRuntime.updatePublishingContract(value),
      createPublishingPublication: (value) =>
        localRuntime.createPublishingPublication(value),
      listPublishingPublications: (value) =>
        localRuntime.listPublishingPublications(value),
      updatePublishingPublication: (value) =>
        localRuntime.updatePublishingPublication(value),
      createPublishingSettlement: (value) =>
        localRuntime.createPublishingSettlement(value),
      listPublishingSettlements: (value) =>
        localRuntime.listPublishingSettlements(value),
      updatePublishingSettlement: (value) =>
        localRuntime.updatePublishingSettlement(value),
      createPublishingPayment: (value) =>
        localRuntime.createPublishingPayment(value),
      listPublishingPayments: (value) =>
        localRuntime.listPublishingPayments(value),
      updatePublishingPayment: (value) =>
        localRuntime.updatePublishingPayment(value),
      createPublishingSource: (value) =>
        localRuntime.createPublishingSource(value),
      listPublishingSources: (value) =>
        localRuntime.listPublishingSources(value),
      previewPublishingResearch: (value) =>
        localRuntime.previewPublishingResearch(value),
      approvePublishingResearch: (value) =>
        localRuntime.approvePublishingResearch(value),
      runPublishingAssistant: (value) =>
        localRuntime.runPublishingAssistant(value),
      approvePublishingAssistantCandidate: (value) =>
        localRuntime.approvePublishingAssistantCandidate(value),
      setPublishingEvidenceLinks: (value) =>
        localRuntime.setPublishingEvidenceLinks(value),
      applyPublishingPartnerCsvImport: (value) =>
        localRuntime.applyPublishingPartnerCsvImport(value),
      applyPublishingSubmissionCsvImport: (value) =>
        localRuntime.applyPublishingSubmissionCsvImport(value),
      recordPublishingMailCandidate: (value) =>
        localRuntime.recordPublishingMailCandidate(value),
      listPublishingMailCandidates: (value) =>
        localRuntime.listPublishingMailCandidates(value),
      linkPublishingMailCandidate: (value) =>
        localRuntime.linkPublishingMailCandidate(value),
      updatePublishingMailCandidate: (value) =>
        localRuntime.updatePublishingMailCandidate(value),
      reviewPublishingMailCandidate: (value) =>
        localRuntime.reviewPublishingMailCandidate(value),
      getPublishingMailConnection: (value) =>
        publishingMailRuntime.status(value),
      connectPublishingMail: async (value) => {
        await publishingMailRuntime.connect(value);
        await publishingMailScheduleRuntime.runDueIfNeeded();
        return publishingMailRuntime.status({ schemaVersion: 1 });
      },
      syncPublishingMail: (value) =>
        publishingMailScheduleRuntime.sync(value),
      disconnectPublishingMail: async (value) => {
        const projection = await publishingMailRuntime.disconnect(value);
        publishingMailScheduleRuntime.reconcile();
        return projection;
      },
      getPublishingMailSchedule: (value) =>
        publishingMailScheduleRuntime.status(value),
      savePublishingMailSchedule: (value) =>
        publishingMailScheduleRuntime.save(value),
      createPlotThread: (value) =>
        localRuntime.createPlotThread(value),
      listPlotThreads: (value) =>
        localRuntime.listPlotThreads(value),
      getDefaultPlotBoard: (value) =>
        localRuntime.getDefaultPlotBoard(value),
      movePlotPlacement: (value) =>
        localRuntime.movePlotPlacement(value),
      setPlotPlacementStoryTime: (value) =>
        localRuntime.setPlotPlacementStoryTime(value),
      updatePlotThread: (value) =>
        localRuntime.updatePlotThread(value),
      retirePlotThread: (value) =>
        localRuntime.retirePlotThread(value),
      createPlotFromEvent: (value) =>
        localRuntime.createPlotFromEvent(value),
      createEventFromPlot: (value) =>
        localRuntime.createEventFromPlot(value),
      linkPlotEvent: (value) =>
        localRuntime.linkPlotEvent(value),
      unlinkPlotEvent: (value) =>
        localRuntime.unlinkPlotEvent(value),
      listPlotEventLinks: (value) =>
        localRuntime.listPlotEventLinks(value),
      linkPlotThreadSource: (value) =>
        localRuntime.linkPlotThreadSource(value),
      listPlotThreadSources: (value) =>
        localRuntime.listPlotThreadSources(value),
      createForeshadowLine: (value) =>
        localRuntime.createForeshadowLine(value),
      listForeshadowLines: (value) =>
        localRuntime.listForeshadowLines(value),
      updateForeshadowLine: (value) =>
        localRuntime.updateForeshadowLine(value),
      retireForeshadowLine: (value) =>
        localRuntime.retireForeshadowLine(value),
      createForeshadowPoint: (value) =>
        localRuntime.createForeshadowPoint(value),
      listForeshadowPoints: (value) =>
        localRuntime.listForeshadowPoints(value),
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
      getPomodoro: (value) =>
        localRuntime.getPomodoro(value),
      configureAndStartPomodoro: (value) =>
        localRuntime.configureAndStartPomodoro(value),
      pausePomodoro: (value) =>
        localRuntime.pausePomodoro(value),
      resumePomodoro: (value) =>
        localRuntime.resumePomodoro(value),
      reconcilePomodoro: (value) =>
        localRuntime.reconcilePomodoro(value),
      updatePomodoroNote: (value) =>
        localRuntime.updatePomodoroNote(value),
      stopPomodoro: (value) =>
        localRuntime.stopPomodoro(value),
      prepareWorkRecordsExport: (value) =>
        localRuntime.prepareWorkRecordsExport(value),
      getWorkRecordsGoals: (value) =>
        localRuntime.getWorkRecordsGoals(value),
      saveWorkRecordsGoals: (value) =>
        localRuntime.saveWorkRecordsGoals(value),
      getWorkReadthrough: (value) =>
        localRuntime.getWorkReadthrough(value),
      saveWorkReadthrough: (value) =>
        localRuntime.saveWorkReadthrough(value),
      getContinuousReadingProgress: (value) =>
        localRuntime.getContinuousReadingProgress(value),
      saveContinuousReadingProgress: (value) =>
        localRuntime.saveContinuousReadingProgress(value),
      listWorkSchedule: (value) =>
        localRuntime.listWorkSchedule(value),
      listWorkCalendar: (value) =>
        localRuntime.listWorkCalendar(value),
      getStudioToday: (value) =>
        localRuntime.getStudioToday(value),
      createWorkScheduleItem: (value) =>
        localRuntime.createWorkScheduleItem(value),
      updateWorkScheduleItem: (value) =>
        localRuntime.updateWorkScheduleItem(value),
      retireWorkScheduleItem: (value) =>
        localRuntime.retireWorkScheduleItem(value),
      setWorkScheduleCompletion: (value) =>
        localRuntime.setWorkScheduleCompletion(value),
      getAppSettings: () =>
        localRuntime.getAppSettings(),
      saveAppSettings: (value) =>
        localRuntime.saveAppSettings(value),
      getWorkMusicSettings: (value) =>
        localRuntime.getWorkMusicSettings(value),
      saveWorkMusicSettings: (value) =>
        localRuntime.saveWorkMusicSettings(value),
      getWorkSceneAnalysisSettings: (value) =>
        localRuntime.getWorkSceneAnalysisSettings(value),
      saveWorkSceneAnalysisSettings: (value) =>
        localRuntime.saveWorkSceneAnalysisSettings(value),
      getWorkInspirationSettings: (value) =>
        localRuntime.getWorkInspirationSettings(value),
      saveWorkInspirationSettings: (value) =>
        localRuntime.saveWorkInspirationSettings(value),
      getYouTubeMusicConnectionStatus: async () =>
        youtubeMusicConnectionStore.getStatus(),
      saveYouTubeMusicConnection: (value) =>
        youtubeMusicConnectionStore.save(value),
      getWorkQuickMemo: (value) =>
        localRuntime.getWorkQuickMemo(value),
      saveWorkQuickMemo: (value) =>
        localRuntime.saveWorkQuickMemo(value),
      listAssistantConnections: async () =>
        assistantConnectionStore.list(),
      saveAssistantConnection: (value) =>
        assistantConnectionStore.save(value),
      deleteAssistantConnection: (value) =>
        assistantConnectionStore.delete(value),
      listAssistantContextState: (value) =>
        localRuntime.listAssistantContextState(value),
      grantAssistantContextPermission: (value) =>
        localRuntime.grantAssistantContextPermission(value),
      revokeAssistantContextPermission: (value) =>
        localRuntime.revokeAssistantContextPermission(value),
      getAssistantConnectorProfile: () => assistantConnectorProfile,
      getAssistantDestinationProfile: () =>
        localRuntime.getAssistantDestinationProfile(),
      runAssistantVocabularyLookup: (value) =>
        localRuntime.runAssistantVocabularyLookup(value),
      runAssistantVocabularySuggestion: (value) =>
        localRuntime.runAssistantVocabularySuggestion(value),
      cancelAssistantRequest: (value) => localRuntime.cancelAssistantRequest(value),
      runAssistantExternalSettingReview: (value) =>
        localRuntime.runAssistantExternalSettingReview(value),
      runCanonReview: (value) =>
        localRuntime.runCanonReview(value),
      listCanonReviewCandidates: (value) =>
        localRuntime.listCanonReviewCandidates(value),
      updateCanonReviewItem: (value) =>
        localRuntime.updateCanonReviewItem(value),
      resolveCanonReviewItemTarget: (value) =>
        localRuntime.resolveCanonReviewItemTarget(value),
      decideCanonReviewItem: (value) =>
        localRuntime.decideCanonReviewItem(value),
      createContinuityThread: (value) =>
        localRuntime.createContinuityThread(value),
      updateContinuityThread: (value) =>
        localRuntime.updateContinuityThread(value),
      listContinuityThreads: (value) =>
        localRuntime.listContinuityThreads(value),
      resolveContinuityThread: (value) =>
        localRuntime.resolveContinuityThread(value),
      dismissContinuityThread: (value) =>
        localRuntime.dismissContinuityThread(value),
      runContinuityReview: (value) =>
        localRuntime.runContinuityReview(value),
      listContinuityReviewCandidates: (value) =>
        localRuntime.listContinuityReviewCandidates(value),
      updateContinuityReviewItem: (value) =>
        localRuntime.updateContinuityReviewItem(value),
      decideContinuityReviewItem: (value) =>
        localRuntime.decideContinuityReviewItem(value),
      createCharacterKnowledge: (value) =>
        localRuntime.createCharacterKnowledge(value),
      updateCharacterKnowledge: (value) =>
        localRuntime.updateCharacterKnowledge(value),
      supersedeCharacterKnowledge: (value) =>
        localRuntime.supersedeCharacterKnowledge(value),
      retireCharacterKnowledge: (value) =>
        localRuntime.retireCharacterKnowledge(value),
      listCharacterKnowledge: (value) =>
        localRuntime.listCharacterKnowledge(value),
      projectPovCharacterKnowledge: (value) =>
        localRuntime.projectPovCharacterKnowledge(value),
      listAssistantEntityContextPolicies: (value) =>
        localRuntime.listAssistantEntityContextPolicies(value),
      saveAssistantEntityContextPolicy: (value) =>
        localRuntime.saveAssistantEntityContextPolicy(value),
      planAssistantContext: (value) =>
        localRuntime.planAssistantContext(value),
      listAssistantContextManifests: (value) =>
        localRuntime.listAssistantContextManifests(value),
      listAssistantContextActivities: (value) =>
        localRuntime.listAssistantContextActivities(value),
      generateNarrativeDigest: (value) =>
        localRuntime.generateNarrativeDigest(value),
      generateSceneNarrativeDigest: (value) =>
        localRuntime.generateSceneNarrativeDigest(value),
      runAutomaticSceneAnalysis: (value) =>
        localRuntime.runAutomaticSceneAnalysis(value),
      listSceneAnalysisRuns: (value) =>
        localRuntime.listSceneAnalysisRuns(value),
      listNarrativeDigests: (value) =>
        localRuntime.listNarrativeDigests(value),
      regenerateNarrativeDigest: (value) =>
        localRuntime.regenerateNarrativeDigest(value),
      runCharacterExtraction: (value) =>
        localRuntime.runCharacterExtraction(value),
      listCharacterExtractionCandidates: (value) =>
        localRuntime.listCharacterExtractionCandidates(value),
      decideCharacterExtractionItem: (value) =>
        localRuntime.decideCharacterExtractionItem(value),
      runCharacterGeneration: (value) =>
        localRuntime.runCharacterGeneration(value),
      listCharacterGenerationCandidates: (value) =>
        localRuntime.listCharacterGenerationCandidates(value),
      decideCharacterGenerationItem: (value) =>
        localRuntime.decideCharacterGenerationItem(value),
      runAssistantNotationReview: (value) =>
        localRuntime.runAssistantNotationReview(value),
      runAssistantSettingReview: (value) =>
        localRuntime.runAssistantSettingReview(value),
      listDocumentRevisions: (value) =>
        localRuntime.listDocumentRevisions(value),
      readDocumentRevision: (value) =>
        localRuntime.readDocumentRevision(value),
      restoreDocumentRevision: (value) =>
        localRuntime.restoreDocumentRevision(value),
      createWorkSnapshot: (value) =>
        localRuntime.createWorkSnapshot(value),
      listWorkSnapshots: (value) =>
        localRuntime.listWorkSnapshots(value),
      compareWorkSnapshot: (value) =>
        localRuntime.compareWorkSnapshot(value),
      planWorkSnapshotSceneSelection: (value) =>
        localRuntime.planWorkSnapshotSceneSelection(value),
      getManuscriptPreflightSettings: (value) =>
        localRuntime.getManuscriptPreflightSettings(value),
      saveManuscriptPreflightSettings: (value) =>
        localRuntime.saveManuscriptPreflightSettings(value),
      prepareManuscriptTextExport: (value) =>
        localRuntime.prepareManuscriptTextExport(value),
      prepareCanonicalMarkdownExport: (value) =>
        localRuntime.prepareCanonicalMarkdownExport(value),
      getBackupStatus: () =>
        localRuntime.getBackupStatus(),
      createBackupBundle: (bundlePath, mode) =>
        localRuntime.createBackupBundle(bundlePath, mode),
      restoreBackupBundle: (bundlePath, targetPath) =>
        localRuntime.restoreBackupBundle(bundlePath, targetPath),
      close: () => {
        publishingMailScheduleRuntime.close();
        localRuntime.close();
      },
    };
  } else {
    applicationRuntime = await createConfiguredApplicationRuntime({ documentProfile, journalProfile, batchingPolicy, recoveryApplyProfile, resumeCheckpointProfile, crashGate, formattingProfile, publishingMailConnectorProfile, appSettingsProfile, musicSettingsProfile, youtubeMusicConnectionStore, assistantConnectorProfile, assistantDestinationProfile, preflightProfile });
  }
  activeApplicationRuntime = applicationRuntime;
  const manuscriptRuntime = applicationRuntime.manuscript;

  registerStudioIpc({
    ipcMain,
    authorizeSender: assertTrustedRendererSender,
    runtimes: createApplicationRuntimes(applicationRuntime),
    getRuntimeInfo: () => ({
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      architecture: process.arch,
    }),
    editor: {
      runtime: pickEditorRuntime({
        getManuscriptDocumentProfile: () =>
          manuscriptRuntime.getManuscriptDocumentProfile(),
        getManuscriptPersistenceProfile: () =>
          manuscriptRuntime.getManuscriptPersistenceProfile(),
        getManuscriptStartupRecovery: () =>
          manuscriptRuntime.getManuscriptStartupRecovery(),
        getManuscriptResumeCheckpoint: () =>
          manuscriptRuntime.getManuscriptResumeCheckpoint(),
        getManuscriptPreflightSettings: (command) =>
          applicationRuntime.getManuscriptPreflightSettings(command),
        saveManuscriptPreflightSettings: (command) =>
          applicationRuntime.saveManuscriptPreflightSettings(command),
        getContinuousReadingProgress: (command) =>
          applicationRuntime.getContinuousReadingProgress(command),
        saveContinuousReadingProgress: (command) =>
          applicationRuntime.saveContinuousReadingProgress(command),
        saveChangeBatch: (value) => manuscriptRuntime.saveChangeBatch(value),
        saveDocumentChange: (value) =>
          manuscriptRuntime.saveDocumentChange(value),
        saveFormatting: (value) => manuscriptRuntime.saveFormatting(value),
        moveRangeToEpisode: (value) =>
          applicationRuntime.moveRangeToEpisode(value),
        undoMoveRangeToEpisode: (value) =>
          applicationRuntime.undoMoveRangeToEpisode(value),
        getWorkManuscriptLayoutSettings: (value) =>
          applicationRuntime.getWorkManuscriptLayoutSettings(value),
        saveWorkManuscriptLayoutSettings: (value) =>
          applicationRuntime.saveWorkManuscriptLayoutSettings(value),
        applyManuscriptStartupRecovery: (value) =>
          manuscriptRuntime.applyManuscriptStartupRecovery(value),
      }),
      profiles: {
        input: manuscriptInputProfile,
        formatting: formattingProfile,
        preflight: preflightProfile,
      },
      exportText: async (input) => {
        const command = await applicationRuntime.prepareManuscriptTextExport(
          input,
        );
        const owner = mainWindow;
        if (owner === null) {
          throw new Error("Main window is unavailable");
        }
        const selected = await dialog.showSaveDialog(owner, {
          title: "원고 TXT 내보내기",
          buttonLabel: "내보내기",
          defaultPath: command.suggestedFileName,
          filters: [
            {
              name: "텍스트 문서",
              extensions: ["txt"],
            },
          ],
        });
        if (selected.canceled || selected.filePath === "") {
          return { schemaVersion: 1, status: "cancelled" } as const;
        }
        const receipt = await exportNodeManuscriptText({
          finalPath: selected.filePath,
          text: command.text,
        });
        return {
          schemaVersion: 1,
          status: "completed",
          byteLength: receipt.byteLength,
        } as const;
      },
      selectTextImport: async (command) => {
        const owner = mainWindow;
        if (owner === null) {
          throw new Error("Main window is unavailable");
        }
        const configuredFilePath =
          process.env.EUM_STUDIO_MANUSCRIPT_TEXT_IMPORT_PATH;
        const filePath = configuredFilePath === undefined
          ? (await dialog.showOpenDialog(owner, {
              title: "원고 TXT 가져오기",
              buttonLabel: "가져오기",
              properties: ["openFile"],
              filters: [
                {
                  name: "텍스트 문서",
                  extensions: ["txt"],
                },
              ],
            })).filePaths[0]
          : configuredFilePath;
        if (filePath === undefined) {
          return { schemaVersion: 1, status: "cancelled" } as const;
        }
        const content = readFileSync(filePath);
        return {
          schemaVersion: 1,
          status: "selected",
          workId: command.workId,
          documentId: command.documentId,
          documentRevisionId: command.documentRevisionId,
          fileName: path.basename(filePath),
          text: normalizeImportedManuscriptText(content.toString("utf8")),
          byteLength: content.byteLength,
        } as const;
      },
      completeCloseRequest: (result) => {
        const request = pendingCloseRequest;
        if (request === null || request.requestId !== result.requestId) {
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
    },
    profiles: {
      appSettings: appSettingsProfile,
      fragment: fragmentProfile,
      foreshadowPoint: foreshadowPointProfile,
      musicSettings: musicSettingsProfile,
      youtubeMusic: youtubeMusicProfile,
    },
    canonicalMarkdownExport: async (input) => {
      const prepared = await applicationRuntime.prepareCanonicalMarkdownExport(input);
      const owner = mainWindow;
      if (owner === null) throw new Error("Main window is unavailable");
      const configuredRoot = process.env.EUM_STUDIO_CANONICAL_MARKDOWN_EXPORT_ROOT_PATH;
      const baseDirectoryPath = configuredRoot ?? (await dialog.showOpenDialog(owner, {
        title: "별빛 Markdown 내보낼 폴더 선택",
        buttonLabel: "이 폴더에 내보내기",
        properties: ["openDirectory", "createDirectory"],
      })).filePaths[0];
      if (baseDirectoryPath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const receipt = await exportNodeCanonicalMarkdownBundle({
        baseDirectoryPath,
        bundle: prepared,
      });
      return {
        schemaVersion: 1,
        status: "completed",
        directoryName: receipt.directoryName,
        fileCount: receipt.fileCount,
        byteLength: receipt.byteLength,
        sourceManifestHash: receipt.sourceManifestHash,
        bundleManifestHash: receipt.bundleManifestHash,
        entityCounts: prepared.entityCounts,
      } as const;
    },
    activityExportRecords: async (command) => {
      const prepared = await applicationRuntime.prepareWorkRecordsExport(
        command,
      );
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const isJson = prepared.format === "json";
      const selected = await dialog.showSaveDialog(owner, {
        title: isJson
          ? "집필 기록 JSON 내보내기"
          : "집필 기록 CSV 내보내기",
        buttonLabel: "내보내기",
        defaultPath: prepared.suggestedFileName,
        filters: [{
          name: isJson ? "JSON 문서" : "CSV 문서",
          extensions: [prepared.format],
        }],
      });
      if (selected.canceled || selected.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const receipt = await exportNodeManuscriptText({
        finalPath: selected.filePath,
        text: prepared.text,
      });
      return {
        schemaVersion: 1,
        status: "completed",
        byteLength: receipt.byteLength,
        sessionCount: prepared.sessionCount,
      } as const;
    },
    assistant: {
      getOAuthStatus: () => chatGptOAuthStore.getStatus(),
      startOAuthLogin: () => chatGptOAuthLogin.startLogin(),
      runChat: (command) => chatGptCodexClient.chat(command.messages),
    },
    backup: {
      create: async (command) => {
        const owner = mainWindow;
        if (owner === null) {
          throw new Error("Main window is unavailable");
        }
        const selected = await dialog.showSaveDialog(owner, {
          title: command.mode === "manuscript-only" ? "원고 백업 · 미디어 미포함" : "새 백업",
          buttonLabel: "백업 만들기",
        });
        if (selected.canceled || selected.filePath === "") {
          return { schemaVersion: 1, status: "cancelled" } as const;
        }
        const summary = await applicationRuntime.createBackupBundle(
          selected.filePath,
          command.mode,
        );
        return { schemaVersion: 1, status: "completed", summary } as const;
      },
      restore: async () => {
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
    },
    uiPreferences: {
      get: () => uiPreferencesStore.get(),
      save: (command) => uiPreferencesStore.save(command),
    },
    musicPlayback: {
      searchVideos: async (command) => Object.freeze({
        schemaVersion: 1,
        query: command.query,
        videos: await youtubeMusicSearchClient.searchVideos(
          command.query,
          youtubeMusicProfile.searchLimit,
        ),
      }),
      selectLocalMedia: async (command) => {
        const configuredPaths =
          process.env.EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS;
        let filePaths: readonly string[];
        if (configuredPaths !== undefined) {
          filePaths = configuredLocalMediaSelectionPaths(configuredPaths);
        } else {
          const owner = mainWindow;
          if (owner === null) throw new Error("Main window is unavailable");
          const selection = await dialog.showOpenDialog(owner, {
            title: command.storageMode === "external-reference"
              ? "미디어 원본 위치 연결"
              : "미디어를 앱에 가져오기",
            buttonLabel: command.storageMode === "external-reference"
              ? "연결"
              : "가져오기",
            properties: ["openFile", "multiSelections"],
            filters: [{ name: "미디어 파일", extensions: ["mp3", "mp4"] }],
          });
          if (selection.canceled) {
            return Object.freeze({ schemaVersion: 1, status: "cancelled" });
          }
          filePaths = selection.filePaths;
        }
        if (filePaths.length === 0) {
          return Object.freeze({ schemaVersion: 1, status: "cancelled" });
        }
        return Object.freeze({
          schemaVersion: 1,
          status: "selected",
          workId: command.workId,
          tracks: await localMediaLibrary.register({
            workId: command.workId,
            storageMode: command.storageMode,
            filePaths,
          }),
        });
      },
      inspectLocalMedia: (command) => localMediaLibrary.inspect(command),
      relinkLocalMedia: async (command) => {
        const configuredPath =
          process.env.EUM_STUDIO_LOCAL_MEDIA_RELINK_PATH;
        let filePath: string | undefined;
        if (configuredPath !== undefined) {
          if (!path.isAbsolute(configuredPath)) {
            throw new Error(
              "EUM_STUDIO_LOCAL_MEDIA_RELINK_PATH must be absolute",
            );
          }
          filePath = configuredPath;
        } else {
          const owner = mainWindow;
          if (owner === null) throw new Error("Main window is unavailable");
          const selection = await dialog.showOpenDialog(owner, {
            title: "연결할 미디어 원본 선택",
            buttonLabel: "다시 연결",
            properties: ["openFile"],
            filters: [{ name: "미디어 파일", extensions: ["mp3", "mp4"] }],
          });
          if (selection.canceled) {
            return Object.freeze({
              schemaVersion: 1,
              status: "cancelled",
            });
          }
          filePath = selection.filePaths[0];
        }
        if (filePath === undefined) {
          return Object.freeze({
            schemaVersion: 1,
            status: "cancelled",
          });
        }
        return Object.freeze({
          schemaVersion: 1,
          status: "relinked",
          availability: await localMediaLibrary.relink({
            ...command,
            filePath,
          }),
        });
      },
    },
    migration: {
      runLegacyLoreRehearsal: async () => {
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
        const selectedBrowserBundle = await dialog.showOpenDialog(owner, {
          title: "기존 브라우저 데이터 내보내기 선택",
          buttonLabel: "브라우저 내보내기 선택",
          properties: ["openFile"],
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        const browserExportBundlePath = selectedBrowserBundle.filePaths[0];
        if (
          selectedBrowserBundle.canceled ||
          browserExportBundlePath === undefined
        ) {
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
        const browserExportProfile = parseLegacyBrowserSourceExportProfile(
          JSON.parse(
            readFileSync(
              process.env
                .EUM_STUDIO_LEGACY_BROWSER_SOURCE_EXPORT_PROFILE_PATH ??
                path.join(
                  app.getAppPath(),
                  "config",
                  "legacy-browser-source-export.json",
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
          browserExportBundlePath,
          browserExportProfile,
        });
        return { schemaVersion: 1, status: "completed", summary } as const;
      },
    },
    publishing: {
      selectPartnerCsv: async () => {
        const owner = mainWindow;
        if (owner === null) throw new Error("Main window is unavailable");
        const selected = await dialog.showOpenDialog(owner, {
          title: "투고처 CSV 선택",
          buttonLabel: "CSV 선택",
          properties: ["openFile"],
          filters: [{ name: "CSV 문서", extensions: ["csv"] }],
        });
        const filePath = selected.filePaths[0];
        if (selected.canceled || filePath === undefined) {
          return parsePublishingPartnerCsvSelectionProjection({
            schemaVersion: 1,
            status: "cancelled",
          });
        }
        return parsePublishingPartnerCsvSelectionProjection({
          schemaVersion: 1,
          status: "selected",
          fileName: path.basename(filePath),
          csvText: readFileSync(filePath, "utf8"),
        });
      },
      selectSubmissionCsv: async () => {
        const owner = mainWindow;
        if (owner === null) throw new Error("Main window is unavailable");
        const selected = await dialog.showOpenDialog(owner, {
          title: "투고 이력 CSV 선택",
          buttonLabel: "CSV 선택",
          properties: ["openFile"],
          filters: [{ name: "CSV 문서", extensions: ["csv"] }],
        });
        const filePath = selected.filePaths[0];
        if (selected.canceled || filePath === undefined) {
          return parsePublishingSubmissionCsvSelectionProjection({
            schemaVersion: 1,
            status: "cancelled",
          });
        }
        return parsePublishingSubmissionCsvSelectionProjection({
          schemaVersion: 1,
          status: "selected",
          fileName: path.basename(filePath),
          csvText: readFileSync(filePath, "utf8"),
        });
      },
    },
    workspace: {
      selectCover: async (command) => {
        const owner = mainWindow;
        if (owner === null) throw new Error("Main window is unavailable");
        const selected = await dialog.showOpenDialog(owner, {
          title: "작품 표지 선택",
          buttonLabel: "표지 선택",
          properties: ["openFile"],
          filters: [
            {
              name: "이미지",
              extensions: [
                "png",
                "jpg",
                "jpeg",
                "webp",
                "gif",
                "avif",
                "bmp",
              ],
            },
          ],
        });
        const filePath = selected.filePaths[0];
        if (selected.canceled || filePath === undefined) return null;
        return applicationRuntime.saveWorkCover({
          schemaVersion: 1,
          workId: command.workId,
          mediaType: mediaTypeForWorkCover(filePath),
          contentBase64: readFileSync(filePath).toString("base64"),
        });
      },
    },
  });
}

function describeDesktopFailure(reason: unknown): string {
  return reason instanceof Error && reason.message.trim().length > 0
    ? reason.message
    : "알 수 없는 데스크톱 오류";
}

function quitAfterDesktopFailure(
  title: string,
  reason: unknown,
): void {
  if (applicationIsQuitting) return;
  applicationIsQuitting = true;
  const detail = describeDesktopFailure(reason);
  console.error(`[eum-studio desktop] ${title}: ${detail}`);
  try {
    dialog.showErrorBox(
      "이음 스튜디오",
      `${title}\n\n${detail}\n\n앱을 다시 실행하면 마지막으로 저장된 원고에서 복구합니다.`,
    );
  } finally {
    app.quit();
  }
}

function activateMainWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  if (shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)) {
    window.show();
    window.focus();
  }
}

function waitForRendererReload(window: BrowserWindow): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const webContents = window.webContents;
    let settled = false;
    const cleanup = () => {
      webContents.removeListener("did-finish-load", handleLoaded);
      webContents.removeListener("did-fail-load", handleFailedLoad);
      webContents.removeListener("render-process-gone", handleRendererGone);
      webContents.removeListener("destroyed", handleDestroyed);
    };
    const finish = (reason?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reason === undefined) resolve();
      else reject(reason);
    };
    const handleLoaded = () => finish();
    const handleFailedLoad = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      _validatedUrl: string,
      isMainFrame: boolean,
    ) => {
      if (!isMainFrame || errorCode === -3) return;
      finish(new Error(
        `Renderer reload failed (${errorCode}): ${errorDescription}`,
      ));
    };
    const handleRendererGone = (
      _event: Electron.Event,
      details: Electron.RenderProcessGoneDetails,
    ) => finish(new Error(
      `Renderer exited again during recovery (${details.reason}, ${details.exitCode})`,
    ));
    const handleDestroyed = () => finish(new Error(
      "Renderer was destroyed during recovery",
    ));

    webContents.once("did-finish-load", handleLoaded);
    webContents.on("did-fail-load", handleFailedLoad);
    webContents.once("render-process-gone", handleRendererGone);
    webContents.once("destroyed", handleDestroyed);
    try {
      webContents.reload();
    } catch (reason) {
      finish(reason);
    }
  });
}

function scheduleRendererRecovery(
  window: BrowserWindow,
  failure: Readonly<{ reason: string; exitCode: number }>,
): void {
  if (!shouldRecoverMainWindowRenderer({
    failedWindowIsCurrent: mainWindow === window,
    isQuitting: applicationIsQuitting || allowMainWindowClose,
    recoveryInProgress: rendererRecoveryPromise !== null,
    windowDestroyed: window.isDestroyed(),
    webContentsDestroyed: window.webContents.isDestroyed(),
  })) return;

  const recovery = waitForRendererReload(window).then(() => {
    if (mainWindow === window && !window.isDestroyed()) {
      pendingCloseRequest = null;
      allowMainWindowClose = false;
      activateMainWindow(window);
    }
  });
  rendererRecoveryPromise = recovery;
  void recovery.then(
    () => undefined,
    (reason) => quitAfterDesktopFailure(
      `화면 프로세스를 복구하지 못했습니다 (${failure.reason}, ${failure.exitCode})`,
      reason,
    ),
  ).finally(() => {
    if (rendererRecoveryPromise === recovery) rendererRecoveryPromise = null;
  });
}

async function activateOrCreateMainWindow(): Promise<void> {
  if (
    applicationIsQuitting ||
    !app.isReady() ||
    !applicationHandlersRegistered
  ) return;
  const window = mainWindow;
  if (
    window !== null &&
    canActivateMainWindow({
      windowDestroyed: window.isDestroyed(),
      webContentsDestroyed: window.webContents.isDestroyed(),
      rendererCrashed: !window.webContents.isDestroyed() &&
        window.webContents.isCrashed(),
    })
  ) {
    activateMainWindow(window);
    return;
  }
  if (
    window !== null &&
    !window.isDestroyed() &&
    !window.webContents.isDestroyed() &&
    window.webContents.isCrashed()
  ) {
    scheduleRendererRecovery(window, { reason: "second-instance", exitCode: 0 });
    return;
  }

  const replacement = await createMainWindow();
  if (window !== null && !window.isDestroyed()) {
    window.destroy();
  }
  activateMainWindow(replacement);
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
    height: 800,
    minHeight: 480,
    minWidth: 640,
    show: false,
    titleBarOverlay: {
      color: "#00000000",
      height: 38,
      symbolColor: "#787878",
    },
    titleBarStyle: "hidden",
    webPreferences: createSecureWebPreferences(preloadPath),
    width: 1200,
  });
  mainWindow = window;

  if (activeYouTubePlayerReferer !== null) {
    const playerReferer = activeYouTubePlayerReferer;
    window.webContents.session.webRequest.onBeforeSendHeaders(
      YOUTUBE_PLAYER_REQUEST_FILTER,
      (details, callback) => {
        callback({
          requestHeaders: withYouTubePlayerReferer(
            details.requestHeaders,
            playerReferer,
          ),
        });
      },
    );
  }

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, requestedTarget) => {
    if (!isAllowedRendererNavigation(requestedTarget, rendererTarget)) {
      event.preventDefault();
    }
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    scheduleRendererRecovery(window, details);
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
    if (
      activeApplicationRuntime?.getWorkspaceCatalog().canCreateFirstWork ===
      true
    ) {
      allowMainWindowClose = true;
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
    sendManuscriptCloseRequest(window.webContents, request);
  });

  try {
    if (configuredRendererUrl === undefined) {
      await window.loadFile(rendererFile);
    } else {
      await window.loadURL(configuredRendererUrl);
    }
  } catch (reason) {
    allowMainWindowClose = true;
    if (!window.isDestroyed()) window.destroy();
    if (mainWindow === window) {
      mainWindow = null;
      configuredRendererTarget = null;
      pendingCloseRequest = null;
      allowMainWindowClose = false;
    }
    throw reason;
  }
  if (
    !window.isDestroyed() &&
    !window.isVisible() &&
    shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)
  ) {
    activateMainWindow(window);
  }

  return window;
}

if (shouldDisableHardwareAcceleration(
  process.env.EUM_STUDIO_HARDWARE_ACCELERATION,
)) {
  app.disableHardwareAcceleration();
}
if (process.env.EUM_STUDIO_DISABLE_SANDBOX !== "1") {
  app.enableSandbox();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  applicationIsQuitting = true;
  app.quit();
} else {
  app.on("second-instance", () => {
    void activateOrCreateMainWindow().catch((reason) => {
      quitAfterDesktopFailure("앱 창을 다시 열지 못했습니다.", reason);
    });
  });
  void app.whenReady().then(async () => {
    await registerApplicationHandlers();
    applicationHandlersRegistered = true;
    mainWindow = await createMainWindow();

    app.on("activate", () => {
      void activateOrCreateMainWindow().catch((reason) => {
        quitAfterDesktopFailure("앱 창을 다시 열지 못했습니다.", reason);
      });
    });
  }).catch((reason) => {
    quitAfterDesktopFailure("앱을 시작하지 못했습니다.", reason);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  applicationIsQuitting = true;
});

app.on("will-quit", () => {
  activeApplicationRuntime?.close();
  activeApplicationRuntime = null;
  activeYouTubePlayerReferer = null;
});
