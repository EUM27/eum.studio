import {
  open,
  rename,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  dirname,
  join,
} from "node:path";

import {
  CaptureResumeCheckpoint,
} from "../application/checkpoints/capture-resume-checkpoint";
import type { RevisionStore } from "../application/revisions/revision-store";
import {
  CompactJournalIntoRevision,
  type CompactionRevisionPlan,
} from "../application/persistence/compact-journal-into-revision";
import type { JournalReplayTarget } from "../application/persistence/replay-journal";
import {
  entityId,
  type Anchor,
  type Document,
  type DocumentRevision,
  type EntityId,
  type ResumeCheckpoint,
  type Work,
  type WritingCatalog,
} from "../domain/writing";
import {
  createPocResumeCheckpointCaptureTransaction,
  type PocResumeCheckpointPublicationCodec,
  type PocResumeCheckpointPublicationStage,
  type PocResumeCheckpointStoragePlan,
} from "../platform/checkpoints/poc-resume-checkpoint-publication";
import {
  createJsonPocResumeCheckpointPublicationCodec,
} from "../platform/checkpoints/poc-resume-checkpoint-json-codec";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import {
  createPocJournalCompactionPort,
  type PocJournalCompactionStage,
  type PocJournalCompactionStoragePlan,
} from "../platform/persistence/poc-journal-compaction-port";

const COMPACTION_CRASH_STAGES = Object.freeze([
  "publication-temp-synced",
  "publication-renamed",
] as const);

const CHECKPOINT_CRASH_STAGES = Object.freeze([
  "publication-temp-synced",
  "publication-renamed",
] as const);

type CompactionCrashStage =
  (typeof COMPACTION_CRASH_STAGES)[number];

type CheckpointCrashStage =
  (typeof CHECKPOINT_CRASH_STAGES)[number];

export type Poc2CompactionCrashWorkerProfile = {
  readonly schemaVersion: 1;
  readonly kind: "compaction";
  readonly scenarioId: string;
  readonly targetStage: CompactionCrashStage;
  readonly reachedPath: string;
  readonly checksumAlgorithm: string;
  readonly storagePlan:
    PocJournalCompactionStoragePlan;
  readonly expectedJournalEndByteOffset: number;
  readonly target: JournalReplayTarget;
  readonly payloadBase64: string;
  readonly revisionPlan:
    CompactionRevisionPlan;
};

export type Poc2CheckpointCrashWorkerProfile = {
  readonly schemaVersion: 1;
  readonly kind: "checkpoint";
  readonly scenarioId: string;
  readonly targetStage: CheckpointCrashStage;
  readonly reachedPath: string;
  readonly checksumAlgorithm: string;
  readonly codecId: string;
  readonly storagePlan:
    PocResumeCheckpointStoragePlan;
  readonly work: Work;
  readonly document: Document;
  readonly revision: DocumentRevision;
  readonly revisionContent: string;
  readonly baselineCheckpoints:
    readonly ResumeCheckpoint[];
  readonly checkpoint: ResumeCheckpoint;
  readonly anchors: readonly Anchor[];
  readonly expectedWorkRevision: number;
  readonly expectedResumeCheckpointId:
    EntityId<"ResumeCheckpoint"> | null;
  readonly expectedCurrentDocumentRevisionId:
    EntityId<"DocumentRevision">;
};

export type Poc2DurabilityCrashWorkerProfile =
  | Poc2CompactionCrashWorkerProfile
  | Poc2CheckpointCrashWorkerProfile;

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  field: string,
): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(
        `Unsupported ${field} field: ${key}`,
      );
    }
  }
}

function readString(
  value: Record<string, unknown>,
  field: string,
): string {
  const result = value[field];
  if (typeof result !== "string") {
    throw new Error(
      `${field} must be a string`,
    );
  }
  return result;
}

function readNonEmptyString(
  value: Record<string, unknown>,
  field: string,
): string {
  const result = readString(value, field);
  if (result.length === 0) {
    throw new Error(
      `${field} must be a non-empty string`,
    );
  }
  return result;
}

function readSafeInteger(
  value: Record<string, unknown>,
  field: string,
): number {
  const result = value[field];
  if (
    typeof result !== "number" ||
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new Error(
      `${field} must be a non-negative safe integer`,
    );
  }
  return result;
}

function readStage<
  TStage extends string,
>(
  value: Record<string, unknown>,
  field: string,
  stages: readonly TStage[],
): TStage {
  const result = readNonEmptyString(
    value,
    field,
  );
  if (!stages.some((stage) => stage === result)) {
    throw new Error(
      `Unsupported ${field}: ${result}`,
    );
  }
  return result as TStage;
}

function parseCompactionStoragePlan(
  value: unknown,
): PocJournalCompactionStoragePlan {
  const input = readRecord(
    value,
    "storagePlan",
  );
  assertOnlyFields(
    input,
    [
      "compactionId",
      "sourceJournalPath",
      "nextJournalPath",
      "publicationTemporaryPath",
      "publicationPath",
      "revisionFiles",
    ],
    "storagePlan",
  );
  if (
    !Array.isArray(input.revisionFiles) ||
    input.revisionFiles.length === 0
  ) {
    throw new Error(
      "storagePlan.revisionFiles must be a non-empty array",
    );
  }
  return Object.freeze({
    compactionId:
      entityId<"JournalCompaction">(
        readNonEmptyString(
          input,
          "compactionId",
        ),
      ),
    sourceJournalPath: readNonEmptyString(
      input,
      "sourceJournalPath",
    ),
    nextJournalPath: readNonEmptyString(
      input,
      "nextJournalPath",
    ),
    publicationTemporaryPath:
      readNonEmptyString(
        input,
        "publicationTemporaryPath",
      ),
    publicationPath: readNonEmptyString(
      input,
      "publicationPath",
    ),
    revisionFiles: Object.freeze(
      input.revisionFiles.map(
        (value, index) => {
          const revision = readRecord(
            value,
            `storagePlan.revisionFiles[${index}]`,
          );
          assertOnlyFields(
            revision,
            ["revisionId", "contentPath"],
            `storagePlan.revisionFiles[${index}]`,
          );
          return Object.freeze({
            revisionId:
              entityId<"DocumentRevision">(
                readNonEmptyString(
                  revision,
                  "revisionId",
                ),
              ),
            contentPath:
              readNonEmptyString(
                revision,
                "contentPath",
              ),
          });
        },
      ),
    ),
  });
}

function parseReplayTarget(
  value: unknown,
): JournalReplayTarget {
  const input = readRecord(value, "target");
  assertOnlyFields(
    input,
    [
      "workId",
      "documentId",
      "baseRevisionId",
      "nextSequence",
      "text",
    ],
    "target",
  );
  return Object.freeze({
    workId: entityId<"Work">(
      readNonEmptyString(input, "workId"),
    ),
    documentId: entityId<"Document">(
      readNonEmptyString(input, "documentId"),
    ),
    baseRevisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          input,
          "baseRevisionId",
        ),
      ),
    nextSequence: readSafeInteger(
      input,
      "nextSequence",
    ),
    text: readString(input, "text"),
  });
}

function parseRevisionPlan(
  value: unknown,
): CompactionRevisionPlan {
  const input = readRecord(
    value,
    "revisionPlan",
  );
  assertOnlyFields(
    input,
    [
      "workId",
      "documentId",
      "expectedBaseRevisionId",
      "revisionId",
      "cause",
      "createdAt",
      "durableAt",
    ],
    "revisionPlan",
  );
  return Object.freeze({
    workId: entityId<"Work">(
      readNonEmptyString(input, "workId"),
    ),
    documentId: entityId<"Document">(
      readNonEmptyString(input, "documentId"),
    ),
    expectedBaseRevisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          input,
          "expectedBaseRevisionId",
        ),
      ),
    revisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          input,
          "revisionId",
        ),
      ),
    cause: readNonEmptyString(
      input,
      "cause",
    ),
    createdAt: readNonEmptyString(
      input,
      "createdAt",
    ),
    durableAt: readNonEmptyString(
      input,
      "durableAt",
    ),
  });
}

function parseCompactionProfile(
  input: Record<string, unknown>,
): Poc2CompactionCrashWorkerProfile {
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "kind",
      "scenarioId",
      "targetStage",
      "reachedPath",
      "checksumAlgorithm",
      "storagePlan",
      "expectedJournalEndByteOffset",
      "target",
      "payloadBase64",
      "revisionPlan",
    ],
    "compaction crash profile",
  );
  return Object.freeze({
    schemaVersion: 1,
    kind: "compaction",
    scenarioId: readNonEmptyString(
      input,
      "scenarioId",
    ),
    targetStage: readStage(
      input,
      "targetStage",
      COMPACTION_CRASH_STAGES,
    ),
    reachedPath: readNonEmptyString(
      input,
      "reachedPath",
    ),
    checksumAlgorithm: readNonEmptyString(
      input,
      "checksumAlgorithm",
    ),
    storagePlan: parseCompactionStoragePlan(
      input.storagePlan,
    ),
    expectedJournalEndByteOffset:
      readSafeInteger(
        input,
        "expectedJournalEndByteOffset",
      ),
    target: parseReplayTarget(input.target),
    payloadBase64: readNonEmptyString(
      input,
      "payloadBase64",
    ),
    revisionPlan: parseRevisionPlan(
      input.revisionPlan,
    ),
  });
}

function parseCheckpointProfile(
  input: Record<string, unknown>,
): Poc2CheckpointCrashWorkerProfile {
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "kind",
      "scenarioId",
      "targetStage",
      "reachedPath",
      "checksumAlgorithm",
      "codecId",
      "storagePlan",
      "work",
      "document",
      "revision",
      "revisionContent",
      "baselineCheckpoints",
      "checkpoint",
      "anchors",
      "expectedWorkRevision",
      "expectedResumeCheckpointId",
      "expectedCurrentDocumentRevisionId",
    ],
    "checkpoint crash profile",
  );
  const storagePlan = readRecord(
    input.storagePlan,
    "storagePlan",
  );
  assertOnlyFields(
    storagePlan,
    [
      "publicationId",
      "publicationTemporaryPath",
      "publicationPath",
    ],
    "storagePlan",
  );
  if (
    !Array.isArray(input.baselineCheckpoints) ||
    !Array.isArray(input.anchors)
  ) {
    throw new Error(
      "baselineCheckpoints and anchors must be arrays",
    );
  }
  const expectedResumeCheckpointId =
    input.expectedResumeCheckpointId;
  if (
    expectedResumeCheckpointId !== null &&
    (typeof expectedResumeCheckpointId !==
      "string" ||
      expectedResumeCheckpointId.length === 0)
  ) {
    throw new Error(
      "expectedResumeCheckpointId must be a non-empty string or null",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: "checkpoint",
    scenarioId: readNonEmptyString(
      input,
      "scenarioId",
    ),
    targetStage: readStage(
      input,
      "targetStage",
      CHECKPOINT_CRASH_STAGES,
    ),
    reachedPath: readNonEmptyString(
      input,
      "reachedPath",
    ),
    checksumAlgorithm: readNonEmptyString(
      input,
      "checksumAlgorithm",
    ),
    codecId: readNonEmptyString(
      input,
      "codecId",
    ),
    storagePlan: Object.freeze({
      publicationId:
        entityId<"ResumeCheckpointPublication">(
          readNonEmptyString(
            storagePlan,
            "publicationId",
          ),
        ),
      publicationTemporaryPath:
        readNonEmptyString(
          storagePlan,
          "publicationTemporaryPath",
        ),
      publicationPath:
        readNonEmptyString(
          storagePlan,
          "publicationPath",
        ),
    }),
    work: readRecord(
      input.work,
      "work",
    ) as unknown as Work,
    document: readRecord(
      input.document,
      "document",
    ) as unknown as Document,
    revision: readRecord(
      input.revision,
      "revision",
    ) as unknown as DocumentRevision,
    revisionContent: readString(
      input,
      "revisionContent",
    ),
    baselineCheckpoints: Object.freeze(
      input.baselineCheckpoints.map(
        (checkpoint, index) =>
          readRecord(
            checkpoint,
            `baselineCheckpoints[${index}]`,
          ) as unknown as ResumeCheckpoint,
      ),
    ),
    checkpoint: readRecord(
      input.checkpoint,
      "checkpoint",
    ) as unknown as ResumeCheckpoint,
    anchors: Object.freeze(
      input.anchors.map(
        (anchor, index) =>
          readRecord(
            anchor,
            `anchors[${index}]`,
          ) as unknown as Anchor,
      ),
    ),
    expectedWorkRevision:
      readSafeInteger(
        input,
        "expectedWorkRevision",
      ),
    expectedResumeCheckpointId:
      expectedResumeCheckpointId === null
        ? null
        : entityId<"ResumeCheckpoint">(
            expectedResumeCheckpointId,
          ),
    expectedCurrentDocumentRevisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          input,
          "expectedCurrentDocumentRevisionId",
        ),
      ),
  });
}

export function parsePoc2DurabilityCrashWorkerProfile(
  value: unknown,
): Poc2DurabilityCrashWorkerProfile {
  const input = readRecord(
    value,
    "POC-2 durability crash worker profile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "POC-2 durability crash worker profile schemaVersion must be 1",
    );
  }
  if (input.kind === "compaction") {
    return parseCompactionProfile(input);
  }
  if (input.kind === "checkpoint") {
    return parseCheckpointProfile(input);
  }
  throw new Error(
    `Unsupported POC-2 durability crash worker kind: ${String(input.kind)}`,
  );
}

export function createPoc2CrashWorkerCheckpointCodec(
  codecId: string,
): PocResumeCheckpointPublicationCodec {
  return createJsonPocResumeCheckpointPublicationCodec(
    codecId,
  );
}

async function writeReachedMarker(
  profile: Poc2DurabilityCrashWorkerProfile,
  stage:
    | CompactionCrashStage
    | CheckpointCrashStage,
): Promise<void> {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      "poc-2-durability-crash-worker-reached",
      1,
      profile.scenarioId,
      profile.kind,
      stage,
    ]),
  );
  const temporaryPath = join(
    dirname(profile.reachedPath),
    randomUUID(),
  );
  const handle = await open(
    temporaryPath,
    "wx",
  );
  try {
    let byteOffset = 0;
    while (byteOffset < bytes.byteLength) {
      const { bytesWritten } =
        await handle.write(
          bytes,
          byteOffset,
          bytes.byteLength - byteOffset,
          null,
        );
      if (bytesWritten <= 0) {
        throw new Error(
          "POC-2 crash worker marker write made no progress",
        );
      }
      byteOffset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(
    temporaryPath,
    profile.reachedPath,
  );
}

async function enterReachedPending(
  profile: Poc2DurabilityCrashWorkerProfile,
  stage:
    | CompactionCrashStage
    | CheckpointCrashStage,
): Promise<void> {
  await writeReachedMarker(profile, stage);
  if (process.channel === undefined) {
    throw new Error(
      "POC-2 crash worker lost its IPC synchronization channel",
    );
  }
  process.channel.ref();
  await new Promise<void>(() => undefined);
}

function createProfileRevisionStore(
  profile: Poc2CheckpointCrashWorkerProfile,
): RevisionStore {
  return {
    async append() {
      throw new Error(
        "POC-2 crash worker does not append revisions",
      );
    },
    async getCurrentRevision(documentId) {
      return documentId ===
        profile.document.meta.id
        ? profile.revision
        : null;
    },
    async getRevision(revisionId) {
      return revisionId === profile.revision.id
        ? profile.revision
        : null;
    },
    async materialize(revisionId) {
      if (revisionId !== profile.revision.id) {
        throw new Error(
          "POC-2 crash worker revision identity conflict",
        );
      }
      return profile.revisionContent;
    },
  };
}

function createProfileWritingCatalog(
  profile: Poc2CheckpointCrashWorkerProfile,
): WritingCatalog {
  return {
    getWork(workId) {
      return workId === profile.work.meta.id
        ? profile.work
        : null;
    },
    getDocument(documentId) {
      return documentId ===
        profile.document.meta.id
        ? profile.document
        : null;
    },
    getDocumentForWork(
      workId,
      documentId,
    ) {
      return workId === profile.work.meta.id &&
        documentId === profile.document.meta.id
        ? profile.document
        : null;
    },
  };
}

async function executeCompactionProfile(
  profile: Poc2CompactionCrashWorkerProfile,
): Promise<void> {
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      profile.checksumAlgorithm,
    );
  const port = createPocJournalCompactionPort({
    storagePlan: profile.storagePlan,
    checksumAdapter,
    onStage: async (
      stage: PocJournalCompactionStage,
    ) => {
      if (stage === profile.targetStage) {
        await enterReachedPending(
          profile,
          stage,
        );
      }
    },
  });
  const command =
    new CompactJournalIntoRevision({
      checksumAdapter,
      port,
    });
  await command.execute({
    compactionId:
      profile.storagePlan.compactionId,
    expectedJournalEndByteOffset:
      profile.expectedJournalEndByteOffset,
    targets: [profile.target],
    payloads: [
      new Uint8Array(
        Buffer.from(
          profile.payloadBase64,
          "base64",
        ),
      ),
    ],
    revisionPlans: [profile.revisionPlan],
  });
}

async function executeCheckpointProfile(
  profile: Poc2CheckpointCrashWorkerProfile,
): Promise<void> {
  const revisionStore =
    createProfileRevisionStore(profile);
  const catalog =
    createProfileWritingCatalog(profile);
  const transaction =
    createPocResumeCheckpointCaptureTransaction({
      works: [profile.work],
      checkpoints:
        profile.baselineCheckpoints,
      anchors: profile.anchors,
      revisionStore,
      storagePlan: profile.storagePlan,
      codec:
        createPoc2CrashWorkerCheckpointCodec(
          profile.codecId,
        ),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          profile.checksumAlgorithm,
        ),
      onStage: async (
        stage:
          PocResumeCheckpointPublicationStage,
      ) => {
        if (stage === profile.targetStage) {
          await enterReachedPending(
            profile,
            stage,
          );
        }
      },
    });
  const command = new CaptureResumeCheckpoint({
    catalog,
    revisionStore,
    transaction,
  });
  await command.execute({
    checkpoint: profile.checkpoint,
    expectedWorkRevision:
      profile.expectedWorkRevision,
    expectedResumeCheckpointId:
      profile.expectedResumeCheckpointId,
    expectedCurrentDocumentRevisionId:
      profile.expectedCurrentDocumentRevisionId,
  });
}

async function executeWorkerProfile(
  profile: Poc2DurabilityCrashWorkerProfile,
): Promise<void> {
  if (profile.kind === "compaction") {
    await executeCompactionProfile(profile);
    return;
  }
  await executeCheckpointProfile(profile);
}

function initializeCrashWorker(): void {
  if (process.send === undefined) {
    throw new Error(
      "POC-2 durability crash worker requires an IPC parent",
    );
  }
  process.send({
    type: "poc-2-durability-crash-worker-ready",
  });
  process.once("message", (value: unknown) => {
    void (async () => {
      const input = readRecord(
        value,
        "POC-2 crash worker IPC message",
      );
      assertOnlyFields(
        input,
        ["type", "profile"],
        "POC-2 crash worker IPC message",
      );
      if (
        input.type !==
        "poc-2-durability-crash-worker-run"
      ) {
        throw new Error(
          "Unsupported POC-2 crash worker IPC message type",
        );
      }
      const profile =
        parsePoc2DurabilityCrashWorkerProfile(
          input.profile,
        );
      await executeWorkerProfile(profile);
      process.send?.({
        type: "poc-2-durability-crash-worker-completed",
        scenarioId: profile.scenarioId,
      });
    })().catch((error: unknown) => {
      process.send?.({
        type: "poc-2-durability-crash-worker-failed",
        errorName:
          error instanceof Error
            ? error.name
            : typeof error,
      });
      process.exitCode = 1;
    });
  });
}

if (
  process.env
    .EUM_STUDIO_POC_2_DURABILITY_CRASH_WORKER ===
  "1"
) {
  initializeCrashWorker();
}
