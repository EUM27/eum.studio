import type { EntityId } from "../../domain/writing";
import type { AssistantContextRange } from "../assistant/assistant-context-permission";
import {
  canonEntityRefKey,
  parseCanonEntityRef,
  type CanonEntityRef,
} from "../canon/canon-entity-ref";
import type {
  ContinuityReviewItem,
} from "./continuity-review-contract";
import {
  resolveContinuityReviewEvidence,
  type ContinuityReviewModelProposal,
  type ContinuityReviewParagraph,
} from "./continuity-review-model-output";
import type {
  ContinuityThreadKind,
  ContinuityThreadStatus,
} from "./continuity-thread-contract";

export type ContinuityThreadSourceSnapshot = Readonly<{
  threadId: EntityId<"ContinuityThread">;
  workId: EntityId<"Work">;
  revision: number;
  kind: ContinuityThreadKind;
  title: string;
  note: string;
  status: ContinuityThreadStatus;
  subjectRefs: readonly CanonEntityRef[];
}>;

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function refKeys(refs: readonly CanonEntityRef[]): readonly string[] {
  return Object.freeze(refs.map(canonEntityRefKey).sort());
}

export function findPotentialContinuityDuplicateThreadIds(
  draft: Pick<ContinuityReviewModelProposal, "kind" | "title" | "subjectRefs">,
  activeThreads: readonly ContinuityThreadSourceSnapshot[],
): readonly EntityId<"ContinuityThread">[] {
  const proposalRefs = refKeys(draft.subjectRefs).join("\u0000");
  return Object.freeze(activeThreads
    .filter((thread) =>
      thread.status === "open" &&
      thread.kind === draft.kind &&
      normalizedText(thread.title) === normalizedText(draft.title) &&
      refKeys(thread.subjectRefs).join("\u0000") === proposalRefs
    )
    .map((thread) => thread.threadId)
    .sort());
}

function itemSignature(item: Pick<ContinuityReviewItem, "draft" | "evidence">): string {
  return JSON.stringify({
    kind: item.draft.kind,
    title: item.draft.title,
    note: item.draft.note,
    subjectRefs: refKeys(item.draft.subjectRefs),
    evidence: item.evidence.map((entry) => [
      entry.documentRevisionId,
      entry.from,
      entry.to,
      entry.exactText,
    ]),
  });
}

export function planContinuityReviewItems(input: Readonly<{
  proposals: readonly ContinuityReviewModelProposal[];
  paragraphs: readonly ContinuityReviewParagraph[];
  sourceRange: AssistantContextRange;
  allowedSubjectRefs: readonly unknown[];
  activeThreads: readonly ContinuityThreadSourceSnapshot[];
  pendingItems: readonly ContinuityReviewItem[];
  itemIdFactory: Readonly<{ create(): string }>;
  evidenceIdFactory: Readonly<{ create(): string }>;
}>): readonly ContinuityReviewItem[] {
  const allowedKeys = new Set(input.allowedSubjectRefs.map((entry, index) =>
    canonEntityRefKey(parseCanonEntityRef(entry, `allowedSubjectRefs[${index}]`))
  ));
  const planned = input.proposals.map((proposal, proposalIndex) => {
    for (const ref of proposal.subjectRefs) {
      if (!allowedKeys.has(canonEntityRefKey(ref))) {
        throw new Error(
          `Continuity proposal[${proposalIndex}] references a subject outside the Work input`,
        );
      }
    }
    const evidence = resolveContinuityReviewEvidence({
      proposal,
      paragraphs: input.paragraphs,
      sourceRange: input.sourceRange,
      evidenceIdFactory: input.evidenceIdFactory,
    });
    return Object.freeze({
      itemId: input.itemIdFactory.create() as EntityId<"ContinuityReviewItem">,
      assertionBasis: proposal.assertionBasis,
      draft: Object.freeze({
        kind: proposal.kind,
        title: proposal.title,
        note: proposal.note,
        subjectRefs: proposal.subjectRefs,
      }),
      reason: proposal.reason,
      evidence,
      potentialDuplicateThreadIds: findPotentialContinuityDuplicateThreadIds(
        proposal,
        input.activeThreads,
      ),
      status: "pending" as const,
      appliedThreadId: null,
    });
  });
  const pendingSignatures = new Set(input.pendingItems
    .filter((item) => item.status === "pending")
    .map(itemSignature));
  return Object.freeze(planned.filter((item) => !pendingSignatures.has(itemSignature(item))));
}
