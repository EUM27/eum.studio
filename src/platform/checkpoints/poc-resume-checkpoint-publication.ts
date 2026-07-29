import {
  open,
  readFile,
  rename,
  stat,
} from "node:fs/promises";
import {
  dirname,
  resolve,
} from "node:path";
import { isDeepStrictEqual } from "node:util";

import type {
  CommitResumeCheckpointCaptureInput,
  ResumeCheckpointCaptureResult,
  ResumeCheckpointCaptureTransaction,
} from "../../application/checkpoints/capture-resume-checkpoint";
import { ResumeCheckpointConflictError } from "../../application/checkpoints/capture-resume-checkpoint";
import type { RevisionReader } from "../../application/revisions/revision-store";
import type {
  Anchor,
  EntityId,
  ResumeCheckpoint,
  Work,
} from "../../domain/writing";
import type { JournalChecksumAdapter } from "../journal/journal-checksum";
import {
  encodeJournalFrame,
  scanJournalFrames,
} from "../journal/journal-frame";

export type PocResumeCheckpointStoragePlan = {
  readonly publicationId:
    EntityId<"ResumeCheckpointPublication">;
  readonly publicationTemporaryPath: string;
  readonly publicationPath: string;
};

export type PocResumeCheckpointPublicationPayload = {
  readonly publicationId:
    EntityId<"ResumeCheckpointPublication">;
  readonly codecId: string;
  readonly expectedWorkRevision: number;
  readonly expectedResumeCheckpointId:
    | EntityId<"ResumeCheckpoint">
    | null;
  readonly expectedCurrentDocumentRevisionId:
    EntityId<"DocumentRevision">;
  readonly nextWork: Work;
  readonly checkpoint: ResumeCheckpoint;
  readonly anchors: readonly Anchor[];
};

export type PocResumeCheckpointPublicationCodec = {
  readonly id: string;
  encode(
    payload: PocResumeCheckpointPublicationPayload,
  ): Promise<Uint8Array>;
  decode(
    bytes: Uint8Array,
  ): Promise<PocResumeCheckpointPublicationPayload>;
};

export type PocResumeCheckpointPublicationStage =
  | "publication-temp-synced"
  | "before-publication-rename"
  | "publication-renamed";

export type PocResumeCheckpointState = {
  readonly works: readonly Work[];
  readonly checkpoints: readonly ResumeCheckpoint[];
  readonly anchors: readonly Anchor[];
};

export type PocResumeCheckpointRecovery =
  | {
      readonly status: "baseline";
      readonly state: PocResumeCheckpointState;
    }
  | {
      readonly status: "invalid";
      readonly reason:
        | "invalid-frame"
        | "codec-error"
        | "identity-conflict"
        | "revision-conflict";
      readonly state: PocResumeCheckpointState;
    }
  | {
      readonly status: "published";
      readonly publicationId:
        EntityId<"ResumeCheckpointPublication">;
      readonly state: PocResumeCheckpointState;
    };

type ResumeCheckpointMutableState = {
  readonly works: ReadonlyMap<EntityId<"Work">, Work>;
  readonly checkpoints: ReadonlyMap<
    EntityId<"ResumeCheckpoint">,
    ResumeCheckpoint
  >;
  readonly anchors: ReadonlyMap<
    EntityId<"Anchor">,
    Anchor
  >;
};

function freezeWorkSnapshot(work: Work): Work {
  const customFields =
    work.customFields === undefined
      ? undefined
      : Object.freeze({ ...work.customFields });
  return Object.freeze({
    ...work,
    meta: Object.freeze({ ...work.meta }),
    ...(customFields === undefined
      ? {}
      : { customFields }),
  });
}

function freezeCheckpointSnapshot(
  checkpoint: ResumeCheckpoint,
): ResumeCheckpoint {
  const contextRefs =
    checkpoint.contextRefs === undefined
      ? undefined
      : Object.freeze(
          checkpoint.contextRefs.map((contextRef) =>
            Object.freeze({ ...contextRef }),
          ),
        );
  return Object.freeze({
    ...checkpoint,
    meta: Object.freeze({ ...checkpoint.meta }),
    ...(contextRefs === undefined
      ? {}
      : { contextRefs }),
  });
}

function freezeAnchorSnapshot(
  anchor: Anchor,
): Anchor {
  return Object.freeze({
    ...anchor,
    meta: Object.freeze({ ...anchor.meta }),
    resolutionEvidence: Object.freeze({
      ...anchor.resolutionEvidence,
      matchedEvidence: Object.freeze([
        ...anchor.resolutionEvidence.matchedEvidence,
      ]),
      candidateOffsets: Object.freeze([
        ...anchor.resolutionEvidence.candidateOffsets,
      ]),
    }),
  });
}

function currentCheckpointId(
  work: Work,
): EntityId<"ResumeCheckpoint"> | null {
  return work.resumeCheckpointId ?? null;
}

function createMutableState(input: {
  readonly works: readonly Work[];
  readonly checkpoints?: readonly ResumeCheckpoint[];
  readonly anchors?: readonly Anchor[];
}): ResumeCheckpointMutableState {
  const works = new Map<EntityId<"Work">, Work>();
  for (const work of input.works) {
    if (works.has(work.meta.id)) {
      throw new Error(
        `Duplicate Work identity: ${work.meta.id}`,
      );
    }
    const snapshot = freezeWorkSnapshot(work);
    works.set(snapshot.meta.id, snapshot);
  }
  const checkpoints = new Map<
    EntityId<"ResumeCheckpoint">,
    ResumeCheckpoint
  >();
  for (const checkpoint of input.checkpoints ?? []) {
    if (checkpoints.has(checkpoint.meta.id)) {
      throw new Error(
        `Duplicate ResumeCheckpoint identity: ${checkpoint.meta.id}`,
      );
    }
    const snapshot =
      freezeCheckpointSnapshot(checkpoint);
    checkpoints.set(snapshot.meta.id, snapshot);
  }
  const anchors = new Map<
    EntityId<"Anchor">,
    Anchor
  >();
  for (const anchor of input.anchors ?? []) {
    if (anchors.has(anchor.meta.id)) {
      throw new Error(
        `Duplicate Anchor identity: ${anchor.meta.id}`,
      );
    }
    const snapshot = freezeAnchorSnapshot(anchor);
    anchors.set(snapshot.meta.id, snapshot);
  }
  return { works, checkpoints, anchors };
}

function freezeState(
  state: ResumeCheckpointMutableState,
): PocResumeCheckpointState {
  return Object.freeze({
    works: Object.freeze([
      ...state.works.values(),
    ]),
    checkpoints: Object.freeze([
      ...state.checkpoints.values(),
    ]),
    anchors: Object.freeze([
      ...state.anchors.values(),
    ]),
  });
}

function validateStoragePlan(
  storagePlan: PocResumeCheckpointStoragePlan,
): void {
  if (
    storagePlan.publicationTemporaryPath.length === 0 ||
    storagePlan.publicationPath.length === 0
  ) {
    throw new Error(
      "POC ResumeCheckpoint publication paths must be provided by the caller",
    );
  }
  if (
    resolve(storagePlan.publicationTemporaryPath) ===
    resolve(storagePlan.publicationPath)
  ) {
    throw new Error(
      "POC ResumeCheckpoint publication paths must be distinct",
    );
  }
  if (
    dirname(resolve(storagePlan.publicationTemporaryPath)) !==
    dirname(resolve(storagePlan.publicationPath))
  ) {
    throw new Error(
      "POC ResumeCheckpoint publication paths must share a directory",
    );
  }
}

async function assertFinalPathMissing(
  filePath: string,
): Promise<void> {
  try {
    await stat(filePath);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code ===
      "ENOENT"
    ) {
      return;
    }
    throw error;
  }
  throw new Error(
    `POC ResumeCheckpoint publication already exists: ${filePath}`,
  );
}

async function writeDurablyExclusive(
  filePath: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await open(filePath, "wx");
  try {
    let byteOffset = 0;
    while (byteOffset < bytes.byteLength) {
      const { bytesWritten } = await handle.write(
        bytes,
        byteOffset,
        bytes.byteLength - byteOffset,
        null,
      );
      if (bytesWritten <= 0) {
        throw new Error(
          `POC ResumeCheckpoint publication write made no progress: ${filePath}`,
        );
      }
      byteOffset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readMetaId(
  value: unknown,
): string | null {
  if (!isRecord(value) || !isRecord(value.meta)) {
    return null;
  }
  return typeof value.meta.id === "string" &&
    value.meta.id.length > 0
    ? value.meta.id
    : null;
}

function decodedPayloadMatchesBaseline(
  payload: PocResumeCheckpointPublicationPayload,
  input: {
    readonly storagePlan:
      PocResumeCheckpointStoragePlan;
    readonly codec:
      PocResumeCheckpointPublicationCodec;
    readonly baseline:
      ResumeCheckpointMutableState;
  },
): boolean {
  if (
    !isRecord(payload) ||
    payload.publicationId !==
      input.storagePlan.publicationId ||
    payload.codecId !== input.codec.id ||
    !Number.isSafeInteger(
      payload.expectedWorkRevision,
    ) ||
    payload.expectedWorkRevision < 0 ||
    !isRecord(payload.nextWork) ||
    !isRecord(payload.nextWork.meta) ||
    !isRecord(payload.checkpoint) ||
    !isRecord(payload.checkpoint.meta) ||
    !Array.isArray(payload.anchors)
  ) {
    return false;
  }
  const workId = readMetaId(payload.nextWork);
  const checkpointId = readMetaId(
    payload.checkpoint,
  );
  if (workId === null || checkpointId === null) {
    return false;
  }
  const currentWork = input.baseline.works.get(
    workId as EntityId<"Work">,
  );
  if (
    currentWork === undefined ||
    currentWork.meta.revision !==
      payload.expectedWorkRevision ||
    currentCheckpointId(currentWork) !==
      payload.expectedResumeCheckpointId ||
    payload.nextWork.meta.revision !==
      payload.expectedWorkRevision + 1 ||
    payload.nextWork.resumeCheckpointId !==
      checkpointId ||
    payload.checkpoint.workId !== workId ||
    payload.checkpoint.documentRevisionId !==
      payload.expectedCurrentDocumentRevisionId ||
    input.baseline.checkpoints.has(
      checkpointId as EntityId<"ResumeCheckpoint">,
    )
  ) {
    return false;
  }
  const seenAnchorIds = new Set<string>();
  for (const anchor of payload.anchors) {
    const anchorId = readMetaId(anchor);
    if (
      anchorId === null ||
      seenAnchorIds.has(anchorId)
    ) {
      return false;
    }
    seenAnchorIds.add(anchorId);
  }
  return (
    seenAnchorIds.size ===
      input.baseline.anchors.size &&
    [...input.baseline.anchors.keys()].every(
      (anchorId) => seenAnchorIds.has(anchorId),
    )
  );
}

function mergePublishedPayload(
  baseline: ResumeCheckpointMutableState,
  payload: PocResumeCheckpointPublicationPayload,
): ResumeCheckpointMutableState {
  const works = new Map(baseline.works);
  const checkpoints = new Map(
    baseline.checkpoints,
  );
  const anchors = new Map(
    baseline.anchors,
  );
  const work = freezeWorkSnapshot(payload.nextWork);
  const checkpoint = freezeCheckpointSnapshot(
    payload.checkpoint,
  );
  works.set(work.meta.id, work);
  checkpoints.set(
    checkpoint.meta.id,
    checkpoint,
  );
  for (const anchor of payload.anchors) {
    const snapshot = freezeAnchorSnapshot(anchor);
    anchors.set(snapshot.meta.id, snapshot);
  }
  return { works, checkpoints, anchors };
}

function invalidRecovery(
  baseline: ResumeCheckpointMutableState,
  reason: Extract<
    PocResumeCheckpointRecovery,
    { readonly status: "invalid" }
  >["reason"],
): PocResumeCheckpointRecovery {
  return Object.freeze({
    status: "invalid",
    reason,
    state: freezeState(baseline),
  });
}

class PocResumeCheckpointCaptureTransaction
  implements ResumeCheckpointCaptureTransaction
{
  readonly #revisionStore: RevisionReader;
  readonly #storagePlan:
    PocResumeCheckpointStoragePlan;
  readonly #codec:
    PocResumeCheckpointPublicationCodec;
  readonly #checksumAdapter:
    JournalChecksumAdapter;
  readonly #onStage:
    | ((
        stage:
          PocResumeCheckpointPublicationStage,
      ) => Promise<void>)
    | undefined;
  #state: ResumeCheckpointMutableState;

  constructor(input: {
    readonly state: ResumeCheckpointMutableState;
    readonly revisionStore: RevisionReader;
    readonly storagePlan:
      PocResumeCheckpointStoragePlan;
    readonly codec:
      PocResumeCheckpointPublicationCodec;
    readonly checksumAdapter:
      JournalChecksumAdapter;
    readonly onStage?:
      (
        stage:
          PocResumeCheckpointPublicationStage,
      ) => Promise<void>;
  }) {
    this.#state = input.state;
    this.#revisionStore = input.revisionStore;
    this.#storagePlan = input.storagePlan;
    this.#codec = input.codec;
    this.#checksumAdapter =
      input.checksumAdapter;
    this.#onStage = input.onStage;
  }

  async getWork(
    workId: EntityId<"Work">,
  ): Promise<Work | null> {
    return this.#state.works.get(workId) ?? null;
  }

  async getCheckpointById(
    checkpointId: EntityId<"ResumeCheckpoint">,
  ): Promise<ResumeCheckpoint | null> {
    return (
      this.#state.checkpoints.get(checkpointId) ??
      null
    );
  }

  async getAnchorById(
    anchorId: EntityId<"Anchor">,
  ): Promise<Anchor | null> {
    return (
      this.#state.anchors.get(anchorId) ?? null
    );
  }

  async commit(
    input: CommitResumeCheckpointCaptureInput,
  ): Promise<ResumeCheckpointCaptureResult> {
    const currentRevision =
      await this.#revisionStore.getCurrentRevision(
        input.checkpoint.documentId,
      );
    const currentWork = this.#state.works.get(
      input.checkpoint.workId,
    );
    if (currentWork === undefined) {
      throw new Error(
        `Unknown work: ${input.checkpoint.workId}`,
      );
    }
    if (
      currentWork.meta.revision !==
      input.expectedWorkRevision
    ) {
      throw new ResumeCheckpointConflictError(
        `Work revision conflict for ${input.checkpoint.workId}`,
      );
    }
    if (
      currentCheckpointId(currentWork) !==
      input.expectedResumeCheckpointId
    ) {
      throw new ResumeCheckpointConflictError(
        `Resume checkpoint pointer conflict for ${input.checkpoint.workId}`,
      );
    }
    if (
      currentRevision?.id !==
        input.expectedCurrentDocumentRevisionId ||
      input.checkpoint.documentRevisionId !==
        input.expectedCurrentDocumentRevisionId
    ) {
      throw new Error(
        `Checkpoint revision is not the current durable revision for document ${input.checkpoint.documentId}`,
      );
    }
    if (
      this.#state.checkpoints.has(
        input.checkpoint.meta.id,
      )
    ) {
      throw new Error(
        `Duplicate checkpoint identity: ${input.checkpoint.meta.id}`,
      );
    }
    if (
      input.nextWork.meta.id !==
        currentWork.meta.id ||
      input.nextWork.resumeCheckpointId !==
        input.checkpoint.meta.id ||
      input.nextWork.meta.revision !==
        input.expectedWorkRevision + 1
    ) {
      throw new Error(
        "Invalid Work update for ResumeCheckpoint publication",
      );
    }

    const checkpoint = freezeCheckpointSnapshot(
      input.checkpoint,
    );
    const work = freezeWorkSnapshot(input.nextWork);
    const payload: PocResumeCheckpointPublicationPayload =
      Object.freeze({
        publicationId:
          this.#storagePlan.publicationId,
        codecId: this.#codec.id,
        expectedWorkRevision:
          input.expectedWorkRevision,
        expectedResumeCheckpointId:
          input.expectedResumeCheckpointId,
        expectedCurrentDocumentRevisionId:
          input.expectedCurrentDocumentRevisionId,
        nextWork: work,
        checkpoint,
        anchors: Object.freeze([
          ...this.#state.anchors.values(),
        ]),
      });
    const encoded = await this.#codec.encode(
      payload,
    );
    const decoded = await this.#codec.decode(
      encoded,
    );
    if (
      !isDeepStrictEqual(decoded, payload) ||
      !decodedPayloadMatchesBaseline(decoded, {
        storagePlan: this.#storagePlan,
        codec: this.#codec,
        baseline: this.#state,
      })
    ) {
      throw new Error(
        "POC ResumeCheckpoint codec did not preserve the complete publication state",
      );
    }
    const frame = await encodeJournalFrame(
      encoded,
      this.#checksumAdapter,
    );
    await assertFinalPathMissing(
      this.#storagePlan.publicationPath,
    );
    await writeDurablyExclusive(
      this.#storagePlan
        .publicationTemporaryPath,
      frame,
    );
    await this.#onStage?.(
      "publication-temp-synced",
    );
    await this.#onStage?.(
      "before-publication-rename",
    );
    await rename(
      this.#storagePlan
        .publicationTemporaryPath,
      this.#storagePlan.publicationPath,
    );
    await this.#onStage?.(
      "publication-renamed",
    );

    const works = new Map(this.#state.works);
    const checkpoints = new Map(
      this.#state.checkpoints,
    );
    works.set(work.meta.id, work);
    checkpoints.set(checkpoint.meta.id, checkpoint);
    this.#state = {
      works,
      checkpoints,
      anchors: this.#state.anchors,
    };
    return Object.freeze({ checkpoint, work });
  }
}

export function createPocResumeCheckpointCaptureTransaction(
  input: {
    readonly works: readonly Work[];
    readonly checkpoints?:
      readonly ResumeCheckpoint[];
    readonly anchors?: readonly Anchor[];
    readonly revisionStore: RevisionReader;
    readonly storagePlan:
      PocResumeCheckpointStoragePlan;
    readonly codec:
      PocResumeCheckpointPublicationCodec;
    readonly checksumAdapter:
      JournalChecksumAdapter;
    readonly onStage?:
      (
        stage:
          PocResumeCheckpointPublicationStage,
      ) => Promise<void>;
  },
): ResumeCheckpointCaptureTransaction {
  validateStoragePlan(input.storagePlan);
  if (input.codec.id.length === 0) {
    throw new Error(
      "POC ResumeCheckpoint publication codec id must not be empty",
    );
  }
  return new PocResumeCheckpointCaptureTransaction({
    state: createMutableState(input),
    revisionStore: input.revisionStore,
    storagePlan: input.storagePlan,
    codec: input.codec,
    checksumAdapter: input.checksumAdapter,
    ...(input.onStage === undefined
      ? {}
      : { onStage: input.onStage }),
  });
}

export async function resolvePocResumeCheckpointPublication(
  input: {
    readonly works: readonly Work[];
    readonly checkpoints?:
      readonly ResumeCheckpoint[];
    readonly anchors?: readonly Anchor[];
    readonly revisionStore: RevisionReader;
    readonly storagePlan:
      PocResumeCheckpointStoragePlan;
    readonly codec:
      PocResumeCheckpointPublicationCodec;
    readonly checksumAdapter:
      JournalChecksumAdapter;
  },
): Promise<PocResumeCheckpointRecovery> {
  validateStoragePlan(input.storagePlan);
  const baseline = createMutableState(input);
  let publicationBytes: Uint8Array;
  try {
    publicationBytes = await readFile(
      input.storagePlan.publicationPath,
    );
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code ===
      "ENOENT"
    ) {
      return Object.freeze({
        status: "baseline",
        state: freezeState(baseline),
      });
    }
    throw error;
  }

  const scan = await scanJournalFrames(
    publicationBytes,
    (adapterId) =>
      adapterId === input.checksumAdapter.id
        ? input.checksumAdapter
        : null,
  );
  if (
    scan.tail !== null ||
    scan.records.length !== 1 ||
    scan.verifiedPrefixByteLength !==
      publicationBytes.byteLength
  ) {
    return invalidRecovery(
      baseline,
      "invalid-frame",
    );
  }

  let payload: PocResumeCheckpointPublicationPayload;
  try {
    payload = await input.codec.decode(
      scan.records[0]?.payload ??
        new Uint8Array(),
    );
  } catch {
    return invalidRecovery(
      baseline,
      "codec-error",
    );
  }
  if (
    !decodedPayloadMatchesBaseline(payload, {
      storagePlan: input.storagePlan,
      codec: input.codec,
      baseline,
    })
  ) {
    return invalidRecovery(
      baseline,
      "identity-conflict",
    );
  }

  let currentRevisionId:
    | EntityId<"DocumentRevision">
    | null;
  try {
    currentRevisionId = (
      await input.revisionStore.getCurrentRevision(
        payload.checkpoint.documentId,
      )
    )?.id ?? null;
  } catch {
    return invalidRecovery(
      baseline,
      "revision-conflict",
    );
  }
  if (
    currentRevisionId !==
    payload.expectedCurrentDocumentRevisionId
  ) {
    return invalidRecovery(
      baseline,
      "revision-conflict",
    );
  }

  let published: ResumeCheckpointMutableState;
  try {
    published = mergePublishedPayload(
      baseline,
      payload,
    );
  } catch {
    return invalidRecovery(
      baseline,
      "codec-error",
    );
  }
  return Object.freeze({
    status: "published",
    publicationId:
      input.storagePlan.publicationId,
    state: freezeState(published),
  });
}
