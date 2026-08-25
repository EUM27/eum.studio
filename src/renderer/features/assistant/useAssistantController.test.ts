import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type {
  AssistantChatMessage,
  AssistantChatResult,
} from "../../../application/assistant/assistant-chat";
import {
  runAssistantChatMessage,
  type AssistantChatClient,
} from "./assistant-client";
import {
  clearAssistantChatErrorState,
  type AssistantChatActionState,
  type AssistantChatMessagesUpdate,
  type AssistantChatStatePort,
} from "./assistant-state";

const priorUser = Object.freeze({
  role: "user" as const,
  text: "앞선 질문",
});
const priorAssistant = Object.freeze({
  role: "assistant" as const,
  text: "앞선 응답",
});
const previousMessages = Object.freeze([priorUser, priorAssistant]);
const assistantMessage = Object.freeze({
  role: "assistant" as const,
  text: "새 응답",
});
const result = Object.freeze({
  schemaVersion: 1,
  providerId: "provider-runtime",
  modelId: "model-runtime",
  message: assistantMessage,
}) satisfies AssistantChatResult;

function createStatePort(
  initialMessages: readonly AssistantChatMessage[],
  order: string[],
) {
  let messages = initialMessages;
  let actionState: AssistantChatActionState = "idle";
  let error: string | null = "previous error";
  let usedFunctionalAppend = false;
  const state: AssistantChatStatePort = {
    setMessages: vi.fn((update: AssistantChatMessagesUpdate) => {
      if (typeof update === "function") {
        order.push("messages:functional-assistant");
        usedFunctionalAppend = true;
        messages = update(messages);
      } else {
        order.push("messages:optimistic-user");
        messages = update;
      }
    }),
    setActionState: vi.fn((next) => {
      order.push(`action:${next}`);
      actionState = next;
    }),
    setError: vi.fn((next) => {
      order.push(`error:${next ?? "null"}`);
      error = next;
    }),
  };
  return {
    state,
    snapshot: () => ({ actionState, error, messages, usedFunctionalAppend }),
  };
}

describe("assistant chat controller", () => {
  it("sends the exact frozen full history after optimistically installing the user", async () => {
    const order: string[] = [];
    let requestMessages: readonly AssistantChatMessage[] | null = null;
    const client: AssistantChatClient = {
      runChat: vi.fn(async (command) => {
        order.push("client:runChat");
        requestMessages = command.messages;
        return result;
      }),
    };
    const { state, snapshot } = createStatePort(previousMessages, order);

    await runAssistantChatMessage({
      actionState: "idle",
      client,
      currentMessages: previousMessages,
      message: "새 질문",
      state,
    });

    expect(order).toEqual([
      "messages:optimistic-user",
      "action:sending",
      "error:null",
      "client:runChat",
      "messages:functional-assistant",
      "action:idle",
    ]);
    expect(client.runChat).toHaveBeenCalledOnce();
    expect(client.runChat).toHaveBeenCalledWith({
      schemaVersion: 1,
      messages: requestMessages,
    });
    expect(requestMessages).toEqual([
      priorUser,
      priorAssistant,
      { role: "user", text: "새 질문" },
    ]);
    expect(Object.isFrozen(requestMessages)).toBe(true);
    expect(Object.isFrozen(requestMessages?.[2])).toBe(true);
    const final = snapshot();
    expect(final.messages).toEqual([
      priorUser,
      priorAssistant,
      { role: "user", text: "새 질문" },
      assistantMessage,
    ]);
    expect(final.messages[0]).toBe(priorUser);
    expect(final.messages[1]).toBe(priorAssistant);
    expect(final.messages[3]).toBe(assistantMessage);
    expect(Object.isFrozen(final.messages)).toBe(true);
    expect(final.usedFunctionalAppend).toBe(true);
    expect(final.actionState).toBe("idle");
    expect(final.error).toBeNull();
  });

  it("uses only the current sending state as its gate", async () => {
    const order: string[] = [];
    const client: AssistantChatClient = {
      runChat: vi.fn(async () => result),
    };
    const { state, snapshot } = createStatePort(previousMessages, order);
    await runAssistantChatMessage({
      actionState: "sending",
      client,
      currentMessages: previousMessages,
      message: "차단된 질문",
      state,
    });
    expect(client.runChat).not.toHaveBeenCalled();
    expect(order).toEqual([]);
    expect(snapshot().messages).toBe(previousMessages);
  });

  it("retains the optimistic user and publishes the raw Error message", async () => {
    const order: string[] = [];
    const client: AssistantChatClient = {
      runChat: vi.fn(() => Promise.reject(new Error("원본 오류"))),
    };
    const { state, snapshot } = createStatePort(previousMessages, order);
    await runAssistantChatMessage({
      actionState: "idle",
      client,
      currentMessages: previousMessages,
      message: "실패 질문",
      state,
    });
    expect(snapshot()).toMatchObject({
      actionState: "idle",
      error: "원본 오류",
      messages: [...previousMessages, { role: "user", text: "실패 질문" }],
      usedFunctionalAppend: false,
    });
    expect(order.at(-1)).toBe("action:idle");
  });

  it("uses the existing non-Error fallback and clears only the error", async () => {
    const order: string[] = [];
    const client: AssistantChatClient = {
      runChat: vi.fn(() => Promise.reject(Object.freeze({ reason: "unknown" }))),
    };
    const { state, snapshot } = createStatePort(previousMessages, order);
    await runAssistantChatMessage({
      actionState: "idle",
      client,
      currentMessages: previousMessages,
      message: "fallback 질문",
      state,
    });
    expect(snapshot().error).toBe("GPT 응답을 받지 못했습니다.");
    const setError = vi.fn();
    clearAssistantChatErrorState({ setError });
    expect(setError).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("keeps chat and workspace state in assistant slices while navigation and UI stay in their hosts", () => {
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const hookSource = readFileSync(
      new URL("./useAssistantController.ts", import.meta.url),
      "utf8",
    );
    const clientSource = readFileSync(
      new URL("./assistant-client.ts", import.meta.url),
      "utf8",
    );
    const workspaceHookSource = readFileSync(
      new URL("./useAssistantWorkspaceController.ts", import.meta.url),
      "utf8",
    );
    const dialogHostSource = readFileSync(
      new URL("./AssistantDialogHost.tsx", import.meta.url),
      "utf8",
    );
    const navigationSource = readFileSync(
      new URL("../../workspace/navigation/useWorkspaceFeatureNavigationController.ts", import.meta.url),
      "utf8",
    );
    expect(hookSource).toContain(
      "const [assistantChatDialogOpen, setAssistantChatDialogOpen] = useState(false)",
    );
    expect(hookSource).toContain("clearAssistantChatError();");
    expect(hookSource).toContain("setAssistantChatDialogOpen(true)");
    expect(hookSource).toContain("setAssistantChatDialogOpen(false)");
    expect(hookSource).toContain("useAssistantWorkspaceController(");
    expect(workspaceHookSource).toContain("assistantContextLoadSequenceRef.current");
    expect(workspaceHookSource).toContain("grantContextPermission(");
    expect(workspaceHookSource).toContain(
      "const [chatGptOAuthStatus, setChatGptOAuthStatus]",
    );
    expect(navigationSource).toContain("const openAssistantVocabularyOccurrence");
    expect(dialogHostSource).toContain("oauthStatus={controller.chatGptOAuthStatus}");
    expect(dialogHostSource).toContain("<AssistantConnectionsDialog");
    expect(dialogHostSource).toContain("<AssistantChatDialog");
    expect(appSource).not.toContain("window.eumStudio.assistant.runChat(");
    expect(clientSource).not.toContain("window.");
    expect(clientSource).not.toMatch(/persist|retry|cancel/u);
  });
});
