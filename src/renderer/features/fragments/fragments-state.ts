import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { FragmentProjection } from "../../../application/fragments/fragment-contract";
import type { EntityId } from "../../../domain/writing";
import type { FragmentShelfActionState } from "../../editor/FragmentShelfDialog";
import type { FragmentMoveOutcome } from "./fragments-client";

export const FRAGMENT_MESSAGES = Object.freeze({
  loadFailed: "파편 서랍을 불러오지 못했습니다.",
  captureSelectionRequired: "복사할 원고 범위를 먼저 선택하세요.",
  captureManuscriptUnavailable: "현재 원고를 읽지 못했습니다.",
  captureFailed:
    "선택 범위를 파편으로 복사하지 못했습니다. 현재 원고에서 다시 선택하세요.",
  moveSelectionRequired: "이동할 원고 범위를 먼저 선택하세요.",
  moveDeleteFailed:
    "원고가 달라져 이동을 완료하지 못했습니다. 안전하게 복사된 파편은 서랍에 남겼습니다.",
  movePersistOrRefreshFailed:
    "파편은 안전하게 복사했지만 원문 이동을 영속 저장하지 못했습니다. 현재 원고 상태를 확인하세요.",
  moveFailed:
    "선택 범위를 파편으로 이동하지 못했습니다. 현재 원고에서 다시 선택하세요.",
  insertCursorRequired:
    "파편을 넣을 한 곳에 커서를 두세요. 선택 범위를 덮어쓰지 않습니다.",
  insertCursorChanged: "현재 커서가 달라져 파편을 넣지 못했습니다.",
  insertPersistFailed:
    "파편 삽입을 영속 저장하지 못했습니다. 사용 횟수는 올리지 않았습니다.",
  updateFailed: "파편 정보가 달라졌습니다. 서랍을 다시 열어 확인하세요.",
  retireFailed: "파편을 서랍에서 치우지 못했습니다.",
});

export function fragmentActionIsIdle(
  actionState: FragmentShelfActionState,
): actionState is "idle" {
  return actionState === "idle";
}

export function canRunFragmentDocumentAction(
  actionState: FragmentShelfActionState,
  document: ManuscriptDocumentSource | null,
): document is ManuscriptDocumentSource {
  return document !== null && fragmentActionIsIdle(actionState);
}

export function canInsertFragment(
  actionState: FragmentShelfActionState,
  document: ManuscriptDocumentSource | null,
  fragment: FragmentProjection,
): document is ManuscriptDocumentSource {
  return canRunFragmentDocumentAction(actionState, document) &&
    fragment.workId === document.workId &&
    fragment.retiredAt === null;
}

export function canMutateFragment(
  actionState: FragmentShelfActionState,
  activeWorkId: EntityId<"Work"> | null,
  fragment: FragmentProjection,
): activeWorkId is EntityId<"Work"> {
  return activeWorkId !== null &&
    fragment.workId === activeWorkId &&
    fragmentActionIsIdle(actionState);
}

export function openFragmentShelfState() {
  return Object.freeze({ dialogOpen: true, error: null });
}

export function closeFragmentShelfState(
  actionState: FragmentShelfActionState,
) {
  return fragmentActionIsIdle(actionState)
    ? Object.freeze({ dialogOpen: false, error: null })
    : null;
}

export function fragmentSourceNavigationStartedState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function fragmentSourceNavigationCompletedState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function fragmentSourceNavigationReopenedState() {
  return Object.freeze({ dialogOpen: true });
}

export function fragmentSourceNavigationFailedState(
  error: string,
  reopen: boolean,
) {
  return reopen
    ? Object.freeze({ dialogOpen: true as const, error })
    : Object.freeze({ error });
}

export function prependFragment(
  current: readonly FragmentProjection[],
  created: FragmentProjection,
): readonly FragmentProjection[] {
  return Object.freeze([
    created,
    ...current.filter((fragment) => fragment.fragmentId !== created.fragmentId),
  ]);
}

export function replaceFragment(
  current: readonly FragmentProjection[],
  updated: FragmentProjection,
): readonly FragmentProjection[] {
  return Object.freeze(current.map((fragment) =>
    fragment.fragmentId === updated.fragmentId ? updated : fragment));
}

export function removeFragment(
  current: readonly FragmentProjection[],
  retired: FragmentProjection,
): readonly FragmentProjection[] {
  return Object.freeze(current.filter(
    (fragment) => fragment.fragmentId !== retired.fragmentId,
  ));
}

export function resolveFragmentMoveState(
  current: readonly FragmentProjection[],
  outcome: FragmentMoveOutcome,
) {
  switch (outcome.status) {
    case "moved":
      return Object.freeze({ fragments: outcome.fragments, error: null });
    case "captured-delete-failed":
      return Object.freeze({
        fragments: prependFragment(current, outcome.captured),
        error: FRAGMENT_MESSAGES.moveDeleteFailed,
      });
    case "captured-persist-or-refresh-failed":
      return Object.freeze({
        fragments: prependFragment(current, outcome.captured),
        error: FRAGMENT_MESSAGES.movePersistOrRefreshFailed,
      });
    case "failed":
      return Object.freeze({
        fragments: current,
        error: FRAGMENT_MESSAGES.moveFailed,
      });
  }
}
