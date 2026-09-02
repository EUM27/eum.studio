import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CanonFieldChange,
  CanonReviewCandidate,
  CanonReviewItem,
  CanonReviewTargetSelection,
  CanonTargetKind,
} from "../../../application/canon/canon-review-contract";
import type { AssistantContextRange } from "../../../application/assistant/assistant-context-permission";
import { entityId, type EntityId } from "../../../domain/writing";
import {
  decideCanonReviewItemRecord,
  exportCanonicalMarkdownRecord,
  grantCanonReviewPermissionRecord,
  listCanonReviewCandidates,
  resolveCanonReviewItemTargetRecord,
  runCanonReviewRecord,
  startCanonReviewWorkLoad,
  updateCanonReviewItemRecord,
  type CanonAssistantClient,
  type CanonClient,
} from "./canon-client";
import {
  CANON_REVIEW_MESSAGES,
  prependCanonReviewCandidate,
  reconcileCanonReviewSelection,
  replaceCanonReviewCandidate,
  resolveCanonReviewRunResult,
  type CanonReviewSelection,
} from "./canon-state";

export type CanonReviewActionState =
  | "idle"
  | "loading"
  | "reviewing"
  | "granting"
  | "updating"
  | "resolving"
  | "deciding"
  | "exporting";

type PendingCanonReview = Readonly<{
  activeWorkId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  requestId: EntityId<"CanonReviewRequest">;
  requestedTargetKinds: readonly CanonTargetKind[];
  sourceRange: AssistantContextRange;
}>;

const EMPTY_SELECTION: CanonReviewSelection = Object.freeze({
  candidateId: null,
  itemId: null,
});

export function useCanonReviewController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: CanonAssistantClient;
  client: CanonClient;
  conversationId: EntityId<"AssistantConversation">;
  refreshCanonical: () => Promise<void>;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const {
    activeWorkId,
    assistantClient,
    client,
    conversationId,
    refreshCanonical,
    workLoadId,
  } = input;
  const [candidates, setCandidates] = useState<readonly CanonReviewCandidate[]>([]);
  const [selection, setSelection] = useState<CanonReviewSelection>(EMPTY_SELECTION);
  const [actionState, setActionState] = useState<CanonReviewActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const activeWorkIdRef = useRef(activeWorkId);
  const pendingReviewRef = useRef<PendingCanonReview | null>(null);

  useEffect(() => {
    activeWorkIdRef.current = activeWorkId;
  }, [activeWorkId]);

  useEffect(() => startCanonReviewWorkLoad({
    client,
    workLoadId,
    onStarted: () => {
      pendingReviewRef.current = null;
      setCandidates([]);
      setSelection(EMPTY_SELECTION);
      setError(null);
      setMessage(null);
      setPermissionRequired(false);
      setDestinationId(null);
      setActionState(workLoadId === null ? "idle" : "loading");
    },
    onReset: () => setActionState("idle"),
    onLoaded: (loadedCandidates) => {
      if (activeWorkIdRef.current !== workLoadId) return;
      setCandidates(loadedCandidates);
      setSelection((current) =>
        reconcileCanonReviewSelection(current, loadedCandidates)
      );
      setActionState("idle");
    },
    onFailed: () => {
      if (activeWorkIdRef.current !== workLoadId) return;
      setError(CANON_REVIEW_MESSAGES.loadFailed);
      setActionState("idle");
    },
  }), [client, workLoadId]);

  const refreshCandidates = useCallback(async (
    status: "all" | "actionable" | "completed" = "all",
  ): Promise<boolean> => {
    const workId = activeWorkId;
    if (workId === null) return false;
    setActionState("loading");
    setError(null);
    try {
      const projection = await listCanonReviewCandidates({
        activeWorkId: workId,
        client,
        status,
      });
      if (activeWorkIdRef.current !== workId) return false;
      setCandidates(projection.candidates);
      setSelection((current) =>
        reconcileCanonReviewSelection(current, projection.candidates)
      );
      return true;
    } catch {
      if (activeWorkIdRef.current === workId) {
        setError(CANON_REVIEW_MESSAGES.loadFailed);
      }
      return false;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client]);

  const exportMarkdown = useCallback(async () => {
    const workId = activeWorkId;
    if (workId === null) return null;
    setActionState("exporting");
    setError(null);
    setMessage(null);
    try {
      const result = await exportCanonicalMarkdownRecord({
        activeWorkId: workId,
        client,
      });
      if (activeWorkIdRef.current !== workId) return null;
      setMessage(result.status === "cancelled"
        ? "별빛 Markdown 내보내기를 취소했습니다."
        : `${result.fileCount}개 Markdown을 ${result.directoryName} 폴더에 내보냈습니다.`);
      return result;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error
          ? reason.message
          : "별빛 Markdown 내보내기에 실패했습니다.");
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client]);

  const executeReview = useCallback(async (
    request: PendingCanonReview,
  ): Promise<CanonReviewCandidate | null> => {
    setActionState("reviewing");
    setError(null);
    setMessage(null);
    try {
      const result = await runCanonReviewRecord({
        ...request,
        client,
      });
      if (activeWorkIdRef.current !== request.activeWorkId) return null;
      const outcome = resolveCanonReviewRunResult(result);
      if (outcome.status === "candidate") {
        setCandidates((current) =>
          prependCanonReviewCandidate(current, outcome.candidate)
        );
        setSelection(Object.freeze({
          candidateId: outcome.candidate.candidateId,
          itemId: outcome.candidate.items[0]?.itemId ?? null,
        }));
        setPermissionRequired(false);
        setDestinationId(null);
        pendingReviewRef.current = null;
        return outcome.candidate;
      }
      if (outcome.status === "permission-required") {
        setPermissionRequired(true);
        setDestinationId(outcome.destinationId);
        return null;
      }
      pendingReviewRef.current = null;
      setPermissionRequired(false);
      setDestinationId(null);
      if (outcome.status === "no-change") setMessage(outcome.message);
      else setError(outcome.error);
      return null;
    } catch (reason) {
      if (activeWorkIdRef.current === request.activeWorkId) {
        setError(reason instanceof Error
          ? reason.message
          : CANON_REVIEW_MESSAGES.runFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === request.activeWorkId) {
        setActionState("idle");
      }
    }
  }, [client]);

  const runReview = useCallback(async (
    sourceRange: AssistantContextRange,
    requestedTargetKinds: readonly CanonTargetKind[],
  ): Promise<CanonReviewCandidate | null> => {
    if (activeWorkId === null || requestedTargetKinds.length === 0) return null;
    const pending = Object.freeze({
      activeWorkId,
      conversationId,
      requestId: entityId<"CanonReviewRequest">(crypto.randomUUID()),
      requestedTargetKinds: Object.freeze([...requestedTargetKinds]),
      sourceRange,
    });
    pendingReviewRef.current = pending;
    return executeReview(pending);
  }, [activeWorkId, conversationId, executeReview]);

  const grantPermissionAndRetry = useCallback(async () => {
    const pending = pendingReviewRef.current;
    const currentDestinationId = destinationId;
    if (
      pending === null ||
      currentDestinationId === null ||
      activeWorkIdRef.current !== pending.activeWorkId
    ) {
      return null;
    }
    setActionState("granting");
    setError(null);
    try {
      await grantCanonReviewPermissionRecord({
        activeWorkId: pending.activeWorkId,
        assistantClient,
        conversationId: pending.conversationId,
        destinationId: currentDestinationId,
      });
      if (activeWorkIdRef.current !== pending.activeWorkId) return null;
      setPermissionRequired(false);
      setDestinationId(null);
      return executeReview(pending);
    } catch (reason) {
      if (activeWorkIdRef.current === pending.activeWorkId) {
        setError(reason instanceof Error
          ? reason.message
          : CANON_REVIEW_MESSAGES.permissionFailed);
        setActionState("idle");
      }
      return null;
    }
  }, [assistantClient, destinationId, executeReview]);

  const updateItem = useCallback(async (
    candidate: CanonReviewCandidate,
    item: CanonReviewItem,
    fieldChanges: readonly CanonFieldChange[],
  ) => {
    const workId = activeWorkId;
    if (workId === null || candidate.workId !== workId) return null;
    setActionState("updating");
    setError(null);
    try {
      const updated = await updateCanonReviewItemRecord({
        activeWorkId: workId,
        candidate,
        client,
        fieldChanges,
        item,
      });
      if (activeWorkIdRef.current !== workId) return null;
      setCandidates((current) => replaceCanonReviewCandidate(current, updated));
      return updated;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CANON_REVIEW_MESSAGES.updateFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client]);

  const resolveTarget = useCallback(async (
    candidate: CanonReviewCandidate,
    item: CanonReviewItem,
    target: CanonReviewTargetSelection,
  ) => {
    const workId = activeWorkId;
    if (workId === null || candidate.workId !== workId) return null;
    setActionState("resolving");
    setError(null);
    try {
      const updated = await resolveCanonReviewItemTargetRecord({
        activeWorkId: workId,
        candidate,
        client,
        item,
        target,
      });
      if (activeWorkIdRef.current !== workId) return null;
      setCandidates((current) => replaceCanonReviewCandidate(current, updated));
      return updated;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CANON_REVIEW_MESSAGES.resolveFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client]);

  const decideItem = useCallback(async (
    candidate: CanonReviewCandidate,
    item: CanonReviewItem,
    decision: "approve" | "reject",
  ) => {
    const workId = activeWorkId;
    if (workId === null || candidate.workId !== workId) return null;
    setActionState("deciding");
    setError(null);
    setMessage(null);
    try {
      const result = await decideCanonReviewItemRecord({
        activeWorkId: workId,
        candidate,
        client,
        decision,
        item,
      });
      if (activeWorkIdRef.current !== workId) return null;
      setCandidates((current) =>
        replaceCanonReviewCandidate(current, result.candidate)
      );
      if (result.status === "applied" || result.status === "nothing-selected") {
        await refreshCanonical();
        if (activeWorkIdRef.current !== workId) return result;
      }
      const feedback = {
        applied: "선택한 변경을 별빛에 반영했습니다.",
        "nothing-selected": "선택된 변경 필드가 없습니다.",
        rejected: "변경 제안을 기각했습니다.",
        "source-stale": "근거 원문의 저장 버전이 달라져 반영하지 않았습니다.",
        "target-stale": "별빛 대상이 변경되어 반영하지 않았습니다.",
        "target-unresolved": "먼저 반영할 별빛 대상을 지정해 주세요.",
        "inference-requires-user-authorship": "추론 제안은 사용자가 내용을 직접 확인하고 수정한 뒤 승인할 수 있습니다.",
        "possible-duplicate": "같은 별빛일 수 있는 항목이 있어 대상을 먼저 확인해 주세요.",
      } as const;
      if (
        result.status === "applied" ||
        result.status === "nothing-selected" ||
        result.status === "rejected"
      ) {
        setMessage(feedback[result.status]);
      } else {
        setError(feedback[result.status]);
      }
      return result;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CANON_REVIEW_MESSAGES.decideFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client, refreshCanonical]);

  const selectCandidate = useCallback((candidateId: string | null) => {
    const candidate = candidates.find((entry) => entry.candidateId === candidateId);
    setSelection(Object.freeze({
      candidateId: candidate?.candidateId ?? null,
      itemId: candidate?.items[0]?.itemId ?? null,
    }));
  }, [candidates]);
  const selectItem = useCallback((itemId: string | null) => {
    setSelection((current) => Object.freeze({ ...current, itemId }));
  }, []);
  const clearFeedback = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);
  const reportError = useCallback((nextError: string) => {
    setError(nextError);
    setMessage(null);
  }, []);
  const selectedCandidate = candidates.find((candidate) =>
    candidate.candidateId === selection.candidateId
  ) ?? null;
  const selectedItem = selectedCandidate?.items.find((item) =>
    item.itemId === selection.itemId
  ) ?? null;

  return {
    candidates,
    selectedCandidate,
    selectedItem,
    selectedCandidateId: selection.candidateId,
    selectedItemId: selection.itemId,
    actionState,
    error,
    message,
    permissionRequired,
    destinationId,
    refreshCandidates,
    exportMarkdown,
    runReview,
    grantPermissionAndRetry,
    updateItem,
    resolveTarget,
    decideItem,
    selectCandidate,
    selectItem,
    clearFeedback,
    reportError,
  };
}
