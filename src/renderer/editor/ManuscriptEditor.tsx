import { history, historyKeymap } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
} from "react";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type { ManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import { ManuscriptDocumentStateRegistry } from "./manuscript-document-state";
import { createManuscriptInputRules } from "./manuscript-input-rules";
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

export type ManuscriptDocumentStateSummary = {
  readonly statistics: ManuscriptTextStatistics;
  readonly selection: ManuscriptSelection;
};

export type ManuscriptEditorProps = {
  readonly accessibleName: string;
  readonly activeDocument: ManuscriptDocumentSource;
  readonly inputProfile: ManuscriptInputProfile;
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
  ) => void;
};

export type ManuscriptEditorHandle = {
  readonly materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string;
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
    inputProfile,
    onBlur,
    onCompositionEnd,
    onDocumentActivated,
    onTransaction,
    readOnly,
    resumeLocation,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialDocumentRef = useRef(activeDocument);
  const activeDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const pendingDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const stateRegistryRef = useRef(new ManuscriptDocumentStateRegistry());
  const readOnlyCompartmentRef = useRef(
    new Compartment(),
  );
  const notifyBlur = useEffectEvent(onBlur);
  const notifyCompositionEnd = useEffectEvent(onCompositionEnd);
  const notifyDocumentActivated = useEffectEvent(onDocumentActivated);
  const notifyTransaction = useEffectEvent(onTransaction);
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
        const storedText =
          stateRegistryRef.current.materialize(document);
        const view = viewRef.current;
        const active = activeDocumentRef.current;
        if (
          view !== null &&
          active?.documentId === document.documentId
        ) {
          return view.state.doc.toString();
        }
        return storedText ?? document.initialText;
      },
    }),
    [],
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
                );
              }
            }
            publishSelectionEvidence(
              update.state,
            );
          }),
        ],
      }),
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
          notifyDocumentActivated(
            document,
            summarizeState(view.state),
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
      if (nextSnapshot.scrollSnapshot !== null) {
        view.dispatch({ effects: nextSnapshot.scrollSnapshot });
      }
      notifyDocumentActivated(document, summarizeState(view.state));
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

  return <div className="manuscript-editor" ref={hostRef} />;
});
