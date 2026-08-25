import {
  parseCreateAnchorlessEventCommand,
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseEventBlockProjection,
  parseEventSourceProjection,
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
} from "../../structure/event-block-contract";
import {
  parseEventRailProjection,
  parseListEventRailCommand,
  type EventRailProjection,
  type ListEventRailCommand,
} from "../../structure/event-rail-projection";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  parseSceneOverrideProjection,
  type CreateSceneOverrideCommand,
  type ListSceneOverridesCommand,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../../structure/scene-override-contract";
import {
  parseListSceneProjectionCommand,
  parseSceneProjectionList,
  parseSetSceneEventOverrideCommand,
  parseUpdateSceneRuleSetCommand,
  type ListSceneProjectionCommand,
  type SceneProjectionList,
  type SetSceneEventOverrideCommand,
  type UpdateSceneRuleSetCommand,
} from "../../structure/scene-projection";
import {
  parseDecideSceneExtractionAnnotationCommand,
  parseDecideSceneExtractionBoundaryCommand,
  parseListSceneExtractionCandidatesCommand,
  parseRunSceneExtractionCommand,
  parseSceneExtractionAnnotationDecisionResult,
  parseSceneExtractionCandidateList,
  parseSceneExtractionDecisionResult,
  parseSceneExtractionResult,
  type DecideSceneExtractionAnnotationCommand,
  type DecideSceneExtractionBoundaryCommand,
  type ListSceneExtractionCandidatesCommand,
  type RunSceneExtractionCommand,
  type SceneExtractionAnnotationDecisionResult,
  type SceneExtractionCandidateList,
  type SceneExtractionDecisionResult,
  type SceneExtractionResult,
} from "../../structure/scene-extraction-contract";
import {
  parseCompleteSceneDraftInsertionCommand,
  parseListSceneDraftCandidatesCommand,
  parsePrepareSceneDraftInsertionCommand,
  parsePrepareSceneDraftInsertionResult,
  parseRunSceneDraftCommand,
  parseRunSceneDraftResult,
  parseSceneDraftCandidate,
  parseSceneDraftCandidateList,
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
} from "../../structure/scene-draft-contract";
import {
  parseListSceneAnnotationsCommand,
  parseSceneAnnotationList,
  type ListSceneAnnotationsCommand,
  type SceneAnnotationList,
} from "../../structure/scene-annotation-contract";

export const STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL =
  "studio:structure:create-event-block";
export const STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL =
  "studio:structure:create-anchorless-event";
export const STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL =
  "studio:structure:move-event-block";
export const STRUCTURE_LINK_EVENT_SOURCE_CHANNEL =
  "studio:structure:link-event-source";
export const STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL =
  "studio:structure:replace-event-source";
export const STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL =
  "studio:structure:retire-event-source";
export const STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL =
  "studio:structure:list-event-blocks";
export const STRUCTURE_LIST_EVENT_RAIL_CHANNEL =
  "studio:structure:list-event-rail";
export const STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL =
  "studio:structure:create-scene-override";
export const STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL =
  "studio:structure:list-scene-overrides";
export const STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL =
  "studio:structure:list-scene-projection";
export const STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL =
  "studio:structure:update-scene-rule-set";
export const STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL =
  "studio:structure:set-scene-event-override";
export const STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL =
  "studio:structure:extract-scenes";
export const STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL =
  "studio:structure:list-scene-extraction-candidates";
export const STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL =
  "studio:structure:decide-scene-extraction-boundary";
export const STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL =
  "studio:structure:list-scene-annotations";
export const STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL =
  "studio:structure:decide-scene-extraction-annotation";
export const STRUCTURE_RUN_SCENE_DRAFT_CHANNEL =
  "studio:structure:run-scene-draft";
export const STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL =
  "studio:structure:list-scene-draft-candidates";
export const STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL =
  "studio:structure:update-scene-draft-candidate";
export const STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL =
  "studio:structure:prepare-scene-draft-insertion";
export const STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL =
  "studio:structure:complete-scene-draft-insertion";

export type StructureBridgeChannel =
  | typeof STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL
  | typeof STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL
  | typeof STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL
  | typeof STRUCTURE_LINK_EVENT_SOURCE_CHANNEL
  | typeof STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL
  | typeof STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL
  | typeof STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL
  | typeof STRUCTURE_LIST_EVENT_RAIL_CHANNEL
  | typeof STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL
  | typeof STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL
  | typeof STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL
  | typeof STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL
  | typeof STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL
  | typeof STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL
  | typeof STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL
  | typeof STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL
  | typeof STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL
  | typeof STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL
  | typeof STRUCTURE_RUN_SCENE_DRAFT_CHANNEL
  | typeof STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL
  | typeof STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL
  | typeof STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL
  | typeof STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL;

export type StructureBridgePayload =
  | CreateEventBlockCommand
  | CreateAnchorlessEventCommand
  | LinkEventSourceCommand
  | ReplaceEventSourceCommand
  | RetireEventSourceCommand
  | ListEventBlocksCommand
  | ListEventRailCommand
  | CreateSceneOverrideCommand
  | ListSceneOverridesCommand
  | ListSceneProjectionCommand
  | UpdateSceneRuleSetCommand
  | SetSceneEventOverrideCommand
  | RunSceneExtractionCommand
  | ListSceneExtractionCandidatesCommand
  | DecideSceneExtractionBoundaryCommand
  | ListSceneAnnotationsCommand
  | DecideSceneExtractionAnnotationCommand
  | RunSceneDraftCommand
  | ListSceneDraftCandidatesCommand
  | UpdateSceneDraftCandidateCommand
  | PrepareSceneDraftInsertionCommand
  | CompleteSceneDraftInsertionCommand;

export type StructureBridge = Readonly<{
  createEventBlock: (
    command: CreateEventBlockCommand,
  ) => Promise<EventBlockProjection>;
  createAnchorlessEvent: (
    command: CreateAnchorlessEventCommand,
  ) => Promise<EventBlockProjection>;
  moveEventBlock: (
    command: MoveEventBlockCommand,
  ) => Promise<EventBlockListProjection>;
  linkEventSource: (
    command: LinkEventSourceCommand,
  ) => Promise<EventSourceProjection>;
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

export type StructureBridgeInvoke = (
  channel: StructureBridgeChannel,
  payload?: StructureBridgePayload,
) => Promise<unknown>;

export function createStructureBridge(
  invoke: StructureBridgeInvoke,
): StructureBridge {
  return Object.freeze({
    createEventBlock: async (input) => {
      const command = parseCreateEventBlockCommand(input);
      const value = await invoke(STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL, command);
      try {
        return parseEventBlockProjection(value);
      } catch {
        throw new Error("Invalid EventBlock creation result");
      }
    },
    createAnchorlessEvent: async (input) => {
      const command = parseCreateAnchorlessEventCommand(input);
      const value = await invoke(
        STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
        command,
      );
      try {
        return parseEventBlockProjection(value);
      } catch {
        throw new Error("Invalid anchorless EventBlock creation result");
      }
    },
    moveEventBlock: async (input) => {
      const command = parseMoveEventBlockCommand(input);
      const value = await invoke(STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL, command);
      try {
        return parseEventBlockListProjection(value);
      } catch {
        throw new Error("Invalid EventBlock move result");
      }
    },
    linkEventSource: async (input) => {
      const command = parseLinkEventSourceCommand(input);
      const value = await invoke(STRUCTURE_LINK_EVENT_SOURCE_CHANNEL, command);
      try {
        return parseEventSourceProjection(value);
      } catch {
        throw new Error("Invalid EventSource link result");
      }
    },
    replaceEventSource: async (input) => {
      const command = parseReplaceEventSourceCommand(input);
      const value = await invoke(
        STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
        command,
      );
      try {
        return parseEventSourceProjection(value);
      } catch {
        throw new Error("Invalid EventSource replacement result");
      }
    },
    retireEventSource: async (input) => {
      const command = parseRetireEventSourceCommand(input);
      const value = await invoke(STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL, command);
      try {
        return parseEventSourceProjection(value);
      } catch {
        throw new Error("Invalid EventSource retirement result");
      }
    },
    listEventBlocks: async (input) => {
      const command = parseListEventBlocksCommand(input);
      const value = await invoke(STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL, command);
      try {
        return parseEventBlockListProjection(value);
      } catch {
        throw new Error("Invalid EventBlock list");
      }
    },
    listEventRail: async (input) => {
      const command = parseListEventRailCommand(input);
      const value = await invoke(STRUCTURE_LIST_EVENT_RAIL_CHANNEL, command);
      try {
        return parseEventRailProjection(value);
      } catch {
        throw new Error("Invalid event rail projection");
      }
    },
    createSceneOverride: async (input) => {
      const command = parseCreateSceneOverrideCommand(input);
      const value = await invoke(
        STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
        command,
      );
      try {
        return parseSceneOverrideProjection(value);
      } catch {
        throw new Error("Invalid SceneOverride creation result");
      }
    },
    listSceneOverrides: async (input) => {
      const command = parseListSceneOverridesCommand(input);
      const value = await invoke(STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL, command);
      try {
        return parseSceneOverrideListProjection(value);
      } catch {
        throw new Error("Invalid SceneOverride list");
      }
    },
    listSceneProjection: async (input) => {
      const command = parseListSceneProjectionCommand(input);
      const value = await invoke(
        STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
        command,
      );
      try {
        return parseSceneProjectionList(value);
      } catch {
        throw new Error("Invalid SceneProjection list");
      }
    },
    updateSceneRuleSet: async (input) => {
      const command = parseUpdateSceneRuleSetCommand(input);
      const value = await invoke(
        STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
        command,
      );
      try {
        return parseSceneProjectionList(value);
      } catch {
        throw new Error("Invalid SceneProjection list");
      }
    },
    setSceneEventOverride: async (input) => {
      const command = parseSetSceneEventOverrideCommand(input);
      const value = await invoke(
        STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
        command,
      );
      try {
        return parseSceneProjectionList(value);
      } catch {
        throw new Error("Invalid SceneProjection list");
      }
    },
    runSceneExtraction: async (input) => {
      const command = parseRunSceneExtractionCommand(input);
      const value = await invoke(STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL, command);
      try {
        return parseSceneExtractionResult(value);
      } catch {
        throw new Error("Invalid scene extraction result");
      }
    },
    listSceneExtractionCandidates: async (input) => {
      const command = parseListSceneExtractionCandidatesCommand(input);
      const value = await invoke(
        STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
        command,
      );
      try {
        return parseSceneExtractionCandidateList(value);
      } catch {
        throw new Error("Invalid scene extraction Candidate list");
      }
    },
    decideSceneExtractionBoundary: async (input) => {
      const command = parseDecideSceneExtractionBoundaryCommand(input);
      const value = await invoke(
        STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL,
        command,
      );
      try {
        return parseSceneExtractionDecisionResult(value);
      } catch {
        throw new Error("Invalid scene extraction decision result");
      }
    },
    listSceneAnnotations: async (input) => {
      const command = parseListSceneAnnotationsCommand(input);
      const value = await invoke(STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL, command);
      try {
        return parseSceneAnnotationList(value);
      } catch {
        throw new Error("Invalid scene annotation list");
      }
    },
    decideSceneExtractionAnnotation: async (input) => {
      const command = parseDecideSceneExtractionAnnotationCommand(input);
      const value = await invoke(
        STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL,
        command,
      );
      try {
        return parseSceneExtractionAnnotationDecisionResult(value);
      } catch {
        throw new Error("Invalid scene extraction annotation decision result");
      }
    },
    runSceneDraft: async (input) => {
      const command = parseRunSceneDraftCommand(input);
      const value = await invoke(STRUCTURE_RUN_SCENE_DRAFT_CHANNEL, command);
      try {
        return parseRunSceneDraftResult(value);
      } catch {
        throw new Error("Invalid scene draft result");
      }
    },
    listSceneDraftCandidates: async (input) => {
      const command = parseListSceneDraftCandidatesCommand(input);
      const value = await invoke(
        STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL,
        command,
      );
      try {
        return parseSceneDraftCandidateList(value);
      } catch {
        throw new Error("Invalid scene draft Candidate list");
      }
    },
    updateSceneDraftCandidate: async (input) => {
      const command = parseUpdateSceneDraftCandidateCommand(input);
      const value = await invoke(
        STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL,
        command,
      );
      try {
        return parseSceneDraftCandidate(value);
      } catch {
        throw new Error("Invalid updated scene draft Candidate");
      }
    },
    prepareSceneDraftInsertion: async (input) => {
      const command = parsePrepareSceneDraftInsertionCommand(input);
      const value = await invoke(
        STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL,
        command,
      );
      try {
        return parsePrepareSceneDraftInsertionResult(value);
      } catch {
        throw new Error("Invalid scene draft insertion preparation");
      }
    },
    completeSceneDraftInsertion: async (input) => {
      const command = parseCompleteSceneDraftInsertionCommand(input);
      const value = await invoke(
        STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL,
        command,
      );
      try {
        return parseSceneDraftCandidate(value);
      } catch {
        throw new Error("Invalid completed scene draft Candidate");
      }
    },
  });
}
