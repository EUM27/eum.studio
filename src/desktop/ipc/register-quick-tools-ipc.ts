import type { IpcMain, IpcMainInvokeEvent } from "electron";
import {
  QUICK_TOOLS_GET_MEMO_CHANNEL,
  QUICK_TOOLS_SAVE_MEMO_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseGetWorkQuickMemoCommand,
  parseSaveWorkQuickMemoCommand,
  type GetWorkQuickMemoCommand,
  type SaveWorkQuickMemoCommand,
  type WorkQuickMemoProjection,
} from "../../application/quick-tools/work-quick-memo";

export type QuickToolsIpcRuntime = Readonly<{
  getWorkQuickMemo: (command: GetWorkQuickMemoCommand) => Promise<WorkQuickMemoProjection>;
  saveWorkQuickMemo: (command: SaveWorkQuickMemoCommand) => Promise<WorkQuickMemoProjection>;
}>;

export function registerQuickToolsIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: QuickToolsIpcRuntime;
}>): void {
  input.ipcMain.handle(QUICK_TOOLS_GET_MEMO_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.getWorkQuickMemo(parseGetWorkQuickMemoCommand(value));
  });
  input.ipcMain.handle(QUICK_TOOLS_SAVE_MEMO_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.saveWorkQuickMemo(parseSaveWorkQuickMemoCommand(value));
  });
}
