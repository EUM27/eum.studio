import { entityId, type EntityId } from "../../domain/writing";
import type { AssistantContextRange } from "../assistant/assistant-context-permission";
import {
  CANON_CHARACTER_FIELDS,
  CANON_CHARACTER_KNOWLEDGE_FIELDS,
  CANON_CHARACTER_RELATION_FIELDS,
  CANON_LORE_ENTRY_FIELDS,
  CANON_REVIEW_PROMPT_VERSION,
  CANON_TARGET_KINDS,
  type CanonAssertionBasis,
  type CanonFieldName,
  type CanonFieldValue,
  type CanonReviewEvidence,
  type CanonTargetKind,
} from "./canon-review-contract";

export type CanonReviewModelEvidence = Readonly<{
  paragraphId: string;
  quote: string;
}>;

export type CanonReviewModelProposal = Readonly<{
  targetKind: CanonTargetKind;
  targetHint: string;
  operationHint: "create" | "update" | "unresolved";
  assertionBasis: CanonAssertionBasis;
  reason: string;
  fields: Readonly<Partial<Record<CanonFieldName, CanonFieldValue>>>;
  evidence: readonly CanonReviewModelEvidence[];
}>;

export type CanonReviewModelPayload = Readonly<{
  proposals: readonly CanonReviewModelProposal[];
}>;

export type CanonReviewParagraph = Readonly<{
  paragraphId: string;
  from: number;
  to: number;
  text: string;
}>;

export type CanonReviewExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof CANON_REVIEW_PROMPT_VERSION;
  payload: CanonReviewModelPayload;
}>;

export type CanonReviewCharacterReference = Readonly<{
  characterId: EntityId<"Character">;
  name: string;
  aliases: readonly string[];
}>;

export type CanonReviewConnectorInput = Readonly<{
  requestId: EntityId<"CanonReviewRequest">;
  requestedTargetKinds: readonly CanonTargetKind[];
  paragraphs: readonly CanonReviewParagraph[];
  characterReferences: readonly CanonReviewCharacterReference[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const entries = value.map((entry, index) =>
    nonEmptyString(entry, `${label}[${index}]`)
  );
  if (new Set(entries).size !== entries.length) {
    throw new Error(`${label} contains duplicate values`);
  }
  return Object.freeze(entries);
}

function kind(value: unknown, label: string): CanonTargetKind {
  if (!(CANON_TARGET_KINDS as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as CanonTargetKind;
}

function allowedFields(targetKind: CanonTargetKind): readonly CanonFieldName[] {
  if (targetKind === "character") return CANON_CHARACTER_FIELDS;
  if (targetKind === "character-relation") {
    return CANON_CHARACTER_RELATION_FIELDS;
  }
  if (targetKind === "lore-entry") return CANON_LORE_ENTRY_FIELDS;
  return CANON_CHARACTER_KNOWLEDGE_FIELDS;
}

function fieldValue(
  value: unknown,
  field: CanonFieldName,
  label: string,
): CanonFieldValue {
  if (field === "aliases" || field === "aboutRefKeys") {
    return stringArray(value, label);
  }
  if (field === "enabled") {
    if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
    return value;
  }
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (
    field === "stance" &&
    !["knows", "believes", "suspects", "denies", "unaware"].includes(value)
  ) {
    throw new Error(`${label} is an unsupported CharacterKnowledge stance`);
  }
  if (
    field === "truthStatus" &&
    !["true", "false", "unknown"].includes(value)
  ) {
    throw new Error(`${label} is an unsupported CharacterKnowledge truth status`);
  }
  if (
    [
      "name",
      "title",
      "kind",
      "fromCharacterId",
      "toCharacterId",
      "characterId",
      "statement",
    ].includes(
      field,
    ) && value.trim().length === 0
  ) {
    throw new Error(`${label} must be non-empty`);
  }
  return value;
}

function parseFields(
  value: unknown,
  targetKind: CanonTargetKind,
  operationHint: CanonReviewModelProposal["operationHint"],
  label: string,
): CanonReviewModelProposal["fields"] {
  const input = record(value, label);
  const allowed = allowedFields(targetKind);
  if (Object.keys(input).length === 0) {
    throw new Error(`${label} must contain at least one field`);
  }
  for (const field of Object.keys(input)) {
    if (!allowed.includes(field as CanonFieldName)) {
      throw new Error(`${label}.${field} is unsupported for ${targetKind}`);
    }
  }
  if (
    operationHint === "create" &&
    (Object.keys(input).length !== allowed.length ||
      allowed.some((field) => !Object.hasOwn(input, field)))
  ) {
    throw new Error(`${label} create fields must be complete`);
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(input).map(([field, entry]) => [
      field,
      fieldValue(entry, field as CanonFieldName, `${label}.${field}`),
    ]),
  )) as CanonReviewModelProposal["fields"];
}

function parseEvidence(value: unknown, label: string): CanonReviewModelEvidence {
  const input = record(value, label);
  exact(input, ["paragraphId", "quote"], label);
  return Object.freeze({
    paragraphId: nonEmptyString(input.paragraphId, `${label}.paragraphId`),
    quote: nonEmptyString(input.quote, `${label}.quote`),
  });
}

function parseProposal(value: unknown, label: string): CanonReviewModelProposal {
  const input = record(value, label);
  exact(input, [
    "targetKind",
    "targetHint",
    "operationHint",
    "assertionBasis",
    "reason",
    "fields",
    "evidence",
  ], label);
  const targetKind = kind(input.targetKind, `${label}.targetKind`);
  if (
    input.operationHint !== "create" && input.operationHint !== "update" &&
    input.operationHint !== "unresolved"
  ) {
    throw new Error(`${label}.operationHint is unsupported`);
  }
  if (
    input.assertionBasis !== "explicit-evidence" &&
    input.assertionBasis !== "model-inference"
  ) {
    throw new Error(`${label}.assertionBasis is unsupported`);
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error(`${label}.evidence must be a non-empty array`);
  }
  const evidence = Object.freeze(input.evidence.map((entry, index) =>
    parseEvidence(entry, `${label}.evidence[${index}]`)
  ));
  const identities = evidence.map((entry) =>
    `${entry.paragraphId}\u001f${entry.quote}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error(`${label}.evidence contains duplicates`);
  }
  return Object.freeze({
    targetKind,
    targetHint: nonEmptyString(input.targetHint, `${label}.targetHint`),
    operationHint: input.operationHint,
    assertionBasis: input.assertionBasis,
    reason: nonEmptyString(input.reason, `${label}.reason`),
    fields: parseFields(
      input.fields,
      targetKind,
      input.operationHint,
      `${label}.fields`,
    ),
    evidence,
  });
}

export function parseCanonReviewModelPayload(
  value: unknown,
): CanonReviewModelPayload {
  const label = "CanonReviewModelPayload";
  const input = record(value, label);
  exact(input, ["proposals"], label);
  if (!Array.isArray(input.proposals)) {
    throw new Error(`${label}.proposals must be an array`);
  }
  return Object.freeze({
    proposals: Object.freeze(input.proposals.map((entry, index) =>
      parseProposal(entry, `${label}.proposals[${index}]`)
    )),
  });
}

export function createCanonReviewParagraphs(input: Readonly<{
  sourceRange: AssistantContextRange;
  manuscript: string;
}>): readonly CanonReviewParagraph[] {
  const paragraphs: CanonReviewParagraph[] = [];
  const pattern = /[^\n]*(?:\n|$)/gu;
  let index = 0;
  for (const match of input.manuscript.matchAll(pattern)) {
    const matched = match[0] ?? "";
    const text = matched.endsWith("\n") ? matched.slice(0, -1) : matched;
    if (text.length === 0 && match.index === input.manuscript.length) break;
    const relativeFrom = match.index ?? 0;
    paragraphs.push(Object.freeze({
      paragraphId: `p${index + 1}`,
      from: input.sourceRange.from + relativeFrom,
      to: input.sourceRange.from + relativeFrom + text.length,
      text,
    }));
    index += 1;
  }
  return Object.freeze(paragraphs);
}

export function resolveCanonReviewEvidence(input: Readonly<{
  sourceRange: AssistantContextRange;
  paragraphs: readonly CanonReviewParagraph[];
  proposal: CanonReviewModelProposal;
  evidenceIdFactory: Readonly<{ create(): string }>;
}>): readonly CanonReviewEvidence[] {
  const evidence = input.proposal.evidence.map((entry, index) => {
    const paragraph = input.paragraphs.find(
      (candidate) => candidate.paragraphId === entry.paragraphId,
    );
    if (paragraph === undefined) {
      throw new Error(`Canon evidence[${index}] references an unknown paragraph`);
    }
    const first = paragraph.text.indexOf(entry.quote);
    const last = paragraph.text.lastIndexOf(entry.quote);
    if (first < 0 || first !== last) {
      throw new Error(`Canon evidence[${index}] quote is not uniquely present`);
    }
    const from = paragraph.from + first;
    const to = from + entry.quote.length;
    if (from < input.sourceRange.from || to > input.sourceRange.to) {
      throw new Error(`Canon evidence[${index}] is outside the source range`);
    }
    return Object.freeze({
      evidenceId: entityId<"CanonReviewEvidence">(
        input.evidenceIdFactory.create(),
      ),
      documentId: input.sourceRange.documentId,
      documentRevisionId: input.sourceRange.documentRevisionId,
      from,
      to,
      exactText: entry.quote,
      anchorId: null,
    });
  });
  const identities = evidence.map((entry) =>
    `${entry.documentId}\u001f${entry.from}\u001f${entry.to}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("Canon evidence contains duplicate exact ranges");
  }
  return Object.freeze(evidence);
}

export function parseCanonReviewExecution(value: unknown): CanonReviewExecution {
  const label = "CanonReviewExecution";
  const input = record(value, label);
  exact(input, ["providerId", "modelId", "promptVersion", "payload"], label);
  if (input.promptVersion !== CANON_REVIEW_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  return Object.freeze({
    providerId: nonEmptyString(input.providerId, `${label}.providerId`),
    modelId: nonEmptyString(input.modelId, `${label}.modelId`),
    promptVersion: CANON_REVIEW_PROMPT_VERSION,
    payload: parseCanonReviewModelPayload(input.payload),
  });
}

export type CanonReviewEvidenceId = EntityId<"CanonReviewEvidence">;
