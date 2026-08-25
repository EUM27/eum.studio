import {
  parseCreateWorkScheduleItemCommand,
  parseListWorkScheduleCommand,
  parseRetireWorkScheduleItemCommand,
  parseSetWorkScheduleCompletionCommand,
  parseUpdateWorkScheduleItemCommand,
  parseWorkScheduleItemProjection,
  parseWorkScheduleProjection,
  type CreateWorkScheduleItemCommand,
  type ListWorkScheduleCommand,
  type RetireWorkScheduleItemCommand,
  type SetWorkScheduleCompletionCommand,
  type UpdateWorkScheduleItemCommand,
  type WorkScheduleItemProjection,
  type WorkScheduleProjection,
} from "../../schedule/work-schedule-contract";
import {
  parseWorkCalendarProjection,
  type WorkCalendarProjection,
} from "../../schedule/work-calendar-contract";
import {
  parseGetStudioTodayCommand,
  parseStudioTodayProjection,
  type GetStudioTodayCommand,
  type StudioTodayProjection,
} from "../../today/studio-today-contract";

export const SCHEDULE_LIST_WORK_CHANNEL = "studio:schedule:list-work";
export const SCHEDULE_LIST_CALENDAR_CHANNEL = "studio:schedule:list-calendar";
export const SCHEDULE_LIST_TODAY_CHANNEL = "studio:schedule:list-today";
export const SCHEDULE_CREATE_ITEM_CHANNEL = "studio:schedule:create-item";
export const SCHEDULE_UPDATE_ITEM_CHANNEL = "studio:schedule:update-item";
export const SCHEDULE_RETIRE_ITEM_CHANNEL = "studio:schedule:retire-item";
export const SCHEDULE_SET_COMPLETION_CHANNEL = "studio:schedule:set-completion";

export type ScheduleBridgePayload =
  | ListWorkScheduleCommand
  | GetStudioTodayCommand
  | CreateWorkScheduleItemCommand
  | UpdateWorkScheduleItemCommand
  | RetireWorkScheduleItemCommand
  | SetWorkScheduleCompletionCommand;

export type ScheduleBridgeChannel =
  | typeof SCHEDULE_LIST_WORK_CHANNEL
  | typeof SCHEDULE_LIST_CALENDAR_CHANNEL
  | typeof SCHEDULE_LIST_TODAY_CHANNEL
  | typeof SCHEDULE_CREATE_ITEM_CHANNEL
  | typeof SCHEDULE_UPDATE_ITEM_CHANNEL
  | typeof SCHEDULE_RETIRE_ITEM_CHANNEL
  | typeof SCHEDULE_SET_COMPLETION_CHANNEL;

export type ScheduleBridge = Readonly<{
  listWork: (command: ListWorkScheduleCommand) => Promise<WorkScheduleProjection>;
  listCalendar: (command: ListWorkScheduleCommand) => Promise<WorkCalendarProjection>;
  listToday: (command: GetStudioTodayCommand) => Promise<StudioTodayProjection>;
  createItem: (command: CreateWorkScheduleItemCommand) => Promise<WorkScheduleItemProjection>;
  updateItem: (command: UpdateWorkScheduleItemCommand) => Promise<WorkScheduleItemProjection>;
  retireItem: (command: RetireWorkScheduleItemCommand) => Promise<void>;
  setCompletion: (command: SetWorkScheduleCompletionCommand) => Promise<WorkScheduleItemProjection>;
}>;

export type ScheduleBridgeInvoke = (
  channel: ScheduleBridgeChannel,
  payload?: ScheduleBridgePayload,
) => Promise<unknown>;

function parseResult<T>(value: unknown, parse: (value: unknown) => T, error: string): T {
  try { return parse(value); } catch { throw new Error(error); }
}

export function createScheduleBridge(invoke: ScheduleBridgeInvoke): ScheduleBridge {
  return Object.freeze({
    listWork: async (input) => parseResult(await invoke(SCHEDULE_LIST_WORK_CHANNEL, parseListWorkScheduleCommand(input)), parseWorkScheduleProjection, "Invalid Work schedule projection"),
    listCalendar: async (input) => parseResult(await invoke(SCHEDULE_LIST_CALENDAR_CHANNEL, parseListWorkScheduleCommand(input)), parseWorkCalendarProjection, "Invalid Work calendar projection"),
    listToday: async (input) => parseResult(await invoke(SCHEDULE_LIST_TODAY_CHANNEL, parseGetStudioTodayCommand(input)), parseStudioTodayProjection, "Invalid Studio Today projection"),
    createItem: async (input) => parseResult(await invoke(SCHEDULE_CREATE_ITEM_CHANNEL, parseCreateWorkScheduleItemCommand(input)), parseWorkScheduleItemProjection, "Invalid created Work schedule item"),
    updateItem: async (input) => parseResult(await invoke(SCHEDULE_UPDATE_ITEM_CHANNEL, parseUpdateWorkScheduleItemCommand(input)), parseWorkScheduleItemProjection, "Invalid updated Work schedule item"),
    retireItem: async (input) => {
      const value = await invoke(
        SCHEDULE_RETIRE_ITEM_CHANNEL,
        parseRetireWorkScheduleItemCommand(input),
      );
      if (value !== undefined) {
        throw new Error("Invalid Work schedule retirement result");
      }
    },
    setCompletion: async (input) => parseResult(await invoke(SCHEDULE_SET_COMPLETION_CHANNEL, parseSetWorkScheduleCompletionCommand(input)), parseWorkScheduleItemProjection, "Invalid Work schedule completion result"),
  });
}
