import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseManuscriptDocumentProfile } from "./manuscript-document-profile";

function createProfile() {
  const workId = randomUUID();
  const documents = [
    {
      workId,
      documentId: randomUUID(),
      documentRevisionId: randomUUID(),
      label: randomUUID(),
      initialText: randomUUID(),
    },
    {
      workId,
      documentId: randomUUID(),
      documentRevisionId: null,
      label: randomUUID(),
      initialText: randomUUID(),
    },
  ];
  return {
    schemaVersion: 1,
    initialDocumentId: documents[0]!.documentId,
    documents,
  } as const;
}

describe("manuscript document profile", () => {
  it("parses and freezes runtime-owned document identities and initial text", () => {
    const input = createProfile();

    const profile = parseManuscriptDocumentProfile(input);

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.documents)).toBe(true);
    expect(Object.isFrozen(profile.documents[0])).toBe(true);
  });

  it("requires the initial document to be explicitly registered", () => {
    const input = createProfile();

    expect(() =>
      parseManuscriptDocumentProfile({
        ...input,
        initialDocumentId: randomUUID(),
      }),
    ).toThrow(/initialDocumentId/);
  });

  it("rejects duplicate document identities instead of replacing ownership", () => {
    const input = createProfile();
    const duplicate = {
      ...input.documents[1],
      documentId: input.documents[0]!.documentId,
    };

    expect(() =>
      parseManuscriptDocumentProfile({
        ...input,
        documents: [...input.documents, duplicate],
      }),
    ).toThrow(/Duplicate document identity/);
  });

  it("rejects malformed document values without supplying defaults", () => {
    const input = createProfile();

    expect(() =>
      parseManuscriptDocumentProfile({
        ...input,
        documents: [{ ...input.documents[0], initialText: null }],
      }),
    ).toThrow(/initialText/);
    expect(() =>
      parseManuscriptDocumentProfile({
        ...input,
        documents: [{ ...input.documents[0], workId: "" }],
      }),
    ).toThrow(/workId/);
  });
});
