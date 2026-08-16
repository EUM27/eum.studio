import { entityId, type EntityId } from "../../domain/writing";
import {
  ASSISTANT_CAPABILITIES,
  ASSISTANT_CONTEXT_SCOPES,
  ASSISTANT_PERMISSION_DURATIONS,
  assistantContextScopeContains,
  parseAssistantContextPermissionGrant,
  parseAssistantContextReceipt,
  type AssistantCapability,
  type AssistantContextPermissionGrant,
  type AssistantContextReceipt,
  type AssistantContextScope,
  type AssistantPermissionDuration,
} from "./assistant-context-permission";
import {
  parseAssistantVocabularyCandidate,
  type AssistantVocabularyCandidate,
} from "./assistant-vocabulary-lookup";
import {
  parseAssistantNotationCandidate,
  type AssistantNotationCandidate,
} from "./assistant-notation-review";
import {
  parseAssistantVocabularySuggestionCandidate,
  type AssistantVocabularySuggestionCandidate,
} from "./assistant-vocabulary-suggestion";
import {
  parseAssistantSettingConflictFinding,
  parseAssistantSettingReviewFinding,
  parseAssistantSettingReviewReceipt,
  type AssistantSettingConflictFinding,
  type AssistantSettingReviewFinding,
  type AssistantSettingReviewReceipt,
} from "./assistant-setting-review";
import {
  parseAssistantExternalSettingReviewCandidate,
  parseAssistantExternalSettingReviewReceipt,
  type AssistantExternalSettingReviewCandidate,
  type AssistantExternalSettingReviewReceipt,
} from "./assistant-external-setting-review";

export type ListAssistantContextStateCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
};

export type GrantAssistantContextPermissionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation"> | null;
  readonly capability: AssistantCapability;
  readonly destinationId: string;
  readonly localScope: AssistantContextScope;
  readonly externalScope: AssistantContextScope;
  readonly duration: AssistantPermissionDuration;
};

export type RevokeAssistantContextPermissionCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly grantId: EntityId<"AssistantContextPermissionGrant">;
  readonly expectedRevision: number;
};

export type AssistantContextStateProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly grants: readonly AssistantContextPermissionGrant[];
  readonly receipts: readonly AssistantContextReceipt[];
  readonly candidates: readonly AssistantVocabularyCandidate[];
  readonly notationCandidates: readonly AssistantNotationCandidate[];
  readonly vocabularySuggestionCandidates:
    readonly AssistantVocabularySuggestionCandidate[];
  readonly settingReviewReceipts: readonly AssistantSettingReviewReceipt[];
  readonly settingReviewFindings: readonly AssistantSettingReviewFinding[];
  readonly settingConflictFindings: readonly AssistantSettingConflictFinding[];
  readonly externalSettingReviewReceipts:
    readonly AssistantExternalSettingReviewReceipt[];
  readonly externalSettingReviewCandidates:
    readonly AssistantExternalSettingReviewCandidate[];
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
    throw new Error(`Unsupported ${label}.schemaVersion`);
  }
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value.trim();
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

function enumValue<T extends string>(
  input: Record<string, unknown>,
  field: string,
  values: readonly T[],
  label: string,
): T {
  const value = input[field];
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as T;
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

export function parseListAssistantContextStateCommand(
  value: unknown,
): ListAssistantContextStateCommand {
  const label = "ListAssistantContextStateCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "conversationId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
  });
}

export function parseGrantAssistantContextPermissionCommand(
  value: unknown,
): GrantAssistantContextPermissionCommand {
  const label = "GrantAssistantContextPermissionCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "conversationId",
    "capability",
    "destinationId",
    "localScope",
    "externalScope",
    "duration",
  ], label);
  schema(input, label);
  const parsedDuration = enumValue(
    input,
    "duration",
    ASSISTANT_PERMISSION_DURATIONS,
    label,
  );
  const conversationId = nullableIdentifier<"AssistantConversation">(
    input,
    "conversationId",
    label,
  );
  if ((parsedDuration === "work") !== (conversationId === null)) {
    throw new Error(`${label}.conversationId does not match duration`);
  }
  const localScope = enumValue(
    input,
    "localScope",
    ASSISTANT_CONTEXT_SCOPES,
    label,
  );
  const externalScope = enumValue(
    input,
    "externalScope",
    ASSISTANT_CONTEXT_SCOPES,
    label,
  );
  if (
    (localScope === "none" && externalScope === "none") ||
    !assistantContextScopeContains(localScope, externalScope)
  ) {
    throw new Error(`${label} context scopes are inconsistent`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    conversationId,
    capability: enumValue(
      input,
      "capability",
      ASSISTANT_CAPABILITIES,
      label,
    ),
    destinationId: nonEmptyString(input, "destinationId", label),
    localScope,
    externalScope,
    duration: parsedDuration,
  });
}

export function parseRevokeAssistantContextPermissionCommand(
  value: unknown,
): RevokeAssistantContextPermissionCommand {
  const label = "RevokeAssistantContextPermissionCommand";
  const input = record(value, label);
  exact(
    input,
    ["schemaVersion", "workId", "grantId", "expectedRevision"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    grantId: identifier<"AssistantContextPermissionGrant">(
      input,
      "grantId",
      label,
    ),
    expectedRevision: positiveInteger(input, "expectedRevision", label),
  });
}

export function parseAssistantContextStateProjection(
  value: unknown,
): AssistantContextStateProjection {
  const label = "AssistantContextStateProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "conversationId",
      "grants",
      "receipts",
      "candidates",
      "notationCandidates",
      "vocabularySuggestionCandidates",
      "settingReviewReceipts",
      "settingReviewFindings",
      "settingConflictFindings",
      "externalSettingReviewReceipts",
      "externalSettingReviewCandidates",
    ],
    label,
  );
  schema(input, label);
  const workId = identifier<"Work">(input, "workId", label);
  const conversationId = identifier<"AssistantConversation">(
    input,
    "conversationId",
    label,
  );
  if (
    !Array.isArray(input.grants) ||
    !Array.isArray(input.receipts) ||
    !Array.isArray(input.candidates) ||
    !Array.isArray(input.notationCandidates) ||
    !Array.isArray(input.vocabularySuggestionCandidates) ||
    !Array.isArray(input.settingReviewReceipts) ||
    !Array.isArray(input.settingReviewFindings) ||
    !Array.isArray(input.settingConflictFindings) ||
    !Array.isArray(input.externalSettingReviewReceipts) ||
    !Array.isArray(input.externalSettingReviewCandidates)
  ) {
    throw new Error(`${label} ledger collections must be arrays`);
  }
  const grants = Object.freeze(input.grants.map((entry, index) => {
    const grant = parseAssistantContextPermissionGrant(entry);
    if (
      grant.workId !== workId ||
      (grant.duration !== "work" && grant.conversationId !== conversationId)
    ) {
      throw new Error(`${label}.grants[${index}] is outside requested context`);
    }
    return grant;
  }));
  const receipts = Object.freeze(input.receipts.map((entry, index) => {
    const receipt = parseAssistantContextReceipt(entry);
    if (
      receipt.workId !== workId ||
      receipt.conversationId !== conversationId
    ) {
      throw new Error(`${label}.receipts[${index}] is outside requested context`);
    }
    return receipt;
  }));
  const candidates = Object.freeze(input.candidates.map((entry, index) => {
    const candidate = parseAssistantVocabularyCandidate(entry);
    if (candidate.workId !== workId) {
      throw new Error(`${label}.candidates[${index}] is outside requested Work`);
    }
    return candidate;
  }));
  const notationCandidates = Object.freeze(
    input.notationCandidates.map((entry, index) => {
      const candidate = parseAssistantNotationCandidate(entry);
      if (candidate.workId !== workId) {
        throw new Error(
          `${label}.notationCandidates[${index}] is outside requested Work`,
        );
      }
      return candidate;
    }),
  );
  const vocabularySuggestionCandidates = Object.freeze(
    input.vocabularySuggestionCandidates.map((entry, index) => {
      const candidate = parseAssistantVocabularySuggestionCandidate(entry);
      if (candidate.workId !== workId) {
        throw new Error(
          `${label}.vocabularySuggestionCandidates[${index}] is outside requested Work`,
        );
      }
      return candidate;
    }),
  );
  const settingReviewReceipts = Object.freeze(
    input.settingReviewReceipts.map((entry, index) => {
      const receipt = parseAssistantSettingReviewReceipt(entry);
      if (receipt.workId !== workId) {
        throw new Error(
          `${label}.settingReviewReceipts[${index}] is outside requested Work`,
        );
      }
      return receipt;
    }),
  );
  const settingReviewFindings = Object.freeze(
    input.settingReviewFindings.map((entry, index) => {
      const finding = parseAssistantSettingReviewFinding(entry);
      if (finding.workId !== workId) {
        throw new Error(
          `${label}.settingReviewFindings[${index}] is outside requested Work`,
        );
      }
      return finding;
    }),
  );
  const settingConflictFindings = Object.freeze(
    input.settingConflictFindings.map((entry, index) => {
      const finding = parseAssistantSettingConflictFinding(entry);
      if (finding.workId !== workId) {
        throw new Error(
          `${label}.settingConflictFindings[${index}] is outside requested Work`,
        );
      }
      return finding;
    }),
  );
  const externalSettingReviewReceipts = Object.freeze(
    input.externalSettingReviewReceipts.map((entry, index) => {
      const receipt = parseAssistantExternalSettingReviewReceipt(entry);
      if (receipt.workId !== workId) {
        throw new Error(
          `${label}.externalSettingReviewReceipts[${index}] is outside requested Work`,
        );
      }
      return receipt;
    }),
  );
  const externalSettingReviewCandidates = Object.freeze(
    input.externalSettingReviewCandidates.map((entry, index) => {
      const candidate = parseAssistantExternalSettingReviewCandidate(entry);
      if (candidate.workId !== workId) {
        throw new Error(
          `${label}.externalSettingReviewCandidates[${index}] is outside requested Work`,
        );
      }
      return candidate;
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    workId,
    conversationId,
    grants,
    receipts,
    candidates,
    notationCandidates,
    vocabularySuggestionCandidates,
    settingReviewReceipts,
    settingReviewFindings,
    settingConflictFindings,
    externalSettingReviewReceipts,
    externalSettingReviewCandidates,
  });
}
