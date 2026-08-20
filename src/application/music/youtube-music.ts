export type YouTubeMusicProfile = {
  readonly schemaVersion: 1;
  readonly providerId: string;
  readonly displayName: string;
  readonly searchApiBaseUrl: string;
  readonly iframeApiUrl: string;
  readonly watchBaseUrl: string;
  readonly playerReferer: string;
  readonly searchLimit: number;
  readonly videosPerOption: number;
  readonly requestTimeoutMs: number;
};

export type YouTubeVideoProjection = {
  readonly providerId: string;
  readonly videoId: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string | null;
  readonly externalUrl: string;
};

export type SearchYouTubeVideosCommand = Readonly<{
  schemaVersion: 1;
  query: string;
}>;

export type YouTubeVideoSearchResult = Readonly<{
  schemaVersion: 1;
  query: string;
  videos: readonly YouTubeVideoProjection[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function integer(
  value: unknown,
  label: string,
  minimum: number,
  maximum?: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    (maximum !== undefined && value > maximum)
  ) {
    throw new Error(
      `${label} must be an integer between ${minimum} and ${maximum ?? "the safe integer limit"}`,
    );
  }
  return value;
}

function secureUrl(value: unknown, label: string): string {
  const url = new URL(nonEmpty(value, label));
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  return url.toString().replace(/\/$/u, "");
}

function secureOrLoopbackUrl(value: unknown, label: string): string {
  const url = new URL(nonEmpty(value, label));
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error(`${label} must use HTTPS or loopback HTTP`);
  }
  return url.toString().replace(/\/$/u, "");
}

function optionalSecureUrl(value: unknown, label: string): string | null {
  if (value === null) return null;
  return secureUrl(value, label);
}

export function parseYouTubeMusicProfile(value: unknown): YouTubeMusicProfile {
  const label = "YouTubeMusicProfile";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "providerId",
    "displayName",
    "searchApiBaseUrl",
    "iframeApiUrl",
    "watchBaseUrl",
    "playerReferer",
    "searchLimit",
    "videosPerOption",
    "requestTimeoutMs",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  const searchLimit = integer(input.searchLimit, `${label}.searchLimit`, 1, 50);
  const videosPerOption = integer(
    input.videosPerOption,
    `${label}.videosPerOption`,
    1,
    searchLimit,
  );
  return Object.freeze({
    schemaVersion: 1,
    providerId: nonEmpty(input.providerId, `${label}.providerId`),
    displayName: nonEmpty(input.displayName, `${label}.displayName`),
    searchApiBaseUrl: secureOrLoopbackUrl(
      input.searchApiBaseUrl,
      `${label}.searchApiBaseUrl`,
    ),
    iframeApiUrl: secureUrl(input.iframeApiUrl, `${label}.iframeApiUrl`),
    watchBaseUrl: secureUrl(input.watchBaseUrl, `${label}.watchBaseUrl`),
    playerReferer: secureUrl(input.playerReferer, `${label}.playerReferer`),
    searchLimit,
    videosPerOption,
    requestTimeoutMs: integer(
      input.requestTimeoutMs,
      `${label}.requestTimeoutMs`,
      1,
    ),
  });
}

export function parseYouTubeVideoProjection(
  value: unknown,
  label = "YouTubeVideoProjection",
): YouTubeVideoProjection {
  const input = record(value, label);
  exact(input, [
    "providerId",
    "videoId",
    "title",
    "channel",
    "thumbnailUrl",
    "externalUrl",
  ], label);
  return Object.freeze({
    providerId: nonEmpty(input.providerId, `${label}.providerId`),
    videoId: nonEmpty(input.videoId, `${label}.videoId`),
    title: nonEmpty(input.title, `${label}.title`),
    channel: nonEmpty(input.channel, `${label}.channel`),
    thumbnailUrl: optionalSecureUrl(
      input.thumbnailUrl,
      `${label}.thumbnailUrl`,
    ),
    externalUrl: secureUrl(input.externalUrl, `${label}.externalUrl`),
  });
}

export function parseSearchYouTubeVideosCommand(
  value: unknown,
): SearchYouTubeVideosCommand {
  const input = record(value, "SearchYouTubeVideosCommand");
  exact(input, ["schemaVersion", "query"], "SearchYouTubeVideosCommand");
  if (input.schemaVersion !== 1) {
    throw new Error("SearchYouTubeVideosCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    query: nonEmpty(input.query, "SearchYouTubeVideosCommand.query"),
  });
}

export function parseYouTubeVideoSearchResult(
  value: unknown,
): YouTubeVideoSearchResult {
  const input = record(value, "YouTubeVideoSearchResult");
  exact(
    input,
    ["schemaVersion", "query", "videos"],
    "YouTubeVideoSearchResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("YouTubeVideoSearchResult.schemaVersion must be 1");
  }
  if (!Array.isArray(input.videos)) {
    throw new Error("YouTubeVideoSearchResult.videos must be an array");
  }
  return Object.freeze({
    schemaVersion: 1,
    query: nonEmpty(input.query, "YouTubeVideoSearchResult.query"),
    videos: Object.freeze(input.videos.map((video, index) =>
      parseYouTubeVideoProjection(
        video,
        `YouTubeVideoSearchResult.videos[${index}]`,
      )
    )),
  });
}
