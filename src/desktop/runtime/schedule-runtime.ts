import type { ScheduleIpcRuntime } from "../ipc/register-schedule-ipc";

export function pickScheduleRuntime(runtime: ScheduleIpcRuntime): ScheduleIpcRuntime {
  return Object.freeze({
    listWorkSchedule: (command) => runtime.listWorkSchedule(command),
    listWorkCalendar: (command) => runtime.listWorkCalendar(command),
    getStudioToday: (command) => runtime.getStudioToday(command),
    createWorkScheduleItem: (command) => runtime.createWorkScheduleItem(command),
    updateWorkScheduleItem: (command) => runtime.updateWorkScheduleItem(command),
    retireWorkScheduleItem: (command) => runtime.retireWorkScheduleItem(command),
    setWorkScheduleCompletion: (command) => runtime.setWorkScheduleCompletion(command),
  });
}
