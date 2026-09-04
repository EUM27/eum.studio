import {
  ChevronDown,
  ChevronUp,
  Film,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  isLocalMediaTrack,
  localMediaPlaybackUrl,
  type MusicTrackProjection,
} from "../../application/music/media-track";
import type { YouTubeMusicProfile } from "../../application/music/youtube-music";
import type {
  YouTubeMusicConnectionStatus,
} from "../../application/music/youtube-music-connection";
import {
  createPlaybackOrder,
  endedPlaybackStep,
  nextPlaybackStep,
  previousPlaybackStep,
  withPlaybackShuffle,
  type PlaybackOrder,
  type RepeatMode,
} from "./playback-order";

type YouTubePlayer = {
  readonly destroy: () => void;
  readonly getCurrentTime?: () => number;
  readonly getDuration?: () => number;
  readonly loadVideoById: (videoId: string) => void;
  readonly pauseVideo: () => void;
  readonly playVideo: () => void;
  readonly seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
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

export type MusicPlaybackRequest = {
  readonly nonce: number;
  readonly startIndex?: number;
  readonly tracks: readonly MusicTrackProjection[];
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

function formattedTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function trackSubtitle(track: MusicTrackProjection | null): string | null {
  if (track === null) return null;
  if (!isLocalMediaTrack(track)) return track.channel;
  const format = track.mediaKind === "audio" ? "MP3" : "MP4";
  const location = track.storageMode === "external-reference"
    ? "원본 위치 연결"
    : "앱에 가져옴";
  return `${format} · ${location}`;
}

export function MusicMiniPlayer(input: {
  readonly connection: YouTubeMusicConnectionStatus | null;
  readonly focusText: string | null;
  readonly onOpenLibrary: () => void;
  readonly onPlayPlaylist: (startIndex: number) => void;
  readonly playlist: readonly MusicTrackProjection[];
  readonly playRequest: MusicPlaybackRequest | null;
  readonly profile: YouTubeMusicProfile | null;
}) {
  const youtubeHostRef = useRef<HTMLDivElement>(null);
  const localMediaRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const queueRef = useRef<readonly MusicTrackProjection[]>([]);
  const currentIndexRef = useRef(0);
  const volumeRef = useRef(70);
  const previousAudibleVolumeRef = useRef(70);
  const onEndedRef = useRef<() => void>(() => undefined);
  const playbackOrderRef = useRef<PlaybackOrder>(
    createPlaybackOrder(0, 0, false),
  );
  const shuffleRef = useRef(false);
  const lastNonceRef = useRef(0);
  const localPlaybackNonceRef = useRef(0);
  const pendingLocalAutoplayNonceRef = useRef<number | null>(null);
  const [queue, setQueue] = useState<readonly MusicTrackProjection[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [volume, setVolume] = useState(70);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [localPlaybackSource, setLocalPlaybackSource] = useState<Readonly<{
    nonce: number;
    url: string;
  }> | null>(null);

  const currentTrack = queue[currentIndex] ?? null;
  const currentIsLocal = currentTrack !== null && isLocalMediaTrack(currentTrack);
  const videoAvailable = currentTrack !== null && (
    !isLocalMediaTrack(currentTrack) || currentTrack.mediaKind === "video"
  );
  const hasPlaylist = input.playlist.length > 0;

  const ensurePlayer = useCallback(async (): Promise<YouTubePlayer> => {
    if (playerRef.current !== null) return playerRef.current;
    if (input.profile === null) {
      throw new Error("YouTube 재생 설정을 불러오지 못했습니다.");
    }
    await loadYouTubeApi(input.profile.iframeApiUrl);
    const Player = (window as YouTubeWindow).YT?.Player;
    if (Player === undefined || youtubeHostRef.current === null) {
      throw new Error("YouTube 플레이어를 시작하지 못했습니다.");
    }
    const playerHost = document.createElement("div");
    youtubeHostRef.current.appendChild(playerHost);
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

  const loadQueueIndex = useCallback(async (nextIndex: number): Promise<void> => {
    const tracks = queueRef.current;
    if (nextIndex < 0 || nextIndex >= tracks.length) return;
    const track = tracks[nextIndex]!;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    setError(null);
    try {
      if (isLocalMediaTrack(track)) {
        try {
          playerRef.current?.stopVideo();
        } catch {
          // The remote player can disappear while switching sources.
        }
        localMediaRef.current?.pause();
        localPlaybackNonceRef.current += 1;
        pendingLocalAutoplayNonceRef.current = localPlaybackNonceRef.current;
        setLocalPlaybackSource(Object.freeze({
          nonce: localPlaybackNonceRef.current,
          url: localMediaPlaybackUrl(track),
        }));
      } else {
        pendingLocalAutoplayNonceRef.current = null;
        const media = localMediaRef.current;
        if (media !== null) {
          media.pause();
        }
        setLocalPlaybackSource(null);
        const player = await ensurePlayer();
        player.loadVideoById(track.videoId);
        player.setVolume(volumeRef.current);
        setPaused(false);
      }
      if (isLocalMediaTrack(track) && track.mediaKind !== "video") {
        setShowVideo(false);
      }
    } catch (reason) {
      setPaused(true);
      setError(
        reason instanceof Error ? reason.message : "미디어 재생에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [ensurePlayer]);

  const nextTrack = useCallback(() => {
    const step = nextPlaybackStep(
      playbackOrderRef.current,
      repeatMode === "one" ? "all" : repeatMode,
    );
    if (step === null) return;
    playbackOrderRef.current = step.state;
    void loadQueueIndex(step.index);
  }, [loadQueueIndex, repeatMode]);

  useEffect(() => {
    onEndedRef.current = () => {
      const step = endedPlaybackStep(
        playbackOrderRef.current,
        repeatMode,
      );
      if (step === null) {
        setPaused(true);
        setCurrentTime(duration);
        return;
      }
      playbackOrderRef.current = step.state;
      void loadQueueIndex(step.index);
    };
  }, [duration, loadQueueIndex, repeatMode]);

  useEffect(() => {
    const request = input.playRequest;
    if (
      request === null ||
      request.tracks.length === 0 ||
      request.nonce === lastNonceRef.current
    ) {
      return;
    }
    lastNonceRef.current = request.nonce;
    queueRef.current = request.tracks;
    const startIndex = Math.min(
      Math.max(Math.trunc(request.startIndex ?? 0), 0),
      request.tracks.length - 1,
    );
    playbackOrderRef.current = createPlaybackOrder(
      request.tracks.length,
      startIndex,
      shuffleRef.current,
    );
    currentIndexRef.current = startIndex;
    setQueue(request.tracks);
    setCurrentIndex(startIndex);
    void loadQueueIndex(startIndex);
  }, [input.playRequest, loadQueueIndex]);

  useEffect(() => {
    volumeRef.current = volume;
    if (volume > 0) previousAudibleVolumeRef.current = volume;
    playerRef.current?.setVolume(volume);
    if (localMediaRef.current !== null) {
      localMediaRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (paused || currentTrack === null || isLocalMediaTrack(currentTrack)) {
      return;
    }
    const update = () => {
      const player = playerRef.current;
      const nextTime = player?.getCurrentTime?.() ?? 0;
      const nextDuration = player?.getDuration?.() ?? 0;
      if (Number.isFinite(nextTime)) setCurrentTime(nextTime);
      if (Number.isFinite(nextDuration)) setDuration(nextDuration);
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [currentTrack, paused]);

  useEffect(() => () => {
    try {
      playerRef.current?.destroy();
    } catch {
      // The remote player can already be gone during window teardown.
    }
    localMediaRef.current?.pause();
    playerRef.current = null;
  }, []);

  const togglePlayback = () => {
    if (currentTrack === null) {
      if (hasPlaylist) input.onPlayPlaylist(0);
      return;
    }
    if (isLocalMediaTrack(currentTrack)) {
      const media = localMediaRef.current;
      if (media === null) return;
      if (paused) void media.play();
      else media.pause();
      return;
    }
    if (playerRef.current === null) return;
    if (paused) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  };

  const previousTrack = () => {
    if (currentTrack === null) return;
    if (currentTime > 5) {
      if (isLocalMediaTrack(currentTrack) && localMediaRef.current !== null) {
        localMediaRef.current.currentTime = 0;
      } else {
        playerRef.current?.seekTo?.(0, true);
      }
      setCurrentTime(0);
      return;
    }
    const step = previousPlaybackStep(
      playbackOrderRef.current,
      repeatMode === "one" ? "all" : repeatMode,
    );
    if (step === null) {
      seek(0);
      return;
    }
    playbackOrderRef.current = step.state;
    void loadQueueIndex(step.index);
  };

  const stopPlayback = () => {
    try {
      playerRef.current?.stopVideo();
    } catch {
      // The remote player can disappear while the app is closing.
    }
    const media = localMediaRef.current;
    if (media !== null) {
      media.pause();
    }
    pendingLocalAutoplayNonceRef.current = null;
    setLocalPlaybackSource(null);
    queueRef.current = [];
    playbackOrderRef.current = createPlaybackOrder(0, 0, shuffleRef.current);
    setQueue([]);
    setCurrentIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setPaused(true);
    setError(null);
    setShowVideo(false);
  };

  const seek = (value: number) => {
    if (currentTrack === null || !Number.isFinite(value)) return;
    if (isLocalMediaTrack(currentTrack) && localMediaRef.current !== null) {
      localMediaRef.current.currentTime = value;
    } else {
      playerRef.current?.seekTo?.(value, true);
    }
    setCurrentTime(value);
  };

  const cycleRepeatMode = () => {
    if (shuffleRef.current) {
      shuffleRef.current = false;
      setShuffle(false);
      playbackOrderRef.current = withPlaybackShuffle(
        playbackOrderRef.current,
        false,
      );
      setRepeatMode("one");
      return;
    }
    setRepeatMode((current) =>
      current === "off" ? "all" : current === "all" ? "one" : "off"
    );
  };

  const toggleShuffle = () => {
    setShuffle((current) => {
      const next = !current;
      shuffleRef.current = next;
      playbackOrderRef.current = withPlaybackShuffle(
        playbackOrderRef.current,
        next,
      );
      if (next) setRepeatMode("all");
      return next;
    });
  };

  const toggleMute = () => {
    setVolume((current) =>
      current === 0 ? previousAudibleVolumeRef.current : 0
    );
  };

  const title = loading
    ? "미디어 준비 중"
    : currentTrack?.title ?? "재생할 곡을 선택하세요";
  const subtitle = error ?? trackSubtitle(currentTrack) ?? (
    input.connection?.apiKeyConfigured
      ? "YouTube 또는 내 미디어에서 선택하세요."
      : "로컬 파일은 연결 없이 재생할 수 있습니다."
  );

  return (
    <section
      aria-label="음악 플레이어"
      className={
        currentTrack === null
          ? "music-mini-player is-idle"
          : `music-mini-player is-playing${currentIsLocal ? " is-local" : " is-youtube"}`
      }
    >
      <div className="music-mini-track">
        {currentTrack !== null && !isLocalMediaTrack(currentTrack) &&
            currentTrack.thumbnailUrl !== null
          ? <img alt="" src={currentTrack.thumbnailUrl} />
          : (
            <span aria-hidden="true">
              {currentTrack !== null && isLocalMediaTrack(currentTrack) &&
                  currentTrack.mediaKind === "video"
                ? <Film size={15} />
                : <Music2 size={15} />}
            </span>
          )}
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </div>

      <label className="music-mini-progress">
        <span className="visually-hidden">재생 위치</span>
        <input
          aria-label="재생 위치"
          disabled={currentTrack === null || duration <= 0 || loading}
          max={Math.max(duration, 0)}
          min="0"
          onChange={(event) => seek(Number(event.currentTarget.value))}
          step="0.1"
          type="range"
          value={Math.min(currentTime, Math.max(duration, 0))}
        />
        <output>{formattedTime(currentTime)} / {formattedTime(duration)}</output>
      </label>

      <div className="music-mini-controls">
        <button
          aria-label={
            shuffle ? "랜덤 전체 반복 끄기" : "랜덤 전체 반복 켜기"
          }
          aria-pressed={shuffle}
          className={shuffle ? "is-active" : undefined}
          onClick={toggleShuffle}
          title={shuffle ? "랜덤 전체 반복 켜짐" : "랜덤 전체 반복"}
          type="button"
        >
          <Shuffle aria-hidden="true" size={13} />
        </button>
        <button
          aria-label="이전 곡"
          disabled={currentTrack === null || loading}
          onClick={previousTrack}
          type="button"
        >
          <SkipBack aria-hidden="true" size={14} />
        </button>
        <button
          aria-label={paused ? "음악 재생" : "음악 일시정지"}
          className="music-mini-primary-control"
          disabled={(!hasPlaylist && currentTrack === null) || loading}
          onClick={togglePlayback}
          type="button"
        >
          {paused
            ? <Play aria-hidden="true" size={15} />
            : <Pause aria-hidden="true" size={15} />}
        </button>
        <button
          aria-label="다음 곡"
          disabled={currentTrack === null || loading}
          onClick={nextTrack}
          type="button"
        >
          <SkipForward aria-hidden="true" size={14} />
        </button>
        <button
          aria-label={
            repeatMode === "all"
              ? "전체 반복"
              : repeatMode === "one" ? "한 곡 반복" : "반복 끔"
          }
          aria-pressed={repeatMode !== "off"}
          className={repeatMode === "off" ? undefined : "is-active"}
          disabled={currentTrack === null && !hasPlaylist}
          onClick={cycleRepeatMode}
          title={
            repeatMode === "all"
              ? "전체 반복 켜짐"
              : repeatMode === "one" ? "한 곡 반복 켜짐" : "반복 끔"
          }
          type="button"
        >
          {repeatMode === "one"
            ? <Repeat1 aria-hidden="true" size={13} />
            : <Repeat aria-hidden="true" size={13} />}
        </button>
      </div>

      <span className="music-mini-time">
        {currentTrack === null ? "— / —" : `${currentIndex + 1} / ${queue.length}`}
      </span>
      {currentTrack !== null && input.focusText !== null && (
        <span className="music-mini-focus">{input.focusText}</span>
      )}
      <div className="music-mini-volume">
        <button
          aria-label={volume === 0 ? "음소거 해제" : "음소거"}
          aria-pressed={volume === 0}
          onClick={toggleMute}
          title={volume === 0 ? "음소거 해제" : "음소거"}
          type="button"
        >
          {volume === 0
            ? <VolumeX aria-hidden="true" size={13} />
            : <Volume2 aria-hidden="true" size={13} />}
        </button>
        <input
          aria-label="음량"
          max="100"
          min="0"
          onChange={(event) => setVolume(Number(event.currentTarget.value))}
          step="1"
          type="range"
          value={volume}
        />
      </div>
      <div className="music-mini-entry-actions">
        <button
          aria-label={showVideo ? "동영상 숨기기" : "동영상 표시"}
          disabled={!videoAvailable}
          onClick={() => setShowVideo((current) => !current)}
          type="button"
        >
          {showVideo
            ? <ChevronDown aria-hidden="true" size={13} />
            : <ChevronUp aria-hidden="true" size={13} />}
        </button>
        <button
          aria-label="음악 정지"
          disabled={currentTrack === null}
          onClick={stopPlayback}
          type="button"
        >
          <Square aria-hidden="true" size={11} />
        </button>
        <button
          aria-label="선곡·재생목록 열기"
          onClick={input.onOpenLibrary}
          title="재생목록"
          type="button"
        >
          <ListMusic aria-hidden="true" size={14} />
        </button>
      </div>
      <div
        aria-hidden={!showVideo}
        className={`music-mini-video-panel${showVideo ? " is-open" : ""}`}
      >
        <div className="music-mini-video-host" ref={youtubeHostRef} />
        <video
          className="music-mini-local-media"
          key={localPlaybackSource?.nonce ?? 0}
          ref={localMediaRef}
          onCanPlay={(event) => {
            if (
              localPlaybackSource === null ||
              pendingLocalAutoplayNonceRef.current !==
                localPlaybackSource.nonce ||
              !event.currentTarget.paused
            ) {
              return;
            }
            pendingLocalAutoplayNonceRef.current = null;
            event.currentTarget.volume = volumeRef.current / 100;
            void event.currentTarget.play().then(
              () => {
                setPaused(false);
                setLoading(false);
              },
              (reason: unknown) => {
                setPaused(true);
                setLoading(false);
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "등록한 미디어 파일을 재생할 수 없습니다.",
                );
              },
            );
          }}
          onEnded={() => onEndedRef.current()}
          onError={() => {
            if (currentIsLocal) {
              setError("등록한 미디어 파일을 재생할 수 없습니다.");
              setPaused(true);
            }
          }}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPause={() => {
            if (currentIsLocal) setPaused(true);
          }}
          onPlay={() => {
            if (currentIsLocal) setPaused(false);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          playsInline
          preload="metadata"
          src={localPlaybackSource?.url}
        />
      </div>
    </section>
  );
}
