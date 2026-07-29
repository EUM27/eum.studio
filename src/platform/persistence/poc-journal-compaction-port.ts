import {
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import {
  dirname,
  resolve,
} from "node:path";

import type {
  JournalCompactionPort,
  JournalCompactionPublication,
  PreparedCompactionRevision,
  PrepareCompactionRevisionInput,
  PublishJournalCompactionInput,
} from "../../application/persistence/compact-journal-into-revision";
import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import type {
  JournalChecksumAdapter,
  ResolveJournalChecksumAdapter,
} from "../journal/journal-checksum";
import {
  encodeJournalFrame,
  scanJournalFrames,
} from "../journal/journal-frame";

const PUBLICATION_TYPE =
  "poc-journal-compaction-publication";
const PUBLICATION_SCHEMA_VERSION = 1;

export type PocJournalCompactionStoragePlan = {
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly sourceJournalPath: string;
  readonly nextJournalPath: string;
  readonly publicationTemporaryPath: string;
  readonly publicationPath: string;
  readonly revisionFiles: readonly {
    readonly revisionId:
      EntityId<"DocumentRevision">;
    readonly contentPath: string;
  }[];
};

export type PocJournalCompactionStage =
  | "revision-content-synced"
  | "next-journal-synced"
  | "publication-temp-synced"
  | "before-publication-rename"
  | "publication-renamed"
  | "before-source-journal-reclamation";

export type PocJournalCompactionStageContext = {
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly revisionId?:
    EntityId<"DocumentRevision">;
};

export type PocPublishedCompactionRevision = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedBaseRevisionId:
    EntityId<"DocumentRevision">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
  readonly contentRef: string;
  readonly content: string;
  readonly checksumAdapterId: string;
  readonly sourceChecksum: Uint8Array;
  readonly resultChecksum: Uint8Array;
};

export type PocJournalCompactionRecovery =
  | {
      readonly status: "not-published";
    }
  | {
      readonly status: "invalid";
      readonly reason:
        | "invalid-frame"
        | "invalid-payload"
        | "identity-conflict"
        | "journal-generation-invalid"
        | "content-mismatch";
    }
  | {
      readonly status: "published";
      readonly compactionId:
        EntityId<"JournalCompaction">;
      readonly consumedThroughByteOffset: number;
      readonly sourceJournalPath: string;
      readonly activeJournalPath: string;
      readonly revisions:
        readonly PocPublishedCompactionRevision[];
    };

export class PocJournalCompactionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "PocJournalCompactionConflictError";
  }
}

type PublicationRevisionTuple = readonly [
  string,
  string,
  string,
  string,
  number,
  string,
  string,
  string,
  string,
];

type PublicationTuple = readonly [
  typeof PUBLICATION_TYPE,
  typeof PUBLICATION_SCHEMA_VERSION,
  string,
  string,
  string,
  number,
  string,
  readonly PublicationRevisionTuple[],
];

function encodeCanonicalManuscriptBytes(
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

function decodeCanonicalManuscriptBytes(
  bytes: Uint8Array,
): string | null {
  if (bytes.byteLength % 2 !== 0) {
    return null;
  }
  const chunks: string[] = [];
  const chunkCodeUnits: number[] = [];
  for (
    let byteIndex = 0;
    byteIndex < bytes.byteLength;
    byteIndex += 2
  ) {
    chunkCodeUnits.push(
      (bytes[byteIndex] ?? 0) |
        ((bytes[byteIndex + 1] ?? 0) << 8),
    );
    if (chunkCodeUnits.length === 4_096) {
      chunks.push(
        String.fromCharCode(...chunkCodeUnits),
      );
      chunkCodeUnits.length = 0;
    }
  }
  if (chunkCodeUnits.length > 0) {
    chunks.push(
      String.fromCharCode(...chunkCodeUnits),
    );
  }
  return chunks.join("");
}

function bytesEqual(
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

function bytesToHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}

function hexToBytes(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]+$/.test(value)
  ) {
    return null;
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = Number.parseInt(
      value.slice(index * 2, index * 2 + 2),
      16,
    );
    if (!Number.isInteger(byte)) {
      return null;
    }
    bytes[index] = byte;
  }
  return bytes;
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
          `Durable POC write made no progress: ${filePath}`,
        );
      }
      byteOffset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function createEmptyFileDurablyExclusive(
  filePath: string,
): Promise<void> {
  const handle = await open(filePath, "wx");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function validateStoragePlan(
  storagePlan: PocJournalCompactionStoragePlan,
): Map<EntityId<"DocumentRevision">, string> {
  if (
    dirname(resolve(storagePlan.publicationTemporaryPath)) !==
    dirname(resolve(storagePlan.publicationPath))
  ) {
    throw new Error(
      "POC publication temporary and final paths must share a directory",
    );
  }

  const callerPaths = [
    storagePlan.sourceJournalPath,
    storagePlan.nextJournalPath,
    storagePlan.publicationTemporaryPath,
    storagePlan.publicationPath,
    ...storagePlan.revisionFiles.map(
      (revision) => revision.contentPath,
    ),
  ];
  if (
    callerPaths.some(
      (filePath) => filePath.length === 0,
    )
  ) {
    throw new Error(
      "POC compaction storage paths must be provided by the caller",
    );
  }
  const paths = callerPaths.map((filePath) =>
    resolve(filePath),
  );
  if (
    new Set(paths).size !== paths.length
  ) {
    throw new Error(
      "POC compaction storage paths must be distinct",
    );
  }

  const contentPathByRevision = new Map<
    EntityId<"DocumentRevision">,
    string
  >();
  for (const revision of storagePlan.revisionFiles) {
    if (
      contentPathByRevision.has(revision.revisionId)
    ) {
      throw new Error(
        `Duplicate POC revision storage plan: ${revision.revisionId}`,
      );
    }
    contentPathByRevision.set(
      revision.revisionId,
      revision.contentPath,
    );
  }
  return contentPathByRevision;
}

function createPublicationPayload(
  storagePlan: PocJournalCompactionStoragePlan,
  checksumAdapter: JournalChecksumAdapter,
  input: PublishJournalCompactionInput,
): Uint8Array {
  const tuple: PublicationTuple = Object.freeze([
    PUBLICATION_TYPE,
    PUBLICATION_SCHEMA_VERSION,
    input.compactionId,
    storagePlan.sourceJournalPath,
    storagePlan.nextJournalPath,
    input.expectedJournalEndByteOffset,
    checksumAdapter.id,
    Object.freeze(
      input.revisions.map((revision) =>
        Object.freeze([
          revision.workId,
          revision.documentId,
          revision.expectedBaseRevisionId,
          revision.revisionId,
          revision.nextSequence,
          revision.prepared.contentRef,
          revision.checksumAdapterId,
          bytesToHex(revision.sourceChecksum),
          bytesToHex(revision.resultChecksum),
        ] as const),
      ),
    ),
  ]);
  return new TextEncoder().encode(
    JSON.stringify(tuple),
  );
}

function parseString(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.length > 0
    ? value
    : null;
}

function parsePublicationTuple(
  payload: Uint8Array,
): PublicationTuple | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(payload),
    );
  } catch {
    return null;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 8 ||
    parsed[0] !== PUBLICATION_TYPE ||
    parsed[1] !== PUBLICATION_SCHEMA_VERSION ||
    parseString(parsed[2]) === null ||
    typeof parsed[3] !== "string" ||
    parsed[3].length === 0 ||
    typeof parsed[4] !== "string" ||
    parsed[4].length === 0 ||
    typeof parsed[5] !== "number" ||
    !Number.isSafeInteger(parsed[5]) ||
    parsed[5] < 0 ||
    parseString(parsed[6]) === null ||
    !Array.isArray(parsed[7])
  ) {
    return null;
  }

  for (const revision of parsed[7]) {
    if (
      !Array.isArray(revision) ||
      revision.length !== 9 ||
      revision
        .slice(0, 4)
        .some((value) => parseString(value) === null) ||
      typeof revision[4] !== "number" ||
      !Number.isSafeInteger(revision[4]) ||
      revision[4] < 0 ||
      revision
        .slice(5)
        .some((value) => parseString(value) === null) ||
      hexToBytes(revision[7]) === null ||
      hexToBytes(revision[8]) === null
    ) {
      return null;
    }
  }

  const canonicalBytes = new TextEncoder().encode(
    JSON.stringify(parsed),
  );
  return bytesEqual(canonicalBytes, payload)
    ? (parsed as unknown as PublicationTuple)
    : null;
}

function publicationForInput(
  input: PublishJournalCompactionInput,
): JournalCompactionPublication {
  return Object.freeze({
    compactionId: input.compactionId,
    consumedThroughByteOffset:
      input.expectedJournalEndByteOffset,
    revisions: Object.freeze(
      input.revisions.map((revision) =>
        Object.freeze({
          documentId: revision.documentId,
          revisionId: revision.revisionId,
          nextSequence: revision.nextSequence,
        }),
      ),
    ),
  });
}

function createInvalidRecovery(
  reason: Extract<
    PocJournalCompactionRecovery,
    { readonly status: "invalid" }
  >["reason"],
): PocJournalCompactionRecovery {
  return Object.freeze({
    status: "invalid",
    reason,
  });
}

export function createPocJournalCompactionPort(input: {
  readonly storagePlan:
    PocJournalCompactionStoragePlan;
  readonly checksumAdapter: JournalChecksumAdapter;
  readonly onStage?: (
    stage: PocJournalCompactionStage,
    context: PocJournalCompactionStageContext,
  ) => Promise<void>;
}): JournalCompactionPort {
  const contentPathByRevision = validateStoragePlan(
    input.storagePlan,
  );
  const notify = async (
    stage: PocJournalCompactionStage,
    revisionId?: EntityId<"DocumentRevision">,
  ) => {
    await input.onStage?.(
      stage,
      Object.freeze({
        compactionId:
          input.storagePlan.compactionId,
        ...(revisionId === undefined
          ? {}
          : { revisionId }),
      }),
    );
  };

  return {
    async prepareRevision(
      prepareInput: PrepareCompactionRevisionInput,
    ) {
      if (
        prepareInput.compactionId !==
        input.storagePlan.compactionId
      ) {
        throw new Error(
          `POC compaction identity conflict: ${prepareInput.compactionId}`,
        );
      }
      const contentPath = contentPathByRevision.get(
        prepareInput.revisionId,
      );
      if (contentPath === undefined) {
        throw new Error(
          `POC revision has no caller storage path: ${prepareInput.revisionId}`,
        );
      }
      await writeDurablyExclusive(
        contentPath,
        encodeCanonicalManuscriptBytes(
          prepareInput.text,
        ),
      );
      await notify(
        "revision-content-synced",
        prepareInput.revisionId,
      );
      return Object.freeze({
        compactionId: prepareInput.compactionId,
        workId: prepareInput.workId,
        documentId: prepareInput.documentId,
        expectedBaseRevisionId:
          prepareInput.expectedBaseRevisionId,
        revisionId: prepareInput.revisionId,
        contentRef: contentPath,
      });
    },

    async materializeRevision(
      prepared: PreparedCompactionRevision,
    ) {
      const contentPath = contentPathByRevision.get(
        prepared.revisionId,
      );
      if (
        contentPath === undefined ||
        contentPath !== prepared.contentRef
      ) {
        throw new Error(
          `POC prepared content path conflict: ${prepared.revisionId}`,
        );
      }
      const content =
        decodeCanonicalManuscriptBytes(
          await readFile(contentPath),
        );
      if (content === null) {
        throw new Error(
          `POC prepared content is not UTF-16LE: ${prepared.revisionId}`,
        );
      }
      return content;
    },

    async publish(
      publishInput: PublishJournalCompactionInput,
    ) {
      if (
        publishInput.compactionId !==
        input.storagePlan.compactionId
      ) {
        throw new Error(
          `POC publication identity conflict: ${publishInput.compactionId}`,
        );
      }
      const initialJournalSize = (
        await stat(input.storagePlan.sourceJournalPath)
      ).size;
      if (
        initialJournalSize !==
        publishInput.expectedJournalEndByteOffset
      ) {
        throw new PocJournalCompactionConflictError(
          `POC source journal end changed: expected ${publishInput.expectedJournalEndByteOffset}, received ${initialJournalSize}`,
        );
      }
      for (const revision of publishInput.revisions) {
        if (
          revision.checksumAdapterId !==
            input.checksumAdapter.id ||
          contentPathByRevision.get(
            revision.revisionId,
          ) !== revision.prepared.contentRef
        ) {
          throw new Error(
            `POC publication revision provenance conflict: ${revision.revisionId}`,
          );
        }
      }

      await createEmptyFileDurablyExclusive(
        input.storagePlan.nextJournalPath,
      );
      await notify("next-journal-synced");
      const publicationPayload =
        createPublicationPayload(
          input.storagePlan,
          input.checksumAdapter,
          publishInput,
        );
      const publicationFrame =
        await encodeJournalFrame(
          publicationPayload,
          input.checksumAdapter,
        );
      await writeDurablyExclusive(
        input.storagePlan.publicationTemporaryPath,
        publicationFrame,
      );
      await notify("publication-temp-synced");
      await notify("before-publication-rename");

      const finalJournalSize = (
        await stat(input.storagePlan.sourceJournalPath)
      ).size;
      if (
        finalJournalSize !==
        publishInput.expectedJournalEndByteOffset
      ) {
        throw new PocJournalCompactionConflictError(
          `POC source journal changed before publication: expected ${publishInput.expectedJournalEndByteOffset}, received ${finalJournalSize}`,
        );
      }
      await rename(
        input.storagePlan.publicationTemporaryPath,
        input.storagePlan.publicationPath,
      );
      await notify("publication-renamed");
      return publicationForInput(publishInput);
    },

    async reclaim() {
      await notify(
        "before-source-journal-reclamation",
      );
      await unlink(
        input.storagePlan.sourceJournalPath,
      );
    },
  };
}

export async function resolvePocJournalCompaction(
  input: {
    readonly storagePlan:
      PocJournalCompactionStoragePlan;
    readonly checksumAdapter:
      JournalChecksumAdapter;
    readonly resolveActiveJournalChecksumAdapter:
      ResolveJournalChecksumAdapter;
  },
): Promise<PocJournalCompactionRecovery> {
  const contentPathByRevision = validateStoragePlan(
    input.storagePlan,
  );
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
        status: "not-published",
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
    return createInvalidRecovery("invalid-frame");
  }
  const publicationTuple = parsePublicationTuple(
    scan.records[0]?.payload ?? new Uint8Array(),
  );
  if (publicationTuple === null) {
    return createInvalidRecovery("invalid-payload");
  }
  const [
    ,
    ,
    compactionId,
    sourceJournalPath,
    nextJournalPath,
    consumedThroughByteOffset,
    checksumAdapterId,
    revisionTuples,
  ] = publicationTuple;
  if (
    compactionId !==
      input.storagePlan.compactionId ||
    sourceJournalPath !==
      input.storagePlan.sourceJournalPath ||
    nextJournalPath !==
      input.storagePlan.nextJournalPath ||
    checksumAdapterId !==
      input.checksumAdapter.id ||
    revisionTuples.length !==
      input.storagePlan.revisionFiles.length
  ) {
    return createInvalidRecovery("identity-conflict");
  }

  try {
    const nextJournalBytes = await readFile(
      input.storagePlan.nextJournalPath,
    );
    const nextJournalScan = await scanJournalFrames(
      nextJournalBytes,
      input.resolveActiveJournalChecksumAdapter,
    );
    if (nextJournalScan.tail !== null) {
      return createInvalidRecovery(
        "journal-generation-invalid",
      );
    }
  } catch {
    return createInvalidRecovery(
      "journal-generation-invalid",
    );
  }

  const revisions: PocPublishedCompactionRevision[] =
    [];
  const seenRevisionIds = new Set<
    EntityId<"DocumentRevision">
  >();
  for (const tuple of revisionTuples) {
    const [
      workId,
      documentId,
      expectedBaseRevisionId,
      revisionIdValue,
      nextSequence,
      contentRef,
      revisionChecksumAdapterId,
      sourceChecksumHex,
      resultChecksumHex,
    ] = tuple;
    const revisionId =
      entityId<"DocumentRevision">(
        revisionIdValue,
      );
    if (
      seenRevisionIds.has(revisionId) ||
      contentPathByRevision.get(revisionId) !==
        contentRef ||
      revisionChecksumAdapterId !==
        input.checksumAdapter.id
    ) {
      return createInvalidRecovery(
        "identity-conflict",
      );
    }
    seenRevisionIds.add(revisionId);
    const sourceChecksum =
      hexToBytes(sourceChecksumHex);
    const resultChecksum =
      hexToBytes(resultChecksumHex);
    if (
      sourceChecksum === null ||
      resultChecksum === null ||
      !bytesEqual(sourceChecksum, resultChecksum)
    ) {
      return createInvalidRecovery(
        "invalid-payload",
      );
    }

    let contentBytes: Uint8Array;
    try {
      contentBytes = await readFile(contentRef);
    } catch {
      return createInvalidRecovery(
        "content-mismatch",
      );
    }
    const content =
      decodeCanonicalManuscriptBytes(contentBytes);
    const computedChecksum =
      await input.checksumAdapter.digest(
        contentBytes,
      );
    if (
      content === null ||
      !bytesEqual(
        sourceChecksum,
        computedChecksum,
      )
    ) {
      return createInvalidRecovery(
        "content-mismatch",
      );
    }
    revisions.push(
      Object.freeze({
        workId: entityId<"Work">(workId),
        documentId:
          entityId<"Document">(documentId),
        expectedBaseRevisionId:
          entityId<"DocumentRevision">(
            expectedBaseRevisionId,
          ),
        revisionId,
        nextSequence,
        contentRef,
        content,
        checksumAdapterId:
          revisionChecksumAdapterId,
        sourceChecksum: sourceChecksum.slice(),
        resultChecksum: resultChecksum.slice(),
      }),
    );
  }

  return Object.freeze({
    status: "published",
    compactionId:
      entityId<"JournalCompaction">(
        compactionId,
      ),
    consumedThroughByteOffset,
    sourceJournalPath,
    activeJournalPath: nextJournalPath,
    revisions: Object.freeze(revisions),
  });
}
