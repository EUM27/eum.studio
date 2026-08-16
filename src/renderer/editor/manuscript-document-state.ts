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

function assertSameWork(
  stored: StoredDocumentState,
  document: ManuscriptDocumentSource,
): void {
  if (stored.workId !== document.workId) {
    throw new Error(
      `Document ownership conflict for ${document.documentId}`,
    );
  }
}

function freezeSnapshot(
  snapshot: ManuscriptDocumentViewSnapshot,
): ManuscriptDocumentViewSnapshot {
  return Object.freeze({ ...snapshot });
}

function rebindExactConfirmedRevision(
  stored: StoredDocumentState,
  document: ManuscriptDocumentSource,
): StoredDocumentState | null {
  assertSameWork(stored, document);
  if (stored.documentRevisionId === document.documentRevisionId) {
    return stored;
  }
  if (stored.state.doc.toString() !== document.initialText) {
    return null;
  }
  return Object.freeze({
    ...stored,
    documentRevisionId: document.documentRevisionId,
  });
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
    let stored = this.#states.get(document.documentId);
    if (stored === undefined) {
      return null;
    }
    const rebound = rebindExactConfirmedRevision(stored, document);
    if (rebound === null) {
      throw new Error(`Document revision conflict for ${document.documentId}`);
    }
    if (rebound !== stored) {
      this.#states.set(document.documentId, rebound);
      stored = rebound;
    }
    return stored.state.doc.toString();
  }

  readState(
    document: ManuscriptDocumentSource,
  ): EditorState | null {
    const stored = this.#states.get(document.documentId);
    if (stored === undefined) {
      return null;
    }
    assertSameSource(stored, document);
    return stored.state;
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

  restoreConfirmedSource(
    document: ManuscriptDocumentSource,
    createState: (document: ManuscriptDocumentSource) => EditorState,
  ): ManuscriptDocumentViewSnapshot {
    const stored = this.#states.get(document.documentId);
    if (stored === undefined) {
      return this.restore(document, createState);
    }
    const rebound = rebindExactConfirmedRevision(stored, document);
    if (rebound !== null) {
      if (rebound !== stored) {
        this.#states.set(document.documentId, rebound);
      }
      return freezeSnapshot(rebound);
    }

    const snapshot = freezeSnapshot({
      state: createState(document),
      scrollSnapshot: null,
    });
    this.#states.delete(document.documentId);
    this.save(document, snapshot);
    return snapshot;
  }
}
