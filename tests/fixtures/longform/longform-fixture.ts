export type LongformFixtureContentManifest = {
  units: string[];
  paragraphSeparator: string;
  sceneSeparatorCandidates: string[];
  longParagraphCharacters: number;
};

export type LongformFixtureManifest = {
  schemaVersion: 1;
  seed: string;
  workCount: number;
  documentsPerWork: number;
  charactersPerWork: number;
  longDocumentCharacters: number;
  content: LongformFixtureContentManifest;
};

export type LongformFixtureDocument = {
  documentId: string;
  manuscript: string;
};

export type LongformFixtureWork = {
  workId: string;
  documents: LongformFixtureDocument[];
};

export type LongformFixture = {
  works: LongformFixtureWork[];
};

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readPositiveInteger(
  record: Record<string, unknown>,
  field: string,
): number {
  const value = record[field];
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value as number;
}

function readNonEmptyString(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function readNonEmptyStrings(
  record: Record<string, unknown>,
  field: string,
): string[] {
  const value = record[field];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(`${field} must contain non-empty strings`);
  }
  return [...value] as string[];
}

export function parseLongformFixtureManifest(
  value: unknown,
): LongformFixtureManifest {
  const record = readRecord(value, "manifest");
  if (record.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1");
  }

  const contentRecord = readRecord(record.content, "content");
  const manifest: LongformFixtureManifest = {
    schemaVersion: 1,
    seed: readNonEmptyString(record, "seed"),
    workCount: readPositiveInteger(record, "workCount"),
    documentsPerWork: readPositiveInteger(record, "documentsPerWork"),
    charactersPerWork: readPositiveInteger(record, "charactersPerWork"),
    longDocumentCharacters: readPositiveInteger(
      record,
      "longDocumentCharacters",
    ),
    content: {
      units: readNonEmptyStrings(contentRecord, "units"),
      paragraphSeparator: readNonEmptyString(
        contentRecord,
        "paragraphSeparator",
      ),
      sceneSeparatorCandidates: readNonEmptyStrings(
        contentRecord,
        "sceneSeparatorCandidates",
      ),
      longParagraphCharacters: readPositiveInteger(
        contentRecord,
        "longParagraphCharacters",
      ),
    },
  };

  const remainingCharacters =
    manifest.charactersPerWork - manifest.longDocumentCharacters;
  if (
    manifest.documentsPerWork === 1 &&
    remainingCharacters !== 0
  ) {
    throw new Error(
      "charactersPerWork must equal longDocumentCharacters for one document",
    );
  }
  if (remainingCharacters < manifest.documentsPerWork - 1) {
    throw new Error(
      "charactersPerWork must allocate at least one character to every document",
    );
  }
  if (
    manifest.content.longParagraphCharacters >
    manifest.longDocumentCharacters
  ) {
    throw new Error(
      "longParagraphCharacters must fit inside longDocumentCharacters",
    );
  }

  return manifest;
}

function hashToken(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function createDocumentLengths(
  manifest: LongformFixtureManifest,
  longDocumentIndex: number,
): number[] {
  const remainingDocumentCount = manifest.documentsPerWork - 1;
  if (remainingDocumentCount === 0) {
    return [manifest.longDocumentCharacters];
  }

  const remainingCharacters =
    manifest.charactersPerWork - manifest.longDocumentCharacters;
  const baseLength = Math.floor(
    remainingCharacters / remainingDocumentCount,
  );
  let extraCharacters = remainingCharacters % remainingDocumentCount;

  return Array.from({ length: manifest.documentsPerWork }, (_, index) => {
    if (index === longDocumentIndex) {
      return manifest.longDocumentCharacters;
    }
    const length = baseLength + (extraCharacters > 0 ? 1 : 0);
    extraCharacters = Math.max(extraCharacters - 1, 0);
    return length;
  });
}

function repeatFromOffset(
  source: string,
  length: number,
  offsetToken: string,
): string {
  const offset = Number.parseInt(hashToken(offsetToken), 36) % source.length;
  const rotated = source.slice(offset) + source.slice(0, offset);
  return rotated.repeat(Math.ceil(length / rotated.length)).slice(0, length);
}

function createManuscript(
  manifest: LongformFixtureManifest,
  length: number,
  offsetToken: string,
  includeLongParagraph: boolean,
): string {
  const corpus = [
    ...manifest.content.units,
    ...manifest.content.sceneSeparatorCandidates,
  ].join(manifest.content.paragraphSeparator);

  if (includeLongParagraph) {
    const longParagraph = repeatFromOffset(
      manifest.content.units.join(" "),
      manifest.content.longParagraphCharacters,
      `${offsetToken}:long-paragraph`,
    );
    const remainingLength = length - longParagraph.length;
    if (remainingLength <= 0) {
      return longParagraph.slice(0, length);
    }
    if (remainingLength < manifest.content.paragraphSeparator.length) {
      return (
        longParagraph +
        repeatFromOffset(corpus, remainingLength, offsetToken)
      );
    }
    return (
      longParagraph +
      manifest.content.paragraphSeparator +
      repeatFromOffset(
        corpus,
        remainingLength - manifest.content.paragraphSeparator.length,
        offsetToken,
      )
    );
  }

  return repeatFromOffset(corpus, length, offsetToken);
}

export function generateLongformFixture(
  manifest: LongformFixtureManifest,
): LongformFixture {
  const seedToken = hashToken(manifest.seed);
  const works = Array.from({ length: manifest.workCount }, (_, workIndex) => {
    const workId = `${seedToken}:w:${workIndex.toString(36)}`;
    const longDocumentIndex =
      Number.parseInt(hashToken(`${manifest.seed}:${workIndex}`), 36) %
      manifest.documentsPerWork;
    const documentLengths = createDocumentLengths(
      manifest,
      longDocumentIndex,
    );
    const documents = documentLengths.map((length, documentIndex) => {
      const documentId = `${workId}:d:${documentIndex.toString(36)}`;
      return {
        documentId,
        manuscript: createManuscript(
          manifest,
          length,
          `${manifest.seed}:${workIndex}:${documentIndex}`,
          documentIndex === longDocumentIndex,
        ),
      };
    });

    return { workId, documents };
  });

  return { works };
}
