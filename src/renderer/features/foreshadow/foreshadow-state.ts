import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ForeshadowLineProjection } from "../../../application/foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointProjection } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { EntityId } from "../../../domain/writing";
import type { ForeshadowLineActionState } from "../../editor/ForeshadowLineDialog";

export const FORESHADOW_MESSAGES = Object.freeze({
  loadFailed: "복선 라인을 불러오지 못했습니다.",
  createFailed: "복선 라인을 만들지 못했습니다. 이름과 현재 작품을 확인하세요.",
  updateFailed: "복선 라인 정보가 달라졌습니다. 다시 열어 확인하세요.",
  retireFailed: "복선 라인을 목록에서 치우지 못했습니다.",
  retireLinkRefreshFailed:
    "복선 라인은 치웠지만 별빛 연결 목록을 새로 읽지 못했습니다.",
  pointSelectionRequired: "연결할 복선 라인과 정확한 원고 범위를 선택하세요.",
  pointManuscriptReadFailed: "현재 원고를 읽지 못했습니다.",
  pointRangeRequired: "연결할 원고 범위를 선택하세요.",
  pointCaptureFailed:
    "복선 지점을 연결하지 못했습니다. 현재 원고 선택과 라인을 확인하세요.",
});

export function canCreateForeshadowLine(
  actionState: ForeshadowLineActionState,
  activeWorkId: EntityId<"Work"> | null,
): activeWorkId is EntityId<"Work"> {
  return actionState === "idle" && activeWorkId !== null;
}

export function canMutateForeshadowLine(
  actionState: ForeshadowLineActionState,
  activeWorkId: EntityId<"Work"> | null,
  line: ForeshadowLineProjection,
): activeWorkId is EntityId<"Work"> {
  return (
    actionState === "idle" &&
    activeWorkId !== null &&
    line.workId === activeWorkId
  );
}

export function canCaptureForeshadowPoint(
  actionState: ForeshadowLineActionState,
  document: ManuscriptDocumentSource | null,
): document is ManuscriptDocumentSource {
  return actionState === "idle" && document !== null;
}

export function canRunLoreForeshadowLink(
  loreActionState: string,
  foreshadowActionState: ForeshadowLineActionState,
): boolean {
  return loreActionState === "idle" && foreshadowActionState === "idle";
}

export function reconcileSelectedForeshadowLine(
  current: string | null,
  lines: readonly ForeshadowLineProjection[],
): string | null {
  return current !== null && lines.some((line) => line.lineId === current)
    ? current
    : null;
}

export function prependForeshadowLine(
  current: readonly ForeshadowLineProjection[],
  created: ForeshadowLineProjection,
): readonly ForeshadowLineProjection[] {
  return Object.freeze([
    created,
    ...current.filter((line) => line.lineId !== created.lineId),
  ]);
}

export function replaceForeshadowLine(
  current: readonly ForeshadowLineProjection[],
  updated: ForeshadowLineProjection,
): readonly ForeshadowLineProjection[] {
  return Object.freeze(current.map((line) =>
    line.lineId === updated.lineId ? updated : line));
}

export function removeForeshadowLine(
  current: readonly ForeshadowLineProjection[],
  retired: ForeshadowLineProjection,
): readonly ForeshadowLineProjection[] {
  return Object.freeze(current.filter((line) => line.lineId !== retired.lineId));
}

export function removeForeshadowLinePoints(
  current: readonly ForeshadowPointProjection[],
  lineId: EntityId<"ForeshadowLine">,
): readonly ForeshadowPointProjection[] {
  return Object.freeze(current.filter((point) => point.lineId !== lineId));
}

export function appendForeshadowPoint(
  current: readonly ForeshadowPointProjection[],
  created: ForeshadowPointProjection,
): readonly ForeshadowPointProjection[] {
  return Object.freeze([
    ...current.filter((point) => point.pointId !== created.pointId),
    created,
  ]);
}

export function openForeshadowDialogState() {
  return Object.freeze({
    dialogOpen: true,
    error: null,
    selectedLineId: null,
  });
}

export function closeForeshadowDialogState(
  actionState: ForeshadowLineActionState,
) {
  return actionState === "idle"
    ? Object.freeze({ dialogOpen: false, error: null })
    : null;
}

export function focusForeshadowLineState(lineId: string) {
  return Object.freeze({
    dialogOpen: false,
    error: null,
    selectedLineId: lineId,
  });
}

export function foreshadowSharedLinkStartedState(
  actionState: "linking-lore" | "unlinking-lore",
) {
  return Object.freeze({ actionState, error: null });
}

export function foreshadowSharedLinkFailedState(error: string) {
  return Object.freeze({ error });
}

export function foreshadowSharedLinkFinishedState() {
  return Object.freeze({ actionState: "idle" as const });
}

export function foreshadowSourceNavigationRejectedState(error: string) {
  return Object.freeze({ error });
}

export function foreshadowSourceNavigationStartedState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function foreshadowSourceNavigationOpenedState() {
  return Object.freeze({ dialogOpen: false, error: null });
}

export function foreshadowSourceNavigationFailedState(
  error: string,
  reopenDialog: boolean,
) {
  return reopenDialog
    ? Object.freeze({ dialogOpen: true, error })
    : Object.freeze({ error });
}
