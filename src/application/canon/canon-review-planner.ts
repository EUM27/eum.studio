import { entityId } from "../../domain/writing";
import type { AssistantContextRange } from "../assistant/assistant-context-permission";
import {
  CANON_CHARACTER_FIELDS,
  CANON_CHARACTER_RELATION_FIELDS,
  CANON_LORE_ENTRY_FIELDS,
  type CanonFieldChange,
  type CanonFieldName,
  type CanonFieldValue,
  type CanonReviewItem,
  type CanonReviewTarget,
  type CanonReviewTargetSelection,
  type CanonTargetKind,
} from "./canon-review-contract";
import {
  createCanonReviewParagraphs,
  resolveCanonReviewEvidence,
  type CanonReviewModelPayload,
  type CanonReviewModelProposal,
} from "./canon-review-model-output";

export type CanonCharacterSourceSnapshot = Readonly<{
  kind: "character";
  id: string;
  revision: number;
  workId: string;
  retiredAt: string | null;
  fields: Readonly<{
    name: string;
    aliases: readonly string[];
    role: string;
    summary: string;
    appearance: string;
    personality: string;
    speech: string;
    goal: string;
    conflict: string;
    note: string;
  }>;
}>;

export type CanonCharacterRelationSourceSnapshot = Readonly<{
  kind: "character-relation";
  id: string;
  revision: number;
  workId: string;
  retiredAt: string | null;
  fields: Readonly<{
    fromCharacterId: string;
    toCharacterId: string;
    kind: string;
    description: string;
  }>;
}>;

export type CanonLoreEntrySourceSnapshot = Readonly<{
  kind: "lore-entry";
  id: string;
  revision: number;
  workId: string;
  retiredAt: string | null;
  fields: Readonly<{
    title: string;
    content: string;
    category: string;
    aliases: readonly string[];
    enabled: boolean;
  }>;
}>;

export type CanonReviewSourceSnapshot =
  | CanonCharacterSourceSnapshot
  | CanonCharacterRelationSourceSnapshot
  | CanonLoreEntrySourceSnapshot;

export type CanonPendingFieldChange = Readonly<{
  sourceDocumentRevisionId: string;
  targetKind: CanonTargetKind;
  targetIdentity: string;
  field: CanonFieldName;
  after: CanonFieldValue;
}>;

function fieldsForKind(kind: CanonTargetKind): readonly CanonFieldName[] {
  if (kind === "character") return CANON_CHARACTER_FIELDS;
  if (kind === "character-relation") return CANON_CHARACTER_RELATION_FIELDS;
  return CANON_LORE_ENTRY_FIELDS;
}

function updateTargetId(target: CanonReviewTarget): string | null {
  if (target.operation !== "update") return null;
  if (target.kind === "character") return target.characterId;
  if (target.kind === "character-relation") return target.relationId;
  return target.loreEntryId;
}

export function canonReviewTargetIdentity(
  target: CanonReviewTarget,
  targetHint: string,
): string {
  const id = updateTargetId(target);
  return id ?? `${target.operation}:${targetHint}`;
}

export function canonFieldValuesEqual(
  left: CanonFieldValue,
  right: CanonFieldValue,
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => entry === right[index]);
  }
  return left === right;
}

function snapshotField(
  source: CanonReviewSourceSnapshot,
  field: CanonFieldName,
): CanonFieldValue {
  if (!Object.hasOwn(source.fields, field)) {
    throw new Error(`Canon field ${field} is unavailable on ${source.kind}`);
  }
  return source.fields[field as keyof typeof source.fields] as CanonFieldValue;
}

function activeSources(
  workId: string,
  sources: readonly CanonReviewSourceSnapshot[],
): readonly CanonReviewSourceSnapshot[] {
  for (const source of sources) {
    if (source.workId !== workId) {
      throw new Error(`Canon source crosses the Work boundary: ${source.id}`);
    }
    if (!Number.isSafeInteger(source.revision) || source.revision < 1) {
      throw new Error(`Canon source revision is invalid: ${source.id}`);
    }
  }
  if (new Set(sources.map((source) => `${source.kind}:${source.id}`)).size !== sources.length) {
    throw new Error("Canon source identities contain duplicates");
  }
  return Object.freeze(sources.filter((source) => source.retiredAt === null));
}

function matchCharacters(
  proposal: CanonReviewModelProposal,
  sources: readonly CanonReviewSourceSnapshot[],
): readonly CanonCharacterSourceSnapshot[] {
  return Object.freeze(sources.filter(
    (source): source is CanonCharacterSourceSnapshot =>
      source.kind === "character" &&
      [source.fields.name, ...source.fields.aliases].includes(proposal.targetHint),
  ).sort((left, right) => left.id.localeCompare(right.id)));
}

function matchLoreEntries(
  proposal: CanonReviewModelProposal,
  sources: readonly CanonReviewSourceSnapshot[],
): readonly CanonLoreEntrySourceSnapshot[] {
  return Object.freeze(sources.filter(
    (source): source is CanonLoreEntrySourceSnapshot =>
      source.kind === "lore-entry" &&
      [source.fields.title, ...source.fields.aliases].includes(proposal.targetHint),
  ).sort((left, right) => left.id.localeCompare(right.id)));
}

function matchRelations(
  proposal: CanonReviewModelProposal,
  sources: readonly CanonReviewSourceSnapshot[],
): readonly CanonCharacterRelationSourceSnapshot[] {
  const relations = sources.filter(
    (source): source is CanonCharacterRelationSourceSnapshot =>
      source.kind === "character-relation",
  );
  const from = proposal.fields.fromCharacterId;
  const to = proposal.fields.toCharacterId;
  const endpointMatches = relations.filter((relation) =>
    (typeof from !== "string" || relation.fields.fromCharacterId === from) &&
    (typeof to !== "string" || relation.fields.toCharacterId === to)
  );
  const hinted = endpointMatches.filter((relation) =>
    [relation.id, relation.fields.kind, relation.fields.description].includes(
      proposal.targetHint,
    )
  );
  const matches = hinted.length > 0
    ? hinted
    : typeof from === "string" || typeof to === "string"
      ? endpointMatches
      : relations.filter((relation) =>
          [relation.id, relation.fields.kind, relation.fields.description]
            .includes(proposal.targetHint)
        );
  return Object.freeze(matches.sort((left, right) =>
    left.id.localeCompare(right.id)
  ));
}

function matchingSources(
  proposal: CanonReviewModelProposal,
  sources: readonly CanonReviewSourceSnapshot[],
) {
  if (proposal.targetKind === "character") {
    return matchCharacters(proposal, sources);
  }
  if (proposal.targetKind === "character-relation") {
    return matchRelations(proposal, sources);
  }
  return matchLoreEntries(proposal, sources);
}

function targetForProposal(
  proposal: CanonReviewModelProposal,
  matches: readonly CanonReviewSourceSnapshot[],
): CanonReviewTarget {
  if (proposal.operationHint === "create" && matches.length === 0) {
    return Object.freeze({ kind: proposal.targetKind, operation: "create" }) as CanonReviewTarget;
  }
  if (proposal.operationHint !== "create" && matches.length === 1) {
    const source = matches[0]!;
    if (source.kind === "character") {
      return Object.freeze({
        kind: source.kind,
        operation: "update",
        characterId: entityId<"Character">(source.id),
        expectedRevision: source.revision,
      });
    }
    if (source.kind === "character-relation") {
      return Object.freeze({
        kind: source.kind,
        operation: "update",
        relationId: entityId<"CharacterRelation">(source.id),
        expectedRevision: source.revision,
      });
    }
    return Object.freeze({
      kind: source.kind,
      operation: "update",
      loreEntryId: entityId<"LoreEntry">(source.id),
      expectedRevision: source.revision,
    });
  }
  const ids = Object.freeze(matches.map((source) => entityId(source.id)));
  return Object.freeze({
    kind: proposal.targetKind,
    operation: "unresolved",
    matchingTargetIds: ids,
  }) as CanonReviewTarget;
}

function proposalFieldChanges(
  proposal: CanonReviewModelProposal,
  target: CanonReviewTarget,
  matches: readonly CanonReviewSourceSnapshot[],
): readonly CanonFieldChange[] {
  const source = target.operation === "update" ? matches[0] : undefined;
  const changes: CanonFieldChange[] = [];
  for (const field of fieldsForKind(proposal.targetKind)) {
    if (!Object.hasOwn(proposal.fields, field)) continue;
    const after = proposal.fields[field]!;
    if (source !== undefined) {
      const before = snapshotField(source, field);
      if (canonFieldValuesEqual(before, after)) continue;
      changes.push(Object.freeze({ field, before, after, selected: true }));
    } else {
      changes.push(Object.freeze({ field, before: null, after, selected: true }));
    }
  }
  return Object.freeze(changes);
}

function assertRelationEndpoints(
  proposal: CanonReviewModelProposal,
  sources: readonly CanonReviewSourceSnapshot[],
): void {
  if (proposal.targetKind !== "character-relation") return;
  const activeCharacterIds = new Set(sources.flatMap((source) =>
    source.kind === "character" ? [source.id] : []
  ));
  for (const field of ["fromCharacterId", "toCharacterId"] as const) {
    const value = proposal.fields[field];
    if (typeof value === "string" && !activeCharacterIds.has(value)) {
      throw new Error(`Canon relation character endpoint is unavailable: ${value}`);
    }
  }
}

function pendingIdentity(change: CanonPendingFieldChange): string {
  return JSON.stringify([
    change.sourceDocumentRevisionId,
    change.targetKind,
    change.targetIdentity,
    change.field,
    change.after,
  ]);
}

export function planCanonReviewItems(input: Readonly<{
  workId: string;
  sourceRange: AssistantContextRange;
  manuscript: string;
  payload: CanonReviewModelPayload;
  requestedTargetKinds?: readonly CanonTargetKind[];
  sources: readonly CanonReviewSourceSnapshot[];
  pendingFieldChanges: readonly CanonPendingFieldChange[];
  itemIdFactory: Readonly<{ create(): string }>;
  evidenceIdFactory: Readonly<{ create(): string }>;
}>): readonly CanonReviewItem[] {
  const sources = activeSources(input.workId, input.sources);
  const pending = new Set(input.pendingFieldChanges.map(pendingIdentity));
  const paragraphs = createCanonReviewParagraphs({
    sourceRange: input.sourceRange,
    manuscript: input.manuscript,
  });
  const items: CanonReviewItem[] = [];
  for (const proposal of input.payload.proposals) {
    if (
      input.requestedTargetKinds !== undefined &&
      !input.requestedTargetKinds.includes(proposal.targetKind)
    ) {
      throw new Error(
        `Canon target kind was not requested: ${proposal.targetKind}`,
      );
    }
    assertRelationEndpoints(proposal, sources);
    const matches = matchingSources(proposal, sources);
    const target = targetForProposal(proposal, matches);
    const targetIdentity = canonReviewTargetIdentity(target, proposal.targetHint);
    const fieldChanges = Object.freeze(proposalFieldChanges(
      proposal,
      target,
      matches,
    ).filter((change) => !pending.has(pendingIdentity({
      sourceDocumentRevisionId: input.sourceRange.documentRevisionId,
      targetKind: proposal.targetKind,
      targetIdentity,
      field: change.field,
      after: change.after,
    }))));
    if (fieldChanges.length === 0) continue;
    items.push(Object.freeze({
      itemId: entityId<"CanonReviewItem">(input.itemIdFactory.create()),
      targetHint: proposal.targetHint,
      target,
      assertionBasis: proposal.assertionBasis,
      reason: proposal.reason,
      evidence: resolveCanonReviewEvidence({
        sourceRange: input.sourceRange,
        paragraphs,
        proposal,
        evidenceIdFactory: input.evidenceIdFactory,
      }),
      fieldChanges,
      status: "pending",
      appliedTargetId: null,
    }));
  }
  if (new Set(items.map((item) => item.itemId)).size !== items.length) {
    throw new Error("Canon review item factory returned duplicate identities");
  }
  return Object.freeze(items);
}

function sourceBySelection(input: Readonly<{
  workId: string;
  kind: CanonTargetKind;
  selection: Extract<CanonReviewTargetSelection, { kind: "update" }>;
  sources: readonly CanonReviewSourceSnapshot[];
}>): CanonReviewSourceSnapshot {
  const sources = activeSources(input.workId, input.sources);
  const source = sources.find((entry) =>
    entry.kind === input.kind && entry.id === input.selection.targetId
  );
  if (source === undefined || source.revision !== input.selection.expectedRevision) {
    throw new Error(`Canon target revision conflict: ${input.selection.targetId}`);
  }
  return source;
}

function resolvedUpdateTarget(
  source: CanonReviewSourceSnapshot,
): CanonReviewTarget {
  if (source.kind === "character") {
    return Object.freeze({
      kind: source.kind,
      operation: "update",
      characterId: entityId<"Character">(source.id),
      expectedRevision: source.revision,
    });
  }
  if (source.kind === "character-relation") {
    return Object.freeze({
      kind: source.kind,
      operation: "update",
      relationId: entityId<"CharacterRelation">(source.id),
      expectedRevision: source.revision,
    });
  }
  return Object.freeze({
    kind: source.kind,
    operation: "update",
    loreEntryId: entityId<"LoreEntry">(source.id),
    expectedRevision: source.revision,
  });
}

export function resolveCanonReviewItemTarget(input: Readonly<{
  workId: string;
  item: CanonReviewItem;
  selection: CanonReviewTargetSelection;
  sources: readonly CanonReviewSourceSnapshot[];
}>): CanonReviewItem {
  if (input.item.status !== "pending") {
    throw new Error(`Canon review item is not pending: ${input.item.itemId}`);
  }
  if (input.selection.kind === "create") {
    const required = fieldsForKind(input.item.target.kind);
    const actual = new Set(input.item.fieldChanges.map((change) => change.field));
    if (required.some((field) => !actual.has(field))) {
      throw new Error("Canon create target requires complete fields");
    }
    return Object.freeze({
      ...input.item,
      target: Object.freeze({
        kind: input.item.target.kind,
        operation: "create",
      }) as CanonReviewTarget,
      fieldChanges: Object.freeze(input.item.fieldChanges.map((change) =>
        Object.freeze({ ...change, before: null })
      )),
    });
  }
  const source = sourceBySelection({
    workId: input.workId,
    kind: input.item.target.kind,
    selection: input.selection,
    sources: input.sources,
  });
  const fieldChanges = Object.freeze(input.item.fieldChanges.map((change) =>
    Object.freeze({
      ...change,
      before: snapshotField(source, change.field),
    })
  ));
  if (source.kind === "character-relation") {
    const activeCharacterIds = new Set(activeSources(input.workId, input.sources)
      .flatMap((entry) => entry.kind === "character" ? [entry.id] : []));
    for (const change of fieldChanges) {
      if (
        (change.field === "fromCharacterId" || change.field === "toCharacterId") &&
        typeof change.after === "string" && !activeCharacterIds.has(change.after)
      ) {
        throw new Error(`Canon relation character endpoint is unavailable: ${change.after}`);
      }
    }
  }
  return Object.freeze({
    ...input.item,
    target: resolvedUpdateTarget(source),
    fieldChanges,
  });
}
