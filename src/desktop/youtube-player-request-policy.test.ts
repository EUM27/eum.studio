import { describe, expect, it } from "vitest";

import {
  withYouTubePlayerReferer,
  YOUTUBE_PLAYER_REQUEST_FILTER,
} from "./youtube-player-request-policy";

describe("YouTube player request policy", () => {
  it("adds the configured desktop app identity when file rendering has no Referer", () => {
    expect(withYouTubePlayerReferer({ Accept: "*/*" }, "https://eum-studio"))
      .toEqual({ Accept: "*/*", Referer: "https://eum-studio" });
    expect(YOUTUBE_PLAYER_REQUEST_FILTER.urls).toEqual([
      "https://www.youtube.com/*",
      "https://www.youtube-nocookie.com/*",
    ]);
  });

  it("preserves a renderer Referer that is already present", () => {
    expect(withYouTubePlayerReferer(
      { Referer: "https://renderer.example/" },
      "https://eum-studio",
    )).toEqual({ Referer: "https://renderer.example/" });
  });
});
