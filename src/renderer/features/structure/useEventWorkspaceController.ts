import { useCallback, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  EventBlockProjection,
  EventSourceProjection,
} from "../../../application/structure/event-block-contract";
import type { EntityId } from "../../../domain/writing";
import type { PendingEventDraft } from "../../workspace/dialogs/EventBlockDialog";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";
import {
  createStructureEventManuscriptPort,
  type StructureEventMoveTarget,
} from "./structure-client";
import type { useStructureController } from "./useStructureController";

type EventMutations = ReturnType<
  typeof useStructureController
>["eventMutations"];

export type EventWorkspaceState = ReturnType<typeof useEventWorkspaceState>;

export function useEventWorkspaceState() {
  const [pendingEventDraft, setPendingEventDraft] =
    useState<PendingEventDraft | null>(null);
  const [eventActionState, setEventActionState] = useState<
    | "idle"
    | "creating"
    | "linking"
    | "moving"
    | "replacing"
    | "retiring"
    | "opening"
  >("idle");
  const [eventActionError, setEventActionError] = useState<string | null>(null);

  const clearEventActionError = useCallback(() => {
    setEventActionError(null);
  }, []);
  const reportEventActionError = useCallback((message: string) => {
    setEventActionError(message);
  }, []);
  const startEventOpening = useCallback(() => {
    setEventActionState("opening");
    setEventActionError(null);
  }, []);
  const finishEventOpening = useCallback(() => {
    setEventActionState("idle");
  }, []);
  const closeEventDialog = useCallback(() => {
    if (eventActionState !== "idle") return;
    setPendingEventDraft(null);
    setEventActionError(null);
  }, [eventActionState]);

  return useMemo(() => ({
    pendingEventDraft,
    setPendingEventDraft,
    eventActionState,
    setEventActionState,
    eventActionError,
    clearEventActionError,
    reportEventActionError,
    startEventOpening,
    finishEventOpening,
    closeEventDialog,
  }), [
    clearEventActionError,
    closeEventDialog,
    eventActionError,
    eventActionState,
    finishEventOpening,
    pendingEventDraft,
    reportEventActionError,
    startEventOpening,
  ]);
}

export function useEventWorkspaceController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  editor: Readonly<{
    readDocumentState: (
      document: ManuscriptDocumentSource,
    ) => ManuscriptDocumentStateSummary | null | undefined;
    materializeDocumentText: (
      document: ManuscriptDocumentSource,
    ) => string | undefined;
  }>;
  eventMutations: EventMutations;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  refreshEventProjection: (workId: EntityId<"Work">) => Promise<unknown>;
  state: EventWorkspaceState;
}>) {
  const readCurrentEventSourceSelection = useCallback(() => {
    if (input.activeDocument === null) return null;
    const summary = input.editor.readDocumentState(input.activeDocument);
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    if (selection === undefined || selection.empty) {
      input.state.reportEventActionError(
        "원고에서 사건 범위를 먼저 선택하세요.",
      );
      return null;
    }
    const manuscript = input.editor.materializeDocumentText(
      input.activeDocument,
    );
    if (manuscript === undefined) {
      input.state.reportEventActionError("현재 원고 범위를 읽지 못했습니다.");
      return null;
    }
    const exactQuote = manuscript.slice(selection.from, selection.to);
    if (exactQuote.length === 0) {
      input.state.reportEventActionError(
        "빈 선택 범위는 사건으로 등록할 수 없습니다.",
      );
      return null;
    }
    input.state.clearEventActionError();
    return Object.freeze({
      workId: input.activeDocument.workId,
      documentId: input.activeDocument.documentId,
      selection: { anchor: selection.anchor, head: selection.head },
      exactQuote,
    });
  }, [input.activeDocument, input.editor, input.state]);

  const openEventBlockDialog = useCallback(() => {
    const selection = readCurrentEventSourceSelection();
    if (selection !== null) {
      input.state.setPendingEventDraft({ kind: "selection", ...selection });
    }
  }, [input.state, readCurrentEventSourceSelection]);
  const openAnchorlessEventDialog = useCallback(() => {
    if (input.activeWorkId === null) return;
    input.state.clearEventActionError();
    input.state.setPendingEventDraft({
      kind: "anchorless",
      workId: input.activeWorkId,
    });
  }, [input.activeWorkId, input.state]);
  const openContextEventDialog = useCallback(() => {
    if (input.activeDocument === null) return;
    const summary = input.editor.readDocumentState(input.activeDocument);
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    if (selection !== undefined && !selection.empty) {
      openEventBlockDialog();
    } else {
      openAnchorlessEventDialog();
    }
  }, [
    input.activeDocument,
    input.editor,
    openAnchorlessEventDialog,
    openEventBlockDialog,
  ]);

  const refreshEventRailAfterPlotChange = useCallback(async (
    workId: EntityId<"Work">,
  ) => {
    try {
      await input.refreshEventProjection(workId);
      input.state.clearEventActionError();
    } catch {
      input.state.reportEventActionError(
        "작품 사건 순서를 새로고침하지 못했습니다.",
      );
    }
  }, [input]);

  const moveEventBlock = useCallback(async (
    eventBlock: EventBlockProjection,
    target: StructureEventMoveTarget,
  ) => {
    if (
      input.activeWorkId === null ||
      eventBlock.workId !== input.activeWorkId ||
      input.state.eventActionState !== "idle"
    ) return;
    input.state.setEventActionState("moving");
    input.state.clearEventActionError();
    try {
      await input.eventMutations.move({ eventBlock, target });
    } catch {
      input.state.reportEventActionError("사건 순서를 이동하지 못했습니다.");
    } finally {
      input.state.setEventActionState("idle");
    }
  }, [input]);

  const createEventBlock = useCallback(async (
    draft: Readonly<{ title: string; note: string }>,
  ) => {
    const pending = input.state.pendingEventDraft;
    if (pending === null || input.state.eventActionState !== "idle") return;
    input.state.setEventActionState("creating");
    input.state.clearEventActionError();
    try {
      if (pending.kind === "selection") {
        if (
          input.activeDocument === null ||
          input.activeDocument.documentId !== pending.documentId
        ) throw new Error("The selected manuscript is no longer active");
        await input.eventMutations.createSelected({
          workId: pending.workId,
          document: input.activeDocument,
          source: {
            documentId: pending.documentId,
            selection: pending.selection,
            exactQuote: pending.exactQuote,
          },
          title: draft.title,
          note: draft.note,
          manuscript: createStructureEventManuscriptPort(
            input.persistDocument,
          ),
        });
      } else {
        await input.eventMutations.createAnchorless({
          workId: pending.workId,
          title: draft.title,
          note: draft.note,
        });
      }
      input.state.setPendingEventDraft(null);
    } catch {
      input.state.reportEventActionError(
        pending.kind === "selection"
          ? "선택 범위를 사건으로 등록하지 못했습니다."
          : "예정 사건을 추가하지 못했습니다.",
      );
    } finally {
      input.state.setEventActionState("idle");
    }
  }, [input]);

  const linkEventSource = useCallback(async (
    eventBlock: EventBlockProjection,
  ) => {
    if (
      input.activeDocument === null ||
      input.activeWorkId === null ||
      eventBlock.workId !== input.activeWorkId ||
      input.state.eventActionState !== "idle"
    ) return;
    const source = readCurrentEventSourceSelection();
    if (source === null) return;
    input.state.setEventActionState("linking");
    try {
      await input.eventMutations.linkSource({
        eventBlock,
        source,
        document: input.activeDocument,
        manuscript: createStructureEventManuscriptPort(input.persistDocument),
      });
    } catch {
      input.state.reportEventActionError(
        "현재 선택을 사건의 원고 출처로 연결하지 못했습니다.",
      );
    } finally {
      input.state.setEventActionState("idle");
    }
  }, [input, readCurrentEventSourceSelection]);

  const replaceEventSource = useCallback(async (
    eventSource: EventSourceProjection,
  ) => {
    if (
      input.activeDocument === null ||
      input.activeWorkId === null ||
      eventSource.workId !== input.activeWorkId ||
      input.state.eventActionState !== "idle"
    ) return;
    const source = readCurrentEventSourceSelection();
    if (source === null) return;
    input.state.setEventActionState("replacing");
    try {
      await input.eventMutations.replaceSource({
        eventSource,
        source,
        document: input.activeDocument,
        manuscript: createStructureEventManuscriptPort(input.persistDocument),
      });
    } catch {
      input.state.reportEventActionError(
        "사건의 원고 출처를 현재 선택으로 교체하지 못했습니다.",
      );
    } finally {
      input.state.setEventActionState("idle");
    }
  }, [input, readCurrentEventSourceSelection]);

  const retireEventSource = useCallback(async (
    eventSource: EventSourceProjection,
  ) => {
    if (
      input.activeWorkId === null ||
      eventSource.workId !== input.activeWorkId ||
      input.state.eventActionState !== "idle"
    ) return;
    input.state.setEventActionState("retiring");
    input.state.clearEventActionError();
    try {
      await input.eventMutations.retireSource({ eventSource });
    } catch {
      input.state.reportEventActionError(
        "사건의 원고 출처를 해제하지 못했습니다.",
      );
    } finally {
      input.state.setEventActionState("idle");
    }
  }, [input]);

  return {
    readCurrentEventSourceSelection,
    openEventBlockDialog,
    openAnchorlessEventDialog,
    openContextEventDialog,
    refreshEventRailAfterPlotChange,
    moveEventBlock,
    createEventBlock,
    linkEventSource,
    replaceEventSource,
    retireEventSource,
  };
}
