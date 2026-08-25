import { useCallback, useState } from "react";

import type { AssistantChatMessage } from "../../../application/assistant/assistant-chat";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import {
  runAssistantChatMessage,
  type AssistantChatClient,
} from "./assistant-client";
import {
  clearAssistantChatErrorState,
  type AssistantChatActionState,
} from "./assistant-state";
import {
  useAssistantWorkspaceController,
  type AssistantWorkspaceControllerInput,
} from "./useAssistantWorkspaceController";

type AssistantControllerWorkspaceInput = Omit<
  AssistantWorkspaceControllerInput,
  "client"
>;

export function useAssistantController(input:
  | Readonly<{
      client: StudioBridge["assistant"];
      workspace: AssistantControllerWorkspaceInput;
    }>
  | Readonly<{
      client: AssistantChatClient;
      workspace?: undefined;
    }>) {
  const workspaceController = useAssistantWorkspaceController(
    input.workspace === undefined
      ? null
      : {
          ...input.workspace,
          client: input.client,
        },
  );
  const [assistantChatDialogOpen, setAssistantChatDialogOpen] = useState(false);
  const [assistantChatMessages, setAssistantChatMessages] = useState<
    readonly AssistantChatMessage[]
  >([]);
  const [assistantChatActionState, setAssistantChatActionState] =
    useState<AssistantChatActionState>("idle");
  const [assistantChatError, setAssistantChatError] = useState<string | null>(
    null,
  );

  const runAssistantChat = useCallback(
    (message: string) => runAssistantChatMessage({
      actionState: assistantChatActionState,
      client: input.client,
      currentMessages: assistantChatMessages,
      message,
      state: {
        setMessages: setAssistantChatMessages,
        setActionState: setAssistantChatActionState,
        setError: setAssistantChatError,
      },
    }),
    [assistantChatActionState, assistantChatMessages, input.client],
  );

  const clearAssistantChatError = useCallback(() => {
    clearAssistantChatErrorState({ setError: setAssistantChatError });
  }, []);

  const openAssistantChatDialog = useCallback(() => {
    clearAssistantChatError();
    setAssistantChatDialogOpen(true);
  }, [clearAssistantChatError]);

  const closeAssistantChatDialog = useCallback(() => {
    if (assistantChatActionState !== "idle") return;
    setAssistantChatDialogOpen(false);
    clearAssistantChatError();
  }, [assistantChatActionState, clearAssistantChatError]);

  const hideAssistantChatDialog = useCallback(() => {
    setAssistantChatDialogOpen(false);
  }, []);

  return {
    ...workspaceController,
    assistantChatDialogOpen,
    assistantChatMessages,
    assistantChatActionState,
    assistantChatError,
    runAssistantChat,
    clearAssistantChatError,
    openAssistantChatDialog,
    closeAssistantChatDialog,
    hideAssistantChatDialog,
  };
}
