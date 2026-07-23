import { history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
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
  readonly onDocumentActivated: (
    document: ManuscriptDocumentSource,
    summary: ManuscriptDocumentStateSummary,
  ) => void;
  readonly onTransaction: (
    document: ManuscriptDocumentSource,
    transaction: ManuscriptTransaction,
    statistics: ManuscriptTextStatistics,
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
    onDocumentActivated,
    onTransaction,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialDocumentRef = useRef(activeDocument);
  const activeDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const pendingDocumentRef = useRef<ManuscriptDocumentSource | null>(null);
  const stateRegistryRef = useRef(new ManuscriptDocumentStateRegistry());
  const notifyDocumentActivated = useEffectEvent(onDocumentActivated);
  const notifyTransaction = useEffectEvent(onTransaction);
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
        extensions: [
          manuscriptTextStatisticsExtension,
          history(),
          keymap.of(historyKeymap),
          EditorView.lineWrapping,
          createManuscriptInputRules(inputProfile),
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
                );
              }
            }
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
        stateRegistryRef.current.restore(document, createDocumentState);
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
      const nextSnapshot = stateRegistryRef.current.restore(
        document,
        createDocumentState,
      );
      activeDocumentRef.current = document;
      view.setState(nextSnapshot.state);
      if (nextSnapshot.scrollSnapshot !== null) {
        view.dispatch({ effects: nextSnapshot.scrollSnapshot });
      }
      notifyDocumentActivated(document, summarizeState(view.state));
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

    const handleCompositionEnd = () => {
      const pendingDocument = pendingDocumentRef.current;
      if (pendingDocument !== null) {
        pendingDocumentRef.current = null;
        queueMicrotask(() => activateDocument(pendingDocument));
      }
    };
    view.contentDOM.addEventListener("compositionend", handleCompositionEnd);

    return () => {
      const currentDocument = activeDocumentRef.current;
      if (currentDocument !== null) {
        stateRegistry.save(currentDocument, {
          state: view.state,
          scrollSnapshot: view.scrollSnapshot(),
        });
      }
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

  return <div className="manuscript-editor" ref={hostRef} />;
});
