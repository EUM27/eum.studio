import { entityId, type EntityId } from "../../domain/writing";

export type CreatePublishingSubmissionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly title: string;
  readonly status: string;
  readonly submittedOn: string | null;
  readonly respondedOn: string | null;
  readonly result: string;
  readonly note: string;
  readonly cardNote: string;
};

export type ListPublishingSubmissionsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work"> | null;
};

export type UpdatePublishingSubmissionCommand = {
  readonly schemaVersion: 1;
  readonly submissionId: EntityId<"PublishingSubmission">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly status?: string;
    readonly respondedOn?: string | null;
    readonly result?: string;
    readonly note?: string;
    readonly cardNote?: string;
  };
};

export type SubmissionPackageDocumentRevision = {
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
};

export type SubmissionPackageProjection = {
  readonly schemaVersion: 1;
  readonly submissionPackageId: EntityId<"SubmissionPackage">;
  readonly workId: EntityId<"Work">;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly workSnapshotId: EntityId<"WorkSnapshot">;
  readonly workTitleSnapshot: string;
  readonly partnerNameSnapshot: string;
  readonly manifestHash: string;
  readonly sealedAt: string;
  readonly documentRevisions: readonly SubmissionPackageDocumentRevision[];
};

export type PublishingSubmissionProjection = {
  readonly schemaVersion: 1;
  readonly submissionId: EntityId<"PublishingSubmission">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly title: string;
  readonly status: string;
  readonly submittedOn: string | null;
  readonly respondedOn: string | null;
  readonly result: string;
  readonly note: string;
  readonly cardNote: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly package: SubmissionPackageProjection;
};

export type PublishingSubmissionListProjection = {
  readonly schemaVersion: 1;
  readonly submissions: readonly PublishingSubmissionProjection[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function optionalFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
  }
}

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = stringValue(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function nullableId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  if (input[field] === null) return null;
  return id<TEntity>(input, field, label);
}

function positiveRevision(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function dateOnlyOrNull(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${label}.${field} must be a date or null`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label}.${field} must be a calendar date`);
  }
  return value;
}

function stringArray(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value)) {
    throw new Error(`${label}.${field} must be an array`);
  }
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}.${field}[${index}] must be a non-empty string`);
    }
    return entry.trim();
  }));
}

const CREATE_FIELDS = [
  "workId",
  "partnerId",
  "title",
  "status",
  "submittedOn",
  "respondedOn",
  "result",
  "note",
  "cardNote",
] as const;

const UPDATE_FIELDS = [
  "status",
  "respondedOn",
  "result",
  "note",
  "cardNote",
] as const;

export function parseCreatePublishingSubmissionCommand(
  value: unknown,
): CreatePublishingSubmissionCommand {
  const label = "CreatePublishingSubmissionCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", ...CREATE_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    partnerId: id<"PublishingPartner">(input, "partnerId", label),
    title: stringValue(input, "title", label),
    status: stringValue(input, "status", label),
    submittedOn: dateOnlyOrNull(input, "submittedOn", label),
    respondedOn: dateOnlyOrNull(input, "respondedOn", label),
    result: stringValue(input, "result", label),
    note: stringValue(input, "note", label),
    cardNote: stringValue(input, "cardNote", label),
  });
}

export function parseListPublishingSubmissionsCommand(
  value: unknown,
): ListPublishingSubmissionsCommand {
  const label = "ListPublishingSubmissionsCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: nullableId<"Work">(input, "workId", label),
  });
}

export function parseUpdatePublishingSubmissionCommand(
  value: unknown,
): UpdatePublishingSubmissionCommand {
  const label = "UpdatePublishingSubmissionCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "submissionId", "expectedRevision", "changes"],
    label,
  );
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(changesInput, UPDATE_FIELDS, changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  return Object.freeze({
    schemaVersion: 1,
    submissionId: id<"PublishingSubmission">(input, "submissionId", label),
    expectedRevision: positiveRevision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changesInput, "status")
        ? { status: stringValue(changesInput, "status", changesLabel) }
        : {}),
      ...(Object.hasOwn(changesInput, "respondedOn")
        ? { respondedOn: dateOnlyOrNull(changesInput, "respondedOn", changesLabel) }
        : {}),
      ...(Object.hasOwn(changesInput, "result")
        ? { result: stringValue(changesInput, "result", changesLabel) }
        : {}),
      ...(Object.hasOwn(changesInput, "note")
        ? { note: stringValue(changesInput, "note", changesLabel) }
        : {}),
      ...(Object.hasOwn(changesInput, "cardNote")
        ? { cardNote: stringValue(changesInput, "cardNote", changesLabel) }
        : {}),
    }),
  });
}

function parsePackageDocumentRevision(
  value: unknown,
  label: string,
): SubmissionPackageDocumentRevision {
  const input = record(value, label);
  exactFields(input, ["documentId", "documentRevisionId"], label);
  return Object.freeze({
    documentId: id<"Document">(input, "documentId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
  });
}

export function parseSubmissionPackageProjection(
  value: unknown,
): SubmissionPackageProjection {
  const label = "SubmissionPackageProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "submissionPackageId",
      "workId",
      "partnerId",
      "workSnapshotId",
      "workTitleSnapshot",
      "partnerNameSnapshot",
      "manifestHash",
      "sealedAt",
      "documentRevisions",
    ],
    label,
  );
  schema(input, label);
  if (!Array.isArray(input.documentRevisions)) {
    throw new Error(`${label}.documentRevisions must be an array`);
  }
  const documentRevisions = Object.freeze(
    input.documentRevisions.map((entry, index) =>
      parsePackageDocumentRevision(
        entry,
        `${label}.documentRevisions[${index}]`,
      ),
    ),
  );
  if (
    new Set(documentRevisions.map((entry) => entry.documentId)).size !==
    documentRevisions.length
  ) {
    throw new Error(`${label}.documentRevisions contains a duplicate Document`);
  }
  return Object.freeze({
    schemaVersion: 1,
    submissionPackageId: id<"SubmissionPackage">(
      input,
      "submissionPackageId",
      label,
    ),
    workId: id<"Work">(input, "workId", label),
    partnerId: id<"PublishingPartner">(input, "partnerId", label),
    workSnapshotId: id<"WorkSnapshot">(input, "workSnapshotId", label),
    workTitleSnapshot: stringValue(input, "workTitleSnapshot", label),
    partnerNameSnapshot: nonEmptyString(input, "partnerNameSnapshot", label),
    manifestHash: nonEmptyString(input, "manifestHash", label),
    sealedAt: nonEmptyString(input, "sealedAt", label),
    documentRevisions,
  });
}

export function parsePublishingSubmissionProjection(
  value: unknown,
): PublishingSubmissionProjection {
  const label = "PublishingSubmissionProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "submissionId",
      "revision",
      ...CREATE_FIELDS,
      "sourceIds",
      "createdAt",
      "updatedAt",
      "package",
    ],
    label,
  );
  schema(input, label);
  const packageProjection = parseSubmissionPackageProjection(input.package);
  const workId = id<"Work">(input, "workId", label);
  const partnerId = id<"PublishingPartner">(input, "partnerId", label);
  if (
    packageProjection.workId !== workId ||
    packageProjection.partnerId !== partnerId
  ) {
    throw new Error(`${label}.package is outside the submission ownership boundary`);
  }
  return Object.freeze({
    schemaVersion: 1,
    submissionId: id<"PublishingSubmission">(input, "submissionId", label),
    revision: positiveRevision(input, "revision", label),
    workId,
    partnerId,
    title: stringValue(input, "title", label),
    status: stringValue(input, "status", label),
    submittedOn: dateOnlyOrNull(input, "submittedOn", label),
    respondedOn: dateOnlyOrNull(input, "respondedOn", label),
    result: stringValue(input, "result", label),
    note: stringValue(input, "note", label),
    cardNote: stringValue(input, "cardNote", label),
    sourceIds: stringArray(input, "sourceIds", label),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
    package: packageProjection,
  });
}

export function parsePublishingSubmissionListProjection(
  value: unknown,
): PublishingSubmissionListProjection {
  const label = "PublishingSubmissionListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "submissions"], label);
  schema(input, label);
  if (!Array.isArray(input.submissions)) {
    throw new Error(`${label}.submissions must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    submissions: Object.freeze(
      input.submissions.map((submission) =>
        parsePublishingSubmissionProjection(submission),
      ),
    ),
  });
}
