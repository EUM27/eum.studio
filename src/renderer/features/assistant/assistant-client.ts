import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import {
  appendAssistantChatResponse,
  appendAssistantChatUserMessage,
  assistantChatFailureMessage,
  type AssistantChatActionState,
  type AssistantChatStatePort,
} from "./assistant-state";
import type { AssistantChatMessage } from "../../../application/assistant/assistant-chat";

export type AssistantChatClient = Pick<
  StudioBridge["assistant"],
  "runChat"
>;

export async function runAssistantChatMessage(input: Readonly<{
  actionState: AssistantChatActionState;
  client: AssistantChatClient;
  currentMessages: readonly AssistantChatMessage[];
  message: string;
  state: AssistantChatStatePort;
}>): Promise<void> {
  if (input.actionState !== "idle") return;
  const nextMessages = appendAssistantChatUserMessage(
    input.currentMessages,
    input.message,
  );
  input.state.setMessages(nextMessages);
  input.state.setActionState("sending");
  input.state.setError(null);
  try {
    const result = await input.client.runChat({
      schemaVersion: 1,
      messages: nextMessages,
    });
    input.state.setMessages((current) =>
      appendAssistantChatResponse(current, result.message)
    );
  } catch (reason) {
    input.state.setError(assistantChatFailureMessage(reason));
  } finally {
    input.state.setActionState("idle");
  }
}
