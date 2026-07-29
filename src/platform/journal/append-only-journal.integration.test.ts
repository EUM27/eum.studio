import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  isAbsolute,
  join,
  relative,
} from "node:path";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import type { JournalChecksumAdapter } from "./journal-checksum";
import {
  appendJournalPayloadDurably,
  scanAppendOnlyJournal,
  type AppendOnlyJournalStage,
} from "./append-only-journal";

const temporaryDirectories: string[] = [];

function createChecksumAdapter(): JournalChecksumAdapter {
  const byteLength = randomInt(8, 32);

  return {
    id: randomUUID(),
    byteLength,
    digest: async (input) => {
      const digest = new Uint8Array(byteLength);
      for (const [index, byte] of input.entries()) {
        const digestIndex = index % byteLength;
        digest[digestIndex] =
          (digest[digestIndex] ?? 0) ^ byte ^ (index & 0xff);
      }
      return digest;
    },
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), randomUUID()));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    const relativePath = relative(tmpdir(), directory);
    if (
      relativePath.length === 0 ||
      relativePath.startsWith("..") ||
      isAbsolute(relativePath)
    ) {
      throw new Error(
        `Refusing to remove a directory outside the OS temp root: ${directory}`,
      );
    }
    await rm(directory, { recursive: true, force: true });
  }
});

describe("append-only journal", () => {
  it("reaches the frame-written stage before sync without returning a durable receipt", async () => {
    const directory = await createTemporaryDirectory();
    const journalPath = join(directory, randomUUID());
    const checksumAdapter = createChecksumAdapter();
    const payload = randomBytes(randomInt(8, 128));
    const stageFailure = new Error(randomUUID());
    const stages: AppendOnlyJournalStage[] = [];

    await expect(
      appendJournalPayloadDurably({
        journalPath,
        payload,
        checksumAdapter,
        onStage: async (stage, context) => {
          stages.push(stage);
          expect(context.journalPath).toBe(journalPath);
          expect(
            (await readFile(journalPath)).byteLength,
          ).toBe(context.frameEndByteOffset);
          throw stageFailure;
        },
      }),
    ).rejects.toBe(stageFailure);
    expect(stages).toEqual([
      "frame-written-before-sync",
    ]);
  });

  it("durably appends complete frames and scans them back in append order", async () => {
    const directory = await createTemporaryDirectory();
    const journalPath = join(directory, randomUUID());
    const checksumAdapter = createChecksumAdapter();
    const firstPayload = randomBytes(randomInt(8, 128));
    const secondPayload = randomBytes(randomInt(8, 128));

    const firstAppend = await appendJournalPayloadDurably({
      journalPath,
      payload: firstPayload,
      checksumAdapter,
    });
    const secondAppend = await appendJournalPayloadDurably({
      journalPath,
      payload: secondPayload,
      checksumAdapter,
    });
    const scan = await scanAppendOnlyJournal({
      journalPath,
      resolveChecksumAdapter: (adapterId) =>
        adapterId === checksumAdapter.id ? checksumAdapter : null,
    });
    const fileBytes = await readFile(journalPath);

    expect(firstAppend.frameStartByteOffset).toBe(0);
    expect(firstAppend.frameEndByteOffset).toBe(
      firstAppend.frameByteLength,
    );
    expect(secondAppend.frameStartByteOffset).toBe(
      firstAppend.frameEndByteOffset,
    );
    expect(secondAppend.frameEndByteOffset).toBe(fileBytes.byteLength);
    expect(scan.tail).toBeNull();
    expect(
      scan.records.map((record) => Array.from(record.payload)),
    ).toEqual([
      Array.from(firstPayload),
      Array.from(secondPayload),
    ]);
  });
});
