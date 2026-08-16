import { entityId, type EntityId } from "../../domain/writing";
import {
  parsePublishingSubmissionProjection,
  type PublishingSubmissionProjection,
} from "./publishing-submission-contract";

export type PublishingMailCandidateReviewStatus =
  | "needs-link"
  | "unreviewed"
  | "approved"
  | "ignored";

export type RecordPublishingMailCandidateCommand = {
  readonly schemaVersion: 1;
  readonly sourceAccountId: string;
  readonly messageId: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly receivedAt: string;
  readonly snippet: string;
  readonly bodyFingerprint: string;
  readonly matchReason: string;
  readonly proposedStatus: string;
  readonly proposedResult: string;
  readonly proposedRespondedOn: string | null;
  readonly proposedNote: string;
  readonly classificationConnectionId: string | null;
  readonly classificationModel: string;
};

export type ListPublishingMailCandidatesCommand = { readonly schemaVersion: 1 };

export type LinkPublishingMailCandidateCommand = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"PublishingMailCandidate">;
  readonly expectedRevision: number;
  readonly submissionId: EntityId<"PublishingSubmission">;
};

export type UpdatePublishingMailCandidateCommand = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"PublishingMailCandidate">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly proposedStatus?: string;
    readonly proposedResult?: string;
    readonly proposedRespondedOn?: string | null;
    readonly proposedNote?: string;
  };
};

export type ReviewPublishingMailCandidateCommand = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"PublishingMailCandidate">;
  readonly expectedRevision: number;
  readonly decision: "approve" | "ignore";
};

export type PublishingMailCandidateProjection = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"PublishingMailCandidate">;
  readonly revision: number;
  readonly sourceId: EntityId<"PublishingSource">;
  readonly sourceAccountId: string;
  readonly messageId: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly receivedAt: string;
  readonly snippet: string;
  readonly bodyFingerprint: string;
  readonly submissionId: EntityId<"PublishingSubmission"> | null;
  readonly partnerId: EntityId<"PublishingPartner"> | null;
  readonly matchReason: string;
  readonly proposedStatus: string;
  readonly proposedResult: string;
  readonly proposedRespondedOn: string | null;
  readonly proposedNote: string;
  readonly classificationConnectionId: string | null;
  readonly classificationModel: string;
  readonly reviewStatus: PublishingMailCandidateReviewStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublishingMailCandidateListProjection = {
  readonly schemaVersion: 1;
  readonly candidates: readonly PublishingMailCandidateProjection[];
};

export type PublishingMailCandidateReviewResult = {
  readonly schemaVersion: 1;
  readonly candidate: PublishingMailCandidateProjection;
  readonly submission: PublishingSubmissionProjection | null;
};

const REVIEW_STATUSES = new Set<PublishingMailCandidateReviewStatus>([
  "needs-link",
  "unreviewed",
  "approved",
  "ignored",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
  for (const field of fields) {
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
  }
}

function optional(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
}

function string(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function nonEmpty(input: Record<string, unknown>, field: string, label: string): string {
  const value = string(input, field, label).trim();
  if (value.length === 0) throw new Error(`${label}.${field} must be non-empty`);
  return value;
}

function nullableString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string or null`);
  return value;
}

function integer(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function dateOnly(value: string | null, label: string): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`${label} must be YYYY-MM-DD or null`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real date`);
  }
  return value;
}

function instant(value: string, label: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant`);
  }
  return value;
}

function id<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return entityId<TEntity>(value.trim());
}

function nullableId<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> | null {
  return value === null ? null : id<TEntity>(value, label);
}

export function parseRecordPublishingMailCandidateCommand(
  value: unknown,
): RecordPublishingMailCandidateCommand {
  const label = "RecordPublishingMailCandidateCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "sourceAccountId", "messageId", "threadId", "from", "subject",
    "receivedAt", "snippet", "bodyFingerprint", "matchReason", "proposedStatus",
    "proposedResult", "proposedRespondedOn", "proposedNote",
    "classificationConnectionId", "classificationModel",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    sourceAccountId: nonEmpty(input, "sourceAccountId", label),
    messageId: nonEmpty(input, "messageId", label),
    threadId: nonEmpty(input, "threadId", label),
    from: string(input, "from", label),
    subject: string(input, "subject", label),
    receivedAt: instant(nonEmpty(input, "receivedAt", label), `${label}.receivedAt`),
    snippet: string(input, "snippet", label),
    bodyFingerprint: nonEmpty(input, "bodyFingerprint", label),
    matchReason: string(input, "matchReason", label),
    proposedStatus: string(input, "proposedStatus", label),
    proposedResult: string(input, "proposedResult", label),
    proposedRespondedOn: dateOnly(
      nullableString(input, "proposedRespondedOn", label),
      `${label}.proposedRespondedOn`,
    ),
    proposedNote: string(input, "proposedNote", label),
    classificationConnectionId: nullableString(input, "classificationConnectionId", label),
    classificationModel: string(input, "classificationModel", label),
  });
}

export function parseListPublishingMailCandidatesCommand(
  value: unknown,
): ListPublishingMailCandidatesCommand {
  const label = "ListPublishingMailCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parseLinkPublishingMailCandidateCommand(
  value: unknown,
): LinkPublishingMailCandidateCommand {
  const label = "LinkPublishingMailCandidateCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidateId", "expectedRevision", "submissionId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"PublishingMailCandidate">(input.candidateId, `${label}.candidateId`),
    expectedRevision: integer(input, "expectedRevision", label),
    submissionId: id<"PublishingSubmission">(input.submissionId, `${label}.submissionId`),
  });
}

export function parseUpdatePublishingMailCandidateCommand(
  value: unknown,
): UpdatePublishingMailCandidateCommand {
  const label = "UpdatePublishingMailCandidateCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidateId", "expectedRevision", "changes"], label);
  schema(input, label);
  const changesInput = record(input.changes, `${label}.changes`);
  optional(changesInput, [
    "proposedStatus", "proposedResult", "proposedRespondedOn", "proposedNote",
  ], `${label}.changes`);
  if (Object.keys(changesInput).length === 0) throw new Error(`${label}.changes must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"PublishingMailCandidate">(input.candidateId, `${label}.candidateId`),
    expectedRevision: integer(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changesInput, "proposedStatus")
        ? { proposedStatus: string(changesInput, "proposedStatus", `${label}.changes`) }
        : {}),
      ...(Object.hasOwn(changesInput, "proposedResult")
        ? { proposedResult: string(changesInput, "proposedResult", `${label}.changes`) }
        : {}),
      ...(Object.hasOwn(changesInput, "proposedRespondedOn")
        ? {
            proposedRespondedOn: dateOnly(
              nullableString(changesInput, "proposedRespondedOn", `${label}.changes`),
              `${label}.changes.proposedRespondedOn`,
            ),
          }
        : {}),
      ...(Object.hasOwn(changesInput, "proposedNote")
        ? { proposedNote: string(changesInput, "proposedNote", `${label}.changes`) }
        : {}),
    }),
  });
}

export function parseReviewPublishingMailCandidateCommand(
  value: unknown,
): ReviewPublishingMailCandidateCommand {
  const label = "ReviewPublishingMailCandidateCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidateId", "expectedRevision", "decision"], label);
  schema(input, label);
  if (input.decision !== "approve" && input.decision !== "ignore") {
    throw new Error(`${label}.decision is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"PublishingMailCandidate">(input.candidateId, `${label}.candidateId`),
    expectedRevision: integer(input, "expectedRevision", label),
    decision: input.decision,
  });
}

export function parsePublishingMailCandidateProjection(
  value: unknown,
): PublishingMailCandidateProjection {
  const label = "PublishingMailCandidateProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "candidateId", "revision", "sourceId", "sourceAccountId",
    "messageId", "threadId", "from", "subject", "receivedAt", "snippet",
    "bodyFingerprint", "submissionId", "partnerId", "matchReason", "proposedStatus",
    "proposedResult", "proposedRespondedOn", "proposedNote",
    "classificationConnectionId", "classificationModel", "reviewStatus", "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  if (typeof input.reviewStatus !== "string" ||
      !REVIEW_STATUSES.has(input.reviewStatus as PublishingMailCandidateReviewStatus)) {
    throw new Error(`${label}.reviewStatus is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"PublishingMailCandidate">(input.candidateId, `${label}.candidateId`),
    revision: integer(input, "revision", label),
    sourceId: id<"PublishingSource">(input.sourceId, `${label}.sourceId`),
    sourceAccountId: nonEmpty(input, "sourceAccountId", label),
    messageId: nonEmpty(input, "messageId", label),
    threadId: nonEmpty(input, "threadId", label),
    from: string(input, "from", label),
    subject: string(input, "subject", label),
    receivedAt: instant(nonEmpty(input, "receivedAt", label), `${label}.receivedAt`),
    snippet: string(input, "snippet", label),
    bodyFingerprint: nonEmpty(input, "bodyFingerprint", label),
    submissionId: nullableId<"PublishingSubmission">(input.submissionId, `${label}.submissionId`),
    partnerId: nullableId<"PublishingPartner">(input.partnerId, `${label}.partnerId`),
    matchReason: string(input, "matchReason", label),
    proposedStatus: string(input, "proposedStatus", label),
    proposedResult: string(input, "proposedResult", label),
    proposedRespondedOn: dateOnly(
      nullableString(input, "proposedRespondedOn", label),
      `${label}.proposedRespondedOn`,
    ),
    proposedNote: string(input, "proposedNote", label),
    classificationConnectionId: nullableString(input, "classificationConnectionId", label),
    classificationModel: string(input, "classificationModel", label),
    reviewStatus: input.reviewStatus as PublishingMailCandidateReviewStatus,
    createdAt: instant(nonEmpty(input, "createdAt", label), `${label}.createdAt`),
    updatedAt: instant(nonEmpty(input, "updatedAt", label), `${label}.updatedAt`),
  });
}

export function parsePublishingMailCandidateListProjection(
  value: unknown,
): PublishingMailCandidateListProjection {
  const label = "PublishingMailCandidateListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) throw new Error(`${label}.candidates must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    candidates: Object.freeze(input.candidates.map(parsePublishingMailCandidateProjection)),
  });
}

export function parsePublishingMailCandidateReviewResult(
  value: unknown,
): PublishingMailCandidateReviewResult {
  const label = "PublishingMailCandidateReviewResult";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidate", "submission"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    candidate: parsePublishingMailCandidateProjection(input.candidate),
    submission: input.submission === null
      ? null
      : parsePublishingSubmissionProjection(input.submission),
  });
}
