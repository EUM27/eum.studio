import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  LoreCandidateApprovalResult,
  LoreCandidateProjection,
} from "../../../application/lore/lore-candidate-contract";
import type { LoreEntryProjection } from "../../../application/lore/lore-entry-contract";
import type { EntityId } from "../../../domain/writing";
import type { LoreCandidateActionState } from "../../editor/LoreCandidateDialog";
import type { LoreManagerActionState } from "../../editor/LoreManagerDialog";

export const LORE_MESSAGES = Object.freeze({
  loadFailed: "별빛과 검토 기록, 복선 연결 목록을 불러오지 못했습니다.",
  candidateLoadFailed: "별빛 검토 기록을 불러오지 못했습니다.",
  createEvidenceRequired: "별빛 근거로 연결할 원고 범위를 먼저 선택하세요.",
  createEmptyEvidence: "빈 원고 범위는 별빛 근거로 연결할 수 없습니다.",
  createFailed: "별빛을 만들지 못했습니다. 이름과 현재 원고 근거를 확인하세요.",
  updateFailed: "별빛 정보가 달라졌습니다. 다시 열어 확인하세요.",
  retireFailed: "별빛을 목록에서 치우지 못했습니다.",
  retireLinkRefreshFailed:
    "별빛은 치웠지만 복선 연결 목록을 새로 읽지 못했습니다.",
  addEvidenceRequired: "별빛 근거로 추가할 원고 범위를 먼저 선택하세요.",
  addEmptyEvidence: "빈 원고 범위는 별빛 근거로 추가할 수 없습니다.",
  addEvidenceFailed: "현재 원고 선택을 별빛 근거로 추가하지 못했습니다.",
  candidateEvidenceRequired: "별빛 후보의 근거가 될 원고 범위를 선택하세요.",
  candidateEmptyEvidence: "빈 원고 범위는 별빛 후보로 담을 수 없습니다.",
  candidateCreateFailed:
    "현재 선택을 별빛 후보로 담지 못했습니다. 원고와 제안 내용을 확인하세요.",
  candidateApproveFailed:
    "후보를 승인하지 못했습니다. 현재 원문과 별빛 상태를 다시 확인하세요.",
  candidateRejectFailed: "후보를 거절하지 못했습니다. 검토 기록을 다시 확인하세요.",
});

export function canCreateLoreEntry(
  actionState: LoreManagerActionState,
  activeWorkId: EntityId<"Work"> | null,
): activeWorkId is EntityId<"Work"> {
  return actionState === "idle" && activeWorkId !== null;
}

export function canMutateLoreEntry(
  actionState: LoreManagerActionState,
  activeWorkId: EntityId<"Work"> | null,
  entry: LoreEntryProjection,
): activeWorkId is EntityId<"Work"> {
  return (
    actionState === "idle" &&
    activeWorkId !== null &&
    entry.workId === activeWorkId
  );
}

export function canAddLoreEvidence(
  actionState: LoreManagerActionState,
  document: ManuscriptDocumentSource | null,
  entry: LoreEntryProjection,
): document is ManuscriptDocumentSource {
  return (
    actionState === "idle" &&
    document !== null &&
    entry.workId === document.workId
  );
}

export function canRefreshLoreCandidates(
  actionState: LoreCandidateActionState,
  activeWorkId: EntityId<"Work"> | null,
): activeWorkId is EntityId<"Work"> {
  return actionState === "idle" && activeWorkId !== null;
}

export function canCreateLoreCandidate(
  actionState: LoreCandidateActionState,
  activeWorkId: EntityId<"Work"> | null,
  document: ManuscriptDocumentSource | null,
): document is ManuscriptDocumentSource {
  return (
    actionState === "idle" &&
    activeWorkId !== null &&
    document !== null &&
    document.workId === activeWorkId
  );
}

export function canApproveLoreCandidate(
  actionState: LoreCandidateActionState,
  activeWorkId: EntityId<"Work"> | null,
  candidate: LoreCandidateProjection,
): activeWorkId is EntityId<"Work"> {
  return (
    actionState === "idle" &&
    activeWorkId !== null &&
    candidate.workId === activeWorkId &&
    candidate.status === "pending" &&
    candidate.approvalBlockReason === null
  );
}

export function canRejectLoreCandidate(
  actionState: LoreCandidateActionState,
  activeWorkId: EntityId<"Work"> | null,
  candidate: LoreCandidateProjection,
): activeWorkId is EntityId<"Work"> {
  return (
    actionState === "idle" &&
    activeWorkId !== null &&
    candidate.workId === activeWorkId &&
    candidate.status === "pending"
  );
}

export function reconcileSelectedLoreEntry(
  current: string | null,
  entries: readonly LoreEntryProjection[],
): string | null {
  return current !== null && entries.some((entry) => entry.loreEntryId === current)
    ? current
    : (entries[0]?.loreEntryId ?? null);
}

export function prependLoreEntry(
  current: readonly LoreEntryProjection[],
  created: LoreEntryProjection,
): readonly LoreEntryProjection[] {
  return Object.freeze([
    created,
    ...current.filter(
      (entry) =>
        entry.workId === created.workId &&
        entry.loreEntryId !== created.loreEntryId,
    ),
  ]);
}

export function replaceLoreEntry(
  current: readonly LoreEntryProjection[],
  updated: LoreEntryProjection,
): readonly LoreEntryProjection[] {
  return Object.freeze(
    current
      .filter((entry) => entry.workId === updated.workId)
      .map((entry) =>
        entry.loreEntryId === updated.loreEntryId ? updated : entry),
  );
}

export function resolveLoreRetirement(
  current: readonly LoreEntryProjection[],
  selectedEntryId: string | null,
  retired: LoreEntryProjection,
) {
  const entries = Object.freeze(current.filter(
    (entry) =>
      entry.workId === retired.workId &&
      entry.loreEntryId !== retired.loreEntryId,
  ));
  return Object.freeze({
    entries,
    selectedEntryId: selectedEntryId === retired.loreEntryId
      ? (entries[0]?.loreEntryId ?? null)
      : selectedEntryId,
  });
}

export function prependLoreCandidate(
  current: readonly LoreCandidateProjection[],
  created: LoreCandidateProjection,
): readonly LoreCandidateProjection[] {
  return Object.freeze([
    created,
    ...current.filter(
      (candidate) => candidate.candidateId !== created.candidateId,
    ),
  ]);
}

export function replaceLoreCandidate(
  current: readonly LoreCandidateProjection[],
  updated: LoreCandidateProjection,
): readonly LoreCandidateProjection[] {
  return Object.freeze(current.map((candidate) =>
    candidate.candidateId === updated.candidateId ? updated : candidate));
}

export function reconcileLoreCandidateApproval(
  entries: readonly LoreEntryProjection[],
  candidates: readonly LoreCandidateProjection[],
  result: LoreCandidateApprovalResult,
) {
  return Object.freeze({
    candidates: replaceLoreCandidate(candidates, result.candidate),
    entries: Object.freeze([
      result.loreEntry,
      ...entries.filter(
        (entry) => entry.loreEntryId !== result.loreEntry.loreEntryId,
      ),
    ]),
    selectedEntryId: result.loreEntry.loreEntryId,
  });
}

export function closeLoreDialogState(actionState: LoreManagerActionState) {
  return actionState === "idle"
    ? Object.freeze({ dialogOpen: false, error: null })
    : null;
}

export function enterLoreStructureState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function closeLoreCandidateDialogState(
  actionState: LoreCandidateActionState,
) {
  return actionState === "idle"
    ? Object.freeze({ dialogOpen: false, error: null })
    : null;
}

export function loreSharedLinkStartedState(
  actionState: "linking-foreshadow" | "unlinking-foreshadow",
) {
  return Object.freeze({ actionState, error: null });
}

export function loreSharedLinkFailedState(error: string) {
  return Object.freeze({ error });
}

export function loreSharedLinkFinishedState() {
  return Object.freeze({ actionState: "idle" as const });
}

export function loreNavigationRejectedState(error: string) {
  return Object.freeze({ error });
}

export function loreNavigationStartedState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function loreNavigationOpenedState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function loreNavigationFailedState(
  error: string,
  reopenDialog: boolean,
) {
  return reopenDialog
    ? Object.freeze({ dialogOpen: true, error })
    : Object.freeze({ error });
}
