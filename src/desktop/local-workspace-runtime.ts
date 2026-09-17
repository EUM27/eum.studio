import { composeWorkspaceRuntime } from "./workspace-runtime/composition";
import type { LocalWorkspaceRuntime,LocalWorkspaceRuntimeOptions } from "./workspace-runtime/contracts";
import { openWorkspaceStorage } from "./workspace-runtime/storage";

export type { LocalWorkspaceRuntime,LocalWorkspaceRuntimeOptions } from "./workspace-runtime/contracts";
export { createLocalWorkspaceRevisionBlobProfile,createLocalWorkspaceStorageProfiles,LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY } from "./workspace-runtime/storage-profiles";

/** Open storage, compose responsibility owners, and expose only the existing API. */
export async function openLocalWorkspaceRuntime(
  options: LocalWorkspaceRuntimeOptions,
): Promise<LocalWorkspaceRuntime> {
  const storage = await openWorkspaceStorage(options);
  try {
    const runtime = composeWorkspaceRuntime(storage, options);
    await runtime.initialize();
    return runtime.facade;
  } catch (error) {
    storage.database.close();
    storage.ledger.close();
    throw error;
  }
}
