import {
  createMusicPlaybackBridge,
  type BridgeInvoke,
  type MusicPlaybackBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadMusicPlaybackBridge(
  invoke: BridgeInvoke,
): MusicPlaybackBridge {
  return createMusicPlaybackBridge((channel, payload) =>
    invoke(channel, payload)
  );
}
