import { entityId, type EntityId } from "../../domain/writing";
import type { CharacterProjection } from "./character-contract";
import {
  CHARACTER_EXTRACTION_MERGE_FIELDS,
  type CharacterExtractionDecision,
  type CharacterExtractionMergeField,
} from "./character-extraction-contract";

export const CHARACTER_GENERATION_PROMPT_VERSION =
  "character-generation-v1" as const;

export type CharacterGenerationBrief = {
  readonly role: string;
  readonly personality: string;
  readonly relationships: string;
  readonly genre: string;
};

export type RunCharacterGenerationCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"CharacterGenerationRequest">;
  readonly workId: EntityId<"Work">;
  readonly brief: CharacterGenerationBrief;
};

export type ListCharacterGenerationCandidatesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type CharacterGenerationModelProposal = {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly role: string;
  readonly summary: string;
  readonly appearance: string;
  readonly personality: string;
  readonly speech: string;
  readonly goal: string;
  readonly conflict: string;
  readonly note: string;
};

export type CharacterGenerationModelPayload = {
  readonly characters: readonly CharacterGenerationModelProposal[];
};

export type CharacterGenerationItem = CharacterGenerationModelProposal & {
  readonly itemId: EntityId<"CharacterGenerationItem">;
  readonly matchingCharacterIds: readonly EntityId<"Character">[];
  readonly status: "pending" | "created" | "merged" | "excluded";
  readonly approvedCharacterId: EntityId<"Character"> | null;
};

export type CharacterGenerationCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"CharacterGenerationCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly brief: CharacterGenerationBrief;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof CHARACTER_GENERATION_PROMPT_VERSION;
  readonly status: "ready" | "completed";
  readonly items: readonly CharacterGenerationItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CharacterGenerationCandidateList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidates: readonly CharacterGenerationCandidate[];
};

export type DecideCharacterGenerationItemCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"CharacterGenerationCandidate">;
  readonly expectedCandidateRevision: number;
  readonly itemId: EntityId<"CharacterGenerationItem">;
  readonly decision: CharacterExtractionDecision;
};

export type CharacterGenerationDecisionResult = Readonly<{
  schemaVersion: 1;
  status: "applied";
  candidate: CharacterGenerationCandidate;
  characters: readonly CharacterProjection[];
}>;

export type CharacterGenerationResult =
  | Readonly<{ schemaVersion: 1; status: "login-required" }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: CharacterGenerationCandidate;
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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
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
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function identifier<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function positiveInteger(
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

function instant(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = nonEmptyString(input, field, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}.${field} must be a valid instant`);
  }
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const entries = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be non-empty`);
    }
    return entry.trim();
  });
  if (new Set(entries).size !== entries.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return Object.freeze(entries);
}

function identifierArray<TEntity extends string>(
  value: unknown,
  label: string,
): readonly EntityId<TEntity>[] {
  return Object.freeze(
    stringArray(value, label).map((entry) => entityId<TEntity>(entry)),
  );
}

export function parseCharacterGenerationBrief(
  value: unknown,
  label = "CharacterGenerationBrief",
): CharacterGenerationBrief {
  const input = record(value, label);
  exact(input, ["role", "personality", "relationships", "genre"], label);
  const brief = Object.freeze({
    role: stringValue(input, "role", label).trim(),
    personality: stringValue(input, "personality", label).trim(),
    relationships: stringValue(input, "relationships", label).trim(),
    genre: stringValue(input, "genre", label).trim(),
  });
  if (Object.values(brief).every((entry) => entry.length === 0)) {
    throw new Error(`${label} must contain at least one condition`);
  }
  return brief;
}

function parseModelProposal(
  value: unknown,
  label: string,
): CharacterGenerationModelProposal {
  const input = record(value, label);
  exact(
    input,
    [
      "name",
      "aliases",
      "role",
      "summary",
      "appearance",
      "personality",
      "speech",
      "goal",
      "conflict",
      "note",
    ],
    label,
  );
  return Object.freeze({
    name: nonEmptyString(input, "name", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    role: stringValue(input, "role", label),
    summary: stringValue(input, "summary", label),
    appearance: stringValue(input, "appearance", label),
    personality: stringValue(input, "personality", label),
    speech: stringValue(input, "speech", label),
    goal: stringValue(input, "goal", label),
    conflict: stringValue(input, "conflict", label),
    note: stringValue(input, "note", label),
  });
}

export function parseCharacterGenerationModelPayload(
  value: unknown,
): CharacterGenerationModelPayload {
  const label = "CharacterGenerationModelPayload";
  const input = record(value, label);
  exact(input, ["characters"], label);
  if (!Array.isArray(input.characters)) {
    throw new Error(`${label}.characters must be an array`);
  }
  return Object.freeze({
    characters: Object.freeze(
      input.characters.map((entry, index) =>
        parseModelProposal(entry, `${label}.characters[${index}]`)
      ),
    ),
  });
}

function parseItem(value: unknown, label: string): CharacterGenerationItem {
  const input = record(value, label);
  exact(
    input,
    [
      "itemId",
      "name",
      "aliases",
      "role",
      "summary",
      "appearance",
      "personality",
      "speech",
      "goal",
      "conflict",
      "note",
      "matchingCharacterIds",
      "status",
      "approvedCharacterId",
    ],
    label,
  );
  if (
    input.status !== "pending" &&
    input.status !== "created" &&
    input.status !== "merged" &&
    input.status !== "excluded"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  const approvedCharacterId = input.approvedCharacterId === null
    ? null
    : identifier<"Character">(input, "approvedCharacterId", label);
  if (
    (input.status === "created" || input.status === "merged") !==
    (approvedCharacterId !== null)
  ) {
    throw new Error(`${label}.approvedCharacterId does not match status`);
  }
  return Object.freeze({
    itemId: identifier<"CharacterGenerationItem">(input, "itemId", label),
    name: nonEmptyString(input, "name", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    role: stringValue(input, "role", label),
    summary: stringValue(input, "summary", label),
    appearance: stringValue(input, "appearance", label),
    personality: stringValue(input, "personality", label),
    speech: stringValue(input, "speech", label),
    goal: stringValue(input, "goal", label),
    conflict: stringValue(input, "conflict", label),
    note: stringValue(input, "note", label),
    matchingCharacterIds: identifierArray<"Character">(
      input.matchingCharacterIds,
      `${label}.matchingCharacterIds`,
    ),
    status: input.status,
    approvedCharacterId,
  });
}

export function parseCharacterGenerationCandidate(
  value: unknown,
): CharacterGenerationCandidate {
  const label = "CharacterGenerationCandidate";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "candidateId",
      "revision",
      "workId",
      "brief",
      "providerId",
      "modelId",
      "promptVersion",
      "status",
      "items",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  schema(input, label);
  if (input.promptVersion !== CHARACTER_GENERATION_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  if (input.status !== "ready" && input.status !== "completed") {
    throw new Error(`${label}.status is unsupported`);
  }
  if (!Array.isArray(input.items)) {
    throw new Error(`${label}.items must be an array`);
  }
  const items = Object.freeze(
    input.items.map((entry, index) =>
      parseItem(entry, `${label}.items[${index}]`)
    ),
  );
  if (new Set(items.map((item) => item.itemId)).size !== items.length) {
    throw new Error(`${label}.items contain duplicate identities`);
  }
  if (
    input.status === "completed" &&
    items.some((item) => item.status === "pending")
  ) {
    throw new Error(`${label}.completed Candidate contains pending items`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"CharacterGenerationCandidate">(
      input,
      "candidateId",
      label,
    ),
    revision: positiveInteger(input, "revision", label),
    workId: identifier<"Work">(input, "workId", label),
    brief: parseCharacterGenerationBrief(input.brief, `${label}.brief`),
    providerId: nonEmptyString(input, "providerId", label),
    modelId: nonEmptyString(input, "modelId", label),
    promptVersion: CHARACTER_GENERATION_PROMPT_VERSION,
    status: input.status,
    items,
    createdAt: instant(input, "createdAt", label),
    updatedAt: instant(input, "updatedAt", label),
  });
}

export function parseRunCharacterGenerationCommand(
  value: unknown,
): RunCharacterGenerationCommand {
  const label = "RunCharacterGenerationCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "workId", "brief"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"CharacterGenerationRequest">(
      input,
      "requestId",
      label,
    ),
    workId: identifier<"Work">(input, "workId", label),
    brief: parseCharacterGenerationBrief(input.brief, `${label}.brief`),
  });
}

export function parseListCharacterGenerationCandidatesCommand(
  value: unknown,
): ListCharacterGenerationCandidatesCommand {
  const label = "ListCharacterGenerationCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
  });
}

function parseMergeField(
  value: unknown,
  label: string,
): CharacterExtractionMergeField {
  if (
    typeof value !== "string" ||
    !CHARACTER_EXTRACTION_MERGE_FIELDS.includes(
      value as CharacterExtractionMergeField,
    )
  ) {
    throw new Error(`${label} is unsupported`);
  }
  return value as CharacterExtractionMergeField;
}

function parseDecision(
  value: unknown,
  label: string,
): CharacterExtractionDecision {
  const input = record(value, label);
  if (input.kind === "create" || input.kind === "exclude") {
    exact(input, ["kind"], label);
    return Object.freeze({ kind: input.kind });
  }
  if (input.kind !== "merge") {
    throw new Error(`${label}.kind is unsupported`);
  }
  exact(
    input,
    ["kind", "targetCharacterId", "expectedCharacterRevision", "fields"],
    label,
  );
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    throw new Error(`${label}.fields must be a non-empty array`);
  }
  const fields = Object.freeze(
    input.fields.map((entry, index) =>
      parseMergeField(entry, `${label}.fields[${index}]`)
    ),
  );
  if (new Set(fields).size !== fields.length) {
    throw new Error(`${label}.fields contain duplicates`);
  }
  return Object.freeze({
    kind: "merge",
    targetCharacterId: identifier<"Character">(
      input,
      "targetCharacterId",
      label,
    ),
    expectedCharacterRevision: positiveInteger(
      input,
      "expectedCharacterRevision",
      label,
    ),
    fields,
  });
}

export function parseDecideCharacterGenerationItemCommand(
  value: unknown,
): DecideCharacterGenerationItemCommand {
  const label = "DecideCharacterGenerationItemCommand";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "candidateId",
      "expectedCandidateRevision",
      "itemId",
      "decision",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    candidateId: identifier<"CharacterGenerationCandidate">(
      input,
      "candidateId",
      label,
    ),
    expectedCandidateRevision: positiveInteger(
      input,
      "expectedCandidateRevision",
      label,
    ),
    itemId: identifier<"CharacterGenerationItem">(input, "itemId", label),
    decision: parseDecision(input.decision, `${label}.decision`),
  });
}

export function parseCharacterGenerationCandidateList(
  value: unknown,
): CharacterGenerationCandidateList {
  const label = "CharacterGenerationCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) {
    throw new Error(`${label}.candidates must be an array`);
  }
  const workId = identifier<"Work">(input, "workId", label);
  const candidates = Object.freeze(
    input.candidates.map((entry) => parseCharacterGenerationCandidate(entry)),
  );
  if (candidates.some((candidate) => candidate.workId !== workId)) {
    throw new Error(`${label}.candidates cross the Work boundary`);
  }
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseCharacterGenerationResult(
  value: unknown,
): CharacterGenerationResult {
  const label = "CharacterGenerationResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "login-required") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "login-required" });
  }
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseCharacterGenerationCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseCharacterGenerationDecisionResult(
  value: unknown,
  parseCharacter: (entry: unknown) => CharacterProjection,
): CharacterGenerationDecisionResult {
  const label = "CharacterGenerationDecisionResult";
  const input = record(value, label);
  exact(input, ["schemaVersion", "status", "candidate", "characters"], label);
  schema(input, label);
  if (input.status !== "applied" || !Array.isArray(input.characters)) {
    throw new Error(`${label} is invalid`);
  }
  const candidate = parseCharacterGenerationCandidate(input.candidate);
  const characters = Object.freeze(input.characters.map(parseCharacter));
  if (characters.some((character) => character.workId !== candidate.workId)) {
    throw new Error(`${label}.characters cross the Work boundary`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "applied",
    candidate,
    characters,
  });
}
