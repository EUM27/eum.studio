import { entityId, type EntityId } from "../../domain/writing";

export type CreatePublishingPartnerCommand = {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly parentPartnerId: EntityId<"PublishingPartner"> | null;
  readonly submissionMethod: string;
  readonly websiteUrl: string;
  readonly email: string;
  readonly genres: readonly string[];
  readonly requiredLength: string;
  readonly priority: string;
  readonly note: string;
};

export type ListPublishingPartnersCommand = {
  readonly schemaVersion: 1;
};

export type UpdatePublishingPartnerCommand = {
  readonly schemaVersion: 1;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly name?: string;
    readonly parentPartnerId?: EntityId<"PublishingPartner"> | null;
    readonly submissionMethod?: string;
    readonly websiteUrl?: string;
    readonly email?: string;
    readonly genres?: readonly string[];
    readonly requiredLength?: string;
    readonly priority?: string;
    readonly note?: string;
  };
};

export type PublishingPartnerProjection = {
  readonly schemaVersion: 1;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly revision: number;
  readonly name: string;
  readonly parentPartnerId: EntityId<"PublishingPartner"> | null;
  readonly submissionMethod: string;
  readonly websiteUrl: string;
  readonly email: string;
  readonly genres: readonly string[];
  readonly requiredLength: string;
  readonly priority: string;
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublishingPartnerListProjection = {
  readonly schemaVersion: 1;
  readonly partners: readonly PublishingPartnerProjection[];
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
    if (!(field in input)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function optionalFields(
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
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
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
    throw new Error(`${label}.${field} must be a non-empty string`);
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

function nullableId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  if (input[field] === null) return null;
  return id<TEntity>(input, field, label);
}

function revision(
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

function stringArray(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value)) {
    throw new Error(`${label}.${field} must be an array`);
  }
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${label}.${field}[${index}] must be a string`);
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      throw new Error(`${label}.${field}[${index}] must be non-empty`);
    }
    return trimmed;
  }));
}

const PARTNER_FIELDS = [
  "name",
  "parentPartnerId",
  "submissionMethod",
  "websiteUrl",
  "email",
  "genres",
  "requiredLength",
  "priority",
  "note",
] as const;

function parsePartnerFields(
  input: Record<string, unknown>,
  label: string,
): Omit<CreatePublishingPartnerCommand, "schemaVersion"> {
  return Object.freeze({
    name: nonEmptyString(input, "name", label),
    parentPartnerId: nullableId<"PublishingPartner">(
      input,
      "parentPartnerId",
      label,
    ),
    submissionMethod: stringValue(input, "submissionMethod", label),
    websiteUrl: stringValue(input, "websiteUrl", label),
    email: stringValue(input, "email", label),
    genres: stringArray(input, "genres", label),
    requiredLength: stringValue(input, "requiredLength", label),
    priority: stringValue(input, "priority", label),
    note: stringValue(input, "note", label),
  });
}

export function parseCreatePublishingPartnerCommand(
  value: unknown,
): CreatePublishingPartnerCommand {
  const label = "CreatePublishingPartnerCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", ...PARTNER_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    ...parsePartnerFields(input, label),
  });
}

export function parseListPublishingPartnersCommand(
  value: unknown,
): ListPublishingPartnersCommand {
  const label = "ListPublishingPartnersCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parseUpdatePublishingPartnerCommand(
  value: unknown,
): UpdatePublishingPartnerCommand {
  const label = "UpdatePublishingPartnerCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "partnerId", "expectedRevision", "changes"],
    label,
  );
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(changesInput, PARTNER_FIELDS, changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  const changes = Object.freeze({
    ...(Object.hasOwn(changesInput, "name")
      ? { name: nonEmptyString(changesInput, "name", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "parentPartnerId")
      ? {
          parentPartnerId: nullableId<"PublishingPartner">(
            changesInput,
            "parentPartnerId",
            changesLabel,
          ),
        }
      : {}),
    ...(Object.hasOwn(changesInput, "submissionMethod")
      ? {
          submissionMethod: stringValue(
            changesInput,
            "submissionMethod",
            changesLabel,
          ),
        }
      : {}),
    ...(Object.hasOwn(changesInput, "websiteUrl")
      ? { websiteUrl: stringValue(changesInput, "websiteUrl", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "email")
      ? { email: stringValue(changesInput, "email", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "genres")
      ? { genres: stringArray(changesInput, "genres", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "requiredLength")
      ? {
          requiredLength: stringValue(
            changesInput,
            "requiredLength",
            changesLabel,
          ),
        }
      : {}),
    ...(Object.hasOwn(changesInput, "priority")
      ? { priority: stringValue(changesInput, "priority", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "note")
      ? { note: stringValue(changesInput, "note", changesLabel) }
      : {}),
  });
  return Object.freeze({
    schemaVersion: 1,
    partnerId: id<"PublishingPartner">(input, "partnerId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes,
  });
}

export function parsePublishingPartnerProjection(
  value: unknown,
): PublishingPartnerProjection {
  const label = "PublishingPartnerProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "partnerId",
      "revision",
      ...PARTNER_FIELDS,
      "sourceIds",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  schema(input, label);
  const fields = parsePartnerFields(input, label);
  return Object.freeze({
    schemaVersion: 1,
    partnerId: id<"PublishingPartner">(input, "partnerId", label),
    revision: revision(input, "revision", label),
    ...fields,
    sourceIds: stringArray(input, "sourceIds", label),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
  });
}

export function parsePublishingPartnerListProjection(
  value: unknown,
): PublishingPartnerListProjection {
  const label = "PublishingPartnerListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "partners"], label);
  schema(input, label);
  if (!Array.isArray(input.partners)) {
    throw new Error(`${label}.partners must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    partners: Object.freeze(
      input.partners.map((partner) => parsePublishingPartnerProjection(partner)),
    ),
  });
}
