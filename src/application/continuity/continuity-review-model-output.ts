import type { EntityId } from "../../domain/writing";
import type { AssistantContextRange } from "../assistant/assistant-context-permission";
import {
  parseCanonEntityRefList,
  type CanonEntityRef,
} from "../canon/canon-entity-ref";
import {
  CONTINUITY_THREAD_KINDS,
  type ContinuityThreadKind,
} from "./continuity-thread-contract";
import type {
  ContinuityAssertionBasis,
  ContinuityReviewEvidence,
} from "./continuity-review-contract";

export type ContinuityReviewModelEvidence = Readonly<{
  paragraphId: string;
  quote: string;
}>;

export type ContinuityReviewModelProposal = Readonly<{
  assertionBasis: ContinuityAssertionBasis;
  kind: ContinuityThreadKind;
  title: string;
  note: string;
  subjectRefs: readonly CanonEntityRef[];
  reason: string;
  evidence: readonly ContinuityReviewModelEvidence[];
}>;

export type ContinuityReviewModelPayload = Readonly<{
  proposals: readonly ContinuityReviewModelProposal[];
}>;

export type ContinuityReviewParagraph = Readonly<{
  paragraphId: string;
  text: string;
  from: number;
  to: number;
}>;

export type ContinuityReviewSubjectReference = Readonly<{
  entity: CanonEntityRef;
  revision: number;
  label: string;
}>;

export type ContinuityReviewConnectorInput = Readonly<{
  requestedRange: AssistantContextRange;
  paragraphs: readonly ContinuityReviewParagraph[];
  subjectReferences: readonly ContinuityReviewSubjectReference[];
}>;

export type ContinuityReviewExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: "eum-continuity-review-v1";
  payload: ContinuityReviewModelPayload;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string) {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  if (!allowEmpty && value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return allowEmpty ? value : value.trim();
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function parseEvidence(value: unknown, label: string): ContinuityReviewModelEvidence {
  const input = record(value, label);
  exact(input, ["paragraphId", "quote"], label);
  return Object.freeze({
    paragraphId: text(input.paragraphId, `${label}.paragraphId`),
    quote: text(input.quote, `${label}.quote`),
  });
}

function parseProposal(value: unknown, label: string): ContinuityReviewModelProposal {
  const input = record(value, label);
  exact(input, [
    "assertionBasis",
    "kind",
    "title",
    "note",
    "subjectRefs",
    "reason",
    "evidence",
  ], label);
  if (
    input.assertionBasis !== "explicit-evidence" &&
    input.assertionBasis !== "model-inference"
  ) {
    throw new Error(`${label}.assertionBasis is unsupported`);
  }
  if (!(CONTINUITY_THREAD_KINDS as readonly unknown[]).includes(input.kind)) {
    throw new Error(`${label}.kind is unsupported`);
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error(`${label}.evidence must be a non-empty array`);
  }
  const evidence = Object.freeze(input.evidence.map((entry, index) =>
    parseEvidence(entry, `${label}.evidence[${index}]`)
  ));
  const evidenceKeys = evidence.map((entry) => `${entry.paragraphId}:${entry.quote}`);
  if (new Set(evidenceKeys).size !== evidenceKeys.length) {
    throw new Error(`${label}.evidence contains duplicates`);
  }
  return Object.freeze({
    assertionBasis: input.assertionBasis,
    kind: input.kind as ContinuityThreadKind,
    title: text(input.title, `${label}.title`),
    note: text(input.note, `${label}.note`, true),
    subjectRefs: parseCanonEntityRefList(input.subjectRefs, `${label}.subjectRefs`),
    reason: text(input.reason, `${label}.reason`),
    evidence,
  });
}

export function parseContinuityReviewModelPayload(
  value: unknown,
): ContinuityReviewModelPayload {
  const label = "ContinuityReviewModelPayload";
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

export function parseContinuityReviewExecution(
  value: unknown,
): ContinuityReviewExecution {
  const label = "ContinuityReviewExecution";
  const input = record(value, label);
  exact(input, ["providerId", "modelId", "promptVersion", "payload"], label);
  if (input.promptVersion !== "eum-continuity-review-v1") {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  return Object.freeze({
    providerId: text(input.providerId, `${label}.providerId`),
    modelId: text(input.modelId, `${label}.modelId`),
    promptVersion: "eum-continuity-review-v1",
    payload: parseContinuityReviewModelPayload(input.payload),
  });
}

export function createContinuityReviewParagraphs(input: Readonly<{
  sourceRange: AssistantContextRange;
  manuscript: string;
}>): readonly ContinuityReviewParagraph[] {
  const paragraphs: ContinuityReviewParagraph[] = [];
  const pattern = /[^\n]*(?:\n|$)/gu;
  let index = 0;
  for (const match of input.manuscript.matchAll(pattern)) {
    const matched = match[0] ?? "";
    const paragraphText = matched.endsWith("\n") ? matched.slice(0, -1) : matched;
    if (paragraphText.length === 0 && match.index === input.manuscript.length) break;
    const relativeFrom = match.index ?? 0;
    paragraphs.push(Object.freeze({
      paragraphId: `p${index + 1}`,
      text: paragraphText,
      from: input.sourceRange.from + relativeFrom,
      to: input.sourceRange.from + relativeFrom + paragraphText.length,
    }));
    index += 1;
  }
  return Object.freeze(paragraphs);
}

export function parseContinuityReviewParagraph(
  value: unknown,
  label = "ContinuityReviewParagraph",
): ContinuityReviewParagraph {
  const input = record(value, label);
  exact(input, ["paragraphId", "text", "from", "to"], label);
  const from = nonNegativeInteger(input.from, `${label}.from`);
  const to = nonNegativeInteger(input.to, `${label}.to`);
  const paragraphText = text(input.text, `${label}.text`, true);
  if (to <= from || to - from !== paragraphText.length) {
    throw new Error(`${label} range does not match its text`);
  }
  return Object.freeze({
    paragraphId: text(input.paragraphId, `${label}.paragraphId`),
    text: paragraphText,
    from,
    to,
  });
}

export function resolveContinuityReviewEvidence(input: Readonly<{
  proposal: ContinuityReviewModelProposal;
  paragraphs: readonly ContinuityReviewParagraph[];
  sourceRange: AssistantContextRange;
  evidenceIdFactory: Readonly<{ create(): string }>;
}>): readonly ContinuityReviewEvidence[] {
  const paragraphById = new Map(input.paragraphs.map((entry) => [entry.paragraphId, entry]));
  if (paragraphById.size !== input.paragraphs.length) {
    throw new Error("Continuity paragraphs contain duplicate identities");
  }
  const evidence = input.proposal.evidence.map((entry, index) => {
    const paragraph = paragraphById.get(entry.paragraphId);
    if (paragraph === undefined) {
      throw new Error(`Continuity evidence[${index}] references an unknown paragraph`);
    }
    if (paragraph.from < input.sourceRange.from || paragraph.to > input.sourceRange.to) {
      throw new Error(`Continuity evidence[${index}] is outside the source range`);
    }
    const first = paragraph.text.indexOf(entry.quote);
    if (first < 0 || paragraph.text.indexOf(entry.quote, first + 1) >= 0) {
      throw new Error(`Continuity evidence[${index}] quote is not uniquely present`);
    }
    return Object.freeze({
      evidenceId: input.evidenceIdFactory.create() as EntityId<"ContinuityReviewEvidence">,
      documentId: input.sourceRange.documentId,
      documentRevisionId: input.sourceRange.documentRevisionId,
      from: paragraph.from + first,
      to: paragraph.from + first + entry.quote.length,
      exactText: entry.quote,
      anchorId: null,
    });
  });
  const identities = evidence.map((entry) =>
    `${entry.documentRevisionId}:${entry.from}:${entry.to}:${entry.exactText}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("Continuity evidence contains duplicate exact ranges");
  }
  return Object.freeze(evidence);
}
