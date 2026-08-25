import {
  parseAssistantContextPermissionGrant,
  type AssistantContextPermissionGrant,
} from "../../assistant/assistant-context-permission";
import {
  parseAssistantConnectionListProjection,
  parseAssistantConnectionProjection,
  parseDeleteAssistantConnectionCommand,
  parseSaveAssistantConnectionCommand,
  type AssistantConnectionListProjection,
  type AssistantConnectionProjection,
  type DeleteAssistantConnectionCommand,
  type SaveAssistantConnectionCommand,
} from "../../assistant/assistant-connection";
import {
  parseAssistantContextStateProjection,
  parseGrantAssistantContextPermissionCommand,
  parseListAssistantContextStateCommand,
  parseRevokeAssistantContextPermissionCommand,
  type AssistantContextStateProjection,
  type GrantAssistantContextPermissionCommand,
  type ListAssistantContextStateCommand,
  type RevokeAssistantContextPermissionCommand,
} from "../../assistant/assistant-context-state";
import {
  parseAssistantConnectorManifestProfile,
  type AssistantConnectorManifestProfile,
} from "../../assistant/assistant-connector-manifest";
import {
  parseAssistantDestinationProfile,
  type AssistantDestinationProfile,
} from "../../assistant/assistant-destination-profile";
import {
  parseAssistantExternalSettingReviewResult,
  parseRunAssistantExternalSettingReviewCommand,
  type AssistantExternalSettingReviewResult,
  type RunAssistantExternalSettingReviewCommand,
} from "../../assistant/assistant-external-setting-review";
import {
  parseAssistantNotationReviewResult,
  parseRunAssistantNotationReviewCommand,
  type AssistantNotationReviewResult,
  type RunAssistantNotationReviewCommand,
} from "../../assistant/assistant-notation-review";
import {
  parseAssistantSettingReviewResult,
  parseRunAssistantSettingReviewCommand,
  type AssistantSettingReviewResult,
  type RunAssistantSettingReviewCommand,
} from "../../assistant/assistant-setting-review";
import {
  parseAssistantVocabularyLookupResult,
  parseRunAssistantVocabularyLookupCommand,
  type AssistantVocabularyLookupResult,
  type RunAssistantVocabularyLookupCommand,
} from "../../assistant/assistant-vocabulary-lookup";
import {
  parseAssistantVocabularySuggestionResult,
  parseRunAssistantVocabularySuggestionCommand,
  type AssistantVocabularySuggestionResult,
  type RunAssistantVocabularySuggestionCommand,
} from "../../assistant/assistant-vocabulary-suggestion";
import {
  parseAssistantChatResult,
  parseRunAssistantChatCommand,
  type AssistantChatResult,
  type RunAssistantChatCommand,
} from "../../assistant/assistant-chat";
import {
  parseChatGptOAuthConnectionStatus,
  type ChatGptOAuthConnectionStatus,
} from "../../assistant/chatgpt-oauth";

export const ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL =
  "studio:assistant:chatgpt-oauth-status";
export const ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL =
  "studio:assistant:chatgpt-oauth-start-login";
export const ASSISTANT_CHAT_RUN_CHANNEL = "studio:assistant:chat-run";
export const ASSISTANT_LIST_CONTEXT_STATE_CHANNEL =
  "studio:assistant:list-context-state";
export const ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL =
  "studio:assistant:grant-context-permission";
export const ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL =
  "studio:assistant:revoke-context-permission";
export const ASSISTANT_DESTINATION_PROFILE_CHANNEL =
  "studio:assistant:get-destination-profile";
export const ASSISTANT_CONNECTOR_PROFILE_CHANNEL =
  "studio:assistant:get-connector-profile";
export const ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL =
  "studio:assistant:run-vocabulary-lookup";
export const ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL =
  "studio:assistant:run-vocabulary-suggestion";
export const ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL =
  "studio:assistant:run-external-setting-review";
export const ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL =
  "studio:assistant:run-notation-review";
export const ASSISTANT_RUN_SETTING_REVIEW_CHANNEL =
  "studio:assistant:run-setting-review";
export const ASSISTANT_LIST_CONNECTIONS_CHANNEL =
  "studio:assistant:list-connections";
export const ASSISTANT_SAVE_CONNECTION_CHANNEL =
  "studio:assistant:save-connection";
export const ASSISTANT_DELETE_CONNECTION_CHANNEL =
  "studio:assistant:delete-connection";

export type AssistantBridgeChannel =
  | typeof ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL
  | typeof ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL
  | typeof ASSISTANT_CHAT_RUN_CHANNEL
  | typeof ASSISTANT_LIST_CONTEXT_STATE_CHANNEL
  | typeof ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL
  | typeof ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL
  | typeof ASSISTANT_DESTINATION_PROFILE_CHANNEL
  | typeof ASSISTANT_CONNECTOR_PROFILE_CHANNEL
  | typeof ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL
  | typeof ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL
  | typeof ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL
  | typeof ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL
  | typeof ASSISTANT_RUN_SETTING_REVIEW_CHANNEL
  | typeof ASSISTANT_LIST_CONNECTIONS_CHANNEL
  | typeof ASSISTANT_SAVE_CONNECTION_CHANNEL
  | typeof ASSISTANT_DELETE_CONNECTION_CHANNEL;

export type AssistantBridgePayload =
  | RunAssistantChatCommand
  | ListAssistantContextStateCommand
  | GrantAssistantContextPermissionCommand
  | RevokeAssistantContextPermissionCommand
  | RunAssistantVocabularyLookupCommand
  | RunAssistantVocabularySuggestionCommand
  | RunAssistantExternalSettingReviewCommand
  | RunAssistantNotationReviewCommand
  | RunAssistantSettingReviewCommand
  | SaveAssistantConnectionCommand
  | DeleteAssistantConnectionCommand;

export type AssistantBridge = Readonly<{
  getChatGptOAuthStatus: () => Promise<ChatGptOAuthConnectionStatus>;
  startChatGptOAuthLogin: () => Promise<ChatGptOAuthConnectionStatus>;
  runChat: (command: RunAssistantChatCommand) => Promise<AssistantChatResult>;
  listConnections: () => Promise<AssistantConnectionListProjection>;
  saveConnection: (
    command: SaveAssistantConnectionCommand,
  ) => Promise<AssistantConnectionProjection>;
  deleteConnection: (command: DeleteAssistantConnectionCommand) => Promise<void>;
  getConnectorProfile: () => Promise<AssistantConnectorManifestProfile>;
  getDestinationProfile: () => Promise<AssistantDestinationProfile>;
  listContextState: (
    command: ListAssistantContextStateCommand,
  ) => Promise<AssistantContextStateProjection>;
  grantContextPermission: (
    command: GrantAssistantContextPermissionCommand,
  ) => Promise<AssistantContextPermissionGrant>;
  revokeContextPermission: (
    command: RevokeAssistantContextPermissionCommand,
  ) => Promise<AssistantContextPermissionGrant>;
  runVocabularyLookup: (
    command: RunAssistantVocabularyLookupCommand,
  ) => Promise<AssistantVocabularyLookupResult>;
  runVocabularySuggestion: (
    command: RunAssistantVocabularySuggestionCommand,
  ) => Promise<AssistantVocabularySuggestionResult>;
  runExternalSettingReview: (
    command: RunAssistantExternalSettingReviewCommand,
  ) => Promise<AssistantExternalSettingReviewResult>;
  runNotationReview: (
    command: RunAssistantNotationReviewCommand,
  ) => Promise<AssistantNotationReviewResult>;
  runSettingReview: (
    command: RunAssistantSettingReviewCommand,
  ) => Promise<AssistantSettingReviewResult>;
}>;

export type AssistantBridgeInvoke = (
  channel: AssistantBridgeChannel,
  payload?: AssistantBridgePayload,
) => Promise<unknown>;

export function createAssistantBridge(
  invoke: AssistantBridgeInvoke,
): AssistantBridge {
  return Object.freeze({
    getChatGptOAuthStatus: async () => {
      const value = await invoke(ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL);
      try {
        return parseChatGptOAuthConnectionStatus(value);
      } catch {
        throw new Error("Invalid ChatGPT OAuth connection status");
      }
    },
    startChatGptOAuthLogin: async () => {
      const value = await invoke(ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL);
      try {
        return parseChatGptOAuthConnectionStatus(value);
      } catch {
        throw new Error("Invalid ChatGPT OAuth login result");
      }
    },
    runChat: async (input) => {
      const command = parseRunAssistantChatCommand(input);
      const value = await invoke(ASSISTANT_CHAT_RUN_CHANNEL, command);
      try {
        return parseAssistantChatResult(value);
      } catch {
        throw new Error("Invalid assistant chat result");
      }
    },
    listConnections: async () => {
      const value = await invoke(ASSISTANT_LIST_CONNECTIONS_CHANNEL);
      try {
        return parseAssistantConnectionListProjection(value);
      } catch {
        throw new Error("Invalid assistant connection list projection");
      }
    },
    saveConnection: async (input) => {
      const command = parseSaveAssistantConnectionCommand(input);
      const value = await invoke(ASSISTANT_SAVE_CONNECTION_CHANNEL, command);
      try {
        return parseAssistantConnectionProjection(value);
      } catch {
        throw new Error("Invalid saved assistant connection projection");
      }
    },
    deleteConnection: async (input) => {
      const command = parseDeleteAssistantConnectionCommand(input);
      const value = await invoke(ASSISTANT_DELETE_CONNECTION_CHANNEL, command);
      if (value !== undefined) {
        throw new Error("Invalid assistant connection deletion result");
      }
    },
    getConnectorProfile: async () => {
      const value = await invoke(ASSISTANT_CONNECTOR_PROFILE_CHANNEL);
      try {
        return parseAssistantConnectorManifestProfile(value);
      } catch {
        throw new Error("Invalid assistant connector profile");
      }
    },
    getDestinationProfile: async () => {
      const value = await invoke(ASSISTANT_DESTINATION_PROFILE_CHANNEL);
      try {
        return parseAssistantDestinationProfile(value);
      } catch {
        throw new Error("Invalid assistant destination profile");
      }
    },
    listContextState: async (input) => {
      const command = parseListAssistantContextStateCommand(input);
      const value = await invoke(ASSISTANT_LIST_CONTEXT_STATE_CHANNEL, command);
      try {
        return parseAssistantContextStateProjection(value);
      } catch {
        throw new Error("Invalid assistant context state projection");
      }
    },
    grantContextPermission: async (input) => {
      const command = parseGrantAssistantContextPermissionCommand(input);
      const value = await invoke(
        ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
        command,
      );
      try {
        return parseAssistantContextPermissionGrant(value);
      } catch {
        throw new Error("Invalid assistant context permission grant");
      }
    },
    revokeContextPermission: async (input) => {
      const command = parseRevokeAssistantContextPermissionCommand(input);
      const value = await invoke(
        ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
        command,
      );
      try {
        return parseAssistantContextPermissionGrant(value);
      } catch {
        throw new Error("Invalid revoked assistant context permission grant");
      }
    },
    runVocabularyLookup: async (input) => {
      const command = parseRunAssistantVocabularyLookupCommand(input);
      const value = await invoke(
        ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
        command,
      );
      try {
        return parseAssistantVocabularyLookupResult(value);
      } catch {
        throw new Error("Invalid assistant vocabulary lookup result");
      }
    },
    runVocabularySuggestion: async (input) => {
      const command = parseRunAssistantVocabularySuggestionCommand(input);
      const value = await invoke(
        ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
        command,
      );
      try {
        return parseAssistantVocabularySuggestionResult(value);
      } catch {
        throw new Error("Invalid assistant vocabulary suggestion result");
      }
    },
    runExternalSettingReview: async (input) => {
      const command = parseRunAssistantExternalSettingReviewCommand(input);
      const value = await invoke(
        ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
        command,
      );
      try {
        return parseAssistantExternalSettingReviewResult(value);
      } catch {
        throw new Error("Invalid assistant external setting review result");
      }
    },
    runNotationReview: async (input) => {
      const command = parseRunAssistantNotationReviewCommand(input);
      const value = await invoke(
        ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
        command,
      );
      try {
        return parseAssistantNotationReviewResult(value);
      } catch {
        throw new Error("Invalid assistant notation review result");
      }
    },
    runSettingReview: async (input) => {
      const command = parseRunAssistantSettingReviewCommand(input);
      const value = await invoke(
        ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
        command,
      );
      try {
        return parseAssistantSettingReviewResult(value);
      } catch {
        throw new Error("Invalid assistant setting review result");
      }
    },
  });
}
