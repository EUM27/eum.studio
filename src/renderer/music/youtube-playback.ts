export type YouTubeVideoRequest = string | Readonly<{ videoId: string; startSeconds: number }>;
export type YouTubePlaybackPort = Readonly<{
  loadVideoById: (request: YouTubeVideoRequest) => void;
  cueVideoById: (request: YouTubeVideoRequest) => void;
}>;

export function loadYouTubePlayback(
  player: YouTubePlaybackPort,
  videoId: string,
  resume?: Readonly<{ currentTime: number; paused: boolean }>,
): void {
  if (resume === undefined) { player.loadVideoById(videoId); return; }
  const request = { videoId, startSeconds: resume.currentTime };
  if (resume.paused) player.cueVideoById(request);
  else player.loadVideoById(request);
}
