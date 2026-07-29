import type { ManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import {
  prepareStartupRecovery,
  type StartupRecoveryIssue,
  type StartupRecoveryState,
} from "../application/persistence/prepare-startup-recovery";
import type { JournalReplayTarget } from "../application/persistence/replay-journal";
import type { EntityId } from "../domain/writing";
import {
  scanAppendOnlyJournal,
} from "../platform/journal/append-only-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import {
  resolvePocJournalCompaction,
  type PocJournalCompactionRecovery,
  type PocPublishedCompactionRevision,
} from "../platform/persistence/poc-journal-compaction-port";
import {
  parseManuscriptJournalRuntimeProfile,
  type ManuscriptJournalRuntimeProfile,
} from "./manuscript-journal-runtime-profile";
import type { PocRecoveryApplyRuntimeProfile } from "./poc-recovery-apply-runtime-profile";

export type ManuscriptStartupPublicationIssue = {
  readonly source: "compaction-publication";
  readonly reason:
    | Extract<
        PocJournalCompactionRecovery,
        { readonly status: "invalid" }
      >["reason"]
    | "identity-conflict";
};

export type ManuscriptStartupJournalReadIssue = {
  readonly source: "journal-read";
  readonly reason: string;
};

export type ManuscriptStartupRecoveryIssue =
  | ManuscriptStartupPublicationIssue
  | ManuscriptStartupJournalReadIssue
  | StartupRecoveryIssue;

export type ManuscriptStartupRecoveryResult =
  | {
      readonly status: "ready";
      readonly confirmedSource:
        | "baseline"
        | "published";
      readonly documentProfile:
        ManuscriptDocumentProfile;
      readonly journalProfile:
        ManuscriptJournalRuntimeProfile;
      readonly recovery: StartupRecoveryState;
    }
  | {
      readonly status: "read-only-error";
      readonly confirmedSource:
        | "baseline"
        | "published"
        | "publication-invalid";
      readonly documentProfile:
        ManuscriptDocumentProfile;
      readonly issues:
        readonly ManuscriptStartupRecoveryIssue[];
    };

function publicationIssue(
  reason: ManuscriptStartupPublicationIssue["reason"],
): ManuscriptStartupPublicationIssue {
  return Object.freeze({
    source: "compaction-publication",
    reason,
  });
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

function publicationMatchesProfile(input: {
  readonly baselineDocumentProfile:
    ManuscriptDocumentProfile;
  readonly profile: PocRecoveryApplyRuntimeProfile;
  readonly recovery: Extract<
    PocJournalCompactionRecovery,
    { readonly status: "published" }
  >;
}): boolean {
  if (
    input.recovery.consumedThroughByteOffset !==
      input.profile
        .expectedSourceJournalEndByteOffset ||
    input.recovery.revisions.length !==
      input.profile.revisions.length
  ) {
    return false;
  }

  const documentsById = new Map(
    input.baselineDocumentProfile.documents.map(
      (document) => [
        document.documentId,
        document,
      ],
    ),
  );
  const plansByRevision = new Map(
    input.profile.revisions.map((revision) => [
      revision.revisionId,
      revision,
    ]),
  );
  for (const revision of input.recovery.revisions) {
    const document = documentsById.get(
      revision.documentId,
    );
    const plan = plansByRevision.get(
      revision.revisionId,
    );
    if (
      document === undefined ||
      plan === undefined ||
      document.workId !== revision.workId ||
      document.documentRevisionId !==
        revision.expectedBaseRevisionId ||
      plan.workId !== revision.workId ||
      plan.documentId !== revision.documentId ||
      plan.expectedBaseRevisionId !==
        revision.expectedBaseRevisionId
    ) {
      return false;
    }
  }
  return true;
}

function effectiveProfilesFromPublication(input: {
  readonly baselineDocumentProfile:
    ManuscriptDocumentProfile;
  readonly baselineJournalProfile:
    ManuscriptJournalRuntimeProfile;
  readonly recovery: Extract<
    PocJournalCompactionRecovery,
    { readonly status: "published" }
  >;
}): {
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly journalProfile:
    ManuscriptJournalRuntimeProfile;
} {
  const publishedByDocument = new Map<
    EntityId<"Document">,
    PocPublishedCompactionRevision
  >(
    input.recovery.revisions.map((revision) => [
      revision.documentId,
      revision,
    ]),
  );
  const nextSequenceByDocument = new Map(
    input.baselineJournalProfile.documentSequences.map(
      (sequence) => [
        sequence.documentId,
        sequence.nextSequence,
      ],
    ),
  );
  for (const revision of input.recovery.revisions) {
    if (
      !nextSequenceByDocument.has(
        revision.documentId,
      )
    ) {
      throw new Error(
        `Published compaction has no journal sequence: ${revision.documentId}`,
      );
    }
    nextSequenceByDocument.set(
      revision.documentId,
      revision.nextSequence,
    );
  }

  const documentProfile =
    parseManuscriptDocumentProfile({
      schemaVersion: 1,
      initialDocumentId:
        input.baselineDocumentProfile
          .initialDocumentId,
      documents:
        input.baselineDocumentProfile.documents.map(
          (document) => {
            const published =
              publishedByDocument.get(
                document.documentId,
              );
            return published === undefined
              ? document
              : {
                  ...document,
                  documentRevisionId:
                    published.revisionId,
                  initialText: published.content,
                };
          },
        ),
    });
  const journalProfile =
    parseManuscriptJournalRuntimeProfile({
      schemaVersion: 1,
      journalPath:
        input.recovery.activeJournalPath,
      checksumAlgorithm:
        input.baselineJournalProfile
          .checksumAlgorithm,
      documentSequences:
        input.baselineJournalProfile.documentSequences.map(
          (sequence) => ({
            documentId: sequence.documentId,
            nextSequence:
              nextSequenceByDocument.get(
                sequence.documentId,
              ),
          }),
        ),
    });
  return {
    documentProfile,
    journalProfile,
  };
}

function createReplayTargets(input: {
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly journalProfile:
    ManuscriptJournalRuntimeProfile;
}): readonly JournalReplayTarget[] {
  const sequencesByDocument = new Map(
    input.journalProfile.documentSequences.map(
      (sequence) => [
        sequence.documentId,
        sequence.nextSequence,
      ],
    ),
  );
  const targets =
    input.documentProfile.documents.map((document) => {
      if (document.documentRevisionId === null) {
        throw new Error(
          `Startup recovery target has no durable base revision: ${document.documentId}`,
        );
      }
      const nextSequence = sequencesByDocument.get(
        document.documentId,
      );
      if (nextSequence === undefined) {
        throw new Error(
          `Startup recovery target has no journal sequence: ${document.documentId}`,
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
    });
  if (
    sequencesByDocument.size !== targets.length
  ) {
    throw new Error(
      "Startup recovery sequences do not exactly match the document profile",
    );
  }
  return targets;
}

async function prepareFromActiveJournal(input: {
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly journalProfile:
    ManuscriptJournalRuntimeProfile;
}): Promise<
  | StartupRecoveryState
  | {
      readonly status: "read-only-error";
      readonly issues:
        readonly ManuscriptStartupRecoveryIssue[];
    }
> {
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      input.journalProfile.checksumAlgorithm,
    );
  let scan;
  try {
    scan = await scanAppendOnlyJournal({
      journalPath: input.journalProfile.journalPath,
      resolveChecksumAdapter: (adapterId) =>
        adapterId === checksumAdapter.id
          ? checksumAdapter
          : null,
    });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code ===
      "ENOENT"
    ) {
      return prepareStartupRecovery({
        targets: createReplayTargets(input),
        records: [],
        sourceJournalEndByteOffset: 0,
        checksumVerifiedPrefixByteLength: 0,
        frameIssue: null,
      });
    }
    const reason =
      (error as NodeJS.ErrnoException).code;
    if (
      typeof reason === "string" &&
      reason.length > 0
    ) {
      return Object.freeze({
        status: "read-only-error",
        issues: Object.freeze([
          Object.freeze({
            source: "journal-read",
            reason,
          }),
        ]),
      });
    }
    throw error;
  }

  const sourceJournalEndByteOffset =
    scan.tail === null
      ? scan.verifiedPrefixByteLength
      : scan.tail.byteOffset +
        scan.tail.bytes.byteLength;
  return prepareStartupRecovery({
    targets: createReplayTargets(input),
    records: scan.records.map((record) => ({
      payload: record.payload,
      frameStartByteOffset:
        record.frameStartByteOffset,
      frameEndByteOffset:
        record.frameEndByteOffset,
    })),
    sourceJournalEndByteOffset,
    checksumVerifiedPrefixByteLength:
      scan.verifiedPrefixByteLength,
    frameIssue:
      scan.tail === null
        ? null
        : {
            byteOffset: scan.tail.byteOffset,
            byteLength:
              scan.tail.bytes.byteLength,
            reason: scan.tail.reason,
          },
  });
}

export async function resolveManuscriptStartupRecovery(input: {
  readonly baselineDocumentProfile:
    ManuscriptDocumentProfile;
  readonly baselineJournalProfile:
    ManuscriptJournalRuntimeProfile;
  readonly recoveryApplyProfile:
    PocRecoveryApplyRuntimeProfile | null;
}): Promise<ManuscriptStartupRecoveryResult> {
  let confirmedSource:
    | "baseline"
    | "published" = "baseline";
  let documentProfile =
    input.baselineDocumentProfile;
  let journalProfile =
    input.baselineJournalProfile;

  if (input.recoveryApplyProfile !== null) {
    if (
      input.recoveryApplyProfile
        .sourceJournalPath !==
      input.baselineJournalProfile.journalPath
    ) {
      return Object.freeze({
        status: "read-only-error",
        confirmedSource: "publication-invalid",
        documentProfile,
        issues: Object.freeze([
          publicationIssue("identity-conflict"),
        ]),
      });
    }
    const publicationChecksumAdapter =
      createNodeCryptoJournalChecksumAdapter(
        input.recoveryApplyProfile
          .contentChecksumAlgorithm,
      );
    const activeJournalChecksumAdapter =
      createNodeCryptoJournalChecksumAdapter(
        input.baselineJournalProfile
          .checksumAlgorithm,
      );
    const publication =
      await resolvePocJournalCompaction({
        storagePlan: storagePlanFor(
          input.recoveryApplyProfile,
        ),
        checksumAdapter:
          publicationChecksumAdapter,
        resolveActiveJournalChecksumAdapter: (
          adapterId,
        ) =>
          adapterId ===
          activeJournalChecksumAdapter.id
            ? activeJournalChecksumAdapter
            : null,
      });

    if (publication.status === "invalid") {
      return Object.freeze({
        status: "read-only-error",
        confirmedSource: "publication-invalid",
        documentProfile,
        issues: Object.freeze([
          publicationIssue(publication.reason),
        ]),
      });
    }
    if (publication.status === "published") {
      if (
        !publicationMatchesProfile({
          baselineDocumentProfile:
            input.baselineDocumentProfile,
          profile: input.recoveryApplyProfile,
          recovery: publication,
        })
      ) {
        return Object.freeze({
          status: "read-only-error",
          confirmedSource:
            "publication-invalid",
          documentProfile,
          issues: Object.freeze([
            publicationIssue(
              "identity-conflict",
            ),
          ]),
        });
      }
      const effective =
        effectiveProfilesFromPublication({
          baselineDocumentProfile:
            input.baselineDocumentProfile,
          baselineJournalProfile:
            input.baselineJournalProfile,
          recovery: publication,
        });
      confirmedSource = "published";
      documentProfile =
        effective.documentProfile;
      journalProfile =
        effective.journalProfile;
    }
  }

  const recovery = await prepareFromActiveJournal({
    documentProfile,
    journalProfile,
  });
  if (recovery.status === "read-only-error") {
    return Object.freeze({
      status: "read-only-error",
      confirmedSource,
      documentProfile,
      issues: recovery.issues,
    });
  }
  return Object.freeze({
    status: "ready",
    confirmedSource,
    documentProfile,
    journalProfile,
    recovery,
  });
}
