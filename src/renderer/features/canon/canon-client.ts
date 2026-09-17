import type {
  CanonFieldChange,
  CanonReviewCandidate,
  CanonReviewDecisionResult,
  CanonReviewItem,
  CanonReviewResult,
  CanonReviewTargetSelection,
  CanonTargetKind,
} from "../../../application/canon/canon-review-contract";
import type { AssistantContextRange } from "../../../application/assistant/assistant-context-permission";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { EntityId } from "../../../domain/writing";

export type CanonClient = StudioBridge["canon"];
export type CanonAssistantClient = Pick<
  StudioBridge["assistant"],
  "grantContextPermission"
>;

export type CanonReviewTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: CanonReviewTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function startCanonReviewWorkLoad(input: Readonly<{
  client: CanonClient;
  onFailed: () => void;
  onLoaded: (candidates: readonly CanonReviewCandidate[]) => void;
  onReset: () => void;
  onStarted: () => void;
  timer?: CanonReviewTimerPort;
  workLoadId: EntityId<"Work"> | null;
}>): () => void {
  let disposed = false;
  const timer = input.timer ?? DEFAULT_TIMER_PORT;
  const startHandle = timer.schedule(() => {
    if (disposed) return;
    input.onStarted();
    if (input.workLoadId === null) {
      input.onReset();
      return;
    }
    void listCanonReviewCandidates({
      activeWorkId: input.workLoadId,
      client: input.client,
    }).then(
      (projection) => {
        if (!disposed) input.onLoaded(projection.candidates);
      },
      () => {
        if (!disposed) input.onFailed();
      },
    );
  }, 0);
  return () => {
    disposed = true;
    timer.cancel(startHandle);
  };
}

export function listCanonReviewCandidates(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: CanonClient;
  status?: "all" | "actionable" | "completed";
}>) {
  return input.client.listCandidates({
    schemaVersion: 1,
    workId: input.activeWorkId,
    status: input.status ?? "all",
  });
}

export function exportCanonicalMarkdownRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: CanonClient;
}>) {
  return input.client.exportMarkdown({
    schemaVersion: 1,
    workId: input.activeWorkId,
  });
}

export function runCanonReviewRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: CanonClient;
  conversationId: EntityId<"AssistantConversation">;
  requestId: EntityId<"CanonReviewRequest">;
  requestedTargetKinds: readonly CanonTargetKind[];
  sourceRange: AssistantContextRange;
}>): Promise<CanonReviewResult> {
  return input.client.runReview({
    schemaVersion: 1,
    requestId: input.requestId,
    workId: input.activeWorkId,
    conversationId: input.conversationId,
    sourceRange: input.sourceRange,
    requestedTargetKinds: input.requestedTargetKinds,
  });
}

export function grantCanonReviewPermissionRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  assistantClient: CanonAssistantClient;
  conversationId: EntityId<"AssistantConversation">;
  destinationId: string;
}>) {
  return input.assistantClient.grantContextPermission({
    schemaVersion: 1,
    workId: input.activeWorkId,
    conversationId: input.conversationId,
    capability: "canon.review",
    destinationId: input.destinationId,
    localScope: "selection",
    externalScope: "selection",
    duration: "once",
  });
}

export function updateCanonReviewItemRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: CanonReviewCandidate;
  client: CanonClient;
  fieldChanges: readonly CanonFieldChange[];
  item: CanonReviewItem;
}>): Promise<CanonReviewCandidate> {
  return input.client.updateItem({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    fieldChanges: input.fieldChanges,
  });
}

export function resolveCanonReviewItemTargetRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: CanonReviewCandidate;
  client: CanonClient;
  item: CanonReviewItem;
  target: CanonReviewTargetSelection;
}>): Promise<CanonReviewCandidate> {
  return input.client.resolveTarget({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    target: input.target,
  });
}

export function decideCanonReviewItemRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: CanonReviewCandidate;
  client: CanonClient;
  decision: "approve" | "reject";
  item: CanonReviewItem;
}>): Promise<CanonReviewDecisionResult> {
  return input.client.decideItem({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    decision: Object.freeze({ kind: input.decision }),
  });
}
