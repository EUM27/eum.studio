import type { StructureIpcRuntime } from "../ipc/register-structure-ipc";

export function pickStructureRuntime(
  runtime: StructureIpcRuntime,
): StructureIpcRuntime {
  return Object.freeze({
    createEventBlock: (command) => runtime.createEventBlock(command),
    createAnchorlessEvent: (command) =>
      runtime.createAnchorlessEvent(command),
    moveEventBlock: (command) => runtime.moveEventBlock(command),
    linkEventSource: (command) => runtime.linkEventSource(command),
    replaceEventSource: (command) => runtime.replaceEventSource(command),
    retireEventSource: (command) => runtime.retireEventSource(command),
    listEventBlocks: (command) => runtime.listEventBlocks(command),
    listEventRail: (command) => runtime.listEventRail(command),
    createSceneOverride: (command) => runtime.createSceneOverride(command),
    relocateSceneSegment: (command) =>
      runtime.relocateSceneSegment(command),
    listSceneOverrides: (command) => runtime.listSceneOverrides(command),
    listSceneProjection: (command) => runtime.listSceneProjection(command),
    updateSceneRuleSet: (command) => runtime.updateSceneRuleSet(command),
    setSceneEventOverride: (command) =>
      runtime.setSceneEventOverride(command),
    runSceneExtraction: (command) => runtime.runSceneExtraction(command),
    listSceneExtractionCandidates: (command) =>
      runtime.listSceneExtractionCandidates(command),
    decideSceneExtractionBoundary: (command) =>
      runtime.decideSceneExtractionBoundary(command),
    listSceneAnnotations: (command) => runtime.listSceneAnnotations(command),
    decideSceneExtractionAnnotation: (command) =>
      runtime.decideSceneExtractionAnnotation(command),
    runSceneDraft: (command) => runtime.runSceneDraft(command),
    listSceneDraftCandidates: (command) =>
      runtime.listSceneDraftCandidates(command),
    updateSceneDraftCandidate: (command) =>
      runtime.updateSceneDraftCandidate(command),
    prepareSceneDraftInsertion: (command) =>
      runtime.prepareSceneDraftInsertion(command),
    completeSceneDraftInsertion: (command) =>
      runtime.completeSceneDraftInsertion(command),
  });
}
