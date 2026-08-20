export const YOUTUBE_PLAYER_REQUEST_FILTER = {
  urls: [
    "https://www.youtube.com/*",
    "https://www.youtube-nocookie.com/*",
  ],
};

export function withYouTubePlayerReferer(
  requestHeaders: Readonly<Record<string, string>>,
  playerReferer: string,
): Record<string, string> {
  if (
    typeof requestHeaders.Referer === "string" &&
    requestHeaders.Referer.length > 0
  ) {
    return { ...requestHeaders };
  }
  return {
    ...requestHeaders,
    Referer: playerReferer,
  };
}
