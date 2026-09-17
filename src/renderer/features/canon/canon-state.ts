import type {
  CanonReviewCandidate,
  CanonReviewResult,
} from "../../../application/canon/canon-review-contract";

export type CanonReviewSelection = Readonly<{
  candidateId: string | null;
  itemId: string | null;
}>;

export const CANON_REVIEW_MESSAGES = Object.freeze({
  loadFailed: "별빛 변경 검토 목록을 불러오지 못했습니다.",
  runFailed: "별빛 변경 점검을 실행하지 못했습니다.",
  loginRequired: "별빛 변경 점검을 사용하려면 조수 연결이 필요합니다.",
  permissionFailed: "선택 원문 사용 권한을 적용하지 못했습니다.",
  updateFailed: "변경 제안을 수정하지 못했습니다.",
  resolveFailed: "별빛 대상을 지정하지 못했습니다.",
  decideFailed: "별빛 변경 결정을 적용하지 못했습니다.",
  noChange: "선택한 원문에서 별빛 변경 사항을 찾지 못했습니다.",
  staleContext: "선택 원문의 저장 버전이 달라졌습니다. 현재 선택으로 다시 실행해 주세요.",
  outsideWork: "현재 작품 밖의 원문은 별빛 변경 점검에 사용할 수 없습니다.",
  invalidRange: "선택 원문 범위가 올바르지 않습니다.",
  sourceUnavailable: "선택 원문의 저장 버전을 찾을 수 없습니다.",
});

export function prependCanonReviewCandidate(
  current: readonly CanonReviewCandidate[],
  candidate: CanonReviewCandidate,
): readonly CanonReviewCandidate[] {
  return Object.freeze([
    candidate,
    ...current.filter((entry) => entry.candidateId !== candidate.candidateId),
  ]);
}

export function replaceCanonReviewCandidate(
  current: readonly CanonReviewCandidate[],
  candidate: CanonReviewCandidate,
): readonly CanonReviewCandidate[] {
  return current.some((entry) => entry.candidateId === candidate.candidateId)
    ? Object.freeze(current.map((entry) =>
        entry.candidateId === candidate.candidateId ? candidate : entry
      ))
    : prependCanonReviewCandidate(current, candidate);
}

export function reconcileCanonReviewSelection(
  current: CanonReviewSelection,
  candidates: readonly CanonReviewCandidate[],
): CanonReviewSelection {
  const selectedCandidate = candidates.find((candidate) =>
    candidate.candidateId === current.candidateId
  );
  if (selectedCandidate !== undefined) {
    return Object.freeze({
      candidateId: selectedCandidate.candidateId,
      itemId: selectedCandidate.items.some((item) => item.itemId === current.itemId)
        ? current.itemId
        : null,
    });
  }
  const first = candidates[0];
  return Object.freeze({
    candidateId: first?.candidateId ?? null,
    itemId: first?.items[0]?.itemId ?? null,
  });
}

export type CanonReviewRunOutcome =
  | Readonly<{ status: "candidate"; candidate: CanonReviewCandidate }>
  | Readonly<{
      status: "permission-required";
      destinationId: string;
      permissionRequired: true;
      error: null;
    }>
  | Readonly<{ status: "no-change"; message: string }>
  | Readonly<{ status: "login-required" | "context-rejected"; error: string }>;

export function resolveCanonReviewRunResult(
  result: CanonReviewResult,
): CanonReviewRunOutcome {
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
    return Object.freeze({ status: "no-change", message: CANON_REVIEW_MESSAGES.noChange });
  }
  if (result.status === "login-required") {
    return Object.freeze({
      status: "login-required",
      error: CANON_REVIEW_MESSAGES.loginRequired,
    });
  }
  const messages = {
    "source-unavailable": CANON_REVIEW_MESSAGES.sourceUnavailable,
    "outside-work": CANON_REVIEW_MESSAGES.outsideWork,
    "stale-context": CANON_REVIEW_MESSAGES.staleContext,
    "invalid-range": CANON_REVIEW_MESSAGES.invalidRange,
  } as const;
  return Object.freeze({
    status: "context-rejected",
    error: messages[result.reason],
  });
}
