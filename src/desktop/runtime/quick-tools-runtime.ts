import type { QuickToolsIpcRuntime } from "../ipc/register-quick-tools-ipc";

export function pickQuickToolsRuntime(runtime: QuickToolsIpcRuntime): QuickToolsIpcRuntime {
  return Object.freeze({
    getWorkQuickMemo: (command) => runtime.getWorkQuickMemo(command),
    saveWorkQuickMemo: (command) => runtime.saveWorkQuickMemo(command),
  });
}
