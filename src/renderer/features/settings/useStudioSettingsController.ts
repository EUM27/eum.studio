import { useCallback, useEffect, useState } from "react";

import type { ChatGptOAuthConnectionStatus } from "../../../application/assistant/chatgpt-oauth";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  MusicSettingsProfile,
  WorkMusicSettingsProjection,
} from "../../../application/music/work-music-settings";
import type {
  AppSettingsProfile,
  AppSettingsProjection,
} from "../../../application/settings/app-settings";
import type { YouTubeMusicConnectionStatus } from "../../../application/music/youtube-music-connection";
import type { WorkSceneAnalysisSettingsProjection } from "../../../application/settings/work-scene-analysis-settings";
import type { EntityId } from "../../../domain/writing";
import type { AppSettingsSaveValue } from "../../settings/AppSettingsDialog";
import { ensureWorkSceneAnalysisPermissions } from "./scene-analysis-permissions";

export function useStudioSettingsController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: StudioBridge["assistant"];
  onOpening: () => void;
  settingsClient: StudioBridge["settings"];
  shellActionState: string;
}>) {
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [appSettingsProfile, setAppSettingsProfile] =
    useState<AppSettingsProfile | null>(null);
  const [appSettingsProjection, setAppSettingsProjection] =
    useState<AppSettingsProjection | null>(null);
  const [musicSettingsProfile, setMusicSettingsProfile] =
    useState<MusicSettingsProfile | null>(null);
  const [workMusicSettingsProjection, setWorkMusicSettingsProjection] =
    useState<WorkMusicSettingsProjection | null>(null);
  const [workSceneAnalysisSettingsProjection, setWorkSceneAnalysisSettingsProjection] =
    useState<WorkSceneAnalysisSettingsProjection | null>(null);
  const [youtubeMusicConnectionStatus, setYoutubeMusicConnectionStatus] =
    useState<YouTubeMusicConnectionStatus | null>(null);
  const [chatGptOAuthStatus, setChatGptOAuthStatus] =
    useState<ChatGptOAuthConnectionStatus | null>(null);
  const [chatGptOAuthLoginState, setChatGptOAuthLoginState] = useState<
    "idle" | "waiting"
  >("idle");
  const [appSettingsActionState, setAppSettingsActionState] = useState<
    "loading" | "idle" | "saving"
  >("idle");
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);
  const [appSettingsScheduleRevision, setAppSettingsScheduleRevision] =
    useState(0);

  useEffect(() => {
    let active = true;
    void input.settingsClient.getYouTubeMusicConnectionStatus().then(
      (status) => {
        if (active) setYoutubeMusicConnectionStatus(status);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [input.settingsClient]);

  const dismissAppSettingsForQuickTools = useCallback(() => {
    setShowAppSettings(false);
    setAppSettingsError(null);
  }, []);

  const openAppSettings = useCallback(() => {
    if (input.shellActionState !== "idle") return;
    input.onOpening();
    setShowAppSettings(true);
    setAppSettingsProfile(null);
    setAppSettingsProjection(null);
    setMusicSettingsProfile(null);
    setWorkMusicSettingsProjection(null);
    setWorkSceneAnalysisSettingsProjection(null);
    setChatGptOAuthStatus(null);
    setChatGptOAuthLoginState("idle");
    setAppSettingsError(null);
    setAppSettingsActionState("loading");
    void Promise.all([
      input.settingsClient.getProfile(),
      input.settingsClient.get(),
      input.settingsClient.getMusicProfile(),
      input.settingsClient.getYouTubeMusicConnectionStatus(),
      input.assistantClient.getChatGptOAuthStatus(),
      input.activeWorkId === null
        ? Promise.resolve(null)
        : input.settingsClient.getWorkMusic({
            schemaVersion: 1,
            workId: input.activeWorkId,
          }),
      input.activeWorkId === null
        ? Promise.resolve(null)
        : input.settingsClient.getWorkSceneAnalysis({
            schemaVersion: 1,
            workId: input.activeWorkId,
          }),
    ]).then(
      ([
        profile,
        projection,
        musicProfile,
        youtubeStatus,
        chatGptStatus,
        workMusicProjection,
        workSceneAnalysisProjection,
      ]) => {
        setAppSettingsProfile(profile);
        setAppSettingsProjection(projection);
        setMusicSettingsProfile(musicProfile);
        setYoutubeMusicConnectionStatus(youtubeStatus);
        setChatGptOAuthStatus(chatGptStatus);
        setWorkMusicSettingsProjection(workMusicProjection);
        setWorkSceneAnalysisSettingsProjection(workSceneAnalysisProjection);
        setAppSettingsActionState("idle");
      },
      (reason: unknown) => {
        setAppSettingsError(
          reason instanceof Error ? reason.message : "설정을 불러오지 못했습니다.",
        );
        setAppSettingsActionState("idle");
      },
    );
  }, [input]);

  const closeAppSettings = useCallback(() => {
    if (appSettingsActionState === "saving") return;
    setShowAppSettings(false);
    setAppSettingsError(null);
  }, [appSettingsActionState]);

  const saveAppSettings = useCallback((value: AppSettingsSaveValue) => {
    if (appSettingsProjection === null) return;
    setAppSettingsActionState("saving");
    setAppSettingsError(null);
    const saveWorkMusic =
      value.workMusicSettings === null || workMusicSettingsProjection === null
        ? Promise.resolve(workMusicSettingsProjection)
        : input.settingsClient.saveWorkMusic({
            schemaVersion: 1,
            workId: workMusicSettingsProjection.workId,
            expectedRevision: workMusicSettingsProjection.revision,
            settings: value.workMusicSettings,
          });
    const saveYouTubeConnection = value.youtubeApiKey === null
      ? Promise.resolve(youtubeMusicConnectionStatus)
      : input.settingsClient.saveYouTubeMusicConnection({
          schemaVersion: 1,
          expectedRevision: youtubeMusicConnectionStatus?.revision ?? 0,
          apiKey: { mode: "replace", value: value.youtubeApiKey },
        });
    const saveSceneAnalysis = async () => {
      if (
        value.workSceneAnalysisEnabled === null ||
        workSceneAnalysisSettingsProjection === null
      ) {
        return workSceneAnalysisSettingsProjection;
      }
      if (
        value.workSceneAnalysisEnabled ===
          workSceneAnalysisSettingsProjection.settings.enabled
      ) {
        return workSceneAnalysisSettingsProjection;
      }
      const enabling = value.workSceneAnalysisEnabled &&
        !workSceneAnalysisSettingsProjection.settings.enabled;
      if (enabling) {
        if (input.activeWorkId === null || chatGptOAuthStatus === null) {
          throw new Error("현재 작품의 GPT 연결 상태를 확인하지 못했습니다.");
        }
        await ensureWorkSceneAnalysisPermissions({
          workId: input.activeWorkId,
          status: chatGptOAuthStatus,
          client: input.assistantClient,
        });
      }
      return input.settingsClient.saveWorkSceneAnalysis({
        schemaVersion: 1,
        workId: workSceneAnalysisSettingsProjection.workId,
        expectedRevision: workSceneAnalysisSettingsProjection.revision,
        settings: { enabled: value.workSceneAnalysisEnabled },
      });
    };
    void Promise.allSettled([
      input.settingsClient.save({
        schemaVersion: 1,
        expectedRevision: appSettingsProjection.revision,
        settings: {
          defaultEpisodeCharacters: value.defaultEpisodeCharacters,
        },
      }),
      saveWorkMusic,
      saveYouTubeConnection,
      saveSceneAnalysis(),
    ]).then((results) => {
      const [saved, savedWorkMusic, savedYouTubeStatus, savedSceneAnalysis] = results;
      if (saved.status === "fulfilled") {
        setAppSettingsProjection(saved.value);
        setAppSettingsScheduleRevision(saved.value.revision);
      }
      if (savedWorkMusic.status === "fulfilled") setWorkMusicSettingsProjection(savedWorkMusic.value);
      if (savedYouTubeStatus.status === "fulfilled") setYoutubeMusicConnectionStatus(savedYouTubeStatus.value);
      if (savedSceneAnalysis.status === "fulfilled") setWorkSceneAnalysisSettingsProjection(savedSceneAnalysis.value);
      const failed = results.find((result) => result.status === "rejected");
      if (failed !== undefined) {
        const reason: unknown = failed.reason;
        setAppSettingsError(reason instanceof Error ? reason.message : "설정을 저장하지 못했습니다.");
      } else {
        setShowAppSettings(false);
      }
      setAppSettingsActionState("idle");
    });
  }, [
    appSettingsProjection,
    input.activeWorkId,
    input.assistantClient,
    input.settingsClient,
    workMusicSettingsProjection,
    youtubeMusicConnectionStatus,
    workSceneAnalysisSettingsProjection,
    chatGptOAuthStatus,
  ]);

  const removeYouTubeMusicConnection = useCallback(() => {
    if (youtubeMusicConnectionStatus === null) return;
    setAppSettingsActionState("saving");
    setAppSettingsError(null);
    void input.settingsClient.saveYouTubeMusicConnection({
      schemaVersion: 1,
      expectedRevision: youtubeMusicConnectionStatus.revision,
      apiKey: { mode: "remove" },
    }).then(
      (saved) => {
        setYoutubeMusicConnectionStatus(saved);
        setAppSettingsActionState("idle");
      },
      (reason: unknown) => {
        setAppSettingsError(
          reason instanceof Error
            ? reason.message
            : "YouTube 연결을 해제하지 못했습니다.",
        );
        setAppSettingsActionState("idle");
      },
    );
  }, [input.settingsClient, youtubeMusicConnectionStatus]);

  const startChatGptOAuthLogin = useCallback(() => {
    if (chatGptOAuthLoginState === "waiting") return;
    setChatGptOAuthLoginState("waiting");
    setAppSettingsError(null);
    void input.assistantClient.startChatGptOAuthLogin().then(
      (status) => {
        setChatGptOAuthStatus(status);
        setChatGptOAuthLoginState("idle");
      },
      (reason: unknown) => {
        setAppSettingsError(
          reason instanceof Error ? reason.message : "GPT 로그인에 실패했습니다.",
        );
        setChatGptOAuthLoginState("idle");
      },
    );
  }, [chatGptOAuthLoginState, input.assistantClient]);

  return {
    showAppSettings,
    appSettingsProfile,
    appSettingsProjection,
    musicSettingsProfile,
    workMusicSettingsProjection: workMusicSettingsProjection?.workId === input.activeWorkId
      ? workMusicSettingsProjection : null,
    workSceneAnalysisSettingsProjection: workSceneAnalysisSettingsProjection?.workId === input.activeWorkId
      ? workSceneAnalysisSettingsProjection : null,
    youtubeMusicConnectionStatus,
    chatGptOAuthStatus,
    chatGptOAuthLoginState,
    appSettingsActionState,
    appSettingsError,
    appSettingsScheduleRevision,
    dismissAppSettingsForQuickTools,
    openAppSettings,
    closeAppSettings,
    saveAppSettings,
    removeYouTubeMusicConnection,
    startChatGptOAuthLogin,
  };
}
