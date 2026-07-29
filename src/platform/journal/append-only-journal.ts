import { open, readFile } from "node:fs/promises";

import type {
  JournalChecksumAdapter,
  ResolveJournalChecksumAdapter,
} from "./journal-checksum";
import {
  encodeJournalFrame,
  scanJournalFrames,
  type JournalFrameScanResult,
} from "./journal-frame";

export type DurableJournalAppendResult = {
  readonly frameStartByteOffset: number;
  readonly frameEndByteOffset: number;
  readonly frameByteLength: number;
};

export type AppendOnlyJournalStage =
  "frame-written-before-sync";

export type AppendOnlyJournalStageContext = {
  readonly journalPath: string;
  readonly frameStartByteOffset: number;
  readonly frameEndByteOffset: number;
  readonly frameByteLength: number;
};

export async function appendJournalPayloadDurably(input: {
  readonly journalPath: string;
  readonly payload: Uint8Array;
  readonly checksumAdapter: JournalChecksumAdapter;
  readonly onStage?: (
    stage: AppendOnlyJournalStage,
    context: AppendOnlyJournalStageContext,
  ) => Promise<void>;
}): Promise<DurableJournalAppendResult> {
  const frame = await encodeJournalFrame(
    input.payload,
    input.checksumAdapter,
  );
  const handle = await open(input.journalPath, "a+");

  try {
    const frameStartByteOffset = (await handle.stat()).size;
    let frameByteOffset = 0;

    while (frameByteOffset < frame.byteLength) {
      const { bytesWritten } = await handle.write(
        frame,
        frameByteOffset,
        frame.byteLength - frameByteOffset,
        null,
      );
      if (bytesWritten <= 0) {
        throw new Error(
          "Journal append made no progress before the frame was complete",
        );
      }
      frameByteOffset += bytesWritten;
    }

    if (input.onStage !== undefined) {
      await input.onStage(
        "frame-written-before-sync",
        Object.freeze({
          journalPath: input.journalPath,
          frameStartByteOffset,
          frameEndByteOffset:
            frameStartByteOffset + frame.byteLength,
          frameByteLength: frame.byteLength,
        }),
      );
    }
    await handle.sync();

    return Object.freeze({
      frameStartByteOffset,
      frameEndByteOffset:
        frameStartByteOffset + frame.byteLength,
      frameByteLength: frame.byteLength,
    });
  } finally {
    await handle.close();
  }
}

export async function scanAppendOnlyJournal(input: {
  readonly journalPath: string;
  readonly resolveChecksumAdapter: ResolveJournalChecksumAdapter;
}): Promise<JournalFrameScanResult> {
  const source = await readFile(input.journalPath);
  return scanJournalFrames(
    source,
    input.resolveChecksumAdapter,
  );
}
