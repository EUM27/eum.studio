import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_EXPORT_RECORDS_CHANNEL,
  ACTIVITY_LIST_WORK_CHANNEL,
  ACTIVITY_GET_RECORDS_GOALS_CHANNEL,
  ACTIVITY_GET_READTHROUGH_CHANNEL,
  ACTIVITY_GET_POMODORO_CHANNEL,
  ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL,
  ACTIVITY_PAUSE_POMODORO_CHANNEL,
  ACTIVITY_RESUME_POMODORO_CHANNEL,
  ACTIVITY_RECONCILE_POMODORO_CHANNEL,
  ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL,
  ACTIVITY_STOP_POMODORO_CHANNEL,
  ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL,
  ACTIVITY_SAVE_READTHROUGH_CHANNEL,
  ACTIVITY_START_FOCUS_CHANNEL,
  ACTIVITY_START_SESSION_CHANNEL,
  ACTIVITY_STOP_FOCUS_CHANNEL,
  ACTIVITY_STOP_SESSION_CHANNEL,
  ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL,
  ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL,
  ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
  ASSISTANT_CONNECTOR_PROFILE_CHANNEL,
  ASSISTANT_DELETE_CONNECTION_CHANNEL,
  ASSISTANT_DESTINATION_PROFILE_CHANNEL,
  ASSISTANT_LIST_CONNECTIONS_CHANNEL,
  ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
  ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
  ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
  ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
  ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
  ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
  ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
  ASSISTANT_SAVE_CONNECTION_CHANNEL,
  BACKUP_CREATE_CHANNEL,
  BACKUP_GET_STATUS_CHANNEL,
  BACKUP_RESTORE_CHANNEL,
  CHARACTER_ADD_EVIDENCE_CHANNEL,
  CHARACTER_CREATE_CHANNEL,
  CHARACTER_EXTRACTION_LIST_CHANNEL,
  CHARACTER_EXTRACTION_RUN_CHANNEL,
  CHARACTER_GENERATION_LIST_CHANNEL,
  CHARACTER_GENERATION_RUN_CHANNEL,
  CHARACTER_LIST_CHANNEL,
  CHARACTER_RELATION_CREATE_CHANNEL,
  CHARACTER_RELATION_LIST_CHANNEL,
  CHARACTER_RELATION_RETIRE_CHANNEL,
  CHARACTER_RELATION_UPDATE_CHANNEL,
  CHARACTER_RETIRE_CHANNEL,
  CHARACTER_UPDATE_CHANNEL,
  LORE_ENTRY_ADD_EVIDENCE_CHANNEL,
  LORE_ENTRY_CREATE_CHANNEL,
  LORE_ENTRY_LIST_CHANNEL,
  LORE_ENTRY_RETIRE_CHANNEL,
  LORE_ENTRY_UPDATE_CHANNEL,
  LORE_CANDIDATE_APPROVE_CHANNEL,
  LORE_CANDIDATE_CREATE_CHANNEL,
  LORE_CANDIDATE_LIST_CHANNEL,
  LORE_CANDIDATE_REJECT_CHANNEL,
  LORE_FORESHADOW_LINK_CHANNEL,
  LORE_FORESHADOW_LIST_CHANNEL,
  LORE_FORESHADOW_UNLINK_CHANNEL,
  PUBLISHING_PARTNER_CREATE_CHANNEL,
  PUBLISHING_PARTNER_LIST_CHANNEL,
  PUBLISHING_PARTNER_UPDATE_CHANNEL,
  PUBLISHING_SUBMISSION_CREATE_CHANNEL,
  PUBLISHING_SUBMISSION_LIST_CHANNEL,
  PUBLISHING_SUBMISSION_UPDATE_CHANNEL,
  PUBLISHING_CONTRACT_CREATE_CHANNEL,
  PUBLISHING_CONTRACT_LIST_CHANNEL,
  PUBLISHING_CONTRACT_UPDATE_CHANNEL,
  PUBLISHING_PUBLICATION_CREATE_CHANNEL,
  PUBLISHING_PUBLICATION_LIST_CHANNEL,
  PUBLISHING_PUBLICATION_UPDATE_CHANNEL,
  PUBLISHING_SETTLEMENT_CREATE_CHANNEL,
  PUBLISHING_SETTLEMENT_LIST_CHANNEL,
  PUBLISHING_SETTLEMENT_UPDATE_CHANNEL,
  PUBLISHING_PAYMENT_CREATE_CHANNEL,
  PUBLISHING_PAYMENT_LIST_CHANNEL,
  PUBLISHING_PAYMENT_UPDATE_CHANNEL,
  PUBLISHING_SOURCE_CREATE_CHANNEL,
  PUBLISHING_SOURCE_LIST_CHANNEL,
  PUBLISHING_RESEARCH_PREVIEW_CHANNEL,
  PUBLISHING_RESEARCH_APPROVE_CHANNEL,
  PUBLISHING_ASSISTANT_RUN_CHANNEL,
  PUBLISHING_ASSISTANT_APPROVE_CHANNEL,
  PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL,
  PUBLISHING_PARTNER_CSV_SELECT_CHANNEL,
  PUBLISHING_PARTNER_CSV_APPLY_CHANNEL,
  PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL,
  PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL,
  PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL,
  PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL,
  PLOT_CREATE_CHANNEL,
  PLOT_CREATE_EVENT_CHANNEL,
  PLOT_CREATE_FROM_EVENT_CHANNEL,
  PLOT_DEFAULT_BOARD_CHANNEL,
  PLOT_EVENT_LINK_LIST_CHANNEL,
  PLOT_LINK_EVENT_CHANNEL,
  PLOT_LIST_CHANNEL,
  PLOT_MOVE_PLACEMENT_CHANNEL,
  PLOT_SET_STORY_TIME_CHANNEL,
  PLOT_LINK_SOURCE_CHANNEL,
  PLOT_RETIRE_CHANNEL,
  PLOT_SOURCE_LIST_CHANNEL,
  PLOT_UNLINK_EVENT_CHANNEL,
  PLOT_UPDATE_CHANNEL,
  FRAGMENT_CAPTURE_CHANNEL,
  FRAGMENT_LIST_CHANNEL,
  FRAGMENT_PROFILE_CHANNEL,
  FRAGMENT_RECORD_USE_CHANNEL,
  FRAGMENT_RETIRE_CHANNEL,
  FRAGMENT_UPDATE_CHANNEL,
  FORESHADOW_CREATE_LINE_CHANNEL,
  FORESHADOW_CREATE_POINT_CHANNEL,
  FORESHADOW_LIST_LINES_CHANNEL,
  FORESHADOW_LIST_POINTS_CHANNEL,
  FORESHADOW_POINT_PROFILE_CHANNEL,
  FORESHADOW_RETIRE_LINE_CHANNEL,
  FORESHADOW_UPDATE_LINE_CHANNEL,
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  MANUSCRIPT_EXPORT_TEXT_CHANNEL,
  MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
  MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
  MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL,
  MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
  MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
  MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
  MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
  MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
  MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
  MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
  RUNTIME_INFO_CHANNEL,
  QUICK_TOOLS_GET_MEMO_CHANNEL,
  QUICK_TOOLS_SAVE_MEMO_CHANNEL,
  APP_SETTINGS_PROFILE_CHANNEL,
  APP_SETTINGS_GET_CHANNEL,
  APP_SETTINGS_SAVE_CHANNEL,
  SCHEDULE_CREATE_ITEM_CHANNEL,
  SCHEDULE_LIST_CALENDAR_CHANNEL,
  SCHEDULE_LIST_TODAY_CHANNEL,
  SCHEDULE_LIST_WORK_CHANNEL,
  SCHEDULE_RETIRE_ITEM_CHANNEL,
  SCHEDULE_SET_COMPLETION_CHANNEL,
  SCHEDULE_UPDATE_ITEM_CHANNEL,
  STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
  STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
  STRUCTURE_DELETE_SCENE_CHANNEL,
  STRUCTURE_LINK_EVENT_SOURCE_CHANNEL,
  STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
  STRUCTURE_LIST_EVENT_RAIL_CHANNEL,
  STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
  STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
  STRUCTURE_LIST_SCENE_TRASH_CHANNEL,
  STRUCTURE_REBIND_SCENE_METADATA_CHANNEL,
  STRUCTURE_PREPARE_SCENE_DELETION_CHANNEL,
  STRUCTURE_RESTORE_SCENE_TRASH_CHANNEL,
  STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
  STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL,
  STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
  STRUCTURE_UNDO_SCENE_DELETION_CHANNEL,
  STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL,
  STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
  STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL,
  STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
  VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
  VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
  VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
  VERSION_READ_DOCUMENT_REVISION_CHANNEL,
  VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
  VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
  WORKSPACE_FAVORITES_CHANNEL,
  WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
  WORKSPACE_COMPLETE_DOCUMENT_CHANNEL,
  WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
  WORKSPACE_COVERS_CHANNEL,
  WORKSPACE_SELECT_COVER_CHANNEL,
  WORKSPACE_RENAME_DOCUMENT_CHANNEL,
  WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_RENAME_WORK_CHANNEL,
  WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_MOVE_DOCUMENT_CHANNEL,
  WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
  WORKSPACE_RETIRE_DOCUMENT_CHANNEL,
  WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_RETIRE_WORK_CHANNEL,
  WORKSPACE_SET_FAVORITE_CHANNEL,
  createStudioBridge as createStudioBridgeContract,
  isRuntimeInfo,
  type BridgeInvoke,
  type BridgeListen,
} from "./studio-bridge";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
} from "../persistence/change-batch";
import {
  createApplyStartupRecoveryCommand,
} from "../persistence/startup-recovery-contract";
import type { StartupRecoveryCandidate } from "../persistence/prepare-startup-recovery";
import { entityId, type EntityId } from "../../domain/writing";
import {
  createDefaultManuscriptPreflightSettings,
  parseManuscriptPreflightProfile,
} from "../editor/manuscript-preflight";

const ignoreBridgeEvents: BridgeListen =
  () => () => undefined;

function createStudioBridge(
  invoke: BridgeInvoke,
) {
  return createStudioBridgeContract(
    invoke,
    ignoreBridgeEvents,
  );
}

function incompleteDocumentCompletion(
  workId: EntityId<"Work">,
  documentId: EntityId<"Document">,
) {
  return {
    schemaVersion: 1 as const,
    workId,
    documentId,
    revision: 0,
    completedAt: null,
    completedDate: null,
    completedTimeZone: null,
    completedDocumentRevisionId: null,
    state: "incomplete" as const,
    updatedAt: null,
  };
}

describe("studio bridge contract", () => {
  it("uses separate typed Document completion query, complete, and clear channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const projection = {
      schemaVersion: 1 as const,
      workId,
      documentId,
      revision: 1,
      completedAt: "2026-08-21T15:00:00.000Z",
      completedDate: "2026-08-22",
      completedTimeZone: "Asia/Seoul",
      completedDocumentRevisionId: documentRevisionId,
      state: "current" as const,
      updatedAt: "2026-08-21T15:00:00.000Z",
    };
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.workspace.getDocumentCompletion({
      schemaVersion: 1,
      workId,
      documentId,
    })).resolves.toEqual(projection);
    await expect(bridge.workspace.completeDocument({
      schemaVersion: 1,
      workId,
      documentId,
      expectedCompletionRevision: 0,
      expectedDocumentRevisionId: documentRevisionId,
    })).resolves.toEqual(projection);
    await expect(bridge.workspace.clearDocumentCompletion({
      schemaVersion: 1,
      workId,
      documentId,
      expectedCompletionRevision: 1,
    })).resolves.toEqual(projection);
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
      { schemaVersion: 1, workId, documentId },
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      WORKSPACE_COMPLETE_DOCUMENT_CHANNEL,
      {
        schemaVersion: 1,
        workId,
        documentId,
        expectedCompletionRevision: 0,
        expectedDocumentRevisionId: documentRevisionId,
      },
    );
    expect(invoke).toHaveBeenNthCalledWith(
      3,
      WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
      {
        schemaVersion: 1,
        workId,
        documentId,
        expectedCompletionRevision: 1,
      },
    );
  });

  it("exposes renderer-safe ChatGPT OAuth status and login channels", async () => {
    const status = {
      schemaVersion: 1 as const,
      revision: 1,
      providerId: "runtime-chatgpt",
      displayName: "GPT",
      modelId: "runtime-model",
      connected: true,
      email: "writer@example.com",
      planType: "plus",
      updatedAt: "2026-08-13T00:00:00.000Z",
    };
    const invoke = vi.fn(async (channel: string) => {
      if (
        channel === ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL ||
        channel === ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL
      ) {
        return status;
      }
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const bridge = createStudioBridge(invoke);

    await expect(bridge.assistant.getChatGptOAuthStatus()).resolves.toEqual(status);
    await expect(bridge.assistant.startChatGptOAuthLogin()).resolves.toEqual(status);
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL,
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL,
    );
  });

  it("uses only typed app settings channels and profile limits", async () => {
    const profile = {
      schemaVersion: 1 as const,
      defaultEpisodeCharacters: {
        defaultValue: 4_000,
        minValue: 100,
        maxValue: 100_000,
      },
    };
    const projection = {
      schemaVersion: 1 as const,
      revision: 1,
      settings: { defaultEpisodeCharacters: 3_200 },
      updatedAt: "2026-08-10T01:00:00.000Z",
    };
    const invoke = vi.fn(async (channel: string) => {
      if (channel === APP_SETTINGS_PROFILE_CHANNEL) return profile;
      return projection;
    });
    const bridge = createStudioBridge(invoke);

    await expect(bridge.settings.getProfile()).resolves.toEqual(profile);
    await expect(bridge.settings.get()).resolves.toEqual(projection);
    await expect(
      bridge.settings.save({
        schemaVersion: 1,
        expectedRevision: projection.revision,
        settings: projection.settings,
      }),
    ).resolves.toEqual(projection);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      APP_SETTINGS_PROFILE_CHANNEL,
      APP_SETTINGS_GET_CHANNEL,
      APP_SETTINGS_PROFILE_CHANNEL,
      APP_SETTINGS_SAVE_CHANNEL,
    ]);
  });

  it("uses typed per-Work quick memo channels without a manuscript command", async () => {
    const workId = entityId<"Work">(randomUUID());
    const projection = {
      schemaVersion: 1 as const,
      workId,
      revision: 1,
      text: "인물 이름 확인",
      updatedAt: "2026-08-10T01:00:00.000Z",
    };
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.quickTools.getMemo({ schemaVersion: 1, workId }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.quickTools.saveMemo({
        schemaVersion: 1,
        workId,
        expectedRevision: 1,
        text: "인물 이름 확인",
      }),
    ).resolves.toEqual(projection);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      QUICK_TOOLS_GET_MEMO_CHANNEL,
      QUICK_TOOLS_SAVE_MEMO_CHANNEL,
    ]);
  });

  it("uses only typed assistant connection, context, vocabulary, and setting review channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const conversationId = entityId<"AssistantConversation">(randomUUID());
    const grantId = entityId<"AssistantContextPermissionGrant">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const requestId = entityId<"AssistantContextRequest">(randomUUID());
    const settingRequestId = entityId<"AssistantSettingReviewRequest">(
      randomUUID(),
    );
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const createdAt = "2026-08-10T01:00:00.000Z";
    const connection = {
      schemaVersion: 1 as const,
      connectionId,
      revision: 1,
      connectorKind: "eum-structured-json-v1",
      label: `connection-${randomUUID()}`,
      endpoint: `https://${randomUUID()}.invalid/rpc`,
      model: `model-${randomUUID()}`,
      credentialConfigured: true,
      createdAt,
      updatedAt: createdAt,
    };
    const connectorProfile = {
      schemaVersion: 1 as const,
      connectors: [{
        connectorKind: "eum-structured-json-v1",
        displayName: "사용자 지정 구조화 JSON",
        capabilities: ["vocabulary-lookup" as const],
        contextTokenBudget: 8192,
        credentialPolicy: "optional" as const,
        runtimeConfig: {
          endpoint: "required" as const,
          model: "required" as const,
        },
      }],
    };
    const destinationProfile = {
      schemaVersion: 1 as const,
      destinations: [{
        destinationId: "local-dictionary",
        label: "작품 내 정확 어휘 검색",
        kind: "local-exact-vocabulary-search" as const,
        capabilities: ["vocabulary-lookup" as const],
        requiredLocalScope: "work" as const,
        requiredExternalScope: "none" as const,
      }],
    };
    const grant = {
      schemaVersion: 1 as const,
      grantId,
      revision: 1,
      workId,
      conversationId,
      capability: "vocabulary-lookup" as const,
      destinationId: "local-dictionary",
      localScope: "selection" as const,
      externalScope: "none" as const,
      duration: "conversation" as const,
      createdAt,
      revokedAt: null,
      consumedAt: null,
    };
    const revoked = {
      ...grant,
      revision: 2,
      revokedAt: "2026-08-10T01:01:00.000Z",
    };
    const projection = {
      schemaVersion: 1 as const,
      workId,
      conversationId,
      grants: [grant],
      receipts: [],
      candidates: [],
      notationCandidates: [],
      vocabularySuggestionCandidates: [],
      settingReviewReceipts: [],
      settingReviewFindings: [],
      settingConflictFindings: [],
      externalSettingReviewReceipts: [],
      externalSettingReviewCandidates: [],
    };
    const lookupResult = {
      schemaVersion: 1 as const,
      status: "candidate" as const,
      candidate: {
        schemaVersion: 1 as const,
        candidateId: entityId<"AssistantVocabularyCandidate">(randomUUID()),
        workId,
        conversationId,
        destinationId: "local-dictionary",
        sourceRange: { documentId, documentRevisionId, from: 0, to: 2 },
        query: "서늘",
        occurrences: [
          { documentId, documentRevisionId, from: 0, to: 2 },
        ],
        receiptId: entityId<"AssistantContextReceipt">(randomUUID()),
        createdAt,
      },
    };
    const suggestionResult = {
      schemaVersion: 1 as const,
      status: "candidate" as const,
      candidate: {
        schemaVersion: 1 as const,
        candidateId: entityId<"AssistantVocabularySuggestionCandidate">(
          randomUUID(),
        ),
        workId,
        conversationId,
        connectionId,
        query: "서늘한 유의어",
        sourceRange: null,
        suggestions: [{
          word: "쌀쌀한",
          nuance: "체감 온도를 강조",
          example: "쌀쌀한 바람이 불었다.",
        }],
        note: "",
        connectorReceiptId: entityId<"ConnectorReceipt">(randomUUID()),
        contextReceiptId: null,
        createdAt,
      },
    };
    const externalSettingReviewRequestId =
      entityId<"AssistantExternalSettingReviewRequest">(randomUUID());
    const externalSettingReviewReceiptId =
      entityId<"AssistantExternalSettingReviewReceipt">(randomUUID());
    const externalSettingReviewResult = {
      schemaVersion: 1 as const,
      status: "candidate" as const,
      receipt: {
        schemaVersion: 1 as const,
        receiptId: externalSettingReviewReceiptId,
        requestId: externalSettingReviewRequestId,
        workId,
        conversationId,
        connectionId,
        sourceRange: { documentId, documentRevisionId, from: 0, to: 2 },
        transmittedSettings: [],
        transmittedSettingCount: 0,
        connectorReceiptId: entityId<"ConnectorReceipt">(randomUUID()),
        contextReceiptId: entityId<"AssistantContextReceipt">(randomUUID()),
        createdAt,
      },
      candidate: {
        schemaVersion: 1 as const,
        candidateId: entityId<"AssistantExternalSettingReviewCandidate">(
          randomUUID(),
        ),
        workId,
        conversationId,
        connectionId,
        query: "현재 회차 설정 검토",
        reply: "검토했습니다.",
        proposals: [],
        reviewNotes: [],
        receiptId: externalSettingReviewReceiptId,
        createdAt,
      },
    };
    const settingReviewResult = {
      schemaVersion: 1 as const,
      status: "reviewed" as const,
      receipt: {
        schemaVersion: 1 as const,
        receiptId: entityId<"AssistantSettingReviewReceipt">(randomUUID()),
        requestId: settingRequestId,
        workId,
        conversationId,
        capability: "lore-review" as const,
        destinationId: "local-setting-review",
        reviewedSettings: [],
        transmittedSettingCount: 0 as const,
        grantIds: [grantId],
        createdAt,
      },
      findings: [],
      conflicts: [],
    };
    const notationReviewResult = {
      schemaVersion: 1 as const,
      status: "candidate" as const,
      candidate: {
        schemaVersion: 1 as const,
        candidateId: entityId<"AssistantNotationCandidate">(randomUUID()),
        workId,
        conversationId,
        destinationId: "local-notation",
        sourceRange: { documentId, documentRevisionId, from: 0, to: 2 },
        findings: [{
          kind: "tab" as const,
          range: { documentId, documentRevisionId, from: 0, to: 1 },
          label: null,
        }],
        regexError: null,
        receiptId: entityId<"AssistantContextReceipt">(randomUUID()),
        createdAt,
      },
    };
    const invoke = vi.fn(async (channel: string) => {
      if (channel === ASSISTANT_LIST_CONNECTIONS_CHANNEL) {
        return { schemaVersion: 1, connections: [connection] };
      }
      if (channel === ASSISTANT_SAVE_CONNECTION_CHANNEL) return connection;
      if (channel === ASSISTANT_DELETE_CONNECTION_CHANNEL) return undefined;
      if (channel === ASSISTANT_CONNECTOR_PROFILE_CHANNEL) {
        return connectorProfile;
      }
      if (channel === ASSISTANT_DESTINATION_PROFILE_CHANNEL) {
        return destinationProfile;
      }
      if (channel === ASSISTANT_LIST_CONTEXT_STATE_CHANNEL) return projection;
      if (channel === ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL) return revoked;
      if (channel === ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL) {
        return lookupResult;
      }
      if (channel === ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL) {
        return suggestionResult;
      }
      if (channel === ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL) {
        return externalSettingReviewResult;
      }
      if (channel === ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL) {
        return notationReviewResult;
      }
      if (channel === ASSISTANT_RUN_SETTING_REVIEW_CHANNEL) {
        return settingReviewResult;
      }
      return grant;
    });
    const bridge = createStudioBridge(invoke);

    await expect(bridge.assistant.listConnections()).resolves.toEqual({
      schemaVersion: 1,
      connections: [connection],
    });
    await expect(bridge.assistant.saveConnection({
      schemaVersion: 1,
      connectionId,
      expectedRevision: 0,
      connectorKind: connection.connectorKind,
      label: connection.label,
      endpoint: connection.endpoint,
      model: connection.model,
      credential: { mode: "replace", value: `secret-${randomUUID()}` },
    })).resolves.toEqual(connection);
    await expect(bridge.assistant.deleteConnection({
      schemaVersion: 1,
      connectionId,
      expectedRevision: 1,
    })).resolves.toBeUndefined();
    await expect(bridge.assistant.getConnectorProfile()).resolves.toEqual(
      connectorProfile,
    );
    await expect(bridge.assistant.getDestinationProfile()).resolves.toEqual(
      destinationProfile,
    );
    await expect(bridge.assistant.listContextState({
      schemaVersion: 1,
      workId,
      conversationId,
    })).resolves.toEqual(projection);
    await expect(bridge.assistant.grantContextPermission({
      schemaVersion: 1,
      workId,
      conversationId,
      capability: "vocabulary-lookup",
      destinationId: "local-dictionary",
      localScope: "selection",
      externalScope: "none",
      duration: "conversation",
    })).resolves.toEqual(grant);
    await expect(bridge.assistant.revokeContextPermission({
      schemaVersion: 1,
      workId,
      grantId,
      expectedRevision: 1,
    })).resolves.toEqual(revoked);
    await expect(bridge.assistant.runVocabularyLookup({
      schemaVersion: 1,
      requestId,
      workId,
      conversationId,
      destinationId: "local-dictionary",
      sourceRange: { documentId, documentRevisionId, from: 0, to: 2 },
    })).resolves.toEqual(lookupResult);
    await expect(bridge.assistant.runVocabularySuggestion({
      schemaVersion: 1,
      requestId: entityId<"AssistantVocabularySuggestionRequest">(
        randomUUID(),
      ),
      workId,
      conversationId,
      connectionId,
      query: "서늘한 유의어",
      sourceRange: null,
    })).resolves.toEqual(suggestionResult);
    await expect(bridge.assistant.runExternalSettingReview({
      schemaVersion: 1,
      requestId: externalSettingReviewRequestId,
      workId,
      conversationId,
      connectionId,
      query: "현재 회차 설정 검토",
      sourceRange: { documentId, documentRevisionId, from: 0, to: 2 },
    })).resolves.toEqual(externalSettingReviewResult);
    await expect(bridge.assistant.runNotationReview({
      schemaVersion: 1,
      requestId,
      workId,
      conversationId,
      destinationId: "local-notation",
      sourceRange: { documentId, documentRevisionId, from: 0, to: 2 },
    })).resolves.toEqual(notationReviewResult);
    await expect(bridge.assistant.runSettingReview({
      schemaVersion: 1,
      requestId: settingRequestId,
      workId,
      conversationId,
      destinationId: "local-setting-review",
    })).resolves.toEqual(settingReviewResult);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      ASSISTANT_LIST_CONNECTIONS_CHANNEL,
      ASSISTANT_SAVE_CONNECTION_CHANNEL,
      ASSISTANT_DELETE_CONNECTION_CHANNEL,
      ASSISTANT_CONNECTOR_PROFILE_CHANNEL,
      ASSISTANT_DESTINATION_PROFILE_CHANNEL,
      ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
      ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
      ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
      ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
      ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
      ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
      ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
      ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
    ]);
  });

  it("uses only typed Work schedule channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const itemId = entityId<"WorkScheduleItem">(randomUUID());
    const timestamp = "2026-08-10T01:00:00.000Z";
    const task = {
      schemaVersion: 1 as const,
      itemId,
      workId,
      revision: 1,
      kind: "task" as const,
      label: "원고 검토",
      date: "2026-08-11",
      time: null,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const projection = {
      schemaVersion: 1 as const,
      workId,
      range: { from: "2026-08-10", to: "2026-08-12" },
      items: [task],
      occurrences: [
        {
          occurrenceId: `task:${itemId}`,
          itemId,
          workId,
          kind: "task" as const,
          label: task.label,
          date: task.date,
          time: null,
          completed: false,
          completedAt: null,
        },
      ],
      episodeProgress: {
        defaultEpisodeCharacters: 4_000,
        totalCharacters: 0,
        totalEpisodeCount: 1,
        completedEpisodeCount: 0,
        completedEpisodeNumbers: [],
      },
    };
    const calendarProjection = {
      ...projection,
      completedDocumentCount: 1,
      occurrences: [
        {
          occurrenceId: "document-completion:document-a",
          workId,
          documentId: "document-a",
          documentTitle: "5화",
          kind: "document-completion" as const,
          label: "5화 완료",
          date: "2026-08-11",
          time: null,
          completed: true as const,
          completedAt: timestamp,
          completedDocumentRevisionId: "revision-a",
          state: "current" as const,
        },
        ...projection.occurrences,
      ],
    };
    const todayProjection = {
      schemaVersion: 1 as const,
      date: "2026-08-11",
      works: [
        {
          workId,
          workTitle: "작품 A",
          calendar: {
            ...calendarProjection,
            range: { from: "2026-08-11", to: "2026-08-11" },
          },
        },
      ],
      completedDocumentCount: 1,
    };
    const invoke = vi.fn(async (channel: string) => {
      if (channel === SCHEDULE_LIST_WORK_CHANNEL) return projection;
      if (channel === SCHEDULE_LIST_CALENDAR_CHANNEL) return calendarProjection;
      if (channel === SCHEDULE_LIST_TODAY_CHANNEL) return todayProjection;
      if (
        channel === SCHEDULE_CREATE_ITEM_CHANNEL ||
        channel === SCHEDULE_UPDATE_ITEM_CHANNEL ||
        channel === SCHEDULE_SET_COMPLETION_CHANNEL
      ) {
        return task;
      }
      if (channel === SCHEDULE_RETIRE_ITEM_CHANNEL) return undefined;
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.schedule.listWork({
        schemaVersion: 1,
        workId,
        range: projection.range,
      }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.schedule.listCalendar({
        schemaVersion: 1,
        workId,
        range: projection.range,
      }),
    ).resolves.toEqual(calendarProjection);
    await expect(
      bridge.schedule.listToday({
        schemaVersion: 1,
        date: "2026-08-11",
      }),
    ).resolves.toEqual(todayProjection);
    await expect(
      bridge.schedule.createItem({
        schemaVersion: 1,
        workId,
        item: {
          kind: "task",
          label: task.label,
          date: task.date,
          time: null,
        },
      }),
    ).resolves.toEqual(task);
    await expect(
      bridge.schedule.updateItem({
        schemaVersion: 1,
        workId,
        itemId,
        expectedRevision: 1,
        item: {
          kind: "task",
          label: task.label,
          date: task.date,
          time: null,
        },
      }),
    ).resolves.toEqual(task);
    await expect(
      bridge.schedule.setCompletion({
        schemaVersion: 1,
        workId,
        itemId,
        expectedRevision: 1,
        date: task.date,
        completed: true,
      }),
    ).resolves.toEqual(task);
    await expect(
      bridge.schedule.retireItem({
        schemaVersion: 1,
        workId,
        itemId,
        expectedRevision: 1,
      }),
    ).resolves.toBeUndefined();
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      SCHEDULE_LIST_WORK_CHANNEL,
      SCHEDULE_LIST_CALENDAR_CHANNEL,
      SCHEDULE_LIST_TODAY_CHANNEL,
      SCHEDULE_CREATE_ITEM_CHANNEL,
      SCHEDULE_UPDATE_ITEM_CHANNEL,
      SCHEDULE_SET_COMPLETION_CHANNEL,
      SCHEDULE_RETIRE_ITEM_CHANNEL,
    ]);
  });

  it("uses typed Work records goal channels without exposing storage", async () => {
    const workId = entityId<"Work">(randomUUID());
    const projection = {
      schemaVersion: 1 as const,
      workId,
      revision: 1,
      goals: {
        dailyActiveMinutes: 60,
        dailyCharacters: null,
        weeklyActiveMinutes: 300,
        weeklyCharacters: 8_000,
      },
    };
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.activity.getRecordsGoals({ schemaVersion: 1, workId }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.activity.saveRecordsGoals({
        schemaVersion: 1,
        workId,
        expectedRevision: projection.revision,
        goals: projection.goals,
      }),
    ).resolves.toEqual(projection);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      ACTIVITY_GET_RECORDS_GOALS_CHANNEL,
      ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL,
    ]);
  });

  it("uses typed Work readthrough channels without exposing storage", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const projection = {
      schemaVersion: 1 as const,
      workId,
      revision: 1,
      entries: [{ documentId, readerCount: 1_000 }],
    };
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.activity.getReadthrough({ schemaVersion: 1, workId }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.activity.saveReadthrough({
        schemaVersion: 1,
        workId,
        expectedRevision: projection.revision,
        entries: projection.entries,
      }),
    ).resolves.toEqual(projection);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      ACTIVITY_GET_READTHROUGH_CHANNEL,
      ACTIVITY_SAVE_READTHROUGH_CHANNEL,
    ]);
  });

  it("uses one typed Work records export channel without exposing a file path", async () => {
    const workId = entityId<"Work">(randomUUID());
    const command = {
      schemaVersion: 1,
      workId,
      format: "csv",
      fromDate: "2026-08-01",
      toDate: "2026-08-10",
    } as const;
    const result = {
      schemaVersion: 1,
      status: "completed",
      byteLength: 128,
      sessionCount: 3,
    } as const;
    const invoke = vi.fn().mockResolvedValue(result);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.activity.exportRecords(command)).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_EXPORT_RECORDS_CHANNEL, command);
    expect(command).not.toHaveProperty("filePath");
  });

  it("uses only typed preflight, text export, and text import channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const profile = parseManuscriptPreflightProfile({
      schemaVersion: 1,
      defaults: {
        trimTrailingWhitespace: true,
        tabReplacement: "preserve",
        tabWidth: 3,
        nonBreakingSpaceReplacement: "space",
        lineEnding: "preserve",
        limitBlankLines: false,
        maxConsecutiveBlankLines: 2,
        forbiddenTerms: [],
        forbiddenCaseSensitive: false,
        regexPattern: "",
        regexCaseSensitive: true,
        regexMultiline: false,
      },
      limits: {
        tabWidth: { min: 1, max: 12 },
        maxConsecutiveBlankLines: { min: 0, max: 6 },
      },
    });
    const settings = createDefaultManuscriptPreflightSettings(profile);
    const projection = {
      schemaVersion: 1 as const,
      workId,
      revision: 0,
      settings,
    };
    const exportResult = {
      schemaVersion: 1 as const,
      status: "completed" as const,
      byteLength: Buffer.byteLength("승인 원문", "utf8"),
    };
    const importResult = {
      schemaVersion: 1 as const,
      status: "selected" as const,
      workId,
      documentId,
      documentRevisionId,
      fileName: "가져온 원고.txt",
      text: "가져온 원고",
      byteLength: Buffer.byteLength("가져온 원고", "utf8"),
    };
    const invoke = vi.fn(async (channel: string) => {
      if (channel === MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL) {
        return profile;
      }
      if (
        channel === MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL ||
        channel === MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL
      ) {
        return projection;
      }
      if (channel === MANUSCRIPT_EXPORT_TEXT_CHANNEL) {
        return exportResult;
      }
      if (channel === MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL) {
        return importResult;
      }
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptPreflightProfile(),
    ).resolves.toEqual(profile);
    await expect(
      bridge.editor.getManuscriptPreflightSettings({
        schemaVersion: 1,
        workId,
      }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.editor.saveManuscriptPreflightSettings({
        schemaVersion: 1,
        workId,
        settings,
      }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.editor.exportManuscriptText({
        schemaVersion: 1,
        workId,
        documentId,
        suggestedFileName: `${randomUUID()}.txt`,
        text: "승인 원문",
      }),
    ).resolves.toEqual(exportResult);
    await expect(
      bridge.editor.selectManuscriptTextImport({
        schemaVersion: 1,
        workId,
        documentId,
        documentRevisionId,
      }),
    ).resolves.toEqual(importResult);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL,
      MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
      MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
      MANUSCRIPT_EXPORT_TEXT_CHANNEL,
      MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
    ]);
  });

  it("wraps the allowlisted runtime query without exposing a generic sender", async () => {
    const runtimeInfo = {
      appName: randomUUID(),
      appVersion: randomUUID(),
      platform: randomUUID(),
      architecture: randomUUID(),
    };
    const invoke = vi.fn().mockResolvedValue(runtimeInfo);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.system.getRuntimeInfo()).resolves.toEqual(runtimeInfo);
    expect(invoke).toHaveBeenCalledWith(RUNTIME_INFO_CHANNEL);
    expect("send" in bridge).toBe(false);
    expect("invoke" in bridge).toBe(false);
  });

  it("rejects malformed main-process responses", async () => {
    const bridge = createStudioBridge(async () => ({ appName: randomUUID() }));

    await expect(bridge.system.getRuntimeInfo()).rejects.toThrow(
      "Invalid runtime information",
    );
  });

  it("wraps the allowlisted manuscript input profile query", async () => {
    const inputProfile = {
      schemaVersion: 1,
      autoClosePairs: [
        {
          open: randomUUID(),
          close: randomUUID(),
        },
      ],
      textReplacements: [
        {
          trigger: randomUUID(),
          replacement: randomUUID(),
        },
      ],
    } as const;
    const invoke = vi.fn().mockResolvedValue(inputProfile);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.editor.getManuscriptInputProfile()).resolves.toEqual(
      inputProfile,
    );
    expect(invoke).toHaveBeenCalledWith(MANUSCRIPT_INPUT_PROFILE_CHANNEL);
  });

  it("wraps the allowlisted manuscript document profile query", async () => {
    const document = {
      workId: randomUUID(),
      documentId: randomUUID(),
      documentRevisionId: randomUUID(),
      label: randomUUID(),
      initialText: randomUUID(),
    };
    const documentProfile = {
      schemaVersion: 1,
      initialDocumentId: document.documentId,
      documents: [document],
    };
    const invoke = vi.fn().mockResolvedValue(documentProfile);
    const bridge = createStudioBridge(invoke);
    const readDocumentProfile = Reflect.get(
      bridge.editor,
      "getManuscriptDocumentProfile",
    );

    expect(readDocumentProfile).toBeTypeOf("function");
    if (typeof readDocumentProfile !== "function") {
      return;
    }
    await expect(readDocumentProfile()).resolves.toEqual(documentProfile);
    expect(invoke).toHaveBeenCalledWith(
      "studio:editor:get-manuscript-document-profile",
    );
  });

  it("strictly invokes the allowlisted durable manuscript save command", async () => {
    const beforeText = randomUUID();
    const insertedText = randomUUID();
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: randomUUID(),
      workId: randomUUID(),
      documentId: randomUUID(),
      baseRevisionId: randomUUID(),
      sequence: Number.parseInt(randomUUID().slice(0, 6), 16),
      createdAt: new Date().toISOString(),
      beforeTextLengthUtf16: beforeText.length,
      afterTextLengthUtf16:
        beforeText.length + insertedText.length,
      changes: [
        {
          fromUtf16: beforeText.length,
          toUtf16: beforeText.length,
          insertedText,
        },
      ],
    });
    const frameStartByteOffset = Number.parseInt(
      randomUUID().slice(0, 6),
      16,
    );
    const frameByteLength =
      Number.parseInt(randomUUID().slice(0, 4), 16) + 1;
    const receipt = {
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      frameStartByteOffset,
      frameEndByteOffset:
        frameStartByteOffset + frameByteLength,
      frameByteLength,
    };
    const invoke = vi.fn().mockResolvedValue(receipt);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.saveChangeBatch(batch),
    ).resolves.toEqual(receipt);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
      batch,
    );
  });

  it("rejects a malformed durable save receipt", async () => {
    const beforeText = randomUUID();
    const insertedText = randomUUID();
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: randomUUID(),
      workId: randomUUID(),
      documentId: randomUUID(),
      baseRevisionId: randomUUID(),
      sequence: Number.parseInt(randomUUID().slice(0, 6), 16),
      createdAt: new Date().toISOString(),
      beforeTextLengthUtf16: beforeText.length,
      afterTextLengthUtf16:
        beforeText.length + insertedText.length,
      changes: [
        {
          fromUtf16: beforeText.length,
          toUtf16: beforeText.length,
          insertedText,
        },
      ],
    });
    const bridge = createStudioBridge(async () => ({
      batchId: batch.batchId,
    }));

    await expect(
      bridge.editor.saveChangeBatch(batch),
    ).rejects.toThrow("Invalid save receipt");
  });

  it("reads only the renderer persistence projection", async () => {
    const profile = {
      schemaVersion: 1,
      batching: {
        schemaVersion: 1,
        maxTransactionsPerBatch:
          Number.parseInt(randomUUID().slice(0, 4), 16) + 1,
        maxDelayMs: Number.parseInt(
          randomUUID().slice(0, 4),
          16,
        ),
      },
      documentSequences: [
        {
          documentId: randomUUID(),
          nextSequence: Number.parseInt(
            randomUUID().slice(0, 6),
            16,
          ),
        },
      ],
    };
    const invoke = vi.fn().mockResolvedValue(profile);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptPersistenceProfile(),
    ).resolves.toEqual(profile);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
    );
    expect("journalPath" in profile).toBe(false);
    expect("checksumAlgorithm" in profile).toBe(false);
  });

  it("uses typed continuous-reading progress channels without exposing storage", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const projection = {
      schemaVersion: 1 as const,
      workId,
      revision: 1,
      location: { documentId, documentRevisionId, textOffset: 12 },
    };
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getContinuousReadingProgress({ schemaVersion: 1, workId }),
    ).resolves.toEqual(projection);
    await expect(
      bridge.editor.saveContinuousReadingProgress({
        schemaVersion: 1,
        workId,
        expectedRevision: projection.revision,
        location: projection.location,
      }),
    ).resolves.toEqual(projection);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
      MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
    ]);
  });

  it("preserves unavailable persistence and rejects malformed projections", async () => {
    const unavailableBridge = createStudioBridge(async () => null);
    await expect(
      unavailableBridge.editor.getManuscriptPersistenceProfile(),
    ).resolves.toBeNull();

    const malformedBridge = createStudioBridge(async () => ({
      schemaVersion: 1,
      journalPath: randomUUID(),
    }));
    await expect(
      malformedBridge.editor.getManuscriptPersistenceProfile(),
    ).rejects.toThrow("Invalid manuscript persistence profile");
  });

  it("wraps the allowlisted startup recovery query and strictly parses its response", async () => {
    const recovery = {
      schemaVersion: 1,
      status: "clean",
      issues: [],
    } as const;
    const invoke = vi.fn().mockResolvedValue(recovery);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptStartupRecovery(),
    ).resolves.toEqual(recovery);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
    );

    const malformed = createStudioBridge(
      async () => ({
        ...recovery,
        [randomUUID()]: randomUUID(),
      }),
    );
    await expect(
      malformed.editor.getManuscriptStartupRecovery(),
    ).rejects.toThrow(
      "Invalid manuscript startup recovery",
    );
  });

  it("reads only a strictly parsed resume checkpoint projection", async () => {
    const projection = {
      schemaVersion: 1,
      status: "resolved",
      workId: randomUUID(),
      documentId: randomUUID(),
      targetRevisionId: randomUUID(),
      selection: {
        anchor:
          Number.parseInt(
            randomUUID().slice(0, 4),
            16,
          ),
        head:
          Number.parseInt(
            randomUUID().slice(0, 4),
            16,
          ),
      },
    } as const;
    const invoke =
      vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptResumeCheckpoint(),
    ).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
    );

    const malformed =
      createStudioBridge(async () => ({
        ...projection,
        move: null,
      }));
    await expect(
      malformed.editor.getManuscriptResumeCheckpoint(),
    ).rejects.toThrow(
      "Invalid manuscript resume checkpoint",
    );
  });

  it("sends only the exact startup recovery apply command and strictly parses its acknowledgement", async () => {
    const safeBoundary =
      Number.parseInt(
        randomUUID().slice(0, 4),
        16,
      ) + 1;
    const documentId =
      entityId<"Document">(randomUUID());
    const candidate: StartupRecoveryCandidate = {
      sourceJournalEndByteOffset:
        safeBoundary +
        Number.parseInt(
          randomUUID().slice(0, 4),
          16,
        ),
      checksumVerifiedPrefixByteLength:
        safeBoundary,
      safeReplayThroughByteOffset:
        safeBoundary,
      affectedDocuments: [
        {
          workId:
            entityId<"Work">(randomUUID()),
          documentId,
          baseRevisionId:
            entityId<"DocumentRevision">(
              randomUUID(),
            ),
          recoveredText: randomUUID(),
          nextSequence: Number.parseInt(
            randomUUID().slice(0, 6),
            16,
          ),
        },
      ],
      appliedBatchIds: [
        entityId<"ChangeBatch">(randomUUID()),
      ],
      duplicateBatchIds: [],
      safePayloads: [
        new TextEncoder().encode(randomUUID()),
      ],
      issues: [],
    };
    const command =
      createApplyStartupRecoveryCommand(candidate);
    const acknowledgement = {
      schemaVersion: 1,
      status: "applied",
      compactionId: randomUUID(),
      consumedThroughByteOffset:
        candidate.sourceJournalEndByteOffset,
      reclamation: "completed",
    } as const;
    const invoke = vi
      .fn()
      .mockResolvedValue(acknowledgement);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.applyManuscriptStartupRecovery(
        command,
      ),
    ).resolves.toEqual(acknowledgement);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
      command,
    );

    const malformed = createStudioBridge(
      async () => ({
        ...acknowledgement,
        reclamation: randomUUID(),
      }),
    );
    await expect(
      malformed.editor.applyManuscriptStartupRecovery(
        command,
      ),
    ).rejects.toThrow(
      "Invalid manuscript recovery acknowledgement",
    );
  });

  it("rejects a malformed manuscript input profile response", async () => {
    const bridge = createStudioBridge(async () => ({ schemaVersion: 1 }));

    await expect(bridge.editor.getManuscriptInputProfile()).rejects.toThrow(
      "Invalid manuscript input profile",
    );
  });

  it("accepts only complete string-valued runtime information", () => {
    expect(
      isRuntimeInfo({
        appName: randomUUID(),
        appVersion: randomUUID(),
        platform: randomUUID(),
        architecture: randomUUID(),
      }),
    ).toBe(true);
    expect(isRuntimeInfo(null)).toBe(false);
    expect(isRuntimeInfo({})).toBe(false);
  });

  it("exposes strict Work and Document rename commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const workTitle = randomUUID();
    const documentTitle = randomUUID();
    const projection = {
      schemaVersion: 1,
      works: [
        {
          workId,
          title: workTitle,
          updatedAt: new Date().toISOString(),
          folders: [],
          documents: [
            {
              documentId,
              title: documentTitle,
              currentRevisionId: revisionId,
              folderId: null,
              completion: incompleteDocumentCompletion(workId, documentId),
            },
          ],
        },
      ],
      activeWorkId: workId,
      activeDocumentId: documentId,
      canCreateFirstWork: false,
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const renameWork = {
      schemaVersion: 1,
      workId,
      title: workTitle,
    } as const;
    const renameDocument = {
      schemaVersion: 1,
      workId,
      documentId,
      title: documentTitle,
    } as const;

    await expect(bridge.workspace.renameWork(renameWork)).resolves.toEqual(
      projection,
    );
    await expect(
      bridge.workspace.renameDocument(renameDocument),
    ).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(
      WORKSPACE_RENAME_WORK_CHANNEL,
      renameWork,
    );
    expect(invoke).toHaveBeenCalledWith(
      WORKSPACE_RENAME_DOCUMENT_CHANNEL,
      renameDocument,
    );
  });

  it("uses the typed Work favorites channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const projection = {
      schemaVersion: 1,
      workIds: [workId],
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      favorite: true,
    } as const;

    await expect(bridge.workspace.getFavorites()).resolves.toEqual(projection);
    await expect(bridge.workspace.setFavorite(command)).resolves.toEqual(
      projection,
    );
    expect(invoke.mock.calls).toEqual([
      [WORKSPACE_FAVORITES_CHANNEL],
      [WORKSPACE_SET_FAVORITE_CHANNEL, command],
    ]);
  });

  it("uses the typed Work cover channels without exposing a file path", async () => {
    const workId = entityId<"Work">(randomUUID());
    const cover = {
      schemaVersion: 1,
      workId,
      mediaType: "image/png",
      contentBase64: "aW1hZ2U=",
    } as const;
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ schemaVersion: 1, covers: [cover] })
      .mockResolvedValueOnce(cover)
      .mockResolvedValueOnce(null);
    const bridge = createStudioBridge(invoke);
    const command = { schemaVersion: 1, workId } as const;

    await expect(bridge.workspace.getCovers()).resolves.toEqual({
      schemaVersion: 1,
      covers: [cover],
    });
    await expect(bridge.workspace.selectCover(command)).resolves.toEqual(cover);
    await expect(bridge.workspace.selectCover(command)).resolves.toBeNull();
    expect(invoke.mock.calls).toEqual([
      [WORKSPACE_COVERS_CHANNEL],
      [WORKSPACE_SELECT_COVER_CHANNEL, command],
      [WORKSPACE_SELECT_COVER_CHANNEL, command],
    ]);
  });

  it("exposes only the exact Work retirement command", async () => {
    const workId = entityId<"Work">(randomUUID());
    const invoke = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      works: [],
      activeWorkId: null,
      activeDocumentId: null,
      canCreateFirstWork: true,
    });
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
    } as const;

    await expect(bridge.workspace.retireWork(command)).resolves.toEqual({
      schemaVersion: 1,
      works: [],
      activeWorkId: null,
      activeDocumentId: null,
      canCreateFirstWork: true,
    });
    expect(invoke).toHaveBeenCalledWith(
      WORKSPACE_RETIRE_WORK_CHANNEL,
      command,
    );
  });

  it("exposes only the exact Document retirement command", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const projection = {
      schemaVersion: 1,
      works: [{
        workId,
        title: randomUUID(),
        updatedAt: new Date().toISOString(),
        folders: [],
        documents: [],
      }],
      activeWorkId: workId,
      activeDocumentId: null,
      canCreateFirstWork: false,
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const command = { schemaVersion: 1, workId, documentId } as const;

    await expect(bridge.workspace.retireDocument(command)).resolves.toEqual(
      projection,
    );
    expect(invoke).toHaveBeenCalledWith(
      WORKSPACE_RETIRE_DOCUMENT_CHANNEL,
      command,
    );
  });

  it("exposes only the exact adjacent Document move command", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const projection = {
      schemaVersion: 1,
      works: [{
        workId,
        title: randomUUID(),
        updatedAt: new Date().toISOString(),
        folders: [],
        documents: [{
          documentId,
          title: randomUUID(),
          currentRevisionId: entityId<"DocumentRevision">(randomUUID()),
          folderId: null,
          completion: incompleteDocumentCompletion(workId, documentId),
        }],
      }],
      activeWorkId: workId,
      activeDocumentId: documentId,
      canCreateFirstWork: false,
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      documentId,
      direction: "later",
    } as const;

    await expect(bridge.workspace.moveDocument(command)).resolves.toEqual(
      projection,
    );
    expect(invoke).toHaveBeenCalledWith(
      WORKSPACE_MOVE_DOCUMENT_CHANNEL,
      command,
    );
  });

  it("exposes exact Document folder commands on separate channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const folderId = entityId<"DocumentFolder">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const title = randomUUID();
    const projection = {
      schemaVersion: 1,
      works: [{
        workId,
        title: randomUUID(),
        updatedAt: new Date().toISOString(),
        folders: [{ folderId, title, parentFolderId: null }],
        documents: [{
          documentId,
          title: randomUUID(),
          currentRevisionId: entityId<"DocumentRevision">(randomUUID()),
          folderId,
          completion: incompleteDocumentCompletion(workId, documentId),
        }],
      }],
      activeWorkId: workId,
      activeDocumentId: documentId,
      canCreateFirstWork: false,
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const create = { schemaVersion: 1, workId, title, parentFolderId: null } as const;
    const rename = { schemaVersion: 1, workId, folderId, title } as const;
    const place = { schemaVersion: 1, workId, documentId, folderId } as const;
    const retire = { schemaVersion: 1, workId, folderId } as const;

    await expect(bridge.workspace.createDocumentFolder(create)).resolves.toEqual(projection);
    await expect(bridge.workspace.renameDocumentFolder(rename)).resolves.toEqual(projection);
    await expect(bridge.workspace.placeDocumentInFolder(place)).resolves.toEqual(projection);
    await expect(bridge.workspace.retireDocumentFolder(retire)).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL, rename);
    expect(invoke).toHaveBeenCalledWith(WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL, place);
    expect(invoke).toHaveBeenCalledWith(WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL, retire);
  });

  it("exposes strict EventBlock and EventSource commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const now = new Date().toISOString();
    const eventBlock = {
      schemaVersion: 1,
      eventBlockId: entityId<"EventBlock">(randomUUID()),
      revision: 1,
      workId,
      title: "첫 사건",
      note: "",
      parentEventId: null,
      outlineOrderKey: "outline-a",
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const eventSource = {
      schemaVersion: 1,
      eventSourceId: entityId<"EventSource">(randomUUID()),
      revision: 1,
      workId,
      eventBlockId: eventBlock.eventBlockId,
      rangeGroupId: randomUUID(),
      role: "primary",
      anchors: [{
        anchorId: randomUUID(),
        documentId,
        documentRevisionId: randomUUID(),
        exactQuote: "선택한 원문",
        integrity: "resolved",
        range: { from: 2, to: 8 },
      }],
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const invoke = vi.fn(async (channel) => {
      if (
        channel === STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL ||
        channel === STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL
      ) {
        return eventBlock;
      }
      if (
        channel === STRUCTURE_LINK_EVENT_SOURCE_CHANNEL ||
        channel === STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL ||
        channel === STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL
      ) {
        return eventSource;
      }
      return {
        schemaVersion: 1,
        workId,
        eventBlocks: [eventBlock],
        eventSources: [eventSource],
      };
    });
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 8, head: 2 },
      exactQuote: "선택한 원문",
      title: "첫 사건",
      note: "",
    } as const;
    const anchorlessCommand = {
      schemaVersion: 1,
      workId,
      title: "예정 사건",
      note: "",
    } as const;
    const linkCommand = {
      schemaVersion: 1,
      workId,
      eventBlockId: eventBlock.eventBlockId,
      role: "primary",
      documentId,
      selection: { anchor: 8, head: 2 },
      exactQuote: "선택한 원문",
    } as const;
    const replaceCommand = {
      schemaVersion: 1,
      workId,
      eventSourceId: eventSource.eventSourceId,
      expectedRevision: 1,
      documentId,
      selection: { anchor: 8, head: 2 },
      exactQuote: "선택한 원문",
    } as const;
    const retireCommand = {
      schemaVersion: 1,
      workId,
      eventSourceId: eventSource.eventSourceId,
      expectedRevision: 1,
    } as const;
    const moveCommand = {
      schemaVersion: 1,
      workId,
      eventBlockId: eventBlock.eventBlockId,
      expectedRevision: 1,
    } as const;

    await expect(
      bridge.structure.createEventBlock(command),
    ).resolves.toEqual(eventBlock);
    await expect(
      bridge.structure.createAnchorlessEvent(anchorlessCommand),
    ).resolves.toEqual(eventBlock);
    await expect(
      bridge.structure.moveEventBlock(moveCommand),
    ).resolves.toEqual({
      schemaVersion: 1,
      workId,
      eventBlocks: [eventBlock],
      eventSources: [eventSource],
    });
    await expect(
      bridge.structure.linkEventSource(linkCommand),
    ).resolves.toEqual(eventSource);
    await expect(
      bridge.structure.replaceEventSource(replaceCommand),
    ).resolves.toEqual(eventSource);
    await expect(
      bridge.structure.retireEventSource(retireCommand),
    ).resolves.toEqual(eventSource);
    await expect(
      bridge.structure.listEventBlocks({ schemaVersion: 1, workId }),
    ).resolves.toEqual({
      schemaVersion: 1,
      workId,
      eventBlocks: [eventBlock],
      eventSources: [eventSource],
    });
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
      command,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
      anchorlessCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL,
      moveCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LINK_EVENT_SOURCE_CHANNEL,
      linkCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
      replaceCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL,
      retireCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
      { schemaVersion: 1, workId },
    );
  });

  it("exposes the authoritative Work-wide event rail on one narrow channel", async () => {
    const workId = entityId<"Work">(randomUUID());
    const now = new Date().toISOString();
    const projection = {
      schemaVersion: 1,
      workId,
      documents: [],
      eventBlocks: [],
      eventSources: [],
      plotEventLinks: [],
      board: {
        schemaVersion: 1,
        plotBoardId: entityId<"PlotBoard">(randomUUID()),
        revision: 1,
        workId,
        title: "기본 플롯 보드",
        mode: "sequence",
        createdAt: now,
        updatedAt: now,
        lanes: [],
      },
      manuscriptEvents: [],
      unpositionedEvents: [],
      plotCards: [],
      unplottedEvents: [],
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const command = { schemaVersion: 1, workId } as const;

    await expect(bridge.structure.listEventRail(command)).resolves.toEqual(
      projection,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_EVENT_RAIL_CHANNEL,
      command,
    );
  });

  it("exposes the final scene projection and its two explicit mutations on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const sceneRuleSetId = entityId<"SceneRuleSet">(randomUUID());
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const now = new Date().toISOString();
    const projection = {
      schemaVersion: 1,
      workId,
      status: "clean",
      ruleSet: {
        schemaVersion: 1,
        sceneRuleSetId,
        revision: 1,
        workId,
        displayName: "기본 장면 규칙",
        boundaryRules: [{
          boundaryRuleId: "divider",
          kind: "line-regexp",
          pattern: "^---$",
          flags: "u",
        }],
        normalizationPolicy: "preserve",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      scenes: [],
      unassignedEvents: [{
        eventBlockId,
        title: "예정 사건",
        sourceState: "unlinked",
      }],
      sceneEventOverrides: [],
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const list = { schemaVersion: 1, workId } as const;
    const update = {
      schemaVersion: 1,
      workId,
      sceneRuleSetId,
      expectedRevision: 1,
      displayName: "기본 장면 규칙",
      boundaryRules: projection.ruleSet.boundaryRules,
      normalizationPolicy: "preserve",
      enabled: true,
    } as const;
    const setException = {
      schemaVersion: 1,
      workId,
      sceneKey: "scene-key",
      eventBlockId,
      operation: "include",
      expectedRevision: null,
    } as const;

    await expect(bridge.structure.listSceneProjection(list)).resolves.toEqual(
      projection,
    );
    await expect(bridge.structure.updateSceneRuleSet(update)).resolves.toEqual(
      projection,
    );
    await expect(
      bridge.structure.setSceneEventOverride(setException),
    ).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
      list,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
      update,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
      setException,
    );
  });

  it("exposes exact scene extraction requests and Candidate lists on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const invoke = vi.fn(async (channel: string) => {
      if (channel === STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL) {
        return { schemaVersion: 1, workId, candidates: [] };
      }
      if (channel === STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL) {
        return { schemaVersion: 1, workId, annotations: [] };
      }
      return { schemaVersion: 1, status: "login-required" };
    });
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      requestId: entityId<"SceneExtractionRequest">(randomUUID()),
      workId,
      conversationId: entityId<"AssistantConversation">(randomUUID()),
      sourceRange: {
        documentId,
        documentRevisionId,
        from: 3,
        to: 19,
      },
    } as const;

    await expect(bridge.structure.runSceneExtraction(command)).resolves.toEqual({
      schemaVersion: 1,
      status: "login-required",
    });
    await expect(bridge.structure.listSceneExtractionCandidates({
      schemaVersion: 1,
      workId,
    })).resolves.toEqual({ schemaVersion: 1, workId, candidates: [] });
    await expect(bridge.structure.listSceneAnnotations({
      schemaVersion: 1,
      workId,
    })).resolves.toEqual({ schemaVersion: 1, workId, annotations: [] });
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL,
      command,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
      { schemaVersion: 1, workId },
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL,
      { schemaVersion: 1, workId },
    );
  });

  it("exposes fragment profile and exact Work-scoped shelf commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const fragmentId = entityId<"Fragment">(randomUUID());
    const now = new Date().toISOString();
    const profile = {
      schemaVersion: 1,
      defaultKindId: "sentence",
      kinds: [{ id: "sentence", label: "문장" }],
    } as const;
    const fragment = {
      schemaVersion: 1,
      fragmentId,
      revision: 1,
      workId,
      sourceDocumentId: documentId,
      sourceDocumentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      sourceAnchorId: entityId<"Anchor">(randomUUID()),
      kindId: "sentence",
      title: "",
      pinned: false,
      useCount: 0,
      exactText: "선택 원문",
      integrity: "resolved",
      range: { from: 2, to: 7 },
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const list = { schemaVersion: 1, workId, fragments: [fragment] } as const;
    const retired = { ...fragment, revision: 2, retiredAt: now } as const;
    const used = { ...fragment, revision: 2, useCount: 1 } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === FRAGMENT_PROFILE_CHANNEL) return profile;
      if (channel === FRAGMENT_LIST_CHANNEL) return list;
      if (channel === FRAGMENT_RETIRE_CHANNEL) return retired;
      if (channel === FRAGMENT_RECORD_USE_CHANNEL) return used;
      return fragment;
    });
    const bridge = createStudioBridge(invoke);
    const capture = {
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 7, head: 2 },
      exactText: "선택 원문",
      kindId: "sentence",
      title: "",
    } as const;
    const update = {
      schemaVersion: 1,
      workId,
      fragmentId,
      expectedRevision: 1,
      changes: { pinned: true },
    } as const;
    const retire = {
      schemaVersion: 1,
      workId,
      fragmentId,
      expectedRevision: 1,
    } as const;
    const recordUse = {
      schemaVersion: 1,
      workId,
      fragmentId,
      expectedRevision: 1,
    } as const;

    await expect(bridge.fragments.getProfile()).resolves.toEqual(profile);
    await expect(bridge.fragments.capture(capture)).resolves.toEqual(fragment);
    await expect(bridge.fragments.list({ schemaVersion: 1, workId })).resolves.toEqual(list);
    await expect(bridge.fragments.update(update)).resolves.toEqual(fragment);
    await expect(bridge.fragments.recordUse(recordUse)).resolves.toEqual(used);
    await expect(bridge.fragments.retire(retire)).resolves.toEqual(retired);
    expect(invoke).toHaveBeenCalledWith(FRAGMENT_PROFILE_CHANNEL);
    expect(invoke).toHaveBeenCalledWith(FRAGMENT_CAPTURE_CHANNEL, capture);
    expect(invoke).toHaveBeenCalledWith(FRAGMENT_LIST_CHANNEL, { schemaVersion: 1, workId });
    expect(invoke).toHaveBeenCalledWith(FRAGMENT_UPDATE_CHANNEL, update);
    expect(invoke).toHaveBeenCalledWith(FRAGMENT_RECORD_USE_CHANNEL, recordUse);
    expect(invoke).toHaveBeenCalledWith(FRAGMENT_RETIRE_CHANNEL, retire);
  });

  it("exposes exact Work-scoped foreshadow line commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const lineId = entityId<"ForeshadowLine">(randomUUID());
    const now = new Date().toISOString();
    const line = {
      schemaVersion: 1,
      lineId,
      revision: 1,
      workId,
      title: "되돌아올 약속",
      note: "첫 회차에 심는다.",
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const list = { schemaVersion: 1, workId, lines: [line] } as const;
    const updated = {
      ...line,
      revision: 2,
      title: "바뀐 약속",
      updatedAt: now,
    } as const;
    const retired = {
      ...updated,
      revision: 3,
      retiredAt: now,
    } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === FORESHADOW_LIST_LINES_CHANNEL) return list;
      if (channel === FORESHADOW_UPDATE_LINE_CHANNEL) return updated;
      if (channel === FORESHADOW_RETIRE_LINE_CHANNEL) return retired;
      return line;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      title: "되돌아올 약속",
      note: "첫 회차에 심는다.",
    } as const;
    const update = {
      schemaVersion: 1,
      workId,
      lineId,
      expectedRevision: 1,
      changes: { title: "바뀐 약속" },
    } as const;
    const retire = {
      schemaVersion: 1,
      workId,
      lineId,
      expectedRevision: 2,
    } as const;

    await expect(bridge.foreshadowing.createLine(create)).resolves.toEqual(line);
    await expect(bridge.foreshadowing.listLines({
      schemaVersion: 1,
      workId,
    })).resolves.toEqual(list);
    await expect(bridge.foreshadowing.updateLine(update)).resolves.toEqual(updated);
    await expect(bridge.foreshadowing.retireLine(retire)).resolves.toEqual(retired);
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_CREATE_LINE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_LIST_LINES_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_UPDATE_LINE_CHANNEL, update);
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_RETIRE_LINE_CHANNEL, retire);
  });

  it("exposes exact Work-scoped character commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const characterId = entityId<"Character">(randomUUID());
    const otherCharacterId = entityId<"Character">(randomUUID());
    const relationId = entityId<"CharacterRelation">(randomUUID());
    const now = new Date().toISOString();
    const character = {
      schemaVersion: 1,
      characterId,
      revision: 1,
      workId,
      name: "윤서",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
      evidences: [],
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const list = { schemaVersion: 1, workId, characters: [character] } as const;
    const updated = {
      ...character,
      revision: 2,
      role: "기록자",
      updatedAt: now,
    } as const;
    const retired = { ...updated, revision: 3, retiredAt: now } as const;
    const relation = {
      schemaVersion: 1,
      relationId,
      revision: 1,
      workId,
      fromCharacterId: characterId,
      toCharacterId: otherCharacterId,
      kind: "동료",
      description: "",
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
      retirementReason: null,
    } as const;
    const updatedRelation = {
      ...relation,
      revision: 2,
      description: "서로를 신뢰한다.",
    } as const;
    const retiredRelation = {
      ...updatedRelation,
      revision: 3,
      retiredAt: now,
      retirementReason: "user",
    } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === CHARACTER_LIST_CHANNEL) return list;
      if (channel === CHARACTER_RELATION_LIST_CHANNEL) {
        return { schemaVersion: 1, workId, relations: [relation] };
      }
      if (channel === CHARACTER_RELATION_UPDATE_CHANNEL) return updatedRelation;
      if (channel === CHARACTER_RELATION_RETIRE_CHANNEL) return retiredRelation;
      if (channel === CHARACTER_RELATION_CREATE_CHANNEL) return relation;
      if (channel === CHARACTER_EXTRACTION_LIST_CHANNEL) {
        return { schemaVersion: 1, workId, candidates: [] };
      }
      if (channel === CHARACTER_EXTRACTION_RUN_CHANNEL) {
        return { schemaVersion: 1, status: "login-required" };
      }
      if (channel === CHARACTER_GENERATION_LIST_CHANNEL) {
        return { schemaVersion: 1, workId, candidates: [] };
      }
      if (channel === CHARACTER_GENERATION_RUN_CHANNEL) {
        return { schemaVersion: 1, status: "login-required" };
      }
      if (channel === CHARACTER_UPDATE_CHANNEL) return updated;
      if (channel === CHARACTER_ADD_EVIDENCE_CHANNEL) return updated;
      if (channel === CHARACTER_RETIRE_CHANNEL) return retired;
      return character;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      name: "윤서",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
    } as const;
    const update = {
      schemaVersion: 1,
      workId,
      characterId,
      expectedRevision: 1,
      changes: { role: "기록자" },
    } as const;
    const retire = {
      schemaVersion: 1,
      workId,
      characterId,
      expectedRevision: 2,
    } as const;
    const addEvidence = {
      schemaVersion: 1,
      workId,
      characterId,
      expectedRevision: 1,
      documentId: entityId<"Document">(randomUUID()),
      documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      selection: { anchor: 2, head: 5 },
    } as const;
    const runExtraction = {
      schemaVersion: 1,
      requestId: entityId<"CharacterExtractionRequest">(randomUUID()),
      workId,
      conversationId: entityId<"AssistantConversation">(randomUUID()),
      sourceRange: {
        documentId: addEvidence.documentId,
        documentRevisionId: addEvidence.documentRevisionId,
        from: 2,
        to: 5,
      },
    } as const;
    const runGeneration = {
      schemaVersion: 1,
      requestId: entityId<"CharacterGenerationRequest">(randomUUID()),
      workId,
      brief: {
        role: "탐정",
        personality: "집요함",
        relationships: "기록자와 협력",
        genre: "미스터리",
      },
    } as const;
    const createRelation = {
      schemaVersion: 1,
      workId,
      fromCharacterId: characterId,
      toCharacterId: otherCharacterId,
      kind: "동료",
      description: "",
    } as const;
    const updateRelation = {
      schemaVersion: 1,
      workId,
      relationId,
      expectedRevision: 1,
      changes: { description: "서로를 신뢰한다." },
    } as const;
    const retireRelation = {
      schemaVersion: 1,
      workId,
      relationId,
      expectedRevision: 2,
    } as const;

    await expect(bridge.characters.create(create)).resolves.toEqual(character);
    await expect(bridge.characters.list({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    await expect(bridge.characters.update(update)).resolves.toEqual(updated);
    await expect(bridge.characters.addEvidence(addEvidence)).resolves.toEqual(
      updated,
    );
    await expect(bridge.characters.retire(retire)).resolves.toEqual(retired);
    await expect(bridge.characters.createRelation(createRelation)).resolves
      .toEqual(relation);
    await expect(bridge.characters.listRelations({ schemaVersion: 1, workId }))
      .resolves.toEqual({ schemaVersion: 1, workId, relations: [relation] });
    await expect(bridge.characters.updateRelation(updateRelation)).resolves
      .toEqual(updatedRelation);
    await expect(bridge.characters.retireRelation(retireRelation)).resolves
      .toEqual(retiredRelation);
    await expect(bridge.characters.runExtraction(runExtraction)).resolves.toEqual({
      schemaVersion: 1,
      status: "login-required",
    });
    await expect(bridge.characters.listExtractionCandidates({
      schemaVersion: 1,
      workId,
    })).resolves.toEqual({ schemaVersion: 1, workId, candidates: [] });
    await expect(bridge.characters.runGeneration(runGeneration)).resolves.toEqual({
      schemaVersion: 1,
      status: "login-required",
    });
    await expect(bridge.characters.listGenerationCandidates({
      schemaVersion: 1,
      workId,
    })).resolves.toEqual({ schemaVersion: 1, workId, candidates: [] });
    expect(invoke).toHaveBeenCalledWith(CHARACTER_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(CHARACTER_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
    expect(invoke).toHaveBeenCalledWith(CHARACTER_UPDATE_CHANNEL, update);
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_ADD_EVIDENCE_CHANNEL,
      addEvidence,
    );
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_EXTRACTION_RUN_CHANNEL,
      runExtraction,
    );
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_GENERATION_RUN_CHANNEL,
      runGeneration,
    );
    expect(invoke).toHaveBeenCalledWith(CHARACTER_RETIRE_CHANNEL, retire);
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_RELATION_CREATE_CHANNEL,
      createRelation,
    );
    expect(invoke).toHaveBeenCalledWith(CHARACTER_RELATION_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_RELATION_UPDATE_CHANNEL,
      updateRelation,
    );
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_RELATION_RETIRE_CHANNEL,
      retireRelation,
    );
  });

  it("exposes exact Work-scoped lore commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const loreEntryId = entityId<"LoreEntry">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const historyId = entityId<"LoreEntryHistory">(randomUUID());
    const now = new Date().toISOString();
    const entry = {
      schemaVersion: 1,
      loreEntryId,
      revision: 1,
      workId,
      title: "북쪽 탑",
      content: "종이 세 번 울린다.",
      category: "사용자 분류",
      aliases: ["북탑"],
      enabled: true,
      evidences: [{
        anchorId,
        sourceDocumentId: documentId,
        sourceDocumentRevisionId: revisionId,
        exactText: "종이 세 번 울렸다",
        integrity: "resolved",
        range: { from: 4, to: 14 },
        createdAt: now,
      }],
      history: [{
        historyId,
        entryRevision: 1,
        changeKind: "created",
        title: "북쪽 탑",
        content: "종이 세 번 울린다.",
        category: "사용자 분류",
        aliases: ["북탑"],
        enabled: true,
        evidenceAnchorIds: [anchorId],
        changedAt: now,
      }],
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const list = { schemaVersion: 1, workId, entries: [entry] } as const;
    const updated = { ...entry, revision: 2, enabled: false } as const;
    const withEvidence = { ...entry, revision: 3 } as const;
    const retired = { ...entry, revision: 4, retiredAt: now } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === LORE_ENTRY_LIST_CHANNEL) return list;
      if (channel === LORE_ENTRY_UPDATE_CHANNEL) return updated;
      if (channel === LORE_ENTRY_ADD_EVIDENCE_CHANNEL) return withEvidence;
      if (channel === LORE_ENTRY_RETIRE_CHANNEL) return retired;
      return entry;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      title: "북쪽 탑",
      content: "종이 세 번 울린다.",
      category: "사용자 분류",
      aliases: ["북탑"],
      enabled: true,
      evidence: null,
    } as const;
    const update = {
      schemaVersion: 1,
      workId,
      loreEntryId,
      expectedRevision: 1,
      changes: { enabled: false },
    } as const;
    const addEvidence = {
      schemaVersion: 1,
      workId,
      loreEntryId,
      expectedRevision: 2,
      documentId,
      selection: { anchor: 4, head: 14 },
      exactText: "종이 세 번 울렸다",
    } as const;
    const retire = {
      schemaVersion: 1,
      workId,
      loreEntryId,
      expectedRevision: 3,
    } as const;

    await expect(bridge.loreEntries.create(create)).resolves.toEqual(entry);
    await expect(bridge.loreEntries.list({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    await expect(bridge.loreEntries.update(update)).resolves.toEqual(updated);
    await expect(bridge.loreEntries.addEvidence(addEvidence)).resolves.toEqual(withEvidence);
    await expect(bridge.loreEntries.retire(retire)).resolves.toEqual(retired);
    expect(invoke).toHaveBeenCalledWith(LORE_ENTRY_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(LORE_ENTRY_LIST_CHANNEL, { schemaVersion: 1, workId });
    expect(invoke).toHaveBeenCalledWith(LORE_ENTRY_UPDATE_CHANNEL, update);
    expect(invoke).toHaveBeenCalledWith(LORE_ENTRY_ADD_EVIDENCE_CHANNEL, addEvidence);
    expect(invoke).toHaveBeenCalledWith(LORE_ENTRY_RETIRE_CHANNEL, retire);
  });

  it("exposes Work-scoped lore Candidate review commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const candidateId = entityId<"LoreCandidate">(randomUUID());
    const loreEntryId = entityId<"LoreEntry">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const historyId = entityId<"LoreEntryHistory">(randomUUID());
    const now = new Date().toISOString();
    const proposal = {
      kind: "create",
      title: "북쪽 탑",
      content: "종이 세 번 울린다.",
      category: "장소",
      aliases: ["북탑"],
      enabled: true,
    } as const;
    const candidate = {
      schemaVersion: 1,
      candidateId,
      revision: 1,
      workId,
      source: "user",
      certainty: "explicit",
      proposal,
      evidence: {
        anchorId,
        sourceDocumentId: documentId,
        sourceDocumentRevisionId: revisionId,
        exactText: "종이 세 번 울렸다",
        integrity: "resolved",
        range: { from: 4, to: 14 },
      },
      reason: "선택한 문장을 별빛으로 검토",
      status: "pending",
      approvedLoreEntryId: null,
      approvalBlockReason: null,
      createdAt: now,
      reviewedAt: null,
    } as const;
    const rejected = {
      ...candidate,
      revision: 2,
      status: "rejected",
      approvalBlockReason: "already-reviewed",
      reviewedAt: now,
    } as const;
    const approved = {
      ...candidate,
      revision: 2,
      status: "approved",
      approvedLoreEntryId: loreEntryId,
      approvalBlockReason: "already-reviewed",
      reviewedAt: now,
    } as const;
    const loreEntry = {
      schemaVersion: 1,
      loreEntryId,
      revision: 1,
      workId,
      title: proposal.title,
      content: proposal.content,
      category: proposal.category,
      aliases: proposal.aliases,
      enabled: proposal.enabled,
      evidences: [{
        anchorId,
        sourceDocumentId: documentId,
        sourceDocumentRevisionId: revisionId,
        exactText: candidate.evidence.exactText,
        integrity: "resolved",
        range: candidate.evidence.range,
        createdAt: now,
      }],
      history: [{
        historyId,
        entryRevision: 1,
        changeKind: "created",
        title: proposal.title,
        content: proposal.content,
        category: proposal.category,
        aliases: proposal.aliases,
        enabled: proposal.enabled,
        evidenceAnchorIds: [anchorId],
        changedAt: now,
      }],
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const list = { schemaVersion: 1, workId, candidates: [candidate] } as const;
    const approval = { schemaVersion: 1, candidate: approved, loreEntry } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === LORE_CANDIDATE_LIST_CHANNEL) return list;
      if (channel === LORE_CANDIDATE_APPROVE_CHANNEL) return approval;
      if (channel === LORE_CANDIDATE_REJECT_CHANNEL) return rejected;
      return candidate;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 4, head: 14 },
      exactText: candidate.evidence.exactText,
      source: "user",
      certainty: "explicit",
      proposal,
      reason: candidate.reason,
    } as const;
    const review = {
      schemaVersion: 1,
      workId,
      candidateId,
      expectedRevision: 1,
    } as const;

    await expect(bridge.loreCandidates.create(create)).resolves.toEqual(candidate);
    await expect(bridge.loreCandidates.list({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    await expect(bridge.loreCandidates.approve(review)).resolves.toEqual(approval);
    await expect(bridge.loreCandidates.reject(review)).resolves.toEqual(rejected);
    expect(invoke).toHaveBeenCalledWith(LORE_CANDIDATE_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(LORE_CANDIDATE_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
    expect(invoke).toHaveBeenCalledWith(LORE_CANDIDATE_APPROVE_CHANNEL, review);
    expect(invoke).toHaveBeenCalledWith(LORE_CANDIDATE_REJECT_CHANNEL, review);
  });

  it("exposes identifier-only lore and foreshadow links on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const loreEntryId = entityId<"LoreEntry">(randomUUID());
    const lineId = entityId<"ForeshadowLine">(randomUUID());
    const linkId = entityId<"LoreForeshadowLink">(randomUUID());
    const now = new Date().toISOString();
    const link = {
      schemaVersion: 1,
      linkId,
      revision: 1,
      workId,
      loreEntryId,
      lineId,
      linkedAt: now,
      unlinkedAt: null,
      unlinkReason: null,
    } as const;
    const unlinked = {
      ...link,
      revision: 2,
      unlinkedAt: now,
      unlinkReason: "user",
    } as const;
    const list = { schemaVersion: 1, workId, links: [link] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === LORE_FORESHADOW_LIST_CHANNEL) return list;
      if (channel === LORE_FORESHADOW_UNLINK_CHANNEL) return unlinked;
      return link;
    });
    const bridge = createStudioBridge(invoke);
    const create = { schemaVersion: 1, workId, loreEntryId, lineId } as const;
    const unlink = {
      schemaVersion: 1,
      workId,
      linkId,
      expectedRevision: 1,
    } as const;

    await expect(bridge.loreForeshadowLinks.link(create)).resolves.toEqual(link);
    await expect(bridge.loreForeshadowLinks.list({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    await expect(bridge.loreForeshadowLinks.unlink(unlink)).resolves.toEqual(unlinked);
    expect(invoke).toHaveBeenCalledWith(LORE_FORESHADOW_LINK_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(LORE_FORESHADOW_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
    expect(invoke).toHaveBeenCalledWith(LORE_FORESHADOW_UNLINK_CHANNEL, unlink);
  });

  it("exposes shared publishing partner commands on narrow channels", async () => {
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    const now = new Date().toISOString();
    const partner = {
      schemaVersion: 1,
      partnerId,
      revision: 1,
      name: "별빛문고",
      parentPartnerId: null,
      submissionMethod: "온라인 폼",
      websiteUrl: "https://publisher.example/submission",
      email: "story@publisher.example",
      genres: ["판타지"],
      requiredLength: "원고 3화",
      priority: "이번 달",
      note: "마감일 확인",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    } as const;
    const updated = {
      ...partner,
      revision: 2,
      email: "novel@publisher.example",
    } as const;
    const list = { schemaVersion: 1, partners: [updated] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_PARTNER_LIST_CHANNEL) return list;
      if (channel === PUBLISHING_PARTNER_UPDATE_CHANNEL) return updated;
      return partner;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      name: "별빛문고",
      parentPartnerId: null,
      submissionMethod: "온라인 폼",
      websiteUrl: "https://publisher.example/submission",
      email: "story@publisher.example",
      genres: ["판타지"],
      requiredLength: "원고 3화",
      priority: "이번 달",
      note: "마감일 확인",
    } as const;
    const update = {
      schemaVersion: 1,
      partnerId,
      expectedRevision: 1,
      changes: { email: "novel@publisher.example" },
    } as const;

    await expect(bridge.publishingPartners.create(create)).resolves.toEqual(partner);
    await expect(bridge.publishingPartners.list({ schemaVersion: 1 }))
      .resolves.toEqual(list);
    await expect(bridge.publishingPartners.update(update)).resolves.toEqual(updated);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PARTNER_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PARTNER_LIST_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PARTNER_UPDATE_CHANNEL, update);
  });

  it("exposes immutable submission packages and editable history on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    const submissionId = entityId<"PublishingSubmission">(randomUUID());
    const now = new Date().toISOString();
    const submission = {
      schemaVersion: 1,
      submissionId,
      revision: 1,
      workId,
      partnerId,
      title: "봄 투고",
      status: "접수",
      submittedOn: "2026-08-10",
      respondedOn: null,
      result: "",
      note: "접수 번호 보관",
      cardNote: "장르 편집부",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
      package: {
        schemaVersion: 1,
        submissionPackageId: entityId<"SubmissionPackage">(randomUUID()),
        workId,
        partnerId,
        workSnapshotId: entityId<"WorkSnapshot">(randomUUID()),
        workTitleSnapshot: "별빛 아래",
        partnerNameSnapshot: "은하출판",
        manifestHash: "package-manifest",
        sealedAt: now,
        documentRevisions: [{
          documentId: entityId<"Document">(randomUUID()),
          documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
        }],
      },
    } as const;
    const updated = {
      ...submission,
      revision: 2,
      status: "회신 완료",
      respondedOn: "2026-08-18",
      result: "수정 요청",
    } as const;
    const list = { schemaVersion: 1, submissions: [updated] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_SUBMISSION_LIST_CHANNEL) return list;
      if (channel === PUBLISHING_SUBMISSION_UPDATE_CHANNEL) return updated;
      return submission;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      partnerId,
      title: "봄 투고",
      status: "접수",
      submittedOn: "2026-08-10",
      respondedOn: null,
      result: "",
      note: "접수 번호 보관",
      cardNote: "장르 편집부",
    } as const;
    const update = {
      schemaVersion: 1,
      submissionId,
      expectedRevision: 1,
      changes: {
        status: "회신 완료",
        respondedOn: "2026-08-18",
        result: "수정 요청",
      },
    } as const;

    await expect(bridge.publishingSubmissions.create(create)).resolves.toEqual(submission);
    await expect(bridge.publishingSubmissions.list({ schemaVersion: 1, workId: null }))
      .resolves.toEqual(list);
    await expect(bridge.publishingSubmissions.update(update)).resolves.toEqual(updated);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SUBMISSION_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SUBMISSION_LIST_CHANNEL, {
      schemaVersion: 1,
      workId: null,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SUBMISSION_UPDATE_CHANNEL, update);
  });

  it("exposes Work-owned publishing contracts on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    const submissionId = entityId<"PublishingSubmission">(randomUUID());
    const contractId = entityId<"PublishingContract">(randomUUID());
    const now = new Date().toISOString();
    const contract = {
      schemaVersion: 1,
      contractId,
      revision: 1,
      workId,
      partnerId,
      submissionId,
      title: "전자 출판 계약",
      workTitleSnapshot: "별빛 아래",
      partnerNameSnapshot: "은하출판",
      status: "체결",
      signedOn: "2026-08-20",
      startsOn: "2026-09-01",
      endsOn: "2028-08-31",
      rightsScope: "국내 전자 출판권",
      advanceAmount: 1500000,
      currencyCode: "KRW",
      revenueShareNote: "순매출 기준",
      note: "원본 계약서는 별도 보관",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    } as const;
    const updated = { ...contract, revision: 2, status: "진행 중" } as const;
    const list = { schemaVersion: 1, contracts: [updated] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_CONTRACT_LIST_CHANNEL) return list;
      if (channel === PUBLISHING_CONTRACT_UPDATE_CHANNEL) return updated;
      return contract;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      partnerId,
      submissionId,
      title: "전자 출판 계약",
      status: "체결",
      signedOn: "2026-08-20",
      startsOn: "2026-09-01",
      endsOn: "2028-08-31",
      rightsScope: "국내 전자 출판권",
      advanceAmount: 1500000,
      currencyCode: "KRW",
      revenueShareNote: "순매출 기준",
      note: "원본 계약서는 별도 보관",
    } as const;
    const update = {
      schemaVersion: 1,
      contractId,
      expectedRevision: 1,
      changes: { status: "진행 중" },
    } as const;

    await expect(bridge.publishingContracts.create(create)).resolves.toEqual(contract);
    await expect(bridge.publishingContracts.list({ schemaVersion: 1, workId: null }))
      .resolves.toEqual(list);
    await expect(bridge.publishingContracts.update(update)).resolves.toEqual(updated);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_CONTRACT_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_CONTRACT_LIST_CHANNEL, {
      schemaVersion: 1,
      workId: null,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_CONTRACT_UPDATE_CHANNEL, update);
  });

  it("exposes exact Work-scoped publication commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const contractId = entityId<"PublishingContract">(randomUUID());
    const channelPartnerId = entityId<"PublishingPartner">(randomUUID());
    const publicationId = entityId<"PublishingPublication">(randomUUID());
    const now = new Date().toISOString();
    const publication = {
      schemaVersion: 1,
      publicationId,
      revision: 1,
      workId,
      contractId,
      channelPartnerId,
      title: "주 2회 연재",
      workTitleSnapshot: "별빛 아래",
      channelNameSnapshot: "별빛 연재관",
      status: "연재 중",
      format: "웹 연재",
      scheduledOn: "2026-09-01",
      startsOn: "2026-09-03",
      endsOn: null,
      publishedUnitCount: 12,
      plannedUnitCount: 40,
      scheduleNote: "화·금 공개",
      note: "채널 공지 확인",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    } as const;
    const updated = { ...publication, revision: 2, status: "휴재" } as const;
    const list = { schemaVersion: 1, publications: [updated] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_PUBLICATION_LIST_CHANNEL) return list;
      if (channel === PUBLISHING_PUBLICATION_UPDATE_CHANNEL) return updated;
      return publication;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      contractId,
      channelPartnerId,
      title: "주 2회 연재",
      status: "연재 중",
      format: "웹 연재",
      scheduledOn: "2026-09-01",
      startsOn: "2026-09-03",
      endsOn: null,
      publishedUnitCount: 12,
      plannedUnitCount: 40,
      scheduleNote: "화·금 공개",
      note: "채널 공지 확인",
    } as const;
    const update = {
      schemaVersion: 1,
      publicationId,
      expectedRevision: 1,
      changes: { status: "휴재" },
    } as const;

    await expect(bridge.publishingPublications.create(create)).resolves.toEqual(publication);
    await expect(bridge.publishingPublications.list({ schemaVersion: 1, workId: null }))
      .resolves.toEqual(list);
    await expect(bridge.publishingPublications.update(update)).resolves.toEqual(updated);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PUBLICATION_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PUBLICATION_LIST_CHANNEL, {
      schemaVersion: 1,
      workId: null,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PUBLICATION_UPDATE_CHANNEL, update);
  });

  it("exposes exact Work-scoped settlement commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const publicationId = entityId<"PublishingPublication">(randomUUID());
    const settlementId = entityId<"PublishingSettlement">(randomUUID());
    const now = new Date().toISOString();
    const settlement = {
      schemaVersion: 1,
      settlementId,
      revision: 1,
      workId,
      publicationId,
      title: "9월 정산서",
      workTitleSnapshot: "별빛 아래",
      publicationTitleSnapshot: "주 2회 연재",
      periodStartsOn: "2026-09-01",
      periodEndsOn: "2026-09-30",
      issuedOn: "2026-10-10",
      reviewStatus: "검토 중",
      currencyCode: "KRW",
      reportedAmount: 1250000,
      items: [],
      note: "원문 파일 별도 보관",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    } as const;
    const updated = { ...settlement, revision: 2, reviewStatus: "확인 완료" } as const;
    const list = { schemaVersion: 1, settlements: [updated] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_SETTLEMENT_LIST_CHANNEL) return list;
      if (channel === PUBLISHING_SETTLEMENT_UPDATE_CHANNEL) return updated;
      return settlement;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      publicationId,
      title: "9월 정산서",
      periodStartsOn: "2026-09-01",
      periodEndsOn: "2026-09-30",
      issuedOn: "2026-10-10",
      reviewStatus: "검토 중",
      currencyCode: "KRW",
      reportedAmount: 1250000,
      items: [],
      note: "원문 파일 별도 보관",
    } as const;
    const update = {
      schemaVersion: 1,
      settlementId,
      expectedRevision: 1,
      changes: { reviewStatus: "확인 완료" },
    } as const;

    await expect(bridge.publishingSettlements.create(create)).resolves.toEqual(settlement);
    await expect(bridge.publishingSettlements.list({ schemaVersion: 1, workId: null }))
      .resolves.toEqual(list);
    await expect(bridge.publishingSettlements.update(update)).resolves.toEqual(updated);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SETTLEMENT_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SETTLEMENT_LIST_CHANNEL, {
      schemaVersion: 1,
      workId: null,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SETTLEMENT_UPDATE_CHANNEL, update);
  });

  it("exposes exact Work-scoped payment commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const settlementId = entityId<"PublishingSettlement">(randomUUID());
    const paymentId = entityId<"PublishingPayment">(randomUUID());
    const now = new Date().toISOString();
    const payment = {
      schemaVersion: 1,
      paymentId,
      revision: 1,
      workId,
      settlementId,
      workTitleSnapshot: "별빛 아래",
      settlementTitleSnapshot: "9월 정산서",
      receivedOn: "2026-10-15",
      confirmedOn: null,
      amount: 600000,
      currencyCode: "KRW",
      matchStatus: "부분 입금",
      payerLabel: "별빛 연재관",
      reference: "BANK-2026-10",
      note: "1차 입금",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    } as const;
    const updated = { ...payment, revision: 2, matchStatus: "확인 완료" } as const;
    const list = { schemaVersion: 1, payments: [updated] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_PAYMENT_LIST_CHANNEL) return list;
      if (channel === PUBLISHING_PAYMENT_UPDATE_CHANNEL) return updated;
      return payment;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      settlementId,
      receivedOn: "2026-10-15",
      confirmedOn: null,
      amount: 600000,
      currencyCode: "KRW",
      matchStatus: "부분 입금",
      payerLabel: "별빛 연재관",
      reference: "BANK-2026-10",
      note: "1차 입금",
    } as const;
    const update = {
      schemaVersion: 1,
      paymentId,
      expectedRevision: 1,
      changes: { matchStatus: "확인 완료" },
    } as const;

    await expect(bridge.publishingPayments.create(create)).resolves.toEqual(payment);
    await expect(bridge.publishingPayments.list({ schemaVersion: 1, workId: null }))
      .resolves.toEqual(list);
    await expect(bridge.publishingPayments.update(update)).resolves.toEqual(updated);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PAYMENT_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PAYMENT_LIST_CHANNEL, {
      schemaVersion: 1,
      workId: null,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PAYMENT_UPDATE_CHANNEL, update);
  });

  it("exposes exact Studio-shared source commands on narrow channels", async () => {
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const source = {
      schemaVersion: 1,
      sourceId,
      revision: 1,
      kind: "사용자 진술",
      label: "계약서 원본 확인",
      url: null,
      observedAt: "2026-10-16T03:30:00.000Z",
      authority: "직접 확인",
      importedFields: {},
      createdAt: "2026-10-16T03:31:00.000Z",
    } as const;
    const list = { schemaVersion: 1, sources: [source] } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PUBLISHING_SOURCE_LIST_CHANNEL ? list : source,
    );
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      kind: "사용자 진술",
      label: "계약서 원본 확인",
      url: null,
      observedAt: "2026-10-16T03:30:00.000Z",
      authority: "직접 확인",
      importedFields: {},
    } as const;

    await expect(bridge.publishingSources.create(create)).resolves.toEqual(source);
    await expect(bridge.publishingSources.list({ schemaVersion: 1 })).resolves.toEqual(list);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SOURCE_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SOURCE_LIST_CHANNEL, { schemaVersion: 1 });
  });

  it("exposes publishing research preview and explicit approval on narrow channels", async () => {
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const sourceInput = {
      label: "공식 투고 안내",
      url: "https://publisher.example/submissions",
      observedOn: "2026-08-10",
      authority: "공식 홈페이지",
    } as const;
    const proposals = {
      websiteUrl: "https://publisher.example/submit",
      genres: ["판타지", "로맨스"],
    } as const;
    const preview = {
      schemaVersion: 1,
      partnerId,
      expectedRevision: 1,
      source: sourceInput,
      proposals,
      fields: [
        { field: "websiteUrl", current: "", proposed: proposals.websiteUrl, conflict: false },
        { field: "genres", current: ["판타지"], proposed: proposals.genres, conflict: true },
      ],
    } as const;
    const approval = {
      schemaVersion: 1,
      partner: {
        schemaVersion: 1,
        partnerId,
        revision: 2,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "이메일",
        websiteUrl: proposals.websiteUrl,
        email: "old@example.test",
        genres: proposals.genres,
        requiredLength: "",
        priority: "",
        note: "",
        sourceIds: [sourceId],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:01:00.000Z",
      },
      source: {
        schemaVersion: 1,
        sourceId,
        revision: 1,
        kind: "web",
        label: sourceInput.label,
        url: sourceInput.url,
        observedAt: "2026-08-10T00:00:00.000Z",
        authority: sourceInput.authority,
        importedFields: {
          websiteUrl: proposals.websiteUrl,
          genres: "[\"판타지\",\"로맨스\"]",
        },
        createdAt: "2026-08-10T00:01:00.000Z",
      },
    } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PUBLISHING_RESEARCH_PREVIEW_CHANNEL ? preview : approval,
    );
    const bridge = createStudioBridge(invoke);
    const previewCommand = {
      schemaVersion: 1,
      partnerId,
      source: sourceInput,
      proposals,
    } as const;
    const approveCommand = {
      ...previewCommand,
      expectedRevision: preview.expectedRevision,
      selectedFields: ["websiteUrl", "genres"],
    } as const;

    await expect(bridge.publishingResearch.preview(previewCommand)).resolves.toEqual(preview);
    await expect(bridge.publishingResearch.approve(approveCommand)).resolves.toEqual(approval);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_RESEARCH_PREVIEW_CHANNEL, previewCommand);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_RESEARCH_APPROVE_CHANNEL, approveCommand);
  });

  it("runs and approves publishing assistant work on two narrow channels", async () => {
    const requestId = entityId<"AssistantConnectorRequest">(randomUUID());
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const runCommand = {
      schemaVersion: 1,
      requestId,
      connectionId,
      statement: "회신이 없는 투고를 보여줘",
    } as const;
    const approveCommand = {
      schemaVersion: 1,
      candidateId: randomUUID(),
    } as const;
    const receipt = {
      schemaVersion: 1,
      receiptId: entityId<"ConnectorReceipt">(randomUUID()),
      requestId,
      connectionId,
      connectorKind: "test-structured-json",
      operation: "publishing-intent",
      requestFingerprint: "sha256:publishing",
      startedAt: "2026-08-10T00:00:00.000Z",
      completedAt: "2026-08-10T00:00:01.000Z",
      resultState: "succeeded",
    } as const;
    const result = {
      schemaVersion: 1,
      status: "query",
      statement: runCommand.statement,
      query: "open",
      workId: null,
      submissionIds: [],
      partnerIds: [],
      receipt,
    } as const;
    const approval = {
      schemaVersion: 1,
      source: {
        schemaVersion: 1,
        sourceId,
        revision: 1,
        kind: "user-statement",
        label: "어제 두 곳에 보냈어",
        url: null,
        observedAt: "2026-08-10T00:00:02.000Z",
        authority: "",
        importedFields: { statement: "어제 두 곳에 보냈어" },
        createdAt: "2026-08-10T00:00:02.000Z",
      },
      submissions: [],
    } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PUBLISHING_ASSISTANT_RUN_CHANNEL ? result : approval,
    );
    const bridge = createStudioBridge(invoke);

    await expect(bridge.publishingAssistant.run(runCommand)).resolves.toEqual(result);
    await expect(bridge.publishingAssistant.approve(approveCommand)).resolves.toEqual(approval);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_ASSISTANT_RUN_CHANNEL, runCommand);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_ASSISTANT_APPROVE_CHANNEL, approveCommand);
  });

  it("exposes an explicit publishing evidence selection on one narrow channel", async () => {
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const paymentId = entityId<"PublishingPayment">(randomUUID());
    const command = {
      schemaVersion: 1,
      targetKind: "payment",
      targetId: paymentId,
      expectedRevision: 1,
      sourceIds: [sourceId],
    } as const;
    const projection = {
      schemaVersion: 1,
      targetKind: "payment",
      targetId: paymentId,
      revision: 2,
      sourceIds: [sourceId],
      updatedAt: "2026-10-16T04:00:00.000Z",
    } as const;
    const invoke = vi.fn(async () => projection);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.publishingEvidence.setLinks(command)).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL, command);
  });

  it("selects and applies an explicitly mapped publishing partner CSV on narrow channels", async () => {
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    const selection = {
      schemaVersion: 1,
      status: "selected",
      fileName: "투고처.csv",
      csvText: "이름,이메일\n새 문고,mail@example.test",
    } as const;
    const apply = {
      schemaVersion: 1,
      fileName: selection.fileName,
      csvText: selection.csvText,
      mapping: { name: "이름", email: "이메일" },
    } as const;
    const result = {
      schemaVersion: 1,
      importedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedRowNumbers: [],
      partnerIds: [partnerId],
      sourceIds: [sourceId],
    } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PUBLISHING_PARTNER_CSV_SELECT_CHANNEL ? selection : result,
    );
    const bridge = createStudioBridge(invoke);

    await expect(bridge.publishingImports.selectPartnerCsv({ schemaVersion: 1 }))
      .resolves.toEqual(selection);
    await expect(bridge.publishingImports.applyPartnerCsv(apply)).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PARTNER_CSV_SELECT_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_PARTNER_CSV_APPLY_CHANNEL, apply);
  });

  it("selects and applies an explicitly mapped publishing submission CSV on narrow channels", async () => {
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const submissionId = entityId<"PublishingSubmission">(randomUUID());
    const submissionPackageId = entityId<"SubmissionPackage">(randomUUID());
    const selection = {
      schemaVersion: 1,
      status: "selected",
      fileName: "투고 이력.csv",
      csvText: "작품,투고처\n긴 여름,한빛 문고",
    } as const;
    const apply = {
      schemaVersion: 1,
      fileName: selection.fileName,
      csvText: selection.csvText,
      mapping: { workLabel: "작품", partnerLabel: "투고처" },
    } as const;
    const result = {
      schemaVersion: 1,
      importedCount: 1,
      skippedRowNumbers: [],
      submissionIds: [submissionId],
      submissionPackageIds: [submissionPackageId],
      sourceIds: [sourceId],
    } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL ? selection : result,
    );
    const bridge = createStudioBridge(invoke);

    await expect(bridge.publishingImports.selectSubmissionCsv({ schemaVersion: 1 }))
      .resolves.toEqual(selection);
    await expect(bridge.publishingImports.applySubmissionCsv(apply)).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL, apply);
  });

  it("exposes explicit publishing mail candidate review commands without a recording channel", async () => {
    const candidateId = entityId<"PublishingMailCandidate">(randomUUID());
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const submissionId = entityId<"PublishingSubmission">(randomUUID());
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    const now = "2026-08-12T02:30:00.000Z";
    const candidate = {
      schemaVersion: 1,
      candidateId,
      revision: 1,
      sourceId,
      sourceAccountId: randomUUID(),
      messageId: randomUUID(),
      threadId: randomUUID(),
      from: "editor@example.test",
      subject: randomUUID(),
      receivedAt: now,
      snippet: randomUUID(),
      bodyFingerprint: randomUUID(),
      submissionId: null,
      partnerId: null,
      matchReason: "",
      proposedStatus: "회신 완료",
      proposedResult: "수정 요청",
      proposedRespondedOn: "2026-08-12",
      proposedNote: "",
      classificationConnectionId: null,
      classificationModel: "",
      reviewStatus: "needs-link",
      createdAt: now,
      updatedAt: now,
    } as const;
    const linked = {
      ...candidate,
      revision: 2,
      submissionId,
      partnerId,
      reviewStatus: "unreviewed",
    } as const;
    const updated = {
      ...linked,
      revision: 3,
      proposedNote: "확인한 회신 요약",
    } as const;
    const ignored = {
      ...updated,
      revision: 4,
      reviewStatus: "ignored",
    } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL) {
        return { schemaVersion: 1, candidates: [candidate] };
      }
      if (channel === PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL) return linked;
      if (channel === PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL) return updated;
      return { schemaVersion: 1, candidate: ignored, submission: null };
    });
    const bridge = createStudioBridge(invoke);
    const linkCommand = {
      schemaVersion: 1,
      candidateId,
      expectedRevision: 1,
      submissionId,
    } as const;
    const updateCommand = {
      schemaVersion: 1,
      candidateId,
      expectedRevision: 2,
      changes: { proposedNote: "확인한 회신 요약" },
    } as const;
    const reviewCommand = {
      schemaVersion: 1,
      candidateId,
      expectedRevision: 3,
      decision: "ignore",
    } as const;

    await expect(bridge.publishingMailCandidates.list({ schemaVersion: 1 }))
      .resolves.toEqual({ schemaVersion: 1, candidates: [candidate] });
    await expect(bridge.publishingMailCandidates.link(linkCommand)).resolves.toEqual(linked);
    await expect(bridge.publishingMailCandidates.update(updateCommand)).resolves.toEqual(updated);
    await expect(bridge.publishingMailCandidates.review(reviewCommand)).resolves.toEqual({
      schemaVersion: 1,
      candidate: ignored,
      submission: null,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL, linkCommand);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL, updateCommand);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL, reviewCommand);
  });

  it("exposes main-owned mail connection and explicit manual sync without token fields", async () => {
    const status = {
      schemaVersion: 1,
      connectors: [{ connectorKind: "mail-test-v1", displayName: "테스트 메일" }],
      state: "connected",
      activeConnectorKind: "mail-test-v1",
      accountLabel: "writer@example.test",
      clientId: "desktop-client",
      scopes: ["mail.readonly"],
      lastSyncedAt: null,
    } as const;
    const synced = {
      schemaVersion: 1,
      discoveredCount: 2,
      newCandidateCount: 1,
      syncedAt: "2026-08-10T10:30:00.000Z",
    } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL ? synced : status
    );
    const bridge = createStudioBridge(invoke);

    await expect(bridge.publishingMailConnection.status({ schemaVersion: 1 }))
      .resolves.toEqual(status);
    await expect(bridge.publishingMailConnection.connect({
      schemaVersion: 1,
      connectorKind: "mail-test-v1",
      clientId: "desktop-client",
    })).resolves.toEqual(status);
    await expect(bridge.publishingMailConnection.sync({ schemaVersion: 1 }))
      .resolves.toEqual(synced);
    await expect(bridge.publishingMailConnection.disconnect({ schemaVersion: 1 }))
      .resolves.toEqual(status);
    expect(JSON.stringify(status)).not.toMatch(/accessToken|refreshToken|authorizationUrl/u);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL, {
      schemaVersion: 1,
      connectorKind: "mail-test-v1",
      clientId: "desktop-client",
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL, {
      schemaVersion: 1,
    });
  });

  it("exposes persisted mail schedule settings on separate narrow channels", async () => {
    const schedule = {
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
      lastAttemptedAt: "2026-08-10T01:00:00.000Z",
      lastSuccessfulAt: "2026-08-10T01:00:02.000Z",
      lastAttemptStatus: "succeeded",
    } as const;
    const invoke = vi.fn().mockResolvedValue(schedule);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.publishingMailSchedule.status({ schemaVersion: 1 }))
      .resolves.toEqual(schedule);
    await expect(bridge.publishingMailSchedule.save({
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
    })).resolves.toEqual(schedule);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL, {
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
    });
  });

  it("exposes exact Work-scoped plot metadata commands on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const plotThreadId = entityId<"PlotThread">(randomUUID());
    const now = new Date().toISOString();
    const plot = {
      schemaVersion: 1,
      plotThreadId,
      revision: 1,
      workId,
      title: "사라진 기록",
      stage: "",
      summary: "",
      note: "",
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const list = { schemaVersion: 1, workId, plots: [plot] } as const;
    const updated = {
      ...plot,
      revision: 2,
      stage: "조사 중",
      updatedAt: now,
    } as const;
    const retired = { ...updated, revision: 3, retiredAt: now } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PLOT_LIST_CHANNEL) return list;
      if (channel === PLOT_UPDATE_CHANNEL) return updated;
      if (channel === PLOT_RETIRE_CHANNEL) return retired;
      return plot;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      title: "사라진 기록",
      stage: "",
      summary: "",
      note: "",
    } as const;
    const update = {
      schemaVersion: 1,
      workId,
      plotThreadId,
      expectedRevision: 1,
      changes: { stage: "조사 중" },
    } as const;
    const retire = {
      schemaVersion: 1,
      workId,
      plotThreadId,
      expectedRevision: 2,
    } as const;

    await expect(bridge.plots.create(create)).resolves.toEqual(plot);
    await expect(bridge.plots.list({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    await expect(bridge.plots.update(update)).resolves.toEqual(updated);
    await expect(bridge.plots.retire(retire)).resolves.toEqual(retired);
    expect(invoke).toHaveBeenCalledWith(PLOT_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PLOT_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
    expect(invoke).toHaveBeenCalledWith(PLOT_UPDATE_CHANNEL, update);
    expect(invoke).toHaveBeenCalledWith(PLOT_RETIRE_CHANNEL, retire);
  });

  it("exposes default PlotBoard reads, relative moves, and normalized story time on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const plotBoardId = entityId<"PlotBoard">(randomUUID());
    const plotLaneId = entityId<"PlotLane">(randomUUID());
    const plotPlacementId = entityId<"PlotPlacement">(randomUUID());
    const now = new Date().toISOString();
    const board = {
      schemaVersion: 1,
      plotBoardId,
      revision: 1,
      workId,
      title: "보드",
      mode: "sequence",
      createdAt: now,
      updatedAt: now,
      lanes: [{
        schemaVersion: 1,
        plotLaneId,
        revision: 1,
        workId,
        plotBoardId,
        title: "흐름",
        kind: "default",
        orderKey: "0/1",
        createdAt: now,
        updatedAt: now,
        placements: [],
      }],
    } as const;
    const moved = { ...board, revision: 2 } as const;
    const positioned = { ...board, revision: 3 } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PLOT_MOVE_PLACEMENT_CHANNEL) return moved;
      if (channel === PLOT_SET_STORY_TIME_CHANNEL) return positioned;
      return board;
    });
    const bridge = createStudioBridge(invoke);
    const get = { schemaVersion: 1, workId } as const;
    const move = {
      schemaVersion: 1,
      workId,
      plotPlacementId,
      targetBoardId: plotBoardId,
      targetLaneId: plotLaneId,
      expectedPlacementRevision: 1,
      expectedBoardRevision: 1,
    } as const;
    const setStoryTime = {
      schemaVersion: 1,
      workId,
      plotPlacementId,
      plotBoardId,
      storyTime: 37.416666666666664,
      storyTimeEnd: null,
      expectedPlacementRevision: 2,
      expectedBoardRevision: 2,
    } as const;

    await expect(bridge.plots.getDefaultBoard(get)).resolves.toEqual(board);
    await expect(bridge.plots.movePlacement(move)).resolves.toEqual(moved);
    await expect(bridge.plots.setStoryTime(setStoryTime)).resolves.toEqual(
      positioned,
    );
    expect(invoke).toHaveBeenCalledWith(PLOT_DEFAULT_BOARD_CHANNEL, get);
    expect(invoke).toHaveBeenCalledWith(PLOT_MOVE_PLACEMENT_CHANNEL, move);
    expect(invoke).toHaveBeenCalledWith(
      PLOT_SET_STORY_TIME_CHANNEL,
      setStoryTime,
    );
  });

  it("exposes bidirectional plot/event creation and manual links on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const plotBeatId = entityId<"PlotThread">(randomUUID());
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    const now = new Date().toISOString();
    const plotBeat = {
      schemaVersion: 1,
      plotThreadId: plotBeatId,
      revision: 1,
      workId,
      title: "같은 제목",
      stage: "",
      summary: "",
      note: "",
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const eventBlock = {
      schemaVersion: 1,
      eventBlockId,
      revision: 1,
      workId,
      title: "같은 제목",
      note: "",
      parentEventId: null,
      outlineOrderKey: randomUUID(),
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const link = {
      schemaVersion: 1,
      plotEventLinkId,
      revision: 1,
      workId,
      plotBeatId,
      eventBlockId,
      role: "primary",
      createdFrom: "manual-link",
      plotTitle: "같은 제목",
      eventTitle: "같은 제목",
      titleMatch: "matched",
      plotRetiredAt: null,
      eventRetiredAt: null,
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    } as const;
    const mutation = {
      schemaVersion: 1,
      status: "created",
      plotBeat,
      eventBlock,
      eventSources: [],
      link,
    } as const;
    const retired = {
      ...mutation,
      status: "retired",
      link: {
        ...link,
        revision: 2,
        updatedAt: now,
        retiredAt: now,
      },
    } as const;
    const list = { schemaVersion: 1, workId, links: [link] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PLOT_UNLINK_EVENT_CHANNEL) return retired;
      if (channel === PLOT_EVENT_LINK_LIST_CHANNEL) return list;
      return mutation;
    });
    const bridge = createStudioBridge(invoke);
    const createFromEvent = { schemaVersion: 1, workId, eventBlockId } as const;
    const createEvent = {
      schemaVersion: 1,
      workId,
      plotBeatId,
      source: { kind: "anchorless" },
    } as const;
    const linkEvent = {
      schemaVersion: 1,
      workId,
      plotBeatId,
      eventBlockId,
      role: "primary",
    } as const;
    const unlinkEvent = {
      schemaVersion: 1,
      workId,
      plotEventLinkId,
      expectedRevision: 1,
    } as const;

    await expect(bridge.plots.createFromEvent(createFromEvent))
      .resolves.toEqual(mutation);
    await expect(bridge.plots.createEvent(createEvent)).resolves.toEqual(mutation);
    await expect(bridge.plots.linkEvent(linkEvent)).resolves.toEqual(mutation);
    await expect(bridge.plots.unlinkEvent(unlinkEvent)).resolves.toEqual(retired);
    await expect(bridge.plots.listEventLinks({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    expect(invoke).toHaveBeenCalledWith(
      PLOT_CREATE_FROM_EVENT_CHANNEL,
      createFromEvent,
    );
    expect(invoke).toHaveBeenCalledWith(PLOT_CREATE_EVENT_CHANNEL, createEvent);
    expect(invoke).toHaveBeenCalledWith(PLOT_LINK_EVENT_CHANNEL, linkEvent);
    expect(invoke).toHaveBeenCalledWith(PLOT_UNLINK_EVENT_CHANNEL, unlinkEvent);
    expect(invoke).toHaveBeenCalledWith(PLOT_EVENT_LINK_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
  });

  it("links and lists only exact Work-scoped plot sources on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const plotThreadId = entityId<"PlotThread">(randomUUID());
    const sourceId = entityId<"PlotThreadSource">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const now = new Date().toISOString();
    const source = {
      schemaVersion: 1,
      sourceId,
      revision: 1,
      workId,
      plotThreadId,
      sourceDocumentId: documentId,
      sourceDocumentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      sourceAnchorId: entityId<"Anchor">(randomUUID()),
      exactText: "선택 원문",
      integrity: "resolved",
      range: { from: 2, to: 7 },
      createdAt: now,
    } as const;
    const list = { schemaVersion: 1, workId, sources: [source] } as const;
    const invoke = vi.fn(async (channel: string) =>
      channel === PLOT_SOURCE_LIST_CHANNEL ? list : source
    );
    const bridge = createStudioBridge(invoke);
    const link = {
      schemaVersion: 1,
      workId,
      plotThreadId,
      expectedSourceId: null,
      documentId,
      selection: { anchor: 2, head: 7 },
      exactText: "선택 원문",
    } as const;

    await expect(bridge.plots.linkSource(link)).resolves.toEqual(source);
    await expect(bridge.plots.listSources({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    expect(invoke).toHaveBeenCalledWith(PLOT_LINK_SOURCE_CHANNEL, link);
    expect(invoke).toHaveBeenCalledWith(PLOT_SOURCE_LIST_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
  });

  it("exposes the data-driven point profile and exact Work-scoped point commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const lineId = entityId<"ForeshadowLine">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const pointId = entityId<"ForeshadowPoint">(randomUUID());
    const profile = {
      schemaVersion: 1,
      defaultRoleId: "plant",
      payoffRoleId: "payoff",
      roles: [
        { id: "plant", label: "배치" },
        { id: "payoff", label: "회수" },
      ],
    } as const;
    const point = {
      schemaVersion: 1,
      pointId,
      revision: 1,
      workId,
      lineId,
      sourceDocumentId: documentId,
      sourceDocumentRevisionId:
        entityId<"DocumentRevision">(randomUUID()),
      sourceAnchorId: entityId<"Anchor">(randomUUID()),
      roleId: "plant",
      note: "첫 단서",
      exactText: "정확한 선택",
      integrity: "resolved",
      range: { from: 2, to: 7 },
      createdAt: new Date().toISOString(),
    } as const;
    const list = { schemaVersion: 1, workId, points: [point] } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === FORESHADOW_POINT_PROFILE_CHANNEL) return profile;
      if (channel === FORESHADOW_LIST_POINTS_CHANNEL) return list;
      return point;
    });
    const bridge = createStudioBridge(invoke);
    const create = {
      schemaVersion: 1,
      workId,
      lineId,
      documentId,
      selection: { anchor: 7, head: 2 },
      exactText: "정확한 선택",
      roleId: "plant",
      note: "첫 단서",
    } as const;

    await expect(bridge.foreshadowing.getPointProfile()).resolves.toEqual(profile);
    await expect(bridge.foreshadowing.createPoint(create)).resolves.toEqual(point);
    await expect(bridge.foreshadowing.listPoints({
      schemaVersion: 1,
      workId,
    })).resolves.toEqual(list);
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_POINT_PROFILE_CHANNEL);
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_CREATE_POINT_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(FORESHADOW_LIST_POINTS_CHANNEL, {
      schemaVersion: 1,
      workId,
    });
  });

  it("exposes only strict SceneOverride create and list commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const sceneOverride = {
      schemaVersion: 1,
      sceneOverrideId: randomUUID(),
      workId,
      documentId,
      operation: "add",
      baseRuleSetRevision: 3,
      note: "커서 경계",
      boundaries: [
        {
          anchorId: randomUUID(),
          documentRevisionId: randomUUID(),
          exactQuote: "",
          integrity: "resolved",
          range: { from: 5, to: 5 },
        },
      ],
      createdAt: new Date().toISOString(),
    } as const;
    const invoke = vi.fn(async (channel) =>
      channel === STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL
        ? sceneOverride
        : {
            schemaVersion: 1,
            workId,
            sceneOverrides: [sceneOverride],
          },
    );
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      documentId,
      expectedDocumentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      selection: { anchor: 5, head: 5 },
      exactQuote: "",
      operation: "add",
      note: "커서 경계",
    } as const;

    await expect(
      bridge.structure.createSceneOverride(command),
    ).resolves.toEqual(sceneOverride);
    await expect(
      bridge.structure.listSceneOverrides({ schemaVersion: 1, workId }),
    ).resolves.toEqual({
      schemaVersion: 1,
      workId,
      sceneOverrides: [sceneOverride],
    });
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
      command,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
      { schemaVersion: 1, workId },
    );
  });

  it("rebinds Scene metadata through its narrow stable-identity channel", async () => {
    const workId = entityId<"Work">(randomUUID());
    const bindingId = entityId<"SceneMetadataBinding">(randomUUID());
    const sceneId = entityId<"Scene">(randomUUID());
    const now = new Date().toISOString();
    const binding = {
      schemaVersion: 1,
      sceneMetadataBindingId: bindingId,
      revision: 3,
      workId,
      metadataKind: "annotation",
      metadataId: randomUUID(),
      sourceSceneKey: "source-scene-fingerprint",
      sceneId,
      status: "current",
      proposedSceneId: null,
      lineageOperationId: null,
      createdAt: now,
      updatedAt: now,
    } as const;
    const invoke = vi.fn().mockResolvedValue(binding);
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      sceneMetadataBindingId: bindingId,
      expectedBindingRevision: 2,
      targetSceneId: sceneId,
    } as const;

    await expect(bridge.structure.rebindSceneMetadata(command))
      .resolves.toEqual(binding);
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_REBIND_SCENE_METADATA_CHANNEL,
      command,
    );
  });

  it("exposes previewed Scene deletion, trash, restore, and undo on narrow channels", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const sceneId = entityId<"Scene">(randomUUID());
    const sceneTrashEntryId = entityId<"SceneTrashEntry">(randomUUID());
    const now = new Date().toISOString();
    const target = { sceneId, documentId, sceneKey: "scene-trash-source" };
    const preview = {
      schemaVersion: 1,
      previewFingerprint: "sha256:scene-trash-preview",
      workId,
      target,
      sceneRuleSetRevision: 2,
      documents: [{
        documentId,
        documentTitle: "첫 회차",
        expectedDocumentRevisionId:
          entityId<"DocumentRevision">(randomUUID()),
        sceneKey: target.sceneKey,
        sceneRange: { start: 0, end: 4 },
        deletionRange: { start: 0, end: 8 },
        removedBoundaryAnchorId: entityId<"Anchor">(randomUUID()),
        sceneContentUtf16Length: 4,
        deletedUtf16Length: 8,
        firstExcerpt: "첫 장면",
        lastExcerpt: "첫 장면",
      }],
      metadata: [],
    } as const;
    const entry = {
      schemaVersion: 1,
      sceneTrashEntryId,
      revision: 1,
      workId,
      sceneId,
      sourceSceneKey: target.sceneKey,
      sceneRuleSetRevision: 2,
      status: "active",
      documents: [{
        sceneTrashDocumentId: entityId<"SceneTrashDocument">(randomUUID()),
        documentId,
        documentTitle: "첫 회차",
        ordinal: 0,
        beforeRevisionId: entityId<"DocumentRevision">(randomUUID()),
        deletedRevisionId: entityId<"DocumentRevision">(randomUUID()),
        restoredRevisionId: null,
        sceneRange: { start: 0, end: 4 },
        deletionRange: { start: 0, end: 8 },
        deletedUtf16Length: 8,
        firstExcerpt: "첫 장면",
        lastExcerpt: "첫 장면",
      }],
      metadata: [],
      canRestore: true,
      conflictReason: null,
      deletedAt: now,
      restoredAt: null,
    } as const;
    const receipt = {
      schemaVersion: 1,
      status: "deleted",
      entry,
      documentRevisions: [{
        documentId,
        revisionId: entry.documents[0].deletedRevisionId,
      }],
    } as const;
    const list = { schemaVersion: 1, workId, entries: [entry] } as const;
    const invoke = vi.fn(async (channel) => {
      if (channel === STRUCTURE_PREPARE_SCENE_DELETION_CHANNEL) return preview;
      if (channel === STRUCTURE_LIST_SCENE_TRASH_CHANNEL) return list;
      return receipt;
    });
    const bridge = createStudioBridge(invoke);
    const prepareCommand = { schemaVersion: 1, workId, target } as const;
    const deleteCommand = { schemaVersion: 1, preview } as const;
    const restoreCommand = {
      schemaVersion: 1,
      workId,
      sceneTrashEntryId,
      expectedRevision: 1,
    } as const;

    await expect(bridge.structure.prepareSceneDeletion(prepareCommand))
      .resolves.toEqual(preview);
    await expect(bridge.structure.deleteScene(deleteCommand)).resolves.toEqual(receipt);
    await expect(bridge.structure.listSceneTrash({ schemaVersion: 1, workId }))
      .resolves.toEqual(list);
    await expect(bridge.structure.restoreSceneTrash(restoreCommand))
      .resolves.toEqual(receipt);
    await expect(bridge.structure.undoSceneDeletion(restoreCommand))
      .resolves.toEqual(receipt);
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_PREPARE_SCENE_DELETION_CHANNEL,
      prepareCommand,
    );
    expect(invoke).toHaveBeenCalledWith(STRUCTURE_DELETE_SCENE_CHANNEL, deleteCommand);
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_SCENE_TRASH_CHANNEL,
      { schemaVersion: 1, workId },
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_RESTORE_SCENE_TRASH_CHANNEL,
      restoreCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_UNDO_SCENE_DELETION_CHANNEL,
      restoreCommand,
    );
  });

  it("exposes strict Work activity commands without a fixed focus duration", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const sessionId = entityId<"WritingSession">(randomUUID());
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    const now = new Date().toISOString();
    const targetDurationMs = 37 * 60 * 1_000;
    const projection = {
      schemaVersion: 1,
      workId,
      activeSessionId: sessionId,
      activeFocusCycleId: focusCycleId,
      sessions: [{
        schemaVersion: 1,
        sessionId,
        workId,
        documentId,
        state: "active",
        startedAt: now,
        endedAt: null,
        activeDurationMs: 0,
        startRevisionId: entityId<"DocumentRevision">(randomUUID()),
        endRevisionId: null,
        characterDelta: null,
        note: "",
      }],
      focusCycles: [{
        schemaVersion: 1,
        focusCycleId,
        workId,
        sessionId,
        state: "running",
        phaseRef: "초고 집중",
        targetDurationMs,
        startedAt: now,
        deadlineAt: new Date(Date.parse(now) + targetDurationMs).toISOString(),
        remainingDurationMs: null,
        pauseReason: null,
        completedAt: null,
        note: "",
      }],
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const list = { schemaVersion: 1, workId } as const;
    const startSession = {
      schemaVersion: 1,
      workId,
      documentId,
      note: "",
    } as const;
    const stopSession = { schemaVersion: 1, workId, sessionId } as const;
    const startFocus = {
      schemaVersion: 1,
      workId,
      documentId,
      phaseRef: "초고 집중",
      targetDurationMs,
      note: "",
    } as const;
    const stopFocus = { schemaVersion: 1, workId, focusCycleId } as const;

    await expect(bridge.activity.listWork(list)).resolves.toEqual(projection);
    await expect(bridge.activity.startSession(startSession)).resolves.toEqual(projection);
    await expect(bridge.activity.stopSession(stopSession)).resolves.toEqual(projection);
    await expect(bridge.activity.startFocus(startFocus)).resolves.toEqual(projection);
    await expect(bridge.activity.stopFocus(stopFocus)).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_LIST_WORK_CHANNEL, list);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_START_SESSION_CHANNEL, startSession);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_STOP_SESSION_CHANNEL, stopSession);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_START_FOCUS_CHANNEL, startFocus);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_STOP_FOCUS_CHANNEL, stopFocus);
  });

  it("exposes only strict Pomodoro lifecycle commands and projections", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    const startedAt = new Date().toISOString();
    const projection = {
      schemaVersion: 1,
      workId,
      settings: {
        workDurationMs: 7_321,
        breakDurationMs: 2_345,
        workCycleCount: 3,
        autoAdvance: false,
      },
      status: "running",
      completedWorkCycles: 0,
      activePhase: {
        focusCycleId,
        state: "running",
        phase: "work",
        cycleNumber: 1,
        targetDurationMs: 7_321,
        remainingDurationMs: 7_321,
        startedAt,
        deadlineAt: new Date(Date.parse(startedAt) + 7_321).toISOString(),
        pauseReason: null,
        note: "첫 주기",
      },
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const get = { schemaVersion: 1, workId } as const;
    const configure = {
      schemaVersion: 1,
      workId,
      documentId,
      workDurationMs: 7_321,
      breakDurationMs: 2_345,
      workCycleCount: 3,
      autoAdvance: false,
      note: "첫 주기",
    } as const;
    const phase = { schemaVersion: 1, workId, focusCycleId } as const;
    const note = { ...phase, note: "장면 전환 확인" } as const;

    await expect(bridge.activity.getPomodoro(get)).resolves.toEqual(projection);
    await expect(
      bridge.activity.configureAndStartPomodoro(configure),
    ).resolves.toEqual(projection);
    await expect(bridge.activity.pausePomodoro(phase)).resolves.toEqual(projection);
    await expect(bridge.activity.resumePomodoro(phase)).resolves.toEqual(projection);
    await expect(bridge.activity.reconcilePomodoro(phase)).resolves.toEqual(projection);
    await expect(bridge.activity.updatePomodoroNote(note)).resolves.toEqual(projection);
    await expect(bridge.activity.stopPomodoro(phase)).resolves.toEqual(projection);

    expect(invoke).toHaveBeenCalledWith(ACTIVITY_GET_POMODORO_CHANNEL, get);
    expect(invoke).toHaveBeenCalledWith(
      ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL,
      configure,
    );
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_PAUSE_POMODORO_CHANNEL, phase);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_RESUME_POMODORO_CHANNEL, phase);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_RECONCILE_POMODORO_CHANNEL, phase);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL, note);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_STOP_POMODORO_CHANNEL, phase);
  });

  it("exposes strict Document revision and WorkSnapshot commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const restoredRevisionId = entityId<"DocumentRevision">(randomUUID());
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    const now = new Date().toISOString();
    const revisionList = {
      schemaVersion: 1,
      workId,
      documentId,
      revisions: [{
        schemaVersion: 1,
        revisionId,
        workId,
        documentId,
        parentRevisionId: null,
        length: 12,
        cause: "manuscript-edit",
        createdAt: now,
        durableAt: now,
        isCurrent: true,
      }],
    } as const;
    const restoreResult = {
      schemaVersion: 1,
      workId,
      documentId,
      targetRevisionId: revisionId,
      restoredRevisionId,
    } as const;
    const snapshot = {
      schemaVersion: 1,
      workSnapshotId,
      workId,
      label: "초고 기준",
      cause: "manual",
      manifestHash: randomUUID(),
      createdAt: now,
      documentRevisions: [{ documentId, documentRevisionId: revisionId }],
    } as const;
    const snapshotList = {
      schemaVersion: 1,
      workId,
      snapshots: [snapshot],
    } as const;
    const snapshotComparison = {
      schemaVersion: 1,
      workId,
      workSnapshotId,
      label: snapshot.label,
      createdAt: now,
      totals: {
        snapshotDocumentCount: 1,
        currentDocumentCount: 1,
        snapshotCharacters: 12,
        currentCharacters: 12,
        characterDelta: 0,
        unchangedCount: 1,
        changedCount: 0,
        addedCount: 0,
        removedCount: 0,
      },
      documents: [{
        documentId,
        title: "1화",
        status: "unchanged",
        snapshotRevisionId: revisionId,
        currentRevisionId: revisionId,
        snapshotLength: 12,
        currentLength: 12,
        characterDelta: 0,
      }],
    } as const;
    const revisionContent = {
      schemaVersion: 1 as const,
      revision: revisionList.revisions[0],
      text: "완료 당시 원고",
    };
    const invoke = vi.fn(async (channel) => {
      if (channel === VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL) {
        return revisionList;
      }
      if (channel === VERSION_READ_DOCUMENT_REVISION_CHANNEL) {
        return revisionContent;
      }
      if (channel === VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL) {
        return restoreResult;
      }
      if (channel === VERSION_CREATE_WORK_SNAPSHOT_CHANNEL) {
        return snapshot;
      }
      if (channel === VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL) {
        return snapshotComparison;
      }
      return snapshotList;
    });
    const bridge = createStudioBridge(invoke);
    const listRevisions = { schemaVersion: 1, workId, documentId } as const;
    const restore = {
      schemaVersion: 1,
      workId,
      documentId,
      targetRevisionId: revisionId,
    } as const;
    const readRevision = {
      schemaVersion: 1,
      workId,
      documentId,
      revisionId,
    } as const;
    const createSnapshot = {
      schemaVersion: 1,
      workId,
      label: "초고 기준",
    } as const;
    const listSnapshots = { schemaVersion: 1, workId } as const;
    const compareSnapshot = {
      schemaVersion: 1,
      workId,
      workSnapshotId,
    } as const;

    await expect(
      bridge.version.listDocumentRevisions(listRevisions),
    ).resolves.toEqual(revisionList);
    await expect(
      bridge.version.readDocumentRevision(readRevision),
    ).resolves.toEqual(revisionContent);
    await expect(
      bridge.version.restoreDocumentRevision(restore),
    ).resolves.toEqual(restoreResult);
    await expect(
      bridge.version.createWorkSnapshot(createSnapshot),
    ).resolves.toEqual(snapshot);
    await expect(
      bridge.version.listWorkSnapshots(listSnapshots),
    ).resolves.toEqual(snapshotList);
    await expect(
      bridge.version.compareWorkSnapshot(compareSnapshot),
    ).resolves.toEqual(snapshotComparison);
    expect(invoke).toHaveBeenCalledWith(
      VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
      listRevisions,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_READ_DOCUMENT_REVISION_CHANNEL,
      readRevision,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
      restore,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
      createSnapshot,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
      listSnapshots,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
      compareSnapshot,
    );
  });

  it("exposes verified local backup status, creation, and restore actions", async () => {
    const summary = {
      schemaVersion: 1,
      bundlePath: "D:\\Backups\\eum-studio-2026-08-07",
      targetPath: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      verifiedAt: "2026-08-07T00:00:01.000Z",
      lastAction: "created",
      counts: {
        workCount: 1,
        documentCount: 2,
        revisionCount: 3,
        resumeCheckpointCount: 1,
        writingSessionCount: 1,
      },
      media: {
        managedFileCount: 1,
        externalReferenceCount: 1,
        disconnectedExternalReferenceCount: 0,
        managedByteLength: 2048,
      },
    } as const;
    const status = { schemaVersion: 1, lastVerified: summary } as const;
    const completed = {
      schemaVersion: 1,
      status: "completed",
      summary,
    } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === BACKUP_GET_STATUS_CHANNEL) {
        return status;
      }
      return completed;
    });
    const bridge = createStudioBridge(invoke);

    await expect(bridge.backup.getStatus()).resolves.toEqual(status);
    await expect(bridge.backup.create()).resolves.toEqual(completed);
    await expect(bridge.backup.restore()).resolves.toEqual(completed);
    expect(invoke).toHaveBeenCalledWith(BACKUP_GET_STATUS_CHANNEL);
    expect(invoke).toHaveBeenCalledWith(BACKUP_CREATE_CHANNEL);
    expect(invoke).toHaveBeenCalledWith(BACKUP_RESTORE_CHANNEL);
  });

  it("exposes a strict read-only legacy import rehearsal action", async () => {
    const completed = {
      schemaVersion: 1,
      status: "completed",
      summary: {
        schemaVersion: 1,
        sourceRootPath: "D:\\eum.editor",
        sourceSnapshotId: "snapshot",
        sourceChecksumIdentity: "sha256",
        sourceChecksumValue: "checksum",
        sourceByteLength: 10,
        sourceSnapshots: [{
          sourceSnapshotId: "snapshot",
          sourceLocator: "data/lorebooks.json",
          checksumIdentity: "sha256",
          checksumValue: "checksum",
          byteLength: 10,
        }],
        connectorMetadata: [],
        browserSourceReceipt: null,
        sourceInspection: {
          sourceInventories: [{
            snapshotId: "snapshot",
            sourceLocator: "data/lorebooks.json",
            branchKind: "live-file",
            rawJsonInventory: {
              entries: [],
              objectFields: [],
              unknownFields: [],
              secretLikePaths: [],
            },
          }],
          branchInventory: {
            branches: [{
              snapshotId: "snapshot",
              sourceLocator: "data/lorebooks.json",
              branchKind: "live-file",
              itemCount: 0,
            }],
            identicalCandidates: [],
            conflictCandidates: [],
          },
        },
        targetRootPath: "D:\\rehearsal",
        rehearsalWorkspacePath: "D:\\rehearsal\\workspace",
        reportPath: "D:\\rehearsal\\workspace\\report.json",
        capturedAt: "2026-08-07T00:00:00.000Z",
        publication: "published",
        sourceUnchanged: true,
        issueCount: 0,
        counts: {
          workCount: 1,
          folderCount: 0,
          documentCount: 1,
          revisionCount: 1,
          resumeCheckpointCount: 1,
          writingSessionCount: 0,
          rawItemCount: 1,
          receiptCount: 3,
          sourceItemCount: 3,
          uncoveredItemCount: 0,
          orphanManuscriptCount: 0,
        },
      },
    } as const;
    const invoke = vi.fn().mockResolvedValue(completed);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.migration.runLegacyLoreRehearsal(),
    ).resolves.toEqual(completed);
    expect(invoke).toHaveBeenCalledWith(
      MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
    );
  });

  it("strictly receives and completes the manuscript close handshake", async () => {
    const request = {
      schemaVersion: 1,
      requestId: randomUUID(),
    } as const;
    const result = {
      schemaVersion: 1,
      requestId: request.requestId,
      status: "saved",
    } as const;
    let receive:
      | ((payload: unknown) => void)
      | undefined;
    const unsubscribe = vi.fn();
    const listen: BridgeListen = (
      channel,
      listener,
    ) => {
      expect(channel).toBe(
        MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
      );
      receive = listener;
      return unsubscribe;
    };
    const invoke = vi.fn().mockResolvedValue(result);
    const bridge = createStudioBridgeContract(
      invoke,
      listen,
    );
    const listener = vi.fn();

    const stop =
      bridge.editor.onManuscriptCloseRequest(
        listener,
      );
    expect(receive).toBeTypeOf("function");
    receive?.(request);
    expect(listener).toHaveBeenCalledWith(
      request,
    );
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();

    await expect(
      bridge.editor.completeManuscriptCloseRequest(
        result,
      ),
    ).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
      result,
    );
  });

  it("rejects malformed manuscript close handshake values", async () => {
    let receive:
      | ((payload: unknown) => void)
      | undefined;
    const bridge = createStudioBridgeContract(
      async () => ({
        schemaVersion: 1,
        requestId: randomUUID(),
        status: randomUUID(),
      }),
      (_channel, listener) => {
        receive = listener;
        return () => undefined;
      },
    );
    bridge.editor.onManuscriptCloseRequest(
      () => undefined,
    );

    expect(() =>
      receive?.({
        schemaVersion: 1,
        requestId: "",
      }),
    ).toThrow(
      "ManuscriptCloseRequest.requestId must be a non-empty string",
    );
    await expect(
      bridge.editor.completeManuscriptCloseRequest(
        {
          schemaVersion: 1,
          requestId: randomUUID(),
          status: "saved",
        },
      ),
    ).rejects.toThrow(
      "Invalid manuscript close result",
    );
  });
});
