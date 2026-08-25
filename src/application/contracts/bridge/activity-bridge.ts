import {
  parseConfigureAndStartPomodoroCommand,
  parseGetPomodoroCommand,
  parsePomodoroPhaseCommand,
  parsePomodoroProjection,
  parseUpdatePomodoroNoteCommand,
  type ConfigureAndStartPomodoroCommand,
  type GetPomodoroCommand,
  type PomodoroPhaseCommand,
  type PomodoroProjection,
  type UpdatePomodoroNoteCommand,
} from "../../activity/pomodoro-contract";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type ListWorkActivityCommand,
  type StartFocusCycleCommand,
  type StartWritingSessionCommand,
  type StopFocusCycleCommand,
  type StopWritingSessionCommand,
  type WorkActivityProjection,
} from "../../activity/work-activity-contract";
import {
  parseExportWorkRecordsCommand,
  parseExportWorkRecordsResult,
  type ExportWorkRecordsCommand,
  type ExportWorkRecordsResult,
} from "../../activity/work-records-export";
import {
  parseGetWorkRecordsGoalsCommand,
  parseSaveWorkRecordsGoalsCommand,
  parseWorkRecordsGoalsProjection,
  type GetWorkRecordsGoalsCommand,
  type SaveWorkRecordsGoalsCommand,
  type WorkRecordsGoalsProjection,
} from "../../activity/work-records-preferences";
import {
  parseGetWorkReadthroughCommand,
  parseSaveWorkReadthroughCommand,
  parseWorkReadthroughProjection,
  type GetWorkReadthroughCommand,
  type SaveWorkReadthroughCommand,
  type WorkReadthroughProjection,
} from "../../activity/work-readthrough-calculator";

export const ACTIVITY_LIST_WORK_CHANNEL = "studio:activity:list-work";
export const ACTIVITY_EXPORT_RECORDS_CHANNEL = "studio:activity:export-records";
export const ACTIVITY_GET_RECORDS_GOALS_CHANNEL = "studio:activity:get-records-goals";
export const ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL = "studio:activity:save-records-goals";
export const ACTIVITY_GET_READTHROUGH_CHANNEL = "studio:activity:get-readthrough";
export const ACTIVITY_SAVE_READTHROUGH_CHANNEL = "studio:activity:save-readthrough";
export const ACTIVITY_START_SESSION_CHANNEL = "studio:activity:start-session";
export const ACTIVITY_STOP_SESSION_CHANNEL = "studio:activity:stop-session";
export const ACTIVITY_START_FOCUS_CHANNEL = "studio:activity:start-focus";
export const ACTIVITY_STOP_FOCUS_CHANNEL = "studio:activity:stop-focus";
export const ACTIVITY_GET_POMODORO_CHANNEL = "studio:activity:get-pomodoro";
export const ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL = "studio:activity:configure-start-pomodoro";
export const ACTIVITY_PAUSE_POMODORO_CHANNEL = "studio:activity:pause-pomodoro";
export const ACTIVITY_RESUME_POMODORO_CHANNEL = "studio:activity:resume-pomodoro";
export const ACTIVITY_RECONCILE_POMODORO_CHANNEL = "studio:activity:reconcile-pomodoro";
export const ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL = "studio:activity:update-pomodoro-note";
export const ACTIVITY_STOP_POMODORO_CHANNEL = "studio:activity:stop-pomodoro";

export type ActivityBridge = Readonly<{
  exportRecords: (command: ExportWorkRecordsCommand) => Promise<ExportWorkRecordsResult>;
  listWork: (command: ListWorkActivityCommand) => Promise<WorkActivityProjection>;
  getRecordsGoals: (command: GetWorkRecordsGoalsCommand) => Promise<WorkRecordsGoalsProjection>;
  saveRecordsGoals: (command: SaveWorkRecordsGoalsCommand) => Promise<WorkRecordsGoalsProjection>;
  getReadthrough: (command: GetWorkReadthroughCommand) => Promise<WorkReadthroughProjection>;
  saveReadthrough: (command: SaveWorkReadthroughCommand) => Promise<WorkReadthroughProjection>;
  startSession: (command: StartWritingSessionCommand) => Promise<WorkActivityProjection>;
  stopSession: (command: StopWritingSessionCommand) => Promise<WorkActivityProjection>;
  startFocus: (command: StartFocusCycleCommand) => Promise<WorkActivityProjection>;
  stopFocus: (command: StopFocusCycleCommand) => Promise<WorkActivityProjection>;
  getPomodoro: (command: GetPomodoroCommand) => Promise<PomodoroProjection>;
  configureAndStartPomodoro: (command: ConfigureAndStartPomodoroCommand) => Promise<PomodoroProjection>;
  pausePomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
  resumePomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
  reconcilePomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
  updatePomodoroNote: (command: UpdatePomodoroNoteCommand) => Promise<PomodoroProjection>;
  stopPomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
}>;

export type ActivityBridgeChannel =
  | typeof ACTIVITY_LIST_WORK_CHANNEL
  | typeof ACTIVITY_EXPORT_RECORDS_CHANNEL
  | typeof ACTIVITY_GET_RECORDS_GOALS_CHANNEL
  | typeof ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL
  | typeof ACTIVITY_GET_READTHROUGH_CHANNEL
  | typeof ACTIVITY_SAVE_READTHROUGH_CHANNEL
  | typeof ACTIVITY_START_SESSION_CHANNEL
  | typeof ACTIVITY_STOP_SESSION_CHANNEL
  | typeof ACTIVITY_START_FOCUS_CHANNEL
  | typeof ACTIVITY_STOP_FOCUS_CHANNEL
  | typeof ACTIVITY_GET_POMODORO_CHANNEL
  | typeof ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL
  | typeof ACTIVITY_PAUSE_POMODORO_CHANNEL
  | typeof ACTIVITY_RESUME_POMODORO_CHANNEL
  | typeof ACTIVITY_RECONCILE_POMODORO_CHANNEL
  | typeof ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL
  | typeof ACTIVITY_STOP_POMODORO_CHANNEL;

export type ActivityBridgePayload =
  | ExportWorkRecordsCommand
  | ListWorkActivityCommand
  | GetWorkRecordsGoalsCommand
  | SaveWorkRecordsGoalsCommand
  | GetWorkReadthroughCommand
  | SaveWorkReadthroughCommand
  | StartWritingSessionCommand
  | StopWritingSessionCommand
  | StartFocusCycleCommand
  | StopFocusCycleCommand
  | GetPomodoroCommand
  | ConfigureAndStartPomodoroCommand
  | PomodoroPhaseCommand
  | UpdatePomodoroNoteCommand;

export type ActivityBridgeInvoke = (
  channel: ActivityBridgeChannel,
  payload?: ActivityBridgePayload,
) => Promise<unknown>;

function parseResult<T>(value: unknown, parser: (value: unknown) => T, message: string): T {
  try { return parser(value); } catch { throw new Error(message); }
}

export function createActivityBridge(invoke: ActivityBridgeInvoke): ActivityBridge {
  return Object.freeze({
    exportRecords: async (input) => parseResult(
      await invoke(ACTIVITY_EXPORT_RECORDS_CHANNEL, parseExportWorkRecordsCommand(input)),
      parseExportWorkRecordsResult,
      "Invalid Work records export result",
    ),
    listWork: async (input) => parseResult(
      await invoke(ACTIVITY_LIST_WORK_CHANNEL, parseListWorkActivityCommand(input)),
      parseWorkActivityProjection,
      "Invalid Work activity projection",
    ),
    getRecordsGoals: async (input) => parseResult(
      await invoke(ACTIVITY_GET_RECORDS_GOALS_CHANNEL, parseGetWorkRecordsGoalsCommand(input)),
      parseWorkRecordsGoalsProjection,
      "Invalid Work records goals projection",
    ),
    saveRecordsGoals: async (input) => parseResult(
      await invoke(ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL, parseSaveWorkRecordsGoalsCommand(input)),
      parseWorkRecordsGoalsProjection,
      "Invalid saved Work records goals projection",
    ),
    getReadthrough: async (input) => parseResult(
      await invoke(ACTIVITY_GET_READTHROUGH_CHANNEL, parseGetWorkReadthroughCommand(input)),
      parseWorkReadthroughProjection,
      "Invalid Work readthrough projection",
    ),
    saveReadthrough: async (input) => parseResult(
      await invoke(ACTIVITY_SAVE_READTHROUGH_CHANNEL, parseSaveWorkReadthroughCommand(input)),
      parseWorkReadthroughProjection,
      "Invalid saved Work readthrough projection",
    ),
    startSession: async (input) => parseResult(
      await invoke(ACTIVITY_START_SESSION_CHANNEL, parseStartWritingSessionCommand(input)),
      parseWorkActivityProjection,
      "Invalid WritingSession result",
    ),
    stopSession: async (input) => parseResult(
      await invoke(ACTIVITY_STOP_SESSION_CHANNEL, parseStopWritingSessionCommand(input)),
      parseWorkActivityProjection,
      "Invalid WritingSession result",
    ),
    startFocus: async (input) => parseResult(
      await invoke(ACTIVITY_START_FOCUS_CHANNEL, parseStartFocusCycleCommand(input)),
      parseWorkActivityProjection,
      "Invalid FocusCycle result",
    ),
    stopFocus: async (input) => parseResult(
      await invoke(ACTIVITY_STOP_FOCUS_CHANNEL, parseStopFocusCycleCommand(input)),
      parseWorkActivityProjection,
      "Invalid FocusCycle result",
    ),
    getPomodoro: async (input) => parseResult(
      await invoke(ACTIVITY_GET_POMODORO_CHANNEL, parseGetPomodoroCommand(input)),
      parsePomodoroProjection,
      "Invalid Pomodoro projection",
    ),
    configureAndStartPomodoro: async (input) => parseResult(
      await invoke(ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL, parseConfigureAndStartPomodoroCommand(input)),
      parsePomodoroProjection,
      "Invalid configured Pomodoro projection",
    ),
    pausePomodoro: async (input) => parseResult(
      await invoke(ACTIVITY_PAUSE_POMODORO_CHANNEL, parsePomodoroPhaseCommand(input)),
      parsePomodoroProjection,
      "Invalid paused Pomodoro projection",
    ),
    resumePomodoro: async (input) => parseResult(
      await invoke(ACTIVITY_RESUME_POMODORO_CHANNEL, parsePomodoroPhaseCommand(input)),
      parsePomodoroProjection,
      "Invalid resumed Pomodoro projection",
    ),
    reconcilePomodoro: async (input) => parseResult(
      await invoke(ACTIVITY_RECONCILE_POMODORO_CHANNEL, parsePomodoroPhaseCommand(input)),
      parsePomodoroProjection,
      "Invalid reconciled Pomodoro projection",
    ),
    updatePomodoroNote: async (input) => parseResult(
      await invoke(ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL, parseUpdatePomodoroNoteCommand(input)),
      parsePomodoroProjection,
      "Invalid updated Pomodoro projection",
    ),
    stopPomodoro: async (input) => parseResult(
      await invoke(ACTIVITY_STOP_POMODORO_CHANNEL, parsePomodoroPhaseCommand(input)),
      parsePomodoroProjection,
      "Invalid stopped Pomodoro projection",
    ),
  });
}
