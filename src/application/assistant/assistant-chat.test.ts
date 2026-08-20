import { describe, expect, it } from "vitest";

import {
  parseAssistantChatResult,
  parseRunAssistantChatCommand,
} from "./assistant-chat";

describe("assistant chat contract", () => {
  it("keeps the exact conversation and returned GPT message", () => {
    const command = parseRunAssistantChatCommand({
      schemaVersion: 1,
      messages: [
        { role: "user", text: "첫 질문" },
        { role: "assistant", text: "첫 답변" },
        { role: "user", text: "다음 질문" },
      ],
    });
    expect(command.messages).toEqual([
      { role: "user", text: "첫 질문" },
      { role: "assistant", text: "첫 답변" },
      { role: "user", text: "다음 질문" },
    ]);

    expect(parseAssistantChatResult({
      schemaVersion: 1,
      providerId: "chatgpt",
      modelId: "model-a",
      message: { role: "assistant", text: "실제 응답" },
    }).message.text).toBe("실제 응답");
  });
});
