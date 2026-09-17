import { useCallback, useEffect, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  FragmentProjection,
  UpdateFragmentCommand,
} from "../../../application/fragments/fragment-contract";
import type { EntityId } from "../../../domain/writing";
import type { FragmentShelfActionState } from "../../editor/FragmentShelfDialog";
import {
  insertFragmentAtCursor as insertFragmentThroughPort,
  moveSelectionToFragment as moveSelectionThroughPort,
  persistAndCaptureFragment,
  retireFragmentRecord,
  startFragmentsWorkLoad,
  updateFragmentRecord,
  type FragmentsClient,
  type FragmentsManuscriptPort,
} from "./fragments-client";
import {
  canInsertFragment,
  canMutateFragment,
  canRunFragmentDocumentAction,
  closeFragmentShelfState,
  fragmentSourceNavigationCompletedState,
  fragmentSourceNavigationFailedState,
  fragmentSourceNavigationReopenedState,
  fragmentSourceNavigationStartedState,
  FRAGMENT_MESSAGES,
  openFragmentShelfState,
  prependFragment,
  removeFragment,
  replaceFragment,
  resolveFragmentMoveState,
} from "./fragments-state";

export function useFragmentsController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  client: FragmentsClient;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const [fragments, setFragments] = useState<
    readonly FragmentProjection[]
  >([]);
  const [fragmentDialogOpen, setFragmentDialogOpen] = useState(false);
  const [fragmentActionState, setFragmentActionState] =
    useState<FragmentShelfActionState>("idle");
  const [fragmentActionError, setFragmentActionError] = useState<
    string | null
  >(null);

  useEffect(() => startFragmentsWorkLoad({
    activeWorkId: input.workLoadId,
    client: input.client,
    onReset: () => {
      setFragments([]);
      setFragmentActionError(null);
      setFragmentDialogOpen(false);
    },
    onLoaded: (loaded) => {
      setFragments(loaded);
      setFragmentActionError(null);
    },
    onFailed: () => {
      setFragments([]);
      setFragmentActionError(FRAGMENT_MESSAGES.loadFailed);
    },
  }), [input.client, input.workLoadId]);

  const captureFragment = useCallback(
    async (
      kindId: string,
      manuscriptPort: FragmentsManuscriptPort | null,
    ) => {
      if (!canRunFragmentDocumentAction(
        fragmentActionState,
        input.activeDocument,
      )) {
        return;
      }
      if (manuscriptPort === null) {
        setFragmentActionError(FRAGMENT_MESSAGES.captureSelectionRequired);
        return;
      }
      const selection = manuscriptPort.readSelection(input.activeDocument);
      if (selection === undefined || selection.empty) {
        setFragmentActionError(FRAGMENT_MESSAGES.captureSelectionRequired);
        return;
      }
      const manuscript = manuscriptPort.materializeDocumentText(
        input.activeDocument,
      );
      if (manuscript === undefined) {
        setFragmentActionError(FRAGMENT_MESSAGES.captureManuscriptUnavailable);
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setFragmentActionError(FRAGMENT_MESSAGES.captureSelectionRequired);
        return;
      }
      setFragmentActionState("capturing");
      setFragmentActionError(null);
      try {
        const created = await persistAndCaptureFragment({
          client: input.client,
          document: input.activeDocument,
          exactText,
          kindId,
          manuscript: manuscriptPort,
          selection,
        });
        setFragments((current) => prependFragment(current, created));
      } catch {
        setFragmentActionError(FRAGMENT_MESSAGES.captureFailed);
      } finally {
        setFragmentActionState("idle");
      }
    },
    [fragmentActionState, input.activeDocument, input.client],
  );

  const moveSelectionToFragment = useCallback(
    async (
      kindId: string,
      manuscriptPort: FragmentsManuscriptPort | null,
    ) => {
      if (!canRunFragmentDocumentAction(
        fragmentActionState,
        input.activeDocument,
      )) {
        return;
      }
      if (manuscriptPort === null) {
        setFragmentActionError(FRAGMENT_MESSAGES.moveSelectionRequired);
        return;
      }
      const selection = manuscriptPort.readSelection(input.activeDocument);
      const manuscript = manuscriptPort.materializeDocumentText(
        input.activeDocument,
      );
      if (
        selection === undefined ||
        selection.empty ||
        manuscript === undefined
      ) {
        setFragmentActionError(FRAGMENT_MESSAGES.moveSelectionRequired);
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setFragmentActionError(FRAGMENT_MESSAGES.moveSelectionRequired);
        return;
      }
      setFragmentActionState("moving");
      setFragmentActionError(null);
      try {
        const outcome = await moveSelectionThroughPort({
          client: input.client,
          document: input.activeDocument,
          exactText,
          kindId,
          manuscript: manuscriptPort,
          selection,
        });
        setFragments((current) =>
          resolveFragmentMoveState(current, outcome).fragments,
        );
        setFragmentActionError(
          resolveFragmentMoveState([], outcome).error,
        );
      } finally {
        setFragmentActionState("idle");
      }
    },
    [fragmentActionState, input.activeDocument, input.client],
  );

  const insertFragmentAtCursor = useCallback(
    async (
      fragment: FragmentProjection,
      manuscriptPort: FragmentsManuscriptPort | null,
    ) => {
      if (!canInsertFragment(
        fragmentActionState,
        input.activeDocument,
        fragment,
      )) {
        return;
      }
      if (manuscriptPort === null) {
        setFragmentActionError(FRAGMENT_MESSAGES.insertCursorRequired);
        return;
      }
      const selection = manuscriptPort.readSelection(input.activeDocument);
      if (selection === undefined || !selection.empty) {
        setFragmentActionError(FRAGMENT_MESSAGES.insertCursorRequired);
        return;
      }
      setFragmentActionState("inserting");
      setFragmentActionError(null);
      try {
        const outcome = await insertFragmentThroughPort({
          client: input.client,
          document: input.activeDocument,
          fragment,
          manuscript: manuscriptPort,
          selection,
        });
        switch (outcome.status) {
          case "inserted":
            setFragments((current) => replaceFragment(current, outcome.used));
            setFragmentDialogOpen(false);
            break;
          case "cursor-changed":
            setFragmentActionError(FRAGMENT_MESSAGES.insertCursorChanged);
            break;
          case "persist-or-record-use-failed":
            setFragmentActionError(FRAGMENT_MESSAGES.insertPersistFailed);
            break;
        }
      } finally {
        setFragmentActionState("idle");
      }
    },
    [fragmentActionState, input.activeDocument, input.client],
  );

  const updateFragment = useCallback(
    async (
      fragment: FragmentProjection,
      changes: UpdateFragmentCommand["changes"],
    ) => {
      if (!canMutateFragment(
        fragmentActionState,
        input.activeWorkId,
        fragment,
      )) {
        return;
      }
      setFragmentActionState("updating");
      setFragmentActionError(null);
      try {
        const updated = await updateFragmentRecord({
          activeWorkId: input.activeWorkId,
          changes,
          client: input.client,
          fragment,
        });
        setFragments((current) => replaceFragment(current, updated));
      } catch {
        setFragmentActionError(FRAGMENT_MESSAGES.updateFailed);
      } finally {
        setFragmentActionState("idle");
      }
    },
    [fragmentActionState, input.activeWorkId, input.client],
  );

  const retireFragment = useCallback(
    async (fragment: FragmentProjection) => {
      if (!canMutateFragment(
        fragmentActionState,
        input.activeWorkId,
        fragment,
      )) {
        return;
      }
      setFragmentActionState("retiring");
      setFragmentActionError(null);
      try {
        const retired = await retireFragmentRecord({
          activeWorkId: input.activeWorkId,
          client: input.client,
          fragment,
        });
        setFragments((current) => removeFragment(current, retired));
      } catch {
        setFragmentActionError(FRAGMENT_MESSAGES.retireFailed);
      } finally {
        setFragmentActionState("idle");
      }
    },
    [fragmentActionState, input.activeWorkId, input.client],
  );

  const openFragmentShelf = useCallback(() => {
    const state = openFragmentShelfState();
    setFragmentActionError(state.error);
    setFragmentDialogOpen(state.dialogOpen);
  }, []);

  const closeFragmentShelf = useCallback(() => {
    const state = closeFragmentShelfState(fragmentActionState);
    if (state === null) return;
    setFragmentDialogOpen(state.dialogOpen);
    setFragmentActionError(state.error);
  }, [fragmentActionState]);

  const startFragmentSourceNavigation = useCallback(() => {
    const state = fragmentSourceNavigationStartedState();
    setFragmentActionError(state.error);
    setFragmentDialogOpen(state.dialogOpen);
  }, []);

  const completeFragmentSourceNavigation = useCallback(() => {
    const state = fragmentSourceNavigationCompletedState();
    setFragmentActionError(state.error);
    setFragmentDialogOpen(state.dialogOpen);
  }, []);

  const failFragmentSourceNavigation = useCallback((
    error: string,
    reopen: boolean,
  ) => {
    const state = fragmentSourceNavigationFailedState(error, reopen);
    setFragmentActionError(state.error);
    if ("dialogOpen" in state) {
      setFragmentDialogOpen(true);
    }
  }, []);

  const reopenFragmentShelfAfterSourceNavigationFailure = useCallback(() => {
    const state = fragmentSourceNavigationReopenedState();
    setFragmentDialogOpen(state.dialogOpen);
  }, []);

  return {
    fragments,
    fragmentDialogOpen,
    fragmentActionState,
    fragmentActionError,
    captureFragment,
    moveSelectionToFragment,
    insertFragmentAtCursor,
    updateFragment,
    retireFragment,
    openFragmentShelf,
    closeFragmentShelf,
    startFragmentSourceNavigation,
    completeFragmentSourceNavigation,
    failFragmentSourceNavigation,
    reopenFragmentShelfAfterSourceNavigationFailure,
  };
}

export type { FragmentsManuscriptPort } from "./fragments-client";
