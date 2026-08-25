import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL,
  ACTIVITY_EXPORT_RECORDS_CHANNEL,
  ACTIVITY_GET_POMODORO_CHANNEL,
  ACTIVITY_GET_READTHROUGH_CHANNEL,
  ACTIVITY_GET_RECORDS_GOALS_CHANNEL,
  ACTIVITY_LIST_WORK_CHANNEL,
  ACTIVITY_PAUSE_POMODORO_CHANNEL,
  ACTIVITY_RECONCILE_POMODORO_CHANNEL,
  ACTIVITY_RESUME_POMODORO_CHANNEL,
  ACTIVITY_SAVE_READTHROUGH_CHANNEL,
  ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL,
  ACTIVITY_START_FOCUS_CHANNEL,
  ACTIVITY_START_SESSION_CHANNEL,
  ACTIVITY_STOP_FOCUS_CHANNEL,
  ACTIVITY_STOP_POMODORO_CHANNEL,
  ACTIVITY_STOP_SESSION_CHANNEL,
  ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseConfigureAndStartPomodoroCommand,
  parseGetPomodoroCommand,
  parsePomodoroPhaseCommand,
  parseUpdatePomodoroNoteCommand,
  type ConfigureAndStartPomodoroCommand,
  type GetPomodoroCommand,
  type PomodoroPhaseCommand,
  type PomodoroProjection,
  type UpdatePomodoroNoteCommand,
} from "../../application/activity/pomodoro-contract";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  type ListWorkActivityCommand,
  type StartFocusCycleCommand,
  type StartWritingSessionCommand,
  type StopFocusCycleCommand,
  type StopWritingSessionCommand,
  type WorkActivityProjection,
} from "../../application/activity/work-activity-contract";
import {
  parseGetWorkRecordsGoalsCommand,
  parseSaveWorkRecordsGoalsCommand,
  type GetWorkRecordsGoalsCommand,
  type SaveWorkRecordsGoalsCommand,
  type WorkRecordsGoalsProjection,
} from "../../application/activity/work-records-preferences";
import {
  parseGetWorkReadthroughCommand,
  parseSaveWorkReadthroughCommand,
  type GetWorkReadthroughCommand,
  type SaveWorkReadthroughCommand,
  type WorkReadthroughProjection,
} from "../../application/activity/work-readthrough-calculator";
import {
  parseExportWorkRecordsCommand,
  type ExportWorkRecordsCommand,
  type ExportWorkRecordsResult,
} from "../../application/activity/work-records-export";

export type ActivityIpcRuntime = Readonly<{
  listWorkActivity: (command: ListWorkActivityCommand) => Promise<WorkActivityProjection>;
  getWorkRecordsGoals: (command: GetWorkRecordsGoalsCommand) => Promise<WorkRecordsGoalsProjection>;
  saveWorkRecordsGoals: (command: SaveWorkRecordsGoalsCommand) => Promise<WorkRecordsGoalsProjection>;
  getWorkReadthrough: (command: GetWorkReadthroughCommand) => Promise<WorkReadthroughProjection>;
  saveWorkReadthrough: (command: SaveWorkReadthroughCommand) => Promise<WorkReadthroughProjection>;
  startWritingSession: (command: StartWritingSessionCommand) => Promise<WorkActivityProjection>;
  stopWritingSession: (command: StopWritingSessionCommand) => Promise<WorkActivityProjection>;
  startFocusCycle: (command: StartFocusCycleCommand) => Promise<WorkActivityProjection>;
  stopFocusCycle: (command: StopFocusCycleCommand) => Promise<WorkActivityProjection>;
  getPomodoro: (command: GetPomodoroCommand) => Promise<PomodoroProjection>;
  configureAndStartPomodoro: (command: ConfigureAndStartPomodoroCommand) => Promise<PomodoroProjection>;
  pausePomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
  resumePomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
  reconcilePomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
  updatePomodoroNote: (command: UpdatePomodoroNoteCommand) => Promise<PomodoroProjection>;
  stopPomodoro: (command: PomodoroPhaseCommand) => Promise<PomodoroProjection>;
}>;

export function registerActivityIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: ActivityIpcRuntime;
  exportRecords: (
    command: ExportWorkRecordsCommand,
  ) => Promise<ExportWorkRecordsResult>;
}>): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ) => input.ipcMain.handle(channel, (event, value: unknown) => {
    input.authorizeSender(event);
    return run(parse(value));
  });
  handle(
    ACTIVITY_EXPORT_RECORDS_CHANNEL,
    parseExportWorkRecordsCommand,
    input.exportRecords,
  );
  handle(ACTIVITY_LIST_WORK_CHANNEL, parseListWorkActivityCommand, input.runtime.listWorkActivity);
  handle(ACTIVITY_GET_RECORDS_GOALS_CHANNEL, parseGetWorkRecordsGoalsCommand, input.runtime.getWorkRecordsGoals);
  handle(ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL, parseSaveWorkRecordsGoalsCommand, input.runtime.saveWorkRecordsGoals);
  handle(ACTIVITY_GET_READTHROUGH_CHANNEL, parseGetWorkReadthroughCommand, input.runtime.getWorkReadthrough);
  handle(ACTIVITY_SAVE_READTHROUGH_CHANNEL, parseSaveWorkReadthroughCommand, input.runtime.saveWorkReadthrough);
  handle(ACTIVITY_START_SESSION_CHANNEL, parseStartWritingSessionCommand, input.runtime.startWritingSession);
  handle(ACTIVITY_STOP_SESSION_CHANNEL, parseStopWritingSessionCommand, input.runtime.stopWritingSession);
  handle(ACTIVITY_START_FOCUS_CHANNEL, parseStartFocusCycleCommand, input.runtime.startFocusCycle);
  handle(ACTIVITY_STOP_FOCUS_CHANNEL, parseStopFocusCycleCommand, input.runtime.stopFocusCycle);
  handle(ACTIVITY_GET_POMODORO_CHANNEL, parseGetPomodoroCommand, input.runtime.getPomodoro);
  handle(ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL, parseConfigureAndStartPomodoroCommand, input.runtime.configureAndStartPomodoro);
  handle(ACTIVITY_PAUSE_POMODORO_CHANNEL, parsePomodoroPhaseCommand, input.runtime.pausePomodoro);
  handle(ACTIVITY_RESUME_POMODORO_CHANNEL, parsePomodoroPhaseCommand, input.runtime.resumePomodoro);
  handle(ACTIVITY_RECONCILE_POMODORO_CHANNEL, parsePomodoroPhaseCommand, input.runtime.reconcilePomodoro);
  handle(ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL, parseUpdatePomodoroNoteCommand, input.runtime.updatePomodoroNote);
  handle(ACTIVITY_STOP_POMODORO_CHANNEL, parsePomodoroPhaseCommand, input.runtime.stopPomodoro);
}
