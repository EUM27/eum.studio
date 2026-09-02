import type { ActivityIpcRuntime } from "../ipc/register-activity-ipc";
import type { ForeshadowingIpcRuntime } from "../ipc/register-foreshadowing-ipc";
import type { FragmentsIpcRuntime } from "../ipc/register-fragments-ipc";
import type { ManuscriptAnnotationsIpcRuntime } from "../ipc/register-manuscript-annotations-ipc";
import type { CharactersIpcRuntime } from "../ipc/register-characters-ipc";
import type { CanonIpcRuntime } from "../ipc/register-canon-ipc";
import type { ContinuityIpcRuntime } from "../ipc/register-continuity-ipc";
import type { CharacterKnowledgeIpcRuntime } from "../ipc/register-character-knowledge-ipc";
import type { ContextPlannerIpcRuntime } from "../ipc/register-context-planner-ipc";
import type { NarrativeDigestIpcRuntime } from "../ipc/register-narrative-digest-ipc";
import type { ScheduleIpcRuntime } from "../ipc/register-schedule-ipc";
import type { QuickToolsIpcRuntime } from "../ipc/register-quick-tools-ipc";
import type { LoreIpcRuntime } from "../ipc/register-lore-ipc";
import type { AssistantIpcRuntime } from "../ipc/register-assistant-ipc";
import type { SettingsIpcRuntime } from "../ipc/register-settings-ipc";
import type { MusicPlaybackIpcRuntime } from "../ipc/register-music-playback-ipc";
import type { VersionIpcRuntime } from "../ipc/register-version-ipc";
import type { BackupIpcRuntime } from "../ipc/register-backup-ipc";
import type { PlotsIpcRuntime } from "../ipc/register-plots-ipc";
import type { StructureIpcRuntime } from "../ipc/register-structure-ipc";
import type { WorkspaceIpcRuntime } from "../ipc/register-workspace-ipc";
import type { PublishingIpcRuntime } from "../ipc/register-publishing-ipc";
import { pickActivityRuntime } from "./activity-runtime";
import { pickForeshadowingRuntime } from "./foreshadowing-runtime";
import { pickFragmentsRuntime } from "./fragments-runtime";
import { pickManuscriptAnnotationsRuntime } from "./manuscript-annotations-runtime";
import { pickCharactersRuntime } from "./characters-runtime";
import { pickCanonRuntime } from "./canon-runtime";
import { pickContinuityRuntime } from "./continuity-runtime";
import { pickCharacterKnowledgeRuntime } from "./character-knowledge-runtime";
import { pickContextPlannerRuntime } from "./context-planner-runtime";
import { pickNarrativeDigestRuntime } from "./narrative-digest-runtime";
import { pickScheduleRuntime } from "./schedule-runtime";
import { pickQuickToolsRuntime } from "./quick-tools-runtime";
import { pickLoreRuntime } from "./lore-runtime";
import { pickAssistantRuntime } from "./assistant-runtime";
import { pickSettingsRuntime } from "./settings-runtime";
import { pickMusicPlaybackRuntime } from "./music-playback-runtime";
import { pickVersionRuntime } from "./version-runtime";
import { pickBackupRuntime } from "./backup-runtime";
import { pickPlotsRuntime } from "./plots-runtime";
import { pickStructureRuntime } from "./structure-runtime";
import { pickWorkspaceRuntime } from "./workspace-runtime";
import { pickPublishingRuntime } from "./publishing-runtime";

export type ExtractedApplicationRuntime =
  & ActivityIpcRuntime
  & ForeshadowingIpcRuntime
  & FragmentsIpcRuntime
  & ManuscriptAnnotationsIpcRuntime
  & CharactersIpcRuntime
  & CanonIpcRuntime
  & ContinuityIpcRuntime
  & CharacterKnowledgeIpcRuntime
  & ContextPlannerIpcRuntime
  & NarrativeDigestIpcRuntime
  & ScheduleIpcRuntime
  & QuickToolsIpcRuntime
  & LoreIpcRuntime
  & AssistantIpcRuntime
  & SettingsIpcRuntime
  & MusicPlaybackIpcRuntime
  & VersionIpcRuntime
  & BackupIpcRuntime
  & PlotsIpcRuntime
  & StructureIpcRuntime
  & WorkspaceIpcRuntime
  & PublishingIpcRuntime;

export function createApplicationRuntimes(runtime: ExtractedApplicationRuntime) {
  return Object.freeze({
    activity: pickActivityRuntime(runtime),
    assistant: pickAssistantRuntime(runtime),
    backup: pickBackupRuntime(runtime),
    characters: pickCharactersRuntime(runtime),
    canon: pickCanonRuntime(runtime),
    continuity: pickContinuityRuntime(runtime),
    characterKnowledge: pickCharacterKnowledgeRuntime(runtime),
    contextPlanner: pickContextPlannerRuntime(runtime),
    narrativeDigest: pickNarrativeDigestRuntime(runtime),
    foreshadowing: pickForeshadowingRuntime(runtime),
    fragments: pickFragmentsRuntime(runtime),
    manuscriptAnnotations: pickManuscriptAnnotationsRuntime(runtime),
    lore: pickLoreRuntime(runtime),
    musicPlayback: pickMusicPlaybackRuntime(runtime),
    plots: pickPlotsRuntime(runtime),
    publishing: pickPublishingRuntime(runtime),
    schedule: pickScheduleRuntime(runtime),
    settings: pickSettingsRuntime(runtime),
    structure: pickStructureRuntime(runtime),
    version: pickVersionRuntime(runtime),
    workspace: pickWorkspaceRuntime(runtime),
    quickTools: pickQuickToolsRuntime(runtime),
  });
}

export type ApplicationRuntimes = ReturnType<typeof createApplicationRuntimes>;
