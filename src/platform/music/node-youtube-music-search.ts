import {
  parseYouTubeVideoProjection,
  type YouTubeMusicProfile,
  type YouTubeVideoProjection,
} from "../../application/music/youtube-music";
import type {
  YouTubeMusicConnectionStore,
} from "./node-youtube-music-connection-store";

type FetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type FetchLike = (
  input: string,
  init: Readonly<{ signal: AbortSignal }>,
) => Promise<FetchResponse>;

type YouTubeSearchItem = {
  readonly id?: { readonly videoId?: string };
  readonly snippet?: {
    readonly title?: string;
    readonly channelTitle?: string;
    readonly thumbnails?: {
      readonly medium?: { readonly url?: string };
    };
  };
};

const YOUTUBE_MUSIC_QUERY_EXCLUSIONS =
  `-shorts -short -tiktok -meme -"be like"`;
const YOUTUBE_LOW_VALUE_MUSIC_RESULT_RE =
  /(^|[\s#|:()[\]-])(shorts?|tiktok|tik\s*tok|memes?|be like|pov|reaction|reacts|compilation|funny moments)(?=$|[\s#|:()[\]-])/iu;
const YOUTUBE_LONG_FORM_MUSIC_QUERY_RE =
  /\b(extended|one\s*hour|1\s*hour|hour(?:long)?|loop(?:able|ed)?|mix|ambient|soundtrack|ost|playlist)\b/iu;

const HTML_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
});

function decodeEntities(value: string): string {
  return value.replace(
    /&amp;|&quot;|&#39;|&lt;|&gt;/gu,
    (entity) => HTML_ENTITIES[entity] ?? entity,
  );
}

function parseSearchItems(value: unknown): readonly YouTubeSearchItem[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("YouTube search response must be an object");
  }
  const items = (value as Record<string, unknown>).items;
  if (items === undefined) return Object.freeze([]);
  if (!Array.isArray(items)) {
    throw new Error("YouTube search response items must be an array");
  }
  return Object.freeze(items as YouTubeSearchItem[]);
}

function friendlyYouTubeError(status: number, body: string): string {
  let reason = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as {
      readonly error?: {
        readonly message?: string;
        readonly errors?: readonly { readonly reason?: string }[];
      };
    };
    reason = (parsed.error?.errors?.[0]?.reason ?? "").toLocaleLowerCase();
    message = parsed.error?.message ?? "";
  } catch {
    // YouTube can return a non-JSON error body.
  }
  const detail = `${reason} ${message} ${body}`.toLocaleLowerCase();
  if (
    reason === "accessnotconfigured" ||
    detail.includes("has not been used in project") ||
    detail.includes("it is disabled")
  ) {
    return "이 키의 Google Cloud 프로젝트에서 YouTube Data API v3가 활성화되지 않았습니다.";
  }
  if (reason === "keyinvalid" || detail.includes("api key not valid")) {
    return "YouTube Data API 키가 올바르지 않습니다.";
  }
  if (reason === "keyexpired") {
    return "YouTube Data API 키가 만료되었습니다.";
  }
  if (detail.includes("referer") || detail.includes("referrer")) {
    return "YouTube 검색은 main process에서 실행됩니다. API 키의 HTTP 리퍼러 제한을 확인하세요.";
  }
  if (
    reason === "quotaexceeded" ||
    reason === "dailylimitexceeded" ||
    detail.includes("quota")
  ) {
    return "YouTube Data API 일일 할당량을 초과했습니다.";
  }
  return `YouTube API 오류 (${status}): ${message || body.slice(0, 160)}`;
}

function watchUrl(profile: YouTubeMusicProfile, videoId: string): string {
  const url = new URL(profile.watchBaseUrl);
  url.searchParams.set("v", videoId);
  return url.toString();
}

function preferredDuration(query: string): "medium" | "long" {
  return YOUTUBE_LONG_FORM_MUSIC_QUERY_RE.test(query) ? "long" : "medium";
}

function searchUrl(
  profile: YouTubeMusicProfile,
  query: string,
  apiKey: string,
  limit: number,
  duration?: "medium" | "long",
): string {
  const url = new URL(`${profile.searchApiBaseUrl}/search`);
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(limit),
    q: `${query} ${YOUTUBE_MUSIC_QUERY_EXCLUSIONS}`,
    key: apiKey,
  }).toString();
  if (duration !== undefined) url.searchParams.set("videoDuration", duration);
  return url.toString();
}

function projectSearchItems(
  profile: YouTubeMusicProfile,
  items: readonly YouTubeSearchItem[],
): readonly YouTubeVideoProjection[] {
  const videos: YouTubeVideoProjection[] = [];
  for (const [index, item] of items.entries()) {
    const videoId = item.id?.videoId?.trim() ?? "";
    const title = decodeEntities(item.snippet?.title ?? "").trim();
    const channel = decodeEntities(item.snippet?.channelTitle ?? "").trim();
    if (
      videoId.length === 0 ||
      title.length === 0 ||
      channel.length === 0 ||
      YOUTUBE_LOW_VALUE_MUSIC_RESULT_RE.test(`${title} ${channel}`)
    ) {
      continue;
    }
    videos.push(parseYouTubeVideoProjection({
      providerId: profile.providerId,
      videoId,
      title,
      channel,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
      externalUrl: watchUrl(profile, videoId),
    }, `YouTube search result[${index}]`));
  }
  return Object.freeze(videos);
}

export function createNodeYouTubeMusicSearchClient(input: {
  readonly profile: YouTubeMusicProfile;
  readonly store: YouTubeMusicConnectionStore;
  readonly fetchImpl?: FetchLike;
}): Readonly<{
  searchVideos(query: string, limit: number): Promise<readonly YouTubeVideoProjection[]>;
}> {
  const fetchImpl = input.fetchImpl ?? (fetch as unknown as FetchLike);
  return Object.freeze({
    async searchVideos(query, limit) {
      const apiKey = input.store.readApiKey();
      if (apiKey === null) {
        throw new Error("YouTube Data API 연결이 필요합니다.");
      }
      const request = async (duration?: "medium" | "long") => {
        const response = await fetchImpl(searchUrl(
          input.profile,
          query,
          apiKey,
          limit,
          duration,
        ), {
          signal: AbortSignal.timeout(input.profile.requestTimeoutMs),
        });
        if (!response.ok) {
          throw new Error(
            friendlyYouTubeError(response.status, await response.text()),
          );
        }
        return projectSearchItems(
          input.profile,
          parseSearchItems(await response.json()),
        );
      };
      const preferred = await request(preferredDuration(query));
      if (preferred.length > 0) return preferred;
      return request();
    },
  });
}
