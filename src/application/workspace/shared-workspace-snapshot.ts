import { parseManuscriptResumeCheckpointProjection } from "../checkpoints/manuscript-resume-checkpoint-projection";
import { parseManuscriptDocumentProfile } from "../editor/manuscript-document-profile";
import { parseManuscriptPersistenceProfile } from "../persistence/manuscript-persistence-profile";
import { parseWorkspaceCatalogProjection } from "./workspace-contract";

export const SHARED_WORKSPACE_SNAPSHOT_CHANNEL = "studio:workspace:shared-snapshot";
export const SHARED_WORKSPACE_CHANGED_CHANNEL = "studio:workspace:shared-changed";

export function parseSharedWorkspaceSnapshot(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Shared workspace snapshot must be an object");
  }
  const input = value as Record<string, unknown>;
  return Object.freeze({
    catalog: parseWorkspaceCatalogProjection(input.catalog),
    documentProfile: parseManuscriptDocumentProfile(input.documentProfile),
    persistenceProfile: parseManuscriptPersistenceProfile(input.persistenceProfile),
    resumeCheckpoint: parseManuscriptResumeCheckpointProjection(input.resumeCheckpoint),
  });
}

export type SharedWorkspaceSnapshot = ReturnType<typeof parseSharedWorkspaceSnapshot>;
export type SharedWorkspaceBridge = Readonly<{
  getSnapshot: () => Promise<SharedWorkspaceSnapshot>;
  onChanged: (listener: () => void) => () => void;
}>;
