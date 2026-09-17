import {
  parseGetWorkQuickMemoCommand,
  parseSaveWorkQuickMemoCommand,
  parseWorkQuickMemoProjection,
  type GetWorkQuickMemoCommand,
  type SaveWorkQuickMemoCommand,
  type WorkQuickMemoProjection,
} from "../../quick-tools/work-quick-memo";

export const QUICK_TOOLS_GET_MEMO_CHANNEL = "studio:quick-tools:get-memo";
export const QUICK_TOOLS_SAVE_MEMO_CHANNEL = "studio:quick-tools:save-memo";

export type QuickToolsBridgePayload =
  | GetWorkQuickMemoCommand
  | SaveWorkQuickMemoCommand;
export type QuickToolsBridgeChannel =
  | typeof QUICK_TOOLS_GET_MEMO_CHANNEL
  | typeof QUICK_TOOLS_SAVE_MEMO_CHANNEL;
export type QuickToolsBridge = Readonly<{
  getMemo: (command: GetWorkQuickMemoCommand) => Promise<WorkQuickMemoProjection>;
  saveMemo: (command: SaveWorkQuickMemoCommand) => Promise<WorkQuickMemoProjection>;
}>;
export type QuickToolsBridgeInvoke = (
  channel: QuickToolsBridgeChannel,
  payload?: QuickToolsBridgePayload,
) => Promise<unknown>;

export function createQuickToolsBridge(
  invoke: QuickToolsBridgeInvoke,
): QuickToolsBridge {
  const parse = (value: unknown, message: string) => {
    try { return parseWorkQuickMemoProjection(value); } catch {
      throw new Error(message);
    }
  };
  return Object.freeze({
    getMemo: async (input) => parse(
      await invoke(QUICK_TOOLS_GET_MEMO_CHANNEL, parseGetWorkQuickMemoCommand(input)),
      "Invalid Work quick memo projection",
    ),
    saveMemo: async (input) => parse(
      await invoke(QUICK_TOOLS_SAVE_MEMO_CHANNEL, parseSaveWorkQuickMemoCommand(input)),
      "Invalid saved Work quick memo projection",
    ),
  });
}
