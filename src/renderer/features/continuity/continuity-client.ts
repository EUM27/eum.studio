import type { AssistantContextRange } from "../../../application/assistant/assistant-context-permission";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  ContinuityReviewCandidate,
  ContinuityReviewDecisionResult,
  ContinuityReviewDraft,
  ContinuityReviewItem,
  ContinuityReviewResult,
} from "../../../application/continuity/continuity-review-contract";
import type {
  ContinuityOverviewProjection,
  ContinuityResolutionMode,
  ContinuityThreadProjection,
} from "../../../application/continuity/continuity-thread-contract";
import type { EntityId } from "../../../domain/writing";

export type ContinuityClient = StudioBridge["continuity"];
export type ContinuityAssistantClient = Pick<
  StudioBridge["assistant"],
  "grantContextPermission"
>;

export type ContinuityWorkLoad = Readonly<{
  overview: ContinuityOverviewProjection;
  candidates: readonly ContinuityReviewCandidate[];
}>;

export type ContinuityTimerPort = Readonly<{
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}>;

const DEFAULT_TIMER: ContinuityTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function startContinuityWorkLoad(input: Readonly<{
  client: ContinuityClient;
  workLoadId: EntityId<"Work"> | null;
  onStarted(): void;
  onReset(): void;
  onLoaded(value: ContinuityWorkLoad): void;
  onFailed(): void;
  timer?: ContinuityTimerPort;
}>): () => void {
  let disposed = false;
  const timer = input.timer ?? DEFAULT_TIMER;
  const handle = timer.schedule(() => {
    if (disposed) return;
    input.onStarted();
    if (input.workLoadId === null) {
      input.onReset();
      return;
    }
    void Promise.all([
      listContinuityRecord({
        activeWorkId: input.workLoadId,
        client: input.client,
      }),
      input.client.listCandidates({
        schemaVersion: 1,
        workId: input.workLoadId,
        status: "all",
      }),
    ]).then(
      ([overview, candidates]) => {
        if (!disposed) input.onLoaded(Object.freeze({
          overview,
          candidates: candidates.candidates,
        }));
      },
      () => {
        if (!disposed) input.onFailed();
      },
    );
  }, 0);
  return () => {
    disposed = true;
    timer.cancel(handle);
  };
}

export function listContinuityRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ContinuityClient;
  status?: "all" | "open" | "closed";
}>) {
  return input.client.list({
    schemaVersion: 1,
    workId: input.activeWorkId,
    status: input.status ?? "all",
  });
}

export function createContinuityThreadRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ContinuityClient;
  draft: ContinuityReviewDraft;
  openedEvidenceRange: AssistantContextRange | null;
}>) {
  return input.client.create({
    schemaVersion: 1,
    workId: input.activeWorkId,
    kind: input.draft.kind,
    title: input.draft.title,
    note: input.draft.note,
    subjectRefs: input.draft.subjectRefs,
    openedEvidenceRange: input.openedEvidenceRange,
  });
}

export function updateContinuityThreadRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ContinuityClient;
  draft: ContinuityReviewDraft;
  thread: ContinuityThreadProjection;
}>) {
  return input.client.update({
    schemaVersion: 1,
    workId: input.activeWorkId,
    threadId: input.thread.threadId,
    expectedRevision: input.thread.revision,
    kind: input.draft.kind,
    title: input.draft.title,
    note: input.draft.note,
    subjectRefs: input.draft.subjectRefs,
  });
}

export function resolveContinuityThreadRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ContinuityClient;
  mode: ContinuityResolutionMode;
  reason: string;
  sourceRange: AssistantContextRange | null;
  thread: ContinuityThreadProjection;
}>) {
  return input.client.resolve({
    schemaVersion: 1,
    workId: input.activeWorkId,
    threadId: input.thread.threadId,
    expectedRevision: input.thread.revision,
    resolutionMode: input.mode,
    resolutionEvidenceRange: input.sourceRange,
    reason: input.reason,
  });
}

export function dismissContinuityThreadRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ContinuityClient;
  reason: string;
  thread: ContinuityThreadProjection;
}>) {
  return input.client.dismiss({
    schemaVersion: 1,
    workId: input.activeWorkId,
    threadId: input.thread.threadId,
    expectedRevision: input.thread.revision,
    reason: input.reason,
  });
}

export function runContinuityReviewRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ContinuityClient;
  conversationId: EntityId<"AssistantConversation">;
  requestId: EntityId<"ContinuityReviewRequest">;
  sourceRange: AssistantContextRange;
}>): Promise<ContinuityReviewResult> {
  return input.client.runReview({
    schemaVersion: 1,
    requestId: input.requestId,
    workId: input.activeWorkId,
    conversationId: input.conversationId,
    sourceRange: input.sourceRange,
  });
}

export function grantContinuityReviewPermissionRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  assistantClient: ContinuityAssistantClient;
  conversationId: EntityId<"AssistantConversation">;
  destinationId: string;
}>) {
  return input.assistantClient.grantContextPermission({
    schemaVersion: 1,
    workId: input.activeWorkId,
    conversationId: input.conversationId,
    capability: "continuity.review",
    destinationId: input.destinationId,
    localScope: "selection",
    externalScope: "selection",
    duration: "once",
  });
}

export function updateContinuityReviewItemRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: ContinuityReviewCandidate;
  client: ContinuityClient;
  draft: ContinuityReviewDraft;
  item: ContinuityReviewItem;
}>) {
  return input.client.updateItem({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    draft: input.draft,
  });
}

export function decideContinuityReviewItemRecord(input: Readonly<{
  acknowledgedDuplicateThreadIds: readonly EntityId<"ContinuityThread">[];
  activeWorkId: EntityId<"Work">;
  candidate: ContinuityReviewCandidate;
  client: ContinuityClient;
  decision: "approve" | "reject";
  item: ContinuityReviewItem;
}>): Promise<ContinuityReviewDecisionResult> {
  return input.client.decideItem({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    decision: input.decision,
    acknowledgedDuplicateThreadIds: input.acknowledgedDuplicateThreadIds,
  });
}
