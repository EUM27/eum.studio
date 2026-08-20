import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import type { CharacterProjection } from "./character-contract";

export const CHARACTER_EXTRACTION_PROMPT_VERSION =
  "character-extraction-v1" as const;

export const CHARACTER_EXTRACTION_MERGE_FIELDS = [
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
] as const;

export type CharacterExtractionMergeField =
  (typeof CHARACTER_EXTRACTION_MERGE_FIELDS)[number];

export type RunCharacterExtractionCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"CharacterExtractionRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly sourceRange: AssistantContextRange;
};

export type ListCharacterExtractionCandidatesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type CharacterExtractionEvidence = {
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly from: number;
  readonly to: number;
  readonly exactText: string;
};

export type CharacterExtractionItem = {
  readonly itemId: EntityId<"CharacterExtractionItem">;
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
  readonly evidences: readonly CharacterExtractionEvidence[];
  readonly matchingCharacterIds: readonly EntityId<"Character">[];
  readonly status: "pending" | "created" | "merged" | "excluded";
  readonly approvedCharacterId: EntityId<"Character"> | null;
};

export type CharacterExtractionCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"CharacterExtractionCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceRange: AssistantContextRange;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof CHARACTER_EXTRACTION_PROMPT_VERSION;
  readonly status: "ready" | "stale" | "completed";
  readonly items: readonly CharacterExtractionItem[];
  readonly contextReceiptId: EntityId<"AssistantContextReceipt">;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CharacterExtractionCandidateList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidates: readonly CharacterExtractionCandidate[];
};

export type CharacterExtractionDecision =
  | Readonly<{ kind: "create" }>
  | Readonly<{
      kind: "merge";
      targetCharacterId: EntityId<"Character">;
      expectedCharacterRevision: number;
      fields: readonly CharacterExtractionMergeField[];
    }>
  | Readonly<{ kind: "exclude" }>;

export type DecideCharacterExtractionItemCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"CharacterExtractionCandidate">;
  readonly expectedCandidateRevision: number;
  readonly itemId: EntityId<"CharacterExtractionItem">;
  readonly decision: CharacterExtractionDecision;
};

export type CharacterExtractionDecisionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "applied";
      candidate: CharacterExtractionCandidate;
      characters: readonly CharacterProjection[];
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "stale";
      candidate: CharacterExtractionCandidate;
    }>;

export type CharacterExtractionResult =
  | Readonly<{ schemaVersion: 1; status: "login-required" }>
  | Readonly<{
      schemaVersion: 1;
      status: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
      destinationId: string;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "context-rejected";
      reason:
        | "source-unavailable"
        | "outside-work"
        | "stale-context"
        | "invalid-range";
      documentId: EntityId<"Document">;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: CharacterExtractionCandidate;
    }>;

export type CharacterExtractionParagraph = {
  readonly paragraphId: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
};

export type CharacterExtractionModelProposal = {
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
  readonly evidences: readonly Readonly<{
    paragraphId: string;
    quote: string;
  }>[];
};

export type CharacterExtractionModelPayload = {
  readonly characters: readonly CharacterExtractionModelProposal[];
};

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

function nonNegativeInteger(
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

function parseEvidence(
  value: unknown,
  label: string,
): CharacterExtractionEvidence {
  const input = record(value, label);
  exact(
    input,
    ["documentId", "documentRevisionId", "from", "to", "exactText"],
    label,
  );
  const from = nonNegativeInteger(input, "from", label);
  const to = nonNegativeInteger(input, "to", label);
  if (to <= from) {
    throw new Error(`${label} must be non-empty`);
  }
  return Object.freeze({
    documentId: identifier<"Document">(input, "documentId", label),
    documentRevisionId: identifier<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    from,
    to,
    exactText: nonEmptyString(input, "exactText", label),
  });
}

function parseItem(
  value: unknown,
  label: string,
): CharacterExtractionItem {
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
      "evidences",
      "matchingCharacterIds",
      "status",
      "approvedCharacterId",
    ],
    label,
  );
  if (!Array.isArray(input.evidences)) {
    throw new Error(`${label}.evidences must be an array`);
  }
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
    itemId: identifier<"CharacterExtractionItem">(input, "itemId", label),
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
    evidences: Object.freeze(
      input.evidences.map((entry, index) =>
        parseEvidence(entry, `${label}.evidences[${index}]`)
      ),
    ),
    matchingCharacterIds: identifierArray<"Character">(
      input.matchingCharacterIds,
      `${label}.matchingCharacterIds`,
    ),
    status: input.status,
    approvedCharacterId,
  });
}

export function parseCharacterExtractionCandidate(
  value: unknown,
): CharacterExtractionCandidate {
  const label = "CharacterExtractionCandidate";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "candidateId",
      "revision",
      "workId",
      "sourceRange",
      "providerId",
      "modelId",
      "promptVersion",
      "status",
      "items",
      "contextReceiptId",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  schema(input, label);
  if (
    input.status !== "ready" &&
    input.status !== "stale" &&
    input.status !== "completed"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  if (input.promptVersion !== CHARACTER_EXTRACTION_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
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
    candidateId: identifier<"CharacterExtractionCandidate">(
      input,
      "candidateId",
      label,
    ),
    revision: positiveInteger(input, "revision", label),
    workId: identifier<"Work">(input, "workId", label),
    sourceRange: parseAssistantContextRange(
      input.sourceRange,
      `${label}.sourceRange`,
    ),
    providerId: nonEmptyString(input, "providerId", label),
    modelId: nonEmptyString(input, "modelId", label),
    promptVersion: CHARACTER_EXTRACTION_PROMPT_VERSION,
    status: input.status,
    items,
    contextReceiptId: identifier<"AssistantContextReceipt">(
      input,
      "contextReceiptId",
      label,
    ),
    createdAt: instant(input, "createdAt", label),
    updatedAt: instant(input, "updatedAt", label),
  });
}

export function parseRunCharacterExtractionCommand(
  value: unknown,
): RunCharacterExtractionCommand {
  const label = "RunCharacterExtractionCommand";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "requestId",
      "workId",
      "conversationId",
      "sourceRange",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"CharacterExtractionRequest">(
      input,
      "requestId",
      label,
    ),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    sourceRange: parseAssistantContextRange(
      input.sourceRange,
      `${label}.sourceRange`,
    ),
  });
}

export function parseListCharacterExtractionCandidatesCommand(
  value: unknown,
): ListCharacterExtractionCandidatesCommand {
  const label = "ListCharacterExtractionCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
  });
}

function parseMergeField(value: unknown, label: string) {
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

export function parseDecideCharacterExtractionItemCommand(
  value: unknown,
): DecideCharacterExtractionItemCommand {
  const label = "DecideCharacterExtractionItemCommand";
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
    candidateId: identifier<"CharacterExtractionCandidate">(
      input,
      "candidateId",
      label,
    ),
    expectedCandidateRevision: positiveInteger(
      input,
      "expectedCandidateRevision",
      label,
    ),
    itemId: identifier<"CharacterExtractionItem">(
      input,
      "itemId",
      label,
    ),
    decision: parseDecision(input.decision, `${label}.decision`),
  });
}

export function parseCharacterExtractionCandidateList(
  value: unknown,
): CharacterExtractionCandidateList {
  const label = "CharacterExtractionCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) {
    throw new Error(`${label}.candidates must be an array`);
  }
  const workId = identifier<"Work">(input, "workId", label);
  const candidates = Object.freeze(
    input.candidates.map((entry) => parseCharacterExtractionCandidate(entry)),
  );
  if (candidates.some((candidate) => candidate.workId !== workId)) {
    throw new Error(`${label}.candidates cross the Work boundary`);
  }
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseCharacterExtractionResult(
  value: unknown,
): CharacterExtractionResult {
  const label = "CharacterExtractionResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "login-required") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "login-required" });
  }
  if (input.status === "permission-required") {
    exact(
      input,
      ["schemaVersion", "status", "missing", "destinationId"],
      label,
    );
    if (!Array.isArray(input.missing)) {
      throw new Error(`${label}.missing must be an array`);
    }
    const missing = Object.freeze(input.missing.map((entry) => {
      if (entry !== "local-read" && entry !== "external-transmit") {
        throw new Error(`${label}.missing contains an unsupported value`);
      }
      return entry;
    }));
    return Object.freeze({
      schemaVersion: 1,
      status: "permission-required",
      missing,
      destinationId: nonEmptyString(input, "destinationId", label),
    });
  }
  if (input.status === "context-rejected") {
    exact(
      input,
      ["schemaVersion", "status", "reason", "documentId"],
      label,
    );
    if (
      input.reason !== "source-unavailable" &&
      input.reason !== "outside-work" &&
      input.reason !== "stale-context" &&
      input.reason !== "invalid-range"
    ) {
      throw new Error(`${label}.reason is unsupported`);
    }
    return Object.freeze({
      schemaVersion: 1,
      status: "context-rejected",
      reason: input.reason,
      documentId: identifier<"Document">(input, "documentId", label),
    });
  }
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseCharacterExtractionCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseCharacterExtractionDecisionResult(
  value: unknown,
  parseCharacter: (value: unknown) => CharacterProjection,
): CharacterExtractionDecisionResult {
  const label = "CharacterExtractionDecisionResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "stale") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    const candidate = parseCharacterExtractionCandidate(input.candidate);
    if (candidate.status !== "stale") {
      throw new Error(`${label}.stale result has a non-stale Candidate`);
    }
    return Object.freeze({ schemaVersion: 1, status: "stale", candidate });
  }
  if (input.status !== "applied") {
    throw new Error(`${label}.status is unsupported`);
  }
  exact(
    input,
    ["schemaVersion", "status", "candidate", "characters"],
    label,
  );
  if (!Array.isArray(input.characters)) {
    throw new Error(`${label}.characters must be an array`);
  }
  const candidate = parseCharacterExtractionCandidate(input.candidate);
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

function parseModelEvidence(
  value: unknown,
  label: string,
): CharacterExtractionModelProposal["evidences"][number] {
  const input = record(value, label);
  exact(input, ["paragraphId", "quote"], label);
  return Object.freeze({
    paragraphId: nonEmptyString(input, "paragraphId", label),
    quote: nonEmptyString(input, "quote", label),
  });
}

function parseModelProposal(
  value: unknown,
  label: string,
): CharacterExtractionModelProposal {
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
      "evidences",
    ],
    label,
  );
  if (!Array.isArray(input.evidences) || input.evidences.length === 0) {
    throw new Error(`${label}.evidences must be a non-empty array`);
  }
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
    evidences: Object.freeze(
      input.evidences.map((entry, index) =>
        parseModelEvidence(entry, `${label}.evidences[${index}]`)
      ),
    ),
  });
}

export function parseCharacterExtractionModelPayload(
  value: unknown,
): CharacterExtractionModelPayload {
  const label = "CharacterExtractionModelPayload";
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

export function createCharacterExtractionParagraphs(input: {
  readonly sourceRange: AssistantContextRange;
  readonly manuscript: string;
}): readonly CharacterExtractionParagraph[] {
  const paragraphs: CharacterExtractionParagraph[] = [];
  const pattern = /[^\n]*(?:\n|$)/gu;
  let index = 0;
  for (const match of input.manuscript.matchAll(pattern)) {
    const text = match[0]?.endsWith("\n")
      ? match[0].slice(0, -1)
      : (match[0] ?? "");
    if (text.length === 0 && match.index === input.manuscript.length) break;
    const relativeFrom = match.index ?? 0;
    const relativeTo = relativeFrom + text.length;
    paragraphs.push(Object.freeze({
      paragraphId: `p${index + 1}`,
      from: input.sourceRange.from + relativeFrom,
      to: input.sourceRange.from + relativeTo,
      text,
    }));
    index += 1;
  }
  return Object.freeze(paragraphs);
}

export function resolveCharacterExtractionEvidences(input: {
  readonly sourceRange: AssistantContextRange;
  readonly paragraphs: readonly CharacterExtractionParagraph[];
  readonly proposal: CharacterExtractionModelProposal;
}): readonly CharacterExtractionEvidence[] {
  const evidences = input.proposal.evidences.map((evidence, index) => {
    const paragraph = input.paragraphs.find(
      (entry) => entry.paragraphId === evidence.paragraphId,
    );
    if (paragraph === undefined) {
      throw new Error(
        `Character evidence[${index}] references an unknown paragraph`,
      );
    }
    const first = paragraph.text.indexOf(evidence.quote);
    const last = paragraph.text.lastIndexOf(evidence.quote);
    if (first < 0 || first !== last) {
      throw new Error(
        `Character evidence[${index}] quote is not uniquely present`,
      );
    }
    return Object.freeze({
      documentId: input.sourceRange.documentId,
      documentRevisionId: input.sourceRange.documentRevisionId,
      from: paragraph.from + first,
      to: paragraph.from + first + evidence.quote.length,
      exactText: evidence.quote,
    });
  });
  const identities = evidences.map((evidence) =>
    `${evidence.documentId}\u001f${evidence.from}\u001f${evidence.to}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("Character evidences contain duplicate exact ranges");
  }
  return Object.freeze(evidences);
}
