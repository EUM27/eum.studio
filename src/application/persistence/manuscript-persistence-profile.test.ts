import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parseManuscriptBatchingPolicy,
  parseManuscriptPersistenceProfile,
} from "./manuscript-persistence-profile";

function createBatchingPolicyInput() {
  return {
    schemaVersion: 1,
    maxTransactionsPerBatch: randomInt(1, 10_000),
    maxDelayMs: randomInt(0, 10_000),
  };
}

function createPersistenceProfileInput() {
  return {
    schemaVersion: 1,
    batching: createBatchingPolicyInput(),
    documentSequences: [
      {
        documentId: randomUUID(),
        nextSequence: randomInt(0, 10_000),
      },
      {
        documentId: randomUUID(),
        nextSequence: randomInt(0, 10_000),
      },
    ],
  };
}

describe("manuscript persistence profile", () => {
  it("retains an existing writer base when a second window starts from a later revision", () => {
    const input = createPersistenceProfileInput();
    const baseRevisionId = randomUUID();
    const profile = parseManuscriptPersistenceProfile({ ...input, documentSequences: input.documentSequences.map((sequence) => ({ ...sequence, baseRevisionId })) });
    expect(profile?.documentSequences[0]?.baseRevisionId).toBe(baseRevisionId);
    expect(() => parseManuscriptPersistenceProfile({ ...input, documentSequences: [{ ...input.documentSequences[0], baseRevisionId: "" }] })).toThrow(/baseRevisionId/);
  });
  it("strictly parses and freezes a caller batching policy", () => {
    const input = createBatchingPolicyInput();
    const policy = parseManuscriptBatchingPolicy(input);

    expect(policy).toEqual(input);
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it("projects only batching policy and document sequences", () => {
    const input = createPersistenceProfileInput();
    const profile = parseManuscriptPersistenceProfile(input);

    expect(profile).toEqual(input);
    expect(profile).not.toBeNull();
    if (profile === null) {
      return;
    }
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.documentSequences)).toBe(true);
    expect(
      profile.documentSequences.every((sequence) =>
        Object.isFrozen(sequence),
      ),
    ).toBe(true);
    expect("journalPath" in profile).toBe(false);
    expect("checksumAlgorithm" in profile).toBe(false);
  });

  it("preserves an explicit unavailable projection", () => {
    expect(parseManuscriptPersistenceProfile(null)).toBeNull();
  });

  it("rejects storage fields and duplicate document identities", () => {
    const withStorageField = {
      ...createPersistenceProfileInput(),
      journalPath: randomUUID(),
    };
    expect(() =>
      parseManuscriptPersistenceProfile(withStorageField),
    ).toThrow();

    const duplicate = createPersistenceProfileInput();
    const first = duplicate.documentSequences[0];
    const second = duplicate.documentSequences[1];
    if (first === undefined || second === undefined) {
      throw new Error(
        "Duplicate projection test requires two sequences",
      );
    }
    duplicate.documentSequences[1] = {
      ...second,
      documentId: first.documentId,
    };
    expect(() =>
      parseManuscriptPersistenceProfile(duplicate),
    ).toThrow(/duplicate/i);
  });

  it.each([
    {
      name: "non-positive transaction boundary",
      mutate: () => ({
        ...createBatchingPolicyInput(),
        maxTransactionsPerBatch: -randomInt(0, 10_000) - 1,
      }),
    },
    {
      name: "negative delay",
      mutate: () => ({
        ...createBatchingPolicyInput(),
        maxDelayMs: -randomInt(0, 10_000) - 1,
      }),
    },
    {
      name: "unsafe delay",
      mutate: () => ({
        ...createBatchingPolicyInput(),
        maxDelayMs: Number.MAX_SAFE_INTEGER + randomInt(1, 10_000),
      }),
    },
  ])("rejects a $name", ({ mutate }) => {
    expect(() =>
      parseManuscriptBatchingPolicy(mutate()),
    ).toThrow();
  });
});
