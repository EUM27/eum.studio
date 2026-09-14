import type {
  ManuscriptResumeCheckpointProjection,
} from "../../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type {
  RuntimeInfo,
  StudioBridge,
} from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentProfile } from "../../../application/editor/manuscript-document-profile";
import type { ManuscriptFormattingProfile } from "../../../application/editor/manuscript-formatting";
import type { ManuscriptInputProfile } from "../../../application/editor/manuscript-input-profile";
import type { ManuscriptPreflightProfile } from "../../../application/editor/manuscript-preflight";
import type { FragmentShelfProfile } from "../../../application/fragments/fragment-contract";
import type { ForeshadowPointProfile } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { ManuscriptPersistenceProfile } from "../../../application/persistence/manuscript-persistence-profile";
import type { StartupRecoveryProjection } from "../../../application/persistence/startup-recovery-contract";
import type { WorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";

export type RuntimeBootstrapClient = Readonly<{
  system: Pick<StudioBridge["system"], "getRuntimeInfo">;
  editor: Pick<
    StudioBridge["editor"],
    | "getManuscriptInputProfile"
    | "getManuscriptFormattingProfile"
    | "getManuscriptPreflightProfile"
    | "getManuscriptDocumentProfile"
    | "getManuscriptPersistenceProfile"
    | "getManuscriptStartupRecovery"
    | "getManuscriptResumeCheckpoint"
  >;
  fragments: Pick<StudioBridge["fragments"], "getProfile">;
  foreshadowing: Pick<StudioBridge["foreshadowing"], "getPointProfile">;
  workspace: Pick<StudioBridge["workspace"], "getCatalog" | "shared">;
}>;

export type RuntimeProjection = {
  readonly info: RuntimeInfo;
  readonly inputProfile: ManuscriptInputProfile;
  readonly formattingProfile: ManuscriptFormattingProfile;
  readonly preflightProfile: ManuscriptPreflightProfile;
  readonly fragmentProfile: FragmentShelfProfile;
  readonly foreshadowPointProfile: ForeshadowPointProfile;
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly persistenceProfile:
    ManuscriptPersistenceProfile | null;
  readonly startupRecovery:
    StartupRecoveryProjection;
  readonly resumeCheckpoint:
    ManuscriptResumeCheckpointProjection;
  readonly catalog: WorkspaceCatalogProjection;
};

export class RuntimeBootstrapController {
  constructor(private readonly client: RuntimeBootstrapClient) {}

  async load(): Promise<RuntimeProjection> {
    const [
      info,
      inputProfile,
      formattingProfile,
      preflightProfile,
      fragmentProfile,
      foreshadowPointProfile,
      documentProfile,
      persistenceProfile,
      startupRecovery,
      resumeCheckpoint,
      catalog,
    ] = await Promise.all([
      this.client.system.getRuntimeInfo(),
      this.client.editor.getManuscriptInputProfile(),
      this.client.editor.getManuscriptFormattingProfile(),
      this.client.editor.getManuscriptPreflightProfile(),
      this.client.fragments.getProfile(),
      this.client.foreshadowing.getPointProfile(),
      this.client.editor.getManuscriptDocumentProfile(),
      this.client.editor.getManuscriptPersistenceProfile(),
      this.client.editor.getManuscriptStartupRecovery(),
      this.client.editor.getManuscriptResumeCheckpoint(),
      this.client.workspace.getCatalog(),
    ]);
    const shared = await this.client.workspace.shared?.getSnapshot();
    return Object.freeze({
      info,
      inputProfile,
      formattingProfile,
      preflightProfile,
      fragmentProfile,
      foreshadowPointProfile,
      documentProfile,
      persistenceProfile,
      startupRecovery,
      resumeCheckpoint,
      catalog,
      ...shared,
    });
  }
}
