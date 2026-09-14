import {
  ArrowDown,
  ArrowUp,
  Film,
  Heart,
  Link2,
  ListMusic,
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
  type LocalMediaAvailabilityStatus,
  type LocalMediaTrackProjection,
  type MusicTrackProjection,
} from "../../application/music/media-track";
import type { YouTubeVideoProjection } from "../../application/music/youtube-music";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

type MusicLibraryTab = "queue" | "local" | "search" | "favorites";

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

function availabilityLabel(
  track: LocalMediaTrackProjection,
  status: LocalMediaAvailabilityStatus | undefined,
): string {
  if (status === undefined) return "연결 확인 중";
  if (status === "available") {
    return track.storageMode === "managed-copy" ? "백업 포함" : "연결됨";
  }
  if (status === "disconnected") return "연결 끊김";
  if (status === "changed") return "파일 변경됨";
  return "checksum 확인 필요";
}

export function MusicLibraryDialog(input: {
  readonly connected: boolean;
  readonly error: string | null;
  readonly favorites: readonly MusicTrackProjection[];
  readonly localMedia: readonly LocalMediaTrackProjection[];
  readonly localMediaAvailability: Readonly<
    Record<string, LocalMediaAvailabilityStatus>
  >;
  readonly onAddToQueue: (track: MusicTrackProjection) => void;
  readonly onAddTracksToQueue?: (tracks: readonly MusicTrackProjection[]) => void;
  readonly onClearQueue: () => void;
  readonly onClose: () => void;
  readonly onMoveQueueTrack: (index: number, direction: -1 | 1) => void;
  readonly onOpenConnectionSettings: () => void;
  readonly onPlayQueue: () => void;
  readonly onPlayQueueTrack: (index: number) => void;
  readonly onPlayTrack: (track: MusicTrackProjection, sourceTracks?: readonly MusicTrackProjection[]) => void;
  readonly onRegisterLocalMedia: (mode: LocalMediaStorageMode) => void;
  readonly onRelinkLocalMedia: (track: LocalMediaTrackProjection) => void;
  readonly onRemoveLocalMedia: (track: LocalMediaTrackProjection) => void;
  readonly onRemoveFromQueue: (track: MusicTrackProjection) => void;
  readonly onSearch: (query: string) => void;
  readonly onToggleFavorite: (track: MusicTrackProjection) => void;
  readonly queue: readonly MusicTrackProjection[];
  readonly queueSaving: boolean;
  readonly registeringMode: LocalMediaStorageMode | null;
  readonly removingMediaId: string | null;
  readonly relinkingMediaId: string | null;
  readonly results: readonly YouTubeVideoProjection[];
  readonly searching: boolean;
}) {
  const [activeTab, setActiveTab] = useState<MusicLibraryTab>(() =>
    input.localMedia.some((track) => {
      const status = input.localMediaAvailability[track.mediaId];
      return status === "disconnected" || status === "changed";
    })
      ? "local"
      : "queue"
  );
  const [query, setQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<ReadonlySet<string>>(() => new Set());
  const available = (track: MusicTrackProjection) => !isLocalMediaTrack(track) ||
    !["disconnected", "changed"].includes(input.localMediaAvailability[track.mediaId] ?? "");
  const selectableMedia = input.localMedia.filter(available);
  const selectedTracks = selectableMedia.filter((track) => selectedMedia.has(musicTrackIdentity(track)));
  const allSelected = selectableMedia.length > 0 && selectedTracks.length === selectableMedia.length;
  const favoriteIds = new Set(input.favorites.map(musicTrackIdentity));
  const queueIds = new Set(input.queue.map(musicTrackIdentity));
  const busy = input.searching || input.queueSaving ||
    input.registeringMode !== null || input.removingMediaId !== null ||
    input.relinkingMediaId !== null;
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
    queueIndex?: number,
  ) => {
    const identity = musicTrackIdentity(track);
    const favorite = favoriteIds.has(identity);
    const queued = queueIds.has(identity);
    const availability = isLocalMediaTrack(track)
      ? input.localMediaAvailability[track.mediaId]
      : undefined;
    const unavailable = isLocalMediaTrack(track) &&
      (availability === "disconnected" || availability === "changed");
    const canRelink = isLocalMediaTrack(track) &&
      track.storageMode === "external-reference" &&
      (
        availability === "disconnected" ||
        availability === "changed" ||
        availability === "unverified"
      );
    const favoriteAction = isLocalMediaTrack(track)
      ? favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"
      : favorite ? "선호 영상 해제" : "선호 영상 저장";
    return (
      <li key={`${mode}:${identity}`} className={mode === "local" ? "music-library-selectable-track" : undefined}>
        {mode === "local" && input.onAddTracksToQueue !== undefined && (
          <input type="checkbox" aria-label={`${track.title} 선택`} checked={selectedMedia.has(identity)}
            disabled={busy || unavailable} onChange={(event) => {
              const checked = event.currentTarget.checked;
              setSelectedMedia((current) => {
                const next = new Set(current);
                if (checked) next.add(identity); else next.delete(identity);
                return next;
              });
            }} />
        )}
        {!isLocalMediaTrack(track) && track.thumbnailUrl !== null
          ? <img alt="" src={track.thumbnailUrl} />
          : (
            <span className="music-library-media-icon" aria-hidden="true">
              {isLocalMediaTrack(track) && track.mediaKind === "video"
                ? <Film size={17} />
                : <Music2 size={17} />}
            </span>
          )}
        <span className="music-library-track-copy">
          <strong>{track.title}</strong>
          <small>
            {trackSubtitle(track)}
            {isLocalMediaTrack(track) &&
              ` · ${availabilityLabel(track, availability)}`}
          </small>
        </span>
        <div className="music-library-track-actions">
          <button
            aria-label={`${track.title} 바로 재생`}
            disabled={unavailable}
            onClick={() => {
              if (mode === "queue" && queueIndex !== undefined) {
                input.onPlayQueueTrack(queueIndex);
              } else {
                const sourceTracks = mode === "local" ? input.localMedia : mode === "favorite" ? input.favorites : input.results;
                input.onPlayTrack(track, sourceTracks.filter(available));
              }
            }}
            title="재생"
            type="button"
          >
            <Play aria-hidden="true" size={13} />
          </button>
          {mode !== "queue" && (
            <button
              aria-label={`${track.title} 재생목록에 추가`}
              disabled={busy || queued || unavailable}
              onClick={() => input.onAddToQueue(track)}
              title={queued ? "재생목록에 있음" : "재생목록에 추가"}
              type="button"
            >
              <ListPlus aria-hidden="true" size={13} />
            </button>
          )}
          {mode === "queue" && queueIndex !== undefined && (
            <>
              <button
                aria-label={`${track.title} 위로 이동`}
                disabled={busy || queueIndex === 0}
                onClick={() => input.onMoveQueueTrack(queueIndex, -1)}
                title="위로"
                type="button"
              >
                <ArrowUp aria-hidden="true" size={13} />
              </button>
              <button
                aria-label={`${track.title} 아래로 이동`}
                disabled={busy || queueIndex === input.queue.length - 1}
                onClick={() => input.onMoveQueueTrack(queueIndex, 1)}
                title="아래로"
                type="button"
              >
                <ArrowDown aria-hidden="true" size={13} />
              </button>
              <button
                aria-label={`${track.title} 재생목록에서 제거`}
                disabled={busy}
                onClick={() => input.onRemoveFromQueue(track)}
                title="제거"
                type="button"
              >
                <Trash2 aria-hidden="true" size={13} />
              </button>
            </>
          )}
          {mode === "local" && isLocalMediaTrack(track) && (
            <>
              {canRelink && (
                  <button
                    aria-label={`${track.title} 다시 연결`}
                    disabled={busy}
                    onClick={() => input.onRelinkLocalMedia(track)}
                    title="다시 연결"
                    type="button"
                  >
                    <Link2 aria-hidden="true" size={13} />
                  </button>
                )}
              <button
                aria-label={`${track.title} 등록 삭제`}
                disabled={busy}
                onClick={() => input.onRemoveLocalMedia(track)}
                title="등록 삭제"
                type="button"
              >
                <Trash2 aria-hidden="true" size={13} />
              </button>
            </>
          )}
          {mode !== "queue" && (
            <button
              aria-label={`${track.title} ${favoriteAction}`}
              aria-pressed={favorite}
              disabled={busy}
              onClick={() => input.onToggleFavorite(track)}
              title={favoriteAction}
              type="button"
            >
              <Heart
                aria-hidden="true"
                fill={favorite ? "currentColor" : "none"}
                size={13}
              />
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
            <ListMusic aria-hidden="true" size={16} />
            <strong>재생목록</strong>
            <span>{input.queue.length}</span>
          </div>
          <button aria-label="음악 창 닫기" onClick={input.onClose} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <nav aria-label="미디어 보기" className="music-library-tabs" role="tablist">
          <button
            aria-label="재생목록 탭"
            aria-selected={activeTab === "queue"}
            onClick={() => setActiveTab("queue")}
            role="tab"
            title="재생목록"
            type="button"
          >
            <ListMusic aria-hidden="true" size={15} />
            <span>{input.queue.length}</span>
          </button>
          <button
            aria-label="내 미디어 탭"
            aria-selected={activeTab === "local"}
            onClick={() => setActiveTab("local")}
            role="tab"
            title="내 미디어"
            type="button"
          >
            <Music2 aria-hidden="true" size={15} />
            <span>{input.localMedia.length}</span>
          </button>
          <button
            aria-label="YouTube 검색 탭"
            aria-selected={activeTab === "search"}
            onClick={() => setActiveTab("search")}
            role="tab"
            title="YouTube 검색"
            type="button"
          >
            <Search aria-hidden="true" size={15} />
            <span>{input.results.length}</span>
          </button>
          <button
            aria-label="즐겨찾기 탭"
            aria-selected={activeTab === "favorites"}
            onClick={() => setActiveTab("favorites")}
            role="tab"
            title="즐겨찾기"
            type="button"
          >
            <Heart aria-hidden="true" size={15} />
            <span>{input.favorites.length}</span>
          </button>
        </nav>

        <div className="music-library-register">
          <button
            aria-label="원본 위치 연결"
            disabled={busy}
            onClick={() => input.onRegisterLocalMedia("external-reference")}
            title="파일을 원래 위치에서 재생"
            type="button"
          >
            <Link2 aria-hidden="true" size={13} />
            {input.registeringMode === "external-reference"
              ? "연결 중…"
              : "원본 위치 연결"}
          </button>
          <button
            aria-label="앱에 가져오기"
            disabled={busy}
            onClick={() => input.onRegisterLocalMedia("managed-copy")}
            title="파일을 앱 저장소에 복사"
            type="button"
          >
            <Upload aria-hidden="true" size={13} />
            {input.registeringMode === "managed-copy"
              ? "가져오는 중…"
              : "앱에 가져오기"}
          </button>
        </div>

        {activeTab === "search" && !input.connected && (
          <div className="music-library-connection" role="status">
            <span>YouTube 검색 연결이 필요합니다.</span>
            <button onClick={input.onOpenConnectionSettings} type="button">
              연결
            </button>
          </div>
        )}

        {activeTab === "search" && (
          <form className="music-library-search" onSubmit={submit}>
            <label>
              <span className="visually-hidden">음악 검색어</span>
              <input
                aria-label="음악 검색어"
                disabled={!input.connected || busy}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="YouTube에서 검색"
                value={query}
              />
            </label>
            <button
              aria-label="검색"
              disabled={!input.connected || busy || query.trim().length === 0}
              title="검색"
              type="submit"
            >
              <Search aria-hidden="true" size={14} />
            </button>
          </form>
        )}

        {input.error !== null && (
          <p className="music-library-error" role="alert">{input.error}</p>
        )}

        <div className="music-library-content">
          {activeTab === "queue" && (
            <section aria-label="재생목록" className="music-library-queue">
              <header>
                <h3>재생목록</h3>
                <span>{input.queue.length}</span>
                <small aria-live="polite">
                  {input.queueSaving ? "저장 중…" : "저장됨"}
                </small>
                <button
                  aria-label="전체 재생"
                  disabled={input.queue.length === 0}
                  onClick={input.onPlayQueue}
                  title="전체 재생"
                  type="button"
                >
                  <Play aria-hidden="true" size={13} />
                </button>
                <button
                  aria-label="재생목록 비우기"
                  disabled={busy || input.queue.length === 0}
                  onClick={input.onClearQueue}
                  title="재생목록 비우기"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={13} />
                </button>
              </header>
              {input.queue.length === 0
                ? <p>내 미디어나 검색 결과에서 곡을 추가하세요.</p>
                : <ol className="music-library-scroll-list">{
                    input.queue.map((track, index) =>
                      renderTrack(track, "queue", index)
                    )
                  }</ol>}
            </section>
          )}

          {activeTab === "local" && (
            <section aria-label="내 미디어" className="music-library-local">
              <header><h3>내 미디어</h3><span>{input.localMedia.length}</span></header>
              {input.localMedia.length > 0 && input.onAddTracksToQueue !== undefined && (
                <div className="music-library-selection">
                  <label><input type="checkbox" aria-label="내 미디어 전체 선택" checked={allSelected}
                    ref={(element) => { if (element !== null) element.indeterminate = selectedTracks.length > 0 && !allSelected; }}
                    disabled={busy || selectableMedia.length === 0}
                    onChange={(event) => setSelectedMedia(event.currentTarget.checked
                      ? new Set(selectableMedia.map(musicTrackIdentity)) : new Set())} />전체 선택</label>
                  <span>{selectedTracks.length}곡 선택</span>
                  <button type="button" disabled={busy || !selectedTracks.some((track) => !queueIds.has(musicTrackIdentity(track)))}
                    onClick={() => input.onAddTracksToQueue?.(selectedTracks)}>선택 곡 재생목록에 추가</button>
                </div>
              )}
              {input.localMedia.length === 0
                ? <p>등록한 MP3·MP4 파일이 여기에 표시됩니다.</p>
                : <ul className="music-library-scroll-list">{
                    input.localMedia.map((track) => renderTrack(track, "local"))
                  }</ul>}
            </section>
          )}

          {activeTab === "search" && (
            <section aria-label="검색 결과" className="music-library-results">
              <header><h3>YouTube 검색</h3><span>{input.results.length}</span></header>
              {input.results.length === 0
                ? <p>검색하면 재생 가능한 영상이 여기에 표시됩니다.</p>
                : <ul className="music-library-scroll-list">{
                    input.results.map((track) => renderTrack(track, "result"))
                  }</ul>}
            </section>
          )}

          {activeTab === "favorites" && (
            <section aria-label="즐겨찾기" className="music-library-favorites">
              <header><h3>즐겨찾기</h3><span>{input.favorites.length}</span></header>
              {input.favorites.length === 0
                ? <p>저장한 미디어가 여기에 남습니다.</p>
                : <ul className="music-library-scroll-list">{
                    input.favorites.map((track) => renderTrack(track, "favorite"))
                  }</ul>}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
