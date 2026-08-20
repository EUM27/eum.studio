import { useState, type FormEvent } from "react";
import { Settings, X } from "lucide-react";

import type {
  AppSettingsProfile,
  AppSettingsProjection,
} from "../../application/settings/app-settings";
import type {
  MusicSettingsProfile,
  WorkMusicSettings,
  WorkMusicSettingsProjection,
} from "../../application/music/work-music-settings";
import type { YouTubeMusicConnectionStatus } from "../../application/music/youtube-music-connection";
import type { ChatGptOAuthConnectionStatus } from "../../application/assistant/chatgpt-oauth";

export type AppSettingsSaveValue = {
  readonly defaultEpisodeCharacters: number;
  readonly workMusicSettings: WorkMusicSettings | null;
  readonly youtubeApiKey: string | null;
};

export function parseDefaultEpisodeCharactersInput(
  value: string,
  profile: AppSettingsProfile,
): number {
  if (!/^\d+$/u.test(value)) {
    throw new Error("1회 기준 글자수는 정수로 입력하세요.");
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < profile.defaultEpisodeCharacters.minValue ||
    parsed > profile.defaultEpisodeCharacters.maxValue
  ) {
    throw new Error(
      `1회 기준 글자수는 ${profile.defaultEpisodeCharacters.minValue.toLocaleString()}자부터 ${profile.defaultEpisodeCharacters.maxValue.toLocaleString()}자까지 입력할 수 있습니다.`,
    );
  }
  return parsed;
}

export function AppSettingsDialog({
  profile,
  projection,
  musicProfile,
  musicProjection,
  youtubeConnectionStatus,
  chatGptOAuthStatus,
  chatGptOAuthLoginState,
  actionState,
  error,
  onClose,
  onSave,
  onRemoveYouTubeApiKey,
  onStartChatGptOAuthLogin,
}: {
  readonly profile: AppSettingsProfile | null;
  readonly projection: AppSettingsProjection | null;
  readonly musicProfile: MusicSettingsProfile | null;
  readonly musicProjection: WorkMusicSettingsProjection | null;
  readonly youtubeConnectionStatus: YouTubeMusicConnectionStatus | null;
  readonly chatGptOAuthStatus: ChatGptOAuthConnectionStatus | null;
  readonly chatGptOAuthLoginState: "idle" | "waiting";
  readonly actionState: "loading" | "idle" | "saving";
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSave: (value: AppSettingsSaveValue) => void;
  readonly onRemoveYouTubeApiKey: () => void;
  readonly onStartChatGptOAuthLogin: () => void;
}) {
  const [value, setValue] = useState(
    projection === null
      ? ""
      : String(projection.settings.defaultEpisodeCharacters),
  );
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [workMusicSettings, setWorkMusicSettings] = useState<WorkMusicSettings | null>(
    musicProjection?.settings ?? null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const busy = actionState !== "idle";

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (profile === null || projection === null) return;
    try {
      const parsed = parseDefaultEpisodeCharactersInput(value, profile);
      setValidationError(null);
      onSave({
        defaultEpisodeCharacters: parsed,
        workMusicSettings,
        youtubeApiKey: youtubeApiKey.trim().length === 0
          ? null
          : youtubeApiKey.trim(),
      });
    } catch (reason) {
      setValidationError(
        reason instanceof Error ? reason.message : "설정값을 확인하세요.",
      );
    }
  }

  return (
    <aside
      aria-labelledby="app-settings-title"
      className="app-settings-dialog"
      role="dialog"
    >
        <header>
          <div>
            <span className="app-settings-icon" aria-hidden="true">
              <Settings size={17} />
            </span>
            <div>
              <p className="panel-kicker">APP SETTINGS</p>
              <h2 id="app-settings-title">앱 설정</h2>
            </div>
          </div>
          <button
            aria-label="앱 설정 닫기"
            disabled={actionState === "saving"}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>

        {profile === null || projection === null ? (
          <p className="app-settings-loading">
            {error ?? "설정을 불러오는 중입니다."}
          </p>
        ) : (
          <form onSubmit={submit}>
            <div className="app-settings-scroll">
              <div className="app-settings-section">
              <h3>원고 통계</h3>
              <label>
                <span>1회 기준 글자수</span>
                <input
                  aria-describedby="episode-character-help"
                  disabled={busy}
                  inputMode="numeric"
                  max={profile.defaultEpisodeCharacters.maxValue}
                  min={profile.defaultEpisodeCharacters.minValue}
                  onChange={(event) => setValue(event.target.value)}
                  step={1}
                  type="number"
                  value={value}
                />
              </label>
              <p id="episode-character-help">
                D-DAY의 회차 진척을 계산할 때 각 회차를 완료로 보는 글자 수입니다.
                원고 내용이나 회차 순서는 바꾸지 않습니다.
              </p>
              </div>

              <div className="app-settings-section">
              <h3>GPT 로그인</h3>
              <div className="app-settings-inline-status">
                <span>
                  {chatGptOAuthStatus?.connected
                    ? (chatGptOAuthStatus.email ?? "ChatGPT 계정 연결됨")
                    : "로그인되지 않음"}
                </span>
                <button
                  disabled={busy || chatGptOAuthLoginState === "waiting"}
                  onClick={onStartChatGptOAuthLogin}
                  type="button"
                >
                  {chatGptOAuthLoginState === "waiting"
                    ? "로그인 대기 중…"
                    : chatGptOAuthStatus?.connected
                      ? "다시 로그인"
                      : "GPT로 로그인"}
                </button>
              </div>
              <p>ChatGPT 계정으로 연결합니다. API 키를 입력하지 않습니다.</p>
              </div>

              <div className="app-settings-section">
              <h3>YouTube 음악 연결</h3>
              <label>
                <span>YouTube Data API 키</span>
                <input
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => setYoutubeApiKey(event.target.value)}
                  placeholder={youtubeConnectionStatus?.apiKeyConfigured
                    ? "연결됨 · 변경할 때만 새 키 입력"
                    : "API 키 입력"}
                  type="password"
                  value={youtubeApiKey}
                />
              </label>
              <div className="app-settings-inline-status">
                <span>
                  {youtubeConnectionStatus?.apiKeyConfigured
                    ? "API 키가 암호화 저장되어 있습니다."
                    : "저장된 API 키가 없습니다."}
                </span>
                {youtubeConnectionStatus?.apiKeyConfigured && (
                  <button
                    disabled={busy}
                    onClick={onRemoveYouTubeApiKey}
                    type="button"
                  >
                    연결 해제
                  </button>
                )}
              </div>
              <p>저장된 API 키로 음악을 검색하고 내장 YouTube 플레이어에서 재생합니다.</p>
              </div>

              {musicProfile !== null && workMusicSettings !== null && (
                <div className="app-settings-section app-settings-work-section">
                <h3>현재 작품 음악</h3>
                <div className="app-settings-check-grid">
                  {([
                    ["autoOnEpisodeTransition", "회차 전환 시 자동 선곡"],
                    ["autoOnSceneTransition", "장면 전환 시 자동 선곡"],
                    ["autoPlayOnPomodoroStart", "뽀모도로 시작 시 자동 재생"],
                    ["preciseSelection", "정밀 선곡"],
                  ] as const).map(([field, label]) => (
                    <label key={field}>
                      <input
                        checked={workMusicSettings[field]}
                        disabled={busy}
                        onChange={(event) => setWorkMusicSettings({
                          ...workMusicSettings,
                          [field]: event.target.checked,
                        })}
                        type="checkbox"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <fieldset>
                  <legend>전환 재생 위치</legend>
                  {musicProfile.transitionPlaybackModes.map((mode) => (
                    <label key={mode}>
                      <input
                        checked={workMusicSettings.transitionPlaybackMode === mode}
                        disabled={busy}
                        name="transition-playback-mode"
                        onChange={() => setWorkMusicSettings({
                          ...workMusicSettings,
                          transitionPlaybackMode: mode,
                        })}
                        type="radio"
                        value={mode}
                      />
                      <span>{mode === "restart" ? "처음부터 재생" : "매번 묻기"}</span>
                    </label>
                  ))}
                </fieldset>
                </div>
              )}
              {(validationError ?? error) !== null && (
                <p className="dialog-error" role="alert">
                  {validationError ?? error}
                </p>
              )}
            </div>
            <footer>
              <span>
                허용 범위 {profile.defaultEpisodeCharacters.minValue.toLocaleString()}
                –{profile.defaultEpisodeCharacters.maxValue.toLocaleString()}자
              </span>
              <button disabled={busy} onClick={onClose} type="button">
                취소
              </button>
              <button className="primary-button" disabled={busy} type="submit">
                {actionState === "saving" ? "저장 중…" : "저장"}
              </button>
            </footer>
          </form>
        )}
    </aside>
  );
}
