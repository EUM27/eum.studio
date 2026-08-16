import { entityId, type EntityId } from "../../domain/writing";

export const PUBLISHING_EVIDENCE_TARGET_KINDS = [
  "partner",
  "submission",
  "contract",
  "publication",
  "settlement",
  "payment",
] as const;

export type PublishingEvidenceTargetKind =
  (typeof PUBLISHING_EVIDENCE_TARGET_KINDS)[number];

export type SetPublishingEvidenceLinksCommand = {
  readonly schemaVersion: 1;
  readonly targetKind: PublishingEvidenceTargetKind;
  readonly targetId: string;
  readonly expectedRevision: number;
  readonly sourceIds: readonly EntityId<"PublishingSource">[];
};

export type PublishingEvidenceLinksProjection = {
  readonly schemaVersion: 1;
  readonly targetKind: PublishingEvidenceTargetKind;
  readonly targetId: string;
  readonly revision: number;
  readonly sourceIds: readonly EntityId<"PublishingSource">[];
  readonly updatedAt: string;
};

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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
}

function nonEmpty(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value.trim();
}

function targetKind(
  input: Record<string, unknown>,
  field: string,
  label: string,
): PublishingEvidenceTargetKind {
  const value = nonEmpty(input, field, label);
  if (!PUBLISHING_EVIDENCE_TARGET_KINDS.some((candidate) => candidate === value)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as PublishingEvidenceTargetKind;
}

function revision(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function sourceIds(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly EntityId<"PublishingSource">[] {
  const value = input[field];
  if (!Array.isArray(value)) throw new Error(`${label}.${field} must be an array`);
  const ids = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}.${field}[${index}] must be non-empty`);
    }
    return entityId<"PublishingSource">(entry.trim());
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label}.${field} must not contain duplicates`);
  }
  return Object.freeze(ids);
}

const FIELDS = [
  "schemaVersion",
  "targetKind",
  "targetId",
  "expectedRevision",
  "sourceIds",
] as const;

export function parseSetPublishingEvidenceLinksCommand(
  value: unknown,
): SetPublishingEvidenceLinksCommand {
  const label = "SetPublishingEvidenceLinksCommand";
  const input = record(value, label);
  exact(input, FIELDS, label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    targetKind: targetKind(input, "targetKind", label),
    targetId: nonEmpty(input, "targetId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    sourceIds: sourceIds(input, "sourceIds", label),
  });
}

export function parsePublishingEvidenceLinksProjection(
  value: unknown,
): PublishingEvidenceLinksProjection {
  const label = "PublishingEvidenceLinksProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "targetKind",
    "targetId",
    "revision",
    "sourceIds",
    "updatedAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    targetKind: targetKind(input, "targetKind", label),
    targetId: nonEmpty(input, "targetId", label),
    revision: revision(input, "revision", label),
    sourceIds: sourceIds(input, "sourceIds", label),
    updatedAt: nonEmpty(input, "updatedAt", label),
  });
}
