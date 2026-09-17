import {
  createSettingsBridge,
  type BridgeInvoke,
  type SettingsBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadSettingsBridge(
  invoke: BridgeInvoke,
): SettingsBridge {
  return createSettingsBridge((channel, payload) => invoke(channel, payload));
}
