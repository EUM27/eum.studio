import type { ManuscriptDocumentProfile } from "../../../application/editor/manuscript-document-profile";
import type { RuntimeProjection } from "./RuntimeBootstrapController";

export type WorkspaceRuntimeState =
  | Readonly<{ status: "loading" }>
  | (Readonly<{
      status: "ready";
      activeDocumentId:
        ManuscriptDocumentProfile["initialDocumentId"] | null;
    }> & RuntimeProjection)
  | Readonly<{ status: "error" }>;

export type WorkspaceRecoveryApplyState = "idle" | "applying" | "failed";
