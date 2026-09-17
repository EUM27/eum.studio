import { entityId, type EntityId } from "../../domain/writing";

export const PUBLISHING_FORM_FIELD_TYPES = Object.freeze([
  "text",
  "email",
  "textarea",
  "number",
  "date",
  "select",
] as const);

export type PublishingFormFieldType =
  (typeof PUBLISHING_FORM_FIELD_TYPES)[number];

export type PublishingFormFieldDefinition = Readonly<{
  fieldId: string;
  label: string;
  fieldType: PublishingFormFieldType;
  required: boolean;
  helpText: string;
  placeholder: string;
  options: readonly string[];
}>;

export type PublishingFormSectionDefinition = Readonly<{
  sectionId: string;
  title: string;
  description: string;
  fields: readonly PublishingFormFieldDefinition[];
}>;

export type PublishingFormTemplateScope = "base" | "partner";

export type CreatePublishingFormTemplateCommand = Readonly<{
  schemaVersion: 1;
  scope: PublishingFormTemplateScope;
  partnerId: EntityId<"PublishingPartner"> | null;
  sourceTemplateId: EntityId<"PublishingFormTemplate"> | null;
  name: string;
  description: string;
  sections: readonly PublishingFormSectionDefinition[];
}>;

export type ListPublishingFormTemplatesCommand = Readonly<{
  schemaVersion: 1;
}>;

export type UpdatePublishingFormTemplateCommand = Readonly<{
  schemaVersion: 1;
  templateId: EntityId<"PublishingFormTemplate">;
  expectedRevision: number;
  name: string;
  description: string;
  sections: readonly PublishingFormSectionDefinition[];
}>;

export type PublishingFormTemplateProjection = Readonly<{
  schemaVersion: 1;
  templateId: EntityId<"PublishingFormTemplate">;
  revision: number;
  scope: PublishingFormTemplateScope;
  partnerId: EntityId<"PublishingPartner"> | null;
  sourceTemplateId: EntityId<"PublishingFormTemplate"> | null;
  name: string;
  description: string;
  sections: readonly PublishingFormSectionDefinition[];
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingFormTemplateListProjection = Readonly<{
  schemaVersion: 1;
  templates: readonly PublishingFormTemplateProjection[];
}>;

export type PublishingFormAnswer = Readonly<{
  fieldId: string;
  value: string;
}>;

export type ListPublishingFormResponsesCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work"> | null;
}>;

export type SavePublishingFormResponseCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  partnerId: EntityId<"PublishingPartner">;
  templateId: EntityId<"PublishingFormTemplate">;
  expectedTemplateRevision: number;
  expectedRevision: number | null;
  answers: readonly PublishingFormAnswer[];
}>;

export type PublishingFormResponseProjection = Readonly<{
  schemaVersion: 1;
  responseId: EntityId<"PublishingFormResponse">;
  revision: number;
  workId: EntityId<"Work">;
  partnerId: EntityId<"PublishingPartner">;
  templateId: EntityId<"PublishingFormTemplate">;
  templateRevision: number;
  answers: readonly PublishingFormAnswer[];
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingFormResponseListProjection = Readonly<{
  schemaVersion: 1;
  responses: readonly PublishingFormResponseProjection[];
}>;

type IdFactory = () => string;

export function createStarterPublishingFormSections(
  createId: IdFactory,
): readonly PublishingFormSectionDefinition[] {
  const field = (
    label: string,
    fieldType: PublishingFormFieldType,
  ): PublishingFormFieldDefinition => Object.freeze({
    fieldId: createId(),
    label,
    fieldType,
    required: false,
    helpText: "",
    placeholder: "",
    options: Object.freeze([]),
  });
  return Object.freeze([
    Object.freeze({
      sectionId: createId(),
      title: "작가 정보",
      description: "",
      fields: Object.freeze([
        field("필명", "text"),
        field("이메일", "email"),
        field("출간 이력", "textarea"),
      ]),
    }),
    Object.freeze({
      sectionId: createId(),
      title: "작품 정보",
      description: "",
      fields: Object.freeze([
        field("작품명", "text"),
        field("로그라인", "textarea"),
      ]),
    }),
  ]);
}

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
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function nonEmptyText(value: unknown, label: string): string {
  const parsed = text(value, label).trim();
  if (parsed.length === 0) throw new Error(`${label} must be non-empty`);
  return parsed;
}

function identity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyText(value, label));
}

function nullableIdentity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> | null {
  return value === null ? null : identity<TEntity>(value, label);
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  return value === null ? null : positiveInteger(value, label);
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
  return value;
}

function parseFieldType(value: unknown, label: string): PublishingFormFieldType {
  if (
    typeof value !== "string" ||
    !PUBLISHING_FORM_FIELD_TYPES.includes(value as PublishingFormFieldType)
  ) {
    throw new Error(`${label} is not a supported field type`);
  }
  return value as PublishingFormFieldType;
}

function parseOptions(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const options = value.map((entry, index) =>
    nonEmptyText(entry, `${label}[${index}]`));
  if (new Set(options).size !== options.length) {
    throw new Error(`${label} contains duplicate options`);
  }
  return Object.freeze(options);
}

export function parsePublishingFormFieldDefinition(
  value: unknown,
  label = "PublishingFormFieldDefinition",
): PublishingFormFieldDefinition {
  const input = record(value, label);
  exact(input, [
    "fieldId",
    "label",
    "fieldType",
    "required",
    "helpText",
    "placeholder",
    "options",
  ], label);
  const fieldType = parseFieldType(input.fieldType, `${label}.fieldType`);
  const options = parseOptions(input.options, `${label}.options`);
  if (fieldType === "select" ? options.length === 0 : options.length !== 0) {
    throw new Error(
      fieldType === "select"
        ? `${label}.options must contain at least one option for select fields`
        : `${label}.options must be empty unless the field type is select`,
    );
  }
  return Object.freeze({
    fieldId: nonEmptyText(input.fieldId, `${label}.fieldId`),
    label: nonEmptyText(input.label, `${label}.label`),
    fieldType,
    required: booleanValue(input.required, `${label}.required`),
    helpText: text(input.helpText, `${label}.helpText`),
    placeholder: text(input.placeholder, `${label}.placeholder`),
    options,
  });
}

export function parsePublishingFormSections(
  value: unknown,
  label = "PublishingFormSections",
): readonly PublishingFormSectionDefinition[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const fieldIds = new Set<string>();
  const sections = value.map((entry, sectionIndex) => {
    const sectionLabel = `${label}[${sectionIndex}]`;
    const input = record(entry, sectionLabel);
    exact(input, ["sectionId", "title", "description", "fields"], sectionLabel);
    if (!Array.isArray(input.fields)) {
      throw new Error(`${sectionLabel}.fields must be an array`);
    }
    const fields = input.fields.map((field, fieldIndex) => {
      const parsed = parsePublishingFormFieldDefinition(
        field,
        `${sectionLabel}.fields[${fieldIndex}]`,
      );
      if (fieldIds.has(parsed.fieldId)) {
        throw new Error(`${label} contains duplicate field identities`);
      }
      fieldIds.add(parsed.fieldId);
      return parsed;
    });
    return Object.freeze({
      sectionId: nonEmptyText(input.sectionId, `${sectionLabel}.sectionId`),
      title: nonEmptyText(input.title, `${sectionLabel}.title`),
      description: text(input.description, `${sectionLabel}.description`),
      fields: Object.freeze(fields),
    });
  });
  if (new Set(sections.map((section) => section.sectionId)).size !== sections.length) {
    throw new Error(`${label} contains duplicate section identities`);
  }
  return Object.freeze(sections);
}

function scope(value: unknown, label: string): PublishingFormTemplateScope {
  if (value !== "base" && value !== "partner") {
    throw new Error(`${label} must be base or partner`);
  }
  return value;
}

function assertTemplateOwnership(input: Readonly<{
  scope: PublishingFormTemplateScope;
  partnerId: EntityId<"PublishingPartner"> | null;
  sourceTemplateId: EntityId<"PublishingFormTemplate"> | null;
}>, label: string): void {
  if (input.scope === "base") {
    if (input.partnerId !== null || input.sourceTemplateId !== null) {
      throw new Error(`${label} base template cannot belong to a partner or source`);
    }
    return;
  }
  if (input.partnerId === null) {
    throw new Error(`${label} partner template must belong to a partner`);
  }
}

export function parseCreatePublishingFormTemplateCommand(
  value: unknown,
): CreatePublishingFormTemplateCommand {
  const label = "CreatePublishingFormTemplateCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "scope",
    "partnerId",
    "sourceTemplateId",
    "name",
    "description",
    "sections",
  ], label);
  schema(input, label);
  const parsed = Object.freeze({
    schemaVersion: 1 as const,
    scope: scope(input.scope, `${label}.scope`),
    partnerId: nullableIdentity<"PublishingPartner">(
      input.partnerId,
      `${label}.partnerId`,
    ),
    sourceTemplateId: nullableIdentity<"PublishingFormTemplate">(
      input.sourceTemplateId,
      `${label}.sourceTemplateId`,
    ),
    name: nonEmptyText(input.name, `${label}.name`),
    description: text(input.description, `${label}.description`),
    sections: parsePublishingFormSections(input.sections, `${label}.sections`),
  });
  assertTemplateOwnership(parsed, label);
  return parsed;
}

export function parseListPublishingFormTemplatesCommand(
  value: unknown,
): ListPublishingFormTemplatesCommand {
  const label = "ListPublishingFormTemplatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parseUpdatePublishingFormTemplateCommand(
  value: unknown,
): UpdatePublishingFormTemplateCommand {
  const label = "UpdatePublishingFormTemplateCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "templateId",
    "expectedRevision",
    "name",
    "description",
    "sections",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    templateId: identity<"PublishingFormTemplate">(
      input.templateId,
      `${label}.templateId`,
    ),
    expectedRevision: positiveInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    name: nonEmptyText(input.name, `${label}.name`),
    description: text(input.description, `${label}.description`),
    sections: parsePublishingFormSections(input.sections, `${label}.sections`),
  });
}

export function parsePublishingFormTemplateProjection(
  value: unknown,
): PublishingFormTemplateProjection {
  const label = "PublishingFormTemplateProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "templateId",
    "revision",
    "scope",
    "partnerId",
    "sourceTemplateId",
    "name",
    "description",
    "sections",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  const parsed = Object.freeze({
    schemaVersion: 1 as const,
    templateId: identity<"PublishingFormTemplate">(
      input.templateId,
      `${label}.templateId`,
    ),
    revision: positiveInteger(input.revision, `${label}.revision`),
    scope: scope(input.scope, `${label}.scope`),
    partnerId: nullableIdentity<"PublishingPartner">(
      input.partnerId,
      `${label}.partnerId`,
    ),
    sourceTemplateId: nullableIdentity<"PublishingFormTemplate">(
      input.sourceTemplateId,
      `${label}.sourceTemplateId`,
    ),
    name: nonEmptyText(input.name, `${label}.name`),
    description: text(input.description, `${label}.description`),
    sections: parsePublishingFormSections(input.sections, `${label}.sections`),
    createdAt: nonEmptyText(input.createdAt, `${label}.createdAt`),
    updatedAt: nonEmptyText(input.updatedAt, `${label}.updatedAt`),
  });
  assertTemplateOwnership(parsed, label);
  return parsed;
}

export function parsePublishingFormTemplateListProjection(
  value: unknown,
): PublishingFormTemplateListProjection {
  const label = "PublishingFormTemplateListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "templates"], label);
  schema(input, label);
  if (!Array.isArray(input.templates)) {
    throw new Error(`${label}.templates must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    templates: Object.freeze(
      input.templates.map(parsePublishingFormTemplateProjection),
    ),
  });
}

function parseAnswer(value: unknown, label: string): PublishingFormAnswer {
  const input = record(value, label);
  exact(input, ["fieldId", "value"], label);
  return Object.freeze({
    fieldId: nonEmptyText(input.fieldId, `${label}.fieldId`),
    value: text(input.value, `${label}.value`),
  });
}

function parseAnswers(value: unknown, label: string): readonly PublishingFormAnswer[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const answers = value.map((answer, index) =>
    parseAnswer(answer, `${label}[${index}]`));
  if (new Set(answers.map((answer) => answer.fieldId)).size !== answers.length) {
    throw new Error(`${label} contains duplicate field identities`);
  }
  return Object.freeze(answers);
}

export function parseListPublishingFormResponsesCommand(
  value: unknown,
): ListPublishingFormResponsesCommand {
  const label = "ListPublishingFormResponsesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: nullableIdentity<"Work">(input.workId, `${label}.workId`),
  });
}

export function parseSavePublishingFormResponseCommand(
  value: unknown,
): SavePublishingFormResponseCommand {
  const label = "SavePublishingFormResponseCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "partnerId",
    "templateId",
    "expectedTemplateRevision",
    "expectedRevision",
    "answers",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identity<"Work">(input.workId, `${label}.workId`),
    partnerId: identity<"PublishingPartner">(
      input.partnerId,
      `${label}.partnerId`,
    ),
    templateId: identity<"PublishingFormTemplate">(
      input.templateId,
      `${label}.templateId`,
    ),
    expectedTemplateRevision: positiveInteger(
      input.expectedTemplateRevision,
      `${label}.expectedTemplateRevision`,
    ),
    expectedRevision: nullablePositiveInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    answers: parseAnswers(input.answers, `${label}.answers`),
  });
}

export function parsePublishingFormResponseProjection(
  value: unknown,
): PublishingFormResponseProjection {
  const label = "PublishingFormResponseProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "responseId",
    "revision",
    "workId",
    "partnerId",
    "templateId",
    "templateRevision",
    "answers",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    responseId: identity<"PublishingFormResponse">(
      input.responseId,
      `${label}.responseId`,
    ),
    revision: positiveInteger(input.revision, `${label}.revision`),
    workId: identity<"Work">(input.workId, `${label}.workId`),
    partnerId: identity<"PublishingPartner">(
      input.partnerId,
      `${label}.partnerId`,
    ),
    templateId: identity<"PublishingFormTemplate">(
      input.templateId,
      `${label}.templateId`,
    ),
    templateRevision: positiveInteger(
      input.templateRevision,
      `${label}.templateRevision`,
    ),
    answers: parseAnswers(input.answers, `${label}.answers`),
    createdAt: nonEmptyText(input.createdAt, `${label}.createdAt`),
    updatedAt: nonEmptyText(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parsePublishingFormResponseListProjection(
  value: unknown,
): PublishingFormResponseListProjection {
  const label = "PublishingFormResponseListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "responses"], label);
  schema(input, label);
  if (!Array.isArray(input.responses)) {
    throw new Error(`${label}.responses must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    responses: Object.freeze(
      input.responses.map(parsePublishingFormResponseProjection),
    ),
  });
}
