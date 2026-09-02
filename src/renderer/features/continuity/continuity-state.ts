import type {
  ContinuityReviewCandidate,
  ContinuityReviewResult,
} from "../../../application/continuity/continuity-review-contract";

export const CONTINUITY_MESSAGES = Object.freeze({
  loadFailed: "연속성 기록을 불러오지 못했습니다.",
  createFailed: "연속성 메모를 저장하지 못했습니다.",
  updateFailed: "연속성 메모를 수정하지 못했습니다.",
  resolveFailed: "연속성 메모를 해결하지 못했습니다.",
  dismissFailed: "연속성 메모를 제외하지 못했습니다.",
  runFailed: "연속성 점검을 실행하지 못했습니다.",
  loginRequired: "연속성 점검을 사용하려면 조수 연결이 필요합니다.",
  permissionFailed: "선택 원문 사용 권한을 적용하지 못했습니다.",
  candidateUpdateFailed: "연속성 제안을 수정하지 못했습니다.",
  decideFailed: "연속성 제안 결정을 적용하지 못했습니다.",
  noChange: "선택한 원문에서 새 연속성 항목을 찾지 못했습니다.",
  staleContext: "선택 원문의 저장 버전이 달라졌습니다. 현재 선택으로 다시 실행해 주세요.",
  outsideWork: "현재 작품 밖의 원문은 연속성 점검에 사용할 수 없습니다.",
  invalidRange: "선택 원문 범위가 올바르지 않습니다.",
  sourceUnavailable: "선택 원문의 저장 버전을 찾을 수 없습니다.",
});

export type ContinuityReviewSelection = Readonly<{
  candidateId: string | null;
  itemId: string | null;
}>;

export function prependContinuityCandidate(
  current: readonly ContinuityReviewCandidate[],
  candidate: ContinuityReviewCandidate,
): readonly ContinuityReviewCandidate[] {
  return Object.freeze([
    candidate,
    ...current.filter((entry) => entry.candidateId !== candidate.candidateId),
  ]);
}

export function replaceContinuityCandidate(
  current: readonly ContinuityReviewCandidate[],
  candidate: ContinuityReviewCandidate,
): readonly ContinuityReviewCandidate[] {
  return current.some((entry) => entry.candidateId === candidate.candidateId)
    ? Object.freeze(current.map((entry) =>
        entry.candidateId === candidate.candidateId ? candidate : entry
      ))
    : prependContinuityCandidate(current, candidate);
}

export function reconcileContinuityReviewSelection(
  current: ContinuityReviewSelection,
  candidates: readonly ContinuityReviewCandidate[],
): ContinuityReviewSelection {
  const selected = candidates.find((entry) => entry.candidateId === current.candidateId);
  if (selected !== undefined) {
    return Object.freeze({
      candidateId: selected.candidateId,
      itemId: selected.items.some((item) => item.itemId === current.itemId)
        ? current.itemId
        : selected.items[0]?.itemId ?? null,
    });
  }
  return Object.freeze({
    candidateId: candidates[0]?.candidateId ?? null,
    itemId: candidates[0]?.items[0]?.itemId ?? null,
  });
}

export type ContinuityReviewRunOutcome =
  | Readonly<{ status: "candidate"; candidate: ContinuityReviewCandidate }>
  | Readonly<{
      status: "permission-required";
      destinationId: string;
      permissionRequired: true;
      error: null;
    }>
  | Readonly<{ status: "no-change"; message: string }>
  | Readonly<{ status: "login-required" | "context-rejected"; error: string }>;

export function resolveContinuityReviewRunResult(
  result: ContinuityReviewResult,
): ContinuityReviewRunOutcome {
  if (result.status === "candidate") {
    return Object.freeze({ status: "candidate", candidate: result.candidate });
  }
  if (result.status === "permission-required") {
    return Object.freeze({
      status: "permission-required",
      destinationId: result.destinationId,
      permissionRequired: true,
      error: null,
    });
  }
  if (result.status === "no-change") {
    return Object.freeze({ status: "no-change", message: CONTINUITY_MESSAGES.noChange });
  }
  if (result.status === "login-required") {
    return Object.freeze({ status: "login-required", error: CONTINUITY_MESSAGES.loginRequired });
  }
  const messages = {
    "source-unavailable": CONTINUITY_MESSAGES.sourceUnavailable,
    "outside-work": CONTINUITY_MESSAGES.outsideWork,
    "stale-context": CONTINUITY_MESSAGES.staleContext,
    "invalid-range": CONTINUITY_MESSAGES.invalidRange,
  } as const;
  return Object.freeze({ status: "context-rejected", error: messages[result.reason] });
}
