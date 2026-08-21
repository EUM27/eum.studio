import { Heart, ListPlus, Play, Search, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { YouTubeVideoProjection } from "../../application/music/youtube-music";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

export function MusicLibraryDialog(input: {
  readonly connected: boolean;
  readonly error: string | null;
  readonly favorites: readonly YouTubeVideoProjection[];
  readonly onAddToQueue: (video: YouTubeVideoProjection) => void;
  readonly onClose: () => void;
  readonly onOpenConnectionSettings: () => void;
  readonly onPlayQueue: () => void;
  readonly onPlayVideo: (video: YouTubeVideoProjection) => void;
  readonly onRemoveFromQueue: (video: YouTubeVideoProjection) => void;
  readonly onSearch: (query: string) => void;
  readonly onToggleFavorite: (video: YouTubeVideoProjection) => void;
  readonly queue: readonly YouTubeVideoProjection[];
  readonly queueSaving: boolean;
  readonly results: readonly YouTubeVideoProjection[];
  readonly searching: boolean;
}) {
  const [query, setQuery] = useState("");
  const favoriteIds = new Set(input.favorites.map((video) => video.videoId));
  const queueIds = new Set(input.queue.map((video) => video.videoId));
  const onBackdropPointerDown = useDialogDismiss({
    disabled: input.searching || input.queueSaving,
    onClose: input.onClose,
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length > 0) input.onSearch(normalized);
  }

  const renderVideo = (
    video: YouTubeVideoProjection,
    mode: "result" | "favorite" | "queue",
  ) => (
    <li key={`${mode}:${video.videoId}`}>
      {video.thumbnailUrl !== null && <img alt="" src={video.thumbnailUrl} />}
      <span>
        <strong>{video.title}</strong>
        <small>{video.channel}</small>
      </span>
      <div>
        <button
          aria-label={`${video.title} 바로 재생`}
          onClick={() => input.onPlayVideo(video)}
          type="button"
        >
          <Play aria-hidden="true" size={14} />
          재생
        </button>
        {mode !== "queue" && (
          <button
            aria-label={`${video.title} 재생목록에 추가`}
            disabled={input.queueSaving || queueIds.has(video.videoId)}
            onClick={() => input.onAddToQueue(video)}
            type="button"
          >
            <ListPlus aria-hidden="true" size={14} />
            {queueIds.has(video.videoId) ? "추가됨" : "목록 추가"}
          </button>
        )}
        {mode === "queue" && (
          <button
            aria-label={`${video.title} 재생목록에서 제거`}
            disabled={input.queueSaving}
            onClick={() => input.onRemoveFromQueue(video)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={14} />
            제거
          </button>
        )}
        {mode !== "queue" && (
          <button
            aria-label={`${video.title} ${
              favoriteIds.has(video.videoId) ? "선호 영상 해제" : "선호 영상 저장"
            }`}
            aria-pressed={favoriteIds.has(video.videoId)}
            disabled={input.queueSaving}
            onClick={() => input.onToggleFavorite(video)}
            type="button"
          >
            <Heart
              aria-hidden="true"
              fill={favoriteIds.has(video.videoId) ? "currentColor" : "none"}
              size={14}
            />
            {favoriteIds.has(video.videoId) ? "저장됨" : "선호 저장"}
          </button>
        )}
      </div>
    </li>
  );

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
            <span>YOUTUBE MUSIC</span>
            <h2>음악 선곡</h2>
          </div>
          <button aria-label="음악 창 닫기" onClick={input.onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {!input.connected && (
          <div className="music-library-connection" role="status">
            <span>YouTube Data API 연결이 필요합니다.</span>
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
              disabled={!input.connected || input.searching}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="곡, 분위기, OST를 검색하세요"
              value={query}
            />
          </label>
          <button
            disabled={!input.connected || input.searching || query.trim().length === 0}
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
          <section aria-label="검색 결과" className="music-library-results">
            <header><h3>검색 결과</h3><span>{input.results.length}</span></header>
            {input.results.length === 0
              ? <p>검색하면 재생 가능한 영상이 여기에 표시됩니다.</p>
              : <ul className="music-library-scroll-list">{
                  input.results.map((video) => renderVideo(video, "result"))
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
              ? <p>검색 결과나 선호 영상에서 곡을 추가하세요.</p>
              : <ol className="music-library-scroll-list">{
                  input.queue.map((video) => renderVideo(video, "queue"))
                }</ol>}
          </section>
          <section aria-label="선호 영상" className="music-library-favorites">
            <header><h3>선호 영상</h3><span>{input.favorites.length}</span></header>
            {input.favorites.length === 0
              ? <p>저장한 선호 영상이 여기에 남습니다.</p>
              : <ul className="music-library-scroll-list">{
                  input.favorites.map((video) => renderVideo(video, "favorite"))
                }</ul>}
          </section>
        </div>
      </section>
    </div>
  );
}
