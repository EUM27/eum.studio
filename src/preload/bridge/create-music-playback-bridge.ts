import {
  createMusicPlaybackBridge,
  type BridgeInvoke,
  type MusicPlaybackBridge,
} from "../../application/contracts/studio-bridge";
import type { SharedMusicBridge } from "../../application/music/shared-music-playback";

export function createPreloadMusicPlaybackBridge(
  invoke: BridgeInvoke,
  shared?: SharedMusicBridge,
): MusicPlaybackBridge {
  return Object.freeze({ ...createMusicPlaybackBridge((channel, payload) => invoke(channel, payload)), ...(shared === undefined ? {} : { shared }) });
}
