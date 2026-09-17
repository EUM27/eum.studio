import type { NarrativeDigestIpcRuntime } from "../ipc/register-narrative-digest-ipc";

export function pickNarrativeDigestRuntime(runtime: NarrativeDigestIpcRuntime): NarrativeDigestIpcRuntime {
  return Object.freeze({
    generateNarrativeDigest: (command) => runtime.generateNarrativeDigest(command),
    generateSceneNarrativeDigest: (command) => runtime.generateSceneNarrativeDigest(command),
    listNarrativeDigests: (command) => runtime.listNarrativeDigests(command),
    regenerateNarrativeDigest: (command) => runtime.regenerateNarrativeDigest(command),
    runAutomaticSceneAnalysis: (command) =>
      runtime.runAutomaticSceneAnalysis(command),
    listSceneAnalysisRuns: (command) => runtime.listSceneAnalysisRuns(command),
  });
}
