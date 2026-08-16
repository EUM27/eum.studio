import { history, historyKeymap, redo, undo } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type StateEffect,
  Transaction,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
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
  transactionChangesManuscriptFormatting,
  type ActiveManuscriptFormatting,
} from "./manuscript-formatting-state";

export type ManuscriptDocumentStateSummary = {
  readonly statistics: ManuscriptTextStatistics;
  readonly selection: ManuscriptSelection;
};

export type ManuscriptEditorProps = {
  readonly accessibleName: string;
  readonly activeDocument: ManuscriptDocumentSource;
  readonly formattingProfile: ManuscriptFormattingProfile;
  readonly inputProfile: ManuscriptInputProfile;
  readonly loreEntries: readonly LoreEntryProjection[];
  readonly orderedDocuments: readonly ManuscriptDocumentSource[];
  readonly readOnly: boolean;
  readonly resumeLocation:
    | Extract<
        ManuscriptResumeCheckpointProjection,
        { readonly status: "resolved" }
      >
    | null;
  readonly onDocumentActivated: (
    document: ManuscriptDocumentSource,
    summary: ManuscriptDocumentStateSummary,
  ) => void;
  readonly onFormattingChange: (
    document: ManuscriptDocumentSource,
    state: ManuscriptEditorDocumentState,
  ) => void;
  readonly onLoreCueHover: (interaction: LoreCueInteraction | null) => void;
  readonly onOpenLoreCue: (cue: LoreCue) => void;
  readonly onOpenContinuousReading: () => void;
  readonly onOpenPreflight: () => void;
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
};

export type ManuscriptEditorHandle = {
  readonly materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string;
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
};

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
    formattingProfile,
    inputProfile,
    loreEntries,
    orderedDocuments,
    onBlur,
    onCompositionEnd,
    onDocumentActivated,
    onFormattingChange,
    onLoreCueHover,
    onOpenLoreCue,
    onOpenContinuousReading,
    onOpenPreflight,
    onTransaction,
    readOnly,
    resumeLocation,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialDocumentRef = useRef(activeDocument);
  const initialFormattingProfileRef = useRef(formattingProfile);
  const activeDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const pendingDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const stateRegistryRef = useRef(new ManuscriptDocumentStateRegistry());
  const orderedDocumentsRef = useRef(orderedDocuments);
  orderedDocumentsRef.current = orderedDocuments;
  const loreEntriesRef = useRef(loreEntries);
  loreEntriesRef.current = loreEntries;
  const [activeFormatting, setActiveFormatting] =
    useState<ActiveManuscriptFormatting>(() => ({
      bold: false,
      italic: false,
      underline: false,
      fontFamilyId: formattingProfile.defaults.fontFamilyId,
      fontSizePx: formattingProfile.defaults.fontSizePx,
      textColor: formattingProfile.defaults.textColor,
      highlightColor: null,
      contentWidthPx: formattingProfile.defaults.contentWidthPx,
      lineHeight: formattingProfile.defaults.lineHeight,
      paragraphSpacingPx: formattingProfile.defaults.paragraphSpacingPx,
      letterSpacingEm: formattingProfile.defaults.letterSpacingEm,
      paragraphAlignment: "left",
    }));
  const [additionalToolsVisible, setAdditionalToolsVisible] = useState(false);
  const readOnlyCompartmentRef = useRef(
    new Compartment(),
  );
  const notifyBlur = useEffectEvent(onBlur);
  const notifyCompositionEnd = useEffectEvent(onCompositionEnd);
  const notifyDocumentActivated = useEffectEvent(onDocumentActivated);
  const notifyFormattingChange = useEffectEvent(onFormattingChange);
  const notifyLoreCueHover = useEffectEvent(onLoreCueHover);
  const notifyOpenLoreCue = useEffectEvent(onOpenLoreCue);
  const notifyTransaction = useEffectEvent(onTransaction);
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
      orderedDocumentsRef.current,
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
          history(),
          keymap.of(historyKeymap),
          EditorView.lineWrapping,
          createPreviousEpisodeFlowExtension(
            readPreviousEpisodeFlow(document),
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
            document.editorStateJson === undefined
              ? createDefaultManuscriptEditorDocumentState(formattingProfile)
              : parseManuscriptEditorDocumentState(
                  JSON.parse(document.editorStateJson),
                  formattingProfile,
                  document.initialText.length,
                ),
          ),
          createManuscriptInputRules(inputProfile),
          readOnlyCompartmentRef.current.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          EditorView.contentAttributes.of({
            "aria-label": accessibleName,
            "aria-multiline": "true",
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
              if (transactionChangesManuscriptFormatting(transaction)) {
                notifyFormattingChange(
                  document,
                  readManuscriptEditorDocumentState(transaction.state),
                );
              }
            }
            setActiveFormatting(
              readActiveManuscriptFormatting(update.state, formattingProfile),
            );
            publishSelectionEvidence(
              update.state,
            );
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
            effects:
              readOnlyCompartmentRef.current.reconfigure([
                EditorState.readOnly.of(readOnly),
                EditorView.editable.of(!readOnly),
              ]),
          });
          syncPreviousEpisodeFlow(view, document);
          syncLoreCueContext(view, document);
          notifyDocumentActivated(
            document,
            summarizeState(view.state),
          );
          setActiveFormatting(
            readActiveManuscriptFormatting(view.state, formattingProfile),
          );
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
        effects:
          readOnlyCompartmentRef.current.reconfigure([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
      });
      syncPreviousEpisodeFlow(view, document);
      syncLoreCueContext(view, document);
      if (nextSnapshot.scrollSnapshot !== null) {
        view.dispatch({ effects: nextSnapshot.scrollSnapshot });
      }
      notifyDocumentActivated(document, summarizeState(view.state));
      setActiveFormatting(
        readActiveManuscriptFormatting(view.state, formattingProfile),
      );
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
    setActiveFormatting(
      readActiveManuscriptFormatting(
        view.state,
        initialFormattingProfileRef.current,
      ),
    );
    publishSelectionEvidence(view.state);

    const handleCompositionEnd = () => {
      const compositionDocument = activeDocumentRef.current;
      const pendingDocument = pendingDocumentRef.current;
      queueMicrotask(() => {
        if (compositionDocument !== null) {
          notifyCompositionEnd(compositionDocument);
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
    const document = activeDocumentRef.current;
    if (view !== null && document !== null) {
      syncPreviousEpisodeFlow(view, document);
    }
  }, [orderedDocuments]);

  useEffect(() => {
    const view = viewRef.current;
    const document = activeDocumentRef.current;
    if (view !== null && document !== null) {
      syncLoreCueContext(view, document);
    }
  }, [loreEntries]);

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
    command(view);
    view.focus();
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
          <label
            className="toolbar-color-picker"
            style={{ "--toolbar-color": activeFormatting.textColor } as CSSProperties}
            title="글자색"
          >
            <Palette aria-hidden="true" size={16} />
            <input
              aria-label="글자색"
              disabled={readOnly}
              onChange={(event) =>
                dispatchFormattingEffect(
                  setManuscriptTextColorEffect.of(event.target.value),
                  false,
                )
              }
              type="color"
              value={activeFormatting.textColor}
            />
          </label>
          <button
            aria-label="글자색 기본값"
            className="toolbar-compact-text-button"
            disabled={readOnly}
            onClick={() =>
              dispatchFormattingEffect(setManuscriptTextColorEffect.of(null))
            }
            onMouseDown={(event) => event.preventDefault()}
            title="글자색 지우기"
            type="button"
          >
            기본
          </button>
          <button
            aria-label="강조색 적용"
            disabled={readOnly}
            onClick={() =>
              dispatchFormattingEffect(
                setManuscriptHighlightColorEffect.of(
                  activeFormatting.highlightColor ??
                    formattingProfile.defaults.highlightColor,
                ),
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            title="현재 강조색 적용"
            type="button"
          >
            <Highlighter aria-hidden="true" size={16} />
          </button>
          <label
            className="toolbar-color-picker"
            style={{
              "--toolbar-color":
                activeFormatting.highlightColor ??
                formattingProfile.defaults.highlightColor,
            } as CSSProperties}
            title="강조색 선택"
          >
            <span aria-hidden="true">▼</span>
            <input
              aria-label="강조색"
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
            aria-label="강조색 없음"
            className="toolbar-compact-text-button"
            disabled={readOnly || activeFormatting.highlightColor === null}
            onClick={() =>
              dispatchFormattingEffect(
                setManuscriptHighlightColorEffect.of(null),
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            title="강조색 지우기"
            type="button"
          >
            없음
          </button>
        </div>
        <button
          aria-expanded={additionalToolsVisible}
          aria-label={
            additionalToolsVisible ? "추가 서식 도구 닫기" : "추가 서식 도구 열기"
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

        {additionalToolsVisible && (
        <div className="formatting-toolbar-row formatting-toolbar-row-secondary">
        <span aria-hidden="true" className="formatting-toolbar-divider" />

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
        )}
      </div>
      <div
        className="manuscript-editor-canvas"
        style={
          {
            "--manuscript-content-width": `${activeFormatting.contentWidthPx}px`,
          } as CSSProperties
        }
      >
        <div className="manuscript-editor" ref={hostRef} />
      </div>
    </div>
  );
});
