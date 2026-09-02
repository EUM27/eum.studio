import { useMemo, useState, type ChangeEvent } from "react";

import {
  createStarterPublishingFormSections,
  type CreatePublishingFormTemplateCommand,
  type PublishingFormFieldDefinition,
  type PublishingFormFieldType,
  type PublishingFormResponseProjection,
  type PublishingFormSectionDefinition,
  type PublishingFormTemplateProjection,
  type SavePublishingFormResponseCommand,
  type UpdatePublishingFormTemplateCommand,
} from "../../application/publishing/publishing-form-contract";
import type { PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import type { WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import type { PublishingPartnerDialogActionState } from "./PublishingPartnerDialog";

type TemplateCreateDraft = Omit<
  CreatePublishingFormTemplateCommand,
  "schemaVersion"
>;
type TemplateUpdateDraft = Omit<
  UpdatePublishingFormTemplateCommand,
  "schemaVersion" | "templateId" | "expectedRevision"
>;
type ResponseSaveDraft = Omit<
  SavePublishingFormResponseCommand,
  "schemaVersion" | "expectedRevision"
>;

const FIELD_TYPE_LABELS: Readonly<Record<PublishingFormFieldType, string>> =
  Object.freeze({
    text: "짧은 글",
    email: "이메일",
    textarea: "여러 줄 글",
    number: "숫자",
    date: "날짜",
    select: "선택 항목",
  });

function createId(): string {
  return globalThis.crypto.randomUUID();
}

function move<T>(values: readonly T[], from: number, to: number): readonly T[] {
  if (to < 0 || to >= values.length || from === to) return values;
  const next = [...values];
  const [value] = next.splice(from, 1);
  if (value === undefined) return values;
  next.splice(to, 0, value);
  return Object.freeze(next);
}

function replaceSection(
  sections: readonly PublishingFormSectionDefinition[],
  sectionId: string,
  update: (
    section: PublishingFormSectionDefinition,
  ) => PublishingFormSectionDefinition,
): readonly PublishingFormSectionDefinition[] {
  return Object.freeze(sections.map((section) =>
    section.sectionId === sectionId ? Object.freeze(update(section)) : section));
}

function TemplateEditor(input: Readonly<{
  actionState: PublishingPartnerDialogActionState;
  template: PublishingFormTemplateProjection;
  onUpdate: (
    template: PublishingFormTemplateProjection,
    changes: TemplateUpdateDraft,
  ) => void;
}>) {
  const [name, setName] = useState(input.template.name);
  const [description, setDescription] = useState(input.template.description);
  const [sections, setSections] = useState(input.template.sections);
  const busy = input.actionState !== "idle";
  const valid = name.trim().length > 0 && sections.every((section) =>
    section.title.trim().length > 0 && section.fields.every((field) =>
      field.label.trim().length > 0 &&
      (field.fieldType !== "select" || (
        field.options.length > 0 &&
        new Set(field.options).size === field.options.length
      ))));

  const updateField = (
    sectionId: string,
    fieldId: string,
    changes: Partial<PublishingFormFieldDefinition>,
  ) => {
    setSections((current) => replaceSection(current, sectionId, (section) => ({
      ...section,
      fields: Object.freeze(section.fields.map((field) =>
        field.fieldId === fieldId
          ? Object.freeze({ ...field, ...changes })
          : field)),
    })));
  };

  return (
    <form
      className="publishing-form-template-editor"
      onSubmit={(event) => {
        event.preventDefault();
        input.onUpdate(input.template, { name, description, sections });
      }}
    >
      <header className="publishing-form-editor-heading">
        <div>
          <strong>
            {input.template.scope === "base" ? "기본 템플릿" : "투고처 전용 양식"}
          </strong>
          <small>revision {input.template.revision}</small>
        </div>
        <button
          disabled={busy || !valid}
          type="submit"
        >
          {input.actionState === "updating-form-template" ? "저장 중" : "양식 저장"}
        </button>
      </header>
      <div className="publishing-partner-field-grid">
        <label>
          <span>양식 이름</span>
          <input
            aria-label="투고 양식 이름"
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label>
          <span>양식 설명</span>
          <input
            aria-label="투고 양식 설명"
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="이 양식을 언제 사용하는지 적습니다"
            value={description}
          />
        </label>
      </div>
      <div className="publishing-form-section-list">
        {sections.map((section, sectionIndex) => (
          <section className="publishing-form-section-card" key={section.sectionId}>
            <header>
              <input
                aria-label={`구역 ${sectionIndex + 1} 이름`}
                disabled={busy}
                onChange={(event) => setSections((current) =>
                  replaceSection(current, section.sectionId, (value) => ({
                    ...value,
                    title: event.target.value,
                  })))}
                value={section.title}
              />
              <div>
                <button
                  aria-label={`${section.title} 위로 이동`}
                  disabled={busy || sectionIndex === 0}
                  onClick={() => setSections((current) =>
                    move(current, sectionIndex, sectionIndex - 1))}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`${section.title} 아래로 이동`}
                  disabled={busy || sectionIndex === sections.length - 1}
                  onClick={() => setSections((current) =>
                    move(current, sectionIndex, sectionIndex + 1))}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label={`${section.title} 구역 삭제`}
                  disabled={busy}
                  onClick={() => setSections((current) => Object.freeze(
                    current.filter((value) => value.sectionId !== section.sectionId),
                  ))}
                  type="button"
                >
                  구역 삭제
                </button>
              </div>
            </header>
            <input
              aria-label={`${section.title} 안내문`}
              disabled={busy}
              onChange={(event) => setSections((current) =>
                replaceSection(current, section.sectionId, (value) => ({
                  ...value,
                  description: event.target.value,
                })))}
              placeholder="구역 안내문"
              value={section.description}
            />
            <div className="publishing-form-field-list">
              {section.fields.map((field, fieldIndex) => (
                <article className="publishing-form-field-card" key={field.fieldId}>
                  <div className="publishing-form-field-row">
                    <label>
                      <span>항목 이름</span>
                      <input
                        aria-label={`${section.title} 항목 ${fieldIndex + 1} 이름`}
                        disabled={busy}
                        onChange={(event) => updateField(
                          section.sectionId,
                          field.fieldId,
                          { label: event.target.value },
                        )}
                        value={field.label}
                      />
                    </label>
                    <label>
                      <span>입력 종류</span>
                      <select
                        aria-label={`${field.label} 입력 종류`}
                        disabled={busy}
                        onChange={(event) => {
                          const fieldType = event.target.value as PublishingFormFieldType;
                          updateField(section.sectionId, field.fieldId, {
                            fieldType,
                            options: Object.freeze([]),
                          });
                        }}
                        value={field.fieldType}
                      >
                        {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="publishing-form-required-field">
                      <input
                        aria-label={`${field.label} 필수 항목`}
                        checked={field.required}
                        disabled={busy}
                        onChange={(event) => updateField(
                          section.sectionId,
                          field.fieldId,
                          { required: event.target.checked },
                        )}
                        type="checkbox"
                      />
                      필수
                    </label>
                  </div>
                  <div className="publishing-form-field-row">
                    <label>
                      <span>안내문</span>
                      <input
                        aria-label={`${field.label} 안내문`}
                        disabled={busy}
                        onChange={(event) => updateField(
                          section.sectionId,
                          field.fieldId,
                          { helpText: event.target.value },
                        )}
                        value={field.helpText}
                      />
                    </label>
                    <label>
                      <span>입력 예시</span>
                      <input
                        aria-label={`${field.label} 입력 예시`}
                        disabled={busy}
                        onChange={(event) => updateField(
                          section.sectionId,
                          field.fieldId,
                          { placeholder: event.target.value },
                        )}
                        value={field.placeholder}
                      />
                    </label>
                    {field.fieldType === "select" && (
                      <label>
                        <span>선택값</span>
                        <textarea
                          aria-label={`${field.label} 선택값`}
                          disabled={busy}
                          onChange={(event) => updateField(
                            section.sectionId,
                            field.fieldId,
                            {
                              options: Object.freeze(event.target.value
                                .split(/\r?\n/u)
                                .map((value) => value.trim())
                                .filter((value) => value.length > 0)),
                            },
                          )}
                          rows={2}
                          value={field.options.join("\n")}
                        />
                      </label>
                    )}
                  </div>
                  <div className="publishing-form-field-actions">
                    <button
                      aria-label={`${field.label} 위로 이동`}
                      disabled={busy || fieldIndex === 0}
                      onClick={() => setSections((current) =>
                        replaceSection(current, section.sectionId, (value) => ({
                          ...value,
                          fields: move(value.fields, fieldIndex, fieldIndex - 1),
                        })))}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`${field.label} 아래로 이동`}
                      disabled={busy || fieldIndex === section.fields.length - 1}
                      onClick={() => setSections((current) =>
                        replaceSection(current, section.sectionId, (value) => ({
                          ...value,
                          fields: move(value.fields, fieldIndex, fieldIndex + 1),
                        })))}
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setSections((current) =>
                        replaceSection(current, section.sectionId, (value) => ({
                          ...value,
                          fields: Object.freeze(value.fields.filter(
                            (candidate) => candidate.fieldId !== field.fieldId,
                          )),
                        })))}
                      type="button"
                    >
                      항목 삭제
                    </button>
                  </div>
                </article>
              ))}
              <button
                disabled={busy}
                onClick={() => setSections((current) =>
                  replaceSection(current, section.sectionId, (value) => ({
                    ...value,
                    fields: Object.freeze([
                      ...value.fields,
                      Object.freeze({
                        fieldId: createId(),
                        label: "새 항목",
                        fieldType: "text" as const,
                        required: false,
                        helpText: "",
                        placeholder: "",
                        options: Object.freeze([]),
                      }),
                    ]),
                  })))}
                type="button"
              >
                항목 추가
              </button>
            </div>
          </section>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={() => setSections((current) => Object.freeze([
          ...current,
          Object.freeze({
            sectionId: createId(),
            title: "새 구역",
            description: "",
            fields: Object.freeze([]),
          }),
        ]))}
        type="button"
      >
        구역 추가
      </button>
    </form>
  );
}

function ResponseEditor(input: Readonly<{
  actionState: PublishingPartnerDialogActionState;
  response: PublishingFormResponseProjection | null;
  template: PublishingFormTemplateProjection;
  workId: EntityId<"Work">;
  onSave: (
    draft: ResponseSaveDraft,
    current: PublishingFormResponseProjection | null,
  ) => void;
}>) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(input.response?.answers.map((answer) => [
      answer.fieldId,
      answer.value,
    ]) ?? []));
  const busy = input.actionState !== "idle";
  const stale = input.response !== null &&
    input.response.templateRevision !== input.template.revision;
  const partnerId = input.template.partnerId;
  if (partnerId === null) {
    throw new Error("Publishing form response requires a partner template");
  }

  return (
    <form
      className="publishing-form-response-editor"
      onSubmit={(event) => {
        event.preventDefault();
        input.onSave({
          workId: input.workId,
          partnerId,
          templateId: input.template.templateId,
          expectedTemplateRevision: input.template.revision,
          answers: Object.freeze(input.template.sections.flatMap((section) =>
            section.fields.map((field) => Object.freeze({
              fieldId: field.fieldId,
              value: answers[field.fieldId] ?? "",
            })))),
        }, input.response);
      }}
    >
      <header className="publishing-form-editor-heading">
        <div>
          <strong>작성 화면</strong>
          <small>이 작품과 투고처에만 저장됩니다.</small>
        </div>
        <button disabled={busy} type="submit">
          {input.actionState === "saving-form-response" ? "저장 중" : "작성값 저장"}
        </button>
      </header>
      {stale && (
        <p className="publishing-form-stale-note" role="status">
          양식이 변경되었습니다. 기존 항목은 유지하고 새 항목을 확인해 주세요.
        </p>
      )}
      {input.template.sections.map((section) => (
        <section className="publishing-form-response-section" key={section.sectionId}>
          <h3>{section.title}</h3>
          {section.description.length > 0 && <p>{section.description}</p>}
          <div className="publishing-form-response-fields">
            {section.fields.map((field) => {
              const common = {
                disabled: busy,
                id: `publishing-form-${field.fieldId}`,
                onChange: (
                  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
                ) => setAnswers((current) => ({
                  ...current,
                  [field.fieldId]: event.target.value,
                })),
                value: answers[field.fieldId] ?? "",
              };
              return (
                <label key={field.fieldId}>
                  <span>
                    {field.label}
                    {field.required ? " · 필수" : ""}
                  </span>
                  {field.fieldType === "textarea" ? (
                    <textarea {...common} placeholder={field.placeholder} rows={5} />
                  ) : field.fieldType === "select" ? (
                    <select {...common}>
                      <option value="">선택하지 않음</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...common}
                      placeholder={field.placeholder}
                      type={field.fieldType}
                    />
                  )}
                  {field.helpText.length > 0 && <small>{field.helpText}</small>}
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </form>
  );
}

export function PublishingFormWorkspace(input: Readonly<{
  actionState: PublishingPartnerDialogActionState;
  partners: readonly PublishingPartnerProjection[];
  templates: readonly PublishingFormTemplateProjection[];
  responses: readonly PublishingFormResponseProjection[];
  works: WorkspaceCatalogProjection["works"];
  workScopeId: EntityId<"Work"> | null;
  onCreateTemplate: (draft: TemplateCreateDraft) => void;
  onUpdateTemplate: (
    template: PublishingFormTemplateProjection,
    changes: TemplateUpdateDraft,
  ) => void;
  onSaveResponse: (
    draft: ResponseSaveDraft,
    current: PublishingFormResponseProjection | null,
  ) => void;
}>) {
  const baseTemplate = input.templates.find((template) =>
    template.scope === "base") ?? null;
  const firstPartnerTemplate = input.templates.find((template) =>
    template.scope === "partner" && template.partnerId !== null);
  const initialOwner = baseTemplate === null
    ? firstPartnerTemplate?.partnerId ?? "base"
    : "base";
  const [owner, setOwner] = useState<string>(initialOwner);
  const [workId, setWorkId] = useState<string>(
    input.workScopeId ?? input.works[0]?.workId ?? "",
  );
  const selectedPartner = input.partners.find((partner) =>
    partner.partnerId === owner) ?? null;
  const selectedTemplate = owner === "base"
    ? baseTemplate
    : input.templates.find((template) =>
        template.scope === "partner" && template.partnerId === owner) ?? null;
  const selectedResponse = useMemo(() =>
    selectedPartner === null || workId.length === 0
      ? null
      : input.responses.find((response) =>
          response.workId === workId &&
          response.partnerId === selectedPartner.partnerId) ?? null,
  [input.responses, selectedPartner, workId]);
  const busy = input.actionState !== "idle";

  return (
    <div className="publishing-partner-body publishing-form-workspace">
      <section aria-label="투고 양식 대상" className="publishing-partner-list">
        <button
          aria-pressed={owner === "base"}
          disabled={busy}
          onClick={() => setOwner("base")}
          type="button"
        >
          <strong>{baseTemplate?.name ?? "기본 투고 양식"}</strong>
          <small>모든 투고처 양식의 출발점</small>
        </button>
        <h3>투고처별 양식</h3>
        {input.partners.length === 0 && (
          <p className="publishing-partner-empty">먼저 투고처를 등록해 주세요.</p>
        )}
        <ul>
          {input.partners.map((partner) => {
            const template = input.templates.find((candidate) =>
              candidate.scope === "partner" &&
              candidate.partnerId === partner.partnerId);
            return (
              <li key={partner.partnerId}>
                <button
                  aria-pressed={owner === partner.partnerId}
                  disabled={busy}
                  onClick={() => setOwner(partner.partnerId)}
                  type="button"
                >
                  <strong>{partner.name}</strong>
                  <small>{template === undefined ? "양식 없음" : template.name}</small>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-label="투고 양식 편집" className="publishing-partner-detail">
        {owner === "base" && baseTemplate === null ? (
          <section className="publishing-form-empty-state">
            <h3>기본 투고 양식</h3>
            <p>
              공통 항목으로 시작한 뒤 출판사별 양식에서 자유롭게 바꿀 수 있습니다.
            </p>
            <button
              disabled={busy}
              onClick={() => input.onCreateTemplate({
                scope: "base",
                partnerId: null,
                sourceTemplateId: null,
                name: "기본 투고 양식",
                description: "",
                sections: createStarterPublishingFormSections(createId),
              })}
              type="button"
            >
              기본 템플릿 만들기
            </button>
          </section>
        ) : selectedPartner !== null && selectedTemplate === null ? (
          <section className="publishing-form-empty-state">
            <h3>{selectedPartner.name} 전용 양식</h3>
            {baseTemplate === null ? (
              <p>먼저 기본 템플릿을 만들어 주세요.</p>
            ) : (
              <>
                <p>
                  기본 템플릿을 복제한 뒤 이 투고처가 요구하는 항목만 바꿉니다.
                </p>
                <button
                  disabled={busy}
                  onClick={() => input.onCreateTemplate({
                    scope: "partner",
                    partnerId: selectedPartner.partnerId,
                    sourceTemplateId: baseTemplate.templateId,
                    name: `${selectedPartner.name} 투고 양식`,
                    description: "",
                    sections: baseTemplate.sections,
                  })}
                  type="button"
                >
                  기본 템플릿에서 만들기
                </button>
              </>
            )}
          </section>
        ) : selectedTemplate !== null ? (
          <>
            <TemplateEditor
              actionState={input.actionState}
              key={`${selectedTemplate.templateId}-${selectedTemplate.revision}`}
              onUpdate={input.onUpdateTemplate}
              template={selectedTemplate}
            />
            {selectedTemplate.scope === "partner" && (
              <section className="publishing-form-response-shell">
                <label>
                  <span>작성할 작품</span>
                  <select
                    aria-label="투고 양식 작성 작품"
                    disabled={busy || input.workScopeId !== null}
                    onChange={(event) => setWorkId(event.target.value)}
                    value={workId}
                  >
                    <option value="">작품 선택</option>
                    {input.works.map((work) => (
                      <option key={work.workId} value={work.workId}>
                        {work.title || "제목없음"}
                      </option>
                    ))}
                  </select>
                </label>
                {workId.length === 0 ? (
                  <p className="publishing-partner-empty">작성값을 저장할 작품을 선택해 주세요.</p>
                ) : (
                  <ResponseEditor
                    actionState={input.actionState}
                    key={`${workId}-${selectedTemplate.templateId}-${selectedTemplate.revision}-${selectedResponse?.revision ?? 0}`}
                    onSave={input.onSaveResponse}
                    response={selectedResponse}
                    template={selectedTemplate}
                    workId={entityId<"Work">(workId)}
                  />
                )}
              </section>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
