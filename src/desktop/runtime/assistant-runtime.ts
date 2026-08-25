import type { AssistantIpcRuntime } from "../ipc/register-assistant-ipc";

export function pickAssistantRuntime(
  runtime: AssistantIpcRuntime,
): AssistantIpcRuntime {
  return Object.freeze({
    listAssistantConnections: () => runtime.listAssistantConnections(),
    saveAssistantConnection: (command) =>
      runtime.saveAssistantConnection(command),
    deleteAssistantConnection: (command) =>
      runtime.deleteAssistantConnection(command),
    getAssistantConnectorProfile: () =>
      runtime.getAssistantConnectorProfile(),
    getAssistantDestinationProfile: () =>
      runtime.getAssistantDestinationProfile(),
    listAssistantContextState: (command) =>
      runtime.listAssistantContextState(command),
    grantAssistantContextPermission: (command) =>
      runtime.grantAssistantContextPermission(command),
    revokeAssistantContextPermission: (command) =>
      runtime.revokeAssistantContextPermission(command),
    runAssistantVocabularyLookup: (command) =>
      runtime.runAssistantVocabularyLookup(command),
    runAssistantVocabularySuggestion: (command) =>
      runtime.runAssistantVocabularySuggestion(command),
    runAssistantExternalSettingReview: (command) =>
      runtime.runAssistantExternalSettingReview(command),
    runAssistantNotationReview: (command) =>
      runtime.runAssistantNotationReview(command),
    runAssistantSettingReview: (command) =>
      runtime.runAssistantSettingReview(command),
  });
}
