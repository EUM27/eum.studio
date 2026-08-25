import type { MusicTrackProjection } from "../../../application/music/media-track";

export type MusicPlaybackRequest = Readonly<{
  nonce: number;
  startIndex: number;
  tracks: readonly MusicTrackProjection[];
}>;

export function createMusicPlaybackRequest(
  currentNonce: number,
  tracks: readonly MusicTrackProjection[],
  startIndex = 0,
): MusicPlaybackRequest | null {
  if (tracks.length === 0) return null;
  return Object.freeze({
    nonce: currentNonce + 1,
    startIndex: Math.min(
      Math.max(Math.trunc(startIndex), 0),
      tracks.length - 1,
    ),
    tracks: Object.freeze([...tracks]),
  });
}
