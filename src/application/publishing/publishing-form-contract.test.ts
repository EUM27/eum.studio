import { describe, expect, it } from "vitest";

import {
  createStarterPublishingFormSections,
  parseCreatePublishingFormTemplateCommand,
  parsePublishingFormResponseProjection,
  parsePublishingFormTemplateProjection,
  parseSavePublishingFormResponseCommand,
} from "./publishing-form-contract";

describe("publishing form contract", () => {
  it("creates an editable starter without publisher-specific fields or fixed identities", () => {
    let identity = 0;
    const sections = createStarterPublishingFormSections(() =>
      `generated-${++identity}`);

    expect(sections.map((section) => section.title)).toEqual([
      "작가 정보",
      "작품 정보",
    ]);
    expect(sections.flatMap((section) =>
      section.fields.map((field) => field.label))).toEqual([
      "필명",
      "이메일",
      "출간 이력",
      "작품명",
      "로그라인",
    ]);
    expect(new Set([
      ...sections.map((section) => section.sectionId),
      ...sections.flatMap((section) =>
        section.fields.map((field) => field.fieldId)),
    ]).size).toBe(7);
    expect(JSON.stringify(sections)).not.toContain("바로나글");
    expect(Object.isFrozen(sections)).toBe(true);
  });

  it("parses ordered sections and selectable field options without normalizing labels", () => {
    const parsed = parseCreatePublishingFormTemplateCommand({
      schemaVersion: 1,
      scope: "partner",
      partnerId: "partner-a",
      sourceTemplateId: "template-base",
      name: "전용 양식",
      description: "원문 안내를 그대로 보관",
      sections: [{
        sectionId: "section-a",
        title: "별도 작품 정보",
        description: "출판사가 요청한 순서",
        fields: [{
          fieldId: "field-a",
          label: "희망 출간 방향",
          fieldType: "select",
          required: true,
          helpText: "한 항목을 고릅니다",
          placeholder: "",
          options: ["연재", "단행"],
        }],
      }],
    });

    expect(parsed.sections[0]?.fields[0]).toEqual({
      fieldId: "field-a",
      label: "희망 출간 방향",
      fieldType: "select",
      required: true,
      helpText: "한 항목을 고릅니다",
      placeholder: "",
      options: ["연재", "단행"],
    });
    expect(Object.isFrozen(parsed.sections[0]?.fields[0])).toBe(true);
  });

  it("keeps base and partner ownership explicit", () => {
    expect(() => parseCreatePublishingFormTemplateCommand({
      schemaVersion: 1,
      scope: "base",
      partnerId: "partner-a",
      sourceTemplateId: null,
      name: "잘못된 기본 양식",
      description: "",
      sections: [],
    })).toThrow("base template cannot belong to a partner");

    expect(() => parseCreatePublishingFormTemplateCommand({
      schemaVersion: 1,
      scope: "partner",
      partnerId: null,
      sourceTemplateId: null,
      name: "잘못된 전용 양식",
      description: "",
      sections: [],
    })).toThrow("partner template must belong to a partner");
  });

  it("parses a template projection and an editable Work-owned response", () => {
    const template = parsePublishingFormTemplateProjection({
      schemaVersion: 1,
      templateId: "template-a",
      revision: 2,
      scope: "partner",
      partnerId: "partner-a",
      sourceTemplateId: "template-base",
      name: "전용 양식",
      description: "",
      sections: [{
        sectionId: "section-a",
        title: "작가 정보",
        description: "",
        fields: [{
          fieldId: "field-a",
          label: "필명",
          fieldType: "text",
          required: false,
          helpText: "",
          placeholder: "",
          options: [],
        }],
      }],
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:01:00.000Z",
    });
    const command = parseSavePublishingFormResponseCommand({
      schemaVersion: 1,
      workId: "work-a",
      partnerId: "partner-a",
      templateId: template.templateId,
      expectedTemplateRevision: template.revision,
      expectedRevision: null,
      answers: [{ fieldId: "field-a", value: "은하" }],
    });
    const response = parsePublishingFormResponseProjection({
      schemaVersion: 1,
      responseId: "response-a",
      revision: 1,
      workId: command.workId,
      partnerId: command.partnerId,
      templateId: command.templateId,
      templateRevision: command.expectedTemplateRevision,
      answers: command.answers,
      createdAt: "2026-09-02T00:02:00.000Z",
      updatedAt: "2026-09-02T00:02:00.000Z",
    });

    expect(response.answers).toEqual([{ fieldId: "field-a", value: "은하" }]);
    expect(Object.isFrozen(response.answers)).toBe(true);
  });
});
