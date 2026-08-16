import { entityId, type EntityId } from "../../domain/writing";
import {
  assistantContextScopeContains,
  parseAssistantContextPermissionGrant,
  type AssistantContextPermissionGrant,
  type AssistantContextPermissionMissing,
} from "./assistant-context-permission";

export const ASSISTANT_SETTING_KINDS = [
  "character",
  "plot",
  "foreshadow",
] as const;

export type AssistantSettingKind = (typeof ASSISTANT_SETTING_KINDS)[number];

export type RunAssistantSettingReviewCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantSettingReviewRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
};

export type AssistantSettingReference = {
  readonly kind: AssistantSettingKind;
  readonly entityId: string;
  readonly revision: number;
};

export type AssistantSettingField = {
  readonly field: string;
  readonly value: string;
};

export type AssistantSettingReviewSource = AssistantSettingReference & {
  readonly workId: EntityId<"Work">;
  readonly label: string;
  readonly fields: readonly AssistantSettingField[];
};

export type AssistantSettingReviewReceipt = {
  readonly schemaVersion: 1;
  readonly receiptId: EntityId<"AssistantSettingReviewReceipt">;
  readonly requestId: EntityId<"AssistantSettingReviewRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly capability: "lore-review";
  readonly destinationId: string;
  readonly reviewedSettings: readonly AssistantSettingReference[];
  readonly transmittedSettingCount: 0;
  readonly grantIds: readonly EntityId<"AssistantContextPermissionGrant">[];
  readonly createdAt: string;
};

export type AssistantSettingReviewFinding = {
  readonly schemaVersion: 1;
  readonly findingId: EntityId<"AssistantSettingReviewFinding">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
  readonly kind: "duplicate";
  readonly settingKind: AssistantSettingKind;
  readonly label: string;
  readonly references: readonly AssistantSettingReference[];
  readonly receiptId: EntityId<"AssistantSettingReviewReceipt">;
  readonly createdAt: string;
};

export type AssistantSettingConflictFinding = {
  readonly schemaVersion: 1;
  readonly findingId: EntityId<"AssistantSettingConflictFinding">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
  readonly kind: "conflict";
  readonly settingKind: AssistantSettingKind;
  readonly label: string;
  readonly field: string;
  readonly references: readonly AssistantSettingReference[];
  readonly receiptId: EntityId<"AssistantSettingReviewReceipt">;
  readonly createdAt: string;
};

export type AssistantSettingDuplicateGroup = {
  readonly settingKind: AssistantSettingKind;
  readonly label: string;
  readonly references: readonly AssistantSettingReference[];
};

export type AssistantSettingConflictGroup = AssistantSettingDuplicateGroup & {
  readonly field: string;
};

export type AssistantSettingReviewAuthorization =
  | Readonly<{
      allowed: false;
      reason: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
    }>
  | Readonly<{
      allowed: true;
      command: RunAssistantSettingReviewCommand;
      settings: readonly AssistantSettingReviewSource[];
      grantIds: readonly EntityId<"AssistantContextPermissionGrant">[];
      consumedGrantIds: readonly EntityId<"AssistantContextPermissionGrant">[];
    }>;

export type AssistantSettingReviewResult =
  | Readonly<{
      schemaVersion: 1;
      status: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "reviewed";
      receipt: AssistantSettingReviewReceipt;
      findings: readonly AssistantSettingReviewFinding[];
      conflicts: readonly AssistantSettingConflictFinding[];
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

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
  preserve = false,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return preserve ? value : value.trim();
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
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
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

function settingKind(
  input: Record<string, unknown>,
  field: string,
  label: string,
): AssistantSettingKind {
  const value = input[field];
  if (!ASSISTANT_SETTING_KINDS.includes(value as AssistantSettingKind)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as AssistantSettingKind;
}

function parseSettingReference(
  value: unknown,
  label: string,
): AssistantSettingReference {
  const input = record(value, label);
  exact(input, ["kind", "entityId", "revision"], label);
  return Object.freeze({
    kind: settingKind(input, "kind", label),
    entityId: nonEmptyString(input, "entityId", label),
    revision: positiveInteger(input, "revision", label),
  });
}

function parseSettingReferences(
  value: unknown,
  label: string,
): readonly AssistantSettingReference[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const references = Object.freeze(
    value.map((entry, index) =>
      parseSettingReference(entry, `${label}[${index}]`)
    ),
  );
  const identities = references.map((reference) =>
    `${reference.kind}\u001f${reference.entityId}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error(`${label} contains duplicate setting references`);
  }
  return references;
}

function parseSettingFields(
  value: unknown,
  label: string,
): readonly AssistantSettingField[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const fields = Object.freeze(value.map((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    const input = record(entry, entryLabel);
    exact(input, ["field", "value"], entryLabel);
    if (typeof input.value !== "string") {
      throw new Error(`${entryLabel}.value must be a string`);
    }
    return Object.freeze({
      field: nonEmptyString(input, "field", entryLabel),
      value: input.value,
    });
  }));
  if (new Set(fields.map((field) => field.field)).size !== fields.length) {
    throw new Error(`${label} contains duplicate fields`);
  }
  return fields;
}

function parseGrantIds(
  value: unknown,
  label: string,
): readonly EntityId<"AssistantContextPermissionGrant">[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const ids = Object.freeze(value.map((entry, index) => {
    const input = { value: entry };
    return identifier<"AssistantContextPermissionGrant">(
      input,
      "value",
      `${label}[${index}]`,
    );
  }));
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return ids;
}

export function parseRunAssistantSettingReviewCommand(
  value: unknown,
): RunAssistantSettingReviewCommand {
  const label = "RunAssistantSettingReviewCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "requestId",
    "workId",
    "conversationId",
    "destinationId",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"AssistantSettingReviewRequest">(
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
    destinationId: nonEmptyString(input, "destinationId", label),
  });
}

export function parseAssistantSettingReviewSource(
  value: unknown,
): AssistantSettingReviewSource {
  const label = "AssistantSettingReviewSource";
  const input = record(value, label);
  exact(input, [
    "kind",
    "entityId",
    "revision",
    "workId",
    "label",
    "fields",
  ], label);
  return Object.freeze({
    ...parseSettingReference({
      kind: input.kind,
      entityId: input.entityId,
      revision: input.revision,
    }, label),
    workId: identifier<"Work">(input, "workId", label),
    label: nonEmptyString(input, "label", label, true),
    fields: parseSettingFields(input.fields, `${label}.fields`),
  });
}

function availableGrant(
  grant: AssistantContextPermissionGrant,
  command: RunAssistantSettingReviewCommand,
): boolean {
  return grant.workId === command.workId &&
    grant.capability === "lore-review" &&
    grant.destinationId === command.destinationId &&
    grant.revokedAt === null &&
    !(grant.duration === "once" && grant.consumedAt !== null) &&
    (grant.duration === "work" || grant.conversationId === command.conversationId) &&
    assistantContextScopeContains(grant.localScope, "work");
}

export function authorizeAssistantSettingReview(input: {
  readonly command: unknown;
  readonly grants: readonly unknown[];
  readonly settings: readonly unknown[];
}): AssistantSettingReviewAuthorization {
  const command = parseRunAssistantSettingReviewCommand(input.command);
  const grants = input.grants.map((grant) =>
    parseAssistantContextPermissionGrant(grant)
  );
  const grant = grants.find((entry) => availableGrant(entry, command));
  if (grant === undefined) {
    return Object.freeze({
      allowed: false,
      reason: "permission-required",
      missing: Object.freeze(["local-read"] as const),
    });
  }
  const settings = Object.freeze(input.settings.map((entry) =>
    parseAssistantSettingReviewSource(entry)
  ));
  for (const setting of settings) {
    if (setting.workId !== command.workId) {
      throw new Error("Assistant setting review source is outside requested Work");
    }
  }
  const identities = settings.map((setting) =>
    `${setting.kind}\u001f${setting.entityId}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("Assistant setting review sources contain duplicate identities");
  }
  return Object.freeze({
    allowed: true,
    command,
    settings,
    grantIds: Object.freeze([grant.grantId]),
    consumedGrantIds: Object.freeze(
      grant.duration === "once" ? [grant.grantId] : [],
    ),
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function findExactDuplicateSettingGroups(
  settings: readonly AssistantSettingReviewSource[],
): readonly AssistantSettingDuplicateGroup[] {
  const grouped = new Map<string, AssistantSettingReviewSource[]>();
  for (const setting of settings) {
    const identity = `${setting.kind}\u001f${setting.label}`;
    const current = grouped.get(identity) ?? [];
    current.push(setting);
    grouped.set(identity, current);
  }
  return Object.freeze(
    [...grouped.values()]
      .filter((entries) => entries.length > 1)
      .sort((left, right) =>
        compareText(left[0]!.kind, right[0]!.kind) ||
        compareText(left[0]!.label, right[0]!.label)
      )
      .map((entries) => Object.freeze({
        settingKind: entries[0]!.kind,
        label: entries[0]!.label,
        references: Object.freeze(
          entries
            .map(({ kind, entityId, revision }) => ({
              kind,
              entityId,
              revision,
            }))
            .sort((left, right) => compareText(left.entityId, right.entityId))
            .map((reference) => Object.freeze(reference)),
        ),
      })),
  );
}

export function findExactSettingConflictGroups(
  settings: readonly AssistantSettingReviewSource[],
): readonly AssistantSettingConflictGroup[] {
  const duplicateGroups = new Map<string, AssistantSettingReviewSource[]>();
  for (const setting of settings) {
    const identity = `${setting.kind}\u001f${setting.label}`;
    const current = duplicateGroups.get(identity) ?? [];
    current.push(setting);
    duplicateGroups.set(identity, current);
  }
  const conflicts: AssistantSettingConflictGroup[] = [];
  for (const entries of duplicateGroups.values()) {
    if (entries.length < 2) continue;
    const fieldNames = [...new Set(entries.flatMap((entry) =>
      entry.fields.map((field) => field.field)
    ))].sort(compareText);
    for (const field of fieldNames) {
      const values = entries.flatMap((entry) => {
        const value = entry.fields.find((candidate) => candidate.field === field)?.value;
        return value === undefined || value.length === 0 ? [] : [value];
      });
      if (values.length < 2 || new Set(values).size < 2) continue;
      conflicts.push(Object.freeze({
        settingKind: entries[0]!.kind,
        label: entries[0]!.label,
        field,
        references: Object.freeze(entries
          .filter((entry) => {
            const value = entry.fields.find((candidate) =>
              candidate.field === field
            )?.value;
            return value !== undefined && value.length > 0;
          })
          .map(({ kind, entityId, revision }) => Object.freeze({
            kind,
            entityId,
            revision,
          }))
          .sort((left, right) => compareText(left.entityId, right.entityId))),
      }));
    }
  }
  return Object.freeze(conflicts.sort((left, right) =>
    compareText(left.settingKind, right.settingKind) ||
    compareText(left.label, right.label) ||
    compareText(left.field, right.field)
  ));
}

export function createAssistantSettingReviewReceipt(input: {
  readonly authorization: Extract<AssistantSettingReviewAuthorization, { allowed: true }>;
  readonly receiptId: string;
  readonly createdAt: string;
}): AssistantSettingReviewReceipt {
  return parseAssistantSettingReviewReceipt({
    schemaVersion: 1,
    receiptId: input.receiptId,
    requestId: input.authorization.command.requestId,
    workId: input.authorization.command.workId,
    conversationId: input.authorization.command.conversationId,
    capability: "lore-review",
    destinationId: input.authorization.command.destinationId,
    reviewedSettings: input.authorization.settings.map(
      ({ kind, entityId, revision }) => ({ kind, entityId, revision }),
    ),
    transmittedSettingCount: 0,
    grantIds: input.authorization.grantIds,
    createdAt: input.createdAt,
  });
}

export function parseAssistantSettingReviewReceipt(
  value: unknown,
): AssistantSettingReviewReceipt {
  const label = "AssistantSettingReviewReceipt";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "receiptId",
    "requestId",
    "workId",
    "conversationId",
    "capability",
    "destinationId",
    "reviewedSettings",
    "transmittedSettingCount",
    "grantIds",
    "createdAt",
  ], label);
  schema(input, label);
  if (input.capability !== "lore-review") {
    throw new Error(`${label}.capability is unsupported`);
  }
  if (input.transmittedSettingCount !== 0) {
    throw new Error(`${label}.transmittedSettingCount must be zero`);
  }
  return Object.freeze({
    schemaVersion: 1,
    receiptId: identifier<"AssistantSettingReviewReceipt">(
      input,
      "receiptId",
      label,
    ),
    requestId: identifier<"AssistantSettingReviewRequest">(
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
    capability: "lore-review",
    destinationId: nonEmptyString(input, "destinationId", label),
    reviewedSettings: parseSettingReferences(
      input.reviewedSettings,
      `${label}.reviewedSettings`,
    ),
    transmittedSettingCount: 0,
    grantIds: parseGrantIds(input.grantIds, `${label}.grantIds`),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseAssistantSettingReviewFinding(
  value: unknown,
): AssistantSettingReviewFinding {
  const label = "AssistantSettingReviewFinding";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "findingId",
    "workId",
    "conversationId",
    "destinationId",
    "kind",
    "settingKind",
    "label",
    "references",
    "receiptId",
    "createdAt",
  ], label);
  schema(input, label);
  if (input.kind !== "duplicate") {
    throw new Error(`${label}.kind is unsupported`);
  }
  const parsedSettingKind = settingKind(input, "settingKind", label);
  const references = parseSettingReferences(
    input.references,
    `${label}.references`,
  );
  if (
    references.length < 2 ||
    references.some((reference) => reference.kind !== parsedSettingKind)
  ) {
    throw new Error(`${label}.references do not describe an exact duplicate group`);
  }
  return Object.freeze({
    schemaVersion: 1,
    findingId: identifier<"AssistantSettingReviewFinding">(
      input,
      "findingId",
      label,
    ),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    destinationId: nonEmptyString(input, "destinationId", label),
    kind: "duplicate",
    settingKind: parsedSettingKind,
    label: nonEmptyString(input, "label", label, true),
    references,
    receiptId: identifier<"AssistantSettingReviewReceipt">(
      input,
      "receiptId",
      label,
    ),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseAssistantSettingConflictFinding(
  value: unknown,
): AssistantSettingConflictFinding {
  const label = "AssistantSettingConflictFinding";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "findingId",
    "workId",
    "conversationId",
    "destinationId",
    "kind",
    "settingKind",
    "label",
    "field",
    "references",
    "receiptId",
    "createdAt",
  ], label);
  schema(input, label);
  if (input.kind !== "conflict") {
    throw new Error(`${label}.kind is unsupported`);
  }
  const parsedSettingKind = settingKind(input, "settingKind", label);
  const references = parseSettingReferences(
    input.references,
    `${label}.references`,
  );
  if (
    references.length < 2 ||
    references.some((reference) => reference.kind !== parsedSettingKind)
  ) {
    throw new Error(`${label}.references do not describe an exact conflict group`);
  }
  return Object.freeze({
    schemaVersion: 1,
    findingId: identifier<"AssistantSettingConflictFinding">(
      input,
      "findingId",
      label,
    ),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    destinationId: nonEmptyString(input, "destinationId", label),
    kind: "conflict",
    settingKind: parsedSettingKind,
    label: nonEmptyString(input, "label", label, true),
    field: nonEmptyString(input, "field", label),
    references,
    receiptId: identifier<"AssistantSettingReviewReceipt">(
      input,
      "receiptId",
      label,
    ),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseAssistantSettingReviewResult(
  value: unknown,
): AssistantSettingReviewResult {
  const label = "AssistantSettingReviewResult";
  const input = record(value, label);
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing"], label);
    schema(input, label);
    if (
      !Array.isArray(input.missing) ||
      input.missing.some((entry) => entry !== "local-read")
    ) {
      throw new Error(`${label}.missing contains an unsupported value`);
    }
    return Object.freeze({
      schemaVersion: 1,
      status: "permission-required",
      missing: Object.freeze(input.missing),
    });
  }
  exact(
    input,
    ["schemaVersion", "status", "receipt", "findings", "conflicts"],
    label,
  );
  schema(input, label);
  if (
    input.status !== "reviewed" ||
    !Array.isArray(input.findings) ||
    !Array.isArray(input.conflicts)
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  const receipt = parseAssistantSettingReviewReceipt(input.receipt);
  const findings = Object.freeze(input.findings.map((entry) => {
    const finding = parseAssistantSettingReviewFinding(entry);
    if (
      finding.workId !== receipt.workId ||
      finding.conversationId !== receipt.conversationId ||
      finding.destinationId !== receipt.destinationId ||
      finding.receiptId !== receipt.receiptId
    ) {
      throw new Error(`${label}.findings are outside the review receipt`);
    }
    return finding;
  }));
  const conflicts = Object.freeze(input.conflicts.map((entry) => {
    const finding = parseAssistantSettingConflictFinding(entry);
    if (
      finding.workId !== receipt.workId ||
      finding.conversationId !== receipt.conversationId ||
      finding.destinationId !== receipt.destinationId ||
      finding.receiptId !== receipt.receiptId
    ) {
      throw new Error(`${label}.conflicts are outside the review receipt`);
    }
    return finding;
  }));
  return Object.freeze({
    schemaVersion: 1,
    status: "reviewed",
    receipt,
    findings,
    conflicts,
  });
}
