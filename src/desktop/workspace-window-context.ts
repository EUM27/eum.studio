import { AsyncLocalStorage } from "node:async_hooks";

import type { ManuscriptResumeCheckpointProjection } from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { WorkspaceCatalogProjection } from "../application/workspace/workspace-contract";

/** Created by main, never accepted from an IPC payload. Storage stays shared. */
export type WorkspaceWindowContext = {
  readonly webContentsId: number;
  multipleWindows?: boolean;
  location?: Pick<WorkspaceCatalogProjection, "activeWorkId" | "activeDocumentId">;
  resumeProjection?: ManuscriptResumeCheckpointProjection;
};

export const workspaceWindowContext = new AsyncLocalStorage<WorkspaceWindowContext>();
