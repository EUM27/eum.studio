import type { ActivityIpcRuntime } from "../ipc/register-activity-ipc";

export function pickActivityRuntime(runtime: ActivityIpcRuntime): ActivityIpcRuntime {
  return Object.freeze({
    listWorkActivity: (command) => runtime.listWorkActivity(command),
    getWorkRecordsGoals: (command) => runtime.getWorkRecordsGoals(command),
    saveWorkRecordsGoals: (command) => runtime.saveWorkRecordsGoals(command),
    getWorkReadthrough: (command) => runtime.getWorkReadthrough(command),
    saveWorkReadthrough: (command) => runtime.saveWorkReadthrough(command),
    startWritingSession: (command) => runtime.startWritingSession(command),
    stopWritingSession: (command) => runtime.stopWritingSession(command),
    startFocusCycle: (command) => runtime.startFocusCycle(command),
    stopFocusCycle: (command) => runtime.stopFocusCycle(command),
    getPomodoro: (command) => runtime.getPomodoro(command),
    configureAndStartPomodoro: (command) => runtime.configureAndStartPomodoro(command),
    pausePomodoro: (command) => runtime.pausePomodoro(command),
    resumePomodoro: (command) => runtime.resumePomodoro(command),
    reconcilePomodoro: (command) => runtime.reconcilePomodoro(command),
    updatePomodoroNote: (command) => runtime.updatePomodoroNote(command),
    stopPomodoro: (command) => runtime.stopPomodoro(command),
  });
}
