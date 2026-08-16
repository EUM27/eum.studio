import { entityId, type EntityId } from "../../domain/writing";
import {
  parseLoreEntryProjection,
  type LoreEntryProjection,
  type UpdateLoreEntryCommand,
} from "./lore-entry-contract";

export type LoreCandidateCertainty = "explicit" | "inferred";
export type LoreCandidateSource = "user" | "assistant";
export type LoreCandidateStatus = "pending" | "approved" | "rejected";
export type LoreCandidateApprovalBlockReason =
  | "already-reviewed"
  | "evidence-stale"
  | "evidence-unresolved"
  | "inferred"
  | "target-missing"
  | "target-stale";

export type LoreCandidateCreateProposal = {
  readonly kind: "create";
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
};

export type LoreCandidateUpdateProposal = {
  readonly kind: "update";
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly expectedLoreEntryRevision: number;
  readonly changes: UpdateLoreEntryCommand["changes"];
};

export type LoreCandidateProposal =
  | LoreCandidateCreateProposal
  | LoreCandidateUpdateProposal;

export type CreateLoreCandidateCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactText: string;
  readonly source: LoreCandidateSource;
  readonly certainty: LoreCandidateCertainty;
  readonly proposal: LoreCandidateProposal;
  readonly reason: string;
};

export type ListLoreCandidatesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type ReviewLoreCandidateCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"LoreCandidate">;
  readonly expectedRevision: number;
};

export type LoreCandidateEvidenceProjection = {
  readonly anchorId: EntityId<"Anchor">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly exactText: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: { readonly from: number; readonly to: number } | null;
};

export type LoreCandidateProjection = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"LoreCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly source: LoreCandidateSource;
  readonly certainty: LoreCandidateCertainty;
  readonly proposal: LoreCandidateProposal;
  readonly evidence: LoreCandidateEvidenceProjection;
  readonly reason: string;
  readonly status: LoreCandidateStatus;
  readonly approvedLoreEntryId: EntityId<"LoreEntry"> | null;
  readonly approvalBlockReason: LoreCandidateApprovalBlockReason | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
};

export type LoreCandidateListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidates: readonly LoreCandidateProjection[];
};

export type LoreCandidateApprovalResult = {
  readonly schemaVersion: 1;
  readonly candidate: LoreCandidateProjection;
  readonly loreEntry: LoreEntryProjection;
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
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
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
    throw new Error(`Unsupported ${label} schemaVersion`);
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

function offset(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function booleanValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): boolean {
  const value = input[field];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return entry;
  }));
}

function parseSelection(value: unknown, label: string) {
  const input = record(value, label);
  exactFields(input, ["anchor", "head"], label);
  const anchor = offset(input, "anchor", label);
  const head = offset(input, "head", label);
  if (anchor === head) throw new Error(`${label} must not be empty`);
  return Object.freeze({ anchor, head });
}

function parseChanges(
  value: unknown,
  label: string,
): UpdateLoreEntryCommand["changes"] {
  const input = record(value, label);
  optionalFields(input, ["title", "content", "category", "aliases", "enabled"], label);
  if (Object.keys(input).length === 0) {
    throw new Error(`${label} must contain at least one field`);
  }
  return Object.freeze({
    ...(Object.hasOwn(input, "title")
      ? { title: nonEmptyString(input, "title", label) }
      : {}),
    ...(Object.hasOwn(input, "content")
      ? { content: stringValue(input, "content", label) }
      : {}),
    ...(Object.hasOwn(input, "category")
      ? { category: stringValue(input, "category", label) }
      : {}),
    ...(Object.hasOwn(input, "aliases")
      ? { aliases: stringArray(input.aliases, `${label}.aliases`) }
      : {}),
    ...(Object.hasOwn(input, "enabled")
      ? { enabled: booleanValue(input, "enabled", label) }
      : {}),
  });
}

export function parseLoreCandidateProposal(
  value: unknown,
): LoreCandidateProposal {
  const label = "LoreCandidateProposal";
  const input = record(value, label);
  if (input.kind === "create") {
    exactFields(
      input,
      ["kind", "title", "content", "category", "aliases", "enabled"],
      label,
    );
    return Object.freeze({
      kind: "create",
      title: nonEmptyString(input, "title", label),
      content: stringValue(input, "content", label),
      category: stringValue(input, "category", label),
      aliases: stringArray(input.aliases, `${label}.aliases`),
      enabled: booleanValue(input, "enabled", label),
    });
  }
  if (input.kind === "update") {
    exactFields(
      input,
      ["kind", "loreEntryId", "expectedLoreEntryRevision", "changes"],
      label,
    );
    return Object.freeze({
      kind: "update",
      loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
      expectedLoreEntryRevision: positiveRevision(
        input,
        "expectedLoreEntryRevision",
        label,
      ),
      changes: parseChanges(input.changes, `${label}.changes`),
    });
  }
  throw new Error(`${label}.kind is invalid`);
}

function parseSource(value: unknown, label: string): LoreCandidateSource {
  if (value !== "user" && value !== "assistant") {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function parseCertainty(value: unknown, label: string): LoreCandidateCertainty {
  if (value !== "explicit" && value !== "inferred") {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseCreateLoreCandidateCommand(
  value: unknown,
): CreateLoreCandidateCommand {
  const label = "CreateLoreCandidateCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "selection",
      "exactText",
      "source",
      "certainty",
      "proposal",
      "reason",
    ],
    label,
  );
  schema(input, label);
  const exactText = stringValue(input, "exactText", label);
  if (exactText.length === 0) throw new Error(`${label}.exactText must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    selection: parseSelection(input.selection, `${label}.selection`),
    exactText,
    source: parseSource(input.source, `${label}.source`),
    certainty: parseCertainty(input.certainty, `${label}.certainty`),
    proposal: parseLoreCandidateProposal(input.proposal),
    reason: stringValue(input, "reason", label),
  });
}

export function parseListLoreCandidatesCommand(
  value: unknown,
): ListLoreCandidatesCommand {
  const label = "ListLoreCandidatesCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseReviewLoreCandidateCommand(
  value: unknown,
): ReviewLoreCandidateCommand {
  const label = "ReviewLoreCandidateCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "candidateId", "expectedRevision"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    candidateId: id<"LoreCandidate">(input, "candidateId", label),
    expectedRevision: positiveRevision(input, "expectedRevision", label),
  });
}

function parseNullableRange(value: unknown, label: string) {
  if (value === null) return null;
  const input = record(value, label);
  exactFields(input, ["from", "to"], label);
  const from = offset(input, "from", label);
  const to = offset(input, "to", label);
  if (to < from) throw new Error(`${label}.to must not precede from`);
  return Object.freeze({ from, to });
}

function parseEvidence(value: unknown): LoreCandidateEvidenceProjection {
  const label = "LoreCandidateEvidenceProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "anchorId",
      "sourceDocumentId",
      "sourceDocumentRevisionId",
      "exactText",
      "integrity",
      "range",
    ],
    label,
  );
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  const exactText = stringValue(input, "exactText", label);
  if (exactText.length === 0) {
    throw new Error(`${label}.exactText must not be empty`);
  }
  return Object.freeze({
    anchorId: id<"Anchor">(input, "anchorId", label),
    sourceDocumentId: id<"Document">(input, "sourceDocumentId", label),
    sourceDocumentRevisionId: id<"DocumentRevision">(
      input,
      "sourceDocumentRevisionId",
      label,
    ),
    exactText,
    integrity: input.integrity,
    range: parseNullableRange(input.range, `${label}.range`),
  });
}

function parseStatus(value: unknown, label: string): LoreCandidateStatus {
  if (value !== "pending" && value !== "approved" && value !== "rejected") {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function parseApprovalBlockReason(
  value: unknown,
  label: string,
): LoreCandidateApprovalBlockReason | null {
  if (value === null) return null;
  if (
    value !== "already-reviewed" &&
    value !== "evidence-stale" &&
    value !== "evidence-unresolved" &&
    value !== "inferred" &&
    value !== "target-missing" &&
    value !== "target-stale"
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseLoreCandidateProjection(
  value: unknown,
): LoreCandidateProjection {
  const label = "LoreCandidateProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "candidateId",
      "revision",
      "workId",
      "source",
      "certainty",
      "proposal",
      "evidence",
      "reason",
      "status",
      "approvedLoreEntryId",
      "approvalBlockReason",
      "createdAt",
      "reviewedAt",
    ],
    label,
  );
  schema(input, label);
  const approvedLoreEntryId = input.approvedLoreEntryId;
  if (
    approvedLoreEntryId !== null &&
    (typeof approvedLoreEntryId !== "string" || approvedLoreEntryId.length === 0)
  ) {
    throw new Error(`${label}.approvedLoreEntryId is invalid`);
  }
  const reviewedAt = input.reviewedAt;
  if (reviewedAt !== null && (typeof reviewedAt !== "string" || reviewedAt.length === 0)) {
    throw new Error(`${label}.reviewedAt is invalid`);
  }
  const status = parseStatus(input.status, `${label}.status`);
  if ((status === "pending") !== (reviewedAt === null)) {
    throw new Error(`${label} review state is inconsistent`);
  }
  if ((status === "approved") !== (approvedLoreEntryId !== null)) {
    throw new Error(`${label} approval state is inconsistent`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"LoreCandidate">(input, "candidateId", label),
    revision: positiveRevision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    source: parseSource(input.source, `${label}.source`),
    certainty: parseCertainty(input.certainty, `${label}.certainty`),
    proposal: parseLoreCandidateProposal(input.proposal),
    evidence: parseEvidence(input.evidence),
    reason: stringValue(input, "reason", label),
    status,
    approvedLoreEntryId:
      approvedLoreEntryId === null
        ? null
        : entityId<"LoreEntry">(approvedLoreEntryId),
    approvalBlockReason: parseApprovalBlockReason(
      input.approvalBlockReason,
      `${label}.approvalBlockReason`,
    ),
    createdAt: nonEmptyString(input, "createdAt", label),
    reviewedAt,
  });
}

export function parseLoreCandidateListProjection(
  value: unknown,
): LoreCandidateListProjection {
  const label = "LoreCandidateListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) {
    throw new Error(`${label}.candidates must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const candidates = Object.freeze(input.candidates.map((candidate, index) => {
    const projection = parseLoreCandidateProjection(candidate);
    if (projection.workId !== workId) {
      throw new Error(`${label}.candidates[${index}] is outside Work ${workId}`);
    }
    return projection;
  }));
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseLoreCandidateApprovalResult(
  value: unknown,
): LoreCandidateApprovalResult {
  const label = "LoreCandidateApprovalResult";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "candidate", "loreEntry"], label);
  schema(input, label);
  const candidate = parseLoreCandidateProjection(input.candidate);
  const loreEntry = parseLoreEntryProjection(input.loreEntry);
  if (
    candidate.status !== "approved" ||
    candidate.approvedLoreEntryId !== loreEntry.loreEntryId ||
    candidate.workId !== loreEntry.workId
  ) {
    throw new Error(`${label} ownership is inconsistent`);
  }
  return Object.freeze({ schemaVersion: 1, candidate, loreEntry });
}
