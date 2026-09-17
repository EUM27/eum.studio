import { useCallback, useMemo, useRef, useState } from "react";

import {
  DEFAULT_CANON_TAB,
  DEFAULT_REVIEW_TAB,
  DEFAULT_STRUCTURE_TAB,
  DEFAULT_WORK_SECTION,
  type CanonTab,
  type ReviewTab,
  type StructureTab,
  type WorkSection,
} from "../../navigation/studio-location";
import type { SceneExtractionSelection } from "../../editor/SceneExtractionPanel";

type WorkReturnLocation = Readonly<{
  section: "structure" | "canon" | "review";
  tab: StructureTab | CanonTab | ReviewTab;
}>;

export type WorkspaceNavigationState = ReturnType<
  typeof useWorkspaceNavigationState
>;

export function useWorkspaceNavigationState() {
  const [workSection, setWorkSection] = useState<WorkSection>(
    DEFAULT_WORK_SECTION,
  );
  const [structureTab, setStructureTab] = useState<StructureTab>(
    DEFAULT_STRUCTURE_TAB,
  );
  const [canonTab, setCanonTab] = useState<CanonTab>(DEFAULT_CANON_TAB);
  const [reviewTab, setReviewTab] = useState<ReviewTab>(DEFAULT_REVIEW_TAB);
  const [workReturnLocation, setWorkReturnLocation] =
    useState<WorkReturnLocation | null>(null);
  const [recordsNowMs, setRecordsNowMs] = useState(() => Date.now());
  const navigationWorkIdRef = useRef<string | null>(null);

  const workspaceSurface = workSection === "write"
    ? "manuscript"
    : workSection === "structure" && structureTab === "characters"
      ? "characters"
      : workSection === "structure" &&
          (structureTab === "plots" || structureTab === "scenes")
        ? "plots"
        : "planning";

  const beginWorkNavigationReset = useCallback((workId: string | null) => {
    if (navigationWorkIdRef.current === workId) return false;
    navigationWorkIdRef.current = workId;
    return true;
  }, []);
  const resetWorkspaceNavigation = useCallback(() => {
    setWorkSection(DEFAULT_WORK_SECTION);
    setStructureTab(DEFAULT_STRUCTURE_TAB);
    setCanonTab(DEFAULT_CANON_TAB);
    setReviewTab(DEFAULT_REVIEW_TAB);
    setWorkReturnLocation(null);
  }, []);
  const showWorkSection = useCallback((section: WorkSection) => {
    setWorkSection(section);
  }, []);
  const selectStructureTab = useCallback((tab: StructureTab) => {
    setStructureTab(tab);
  }, []);
  const selectCanonTab = useCallback((tab: CanonTab) => {
    setCanonTab(tab);
  }, []);
  const selectReviewTab = useCallback((tab: ReviewTab) => {
    setReviewTab(tab);
  }, []);
  const clearWorkReturnLocation = useCallback(() => {
    setWorkReturnLocation(null);
  }, []);
  const preserveCurrentWorkLocation = useCallback(() => {
    if (workSection === "structure") {
      setWorkReturnLocation({ section: "structure", tab: structureTab });
    } else if (workSection === "canon") {
      setWorkReturnLocation({ section: "canon", tab: canonTab });
    } else if (workSection === "review") {
      setWorkReturnLocation({ section: "review", tab: reviewTab });
    }
  }, [canonTab, reviewTab, structureTab, workSection]);
  const returnToPreviousWorkLocation = useCallback(() => {
    const target = workReturnLocation;
    if (target === null) return;
    setWorkReturnLocation(null);
    if (target.section === "structure") {
      setStructureTab(target.tab as StructureTab);
    } else if (target.section === "canon") {
      setCanonTab(target.tab as CanonTab);
    } else {
      setReviewTab(target.tab as ReviewTab);
    }
    setWorkSection(target.section);
  }, [workReturnLocation]);
  const openRecordsDocument = useCallback(() => {
    setWorkReturnLocation({ section: "review", tab: "records" });
    setWorkSection("write");
  }, []);
  const touchRecordsNow = useCallback(() => {
    setRecordsNowMs(Date.now());
  }, []);

  return useMemo(() => ({
    workSection,
    structureTab,
    canonTab,
    reviewTab,
    workReturnLocation,
    recordsNowMs,
    workspaceSurface,
    beginWorkNavigationReset,
    resetWorkspaceNavigation,
    showWorkSection,
    selectStructureTab,
    selectCanonTab,
    selectReviewTab,
    clearWorkReturnLocation,
    preserveCurrentWorkLocation,
    returnToPreviousWorkLocation,
    openRecordsDocument,
    touchRecordsNow,
  }), [
    beginWorkNavigationReset,
    canonTab,
    clearWorkReturnLocation,
    openRecordsDocument,
    preserveCurrentWorkLocation,
    recordsNowMs,
    resetWorkspaceNavigation,
    returnToPreviousWorkLocation,
    reviewTab,
    selectReviewTab,
    selectCanonTab,
    selectStructureTab,
    showWorkSection,
    structureTab,
    touchRecordsNow,
    workReturnLocation,
    workSection,
    workspaceSurface,
  ]);
}

export function useWorkspaceNavigationController(input: Readonly<{
  captureCandidateSelection: () => Promise<SceneExtractionSelection | null>;
  exitManuscriptFocus: () => void;
  navigation: WorkspaceNavigationState;
  openCharacterWorkspace: () => Promise<unknown>;
  openPlotWorkspace: (
    initialTab: "board" | "scenes",
  ) => Promise<SceneExtractionSelection | null>;
  refreshCandidates: () => void;
  refreshCanonCandidates: () => void;
  refreshContinuity: () => void;
  refreshCharacterKnowledge: () => void;
  refreshContextPlanner: () => void;
  refreshNarrativeDigests: () => void;
  selectCandidateSceneExtraction: (
    selection: SceneExtractionSelection | null,
  ) => void;
  versionActionState: string;
}>) {
  const openCandidateReview = useCallback(() => {
    input.refreshCandidates();
    void input.captureCandidateSelection().then((selection) => {
      input.selectCandidateSceneExtraction(selection);
    });
  }, [input]);

  const changeWorkSection = useCallback((section: WorkSection) => {
    if (input.versionActionState !== "idle") return;
    if (section !== "write") input.exitManuscriptFocus();
    input.navigation.clearWorkReturnLocation();
    input.navigation.showWorkSection(section);
    if (section === "review" && input.navigation.reviewTab === "records") {
      input.navigation.touchRecordsNow();
    } else if (
      section === "review" &&
      input.navigation.reviewTab === "candidates"
    ) {
      openCandidateReview();
    }
    if (section === "canon") {
      input.refreshCanonCandidates();
      if (input.navigation.canonTab === "continuity") input.refreshContinuity();
      if (input.navigation.canonTab === "knowledge") input.refreshCharacterKnowledge();
      if (input.navigation.canonTab === "context") input.refreshContextPlanner();
    }
  }, [input, openCandidateReview]);

  const openCharacterWorkspace = useCallback(async () => {
    const result = await input.openCharacterWorkspace();
    input.navigation.selectStructureTab("characters");
    input.navigation.showWorkSection("structure");
    return result;
  }, [input]);

  const openPlotWorkspace = useCallback(async (
    initialTab: "board" | "scenes" = "board",
  ) => {
    const result = await input.openPlotWorkspace(initialTab);
    input.navigation.selectStructureTab(
      initialTab === "scenes" ? "scenes" : "plots",
    );
    input.navigation.showWorkSection("structure");
    return result;
  }, [input]);

  const changeStructureTab = useCallback((tab: StructureTab) => {
    input.exitManuscriptFocus();
    input.navigation.clearWorkReturnLocation();
    if (tab === "characters") {
      void openCharacterWorkspace();
      return;
    }
    if (tab === "plots" || tab === "scenes") {
      void openPlotWorkspace(tab === "scenes" ? "scenes" : "board");
      return;
    }
    input.navigation.selectStructureTab(tab);
    input.navigation.showWorkSection("structure");
  }, [input, openCharacterWorkspace, openPlotWorkspace]);

  const changeReviewTab = useCallback((tab: ReviewTab) => {
    input.navigation.selectReviewTab(tab);
    input.navigation.clearWorkReturnLocation();
    if (tab === "records") input.navigation.touchRecordsNow();
    if (tab === "candidates") openCandidateReview();
  }, [input.navigation, openCandidateReview]);

  const changeCanonTab = useCallback((tab: CanonTab) => {
    input.navigation.selectCanonTab(tab);
    input.navigation.clearWorkReturnLocation();
    if (tab === "review") input.refreshCanonCandidates();
    if (tab === "continuity") input.refreshContinuity();
    if (tab === "knowledge") input.refreshCharacterKnowledge();
    if (tab === "digest") input.refreshNarrativeDigests();
    if (tab === "context") input.refreshContextPlanner();
  }, [input]);

  return {
    changeWorkSection,
    changeStructureTab,
    changeCanonTab,
    changeReviewTab,
    openCharacterWorkspace,
    openPlotWorkspace,
  };
}
