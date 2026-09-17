import type { ContinuityReviewCandidate } from "../../application/continuity/continuity-review-contract";
import type {
  ContinuityEvidenceProjection,
  ContinuityOverviewProjection,
  ContinuityThreadProjection,
} from "../../application/continuity/continuity-thread-contract";

export type ContinuityRadarSignalState =
  | "broken-evidence"
  | "missing-evidence"
  | "needs-review-evidence"
  | "connected";

export type ContinuityRadarThreadSignal = Readonly<{
  thread: ContinuityThreadProjection;
  threadId: string;
  state: ContinuityRadarSignalState;
  documentIds: readonly string[];
  openableEvidence: ContinuityEvidenceProjection | null;
}>;

export type ContinuityRadarDocumentLane = Readonly<{
  documentId: string;
  connectedCount: number;
  needsAttentionCount: number;
  threadCount: number;
}>;

export type ContinuityRadarProjection = Readonly<{
  counts: Readonly<{
    activeSources: number;
    connected: number;
    needsAttention: number;
    open: number;
    pendingAi: number;
    resolved: number;
  }>;
  documentLanes: readonly ContinuityRadarDocumentLane[];
  threadSignals: readonly ContinuityRadarThreadSignal[];
}>;

const SIGNAL_ORDER: Readonly<Record<ContinuityRadarSignalState, number>> =
  Object.freeze({
    "broken-evidence": 0,
    "missing-evidence": 1,
    "needs-review-evidence": 2,
    connected: 3,
  });

function signalForThread(
  thread: ContinuityThreadProjection,
): ContinuityRadarThreadSignal {
  const documentIds = Object.freeze([...new Set(
    thread.openedEvidence.map((entry) => entry.documentId),
  )]);
  let state: ContinuityRadarSignalState = "connected";
  if (thread.openedEvidence.some((entry) => entry.integrity === "broken")) {
    state = "broken-evidence";
  } else if (thread.openedEvidence.length === 0) {
    state = "missing-evidence";
  } else if (thread.openedEvidence.some((entry) => entry.integrity === "needsReview")) {
    state = "needs-review-evidence";
  }
  const openableEvidence = thread.openedEvidence.find((entry) =>
    entry.integrity === "resolved" && entry.range !== null
  ) ?? null;
  return Object.freeze({
    thread,
    threadId: thread.threadId,
    state,
    documentIds,
    openableEvidence,
  });
}

export function buildContinuityRadarProjection(
  overview: ContinuityOverviewProjection | null,
  candidates: readonly ContinuityReviewCandidate[],
): ContinuityRadarProjection {
  const threads = overview?.threads ?? [];
  const openThreads = threads.filter((thread) => thread.status === "open");
  const threadSignals = Object.freeze(openThreads
    .map(signalForThread)
    .sort((left, right) =>
      SIGNAL_ORDER[left.state] - SIGNAL_ORDER[right.state] ||
      right.thread.updatedAt.localeCompare(left.thread.updatedAt) ||
      left.thread.title.localeCompare(right.thread.title, "ko")
    ));
  const documentMap = new Map<string, Set<string>>();
  for (const signal of threadSignals) {
    for (const documentId of signal.documentIds) {
      const threadIds = documentMap.get(documentId) ?? new Set<string>();
      threadIds.add(signal.threadId);
      documentMap.set(documentId, threadIds);
    }
  }
  const byThreadId = new Map(threadSignals.map((signal) => [signal.threadId, signal]));
  const documentLanes = Object.freeze([...documentMap.entries()]
    .map(([documentId, threadIds]): ContinuityRadarDocumentLane => {
      const documentSignals = [...threadIds].flatMap((threadId) => {
        const signal = byThreadId.get(threadId);
        return signal === undefined ? [] : [signal];
      });
      return Object.freeze({
        documentId,
        connectedCount: documentSignals.filter((signal) =>
          signal.state === "connected"
        ).length,
        needsAttentionCount: documentSignals.filter((signal) =>
          signal.state !== "connected"
        ).length,
        threadCount: documentSignals.length,
      });
    })
    .sort((left, right) => left.documentId.localeCompare(right.documentId)));
  const needsAttention = threadSignals.filter((signal) =>
    signal.state !== "connected"
  ).length;
  return Object.freeze({
    counts: Object.freeze({
      activeSources: overview?.projectedSources.filter((source) => source.active).length ?? 0,
      connected: threadSignals.length - needsAttention,
      needsAttention,
      open: openThreads.length,
      pendingAi: candidates.reduce((count, candidate) =>
        count + (candidate.status === "ready"
          ? candidate.items.filter((item) => item.status === "pending").length
          : 0), 0),
      resolved: threads.filter((thread) => thread.status === "resolved").length,
    }),
    documentLanes,
    threadSignals,
  });
}
