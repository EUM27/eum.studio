import type { EditorState, StateEffect } from "@codemirror/state";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type { EntityId } from "../../domain/writing";

export type ManuscriptDocumentViewSnapshot = {
  readonly state: EditorState;
  readonly scrollSnapshot: StateEffect<unknown> | null;
};

type StoredDocumentState = ManuscriptDocumentViewSnapshot & {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentRevisionId: ManuscriptDocumentSource["documentRevisionId"];
};

function assertSameSource(
  stored: StoredDocumentState,
  document: ManuscriptDocumentSource,
): void {
  if (stored.workId !== document.workId) {
    throw new Error(
      `Document ownership conflict for ${document.documentId}`,
    );
  }
  if (stored.documentRevisionId !== document.documentRevisionId) {
    throw new Error(`Document revision conflict for ${document.documentId}`);
  }
}

function freezeSnapshot(
  snapshot: ManuscriptDocumentViewSnapshot,
): ManuscriptDocumentViewSnapshot {
  return Object.freeze({ ...snapshot });
}

export class ManuscriptDocumentStateRegistry {
  readonly #states = new Map<
    EntityId<"Document">,
    StoredDocumentState
  >();

  save(
    document: ManuscriptDocumentSource,
    snapshot: ManuscriptDocumentViewSnapshot,
  ): void {
    const stored = this.#states.get(document.documentId);
    if (stored !== undefined) {
      assertSameSource(stored, document);
    }
    this.#states.set(
      document.documentId,
      Object.freeze({
        workId: document.workId,
        documentRevisionId: document.documentRevisionId,
        state: snapshot.state,
        scrollSnapshot: snapshot.scrollSnapshot,
      }),
    );
  }

  materialize(
    document: ManuscriptDocumentSource,
  ): string | null {
    const stored = this.#states.get(document.documentId);
    if (stored === undefined) {
      return null;
    }
    assertSameSource(stored, document);
    return stored.state.doc.toString();
  }

  restore(
    document: ManuscriptDocumentSource,
    createState: (document: ManuscriptDocumentSource) => EditorState,
  ): ManuscriptDocumentViewSnapshot {
    const stored = this.#states.get(document.documentId);
    if (stored !== undefined) {
      assertSameSource(stored, document);
      return freezeSnapshot(stored);
    }

    const snapshot = freezeSnapshot({
      state: createState(document),
      scrollSnapshot: null,
    });
    this.save(document, snapshot);
    return snapshot;
  }
}
