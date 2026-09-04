import {
  history,
  historyKeymap,
  isolateHistory,
  redo,
  selectAll,
  undo,
  undoDepth,
} from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type StateEffect,
  Transaction,
} from "@codemirror/state";
import { search, searchKeymap } from "@codemirror/search";
import {
  EditorView,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Minus,
  MoreHorizontal,
  Palette,
  Plus,
  Redo2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  createDefaultManuscriptEditorDocumentState,
  parseManuscriptEditorDocumentState,
  serializeManuscriptEditorDocumentState,
  type ManuscriptEditorDocumentState,
  type ManuscriptFormattingProfile,
} from "../../application/editor/manuscript-formatting";
import {
  formatManuscriptBlankLines,
  type ManuscriptBlankLineCount,
} from "../../application/editor/manuscript-blank-line-formatting";
import {
  applyManuscriptLayoutSettings,
  readManuscriptLayoutSettings,
  type ManuscriptLayoutSettings,
} from "../../application/editor/work-manuscript-layout-settings";
import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type { ManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import { derivePreviousEpisodeFlowPreview } from "../../application/editor/previous-episode-flow";
import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import { ManuscriptDocumentStateRegistry } from "./manuscript-document-state";
import { createManuscriptInputRules } from "./manuscript-input-rules";
import {
  createPreviousEpisodeFlowExtension,
  setPreviousEpisodeFlowPreviewEffect,
} from "./previous-episode-flow-extension";
import {
  createLoreCueExtension,
  setLoreCueContextEffect,
  type LoreCueInteraction,
} from "./lore-cue-extension";
import {
  createSceneBoundaryPreviewExtension,
  setSceneBoundaryPreviewsEffect,
  type ManuscriptSceneBoundaryPreview,
} from "./scene-boundary-preview-extension";
import {
  createManuscriptSceneRangeExtension,
  setManuscriptSceneRangesEffect,
  type ManuscriptSceneRange,
  type ManuscriptSceneRangeMove,
} from "./manuscript-scene-range-extension";
import {
  createSceneBoundaryHistoryExtension,
  recordSceneBoundaryHistoryEffect,
  type SceneBoundaryHistoryEntry,
} from "./scene-boundary-history-extension";
import type { LoreCue } from "../../application/lore/lore-cue-projection";
import {
  extractManuscriptTransaction,
  type ManuscriptSelection,
  type ManuscriptTransaction,
} from "./manuscript-transaction";
import {
  manuscriptTextStatisticsExtension,
  readManuscriptTextStatistics,
  type ManuscriptTextStatistics,
} from "./manuscript-text-statistics";
import {
  activeManuscriptFormattingEqual,
  createManuscriptFormattingExtension,
  readActiveManuscriptFormatting,
  readManuscriptEditorDocumentState,
  setManuscriptContentWidthEffect,
  setManuscriptFontFamilyEffect,
  setManuscriptFontSizeEffect,
  setManuscriptHighlightColorEffect,
  setManuscriptLetterSpacingEffect,
  setManuscriptLineHeightEffect,
  setManuscriptParagraphAlignmentEffect,
  setManuscriptParagraphSpacingEffect,
  setManuscriptTextColorEffect,
  toggleManuscriptStyleEffect,
  transactionChangesManuscriptDocumentFormatting,
  transactionChangesManuscriptLayoutSettings,
  type ActiveManuscriptFormatting,
} from "./manuscript-formatting-state";
import { ManuscriptContextMenu } from "./ManuscriptContextMenu";
import {
  createManuscriptHeatmapExtension,
  setManuscriptHeatmapModeEffect,
  type ManuscriptHeatmapMode,
} from "./manuscript-analysis";
import { createForwardWritingProtection } from "./forward-writing-protection";
import { resolveCursorFollowScrollTop } from "./cursor-follow-scroll-position";
import {
  createManuscriptAnnotationExtension,
  setManuscriptAnnotationRangesEffect,
  type ManuscriptAnnotationRange,
} from "./manuscript-annotation-extension";
import {
  ManuscriptCompositionNavigationGate,
} from "./manuscript-composition-navigation-gate";

export type ManuscriptDocumentStateSummary = {
  readonly statistics: ManuscriptTextStatistics;
  readonly selection: ManuscriptSelection;
};

export type ManuscriptFocusPresentation = {
  readonly active: boolean;
  readonly manuscriptWidthPx: number;
  readonly highlightCurrentParagraph: boolean;
  readonly cursorFollowEnabled: boolean;
  readonly cursorViewportPercent: number;
  readonly textScalePercent: number;
};

const cursorFollowScrollRequestVersions = new WeakMap<EditorView, number>();

function requestCursorViewportPosition(
  view: EditorView,
  positionPercent: number,
): void {
  const requestVersion =
    (cursorFollowScrollRequestVersions.get(view) ?? 0) + 1;
  cursorFollowScrollRequestVersions.set(view, requestVersion);
  view.scrollDOM.style.setProperty(
    "--cursor-follow-scroll-space",
    `${view.scrollDOM.clientHeight}px`,
  );
  window.setTimeout(() => {
    const canvas = view.dom.closest<HTMLElement>(
      ".manuscript-editor-canvas",
    );
    if (
      !view.dom.isConnected ||
      canvas?.dataset.cursorFollow !== "true" ||
      cursorFollowScrollRequestVersions.get(view) !== requestVersion
    ) {
      return;
    }
    const cursor = view.coordsAtPos(view.state.selection.main.head, 1);
    if (cursor === null) {
      return;
    }
    const scroller = view.scrollDOM;
    const scrollerRect = scroller.getBoundingClientRect();
    const requestedScrollTop = resolveCursorFollowScrollTop({
      currentScrollTop: scroller.scrollTop,
      cursorBottom: cursor.bottom,
      cursorTop: cursor.top,
      maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
      positionPercent,
      scrollerTop: scrollerRect.top,
      viewportHeight: scroller.clientHeight,
    });
    scroller.scrollTop = requestedScrollTop;
  }, 0);
}

export type ManuscriptEditorProps = {
  readonly accessibleName: string;
  readonly activeDocument: ManuscriptDocumentSource;
  readonly formattingProfile: ManuscriptFormattingProfile;
  readonly manuscriptFocus?: ManuscriptFocusPresentation;
  readonly forwardWriteProtectedLength?: number | null;
  readonly heatmapMode?: ManuscriptHeatmapMode;
  readonly canMoveToNextEpisode: boolean;
  readonly inputProfile: ManuscriptInputProfile;
  readonly loreEntries: readonly LoreEntryProjection[];
  readonly layoutSettings?: ManuscriptLayoutSettings;
  readonly orderedDocuments: readonly ManuscriptDocumentSource[];
  readonly previousEpisodeFlowDocuments: readonly ManuscriptDocumentSource[];
  readonly annotationRanges?: readonly ManuscriptAnnotationRange[];
  readonly readOnly: boolean;
  readonly resumeLocation:
    | Extract<
        ManuscriptResumeCheckpointProjection,
        { readonly status: "resolved" }
      >
    | null;
  readonly sceneBoundaryPreviews?: readonly ManuscriptSceneBoundaryPreview[];
  readonly sceneRanges?: readonly ManuscriptSceneRange[];
  readonly onDocumentActivated: (
    document: ManuscriptDocumentSource,
    summary: ManuscriptDocumentStateSummary,
  ) => void;
  readonly onFormattingChange: (
    document: ManuscriptDocumentSource,
    state: ManuscriptEditorDocumentState,
  ) => void;
  readonly onLayoutSettingsChange?: (
    settings: ManuscriptLayoutSettings,
  ) => void;
  readonly onHeatmapModeChange?: (mode: ManuscriptHeatmapMode) => void;
  readonly onImportText?: () => void;
  readonly onOpenBulkExport?: () => void;
  readonly onMoveToNextEpisode: () => void;
  readonly onLoreCueHover: (interaction: LoreCueInteraction | null) => void;
  readonly onOpenLoreCue: (cue: LoreCue) => void;
  readonly onOpenContinuousReading: () => void;
  readonly onOpenPreflight: () => void;
  readonly onOpenAnalysis?: () => void;
  readonly onCanonReview: (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => void;
  readonly onContinuityManual: (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => void;
  readonly onContinuityReview: (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => void;
  readonly onCharacterKnowledge: (
    document: ManuscriptDocumentSource,
    selection: ManuscriptCanonReviewSelection,
  ) => void;
  readonly onAddEvent: () => void;
  readonly onAddScene: () => void;
  readonly onMergeScene: (
    document: ManuscriptDocumentSource,
    offset: number,
  ) => void;
  readonly onMoveSceneRange: (
    document: ManuscriptDocumentSource,
    move: ManuscriptSceneRangeMove,
  ) => void;
  readonly onSplitScene: (
    document: ManuscriptDocumentSource,
    offset: number,
  ) => void;
  readonly onSceneBoundaryHistoryToggle: (
    entry: SceneBoundaryHistoryEntry,
    active: boolean,
  ) => void;
  readonly onBlur: (
    document: ManuscriptDocumentSource,
  ) => void;
  readonly onCompositionEnd: (
    document: ManuscriptDocumentSource,
  ) => void;
  readonly onTransaction: (
    document: ManuscriptDocumentSource,
    transaction: ManuscriptTransaction,
    statistics: ManuscriptTextStatistics,
    composing: boolean,
    editorStateJson: string,
  ) => void;
  readonly onUndoExternal?: () => boolean;
};

export type ManuscriptEditorHandle = {
  readonly materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string;
  readonly isDocumentComposing: (
    document: ManuscriptDocumentSource,
  ) => boolean;
  readonly waitForDocumentCompositionEnd: (
    document: ManuscriptDocumentSource,
  ) => Promise<void>;
  readonly serializeDocumentEditorState: (
    document: ManuscriptDocumentSource,
  ) => string;
  readonly readDocumentState: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptDocumentStateSummary | null;
  readonly selectDocumentRange: (
    document: ManuscriptDocumentSource,
    range: { readonly from: number; readonly to: number },
  ) => boolean;
  readonly replaceDocumentRange: (
    document: ManuscriptDocumentSource,
    range: { readonly from: number; readonly to: number },
    expectedSource: string,
    result: string,
  ) => boolean;
  readonly deleteExactDocumentRange: (
    document: ManuscriptDocumentSource,
    range: { readonly from: number; readonly to: number },
    expectedSource: string,
  ) => boolean;
  readonly insertFragmentAtCursor: (
    document: ManuscriptDocumentSource,
    cursor: number,
    text: string,
  ) => boolean;
  readonly insertTextAtExactOffset: (
    document: ManuscriptDocumentSource,
    offset: number,
    expectedDocumentLength: number,
    text: string,
  ) => boolean;
  readonly revealDocumentOffset: (
    document: ManuscriptDocumentSource,
    offset: number,
  ) => boolean;
  readonly recordSceneBoundaryHistory: (
    document: ManuscriptDocumentSource,
    entry: SceneBoundaryHistoryEntry,
  ) => boolean;
};

export type ManuscriptContextSelection = Readonly<{
  anchor: number;
  head: number;
}>;

export type ManuscriptCanonReviewSelection = Readonly<{
  from: number;
  to: number;
  exactText: string;
}>;

export function createCanonReviewContextSelection(
  documentText: string,
  selection: Readonly<{ from: number; to: number }>,
  composing: boolean,
): ManuscriptCanonReviewSelection | null {
  if (
    composing ||
    !Number.isSafeInteger(selection.from) ||
    !Number.isSafeInteger(selection.to) ||
    selection.from < 0 ||
    selection.to <= selection.from ||
    selection.to > documentText.length
  ) {
    return null;
  }
  const exactText = documentText.slice(selection.from, selection.to);
  return exactText.length === 0
    ? null
    : Object.freeze({ from: selection.from, to: selection.to, exactText });
}

export function resolveManuscriptContextSelection(
  selection: Readonly<{ anchor: number; head: number; from: number; to: number }>,
  pointerOffset: number,
): ManuscriptContextSelection {
  if (
    selection.from !== selection.to &&
    pointerOffset >= selection.from &&
    pointerOffset < selection.to
  ) {
    return Object.freeze({ anchor: selection.anchor, head: selection.head });
  }
  return Object.freeze({ anchor: pointerOffset, head: pointerOffset });
}

function summarizeState(state: EditorState): ManuscriptDocumentStateSummary {
  const ranges = state.selection.ranges.map((range) =>
    Object.freeze({
      anchor: range.anchor,
      head: range.head,
      from: range.from,
      to: range.to,
      empty: range.empty,
    }),
  );
  return Object.freeze({
    statistics: readManuscriptTextStatistics(state),
    selection: Object.freeze({
      mainIndex: state.selection.mainIndex,
      ranges: Object.freeze(ranges),
    }),
  });
}

export const ManuscriptEditor = forwardRef<
  ManuscriptEditorHandle,
  ManuscriptEditorProps
>(function ManuscriptEditor(
  {
    accessibleName,
    activeDocument,
    annotationRanges = [],
    formattingProfile,
    manuscriptFocus,
    forwardWriteProtectedLength = null,
    heatmapMode = "off",
    canMoveToNextEpisode,
    inputProfile,
    layoutSettings,
    loreEntries,
    orderedDocuments,
    previousEpisodeFlowDocuments,
    onBlur,
    onCompositionEnd,
    onDocumentActivated,
    onFormattingChange,
    onLayoutSettingsChange,
    onHeatmapModeChange,
    onImportText,
    onOpenBulkExport,
    onMoveToNextEpisode,
    onLoreCueHover,
    onAddEvent,
    onAddScene,
    onMergeScene,
    onMoveSceneRange,
    onSplitScene,
    onSceneBoundaryHistoryToggle,
    onOpenLoreCue,
    onOpenContinuousReading,
    onOpenPreflight,
    onOpenAnalysis,
    onCanonReview,
    onContinuityManual,
    onContinuityReview,
    onCharacterKnowledge,
    onTransaction,
    onUndoExternal,
    readOnly,
    resumeLocation,
    sceneBoundaryPreviews = [],
    sceneRanges = [],
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialDocumentRef = useRef(activeDocument);
  const initialFormattingProfileRef = useRef(formattingProfile);
  const layoutSettingsRef = useRef(layoutSettings);
  layoutSettingsRef.current = layoutSettings;
  const synchronizingLayoutRef = useRef(false);
  const activeDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const pendingDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const compositionNavigationGateRef = useRef(
    new ManuscriptCompositionNavigationGate(),
  );
  const stateRegistryRef = useRef(new ManuscriptDocumentStateRegistry());
  const orderedDocumentsRef = useRef(orderedDocuments);
  orderedDocumentsRef.current = orderedDocuments;
  const previousEpisodeFlowDocumentsRef = useRef(
    previousEpisodeFlowDocuments,
  );
  previousEpisodeFlowDocumentsRef.current = previousEpisodeFlowDocuments;
  const loreEntriesRef = useRef(loreEntries);
  loreEntriesRef.current = loreEntries;
  const sceneBoundaryPreviewsRef = useRef(sceneBoundaryPreviews);
  sceneBoundaryPreviewsRef.current = sceneBoundaryPreviews;
  const sceneRangesRef = useRef(sceneRanges);
  sceneRangesRef.current = sceneRanges;
  const annotationRangesRef = useRef(annotationRanges);
  annotationRangesRef.current = annotationRanges;
  const [activeFormatting, setActiveFormatting] =
    useState<ActiveManuscriptFormatting>(() => ({
      bold: false,
      italic: false,
      underline: false,
      fontFamilyId:
        layoutSettings?.fontFamilyId ?? formattingProfile.defaults.fontFamilyId,
      fontSizePx:
        layoutSettings?.fontSizePx ?? formattingProfile.defaults.fontSizePx,
      textColor: formattingProfile.defaults.textColor,
      highlightColor: null,
      contentWidthPx:
        layoutSettings?.contentWidthPx ?? formattingProfile.defaults.contentWidthPx,
      lineHeight: layoutSettings?.lineHeight ?? formattingProfile.defaults.lineHeight,
      paragraphSpacingPx:
        layoutSettings?.paragraphSpacingPx ??
        formattingProfile.defaults.paragraphSpacingPx,
      letterSpacingEm:
        layoutSettings?.letterSpacingEm ??
        formattingProfile.defaults.letterSpacingEm,
      paragraphAlignment: "left",
    }));
  const activeFormattingRef = useRef(activeFormatting);
  activeFormattingRef.current = activeFormatting;
  const publishActiveFormatting = (
    nextFormatting: ActiveManuscriptFormatting,
  ) => {
    if (activeManuscriptFormattingEqual(
      activeFormattingRef.current,
      nextFormatting,
    )) {
      return;
    }
    activeFormattingRef.current = nextFormatting;
    setActiveFormatting(nextFormatting);
  };
  const [additionalToolsVisible, setAdditionalToolsVisible] = useState(false);
  const [colorMenu, setColorMenu] = useState<"text" | "highlight" | null>(null);
  const [contextMenu, setContextMenu] = useState<Readonly<{
    canCopy: boolean;
    canCut: boolean;
    clientX: number;
    clientY: number;
    canMoveToNextEpisode: boolean;
    canMergeScene: boolean;
    canPaste: boolean;
    canonReviewSelection: ManuscriptCanonReviewSelection | null;
    sceneOffset: number;
  }> | null>(null);
  const readOnlyCompartmentRef = useRef(
    new Compartment(),
  );
  const forwardWritingProtectionCompartmentRef = useRef(new Compartment());
  const currentParagraphHighlightCompartmentRef = useRef(new Compartment());
  const manuscriptFocusRef = useRef(manuscriptFocus);
  manuscriptFocusRef.current = manuscriptFocus;
  const notifyBlur = useEffectEvent(onBlur);
  const notifyCompositionEnd = useEffectEvent(onCompositionEnd);
  const notifyDocumentActivated = useEffectEvent(onDocumentActivated);
  const notifyFormattingChange = useEffectEvent(onFormattingChange);
  const notifyLayoutSettingsChange = useEffectEvent(
    (settings: ManuscriptLayoutSettings) => {
      onLayoutSettingsChange?.(settings);
    },
  );
  const notifyLoreCueHover = useEffectEvent(onLoreCueHover);
  const notifyAddEvent = useEffectEvent(onAddEvent);
  const notifyAddScene = useEffectEvent(onAddScene);
  const notifyCanonReview = useEffectEvent(onCanonReview);
  const notifyContinuityManual = useEffectEvent(onContinuityManual);
  const notifyContinuityReview = useEffectEvent(onContinuityReview);
  const notifyCharacterKnowledge = useEffectEvent(onCharacterKnowledge);
  const notifyMergeScene = useEffectEvent(onMergeScene);
  const notifyMoveSceneRange = useEffectEvent(onMoveSceneRange);
  const notifySplitScene = useEffectEvent(onSplitScene);
  const notifySceneBoundaryHistoryToggle = useEffectEvent(
    onSceneBoundaryHistoryToggle,
  );
  const notifyOpenLoreCue = useEffectEvent(onOpenLoreCue);
  const notifyMoveToNextEpisode = useEffectEvent(onMoveToNextEpisode);
  const notifyTransaction = useEffectEvent(onTransaction);
  const notifyUndoExternal = useEffectEvent(
    () => onUndoExternal?.() ?? false,
  );
  const canMoveToNextEpisodeRef = useRef(canMoveToNextEpisode);
  canMoveToNextEpisodeRef.current = canMoveToNextEpisode;
  const materializeDocumentText = (
    document: ManuscriptDocumentSource,
  ): string => {
    const storedText = stateRegistryRef.current.materialize(document);
    const view = viewRef.current;
    const active = activeDocumentRef.current;
    if (
      view !== null &&
      active?.workId === document.workId &&
      active.documentId === document.documentId
    ) {
      return view.state.doc.toString();
    }
    return storedText ?? document.initialText;
  };
  const readPreviousEpisodeFlow = (
    document: ManuscriptDocumentSource,
  ) =>
    derivePreviousEpisodeFlowPreview(
      document,
      previousEpisodeFlowDocumentsRef.current,
      materializeDocumentText,
    );
  const publishSelectionEvidence = useEffectEvent(
    (state: EditorState) => {
      const host = hostRef.current;
      if (host === null) {
        return;
      }
      const main = state.selection.main;
      host.dataset.selectionAnchor =
        String(main.anchor);
      host.dataset.selectionHead =
        String(main.head);
    },
  );
  useImperativeHandle(
    ref,
    () => ({
      materializeDocumentText(document) {
        return materializeDocumentText(document);
      },
      isDocumentComposing(document) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        return view !== null &&
          active?.documentId === document.documentId &&
          active.workId === document.workId &&
          (view.composing || view.compositionStarted);
      },
      waitForDocumentCompositionEnd(document) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId
        ) {
          return Promise.reject(new Error(
            `The active editor state is unavailable for ${document.documentId}`,
          ));
        }
        return compositionNavigationGateRef.current.waitForEnd(
          {
            workId: document.workId,
            documentId: document.documentId,
          },
          {
            isComposing: () => {
              const currentView = viewRef.current;
              const currentDocument = activeDocumentRef.current;
              return currentView === view &&
                currentDocument?.workId === document.workId &&
                currentDocument.documentId === document.documentId &&
                (view.composing || view.compositionStarted);
            },
            blur: () => view.contentDOM.blur(),
            afterPaint: (callback) => {
              window.requestAnimationFrame(() => callback());
            },
            onFallbackEnd: () => notifyCompositionEnd(document),
          },
        );
      },
      serializeDocumentEditorState(document) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        const state =
          view !== null &&
          active?.documentId === document.documentId &&
          active.workId === document.workId
            ? view.state
            : stateRegistryRef.current.readState(document);
        const documentState =
          state === null
            ? document.editorStateJson === undefined
              ? createDefaultManuscriptEditorDocumentState(formattingProfile)
              : parseManuscriptEditorDocumentState(
                  JSON.parse(document.editorStateJson),
                  formattingProfile,
                  document.initialText.length,
                )
            : readManuscriptEditorDocumentState(state);
        return serializeManuscriptEditorDocumentState(documentState);
      },
      readDocumentState(document) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId
        ) {
          return null;
        }
        return summarizeState(view.state);
      },
      selectDocumentRange(document, range) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          !Number.isSafeInteger(range.from) ||
          !Number.isSafeInteger(range.to) ||
          range.from < 0 ||
          range.to < range.from ||
          range.to > view.state.doc.length
        ) {
          return false;
        }
        view.dispatch({
          selection: EditorSelection.single(range.from, range.to),
          scrollIntoView: true,
        });
        view.focus();
        return true;
      },
      replaceDocumentRange(document, range, expectedSource, result) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          readOnly ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          !Number.isSafeInteger(range.from) ||
          !Number.isSafeInteger(range.to) ||
          range.from < 0 ||
          range.to < range.from ||
          range.to > view.state.doc.length ||
          view.state.doc.sliceString(range.from, range.to) !== expectedSource
        ) {
          return false;
        }
        view.dispatch({
          changes: {
            from: range.from,
            to: range.to,
            insert: result,
          },
          selection: EditorSelection.cursor(range.from + result.length),
          scrollIntoView: true,
          annotations: Transaction.userEvent.of("input.preflight"),
        });
        view.focus();
        return true;
      },
      deleteExactDocumentRange(document, range, expectedSource) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          readOnly ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          !Number.isSafeInteger(range.from) ||
          !Number.isSafeInteger(range.to) ||
          range.from < 0 ||
          range.to <= range.from ||
          range.to > view.state.doc.length ||
          view.state.doc.sliceString(range.from, range.to) !== expectedSource
        ) {
          return false;
        }
        view.dispatch({
          changes: {
            from: range.from,
            to: range.to,
            insert: "",
          },
          selection: EditorSelection.cursor(range.from),
          scrollIntoView: true,
          annotations: Transaction.userEvent.of("input.fragment.move"),
        });
        view.focus();
        return true;
      },
      insertFragmentAtCursor(document, cursor, text) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        const selection = view?.state.selection.main;
        if (
          view === null ||
          readOnly ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          !Number.isSafeInteger(cursor) ||
          cursor < 0 ||
          cursor > view.state.doc.length ||
          text.length === 0 ||
          selection === undefined ||
          !selection.empty ||
          selection.from !== cursor
        ) {
          return false;
        }
        view.dispatch({
          changes: {
            from: cursor,
            to: cursor,
            insert: text,
          },
          selection: EditorSelection.cursor(cursor + text.length),
          scrollIntoView: true,
          annotations: Transaction.userEvent.of("input.fragment.insert"),
        });
        view.focus();
        return true;
      },
      insertTextAtExactOffset(
        document,
        offset,
        expectedDocumentLength,
        text,
      ) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          readOnly ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          !Number.isSafeInteger(expectedDocumentLength) ||
          expectedDocumentLength < 0 ||
          view.state.doc.length !== expectedDocumentLength ||
          offset > expectedDocumentLength ||
          text.trim().length === 0
        ) {
          return false;
        }
        view.dispatch({
          changes: { from: offset, to: offset, insert: text },
          selection: EditorSelection.cursor(offset + text.length),
          scrollIntoView: true,
          annotations: Transaction.userEvent.of("input.scene-draft.insert"),
        });
        view.focus();
        return true;
      },
      revealDocumentOffset(document, offset) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          offset > view.state.doc.length
        ) {
          return false;
        }
        view.dispatch({
          effects: EditorView.scrollIntoView(offset, { y: "center" }),
        });
        view.focus();
        return true;
      },
      recordSceneBoundaryHistory(document, entry) {
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view === null ||
          active?.documentId !== document.documentId ||
          active.workId !== document.workId ||
          entry.documentId !== document.documentId ||
          entry.workId !== document.workId
        ) {
          return false;
        }
        view.dispatch({
          effects: recordSceneBoundaryHistoryEffect.of(entry),
          annotations: [
            Transaction.userEvent.of("input.scene-boundary"),
            Transaction.addToHistory.of(true),
            isolateHistory.of("full"),
          ],
        });
        view.focus();
        return true;
      },
    }),
    [formattingProfile, readOnly],
  );
  const createDocumentState = useEffectEvent(
    (document: ManuscriptDocumentSource) =>
      EditorState.create({
        doc: document.initialText,
        ...(
          resumeLocation !== null &&
          resumeLocation.workId ===
            document.workId &&
          resumeLocation.documentId ===
            document.documentId &&
          resumeLocation.targetRevisionId ===
            document.documentRevisionId
            ? {
                selection: EditorSelection.single(
                resumeLocation.selection
                  .anchor,
                resumeLocation.selection
                  .head,
                ),
              }
            : {}
        ),
        extensions: [
          manuscriptTextStatisticsExtension,
          createManuscriptHeatmapExtension(heatmapMode),
          history(),
          search({ top: true }),
          EditorState.phrases.of({
            Find: "검색",
            Replace: "바꾸기",
            all: "모두 선택",
            "by word": "단어 단위",
            close: "검색 닫기",
            "current match": "현재 일치",
            "match case": "대소문자 구분",
            next: "다음",
            "on line": "행",
            previous: "이전",
            regexp: "정규식",
            replace: "바꾸기",
            "replace all": "모두 바꾸기",
            "replaced $ matches": "$개 일치를 바꿈",
            "replaced match on line $": "$행의 일치를 바꿈",
          }),
          keymap.of(searchKeymap),
          keymap.of([
            {
              key: "Mod-a",
              run: selectAll,
            },
            {
              key: "Mod-z",
              run: (view) =>
                undoDepth(view.state) === 0 && notifyUndoExternal(),
            },
          ]),
          keymap.of(historyKeymap),
          EditorView.lineWrapping,
          currentParagraphHighlightCompartmentRef.current.of(
            manuscriptFocusRef.current?.active === true &&
              manuscriptFocusRef.current.highlightCurrentParagraph
              ? highlightActiveLine()
              : [],
          ),
          createPreviousEpisodeFlowExtension(
            readPreviousEpisodeFlow(document),
          ),
          createSceneBoundaryPreviewExtension(
            sceneBoundaryPreviewsRef.current,
          ),
          createManuscriptSceneRangeExtension(
            sceneRangesRef.current,
            (move) => {
              const active = activeDocumentRef.current;
              if (active !== null) notifyMoveSceneRange(active, move);
            },
          ),
          createManuscriptAnnotationExtension(annotationRangesRef.current),
          createSceneBoundaryHistoryExtension(
            notifySceneBoundaryHistoryToggle,
          ),
          createLoreCueExtension(
            {
              workId: document.workId,
              documentId: document.documentId,
              entries: loreEntriesRef.current,
            },
            {
              onHover: notifyLoreCueHover,
              onOpen: notifyOpenLoreCue,
            },
          ),
          createManuscriptFormattingExtension(
            formattingProfile,
            (() => {
              const documentState = document.editorStateJson === undefined
                ? createDefaultManuscriptEditorDocumentState(formattingProfile)
                : parseManuscriptEditorDocumentState(
                    JSON.parse(document.editorStateJson),
                    formattingProfile,
                    document.initialText.length,
                  );
              const sharedLayout = layoutSettingsRef.current;
              return sharedLayout === undefined
                ? documentState
                : applyManuscriptLayoutSettings(documentState, sharedLayout);
            })(),
          ),
          createManuscriptInputRules(inputProfile),
          forwardWritingProtectionCompartmentRef.current.of(
            createForwardWritingProtection(forwardWriteProtectedLength),
          ),
          readOnlyCompartmentRef.current.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          EditorView.contentAttributes.of({
            "aria-label": accessibleName,
            "aria-multiline": "true",
          }),
          EditorView.domEventHandlers({
            contextmenu: (event, view) => {
              if (view.composing || view.compositionStarted) {
                event.preventDefault();
                setContextMenu(null);
                return true;
              }
              const pointerOffset = view.posAtCoords({
                x: event.clientX,
                y: event.clientY,
              });
              if (pointerOffset === null) return false;
              event.preventDefault();
              const current = view.state.selection.main;
              const selection = resolveManuscriptContextSelection(
                current,
                pointerOffset,
              );
              const selectionFrom = Math.min(selection.anchor, selection.head);
              const selectionTo = Math.max(selection.anchor, selection.head);
              const canonReviewSelection = createCanonReviewContextSelection(
                view.state.doc.toString(),
                { from: selectionFrom, to: selectionTo },
                view.composing || view.compositionStarted,
              );
              if (
                current.anchor !== selection.anchor ||
                current.head !== selection.head
              ) {
                view.dispatch({
                  selection: EditorSelection.single(
                    selection.anchor,
                    selection.head,
                  ),
                });
              }
              const orderedSceneRanges = [...sceneRangesRef.current]
                .filter((range) => range.start < range.end)
                .sort((left, right) =>
                  left.start - right.start || left.end - right.end
                );
              const pointerSceneIndex = orderedSceneRanges.findIndex(
                (range, index) =>
                  range.start <= pointerOffset &&
                  (pointerOffset < range.end ||
                    (index === orderedSceneRanges.length - 1 &&
                      pointerOffset === range.end)),
              );
              const activeDocumentIndex = orderedDocumentsRef.current.findIndex(
                (candidate) => candidate.documentId === document.documentId,
              );
              setContextMenu({
                canCopy:
                  selection.anchor !== selection.head &&
                  typeof navigator.clipboard?.writeText === "function",
                canCut:
                  selection.anchor !== selection.head &&
                  !readOnly &&
                  typeof navigator.clipboard?.writeText === "function",
                clientX: event.clientX,
                clientY: event.clientY,
                canMoveToNextEpisode:
                  canMoveToNextEpisodeRef.current &&
                  !readOnly,
                canMergeScene:
                  !readOnly &&
                  (pointerSceneIndex > 0 ||
                    (pointerSceneIndex === 0 && activeDocumentIndex > 0)),
                canPaste:
                  !readOnly &&
                  typeof navigator.clipboard?.readText === "function",
                canonReviewSelection: readOnly ? null : canonReviewSelection,
                sceneOffset: pointerOffset,
              });
              return true;
            },
          }),
          EditorView.updateListener.of((update) => {
            for (const transaction of update.transactions) {
              if (
                !transaction.changes.empty ||
                transaction.selection !== undefined
              ) {
                notifyTransaction(
                  document,
                  extractManuscriptTransaction(transaction),
                  readManuscriptTextStatistics(transaction.state),
                  update.view.composing,
                  serializeManuscriptEditorDocumentState(
                    readManuscriptEditorDocumentState(transaction.state),
                  ),
                );
              }
              if (
                transactionChangesManuscriptLayoutSettings(transaction) &&
                !synchronizingLayoutRef.current
              ) {
                notifyLayoutSettingsChange(
                  readManuscriptLayoutSettings(
                    readManuscriptEditorDocumentState(transaction.state),
                  ),
                );
              }
              if (
                transactionChangesManuscriptDocumentFormatting(transaction)
              ) {
                notifyFormattingChange(
                  document,
                  readManuscriptEditorDocumentState(transaction.state),
                );
              }
            }
            const nextFormatting = readActiveManuscriptFormatting(
              update.state,
              formattingProfile,
            );
            publishActiveFormatting(nextFormatting);
            publishSelectionEvidence(
              update.state,
            );
            const pointerSelection = update.transactions.some(
              (transaction) => transaction.isUserEvent("select.pointer"),
            );
            if (
              manuscriptFocusRef.current?.active === true &&
              manuscriptFocusRef.current.cursorFollowEnabled &&
              (update.docChanged || update.selectionSet) &&
              !pointerSelection
            ) {
              requestCursorViewportPosition(
                update.view,
                manuscriptFocusRef.current.cursorViewportPercent,
              );
            }
          }),
        ],
      }),
  );
  const syncPreviousEpisodeFlow = useEffectEvent(
    (view: EditorView, document: ManuscriptDocumentSource) => {
      const preview = readPreviousEpisodeFlow(document);
      view.dispatch({
        effects: setPreviousEpisodeFlowPreviewEffect.of(
          preview,
        ),
      });
    },
  );
  const syncLoreCueContext = useEffectEvent(
    (view: EditorView, document: ManuscriptDocumentSource) => {
      view.dispatch({
        effects: setLoreCueContextEffect.of({
          workId: document.workId,
          documentId: document.documentId,
          entries: loreEntriesRef.current,
        }),
      });
    },
  );
  const syncSceneBoundaryPreviews = useEffectEvent((view: EditorView) => {
    view.dispatch({
      effects: setSceneBoundaryPreviewsEffect.of(
        sceneBoundaryPreviewsRef.current,
      ),
    });
  });
  const syncManuscriptSceneRanges = useEffectEvent((view: EditorView) => {
    view.dispatch({
      effects: setManuscriptSceneRangesEffect.of(sceneRangesRef.current),
    });
  });
  const syncManuscriptAnnotationRanges = useEffectEvent((view: EditorView) => {
    view.dispatch({
      effects: setManuscriptAnnotationRangesEffect.of(
        annotationRangesRef.current,
      ),
    });
  });
  const syncHeatmapMode = useEffectEvent((
    view: EditorView,
    mode: ManuscriptHeatmapMode,
  ) => {
    view.dispatch({
      effects: setManuscriptHeatmapModeEffect.of(mode),
    });
  });
  const syncManuscriptLayoutSettings = useEffectEvent((
    view: EditorView,
    settings: ManuscriptLayoutSettings,
  ) => {
    const current = readManuscriptLayoutSettings(
      readManuscriptEditorDocumentState(view.state),
    );
    if (
      current.fontFamilyId === settings.fontFamilyId &&
      current.fontSizePx === settings.fontSizePx &&
      current.contentWidthPx === settings.contentWidthPx &&
      current.lineHeight === settings.lineHeight &&
      current.paragraphSpacingPx === settings.paragraphSpacingPx &&
      current.letterSpacingEm === settings.letterSpacingEm
    ) {
      return;
    }
    synchronizingLayoutRef.current = true;
    try {
      view.dispatch({
        effects: [
          setManuscriptFontFamilyEffect.of(settings.fontFamilyId),
          setManuscriptFontSizeEffect.of(settings.fontSizePx),
          setManuscriptContentWidthEffect.of(settings.contentWidthPx),
          setManuscriptLineHeightEffect.of(settings.lineHeight),
          setManuscriptParagraphSpacingEffect.of(settings.paragraphSpacingPx),
          setManuscriptLetterSpacingEffect.of(settings.letterSpacingEm),
        ],
        annotations: Transaction.addToHistory.of(false),
      });
    } finally {
      synchronizingLayoutRef.current = false;
    }
  });
  const activateDocument = useEffectEvent(
    (document: ManuscriptDocumentSource) => {
      const view = viewRef.current;
      const currentDocument = activeDocumentRef.current;
      if (view === null || currentDocument === null) {
        return;
      }
      if (currentDocument.documentId === document.documentId) {
        pendingDocumentRef.current = null;
        const nextSnapshot =
          stateRegistryRef.current.restoreConfirmedSource(
            document,
            createDocumentState,
          );
        const sourceChanged =
          currentDocument.workId !==
            document.workId ||
          currentDocument.documentRevisionId !==
            document.documentRevisionId;
        activeDocumentRef.current = document;
        if (sourceChanged) {
          view.setState(nextSnapshot.state);
          view.dispatch({
            effects: [
              readOnlyCompartmentRef.current.reconfigure([
                EditorState.readOnly.of(readOnly),
                EditorView.editable.of(!readOnly),
              ]),
              forwardWritingProtectionCompartmentRef.current.reconfigure(
                createForwardWritingProtection(forwardWriteProtectedLength),
              ),
            ],
          });
          const sharedLayout = layoutSettingsRef.current;
          if (sharedLayout !== undefined) {
            syncManuscriptLayoutSettings(view, sharedLayout);
          }
          syncPreviousEpisodeFlow(view, document);
          syncLoreCueContext(view, document);
          syncSceneBoundaryPreviews(view);
          syncHeatmapMode(view, heatmapMode);
          notifyDocumentActivated(
            document,
            summarizeState(view.state),
          );
          const nextFormatting = readActiveManuscriptFormatting(
            view.state,
            formattingProfile,
          );
          publishActiveFormatting(nextFormatting);
          publishSelectionEvidence(
            view.state,
          );
        }
        return;
      }
      if (view.composing) {
        pendingDocumentRef.current = document;
        return;
      }

      stateRegistryRef.current.save(currentDocument, {
        state: view.state,
        scrollSnapshot: view.scrollSnapshot(),
      });
      const nextSnapshot =
        stateRegistryRef.current.restoreConfirmedSource(
          document,
          createDocumentState,
        );
      activeDocumentRef.current = document;
      view.setState(nextSnapshot.state);
      view.dispatch({
        effects: [
          readOnlyCompartmentRef.current.reconfigure([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          forwardWritingProtectionCompartmentRef.current.reconfigure(
            createForwardWritingProtection(forwardWriteProtectedLength),
          ),
          currentParagraphHighlightCompartmentRef.current.reconfigure(
            manuscriptFocusRef.current?.active === true &&
              manuscriptFocusRef.current.highlightCurrentParagraph
              ? highlightActiveLine()
              : [],
          ),
        ],
      });
      const sharedLayout = layoutSettingsRef.current;
      if (sharedLayout !== undefined) {
        syncManuscriptLayoutSettings(view, sharedLayout);
      }
      syncPreviousEpisodeFlow(view, document);
      syncLoreCueContext(view, document);
      syncSceneBoundaryPreviews(view);
      syncHeatmapMode(view, heatmapMode);
      if (nextSnapshot.scrollSnapshot !== null) {
        view.dispatch({ effects: nextSnapshot.scrollSnapshot });
      }
      notifyDocumentActivated(document, summarizeState(view.state));
      const nextFormatting = readActiveManuscriptFormatting(
        view.state,
        formattingProfile,
      );
      publishActiveFormatting(nextFormatting);
      publishSelectionEvidence(view.state);
    },
  );

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }

    const initialDocument = initialDocumentRef.current;
    const stateRegistry = stateRegistryRef.current;
    const compositionNavigationGate =
      compositionNavigationGateRef.current;
    const initialSnapshot = stateRegistry.restore(
      initialDocument,
      createDocumentState,
    );
    const view = new EditorView({
      parent: host,
      state: initialSnapshot.state,
    });
    viewRef.current = view;
    activeDocumentRef.current = initialDocument;
    notifyDocumentActivated(initialDocument, summarizeState(view.state));
    const initialActiveFormatting = readActiveManuscriptFormatting(
      view.state,
      initialFormattingProfileRef.current,
    );
    publishActiveFormatting(initialActiveFormatting);
    publishSelectionEvidence(view.state);

    const handleCompositionEnd = () => {
      const compositionDocument = activeDocumentRef.current;
      const pendingDocument = pendingDocumentRef.current;
      queueMicrotask(() => {
        if (compositionDocument !== null) {
          notifyCompositionEnd(compositionDocument);
          compositionNavigationGate.resolve({
            workId: compositionDocument.workId,
            documentId: compositionDocument.documentId,
          });
        }
        if (pendingDocument !== null) {
          pendingDocumentRef.current = null;
          activateDocument(pendingDocument);
        }
      });
    };
    const handleBlur = () => {
      const document = activeDocumentRef.current;
      if (document !== null) {
        notifyBlur(document);
      }
    };
    view.contentDOM.addEventListener("blur", handleBlur);
    view.contentDOM.addEventListener("compositionend", handleCompositionEnd);

    return () => {
      const currentDocument = activeDocumentRef.current;
      if (currentDocument !== null) {
        stateRegistry.save(currentDocument, {
          state: view.state,
          scrollSnapshot: view.scrollSnapshot(),
        });
      }
      view.contentDOM.removeEventListener("blur", handleBlur);
      view.contentDOM.removeEventListener(
        "compositionend",
        handleCompositionEnd,
      );
      compositionNavigationGate.rejectAll((identity) =>
        new Error(
          `The manuscript editor closed before composition ended for ${identity.documentId}`,
        )
      );
      view.destroy();
      viewRef.current = null;
      activeDocumentRef.current = null;
    };
  }, []);

  useEffect(() => {
    activateDocument(activeDocument);
  }, [activeDocument]);

  useEffect(() => {
    const view = viewRef.current;
    if (view !== null && layoutSettings !== undefined) {
      syncManuscriptLayoutSettings(view, layoutSettings);
    }
  }, [layoutSettings]);

  useEffect(() => {
    if (!additionalToolsVisible) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdditionalToolsVisible(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [additionalToolsVisible]);

  useEffect(() => {
    if (colorMenu === null) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !event.target.parentElement?.closest(".toolbar-color-menu")
      ) {
        setColorMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColorMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [colorMenu]);

  useEffect(() => {
    const view = viewRef.current;
    const document = activeDocumentRef.current;
    if (view !== null && document !== null) {
      syncPreviousEpisodeFlow(view, document);
    }
  }, [previousEpisodeFlowDocuments]);

  useEffect(() => {
    const view = viewRef.current;
    const document = activeDocumentRef.current;
    if (view !== null && document !== null) {
      syncLoreCueContext(view, document);
    }
  }, [loreEntries]);

  useEffect(() => {
    const view = viewRef.current;
    if (view !== null) {
      syncSceneBoundaryPreviews(view);
    }
  }, [sceneBoundaryPreviews]);

  useEffect(() => {
    const view = viewRef.current;
    if (view !== null) {
      syncManuscriptSceneRanges(view);
    }
  }, [sceneRanges]);

  useEffect(() => {
    const view = viewRef.current;
    if (view !== null) {
      syncManuscriptAnnotationRanges(view);
    }
  }, [annotationRanges]);

  useEffect(() => {
    const view = viewRef.current;
    if (view !== null) {
      syncHeatmapMode(view, heatmapMode);
    }
  }, [heatmapMode]);

  useEffect(() => {
    const view = viewRef.current;
    const currentDocument =
      activeDocumentRef.current;
    if (
      view === null ||
      currentDocument === null ||
      resumeLocation === null ||
      currentDocument.workId !==
        resumeLocation.workId ||
      currentDocument.documentId !==
        resumeLocation.documentId ||
      currentDocument.documentRevisionId !==
        resumeLocation.targetRevisionId
    ) {
      return;
    }
    const current = view.state.selection.main;
    if (
      current.anchor !==
        resumeLocation.selection.anchor ||
      current.head !==
        resumeLocation.selection.head
    ) {
      view.dispatch({
        selection: EditorSelection.single(
          resumeLocation.selection.anchor,
          resumeLocation.selection.head,
        ),
      });
    }
    publishSelectionEvidence(view.state);
  }, [resumeLocation]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    view.dispatch({
      effects:
        readOnlyCompartmentRef.current.reconfigure([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    view.dispatch({
      effects: forwardWritingProtectionCompartmentRef.current.reconfigure(
        createForwardWritingProtection(forwardWriteProtectedLength),
      ),
    });
  }, [forwardWriteProtectedLength]);

  const manuscriptFocusActive = manuscriptFocus?.active === true;
  const highlightCurrentParagraph =
    manuscriptFocus?.active === true && manuscriptFocus.highlightCurrentParagraph;
  const cursorFollowEnabled =
    manuscriptFocus?.active === true && manuscriptFocus.cursorFollowEnabled;
  const cursorViewportPercent =
    manuscriptFocus?.cursorViewportPercent;

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    view.dispatch({
      effects: currentParagraphHighlightCompartmentRef.current.reconfigure(
        highlightCurrentParagraph ? highlightActiveLine() : [],
      ),
    });
  }, [highlightCurrentParagraph]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    if (
      cursorFollowEnabled &&
      cursorViewportPercent !== undefined
    ) {
      requestCursorViewportPosition(view, cursorViewportPercent);
    } else {
      view.scrollDOM.style.removeProperty("--cursor-follow-scroll-space");
    }
  }, [cursorFollowEnabled, cursorViewportPercent]);

  const dispatchFormattingEffect = (
    effect: StateEffect<unknown>,
    focusEditor = true,
  ) => {
    const view = viewRef.current;
    if (view === null || readOnly) {
      return;
    }
    view.dispatch({
      effects: effect,
      annotations: Transaction.userEvent.of("input.format"),
    });
    if (focusEditor) {
      view.focus();
    }
  };

  const runHistoryCommand = (command: typeof undo): void => {
    const view = viewRef.current;
    if (view === null || readOnly) {
      return;
    }
    if (
      command === undo &&
      undoDepth(view.state) === 0 &&
      notifyUndoExternal()
    ) {
      view.focus();
      return;
    }
    command(view);
    view.focus();
  };

  const copyOrCutSelection = (cut: boolean): void => {
    const view = viewRef.current;
    if (view === null || (cut && readOnly)) {
      return;
    }
    const selection = view.state.selection.main;
    if (selection.empty) {
      view.focus();
      return;
    }
    const selectedText = view.state.doc.sliceString(selection.from, selection.to);
    void navigator.clipboard.writeText(selectedText).then(() => {
      if (
        cut &&
        viewRef.current === view &&
        view.state.selection.main.from === selection.from &&
        view.state.selection.main.to === selection.to &&
        view.state.doc.sliceString(selection.from, selection.to) === selectedText
      ) {
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: "" },
          selection: EditorSelection.cursor(selection.from),
          scrollIntoView: true,
          annotations: [
            Transaction.userEvent.of("delete.cut"),
            isolateHistory.of("full"),
          ],
        });
      }
      view.focus();
    }, () => {
      view.focus();
    });
  };

  const pasteClipboardText = (): void => {
    const view = viewRef.current;
    if (view === null || readOnly) {
      return;
    }
    const selection = view.state.selection.main;
    void navigator.clipboard.readText().then((text) => {
      if (
        text.length > 0 &&
        viewRef.current === view &&
        view.state.selection.main.from === selection.from &&
        view.state.selection.main.to === selection.to
      ) {
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: EditorSelection.cursor(selection.from + text.length),
          scrollIntoView: true,
          annotations: [
            Transaction.userEvent.of("input.paste"),
            isolateHistory.of("full"),
          ],
        });
      }
      view.focus();
    }, () => {
      view.focus();
    });
  };

  const activeFontSizeIndex = formattingProfile.fontSizesPx.indexOf(
    activeFormatting.fontSizePx,
  );
  const changeFontSize = (direction: -1 | 1): void => {
    const nextIndex = Math.min(
      formattingProfile.fontSizesPx.length - 1,
      Math.max(0, activeFontSizeIndex + direction),
    );
    const nextSize = formattingProfile.fontSizesPx[nextIndex];
    if (nextSize !== undefined && nextSize !== activeFormatting.fontSizePx) {
      dispatchFormattingEffect(setManuscriptFontSizeEffect.of(nextSize));
    }
  };
  const applyBlankLineFormatting = (
    blankLineCount: ManuscriptBlankLineCount,
  ): void => {
    const view = viewRef.current;
    if (view === null || readOnly) {
      return;
    }
    const selection = view.state.selection.main;
    const from = selection.empty ? 0 : selection.from;
    const to = selection.empty ? view.state.doc.length : selection.to;
    const source = view.state.doc.sliceString(from, to);
    const result = formatManuscriptBlankLines(source, blankLineCount);
    if (result === source) {
      view.focus();
      return;
    }
    view.dispatch({
      changes: { from, to, insert: result },
      ...(selection.empty
        ? {}
        : {
            selection: EditorSelection.single(from, from + result.length),
          }),
      scrollIntoView: true,
      annotations: [
        Transaction.userEvent.of("input.format.blank-lines"),
        isolateHistory.of("full"),
      ],
    });
    view.focus();
  };

  return (
    <div className="manuscript-editor-shell">
      <div
        aria-label="원고 편집 도구"
        className="manuscript-formatting-toolbar"
        role="toolbar"
      >
        <div className="formatting-toolbar-row formatting-toolbar-row-primary">
        <div aria-label="실행 기록" className="formatting-toolbar-group">
          <button
            aria-label="실행 취소"
            disabled={readOnly}
            onClick={() => runHistoryCommand(undo)}
            onMouseDown={(event) => event.preventDefault()}
            title="실행 취소 (Ctrl+Z)"
            type="button"
          >
            <Undo2 aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="다시 실행"
            disabled={readOnly}
            onClick={() => runHistoryCommand(redo)}
            onMouseDown={(event) => event.preventDefault()}
            title="다시 실행 (Ctrl+Y)"
            type="button"
          >
            <Redo2 aria-hidden="true" size={16} />
          </button>
        </div>

        <span aria-hidden="true" className="formatting-toolbar-divider" />

        <div aria-label="글꼴" className="formatting-toolbar-group">
          <label>
            <span className="visually-hidden">본문 글꼴</span>
            <select
              aria-label="본문 글꼴"
              className="manuscript-font-family-select"
              disabled={readOnly}
              onChange={(event) =>
                dispatchFormattingEffect(
                  setManuscriptFontFamilyEffect.of(event.target.value),
                )
              }
              value={activeFormatting.fontFamilyId}
            >
              {formattingProfile.fontFamilies.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">글자 크기</span>
            <select
              aria-label="글자 크기"
              className="manuscript-font-size-select"
              disabled={readOnly}
              onChange={(event) =>
                dispatchFormattingEffect(
                  setManuscriptFontSizeEffect.of(Number(event.target.value)),
                )
              }
              value={activeFormatting.fontSizePx}
            >
              {formattingProfile.fontSizesPx.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="글자 크기 줄이기"
            disabled={readOnly || activeFontSizeIndex <= 0}
            onClick={() => changeFontSize(-1)}
            onMouseDown={(event) => event.preventDefault()}
            title="글자 크기 줄이기"
            type="button"
          >
            <Minus aria-hidden="true" size={14} />
          </button>
          <button
            aria-label="글자 크기 늘리기"
            disabled={
              readOnly ||
              activeFontSizeIndex >= formattingProfile.fontSizesPx.length - 1
            }
            onClick={() => changeFontSize(1)}
            onMouseDown={(event) => event.preventDefault()}
            title="글자 크기 늘리기"
            type="button"
          >
            <Plus aria-hidden="true" size={14} />
          </button>
        </div>

        <div aria-label="문자 서식" className="formatting-toolbar-group">
          <button
            aria-label="굵게"
            aria-pressed={activeFormatting.bold}
            disabled={readOnly}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              dispatchFormattingEffect(
                toggleManuscriptStyleEffect.of("bold"),
              )
            }
            title="굵게 (Ctrl+B)"
            type="button"
          >
            <Bold aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="기울임"
            aria-pressed={activeFormatting.italic}
            disabled={readOnly}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              dispatchFormattingEffect(
                toggleManuscriptStyleEffect.of("italic"),
              )
            }
            title="기울임 (Ctrl+I)"
            type="button"
          >
            <Italic aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="밑줄"
            aria-pressed={activeFormatting.underline}
            disabled={readOnly}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              dispatchFormattingEffect(
                toggleManuscriptStyleEffect.of("underline"),
              )
            }
            title="밑줄"
            type="button"
          >
            <Underline aria-hidden="true" size={16} />
          </button>
        </div>

        <div aria-label="색상" className="formatting-toolbar-group">
          <div className="toolbar-color-menu">
            <button
              aria-expanded={colorMenu === "text"}
              aria-haspopup="dialog"
              aria-label="글자색"
              className="toolbar-color-trigger"
              disabled={readOnly}
              onClick={() =>
                setColorMenu((current) => current === "text" ? null : "text")
              }
              onMouseDown={(event) => event.preventDefault()}
              style={{ "--toolbar-color": activeFormatting.textColor } as CSSProperties}
              title="글자색"
              type="button"
            >
              <Palette aria-hidden="true" size={16} />
            </button>
            {colorMenu === "text" && (
              <div
                aria-label="글자색 선택"
                className="toolbar-color-popover"
                role="dialog"
              >
                <label>
                  <span>색상</span>
                  <input
                    aria-label="글자색 선택값"
                    disabled={readOnly}
                    onChange={(event) => {
                      dispatchFormattingEffect(
                        setManuscriptTextColorEffect.of(event.target.value),
                        false,
                      );
                      setColorMenu(null);
                    }}
                    type="color"
                    value={activeFormatting.textColor}
                  />
                </label>
                <button
                  disabled={readOnly}
                  onClick={() => {
                    dispatchFormattingEffect(setManuscriptTextColorEffect.of(null));
                    setColorMenu(null);
                  }}
                  type="button"
                >
                  기본색
                </button>
              </div>
            )}
          </div>
          <div className="toolbar-color-menu">
            <button
              aria-expanded={colorMenu === "highlight"}
              aria-haspopup="dialog"
              aria-label="강조색"
              className="toolbar-color-trigger"
              disabled={readOnly}
              onClick={() =>
                setColorMenu((current) =>
                  current === "highlight" ? null : "highlight"
                )
              }
              onMouseDown={(event) => event.preventDefault()}
              style={{
                "--toolbar-color":
                  activeFormatting.highlightColor ??
                  formattingProfile.defaults.highlightColor,
              } as CSSProperties}
              title="강조색"
              type="button"
            >
              <Highlighter aria-hidden="true" size={16} />
            </button>
            {colorMenu === "highlight" && (
              <div
                aria-label="강조색 선택"
                className="toolbar-color-popover"
                role="dialog"
              >
                <label>
                  <span>색상</span>
                  <input
                    aria-label="강조색 선택값"
                    disabled={readOnly}
                    onChange={(event) =>
                      dispatchFormattingEffect(
                        setManuscriptHighlightColorEffect.of(event.target.value),
                        false,
                      )
                    }
                    type="color"
                    value={
                      activeFormatting.highlightColor ??
                      formattingProfile.defaults.highlightColor
                    }
                  />
                </label>
                <button
                  aria-label="강조색 적용"
                  disabled={readOnly}
                  onClick={() => {
                    dispatchFormattingEffect(
                      setManuscriptHighlightColorEffect.of(
                        activeFormatting.highlightColor ??
                          formattingProfile.defaults.highlightColor,
                      ),
                    );
                    setColorMenu(null);
                  }}
                  type="button"
                >
                  현재 색 적용
                </button>
                <button
                  disabled={readOnly || activeFormatting.highlightColor === null}
                  onClick={() => {
                    dispatchFormattingEffect(
                      setManuscriptHighlightColorEffect.of(null),
                    );
                    setColorMenu(null);
                  }}
                  type="button"
                >
                  없음
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          aria-expanded={additionalToolsVisible}
          aria-label={
            additionalToolsVisible ? "추가 서식 도구 열림" : "추가 서식 도구 열기"
          }
          className="formatting-toolbar-more"
          onClick={() => setAdditionalToolsVisible((visible) => !visible)}
          onMouseDown={(event) => event.preventDefault()}
          title="추가 서식 도구"
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={17} />
        </button>
        </div>
      </div>

      {additionalToolsVisible && (
        <div
          className="formatting-tools-popover-layer"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setAdditionalToolsVisible(false);
            }
          }}
        >
          <section
            aria-label="추가 서식 도구"
            aria-modal="false"
            className="formatting-tools-popover"
            role="dialog"
          >
            <header className="formatting-tools-popover-header">
              <strong>추가 서식</strong>
              <button
                aria-label="추가 서식 도구 닫기"
                onClick={() => setAdditionalToolsVisible(false)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </header>
            <div className="formatting-toolbar-row formatting-toolbar-row-secondary">

        <div aria-label="문단 정렬" className="formatting-toolbar-group">
          <button
            aria-label="왼쪽 정렬"
            aria-pressed={activeFormatting.paragraphAlignment === "left"}
            disabled={readOnly}
            onClick={() =>
              dispatchFormattingEffect(
                setManuscriptParagraphAlignmentEffect.of("left"),
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            title="왼쪽 정렬"
            type="button"
          >
            <AlignLeft aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="가운데 정렬"
            aria-pressed={activeFormatting.paragraphAlignment === "center"}
            disabled={readOnly}
            onClick={() =>
              dispatchFormattingEffect(
                setManuscriptParagraphAlignmentEffect.of("center"),
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            title="가운데 정렬"
            type="button"
          >
            <AlignCenter aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="오른쪽 정렬"
            aria-pressed={activeFormatting.paragraphAlignment === "right"}
            disabled={readOnly}
            onClick={() =>
              dispatchFormattingEffect(
                setManuscriptParagraphAlignmentEffect.of("right"),
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            title="오른쪽 정렬"
            type="button"
          >
            <AlignRight aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="양쪽 정렬"
            aria-pressed={activeFormatting.paragraphAlignment === "justify"}
            disabled={readOnly}
            onClick={() =>
              dispatchFormattingEffect(
                setManuscriptParagraphAlignmentEffect.of("justify"),
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            title="양쪽 정렬"
            type="button"
          >
            <AlignJustify aria-hidden="true" size={16} />
          </button>
        </div>

        <div aria-label="간격 설정" className="formatting-toolbar-group">
          <label>
            <span className="visually-hidden">행간</span>
            <select
              aria-label="행간"
              disabled={readOnly}
              onChange={(event) =>
                dispatchFormattingEffect(
                  setManuscriptLineHeightEffect.of(Number(event.target.value)),
                )
              }
              value={activeFormatting.lineHeight}
            >
              {formattingProfile.lineHeights.map((lineHeight) => (
                <option key={lineHeight} value={lineHeight}>
                  행간 {lineHeight}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">문단 간격</span>
            <select
              aria-label="문단 간격"
              disabled={readOnly}
              onChange={(event) =>
                dispatchFormattingEffect(
                  setManuscriptParagraphSpacingEffect.of(
                    Number(event.target.value),
                  ),
                )
              }
              value={activeFormatting.paragraphSpacingPx}
            >
              {formattingProfile.paragraphSpacingsPx.map((spacing) => (
                <option key={spacing} value={spacing}>
                  문단 {spacing}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">자간</span>
            <select
              aria-label="자간"
              disabled={readOnly}
              onChange={(event) =>
                dispatchFormattingEffect(
                  setManuscriptLetterSpacingEffect.of(
                    Number(event.target.value),
                  ),
                )
              }
              value={activeFormatting.letterSpacingEm}
            >
              {formattingProfile.letterSpacingsEm.map((spacing) => (
                <option key={spacing} value={spacing}>
                  자간 {Math.round(spacing * 100)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div aria-label="빈 줄 서식" className="formatting-toolbar-group">
          <button
            className="toolbar-text-button"
            disabled={readOnly}
            onClick={() => applyBlankLineFormatting(1)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            1줄 띄우기
          </button>
          <button
            className="toolbar-text-button"
            disabled={readOnly}
            onClick={() => applyBlankLineFormatting(2)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            2줄 띄우기
          </button>
          <button
            className="toolbar-text-button"
            disabled={readOnly}
            onClick={() => applyBlankLineFormatting(0)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            빈줄 제거
          </button>
        </div>

        <span aria-hidden="true" className="formatting-toolbar-divider" />

        <label className="manuscript-width-control">
          <span>본문 폭</span>
          <input
            aria-label="본문 폭"
            disabled={readOnly}
            max={formattingProfile.contentWidthRangePx.max}
            min={formattingProfile.contentWidthRangePx.min}
            onChange={(event) =>
              dispatchFormattingEffect(
                setManuscriptContentWidthEffect.of(Number(event.target.value)),
                false,
              )
            }
            step={formattingProfile.contentWidthRangePx.step}
            type="range"
            value={activeFormatting.contentWidthPx}
          />
          <output>{activeFormatting.contentWidthPx}px</output>
        </label>

        <span aria-hidden="true" className="formatting-toolbar-divider" />

        <div aria-label="원고 도구" className="formatting-toolbar-group">
          {onHeatmapModeChange !== undefined && (
            <label className="toolbar-heatmap-control">
              <span>히트맵</span>
              <select
                aria-label="히트맵"
                disabled={readOnly}
                onChange={(event) =>
                  onHeatmapModeChange(event.target.value as ManuscriptHeatmapMode)
                }
                value={heatmapMode}
              >
                <option value="off">꺼짐</option>
                <option value="sentence">문장 길이</option>
                <option value="word">반복 단어</option>
              </select>
            </label>
          )}
          {onOpenAnalysis !== undefined && (
            <button
              className="toolbar-text-button"
              disabled={readOnly}
              onClick={onOpenAnalysis}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              원고 분석
            </button>
          )}
          {onImportText !== undefined && (
            <button
              className="toolbar-text-button"
              disabled={readOnly}
              onClick={onImportText}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              TXT 가져오기
            </button>
          )}
          {onOpenBulkExport !== undefined && (
            <button
              className="toolbar-text-button"
              disabled={readOnly}
              onClick={onOpenBulkExport}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              전체 다운로드
            </button>
          )}
          <button
            className="toolbar-text-button"
            disabled={readOnly}
            onClick={onOpenContinuousReading}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            연속 읽기
          </button>
          <button
            className="toolbar-text-button"
            disabled={readOnly}
            onClick={onOpenPreflight}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            원고 점검
          </button>
        </div>
            </div>
          </section>
        </div>
      )}
      <div
        className="manuscript-editor-canvas"
        data-current-paragraph-highlight={
          highlightCurrentParagraph ? "true" : undefined
        }
        data-manuscript-focus={manuscriptFocusActive ? "true" : undefined}
        data-cursor-follow={cursorFollowEnabled ? "true" : undefined}
        style={
          {
            "--manuscript-content-width": `${activeFormatting.contentWidthPx}px`,
            ...(manuscriptFocus?.active === true
              ? {
                  "--manuscript-focus-width": `${manuscriptFocus.manuscriptWidthPx}px`,
                  "--manuscript-focus-font-size": `${
                    activeFormatting.fontSizePx *
                    (manuscriptFocus.textScalePercent / 100)
                  }px`,
                }
              : {}),
          } as CSSProperties
        }
      >
        <div className="manuscript-editor" ref={hostRef} />
      </div>
      {contextMenu !== null && (
        <ManuscriptContextMenu
          clientX={contextMenu.clientX}
          clientY={contextMenu.clientY}
          copyDisabled={!contextMenu.canCopy}
          cutDisabled={!contextMenu.canCut}
          mergeSceneDisabled={!contextMenu.canMergeScene}
          canonReviewDisabled={contextMenu.canonReviewSelection === null}
          continuityDisabled={contextMenu.canonReviewSelection === null}
          characterKnowledgeDisabled={contextMenu.canonReviewSelection === null}
          onAddEvent={notifyAddEvent}
          onAddScene={notifyAddScene}
          onCanonReview={() => {
            const document = activeDocumentRef.current;
            if (document !== null && contextMenu.canonReviewSelection !== null) {
              notifyCanonReview(document, contextMenu.canonReviewSelection);
            }
          }}
          onContinuityManual={() => {
            const document = activeDocumentRef.current;
            if (document !== null && contextMenu.canonReviewSelection !== null) {
              notifyContinuityManual(document, contextMenu.canonReviewSelection);
            }
          }}
          onContinuityReview={() => {
            const document = activeDocumentRef.current;
            if (document !== null && contextMenu.canonReviewSelection !== null) {
              notifyContinuityReview(document, contextMenu.canonReviewSelection);
            }
          }}
          onCharacterKnowledge={() => {
            const document = activeDocumentRef.current;
            if (document !== null && contextMenu.canonReviewSelection !== null) {
              notifyCharacterKnowledge(document, contextMenu.canonReviewSelection);
            }
          }}
          onMergeScene={() => {
            const view = viewRef.current;
            if (view !== null) {
              view.dispatch({
                selection: EditorSelection.cursor(contextMenu.sceneOffset),
              });
            }
            const document = activeDocumentRef.current;
            if (document !== null) {
              notifyMergeScene(document, contextMenu.sceneOffset);
            }
          }}
          onSplitScene={() => {
            const view = viewRef.current;
            if (view !== null) {
              view.dispatch({
                selection: EditorSelection.cursor(contextMenu.sceneOffset),
              });
            }
            const document = activeDocumentRef.current;
            if (document !== null) {
              notifySplitScene(document, contextMenu.sceneOffset);
            }
          }}
          onCopy={() => copyOrCutSelection(false)}
          onCut={() => copyOrCutSelection(true)}
          onMoveToNextEpisode={notifyMoveToNextEpisode}
          onPaste={pasteClipboardText}
          pasteDisabled={!contextMenu.canPaste}
          moveToNextEpisodeDisabled={!contextMenu.canMoveToNextEpisode}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
});
