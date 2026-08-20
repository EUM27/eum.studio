import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantChatDialog } from "./AssistantChatDialog";

describe("AssistantChatDialog", () => {
  it("shows sent and received conversation with an enabled composer", () => {
    const markup = renderToStaticMarkup(createElement(AssistantChatDialog, {
      actionState: "idle",
      error: null,
      messages: [
        { role: "user", text: "질문" },
        { role: "assistant", text: "GPT 응답" },
      ],
      oauthStatus: {
        schemaVersion: 1,
        revision: 1,
        providerId: "runtime-chatgpt",
        displayName: "GPT",
        modelId: "runtime-model",
        connected: true,
        email: null,
        planType: null,
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
      onClose: () => undefined,
      onOpenSettings: () => undefined,
      onOpenTools: () => undefined,
      onSend: () => undefined,
    }));
    expect(markup).toContain('aria-label="GPT 조수 대화"');
    expect(markup).toContain('aria-label="GPT에게 보낼 메시지"');
    expect(markup).toContain("GPT 응답");
  });
});
