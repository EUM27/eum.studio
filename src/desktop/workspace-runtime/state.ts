import type { ManuscriptResumeCheckpointProjection } from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { ManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import type { WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import type { MutableDocumentSaveTarget } from "./state-contracts";

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

  get catalog(): WorkspaceCatalogProjection { return this.#catalog; }
  get documentProfile(): ManuscriptDocumentProfile { return this.#documentProfile; }
  get resumeProjection(): ManuscriptResumeCheckpointProjection { return this.#resumeProjection; }
  get documentTargets(): ReadonlyMap<EntityId<"Document">, MutableDocumentSaveTarget> {
    return this.#documentTargets;
  }

  replaceCatalog(catalog: WorkspaceCatalogProjection): void { this.#catalog = catalog; }
  replaceDocumentProfile(profile: ManuscriptDocumentProfile): void { this.#documentProfile = profile; }
  replaceResumeProjection(projection: ManuscriptResumeCheckpointProjection): void {
    this.#resumeProjection = projection;
  }
  clearDocumentTargets(): void { this.#documentTargets.clear(); }
  installDocumentTarget(documentId: EntityId<"Document">, target: MutableDocumentSaveTarget): void {
    this.#documentTargets.set(documentId, target);
  }
}
