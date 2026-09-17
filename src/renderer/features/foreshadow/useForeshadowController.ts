import { useCallback, useEffect, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  ForeshadowLineProjection,
  UpdateForeshadowLineCommand,
} from "../../../application/foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointProjection } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { EntityId } from "../../../domain/writing";
import type { ForeshadowLineActionState } from "../../editor/ForeshadowLineDialog";
import {
  captureForeshadowPointThroughPort,
  createForeshadowLineRecord,
  retireForeshadowLineWithCompatibility,
  startForeshadowWorkLoad,
  updateForeshadowLineRecord,
  type ForeshadowClient,
  type ForeshadowLoreLinkCompatibilityPort,
  type ForeshadowManuscriptPort,
} from "./foreshadow-client";
import {
  appendForeshadowPoint,
  canCaptureForeshadowPoint,
  canCreateForeshadowLine,
  canMutateForeshadowLine,
  closeForeshadowDialogState,
  focusForeshadowLineState,
  FORESHADOW_MESSAGES,
  foreshadowSharedLinkFailedState,
  foreshadowSharedLinkFinishedState,
  foreshadowSharedLinkStartedState,
  foreshadowSourceNavigationFailedState,
  foreshadowSourceNavigationOpenedState,
  foreshadowSourceNavigationRejectedState,
  foreshadowSourceNavigationStartedState,
  openForeshadowDialogState,
  prependForeshadowLine,
  reconcileSelectedForeshadowLine,
  removeForeshadowLine,
  removeForeshadowLinePoints,
  replaceForeshadowLine,
} from "./foreshadow-state";

export function useForeshadowController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  client: ForeshadowClient;
  links: ForeshadowLoreLinkCompatibilityPort;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const [foreshadowLines, setForeshadowLines] = useState<
    readonly ForeshadowLineProjection[]
  >([]);
  const [foreshadowPoints, setForeshadowPoints] = useState<
    readonly ForeshadowPointProjection[]
  >([]);
  const [foreshadowLineDialogOpen, setForeshadowLineDialogOpen] =
    useState(false);
  const [selectedForeshadowLineId, setSelectedForeshadowLineId] = useState<
    string | null
  >(null);
  const [foreshadowLineActionState, setForeshadowLineActionState] =
    useState<ForeshadowLineActionState>("idle");
  const [foreshadowLineActionError, setForeshadowLineActionError] = useState<
    string | null
  >(null);

  useEffect(() => startForeshadowWorkLoad({
    activeWorkId: input.workLoadId,
    client: input.client,
    onReset: () => {
      setForeshadowLines([]);
      setForeshadowPoints([]);
      setSelectedForeshadowLineId(null);
      setForeshadowLineActionError(null);
      setForeshadowLineDialogOpen(false);
    },
    onLoaded: (lines, points) => {
      setForeshadowLines(lines);
      setForeshadowPoints(points);
      setSelectedForeshadowLineId((current) =>
        reconcileSelectedForeshadowLine(current, lines));
      setForeshadowLineActionError(null);
    },
    onFailed: () => {
      setForeshadowLines([]);
      setForeshadowPoints([]);
      setForeshadowLineActionError(FORESHADOW_MESSAGES.loadFailed);
    },
  }), [input.client, input.workLoadId]);

  const createForeshadowLine = useCallback(
    async (title: string, note: string) => {
      const activeWorkId = input.activeWorkId;
      if (!canCreateForeshadowLine(
        foreshadowLineActionState,
        activeWorkId,
      )) {
        return;
      }
      setForeshadowLineActionState("creating");
      setForeshadowLineActionError(null);
      try {
        const created = await createForeshadowLineRecord({
          activeWorkId,
          client: input.client,
          note,
          title,
        });
        setForeshadowLines((current) =>
          prependForeshadowLine(current, created));
      } catch {
        setForeshadowLineActionError(FORESHADOW_MESSAGES.createFailed);
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [foreshadowLineActionState, input.activeWorkId, input.client],
  );

  const updateForeshadowLine = useCallback(
    async (
      line: ForeshadowLineProjection,
      changes: UpdateForeshadowLineCommand["changes"],
    ) => {
      const activeWorkId = input.activeWorkId;
      if (!canMutateForeshadowLine(
        foreshadowLineActionState,
        activeWorkId,
        line,
      )) {
        return;
      }
      setForeshadowLineActionState("updating");
      setForeshadowLineActionError(null);
      try {
        const updated = await updateForeshadowLineRecord({
          activeWorkId,
          changes,
          client: input.client,
          line,
        });
        setForeshadowLines((current) =>
          replaceForeshadowLine(current, updated));
      } catch {
        setForeshadowLineActionError(FORESHADOW_MESSAGES.updateFailed);
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [foreshadowLineActionState, input.activeWorkId, input.client],
  );

  const retireForeshadowLine = useCallback(
    async (line: ForeshadowLineProjection) => {
      const activeWorkId = input.activeWorkId;
      if (!canMutateForeshadowLine(
        foreshadowLineActionState,
        activeWorkId,
        line,
      )) {
        return;
      }
      setForeshadowLineActionState("retiring");
      setForeshadowLineActionError(null);
      try {
        const outcome = await retireForeshadowLineWithCompatibility({
          activeWorkId,
          client: input.client,
          line,
          links: input.links,
          onRetired: (retired) => {
            setForeshadowLines((current) =>
              removeForeshadowLine(current, retired));
            setForeshadowPoints((current) =>
              removeForeshadowLinePoints(current, retired.lineId));
          },
        });
        if (outcome.status === "retired-link-refresh-failed") {
          setForeshadowLineActionError(
            FORESHADOW_MESSAGES.retireLinkRefreshFailed,
          );
        }
      } catch {
        setForeshadowLineActionError(FORESHADOW_MESSAGES.retireFailed);
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [
      foreshadowLineActionState,
      input.activeWorkId,
      input.client,
      input.links,
    ],
  );

  const captureForeshadowPoint = useCallback(
    async (
      lineId: string,
      roleId: string,
      note: string,
      manuscriptPort: ForeshadowManuscriptPort | null,
    ) => {
      const activeDocument = input.activeDocument;
      if (!canCaptureForeshadowPoint(
        foreshadowLineActionState,
        activeDocument,
      )) {
        return;
      }
      const line = foreshadowLines.find(
        (candidate) =>
          candidate.lineId === lineId &&
          candidate.workId === activeDocument.workId,
      );
      if (line === undefined || manuscriptPort === null) {
        setForeshadowLineActionError(
          FORESHADOW_MESSAGES.pointSelectionRequired,
        );
        return;
      }
      const selection = manuscriptPort.readSelection(activeDocument);
      if (selection === undefined || selection.empty) {
        setForeshadowLineActionError(
          FORESHADOW_MESSAGES.pointSelectionRequired,
        );
        return;
      }
      const manuscript = manuscriptPort.materializeDocumentText(activeDocument);
      if (manuscript === undefined) {
        setForeshadowLineActionError(
          FORESHADOW_MESSAGES.pointManuscriptReadFailed,
        );
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setForeshadowLineActionError(FORESHADOW_MESSAGES.pointRangeRequired);
        return;
      }
      setForeshadowLineActionState("capturing");
      setForeshadowLineActionError(null);
      try {
        const created = await captureForeshadowPointThroughPort({
          client: input.client,
          document: activeDocument,
          exactText,
          line,
          manuscript: manuscriptPort,
          note,
          roleId,
          selection,
        });
        setForeshadowPoints((current) =>
          appendForeshadowPoint(current, created));
      } catch {
        setForeshadowLineActionError(FORESHADOW_MESSAGES.pointCaptureFailed);
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [foreshadowLineActionState, foreshadowLines, input.activeDocument, input.client],
  );

  const openForeshadowDialog = useCallback(() => {
    const state = openForeshadowDialogState();
    setSelectedForeshadowLineId(state.selectedLineId);
    setForeshadowLineActionError(state.error);
    setForeshadowLineDialogOpen(state.dialogOpen);
  }, []);

  const closeForeshadowDialog = useCallback(() => {
    const state = closeForeshadowDialogState(foreshadowLineActionState);
    if (state === null) return;
    setForeshadowLineDialogOpen(state.dialogOpen);
    setForeshadowLineActionError(state.error);
  }, [foreshadowLineActionState]);

  const focusForeshadowLineInStructure = useCallback((lineId: string) => {
    const state = focusForeshadowLineState(lineId);
    setSelectedForeshadowLineId(state.selectedLineId);
    setForeshadowLineActionError(state.error);
    setForeshadowLineDialogOpen(state.dialogOpen);
  }, []);

  const startForeshadowSharedLinkAction = useCallback((
    actionState: "linking-lore" | "unlinking-lore",
  ) => {
    const state = foreshadowSharedLinkStartedState(actionState);
    setForeshadowLineActionState(state.actionState);
    setForeshadowLineActionError(state.error);
  }, []);

  const failForeshadowSharedLinkAction = useCallback((error: string) => {
    const state = foreshadowSharedLinkFailedState(error);
    setForeshadowLineActionError(state.error);
  }, []);

  const finishForeshadowSharedLinkAction = useCallback(() => {
    const state = foreshadowSharedLinkFinishedState();
    setForeshadowLineActionState(state.actionState);
  }, []);

  const rejectForeshadowSourceNavigation = useCallback((error: string) => {
    const state = foreshadowSourceNavigationRejectedState(error);
    setForeshadowLineActionError(state.error);
  }, []);

  const startForeshadowSourceNavigation = useCallback(() => {
    const state = foreshadowSourceNavigationStartedState();
    setForeshadowLineActionError(state.error);
    setForeshadowLineDialogOpen(state.dialogOpen);
  }, []);

  const completeForeshadowSourceNavigation = useCallback(() => {
    const state = foreshadowSourceNavigationOpenedState();
    setForeshadowLineActionError(state.error);
    setForeshadowLineDialogOpen(state.dialogOpen);
  }, []);

  const failForeshadowSourceNavigation = useCallback((
    error: string,
    reopenDialog: boolean,
  ) => {
    const state = foreshadowSourceNavigationFailedState(error, reopenDialog);
    setForeshadowLineActionError(state.error);
    if ("dialogOpen" in state) {
      setForeshadowLineDialogOpen(true);
    }
  }, []);

  const sharedLinkAction = useMemo(() => Object.freeze({
    started: startForeshadowSharedLinkAction,
    failed: failForeshadowSharedLinkAction,
    finished: finishForeshadowSharedLinkAction,
  }), [
    failForeshadowSharedLinkAction,
    finishForeshadowSharedLinkAction,
    startForeshadowSharedLinkAction,
  ]);

  const sourceNavigation = useMemo(() => Object.freeze({
    reject: rejectForeshadowSourceNavigation,
    started: startForeshadowSourceNavigation,
    opened: completeForeshadowSourceNavigation,
    failed: failForeshadowSourceNavigation,
  }), [
    completeForeshadowSourceNavigation,
    failForeshadowSourceNavigation,
    rejectForeshadowSourceNavigation,
    startForeshadowSourceNavigation,
  ]);

  return {
    foreshadowLines,
    foreshadowPoints,
    foreshadowLineDialogOpen,
    selectedForeshadowLineId,
    foreshadowLineActionState,
    foreshadowLineActionError,
    createForeshadowLine,
    updateForeshadowLine,
    retireForeshadowLine,
    captureForeshadowPoint,
    openForeshadowDialog,
    closeForeshadowDialog,
    focusForeshadowLineInStructure,
    sharedLinkAction,
    sourceNavigation,
  };
}

export type {
  ForeshadowLoreLinkCompatibilityPort,
  ForeshadowManuscriptPort,
} from "./foreshadow-client";
