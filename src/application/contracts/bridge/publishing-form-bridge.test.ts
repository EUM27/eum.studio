import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../../domain/writing";
import {
  PUBLISHING_FORM_RESPONSE_LIST_CHANNEL,
  PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL,
  PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL,
  PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL,
  PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL,
  createPublishingBridge,
} from "./publishing-bridge";

describe("publishing form bridge", () => {
  it("uses narrow template and Work-response channels", async () => {
    const template = Object.freeze({
      schemaVersion: 1 as const,
      templateId: entityId<"PublishingFormTemplate">("template-a"),
      revision: 1,
      scope: "partner" as const,
      partnerId: entityId<"PublishingPartner">("partner-a"),
      sourceTemplateId: null,
      name: "전용 양식",
      description: "",
      sections: Object.freeze([]),
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    });
    const response = Object.freeze({
      schemaVersion: 1 as const,
      responseId: entityId<"PublishingFormResponse">("response-a"),
      revision: 1,
      workId: entityId<"Work">("work-a"),
      partnerId: template.partnerId,
      templateId: template.templateId,
      templateRevision: template.revision,
      answers: Object.freeze([]),
      createdAt: "2026-09-02T00:01:00.000Z",
      updatedAt: "2026-09-02T00:01:00.000Z",
    });
    const invoke = vi.fn(async (channel: string) => {
      if (channel === PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL) {
        return { schemaVersion: 1, templates: [template] };
      }
      if (channel === PUBLISHING_FORM_RESPONSE_LIST_CHANNEL) {
        return { schemaVersion: 1, responses: [response] };
      }
      if (channel === PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL) return response;
      return template;
    });
    const bridge = createPublishingBridge(invoke);
    const create = {
      schemaVersion: 1 as const,
      scope: "partner" as const,
      partnerId: template.partnerId,
      sourceTemplateId: null,
      name: template.name,
      description: "",
      sections: [],
    };
    const update = {
      schemaVersion: 1 as const,
      templateId: template.templateId,
      expectedRevision: template.revision,
      name: template.name,
      description: "",
      sections: [],
    };
    const save = {
      schemaVersion: 1 as const,
      workId: response.workId,
      partnerId: response.partnerId,
      templateId: response.templateId,
      expectedTemplateRevision: response.templateRevision,
      expectedRevision: null,
      answers: [],
    };

    await expect(bridge.publishingFormTemplates.create(create))
      .resolves.toEqual(template);
    await expect(bridge.publishingFormTemplates.list({ schemaVersion: 1 }))
      .resolves.toEqual({ schemaVersion: 1, templates: [template] });
    await expect(bridge.publishingFormTemplates.update(update))
      .resolves.toEqual(template);
    await expect(bridge.publishingFormResponses.list({
      schemaVersion: 1,
      workId: response.workId,
    })).resolves.toEqual({ schemaVersion: 1, responses: [response] });
    await expect(bridge.publishingFormResponses.save(save))
      .resolves.toEqual(response);

    expect(invoke).toHaveBeenCalledWith(PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL, create);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL, {
      schemaVersion: 1,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL, update);
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_FORM_RESPONSE_LIST_CHANNEL, {
      schemaVersion: 1,
      workId: response.workId,
    });
    expect(invoke).toHaveBeenCalledWith(PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL, save);
  });
});
