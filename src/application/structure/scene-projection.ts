import { entityId, type EntityId } from "../../domain/writing";
import {
  deriveEventBlockSourceState,
  type EventBlockProjection,
  type EventBlockSourceState,
  type EventSourceProjection,
} from "./event-block-contract";
import type { SceneOverrideProjection } from "./scene-override-contract";

export type SceneBoundaryRule = {
  readonly boundaryRuleId: string;
  readonly kind: "line-regexp";
  readonly pattern: string;
  readonly flags: string;
};

export type SceneRuleSetProjection = {
  readonly schemaVersion: 1;
  readonly sceneRuleSetId: EntityId<"SceneRuleSet">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly displayName: string;
  readonly boundaryRules: readonly SceneBoundaryRule[];
  readonly normalizationPolicy: "preserve" | "trim-line-whitespace";
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListSceneProjectionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdateSceneRuleSetCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly sceneRuleSetId: EntityId<"SceneRuleSet">;
  readonly expectedRevision: number;
  readonly displayName: string;
  readonly boundaryRules: readonly SceneBoundaryRule[];
  readonly normalizationPolicy: SceneRuleSetProjection["normalizationPolicy"];
  readonly enabled: boolean;
};

export type SceneEventOverrideOperation = "include" | "exclude";

export type SetSceneEventOverrideCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly operation: SceneEventOverrideOperation | null;
  readonly expectedRevision: number | null;
};

export type SceneEventOverrideProjection = {
  readonly schemaVersion: 1;
  readonly sceneEventOverrideId: EntityId<"SceneEventOverride">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly operation: SceneEventOverrideOperation;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SceneEventProjection = {
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly title: string;
  readonly sourceState: EventBlockSourceState;
  readonly membership: "automatic" | "manual";
  readonly sceneEventOverrideId: EntityId<"SceneEventOverride"> | null;
  readonly sceneEventOverrideRevision: number | null;
};

export type SceneExcludedEventProjection = {
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly title: string;
  readonly sourceState: EventBlockSourceState;
  readonly sceneEventOverrideId: EntityId<"SceneEventOverride">;
  readonly sceneEventOverrideRevision: number;
};

export type SceneProjection = {
  readonly schemaVersion: 1;
  readonly sceneKey: string;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly documentTitle: string;
  readonly documentIndex: number;
  readonly sceneIndex: number;
  readonly startAnchorId: EntityId<"Anchor">;
  readonly endAnchorId: EntityId<"Anchor"> | null;
  readonly range: { readonly start: number; readonly end: number } | null;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly source: "rule" | "override";
  readonly events: readonly SceneEventProjection[];
  readonly excludedEvents: readonly SceneExcludedEventProjection[];
};

export type SceneUnassignedEventProjection = {
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly title: string;
  readonly sourceState: EventBlockSourceState;
};

export type SceneProjectionList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly status: "clean" | "needsReview" | "invalid";
  readonly ruleSet: SceneRuleSetProjection;
  readonly scenes: readonly SceneProjection[];
  readonly unassignedEvents: readonly SceneUnassignedEventProjection[];
  readonly sceneEventOverrides: readonly SceneEventOverrideProjection[];
};

export type SceneProjectionDocumentInput = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly title: string;
  readonly documentIndex: number;
  readonly text: string;
};

export type DeriveSceneProjectionInput = {
  readonly workId: EntityId<"Work">;
  readonly ruleSet: SceneRuleSetProjection;
  readonly documents: readonly SceneProjectionDocumentInput[];
  readonly sceneOverrides: readonly SceneOverrideProjection[];
  readonly eventBlocks: readonly EventBlockProjection[];
  readonly eventSources: readonly EventSourceProjection[];
  readonly sceneEventOverrides: readonly SceneEventOverrideProjection[];
};

type Boundary = {
  readonly boundaryId: EntityId<"Anchor">;
  readonly range: { readonly from: number; readonly to: number };
  readonly source: "rule" | "override";
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
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
  const value = stringValue(input, field, label);
  if (value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function integer(
  input: Record<string, unknown>,
  field: string,
  label: string,
  minimum = 0,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(`${label}.${field} must be an integer >= ${minimum}`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function booleanValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): boolean {
  const value = input[field];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

export function parseSceneBoundaryRule(
  value: unknown,
  label = "SceneBoundaryRule",
): SceneBoundaryRule {
  const input = record(value, label);
  exactFields(input, ["boundaryRuleId", "kind", "pattern", "flags"], label);
  if (input.kind !== "line-regexp") {
    throw new Error(`${label}.kind is invalid`);
  }
  const pattern = stringValue(input, "pattern", label);
  const flags = stringValue(input, "flags", label);
  if (/[^dimsuv]/u.test(flags) || new Set(flags).size !== flags.length) {
    throw new Error(`${label}.flags contains unsupported or duplicate flags`);
  }
  try {
    new RegExp(pattern, flags);
  } catch {
    throw new Error(`${label}.pattern is not a valid regular expression`);
  }
  return Object.freeze({
    boundaryRuleId: nonEmptyString(input, "boundaryRuleId", label),
    kind: "line-regexp",
    pattern,
    flags,
  });
}

export function parseSceneRuleSetProjection(
  value: unknown,
): SceneRuleSetProjection {
  const label = "SceneRuleSetProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "sceneRuleSetId",
      "revision",
      "workId",
      "displayName",
      "boundaryRules",
      "normalizationPolicy",
      "enabled",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  schema(input, label);
  if (!Array.isArray(input.boundaryRules)) {
    throw new Error(`${label}.boundaryRules must be an array`);
  }
  if (
    input.normalizationPolicy !== "preserve" &&
    input.normalizationPolicy !== "trim-line-whitespace"
  ) {
    throw new Error(`${label}.normalizationPolicy is invalid`);
  }
  const boundaryRules = Object.freeze(
    input.boundaryRules.map((rule, index) =>
      parseSceneBoundaryRule(rule, `${label}.boundaryRules[${index}]`),
    ),
  );
  if (new Set(boundaryRules.map((rule) => rule.boundaryRuleId)).size !== boundaryRules.length) {
    throw new Error(`${label}.boundaryRules contains duplicate identities`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sceneRuleSetId: id<"SceneRuleSet">(input, "sceneRuleSetId", label),
    revision: integer(input, "revision", label, 1),
    workId: id<"Work">(input, "workId", label),
    displayName: nonEmptyString(input, "displayName", label),
    boundaryRules,
    normalizationPolicy: input.normalizationPolicy,
    enabled: booleanValue(input, "enabled", label),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
  });
}

export function parseListSceneProjectionCommand(
  value: unknown,
): ListSceneProjectionCommand {
  const label = "ListSceneProjectionCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseUpdateSceneRuleSetCommand(
  value: unknown,
): UpdateSceneRuleSetCommand {
  const label = "UpdateSceneRuleSetCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "sceneRuleSetId",
      "expectedRevision",
      "displayName",
      "boundaryRules",
      "normalizationPolicy",
      "enabled",
    ],
    label,
  );
  schema(input, label);
  const parsed = parseSceneRuleSetProjection({
    schemaVersion: 1,
    sceneRuleSetId: input.sceneRuleSetId,
    revision: integer(input, "expectedRevision", label, 1),
    workId: input.workId,
    displayName: input.displayName,
    boundaryRules: input.boundaryRules,
    normalizationPolicy: input.normalizationPolicy,
    enabled: input.enabled,
    createdAt: "command",
    updatedAt: "command",
  });
  return Object.freeze({
    schemaVersion: 1,
    workId: parsed.workId,
    sceneRuleSetId: parsed.sceneRuleSetId,
    expectedRevision: parsed.revision,
    displayName: parsed.displayName,
    boundaryRules: parsed.boundaryRules,
    normalizationPolicy: parsed.normalizationPolicy,
    enabled: parsed.enabled,
  });
}

function parseSceneEventOverrideOperation(
  value: unknown,
  label: string,
): SceneEventOverrideOperation {
  if (value !== "include" && value !== "exclude") {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseSetSceneEventOverrideCommand(
  value: unknown,
): SetSceneEventOverrideCommand {
  const label = "SetSceneEventOverrideCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "sceneKey",
      "eventBlockId",
      "operation",
      "expectedRevision",
    ],
    label,
  );
  schema(input, label);
  const expectedRevision = input.expectedRevision === null
    ? null
    : integer(input, "expectedRevision", label, 1);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    sceneKey: nonEmptyString(input, "sceneKey", label),
    eventBlockId: id<"EventBlock">(input, "eventBlockId", label),
    operation: input.operation === null
      ? null
      : parseSceneEventOverrideOperation(input.operation, `${label}.operation`),
    expectedRevision,
  });
}

export function parseSceneEventOverrideProjection(
  value: unknown,
): SceneEventOverrideProjection {
  const label = "SceneEventOverrideProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "sceneEventOverrideId",
      "revision",
      "workId",
      "sceneKey",
      "eventBlockId",
      "operation",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    sceneEventOverrideId: id<"SceneEventOverride">(
      input,
      "sceneEventOverrideId",
      label,
    ),
    revision: integer(input, "revision", label, 1),
    workId: id<"Work">(input, "workId", label),
    sceneKey: nonEmptyString(input, "sceneKey", label),
    eventBlockId: id<"EventBlock">(input, "eventBlockId", label),
    operation: parseSceneEventOverrideOperation(
      input.operation,
      `${label}.operation`,
    ),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
  });
}

function parseSourceState(value: unknown, label: string): EventBlockSourceState {
  if (
    value !== "resolved" &&
    value !== "unlinked" &&
    value !== "needsReview" &&
    value !== "broken"
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function parseSceneEvent(value: unknown, label: string): SceneEventProjection {
  const input = record(value, label);
  exactFields(
    input,
    [
      "eventBlockId",
      "title",
      "sourceState",
      "membership",
      "sceneEventOverrideId",
      "sceneEventOverrideRevision",
    ],
    label,
  );
  if (input.membership !== "automatic" && input.membership !== "manual") {
    throw new Error(`${label}.membership is invalid`);
  }
  const hasOverride = input.sceneEventOverrideId !== null;
  const hasOverrideRevision = input.sceneEventOverrideRevision !== null;
  if (hasOverride !== hasOverrideRevision) {
    throw new Error(`${label} override identity and revision must match`);
  }
  return Object.freeze({
    eventBlockId: id<"EventBlock">(input, "eventBlockId", label),
    title: nonEmptyString(input, "title", label),
    sourceState: parseSourceState(input.sourceState, `${label}.sourceState`),
    membership: input.membership,
    sceneEventOverrideId: input.sceneEventOverrideId === null
      ? null
      : id<"SceneEventOverride">(input, "sceneEventOverrideId", label),
    sceneEventOverrideRevision: input.sceneEventOverrideRevision === null
      ? null
      : integer(input, "sceneEventOverrideRevision", label, 1),
  });
}

function parseExcludedEvent(
  value: unknown,
  label: string,
): SceneExcludedEventProjection {
  const input = record(value, label);
  exactFields(
    input,
    [
      "eventBlockId",
      "title",
      "sourceState",
      "sceneEventOverrideId",
      "sceneEventOverrideRevision",
    ],
    label,
  );
  return Object.freeze({
    eventBlockId: id<"EventBlock">(input, "eventBlockId", label),
    title: nonEmptyString(input, "title", label),
    sourceState: parseSourceState(input.sourceState, `${label}.sourceState`),
    sceneEventOverrideId: id<"SceneEventOverride">(
      input,
      "sceneEventOverrideId",
      label,
    ),
    sceneEventOverrideRevision: integer(
      input,
      "sceneEventOverrideRevision",
      label,
      1,
    ),
  });
}

function parseRange(
  value: unknown,
  label: string,
): SceneProjection["range"] {
  if (value === null) return null;
  const input = record(value, label);
  exactFields(input, ["start", "end"], label);
  const start = integer(input, "start", label);
  const end = integer(input, "end", label);
  if (end < start) throw new Error(`${label}.end must not precede start`);
  return Object.freeze({ start, end });
}

function parseScene(value: unknown, label: string): SceneProjection {
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "sceneKey",
      "workId",
      "documentId",
      "documentRevisionId",
      "documentTitle",
      "documentIndex",
      "sceneIndex",
      "startAnchorId",
      "endAnchorId",
      "range",
      "integrity",
      "source",
      "events",
      "excludedEvents",
    ],
    label,
  );
  schema(input, label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  if (input.source !== "rule" && input.source !== "override") {
    throw new Error(`${label}.source is invalid`);
  }
  if (!Array.isArray(input.events) || !Array.isArray(input.excludedEvents)) {
    throw new Error(`${label} event fields must be arrays`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sceneKey: nonEmptyString(input, "sceneKey", label),
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    documentTitle: nonEmptyString(input, "documentTitle", label),
    documentIndex: integer(input, "documentIndex", label),
    sceneIndex: integer(input, "sceneIndex", label, 1),
    startAnchorId: id<"Anchor">(input, "startAnchorId", label),
    endAnchorId: input.endAnchorId === null
      ? null
      : id<"Anchor">(input, "endAnchorId", label),
    range: parseRange(input.range, `${label}.range`),
    integrity: input.integrity,
    source: input.source,
    events: Object.freeze(
      input.events.map((event, index) =>
        parseSceneEvent(event, `${label}.events[${index}]`),
      ),
    ),
    excludedEvents: Object.freeze(
      input.excludedEvents.map((event, index) =>
        parseExcludedEvent(event, `${label}.excludedEvents[${index}]`),
      ),
    ),
  });
}

function parseUnassignedEvent(
  value: unknown,
  label: string,
): SceneUnassignedEventProjection {
  const input = record(value, label);
  exactFields(input, ["eventBlockId", "title", "sourceState"], label);
  return Object.freeze({
    eventBlockId: id<"EventBlock">(input, "eventBlockId", label),
    title: nonEmptyString(input, "title", label),
    sourceState: parseSourceState(input.sourceState, `${label}.sourceState`),
  });
}

export function parseSceneProjectionList(value: unknown): SceneProjectionList {
  const label = "SceneProjectionList";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "status",
      "ruleSet",
      "scenes",
      "unassignedEvents",
      "sceneEventOverrides",
    ],
    label,
  );
  schema(input, label);
  if (
    input.status !== "clean" &&
    input.status !== "needsReview" &&
    input.status !== "invalid"
  ) {
    throw new Error(`${label}.status is invalid`);
  }
  if (
    !Array.isArray(input.scenes) ||
    !Array.isArray(input.unassignedEvents) ||
    !Array.isArray(input.sceneEventOverrides)
  ) {
    throw new Error(`${label} list fields must be arrays`);
  }
  const workId = id<"Work">(input, "workId", label);
  const ruleSet = parseSceneRuleSetProjection(input.ruleSet);
  const scenes = Object.freeze(
    input.scenes.map((scene, index) =>
      parseScene(scene, `${label}.scenes[${index}]`),
    ),
  );
  const sceneEventOverrides = Object.freeze(
    input.sceneEventOverrides.map((override) =>
      parseSceneEventOverrideProjection(override),
    ),
  );
  if (
    ruleSet.workId !== workId ||
    scenes.some((scene) => scene.workId !== workId) ||
    sceneEventOverrides.some((override) => override.workId !== workId)
  ) {
    throw new Error(`${label} contains data outside its Work`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId,
    status: input.status,
    ruleSet,
    scenes,
    unassignedEvents: Object.freeze(
      input.unassignedEvents.map((event, index) =>
        parseUnassignedEvent(event, `${label}.unassignedEvents[${index}]`),
      ),
    ),
    sceneEventOverrides,
  });
}

function derivedBoundaryId(parts: readonly string[]): EntityId<"Anchor"> {
  return entityId<"Anchor">(
    `scene-boundary-v1:${parts.map((part) => encodeURIComponent(part)).join(":")}`,
  );
}

function derivedSceneKey(
  documentId: EntityId<"Document">,
  startAnchorId: EntityId<"Anchor">,
  endAnchorId: EntityId<"Anchor"> | null,
): string {
  return ["scene-v1", documentId, startAnchorId, endAnchorId ?? "document-end"]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

function ruleBoundaries(
  document: SceneProjectionDocumentInput,
  ruleSet: SceneRuleSetProjection,
): readonly Boundary[] {
  if (!ruleSet.enabled || ruleSet.boundaryRules.length === 0) return [];
  const compiled = ruleSet.boundaryRules.map((rule) => ({
    rule,
    expression: new RegExp(rule.pattern, rule.flags),
    occurrence: 0,
  }));
  const boundaries: Boundary[] = [];
  let lineStart = 0;
  while (lineStart <= document.text.length) {
    const newline = document.text.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? document.text.length : newline;
    const rawLine = document.text.slice(lineStart, lineEnd);
    const comparable = ruleSet.normalizationPolicy === "trim-line-whitespace"
      ? rawLine.trim()
      : rawLine;
    for (const entry of compiled) {
      entry.expression.lastIndex = 0;
      if (!entry.expression.test(comparable)) continue;
      entry.occurrence += 1;
      boundaries.push(Object.freeze({
        boundaryId: derivedBoundaryId([
          document.documentId,
          ruleSet.sceneRuleSetId,
          String(ruleSet.revision),
          entry.rule.boundaryRuleId,
          String(entry.occurrence),
        ]),
        range: Object.freeze({
          from: lineStart,
          to: newline === -1 ? lineEnd : newline + 1,
        }),
        source: "rule" as const,
      }));
      break;
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  return Object.freeze(boundaries);
}

function boundaryMatches(
  boundary: Boundary,
  target: { readonly from: number; readonly to: number },
): boolean {
  if (target.from === target.to) {
    return target.from >= boundary.range.from && target.from <= boundary.range.to;
  }
  return target.from < boundary.range.to && target.to > boundary.range.from;
}

function rangesOverlap(
  first: { readonly start: number; readonly end: number },
  second: { readonly from: number; readonly to: number },
): boolean {
  if (second.from === second.to) {
    return second.from >= first.start && second.from <= first.end;
  }
  return second.from < first.end && second.to > first.start;
}

function sourceRangeOverlapsScene(
  source: EventSourceProjection,
  documentId: EntityId<"Document">,
  range: { readonly start: number; readonly end: number },
): boolean {
  return source.retiredAt === null && source.anchors.some((anchor) => {
    if (
      anchor.documentId !== documentId ||
      anchor.integrity !== "resolved" ||
      anchor.range === null
    ) {
      return false;
    }
    if (anchor.range.from === anchor.range.to) {
      return anchor.range.from >= range.start && anchor.range.from <= range.end;
    }
    return anchor.range.from < range.end && anchor.range.to > range.start;
  });
}

function statusRank(status: SceneProjectionList["status"]): number {
  return status === "clean" ? 0 : status === "needsReview" ? 1 : 2;
}

function higherStatus(
  current: SceneProjectionList["status"],
  candidate: SceneProjectionList["status"],
): SceneProjectionList["status"] {
  return statusRank(candidate) > statusRank(current) ? candidate : current;
}

export function deriveSceneProjection(
  input: DeriveSceneProjectionInput,
): SceneProjectionList {
  const ruleSet = parseSceneRuleSetProjection(input.ruleSet);
  if (ruleSet.workId !== input.workId) {
    throw new Error("SceneRuleSet is outside its Work");
  }
  const documents = [...input.documents].sort(
    (first, second) => first.documentIndex - second.documentIndex,
  );
  const documentIds = new Set<EntityId<"Document">>();
  for (const document of documents) {
    if (document.workId !== input.workId) {
      throw new Error(`Document is outside Work ${input.workId}`);
    }
    if (documentIds.has(document.documentId)) {
      throw new Error(`Duplicate Document: ${document.documentId}`);
    }
    documentIds.add(document.documentId);
  }
  for (const value of [
    ...input.sceneOverrides,
    ...input.eventBlocks,
    ...input.eventSources,
    ...input.sceneEventOverrides,
  ]) {
    if (value.workId !== input.workId) {
      throw new Error(`Scene projection input is outside Work ${input.workId}`);
    }
  }
  const eventBlocks = input.eventBlocks.filter((event) => event.retiredAt === null);
  const eventIds = new Set(eventBlocks.map((event) => event.eventBlockId));
  const sceneEventOverrides = input.sceneEventOverrides.map((override) =>
    parseSceneEventOverrideProjection(override),
  );
  const overridesByDocument = new Map<
    EntityId<"Document">,
    SceneOverrideProjection[]
  >();
  for (const override of input.sceneOverrides) {
    const existing = overridesByDocument.get(override.documentId);
    if (existing === undefined) overridesByDocument.set(override.documentId, [override]);
    else existing.push(override);
  }

  let status: SceneProjectionList["status"] = "clean";
  const scenes: SceneProjection[] = [];
  for (const document of documents) {
    const boundaries = [...ruleBoundaries(document, ruleSet)];
    const affectedRanges: Array<{ readonly from: number; readonly to: number }> = [];
    let documentIntegrity: SceneProjection["integrity"] = "resolved";
    const overrides = [...(overridesByDocument.get(document.documentId) ?? [])]
      .sort((first, second) =>
        first.createdAt.localeCompare(second.createdAt) ||
        first.sceneOverrideId.localeCompare(second.sceneOverrideId),
      );
    for (const override of overrides) {
      if (override.baseRuleSetRevision !== ruleSet.revision) {
        documentIntegrity = documentIntegrity === "broken"
          ? "broken"
          : "needsReview";
        status = higherStatus(status, "needsReview");
      }
      for (const boundary of override.boundaries) {
        if (boundary.integrity !== "resolved" || boundary.range === null) {
          documentIntegrity = boundary.integrity === "broken"
            ? "broken"
            : documentIntegrity === "broken"
              ? "broken"
              : "needsReview";
          status = higherStatus(
            status,
            boundary.integrity === "broken" ? "invalid" : "needsReview",
          );
          continue;
        }
        if (override.operation === "add" || override.operation === "split") {
          const duplicate = boundaries.some(
            (candidate) =>
              candidate.range.from === boundary.range?.from &&
              candidate.range.to === boundary.range?.to,
          );
          if (!duplicate) {
            boundaries.push(Object.freeze({
              boundaryId: boundary.anchorId,
              range: boundary.range,
              source: "override" as const,
            }));
          }
          affectedRanges.push(boundary.range);
          continue;
        }
        const matchingIndexes = boundaries
          .map((candidate, index) =>
            boundaryMatches(candidate, boundary.range as { from: number; to: number })
              ? index
              : -1,
          )
          .filter((index) => index >= 0)
          .sort((first, second) => second - first);
        if (matchingIndexes.length === 0) {
          documentIntegrity = documentIntegrity === "broken"
            ? "broken"
            : "needsReview";
          status = higherStatus(status, "needsReview");
        }
        for (const index of matchingIndexes) boundaries.splice(index, 1);
        affectedRanges.push(boundary.range);
      }
    }
    boundaries.sort(
      (first, second) =>
        first.range.from - second.range.from ||
        first.range.to - second.range.to ||
        first.boundaryId.localeCompare(second.boundaryId),
    );
    const hasOverlap = boundaries.some(
      (boundary, index) =>
        index > 0 &&
        (boundaries[index - 1]?.range.to ?? 0) > boundary.range.from,
    );
    if (hasOverlap) {
      documentIntegrity = "broken";
      status = "invalid";
    }
    const starts: readonly Boundary[] = [
      Object.freeze({
        boundaryId: derivedBoundaryId([document.documentId, "document-start"]),
        range: Object.freeze({ from: 0, to: 0 }),
        source: "rule",
      }),
      ...boundaries,
    ];
    starts.forEach((startBoundary, index) => {
      const endBoundary = starts[index + 1] ?? null;
      const range = hasOverlap
        ? null
        : Object.freeze({
            start: startBoundary.range.to,
            end: endBoundary?.range.from ?? document.text.length,
          });
      const source =
        startBoundary.source === "override" ||
        endBoundary?.source === "override" ||
        (range !== null && affectedRanges.some((affected) =>
          rangesOverlap(range, affected)))
          ? "override"
          : "rule";
      scenes.push({
        schemaVersion: 1,
        sceneKey: derivedSceneKey(
          document.documentId,
          startBoundary.boundaryId,
          endBoundary?.boundaryId ?? null,
        ),
        workId: input.workId,
        documentId: document.documentId,
        documentRevisionId: document.documentRevisionId,
        documentTitle: document.title,
        documentIndex: document.documentIndex,
        sceneIndex: index + 1,
        startAnchorId: startBoundary.boundaryId,
        endAnchorId: endBoundary?.boundaryId ?? null,
        range,
        integrity: documentIntegrity,
        source,
        events: [],
        excludedEvents: [],
      });
    });
  }

  const scenesByKey = new Map(scenes.map((scene) => [scene.sceneKey, scene] as const));
  const overrideByPair = new Map<string, SceneEventOverrideProjection>();
  for (const override of sceneEventOverrides) {
    if (!eventIds.has(override.eventBlockId) || !scenesByKey.has(override.sceneKey)) {
      status = higherStatus(status, "needsReview");
      continue;
    }
    overrideByPair.set(`${override.sceneKey}\u0000${override.eventBlockId}`, override);
  }
  const assignedEventIds = new Set<EntityId<"EventBlock">>();
  const projectedScenes = scenes.map((scene) => {
    const automaticIds = new Set<EntityId<"EventBlock">>();
    if (scene.range !== null) {
      for (const eventBlock of eventBlocks) {
        if (
          input.eventSources.some(
            (source) =>
              source.eventBlockId === eventBlock.eventBlockId &&
              sourceRangeOverlapsScene(
                source,
                scene.documentId,
                scene.range as { start: number; end: number },
              ),
          )
        ) {
          automaticIds.add(eventBlock.eventBlockId);
        }
      }
    }
    const events: SceneEventProjection[] = [];
    const excludedEvents: SceneExcludedEventProjection[] = [];
    for (const eventBlock of eventBlocks) {
      const override = overrideByPair.get(
        `${scene.sceneKey}\u0000${eventBlock.eventBlockId}`,
      );
      if (override?.operation === "exclude") {
        if (automaticIds.has(eventBlock.eventBlockId)) {
          excludedEvents.push(Object.freeze({
            eventBlockId: eventBlock.eventBlockId,
            title: eventBlock.title,
            sourceState: deriveEventBlockSourceState(
              eventBlock.eventBlockId,
              input.eventSources,
            ),
            sceneEventOverrideId: override.sceneEventOverrideId,
            sceneEventOverrideRevision: override.revision,
          }));
        }
        continue;
      }
      const automatic = automaticIds.has(eventBlock.eventBlockId);
      if (!automatic && override?.operation !== "include") continue;
      assignedEventIds.add(eventBlock.eventBlockId);
      events.push(Object.freeze({
        eventBlockId: eventBlock.eventBlockId,
        title: eventBlock.title,
        sourceState: deriveEventBlockSourceState(
          eventBlock.eventBlockId,
          input.eventSources,
        ),
        membership: override?.operation === "include" ? "manual" : "automatic",
        sceneEventOverrideId: override?.sceneEventOverrideId ?? null,
        sceneEventOverrideRevision: override?.revision ?? null,
      }));
    }
    return Object.freeze({ ...scene, events, excludedEvents });
  });
  const unassignedEvents = eventBlocks
    .filter((eventBlock) => !assignedEventIds.has(eventBlock.eventBlockId))
    .map((eventBlock) => Object.freeze({
      eventBlockId: eventBlock.eventBlockId,
      title: eventBlock.title,
      sourceState: deriveEventBlockSourceState(
        eventBlock.eventBlockId,
        input.eventSources,
      ),
    }));

  return parseSceneProjectionList({
    schemaVersion: 1,
    workId: input.workId,
    status,
    ruleSet,
    scenes: projectedScenes,
    unassignedEvents,
    sceneEventOverrides,
  });
}
