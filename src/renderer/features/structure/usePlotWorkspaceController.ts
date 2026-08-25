import { useCallback, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { EventBlockProjection } from "../../../application/structure/event-block-contract";
import type {
  CreateEventFromPlotSource,
  PlotEventLinkProjection,
  PlotEventLinkRole,
} from "../../../application/plots/plot-event-link-contract";
import type {
  PlotBoardProjection,
  PlotPlacementProjection,
} from "../../../application/plots/plot-board-contract";
import type {
  PlotThreadProjection,
  UpdatePlotThreadCommand,
} from "../../../application/plots/plot-contract";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";
import type {
  PlotDraft,
  PlotManagerActionState,
  PlotPlacementMoveTarget,
  PlotStoryTimeTarget,
} from "../../editor/PlotManagerDialog";
import type { PlotWorkspaceTab } from "../../editor/PlotWorkspace";
import {
  createPlotFromEventTabPort,
  createPlotMutationRefreshPort,
  createPlotMutationSelectionPort,
  createStructureEventManuscriptPort,
  createStructurePlotSourceManuscriptPort,
} from "./structure-client";
import type { useStructureController } from "./useStructureController";

type PlotMutations = ReturnType<
  typeof useStructureController
>["plotMutations"];

export type PlotWorkspaceState = ReturnType<typeof usePlotWorkspaceState>;

export function usePlotWorkspaceState() {
  const [plotWorkspaceInitialTab, setPlotWorkspaceInitialTab] =
    useState<PlotWorkspaceTab>("board");
  const [plotDialogOpen, setPlotDialogOpen] = useState(false);
  const [selectedPlotThreadId, setSelectedPlotThreadId] = useState<
    string | null
  >(null);
  const [plotActionState, setPlotActionState] =
    useState<PlotManagerActionState>("idle");
  const [plotActionError, setPlotActionError] = useState<string | null>(null);

  const resetPlotWorkspace = useCallback(() => {
    setSelectedPlotThreadId(null);
    setPlotActionError(null);
    setPlotDialogOpen(false);
  }, []);
  const installLoadedPlots = useCallback((
    loadedPlots: readonly PlotThreadProjection[],
  ) => {
    setSelectedPlotThreadId((current) =>
      current !== null && loadedPlots.some(
        (plot) => plot.plotThreadId === current,
      )
        ? current
        : (loadedPlots[0]?.plotThreadId ?? null)
    );
    setPlotActionError(null);
  }, []);
  const failPlotWorkspaceLoad = useCallback(() => {
    setPlotActionError("플롯 목록을 불러오지 못했습니다.");
  }, []);
  const selectPlot = useCallback((plotThreadId: string | null) => {
    setSelectedPlotThreadId(plotThreadId);
  }, []);
  const selectPlotWorkspaceInitialTab = useCallback((tab: PlotWorkspaceTab) => {
    setPlotWorkspaceInitialTab(tab);
  }, []);
  const openPlotManagementDialog = useCallback(() => {
    setPlotActionError(null);
    setPlotDialogOpen(true);
  }, []);
  const closePlotManagementDialog = useCallback(() => {
    if (plotActionState !== "idle") return;
    setPlotDialogOpen(false);
    setPlotActionError(null);
  }, [plotActionState]);
  const clearPlotActionError = useCallback(() => {
    setPlotActionError(null);
  }, []);
  const reportPlotActionError = useCallback((message: string) => {
    setPlotActionError(message);
  }, []);
  const preparePlotSourceNavigation = useCallback(() => {
    setPlotActionError(null);
    setPlotDialogOpen(false);
  }, []);
  const reopenPlotManagementDialog = useCallback(() => {
    setPlotDialogOpen(true);
  }, []);
  const showPlotInWorkspace = useCallback((
    plotThreadId: string,
    initialTab?: PlotWorkspaceTab,
  ) => {
    setSelectedPlotThreadId(plotThreadId);
    setPlotActionError(null);
    setPlotDialogOpen(false);
    if (initialTab !== undefined) setPlotWorkspaceInitialTab(initialTab);
  }, []);

  return useMemo(() => ({
    plotWorkspaceInitialTab,
    plotDialogOpen,
    setPlotDialogOpen,
    selectedPlotThreadId,
    setSelectedPlotThreadId,
    plotActionState,
    setPlotActionState,
    plotActionError,
    setPlotActionError,
    resetPlotWorkspace,
    installLoadedPlots,
    failPlotWorkspaceLoad,
    selectPlot,
    selectPlotWorkspaceInitialTab,
    openPlotManagementDialog,
    closePlotManagementDialog,
    clearPlotActionError,
    reportPlotActionError,
    preparePlotSourceNavigation,
    reopenPlotManagementDialog,
    showPlotInWorkspace,
  }), [
    clearPlotActionError,
    closePlotManagementDialog,
    failPlotWorkspaceLoad,
    installLoadedPlots,
    openPlotManagementDialog,
    plotActionError,
    plotActionState,
    plotDialogOpen,
    plotWorkspaceInitialTab,
    preparePlotSourceNavigation,
    reopenPlotManagementDialog,
    reportPlotActionError,
    resetPlotWorkspace,
    selectPlot,
    selectedPlotThreadId,
    selectPlotWorkspaceInitialTab,
    showPlotInWorkspace,
  ]);
}

export function usePlotWorkspaceController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  activeWorkPlots: readonly PlotThreadProjection[];
  editor: Readonly<{
    materializeDocumentText: (
      document: ManuscriptDocumentSource,
    ) => string | undefined;
    readDocumentState: (
      document: ManuscriptDocumentSource,
    ) => ManuscriptDocumentStateSummary | null | undefined;
  }>;
  openPlotsStructureTab: () => void;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  plotBoard: PlotBoardProjection | null;
  plotMutations: PlotMutations;
  refreshEventRailAfterPlotChange: (
    workId: EntityId<"Work">,
  ) => Promise<void>;
  state: PlotWorkspaceState;
}>) {
  const activeSelectedPlotThreadId = input.activeWorkPlots.some(
    (plot) => plot.plotThreadId === input.state.selectedPlotThreadId,
  )
    ? input.state.selectedPlotThreadId
    : null;
  const activeSelectedPlot = activeSelectedPlotThreadId === null
    ? null
    : input.activeWorkPlots.find(
        (plot) => plot.plotThreadId === activeSelectedPlotThreadId,
      ) ?? null;

  const createPlotFromEvent = useCallback(async (
    eventBlock: EventBlockProjection,
  ) => {
    if (
      input.activeWorkId === null ||
      eventBlock.workId !== input.activeWorkId ||
      input.state.plotActionState !== "idle"
    ) return;
    input.state.setPlotActionState("creating-event");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.createFromEvent({
        eventBlock,
        selection: createPlotMutationSelectionPort(input.state.selectPlot),
        tab: createPlotFromEventTabPort(input.openPlotsStructureTab),
      });
    } catch {
      input.state.setPlotActionError("사건에서 플롯을 만들거나 열지 못했습니다.");
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const createEventFromPlot = useCallback(async (
    plot: PlotThreadProjection,
    exactSelection: boolean,
  ) => {
    if (
      input.activeWorkId === null ||
      plot.workId !== input.activeWorkId ||
      input.state.plotActionState !== "idle"
    ) return;
    let source: CreateEventFromPlotSource = { kind: "anchorless" };
    if (exactSelection) {
      if (
        input.activeDocument === null ||
        input.activeDocument.workId !== input.activeWorkId
      ) {
        input.state.setPlotActionError(
          "현재 작품 원고에서 사건 범위를 먼저 선택하세요.",
        );
        return;
      }
      const summary = input.editor.readDocumentState(input.activeDocument);
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      const manuscript = input.editor.materializeDocumentText(
        input.activeDocument,
      );
      if (
        selection === undefined ||
        selection.empty ||
        manuscript === undefined
      ) {
        input.state.setPlotActionError(
          "현재 작품 원고에서 사건 범위를 먼저 선택하세요.",
        );
        return;
      }
      const exactQuote = manuscript.slice(selection.from, selection.to);
      if (exactQuote.length === 0) {
        input.state.setPlotActionError("빈 원고 범위로는 사건을 만들 수 없습니다.");
        return;
      }
      source = {
        kind: "exact-selection",
        documentId: input.activeDocument.documentId,
        selection: { anchor: selection.anchor, head: selection.head },
        exactQuote,
      };
    }
    input.state.setPlotActionState("creating-event");
    input.state.setPlotActionError(null);
    try {
      const refresh = createPlotMutationRefreshPort(
        input.refreshEventRailAfterPlotChange,
      );
      if (source.kind === "exact-selection") {
        await input.plotMutations.createSelectedEvent({
          plot,
          source,
          document: input.activeDocument as ManuscriptDocumentSource,
          manuscript: createStructureEventManuscriptPort(
            input.persistDocument,
          ),
          refresh,
        });
      } else {
        await input.plotMutations.createAnchorlessEvent({ plot, refresh });
      }
    } catch {
      input.state.setPlotActionError("플롯에서 사건을 만들지 못했습니다.");
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const linkPlotEvent = useCallback(async (
    plot: PlotThreadProjection,
    eventBlockId: EventBlockProjection["eventBlockId"],
    role: PlotEventLinkRole,
  ) => {
    if (
      input.activeWorkId === null ||
      plot.workId !== input.activeWorkId ||
      input.state.plotActionState !== "idle"
    ) return;
    input.state.setPlotActionState("linking-event");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.linkEvent({
        plot,
        eventBlockId,
        role,
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
    } catch {
      input.state.setPlotActionError("플롯과 사건을 연결하지 못했습니다.");
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const unlinkPlotEvent = useCallback(async (
    link: PlotEventLinkProjection,
  ) => {
    if (
      input.activeWorkId === null ||
      link.workId !== input.activeWorkId ||
      input.state.plotActionState !== "idle"
    ) return;
    input.state.setPlotActionState("unlinking-event");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.unlinkEvent({
        link,
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
    } catch {
      input.state.setPlotActionError("플롯과 사건의 연결을 해제하지 못했습니다.");
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const createPlotThread = useCallback(async (draft: PlotDraft) => {
    if (
      input.activeWorkId === null ||
      input.state.plotActionState !== "idle"
    ) return;
    input.state.setPlotActionState("creating");
    input.state.setPlotActionError(null);
    try {
      const created = await input.plotMutations.create({
        workId: input.activeWorkId,
        draft,
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
      input.state.selectPlot(created.plotThreadId);
    } catch {
      input.state.setPlotActionError(
        "플롯을 만들지 못했습니다. 제목과 현재 작품을 확인하세요.",
      );
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const updatePlotThread = useCallback(async (
    plot: PlotThreadProjection,
    changes: UpdatePlotThreadCommand["changes"],
  ) => {
    if (
      input.activeWorkId === null ||
      plot.workId !== input.activeWorkId ||
      input.state.plotActionState !== "idle"
    ) return;
    input.state.setPlotActionState("updating");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.update({
        plot,
        changes,
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
    } catch {
      input.state.setPlotActionError(
        "플롯 정보가 달라졌습니다. 다시 열어 확인하세요.",
      );
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const retirePlotThread = useCallback(async (plot: PlotThreadProjection) => {
    if (
      input.activeWorkId === null ||
      plot.workId !== input.activeWorkId ||
      input.state.plotActionState !== "idle"
    ) return;
    input.state.setPlotActionState("retiring");
    input.state.setPlotActionError(null);
    try {
      const { remaining, retired } = await input.plotMutations.retire({
        plot,
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
      input.state.setSelectedPlotThreadId((current) =>
        current === retired.plotThreadId
          ? (remaining[0]?.plotThreadId ?? null)
          : current
      );
    } catch {
      input.state.setPlotActionError("플롯을 목록에서 치우지 못했습니다.");
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const movePlotPlacement = useCallback(async (
    placement: PlotPlacementProjection,
    target: PlotPlacementMoveTarget,
  ) => {
    if (
      input.activeWorkId === null ||
      input.plotBoard === null ||
      placement.workId !== input.activeWorkId ||
      placement.plotBoardId !== input.plotBoard.plotBoardId ||
      input.state.plotActionState !== "idle"
    ) return;
    const placementOnBoard = input.plotBoard.lanes
      .flatMap((candidate) => candidate.placements)
      .find((candidate) =>
        candidate.plotPlacementId === placement.plotPlacementId
      );
    const targetLane = input.plotBoard.lanes.find(
      (candidate) => candidate.plotLaneId === target.targetLaneId,
    );
    if (placementOnBoard === undefined || targetLane === undefined) return;
    input.state.setPlotActionState("moving-placement");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.movePlacement({
        board: input.plotBoard,
        placement,
        target: {
          targetLaneId: targetLane.plotLaneId,
          ...(target.beforePlacementId === undefined
            ? {}
            : { beforePlacementId: target.beforePlacementId }),
          ...(target.afterPlacementId === undefined
            ? {}
            : { afterPlacementId: target.afterPlacementId }),
        },
        selection: createPlotMutationSelectionPort(input.state.selectPlot),
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
    } catch {
      input.state.setPlotActionError(
        "플롯 배치 순서가 달라졌습니다. 다시 열어 확인하세요.",
      );
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const setPlotPlacementStoryTime = useCallback(async (
    placement: PlotPlacementProjection,
    target: PlotStoryTimeTarget,
  ) => {
    if (
      input.activeWorkId === null ||
      input.plotBoard === null ||
      placement.workId !== input.activeWorkId ||
      placement.plotBoardId !== input.plotBoard.plotBoardId ||
      input.state.plotActionState !== "idle"
    ) return;
    const placementOnBoard = input.plotBoard.lanes
      .flatMap((candidate) => candidate.placements)
      .find((candidate) =>
        candidate.plotPlacementId === placement.plotPlacementId
      );
    if (placementOnBoard === undefined) return;
    input.state.setPlotActionState("setting-story-time");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.setStoryTime({
        board: input.plotBoard,
        placement,
        target,
        selection: createPlotMutationSelectionPort(input.state.selectPlot),
        refresh: createPlotMutationRefreshPort(
          input.refreshEventRailAfterPlotChange,
        ),
      });
    } catch {
      input.state.setPlotActionError(
        "플롯 이야기 시간이 달라졌습니다. 다시 열어 확인하세요.",
      );
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  const linkPlotThreadSource = useCallback(async (
    plot: PlotThreadProjection,
  ) => {
    if (
      input.activeDocument === null ||
      plot.workId !== input.activeDocument.workId ||
      input.state.plotActionState !== "idle"
    ) return;
    const summary = input.editor.readDocumentState(input.activeDocument);
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    if (selection === undefined || selection.empty) {
      input.state.setPlotActionError(
        "플롯 출처로 연결할 원고 범위를 먼저 선택하세요.",
      );
      return;
    }
    const manuscript = input.editor.materializeDocumentText(
      input.activeDocument,
    );
    if (manuscript === undefined) {
      input.state.setPlotActionError("현재 원고 선택을 읽지 못했습니다.");
      return;
    }
    const exactText = manuscript.slice(selection.from, selection.to);
    if (exactText.length === 0) {
      input.state.setPlotActionError(
        "플롯 출처로 연결할 원고 범위를 먼저 선택하세요.",
      );
      return;
    }
    input.state.setPlotActionState("linking-source");
    input.state.setPlotActionError(null);
    try {
      await input.plotMutations.linkSource({
        document: input.activeDocument,
        manuscript: createStructurePlotSourceManuscriptPort(
          input.persistDocument,
        ),
        plot,
        source: {
          documentId: input.activeDocument.documentId,
          selection: { anchor: selection.anchor, head: selection.head },
          exactText,
        },
      });
    } catch {
      input.state.setPlotActionError(
        "플롯 출처를 연결하지 못했습니다. 현재 원고 선택과 플롯을 확인하세요.",
      );
    } finally {
      input.state.setPlotActionState("idle");
    }
  }, [input]);

  return {
    activeSelectedPlotThreadId,
    activeSelectedPlot,
    createPlotFromEvent,
    createEventFromPlot,
    linkPlotEvent,
    unlinkPlotEvent,
    createPlotThread,
    updatePlotThread,
    retirePlotThread,
    movePlotPlacement,
    setPlotPlacementStoryTime,
    linkPlotThreadSource,
  };
}
