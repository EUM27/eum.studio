import { useCallback, type RefObject } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import { CANON_TARGET_KINDS } from "../../../application/canon/canon-review-contract";
import type { AssistantContextRange } from "../../../application/assistant/assistant-context-permission";
import type { FragmentProjection } from "../../../application/fragments/fragment-contract";
import type { LoreEntryProjection } from "../../../application/lore/lore-entry-contract";
import type {
  ManuscriptCanonReviewSelection,
  ManuscriptEditorHandle,
} from "../../editor/ManuscriptEditor";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import type { ManuscriptTextStatistics } from "../../editor/manuscript-text-statistics";
import type { ManuscriptTransaction } from "../../editor/manuscript-transaction";
import { createCharactersManuscriptPort } from "../../features/characters/characters-client";
import type { useCharactersController } from "../../features/characters/useCharactersController";
import type { useCanonReviewController } from "../../features/canon/useCanonReviewController";
import type { useContinuityController } from "../../features/continuity/useContinuityController";
import type { useCharacterKnowledgeController } from "../../features/knowledge/useCharacterKnowledgeController";
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

export type SubmitCanonReviewSelectionResult = Readonly<{
  status:
    | "submitted"
    | "composition-active"
    | "invalid-selection"
    | "selection-stale"
    | "revision-unavailable"
    | "persist-failed"
    | "run-failed";
}>;

export async function submitCanonReviewSelection(input: Readonly<{
  document: ManuscriptDocumentSource;
  editor: Pick<
    ManuscriptEditorHandle,
    "isDocumentComposing" | "materializeDocumentText"
  >;
  getCurrentRevisionId: (
    documentId: ManuscriptDocumentSource["documentId"],
  ) => ManuscriptDocumentSource["documentRevisionId"] | null;
  openReview: () => void;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  runReview: (sourceRange: AssistantContextRange) => Promise<unknown>;
  selection: ManuscriptCanonReviewSelection;
}>): Promise<SubmitCanonReviewSelectionResult> {
  const { document, editor, selection } = input;
  if (editor.isDocumentComposing(document)) {
    return Object.freeze({ status: "composition-active" });
  }
  if (
    !Number.isSafeInteger(selection.from) ||
    !Number.isSafeInteger(selection.to) ||
    selection.from < 0 ||
    selection.to <= selection.from ||
    selection.exactText.length === 0
  ) {
    return Object.freeze({ status: "invalid-selection" });
  }
  const matchesExactSelection = () => {
    const text = editor.materializeDocumentText(document);
    return selection.to <= text.length &&
      text.slice(selection.from, selection.to) === selection.exactText;
  };
  if (!matchesExactSelection()) {
    return Object.freeze({ status: "selection-stale" });
  }
  try {
    await input.persistDocument(document);
  } catch {
    return Object.freeze({ status: "persist-failed" });
  }
  if (editor.isDocumentComposing(document)) {
    return Object.freeze({ status: "composition-active" });
  }
  if (!matchesExactSelection()) {
    return Object.freeze({ status: "selection-stale" });
  }
  const documentRevisionId = input.getCurrentRevisionId(document.documentId) ??
    document.documentRevisionId;
  if (documentRevisionId === null) {
    return Object.freeze({ status: "revision-unavailable" });
  }
  input.openReview();
  try {
    await input.runReview(Object.freeze({
      documentId: document.documentId,
      documentRevisionId,
      from: selection.from,
      to: selection.to,
    }));
  } catch {
    return Object.freeze({ status: "run-failed" });
  }
  return Object.freeze({ status: "submitted" });
}

const CANON_SELECTION_MESSAGES: Readonly<Record<
  Exclude<SubmitCanonReviewSelectionResult["status"], "submitted">,
  string
>> = Object.freeze({
  "composition-active": "한글 입력 조합이 끝난 뒤 별빛 변경 점검을 다시 실행해 주세요.",
  "invalid-selection": "별빛 변경 점검에는 비어 있지 않은 정확한 원문 선택이 필요합니다.",
  "selection-stale": "선택한 원문이 달라졌습니다. 현재 원문을 다시 선택해 주세요.",
  "revision-unavailable": "선택 원문의 현재 저장 revision을 확인하지 못했습니다.",
  "persist-failed": "선택 원문의 현재 저장 버전을 만들지 못했습니다.",
  "run-failed": "별빛 변경 점검을 실행하지 못했습니다.",
});

const CONTINUITY_SELECTION_MESSAGES: Readonly<Record<
  Exclude<SubmitCanonReviewSelectionResult["status"], "submitted">,
  string
>> = Object.freeze({
  "composition-active": "한글 입력 조합이 끝난 뒤 연속성 작업을 다시 실행해 주세요.",
  "invalid-selection": "연속성 작업에는 비어 있지 않은 정확한 원문 선택이 필요합니다.",
  "selection-stale": "선택한 원문이 달라졌습니다. 현재 원문을 다시 선택해 주세요.",
  "revision-unavailable": "선택 원문의 현재 저장 revision을 확인하지 못했습니다.",
  "persist-failed": "선택 원문의 현재 저장 버전을 만들지 못했습니다.",
  "run-failed": "연속성 작업을 실행하지 못했습니다.",
});

const CHARACTER_KNOWLEDGE_SELECTION_MESSAGES: Readonly<Record<
  Exclude<SubmitCanonReviewSelectionResult["status"], "submitted">,
  string
>> = Object.freeze({
  "composition-active": "한글 입력 조합이 끝난 뒤 인물 지식 저장을 다시 실행해 주세요.",
  "invalid-selection": "인물 지식에는 비어 있지 않은 정확한 원문 선택이 필요합니다.",
  "selection-stale": "선택한 원문이 달라졌습니다. 현재 원문을 다시 선택해 주세요.",
  "revision-unavailable": "선택 원문의 현재 저장 revision을 확인하지 못했습니다.",
  "persist-failed": "선택 원문의 현재 저장 버전을 만들지 못했습니다.",
  "run-failed": "인물 지식 저장 화면을 준비하지 못했습니다.",
});

export function useWorkspaceManuscriptActionsController(input: Readonly<{
  controllers: Readonly<{
    activity: ReturnType<typeof useActivityController>;
    canon: ReturnType<typeof useCanonReviewController>;
    continuity: ReturnType<typeof useContinuityController>;
    characterKnowledge: ReturnType<typeof useCharacterKnowledgeController>;
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
  navigation: Readonly<{
    openCanonReview: () => void;
    openContinuity: () => void;
    openCharacterKnowledge: () => void;
  }>;
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

  const runCanonReviewSelection = useCallback(async (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => {
    const editor = manuscriptEditorRef.current;
    if (editor === null) {
      input.navigation.openCanonReview();
      input.controllers.canon.reportError(
        "현재 원고 편집기를 확인할 수 없습니다.",
      );
      return;
    }
    const outcome = await submitCanonReviewSelection({
      document,
      editor,
      selection,
      getCurrentRevisionId: (documentId) =>
        durableSaveQueueRef.current?.getCurrentRevisionId(documentId) ?? null,
      openReview: input.navigation.openCanonReview,
      persistDocument,
      runReview: (sourceRange) =>
        input.controllers.canon.runReview(sourceRange, CANON_TARGET_KINDS),
    });
    if (outcome.status !== "submitted") {
      input.navigation.openCanonReview();
      input.controllers.canon.reportError(CANON_SELECTION_MESSAGES[outcome.status]);
    }
  }, [
    durableSaveQueueRef,
    input.controllers.canon,
    input.navigation,
    manuscriptEditorRef,
    persistDocument,
  ]);

  const stageContinuitySelection = useCallback(async (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => {
    const editor = manuscriptEditorRef.current;
    if (editor === null) {
      input.navigation.openContinuity();
      input.controllers.continuity.reportError(
        "현재 원고 편집기를 확인할 수 없습니다.",
      );
      return;
    }
    const outcome = await submitCanonReviewSelection({
      document,
      editor,
      selection,
      getCurrentRevisionId: (documentId) =>
        durableSaveQueueRef.current?.getCurrentRevisionId(documentId) ?? null,
      openReview: input.navigation.openContinuity,
      persistDocument,
      runReview: async (sourceRange) => {
        input.controllers.continuity.stageManualSelection(
          sourceRange,
          selection.exactText,
        );
      },
    });
    if (outcome.status !== "submitted") {
      input.navigation.openContinuity();
      input.controllers.continuity.reportError(
        CONTINUITY_SELECTION_MESSAGES[outcome.status],
      );
    }
  }, [
    durableSaveQueueRef,
    input.controllers.continuity,
    input.navigation,
    manuscriptEditorRef,
    persistDocument,
  ]);

  const runContinuityReviewSelection = useCallback(async (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => {
    const editor = manuscriptEditorRef.current;
    if (editor === null) {
      input.navigation.openContinuity();
      input.controllers.continuity.reportError(
        "현재 원고 편집기를 확인할 수 없습니다.",
      );
      return;
    }
    const outcome = await submitCanonReviewSelection({
      document,
      editor,
      selection,
      getCurrentRevisionId: (documentId) =>
        durableSaveQueueRef.current?.getCurrentRevisionId(documentId) ?? null,
      openReview: input.navigation.openContinuity,
      persistDocument,
      runReview: (sourceRange) =>
        input.controllers.continuity.runReview(sourceRange),
    });
    if (outcome.status !== "submitted") {
      input.navigation.openContinuity();
      input.controllers.continuity.reportError(
        CONTINUITY_SELECTION_MESSAGES[outcome.status],
      );
    }
  }, [
    durableSaveQueueRef,
    input.controllers.continuity,
    input.navigation,
    manuscriptEditorRef,
    persistDocument,
  ]);

  const stageCharacterKnowledgeSelection = useCallback(async (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => {
    const editor = manuscriptEditorRef.current;
    if (editor === null) {
      input.navigation.openCharacterKnowledge();
      input.controllers.characterKnowledge.reportError(
        "현재 원고 편집기를 확인할 수 없습니다.",
      );
      return;
    }
    const outcome = await submitCanonReviewSelection({
      document,
      editor,
      selection,
      getCurrentRevisionId: (documentId) =>
        durableSaveQueueRef.current?.getCurrentRevisionId(documentId) ?? null,
      openReview: input.navigation.openCharacterKnowledge,
      persistDocument,
      runReview: async (sourceRange) => {
        input.controllers.characterKnowledge.stageSelection(
          sourceRange,
          selection.exactText,
        );
      },
    });
    if (outcome.status !== "submitted") {
      input.navigation.openCharacterKnowledge();
      input.controllers.characterKnowledge.reportError(
        CHARACTER_KNOWLEDGE_SELECTION_MESSAGES[outcome.status],
      );
    }
  }, [
    durableSaveQueueRef,
    input.controllers.characterKnowledge,
    input.navigation,
    manuscriptEditorRef,
    persistDocument,
  ]);

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
    runCanonReviewSelection,
    stageContinuitySelection,
    runContinuityReviewSelection,
    stageCharacterKnowledgeSelection,
    handleManuscriptTransaction,
  };
}
