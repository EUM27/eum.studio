import { useCallback, useMemo, useState, type RefObject } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import {
  resolveHereToEpisodeEndRange,
  type MoveRangeToEpisodeReceipt,
} from "../../../application/editor/move-range-to-episode";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptEditorHandle } from "../../editor/ManuscriptEditor";
import type { ManuscriptDurableSaveQueue } from "../../persistence/manuscript-durable-save-queue";

export function useMoveRangeToEpisodeController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  documents: readonly ManuscriptDocumentSource[];
  editorClient: Pick<
    StudioBridge["editor"],
    "moveRangeToEpisode" | "undoMoveRangeToEpisode"
  >;
  editorRef: RefObject<ManuscriptEditorHandle | null>;
  durableSaveQueueRef: RefObject<ManuscriptDurableSaveQueue | null>;
  reloadRuntime: (
    preferredDocumentId: EntityId<"Document">,
  ) => Promise<void>;
  refreshSceneProjection: (workId: EntityId<"Work">) => Promise<unknown>;
}>) {
  const [actionState, setActionState] = useState<"idle" | "moving" | "undoing">(
    "idle",
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<MoveRangeToEpisodeReceipt | null>(null);
  const nextEpisode = useMemo(() => {
    if (input.activeDocument === null) return null;
    const index = input.documents.findIndex(
      (document) => document.documentId === input.activeDocument?.documentId,
    );
    return index < 0 ? null : input.documents[index + 1] ?? null;
  }, [input.activeDocument, input.documents]);

  const moveHereToNextEpisode = useCallback(async (): Promise<void> => {
    const source = input.activeDocument;
    const target = nextEpisode;
    const editor = input.editorRef.current;
    const queue = input.durableSaveQueueRef.current;
    if (source === null || target === null || editor === null || queue === null) {
      setActionError(target === null ? "다음 회차가 없습니다." : "원고 이동을 준비할 수 없습니다.");
      return;
    }
    const summary = editor.readDocumentState(source);
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    if (selection === undefined) {
      setActionError("현재 원고 위치를 읽지 못했습니다.");
      return;
    }
    const sourceText = editor.materializeDocumentText(source);
    const range = resolveHereToEpisodeEndRange(selection, sourceText.length);
    if (range.from === range.to) {
      setActionError("현재 위치 뒤에 다음 화로 보낼 내용이 없습니다.");
      return;
    }
    setActionState("moving");
    setActionError(null);
    try {
      await queue.flush(source.documentId);
      await queue.flush(target.documentId);
      const expectedSourceRevisionId = queue.getCurrentRevisionId(source.documentId);
      const expectedTargetRevisionId = queue.getCurrentRevisionId(target.documentId);
      if (
        expectedSourceRevisionId === undefined ||
        expectedTargetRevisionId === undefined
      ) {
        throw new Error("두 회차의 저장 revision을 확인하지 못했습니다.");
      }
      const receipt = await input.editorClient.moveRangeToEpisode({
        schemaVersion: 1,
        workId: source.workId,
        sourceEpisodeId: source.documentId,
        targetEpisodeId: target.documentId,
        expectedSourceRevisionId,
        expectedTargetRevisionId,
        from: range.from,
        to: range.to,
        placement: "start",
      });
      await input.reloadRuntime(source.documentId);
      await input.refreshSceneProjection(source.workId);
      setLastMove(receipt);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "다음 화로 보내지 못했습니다.",
      );
    } finally {
      setActionState("idle");
    }
  }, [input, nextEpisode]);

  const undoLastMove = useCallback(async (): Promise<void> => {
    const move = lastMove;
    const queue = input.durableSaveQueueRef.current;
    if (move === null || queue === null) return;
    const source = input.documents.find(
      (document) => document.documentId === move.sourceEpisodeId,
    );
    const target = input.documents.find(
      (document) => document.documentId === move.targetEpisodeId,
    );
    if (source === undefined || target === undefined) {
      setActionError("이동한 두 회차를 찾지 못했습니다.");
      return;
    }
    setActionState("undoing");
    setActionError(null);
    try {
      await queue.flush(source.documentId);
      await queue.flush(target.documentId);
      const expectedSourceRevisionId = queue.getCurrentRevisionId(source.documentId);
      const expectedTargetRevisionId = queue.getCurrentRevisionId(target.documentId);
      if (
        expectedSourceRevisionId === undefined ||
        expectedTargetRevisionId === undefined
      ) {
        throw new Error("두 회차의 저장 revision을 확인하지 못했습니다.");
      }
      await input.editorClient.undoMoveRangeToEpisode({
        schemaVersion: 1,
        workId: move.workId,
        moveId: move.moveId,
        expectedSourceRevisionId,
        expectedTargetRevisionId,
      });
      const preferredDocumentId = input.activeDocument?.documentId ??
        move.sourceEpisodeId;
      await input.reloadRuntime(preferredDocumentId);
      await input.refreshSceneProjection(move.workId);
      setLastMove(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "회차 이동을 되돌리지 못했습니다.",
      );
    } finally {
      setActionState("idle");
    }
  }, [input, lastMove]);

  const requestUndoLastMove = useCallback((): boolean => {
    if (lastMove === null || actionState !== "idle") return false;
    void undoLastMove();
    return true;
  }, [actionState, lastMove, undoLastMove]);

  return {
    actionError,
    actionState,
    hasNextEpisode: nextEpisode !== null,
    lastMove,
    moveHereToNextEpisode,
    requestUndoLastMove,
  };
}
