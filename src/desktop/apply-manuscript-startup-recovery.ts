import type { ManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import {
  CompactJournalIntoRevision,
  type JournalCompactionPort,
  type JournalCompactionPublication,
} from "../application/persistence/compact-journal-into-revision";
import type { StartupRecoveryCandidate } from "../application/persistence/prepare-startup-recovery";
import {
  assertApplyStartupRecoveryMatchesCandidate,
  parseApplyStartupRecoveryCommand,
  projectStartupRecovery,
  type StartupRecoveryProjection,
} from "../application/persistence/startup-recovery-contract";
import type { JournalReplayTarget } from "../application/persistence/replay-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import {
  createPocJournalCompactionPort,
} from "../platform/persistence/poc-journal-compaction-port";
import type { ManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  resolveManuscriptStartupRecovery,
  type ManuscriptStartupRecoveryResult,
} from "./manuscript-startup-recovery";
import type { PocRecoveryApplyRuntimeProfile } from "./poc-recovery-apply-runtime-profile";

type ReadyStartup = Extract<
  ManuscriptStartupRecoveryResult,
  { readonly status: "ready" }
>;

export type AppliedManuscriptStartupRecovery = {
  readonly schemaVersion: 1;
  readonly publication:
    JournalCompactionPublication;
  readonly reclamation: "completed" | "pending";
  readonly documentProfile:
    ManuscriptDocumentProfile;
  readonly journalProfile:
    ManuscriptJournalRuntimeProfile;
  readonly recovery: StartupRecoveryProjection;
};

export class ManuscriptRecoveryApplyProfileConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "ManuscriptRecoveryApplyProfileConflictError";
  }
}

function pendingCandidate(
  startup: ReadyStartup,
): StartupRecoveryCandidate | null {
  return startup.recovery.status ===
    "recovery-pending"
    ? startup.recovery.candidate
    : null;
}

function profileMatchesCandidate(input: {
  readonly startup: ReadyStartup;
  readonly applyProfile:
    PocRecoveryApplyRuntimeProfile;
  readonly candidate: StartupRecoveryCandidate;
}): boolean {
  if (
    input.applyProfile.sourceJournalPath !==
      input.startup.journalProfile.journalPath ||
    input.applyProfile
      .expectedSourceJournalEndByteOffset !==
      input.candidate
        .sourceJournalEndByteOffset ||
    input.applyProfile
      .expectedSafeReplayThroughByteOffset !==
      input.candidate
        .safeReplayThroughByteOffset ||
    input.applyProfile.revisions.length !==
      input.candidate.affectedDocuments.length
  ) {
    return false;
  }
  for (
    let index = 0;
    index < input.applyProfile.revisions.length;
    index += 1
  ) {
    const plan =
      input.applyProfile.revisions[index];
    const current =
      input.candidate.affectedDocuments[index];
    if (
      plan === undefined ||
      current === undefined ||
      plan.workId !== current.workId ||
      plan.documentId !== current.documentId ||
      plan.expectedBaseRevisionId !==
        current.baseRevisionId ||
      plan.revisionId === current.baseRevisionId
    ) {
      return false;
    }
  }
  return true;
}

export function isManuscriptStartupRecoveryApplyAvailable(input: {
  readonly startup: ReadyStartup;
  readonly applyProfile:
    PocRecoveryApplyRuntimeProfile | null;
}): boolean {
  const candidate = pendingCandidate(
    input.startup,
  );
  return (
    candidate !== null &&
    input.applyProfile !== null &&
    profileMatchesCandidate({
      startup: input.startup,
      applyProfile: input.applyProfile,
      candidate,
    })
  );
}

function storagePlanFor(
  profile: PocRecoveryApplyRuntimeProfile,
) {
  return {
    compactionId: profile.compactionId,
    sourceJournalPath: profile.sourceJournalPath,
    nextJournalPath: profile.nextJournalPath,
    publicationTemporaryPath:
      profile.publicationTemporaryPath,
    publicationPath: profile.publicationPath,
    revisionFiles: profile.revisions.map(
      (revision) => ({
        revisionId: revision.revisionId,
        contentPath: revision.contentPath,
      }),
    ),
  };
}

function replayTargetsFor(
  startup: ReadyStartup,
): readonly JournalReplayTarget[] {
  const sequencesByDocument = new Map(
    startup.journalProfile.documentSequences.map(
      (sequence) => [
        sequence.documentId,
        sequence.nextSequence,
      ],
    ),
  );
  const targets =
    startup.documentProfile.documents.map(
      (document) => {
        if (document.documentRevisionId === null) {
          throw new Error(
            `Recovery apply target has no durable base revision: ${document.documentId}`,
          );
        }
        const nextSequence =
          sequencesByDocument.get(
            document.documentId,
          );
        if (nextSequence === undefined) {
          throw new Error(
            `Recovery apply target has no sequence: ${document.documentId}`,
          );
        }
        return {
          workId: document.workId,
          documentId: document.documentId,
          baseRevisionId:
            document.documentRevisionId,
          nextSequence,
          text: document.initialText,
        };
      },
    );
  if (
    targets.length !== sequencesByDocument.size
  ) {
    throw new Error(
      "Recovery apply sequences do not exactly match its document profile",
    );
  }
  return targets;
}

function retainIssueSource(
  port: JournalCompactionPort,
): JournalCompactionPort {
  return {
    prepareRevision: (input) =>
      port.prepareRevision(input),
    materializeRevision: (prepared) =>
      port.materializeRevision(prepared),
    publish: (input) => port.publish(input),
    reclaim: async () => {
      throw new Error(
        "Recovery issue source journal remains isolated",
      );
    },
  };
}

export async function applyManuscriptStartupRecovery(input: {
  readonly baselineDocumentProfile:
    ManuscriptDocumentProfile;
  readonly baselineJournalProfile:
    ManuscriptJournalRuntimeProfile;
  readonly startup: ReadyStartup;
  readonly applyProfile:
    PocRecoveryApplyRuntimeProfile;
  readonly command: unknown;
}): Promise<AppliedManuscriptStartupRecovery> {
  const candidate = pendingCandidate(input.startup);
  if (candidate === null) {
    throw new ManuscriptRecoveryApplyProfileConflictError(
      "Recovery apply profile has no pending candidate",
    );
  }
  const command =
    parseApplyStartupRecoveryCommand(
      input.command,
    );
  assertApplyStartupRecoveryMatchesCandidate(
    command,
    candidate,
  );
  if (
    !profileMatchesCandidate({
      startup: input.startup,
      applyProfile: input.applyProfile,
      candidate,
    })
  ) {
    throw new ManuscriptRecoveryApplyProfileConflictError(
      "Recovery apply profile does not identify the current candidate",
    );
  }

  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      input.applyProfile
        .contentChecksumAlgorithm,
    );
  const physicalPort =
    createPocJournalCompactionPort({
      storagePlan: storagePlanFor(
        input.applyProfile,
      ),
      checksumAdapter,
    });
  const port =
    candidate.issues.length === 0
      ? physicalPort
      : retainIssueSource(physicalPort);
  const compaction =
    new CompactJournalIntoRevision({
      checksumAdapter,
      port,
    });
  const compacted = await compaction.execute({
    compactionId:
      input.applyProfile.compactionId,
    expectedJournalEndByteOffset:
      command.expectedSourceJournalEndByteOffset,
    targets: replayTargetsFor(input.startup),
    payloads: candidate.safePayloads,
    revisionPlans:
      input.applyProfile.revisions,
  });

  const restarted =
    await resolveManuscriptStartupRecovery({
      baselineDocumentProfile:
        input.baselineDocumentProfile,
      baselineJournalProfile:
        input.baselineJournalProfile,
      recoveryApplyProfile:
        input.applyProfile,
    });
  if (restarted.status !== "ready") {
    throw new Error(
      "Published recovery could not resolve its active startup source",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    publication: compacted.publication,
    reclamation: compacted.reclamation,
    documentProfile: restarted.documentProfile,
    journalProfile: restarted.journalProfile,
    recovery: projectStartupRecovery(
      restarted.recovery,
      false,
    ),
  });
}
