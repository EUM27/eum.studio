import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";

function createProfileInput() {
  return {
    schemaVersion: 1,
    journalPath: randomUUID(),
    checksumAlgorithm: randomUUID(),
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

describe("manuscript journal runtime profile", () => {
  it("strictly parses caller-selected journal inputs without replacing them", () => {
    const input = createProfileInput();
    const profile =
      parseManuscriptJournalRuntimeProfile(input);

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.documentSequences)).toBe(true);
    expect(
      profile.documentSequences.every(Object.isFrozen),
    ).toBe(true);
  });

  it("rejects unknown fields instead of discarding them", () => {
    const input = {
      ...createProfileInput(),
      [randomUUID()]: randomUUID(),
    };

    expect(() =>
      parseManuscriptJournalRuntimeProfile(input),
    ).toThrow();
  });

  it("rejects duplicate document identities without fallback", () => {
    const input = createProfileInput();
    const first = input.documentSequences[0];
    const second = input.documentSequences[1];
    if (first === undefined || second === undefined) {
      throw new Error(
        "Duplicate identity test requires two document sequences",
      );
    }
    input.documentSequences[1] = {
      ...second,
      documentId: first.documentId,
    };

    expect(() =>
      parseManuscriptJournalRuntimeProfile(input),
    ).toThrow(/duplicate/i);
  });

  it.each([
    {
      field: "journalPath",
      mutate: (input: ReturnType<typeof createProfileInput>) => ({
        ...input,
        journalPath: "",
      }),
    },
    {
      field: "checksumAlgorithm",
      mutate: (input: ReturnType<typeof createProfileInput>) => ({
        ...input,
        checksumAlgorithm: "",
      }),
    },
    {
      field: "nextSequence",
      mutate: (input: ReturnType<typeof createProfileInput>) => ({
        ...input,
        documentSequences: [
          {
            ...input.documentSequences[0],
            nextSequence: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      }),
    },
  ])("rejects an invalid $field", ({ mutate }) => {
    expect(() =>
      parseManuscriptJournalRuntimeProfile(
        mutate(createProfileInput()),
      ),
    ).toThrow();
  });
});
