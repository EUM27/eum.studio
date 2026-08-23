import {
  Film,
  Heart,
  Link2,
  ListPlus,
  Music2,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  isLocalMediaTrack,
  musicTrackIdentity,
  type LocalMediaStorageMode,
  type LocalMediaTrackProjection,
  type MusicTrackProjection,
} from "../../application/music/media-track";
import type { YouTubeVideoProjection } from "../../application/music/youtube-music";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

function storageModeLabel(mode: LocalMediaStorageMode): string {
  return mode === "external-reference" ? "원본 위치 연결" : "앱에 가져오기";
}

function byteSize(value: number): string {
  if (value < 1024) return `${value.toLocaleString()} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function trackSubtitle(track: MusicTrackProjection): string {
  if (!isLocalMediaTrack(track)) return track.channel;
  return [
    track.fileName,
    storageModeLabel(track.storageMode),
    byteSize(track.byteLength),
  ].join(" · ");
}

export function MusicLibraryDialog(input: {
  readonly connected: boolean;
  readonly error: string | null;
  readonly favorites: readonly MusicTrackProjection[];
  readonly localMedia: readonly LocalMediaTrackProjection[];
  readonly onAddToQueue: (track: MusicTrackProjection) => void;
  readonly onClose: () => void;
  readonly onOpenConnectionSettings: () => void;
  readonly onPlayQueue: () => void;
  readonly onPlayTrack: (track: MusicTrackProjection) => void;
  readonly onRegisterLocalMedia: (mode: LocalMediaStorageMode) => void;
  readonly onRemoveFromQueue: (track: MusicTrackProjection) => void;
  readonly onSearch: (query: string) => void;
  readonly onToggleFavorite: (track: MusicTrackProjection) => void;
  readonly queue: readonly MusicTrackProjection[];
  readonly queueSaving: boolean;
  readonly registeringMode: LocalMediaStorageMode | null;
  readonly results: readonly YouTubeVideoProjection[];
  readonly searching: boolean;
}) {
  const [query, setQuery] = useState("");
  const [registrationMode, setRegistrationMode] =
    useState<LocalMediaStorageMode>("external-reference");
  const favoriteIds = new Set(input.favorites.map(musicTrackIdentity));
  const queueIds = new Set(input.queue.map(musicTrackIdentity));
  const busy = input.searching || input.queueSaving || input.registeringMode !== null;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: busy,
    onClose: input.onClose,
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length > 0) input.onSearch(normalized);
  }

  const renderTrack = (
    track: MusicTrackProjection,
    mode: "result" | "favorite" | "queue" | "local",
  ) => {
    const identity = musicTrackIdentity(track);
    const favorite = favoriteIds.has(identity);
    const queued = queueIds.has(identity);
    const favoriteAction = isLocalMediaTrack(track)
      ? favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"
      : favorite ? "선호 영상 해제" : "선호 영상 저장";
    return (
      <li key={`${mode}:${identity}`}>
        {!isLocalMediaTrack(track) && track.thumbnailUrl !== null
          ? <img alt="" src={track.thumbnailUrl} />
          : (
            <span className="music-library-media-icon" aria-hidden="true">
              {isLocalMediaTrack(track) && track.mediaKind === "video"
                ? <Film size={20} />
                : <Music2 size={20} />}
            </span>
          )}
        <span>
          <strong>{track.title}</strong>
          <small>{trackSubtitle(track)}</small>
        </span>
        <div>
          <button
            aria-label={`${track.title} 바로 재생`}
            onClick={() => input.onPlayTrack(track)}
            type="button"
          >
            <Play aria-hidden="true" size={14} />
            재생
          </button>
          {mode !== "queue" && (
            <button
              aria-label={`${track.title} 재생목록에 추가`}
              disabled={busy || queued}
              onClick={() => input.onAddToQueue(track)}
              type="button"
            >
              <ListPlus aria-hidden="true" size={14} />
              {queued ? "추가됨" : "목록 추가"}
            </button>
          )}
          {mode === "queue" && (
            <button
              aria-label={`${track.title} 재생목록에서 제거`}
              disabled={busy}
              onClick={() => input.onRemoveFromQueue(track)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
              제거
            </button>
          )}
          {mode !== "queue" && (
            <button
              aria-label={`${track.title} ${favoriteAction}`}
              aria-pressed={favorite}
              disabled={busy}
              onClick={() => input.onToggleFavorite(track)}
              type="button"
            >
              <Heart
                aria-hidden="true"
                fill={favorite ? "currentColor" : "none"}
                size={14}
              />
              {favorite ? "저장됨" : "즐겨찾기"}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div
      className="dialog-backdrop music-library-backdrop"
      onPointerDown={onBackdropPointerDown}
    >
      <section
        aria-label="음악 선곡과 재생목록"
        className="music-library-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span>MEDIA PLAYER</span>
            <h2>미디어 라이브러리</h2>
          </div>
          <button aria-label="음악 창 닫기" onClick={input.onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="music-library-register">
          <div>
            <strong>내 파일 등록</strong>
            <small>여러 MP3·MP4 파일을 한 번에 선택할 수 있습니다.</small>
          </div>
          <fieldset aria-label="미디어 등록 방식">
            <label>
              <input
                aria-label="원본 위치 연결"
                checked={registrationMode === "external-reference"}
                disabled={busy}
                name="local-media-storage-mode"
                onChange={() => setRegistrationMode("external-reference")}
                type="radio"
              />
              <Link2 aria-hidden="true" size={13} />
              원본 위치 연결
            </label>
            <label>
              <input
                aria-label="앱에 가져오기"
                checked={registrationMode === "managed-copy"}
                disabled={busy}
                name="local-media-storage-mode"
                onChange={() => setRegistrationMode("managed-copy")}
                type="radio"
              />
              <Upload aria-hidden="true" size={13} />
              앱에 가져오기
            </label>
          </fieldset>
          <button
            disabled={busy}
            onClick={() => input.onRegisterLocalMedia(registrationMode)}
            type="button"
          >
            <Music2 aria-hidden="true" size={15} />
            {input.registeringMode === null ? "미디어 파일 등록" : "등록 중…"}
          </button>
        </div>

        {!input.connected && (
          <div className="music-library-connection" role="status">
            <span>YouTube 검색에는 Data API 연결이 필요합니다.</span>
            <button onClick={input.onOpenConnectionSettings} type="button">
              연결 설정
            </button>
          </div>
        )}

        <form className="music-library-search" onSubmit={submit}>
          <label>
            <span className="visually-hidden">음악 검색어</span>
            <input
              aria-label="음악 검색어"
              disabled={!input.connected || busy}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="YouTube에서 곡, 분위기, OST 검색"
              value={query}
            />
          </label>
          <button
            disabled={!input.connected || busy || query.trim().length === 0}
            type="submit"
          >
            <Search aria-hidden="true" size={15} />
            {input.searching ? "검색 중" : "검색"}
          </button>
        </form>
        {input.error !== null && (
          <p className="music-library-error" role="alert">{input.error}</p>
        )}

        <div className="music-library-columns">
          <section aria-label="내 미디어" className="music-library-local">
            <header><h3>내 미디어</h3><span>{input.localMedia.length}</span></header>
            {input.localMedia.length === 0
              ? <p>등록한 MP3·MP4 파일이 여기에 표시됩니다.</p>
              : <ul className="music-library-scroll-list">{
                  input.localMedia.map((track) => renderTrack(track, "local"))
                }</ul>}
          </section>
          <section aria-label="재생목록" className="music-library-queue">
            <header>
              <h3>재생목록</h3>
              <span>{input.queue.length}</span>
              <small aria-live="polite">
                {input.queueSaving ? "저장 중…" : "작품에 저장됨"}
              </small>
              <button
                disabled={input.queue.length === 0}
                onClick={input.onPlayQueue}
                type="button"
              >
                <Play aria-hidden="true" size={14} />
                전체 재생
              </button>
            </header>
            {input.queue.length === 0
              ? <p>내 미디어나 검색 결과에서 곡을 추가하세요.</p>
              : <ol className="music-library-scroll-list">{
                  input.queue.map((track) => renderTrack(track, "queue"))
                }</ol>}
          </section>
          <section aria-label="검색 결과" className="music-library-results">
            <header><h3>YouTube 검색</h3><span>{input.results.length}</span></header>
            {input.results.length === 0
              ? <p>검색하면 재생 가능한 영상이 여기에 표시됩니다.</p>
              : <ul className="music-library-scroll-list">{
                  input.results.map((track) => renderTrack(track, "result"))
                }</ul>}
          </section>
          <section aria-label="즐겨찾기" className="music-library-favorites">
            <header><h3>즐겨찾기</h3><span>{input.favorites.length}</span></header>
            {input.favorites.length === 0
              ? <p>저장한 미디어가 여기에 남습니다.</p>
              : <ul className="music-library-scroll-list">{
                  input.favorites.map((track) => renderTrack(track, "favorite"))
                }</ul>}
          </section>
        </div>
      </section>
    </div>
  );
}
