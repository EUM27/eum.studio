import { entityId, type EntityId } from "../../domain/writing";
import {
  parsePublishingPartnerProjection,
  type PublishingPartnerProjection,
} from "./publishing-partner-contract";
import {
  parsePublishingSourceProjection,
  type PublishingSourceProjection,
} from "./publishing-source-contract";

export type PublishingResearchField = "websiteUrl" | "email" | "genres" | "note";
export type PublishingResearchValue = string | readonly string[];

export type PublishingResearchSourceInput = {
  readonly label: string;
  readonly url: string;
  readonly observedOn: string;
  readonly authority: string;
};

export type PublishingResearchProposals = {
  readonly websiteUrl?: string;
  readonly email?: string;
  readonly genres?: readonly string[];
  readonly note?: string;
};

export type PreviewPublishingResearchCommand = {
  readonly schemaVersion: 1;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly source: PublishingResearchSourceInput;
  readonly proposals: PublishingResearchProposals;
};

export type PublishingResearchCandidateProjection = {
  readonly schemaVersion: 1;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly expectedRevision: number;
  readonly source: PublishingResearchSourceInput;
  readonly proposals: PublishingResearchProposals;
  readonly fields: readonly {
    readonly field: PublishingResearchField;
    readonly current: PublishingResearchValue;
    readonly proposed: PublishingResearchValue;
    readonly conflict: boolean;
  }[];
};

export type ApprovePublishingResearchCommand = {
  readonly schemaVersion: 1;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly expectedRevision: number;
  readonly source: PublishingResearchSourceInput;
  readonly proposals: PublishingResearchProposals;
  readonly selectedFields: readonly PublishingResearchField[];
};

export type PublishingResearchApprovalResult = {
  readonly schemaVersion: 1;
  readonly partner: PublishingPartnerProjection;
  readonly source: PublishingSourceProjection;
};

const RESEARCH_FIELDS = ["websiteUrl", "email", "genres", "note"] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function optional(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (Object.keys(input).some((field) => !expected.has(field))) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

function source(value: unknown, label: string): PublishingResearchSourceInput {
  const input = record(value, label);
  exact(input, ["label", "url", "observedOn", "authority"], label);
  const parsedUrl = new URL(nonEmpty(input.url, `${label}.url`));
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`${label}.url must use HTTP or HTTPS`);
  }
  const observedOn = nonEmpty(input.observedOn, `${label}.observedOn`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(observedOn)) {
    throw new Error(`${label}.observedOn must be YYYY-MM-DD`);
  }
  const parsedDate = new Date(`${observedOn}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== observedOn) {
    throw new Error(`${label}.observedOn must be a calendar date`);
  }
  return Object.freeze({
    label: nonEmpty(input.label, `${label}.label`),
    url: parsedUrl.toString(),
    observedOn,
    authority: nonEmpty(input.authority, `${label}.authority`),
  });
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value.trim();
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) =>
    nonEmpty(entry, `${label}[${index}]`)
  ));
}

function proposals(value: unknown, label: string): PublishingResearchProposals {
  const input = record(value, label);
  optional(input, RESEARCH_FIELDS, label);
  return Object.freeze({
    ...(Object.hasOwn(input, "websiteUrl")
      ? { websiteUrl: text(input.websiteUrl, `${label}.websiteUrl`) }
      : {}),
    ...(Object.hasOwn(input, "email")
      ? { email: text(input.email, `${label}.email`) }
      : {}),
    ...(Object.hasOwn(input, "genres")
      ? { genres: stringArray(input.genres, `${label}.genres`) }
      : {}),
    ...(Object.hasOwn(input, "note")
      ? { note: text(input.note, `${label}.note`) }
      : {}),
  });
}

function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function field(value: unknown, label: string): PublishingResearchField {
  if (typeof value !== "string" || !RESEARCH_FIELDS.includes(value as PublishingResearchField)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as PublishingResearchField;
}

function valuesEqual(left: PublishingResearchValue, right: PublishingResearchValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

export function parsePreviewPublishingResearchCommand(
  value: unknown,
): PreviewPublishingResearchCommand {
  const label = "PreviewPublishingResearchCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "partnerId", "source", "proposals"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    partnerId: entityId<"PublishingPartner">(nonEmpty(input.partnerId, `${label}.partnerId`)),
    source: source(input.source, `${label}.source`),
    proposals: proposals(input.proposals, `${label}.proposals`),
  });
}

export function parseApprovePublishingResearchCommand(
  value: unknown,
): ApprovePublishingResearchCommand {
  const label = "ApprovePublishingResearchCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "partnerId",
    "expectedRevision",
    "source",
    "proposals",
    "selectedFields",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.selectedFields) || input.selectedFields.length === 0) {
    throw new Error(`${label}.selectedFields must be a non-empty array`);
  }
  const selectedFields = Object.freeze(input.selectedFields.map((value, index) =>
    field(value, `${label}.selectedFields[${index}]`)
  ));
  if (new Set(selectedFields).size !== selectedFields.length) {
    throw new Error(`${label}.selectedFields must be unique`);
  }
  const parsedProposals = proposals(input.proposals, `${label}.proposals`);
  if (selectedFields.some((name) => !Object.hasOwn(parsedProposals, name))) {
    throw new Error(`${label}.selectedFields must reference proposed fields`);
  }
  return Object.freeze({
    schemaVersion: 1,
    partnerId: entityId<"PublishingPartner">(nonEmpty(input.partnerId, `${label}.partnerId`)),
    expectedRevision: revision(input.expectedRevision, `${label}.expectedRevision`),
    source: source(input.source, `${label}.source`),
    proposals: parsedProposals,
    selectedFields,
  });
}

export function buildPublishingResearchCandidate(
  partner: PublishingPartnerProjection,
  command: PreviewPublishingResearchCommand,
): PublishingResearchCandidateProjection {
  if (partner.partnerId !== command.partnerId) {
    throw new Error(`Publishing research partner boundary violation: ${command.partnerId}`);
  }
  const fields = RESEARCH_FIELDS.flatMap((name) => {
    if (!Object.hasOwn(command.proposals, name)) return [];
    const current = partner[name];
    const proposed = command.proposals[name] as PublishingResearchValue;
    const currentHasValue = Array.isArray(current) ? current.length > 0 : current.length > 0;
    return [Object.freeze({
      field: name,
      current,
      proposed,
      conflict: currentHasValue && !valuesEqual(current, proposed),
    })];
  });
  return Object.freeze({
    schemaVersion: 1,
    partnerId: partner.partnerId,
    expectedRevision: partner.revision,
    source: command.source,
    proposals: command.proposals,
    fields: Object.freeze(fields),
  });
}

export function parsePublishingResearchCandidateProjection(
  value: unknown,
): PublishingResearchCandidateProjection {
  const label = "PublishingResearchCandidateProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "partnerId",
    "expectedRevision",
    "source",
    "proposals",
    "fields",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.fields)) throw new Error(`${label}.fields must be an array`);
  const parsedProposals = proposals(input.proposals, `${label}.proposals`);
  return Object.freeze({
    schemaVersion: 1,
    partnerId: entityId<"PublishingPartner">(nonEmpty(input.partnerId, `${label}.partnerId`)),
    expectedRevision: revision(input.expectedRevision, `${label}.expectedRevision`),
    source: source(input.source, `${label}.source`),
    proposals: parsedProposals,
    fields: Object.freeze(input.fields.map((value, index) => {
      const itemLabel = `${label}.fields[${index}]`;
      const item = record(value, itemLabel);
      exact(item, ["field", "current", "proposed", "conflict"], itemLabel);
      const name = field(item.field, `${itemLabel}.field`);
      if (typeof item.conflict !== "boolean") throw new Error(`${itemLabel}.conflict must be boolean`);
      const current = name === "genres"
        ? stringArray(item.current, `${itemLabel}.current`)
        : text(item.current, `${itemLabel}.current`);
      const proposed = name === "genres"
        ? stringArray(item.proposed, `${itemLabel}.proposed`)
        : text(item.proposed, `${itemLabel}.proposed`);
      return Object.freeze({ field: name, current, proposed, conflict: item.conflict });
    })),
  });
}

export function parsePublishingResearchApprovalResult(
  value: unknown,
): PublishingResearchApprovalResult {
  const label = "PublishingResearchApprovalResult";
  const input = record(value, label);
  exact(input, ["schemaVersion", "partner", "source"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    partner: parsePublishingPartnerProjection(input.partner),
    source: parsePublishingSourceProjection(input.source),
  });
}
