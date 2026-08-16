import { entityId, type EntityId } from "../../domain/writing";

export type LoreEvidenceSelection = {
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactText: string;
};

export type CreateLoreEntryCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly evidence: LoreEvidenceSelection | null;
};

export type ListLoreEntriesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdateLoreEntryCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly title?: string;
    readonly content?: string;
    readonly category?: string;
    readonly aliases?: readonly string[];
    readonly enabled?: boolean;
  };
};

export type AddLoreEntryEvidenceCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly expectedRevision: number;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactText: string;
};

export type RetireLoreEntryCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly expectedRevision: number;
};

export type LoreEntryEvidenceProjection = {
  readonly anchorId: EntityId<"Anchor">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly exactText: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: { readonly from: number; readonly to: number } | null;
  readonly createdAt: string;
};

export type LoreEntryHistoryProjection = {
  readonly historyId: EntityId<"LoreEntryHistory">;
  readonly entryRevision: number;
  readonly changeKind: "created" | "updated" | "evidence-added" | "retired";
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly evidenceAnchorIds: readonly EntityId<"Anchor">[];
  readonly changedAt: string;
};

export type LoreEntryProjection = {
  readonly schemaVersion: 1;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly evidences: readonly LoreEntryEvidenceProjection[];
  readonly history: readonly LoreEntryHistoryProjection[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type LoreEntryListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly entries: readonly LoreEntryProjection[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
  for (const field of fields) {
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
  }
}

function optionalFields(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
}

function stringValue(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function trimmedNonEmptyString(input: Record<string, unknown>, field: string, label: string): string {
  const value = stringValue(input, field, label).trim();
  if (!value) throw new Error(`${label}.${field} must be a non-empty string`);
  return value;
}

function id<TEntity extends string>(input: Record<string, unknown>, field: string, label: string): EntityId<TEntity> {
  return entityId<TEntity>(trimmedNonEmptyString(input, field, label));
}

function positiveRevision(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function offset(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function booleanValue(input: Record<string, unknown>, field: string, label: string): boolean {
  const value = input[field];
  if (typeof value !== "boolean") throw new Error(`${label}.${field} must be a boolean`);
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return entry;
  }));
}

function parseSelection(value: unknown, label: string): { readonly anchor: number; readonly head: number } {
  const input = record(value, label);
  exactFields(input, ["anchor", "head"], label);
  const anchor = offset(input, "anchor", label);
  const head = offset(input, "head", label);
  if (anchor === head) throw new Error(`${label} must not be empty`);
  return Object.freeze({ anchor, head });
}

function parseEvidence(value: unknown, label: string): LoreEvidenceSelection {
  const input = record(value, label);
  exactFields(input, ["documentId", "selection", "exactText"], label);
  const selection = parseSelection(input.selection, `${label} selection`);
  const exactText = stringValue(input, "exactText", label);
  if (!exactText) throw new Error(`${label} exactText must not be empty`);
  return Object.freeze({
    documentId: id<"Document">(input, "documentId", label),
    selection,
    exactText,
  });
}

export function parseCreateLoreEntryCommand(value: unknown): CreateLoreEntryCommand {
  const label = "CreateLoreEntryCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "title", "content", "category", "aliases", "enabled", "evidence"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    title: trimmedNonEmptyString(input, "title", label),
    content: stringValue(input, "content", label),
    category: stringValue(input, "category", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    enabled: booleanValue(input, "enabled", label),
    evidence: input.evidence === null ? null : parseEvidence(input.evidence, `${label}.evidence`),
  });
}

export function parseListLoreEntriesCommand(value: unknown): ListLoreEntriesCommand {
  const label = "ListLoreEntriesCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1, workId: id<"Work">(input, "workId", label) });
}

export function parseUpdateLoreEntryCommand(value: unknown): UpdateLoreEntryCommand {
  const label = "UpdateLoreEntryCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "loreEntryId", "expectedRevision", "changes"], label);
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(changesInput, ["title", "content", "category", "aliases", "enabled"], changesLabel);
  if (Object.keys(changesInput).length === 0) throw new Error(`${changesLabel} must contain at least one field`);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
    expectedRevision: positiveRevision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changesInput, "title") ? { title: trimmedNonEmptyString(changesInput, "title", changesLabel) } : {}),
      ...(Object.hasOwn(changesInput, "content") ? { content: stringValue(changesInput, "content", changesLabel) } : {}),
      ...(Object.hasOwn(changesInput, "category") ? { category: stringValue(changesInput, "category", changesLabel) } : {}),
      ...(Object.hasOwn(changesInput, "aliases") ? { aliases: stringArray(changesInput.aliases, `${changesLabel}.aliases`) } : {}),
      ...(Object.hasOwn(changesInput, "enabled") ? { enabled: booleanValue(changesInput, "enabled", changesLabel) } : {}),
    }),
  });
}

export function parseAddLoreEntryEvidenceCommand(value: unknown): AddLoreEntryEvidenceCommand {
  const label = "AddLoreEntryEvidenceCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "loreEntryId", "expectedRevision", "documentId", "selection", "exactText"], label);
  schema(input, label);
  const selection = parseSelection(input.selection, `${label}.selection`);
  const exactText = stringValue(input, "exactText", label);
  if (!exactText) throw new Error(`${label}.exactText must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
    expectedRevision: positiveRevision(input, "expectedRevision", label),
    documentId: id<"Document">(input, "documentId", label),
    selection,
    exactText,
  });
}

export function parseRetireLoreEntryCommand(value: unknown): RetireLoreEntryCommand {
  const label = "RetireLoreEntryCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "loreEntryId", "expectedRevision"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
    expectedRevision: positiveRevision(input, "expectedRevision", label),
  });
}

function nullableRange(value: unknown, label: string): { readonly from: number; readonly to: number } | null {
  if (value === null) return null;
  const input = record(value, label);
  exactFields(input, ["from", "to"], label);
  const from = offset(input, "from", label);
  const to = offset(input, "to", label);
  if (to < from) throw new Error(`${label}.to must not precede from`);
  return Object.freeze({ from, to });
}

function parseEvidenceProjection(value: unknown): LoreEntryEvidenceProjection {
  const label = "LoreEntryEvidenceProjection";
  const input = record(value, label);
  exactFields(input, ["anchorId", "sourceDocumentId", "sourceDocumentRevisionId", "exactText", "integrity", "range", "createdAt"], label);
  const integrity = input.integrity;
  if (integrity !== "resolved" && integrity !== "needsReview" && integrity !== "broken") {
    throw new Error(`${label}.integrity is invalid`);
  }
  return Object.freeze({
    anchorId: id<"Anchor">(input, "anchorId", label),
    sourceDocumentId: id<"Document">(input, "sourceDocumentId", label),
    sourceDocumentRevisionId: id<"DocumentRevision">(input, "sourceDocumentRevisionId", label),
    exactText: stringValue(input, "exactText", label),
    integrity,
    range: nullableRange(input.range, `${label}.range`),
    createdAt: trimmedNonEmptyString(input, "createdAt", label),
  });
}

function parseHistoryProjection(value: unknown): LoreEntryHistoryProjection {
  const label = "LoreEntryHistoryProjection";
  const input = record(value, label);
  exactFields(input, ["historyId", "entryRevision", "changeKind", "title", "content", "category", "aliases", "enabled", "evidenceAnchorIds", "changedAt"], label);
  const changeKind = input.changeKind;
  if (changeKind !== "created" && changeKind !== "updated" && changeKind !== "evidence-added" && changeKind !== "retired") {
    throw new Error(`${label}.changeKind is invalid`);
  }
  return Object.freeze({
    historyId: id<"LoreEntryHistory">(input, "historyId", label),
    entryRevision: positiveRevision(input, "entryRevision", label),
    changeKind,
    title: trimmedNonEmptyString(input, "title", label),
    content: stringValue(input, "content", label),
    category: stringValue(input, "category", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    enabled: booleanValue(input, "enabled", label),
    evidenceAnchorIds: Object.freeze(stringArray(input.evidenceAnchorIds, `${label}.evidenceAnchorIds`).map((entry) => entityId<"Anchor">(entry))),
    changedAt: trimmedNonEmptyString(input, "changedAt", label),
  });
}

export function parseLoreEntryProjection(value: unknown): LoreEntryProjection {
  const label = "LoreEntryProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "loreEntryId", "revision", "workId", "title", "content", "category", "aliases", "enabled", "evidences", "history", "createdAt", "updatedAt", "retiredAt"], label);
  schema(input, label);
  if (!Array.isArray(input.evidences) || !Array.isArray(input.history)) throw new Error(`${label} collections must be arrays`);
  if (input.retiredAt !== null && typeof input.retiredAt !== "string") throw new Error(`${label}.retiredAt must be a string or null`);
  return Object.freeze({
    schemaVersion: 1,
    loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
    revision: positiveRevision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    title: trimmedNonEmptyString(input, "title", label),
    content: stringValue(input, "content", label),
    category: stringValue(input, "category", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    enabled: booleanValue(input, "enabled", label),
    evidences: Object.freeze(input.evidences.map(parseEvidenceProjection)),
    history: Object.freeze(input.history.map(parseHistoryProjection)),
    createdAt: trimmedNonEmptyString(input, "createdAt", label),
    updatedAt: trimmedNonEmptyString(input, "updatedAt", label),
    retiredAt: input.retiredAt,
  });
}

export function parseLoreEntryListProjection(value: unknown): LoreEntryListProjection {
  const label = "LoreEntryListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "entries"], label);
  schema(input, label);
  if (!Array.isArray(input.entries)) throw new Error(`${label}.entries must be an array`);
  const workId = id<"Work">(input, "workId", label);
  const entries = Object.freeze(input.entries.map((entry, index) => {
    const projection = parseLoreEntryProjection(entry);
    if (projection.workId !== workId) throw new Error(`${label}.entries[${index}] is outside Work ${workId}`);
    return projection;
  }));
  return Object.freeze({ schemaVersion: 1, workId, entries });
}
