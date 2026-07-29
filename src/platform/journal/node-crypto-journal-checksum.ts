import { createHash } from "node:crypto";

import {
  assertJournalChecksumAdapter,
  type JournalChecksumAdapter,
} from "./journal-checksum";

export function createNodeCryptoJournalChecksumAdapter(
  algorithm: string,
): JournalChecksumAdapter {
  if (typeof algorithm !== "string" || algorithm.length === 0) {
    throw new Error(
      "Journal checksum algorithm must be a non-empty string",
    );
  }

  const byteLength = createHash(algorithm).digest().byteLength;
  const adapter: JournalChecksumAdapter = Object.freeze({
    id: algorithm,
    byteLength,
    async digest(input) {
      const digest = createHash(algorithm)
        .update(new Uint8Array(input))
        .digest();
      return new Uint8Array(digest);
    },
  });
  assertJournalChecksumAdapter(adapter);
  return adapter;
}
