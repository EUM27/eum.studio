import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  SCHEDULE_CREATE_ITEM_CHANNEL,
  SCHEDULE_LIST_CALENDAR_CHANNEL,
  SCHEDULE_LIST_TODAY_CHANNEL,
  SCHEDULE_LIST_WORK_CHANNEL,
  SCHEDULE_RETIRE_ITEM_CHANNEL,
  SCHEDULE_SET_COMPLETION_CHANNEL,
  SCHEDULE_UPDATE_ITEM_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreateWorkScheduleItemCommand,
  parseListWorkScheduleCommand,
  parseRetireWorkScheduleItemCommand,
  parseSetWorkScheduleCompletionCommand,
  parseUpdateWorkScheduleItemCommand,
  type CreateWorkScheduleItemCommand,
  type ListWorkScheduleCommand,
  type RetireWorkScheduleItemCommand,
  type SetWorkScheduleCompletionCommand,
  type UpdateWorkScheduleItemCommand,
  type WorkScheduleItemProjection,
  type WorkScheduleProjection,
} from "../../application/schedule/work-schedule-contract";
import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import {
  parseGetStudioTodayCommand,
  type GetStudioTodayCommand,
  type StudioTodayProjection,
} from "../../application/today/studio-today-contract";

export type ScheduleIpcRuntime = Readonly<{
  listWorkSchedule: (command: ListWorkScheduleCommand) => Promise<WorkScheduleProjection>;
  listWorkCalendar: (command: ListWorkScheduleCommand) => Promise<WorkCalendarProjection>;
  getStudioToday: (command: GetStudioTodayCommand) => Promise<StudioTodayProjection>;
  createWorkScheduleItem: (command: CreateWorkScheduleItemCommand) => Promise<WorkScheduleItemProjection>;
  updateWorkScheduleItem: (command: UpdateWorkScheduleItemCommand) => Promise<WorkScheduleItemProjection>;
  retireWorkScheduleItem: (command: RetireWorkScheduleItemCommand) => Promise<void>;
  setWorkScheduleCompletion: (command: SetWorkScheduleCompletionCommand) => Promise<WorkScheduleItemProjection>;
}>;

export function registerScheduleIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: ScheduleIpcRuntime;
}>): void {
  const handle = <T>(channel: string, parse: (value: unknown) => T, run: (command: T) => Promise<unknown>) =>
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  handle(SCHEDULE_LIST_WORK_CHANNEL, parseListWorkScheduleCommand, input.runtime.listWorkSchedule);
  handle(SCHEDULE_LIST_CALENDAR_CHANNEL, parseListWorkScheduleCommand, input.runtime.listWorkCalendar);
  handle(SCHEDULE_LIST_TODAY_CHANNEL, parseGetStudioTodayCommand, input.runtime.getStudioToday);
  handle(SCHEDULE_CREATE_ITEM_CHANNEL, parseCreateWorkScheduleItemCommand, input.runtime.createWorkScheduleItem);
  handle(SCHEDULE_UPDATE_ITEM_CHANNEL, parseUpdateWorkScheduleItemCommand, input.runtime.updateWorkScheduleItem);
  handle(SCHEDULE_RETIRE_ITEM_CHANNEL, parseRetireWorkScheduleItemCommand, input.runtime.retireWorkScheduleItem);
  handle(SCHEDULE_SET_COMPLETION_CHANNEL, parseSetWorkScheduleCompletionCommand, input.runtime.setWorkScheduleCompletion);
}
