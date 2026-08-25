import type {
  ManuscriptDocumentProfile,
  ManuscriptDocumentSource,
} from "../../../application/editor/manuscript-document-profile";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import {
  closeDocumentTab,
  openDocumentTab,
  projectDocumentTabs,
  type CloseDocumentTabResult,
  type DocumentTabSession,
} from "../../document-tab-state";

export type WorkspaceSessionSelectionSource = Readonly<{
  catalog: WorkspaceCatalogProjection;
  documentProfile: ManuscriptDocumentProfile;
  activeDocumentId:
    ManuscriptDocumentProfile["initialDocumentId"] | null;
}>;

export type WorkspaceSessionSelection = Readonly<{
  activeWork: WorkspaceWorkSummary | undefined;
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWorkId: WorkspaceWorkSummary["workId"] | null;
}>;

export type DocumentNavigationWorkspaceSnapshot = Readonly<{
  activeWorkId: WorkspaceCatalogProjection["activeWorkId"];
  activeDocument: ManuscriptDocumentSource | null;
  documents: readonly ManuscriptDocumentSource[];
}>;

export type InstalledEditorDocumentIdentity = Readonly<{
  workId: ManuscriptDocumentSource["workId"];
  documentId: ManuscriptDocumentSource["documentId"];
}>;

export function selectWorkspaceSessionSelection(
  source: WorkspaceSessionSelectionSource | null,
): WorkspaceSessionSelection {
  if (source === null) {
    return Object.freeze({
      activeWork: undefined,
      activeDocument: undefined,
      activeWorkId: null,
    });
  }
  const activeWork = source.catalog.activeWorkId === null
    ? undefined
    : source.catalog.works.find(
        (work) => work.workId === source.catalog.activeWorkId,
      );
  const activeDocument = source.activeDocumentId === null
    ? undefined
    : source.documentProfile.documents.find(
        (document) => document.documentId === source.activeDocumentId,
      );
  return Object.freeze({
    activeWork,
    activeDocument,
    activeWorkId: activeWork?.workId ?? null,
  });
}

export function createDocumentNavigationWorkspaceSnapshot(input: Readonly<{
  source: Pick<
    WorkspaceSessionSelectionSource,
    "catalog" | "documentProfile"
  > | null;
  activeDocument: ManuscriptDocumentSource | undefined;
}>): DocumentNavigationWorkspaceSnapshot {
  if (input.source === null) {
    return Object.freeze({
      activeWorkId: null,
      activeDocument: null,
      documents: Object.freeze([]),
    });
  }
  return Object.freeze({
    activeWorkId: input.source.catalog.activeWorkId,
    activeDocument: input.activeDocument ?? null,
    documents: input.source.documentProfile.documents,
  });
}

export function selectWorkspaceSessionOpenDocumentIds(input: Readonly<{
  session: DocumentTabSession;
  activeWorkId: string | null;
  orderedDocumentIds: readonly string[];
  activeDocumentId: string | null;
}>): readonly string[] {
  return projectDocumentTabs({
    session: input.session,
    workId: input.activeWorkId,
    orderedDocumentIds: input.orderedDocumentIds,
    activeDocumentId: input.activeDocumentId,
  });
}

export function createInstalledEditorDocumentIdentity(
  document: InstalledEditorDocumentIdentity,
): InstalledEditorDocumentIdentity {
  return Object.freeze({
    workId: document.workId,
    documentId: document.documentId,
  });
}

export function matchesInstalledEditorDocumentIdentity(
  installed: InstalledEditorDocumentIdentity | null,
  target: InstalledEditorDocumentIdentity,
): boolean {
  return installed !== null &&
    installed.workId === target.workId &&
    installed.documentId === target.documentId;
}

export function openWorkspaceSessionDocumentTab(input: Readonly<{
  session: DocumentTabSession;
  workId: string;
  orderedDocumentIds: readonly string[];
  activeDocumentId: string;
  documentId: string;
}>): DocumentTabSession {
  return openDocumentTab(input);
}

export function closeWorkspaceSessionDocumentTab(input: Readonly<{
  session: DocumentTabSession;
  workId: string;
  orderedDocumentIds: readonly string[];
  activeDocumentId: string;
  documentId: string;
}>): CloseDocumentTabResult {
  return closeDocumentTab(input);
}
