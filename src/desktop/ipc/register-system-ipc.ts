import type { IpcMain } from "electron";

import {
  RUNTIME_INFO_CHANNEL,
  type RuntimeInfo,
} from "../../application/contracts/studio-bridge";

export function registerSystemIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  getRuntimeInfo: () => RuntimeInfo;
}>): void {
  input.ipcMain.handle(RUNTIME_INFO_CHANNEL, input.getRuntimeInfo);
}
