import {
  createHash,
  getHashes,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import { describe, expect, it } from "vitest";

import { createNodeCryptoJournalChecksumAdapter } from "./node-crypto-journal-checksum";

function selectRuntimeHashAlgorithm(): string {
  const algorithms = getHashes();
  if (algorithms.length === 0) {
    throw new Error("Node.js runtime exposes no hash algorithms");
  }
  return algorithms[randomInt(0, algorithms.length)] as string;
}

describe("Node crypto journal checksum adapter", () => {
  it("uses the caller-selected runtime algorithm without changing its identity", async () => {
    const algorithm = selectRuntimeHashAlgorithm();
    const input = randomBytes(randomInt(1, 1_024));
    const expected = createHash(algorithm).update(input).digest();
    const adapter =
      createNodeCryptoJournalChecksumAdapter(algorithm);

    expect(adapter.id).toBe(algorithm);
    expect(adapter.byteLength).toBe(expected.byteLength);
    await expect(adapter.digest(input)).resolves.toEqual(
      new Uint8Array(expected),
    );
  });

  it("rejects an unsupported caller algorithm instead of falling back", () => {
    expect(() =>
      createNodeCryptoJournalChecksumAdapter(randomUUID()),
    ).toThrow();
  });
});
