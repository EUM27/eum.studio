import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseAppSettingsProfile } from "../../application/settings/app-settings";
import { parseMusicSettingsProfile } from "../../application/music/work-music-settings";
import { entityId } from "../../domain/writing";
import {
  AppSettingsDialog,
  parseDefaultEpisodeCharactersInput,
} from "./AppSettingsDialog";

describe("AppSettingsDialog", () => {
  const profile = parseAppSettingsProfile({
    schemaVersion: 1,
    defaultEpisodeCharacters: {
      defaultValue: 4_000,
      minValue: 100,
      maxValue: 100_000,
    },
  });
  const musicProfile = parseMusicSettingsProfile({
    schemaVersion: 1,
    workDefaults: {
      autoOnEpisodeTransition: false,
      autoOnSceneTransition: false,
      autoPlayOnPomodoroStart: true,
      preciseSelection: false,
      transitionPlaybackMode: "restart",
    },
    transitionPlaybackModes: ["restart", "ask"],
  });

  it("renders YouTube music connection and exact Work music settings", () => {
    const markup = renderToStaticMarkup(
      createElement(AppSettingsDialog, {
        profile,
        projection: {
          schemaVersion: 1,
          revision: 2,
          settings: { defaultEpisodeCharacters: 3_500 },
          updatedAt: "2026-08-10T01:00:00.000Z",
        },
        musicProfile,
        musicProjection: {
          schemaVersion: 1,
          workId: entityId<"Work">("work-a"),
          revision: 1,
          settings: musicProfile.workDefaults,
          updatedAt: "2026-08-13T00:00:00.000Z",
        },
        sceneAnalysisProjection: {
          schemaVersion: 1,
          workId: entityId<"Work">("work-a"),
          revision: 1,
          settings: { enabled: true },
          updatedAt: "2026-08-29T00:00:00.000Z",
        },
        youtubeConnectionStatus: {
          schemaVersion: 1,
          revision: 2,
          apiKeyConfigured: true,
          updatedAt: "2026-08-13T00:00:00.000Z",
        },
        chatGptOAuthStatus: {
          schemaVersion: 1,
          revision: 1,
          providerId: "runtime-chatgpt",
          displayName: "GPT",
          modelId: "runtime-model",
          connected: true,
          email: "writer@example.com",
          planType: "plus",
          updatedAt: "2026-08-13T00:00:00.000Z",
        },
        chatGptOAuthLoginState: "idle",
        actionState: "idle",
        error: null,
        onClose: () => undefined,
        onSave: () => undefined,
        onRemoveYouTubeApiKey: () => undefined,
        onStartChatGptOAuthLogin: () => undefined,
      }),
    );

    expect(markup).toContain("1회 기준 글자수");
    expect(markup).toContain('value="3500"');
    expect(markup).toContain("YouTube Data API 키");
    expect(markup).toContain("YouTube 음악 연결");
    expect(markup).toContain("내장 YouTube 플레이어에서 재생");
    expect(markup).not.toContain("Spotify");
    expect(markup).toContain("GPT 로그인");
    expect(markup).toContain("writer@example.com");
    expect(markup).toContain("다시 로그인");
    expect(markup).toContain('type="password"');
    expect(markup).toContain("회차 전환 시 자동 선곡");
    expect(markup).toContain("장면 전환 시 자동 선곡");
    expect(markup).toContain("뽀모도로 시작 시 자동 재생");
    expect(markup).toContain("정밀 선곡");
    expect(markup).toContain("처음부터 재생");
    expect(markup).toContain("매번 묻기");
    expect(markup).toContain("장면 전환·분할·회차 전환 시 요약과 작품 정보·연속성 후보 생성");
    expect(markup).toContain("후보 검토함에서 승인하기 전까지 별빛에 적용하지 않습니다");
    expect(markup).not.toContain("백업");
  });

  it("accepts only the runtime profile range", () => {
    expect(parseDefaultEpisodeCharactersInput("3210", profile)).toBe(3_210);
    expect(() => parseDefaultEpisodeCharactersInput("99", profile)).toThrow(
      "100자부터",
    );
    expect(() => parseDefaultEpisodeCharactersInput("3.5", profile)).toThrow(
      "정수",
    );
  });
});
