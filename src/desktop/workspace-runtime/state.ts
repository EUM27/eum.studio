import type { ManuscriptResumeCheckpointProjection } from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { ManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import type { WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import type { MutableDocumentSaveTarget } from "./state-contracts";
import { workspaceWindowContext } from "../workspace-window-context";

/** Current workspace identity and live save targets, shared by all responsibility owners. */
export class WorkspaceRuntimeState {
  #catalog: WorkspaceCatalogProjection;
  #documentProfile: ManuscriptDocumentProfile;
  #resumeProjection: ManuscriptResumeCheckpointProjection;
  readonly #documentTargets = new Map<EntityId<"Document">, MutableDocumentSaveTarget>();

  constructor(input: {
    readonly catalog: WorkspaceCatalogProjection;
    readonly documentProfile: ManuscriptDocumentProfile;
    readonly resumeProjection: ManuscriptResumeCheckpointProjection;
    readonly documentTargets: readonly MutableDocumentSaveTarget[];
  }) {
    this.#catalog = input.catalog;
    this.#documentProfile = input.documentProfile;
    this.#resumeProjection = input.resumeProjection;
    for (const target of input.documentTargets) {
      this.installDocumentTarget(target.documentId, target);
    }
  }

  get catalog(): WorkspaceCatalogProjection {
    const context = workspaceWindowContext.getStore();
    if (context === undefined) return this.#catalog;
    if (context.location?.activeWorkId === null && this.#catalog.activeWorkId !== null) {
      context.location = { activeWorkId: this.#catalog.activeWorkId, activeDocumentId: this.#catalog.activeDocumentId };
      context.resumeProjection = this.#resumeProjection;
    }
    context.location ??= {
      activeWorkId: this.#catalog.activeWorkId,
      activeDocumentId: this.#catalog.activeDocumentId,
    };
    context.resumeProjection ??= this.#resumeProjection;
    return Object.freeze({ ...this.#catalog, ...context.location });
  }
  get documentProfile(): ManuscriptDocumentProfile {
    if (workspaceWindowContext.getStore() === undefined) return this.#documentProfile;
    return Object.freeze({
      ...this.#documentProfile,
      initialDocumentId: this.catalog.activeDocumentId ?? this.#documentProfile.initialDocumentId,
    });
  }
  get resumeProjection(): ManuscriptResumeCheckpointProjection {
    const context = workspaceWindowContext.getStore();
    const resume = context?.resumeProjection ?? this.#resumeProjection;
    if (context !== undefined && "targetRevisionId" in resume &&
      this.#documentTargets.get(resume.documentId)?.currentRevisionId !== resume.targetRevisionId) {
      return Object.freeze({ schemaVersion: 1, status: "missing", workId: resume.workId });
    }
    return resume;
  }
  get documentTargets(): ReadonlyMap<EntityId<"Document">, MutableDocumentSaveTarget> {
    return this.#documentTargets;
  }

  replaceCatalog(catalog: WorkspaceCatalogProjection): void {
    const context = workspaceWindowContext.getStore();
    if (context !== undefined) context.location = {
      activeWorkId: catalog.activeWorkId,
      activeDocumentId: catalog.activeDocumentId,
    };
    this.#catalog = catalog;
  }
  replaceDocumentProfile(profile: ManuscriptDocumentProfile): void { this.#documentProfile = profile; }
  replaceResumeProjection(projection: ManuscriptResumeCheckpointProjection): void {
    const context = workspaceWindowContext.getStore();
    if (context !== undefined) context.resumeProjection = projection;
    this.#resumeProjection = projection;
  }
  clearDocumentTargets(): void { this.#documentTargets.clear(); }
  installDocumentTarget(documentId: EntityId<"Document">, target: MutableDocumentSaveTarget): void {
    this.#documentTargets.set(documentId, target);
  }
}
