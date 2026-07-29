import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { JournalChecksumAdapter } from "./journal-checksum";
import {
  encodeJournalFrame,
  scanJournalFrames,
} from "./journal-frame";

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

function concatenateBytes(
  first: Uint8Array,
  second: Uint8Array,
): Uint8Array {
  const output = new Uint8Array(
    first.byteLength + second.byteLength,
  );
  output.set(first);
  output.set(second, first.byteLength);
  return output;
}

describe("journal frame", () => {
  it("round-trips one payload through a deterministic length-and-checksum frame", async () => {
    const checksum = createChecksumAdapter();
    const payload = randomBytes(randomInt(8, 128));

    const firstFrame = await encodeJournalFrame(payload, checksum);
    const secondFrame = await encodeJournalFrame(payload, checksum);
    const scan = await scanJournalFrames(
      firstFrame,
      (adapterId) => (adapterId === checksum.id ? checksum : null),
    );

    expect(Array.from(firstFrame)).toEqual(Array.from(secondFrame));
    expect(scan.records).toHaveLength(1);
    expect(Array.from(scan.records[0]?.payload ?? [])).toEqual(
      Array.from(payload),
    );
    expect(scan.verifiedPrefixByteLength).toBe(firstFrame.length);
    expect(scan.tail).toBeNull();
  });

  it("returns every verified record before a checksum-damaged tail without resynchronizing", async () => {
    const checksum = createChecksumAdapter();
    const firstPayload = randomBytes(randomInt(8, 128));
    const secondPayload = randomBytes(randomInt(8, 128));
    const firstFrame = await encodeJournalFrame(firstPayload, checksum);
    const damagedFrame = await encodeJournalFrame(
      secondPayload,
      checksum,
    );
    const damagedByteIndex = damagedFrame.length - 1;
    damagedFrame[damagedByteIndex] =
      (damagedFrame[damagedByteIndex] ?? 0) ^ 0xff;
    const source = concatenateBytes(firstFrame, damagedFrame);

    const scan = await scanJournalFrames(
      source,
      (adapterId) => (adapterId === checksum.id ? checksum : null),
    );

    expect(scan.records).toHaveLength(1);
    expect(Array.from(scan.records[0]?.payload ?? [])).toEqual(
      Array.from(firstPayload),
    );
    expect(scan.verifiedPrefixByteLength).toBe(firstFrame.length);
    expect(scan.tail?.byteOffset).toBe(firstFrame.length);
    expect(scan.tail?.reason).toBe("checksum-mismatch");
    expect(Array.from(scan.tail?.bytes ?? [])).toEqual(
      Array.from(damagedFrame),
    );
  });

  it("recovers the same verified prefix from every truncated cut of the following frame", async () => {
    const checksum = createChecksumAdapter();
    const firstFrame = await encodeJournalFrame(
      randomBytes(randomInt(8, 128)),
      checksum,
    );
    const secondFrame = await encodeJournalFrame(
      randomBytes(randomInt(8, 128)),
      checksum,
    );

    for (
      let cutByteLength = 1;
      cutByteLength < secondFrame.byteLength;
      cutByteLength += 1
    ) {
      const source = concatenateBytes(
        firstFrame,
        secondFrame.slice(0, cutByteLength),
      );
      const scan = await scanJournalFrames(
        source,
        (adapterId) =>
          adapterId === checksum.id ? checksum : null,
      );

      expect(scan.records).toHaveLength(1);
      expect(scan.verifiedPrefixByteLength).toBe(firstFrame.length);
      expect(scan.tail?.byteOffset).toBe(firstFrame.length);
      expect(Array.from(scan.tail?.bytes ?? [])).toEqual(
        Array.from(secondFrame.slice(0, cutByteLength)),
      );
    }
  });
});
