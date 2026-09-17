import { useCallback, useEffect, useRef, useState } from "react";

import type { AssistantContextRange } from "../../../application/assistant/assistant-context-permission";
import type {
  ContinuityReviewCandidate,
  ContinuityReviewDecisionResult,
  ContinuityReviewDraft,
  ContinuityReviewItem,
} from "../../../application/continuity/continuity-review-contract";
import type {
  ContinuityOverviewProjection,
  ContinuityThreadProjection,
} from "../../../application/continuity/continuity-thread-contract";
import { entityId, type EntityId } from "../../../domain/writing";
import {
  createContinuityThreadRecord,
  decideContinuityReviewItemRecord,
  dismissContinuityThreadRecord,
  grantContinuityReviewPermissionRecord,
  listContinuityRecord,
  resolveContinuityThreadRecord,
  runContinuityReviewRecord,
  startContinuityWorkLoad,
  updateContinuityReviewItemRecord,
  updateContinuityThreadRecord,
  type ContinuityAssistantClient,
  type ContinuityClient,
} from "./continuity-client";
import {
  CONTINUITY_MESSAGES,
  prependContinuityCandidate,
  reconcileContinuityReviewSelection,
  replaceContinuityCandidate,
  resolveContinuityReviewRunResult,
  type ContinuityReviewSelection,
} from "./continuity-state";

export type ContinuityActionState =
  | "idle"
  | "loading"
  | "saving"
  | "reviewing"
  | "granting"
  | "updating"
  | "deciding";

export type PendingContinuitySelection = Readonly<{
  sourceRange: AssistantContextRange;
  exactText: string;
}>;

type PendingReview = Readonly<{
  activeWorkId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  requestId: EntityId<"ContinuityReviewRequest">;
  sourceRange: AssistantContextRange;
}>;

const EMPTY_REVIEW_SELECTION: ContinuityReviewSelection = Object.freeze({
  candidateId: null,
  itemId: null,
});

export function useContinuityController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: ContinuityAssistantClient;
  client: ContinuityClient;
  conversationId: EntityId<"AssistantConversation">;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const { activeWorkId, assistantClient, client, conversationId, workLoadId } = input;
  const [overview, setOverview] = useState<ContinuityOverviewProjection | null>(null);
  const [candidates, setCandidates] = useState<readonly ContinuityReviewCandidate[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [reviewSelection, setReviewSelection] = useState<ContinuityReviewSelection>(
    EMPTY_REVIEW_SELECTION,
  );
  const [pendingSelection, setPendingSelection] =
    useState<PendingContinuitySelection | null>(null);
  const [actionState, setActionState] = useState<ContinuityActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const activeWorkIdRef = useRef(activeWorkId);
  const pendingReviewRef = useRef<PendingReview | null>(null);

  useEffect(() => {
    activeWorkIdRef.current = activeWorkId;
  }, [activeWorkId]);

  useEffect(() => startContinuityWorkLoad({
    client,
    workLoadId,
    onStarted: () => {
      setOverview(null);
      setCandidates([]);
      setSelectedThreadId(null);
      setReviewSelection(EMPTY_REVIEW_SELECTION);
      setPendingSelection(null);
      pendingReviewRef.current = null;
      setError(null);
      setMessage(null);
      setPermissionRequired(false);
      setDestinationId(null);
      setActionState(workLoadId === null ? "idle" : "loading");
    },
    onReset: () => setActionState("idle"),
    onLoaded: (loaded) => {
      if (activeWorkIdRef.current !== workLoadId) return;
      setOverview(loaded.overview);
      setCandidates(loaded.candidates);
      setSelectedThreadId(loaded.overview.threads[0]?.threadId ?? null);
      setReviewSelection((current) =>
        reconcileContinuityReviewSelection(current, loaded.candidates)
      );
      setActionState("idle");
    },
    onFailed: () => {
      if (activeWorkIdRef.current !== workLoadId) return;
      setError(CONTINUITY_MESSAGES.loadFailed);
      setActionState("idle");
    },
  }), [client, workLoadId]);

  const refresh = useCallback(async (): Promise<boolean> => {
    const workId = activeWorkId;
    if (workId === null) return false;
    setActionState("loading");
    setError(null);
    try {
      const [loadedOverview, loadedCandidates] = await Promise.all([
        listContinuityRecord({ activeWorkId: workId, client }),
        client.listCandidates({ schemaVersion: 1, workId, status: "all" }),
      ]);
      if (activeWorkIdRef.current !== workId) return false;
      setOverview(loadedOverview);
      setCandidates(loadedCandidates.candidates);
      setSelectedThreadId((current) =>
        loadedOverview.threads.some((thread) => thread.threadId === current)
          ? current
          : loadedOverview.threads[0]?.threadId ?? null
      );
      setReviewSelection((current) =>
        reconcileContinuityReviewSelection(current, loadedCandidates.candidates)
      );
      return true;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CONTINUITY_MESSAGES.loadFailed);
      }
      return false;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client]);

  const stageManualSelection = useCallback((
    sourceRange: AssistantContextRange,
    exactText: string,
  ) => {
    setPendingSelection(Object.freeze({ sourceRange, exactText }));
    setError(null);
    setMessage("선택 원문을 연속성 메모 근거로 준비했습니다.");
  }, []);

  const clearPendingSelection = useCallback(() => setPendingSelection(null), []);

  const createThread = useCallback(async (draft: ContinuityReviewDraft) => {
    const workId = activeWorkId;
    if (workId === null) return null;
    setActionState("saving");
    setError(null);
    setMessage(null);
    try {
      const created = await createContinuityThreadRecord({
        activeWorkId: workId,
        client,
        draft,
        openedEvidenceRange: pendingSelection?.sourceRange ?? null,
      });
      if (activeWorkIdRef.current !== workId) return null;
      await refresh();
      if (activeWorkIdRef.current !== workId) return created;
      setSelectedThreadId(created.threadId);
      setPendingSelection(null);
      setMessage("연속성 메모를 저장했습니다.");
      return created;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CONTINUITY_MESSAGES.createFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client, pendingSelection, refresh]);

  const updateThread = useCallback(async (
    thread: ContinuityThreadProjection,
    draft: ContinuityReviewDraft,
  ) => {
    const workId = activeWorkId;
    if (workId === null || thread.workId !== workId) return null;
    setActionState("updating");
    setError(null);
    try {
      const updated = await updateContinuityThreadRecord({
        activeWorkId: workId,
        client,
        thread,
        draft,
      });
      if (activeWorkIdRef.current !== workId) return null;
      await refresh();
      setSelectedThreadId(updated.threadId);
      setMessage("연속성 메모를 수정했습니다.");
      return updated;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CONTINUITY_MESSAGES.updateFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client, refresh]);

  const resolveThread = useCallback(async (
    thread: ContinuityThreadProjection,
    reason: string,
    usePendingEvidence: boolean,
  ) => {
    const workId = activeWorkId;
    if (workId === null || thread.workId !== workId) return null;
    setActionState("saving");
    setError(null);
    try {
      const resolved = await resolveContinuityThreadRecord({
        activeWorkId: workId,
        client,
        thread,
        mode: usePendingEvidence ? "evidence" : "manual",
        sourceRange: usePendingEvidence ? pendingSelection?.sourceRange ?? null : null,
        reason,
      });
      if (activeWorkIdRef.current !== workId) return null;
      await refresh();
      if (usePendingEvidence) setPendingSelection(null);
      setMessage("연속성 메모를 해결했습니다.");
      return resolved;
    } catch (reasonValue) {
      if (activeWorkIdRef.current === workId) {
        setError(reasonValue instanceof Error
          ? reasonValue.message
          : CONTINUITY_MESSAGES.resolveFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client, pendingSelection, refresh]);

  const dismissThread = useCallback(async (
    thread: ContinuityThreadProjection,
    reason: string,
  ) => {
    const workId = activeWorkId;
    if (workId === null || thread.workId !== workId) return null;
    setActionState("saving");
    setError(null);
    try {
      const dismissed = await dismissContinuityThreadRecord({
        activeWorkId: workId,
        client,
        thread,
        reason,
      });
      if (activeWorkIdRef.current !== workId) return null;
      await refresh();
      setMessage("연속성 메모를 추적 대상에서 제외했습니다.");
      return dismissed;
    } catch (reasonValue) {
      if (activeWorkIdRef.current === workId) {
        setError(reasonValue instanceof Error
          ? reasonValue.message
          : CONTINUITY_MESSAGES.dismissFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client, refresh]);

  const executeReview = useCallback(async (request: PendingReview) => {
    setActionState("reviewing");
    setError(null);
    setMessage(null);
    try {
      const result = await runContinuityReviewRecord({ ...request, client });
      if (activeWorkIdRef.current !== request.activeWorkId) return null;
      const outcome = resolveContinuityReviewRunResult(result);
      if (outcome.status === "candidate") {
        setCandidates((current) => prependContinuityCandidate(current, outcome.candidate));
        setReviewSelection(Object.freeze({
          candidateId: outcome.candidate.candidateId,
          itemId: outcome.candidate.items[0]?.itemId ?? null,
        }));
        pendingReviewRef.current = null;
        setPermissionRequired(false);
        setDestinationId(null);
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
        setError(reason instanceof Error ? reason.message : CONTINUITY_MESSAGES.runFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === request.activeWorkId) setActionState("idle");
    }
  }, [client]);

  const runReview = useCallback(async (sourceRange: AssistantContextRange) => {
    if (activeWorkId === null) return null;
    const pending = Object.freeze({
      activeWorkId,
      conversationId,
      requestId: entityId<"ContinuityReviewRequest">(crypto.randomUUID()),
      sourceRange,
    });
    pendingReviewRef.current = pending;
    return executeReview(pending);
  }, [activeWorkId, conversationId, executeReview]);

  const grantPermissionAndRetry = useCallback(async () => {
    const pending = pendingReviewRef.current;
    if (
      pending === null || destinationId === null ||
      activeWorkIdRef.current !== pending.activeWorkId
    ) return null;
    setActionState("granting");
    setError(null);
    try {
      await grantContinuityReviewPermissionRecord({
        activeWorkId: pending.activeWorkId,
        assistantClient,
        conversationId: pending.conversationId,
        destinationId,
      });
      if (activeWorkIdRef.current !== pending.activeWorkId) return null;
      setPermissionRequired(false);
      setDestinationId(null);
      return executeReview(pending);
    } catch (reason) {
      if (activeWorkIdRef.current === pending.activeWorkId) {
        setError(reason instanceof Error ? reason.message : CONTINUITY_MESSAGES.permissionFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === pending.activeWorkId) setActionState("idle");
    }
  }, [assistantClient, destinationId, executeReview]);

  const updateItem = useCallback(async (
    candidate: ContinuityReviewCandidate,
    item: ContinuityReviewItem,
    draft: ContinuityReviewDraft,
  ) => {
    const workId = activeWorkId;
    if (workId === null || candidate.workId !== workId) return null;
    setActionState("updating");
    setError(null);
    try {
      const updated = await updateContinuityReviewItemRecord({
        activeWorkId: workId,
        candidate,
        client,
        item,
        draft,
      });
      if (activeWorkIdRef.current !== workId) return null;
      setCandidates((current) => replaceContinuityCandidate(current, updated));
      return updated;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error
          ? reason.message
          : CONTINUITY_MESSAGES.candidateUpdateFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client]);

  const decideItem = useCallback(async (
    candidate: ContinuityReviewCandidate,
    item: ContinuityReviewItem,
    decision: "approve" | "reject",
    acknowledgedDuplicateThreadIds: readonly EntityId<"ContinuityThread">[],
  ): Promise<ContinuityReviewDecisionResult | null> => {
    const workId = activeWorkId;
    if (workId === null || candidate.workId !== workId) return null;
    setActionState("deciding");
    setError(null);
    setMessage(null);
    try {
      const result = await decideContinuityReviewItemRecord({
        acknowledgedDuplicateThreadIds,
        activeWorkId: workId,
        candidate,
        client,
        decision,
        item,
      });
      if (activeWorkIdRef.current !== workId) return null;
      setCandidates((current) => replaceContinuityCandidate(current, result.candidate));
      if (result.status === "applied") await refresh();
      const feedback = {
        applied: "연속성 제안을 새 메모로 승인했습니다.",
        rejected: "연속성 제안을 기각했습니다.",
        "source-stale": "근거 원문의 저장 버전이 달라 승인하지 않았습니다.",
        "candidate-stale": "후보가 변경되어 다시 확인해야 합니다.",
        "duplicate-review-required": "비슷한 열린 메모를 확인한 뒤 승인해 주세요.",
      } as const;
      if (result.status === "applied" || result.status === "rejected") {
        setMessage(feedback[result.status]);
      } else {
        setError(feedback[result.status]);
      }
      return result;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : CONTINUITY_MESSAGES.decideFailed);
      }
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [activeWorkId, client, refresh]);

  const selectCandidate = useCallback((candidateId: string | null) => {
    const selected = candidates.find((entry) => entry.candidateId === candidateId);
    setReviewSelection(Object.freeze({
      candidateId: selected?.candidateId ?? null,
      itemId: selected?.items[0]?.itemId ?? null,
    }));
  }, [candidates]);
  const selectItem = useCallback((itemId: string | null) => {
    setReviewSelection((current) => Object.freeze({ ...current, itemId }));
  }, []);
  const clearFeedback = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);
  const reportError = useCallback((next: string) => {
    setError(next);
    setMessage(null);
  }, []);

  const selectedCandidate = candidates.find((entry) =>
    entry.candidateId === reviewSelection.candidateId
  ) ?? null;
  const selectedItem = selectedCandidate?.items.find((entry) =>
    entry.itemId === reviewSelection.itemId
  ) ?? null;
  const selectedThread = overview?.threads.find((entry) =>
    entry.threadId === selectedThreadId
  ) ?? null;

  return {
    overview,
    candidates,
    selectedThread,
    selectedThreadId,
    selectedCandidate,
    selectedItem,
    selectedCandidateId: reviewSelection.candidateId,
    selectedItemId: reviewSelection.itemId,
    pendingSelection,
    actionState,
    error,
    message,
    permissionRequired,
    refresh,
    stageManualSelection,
    clearPendingSelection,
    createThread,
    updateThread,
    resolveThread,
    dismissThread,
    runReview,
    grantPermissionAndRetry,
    updateItem,
    decideItem,
    selectThread: setSelectedThreadId,
    selectCandidate,
    selectItem,
    clearFeedback,
    reportError,
  };
}
