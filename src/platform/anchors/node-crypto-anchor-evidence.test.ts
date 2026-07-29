import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  encodeDurableText,
} from "../../application/persistence/change-batch";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "./node-crypto-anchor-evidence";

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

function digest(
  algorithm: string,
  text: string,
): string {
  return createHash(algorithm)
    .update(encodeDurableText(text))
    .digest("hex");
}

describe("Node crypto Anchor evidence descriptor", () => {
  it("uses caller-selected checksum and canonical UTF-16LE text bytes", () => {
    const algorithm =
      selectHashAlgorithm();
    const evidence = {
      exactQuote: randomUUID(),
      prefixContext: randomUUID(),
      suffixContext: randomUUID(),
    };
    const describe =
      createNodeCryptoAnchorEvidenceDescriptor(
        algorithm,
      );

    expect(describe(evidence)).toEqual({
      quoteHash: digest(
        algorithm,
        evidence.exactQuote,
      ),
      contextHash: digest(
        algorithm,
        JSON.stringify([
          evidence.prefixContext,
          evidence.suffixContext,
        ]),
      ),
    });
  });

  it("does not replace an unsupported caller algorithm", () => {
    expect(() =>
      createNodeCryptoAnchorEvidenceDescriptor(
        randomUUID(),
      ),
    ).toThrow();
  });
});
