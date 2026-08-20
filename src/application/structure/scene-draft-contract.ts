import { entityId, type EntityId } from "../../domain/writing";

export const SCENE_DRAFT_PROMPT_VERSION = "scene-draft-v1" as const;

export type SceneDraftPlotContext = {
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly revision: number;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly note: string;
};

export type SceneDraftEventContext = {
  readonly plotEventLinkId: EntityId<"PlotEventLink">;
  readonly linkRevision: number;
  readonly role: "primary" | "supporting";
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly eventRevision: number;
  readonly title: string;
  readonly note: string;
};

export type SceneDraftCharacterContext = {
  readonly characterId: EntityId<"Character">;
  readonly revision: number;
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

export type SceneDraftSettingContext = {
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly revision: number;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
};

export type SceneDraftContext = {
  readonly plot: SceneDraftPlotContext;
  readonly events: readonly SceneDraftEventContext[];
  readonly characters: readonly SceneDraftCharacterContext[];
  readonly settings: readonly SceneDraftSettingContext[];
};

export type SceneDraftTarget = {
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly insertionOffset: number;
};

export type SceneDraftModelPayload = {
  readonly draftText: string;
};

export type SceneDraftCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"SceneDraftCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly context: SceneDraftContext;
  readonly target: SceneDraftTarget;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof SCENE_DRAFT_PROMPT_VERSION;
  readonly generatedText: string;
  readonly draftText: string;
  readonly status: "ready" | "applied";
  readonly integrity: "current" | "inserted" | "stale";
  readonly appliedDocumentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RunSceneDraftCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"SceneDraftRequest">;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly expectedPlotRevision: number;
  readonly target: SceneDraftTarget;
  readonly characterIds: readonly EntityId<"Character">[];
  readonly settingIds: readonly EntityId<"LoreEntry">[];
};

export type RunSceneDraftResult =
  | Readonly<{ schemaVersion: 1; status: "login-required" }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: SceneDraftCandidate;
    }>;

export type ListSceneDraftCandidatesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SceneDraftCandidateList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidates: readonly SceneDraftCandidate[];
};

export type UpdateSceneDraftCandidateCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"SceneDraftCandidate">;
  readonly expectedCandidateRevision: number;
  readonly draftText: string;
};

export type PrepareSceneDraftInsertionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"SceneDraftCandidate">;
  readonly expectedCandidateRevision: number;
};

export type PrepareSceneDraftInsertionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "authorized";
      candidate: SceneDraftCandidate;
      baseDocumentLength: number;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "already-inserted";
      candidate: SceneDraftCandidate;
      resultDocumentRevisionId: EntityId<"DocumentRevision">;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "stale";
      candidate: SceneDraftCandidate;
    }>;

export type CompleteSceneDraftInsertionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"SceneDraftCandidate">;
  readonly expectedCandidateRevision: number;
  readonly resultDocumentRevisionId: EntityId<"DocumentRevision">;
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
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  return value;
}

function nonEmpty(value: unknown, label: string): string {
  const parsed = stringValue(value, label).trim();
  if (!parsed) throw new Error(`${label} must be non-empty text`);
  return parsed;
}

function nonBlankText(value: unknown, label: string): string {
  const parsed = stringValue(value, label);
  if (!parsed.trim()) throw new Error(`${label} must contain text`);
  return parsed;
}

function identifier<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(value, label));
}

function positive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function offset(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function instant(value: unknown, label: string): string {
  const parsed = nonEmpty(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be an instant`);
  return parsed;
}

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const parsed = value.map((entry, index) => nonEmpty(entry, `${label}[${index}]`));
  if (new Set(parsed).size !== parsed.length) throw new Error(`${label} has duplicates`);
  return Object.freeze(parsed);
}

function ids<TEntity extends string>(
  value: unknown,
  label: string,
): readonly EntityId<TEntity>[] {
  return strings(value, label).map((entry) => entityId<TEntity>(entry));
}

function parseTarget(value: unknown, label: string): SceneDraftTarget {
  const input = record(value, label);
  exact(input, ["documentId", "documentRevisionId", "insertionOffset"], label);
  return Object.freeze({
    documentId: identifier<"Document">(input.documentId, `${label}.documentId`),
    documentRevisionId: identifier<"DocumentRevision">(
      input.documentRevisionId,
      `${label}.documentRevisionId`,
    ),
    insertionOffset: offset(input.insertionOffset, `${label}.insertionOffset`),
  });
}

function parsePlotContext(value: unknown, label: string): SceneDraftPlotContext {
  const input = record(value, label);
  exact(input, [
    "plotThreadId", "revision", "title", "stage", "summary", "note",
  ], label);
  return Object.freeze({
    plotThreadId: identifier<"PlotThread">(
      input.plotThreadId,
      `${label}.plotThreadId`,
    ),
    revision: positive(input.revision, `${label}.revision`),
    title: nonEmpty(input.title, `${label}.title`),
    stage: stringValue(input.stage, `${label}.stage`),
    summary: stringValue(input.summary, `${label}.summary`),
    note: stringValue(input.note, `${label}.note`),
  });
}

function parseEventContext(value: unknown, label: string): SceneDraftEventContext {
  const input = record(value, label);
  exact(input, [
    "plotEventLinkId", "linkRevision", "role", "eventBlockId",
    "eventRevision", "title", "note",
  ], label);
  if (input.role !== "primary" && input.role !== "supporting") {
    throw new Error(`${label}.role is unsupported`);
  }
  return Object.freeze({
    plotEventLinkId: identifier<"PlotEventLink">(
      input.plotEventLinkId,
      `${label}.plotEventLinkId`,
    ),
    linkRevision: positive(input.linkRevision, `${label}.linkRevision`),
    role: input.role,
    eventBlockId: identifier<"EventBlock">(
      input.eventBlockId,
      `${label}.eventBlockId`,
    ),
    eventRevision: positive(input.eventRevision, `${label}.eventRevision`),
    title: nonEmpty(input.title, `${label}.title`),
    note: stringValue(input.note, `${label}.note`),
  });
}

function parseCharacterContext(
  value: unknown,
  label: string,
): SceneDraftCharacterContext {
  const input = record(value, label);
  exact(input, [
    "characterId", "revision", "name", "aliases", "role", "summary",
    "appearance", "personality", "speech", "goal", "conflict", "note",
  ], label);
  return Object.freeze({
    characterId: identifier<"Character">(
      input.characterId,
      `${label}.characterId`,
    ),
    revision: positive(input.revision, `${label}.revision`),
    name: nonEmpty(input.name, `${label}.name`),
    aliases: strings(input.aliases, `${label}.aliases`),
    role: stringValue(input.role, `${label}.role`),
    summary: stringValue(input.summary, `${label}.summary`),
    appearance: stringValue(input.appearance, `${label}.appearance`),
    personality: stringValue(input.personality, `${label}.personality`),
    speech: stringValue(input.speech, `${label}.speech`),
    goal: stringValue(input.goal, `${label}.goal`),
    conflict: stringValue(input.conflict, `${label}.conflict`),
    note: stringValue(input.note, `${label}.note`),
  });
}

function parseSettingContext(
  value: unknown,
  label: string,
): SceneDraftSettingContext {
  const input = record(value, label);
  exact(input, [
    "loreEntryId", "revision", "title", "content", "category", "aliases",
  ], label);
  return Object.freeze({
    loreEntryId: identifier<"LoreEntry">(
      input.loreEntryId,
      `${label}.loreEntryId`,
    ),
    revision: positive(input.revision, `${label}.revision`),
    title: nonEmpty(input.title, `${label}.title`),
    content: stringValue(input.content, `${label}.content`),
    category: stringValue(input.category, `${label}.category`),
    aliases: strings(input.aliases, `${label}.aliases`),
  });
}

function array<T>(
  value: unknown,
  label: string,
  parser: (entry: unknown, label: string) => T,
): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) =>
    parser(entry, `${label}[${index}]`)
  ));
}

function assertUniqueIdentities(
  values: readonly string[],
  label: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} has duplicate identities`);
  }
}

export function parseSceneDraftContext(value: unknown): SceneDraftContext {
  const label = "SceneDraftContext";
  const input = record(value, label);
  exact(input, ["plot", "events", "characters", "settings"], label);
  const events = array(input.events, `${label}.events`, parseEventContext);
  const characters = array(
    input.characters,
    `${label}.characters`,
    parseCharacterContext,
  );
  const settings = array(input.settings, `${label}.settings`, parseSettingContext);
  assertUniqueIdentities(
    events.map((entry) => entry.plotEventLinkId),
    `${label}.events`,
  );
  assertUniqueIdentities(
    characters.map((entry) => entry.characterId),
    `${label}.characters`,
  );
  assertUniqueIdentities(
    settings.map((entry) => entry.loreEntryId),
    `${label}.settings`,
  );
  return Object.freeze({
    plot: parsePlotContext(input.plot, `${label}.plot`),
    events,
    characters,
    settings,
  });
}

export function parseSceneDraftModelPayload(value: unknown): SceneDraftModelPayload {
  const label = "SceneDraftModelPayload";
  const input = record(value, label);
  exact(input, ["draftText"], label);
  return Object.freeze({
    draftText: nonBlankText(input.draftText, `${label}.draftText`),
  });
}

export function parseSceneDraftCandidate(value: unknown): SceneDraftCandidate {
  const label = "SceneDraftCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "candidateId", "revision", "workId", "context",
    "target", "providerId", "modelId", "promptVersion", "generatedText",
    "draftText", "status", "integrity", "appliedDocumentRevisionId",
    "createdAt", "updatedAt",
  ], label);
  schema(input, label);
  if (input.promptVersion !== SCENE_DRAFT_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  if (input.status !== "ready" && input.status !== "applied") {
    throw new Error(`${label}.status is unsupported`);
  }
  if (
    input.integrity !== "current" &&
    input.integrity !== "inserted" &&
    input.integrity !== "stale"
  ) {
    throw new Error(`${label}.integrity is unsupported`);
  }
  const appliedDocumentRevisionId = input.appliedDocumentRevisionId === null
    ? null
    : identifier<"DocumentRevision">(
        input.appliedDocumentRevisionId,
        `${label}.appliedDocumentRevisionId`,
      );
  if ((input.status === "applied") !== (appliedDocumentRevisionId !== null)) {
    throw new Error(`${label}.status does not match applied revision`);
  }
  if (input.status === "applied" && input.integrity !== "current") {
    throw new Error(`${label}.applied Candidate must be current`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"SceneDraftCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    revision: positive(input.revision, `${label}.revision`),
    workId: identifier<"Work">(input.workId, `${label}.workId`),
    context: parseSceneDraftContext(input.context),
    target: parseTarget(input.target, `${label}.target`),
    providerId: nonEmpty(input.providerId, `${label}.providerId`),
    modelId: nonEmpty(input.modelId, `${label}.modelId`),
    promptVersion: SCENE_DRAFT_PROMPT_VERSION,
    generatedText: nonBlankText(input.generatedText, `${label}.generatedText`),
    draftText: nonBlankText(input.draftText, `${label}.draftText`),
    status: input.status,
    integrity: input.integrity,
    appliedDocumentRevisionId,
    createdAt: instant(input.createdAt, `${label}.createdAt`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseRunSceneDraftCommand(value: unknown): RunSceneDraftCommand {
  const label = "RunSceneDraftCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "requestId", "workId", "plotThreadId",
    "expectedPlotRevision", "target", "characterIds", "settingIds",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"SceneDraftRequest">(
      input.requestId,
      `${label}.requestId`,
    ),
    workId: identifier<"Work">(input.workId, `${label}.workId`),
    plotThreadId: identifier<"PlotThread">(
      input.plotThreadId,
      `${label}.plotThreadId`,
    ),
    expectedPlotRevision: positive(
      input.expectedPlotRevision,
      `${label}.expectedPlotRevision`,
    ),
    target: parseTarget(input.target, `${label}.target`),
    characterIds: ids<"Character">(input.characterIds, `${label}.characterIds`),
    settingIds: ids<"LoreEntry">(input.settingIds, `${label}.settingIds`),
  });
}

export function parseRunSceneDraftResult(value: unknown): RunSceneDraftResult {
  const label = "RunSceneDraftResult";
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
      candidate: parseSceneDraftCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseListSceneDraftCandidatesCommand(
  value: unknown,
): ListSceneDraftCandidatesCommand {
  const label = "ListSceneDraftCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input.workId, `${label}.workId`),
  });
}

export function parseSceneDraftCandidateList(
  value: unknown,
): SceneDraftCandidateList {
  const label = "SceneDraftCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  const workId = identifier<"Work">(input.workId, `${label}.workId`);
  const candidates = array(
    input.candidates,
    `${label}.candidates`,
    (entry) => parseSceneDraftCandidate(entry),
  );
  if (candidates.some((candidate) => candidate.workId !== workId)) {
    throw new Error(`${label}.candidates cross the Work boundary`);
  }
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseUpdateSceneDraftCandidateCommand(
  value: unknown,
): UpdateSceneDraftCandidateCommand {
  const label = "UpdateSceneDraftCandidateCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "workId", "candidateId", "expectedCandidateRevision",
    "draftText",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input.workId, `${label}.workId`),
    candidateId: identifier<"SceneDraftCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    expectedCandidateRevision: positive(
      input.expectedCandidateRevision,
      `${label}.expectedCandidateRevision`,
    ),
    draftText: nonBlankText(input.draftText, `${label}.draftText`),
  });
}

export function parsePrepareSceneDraftInsertionCommand(
  value: unknown,
): PrepareSceneDraftInsertionCommand {
  const label = "PrepareSceneDraftInsertionCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "workId", "candidateId", "expectedCandidateRevision",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input.workId, `${label}.workId`),
    candidateId: identifier<"SceneDraftCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    expectedCandidateRevision: positive(
      input.expectedCandidateRevision,
      `${label}.expectedCandidateRevision`,
    ),
  });
}

export function parsePrepareSceneDraftInsertionResult(
  value: unknown,
): PrepareSceneDraftInsertionResult {
  const label = "PrepareSceneDraftInsertionResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "authorized") {
    exact(input, [
      "schemaVersion", "status", "candidate", "baseDocumentLength",
    ], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "authorized",
      candidate: parseSceneDraftCandidate(input.candidate),
      baseDocumentLength: offset(
        input.baseDocumentLength,
        `${label}.baseDocumentLength`,
      ),
    });
  }
  if (input.status === "already-inserted") {
    exact(input, [
      "schemaVersion", "status", "candidate", "resultDocumentRevisionId",
    ], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "already-inserted",
      candidate: parseSceneDraftCandidate(input.candidate),
      resultDocumentRevisionId: identifier<"DocumentRevision">(
        input.resultDocumentRevisionId,
        `${label}.resultDocumentRevisionId`,
      ),
    });
  }
  if (input.status === "stale") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "stale",
      candidate: parseSceneDraftCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseCompleteSceneDraftInsertionCommand(
  value: unknown,
): CompleteSceneDraftInsertionCommand {
  const label = "CompleteSceneDraftInsertionCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "workId", "candidateId", "expectedCandidateRevision",
    "resultDocumentRevisionId",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input.workId, `${label}.workId`),
    candidateId: identifier<"SceneDraftCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    expectedCandidateRevision: positive(
      input.expectedCandidateRevision,
      `${label}.expectedCandidateRevision`,
    ),
    resultDocumentRevisionId: identifier<"DocumentRevision">(
      input.resultDocumentRevisionId,
      `${label}.resultDocumentRevisionId`,
    ),
  });
}
