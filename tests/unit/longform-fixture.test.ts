import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  generateLongformFixture,
  parseLongformFixtureManifest,
} from "../fixtures/longform/longform-fixture";

function createManifestInput() {
  const documentCount = randomInt(3, 8);
  const longDocumentCharacters = randomInt(256, 512);
  const otherDocumentCharacters = randomInt(64, 128);

  return {
    schemaVersion: 1,
    seed: randomUUID(),
    workCount: randomInt(2, 5),
    documentsPerWork: documentCount,
    charactersPerWork:
      longDocumentCharacters +
      (documentCount - 1) * otherDocumentCharacters,
    longDocumentCharacters,
    content: {
      units: [randomUUID(), randomUUID(), randomUUID()],
      paragraphSeparator: `\n${randomUUID()}\n`,
      sceneSeparatorCandidates: [randomUUID(), randomUUID()],
      longParagraphCharacters: randomInt(32, 64),
    },
  };
}

describe("longform fixture manifest", () => {
  it("accepts a complete runtime manifest without replacing its values", () => {
    const input = createManifestInput();

    expect(parseLongformFixtureManifest(input)).toEqual(input);
  });

  it("rejects an impossible document allocation", () => {
    const input = createManifestInput();

    expect(() =>
      parseLongformFixtureManifest({
        ...input,
        charactersPerWork: input.longDocumentCharacters,
      }),
    ).toThrow("charactersPerWork");
  });

  it("requires a single document to own the complete work manuscript", () => {
    const input = createManifestInput();

    expect(() =>
      parseLongformFixtureManifest({
        ...input,
        documentsPerWork: 1,
        charactersPerWork: input.longDocumentCharacters + 1,
      }),
    ).toThrow("charactersPerWork");
  });
});

describe("longform fixture generator", () => {
  it("materializes the manifest deterministically with exact document ownership and sizes", () => {
    const input = createManifestInput();
    const manifest = parseLongformFixtureManifest(input);
    const originalManifest = structuredClone(manifest);

    const fixture = generateLongformFixture(manifest);

    expect(fixture.works).toHaveLength(manifest.workCount);
    const workIds = fixture.works.map((work) => work.workId);
    const documentIds = fixture.works.flatMap((work) =>
      work.documents.map((document) => document.documentId),
    );
    expect(new Set(workIds).size).toBe(workIds.length);
    expect(new Set(documentIds).size).toBe(documentIds.length);

    for (const work of fixture.works) {
      expect(work.documents).toHaveLength(manifest.documentsPerWork);
      expect(
        work.documents.reduce(
          (total, document) => total + document.manuscript.length,
          0,
        ),
      ).toBe(manifest.charactersPerWork);
      expect(
        work.documents.some(
          (document) =>
            document.manuscript.length === manifest.longDocumentCharacters,
        ),
      ).toBe(true);
    }

    expect(generateLongformFixture(manifest)).toEqual(fixture);
    expect(
      generateLongformFixture({
        ...manifest,
        seed: randomUUID(),
      }),
    ).not.toEqual(fixture);
    expect(manifest).toEqual(originalManifest);
  });

  it("materializes the checked-in POC-1 profile with its declared text characteristics", () => {
    const manifestPath = path.join(
      process.cwd(),
      "tests",
      "fixtures",
      "longform",
      "poc-1-longform.manifest.json",
    );
    const manifest = parseLongformFixtureManifest(
      JSON.parse(readFileSync(manifestPath, "utf8")),
    );
    const fixture = generateLongformFixture(manifest);

    expect(manifest.workCount).toBeGreaterThan(1);
    for (const work of fixture.works) {
      expect(work.documents).toHaveLength(manifest.documentsPerWork);
      expect(
        work.documents.reduce(
          (total, document) => total + document.manuscript.length,
          0,
        ),
      ).toBe(manifest.charactersPerWork);
      expect(
        work.documents.some(
          (document) =>
            document.manuscript.length === manifest.longDocumentCharacters,
        ),
      ).toBe(true);
    }

    const manuscripts = fixture.works[0]!.documents
      .map((document) => document.manuscript)
      .join(manifest.content.paragraphSeparator);
    expect(manuscripts).toMatch(/[가-힣]/u);
    expect(manuscripts).toMatch(/[A-Za-z]/u);
    expect(manuscripts).toMatch(/[0-9]/u);
    expect(manuscripts).toMatch(/["'“”‘’]/u);
    for (const bracket of ["(", ")", "[", "]", "{", "}"]) {
      expect(manuscripts).toContain(bracket);
    }
    for (const candidate of manifest.content.sceneSeparatorCandidates) {
      expect(manuscripts).toContain(candidate);
    }
    expect(manuscripts.indexOf(manifest.content.units[0]!)).not.toBe(
      manuscripts.lastIndexOf(manifest.content.units[0]!),
    );
    const longestParagraph = Math.max(
      ...fixture.works[0]!.documents.flatMap((document) =>
        document.manuscript
          .split(manifest.content.paragraphSeparator)
          .map((paragraph) => paragraph.length),
      ),
    );
    expect(longestParagraph).toBeGreaterThanOrEqual(
      manifest.content.longParagraphCharacters,
    );
  });
});
