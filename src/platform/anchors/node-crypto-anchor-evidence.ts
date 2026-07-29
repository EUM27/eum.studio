import { createHash } from "node:crypto";

import {
  encodeDurableText,
} from "../../application/persistence/change-batch";
import type {
  DescribeAnchorEvidence,
} from "../../application/anchors/create-anchor";

function digestCanonicalText(
  algorithm: string,
  value: string,
): string {
  return createHash(algorithm)
    .update(encodeDurableText(value))
    .digest("hex");
}

export function createNodeCryptoAnchorEvidenceDescriptor(
  algorithm: string,
): DescribeAnchorEvidence {
  if (algorithm.length === 0) {
    throw new Error(
      "Anchor evidence checksum algorithm must not be empty",
    );
  }
  createHash(algorithm).digest();
  return (input) => ({
    quoteHash: digestCanonicalText(
      algorithm,
      input.exactQuote,
    ),
    contextHash: digestCanonicalText(
      algorithm,
      JSON.stringify([
        input.prefixContext,
        input.suffixContext,
      ]),
    ),
  });
}
