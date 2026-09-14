import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type {
  LocalMediaTrackProjection,
  MusicTrackProjection,
} from "../../../application/music/media-track";
import type { WorkMusicSettingsProjection } from "../../../application/music/work-music-settings";
import type { YouTubeMusicProfile } from "../../../application/music/youtube-music";
import { entityId } from "../../../domain/writing";
import {
  startWorkMusicSettingsLoad,
  startYouTubeMusicProfileLoad,
  type MusicLibraryQueueProjectionPort,
  type MusicTimerPort,
  type WorkMusicSettingsReadClient,
} from "./music-client";
import {
  createMusicPlaybackRequest,
  appendMusicTracksToQueue,
  withoutRegisteredLocalMedia,
} from "./music-state";

const workA = entityId<"Work">("work-music-a");
const workB = entityId<"Work">("work-music-b");

it("adds a selection in one ordered queue update without duplicating existing tracks", () => {
  const first = track("first"); const second = track("second"); const third = track("third");
  const queue = appendMusicTracksToQueue([first], [second, first, third, second]);
  expect(queue).toEqual([first, second, third]);
  expect(createMusicPlaybackRequest(0, queue, 1)?.tracks).toEqual([first, second, third]);
});

function track(suffix: string): MusicTrackProjection {
  return Object.freeze({
    providerId: "provider-runtime",
    videoId: `video-${suffix}`,
    title: `음악 ${suffix}`,
    channel: `채널 ${suffix}`,
    thumbnailUrl: null,
    externalUrl: `https://music.invalid/${suffix}`,
  });
}

function localTrack(suffix: string): LocalMediaTrackProjection {
  return Object.freeze({
    sourceKind: "local-file",
    mediaId: `media-${suffix}`,
    workId: workA,
    title: `로컬 음악 ${suffix}`,
    fileName: `${suffix}.mp3`,
    mediaKind: "audio",
    mediaType: "audio/mpeg",
    storageMode: "external-reference",
    byteLength: 128,
  });
}

function settings(
  workId: typeof workA | typeof workB,
  suffix: string,
): WorkMusicSettingsProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId,
    revision: 2,
    settings: Object.freeze({
      autoOnEpisodeTransition: false,
      autoOnSceneTransition: false,
      autoPlayOnPomodoroStart: true,
      favoriteTracks: Object.freeze([track(`favorite-${suffix}`)]),
      playlistTracks: Object.freeze([track(`playlist-${suffix}`)]),
      localMedia: Object.freeze([]),
      preciseSelection: false,
      transitionPlaybackMode: `mode-${suffix}`,
    }),
    updatedAt: "2026-08-24T00:00:00.000Z",
  });
}

function profile(suffix: string): YouTubeMusicProfile {
  return Object.freeze({
    schemaVersion: 1,
    providerId: `provider-${suffix}`,
    displayName: `프로필 ${suffix}`,
    searchApiBaseUrl: `https://search.invalid/${suffix}`,
    iframeApiUrl: `https://iframe.invalid/${suffix}`,
    watchBaseUrl: `https://watch.invalid/${suffix}`,
    playerReferer: `https://referer.invalid/${suffix}`,
    searchLimit: 7,
    videosPerOption: 3,
    requestTimeoutMs: 4000,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function libraryQueuePort(): MusicLibraryQueueProjectionPort {
  return {
    replacePlaylist: vi.fn(),
    clearPlaylist: vi.fn(),
  };
}

describe("music controller core", () => {
  it("delays null-Work reset and cancels the scheduled reset on cleanup", () => {
    const callbacks: Array<() => void> = [];
    const cancel = vi.fn();
    const timer: MusicTimerPort = {
      schedule: vi.fn((callback, delayMs) => {
        expect(delayMs).toBe(0);
        callbacks.push(callback);
        return callbacks.length;
      }),
      cancel,
    };
    const onReset = vi.fn();
    const queue = libraryQueuePort();
    const disposeApplied = startWorkMusicSettingsLoad({
      activeWorkId: null,
      client: {} as WorkMusicSettingsReadClient,
      libraryQueue: queue,
      onFailed: vi.fn(),
      onLoaded: vi.fn(),
      onReset,
      timer,
    });
    expect(onReset).not.toHaveBeenCalled();
    expect(queue.clearPlaylist).not.toHaveBeenCalled();
    callbacks[0]?.();
    expect(onReset).toHaveBeenCalledOnce();
    expect(queue.clearPlaylist).toHaveBeenCalledOnce();
    disposeApplied();

    const disposeCancelled = startWorkMusicSettingsLoad({
      activeWorkId: null,
      client: {} as WorkMusicSettingsReadClient,
      libraryQueue: queue,
      onFailed: vi.fn(),
      onLoaded: vi.fn(),
      onReset,
      timer,
    });
    disposeCancelled();
    expect(cancel).toHaveBeenLastCalledWith(2);
  });

  it("does not eagerly clear on A-to-B load and suppresses disposed A", async () => {
    const readA = deferred<WorkMusicSettingsProjection>();
    const readB = deferred<WorkMusicSettingsProjection>();
    const client: WorkMusicSettingsReadClient = {
      getWorkMusic: vi.fn((command) =>
        command.workId === workA ? readA.promise : readB.promise),
    };
    const queue = libraryQueuePort();
    const onLoaded = vi.fn();
    const onFailed = vi.fn();
    const disposeA = startWorkMusicSettingsLoad({
      activeWorkId: workA,
      client,
      libraryQueue: queue,
      onFailed,
      onLoaded,
      onReset: vi.fn(),
    });
    disposeA();
    startWorkMusicSettingsLoad({
      activeWorkId: workB,
      client,
      libraryQueue: queue,
      onFailed,
      onLoaded,
      onReset: vi.fn(),
    });
    expect(queue.clearPlaylist).not.toHaveBeenCalled();
    expect(queue.replacePlaylist).not.toHaveBeenCalled();

    readA.resolve(settings(workA, "a"));
    await Promise.resolve();
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();
    readB.resolve(settings(workB, "b"));
    await Promise.resolve();
    await Promise.resolve();
    expect(onLoaded).toHaveBeenCalledWith(settings(workB, "b"));
    expect(queue.replacePlaylist).toHaveBeenCalledWith(
      settings(workB, "b").settings.playlistTracks,
    );
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("silently publishes null settings and an empty playlist after load failure", async () => {
    const queue = libraryQueuePort();
    const onFailed = vi.fn();
    startWorkMusicSettingsLoad({
      activeWorkId: workA,
      client: {
        getWorkMusic: vi.fn(() => Promise.reject(new Error("load failed"))),
      },
      libraryQueue: queue,
      onFailed,
      onLoaded: vi.fn(),
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onFailed).toHaveBeenCalledOnce();
    expect(queue.clearPlaylist).toHaveBeenCalledOnce();
  });

  it("loads the profile silently and suppresses a disposed result", async () => {
    const first = deferred<YouTubeMusicProfile>();
    const onLoaded = vi.fn();
    const onFailed = vi.fn();
    const dispose = startYouTubeMusicProfileLoad({
      client: { getProfile: vi.fn(() => first.promise) },
      onFailed,
      onLoaded,
    });
    dispose();
    first.resolve(profile("disposed"));
    await Promise.resolve();
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();

    startYouTubeMusicProfileLoad({
      client: {
        getProfile: vi.fn(() => Promise.reject(new Error("profile failed"))),
      },
      onFailed,
      onLoaded,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onFailed).toHaveBeenCalledOnce();
  });

  it("creates copied immutable requests with immediate monotonic nonce and current clamp", () => {
    const tracks = [track("first"), track("second"), track("third")];
    expect(createMusicPlaybackRequest(0, [], 2)).toBeNull();
    const first = createMusicPlaybackRequest(0, tracks, 1.9);
    expect(first).toEqual({ nonce: 1, startIndex: 1, tracks });
    expect(first?.tracks).not.toBe(tracks);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.tracks)).toBe(true);
    const second = createMusicPlaybackRequest(first!.nonce, tracks, -8);
    expect(second?.nonce).toBe(2);
    expect(second?.startIndex).toBe(0);
    const third = createMusicPlaybackRequest(second!.nonce, tracks, 99);
    expect(third?.nonce).toBe(3);
    expect(third?.startIndex).toBe(2);
  });

  it("removes registered local media from the library, playlist, and favorites", () => {
    const removed = localTrack("removed");
    const preserved = localTrack("preserved");
    const remote = track("remote");
    const current = Object.freeze({
      ...settings(workA, "remove").settings,
      favoriteTracks: Object.freeze([removed, remote]),
      playlistTracks: Object.freeze([remote, removed]),
      localMedia: Object.freeze([removed, preserved]),
    });

    const next = withoutRegisteredLocalMedia(current, removed);

    expect(next.favoriteTracks).toEqual([remote]);
    expect(next.playlistTracks).toEqual([remote]);
    expect(next.localMedia).toEqual([preserved]);
    expect(current.localMedia).toEqual([removed, preserved]);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.localMedia)).toBe(true);
  });

  it("keeps music state and mutations in the music slice while hosts compose UI and Pomodoro", () => {
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const clientSource = readFileSync(
      new URL("./music-client.ts", import.meta.url),
      "utf8",
    );
    const controllerSource = readFileSync(
      new URL("./useMusicController.ts", import.meta.url),
      "utf8",
    );
    const pomodoroSource = readFileSync(
      new URL("./usePomodoroMusicController.ts", import.meta.url),
      "utf8",
    );
    const coreSource = readFileSync(
      new URL("../../workspace/useWorkspaceCoreFeatureKernel.ts", import.meta.url),
      "utf8",
    );
    const uiHostSource = readFileSync(
      new URL("../../workspace/WorkspaceStatusToolsHost.tsx", import.meta.url),
      "utf8",
    );
    expect(clientSource).not.toContain("window.");
    expect(controllerSource).not.toContain("window.");
    expect(controllerSource).toContain(
      "const [musicLibraryQueue, setMusicLibraryQueue]",
    );
    expect(controllerSource).toContain("input.operations.settings.saveWorkMusic(");
    expect(controllerSource).toContain("input.operations.playback.selectLocalMedia(");
    expect(controllerSource).toContain("input.operations.playback.searchVideos(");
    expect(controllerSource).toContain("input.operations.playback.searchSceneQueues(");
    expect(controllerSource).toContain("input.operations.playback.selectSceneQueue(");
    expect(appSource).not.toContain("setWorkMusicSettings");
    expect(appSource).not.toContain("settings.getWorkMusic(");
    expect(appSource).not.toContain("musicPlayback.getProfile()");
    expect(appSource).not.toMatch(
      /window\.eumStudio\.(?:settings|musicPlayback)\.[A-Za-z]+\(/u,
    );
    expect(uiHostSource).toContain("<MusicMiniPlayer");
    expect(uiHostSource).toContain("<MusicLibraryDialog");
    expect(controllerSource.match(/replaceWorkMusicSettings\(saved\)/gu))
      .toHaveLength(4);

    const playlistSave = controllerSource.slice(
      controllerSource.indexOf("const saveMusicLibraryQueue = useCallback("),
      controllerSource.indexOf("const registerLocalMedia = useCallback("),
    );
    expect(playlistSave).toContain("setMusicLibraryQueue(nextQueue)");
    expect(playlistSave).toContain(
      "setMusicLibraryQueue(saved.settings.playlistTracks)",
    );
    expect(playlistSave).toContain("setMusicLibraryQueue(previousQueue)");
    const register = controllerSource.slice(
      controllerSource.indexOf("const registerLocalMedia = useCallback("),
      controllerSource.indexOf("const removeRegisteredLocalMedia = useCallback("),
    );
    expect(register).toContain("replaceWorkMusicSettings(saved)");
    expect(register).not.toContain("setMusicLibraryQueue");
    const favorite = controllerSource.slice(
      controllerSource.indexOf("const toggleFavoriteMusicTrack = useCallback("),
      controllerSource.indexOf("const openMusicLibrary = useCallback("),
    );
    expect(favorite).toContain("replaceWorkMusicSettings(saved)");
    expect(favorite).not.toContain("setMusicLibraryQueue");

    const settingsEffect = controllerSource.slice(
      controllerSource.indexOf("useEffect(() => startWorkMusicSettingsLoad"),
      controllerSource.indexOf("useEffect(() => startYouTubeMusicProfileLoad"),
    );
    expect(settingsEffect).toContain("input.musicSettingsRevision");
    const profileEffect = controllerSource.slice(
      controllerSource.indexOf("useEffect(() => startYouTubeMusicProfileLoad"),
      controllerSource.indexOf("const playMusicQueue"),
    );
    expect(profileEffect).toContain("initialProfileClient");
    expect(profileEffect).not.toContain("input.profileClient");
    expect(controllerSource.match(/setMusicPlaybackRequest\(/gu)).toHaveLength(1);

    expect(coreSource).toContain("usePomodoroMusicController(");
    expect(coreSource).toContain("onPomodoroStarted: playMusicForPomodoroStartPort");
    expect(pomodoroSource.indexOf("autoPlayOnPomodoroStart"))
      .toBeLessThan(pomodoroSource.indexOf("Promise.all"));
    expect(pomodoroSource.indexOf("selectedSceneMusicQueueOption"))
      .toBeLessThan(pomodoroSource.indexOf("input.playMusicQueue"));
  });
});
