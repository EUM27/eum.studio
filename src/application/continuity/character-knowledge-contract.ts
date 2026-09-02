import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseCanonEntityRefList,
  type CanonEntityRef,
} from "../canon/canon-entity-ref";

export const CHARACTER_KNOWLEDGE_STANCES = [
  "knows",
  "believes",
  "suspects",
  "denies",
  "unaware",
] as const;

export const KNOWLEDGE_TRUTH_STATUSES = ["true", "false", "unknown"] as const;

export type CharacterKnowledgeStance =
  (typeof CHARACTER_KNOWLEDGE_STANCES)[number];
export type KnowledgeTruthStatus = (typeof KNOWLEDGE_TRUTH_STATUSES)[number];
export type CharacterKnowledgeStatus = "active" | "superseded" | "retired";
export type KnowledgeIntegrity = "resolved" | "needsReview" | "broken";

export type KnowledgeEvidenceProjection = Readonly<{
  anchorId: EntityId<"Anchor">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  exactText: string;
  integrity: KnowledgeIntegrity;
  range: Readonly<{ from: number; to: number }> | null;
}>;

export type CharacterKnowledgeProjection = Readonly<{
  schemaVersion: 1;
  knowledgeId: EntityId<"CharacterKnowledge">;
  revision: number;
  workId: EntityId<"Work">;
  characterId: EntityId<"Character">;
  statement: string;
  stance: CharacterKnowledgeStance;
  truthStatus: KnowledgeTruthStatus;
  aboutRefs: readonly CanonEntityRef[];
  evidence: readonly KnowledgeEvidenceProjection[];
  status: CharacterKnowledgeStatus;
  supersedesKnowledgeId: EntityId<"CharacterKnowledge"> | null;
  supersededByKnowledgeId: EntityId<"CharacterKnowledge"> | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CharacterKnowledgeListProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  entries: readonly CharacterKnowledgeProjection[];
}>;

export type PovKnowledgeContextProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  characterId: EntityId<"Character">;
  objectiveFacts: readonly CharacterKnowledgeProjection[];
  povKnown: readonly CharacterKnowledgeProjection[];
  povFalseBeliefs: readonly CharacterKnowledgeProjection[];
  povUnavailable: readonly CharacterKnowledgeProjection[];
}>;

export type CreateCharacterKnowledgeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  characterId: EntityId<"Character">;
  statement: string;
  stance: CharacterKnowledgeStance;
  truthStatus: KnowledgeTruthStatus;
  aboutRefs: readonly CanonEntityRef[];
  evidenceRange: AssistantContextRange | null;
}>;

/** Content correction only. A changed stance or truth must use supersession. */
export type UpdateCharacterKnowledgeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  knowledgeId: EntityId<"CharacterKnowledge">;
  expectedRevision: number;
  statement: string;
  aboutRefs: readonly CanonEntityRef[];
}>;

export type SupersedeCharacterKnowledgeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  knowledgeId: EntityId<"CharacterKnowledge">;
  expectedRevision: number;
  statement: string;
  stance: CharacterKnowledgeStance;
  truthStatus: KnowledgeTruthStatus;
  aboutRefs: readonly CanonEntityRef[];
  evidenceRange: AssistantContextRange | null;
}>;

export type RetireCharacterKnowledgeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  knowledgeId: EntityId<"CharacterKnowledge">;
  expectedRevision: number;
  reason: string;
}>;

export type ListCharacterKnowledgeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  characterId: EntityId<"Character"> | null;
  status: "all" | "current" | "history";
}>;

export type ProjectPovKnowledgeCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  characterId: EntityId<"Character">;
}>;

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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = allowEmpty ? value : value.trim();
  if (!allowEmpty && normalized.length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return normalized;
}

function exactText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be non-empty exact text`);
  }
  return value;
}

function id<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> {
  return entityId<TEntity>(text(value, label));
}

function nullableId<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> | null {
  return value === null ? null : id<TEntity>(value, label);
}

function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function instant(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be an instant`);
  return parsed;
}

function stance(value: unknown, label: string): CharacterKnowledgeStance {
  if (!(CHARACTER_KNOWLEDGE_STANCES as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as CharacterKnowledgeStance;
}

function truthStatus(value: unknown, label: string): KnowledgeTruthStatus {
  if (!(KNOWLEDGE_TRUTH_STATUSES as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as KnowledgeTruthStatus;
}

function evidenceRange(value: unknown, label: string): AssistantContextRange | null {
  return value === null ? null : parseAssistantContextRange(value, label);
}

function parseEvidence(value: unknown, label: string): KnowledgeEvidenceProjection {
  const input = record(value, label);
  exact(input, [
    "anchorId",
    "documentId",
    "documentRevisionId",
    "exactText",
    "integrity",
    "range",
  ], label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is unsupported`);
  }
  let range: Readonly<{ from: number; to: number }> | null = null;
  if (input.range !== null) {
    const candidate = record(input.range, `${label}.range`);
    exact(candidate, ["from", "to"], `${label}.range`);
    if (
      typeof candidate.from !== "number" ||
      typeof candidate.to !== "number" ||
      !Number.isSafeInteger(candidate.from) ||
      !Number.isSafeInteger(candidate.to) ||
      candidate.from < 0 ||
      candidate.to <= candidate.from
    ) {
      throw new Error(`${label}.range is invalid`);
    }
    range = Object.freeze({ from: candidate.from, to: candidate.to });
  }
  if (input.integrity === "resolved" && range === null) {
    throw new Error(`${label}.resolved evidence requires a range`);
  }
  return Object.freeze({
    anchorId: id<"Anchor">(input.anchorId, `${label}.anchorId`),
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    documentRevisionId: id<"DocumentRevision">(
      input.documentRevisionId,
      `${label}.documentRevisionId`,
    ),
    exactText: exactText(input.exactText, `${label}.exactText`),
    integrity: input.integrity,
    range,
  });
}

function parseProjectionList(
  value: unknown,
  label: string,
): readonly CharacterKnowledgeProjection[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) =>
    parseCharacterKnowledgeProjection(entry, `${label}[${index}]`)
  ));
}

export function parseCreateCharacterKnowledgeCommand(
  value: unknown,
): CreateCharacterKnowledgeCommand {
  const label = "CreateCharacterKnowledgeCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "characterId",
    "statement",
    "stance",
    "truthStatus",
    "aboutRefs",
    "evidenceRange",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    characterId: id<"Character">(input.characterId, `${label}.characterId`),
    statement: text(input.statement, `${label}.statement`),
    stance: stance(input.stance, `${label}.stance`),
    truthStatus: truthStatus(input.truthStatus, `${label}.truthStatus`),
    aboutRefs: parseCanonEntityRefList(input.aboutRefs, `${label}.aboutRefs`),
    evidenceRange: evidenceRange(input.evidenceRange, `${label}.evidenceRange`),
  });
}

export function parseUpdateCharacterKnowledgeCommand(
  value: unknown,
): UpdateCharacterKnowledgeCommand {
  const label = "UpdateCharacterKnowledgeCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "knowledgeId",
    "expectedRevision",
    "statement",
    "aboutRefs",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    knowledgeId: id<"CharacterKnowledge">(input.knowledgeId, `${label}.knowledgeId`),
    expectedRevision: revision(input.expectedRevision, `${label}.expectedRevision`),
    statement: text(input.statement, `${label}.statement`),
    aboutRefs: parseCanonEntityRefList(input.aboutRefs, `${label}.aboutRefs`),
  });
}

export function parseSupersedeCharacterKnowledgeCommand(
  value: unknown,
): SupersedeCharacterKnowledgeCommand {
  const label = "SupersedeCharacterKnowledgeCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "knowledgeId",
    "expectedRevision",
    "statement",
    "stance",
    "truthStatus",
    "aboutRefs",
    "evidenceRange",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    knowledgeId: id<"CharacterKnowledge">(input.knowledgeId, `${label}.knowledgeId`),
    expectedRevision: revision(input.expectedRevision, `${label}.expectedRevision`),
    statement: text(input.statement, `${label}.statement`),
    stance: stance(input.stance, `${label}.stance`),
    truthStatus: truthStatus(input.truthStatus, `${label}.truthStatus`),
    aboutRefs: parseCanonEntityRefList(input.aboutRefs, `${label}.aboutRefs`),
    evidenceRange: evidenceRange(input.evidenceRange, `${label}.evidenceRange`),
  });
}

export function parseRetireCharacterKnowledgeCommand(
  value: unknown,
): RetireCharacterKnowledgeCommand {
  const label = "RetireCharacterKnowledgeCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "knowledgeId",
    "expectedRevision",
    "reason",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    knowledgeId: id<"CharacterKnowledge">(input.knowledgeId, `${label}.knowledgeId`),
    expectedRevision: revision(input.expectedRevision, `${label}.expectedRevision`),
    reason: text(input.reason, `${label}.reason`),
  });
}

export function parseListCharacterKnowledgeCommand(
  value: unknown,
): ListCharacterKnowledgeCommand {
  const label = "ListCharacterKnowledgeCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "characterId", "status"], label);
  schema(input, label);
  if (input.status !== "all" && input.status !== "current" && input.status !== "history") {
    throw new Error(`${label}.status is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    characterId: nullableId<"Character">(input.characterId, `${label}.characterId`),
    status: input.status,
  });
}

export function parseProjectPovKnowledgeCommand(
  value: unknown,
): ProjectPovKnowledgeCommand {
  const label = "ProjectPovKnowledgeCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "characterId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    characterId: id<"Character">(input.characterId, `${label}.characterId`),
  });
}

export function parseCharacterKnowledgeProjection(
  value: unknown,
  label = "CharacterKnowledgeProjection",
): CharacterKnowledgeProjection {
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "knowledgeId",
    "revision",
    "workId",
    "characterId",
    "statement",
    "stance",
    "truthStatus",
    "aboutRefs",
    "evidence",
    "status",
    "supersedesKnowledgeId",
    "supersededByKnowledgeId",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  if (input.status !== "active" && input.status !== "superseded" && input.status !== "retired") {
    throw new Error(`${label}.status is unsupported`);
  }
  const knowledgeId = id<"CharacterKnowledge">(input.knowledgeId, `${label}.knowledgeId`);
  const supersedesKnowledgeId = nullableId<"CharacterKnowledge">(
    input.supersedesKnowledgeId,
    `${label}.supersedesKnowledgeId`,
  );
  const supersededByKnowledgeId = nullableId<"CharacterKnowledge">(
    input.supersededByKnowledgeId,
    `${label}.supersededByKnowledgeId`,
  );
  if (knowledgeId === supersedesKnowledgeId || knowledgeId === supersededByKnowledgeId) {
    throw new Error(`${label} cannot supersede itself`);
  }
  if ((input.status === "superseded") !== (supersededByKnowledgeId !== null)) {
    throw new Error(`${label}.status and supersededByKnowledgeId disagree`);
  }
  if (!Array.isArray(input.evidence)) throw new Error(`${label}.evidence must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    knowledgeId,
    revision: revision(input.revision, `${label}.revision`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    characterId: id<"Character">(input.characterId, `${label}.characterId`),
    statement: text(input.statement, `${label}.statement`),
    stance: stance(input.stance, `${label}.stance`),
    truthStatus: truthStatus(input.truthStatus, `${label}.truthStatus`),
    aboutRefs: parseCanonEntityRefList(input.aboutRefs, `${label}.aboutRefs`),
    evidence: Object.freeze(input.evidence.map((entry, index) =>
      parseEvidence(entry, `${label}.evidence[${index}]`)
    )),
    status: input.status,
    supersedesKnowledgeId,
    supersededByKnowledgeId,
    createdAt: instant(input.createdAt, `${label}.createdAt`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseCharacterKnowledgeListProjection(
  value: unknown,
): CharacterKnowledgeListProjection {
  const label = "CharacterKnowledgeListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "entries"], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const entries = parseProjectionList(input.entries, `${label}.entries`);
  if (entries.some((entry) => entry.workId !== workId)) {
    throw new Error(`${label}.entries must belong to the requested Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, entries });
}

export function parsePovKnowledgeContextProjection(
  value: unknown,
): PovKnowledgeContextProjection {
  const label = "PovKnowledgeContextProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "characterId",
    "objectiveFacts",
    "povKnown",
    "povFalseBeliefs",
    "povUnavailable",
  ], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const characterId = id<"Character">(input.characterId, `${label}.characterId`);
  const objectiveFacts = parseProjectionList(input.objectiveFacts, `${label}.objectiveFacts`);
  const povKnown = parseProjectionList(input.povKnown, `${label}.povKnown`);
  const povFalseBeliefs = parseProjectionList(
    input.povFalseBeliefs,
    `${label}.povFalseBeliefs`,
  );
  const povUnavailable = parseProjectionList(input.povUnavailable, `${label}.povUnavailable`);
  const all = [...objectiveFacts, ...povKnown, ...povFalseBeliefs, ...povUnavailable];
  if (all.some((entry) => entry.workId !== workId || entry.status !== "active")) {
    throw new Error(`${label} may contain only active entries from the requested Work`);
  }
  if ([...povKnown, ...povFalseBeliefs, ...povUnavailable]
    .some((entry) => entry.characterId !== characterId)) {
    throw new Error(`${label} POV entries must belong to the requested Character`);
  }
  if (objectiveFacts.some((entry) => entry.truthStatus !== "true")) {
    throw new Error(`${label}.objectiveFacts must be objectively true`);
  }
  if (povKnown.some((entry) => entry.stance !== "knows")) {
    throw new Error(`${label}.povKnown must use knows stance`);
  }
  if (povFalseBeliefs.some((entry) => !(
    (entry.truthStatus === "false" && (entry.stance === "believes" || entry.stance === "suspects")) ||
    (entry.truthStatus === "true" && entry.stance === "denies")
  ))) {
    throw new Error(`${label}.povFalseBeliefs contains a non-false belief`);
  }
  if (povUnavailable.some((entry) => entry.stance !== "unaware")) {
    throw new Error(`${label}.povUnavailable must use unaware stance`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId,
    characterId,
    objectiveFacts,
    povKnown,
    povFalseBeliefs,
    povUnavailable,
  });
}
