import {
  musicTrackIdentity,
  type LocalMediaTrackProjection,
  type MusicTrackProjection,
} from "../../../application/music/media-track";
import type { WorkMusicSettings } from "../../../application/music/work-music-settings";

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

export function withoutRegisteredLocalMedia(
  settings: WorkMusicSettings,
  removedTrack: LocalMediaTrackProjection,
): WorkMusicSettings {
  const removedIdentity = musicTrackIdentity(removedTrack);
  const keepTrack = (track: MusicTrackProjection) =>
    musicTrackIdentity(track) !== removedIdentity;
  return Object.freeze({
    ...settings,
    favoriteTracks: Object.freeze(settings.favoriteTracks.filter(keepTrack)),
    playlistTracks: Object.freeze(settings.playlistTracks.filter(keepTrack)),
    localMedia: Object.freeze(settings.localMedia.filter(keepTrack)),
  });
}
