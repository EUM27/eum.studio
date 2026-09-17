import type { AssistantChatMessage } from "../../../application/assistant/assistant-chat";

export type AssistantChatActionState = "idle" | "sending";

export type AssistantChatMessagesUpdate =
  | readonly AssistantChatMessage[]
  | ((current: readonly AssistantChatMessage[]) => readonly AssistantChatMessage[]);

export type AssistantChatStatePort = Readonly<{
  setMessages: (update: AssistantChatMessagesUpdate) => void;
  setActionState: (state: AssistantChatActionState) => void;
  setError: (error: string | null) => void;
}>;

export function appendAssistantChatUserMessage(
  current: readonly AssistantChatMessage[],
  message: string,
): readonly AssistantChatMessage[] {
  const userMessage = Object.freeze({
    role: "user" as const,
    text: message,
  });
  return Object.freeze([...current, userMessage]);
}

export function appendAssistantChatResponse(
  current: readonly AssistantChatMessage[],
  message: AssistantChatMessage & Readonly<{ role: "assistant" }>,
): readonly AssistantChatMessage[] {
  return Object.freeze([...current, message]);
}

export function assistantChatFailureMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "GPT 응답을 받지 못했습니다.";
}

export function clearAssistantChatErrorState(
  state: Pick<AssistantChatStatePort, "setError">,
): void {
  state.setError(null);
}
