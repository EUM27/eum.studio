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

export function appendMusicTracksToQueue(
  queue: readonly MusicTrackProjection[],
  tracks: readonly MusicTrackProjection[],
): readonly MusicTrackProjection[] {
  const identities = new Set(queue.map(musicTrackIdentity));
  const next = [...queue];
  for (const track of tracks) {
    const identity = musicTrackIdentity(track);
    if (identities.has(identity)) continue;
    identities.add(identity);
    next.push(track);
  }
  return Object.freeze(next);
}

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
