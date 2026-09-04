import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  LocalMediaAvailabilityStatus,
  LocalMediaTrackProjection,
  LocalMediaStorageMode,
  MusicTrackProjection,
} from "../../../application/music/media-track";
import { musicTrackIdentity } from "../../../application/music/media-track";
import type {
  SceneMusicQueueCandidate,
  SceneMusicQueueOption,
} from "../../../application/music/scene-music-queue-contract";
import { selectedSceneMusicQueueOption } from "../../../application/music/scene-music-queue-contract";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { WorkMusicSettingsProjection } from "../../../application/music/work-music-settings";
import type {
  YouTubeMusicProfile,
  YouTubeVideoProjection,
} from "../../../application/music/youtube-music";
import { entityId, type EntityId } from "../../../domain/writing";
import {
  startWorkMusicSettingsLoad,
  startYouTubeMusicProfileLoad,
  type MusicLibraryQueueProjectionPort,
  type WorkMusicSettingsReadClient,
  type YouTubeMusicProfileReadClient,
} from "./music-client";
import {
  createMusicPlaybackRequest,
  withoutRegisteredLocalMedia,
  type MusicPlaybackRequest,
} from "./music-state";

export type MusicOperations = Readonly<{
  playback: StudioBridge["musicPlayback"];
  settings: StudioBridge["settings"];
}>;

export function useMusicController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  libraryQueue?: MusicLibraryQueueProjectionPort;
  musicSettingsRevision: number;
  operations?: MusicOperations;
  profileClient: YouTubeMusicProfileReadClient;
  settingsClient: WorkMusicSettingsReadClient;
}>) {
  const [workMusicSettings, setWorkMusicSettings] =
    useState<WorkMusicSettingsProjection | null>(null);
  const [youtubeMusicProfile, setYoutubeMusicProfile] =
    useState<YouTubeMusicProfile | null>(null);
  const [musicPlaybackRequest, setMusicPlaybackRequest] =
    useState<MusicPlaybackRequest | null>(null);
  const [sceneMusicQueueCandidates, setSceneMusicQueueCandidates] = useState<
    readonly SceneMusicQueueCandidate[]
  >([]);
  const [sceneMusicQueueActionState, setSceneMusicQueueActionState] = useState<
    "idle" | "searching" | "selecting" | "playing" | "saving-favorite"
  >("idle");
  const [sceneMusicQueueError, setSceneMusicQueueError] =
    useState<string | null>(null);
  const [musicLibraryOpen, setMusicLibraryOpen] = useState(false);
  const [musicLibraryResults, setMusicLibraryResults] = useState<
    readonly YouTubeVideoProjection[]
  >([]);
  const [musicLibraryQueue, setMusicLibraryQueue] = useState<
    readonly MusicTrackProjection[]
  >([]);
  const [musicLibraryActionState, setMusicLibraryActionState] = useState<
    | "idle"
    | "searching"
    | "saving-playlist"
    | "registering-media"
    | "removing-media"
    | "relinking-media"
  >("idle");
  const [localMediaRegistrationMode, setLocalMediaRegistrationMode] =
    useState<LocalMediaStorageMode | null>(null);
  const [localMediaRemovalId, setLocalMediaRemovalId] =
    useState<string | null>(null);
  const [localMediaRelinkingId, setLocalMediaRelinkingId] =
    useState<string | null>(null);
  const [localMediaAvailability, setLocalMediaAvailability] = useState<
    Readonly<Record<string, LocalMediaAvailabilityStatus>>
  >(Object.freeze({}));
  const [musicLibraryError, setMusicLibraryError] = useState<string | null>(
    null,
  );
  const musicPlaybackNonceRef = useRef(0);
  const [initialProfileClient] = useState(() => input.profileClient);

  const replaceMusicLibraryPlaylist = useCallback(
    (tracks: readonly MusicTrackProjection[]) => {
      setMusicLibraryQueue(tracks);
    },
    [],
  );
  const clearMusicLibraryPlaylist = useCallback(() => {
    setMusicLibraryQueue([]);
  }, []);
  const internalLibraryQueue = useMemo(() => Object.freeze({
    replacePlaylist: replaceMusicLibraryPlaylist,
    clearPlaylist: clearMusicLibraryPlaylist,
  }), [clearMusicLibraryPlaylist, replaceMusicLibraryPlaylist]);
  const libraryQueue = input.libraryQueue ?? internalLibraryQueue;

  useEffect(() => startWorkMusicSettingsLoad({
    activeWorkId: input.activeWorkId,
    client: input.settingsClient,
    libraryQueue,
    onReset: () => setWorkMusicSettings(null),
    onLoaded: setWorkMusicSettings,
    onFailed: () => setWorkMusicSettings(null),
  }), [
    input.activeWorkId,
    input.musicSettingsRevision,
    input.settingsClient,
    libraryQueue,
  ]);

  useEffect(() => startYouTubeMusicProfileLoad({
    client: initialProfileClient,
    onLoaded: setYoutubeMusicProfile,
    onFailed: () => setYoutubeMusicProfile(null),
  }), [initialProfileClient]);

  useEffect(() => {
    let disposed = false;
    if (
      !musicLibraryOpen ||
      input.activeWorkId === null ||
      input.operations === undefined ||
      workMusicSettings?.workId !== input.activeWorkId
    ) {
      return () => {
        disposed = true;
      };
    }
    const mediaIds = workMusicSettings.settings.localMedia.map(
      (track) => track.mediaId,
    );
    if (mediaIds.length === 0) {
      return () => {
        disposed = true;
      };
    }
    void input.operations.playback.inspectLocalMedia({
      schemaVersion: 1,
      workId: input.activeWorkId,
      mediaIds,
    }).then(
      (result) => {
        if (disposed) return;
        setLocalMediaAvailability(Object.freeze(Object.fromEntries(
          result.entries.map((entry) => [entry.mediaId, entry.status]),
        )));
      },
      (reason) => {
        if (disposed) return;
        setMusicLibraryError(
          reason instanceof Error
            ? reason.message
            : "미디어 연결 상태를 확인하지 못했습니다.",
        );
      },
    );
    return () => {
      disposed = true;
    };
  }, [
    input.activeWorkId,
    input.operations,
    musicLibraryOpen,
    workMusicSettings,
  ]);

  const playMusicQueue = useCallback((
    tracks: readonly MusicTrackProjection[],
    startIndex = 0,
  ): boolean => {
    const request = createMusicPlaybackRequest(
      musicPlaybackNonceRef.current,
      tracks,
      startIndex,
    );
    if (request === null) return false;
    musicPlaybackNonceRef.current = request.nonce;
    setMusicPlaybackRequest(request);
    return true;
  }, []);

  const replaceWorkMusicSettings = useCallback(
    (projection: WorkMusicSettingsProjection) => {
      setWorkMusicSettings(projection);
    },
    [],
  );

  const listSceneMusicQueueProjection = useCallback(
    async (workId: EntityId<"Work">) => {
      if (input.operations === undefined) {
        throw new Error("Music operations are unavailable");
      }
      const projection =
        await input.operations.playback.listSceneQueueCandidates({
          schemaVersion: 1,
          workId,
        });
      return projection.candidates;
    },
    [input.operations],
  );
  const replaceSceneMusicQueueProjection = useCallback(
    (candidates: readonly SceneMusicQueueCandidate[]) => {
      setSceneMusicQueueCandidates(candidates);
    },
    [],
  );
  const clearSceneMusicQueueProjection = useCallback(() => {
    setSceneMusicQueueCandidates([]);
  }, []);
  const clearSceneMusicQueueError = useCallback(() => {
    setSceneMusicQueueError(null);
  }, []);
  const sceneQueueProjectionPort = useMemo(() => Object.freeze({
    list: listSceneMusicQueueProjection,
    replace: replaceSceneMusicQueueProjection,
    clear: clearSceneMusicQueueProjection,
  }), [
    clearSceneMusicQueueProjection,
    listSceneMusicQueueProjection,
    replaceSceneMusicQueueProjection,
  ]);

  const refreshSceneMusicQueueCandidates = useCallback(async (
    workId: EntityId<"Work">,
  ) => {
    const candidates = await listSceneMusicQueueProjection(workId);
    setSceneMusicQueueCandidates(candidates);
    return candidates;
  }, [listSceneMusicQueueProjection]);

  const searchMusicLibrary = useCallback(async (query: string) => {
    if (
      input.operations === undefined ||
      musicLibraryActionState !== "idle"
    ) return;
    setMusicLibraryActionState("searching");
    setMusicLibraryError(null);
    try {
      const result = await input.operations.playback.searchVideos({
        schemaVersion: 1,
        query,
      });
      setMusicLibraryResults(result.videos);
      if (result.videos.length === 0) {
        setMusicLibraryError("검색 결과가 없습니다.");
      }
    } catch (reason) {
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "음악을 검색하지 못했습니다.",
      );
    } finally {
      setMusicLibraryActionState("idle");
    }
  }, [input.operations, musicLibraryActionState]);

  const saveMusicLibraryQueue = useCallback(async (
    nextQueue: readonly MusicTrackProjection[],
  ) => {
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      workMusicSettings?.workId !== input.activeWorkId ||
      musicLibraryActionState !== "idle" ||
      sceneMusicQueueActionState !== "idle"
    ) return;
    const previousQueue = workMusicSettings.settings.playlistTracks;
    setMusicLibraryQueue(nextQueue);
    setMusicLibraryActionState("saving-playlist");
    setMusicLibraryError(null);
    try {
      const saved = await input.operations.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: input.activeWorkId,
        expectedRevision: workMusicSettings.revision,
        settings: {
          ...workMusicSettings.settings,
          playlistTracks: nextQueue,
        },
      });
      replaceWorkMusicSettings(saved);
      setMusicLibraryQueue(saved.settings.playlistTracks);
    } catch (reason) {
      setMusicLibraryQueue(previousQueue);
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "재생목록을 저장하지 못했습니다.",
      );
    } finally {
      setMusicLibraryActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.operations,
    musicLibraryActionState,
    replaceWorkMusicSettings,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const registerLocalMedia = useCallback(async (
    storageMode: LocalMediaStorageMode,
  ) => {
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      workMusicSettings?.workId !== input.activeWorkId ||
      musicLibraryActionState !== "idle" ||
      sceneMusicQueueActionState !== "idle"
    ) return;
    setMusicLibraryActionState("registering-media");
    setLocalMediaRegistrationMode(storageMode);
    setMusicLibraryError(null);
    try {
      const result = await input.operations.playback.selectLocalMedia({
        schemaVersion: 1,
        workId: input.activeWorkId,
        storageMode,
      });
      if (result.status === "cancelled") return;
      const saved = await input.operations.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: input.activeWorkId,
        expectedRevision: workMusicSettings.revision,
        settings: {
          ...workMusicSettings.settings,
          localMedia: Object.freeze([
            ...workMusicSettings.settings.localMedia,
            ...result.tracks,
          ]),
        },
      });
      replaceWorkMusicSettings(saved);
    } catch (reason) {
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "미디어 파일을 등록하지 못했습니다.",
      );
    } finally {
      setLocalMediaRegistrationMode(null);
      setMusicLibraryActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.operations,
    musicLibraryActionState,
    replaceWorkMusicSettings,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const removeRegisteredLocalMedia = useCallback(async (
    track: LocalMediaTrackProjection,
  ) => {
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      workMusicSettings?.workId !== input.activeWorkId ||
      track.workId !== input.activeWorkId ||
      !workMusicSettings.settings.localMedia.some(
        (entry) => entry.mediaId === track.mediaId,
      ) ||
      musicLibraryActionState !== "idle" ||
      sceneMusicQueueActionState !== "idle"
    ) return;
    setMusicLibraryActionState("removing-media");
    setLocalMediaRemovalId(track.mediaId);
    setMusicLibraryError(null);
    try {
      const saved = await input.operations.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: input.activeWorkId,
        expectedRevision: workMusicSettings.revision,
        settings: withoutRegisteredLocalMedia(
          workMusicSettings.settings,
          track,
        ),
      });
      replaceWorkMusicSettings(saved);
      setMusicLibraryQueue(saved.settings.playlistTracks);
      setLocalMediaAvailability((current) => Object.freeze(
        Object.fromEntries(
          Object.entries(current).filter(([mediaId]) =>
            mediaId !== track.mediaId
          ),
        ),
      ));
    } catch (reason) {
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "등록한 미디어를 삭제하지 못했습니다.",
      );
    } finally {
      setLocalMediaRemovalId(null);
      setMusicLibraryActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.operations,
    musicLibraryActionState,
    replaceWorkMusicSettings,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const relinkLocalMedia = useCallback(async (
    track: LocalMediaTrackProjection,
  ) => {
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      workMusicSettings?.workId !== input.activeWorkId ||
      track.workId !== input.activeWorkId ||
      track.storageMode !== "external-reference" ||
      !workMusicSettings.settings.localMedia.some(
        (entry) => entry.mediaId === track.mediaId,
      ) ||
      musicLibraryActionState !== "idle" ||
      sceneMusicQueueActionState !== "idle"
    ) return;
    setMusicLibraryActionState("relinking-media");
    setLocalMediaRelinkingId(track.mediaId);
    setMusicLibraryError(null);
    try {
      const result = await input.operations.playback.relinkLocalMedia({
        schemaVersion: 1,
        workId: input.activeWorkId,
        mediaId: track.mediaId,
      });
      if (result.status === "relinked") {
        setLocalMediaAvailability((current) => Object.freeze({
          ...current,
          [track.mediaId]: result.availability.status,
        }));
      }
    } catch (reason) {
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "미디어 원본을 다시 연결하지 못했습니다.",
      );
    } finally {
      setLocalMediaRelinkingId(null);
      setMusicLibraryActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.operations,
    musicLibraryActionState,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const searchSceneMusicQueues = useCallback(async (
    annotation: SceneAnnotationProjection,
    query: string,
  ) => {
    const normalizedQuery = query.trim();
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      annotation.workId !== input.activeWorkId ||
      sceneMusicQueueActionState !== "idle" ||
      normalizedQuery.length === 0
    ) {
      if (normalizedQuery.length === 0) {
        setSceneMusicQueueError("음악 검색어를 입력해 주세요.");
      }
      return;
    }
    setSceneMusicQueueActionState("searching");
    setSceneMusicQueueError(null);
    try {
      const result = await input.operations.playback.searchSceneQueues({
        schemaVersion: 1,
        requestId: entityId<"SceneMusicQueueRequest">(crypto.randomUUID()),
        workId: annotation.workId,
        sceneKey: annotation.sceneKey,
        expectedAnnotationRevision: annotation.revision,
        query: normalizedQuery,
      });
      if (result.status === "connection-required") {
        setSceneMusicQueueError(
          "YouTube Data API 연결 후 장면 음악을 찾을 수 있습니다.",
        );
        return;
      }
      setSceneMusicQueueCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (candidate) =>
            candidate.candidateId !== result.candidate.candidateId,
        ),
      ]));
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "장면 음악 큐를 찾지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [input.activeWorkId, input.operations, sceneMusicQueueActionState]);

  const selectSceneMusicQueue = useCallback(async (
    candidate: SceneMusicQueueCandidate,
    option: SceneMusicQueueOption,
  ) => {
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      candidate.workId !== input.activeWorkId ||
      sceneMusicQueueActionState !== "idle"
    ) return;
    setSceneMusicQueueActionState("selecting");
    setSceneMusicQueueError(null);
    try {
      await input.operations.playback.selectSceneQueue({
        schemaVersion: 1,
        workId: candidate.workId,
        candidateId: candidate.candidateId,
        expectedCandidateRevision: candidate.revision,
        optionId: option.optionId,
      });
      await refreshSceneMusicQueueCandidates(candidate.workId);
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "장면 음악 큐를 선택하지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.operations,
    refreshSceneMusicQueueCandidates,
    sceneMusicQueueActionState,
  ]);

  const playSelectedSceneMusicQueue = useCallback(async (
    candidate: SceneMusicQueueCandidate,
  ) => {
    if (
      input.activeWorkId === null ||
      candidate.workId !== input.activeWorkId ||
      sceneMusicQueueActionState !== "idle"
    ) return;
    setSceneMusicQueueActionState("playing");
    setSceneMusicQueueError(null);
    try {
      const candidates = await refreshSceneMusicQueueCandidates(
        candidate.workId,
      );
      const currentCandidate = candidates.find(
        (entry) => entry.candidateId === candidate.candidateId,
      );
      const option = currentCandidate === undefined
        ? null
        : selectedSceneMusicQueueOption(currentCandidate);
      if (option === null) {
        throw new Error("현재 장면에 선택된 최신 큐가 없습니다.");
      }
      const played = playMusicQueue(option.tracks);
      if (!played) {
        setSceneMusicQueueError(
          "선택한 장면 음악 큐를 재생하지 못했습니다.",
        );
      }
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "선택한 장면 음악 큐를 재생하지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [
    input.activeWorkId,
    playMusicQueue,
    refreshSceneMusicQueueCandidates,
    sceneMusicQueueActionState,
  ]);

  const toggleFavoriteMusicTrack = useCallback(async (
    track: MusicTrackProjection,
  ) => {
    if (
      input.activeWorkId === null ||
      input.operations === undefined ||
      workMusicSettings?.workId !== input.activeWorkId ||
      sceneMusicQueueActionState !== "idle" ||
      musicLibraryActionState !== "idle"
    ) return;
    const currentFavorites = workMusicSettings.settings.favoriteTracks;
    const identity = musicTrackIdentity(track);
    const alreadyFavorite = currentFavorites.some(
      (favorite) => musicTrackIdentity(favorite) === identity,
    );
    setSceneMusicQueueActionState("saving-favorite");
    setSceneMusicQueueError(null);
    try {
      const saved = await input.operations.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: input.activeWorkId,
        expectedRevision: workMusicSettings.revision,
        settings: {
          ...workMusicSettings.settings,
          favoriteTracks: alreadyFavorite
            ? currentFavorites.filter(
                (favorite) => musicTrackIdentity(favorite) !== identity,
              )
            : Object.freeze([...currentFavorites, track]),
        },
      });
      replaceWorkMusicSettings(saved);
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "선호 영상을 저장하지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.operations,
    musicLibraryActionState,
    replaceWorkMusicSettings,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const openMusicLibrary = useCallback(() => {
    setMusicLibraryError(null);
    setMusicLibraryOpen(true);
  }, []);
  const closeMusicLibrary = useCallback(() => {
    setMusicLibraryOpen(false);
  }, []);
  const addMusicLibraryTrack = useCallback((track: MusicTrackProjection) => {
    if (musicLibraryQueue.some(
      (entry) => musicTrackIdentity(entry) === musicTrackIdentity(track),
    )) return;
    void saveMusicLibraryQueue(Object.freeze([...musicLibraryQueue, track]));
  }, [musicLibraryQueue, saveMusicLibraryQueue]);
  const clearMusicLibraryQueue = useCallback(() => {
    void saveMusicLibraryQueue(Object.freeze([]));
  }, [saveMusicLibraryQueue]);
  const moveMusicLibraryQueueTrack = useCallback((
    index: number,
    targetIndex: number,
  ) => {
    if (
      index < 0 ||
      targetIndex < 0 ||
      index >= musicLibraryQueue.length ||
      targetIndex >= musicLibraryQueue.length
    ) return;
    const nextQueue = [...musicLibraryQueue];
    const [track] = nextQueue.splice(index, 1);
    if (track === undefined) return;
    nextQueue.splice(targetIndex, 0, track);
    void saveMusicLibraryQueue(Object.freeze(nextQueue));
  }, [musicLibraryQueue, saveMusicLibraryQueue]);
  const playMusicLibraryTrack = useCallback((track: MusicTrackProjection) => {
    const queuedIndex = musicLibraryQueue.findIndex(
      (entry) => musicTrackIdentity(entry) === musicTrackIdentity(track),
    );
    if (queuedIndex >= 0) {
      playMusicQueue(musicLibraryQueue, queuedIndex);
    } else {
      playMusicQueue([track]);
    }
  }, [musicLibraryQueue, playMusicQueue]);
  const removeMusicLibraryTrack = useCallback((track: MusicTrackProjection) => {
    void saveMusicLibraryQueue(Object.freeze(
      musicLibraryQueue.filter(
        (entry) => musicTrackIdentity(entry) !== musicTrackIdentity(track),
      ),
    ));
  }, [musicLibraryQueue, saveMusicLibraryQueue]);

  const reconcile = useMemo(() => Object.freeze({
    replaceWorkMusicSettings,
    replaceSceneMusicQueueCandidates: replaceSceneMusicQueueProjection,
  }), [replaceSceneMusicQueueProjection, replaceWorkMusicSettings]);

  return {
    workMusicSettings,
    youtubeMusicProfile,
    musicPlaybackRequest,
    sceneMusicQueueCandidates,
    sceneMusicQueueActionState,
    sceneMusicQueueError,
    musicLibraryOpen,
    musicLibraryResults,
    musicLibraryQueue,
    musicLibraryActionState,
    localMediaRegistrationMode,
    musicLibraryError,
    playMusicQueue,
    sceneQueueProjectionPort,
    listSceneMusicQueueCandidates: listSceneMusicQueueProjection,
    clearSceneMusicQueueError,
    refreshSceneMusicQueueCandidates,
    searchMusicLibrary,
    saveMusicLibraryQueue,
    registerLocalMedia,
    removeRegisteredLocalMedia,
    relinkLocalMedia,
    searchSceneMusicQueues,
    selectSceneMusicQueue,
    playSelectedSceneMusicQueue,
    toggleFavoriteMusicTrack,
    openMusicLibrary,
    closeMusicLibrary,
    addMusicLibraryTrack,
    clearMusicLibraryQueue,
    moveMusicLibraryQueueTrack,
    playMusicLibraryTrack,
    removeMusicLibraryTrack,
    localMediaRemovalId,
    localMediaRelinkingId,
    localMediaAvailability,
    reconcile,
  };
}

export type { MusicLibraryQueueProjectionPort } from "./music-client";
export type { MusicPlaybackRequest } from "./music-state";
