import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type ManuscriptDocumentSource = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly label: string;
  readonly initialText: string;
  readonly editorStateJson?: string;
};

export type ManuscriptDocumentProfile = {
  readonly schemaVersion: 1;
  readonly initialDocumentId: EntityId<"Document">;
  readonly documents: readonly ManuscriptDocumentSource[];
};

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
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

function readText(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function readRevisionId(
  record: Record<string, unknown>,
): EntityId<"DocumentRevision"> | null {
  const value = record.documentRevisionId;
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "documentRevisionId must be a non-empty string or null",
    );
  }
  return entityId<"DocumentRevision">(value);
}

export function parseManuscriptDocumentProfile(
  value: unknown,
): ManuscriptDocumentProfile {
  const record = readRecord(value, "manuscriptDocumentProfile");
  if (record.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1");
  }
  if (!Array.isArray(record.documents) || record.documents.length === 0) {
    throw new Error("documents must be a non-empty array");
  }

  const documentIds = new Set<EntityId<"Document">>();
  const documents = record.documents.map((item, index) => {
    const document = readRecord(item, `documents[${index}]`);
    const documentId = entityId<"Document">(
      readNonEmptyString(document, "documentId"),
    );
    if (documentIds.has(documentId)) {
      throw new Error(`Duplicate document identity: ${documentId}`);
    }
    documentIds.add(documentId);
    const editorStateJson =
      document.editorStateJson === undefined
        ? undefined
        : readNonEmptyString(document, "editorStateJson");
    return Object.freeze({
      workId: entityId<"Work">(
        readNonEmptyString(document, "workId"),
      ),
      documentId,
      documentRevisionId: readRevisionId(document),
      label: readNonEmptyString(document, "label"),
      initialText: readText(document, "initialText"),
      ...(editorStateJson === undefined ? {} : { editorStateJson }),
    });
  });
  const initialDocumentId = entityId<"Document">(
    readNonEmptyString(record, "initialDocumentId"),
  );
  if (!documentIds.has(initialDocumentId)) {
    throw new Error("initialDocumentId must reference a registered document");
  }

  return Object.freeze({
    schemaVersion: 1,
    initialDocumentId,
    documents: Object.freeze(documents),
  });
}
