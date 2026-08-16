import { randomInt, randomUUID } from "node:crypto";

import { history, undoDepth } from "@codemirror/commands";
import { EditorState, StateEffect } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import { ManuscriptDocumentStateRegistry } from "./manuscript-document-state";

function createDocument(
  overrides: Partial<ManuscriptDocumentSource> = {},
): ManuscriptDocumentSource {
  return {
    workId: entityId<"Work">(randomUUID()),
    documentId: entityId<"Document">(randomUUID()),
    documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
    label: randomUUID(),
    initialText: randomUUID(),
    ...overrides,
  };
}

function createState(document: ManuscriptDocumentSource): EditorState {
  return EditorState.create({
    doc: document.initialText,
    extensions: [history()],
  });
}

describe("manuscript document state registry", () => {
  it("restores each document's text, selection, history, and view snapshot independently", () => {
    const firstDocument = createDocument();
    const secondDocument = createDocument({
      workId: firstDocument.workId,
    });
    const registry = new ManuscriptDocumentStateRegistry();
    const scrollEffect = StateEffect.define<number>();
    const firstScroll = scrollEffect.of(randomInt(1, 1_000));
    const secondScroll = scrollEffect.of(randomInt(1_001, 2_000));

    let firstState = registry.restore(firstDocument, createState).state;
    const firstInsert = randomUUID();
    const firstCursor = firstState.doc.length + firstInsert.length;
    firstState = firstState.update({
      changes: { from: firstState.doc.length, insert: firstInsert },
      selection: { anchor: firstCursor, head: firstState.doc.length },
    }).state;
    registry.save(firstDocument, {
      state: firstState,
      scrollSnapshot: firstScroll,
    });

    let secondState = registry.restore(secondDocument, createState).state;
    const secondInsert = randomUUID();
    secondState = secondState.update({
      changes: { from: secondState.doc.length, insert: secondInsert },
    }).state;
    registry.save(secondDocument, {
      state: secondState,
      scrollSnapshot: secondScroll,
    });

    const restoredFirst = registry.restore(firstDocument, createState);
    expect(restoredFirst.state).toBe(firstState);
    expect(restoredFirst.state.doc.toString()).toBe(
      `${firstDocument.initialText}${firstInsert}`,
    );
    expect(restoredFirst.state.selection.main.anchor).toBe(firstCursor);
    expect(restoredFirst.state.selection.main.head).toBe(
      firstDocument.initialText.length,
    );
    expect(undoDepth(restoredFirst.state)).toBe(1);
    expect(restoredFirst.scrollSnapshot).toBe(firstScroll);

    const restoredSecond = registry.restore(secondDocument, createState);
    expect(restoredSecond.state).toBe(secondState);
    expect(restoredSecond.state.doc.toString()).toBe(
      `${secondDocument.initialText}${secondInsert}`,
    );
    expect(undoDepth(restoredSecond.state)).toBe(1);
    expect(restoredSecond.scrollSnapshot).toBe(secondScroll);
  });

  it("rejects reuse of a document identity across Work or revision ownership", () => {
    const document = createDocument();
    const registry = new ManuscriptDocumentStateRegistry();
    const initial = registry.restore(document, createState);
    registry.save(document, initial);

    expect(() =>
      registry.restore(
        createDocument({ documentId: document.documentId }),
        createState,
      ),
    ).toThrow(/ownership/);
    expect(() =>
      registry.restore(
        createDocument({
          workId: document.workId,
          documentId: document.documentId,
        }),
        createState,
      ),
    ).toThrow(/revision/);
  });

  it("materializes a saved document only when a caller requests its current text", () => {
    const document = createDocument();
    const registry = new ManuscriptDocumentStateRegistry();
    const insertedText = randomUUID();

    expect(registry.materialize(document)).toBeNull();

    const state = createState(document).update({
      changes: {
        from: document.initialText.length,
        insert: insertedText,
      },
    }).state;
    registry.save(document, {
      state,
      scrollSnapshot: null,
    });

    expect(registry.materialize(document)).toBe(
      `${document.initialText}${insertedText}`,
    );
    expect(() =>
      registry.materialize(
        createDocument({ documentId: document.documentId }),
      ),
    ).toThrow(/ownership/);
  });

  it("replaces a stored EditorState only through an explicit confirmed revision source", () => {
    const document = createDocument();
    const registry = new ManuscriptDocumentStateRegistry();
    const editedState = createState(document).update({
      changes: {
        from: document.initialText.length,
        insert: randomUUID(),
      },
    }).state;
    registry.save(document, {
      state: editedState,
      scrollSnapshot: null,
    });
    const confirmedDocument = createDocument({
      workId: document.workId,
      documentId: document.documentId,
    });

    expect(() =>
      registry.restore(
        confirmedDocument,
        createState,
      ),
    ).toThrow(/revision/);

    const replacement =
      registry.restoreConfirmedSource(
        confirmedDocument,
        createState,
      );

    expect(replacement.state).not.toBe(
      editedState,
    );
    expect(
      replacement.state.doc.toString(),
    ).toBe(confirmedDocument.initialText);
    expect(undoDepth(replacement.state)).toBe(0);
    expect(
      registry.restore(
        confirmedDocument,
        createState,
      ).state,
    ).toBe(replacement.state);
    expect(() =>
      registry.restoreConfirmedSource(
        createDocument({
          documentId: document.documentId,
        }),
        createState,
      ),
    ).toThrow(/ownership/);
  });

  it("preserves editor state when a confirmed durable revision has the exact saved text", () => {
    const document = createDocument();
    const registry = new ManuscriptDocumentStateRegistry();
    const scrollEffect = StateEffect.define<number>();
    const scrollSnapshot = scrollEffect.of(randomInt(1, 1_000));
    const insertedText = randomUUID();
    const savedState = createState(document).update({
      changes: {
        from: document.initialText.length,
        insert: insertedText,
      },
    }).state;
    registry.save(document, {
      state: savedState,
      scrollSnapshot,
    });
    const confirmedDocument = createDocument({
      workId: document.workId,
      documentId: document.documentId,
      initialText: savedState.doc.toString(),
    });

    const restored = registry.restoreConfirmedSource(
      confirmedDocument,
      createState,
    );

    expect(restored.state).toBe(savedState);
    expect(restored.scrollSnapshot).toBe(scrollSnapshot);
    expect(undoDepth(restored.state)).toBe(1);
    expect(registry.materialize(confirmedDocument)).toBe(
      savedState.doc.toString(),
    );
  });
});
