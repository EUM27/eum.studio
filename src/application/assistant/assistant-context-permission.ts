import { entityId, type EntityId } from "../../domain/writing";

export const ASSISTANT_CAPABILITIES = [
  "vocabulary-lookup",
  "lore-review",
  "character.extract",
  "scene.extract",
  "publishing-operations",
] as const;

export const ASSISTANT_CONTEXT_SCOPES = [
  "none",
  "selection",
  "paragraph",
  "scene",
  "chapter",
  "work",
] as const;

export const ASSISTANT_PERMISSION_DURATIONS = [
  "once",
  "conversation",
  "work",
] as const;

export type AssistantCapability = (typeof ASSISTANT_CAPABILITIES)[number];
export type AssistantContextScope = (typeof ASSISTANT_CONTEXT_SCOPES)[number];
export type AssistantPermissionDuration =
  (typeof ASSISTANT_PERMISSION_DURATIONS)[number];

export type AssistantContextRange = {
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly from: number;
  readonly to: number;
};

export type AssistantContextRequest = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantContextRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly capability: AssistantCapability;
  readonly destinationId: string;
  readonly requiredLocalScope: AssistantContextScope;
  readonly requiredExternalScope: AssistantContextScope;
  readonly readRanges: readonly AssistantContextRange[];
  readonly transmittedRanges: readonly AssistantContextRange[];
};

export type AssistantContextPermissionGrant = {
  readonly schemaVersion: 1;
  readonly grantId: EntityId<"AssistantContextPermissionGrant">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation"> | null;
  readonly capability: AssistantCapability;
  readonly destinationId: string;
  readonly localScope: AssistantContextScope;
  readonly externalScope: AssistantContextScope;
  readonly duration: AssistantPermissionDuration;
  readonly createdAt: string;
  readonly revokedAt: string | null;
  readonly consumedAt: string | null;
};

export type AssistantContextDocumentVersion = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly length: number;
};

export type AssistantContextPermissionMissing =
  | "local-read"
  | "external-transmit";

export type AssistantContextAuthorization =
  | Readonly<{
      allowed: false;
      reason: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
    }>
  | Readonly<{
      allowed: false;
      reason:
        | "source-unavailable"
        | "outside-work"
        | "stale-context"
        | "invalid-range";
      documentId: EntityId<"Document">;
    }>
  | Readonly<{
      allowed: true;
      request: AssistantContextRequest;
      grantIds: readonly EntityId<"AssistantContextPermissionGrant">[];
      consumedGrantIds: readonly EntityId<"AssistantContextPermissionGrant">[];
    }>;

export type AssistantContextReceipt = {
  readonly schemaVersion: 1;
  readonly receiptId: EntityId<"AssistantContextReceipt">;
  readonly requestId: EntityId<"AssistantContextRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly capability: AssistantCapability;
  readonly destinationId: string;
  readonly readRanges: readonly AssistantContextRange[];
  readonly transmittedRanges: readonly AssistantContextRange[];
  readonly readCharacterCount: number;
  readonly transmittedCharacterCount: number;
  readonly grantIds: readonly EntityId<"AssistantContextPermissionGrant">[];
  readonly createdAt: string;
};

export type AssistantContextAccessResult =
  | Exclude<AssistantContextAuthorization, { allowed: true }>
  | Readonly<{
      allowed: true;
      receipt: AssistantContextReceipt;
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
    throw new Error(`Unsupported ${label}.schemaVersion`);
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

function nullableIdentifier<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  return input[field] === null
    ? null
    : identifier<TEntity>(input, field, label);
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

function positiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = nonNegativeInteger(input, field, label);
  if (value === 0) {
    throw new Error(`${label}.${field} must be positive`);
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

function nullableInstant(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  return input[field] === null ? null : instant(input, field, label);
}

function capability(
  input: Record<string, unknown>,
  field: string,
  label: string,
): AssistantCapability {
  const value = input[field];
  if (!(ASSISTANT_CAPABILITIES as readonly unknown[]).includes(value)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as AssistantCapability;
}

function scope(
  input: Record<string, unknown>,
  field: string,
  label: string,
): AssistantContextScope {
  const value = input[field];
  if (!(ASSISTANT_CONTEXT_SCOPES as readonly unknown[]).includes(value)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as AssistantContextScope;
}

function duration(
  input: Record<string, unknown>,
  field: string,
  label: string,
): AssistantPermissionDuration {
  const value = input[field];
  if (!(ASSISTANT_PERMISSION_DURATIONS as readonly unknown[]).includes(value)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as AssistantPermissionDuration;
}

function parseRange(value: unknown, label: string): AssistantContextRange {
  const input = record(value, label);
  exact(input, ["documentId", "documentRevisionId", "from", "to"], label);
  const from = nonNegativeInteger(input, "from", label);
  const to = nonNegativeInteger(input, "to", label);
  if (to <= from) {
    throw new Error(`${label} must identify a non-empty exact range`);
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
  });
}

export function parseAssistantContextRange(
  value: unknown,
  label = "AssistantContextRange",
): AssistantContextRange {
  return parseRange(value, label);
}

function parseRanges(value: unknown, label: string): readonly AssistantContextRange[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const ranges = Object.freeze(value.map((entry, index) =>
    parseRange(entry, `${label}[${index}]`)
  ));
  const identities = new Set<string>();
  for (const range of ranges) {
    const identity = JSON.stringify([
      range.documentId,
      range.documentRevisionId,
      range.from,
      range.to,
    ]);
    if (identities.has(identity)) {
      throw new Error(`${label} contains a duplicate range`);
    }
    identities.add(identity);
  }
  return ranges;
}

function rangeContains(
  container: AssistantContextRange,
  candidate: AssistantContextRange,
): boolean {
  return container.documentId === candidate.documentId &&
    container.documentRevisionId === candidate.documentRevisionId &&
    container.from <= candidate.from &&
    container.to >= candidate.to;
}

function assertScopeRanges(
  scopeValue: AssistantContextScope,
  ranges: readonly AssistantContextRange[],
  label: string,
): void {
  if ((scopeValue === "none") !== (ranges.length === 0)) {
    throw new Error(`${label} scope and exact ranges are inconsistent`);
  }
  if (scopeValue === "selection" && ranges.length !== 1) {
    throw new Error(`${label} selection scope requires one exact range`);
  }
}

export function parseAssistantContextRequest(
  value: unknown,
): AssistantContextRequest {
  const label = "AssistantContextRequest";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "requestId",
    "workId",
    "conversationId",
    "capability",
    "destinationId",
    "requiredLocalScope",
    "requiredExternalScope",
    "readRanges",
    "transmittedRanges",
  ], label);
  schema(input, label);
  const requiredLocalScope = scope(input, "requiredLocalScope", label);
  const requiredExternalScope = scope(input, "requiredExternalScope", label);
  const readRanges = parseRanges(input.readRanges, `${label}.readRanges`);
  const transmittedRanges = parseRanges(
    input.transmittedRanges,
    `${label}.transmittedRanges`,
  );
  assertScopeRanges(requiredLocalScope, readRanges, `${label}.requiredLocal`);
  assertScopeRanges(
    requiredExternalScope,
    transmittedRanges,
    `${label}.requiredExternal`,
  );
  if (
    requiredExternalScope !== "none" &&
    requiredLocalScope === "none"
  ) {
    throw new Error(`${label} cannot transmit context without local read scope`);
  }
  if (
    transmittedRanges.some((range) =>
      !readRanges.some((readRange) => rangeContains(readRange, range))
    )
  ) {
    throw new Error(`${label}.transmittedRanges must stay inside readRanges`);
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"AssistantContextRequest">(
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
    capability: capability(input, "capability", label),
    destinationId: nonEmptyString(input, "destinationId", label),
    requiredLocalScope,
    requiredExternalScope,
    readRanges,
    transmittedRanges,
  });
}

const scopeRank = new Map<AssistantContextScope, number>(
  ASSISTANT_CONTEXT_SCOPES.map((entry, index) => [entry, index]),
);

export function assistantContextScopeContains(
  granted: AssistantContextScope,
  required: AssistantContextScope,
): boolean {
  return (scopeRank.get(granted) ?? -1) >=
    (scopeRank.get(required) ?? Number.MAX_SAFE_INTEGER);
}

export function parseAssistantContextPermissionGrant(
  value: unknown,
): AssistantContextPermissionGrant {
  const label = "AssistantContextPermissionGrant";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "grantId",
    "revision",
    "workId",
    "conversationId",
    "capability",
    "destinationId",
    "localScope",
    "externalScope",
    "duration",
    "createdAt",
    "revokedAt",
    "consumedAt",
  ], label);
  schema(input, label);
  const parsedDuration = duration(input, "duration", label);
  const conversationId = nullableIdentifier<"AssistantConversation">(
    input,
    "conversationId",
    label,
  );
  if ((parsedDuration === "work") !== (conversationId === null)) {
    throw new Error(`${label}.conversationId does not match duration`);
  }
  const localScope = scope(input, "localScope", label);
  const externalScope = scope(input, "externalScope", label);
  if (localScope === "none" && externalScope === "none") {
    throw new Error(`${label} must grant at least one context capability`);
  }
  if (!assistantContextScopeContains(localScope, externalScope)) {
    throw new Error(`${label}.externalScope exceeds localScope`);
  }
  const createdAt = instant(input, "createdAt", label);
  const revokedAt = nullableInstant(input, "revokedAt", label);
  const consumedAt = nullableInstant(input, "consumedAt", label);
  if (parsedDuration !== "once" && consumedAt !== null) {
    throw new Error(`${label}.consumedAt is only valid for a once grant`);
  }
  if (
    (revokedAt !== null && Date.parse(revokedAt) < Date.parse(createdAt)) ||
    (consumedAt !== null && Date.parse(consumedAt) < Date.parse(createdAt))
  ) {
    throw new Error(`${label} lifecycle instants precede createdAt`);
  }
  return Object.freeze({
    schemaVersion: 1,
    grantId: identifier<"AssistantContextPermissionGrant">(
      input,
      "grantId",
      label,
    ),
    revision: positiveInteger(input, "revision", label),
    workId: identifier<"Work">(input, "workId", label),
    conversationId,
    capability: capability(input, "capability", label),
    destinationId: nonEmptyString(input, "destinationId", label),
    localScope,
    externalScope,
    duration: parsedDuration,
    createdAt,
    revokedAt,
    consumedAt,
  });
}

function parseDocumentVersion(
  value: unknown,
  label: string,
): AssistantContextDocumentVersion {
  const input = record(value, label);
  exact(
    input,
    ["workId", "documentId", "documentRevisionId", "length"],
    label,
  );
  return Object.freeze({
    workId: identifier<"Work">(input, "workId", label),
    documentId: identifier<"Document">(input, "documentId", label),
    documentRevisionId: identifier<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    length: nonNegativeInteger(input, "length", label),
  });
}

function availableGrant(
  grant: AssistantContextPermissionGrant,
  request: AssistantContextRequest,
): boolean {
  return grant.workId === request.workId &&
    grant.capability === request.capability &&
    grant.destinationId === request.destinationId &&
    grant.revokedAt === null &&
    !(grant.duration === "once" && grant.consumedAt !== null) &&
    (grant.duration === "work" ||
      grant.conversationId === request.conversationId);
}

export function authorizeAssistantContextRequest(input: {
  readonly request: unknown;
  readonly grants: readonly unknown[];
  readonly documents: readonly unknown[];
}): AssistantContextAuthorization {
  const request = parseAssistantContextRequest(input.request);
  const grants = input.grants.map((grant) =>
    parseAssistantContextPermissionGrant(grant)
  );
  const candidates = grants.filter((grant) => availableGrant(grant, request));
  const localGrant = request.requiredLocalScope === "none"
    ? null
    : candidates.find((grant) =>
      assistantContextScopeContains(
        grant.localScope,
        request.requiredLocalScope,
      )
    ) ?? null;
  const externalGrant = request.requiredExternalScope === "none"
    ? null
    : candidates.find((grant) =>
      assistantContextScopeContains(
        grant.externalScope,
        request.requiredExternalScope,
      )
    ) ?? null;
  const missing: AssistantContextPermissionMissing[] = [];
  if (request.requiredLocalScope !== "none" && localGrant === null) {
    missing.push("local-read");
  }
  if (request.requiredExternalScope !== "none" && externalGrant === null) {
    missing.push("external-transmit");
  }
  if (missing.length > 0) {
    return Object.freeze({
      allowed: false,
      reason: "permission-required",
      missing: Object.freeze(missing),
    });
  }

  const documents = input.documents.map((document, index) =>
    parseDocumentVersion(document, `AssistantContextDocumentVersion[${index}]`)
  );
  const documentsById = new Map<
    EntityId<"Document">,
    AssistantContextDocumentVersion
  >();
  for (const document of documents) {
    if (documentsById.has(document.documentId)) {
      throw new Error("Assistant context document versions contain a duplicate Document");
    }
    documentsById.set(document.documentId, document);
  }
  for (const range of [...request.readRanges, ...request.transmittedRanges]) {
    const document = documentsById.get(range.documentId);
    if (document === undefined) {
      return Object.freeze({
        allowed: false,
        reason: "source-unavailable",
        documentId: range.documentId,
      });
    }
    if (document.workId !== request.workId) {
      return Object.freeze({
        allowed: false,
        reason: "outside-work",
        documentId: range.documentId,
      });
    }
    if (document.documentRevisionId !== range.documentRevisionId) {
      return Object.freeze({
        allowed: false,
        reason: "stale-context",
        documentId: range.documentId,
      });
    }
    if (range.to > document.length) {
      return Object.freeze({
        allowed: false,
        reason: "invalid-range",
        documentId: range.documentId,
      });
    }
  }
  const grantIds = Object.freeze([
    ...new Set(
      [localGrant?.grantId, externalGrant?.grantId].filter(
        (grantId): grantId is EntityId<"AssistantContextPermissionGrant"> =>
          grantId !== undefined,
      ),
    ),
  ]);
  const consumedGrantIds = Object.freeze(grantIds.filter((grantId) =>
    grants.some((grant) =>
      grant.grantId === grantId && grant.duration === "once"
    )
  ));
  return Object.freeze({
    allowed: true,
    request,
    grantIds,
    consumedGrantIds,
  });
}

function countRangeCharacters(ranges: readonly AssistantContextRange[]): number {
  return ranges.reduce((sum, range) => sum + range.to - range.from, 0);
}

export function createAssistantContextReceipt(input: {
  readonly authorization: Extract<AssistantContextAuthorization, { allowed: true }>;
  readonly receiptId: string;
  readonly createdAt: string;
}): AssistantContextReceipt {
  const receiptId = entityId<"AssistantContextReceipt">(
    input.receiptId.trim(),
  );
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new Error("AssistantContextReceipt.createdAt must be a valid instant");
  }
  const request = input.authorization.request;
  return Object.freeze({
    schemaVersion: 1,
    receiptId,
    requestId: request.requestId,
    workId: request.workId,
    conversationId: request.conversationId,
    capability: request.capability,
    destinationId: request.destinationId,
    readRanges: request.readRanges,
    transmittedRanges: request.transmittedRanges,
    readCharacterCount: countRangeCharacters(request.readRanges),
    transmittedCharacterCount: countRangeCharacters(
      request.transmittedRanges,
    ),
    grantIds: input.authorization.grantIds,
    createdAt: input.createdAt,
  });
}

export function parseAssistantContextReceipt(
  value: unknown,
): AssistantContextReceipt {
  const label = "AssistantContextReceipt";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "receiptId",
    "requestId",
    "workId",
    "conversationId",
    "capability",
    "destinationId",
    "readRanges",
    "transmittedRanges",
    "readCharacterCount",
    "transmittedCharacterCount",
    "grantIds",
    "createdAt",
  ], label);
  schema(input, label);
  const readRanges = parseRanges(input.readRanges, `${label}.readRanges`);
  const transmittedRanges = parseRanges(
    input.transmittedRanges,
    `${label}.transmittedRanges`,
  );
  if (
    transmittedRanges.some((range) =>
      !readRanges.some((readRange) => rangeContains(readRange, range))
    )
  ) {
    throw new Error(`${label}.transmittedRanges must stay inside readRanges`);
  }
  const readCharacterCount = nonNegativeInteger(
    input,
    "readCharacterCount",
    label,
  );
  const transmittedCharacterCount = nonNegativeInteger(
    input,
    "transmittedCharacterCount",
    label,
  );
  if (
    readCharacterCount !== countRangeCharacters(readRanges) ||
    transmittedCharacterCount !== countRangeCharacters(transmittedRanges)
  ) {
    throw new Error(`${label} character counts do not match exact ranges`);
  }
  if (!Array.isArray(input.grantIds)) {
    throw new Error(`${label}.grantIds must be an array`);
  }
  const grantIds = Object.freeze(input.grantIds.map((grantId, index) => {
    if (typeof grantId !== "string" || grantId.trim().length === 0) {
      throw new Error(`${label}.grantIds[${index}] must be non-empty`);
    }
    return entityId<"AssistantContextPermissionGrant">(grantId.trim());
  }));
  if (new Set(grantIds).size !== grantIds.length) {
    throw new Error(`${label}.grantIds contains duplicates`);
  }
  return Object.freeze({
    schemaVersion: 1,
    receiptId: identifier<"AssistantContextReceipt">(
      input,
      "receiptId",
      label,
    ),
    requestId: identifier<"AssistantContextRequest">(
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
    capability: capability(input, "capability", label),
    destinationId: nonEmptyString(input, "destinationId", label),
    readRanges,
    transmittedRanges,
    readCharacterCount,
    transmittedCharacterCount,
    grantIds,
    createdAt: instant(input, "createdAt", label),
  });
}
