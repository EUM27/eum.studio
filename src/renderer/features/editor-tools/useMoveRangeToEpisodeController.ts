import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

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
  workspaceClient: Pick<StudioBridge["workspace"], "createDocument">;
  editorRef: RefObject<ManuscriptEditorHandle | null>;
  durableSaveQueueRef: RefObject<ManuscriptDurableSaveQueue | null>;
  reloadRuntime: (
    preferredDocumentId: EntityId<"Document">,
  ) => Promise<void>;
  refreshSceneProjection: (workId: EntityId<"Work">) => Promise<unknown>;
}>) {
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  const [actionState, setActionState] = useState<"idle" | "moving" | "undoing">(
    "idle",
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<MoveRangeToEpisodeReceipt | null>(null);
  const actionStateRef = useRef(actionState);
  const lastMoveRef = useRef(lastMove);
  useEffect(() => {
    actionStateRef.current = actionState;
  }, [actionState]);
  useEffect(() => {
    lastMoveRef.current = lastMove;
  }, [lastMove]);
  const moveHereToNextEpisode = useCallback(async (): Promise<void> => {
    const current = inputRef.current;
    const source = current.activeDocument;
    const sourceIndex = source === null
      ? -1
      : current.documents.findIndex(
          (document) => document.documentId === source.documentId,
        );
    const target = sourceIndex < 0 ? null : current.documents[sourceIndex + 1] ?? null;
    const editor = current.editorRef.current;
    const queue = current.durableSaveQueueRef.current;
    if (source === null || editor === null || queue === null) {
      setActionError("원고 이동을 준비할 수 없습니다.");
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
    actionStateRef.current = "moving";
    setActionState("moving");
    setActionError(null);
    try {
      await queue.flush(source.documentId);
      const expectedSourceRevisionId = queue.getCurrentRevisionId(source.documentId);
      const targetIdentity = target === null
        ? await current.workspaceClient.createDocument({
            schemaVersion: 1,
            workId: source.workId,
            title: "",
          })
        : null;
      if (target !== null) {
        await queue.flush(target.documentId);
      }
      const targetEpisodeId = target?.documentId ?? targetIdentity?.documentId;
      const expectedTargetRevisionId = target === null
        ? targetIdentity?.revisionId
        : queue.getCurrentRevisionId(target.documentId);
      if (targetEpisodeId === undefined || expectedTargetRevisionId === undefined) {
        throw new Error("다음 회차를 준비하지 못했습니다.");
      }
      const receipt = await current.editorClient.moveRangeToEpisode({
        schemaVersion: 1,
        workId: source.workId,
        sourceEpisodeId: source.documentId,
        targetEpisodeId,
        expectedSourceRevisionId,
        expectedTargetRevisionId,
        from: range.from,
        to: range.to,
        placement: "start",
      });
      await current.refreshSceneProjection(source.workId);
      await current.reloadRuntime(source.documentId);
      lastMoveRef.current = receipt;
      setLastMove(receipt);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "다음 화로 보내지 못했습니다.",
      );
    } finally {
      actionStateRef.current = "idle";
      setActionState("idle");
    }
  }, []);

  const undoLastMove = useCallback(async (): Promise<void> => {
    const current = inputRef.current;
    const move = lastMoveRef.current;
    const queue = current.durableSaveQueueRef.current;
    if (move === null || queue === null) return;
    const source = current.documents.find(
      (document) => document.documentId === move.sourceEpisodeId,
    );
    const target = current.documents.find(
      (document) => document.documentId === move.targetEpisodeId,
    );
    if (source === undefined || target === undefined) {
      setActionError("이동한 두 회차를 찾지 못했습니다.");
      return;
    }
    actionStateRef.current = "undoing";
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
      await current.editorClient.undoMoveRangeToEpisode({
        schemaVersion: 1,
        workId: move.workId,
        moveId: move.moveId,
        expectedSourceRevisionId,
        expectedTargetRevisionId,
      });
      const preferredDocumentId = current.activeDocument?.documentId ??
        move.sourceEpisodeId;
      await current.refreshSceneProjection(move.workId);
      await current.reloadRuntime(preferredDocumentId);
      lastMoveRef.current = null;
      setLastMove(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "회차 이동을 되돌리지 못했습니다.",
      );
    } finally {
      actionStateRef.current = "idle";
      setActionState("idle");
    }
  }, []);

  const requestUndoLastMove = useCallback((): boolean => {
    if (lastMoveRef.current === null || actionStateRef.current !== "idle") {
      return false;
    }
    void undoLastMove();
    return true;
  }, [undoLastMove]);

  return {
    actionError,
    actionState,
    canMoveToNextEpisode: input.activeDocument !== null,
    lastMove,
    moveHereToNextEpisode,
    requestUndoLastMove,
  };
}
