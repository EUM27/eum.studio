import { entityId, type EntityId } from "../../domain/writing";
import { parseCanonEntityRef, type CanonEntityRef } from "../canon/canon-entity-ref";

export const ASSISTANT_CONTEXT_MODES = ["required", "relevant", "withheld"] as const;
export type AssistantContextMode = (typeof ASSISTANT_CONTEXT_MODES)[number];

export type AssistantEntityContextPolicyProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  entity: CanonEntityRef;
  revision: number;
  mode: AssistantContextMode;
  updatedAt: string;
}>;

export type AssistantEntityContextPolicyList = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  policies: readonly AssistantEntityContextPolicyProjection[];
}>;

export type ListAssistantEntityContextPoliciesCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type SaveAssistantEntityContextPolicyCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  entity: CanonEntityRef;
  expectedRevision: number | null;
  mode: AssistantContextMode;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (Object.keys(input).length !== expected.size || Object.keys(input).some((key) => !expected.has(key))) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function id<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty identity`);
  }
  return entityId<TEntity>(value.trim());
}

function mode(value: unknown, label: string): AssistantContextMode {
  if (!(ASSISTANT_CONTEXT_MODES as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as AssistantContextMode;
}

function revision(value: unknown, label: string, allowZero = false): number {
  if (
    typeof value !== "number" || !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1)
  ) throw new Error(`${label} is invalid`);
  return value;
}

function instant(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an instant`);
  }
  return value;
}

export function parseAssistantEntityContextPolicyProjection(
  value: unknown,
): AssistantEntityContextPolicyProjection {
  const label = "AssistantEntityContextPolicyProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "entity", "revision", "mode", "updatedAt"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    entity: parseCanonEntityRef(input.entity, `${label}.entity`),
    revision: revision(input.revision, `${label}.revision`, true),
    mode: mode(input.mode, `${label}.mode`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseAssistantEntityContextPolicyList(
  value: unknown,
): AssistantEntityContextPolicyList {
  const label = "AssistantEntityContextPolicyList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "policies"], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  if (!Array.isArray(input.policies)) throw new Error(`${label}.policies must be an array`);
  const policies = Object.freeze(input.policies.map(parseAssistantEntityContextPolicyProjection));
  if (policies.some((policy) => policy.workId !== workId)) {
    throw new Error(`${label}.policies must belong to the requested Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, policies });
}

export function parseListAssistantEntityContextPoliciesCommand(
  value: unknown,
): ListAssistantEntityContextPoliciesCommand {
  const label = "ListAssistantEntityContextPoliciesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
  });
}

export function parseSaveAssistantEntityContextPolicyCommand(
  value: unknown,
): SaveAssistantEntityContextPolicyCommand {
  const label = "SaveAssistantEntityContextPolicyCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "entity", "expectedRevision", "mode"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    entity: parseCanonEntityRef(input.entity, `${label}.entity`),
    expectedRevision: input.expectedRevision === null
      ? null
      : revision(input.expectedRevision, `${label}.expectedRevision`),
    mode: mode(input.mode, `${label}.mode`),
  });
}
