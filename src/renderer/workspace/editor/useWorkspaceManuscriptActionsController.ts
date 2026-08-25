import { useCallback, type RefObject } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { FragmentProjection } from "../../../application/fragments/fragment-contract";
import type { LoreEntryProjection } from "../../../application/lore/lore-entry-contract";
import type { ManuscriptEditorHandle } from "../../editor/ManuscriptEditor";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import type { ManuscriptTextStatistics } from "../../editor/manuscript-text-statistics";
import type { ManuscriptTransaction } from "../../editor/manuscript-transaction";
import { createCharactersManuscriptPort } from "../../features/characters/characters-client";
import type { useCharactersController } from "../../features/characters/useCharactersController";
import type { useActivityController } from "../../features/activity/useActivityController";
import type { useEditorToolsController } from "../../features/editor-tools/useEditorToolsController";
import type { useManuscriptSearchController } from "../../features/editor-tools/useManuscriptSearchController";
import { createFragmentsManuscriptPort } from "../../features/fragments/fragments-client";
import type { useFragmentsController } from "../../features/fragments/useFragmentsController";
import {
  createLoreManuscriptPort,
  type LoreCandidateDraftInput,
  type LoreEntryDraftInput,
} from "../../features/lore/lore-client";
import type { useLoreController } from "../../features/lore/useLoreController";
import type { useLoreCueState } from "../../features/lore/useLoreCueController";
import type { useSceneWorkspaceState } from "../../features/structure/useSceneWorkspaceController";
import type { useWorkspaceLayoutController } from "../layout/useWorkspaceLayoutController";
import type { usePersistenceCoordinator } from "../session/usePersistenceCoordinator";

export function useWorkspaceManuscriptActionsController(input: Readonly<{
  controllers: Readonly<{
    activity: ReturnType<typeof useActivityController>;
    characters: ReturnType<typeof useCharactersController>;
    editorTools: ReturnType<typeof useEditorToolsController>;
    fragments: ReturnType<typeof useFragmentsController>;
    lore: ReturnType<typeof useLoreController>;
    loreCueState: ReturnType<typeof useLoreCueState>;
    manuscriptSearch: ReturnType<typeof useManuscriptSearchController>;
    sceneState: ReturnType<typeof useSceneWorkspaceState>;
    workspaceLayout: ReturnType<typeof useWorkspaceLayoutController>;
  }>;
  manuscriptEditorRef: RefObject<ManuscriptEditorHandle | null>;
  persistence: Pick<
    ReturnType<typeof usePersistenceCoordinator>,
    "durableSaveQueueRef"
  >;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  telemetryStore: ManuscriptTelemetryStore;
}>) {
  const {
    manuscriptEditorRef,
    persistDocument,
    telemetryStore,
  } = input;
  const {
    handleDocumentEdited,
    resumePausedPomodoroOnInput,
  } = input.controllers.activity;
  const {
    captureWorkspaceSelection: captureCharacterWorkspaceSelectionAction,
  } = input.controllers.characters;
  const {
    recordForwardWritingStatistics,
  } = input.controllers.editorTools;
  const {
    captureFragment: captureFragmentAction,
    insertFragmentAtCursor: insertFragmentAtCursorAction,
    moveSelectionToFragment: moveSelectionToFragmentAction,
  } = input.controllers.fragments;
  const {
    addLoreEntryEvidence: addLoreEntryEvidenceAction,
    createLoreCandidate: createLoreCandidateAction,
    createLoreEntry: createLoreEntryAction,
  } = input.controllers.lore;
  const {
    resetLoreCue,
  } = input.controllers.loreCueState;
  const {
    invalidateSearchResult,
  } = input.controllers.manuscriptSearch;
  const {
    clearSceneContextForDocumentEdit,
  } = input.controllers.sceneState;
  const {
    updateActiveManuscriptPosition,
  } = input.controllers.workspaceLayout;
  const {
    durableSaveQueueRef,
  } = input.persistence;

  const createCurrentCharactersManuscriptPort = useCallback(() => {
      const editor = manuscriptEditorRef.current;
      return editor === null
        ? null
        : createCharactersManuscriptPort(
            {
              readSelection: (document) => {
                const summary = editor.readDocumentState(document);
                const range =
                  summary?.selection.ranges[summary.selection.mainIndex];
                return range === undefined
                  ? undefined
                  : Object.freeze({
                      from: range.from,
                      to: range.to,
                      empty: range.empty,
                    });
              },
              currentRevisionId: (document) =>
                durableSaveQueueRef.current?.getCurrentRevisionId(
                  document.documentId,
                ) ?? document.documentRevisionId,
            },
            persistDocument,
          );
    }, [durableSaveQueueRef, manuscriptEditorRef, persistDocument]);
  
  const captureCharacterWorkspaceSelection = useCallback(
      () => captureCharacterWorkspaceSelectionAction(
        createCurrentCharactersManuscriptPort(),
      ),
      [
        captureCharacterWorkspaceSelectionAction,
        createCurrentCharactersManuscriptPort,
      ],
    );
  
  const createCurrentLoreManuscriptPort = useCallback(() => {
      const editor = manuscriptEditorRef.current;
      return editor === null
        ? null
        : createLoreManuscriptPort(
            {
              readSelection: (document) => {
                const summary = editor.readDocumentState(document);
                const selection =
                  summary?.selection.ranges[summary.selection.mainIndex];
                return selection === undefined
                  ? undefined
                  : Object.freeze({
                      anchor: selection.anchor,
                      head: selection.head,
                      from: selection.from,
                      to: selection.to,
                      empty: selection.empty,
                    });
              },
              materializeDocumentText: (document) =>
                editor.materializeDocumentText(document),
            },
            persistDocument,
          );
    }, [manuscriptEditorRef, persistDocument]);
  
  const createLoreEntry = useCallback((draft: LoreEntryDraftInput) =>
      createLoreEntryAction(draft, createCurrentLoreManuscriptPort()), [
      createCurrentLoreManuscriptPort,
      createLoreEntryAction,
    ]);
  
  const addLoreEntryEvidence = useCallback((entry: LoreEntryProjection) =>
      addLoreEntryEvidenceAction(entry, createCurrentLoreManuscriptPort()), [
      addLoreEntryEvidenceAction,
      createCurrentLoreManuscriptPort,
    ]);
  
  const createLoreCandidate = useCallback((draft: LoreCandidateDraftInput) =>
      createLoreCandidateAction(draft, createCurrentLoreManuscriptPort()), [
      createCurrentLoreManuscriptPort,
      createLoreCandidateAction,
    ]);
  
  const captureFragment = useCallback(
      (kindId: string) => {
        const editor = manuscriptEditorRef.current;
        const manuscriptPort = editor === null
          ? null
          : createFragmentsManuscriptPort(
              {
                readSelection: (document) => {
                  const summary = editor.readDocumentState(document);
                  const selection =
                    summary?.selection.ranges[summary.selection.mainIndex];
                  return selection === undefined
                    ? undefined
                    : Object.freeze({
                        anchor: selection.anchor,
                        head: selection.head,
                        from: selection.from,
                        to: selection.to,
                        empty: selection.empty,
                      });
                },
                materializeDocumentText: (document) =>
                  editor.materializeDocumentText(document),
                deleteExactDocumentRange: (document, range, exactText) =>
                  editor.deleteExactDocumentRange(document, range, exactText),
                insertFragmentAtCursor: (document, offset, exactText) =>
                  editor.insertFragmentAtCursor(document, offset, exactText),
              },
              persistDocument,
            );
        return captureFragmentAction(kindId, manuscriptPort);
      },
      [captureFragmentAction, manuscriptEditorRef, persistDocument],
    );
  
  const moveSelectionToFragment = useCallback(
      (kindId: string) => {
        const editor = manuscriptEditorRef.current;
        const manuscriptPort = editor === null
          ? null
          : createFragmentsManuscriptPort(
              {
                readSelection: (document) => {
                  const summary = editor.readDocumentState(document);
                  const selection =
                    summary?.selection.ranges[summary.selection.mainIndex];
                  return selection === undefined
                    ? undefined
                    : Object.freeze({
                        anchor: selection.anchor,
                        head: selection.head,
                        from: selection.from,
                        to: selection.to,
                        empty: selection.empty,
                      });
                },
                materializeDocumentText: (document) =>
                  editor.materializeDocumentText(document),
                deleteExactDocumentRange: (document, range, exactText) =>
                  editor.deleteExactDocumentRange(document, range, exactText),
                insertFragmentAtCursor: (document, offset, exactText) =>
                  editor.insertFragmentAtCursor(document, offset, exactText),
              },
              persistDocument,
            );
        return moveSelectionToFragmentAction(kindId, manuscriptPort);
      },
      [manuscriptEditorRef, moveSelectionToFragmentAction, persistDocument],
    );
  
  const insertFragmentAtCursor = useCallback(
      (fragment: FragmentProjection) => {
        const editor = manuscriptEditorRef.current;
        const manuscriptPort = editor === null
          ? null
          : createFragmentsManuscriptPort(
              {
                readSelection: (document) => {
                  const summary = editor.readDocumentState(document);
                  const selection =
                    summary?.selection.ranges[summary.selection.mainIndex];
                  return selection === undefined
                    ? undefined
                    : Object.freeze({
                        anchor: selection.anchor,
                        head: selection.head,
                        from: selection.from,
                        to: selection.to,
                        empty: selection.empty,
                      });
                },
                materializeDocumentText: (document) =>
                  editor.materializeDocumentText(document),
                deleteExactDocumentRange: (document, range, exactText) =>
                  editor.deleteExactDocumentRange(document, range, exactText),
                insertFragmentAtCursor: (document, offset, exactText) =>
                  editor.insertFragmentAtCursor(document, offset, exactText),
              },
              persistDocument,
            );
        return insertFragmentAtCursorAction(fragment, manuscriptPort);
      },
      [insertFragmentAtCursorAction, manuscriptEditorRef, persistDocument],
    );
  
  const handleManuscriptTransaction = useCallback(
      (
        document: ManuscriptDocumentSource,
        transaction: ManuscriptTransaction,
        statistics: ManuscriptTextStatistics,
        composing: boolean,
        editorStateJson: string,
      ) => {
        const selection = transaction.selection.ranges[
        transaction.selection.mainIndex
        ];
        if (selection !== undefined) {
          updateActiveManuscriptPosition(
            document.documentId,
            selection.head,
          );
        }
        telemetryStore.publish(
          statistics,
          transaction.selection.ranges.some((range) => !range.empty),
        );
        if (transaction.changes.length > 0) invalidateSearchResult();
        if (transaction.changes.length === 0) {
          return;
        }
        resumePausedPomodoroOnInput();
        recordForwardWritingStatistics(document, statistics.characterCount);
        resetLoreCue();
        clearSceneContextForDocumentEdit(document);
        const pending = durableSaveQueueRef.current?.record(
          document.documentId,
          transaction,
          { composing, editorStateJson },
        );
        void pending?.catch(() => undefined);
        handleDocumentEdited(document);
      },
      [clearSceneContextForDocumentEdit, durableSaveQueueRef, handleDocumentEdited, invalidateSearchResult, recordForwardWritingStatistics, resetLoreCue, resumePausedPomodoroOnInput, telemetryStore, updateActiveManuscriptPosition],
    );
  return {
    captureCharacterWorkspaceSelection,
    createLoreEntry,
    addLoreEntryEvidence,
    createLoreCandidate,
    captureFragment,
    moveSelectionToFragment,
    insertFragmentAtCursor,
    handleManuscriptTransaction,
  };
}
