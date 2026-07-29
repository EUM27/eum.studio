import {
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseCanonicalChangeBatch,
  parseChangeBatch,
} from "../application/persistence/change-batch";
import { scanJournalFrames } from "../platform/journal/journal-frame";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  createManuscriptPersistenceRuntime,
  createManuscriptSaveHandler,
} from "./manuscript-persistence-runtime";

function selectRuntimeHashAlgorithm(): string {
  const algorithms = getHashes();
  if (algorithms.length === 0) {
    throw new Error("Node.js runtime exposes no hash algorithms");
  }
  return algorithms[randomInt(0, algorithms.length)] as string;
}

function createDocumentProfileInput() {
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  return {
    document,
    profile: {
      schemaVersion: 1,
      initialDocumentId: document.documentId,
      documents: [document],
    },
  };
}

async function removeVerifiedTemporaryDirectory(
  directory: string,
): Promise<void> {
  const temporaryRoot = resolve(tmpdir());
  const resolvedDirectory = resolve(directory);
  if (
    resolvedDirectory === temporaryRoot ||
    !resolvedDirectory.startsWith(temporaryRoot)
  ) {
    throw new Error(
      "Refusing to remove a directory outside the OS temporary root",
    );
  }
  await rm(resolvedDirectory, { recursive: true, force: true });
}

describe("manuscript persistence runtime", () => {
  it("returns an explicit failure without a configured runtime", async () => {
    const handler = createManuscriptSaveHandler(null);

    await expect(handler({ [randomUUID()]: randomUUID() })).rejects.toThrow(
      /unavailable/i,
    );
  });

  it("joins exact document ownership to caller sequence and durably appends through the runtime adapter", async () => {
    const directory = await mkdtemp(join(tmpdir(), randomUUID()));
    const journalPath = join(directory, randomUUID());
    const checksumAlgorithm = selectRuntimeHashAlgorithm();
    const { document, profile: documentProfileInput } =
      createDocumentProfileInput();
    const nextSequence = randomInt(0, 10_000);
    const insertedText = randomUUID();
    const documentProfile =
      parseManuscriptDocumentProfile(documentProfileInput);
    const journalProfile =
      parseManuscriptJournalRuntimeProfile({
        schemaVersion: 1,
        journalPath,
        checksumAlgorithm,
        documentSequences: [
          {
            documentId: document.documentId,
            nextSequence,
          },
        ],
      });
    const stages: string[] = [];
    const runtime = createManuscriptPersistenceRuntime({
      documentProfile,
      journalProfile,
      onSaveStage: async (stage) => {
        stages.push(`save:${stage}`);
      },
      onJournalStage: async (stage) => {
        stages.push(`journal:${stage}`);
      },
    });
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: randomUUID(),
      workId: document.workId,
      documentId: document.documentId,
      baseRevisionId: document.documentRevisionId,
      sequence: nextSequence,
      createdAt: new Date().toISOString(),
      beforeTextLengthUtf16: document.initialText.length,
      afterTextLengthUtf16:
        document.initialText.length + insertedText.length,
      changes: [
        {
          fromUtf16: document.initialText.length,
          toUtf16: document.initialText.length,
          insertedText,
        },
      ],
    });

    try {
      const receipt = await runtime.saveChangeBatch.execute(batch);
      const adapter =
        createNodeCryptoJournalChecksumAdapter(
          checksumAlgorithm,
        );
      const scan = await scanJournalFrames(
        await readFile(journalPath),
        (adapterId) =>
          adapterId === adapter.id ? adapter : null,
      );

      expect(scan.tail).toBeNull();
      expect(scan.records).toHaveLength(1);
      expect(
        parseCanonicalChangeBatch(
          scan.records[0]?.payload ?? new Uint8Array(),
        ),
      ).toEqual(batch);
      expect(receipt).toMatchObject({
        workId: batch.workId,
        documentId: batch.documentId,
        baseRevisionId: batch.baseRevisionId,
        batchId: batch.batchId,
        sequence: batch.sequence,
        frameStartByteOffset:
          scan.records[0]?.frameStartByteOffset,
        frameEndByteOffset:
          scan.records[0]?.frameEndByteOffset,
      });
      expect(stages).toEqual([
        "save:target-validated",
        "save:before-journal-append",
        "journal:frame-written-before-sync",
      ]);
    } finally {
      await removeVerifiedTemporaryDirectory(directory);
    }
  });

  it("rejects missing or unregistered sequence documents instead of falling back", () => {
    const { document, profile: documentProfileInput } =
      createDocumentProfileInput();
    const documentProfile =
      parseManuscriptDocumentProfile(documentProfileInput);
    const baseJournalInput = {
      schemaVersion: 1,
      journalPath: randomUUID(),
      checksumAlgorithm: selectRuntimeHashAlgorithm(),
    };

    expect(() =>
      createManuscriptPersistenceRuntime({
        documentProfile,
        journalProfile:
          parseManuscriptJournalRuntimeProfile({
            ...baseJournalInput,
            documentSequences: [
              {
                documentId: randomUUID(),
                nextSequence: randomInt(0, 10_000),
              },
            ],
          }),
      }),
    ).toThrow();

    expect(() =>
      createManuscriptPersistenceRuntime({
        documentProfile,
        journalProfile:
          parseManuscriptJournalRuntimeProfile({
            ...baseJournalInput,
            documentSequences: [
              {
                documentId: document.documentId,
                nextSequence: randomInt(0, 10_000),
              },
              {
                documentId: randomUUID(),
                nextSequence: randomInt(0, 10_000),
              },
            ],
          }),
      }),
    ).toThrow();
  });

  it("rejects a persistence target without a durable base revision", () => {
    const { document, profile } = createDocumentProfileInput();
    const documentProfile =
      parseManuscriptDocumentProfile({
        ...profile,
        documents: [
          {
            ...document,
            documentRevisionId: null,
          },
        ],
      });
    const journalProfile =
      parseManuscriptJournalRuntimeProfile({
        schemaVersion: 1,
        journalPath: randomUUID(),
        checksumAlgorithm: selectRuntimeHashAlgorithm(),
        documentSequences: [
          {
            documentId: document.documentId,
            nextSequence: randomInt(0, 10_000),
          },
        ],
      });

    expect(() =>
      createManuscriptPersistenceRuntime({
        documentProfile,
        journalProfile,
      }),
    ).toThrow(/revision/i);
  });
});
