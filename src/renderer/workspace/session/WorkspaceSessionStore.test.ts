import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import { entityId } from "../../../domain/writing";
import {
  createDocumentNavigationWorkspaceSnapshot,
  selectWorkspaceSessionSelection,
  selectWorkspaceSessionOpenDocumentIds,
  type WorkspaceSessionSelectionSource,
} from "./WorkspaceSessionStore";

function work(suffix: string): WorkspaceWorkSummary {
  return {
    workId: entityId<"Work">(`work-${suffix}`),
    title: `작품 ${suffix}`,
    updatedAt: "2026-08-24T00:00:00.000Z",
    folders: [],
    documents: [],
  };
}

function document(
  workId: WorkspaceWorkSummary["workId"],
  suffix: string,
): ManuscriptDocumentSource {
  return {
    workId,
    documentId: entityId<"Document">(`document-${suffix}`),
    documentRevisionId: entityId<"DocumentRevision">(`revision-${suffix}`),
    label: `회차 ${suffix}`,
    initialText: `원고 ${suffix}`,
  };
}

function source(input: Readonly<{
  works: readonly WorkspaceWorkSummary[];
  documents: readonly ManuscriptDocumentSource[];
  activeWorkId: WorkspaceCatalogProjection["activeWorkId"];
  activeDocumentId: WorkspaceSessionSelectionSource["activeDocumentId"];
}>): WorkspaceSessionSelectionSource {
  return {
    catalog: {
      schemaVersion: 1,
      works: input.works,
      activeWorkId: input.activeWorkId,
      activeDocumentId: null,
      canCreateFirstWork: input.works.length === 0,
    },
    documentProfile: {
      schemaVersion: 1,
      initialDocumentId:
        input.documents[0]?.documentId ?? entityId<"Document">("initial"),
      documents: input.documents,
    },
    activeDocumentId: input.activeDocumentId,
  };
}

describe("workspace session selection", () => {
  it("returns one frozen empty snapshot for a null source", () => {
    const selection = selectWorkspaceSessionSelection(null);
    expect(selection).toEqual({
      activeWork: undefined,
      activeDocument: undefined,
      activeWorkId: null,
    });
    expect(Object.isFrozen(selection)).toBe(true);
  });

  it("delegates null Work or Document to an empty frozen tab projection", () => {
    const workId = "work-tabs";
    const documentId = "document-tabs";
    const session = Object.freeze({
      [workId]: Object.freeze([documentId]),
    });
    const orderedDocumentIds = Object.freeze([documentId]);
    const nullWork = selectWorkspaceSessionOpenDocumentIds({
      session,
      activeWorkId: null,
      orderedDocumentIds,
      activeDocumentId: documentId,
    });
    const nullDocument = selectWorkspaceSessionOpenDocumentIds({
      session,
      activeWorkId: workId,
      orderedDocumentIds,
      activeDocumentId: null,
    });
    expect(nullWork).toEqual([]);
    expect(nullDocument).toEqual([]);
    expect(Object.isFrozen(nullWork)).toBe(true);
    expect(Object.isFrozen(nullDocument)).toBe(true);
    expect(session[workId]).toEqual([documentId]);
    expect(orderedDocumentIds).toEqual([documentId]);
  });

  it("includes the active Document and removes stale duplicates in canonical order", () => {
    const workId = "work-tabs";
    const firstDocumentId = "document-first";
    const activeDocumentId = "document-active";
    const thirdDocumentId = "document-third";
    const staleDocumentId = "document-stale";
    const session = Object.freeze({
      [workId]: Object.freeze([
        staleDocumentId,
        thirdDocumentId,
        thirdDocumentId,
      ]),
    });
    const orderedDocumentIds = Object.freeze([
      firstDocumentId,
      activeDocumentId,
      thirdDocumentId,
    ]);
    const projected = selectWorkspaceSessionOpenDocumentIds({
      session,
      activeWorkId: workId,
      orderedDocumentIds,
      activeDocumentId,
    });
    expect(projected).toEqual([activeDocumentId, thirdDocumentId]);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(session[workId]).toEqual([
      staleDocumentId,
      thirdDocumentId,
      thirdDocumentId,
    ]);
    expect(orderedDocumentIds).toEqual([
      firstDocumentId,
      activeDocumentId,
      thirdDocumentId,
    ]);
  });

  it("keeps open Document IDs isolated to the requested Work", () => {
    const firstWorkId = "work-first";
    const secondWorkId = "work-second";
    const firstDocumentId = "document-first";
    const secondDocumentId = "document-second";
    const session = Object.freeze({
      [firstWorkId]: Object.freeze([firstDocumentId]),
      [secondWorkId]: Object.freeze([secondDocumentId]),
    });
    expect(selectWorkspaceSessionOpenDocumentIds({
      session,
      activeWorkId: firstWorkId,
      orderedDocumentIds: [firstDocumentId],
      activeDocumentId: firstDocumentId,
    })).toEqual([firstDocumentId]);
    expect(selectWorkspaceSessionOpenDocumentIds({
      session,
      activeWorkId: secondWorkId,
      orderedDocumentIds: [secondDocumentId],
      activeDocumentId: secondDocumentId,
    })).toEqual([secondDocumentId]);
  });

  it("preserves the existing non-owned active Document error", () => {
    const workId = "work-owned";
    const foreignDocumentId = "document-foreign";
    expect(() => selectWorkspaceSessionOpenDocumentIds({
      session: Object.freeze({}),
      activeWorkId: workId,
      orderedDocumentIds: Object.freeze(["document-owned"]),
      activeDocumentId: foreignDocumentId,
    })).toThrow(
      `The current Work does not own Document ${foreignDocumentId}`,
    );
  });

  it("creates a frozen null navigation snapshot with a new frozen empty array", () => {
    const workA = work("null");
    const documentA = document(workA.workId, "null");
    const first = createDocumentNavigationWorkspaceSnapshot({
      source: null,
      activeDocument: documentA,
    });
    const second = createDocumentNavigationWorkspaceSnapshot({
      source: null,
      activeDocument: undefined,
    });
    expect(first).toEqual({
      activeWorkId: null,
      activeDocument: null,
      documents: [],
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.documents)).toBe(true);
    expect(first.documents).not.toBe(second.documents);
  });

  it("preserves raw navigation identities, order, and cross-Work selection", () => {
    const workA = work("navigation-a");
    const workB = work("navigation-b");
    const documentA = document(workA.workId, "navigation-a");
    const documentB = document(workB.workId, "navigation-b");
    const documents = [documentB, documentA];
    const danglingWorkId = entityId<"Work">("work-navigation-dangling");
    const navigationSource = source({
      works: [workA, workB],
      documents,
      activeWorkId: danglingWorkId,
      activeDocumentId: documentA.documentId,
    });
    const snapshot = createDocumentNavigationWorkspaceSnapshot({
      source: navigationSource,
      activeDocument: documentB,
    });
    expect(snapshot.activeWorkId).toBe(danglingWorkId);
    expect(snapshot.activeDocument).toBe(documentB);
    expect(snapshot.documents).toBe(navigationSource.documentProfile.documents);
    expect(snapshot.documents).toEqual([documentB, documentA]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.documents)).toBe(false);
    expect("editorDocument" in snapshot).toBe(false);
    expect("documentTabSession" in snapshot).toBe(false);
  });

  it("selects exact Work and Document identities and derives the matched Work ID", () => {
    const workA = work("a");
    const documentA = document(workA.workId, "a");
    const selection = selectWorkspaceSessionSelection(source({
      works: [workA],
      documents: [documentA],
      activeWorkId: workA.workId,
      activeDocumentId: documentA.documentId,
    }));
    expect(selection.activeWork).toBe(workA);
    expect(selection.activeDocument).toBe(documentA);
    expect(selection.activeWorkId).toBe(workA.workId);
    expect(Object.isFrozen(selection)).toBe(true);
    expect(Object.isFrozen(workA)).toBe(false);
    expect(Object.isFrozen(documentA)).toBe(false);
  });

  it("keeps an exact Document when the requested Work is dangling", () => {
    const workA = work("a");
    const documentA = document(workA.workId, "a");
    const selection = selectWorkspaceSessionSelection(source({
      works: [workA],
      documents: [documentA],
      activeWorkId: entityId<"Work">("work-missing"),
      activeDocumentId: documentA.documentId,
    }));
    expect(selection.activeWork).toBeUndefined();
    expect(selection.activeWorkId).toBeNull();
    expect(selection.activeDocument).toBe(documentA);
  });

  it("does not replace a null or dangling requested Document", () => {
    const workA = work("a");
    const documentA = document(workA.workId, "a");
    const base = {
      works: [workA],
      documents: [documentA],
      activeWorkId: workA.workId,
    };
    expect(selectWorkspaceSessionSelection(source({
      ...base,
      activeDocumentId: null,
    })).activeDocument).toBeUndefined();
    expect(selectWorkspaceSessionSelection(source({
      ...base,
      activeDocumentId: entityId<"Document">("document-missing"),
    })).activeDocument).toBeUndefined();
  });

  it("selects Work and cross-Work Document independently without correction", () => {
    const workA = work("a");
    const workB = work("b");
    const documentA = document(workA.workId, "a");
    const documentB = document(workB.workId, "b");
    const selection = selectWorkspaceSessionSelection(source({
      works: [workA, workB],
      documents: [documentA, documentB],
      activeWorkId: workA.workId,
      activeDocumentId: documentB.documentId,
    }));
    expect(selection.activeWork).toBe(workA);
    expect(selection.activeWorkId).toBe(workA.workId);
    expect(selection.activeDocument).toBe(documentB);
  });

  it("keeps the store pure while session, navigation, document, and close slices own mutable lifecycle", () => {
    const storeSource = readFileSync(
      new URL("./WorkspaceSessionStore.ts", import.meta.url),
      "utf8",
    );
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const sessionHookSource = readFileSync(
      new URL("./useWorkspaceSession.ts", import.meta.url),
      "utf8",
    );
    const coreSource = readFileSync(
      new URL("../useWorkspaceCoreFeatureKernel.ts", import.meta.url),
      "utf8",
    );
    const navigatorSource = readFileSync(
      new URL("../navigation/useWorkspaceDocumentNavigatorController.ts", import.meta.url),
      "utf8",
    );
    const documentSource = readFileSync(
      new URL("../lifecycle/useWorkspaceDocumentController.ts", import.meta.url),
      "utf8",
    );
    const closeSource = readFileSync(
      new URL("./useWorkspaceCloseController.ts", import.meta.url),
      "utf8",
    );
    const runtimeProjectionSource = readFileSync(
      new URL("./useWorkspaceRuntimeProjectionController.ts", import.meta.url),
      "utf8",
    );

    expect(appSource.match(/selectWorkspaceSessionSelection\(/gu))
      .toHaveLength(1);
    expect(appSource.match(/createDocumentNavigationWorkspaceSnapshot\(/gu))
      .toHaveLength(1);
    expect(coreSource.match(/createDocumentNavigationWorkspaceSnapshot\(/gu))
      .toHaveLength(1);
    expect(coreSource.match(/selectWorkspaceSessionOpenDocumentIds\(/gu))
      .toHaveLength(1);
    expect(appSource).not.toContain("projectDocumentTabs(");

    expect(sessionHookSource).toContain(
      "const [runtime, setRuntime] = useState<WorkspaceRuntimeState>",
    );
    expect(sessionHookSource).toContain(
      "const [documentTabSession, setDocumentTabSession] = useState(",
    );
    expect(sessionHookSource).toContain("createDocumentTabSession");
    expect(documentSource).toContain("openWorkspaceSessionDocumentTab({");
    expect(documentSource).toContain("closeWorkspaceSessionDocumentTab({");
    expect(coreSource).toContain("const activeWorkDocumentIds = useMemo(");
    expect(coreSource).toContain("const openDocuments = useMemo(");

    expect(appSource).toContain("const [documentNavigator] = useState(");
    expect(appSource).toContain("documentNavigationWorkspaceRef");
    expect(appSource).toContain("installedEditorDocumentRef");
    expect(navigatorSource).toContain(
      "editorDocument: installedEditorDocumentRef.current",
    );
    expect(runtimeProjectionSource).toContain(
      "const installRuntimeProjection = useCallback(",
    );
    expect(closeSource).toContain("onManuscriptCloseRequest(");
    expect(navigatorSource).toContain(
      "const activateWorkspaceLocation = useCallback(",
    );
    expect(storeSource).not.toMatch(
      /React|useState|useEffect|useMemo|class |subscribe|setRuntime|Navigator|lifecycle|fallback|correct|throw /u,
    );
  });
});
