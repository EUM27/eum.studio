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
  useEffectEvent,
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

import type { SharedMusicBridge, SharedMusicCommand, SharedMusicState } from "../../application/music/shared-music-playback";
import { useSharedMusicConnection, type SharedMusicHandlers } from "./useSharedMusicConnection";
import { loadYouTubePlayback, type YouTubePlaybackPort } from "./youtube-playback";

type YouTubePlayer = YouTubePlaybackPort & {
  readonly destroy: () => void;
  readonly getCurrentTime?: () => number;
  readonly getDuration?: () => number;
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
  readonly shared?: SharedMusicBridge | undefined;
  readonly connection: YouTubeMusicConnectionStatus | null;
  readonly focusText: string | null;
  readonly onOpenLibrary: () => void;
  readonly onPlayPlaylist: (startIndex: number) => void;
  readonly playlist: readonly MusicTrackProjection[];
  readonly playRequest: MusicPlaybackRequest | null;
  readonly profile: YouTubeMusicProfile | null;
}) {
  const sharedHandlers = useRef<SharedMusicHandlers>({ command: () => {}, restore: () => {}, silence: () => {}, error: () => {} });
  const { snapshot: sharedSnapshot, isOwner, ownerRef, command: sendSharedCommand, publish: publishSharedState } = useSharedMusicConnection(input.shared, sharedHandlers);
  const playbackGenerationRef = useRef(0);
  const resumePlaybackRef = useRef<{ currentTime: number; paused: boolean } | null>(null);
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
  const [engineQueue, setQueue] = useState<readonly MusicTrackProjection[]>([]);
  const [engineCurrentIndex, setCurrentIndex] = useState(0);
  const [engineLoading, setLoading] = useState(false);
  const [engineError, setError] = useState<string | null>(null);
  const [enginePaused, setPaused] = useState(true);
  const [engineShowVideo, setShowVideo] = useState(false);
  const [engineVolume, setVolume] = useState(70);
  const [engineCurrentTime, setCurrentTime] = useState(0);
  const [engineDuration, setDuration] = useState(0);
  const [engineRepeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [engineShuffle, setShuffle] = useState(false);
  const [localPlaybackSource, setLocalPlaybackSource] = useState<Readonly<{
    nonce: number;
    url: string;
  }> | null>(null);

  const mirrored = input.shared !== undefined && !isOwner ? sharedSnapshot?.state : null;
  const queue = mirrored?.queue ?? engineQueue;
  const currentIndex = mirrored?.currentIndex ?? engineCurrentIndex;
  const loading = mirrored?.loading ?? engineLoading;
  const error = mirrored?.error ?? engineError;
  const paused = mirrored?.paused ?? enginePaused;
  const volume = mirrored?.volume ?? engineVolume;
  const currentTime = mirrored?.currentTime ?? engineCurrentTime;
  const duration = mirrored?.duration ?? engineDuration;
  const repeatMode = mirrored?.repeatMode ?? engineRepeatMode;
  const shuffle = mirrored?.shuffle ?? engineShuffle;
  const showVideo = mirrored ? false : engineShowVideo;

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
            if (!ownerRef.current) { player.destroy(); return; }
            player.setVolume(volumeRef.current);
            playerRef.current = player;
            resolve(player);
          },
          onStateChange: (event) => {
            if (!ownerRef.current) return;
            const resume = resumePlaybackRef.current;
            if (resume !== null && event.data === 5) {
              resumePlaybackRef.current = null;
              setCurrentTime(resume.currentTime);
              setDuration(player.getDuration?.() ?? 0);
              setPaused(true);
              return;
            }
            if (resume !== null && (event.data === 1 || event.data === 2)) {
              resumePlaybackRef.current = null;
              player.seekTo?.(resume.currentTime, true);
              setCurrentTime(resume.currentTime);
              if (resume.paused) { player.pauseVideo(); setPaused(true); return; }
            }
            if (event.data === 1) setPaused(false);
            if (event.data === 2) setPaused(true);
            if (event.data === 0) onEndedRef.current();
          },
        }),
      });
    });
  }, [input.profile, ownerRef]);

  const loadQueueIndex = useCallback(async (nextIndex: number, resume?: { currentTime: number; paused: boolean }): Promise<void> => {
    if (!ownerRef.current) return;
    const generation = ++playbackGenerationRef.current;
    resumePlaybackRef.current = resume ?? null;
    const tracks = queueRef.current;
    if (nextIndex < 0 || nextIndex >= tracks.length) return;
    const track = tracks[nextIndex]!;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setCurrentTime(resume?.currentTime ?? 0);
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
        if (!ownerRef.current || generation !== playbackGenerationRef.current) return;
        loadYouTubePlayback(player, track.videoId, resume);
        player.setVolume(volumeRef.current);
        setPaused(resume?.paused ?? false);
      }
      if (isLocalMediaTrack(track) && track.mediaKind !== "video") {
        setShowVideo(false);
      }
    } catch (reason) {
      if (!ownerRef.current || generation !== playbackGenerationRef.current) return;
      setPaused(true);
      setError(
        reason instanceof Error ? reason.message : "미디어 재생에 실패했습니다.",
      );
    } finally {
      if (ownerRef.current && generation === playbackGenerationRef.current) setLoading(false);
    }
  }, [ensurePlayer, ownerRef]);

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

  const startQueue = useCallback((tracks: readonly MusicTrackProjection[], startIndex = 0) => {
    queueRef.current = tracks;
    playbackOrderRef.current = createPlaybackOrder(tracks.length, startIndex, shuffleRef.current);
    currentIndexRef.current = startIndex;
    setQueue(tracks);
    setCurrentIndex(startIndex);
    void loadQueueIndex(startIndex);
  }, [loadQueueIndex]);

  const handlePlaybackRequest = useEffectEvent((request: MusicPlaybackRequest | null) => {
    if (request === null || request.tracks.length === 0 || request.nonce === lastNonceRef.current) return;
    lastNonceRef.current = request.nonce;
    const startIndex = Math.min(Math.max(Math.trunc(request.startIndex ?? 0), 0), request.tracks.length - 1);
    if (input.shared !== undefined) {
      void sendSharedCommand({ type: "play-queue", tracks: request.tracks, startIndex }).catch((reason: unknown) => setError(String(reason)));
    } else startQueue(request.tracks, startIndex);
  });
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) handlePlaybackRequest(input.playRequest); });
    return () => { cancelled = true; };
  }, [input.playRequest]);

  useEffect(() => {
    volumeRef.current = volume;
    if (volume > 0) previousAudibleVolumeRef.current = volume;
    playerRef.current?.setVolume(volume);
    if (localMediaRef.current !== null) {
      localMediaRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (!isOwner || paused || currentTrack === null || isLocalMediaTrack(currentTrack)) {
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
  }, [currentTrack, paused, isOwner]);

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
    playbackGenerationRef.current += 1;
    resumePlaybackRef.current = null;
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

  const sendControl = (command: SharedMusicCommand) => {
    void sendSharedCommand(command).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "음악을 조작하지 못했습니다."));
  };
  const silenceSharedPlayer = useEffectEvent(() => {
    playbackGenerationRef.current += 1;
    pendingLocalAutoplayNonceRef.current = null;
    localMediaRef.current?.pause();
    try { playerRef.current?.stopVideo(); } catch { /* renderer teardown */ }
  });
  const restoreSharedPlayer = useEffectEvent((state: SharedMusicState) => {
    volumeRef.current = state.volume;
    previousAudibleVolumeRef.current = state.previousAudibleVolume;
    shuffleRef.current = state.shuffle;
    queueRef.current = state.queue;
    playbackOrderRef.current = state.order;
    setQueue(state.queue);
    setCurrentIndex(state.currentIndex);
    setVolume(state.volume);
    setRepeatMode(state.repeatMode);
    setShuffle(state.shuffle);
    setShowVideo(state.showVideo);
    setPaused(state.paused);
    if (state.queue.length > 0) void loadQueueIndex(state.currentIndex, { currentTime: state.currentTime, paused: state.paused });
  });
  const applySharedCommand = useEffectEvent((command: SharedMusicCommand) => {
    switch (command.type) {
      case "play-queue": startQueue(command.tracks, command.startIndex); break;
      case "toggle": togglePlayback(); break;
      case "next": nextTrack(); break;
      case "previous": previousTrack(); break;
      case "stop": stopPlayback(); break;
      case "seek": seek(command.value); break;
      case "volume": setVolume(command.value); break;
      case "shuffle": toggleShuffle(); break;
      case "repeat": cycleRepeatMode(); break;
      case "mute": toggleMute(); break;
      case "video": setShowVideo(command.visible); break;
    }
  });
  useEffect(() => {
    Object.assign(sharedHandlers.current, {
      error: setError,
      command: (command: SharedMusicCommand) => applySharedCommand(command),
      restore: (state: SharedMusicState) => restoreSharedPlayer(state),
      silence: () => silenceSharedPlayer(),
    });
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    publishSharedState({ queue: engineQueue, currentIndex: engineCurrentIndex, paused: enginePaused,
      loading: engineLoading, error: engineError, volume: engineVolume, previousAudibleVolume: previousAudibleVolumeRef.current,
      currentTime: Number.isFinite(engineCurrentTime) ? engineCurrentTime : 0,
      duration: Number.isFinite(engineDuration) ? engineDuration : 0,
      repeatMode: engineRepeatMode, shuffle: engineShuffle, showVideo: engineShowVideo, order: playbackOrderRef.current });
  }, [engineQueue, engineCurrentIndex, enginePaused, engineLoading, engineError, engineVolume, engineCurrentTime, engineDuration, engineRepeatMode, engineShuffle, engineShowVideo, isOwner, publishSharedState]);

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
      data-playback-owner={isOwner ? "true" : "false"}
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
          onChange={(event) => sendControl({ type: "seek", value: Number(event.currentTarget.value) })}
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
          onClick={() => sendControl({ type: "shuffle" })}
          title={shuffle ? "랜덤 전체 반복 켜짐" : "랜덤 전체 반복"}
          type="button"
        >
          <Shuffle aria-hidden="true" size={13} />
        </button>
        <button
          aria-label="이전 곡"
          disabled={currentTrack === null || loading}
          onClick={() => sendControl({ type: "previous" })}
          type="button"
        >
          <SkipBack aria-hidden="true" size={14} />
        </button>
        <button
          aria-label={paused ? "음악 재생" : "음악 일시정지"}
          className="music-mini-primary-control"
          disabled={(!hasPlaylist && currentTrack === null) || loading}
          onClick={() => { if (currentTrack === null && hasPlaylist) input.onPlayPlaylist(0); else sendControl({ type: "toggle" }); }}
          type="button"
        >
          {paused
            ? <Play aria-hidden="true" size={15} />
            : <Pause aria-hidden="true" size={15} />}
        </button>
        <button
          aria-label="다음 곡"
          disabled={currentTrack === null || loading}
          onClick={() => sendControl({ type: "next" })}
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
          onClick={() => sendControl({ type: "repeat" })}
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
          onClick={() => sendControl({ type: "mute" })}
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
          onChange={(event) => sendControl({ type: "volume", value: Number(event.currentTarget.value) })}
          step="1"
          type="range"
          value={volume}
        />
      </div>
      <div className="music-mini-entry-actions">
        <button
          aria-label={showVideo ? "동영상 숨기기" : "동영상 표시"}
          disabled={!videoAvailable}
          onClick={() => sendControl({ type: "video", visible: !showVideo })}
          type="button"
        >
          {showVideo
            ? <ChevronDown aria-hidden="true" size={13} />
            : <ChevronUp aria-hidden="true" size={13} />}
        </button>
        <button
          aria-label="음악 정지"
          disabled={currentTrack === null}
          onClick={() => sendControl({ type: "stop" })}
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
              !ownerRef.current || localPlaybackSource === null ||
              pendingLocalAutoplayNonceRef.current !==
                localPlaybackSource.nonce ||
              !event.currentTarget.paused
            ) {
              return;
            }
            pendingLocalAutoplayNonceRef.current = null;
            event.currentTarget.volume = volumeRef.current / 100;
            const resume = resumePlaybackRef.current;
            resumePlaybackRef.current = null;
            if (resume !== null) {
              event.currentTarget.currentTime = resume.currentTime;
              setCurrentTime(resume.currentTime);
              if (resume.paused) { setPaused(true); setLoading(false); return; }
            }
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
