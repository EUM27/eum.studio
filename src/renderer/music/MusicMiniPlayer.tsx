import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  YouTubeMusicProfile,
  YouTubeVideoProjection,
} from "../../application/music/youtube-music";
import type {
  YouTubeMusicConnectionStatus,
} from "../../application/music/youtube-music-connection";

type YouTubePlayer = {
  readonly destroy: () => void;
  readonly loadVideoById: (videoId: string) => void;
  readonly pauseVideo: () => void;
  readonly playVideo: () => void;
  readonly setVolume: (volume: number) => void;
  readonly stopVideo: () => void;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: Readonly<{
    width: string;
    height: string;
    playerVars: Readonly<{
      autoplay: number;
      modestbranding: number;
      playsinline: number;
      rel: number;
    }>;
    events: Readonly<{
      onReady: () => void;
      onStateChange: (event: Readonly<{ data: number }>) => void;
    }>;
  }>,
) => YouTubePlayer;

type YouTubeWindow = Window & {
  YT?: Readonly<{ Player?: YouTubePlayerConstructor }>;
  onYouTubeIframeAPIReady?: () => void;
};

export type YouTubePlaybackRequest = {
  readonly nonce: number;
  readonly videos: readonly YouTubeVideoProjection[];
};

let youtubeApiPromise: Promise<void> | null = null;
let youtubeApiUrl: string | null = null;

function loadYouTubeApi(url: string): Promise<void> {
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player !== undefined) return Promise.resolve();
  if (youtubeApiPromise !== null && youtubeApiUrl === url) {
    return youtubeApiPromise;
  }
  youtubeApiUrl = url;
  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = url;
    script.addEventListener("error", () => {
      youtubeApiPromise = null;
      reject(new Error("YouTube 플레이어를 불러오지 못했습니다."));
    }, { once: true });
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

export function MusicMiniPlayer(input: {
  readonly connection: YouTubeMusicConnectionStatus | null;
  readonly focusText: string | null;
  readonly onOpenLibrary: () => void;
  readonly playRequest: YouTubePlaybackRequest | null;
  readonly profile: YouTubeMusicProfile | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const queueRef = useRef<readonly YouTubeVideoProjection[]>([]);
  const currentIndexRef = useRef(0);
  const volumeRef = useRef(70);
  const onEndedRef = useRef<() => void>(() => undefined);
  const lastNonceRef = useRef(0);
  const [queue, setQueue] = useState<readonly YouTubeVideoProjection[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [volume, setVolume] = useState(70);

  const currentVideo = queue[currentIndex] ?? null;

  const ensurePlayer = useCallback(async (): Promise<YouTubePlayer> => {
    if (playerRef.current !== null) return playerRef.current;
    if (input.profile === null) {
      throw new Error("YouTube 재생 설정을 불러오지 못했습니다.");
    }
    await loadYouTubeApi(input.profile.iframeApiUrl);
    const Player = (window as YouTubeWindow).YT?.Player;
    if (Player === undefined || hostRef.current === null) {
      throw new Error("YouTube 플레이어를 시작하지 못했습니다.");
    }
    const playerHost = document.createElement("div");
    hostRef.current.appendChild(playerHost);
    return new Promise<YouTubePlayer>((resolve) => {
      const player = new Player(playerHost, {
        width: "356",
        height: "200",
        playerVars: Object.freeze({
          autoplay: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        }),
        events: Object.freeze({
          onReady: () => {
            player.setVolume(volumeRef.current);
            playerRef.current = player;
            resolve(player);
          },
          onStateChange: (event) => {
            if (event.data === 1) setPaused(false);
            if (event.data === 2) setPaused(true);
            if (event.data === 0) onEndedRef.current();
          },
        }),
      });
    });
  }, [input.profile]);

  const loadQueueIndex = useCallback((nextIndex: number): void => {
    const videos = queueRef.current;
    const player = playerRef.current;
    if (player === null || videos.length === 0) return;
    const normalized = (nextIndex + videos.length) % videos.length;
    currentIndexRef.current = normalized;
    setCurrentIndex(normalized);
    player.loadVideoById(videos[normalized]!.videoId);
    player.setVolume(volumeRef.current);
    setPaused(false);
  }, []);

  useEffect(() => {
    onEndedRef.current = () => loadQueueIndex(currentIndexRef.current + 1);
  }, [loadQueueIndex]);

  useEffect(() => {
    const request = input.playRequest;
    if (
      request === null ||
      request.videos.length === 0 ||
      request.nonce === lastNonceRef.current
    ) {
      return;
    }
    lastNonceRef.current = request.nonce;
    let active = true;
    setLoading(true);
    setError(null);
    void ensurePlayer().then(
      (player) => {
        if (!active) return;
        queueRef.current = request.videos;
        currentIndexRef.current = 0;
        setQueue(request.videos);
        setCurrentIndex(0);
        player.loadVideoById(request.videos[0]!.videoId);
        player.setVolume(volumeRef.current);
        setPaused(false);
        setLoading(false);
      },
      (reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "YouTube 재생에 실패했습니다.",
        );
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [ensurePlayer, input.playRequest]);

  useEffect(() => {
    volumeRef.current = volume;
    playerRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => () => {
    try {
      playerRef.current?.destroy();
    } catch {
      // The remote player can already be gone during window teardown.
    }
    playerRef.current = null;
  }, []);

  const togglePlayback = () => {
    if (playerRef.current === null) return;
    if (paused) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  };

  const stopPlayback = () => {
    try {
      playerRef.current?.stopVideo();
    } catch {
      // The player can disappear while the app is closing.
    }
    queueRef.current = [];
    setQueue([]);
    setCurrentIndex(0);
    setPaused(true);
    setError(null);
    setShowVideo(false);
  };

  return (
    <section
      aria-label="음악 플레이어"
      className={
        currentVideo === null
          ? "music-mini-player is-idle"
          : "music-mini-player is-playing"
      }
    >
      <div className="music-mini-track">
        {currentVideo?.thumbnailUrl
          ? <img alt="" src={currentVideo.thumbnailUrl} />
          : <span aria-hidden="true">▶</span>}
        <span>
          <strong>
            {loading
              ? "YouTube 음악 찾는 중"
              : currentVideo?.title ??
                (input.connection?.apiKeyConfigured
                  ? "YouTube 재생 대기"
                  : "YouTube API 연결 필요")}
          </strong>
          <small>
            {error ?? currentVideo?.channel ?? "장면에서 음악 큐를 선택하세요."}
          </small>
        </span>
      </div>
      {currentVideo !== null && (
        <div className="music-mini-controls">
          <button
            aria-label="이전 곡"
            disabled={loading}
            onClick={() => loadQueueIndex(currentIndexRef.current - 1)}
            type="button"
          >
            <SkipBack aria-hidden="true" size={13} />
          </button>
          <button
            aria-label={paused ? "음악 재생" : "음악 일시정지"}
            disabled={loading}
            onClick={togglePlayback}
            type="button"
          >
            {paused
              ? <Play aria-hidden="true" size={14} />
              : <Pause aria-hidden="true" size={14} />}
          </button>
          <button
            aria-label="다음 곡"
            disabled={loading}
            onClick={() => loadQueueIndex(currentIndexRef.current + 1)}
            type="button"
          >
            <SkipForward aria-hidden="true" size={13} />
          </button>
          <button
            aria-label={showVideo ? "동영상 숨기기" : "동영상 표시"}
            onClick={() => setShowVideo((current) => !current)}
            type="button"
          >
            {showVideo
              ? <ChevronDown aria-hidden="true" size={13} />
              : <ChevronUp aria-hidden="true" size={13} />}
          </button>
          <button
            aria-label="음악 정지"
            onClick={stopPlayback}
            type="button"
          >
            <X aria-hidden="true" size={13} />
          </button>
        </div>
      )}
      {currentVideo !== null && (
        <span className="music-mini-time">
          {currentIndex + 1} / {queue.length}
        </span>
      )}
      {currentVideo !== null && input.focusText !== null && (
        <span className="music-mini-focus">{input.focusText}</span>
      )}
      {currentVideo !== null && (
        <label className="music-mini-volume">
          {volume === 0
            ? <VolumeX aria-hidden="true" size={12} />
            : <Volume2 aria-hidden="true" size={12} />}
          <input
            aria-label="YouTube 음량"
            max="100"
            min="0"
            onChange={(event) => setVolume(Number(event.target.value))}
            step="1"
            type="range"
            value={volume}
          />
        </label>
      )}
      <div className="music-mini-entry-actions">
        <button
          aria-label="선곡·재생목록 열기"
          onClick={input.onOpenLibrary}
          type="button"
        >
          <ListMusic aria-hidden="true" size={13} />
          <span>선곡·목록</span>
        </button>
      </div>
      <div
        aria-hidden={!showVideo}
        className={`music-mini-video-panel${showVideo ? " is-open" : ""}`}
      >
        <div className="music-mini-video-host" ref={hostRef} />
      </div>
    </section>
  );
}
