import {
  entityId,
  type Anchor,
  type Document,
  type DocumentRevision,
  type EntityId,
  type ResumeCheckpoint,
  type Work,
} from "../domain/writing";
import type {
  PocResumeCheckpointStoragePlan,
} from "../platform/checkpoints/poc-resume-checkpoint-publication";

export type PocResumeCheckpointRevisionSource = {
  readonly revision: DocumentRevision;
  readonly content: string;
};

export type PocResumeCheckpointPublicationRevisionHead = {
  readonly documentId: EntityId<"Document">;
  readonly revisionId:
    EntityId<"DocumentRevision">;
};

export type PocResumeCheckpointRuntimeProfile = {
  readonly schemaVersion: 1;
  readonly codecId: string;
  readonly publicationChecksumAlgorithm: string;
  readonly anchorEvidenceChecksumAlgorithm: string;
  readonly storagePlan:
    PocResumeCheckpointStoragePlan;
  readonly works: readonly Work[];
  readonly documents: readonly Document[];
  readonly revisions:
    readonly PocResumeCheckpointRevisionSource[];
  readonly publicationRevisionHeads:
    readonly PocResumeCheckpointPublicationRevisionHead[];
  readonly baselineCheckpoints:
    readonly ResumeCheckpoint[];
  readonly anchors: readonly Anchor[];
};

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  field: string,
): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(
        `Unsupported ${field} field: ${key}`,
      );
    }
  }
}

function readNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function readArray(
  value: unknown,
  field: string,
): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value;
}

function readMetaId<TEntity extends string>(
  value: Record<string, unknown>,
  field: string,
): EntityId<TEntity> {
  const meta = readRecord(
    value.meta,
    `${field}.meta`,
  );
  return entityId<TEntity>(
    readNonEmptyString(
      meta.id,
      `${field}.meta.id`,
    ),
  );
}

function parseStoragePlan(
  value: unknown,
): PocResumeCheckpointStoragePlan {
  const input = readRecord(
    value,
    "storagePlan",
  );
  assertOnlyFields(
    input,
    [
      "publicationId",
      "publicationTemporaryPath",
      "publicationPath",
    ],
    "storagePlan",
  );
  return Object.freeze({
    publicationId:
      entityId<"ResumeCheckpointPublication">(
        readNonEmptyString(
          input.publicationId,
          "storagePlan.publicationId",
        ),
      ),
    publicationTemporaryPath:
      readNonEmptyString(
        input.publicationTemporaryPath,
        "storagePlan.publicationTemporaryPath",
      ),
    publicationPath: readNonEmptyString(
      input.publicationPath,
      "storagePlan.publicationPath",
    ),
  });
}

function parseEntityArray<
  TEntity,
  TEntityName extends string,
>(
  value: unknown,
  field: string,
  entityName: TEntityName,
): readonly TEntity[] {
  const identities = new Set<string>();
  return Object.freeze(
    readArray(value, field).map(
      (entry, index) => {
        const record = readRecord(
          entry,
          `${field}[${index}]`,
        );
        const identity =
          readMetaId<TEntityName>(
            record,
            `${field}[${index}]`,
          );
        if (identities.has(identity)) {
          throw new Error(
            `Duplicate ${entityName} identity: ${identity}`,
          );
        }
        identities.add(identity);
        return record as unknown as TEntity;
      },
    ),
  );
}

export function parsePocResumeCheckpointRuntimeProfile(
  value: unknown,
): PocResumeCheckpointRuntimeProfile {
  const input = readRecord(
    value,
    "POC ResumeCheckpoint runtime profile",
  );
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "codecId",
      "publicationChecksumAlgorithm",
      "anchorEvidenceChecksumAlgorithm",
      "storagePlan",
      "works",
      "documents",
      "revisions",
      "publicationRevisionHeads",
      "baselineCheckpoints",
      "anchors",
    ],
    "POC ResumeCheckpoint runtime profile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "POC ResumeCheckpoint runtime profile schemaVersion must be 1",
    );
  }
  const works = parseEntityArray<
    Work,
    "Work"
  >(input.works, "works", "Work");
  const documents = parseEntityArray<
    Document,
    "Document"
  >(
    input.documents,
    "documents",
    "Document",
  );
  const baselineCheckpoints =
    parseEntityArray<
      ResumeCheckpoint,
      "ResumeCheckpoint"
    >(
      input.baselineCheckpoints,
      "baselineCheckpoints",
      "ResumeCheckpoint",
    );
  const anchors = parseEntityArray<
    Anchor,
    "Anchor"
  >(input.anchors, "anchors", "Anchor");
  const revisionIds = new Set<string>();
  const revisions = Object.freeze(
    readArray(
      input.revisions,
      "revisions",
    ).map((entry, index) => {
      const source = readRecord(
        entry,
        `revisions[${index}]`,
      );
      assertOnlyFields(
        source,
        ["revision", "content"],
        `revisions[${index}]`,
      );
      const revision = readRecord(
        source.revision,
        `revisions[${index}].revision`,
      ) as unknown as DocumentRevision;
      const revisionId =
        entityId<"DocumentRevision">(
          readNonEmptyString(
            revision.id,
            `revisions[${index}].revision.id`,
          ),
        );
      if (revisionIds.has(revisionId)) {
        throw new Error(
          `Duplicate DocumentRevision identity: ${revisionId}`,
        );
      }
      revisionIds.add(revisionId);
      const content =
        typeof source.content === "string"
          ? source.content
          : (() => {
              throw new Error(
                `revisions[${index}].content must be a string`,
              );
            })();
      if (
        !Number.isSafeInteger(revision.length) ||
        revision.length !== content.length
      ) {
        throw new Error(
          `Revision content length conflict: ${revisionId}`,
        );
      }
      return Object.freeze({
        revision,
        content,
      });
    }),
  );
  const headDocuments = new Set<string>();
  const publicationRevisionHeads =
    Object.freeze(
      readArray(
        input.publicationRevisionHeads,
        "publicationRevisionHeads",
      ).map((entry, index) => {
        const head = readRecord(
          entry,
          `publicationRevisionHeads[${index}]`,
        );
        assertOnlyFields(
          head,
          ["documentId", "revisionId"],
          `publicationRevisionHeads[${index}]`,
        );
        const documentId =
          entityId<"Document">(
            readNonEmptyString(
              head.documentId,
              `publicationRevisionHeads[${index}].documentId`,
            ),
          );
        if (headDocuments.has(documentId)) {
          throw new Error(
            `Duplicate publication revision head: ${documentId}`,
          );
        }
        headDocuments.add(documentId);
        return Object.freeze({
          documentId,
          revisionId:
            entityId<"DocumentRevision">(
              readNonEmptyString(
                head.revisionId,
                `publicationRevisionHeads[${index}].revisionId`,
              ),
            ),
        });
      }),
    );

  return Object.freeze({
    schemaVersion: 1,
    codecId: readNonEmptyString(
      input.codecId,
      "codecId",
    ),
    publicationChecksumAlgorithm:
      readNonEmptyString(
        input.publicationChecksumAlgorithm,
        "publicationChecksumAlgorithm",
      ),
    anchorEvidenceChecksumAlgorithm:
      readNonEmptyString(
        input.anchorEvidenceChecksumAlgorithm,
        "anchorEvidenceChecksumAlgorithm",
      ),
    storagePlan: parseStoragePlan(
      input.storagePlan,
    ),
    works,
    documents,
    revisions,
    publicationRevisionHeads,
    baselineCheckpoints,
    anchors,
  });
}
