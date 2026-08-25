import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL,
  ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL,
  ASSISTANT_CHAT_RUN_CHANNEL,
  ASSISTANT_CONNECTOR_PROFILE_CHANNEL,
  ASSISTANT_DELETE_CONNECTION_CHANNEL,
  ASSISTANT_DESTINATION_PROFILE_CHANNEL,
  ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
  ASSISTANT_LIST_CONNECTIONS_CHANNEL,
  ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
  ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
  ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
  ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
  ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
  ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
  ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
  ASSISTANT_SAVE_CONNECTION_CHANNEL,
} from "../../application/contracts/studio-bridge";
import type { AssistantContextPermissionGrant } from "../../application/assistant/assistant-context-permission";
import {
  parseDeleteAssistantConnectionCommand,
  parseSaveAssistantConnectionCommand,
  type AssistantConnectionListProjection,
  type AssistantConnectionProjection,
  type DeleteAssistantConnectionCommand,
  type SaveAssistantConnectionCommand,
} from "../../application/assistant/assistant-connection";
import {
  parseGrantAssistantContextPermissionCommand,
  parseListAssistantContextStateCommand,
  parseRevokeAssistantContextPermissionCommand,
  type AssistantContextStateProjection,
  type GrantAssistantContextPermissionCommand,
  type ListAssistantContextStateCommand,
  type RevokeAssistantContextPermissionCommand,
} from "../../application/assistant/assistant-context-state";
import type { AssistantConnectorManifestProfile } from "../../application/assistant/assistant-connector-manifest";
import type { AssistantDestinationProfile } from "../../application/assistant/assistant-destination-profile";
import {
  parseRunAssistantExternalSettingReviewCommand,
  type AssistantExternalSettingReviewResult,
  type RunAssistantExternalSettingReviewCommand,
} from "../../application/assistant/assistant-external-setting-review";
import {
  parseRunAssistantNotationReviewCommand,
  type AssistantNotationReviewResult,
  type RunAssistantNotationReviewCommand,
} from "../../application/assistant/assistant-notation-review";
import {
  parseRunAssistantSettingReviewCommand,
  type AssistantSettingReviewResult,
  type RunAssistantSettingReviewCommand,
} from "../../application/assistant/assistant-setting-review";
import {
  parseRunAssistantVocabularyLookupCommand,
  type AssistantVocabularyLookupResult,
  type RunAssistantVocabularyLookupCommand,
} from "../../application/assistant/assistant-vocabulary-lookup";
import {
  parseRunAssistantVocabularySuggestionCommand,
  type AssistantVocabularySuggestionResult,
  type RunAssistantVocabularySuggestionCommand,
} from "../../application/assistant/assistant-vocabulary-suggestion";
import {
  parseRunAssistantChatCommand,
  type AssistantChatResult,
  type RunAssistantChatCommand,
} from "../../application/assistant/assistant-chat";
import type { ChatGptOAuthConnectionStatus } from "../../application/assistant/chatgpt-oauth";

type MaybePromise<T> = T | Promise<T>;

export type AssistantIpcRuntime = Readonly<{
  listAssistantConnections: () => Promise<AssistantConnectionListProjection>;
  saveAssistantConnection: (
    command: SaveAssistantConnectionCommand,
  ) => Promise<AssistantConnectionProjection>;
  deleteAssistantConnection: (
    command: DeleteAssistantConnectionCommand,
  ) => Promise<void>;
  getAssistantConnectorProfile: () => MaybePromise<AssistantConnectorManifestProfile>;
  getAssistantDestinationProfile: () => MaybePromise<AssistantDestinationProfile>;
  listAssistantContextState: (
    command: ListAssistantContextStateCommand,
  ) => Promise<AssistantContextStateProjection>;
  grantAssistantContextPermission: (
    command: GrantAssistantContextPermissionCommand,
  ) => Promise<AssistantContextPermissionGrant>;
  revokeAssistantContextPermission: (
    command: RevokeAssistantContextPermissionCommand,
  ) => Promise<AssistantContextPermissionGrant>;
  runAssistantVocabularyLookup: (
    command: RunAssistantVocabularyLookupCommand,
  ) => Promise<AssistantVocabularyLookupResult>;
  runAssistantVocabularySuggestion: (
    command: RunAssistantVocabularySuggestionCommand,
  ) => Promise<AssistantVocabularySuggestionResult>;
  runAssistantExternalSettingReview: (
    command: RunAssistantExternalSettingReviewCommand,
  ) => Promise<AssistantExternalSettingReviewResult>;
  runAssistantNotationReview: (
    command: RunAssistantNotationReviewCommand,
  ) => Promise<AssistantNotationReviewResult>;
  runAssistantSettingReview: (
    command: RunAssistantSettingReviewCommand,
  ) => Promise<AssistantSettingReviewResult>;
}>;

export function registerAssistantIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: AssistantIpcRuntime;
  oauth: Readonly<{
    getStatus: () => MaybePromise<ChatGptOAuthConnectionStatus>;
    startLogin: () => MaybePromise<ChatGptOAuthConnectionStatus>;
  }>;
  runChat: (command: RunAssistantChatCommand) => Promise<AssistantChatResult>;
}>): void {
  input.ipcMain.handle(ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.oauth.getStatus();
  });
  input.ipcMain.handle(ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.oauth.startLogin();
  });
  input.ipcMain.handle(ASSISTANT_CHAT_RUN_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runChat(parseRunAssistantChatCommand(value));
  });
  input.ipcMain.handle(ASSISTANT_LIST_CONNECTIONS_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runtime.listAssistantConnections();
  });
  input.ipcMain.handle(
    ASSISTANT_SAVE_CONNECTION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.saveAssistantConnection(
        parseSaveAssistantConnectionCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_DELETE_CONNECTION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.deleteAssistantConnection(
        parseDeleteAssistantConnectionCommand(value),
      );
    },
  );
  input.ipcMain.handle(ASSISTANT_CONNECTOR_PROFILE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runtime.getAssistantConnectorProfile();
  });
  input.ipcMain.handle(ASSISTANT_DESTINATION_PROFILE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runtime.getAssistantDestinationProfile();
  });
  input.ipcMain.handle(
    ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.listAssistantContextState(
        parseListAssistantContextStateCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.grantAssistantContextPermission(
        parseGrantAssistantContextPermissionCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.revokeAssistantContextPermission(
        parseRevokeAssistantContextPermissionCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.runAssistantVocabularyLookup(
        parseRunAssistantVocabularyLookupCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.runAssistantVocabularySuggestion(
        parseRunAssistantVocabularySuggestionCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.runAssistantExternalSettingReview(
        parseRunAssistantExternalSettingReviewCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.runAssistantNotationReview(
        parseRunAssistantNotationReviewCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.runAssistantSettingReview(
        parseRunAssistantSettingReviewCommand(value),
      );
    },
  );
}
