import {
  parseGenerateNarrativeDigestCommand,
  parseGenerateSceneNarrativeDigestCommand,
  parseListNarrativeDigestsCommand,
  parseNarrativeDigestListProjection,
  parseNarrativeDigestResult,
  parseRegenerateNarrativeDigestCommand,
  type GenerateNarrativeDigestCommand,
  type GenerateSceneNarrativeDigestCommand,
  type ListNarrativeDigestsCommand,
  type NarrativeDigestListProjection,
  type NarrativeDigestResult,
  type RegenerateNarrativeDigestCommand,
} from "../../continuity/narrative-digest-contract";
import {
  parseAutomaticSceneAnalysisResult,
  parseListSceneAnalysisRunsCommand,
  parseRunAutomaticSceneAnalysisCommand,
  parseSceneAnalysisRunListProjection,
  type AutomaticSceneAnalysisResult,
  type ListSceneAnalysisRunsCommand,
  type RunAutomaticSceneAnalysisCommand,
  type SceneAnalysisRunListProjection,
} from "../../continuity/scene-analysis-run-contract";

export const NARRATIVE_DIGEST_GENERATE_CHANNEL = "studio:narrative-digest:generate";
export const NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL =
  "studio:narrative-digest:generate-scene";
export const NARRATIVE_DIGEST_LIST_CHANNEL = "studio:narrative-digest:list";
export const NARRATIVE_DIGEST_REGENERATE_CHANNEL = "studio:narrative-digest:regenerate";
export const NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL =
  "studio:narrative-digest:run-scene-analysis";
export const NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL =
  "studio:narrative-digest:list-scene-analysis-runs";

export type NarrativeDigestBridgeChannel =
  | typeof NARRATIVE_DIGEST_GENERATE_CHANNEL
  | typeof NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL
  | typeof NARRATIVE_DIGEST_LIST_CHANNEL
  | typeof NARRATIVE_DIGEST_REGENERATE_CHANNEL
  | typeof NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL
  | typeof NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL;

export type NarrativeDigestBridgePayload =
  | GenerateNarrativeDigestCommand
  | GenerateSceneNarrativeDigestCommand
  | ListNarrativeDigestsCommand
  | RegenerateNarrativeDigestCommand
  | RunAutomaticSceneAnalysisCommand
  | ListSceneAnalysisRunsCommand;

export type NarrativeDigestBridge = Readonly<{
  generate(command: GenerateNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  generateScene(command: GenerateSceneNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  list(command: ListNarrativeDigestsCommand): Promise<NarrativeDigestListProjection>;
  regenerate(command: RegenerateNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  runSceneAnalysis(
    command: RunAutomaticSceneAnalysisCommand,
  ): Promise<AutomaticSceneAnalysisResult>;
  listSceneAnalysisRuns(
    command: ListSceneAnalysisRunsCommand,
  ): Promise<SceneAnalysisRunListProjection>;
}>;

export type NarrativeDigestBridgeInvoke = (
  channel: NarrativeDigestBridgeChannel,
  payload?: NarrativeDigestBridgePayload,
) => Promise<unknown>;

export function createNarrativeDigestBridge(
  invoke: NarrativeDigestBridgeInvoke,
): NarrativeDigestBridge {
  return Object.freeze({
    generate: async (command) => parseNarrativeDigestResult(
      await invoke(NARRATIVE_DIGEST_GENERATE_CHANNEL,parseGenerateNarrativeDigestCommand(command)),
    ),
    generateScene: async (command) => parseNarrativeDigestResult(
      await invoke(
        NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,
        parseGenerateSceneNarrativeDigestCommand(command),
      ),
    ),
    list: async (command) => parseNarrativeDigestListProjection(
      await invoke(NARRATIVE_DIGEST_LIST_CHANNEL,parseListNarrativeDigestsCommand(command)),
    ),
    regenerate: async (command) => parseNarrativeDigestResult(
      await invoke(NARRATIVE_DIGEST_REGENERATE_CHANNEL,parseRegenerateNarrativeDigestCommand(command)),
    ),
    runSceneAnalysis: async (command) => parseAutomaticSceneAnalysisResult(
      await invoke(
        NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL,
        parseRunAutomaticSceneAnalysisCommand(command),
      ),
    ),
    listSceneAnalysisRuns: async (command) =>
      parseSceneAnalysisRunListProjection(await invoke(
        NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL,
        parseListSceneAnalysisRunsCommand(command),
      )),
  });
}
