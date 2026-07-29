import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  join,
  resolve,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  CreateAnchor,
} from "../application/anchors/create-anchor";
import {
  CaptureResumeCheckpoint,
} from "../application/checkpoints/capture-resume-checkpoint";
import {
  parseManuscriptDocumentProfile,
} from "../application/editor/manuscript-document-profile";
import {
  createWritingCatalog,
  entityId,
  type Anchor,
  type Document,
  type ResumeCheckpoint,
  type Work,
} from "../domain/writing";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../platform/anchors/node-crypto-anchor-evidence";
import {
  createPocResumeCheckpointCaptureTransaction,
  type PocResumeCheckpointPublicationCodec,
  type PocResumeCheckpointPublicationPayload,
} from "../platform/checkpoints/poc-resume-checkpoint-publication";
import {
  createNodeCryptoJournalChecksumAdapter,
} from "../platform/journal/node-crypto-journal-checksum";
import {
  InMemoryRevisionStore,
} from "../platform/revisions/in-memory-revision-store";
import {
  resolvePocResumeCheckpointStartup,
} from "./poc-resume-checkpoint-startup";
import type {
  PocResumeCheckpointRuntimeProfile,
} from "./poc-resume-checkpoint-runtime-profile";

const temporaryDirectories: string[] = [];

function selectHashAlgorithm(): string {
  const algorithms = getHashes().filter(
    (algorithm) => {
      try {
        createHash(algorithm).digest();
        return true;
      } catch {
        return false;
      }
    },
  );
  const selected =
    algorithms[randomInt(0, algorithms.length)];
  if (selected === undefined) {
    throw new Error(
      "Test runtime exposes no hash algorithm",
    );
  }
  return selected;
}

function createCodec(
  id: string,
): PocResumeCheckpointPublicationCodec {
  return {
    id,
    async encode(payload) {
      return new TextEncoder().encode(
        JSON.stringify(payload),
      );
    },
    async decode(bytes) {
      return JSON.parse(
        new TextDecoder("utf-8", {
          fatal: true,
        }).decode(bytes),
      ) as PocResumeCheckpointPublicationPayload;
    },
  };
}

function createWork(recordedAt: string): Work {
  return {
    meta: {
      id: entityId<"Work">(randomUUID()),
      schemaVersion: randomInt(1, 32),
      revision: randomInt(0, 32),
      createdAt: recordedAt,
      updatedAt: recordedAt,
    },
    studioId:
      entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId:
      entityId<"WorkSettings">(
        randomUUID(),
      ),
  };
}

function createDocument(
  workId: Work["meta"]["id"],
  recordedAt: string,
): Document {
  return {
    meta: {
      id:
        entityId<"Document">(
          randomUUID(),
        ),
      schemaVersion: randomInt(1, 32),
      revision: randomInt(0, 32),
      createdAt: recordedAt,
      updatedAt: recordedAt,
    },
    workId,
    title: randomUUID(),
    orderKey: randomUUID(),
    manuscriptId:
      entityId<"Manuscript">(
        randomUUID(),
      ),
  };
}

afterEach(async () => {
  const temporaryRoot = resolve(tmpdir());
  for (
    const directory of temporaryDirectories.splice(0)
  ) {
    const resolvedDirectory = resolve(directory);
    if (
      resolvedDirectory === temporaryRoot ||
      !resolvedDirectory.startsWith(
        `${temporaryRoot}\\`,
      )
    ) {
      throw new Error(
        "Refusing to remove a test directory outside the OS temporary root",
      );
    }
    await rm(resolvedDirectory, {
      recursive: true,
      force: true,
    });
  }
});

async function createScenario(
  createTargetContent: (
    originContent: string,
  ) => string,
) {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  temporaryDirectories.push(directory);
  const recordedAt =
    new Date().toISOString();
  const work = createWork(recordedAt);
  const document = createDocument(
    work.meta.id,
    recordedAt,
  );
  const catalog = createWritingCatalog({
    works: [work],
    documents: [document],
  });
  const checksumAlgorithm =
    selectHashAlgorithm();
  const anchorEvidenceChecksumAlgorithm =
    selectHashAlgorithm();
  const describeEvidence =
    createNodeCryptoAnchorEvidenceDescriptor(
      anchorEvidenceChecksumAlgorithm,
    );
  const revisionStore =
    new InMemoryRevisionStore({
      catalog,
      describeContent: (content) => ({
        contentRef: randomUUID(),
        contentHash:
          createHash(checksumAlgorithm)
            .update(content)
            .digest("hex"),
        length: content.length,
      }),
    });
  const prefix = randomUUID();
  const selectedText =
    randomUUID().slice(
      0,
      randomInt(4, 12),
    );
  const suffix = randomUUID();
  const originContent =
    `${prefix}${selectedText}${suffix}`;
  const originRevision =
    await revisionStore.append({
      revisionId:
        entityId<"DocumentRevision">(
          randomUUID(),
        ),
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content: originContent,
      cause: randomUUID(),
      createdAt: recordedAt,
      durableAt: recordedAt,
    });
  const selectionStart = prefix.length;
  const selectionEnd =
    selectionStart + selectedText.length;
  const createAnchor = new CreateAnchor({
    catalog,
    revisionStore,
    describeEvidence,
  });
  const policy = {
    schemaVersion: 1 as const,
    version: randomUUID(),
    contextOffsetLength:
      Math.max(prefix.length, suffix.length),
  };
  const cursorAnchor =
    await createAnchor.execute({
      meta: {
        id:
          entityId<"Anchor">(
            randomUUID(),
          ),
        schemaVersion: randomInt(1, 32),
        revision: randomInt(0, 32),
        createdAt: recordedAt,
        updatedAt: recordedAt,
      },
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId:
        originRevision.id,
      startOffset: selectionStart,
      endOffset: selectionStart,
      policy,
      commandRef: randomUUID(),
      actorRef: randomUUID(),
    });
  const selectionAnchor =
    await createAnchor.execute({
      meta: {
        id:
          entityId<"Anchor">(
            randomUUID(),
          ),
        schemaVersion: randomInt(1, 32),
        revision: randomInt(0, 32),
        createdAt: recordedAt,
        updatedAt: recordedAt,
      },
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId:
        originRevision.id,
      startOffset: selectionStart,
      endOffset: selectionEnd,
      policy,
      commandRef: randomUUID(),
      actorRef: randomUUID(),
    });
  const checkpoint: ResumeCheckpoint = {
    meta: {
      id:
        entityId<"ResumeCheckpoint">(
          randomUUID(),
        ),
      schemaVersion: randomInt(1, 32),
      revision: randomInt(0, 32),
      createdAt: recordedAt,
      updatedAt: recordedAt,
    },
    workId: work.meta.id,
    documentId: document.meta.id,
    documentRevisionId:
      originRevision.id,
    cursorAnchorId:
      cursorAnchor.meta.id,
    selectionAnchorId:
      selectionAnchor.meta.id,
    workspaceMode: randomUUID(),
    capturedAt: recordedAt,
  };
  const codecId = randomUUID();
  const publicationChecksumAlgorithm =
    selectHashAlgorithm();
  const storagePlan = {
    publicationId:
      entityId<"ResumeCheckpointPublication">(
        randomUUID(),
      ),
    publicationTemporaryPath: join(
      directory,
      randomUUID(),
    ),
    publicationPath: join(
      directory,
      randomUUID(),
    ),
  };
  const transaction =
    createPocResumeCheckpointCaptureTransaction({
      works: [work],
      checkpoints: [],
      anchors: [
        cursorAnchor,
        selectionAnchor,
      ],
      revisionStore,
      storagePlan,
      codec: createCodec(codecId),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          publicationChecksumAlgorithm,
        ),
    });
  await new CaptureResumeCheckpoint({
    catalog,
    revisionStore,
    transaction,
  }).execute({
    checkpoint,
    expectedWorkRevision:
      work.meta.revision,
    expectedResumeCheckpointId: null,
    expectedCurrentDocumentRevisionId:
      originRevision.id,
  });

  const targetContent =
    createTargetContent(originContent);
  const targetRevision =
    await revisionStore.append({
      revisionId:
        entityId<"DocumentRevision">(
          randomUUID(),
        ),
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId:
        originRevision.id,
      content: targetContent,
      cause: randomUUID(),
      createdAt: recordedAt,
      durableAt: recordedAt,
    });
  const anchors: readonly Anchor[] = [
    cursorAnchor,
    selectionAnchor,
  ];
  const runtimeProfile:
    PocResumeCheckpointRuntimeProfile = {
    schemaVersion: 1,
    codecId,
    publicationChecksumAlgorithm,
    anchorEvidenceChecksumAlgorithm,
    storagePlan,
    works: [work],
    documents: [document],
    revisions: [
      {
        revision: originRevision,
        content: originContent,
      },
      {
        revision: targetRevision,
        content: targetContent,
      },
    ],
    publicationRevisionHeads: [
      {
        documentId: document.meta.id,
        revisionId:
          originRevision.id,
      },
    ],
    baselineCheckpoints: [],
    anchors,
  };
  const documentProfile =
    parseManuscriptDocumentProfile({
      schemaVersion: 1,
      initialDocumentId:
        document.meta.id,
      documents: [
        {
          workId: work.meta.id,
          documentId:
            document.meta.id,
          documentRevisionId:
            targetRevision.id,
          label: document.title,
          initialText: targetContent,
        },
      ],
    });
  return {
    work,
    document,
    originContent,
    targetContent,
    targetRevision,
    selectedText,
    selectionStart,
    selectionEnd,
    documentProfile,
    runtimeProfile,
  };
}

describe("POC ResumeCheckpoint startup composition", () => {
  it("opens the owned document and restores an exact directional selection against the confirmed revision", async () => {
    const leading = randomUUID();
    const scenario = await createScenario(
      (originContent) =>
        `${leading}${originContent}`,
    );

    await expect(
      resolvePocResumeCheckpointStartup({
        documentProfile:
          scenario.documentProfile,
        runtimeProfile:
          scenario.runtimeProfile,
      }),
    ).resolves.toEqual({
      schemaVersion: 1,
      status: "resolved",
      workId:
        scenario.work.meta.id,
      documentId:
        scenario.document.meta.id,
      targetRevisionId:
        scenario.targetRevision.id,
      selection: {
        anchor:
          leading.length +
          scenario.selectionEnd,
        head:
          leading.length +
          scenario.selectionStart,
      },
    });
  });

  it("opens the owned document without moving when current evidence is ambiguous", async () => {
    const leading = randomUUID();
    const separator = randomUUID();
    const scenario = await createScenario(
      (originContent) =>
        `${leading}${originContent}${separator}${originContent}`,
    );

    await expect(
      resolvePocResumeCheckpointStartup({
        documentProfile:
          scenario.documentProfile,
        runtimeProfile:
          scenario.runtimeProfile,
      }),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      status: "needsReview",
      workId:
        scenario.work.meta.id,
      documentId:
        scenario.document.meta.id,
      targetRevisionId:
        scenario.targetRevision.id,
      move: null,
    });
  });
});
