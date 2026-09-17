import type { EditorIpcRuntime } from "../ipc/register-editor-ipc";

export function pickEditorRuntime(runtime: EditorIpcRuntime): EditorIpcRuntime {
  return Object.freeze({
    getManuscriptDocumentProfile: () =>
      runtime.getManuscriptDocumentProfile(),
    getManuscriptPersistenceProfile: () =>
      runtime.getManuscriptPersistenceProfile(),
    getManuscriptStartupRecovery: () =>
      runtime.getManuscriptStartupRecovery(),
    getManuscriptResumeCheckpoint: () =>
      runtime.getManuscriptResumeCheckpoint(),
    getManuscriptPreflightSettings: (command) =>
      runtime.getManuscriptPreflightSettings(command),
    saveManuscriptPreflightSettings: (command) =>
      runtime.saveManuscriptPreflightSettings(command),
    getContinuousReadingProgress: (command) =>
      runtime.getContinuousReadingProgress(command),
    saveContinuousReadingProgress: (command) =>
      runtime.saveContinuousReadingProgress(command),
    saveChangeBatch: (value) => runtime.saveChangeBatch(value),
    saveDocumentChange: (value) => runtime.saveDocumentChange(value),
    saveFormatting: (value) => runtime.saveFormatting(value),
    moveRangeToEpisode: (value) => runtime.moveRangeToEpisode(value),
    undoMoveRangeToEpisode: (value) => runtime.undoMoveRangeToEpisode(value),
    getWorkManuscriptLayoutSettings: (value) =>
      runtime.getWorkManuscriptLayoutSettings(value),
    saveWorkManuscriptLayoutSettings: (value) =>
      runtime.saveWorkManuscriptLayoutSettings(value),
    applyManuscriptStartupRecovery: (value) =>
      runtime.applyManuscriptStartupRecovery(value),
  });
}
