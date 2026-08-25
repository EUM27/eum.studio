import type { EntityId } from "../../../domain/writing";

import type {
  DocumentNavigationBlockedReason,
  DocumentNavigationDocument,
  DocumentNavigationOpenRequest,
  DocumentNavigationOpenResult,
  DocumentNavigationPath,
  DocumentNavigationPorts,
  DocumentNavigationReveal,
  DocumentNavigationRevealOutcome,
  DocumentNavigationSurfaceOutcome,
  DocumentNavigationTarget,
  DocumentNavigationWorkspaceSnapshot,
} from "./document-target";

type DocumentNavigationOperation = {
  readonly document: DocumentNavigationDocument;
  readonly generation: number;
  readonly ports: DocumentNavigationPorts;
  readonly request: DocumentNavigationOpenRequest;
  readonly resolve: (result: DocumentNavigationOpenResult) => void;
  minimumEditorSequence: number;
  path: DocumentNavigationPath | null;
  phase: "running" | "waiting-editor" | "completing";
  settled: boolean;
};

type InstalledEditorDocument = Readonly<{
  document: DocumentNavigationDocument;
  sequence: number;
}>;

function sameDocument(
  first: DocumentNavigationDocument | null,
  second: DocumentNavigationDocument,
): boolean {
  return first !== null &&
    first.workId === second.workId &&
    first.documentId === second.documentId;
}

function safeOffset(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateTargetLocation(
  target: DocumentNavigationTarget,
): DocumentNavigationOpenResult | null {
  if (
    typeof target.workId !== "string" ||
    target.workId.length === 0 ||
    typeof target.documentId !== "string" ||
    target.documentId.length === 0
  ) {
    return { status: "invalid-location" };
  }
  switch (target.kind) {
    case "document":
      return null;
    case "exact-selection":
    case "current-selection":
      return safeOffset(target.range.from) &&
          safeOffset(target.range.to) &&
          target.range.from <= target.range.to
        ? null
        : { status: "invalid-range" };
    case "exact-cursor":
    case "exact-preview-offset":
    case "current-preview-offset":
      return safeOffset(target.offset)
        ? null
        : { status: "invalid-location" };
  }
}

function exactRevision(
  target: DocumentNavigationTarget,
): EntityId<"DocumentRevision"> | null {
  switch (target.kind) {
    case "exact-selection":
    case "exact-cursor":
    case "exact-preview-offset":
      return target.documentRevisionId;
    case "document":
    case "current-selection":
    case "current-preview-offset":
      return null;
  }
}

function revealKind(
  target: DocumentNavigationTarget,
): DocumentNavigationReveal {
  return target.kind === "document" ? "none" : target.kind;
}

export class DocumentNavigator {
  private activeOperation: DocumentNavigationOperation | null = null;
  private editorActivationSequence = 0;
  private generation = 0;
  private installedEditorDocument: InstalledEditorDocument | null = null;

  open(
    request: DocumentNavigationOpenRequest,
    ports: DocumentNavigationPorts,
  ): Promise<DocumentNavigationOpenResult> {
    this.generation += 1;
    const previous = this.activeOperation;
    if (previous !== null) {
      this.finish(previous, { status: "superseded" });
    }
    const operationGeneration = this.generation;
    const target = request.target;
    const document = Object.freeze({
      workId: target.workId,
      documentId: target.documentId,
    });
    return new Promise<DocumentNavigationOpenResult>((resolve) => {
      const operation: DocumentNavigationOperation = {
        document,
        generation: operationGeneration,
        minimumEditorSequence: 0,
        path: null,
        phase: "running",
        ports,
        request,
        resolve,
        settled: false,
      };
      this.activeOperation = operation;
      void this.run(operation);
    });
  }

  notifyEditorActivated(document: DocumentNavigationDocument): void {
    this.editorActivationSequence += 1;
    this.installedEditorDocument = Object.freeze({
      document: Object.freeze({ ...document }),
      sequence: this.editorActivationSequence,
    });
    const operation = this.activeOperation;
    if (operation !== null) {
      this.completeFromInstalledEditor(operation);
    }
  }

  private blocked(
    reason: DocumentNavigationBlockedReason,
  ): DocumentNavigationOpenResult {
    return { status: "blocked", reason };
  }

  private checkOwnership(
    snapshot: DocumentNavigationWorkspaceSnapshot,
    document: DocumentNavigationDocument,
  ): DocumentNavigationOpenResult | null {
    if (snapshot.activeWorkId !== document.workId) {
      return this.blocked("inactive-work");
    }
    return snapshot.documents.some((candidate) =>
        sameDocument(candidate, document)
      )
      ? null
      : { status: "missing-document" };
  }

  private checkRevision(
    operation: DocumentNavigationOperation,
  ): DocumentNavigationOpenResult | null {
    const requiredRevision = exactRevision(operation.request.target);
    if (requiredRevision === null) return null;
    try {
      return operation.ports.getCurrentRevision(operation.document) ===
          requiredRevision
        ? null
        : { status: "stale-revision" };
    } catch {
      return this.blocked("revision-unavailable");
    }
  }

  private completeFromInstalledEditor(
    operation: DocumentNavigationOperation,
  ): void {
    if (
      !this.isCurrent(operation) ||
      operation.phase !== "waiting-editor" ||
      operation.path === null
    ) {
      return;
    }
    if (operation.path === "cross-document") {
      const installed = this.installedEditorDocument;
      if (
        installed === null ||
        installed.sequence < operation.minimumEditorSequence ||
        !sameDocument(installed.document, operation.document)
      ) {
        return;
      }
    }
    operation.phase = "completing";
    const snapshot = this.readWorkspaceSnapshot(operation);
    if (snapshot === null) return;
    const ownership = this.checkOwnership(snapshot, operation.document);
    if (ownership !== null) {
      this.finish(operation, ownership);
      return;
    }
    if (!sameDocument(snapshot.editorDocument, operation.document)) {
      this.finish(operation, this.blocked("editor-unavailable"));
      return;
    }
    const revision = this.checkRevision(operation);
    if (revision !== null) {
      this.finish(operation, revision);
      return;
    }
    if (!this.applyTabPolicy(operation)) return;
    if (!this.isCurrent(operation)) return;
    let revealOutcome: DocumentNavigationRevealOutcome = "revealed";
    try {
      const target = operation.request.target;
      switch (target.kind) {
        case "document":
          break;
        case "exact-selection":
        case "current-selection":
          revealOutcome = operation.ports.selectRange(
            operation.document,
            target.range,
          );
          break;
        case "exact-cursor":
          revealOutcome = operation.ports.placeCursor(
            operation.document,
            target.offset,
          );
          break;
        case "exact-preview-offset":
        case "current-preview-offset":
          revealOutcome = operation.ports.revealPreviewOffset(
            operation.document,
            target.offset,
          );
          break;
      }
    } catch {
      revealOutcome = "blocked";
    }
    if (!this.isCurrent(operation)) return;
    if (revealOutcome === "invalid-location") {
      const target = operation.request.target;
      this.finish(operation, {
        status: target.kind === "exact-selection" ||
            target.kind === "current-selection"
          ? "invalid-range"
          : "invalid-location",
      });
      return;
    }
    if (revealOutcome === "blocked") {
      this.finish(operation, this.blocked("reveal-rejected"));
      return;
    }
    this.finish(operation, {
      status: "opened",
      path: operation.path,
      reveal: revealKind(operation.request.target),
    });
  }

  private applyTabPolicy(operation: DocumentNavigationOperation): boolean {
    try {
      if (operation.ports.applyTabPolicy(operation.document) === "applied") {
        return true;
      }
    } catch {
      // The neutral blocked result is returned below.
    }
    this.finish(operation, this.blocked("tab-policy-rejected"));
    return false;
  }

  private finish(
    operation: DocumentNavigationOperation,
    result: DocumentNavigationOpenResult,
  ): void {
    if (operation.settled) return;
    operation.settled = true;
    if (this.activeOperation === operation) {
      this.activeOperation = null;
    }
    operation.resolve(result);
  }

  private finishDocumentOpen(operation: DocumentNavigationOperation): void {
    if (!this.isCurrent(operation) || operation.path === null) return;
    const snapshot = this.readWorkspaceSnapshot(operation);
    if (snapshot === null) return;
    const ownership = this.checkOwnership(snapshot, operation.document);
    if (ownership !== null) {
      this.finish(operation, ownership);
      return;
    }
    if (!this.applyTabPolicy(operation) || !this.isCurrent(operation)) return;
    this.finish(operation, {
      status: "opened",
      path: operation.path,
      reveal: "none",
    });
  }

  private isCurrent(operation: DocumentNavigationOperation): boolean {
    return !operation.settled &&
      this.activeOperation === operation &&
      operation.generation === this.generation;
  }

  private readWorkspaceSnapshot(
    operation: DocumentNavigationOperation,
  ): DocumentNavigationWorkspaceSnapshot | null {
    try {
      return operation.ports.getWorkspaceSnapshot();
    } catch {
      this.finish(operation, this.blocked("workspace-unavailable"));
      return null;
    }
  }

  private async run(operation: DocumentNavigationOperation): Promise<void> {
    const invalid = validateTargetLocation(operation.request.target);
    if (invalid !== null) {
      this.finish(operation, invalid);
      return;
    }
    const initialSnapshot = this.readWorkspaceSnapshot(operation);
    if (initialSnapshot === null || !this.isCurrent(operation)) return;
    const initialOwnership = this.checkOwnership(
      initialSnapshot,
      operation.document,
    );
    if (initialOwnership !== null) {
      this.finish(operation, initialOwnership);
      return;
    }
    let surface: DocumentNavigationSurfaceOutcome;
    try {
      surface = await operation.ports.ensureSurface(operation.document);
    } catch {
      surface = "blocked";
    }
    if (!this.isCurrent(operation)) return;
    if (surface === "blocked") {
      this.finish(operation, this.blocked("surface-unavailable"));
      return;
    }
    const snapshot = this.readWorkspaceSnapshot(operation);
    if (snapshot === null || !this.isCurrent(operation)) return;
    const ownership = this.checkOwnership(snapshot, operation.document);
    if (ownership !== null) {
      this.finish(operation, ownership);
      return;
    }
    const revision = this.checkRevision(operation);
    if (revision !== null) {
      this.finish(operation, revision);
      return;
    }
    const activeDocumentMatches = sameDocument(
      snapshot.activeDocument,
      operation.document,
    );
    operation.path = activeDocumentMatches
      ? surface === "transitioned"
        ? "visible-transition"
        : "same-document"
      : "cross-document";
    if (operation.path !== "cross-document") {
      if (operation.request.target.kind === "document") {
        this.finishDocumentOpen(operation);
        return;
      }
      operation.phase = "waiting-editor";
      this.completeFromInstalledEditor(operation);
      return;
    }
    operation.minimumEditorSequence = this.editorActivationSequence + 1;
    let activated: boolean;
    try {
      activated = await operation.ports.activateWorkspaceLocation(
        operation.document,
      ) === "activated";
    } catch {
      activated = false;
    }
    if (!this.isCurrent(operation)) return;
    if (!activated) {
      this.finish(operation, this.blocked("activation-rejected"));
      return;
    }
    operation.phase = "waiting-editor";
    this.completeFromInstalledEditor(operation);
  }
}
