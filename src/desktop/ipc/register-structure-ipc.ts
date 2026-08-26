import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL,
  STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
  STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
  STRUCTURE_RELOCATE_SCENE_SEGMENT_CHANNEL,
  STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL,
  STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL,
  STRUCTURE_LINK_EVENT_SOURCE_CHANNEL,
  STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
  STRUCTURE_LIST_EVENT_RAIL_CHANNEL,
  STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL,
  STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL,
  STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
  STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
  STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
  STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL,
  STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
  STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL,
  STRUCTURE_RUN_SCENE_DRAFT_CHANNEL,
  STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL,
  STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
  STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL,
  STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreateAnchorlessEventCommand,
  parseCreateEventBlockCommand,
  parseLinkEventSourceCommand,
  parseListEventBlocksCommand,
  parseMoveEventBlockCommand,
  parseReplaceEventSourceCommand,
  parseRetireEventSourceCommand,
  type CreateAnchorlessEventCommand,
  type CreateEventBlockCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
  type EventSourceProjection,
  type LinkEventSourceCommand,
  type ListEventBlocksCommand,
  type MoveEventBlockCommand,
  type ReplaceEventSourceCommand,
  type RetireEventSourceCommand,
} from "../../application/structure/event-block-contract";
import {
  parseListEventRailCommand,
  type EventRailProjection,
  type ListEventRailCommand,
} from "../../application/structure/event-rail-projection";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseRelocateSceneSegmentCommand,
  type CreateSceneOverrideCommand,
  type ListSceneOverridesCommand,
  type RelocateSceneSegmentCommand,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../../application/structure/scene-override-contract";
import {
  parseListSceneProjectionCommand,
  parseSetSceneEventOverrideCommand,
  parseUpdateSceneRuleSetCommand,
  type ListSceneProjectionCommand,
  type SceneProjectionList,
  type SetSceneEventOverrideCommand,
  type UpdateSceneRuleSetCommand,
} from "../../application/structure/scene-projection";
import {
  parseDecideSceneExtractionAnnotationCommand,
  parseDecideSceneExtractionBoundaryCommand,
  parseListSceneExtractionCandidatesCommand,
  parseRunSceneExtractionCommand,
  type DecideSceneExtractionAnnotationCommand,
  type DecideSceneExtractionBoundaryCommand,
  type ListSceneExtractionCandidatesCommand,
  type RunSceneExtractionCommand,
  type SceneExtractionAnnotationDecisionResult,
  type SceneExtractionCandidateList,
  type SceneExtractionDecisionResult,
  type SceneExtractionResult,
} from "../../application/structure/scene-extraction-contract";
import {
  parseCompleteSceneDraftInsertionCommand,
  parseListSceneDraftCandidatesCommand,
  parsePrepareSceneDraftInsertionCommand,
  parseRunSceneDraftCommand,
  parseUpdateSceneDraftCandidateCommand,
  type CompleteSceneDraftInsertionCommand,
  type ListSceneDraftCandidatesCommand,
  type PrepareSceneDraftInsertionCommand,
  type PrepareSceneDraftInsertionResult,
  type RunSceneDraftCommand,
  type RunSceneDraftResult,
  type SceneDraftCandidate,
  type SceneDraftCandidateList,
  type UpdateSceneDraftCandidateCommand,
} from "../../application/structure/scene-draft-contract";
import {
  parseListSceneAnnotationsCommand,
  type ListSceneAnnotationsCommand,
  type SceneAnnotationList,
} from "../../application/structure/scene-annotation-contract";

export type StructureIpcRuntime = Readonly<{
  createEventBlock: (command: CreateEventBlockCommand) => Promise<EventBlockProjection>;
  createAnchorlessEvent: (
    command: CreateAnchorlessEventCommand,
  ) => Promise<EventBlockProjection>;
  moveEventBlock: (command: MoveEventBlockCommand) => Promise<EventBlockListProjection>;
  linkEventSource: (command: LinkEventSourceCommand) => Promise<EventSourceProjection>;
  replaceEventSource: (
    command: ReplaceEventSourceCommand,
  ) => Promise<EventSourceProjection>;
  retireEventSource: (
    command: RetireEventSourceCommand,
  ) => Promise<EventSourceProjection>;
  listEventBlocks: (
    command: ListEventBlocksCommand,
  ) => Promise<EventBlockListProjection>;
  listEventRail: (command: ListEventRailCommand) => Promise<EventRailProjection>;
  createSceneOverride: (
    command: CreateSceneOverrideCommand,
  ) => Promise<SceneOverrideProjection>;
  relocateSceneSegment: (
    command: RelocateSceneSegmentCommand,
  ) => Promise<SceneProjectionList>;
  listSceneOverrides: (
    command: ListSceneOverridesCommand,
  ) => Promise<SceneOverrideListProjection>;
  listSceneProjection: (
    command: ListSceneProjectionCommand,
  ) => Promise<SceneProjectionList>;
  updateSceneRuleSet: (
    command: UpdateSceneRuleSetCommand,
  ) => Promise<SceneProjectionList>;
  setSceneEventOverride: (
    command: SetSceneEventOverrideCommand,
  ) => Promise<SceneProjectionList>;
  runSceneExtraction: (
    command: RunSceneExtractionCommand,
  ) => Promise<SceneExtractionResult>;
  listSceneExtractionCandidates: (
    command: ListSceneExtractionCandidatesCommand,
  ) => Promise<SceneExtractionCandidateList>;
  decideSceneExtractionBoundary: (
    command: DecideSceneExtractionBoundaryCommand,
  ) => Promise<SceneExtractionDecisionResult>;
  listSceneAnnotations: (
    command: ListSceneAnnotationsCommand,
  ) => Promise<SceneAnnotationList>;
  decideSceneExtractionAnnotation: (
    command: DecideSceneExtractionAnnotationCommand,
  ) => Promise<SceneExtractionAnnotationDecisionResult>;
  runSceneDraft: (command: RunSceneDraftCommand) => Promise<RunSceneDraftResult>;
  listSceneDraftCandidates: (
    command: ListSceneDraftCandidatesCommand,
  ) => Promise<SceneDraftCandidateList>;
  updateSceneDraftCandidate: (
    command: UpdateSceneDraftCandidateCommand,
  ) => Promise<SceneDraftCandidate>;
  prepareSceneDraftInsertion: (
    command: PrepareSceneDraftInsertionCommand,
  ) => Promise<PrepareSceneDraftInsertionResult>;
  completeSceneDraftInsertion: (
    command: CompleteSceneDraftInsertionCommand,
  ) => Promise<SceneDraftCandidate>;
}>;

export function registerStructureIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: StructureIpcRuntime;
}>): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ): void => {
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  };

  handle(STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL, parseCreateEventBlockCommand,
    (command) => input.runtime.createEventBlock(command));
  handle(STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL, parseCreateAnchorlessEventCommand,
    (command) => input.runtime.createAnchorlessEvent(command));
  handle(STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL, parseMoveEventBlockCommand,
    (command) => input.runtime.moveEventBlock(command));
  handle(STRUCTURE_LINK_EVENT_SOURCE_CHANNEL, parseLinkEventSourceCommand,
    (command) => input.runtime.linkEventSource(command));
  handle(STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL, parseReplaceEventSourceCommand,
    (command) => input.runtime.replaceEventSource(command));
  handle(STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL, parseRetireEventSourceCommand,
    (command) => input.runtime.retireEventSource(command));
  handle(STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL, parseListEventBlocksCommand,
    (command) => input.runtime.listEventBlocks(command));
  handle(STRUCTURE_LIST_EVENT_RAIL_CHANNEL, parseListEventRailCommand,
    (command) => input.runtime.listEventRail(command));
  handle(STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL, parseCreateSceneOverrideCommand,
    (command) => input.runtime.createSceneOverride(command));
  handle(STRUCTURE_RELOCATE_SCENE_SEGMENT_CHANNEL, parseRelocateSceneSegmentCommand,
    (command) => input.runtime.relocateSceneSegment(command));
  handle(STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL, parseListSceneOverridesCommand,
    (command) => input.runtime.listSceneOverrides(command));
  handle(STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL, parseListSceneProjectionCommand,
    (command) => input.runtime.listSceneProjection(command));
  handle(STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL, parseUpdateSceneRuleSetCommand,
    (command) => input.runtime.updateSceneRuleSet(command));
  handle(STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL, parseSetSceneEventOverrideCommand,
    (command) => input.runtime.setSceneEventOverride(command));
  handle(STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL, parseRunSceneExtractionCommand,
    (command) => input.runtime.runSceneExtraction(command));
  handle(
    STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
    parseListSceneExtractionCandidatesCommand,
    (command) => input.runtime.listSceneExtractionCandidates(command),
  );
  handle(
    STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL,
    parseDecideSceneExtractionBoundaryCommand,
    (command) => input.runtime.decideSceneExtractionBoundary(command),
  );
  handle(STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL, parseListSceneAnnotationsCommand,
    (command) => input.runtime.listSceneAnnotations(command));
  handle(
    STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL,
    parseDecideSceneExtractionAnnotationCommand,
    (command) => input.runtime.decideSceneExtractionAnnotation(command),
  );
  handle(STRUCTURE_RUN_SCENE_DRAFT_CHANNEL, parseRunSceneDraftCommand,
    (command) => input.runtime.runSceneDraft(command));
  handle(STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL,
    parseListSceneDraftCandidatesCommand,
    (command) => input.runtime.listSceneDraftCandidates(command));
  handle(STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL,
    parseUpdateSceneDraftCandidateCommand,
    (command) => input.runtime.updateSceneDraftCandidate(command));
  handle(STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL,
    parsePrepareSceneDraftInsertionCommand,
    (command) => input.runtime.prepareSceneDraftInsertion(command));
  handle(STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL,
    parseCompleteSceneDraftInsertionCommand,
    (command) => input.runtime.completeSceneDraftInsertion(command));
}
