import type { IpcMain,IpcMainInvokeEvent } from "electron";

import {
  NARRATIVE_DIGEST_GENERATE_CHANNEL,
  NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,
  NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL,
  NARRATIVE_DIGEST_LIST_CHANNEL,
  NARRATIVE_DIGEST_REGENERATE_CHANNEL,
  NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL,
} from "../../application/contracts/bridge/narrative-digest-bridge";
import {
  parseGenerateNarrativeDigestCommand,
  parseGenerateSceneNarrativeDigestCommand,
  parseListNarrativeDigestsCommand,
  parseRegenerateNarrativeDigestCommand,
  type GenerateNarrativeDigestCommand,
  type GenerateSceneNarrativeDigestCommand,
  type ListNarrativeDigestsCommand,
  type NarrativeDigestListProjection,
  type NarrativeDigestResult,
  type RegenerateNarrativeDigestCommand,
} from "../../application/continuity/narrative-digest-contract";
import {
  parseListSceneAnalysisRunsCommand,
  parseRunAutomaticSceneAnalysisCommand,
  type AutomaticSceneAnalysisResult,
  type ListSceneAnalysisRunsCommand,
  type RunAutomaticSceneAnalysisCommand,
  type SceneAnalysisRunListProjection,
} from "../../application/continuity/scene-analysis-run-contract";

export type NarrativeDigestIpcRuntime = Readonly<{
  generateNarrativeDigest(command: GenerateNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  generateSceneNarrativeDigest(command: GenerateSceneNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  listNarrativeDigests(command: ListNarrativeDigestsCommand): Promise<NarrativeDigestListProjection>;
  regenerateNarrativeDigest(command: RegenerateNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  runAutomaticSceneAnalysis(
    command: RunAutomaticSceneAnalysisCommand,
  ): Promise<AutomaticSceneAnalysisResult>;
  listSceneAnalysisRuns(
    command: ListSceneAnalysisRunsCommand,
  ): Promise<SceneAnalysisRunListProjection>;
}>;

export function registerNarrativeDigestIpc(input: Readonly<{
  ipcMain: Pick<IpcMain,"handle">;
  authorizeSender(event: IpcMainInvokeEvent): void;
  runtime: NarrativeDigestIpcRuntime;
}>): void {
  const handle = <T>(channel: string,parse: (value: unknown) => T,run: (command: T) => Promise<unknown>) =>
    input.ipcMain.handle(channel,(event,value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  handle(NARRATIVE_DIGEST_GENERATE_CHANNEL,parseGenerateNarrativeDigestCommand,input.runtime.generateNarrativeDigest);
  handle(NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,parseGenerateSceneNarrativeDigestCommand,input.runtime.generateSceneNarrativeDigest);
  handle(NARRATIVE_DIGEST_LIST_CHANNEL,parseListNarrativeDigestsCommand,input.runtime.listNarrativeDigests);
  handle(NARRATIVE_DIGEST_REGENERATE_CHANNEL,parseRegenerateNarrativeDigestCommand,input.runtime.regenerateNarrativeDigest);
  handle(NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL,parseRunAutomaticSceneAnalysisCommand,input.runtime.runAutomaticSceneAnalysis);
  handle(NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL,parseListSceneAnalysisRunsCommand,input.runtime.listSceneAnalysisRuns);
}
