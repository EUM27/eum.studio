import { useCallback, useMemo, useState } from "react";

import type { EntityId } from "../../../domain/writing";
import type { EventRailMode } from "../../editor/EventRail";
import {
  createWorkspaceRailState,
  openWorkspaceRail,
  setWorkspaceRailLayout,
  toggleWorkspaceRail,
  type WorkspaceRail,
  type WorkspaceRailLayout,
} from "../../workspace-rail-state";

export type ReviewInspectorTab =
  | "current"
  | "assistant"
  | "work"
  | "versions";

export function useWorkspaceLayoutController() {
  const [railState, setRailState] = useState(() =>
    createWorkspaceRailState({
      layout: "wide",
      initialVisibility: { left: "open", right: "closed" },
    })
  );
  const [reviewInspectorTab, setReviewInspectorTab] =
    useState<ReviewInspectorTab>("current");
  const [eventRailMode, setEventRailMode] =
    useState<EventRailMode>("manuscript");
  const [activeManuscriptPosition, setActiveManuscriptPosition] = useState<{
    readonly documentId: EntityId<"Document">;
    readonly offset: number;
  } | null>(null);

  const toggleRail = useCallback((
    workId: EntityId<"Work"> | null,
    rail: WorkspaceRail,
  ) => {
    if (workId === null) return;
    setRailState((current) => toggleWorkspaceRail(current, workId, rail));
  }, []);
  const openRail = useCallback((
    workId: EntityId<"Work">,
    rail: WorkspaceRail,
  ) => {
    setRailState((current) => openWorkspaceRail(current, workId, rail));
  }, []);
  const changeRailLayout = useCallback((layout: WorkspaceRailLayout) => {
    setRailState((current) => setWorkspaceRailLayout(current, layout));
  }, []);
  const selectReviewInspectorTab = useCallback((tab: ReviewInspectorTab) => {
    setReviewInspectorTab(tab);
  }, []);
  const changeEventRailMode = useCallback((mode: EventRailMode) => {
    setEventRailMode(mode);
  }, []);
  const installActiveManuscriptPosition = useCallback((
    documentId: EntityId<"Document">,
    offset: number,
  ) => {
    setActiveManuscriptPosition({ documentId, offset });
  }, []);
  const updateActiveManuscriptPosition = useCallback((
    documentId: EntityId<"Document">,
    offset: number,
  ) => {
    setActiveManuscriptPosition((current) =>
      current?.documentId === documentId && current.offset === offset
        ? current
        : { documentId, offset }
    );
  }, []);

  return useMemo(() => ({
    railState,
    reviewInspectorTab,
    eventRailMode,
    activeManuscriptPosition,
    toggleRail,
    openRail,
    changeRailLayout,
    selectReviewInspectorTab,
    changeEventRailMode,
    installActiveManuscriptPosition,
    updateActiveManuscriptPosition,
  }), [
    activeManuscriptPosition,
    changeEventRailMode,
    changeRailLayout,
    eventRailMode,
    installActiveManuscriptPosition,
    openRail,
    railState,
    reviewInspectorTab,
    selectReviewInspectorTab,
    toggleRail,
    updateActiveManuscriptPosition,
  ]);
}
