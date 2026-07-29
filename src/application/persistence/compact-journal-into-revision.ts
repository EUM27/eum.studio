import type {
  EntityId,
  Instant,
} from "../../domain/writing";
import {
  parseCanonicalChangeBatch,
} from "./change-batch";
import {
  replayJournal,
  type JournalReplayTarget,
} from "./replay-journal";

export type ManuscriptContentChecksumAdapter = {
  readonly id: string;
  digest(input: Uint8Array): Promise<Uint8Array>;
};

export type CompactionRevisionPlan = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedBaseRevisionId:
    EntityId<"DocumentRevision">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly cause: string;
  readonly createdAt: Instant;
  readonly durableAt: Instant;
};

export type PrepareCompactionRevisionInput =
  CompactionRevisionPlan & {
    readonly compactionId:
      EntityId<"JournalCompaction">;
    readonly text: string;
    readonly nextSequence: number;
  };

export type PreparedCompactionRevision = {
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedBaseRevisionId:
    EntityId<"DocumentRevision">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly contentRef: string;
};

export type PublishCompactionRevision = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedBaseRevisionId:
    EntityId<"DocumentRevision">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
  readonly prepared: PreparedCompactionRevision;
  readonly checksumAdapterId: string;
  readonly sourceChecksum: Uint8Array;
  readonly resultChecksum: Uint8Array;
};

export type PublishJournalCompactionInput = {
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly expectedJournalEndByteOffset: number;
  readonly revisions: readonly PublishCompactionRevision[];
};

export type PublishedCompactionRevision = {
  readonly documentId: EntityId<"Document">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
};

export type JournalCompactionPublication = {
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly consumedThroughByteOffset: number;
  readonly revisions:
    readonly PublishedCompactionRevision[];
};

export type JournalCompactionPort = {
  prepareRevision(
    input: PrepareCompactionRevisionInput,
  ): Promise<PreparedCompactionRevision>;
  materializeRevision(
    prepared: PreparedCompactionRevision,
  ): Promise<string>;
  publish(
    input: PublishJournalCompactionInput,
  ): Promise<JournalCompactionPublication>;
  reclaim(
    publication: JournalCompactionPublication,
  ): Promise<void>;
};

export type CompactedRevisionResult = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedBaseRevisionId:
    EntityId<"DocumentRevision">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
  readonly checksumAdapterId: string;
  readonly sourceChecksum: Uint8Array;
  readonly resultChecksum: Uint8Array;
};

export type CompactJournalIntoRevisionResult = {
  readonly publication: JournalCompactionPublication;
  readonly revisions: readonly CompactedRevisionResult[];
  readonly reclamation: "completed" | "pending";
};

export class JournalCompactionReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalCompactionReplayError";
  }
}

export class JournalCompactionPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalCompactionPlanError";
  }
}

export class JournalCompactionPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalCompactionPreparationError";
  }
}

export class JournalCompactionContentMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "JournalCompactionContentMismatchError";
  }
}

export class JournalCompactionPublicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalCompactionPublicationError";
  }
}

export function encodeCanonicalManuscriptVerificationBytes(
  text: string,
): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    const byteIndex = index * 2;
    bytes[byteIndex] = codeUnit & 0xff;
    bytes[byteIndex + 1] = codeUnit >>> 8;
  }
  return bytes;
}

function checksumsEqual(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function freezeChecksum(
  checksum: Uint8Array,
): Uint8Array {
  return checksum.slice();
}

function freezePublication(
  publication: JournalCompactionPublication,
): JournalCompactionPublication {
  return Object.freeze({
    compactionId: publication.compactionId,
    consumedThroughByteOffset:
      publication.consumedThroughByteOffset,
    revisions: Object.freeze(
      publication.revisions.map((revision) =>
        Object.freeze({ ...revision }),
      ),
    ),
  });
}

type PreparedRevisionState = {
  readonly plan: CompactionRevisionPlan;
  readonly target: JournalReplayTarget;
  readonly prepared: PreparedCompactionRevision;
  readonly sourceChecksum: Uint8Array;
  resultChecksum: Uint8Array | null;
};

function assertPreparedRevision(
  input: PrepareCompactionRevisionInput,
  prepared: PreparedCompactionRevision,
): void {
  if (
    prepared.compactionId !== input.compactionId ||
    prepared.workId !== input.workId ||
    prepared.documentId !== input.documentId ||
    prepared.expectedBaseRevisionId !==
      input.expectedBaseRevisionId ||
    prepared.revisionId !== input.revisionId ||
    prepared.contentRef.length === 0
  ) {
    throw new JournalCompactionPreparationError(
      `Prepared revision does not identify its plan: ${input.documentId}`,
    );
  }
}

function assertPublication(
  input: PublishJournalCompactionInput,
  publication: JournalCompactionPublication,
): void {
  if (
    publication.compactionId !== input.compactionId ||
    publication.consumedThroughByteOffset !==
      input.expectedJournalEndByteOffset ||
    publication.revisions.length !==
      input.revisions.length
  ) {
    throw new JournalCompactionPublicationError(
      `Publication does not identify compaction ${input.compactionId}`,
    );
  }

  const publishedByDocument = new Map(
    publication.revisions.map((revision) => [
      revision.documentId,
      revision,
    ]),
  );
  if (
    publishedByDocument.size !==
    publication.revisions.length
  ) {
    throw new JournalCompactionPublicationError(
      `Publication repeats a document for compaction ${input.compactionId}`,
    );
  }
  for (const revision of input.revisions) {
    const published = publishedByDocument.get(
      revision.documentId,
    );
    if (
      published === undefined ||
      published.revisionId !== revision.revisionId ||
      published.nextSequence !== revision.nextSequence
    ) {
      throw new JournalCompactionPublicationError(
        `Publication revision mismatch for document ${revision.documentId}`,
      );
    }
  }
}

export class CompactJournalIntoRevision {
  readonly #checksumAdapter:
    ManuscriptContentChecksumAdapter;
  readonly #port: JournalCompactionPort;

  constructor(input: {
    readonly checksumAdapter:
      ManuscriptContentChecksumAdapter;
    readonly port: JournalCompactionPort;
  }) {
    if (input.checksumAdapter.id.length === 0) {
      throw new Error(
        "Manuscript content checksum adapter id must not be empty",
      );
    }
    this.#checksumAdapter = input.checksumAdapter;
    this.#port = input.port;
  }

  async execute(input: {
    readonly compactionId:
      EntityId<"JournalCompaction">;
    readonly expectedJournalEndByteOffset: number;
    readonly targets: readonly JournalReplayTarget[];
    readonly payloads: readonly Uint8Array[];
    readonly revisionPlans:
      readonly CompactionRevisionPlan[];
  }): Promise<CompactJournalIntoRevisionResult> {
    if (
      !Number.isSafeInteger(
        input.expectedJournalEndByteOffset,
      ) ||
      input.expectedJournalEndByteOffset < 0
    ) {
      throw new JournalCompactionPlanError(
        "Expected journal end byte offset must be a non-negative safe integer",
      );
    }

    const replay = replayJournal({
      targets: input.targets,
      payloads: input.payloads,
    });
    if (
      replay.stoppedAtRecordIndex !== null ||
      replay.issues.length > 0
    ) {
      throw new JournalCompactionReplayError(
        `Journal replay stopped at record ${replay.stoppedAtRecordIndex}`,
      );
    }

    const affectedDocumentIds: EntityId<"Document">[] = [];
    const affectedDocumentSet = new Set<
      EntityId<"Document">
    >();
    for (const payload of input.payloads) {
      const documentId =
        parseCanonicalChangeBatch(payload).documentId;
      if (!affectedDocumentSet.has(documentId)) {
        affectedDocumentSet.add(documentId);
        affectedDocumentIds.push(documentId);
      }
    }

    const plansByDocument = new Map<
      EntityId<"Document">,
      CompactionRevisionPlan
    >();
    for (const plan of input.revisionPlans) {
      if (plansByDocument.has(plan.documentId)) {
        throw new JournalCompactionPlanError(
          `Duplicate compaction revision plan: ${plan.documentId}`,
        );
      }
      plansByDocument.set(plan.documentId, plan);
    }
    if (
      plansByDocument.size !== affectedDocumentSet.size
    ) {
      throw new JournalCompactionPlanError(
        "Revision plans do not exactly match affected journal documents",
      );
    }

    const replayTargetsByDocument = new Map(
      replay.targets.map((target) => [
        target.documentId,
        target,
      ]),
    );
    const preparedStates: PreparedRevisionState[] = [];
    for (const documentId of affectedDocumentIds) {
      const target =
        replayTargetsByDocument.get(documentId);
      const plan = plansByDocument.get(documentId);
      if (target === undefined || plan === undefined) {
        throw new JournalCompactionPlanError(
          `Missing compaction target or plan: ${documentId}`,
        );
      }
      if (
        plan.workId !== target.workId ||
        plan.documentId !== target.documentId ||
        plan.expectedBaseRevisionId !==
          target.baseRevisionId ||
        plan.revisionId === target.baseRevisionId
      ) {
        throw new JournalCompactionPlanError(
          `Compaction plan boundary mismatch: ${documentId}`,
        );
      }

      const sourceChecksum = freezeChecksum(
        await this.#checksumAdapter.digest(
          encodeCanonicalManuscriptVerificationBytes(
            target.text,
          ),
        ),
      );
      if (sourceChecksum.byteLength === 0) {
        throw new JournalCompactionPreparationError(
          `Source checksum is empty: ${documentId}`,
        );
      }
      const prepareInput: PrepareCompactionRevisionInput = {
        ...plan,
        compactionId: input.compactionId,
        text: target.text,
        nextSequence: target.nextSequence,
      };
      const prepared =
        await this.#port.prepareRevision(prepareInput);
      assertPreparedRevision(prepareInput, prepared);
      preparedStates.push({
        plan,
        target,
        prepared: Object.freeze({ ...prepared }),
        sourceChecksum,
        resultChecksum: null,
      });
    }

    for (const state of preparedStates) {
      const materialized =
        await this.#port.materializeRevision(
          state.prepared,
        );
      const resultChecksum = freezeChecksum(
        await this.#checksumAdapter.digest(
          encodeCanonicalManuscriptVerificationBytes(
            materialized,
          ),
        ),
      );
      state.resultChecksum = resultChecksum;
      if (
        !checksumsEqual(
          state.sourceChecksum,
          resultChecksum,
        )
      ) {
        throw new JournalCompactionContentMismatchError(
          `Prepared revision content mismatch: ${state.target.documentId}`,
        );
      }
    }

    const publishInput: PublishJournalCompactionInput =
      Object.freeze({
        compactionId: input.compactionId,
        expectedJournalEndByteOffset:
          input.expectedJournalEndByteOffset,
        revisions: Object.freeze(
          preparedStates.map((state) => {
            const resultChecksum =
              state.resultChecksum;
            if (resultChecksum === null) {
              throw new JournalCompactionPreparationError(
                `Prepared revision was not verified: ${state.target.documentId}`,
              );
            }
            return Object.freeze({
              workId: state.target.workId,
              documentId: state.target.documentId,
              expectedBaseRevisionId:
                state.target.baseRevisionId,
              revisionId: state.plan.revisionId,
              nextSequence: state.target.nextSequence,
              prepared: state.prepared,
              checksumAdapterId:
                this.#checksumAdapter.id,
              sourceChecksum: freezeChecksum(
                state.sourceChecksum,
              ),
              resultChecksum:
                freezeChecksum(resultChecksum),
            });
          }),
        ),
      });
    const publication =
      await this.#port.publish(publishInput);
    assertPublication(publishInput, publication);
    const frozenPublication =
      freezePublication(publication);

    let reclamation:
      | CompactJournalIntoRevisionResult["reclamation"] =
      "completed";
    try {
      await this.#port.reclaim(frozenPublication);
    } catch {
      reclamation = "pending";
    }

    return Object.freeze({
      publication: frozenPublication,
      revisions: Object.freeze(
        preparedStates.map((state) => {
          const resultChecksum = state.resultChecksum;
          if (resultChecksum === null) {
            throw new JournalCompactionPreparationError(
              `Compacted revision has no result checksum: ${state.target.documentId}`,
            );
          }
          return Object.freeze({
            workId: state.target.workId,
            documentId: state.target.documentId,
            expectedBaseRevisionId:
              state.target.baseRevisionId,
            revisionId: state.plan.revisionId,
            nextSequence: state.target.nextSequence,
            checksumAdapterId:
              this.#checksumAdapter.id,
            sourceChecksum: freezeChecksum(
              state.sourceChecksum,
            ),
            resultChecksum:
              freezeChecksum(resultChecksum),
          });
        }),
      ),
      reclamation,
    });
  }
}
