import type { EntityId } from "../../../domain/writing";

export type DocumentNavigationDocument = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
}>;

type DocumentNavigationTargetBase = DocumentNavigationDocument;

type RevisionBoundDocumentNavigationTarget = Readonly<{
  documentRevisionId: EntityId<"DocumentRevision">;
}>;

export type DocumentOpenTarget = Readonly<
  DocumentNavigationTargetBase & {
    kind: "document";
  }
>;

export type ExactSelectionDocumentTarget = Readonly<
  DocumentNavigationTargetBase &
    RevisionBoundDocumentNavigationTarget & {
      kind: "exact-selection";
      range: Readonly<{
        from: number;
        to: number;
      }>;
    }
>;

export type CurrentSelectionDocumentTarget = Readonly<
  DocumentNavigationTargetBase & {
    kind: "current-selection";
    range: Readonly<{
      from: number;
      to: number;
    }>;
  }
>;

export type ExactCursorDocumentTarget = Readonly<
  DocumentNavigationTargetBase &
    RevisionBoundDocumentNavigationTarget & {
      kind: "exact-cursor";
      offset: number;
    }
>;

export type ExactPreviewOffsetDocumentTarget = Readonly<
  DocumentNavigationTargetBase &
    RevisionBoundDocumentNavigationTarget & {
      kind: "exact-preview-offset";
      offset: number;
    }
>;

export type CurrentPreviewOffsetDocumentTarget = Readonly<
  DocumentNavigationTargetBase & {
    kind: "current-preview-offset";
    offset: number;
  }
>;

export type DocumentNavigationTarget =
  | DocumentOpenTarget
  | ExactSelectionDocumentTarget
  | CurrentSelectionDocumentTarget
  | ExactCursorDocumentTarget
  | ExactPreviewOffsetDocumentTarget
  | CurrentPreviewOffsetDocumentTarget;

export type DocumentNavigationOpenRequest = Readonly<{
  target: DocumentNavigationTarget;
}>;

export type DocumentNavigationWorkspaceSnapshot = Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  activeDocument: DocumentNavigationDocument | null;
  editorDocument: DocumentNavigationDocument | null;
  documents: readonly DocumentNavigationDocument[];
}>;

export type DocumentNavigationSurfaceOutcome =
  | "ready"
  | "transitioned"
  | "blocked";

export type DocumentNavigationActivationOutcome = "activated" | "blocked";

export type DocumentNavigationTabOutcome = "applied" | "blocked";

export type DocumentNavigationRevealOutcome =
  | "revealed"
  | "invalid-location"
  | "blocked";

export type DocumentNavigationPorts = Readonly<{
  getWorkspaceSnapshot: () => DocumentNavigationWorkspaceSnapshot;
  getCurrentRevision: (
    document: DocumentNavigationDocument,
  ) => EntityId<"DocumentRevision"> | null;
  ensureSurface: (
    document: DocumentNavigationDocument,
  ) => DocumentNavigationSurfaceOutcome |
    Promise<DocumentNavigationSurfaceOutcome>;
  activateWorkspaceLocation: (
    document: DocumentNavigationDocument,
  ) => Promise<DocumentNavigationActivationOutcome>;
  applyTabPolicy: (
    document: DocumentNavigationDocument,
  ) => DocumentNavigationTabOutcome;
  selectRange: (
    document: DocumentNavigationDocument,
    range: Readonly<{ from: number; to: number }>,
  ) => DocumentNavigationRevealOutcome;
  placeCursor: (
    document: DocumentNavigationDocument,
    offset: number,
  ) => DocumentNavigationRevealOutcome;
  revealPreviewOffset: (
    document: DocumentNavigationDocument,
    offset: number,
  ) => DocumentNavigationRevealOutcome;
}>;

export type DocumentNavigationPath =
  | "same-document"
  | "visible-transition"
  | "cross-document";

export type DocumentNavigationReveal =
  | "none"
  | "exact-selection"
  | "current-selection"
  | "exact-cursor"
  | "exact-preview-offset"
  | "current-preview-offset";

export type DocumentNavigationBlockedReason =
  | "workspace-unavailable"
  | "inactive-work"
  | "surface-unavailable"
  | "editor-unavailable"
  | "revision-unavailable"
  | "activation-rejected"
  | "tab-policy-rejected"
  | "reveal-rejected";

export type DocumentNavigationOpenResult =
  | Readonly<{
      status: "opened";
      path: DocumentNavigationPath;
      reveal: DocumentNavigationReveal;
    }>
  | Readonly<{ status: "superseded" }>
  | Readonly<{ status: "missing-document" }>
  | Readonly<{ status: "stale-revision" }>
  | Readonly<{ status: "invalid-range" }>
  | Readonly<{ status: "invalid-location" }>
  | Readonly<{
      status: "blocked";
      reason: DocumentNavigationBlockedReason;
    }>;
