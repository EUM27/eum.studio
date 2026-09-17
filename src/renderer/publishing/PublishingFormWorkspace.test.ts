import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { PublishingFormWorkspace } from "./PublishingFormWorkspace";

const partner = Object.freeze({
  schemaVersion: 1 as const,
  partnerId: entityId<"PublishingPartner">("partner-a"),
  revision: 1,
  name: "검증 투고처",
  parentPartnerId: null,
  submissionMethod: "",
  websiteUrl: "",
  email: "",
  genres: Object.freeze([]),
  requiredLength: "",
  priority: "",
  note: "",
  sourceIds: Object.freeze([]),
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
});

const workId = entityId<"Work">("work-a");
const works = Object.freeze([Object.freeze({
  workId,
  title: "검증 작품",
  updatedAt: "2026-09-02T00:00:00.000Z",
  folders: Object.freeze([]),
  documents: Object.freeze([]),
})]);

describe("PublishingFormWorkspace", () => {
  it("offers one editable starter instead of treating a publisher sample as universal", () => {
    const markup = renderToStaticMarkup(createElement(PublishingFormWorkspace, {
      actionState: "idle",
      partners: [partner],
      templates: [],
      responses: [],
      works,
      workScopeId: null,
      onCreateTemplate: () => undefined,
      onUpdateTemplate: () => undefined,
      onSaveResponse: () => undefined,
    }));

    expect(markup).toContain("기본 템플릿 만들기");
    expect(markup).toContain("투고처별 양식");
    expect(markup).toContain("검증 투고처");
    expect(markup).not.toContain("바로나글");
  });

  it("renders publisher-defined field types and saved Work values", () => {
    const template = Object.freeze({
      schemaVersion: 1 as const,
      templateId: entityId<"PublishingFormTemplate">("template-a"),
      revision: 2,
      scope: "partner" as const,
      partnerId: partner.partnerId,
      sourceTemplateId: null,
      name: "검증 투고처 양식",
      description: "",
      sections: Object.freeze([Object.freeze({
        sectionId: "section-a",
        title: "요구 정보",
        description: "항목별 안내",
        fields: Object.freeze([
          Object.freeze({
            fieldId: "field-name",
            label: "사용자 정의 짧은 항목",
            fieldType: "text" as const,
            required: true,
            helpText: "직접 입력",
            placeholder: "입력 예시",
            options: Object.freeze([]),
          }),
          Object.freeze({
            fieldId: "field-direction",
            label: "사용자 정의 선택 항목",
            fieldType: "select" as const,
            required: false,
            helpText: "",
            placeholder: "",
            options: Object.freeze(["첫 선택", "둘째 선택"]),
          }),
        ]),
      })]),
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:01:00.000Z",
    });
    const response = Object.freeze({
      schemaVersion: 1 as const,
      responseId: entityId<"PublishingFormResponse">("response-a"),
      revision: 1,
      workId,
      partnerId: partner.partnerId,
      templateId: template.templateId,
      templateRevision: template.revision,
      answers: Object.freeze([
        Object.freeze({ fieldId: "field-name", value: "작성된 값" }),
        Object.freeze({ fieldId: "field-direction", value: "둘째 선택" }),
      ]),
      createdAt: "2026-09-02T00:02:00.000Z",
      updatedAt: "2026-09-02T00:02:00.000Z",
    });
    const markup = renderToStaticMarkup(createElement(PublishingFormWorkspace, {
      actionState: "idle",
      partners: [partner],
      templates: [template],
      responses: [response],
      works,
      workScopeId: workId,
      onCreateTemplate: () => undefined,
      onUpdateTemplate: () => undefined,
      onSaveResponse: () => undefined,
    }));

    expect(markup).toContain("양식 저장");
    expect(markup).toContain("작성 화면");
    expect(markup).toContain("사용자 정의 짧은 항목 · 필수");
    expect(markup).toContain("작성된 값");
    expect(markup).toContain("사용자 정의 선택 항목");
    expect(markup).toContain("둘째 선택");
    expect(markup).toContain("작성값 저장");
  });
});
