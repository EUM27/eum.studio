import type { LocalWorkspaceBackupMode,LocalWorkspaceBackupStatusProjection,LocalWorkspaceBackupSummary } from "../../../application/storage/local-workspace-backup-contract";
import type { LocalWorkspaceBackupService } from "../../local-workspace-backup-service";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { InfrastructureService } from "./infrastructure";

/** Owns backup commands and their existing transaction boundaries. */
export class BackupService {
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #backupService: LocalWorkspaceBackupService;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly operations: WorkspaceOperationCoordinator;
    readonly backupService: LocalWorkspaceBackupService;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#operations = input.operations;
    this.#backupService = input.backupService;
    this.#infrastructure = input.infrastructure;
  }

  getBackupStatus(): Promise<LocalWorkspaceBackupStatusProjection> {
    this.#infrastructure.assertOpen();
    return this.#operations.readBarrier().then(() =>
      this.#backupService.getStatus(),
    );
  }

  createBackupBundle(
    finalBundleRoot: string,
    mode: LocalWorkspaceBackupMode = "complete",
  ): Promise<LocalWorkspaceBackupSummary> {
    this.#infrastructure.assertOpen();
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#backupService.createBundle(finalBundleRoot, mode);
    });

    return execution;
  }

  restoreBackupBundle(
    finalBundleRoot: string,
    targetFinalRoot: string,
  ): Promise<LocalWorkspaceBackupSummary> {
    this.#infrastructure.assertOpen();
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#backupService.restoreBundle(
        finalBundleRoot,
        targetFinalRoot,
      );
    });

    return execution;
  }
}

