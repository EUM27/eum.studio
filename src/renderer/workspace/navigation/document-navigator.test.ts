import { describe, expect, it } from "vitest";

import { entityId } from "../../../domain/writing";
import { DocumentNavigator } from "./DocumentNavigator";
import { createCanonEvidenceNavigationTarget } from "./useWorkspaceFeatureNavigationController";
import type {
  DocumentNavigationActivationOutcome,
  DocumentNavigationDocument,
  DocumentNavigationPorts,
  DocumentNavigationTarget,
  DocumentNavigationWorkspaceSnapshot,
} from "./document-target";

function navigationDocument(
  documentSuffix: string,
  workSuffix = "shared",
): DocumentNavigationDocument {
  return Object.freeze({
    workId: entityId<"Work">(`work-${workSuffix}`),
    documentId: entityId<"Document">(`document-${documentSuffix}`),
  });
}

function workspaceSnapshot(
  activeWorkId: DocumentNavigationDocument["workId"] | null,
  activeDocument: DocumentNavigationDocument | null,
  documents: readonly DocumentNavigationDocument[],
  editorDocument: DocumentNavigationDocument | null = activeDocument,
): DocumentNavigationWorkspaceSnapshot {
  return Object.freeze({
    activeWorkId,
    activeDocument,
    editorDocument,
    documents: Object.freeze([...documents]),
  });
}

function orchestrationPorts(
  getWorkspaceSnapshot: () => DocumentNavigationWorkspaceSnapshot,
  overrides: Partial<DocumentNavigationPorts> = {},
): DocumentNavigationPorts {
  const defaults: DocumentNavigationPorts = {
    activateWorkspaceLocation: async () => "activated",
    applyTabPolicy: () => "applied",
    ensureSurface: () => "ready",
    getCurrentRevision: () => null,
    getWorkspaceSnapshot,
    placeCursor: () => "revealed",
    revealPreviewOffset: () => "revealed",
    selectRange: () => "revealed",
  };
  return Object.freeze({ ...defaults, ...overrides });
}

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      if (resolvePromise === null) throw new Error("Deferred is unavailable");
      resolvePromise(value);
    },
  };
}

describe("canon evidence navigation target", () => {
  it("keeps the evidence Work, revision, and exact range intact", () => {
    const workId = entityId<"Work">("work-canon-evidence");
    expect(createCanonEvidenceNavigationTarget(workId, {
      documentId: entityId<"Document">("document-navigation"),
      documentRevisionId: entityId<"DocumentRevision">("revision-navigation"),
      from: 7,
      to: 19,
      exactText: "정확한 근거 원문",
    })).toEqual({
      kind: "exact-selection",
      workId,
      documentId: "document-navigation",
      documentRevisionId: "revision-navigation",
      range: { from: 7, to: 19 },
    });
  });

  it("rejects empty or invalid evidence ranges", () => {
    const workId = entityId<"Work">("work-canon-evidence");
    expect(createCanonEvidenceNavigationTarget(workId, {
      documentId: entityId<"Document">("document-navigation"),
      documentRevisionId: entityId<"DocumentRevision">("revision-navigation"),
      from: 7,
      to: 7,
      exactText: "",
    })).toBeNull();
  });
});

describe("DocumentNavigator", () => {
  it("validates active Work ownership and document membership before activation", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("owned", "target");
    const otherWork = navigationDocument("other", "other");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "document",
      ...document,
    });
    let activationCalls = 0;
    const activateWorkspaceLocation = async () => {
      activationCalls += 1;
      return "activated" as const;
    };

    await expect(navigator.open(
      { target },
      orchestrationPorts(
        () => workspaceSnapshot(otherWork.workId, otherWork, [document]),
        { activateWorkspaceLocation },
      ),
    )).resolves.toEqual({
      status: "blocked",
      reason: "inactive-work",
    });
    await expect(navigator.open(
      { target },
      orchestrationPorts(
        () => workspaceSnapshot(document.workId, null, []),
        { activateWorkspaceLocation },
      ),
    )).resolves.toEqual({ status: "missing-document" });
    expect(activationCalls).toBe(0);
  });

  it("rejects unsafe, negative, and reversed locations before activation", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("invalid");
    const snapshot = workspaceSnapshot(document.workId, document, [document]);
    let activationCalls = 0;
    const ports = orchestrationPorts(() => snapshot, {
      activateWorkspaceLocation: async () => {
        activationCalls += 1;
        return "activated";
      },
    });
    const reversedSelection: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...document,
      range: Object.freeze({ from: 9, to: 3 }),
    });
    const unsafePreview: DocumentNavigationTarget = Object.freeze({
      kind: "current-preview-offset",
      ...document,
      offset: Number.MAX_SAFE_INTEGER + 1,
    });
    const negativeCursor: DocumentNavigationTarget = Object.freeze({
      kind: "exact-cursor",
      ...document,
      documentRevisionId: entityId<"DocumentRevision">("revision-invalid"),
      offset: -1,
    });

    await expect(navigator.open({ target: reversedSelection }, ports))
      .resolves.toEqual({ status: "invalid-range" });
    await expect(navigator.open({ target: unsafePreview }, ports))
      .resolves.toEqual({ status: "invalid-location" });
    await expect(navigator.open({ target: negativeCursor }, ports))
      .resolves.toEqual({ status: "invalid-location" });
    expect(activationCalls).toBe(0);
  });

  it("waits for a matching editor activation before opening a plain cross-document target", async () => {
    const navigator = new DocumentNavigator();
    const first = navigationDocument("plain-first");
    const targetDocument = navigationDocument("plain-target");
    let snapshot = workspaceSnapshot(first.workId, first, [first, targetDocument]);
    const tabbed: DocumentNavigationDocument[] = [];
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "document",
      ...targetDocument,
    });
    const ports = orchestrationPorts(() => snapshot, {
      activateWorkspaceLocation: async (document) => {
        snapshot = workspaceSnapshot(
          targetDocument.workId,
          document,
          [first, targetDocument],
        );
        return "activated";
      },
      applyTabPolicy: (document) => {
        tabbed.push(document);
        return "applied";
      },
    });

    let settled = false;
    const opening = navigator.open({ target }, ports);
    void opening.then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(tabbed).toEqual([]);
    navigator.notifyEditorActivated(targetDocument);
    await expect(opening).resolves.toEqual({
      status: "opened",
      path: "cross-document",
      reveal: "none",
    });
    expect(tabbed).toEqual([targetDocument]);
  });

  it("opens a snapshot-installed same-document exact selection with two revision checks", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("same-selection");
    const revisionId = entityId<"DocumentRevision">("revision-same-selection");
    const range = Object.freeze({ from: 11, to: 19 });
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "exact-selection",
      ...document,
      documentRevisionId: revisionId,
      range,
    });
    let revisionChecks = 0;
    let activationCalls = 0;
    const selected: Array<Readonly<{
      document: DocumentNavigationDocument;
      range: Readonly<{ from: number; to: number }>;
    }>> = [];
    const ports = orchestrationPorts(
      () => workspaceSnapshot(document.workId, document, [document]),
      {
        activateWorkspaceLocation: async () => {
          activationCalls += 1;
          return "activated";
        },
        getCurrentRevision: () => {
          revisionChecks += 1;
          return revisionId;
        },
        selectRange: (selectedDocument, selectedRange) => {
          selected.push({ document: selectedDocument, range: selectedRange });
          return "revealed";
        },
      },
    );
    await expect(navigator.open({ target }, ports)).resolves.toEqual({
      status: "opened",
      path: "same-document",
      reveal: "exact-selection",
    });
    expect(revisionChecks).toBe(2);
    expect(activationCalls).toBe(0);
    expect(selected).toEqual([{ document, range }]);
  });

  it("opens a committed same-document visible transition without another activation notify", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("surface-transition");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "current-preview-offset",
      ...document,
      offset: 37,
    });
    let snapshot = workspaceSnapshot(
      document.workId,
      document,
      [document],
      null,
    );
    const surfaceCommit = deferred<"transitioned">();
    let previewCalls = 0;
    const ports = orchestrationPorts(
      () => snapshot,
      {
        ensureSurface: () => surfaceCommit.promise,
        revealPreviewOffset: () => {
          previewCalls += 1;
          return "revealed";
        },
      },
    );
    let settled = false;
    const opening = navigator.open({ target }, ports);
    void opening.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(previewCalls).toBe(0);
    snapshot = workspaceSnapshot(document.workId, document, [document]);
    surfaceCommit.resolve("transitioned");
    await expect(opening).resolves.toEqual({
      status: "opened",
      path: "visible-transition",
      reveal: "current-preview-offset",
    });
    expect(previewCalls).toBe(1);
  });

  it("blocks a same-document reveal when the installed editor identity mismatches", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("editor-target");
    const otherDocument = navigationDocument("editor-other");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...document,
      range: Object.freeze({ from: 2, to: 5 }),
    });
    let revealCalls = 0;

    await expect(navigator.open(
      { target },
      orchestrationPorts(
        () => workspaceSnapshot(
          document.workId,
          document,
          [document, otherDocument],
          otherDocument,
        ),
        {
          ensureSurface: async () => "ready" as const,
          selectRange: () => {
            revealCalls += 1;
            return "revealed";
          },
        },
      ),
    )).resolves.toEqual({
      status: "blocked",
      reason: "editor-unavailable",
    });
    expect(revealCalls).toBe(0);
  });

  it("returns a neutral block when the requested surface is unavailable", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("surface-blocked");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "document",
      ...document,
    });

    await expect(navigator.open(
      { target },
      orchestrationPorts(
        () => workspaceSnapshot(document.workId, document, [document]),
        { ensureSurface: () => "blocked" },
      ),
    )).resolves.toEqual({
      status: "blocked",
      reason: "surface-unavailable",
    });
  });

  it("waits for a matching cross-document editor activation before revealing", async () => {
    const navigator = new DocumentNavigator();
    const first = navigationDocument("ready-first");
    const targetDocument = navigationDocument("ready-target");
    let snapshot = workspaceSnapshot(first.workId, first, [first, targetDocument]);
    const selectedDocuments: DocumentNavigationDocument[] = [];
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...targetDocument,
      range: Object.freeze({ from: 5, to: 13 }),
    });
    const ports = orchestrationPorts(() => snapshot, {
      activateWorkspaceLocation: async (document) => {
        snapshot = workspaceSnapshot(
          targetDocument.workId,
          document,
          [first, targetDocument],
        );
        return "activated";
      },
      selectRange: (document) => {
        selectedDocuments.push(document);
        return "revealed";
      },
    });
    let settled = false;
    const opening = navigator.open({ target }, ports);
    void opening.then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
    navigator.notifyEditorActivated(first);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(selectedDocuments).toEqual([]);
    navigator.notifyEditorActivated(targetDocument);
    await expect(opening).resolves.toEqual({
      status: "opened",
      path: "cross-document",
      reveal: "current-selection",
    });
    expect(selectedDocuments).toEqual([targetDocument]);
  });

  it("rejects a stale exact revision before activation", async () => {
    const navigator = new DocumentNavigator();
    const first = navigationDocument("pre-stale-first");
    const targetDocument = navigationDocument("pre-stale-target");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "exact-cursor",
      ...targetDocument,
      documentRevisionId: entityId<"DocumentRevision">("revision-expected"),
      offset: 23,
    });
    let activationCalls = 0;
    const ports = orchestrationPorts(
      () => workspaceSnapshot(first.workId, first, [first, targetDocument]),
      {
        activateWorkspaceLocation: async () => {
          activationCalls += 1;
          return "activated";
        },
        getCurrentRevision: () =>
          entityId<"DocumentRevision">("revision-current"),
      },
    );

    await expect(navigator.open({ target }, ports)).resolves.toEqual({
      status: "stale-revision",
    });
    expect(activationCalls).toBe(0);
  });

  it("rejects an exact revision that becomes stale after editor installation", async () => {
    const navigator = new DocumentNavigator();
    const first = navigationDocument("post-stale-first");
    const targetDocument = navigationDocument("post-stale-target");
    const expectedRevision = entityId<"DocumentRevision">(
      "revision-post-expected",
    );
    let currentRevision = expectedRevision;
    let snapshot = workspaceSnapshot(first.workId, first, [first, targetDocument]);
    let revisionChecks = 0;
    let tabCalls = 0;
    let previewCalls = 0;
    const activation = deferred<DocumentNavigationActivationOutcome>();
    const activationStarted = deferred<void>();
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "exact-preview-offset",
      ...targetDocument,
      documentRevisionId: expectedRevision,
      offset: 41,
    });
    const ports = orchestrationPorts(() => snapshot, {
      activateWorkspaceLocation: (document) => {
        snapshot = workspaceSnapshot(
          targetDocument.workId,
          document,
          [first, targetDocument],
        );
        activationStarted.resolve(undefined);
        return activation.promise;
      },
      applyTabPolicy: () => {
        tabCalls += 1;
        return "applied";
      },
      getCurrentRevision: () => {
        revisionChecks += 1;
        return currentRevision;
      },
      revealPreviewOffset: () => {
        previewCalls += 1;
        return "revealed";
      },
    });
    const opening = navigator.open({ target }, ports);
    await activationStarted.promise;
    expect(revisionChecks).toBe(1);
    currentRevision = entityId<"DocumentRevision">("revision-post-newer");
    activation.resolve("activated");
    await Promise.resolve();
    navigator.notifyEditorActivated(targetDocument);

    await expect(opening).resolves.toEqual({ status: "stale-revision" });
    expect(revisionChecks).toBe(2);
    expect(tabCalls).toBe(0);
    expect(previewCalls).toBe(0);
  });

  it("returns a neutral block when cross-document activation fails", async () => {
    const navigator = new DocumentNavigator();
    const first = navigationDocument("activation-first");
    const targetDocument = navigationDocument("activation-target");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...targetDocument,
      range: Object.freeze({ from: 1, to: 2 }),
    });
    let tabCalls = 0;
    const ports = orchestrationPorts(
      () => workspaceSnapshot(first.workId, first, [first, targetDocument]),
      {
        activateWorkspaceLocation: async () => "blocked",
        applyTabPolicy: () => {
          tabCalls += 1;
          return "applied";
        },
      },
    );

    await expect(navigator.open({ target }, ports)).resolves.toEqual({
      status: "blocked",
      reason: "activation-rejected",
    });
    expect(tabCalls).toBe(0);
  });

  it("returns a neutral block when the installed editor rejects reveal", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("reveal-blocked");
    const target: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...document,
      range: Object.freeze({ from: 2, to: 7 }),
    });
    navigator.notifyEditorActivated(document);

    await expect(navigator.open(
      { target },
      orchestrationPorts(
        () => workspaceSnapshot(document.workId, document, [document]),
        { selectRange: () => "blocked" },
      ),
    )).resolves.toEqual({
      status: "blocked",
      reason: "reveal-rejected",
    });
  });

  it("maps invalid range and offset reveals to distinct neutral results", async () => {
    const navigator = new DocumentNavigator();
    const document = navigationDocument("invalid-reveal");
    const snapshot = workspaceSnapshot(document.workId, document, [document]);
    const selectionTarget: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...document,
      range: Object.freeze({ from: 3, to: 9 }),
    });
    const previewTarget: DocumentNavigationTarget = Object.freeze({
      kind: "current-preview-offset",
      ...document,
      offset: 17,
    });

    await expect(navigator.open(
      { target: selectionTarget },
      orchestrationPorts(
        () => snapshot,
        { selectRange: () => "invalid-location" },
      ),
    )).resolves.toEqual({ status: "invalid-range" });
    await expect(navigator.open(
      { target: previewTarget },
      orchestrationPorts(
        () => snapshot,
        { revealPreviewOffset: () => "invalid-location" },
      ),
    )).resolves.toEqual({ status: "invalid-location" });
  });

  it("supersedes an older activation and prevents its stale tab and reveal", async () => {
    const navigator = new DocumentNavigator();
    const olderDocument = navigationDocument("superseded-older");
    const newerDocument = navigationDocument("superseded-newer");
    const snapshot = workspaceSnapshot(
      newerDocument.workId,
      newerDocument,
      [olderDocument, newerDocument],
    );
    const activation = deferred<DocumentNavigationActivationOutcome>();
    const activationStarted = deferred<void>();
    const tabbedDocuments: DocumentNavigationDocument[] = [];
    const selectedDocuments: DocumentNavigationDocument[] = [];
    const ports = orchestrationPorts(() => snapshot, {
      activateWorkspaceLocation: () => {
        activationStarted.resolve(undefined);
        return activation.promise;
      },
      applyTabPolicy: (document) => {
        tabbedDocuments.push(document);
        return "applied";
      },
      selectRange: (document) => {
        selectedDocuments.push(document);
        return "revealed";
      },
    });
    const olderTarget: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...olderDocument,
      range: Object.freeze({ from: 3, to: 8 }),
    });
    const newerTarget: DocumentNavigationTarget = Object.freeze({
      kind: "current-selection",
      ...newerDocument,
      range: Object.freeze({ from: 13, to: 21 }),
    });
    navigator.notifyEditorActivated(newerDocument);

    const olderOpening = navigator.open({ target: olderTarget }, ports);
    await activationStarted.promise;
    const newerOpening = navigator.open({ target: newerTarget }, ports);
    await expect(olderOpening).resolves.toEqual({ status: "superseded" });
    await expect(newerOpening).resolves.toEqual({
      status: "opened",
      path: "same-document",
      reveal: "current-selection",
    });
    activation.resolve("activated");
    await Promise.resolve();
    await Promise.resolve();
    navigator.notifyEditorActivated(olderDocument);

    expect(tabbedDocuments).toEqual([newerDocument]);
    expect(selectedDocuments).toEqual([newerDocument]);
  });

});
