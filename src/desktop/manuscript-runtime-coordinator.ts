import type { ManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptBatchingPolicy,
  type ManuscriptPersistenceProfile,
} from "../application/persistence/manuscript-persistence-profile";
import {
  projectStartupRecovery,
  type ApplyStartupRecoveryAcknowledgement,
  type StartupRecoveryProjection,
} from "../application/persistence/startup-recovery-contract";
import type {
  AppendOnlyJournalStage,
  AppendOnlyJournalStageContext,
} from "../platform/journal/append-only-journal";
import type { ChangeBatch } from "../application/persistence/change-batch";
import type {
  SaveChangeBatchStage,
  SaveReceipt,
} from "../application/persistence/save-change-batch";
import {
  applyManuscriptStartupRecovery,
  isManuscriptStartupRecoveryApplyAvailable,
  ManuscriptRecoveryApplyProfileConflictError,
} from "./apply-manuscript-startup-recovery";
import type { ManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  createManuscriptPersistenceRuntime,
  type ManuscriptPersistenceRuntime,
} from "./manuscript-persistence-runtime";
import {
  resolveManuscriptStartupRecovery,
  type ManuscriptStartupRecoveryResult,
} from "./manuscript-startup-recovery";
import type { PocRecoveryApplyRuntimeProfile } from "./poc-recovery-apply-runtime-profile";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import {
  resolvePocResumeCheckpointStartup,
} from "./poc-resume-checkpoint-startup";
import type {
  PocResumeCheckpointRuntimeProfile,
} from "./poc-resume-checkpoint-runtime-profile";

export type ManuscriptRuntimeCoordinator = {
  getManuscriptDocumentProfile(): ManuscriptDocumentProfile;
  getManuscriptPersistenceProfile(): ManuscriptPersistenceProfile | null;
  getManuscriptStartupRecovery(): StartupRecoveryProjection;
  getManuscriptResumeCheckpoint(): ManuscriptResumeCheckpointProjection;
  saveChangeBatch(value: unknown): Promise<SaveReceipt>;
  applyManuscriptStartupRecovery(
    value: unknown,
  ): Promise<ApplyStartupRecoveryAcknowledgement>;
};

type CoordinatorHooks = {
  readonly onSaveStage?: (
    stage: SaveChangeBatchStage,
    batch: ChangeBatch,
  ) => Promise<void>;
  readonly onJournalStage?: (
    stage: AppendOnlyJournalStage,
    context: AppendOnlyJournalStageContext,
  ) => Promise<void>;
};

type CoordinatorConfiguration = CoordinatorHooks & {
  readonly baselineDocumentProfile:
    ManuscriptDocumentProfile;
  readonly baselineJournalProfile:
    ManuscriptJournalRuntimeProfile | null;
  readonly batchingPolicy:
    ManuscriptBatchingPolicy | null;
  readonly recoveryApplyProfile:
    PocRecoveryApplyRuntimeProfile | null;
  readonly resumeCheckpointProfile:
    PocResumeCheckpointRuntimeProfile | null;
};

function createPersistenceRuntime(input: {
  readonly startup:
    ManuscriptStartupRecoveryResult | null;
  readonly hooks: CoordinatorHooks;
}): ManuscriptPersistenceRuntime | null {
  if (
    input.startup === null ||
    input.startup.status !== "ready" ||
    input.startup.recovery.status !== "clean"
  ) {
    return null;
  }
  return createManuscriptPersistenceRuntime({
    documentProfile:
      input.startup.documentProfile,
    journalProfile:
      input.startup.journalProfile,
    ...(input.hooks.onSaveStage === undefined
      ? {}
      : {
          onSaveStage:
            input.hooks.onSaveStage,
        }),
    ...(input.hooks.onJournalStage === undefined
      ? {}
      : {
          onJournalStage:
            input.hooks.onJournalStage,
        }),
  });
}

function persistenceProjection(input: {
  readonly startup:
    ManuscriptStartupRecoveryResult | null;
  readonly runtime:
    ManuscriptPersistenceRuntime | null;
  readonly batchingPolicy:
    ManuscriptBatchingPolicy | null;
}): ManuscriptPersistenceProfile | null {
  if (
    input.startup === null ||
    input.startup.status !== "ready" ||
    input.runtime === null ||
    input.batchingPolicy === null
  ) {
    return null;
  }
  return parseManuscriptPersistenceProfile({
    schemaVersion: 1,
    batching: input.batchingPolicy,
    documentSequences:
      input.startup.journalProfile
        .documentSequences,
  });
}

function recoveryProjection(input: {
  readonly startup:
    ManuscriptStartupRecoveryResult | null;
  readonly recoveryApplyProfile:
    PocRecoveryApplyRuntimeProfile | null;
}): StartupRecoveryProjection {
  if (input.startup === null) {
    return Object.freeze({
      schemaVersion: 1,
      status: "clean",
      issues: Object.freeze([]),
    });
  }
  if (input.startup.status === "read-only-error") {
    return Object.freeze({
      schemaVersion: 1,
      status: "read-only-error",
      issues: Object.freeze(
        input.startup.issues.map((issue) =>
          Object.freeze({ ...issue }),
        ),
      ),
    });
  }
  return projectStartupRecovery(
    input.startup.recovery,
    isManuscriptStartupRecoveryApplyAvailable({
      startup: input.startup,
      applyProfile:
        input.recoveryApplyProfile,
    }),
  );
}

class DefaultManuscriptRuntimeCoordinator
  implements ManuscriptRuntimeCoordinator
{
  readonly #configuration:
    CoordinatorConfiguration;
  #startup:
    ManuscriptStartupRecoveryResult | null;
  #persistenceRuntime:
    ManuscriptPersistenceRuntime | null;
  #persistenceProfile:
    ManuscriptPersistenceProfile | null;
  #recoveryProjection:
    StartupRecoveryProjection;
  #resumeCheckpointProjection:
    ManuscriptResumeCheckpointProjection;

  constructor(input: {
    readonly configuration:
      CoordinatorConfiguration;
    readonly startup:
      ManuscriptStartupRecoveryResult | null;
    readonly resumeCheckpointProjection:
      ManuscriptResumeCheckpointProjection;
  }) {
    this.#configuration = input.configuration;
    this.#startup = input.startup;
    this.#persistenceRuntime =
      createPersistenceRuntime({
        startup: this.#startup,
        hooks: this.#configuration,
      });
    this.#persistenceProfile =
      persistenceProjection({
        startup: this.#startup,
        runtime: this.#persistenceRuntime,
        batchingPolicy:
          this.#configuration.batchingPolicy,
      });
    this.#recoveryProjection =
      recoveryProjection({
        startup: this.#startup,
        recoveryApplyProfile:
          this.#configuration
            .recoveryApplyProfile,
      });
    this.#resumeCheckpointProjection =
      input.resumeCheckpointProjection;
  }

  getManuscriptDocumentProfile(): ManuscriptDocumentProfile {
    return this.#startup?.documentProfile ??
      this.#configuration
        .baselineDocumentProfile;
  }

  getManuscriptPersistenceProfile(): ManuscriptPersistenceProfile | null {
    return this.#persistenceProfile;
  }

  getManuscriptStartupRecovery(): StartupRecoveryProjection {
    return this.#recoveryProjection;
  }

  getManuscriptResumeCheckpoint(): ManuscriptResumeCheckpointProjection {
    return this.#resumeCheckpointProjection;
  }

  async saveChangeBatch(
    value: unknown,
  ): Promise<SaveReceipt> {
    if (this.#persistenceRuntime === null) {
      throw new Error(
        "Durable manuscript persistence is unavailable",
      );
    }
    return this.#persistenceRuntime.saveChangeBatch.execute(
      value,
    );
  }

  async applyManuscriptStartupRecovery(
    value: unknown,
  ): Promise<ApplyStartupRecoveryAcknowledgement> {
    if (
      this.#startup === null ||
      this.#startup.status !== "ready" ||
      this.#configuration
        .baselineJournalProfile === null ||
      this.#configuration
        .recoveryApplyProfile === null
    ) {
      throw new ManuscriptRecoveryApplyProfileConflictError(
        "Recovery apply profile is unavailable",
      );
    }
    const applied =
      await applyManuscriptStartupRecovery({
        baselineDocumentProfile:
          this.#configuration
            .baselineDocumentProfile,
        baselineJournalProfile:
          this.#configuration
            .baselineJournalProfile,
        startup: this.#startup,
        applyProfile:
          this.#configuration
            .recoveryApplyProfile,
        command: value,
      });
    const nextStartup =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          this.#configuration
            .baselineDocumentProfile,
        baselineJournalProfile:
          this.#configuration
            .baselineJournalProfile,
        recoveryApplyProfile:
          this.#configuration
            .recoveryApplyProfile,
      });

    this.#startup = nextStartup;
    this.#persistenceRuntime =
      createPersistenceRuntime({
        startup: this.#startup,
        hooks: this.#configuration,
      });
    this.#persistenceProfile =
      persistenceProjection({
        startup: this.#startup,
        runtime: this.#persistenceRuntime,
        batchingPolicy:
          this.#configuration.batchingPolicy,
      });
    this.#recoveryProjection =
      recoveryProjection({
        startup: this.#startup,
        recoveryApplyProfile:
          this.#configuration
            .recoveryApplyProfile,
      });
    this.#resumeCheckpointProjection =
      this.#configuration
        .resumeCheckpointProfile === null
        ? Object.freeze({
            schemaVersion: 1,
            status: "unavailable",
          })
        : await resolvePocResumeCheckpointStartup({
            documentProfile:
              this.getManuscriptDocumentProfile(),
            runtimeProfile:
              this.#configuration
                .resumeCheckpointProfile,
          });

    return Object.freeze({
      schemaVersion: 1,
      status: "applied",
      compactionId:
        applied.publication.compactionId,
      consumedThroughByteOffset:
        applied.publication
          .consumedThroughByteOffset,
      reclamation: applied.reclamation,
    });
  }
}

export async function createManuscriptRuntimeCoordinator(input: {
  readonly documentProfile:
    ManuscriptDocumentProfile;
  readonly journalProfile:
    ManuscriptJournalRuntimeProfile | null;
  readonly batchingPolicy:
    ManuscriptBatchingPolicy | null;
  readonly recoveryApplyProfile:
    PocRecoveryApplyRuntimeProfile | null;
  readonly resumeCheckpointProfile:
    PocResumeCheckpointRuntimeProfile | null;
  readonly onSaveStage?: (
    stage: SaveChangeBatchStage,
    batch: ChangeBatch,
  ) => Promise<void>;
  readonly onJournalStage?: (
    stage: AppendOnlyJournalStage,
    context: AppendOnlyJournalStageContext,
  ) => Promise<void>;
}): Promise<ManuscriptRuntimeCoordinator> {
  const startup =
    input.journalProfile === null
      ? null
      : await resolveManuscriptStartupRecovery({
          baselineDocumentProfile:
            input.documentProfile,
          baselineJournalProfile:
            input.journalProfile,
          recoveryApplyProfile:
            input.recoveryApplyProfile,
        });
  const configuration:
    CoordinatorConfiguration = {
    baselineDocumentProfile:
      input.documentProfile,
    baselineJournalProfile:
      input.journalProfile,
    batchingPolicy: input.batchingPolicy,
    recoveryApplyProfile:
      input.recoveryApplyProfile,
    resumeCheckpointProfile:
      input.resumeCheckpointProfile,
    ...(input.onSaveStage === undefined
      ? {}
      : { onSaveStage: input.onSaveStage }),
    ...(input.onJournalStage === undefined
      ? {}
      : {
          onJournalStage:
            input.onJournalStage,
        }),
  };
  const resumeCheckpointProjection =
    input.resumeCheckpointProfile === null
      ? Object.freeze({
          schemaVersion: 1 as const,
          status: "unavailable" as const,
        })
      : await resolvePocResumeCheckpointStartup({
          documentProfile:
            startup?.documentProfile ??
            input.documentProfile,
          runtimeProfile:
            input.resumeCheckpointProfile,
        });
  return new DefaultManuscriptRuntimeCoordinator({
    configuration,
    startup,
    resumeCheckpointProjection,
  });
}
