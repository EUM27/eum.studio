import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ASSISTANT_REQUEST_FAILURE_MESSAGES, type CancelAssistantRequestCommand } from "../../../application/assistant/assistant-request-lifecycle";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { AssistantContextPermissionGrant } from "../../../application/assistant/assistant-context-permission";
import type { AssistantContextStateProjection } from "../../../application/assistant/assistant-context-state";
import type { AssistantDestinationProfile } from "../../../application/assistant/assistant-destination-profile";
import type { AssistantConnectorManifestProfile } from "../../../application/assistant/assistant-connector-manifest";
import type { AssistantConnectionProjection } from "../../../application/assistant/assistant-connection";
import {
  createChatGptOAuthAssistantConnectionId,
  type ChatGptOAuthConnectionStatus,
} from "../../../application/assistant/chatgpt-oauth";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import { entityId, type EntityId } from "../../../domain/writing";
import type {
  AssistantContextConnectionProjection,
  AssistantContextDialogActionState,
  AssistantPermissionDraft,
} from "../../assistant/AssistantContextDialog";
import type {
  AssistantConnectionEditorInput,
  AssistantConnectionsDialogActionState,
} from "../../assistant/AssistantConnectionsDialog";

export type AssistantDocumentPort = Readonly<{
  source: ManuscriptDocumentSource;
  readSelection: () => Readonly<{
    from: number;
    to: number;
    empty: boolean;
  }> | undefined;
  materializeText: () => string;
  persist: () => Promise<void>;
  getCurrentRevisionId: () => EntityId<"DocumentRevision"> | null;
}>;

export type AssistantWorkspaceControllerInput = Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: StudioBridge["assistant"];
  document: AssistantDocumentPort | null;
}>;

export function useAssistantWorkspaceController(
  input: AssistantWorkspaceControllerInput | null,
) {
  const assistantContextLoadSequenceRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const activeRequestRef = useRef<{
    identity: CancelAssistantRequestCommand;
    client: StudioBridge["assistant"];
    dispatched: boolean;
  } | null>(null);
  const [assistantConversationId] = useState(() =>
    entityId<"AssistantConversation">(crypto.randomUUID()),
  );
  const [chatGptOAuthStatus, setChatGptOAuthStatus] =
    useState<ChatGptOAuthConnectionStatus | null>(null);
  const [assistantContextDialogOpen, setAssistantContextDialogOpen] =
    useState(false);
  const [assistantContextProjection, setAssistantContextProjection] =
    useState<AssistantContextStateProjection | null>(null);
  const [assistantDestinationProfile, setAssistantDestinationProfile] =
    useState<AssistantDestinationProfile | null>(null);
  const [assistantContextActionState, setAssistantContextActionState] =
    useState<AssistantContextDialogActionState>("idle");
  const [assistantContextActionError, setAssistantContextActionError] =
    useState<string | null>(null);
  const [assistantConnectionsDialogOpen, setAssistantConnectionsDialogOpen] =
    useState(false);
  const [assistantConnections, setAssistantConnections] = useState<
    readonly AssistantConnectionProjection[]
  >([]);
  const [assistantConnectorProfile, setAssistantConnectorProfile] =
    useState<AssistantConnectorManifestProfile | null>(null);
  const [assistantConnectionsActionState, setAssistantConnectionsActionState] =
    useState<AssistantConnectionsDialogActionState>("idle");
  const [assistantConnectionsActionError, setAssistantConnectionsActionError] =
    useState<string | null>(null);

  const activeWorkId = input?.activeWorkId ?? null;
  useLayoutEffect(() => () => {
    requestGenerationRef.current += 1;
    assistantContextLoadSequenceRef.current += 1;
    const active = activeRequestRef.current;
    activeRequestRef.current = null;
    if (active?.dispatched) void active.client.cancelRequest(active.identity).catch(() => undefined);
    setAssistantContextActionState("idle");
    setAssistantContextActionError(null);
    setAssistantContextProjection(null);
  }, [activeWorkId]);

  const cancelAssistantRequest = useCallback(async () => {
    const active = activeRequestRef.current;
    if (active === null) return;
    activeRequestRef.current = null;
    const generation = ++requestGenerationRef.current;
    setAssistantContextActionState("idle");
    setAssistantContextActionError(ASSISTANT_REQUEST_FAILURE_MESSAGES.cancelled);
    if (active.dispatched) {
      try { await active.client.cancelRequest(active.identity); }
      catch {
        // Do not apply an old cancellation error to a new Work or a newer request.
        if (requestGenerationRef.current === generation) {
          setAssistantContextActionError("취소 요청을 전달하지 못했습니다. 연결의 제한 시간이 지나면 요청이 종료됩니다.");
        }
      }
    }
  }, []);

  const assistantContextConnections = useMemo<
    readonly AssistantContextConnectionProjection[]
  >(() => {
    if (chatGptOAuthStatus?.connected !== true) {
      return assistantConnections;
    }
    const connectionId = createChatGptOAuthAssistantConnectionId(
      chatGptOAuthStatus.providerId,
    );
    return Object.freeze([
      Object.freeze({
        connectionId,
        label: chatGptOAuthStatus.displayName,
        model: chatGptOAuthStatus.modelId,
      }),
      ...assistantConnections.filter(
        (connection) => connection.connectionId !== connectionId,
      ),
    ]);
  }, [assistantConnections, chatGptOAuthStatus]);

  const activeAssistantGrantCount =
    input !== null &&
    input.activeWorkId !== null &&
    assistantContextProjection !== null &&
    assistantContextProjection.workId === input.activeWorkId
      ? assistantContextProjection.grants.filter(
          (grant) => grant.revokedAt === null && grant.consumedAt === null,
        ).length
      : 0;

  const publishAssistantOAuthStatus = useCallback(
    (status: ChatGptOAuthConnectionStatus) => {
      setChatGptOAuthStatus(status);
    },
    [],
  );

  const reportAssistantContextError = useCallback((message: string) => {
    setAssistantContextActionError(message);
  }, []);

  const clearAssistantContextError = useCallback(() => {
    setAssistantContextActionError(null);
  }, []);

  const hideAssistantContextForNavigation = useCallback(() => {
    setAssistantContextDialogOpen(false);
    setAssistantContextActionError(null);
  }, []);

  const dismissAssistantContextForNavigation = useCallback(() => {
    assistantContextLoadSequenceRef.current += 1;
    hideAssistantContextForNavigation();
  }, [hideAssistantContextForNavigation]);

  const reopenAssistantContextAfterNavigation = useCallback(() => {
    setAssistantContextDialogOpen(true);
  }, []);

  const openAssistantContextDialog = useCallback(async () => {
    if (input === null || input.activeWorkId === null) return;
    const sequence = assistantContextLoadSequenceRef.current + 1;
    assistantContextLoadSequenceRef.current = sequence;
    setAssistantContextDialogOpen(true);
    setAssistantContextActionState("loading");
    setAssistantContextActionError(null);
    try {
      const [destinationProfile, projection, connectionsProjection] =
        await Promise.all([
          input.client.getDestinationProfile(),
          input.client.listContextState({
            schemaVersion: 1,
            workId: input.activeWorkId,
            conversationId: assistantConversationId,
          }),
          input.client.listConnections(),
        ]);
      if (assistantContextLoadSequenceRef.current !== sequence) return;
      setAssistantDestinationProfile(destinationProfile);
      setAssistantContextProjection(projection);
      setAssistantConnections(connectionsProjection.connections);
      setAssistantContextActionState("idle");
    } catch (reason) {
      if (assistantContextLoadSequenceRef.current !== sequence) return;
      setAssistantContextActionError(
        reason instanceof Error
          ? reason.message
          : "조수 접근 권한을 불러오지 못했습니다.",
      );
      setAssistantContextActionState("idle");
    }
  }, [assistantConversationId, input]);

  const closeAssistantContextDialog = useCallback(() => {
    if (assistantContextActionState !== "idle") return;
    dismissAssistantContextForNavigation();
  }, [assistantContextActionState, dismissAssistantContextForNavigation]);

  const openAssistantConnectionsDialog = useCallback(async () => {
    if (input === null) return;
    setAssistantConnectionsDialogOpen(true);
    setAssistantConnectionsActionState("loading");
    setAssistantConnectionsActionError(null);
    try {
      const [projection, connectorProfile] = await Promise.all([
        input.client.listConnections(),
        input.client.getConnectorProfile(),
      ]);
      setAssistantConnections(projection.connections);
      setAssistantConnectorProfile(connectorProfile);
    } catch (reason) {
      setAssistantConnectionsActionError(
        reason instanceof Error
          ? reason.message
          : "조수 연결을 불러오지 못했습니다.",
      );
    } finally {
      setAssistantConnectionsActionState("idle");
    }
  }, [input]);

  const openAssistantConnectionsFromContext = useCallback(() => {
    if (assistantContextActionState !== "idle") return;
    dismissAssistantContextForNavigation();
    void openAssistantConnectionsDialog();
  }, [
    assistantContextActionState,
    dismissAssistantContextForNavigation,
    openAssistantConnectionsDialog,
  ]);

  const closeAssistantConnectionsDialog = useCallback(() => {
    if (assistantConnectionsActionState !== "idle") return;
    setAssistantConnectionsDialogOpen(false);
    setAssistantConnectionsActionError(null);
    void openAssistantContextDialog();
  }, [assistantConnectionsActionState, openAssistantContextDialog]);

  const saveAssistantConnection = useCallback(
    async (draft: AssistantConnectionEditorInput) => {
      if (input === null || assistantConnectionsActionState !== "idle") return;
      setAssistantConnectionsActionState("saving");
      setAssistantConnectionsActionError(null);
      try {
        await input.client.saveConnection({
          schemaVersion: 1,
          connectionId:
            draft.connection?.connectionId ??
            entityId<"AssistantConnection">(crypto.randomUUID()),
          expectedRevision: draft.connection?.revision ?? 0,
          connectorKind: draft.connectorKind,
          label: draft.label,
          endpoint: draft.endpoint,
          model: draft.model,
          credential: draft.credential,
        });
        const projection = await input.client.listConnections();
        setAssistantConnections(projection.connections);
      } catch (reason) {
        setAssistantConnectionsActionError(
          reason instanceof Error
            ? reason.message
            : "조수 연결을 저장하지 못했습니다.",
        );
      } finally {
        setAssistantConnectionsActionState("idle");
      }
    },
    [assistantConnectionsActionState, input],
  );

  const deleteAssistantConnection = useCallback(
    async (connection: AssistantConnectionProjection) => {
      if (input === null || assistantConnectionsActionState !== "idle") return;
      setAssistantConnectionsActionState("deleting");
      setAssistantConnectionsActionError(null);
      try {
        await input.client.deleteConnection({
          schemaVersion: 1,
          connectionId: connection.connectionId,
          expectedRevision: connection.revision,
        });
        const projection = await input.client.listConnections();
        setAssistantConnections(projection.connections);
      } catch (reason) {
        setAssistantConnectionsActionError(
          reason instanceof Error
            ? reason.message
            : "조수 연결을 삭제하지 못했습니다.",
        );
      } finally {
        setAssistantConnectionsActionState("idle");
      }
    },
    [assistantConnectionsActionState, input],
  );

  const refreshAssistantContext = useCallback(async (isCurrent?: () => boolean) => {
    if (input === null || input.activeWorkId === null) return;
    const projection = await input.client.listContextState({
      schemaVersion: 1,
      workId: input.activeWorkId,
      conversationId: assistantConversationId,
    });
    if (isCurrent?.() === false) return;
    setAssistantContextProjection(projection);
  }, [assistantConversationId, input]);

  const grantAssistantContextPermission = useCallback(
    async (draft: AssistantPermissionDraft) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("granting");
      setAssistantContextActionError(null);
      try {
        await input.client.grantContextPermission({
          schemaVersion: 1,
          workId: input.activeWorkId,
          conversationId:
            draft.duration === "work" ? null : assistantConversationId,
          ...draft,
        });
        await refreshAssistantContext();
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "조수 접근 권한을 승인하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      assistantContextActionState,
      assistantConversationId,
      input,
      refreshAssistantContext,
    ],
  );

  const revokeAssistantContextPermission = useCallback(
    async (grant: AssistantContextPermissionGrant) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        grant.workId !== input.activeWorkId ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("revoking");
      setAssistantContextActionError(null);
      try {
        await input.client.revokeContextPermission({
          schemaVersion: 1,
          workId: input.activeWorkId,
          grantId: grant.grantId,
          expectedRevision: grant.revision,
        });
        await refreshAssistantContext();
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "조수 접근 권한을 철회하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [assistantContextActionState, input, refreshAssistantContext],
  );

  const runAssistantVocabularyLookup = useCallback(
    async (destinationId: string) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        input.document === null ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      const selection = input.document.readSelection();
      if (selection === undefined || selection.empty) {
        setAssistantContextActionError(
          "원고에서 검색할 어휘를 정확히 선택하세요.",
        );
        return;
      }
      setAssistantContextActionState("running-vocabulary");
      setAssistantContextActionError(null);
      try {
        await input.document.persist();
        const documentRevisionId =
          input.document.getCurrentRevisionId() ??
          input.document.source.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
        }
        const result = await input.client.runVocabularyLookup({
          schemaVersion: 1,
          requestId: entityId<"AssistantContextRequest">(crypto.randomUUID()),
          workId: input.activeWorkId,
          conversationId: assistantConversationId,
          destinationId,
          sourceRange: {
            documentId: input.document.source.documentId,
            documentRevisionId,
            from: selection.from,
            to: selection.to,
          },
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "이 기능에 필요한 작품 전체 로컬 읽기 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "선택 범위가 현재 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        await refreshAssistantContext();
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "작품 내 어휘를 검색하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      assistantContextActionState,
      assistantConversationId,
      input,
      refreshAssistantContext,
    ],
  );

  const runAssistantVocabularySuggestion = useCallback(
    async (request: Readonly<{
      connectionId: string;
      query: string;
      includeSelection: boolean;
    }>) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      if (activeRequestRef.current !== null) return;
      const active = {
        identity: { schemaVersion: 1 as const, workId: input.activeWorkId, requestId: crypto.randomUUID() },
        client: input.client,
        dispatched: false,
      };
      requestGenerationRef.current += 1;
      activeRequestRef.current = active;
      const isCurrent = () => activeRequestRef.current === active;
      setAssistantContextActionState("running-vocabulary-suggestion");
      setAssistantContextActionError(null);
      try {
        let sourceRange: {
          documentId: EntityId<"Document">;
          documentRevisionId: EntityId<"DocumentRevision">;
          from: number;
          to: number;
        } | null = null;
        if (request.includeSelection) {
          if (input.document === null) {
            throw new Error("현재 원고를 확인하지 못했습니다.");
          }
          const selection = input.document.readSelection();
          if (selection === undefined || selection.empty) {
            throw new Error("함께 보낼 원고 범위를 정확히 선택하세요.");
          }
          await input.document.persist();
          if (!isCurrent()) return;
          const documentRevisionId =
            input.document.getCurrentRevisionId() ??
            input.document.source.documentRevisionId;
          if (documentRevisionId === null) {
            throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
          }
          sourceRange = {
            documentId: input.document.source.documentId,
            documentRevisionId,
            from: selection.from,
            to: selection.to,
          };
        }
        if (!isCurrent()) return;
        active.dispatched = true;
        const result = await input.client.runVocabularySuggestion({
          schemaVersion: 1,
          requestId: entityId<"AssistantVocabularySuggestionRequest">(
            active.identity.requestId,
          ),
          workId: input.activeWorkId,
          conversationId: assistantConversationId,
          connectionId: entityId<"AssistantConnection">(request.connectionId),
          query: request.query,
          sourceRange,
        });
        if (!isCurrent()) return;
        if (result.status === "failed") {
          setAssistantContextActionError(ASSISTANT_REQUEST_FAILURE_MESSAGES[result.reason]);
          return;
        }
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "정확한 선택 범위를 함께 보내려면 해당 연결의 로컬 읽기·외부 전송 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "선택 범위가 현재 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        await refreshAssistantContext(isCurrent);
      } catch (reason) {
        if (!isCurrent()) return;
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "어휘·유의어 제안을 받지 못했습니다.",
        );
      } finally {
        if (isCurrent()) {
          activeRequestRef.current = null;
          setAssistantContextActionState("idle");
        }
      }
    },
    [
      assistantContextActionState,
      assistantConversationId,
      input,
      refreshAssistantContext,
    ],
  );

  const runAssistantExternalSettingReview = useCallback(
    async (request: Readonly<{ connectionId: string; query: string }>) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        input.document === null ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      if (activeRequestRef.current !== null) return;
      const active = {
        identity: { schemaVersion: 1 as const, workId: input.activeWorkId, requestId: crypto.randomUUID() },
        client: input.client,
        dispatched: false,
      };
      requestGenerationRef.current += 1;
      activeRequestRef.current = active;
      const isCurrent = () => activeRequestRef.current === active;
      setAssistantContextActionState("running-external-setting-review");
      setAssistantContextActionError(null);
      try {
        await input.document.persist();
          if (!isCurrent()) return;
        const manuscript = input.document.materializeText();
        if (manuscript.length === 0) {
          throw new Error("외부 설정 검토에 보낼 현재 회차 원고가 비어 있습니다.");
        }
        const documentRevisionId =
          input.document.getCurrentRevisionId() ??
          input.document.source.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
        }
        if (!isCurrent()) return;
        active.dispatched = true;
        const result = await input.client.runExternalSettingReview({
          schemaVersion: 1,
          requestId: entityId<"AssistantExternalSettingReviewRequest">(
            active.identity.requestId,
          ),
          workId: input.activeWorkId,
          conversationId: assistantConversationId,
          connectionId: entityId<"AssistantConnection">(request.connectionId),
          query: request.query,
          sourceRange: {
            documentId: input.document.source.documentId,
            documentRevisionId,
            from: 0,
            to: manuscript.length,
          },
        });
        if (!isCurrent()) return;
        if (result.status === "failed") {
          setAssistantContextActionError(ASSISTANT_REQUEST_FAILURE_MESSAGES[result.reason]);
          return;
        }
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "현재 회차와 작품 설정을 보내려면 해당 연결의 작품 로컬 읽기·외부 전송 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "현재 회차 범위가 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        await refreshAssistantContext(isCurrent);
      } catch (reason) {
        if (!isCurrent()) return;
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "외부 설정 검토 결과를 받지 못했습니다.",
        );
      } finally {
        if (isCurrent()) {
          activeRequestRef.current = null;
          setAssistantContextActionState("idle");
        }
      }
    },
    [
      assistantContextActionState,
      assistantConversationId,
      input,
      refreshAssistantContext,
    ],
  );

  const runAssistantNotationReview = useCallback(
    async (destinationId: string) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        input.document === null ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      const selection = input.document.readSelection();
      if (selection === undefined || selection.empty) {
        setAssistantContextActionError(
          "원고에서 점검할 범위를 정확히 선택하세요.",
        );
        return;
      }
      setAssistantContextActionState("running-notation-review");
      setAssistantContextActionError(null);
      try {
        await input.document.persist();
        const documentRevisionId =
          input.document.getCurrentRevisionId() ??
          input.document.source.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
        }
        const result = await input.client.runNotationReview({
          schemaVersion: 1,
          requestId: entityId<"AssistantContextRequest">(crypto.randomUUID()),
          workId: input.activeWorkId,
          conversationId: assistantConversationId,
          destinationId,
          sourceRange: {
            documentId: input.document.source.documentId,
            documentRevisionId,
            from: selection.from,
            to: selection.to,
          },
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "표기 점검에 필요한 정확한 선택 범위 로컬 읽기 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "선택 범위가 현재 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        await refreshAssistantContext();
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "선택 범위의 표기를 점검하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      assistantContextActionState,
      assistantConversationId,
      input,
      refreshAssistantContext,
    ],
  );

  const runAssistantSettingReview = useCallback(
    async (destinationId: string) => {
      if (
        input === null ||
        input.activeWorkId === null ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("running-setting-review");
      setAssistantContextActionError(null);
      try {
        const result = await input.client.runSettingReview({
          schemaVersion: 1,
          requestId: entityId<"AssistantSettingReviewRequest">(
            crypto.randomUUID(),
          ),
          workId: input.activeWorkId,
          conversationId: assistantConversationId,
          destinationId,
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "설정 검토에 필요한 작품 전체 로컬 읽기 권한을 먼저 승인하세요.",
          );
          return;
        }
        await refreshAssistantContext();
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "작품 설정을 검토하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [assistantContextActionState, assistantConversationId, input, refreshAssistantContext],
  );

  return {
    assistantConversationId,
    chatGptOAuthStatus,
    publishAssistantOAuthStatus,
    assistantContextDialogOpen,
    assistantContextProjection,
    assistantDestinationProfile,
    assistantContextActionState,
    assistantContextActionError,
    assistantContextConnections,
    activeAssistantGrantCount,
    assistantConnectionsDialogOpen,
    assistantConnections,
    assistantConnectorProfile,
    assistantConnectionsActionState,
    assistantConnectionsActionError,
    openAssistantContextDialog,
    closeAssistantContextDialog,
    openAssistantConnectionsDialog,
    openAssistantConnectionsFromContext,
    closeAssistantConnectionsDialog,
    saveAssistantConnection,
    deleteAssistantConnection,
    grantAssistantContextPermission,
    revokeAssistantContextPermission,
    runAssistantVocabularyLookup,
    runAssistantVocabularySuggestion,
    cancelAssistantRequest,
    runAssistantExternalSettingReview,
    runAssistantNotationReview,
    runAssistantSettingReview,
    reportAssistantContextError,
    clearAssistantContextError,
    hideAssistantContextForNavigation,
    dismissAssistantContextForNavigation,
    reopenAssistantContextAfterNavigation,
  };
}
