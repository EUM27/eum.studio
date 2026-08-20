import { useId, useState } from "react";

import {
  selectedSceneMusicQueueOption,
  type SceneMusicQueueCandidate,
  type SceneMusicQueueOption,
} from "../../application/music/scene-music-queue-contract";
import type {
  SceneAnnotationProjection,
} from "../../application/structure/scene-annotation-contract";
import type { YouTubeVideoProjection } from "../../application/music/youtube-music";

function sceneSearchQuery(annotation: SceneAnnotationProjection): string {
  return [
    annotation.title,
    annotation.location,
    annotation.time,
    annotation.goal,
    annotation.conflict,
    annotation.outcome,
  ].filter((value) => value.trim().length > 0).join(" ");
}

function candidateStatus(candidate: SceneMusicQueueCandidate): string {
  if (candidate.integrity === "stale") return "장면 변경으로 만료됨";
  if (candidate.status === "selected") return "저장된 재생목록";
  return "선택 대기";
}

export function SceneMusicQueuePanel(input: {
  readonly annotation: SceneAnnotationProjection;
  readonly candidates: readonly SceneMusicQueueCandidate[];
  readonly connected: boolean;
  readonly playbackAvailable: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly favoriteVideoIds: readonly string[];
  readonly onOpenSettings: () => void;
  readonly onSearch: (
    annotation: SceneAnnotationProjection,
    query: string,
  ) => void;
  readonly onSelect: (
    candidate: SceneMusicQueueCandidate,
    option: SceneMusicQueueOption,
  ) => void;
  readonly onPlay: (candidate: SceneMusicQueueCandidate) => void;
  readonly onToggleFavorite: (video: YouTubeVideoProjection) => void;
}) {
  const queryId = useId();
  const queryKey =
    `${input.annotation.sceneAnnotationId}:${input.annotation.revision}`;
  const [queryState, setQueryState] = useState(() => ({
    key: queryKey,
    value: sceneSearchQuery(input.annotation),
  }));
  const query = queryState.key === queryKey
    ? queryState.value
    : sceneSearchQuery(input.annotation);
  const candidates = input.candidates.filter((candidate) =>
    candidate.sceneKey === input.annotation.sceneKey &&
    candidate.status !== "superseded"
  );
  const selectedCandidate = candidates.find((candidate) =>
    selectedSceneMusicQueueOption(candidate) !== null
  );
  const selectedOption = selectedCandidate === undefined
    ? null
    : selectedSceneMusicQueueOption(selectedCandidate);

  return (
    <section
      className="scene-music-queue"
      data-scene-music-queue={input.annotation.sceneKey}
    >
      <header>
        <div>
          <h5>장면 선곡·재생목록</h5>
          <small>곡을 찾고 이 장면에서 쓸 재생목록을 저장합니다.</small>
        </div>
        {selectedOption !== null && selectedCandidate !== undefined && (
          <button
            disabled={input.busy || !input.playbackAvailable}
            onClick={() => input.onPlay(selectedCandidate)}
            type="button"
          >
            재생목록 재생
          </button>
        )}
      </header>
      {!input.connected && (
        <p className="scene-music-connection-note">
          YouTube Data API 연결이 필요합니다.{" "}
          <button onClick={input.onOpenSettings} type="button">
            연결 설정
          </button>
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          input.onSearch(input.annotation, query);
        }}
      >
        <label htmlFor={queryId}>확인할 검색어</label>
        <input
          disabled={input.busy}
          id={queryId}
          onChange={(event) => {
            setQueryState({ key: queryKey, value: event.currentTarget.value });
          }}
          value={query}
        />
        <button
          disabled={input.busy || !input.connected || query.trim().length === 0}
          type="submit"
        >
          이 장면으로 음악 찾기
        </button>
      </form>
      {input.error !== null && (
        <p className="event-action-error" role="alert">{input.error}</p>
      )}
      {candidates.length > 0 && (
        <div className="scene-music-candidates">
          {candidates.map((candidate) => (
            <article
              data-scene-music-candidate={candidate.candidateId}
              key={candidate.candidateId}
            >
              <header>
                <strong>{candidate.query}</strong>
                <small>{candidateStatus(candidate)}</small>
              </header>
              {candidate.options.length === 0 ? (
                <p>검색된 트랙이 없습니다.</p>
              ) : (
                <ol>
                  {candidate.options.map((option, optionIndex) => {
                    const selected =
                      candidate.status === "selected" &&
                      candidate.selectedOptionId === option.optionId;
                    return (
                      <li
                        data-scene-music-option={option.optionId}
                        key={option.optionId}
                      >
                        <div>
                          <strong>{`큐 ${optionIndex + 1}`}</strong>
                          <ul>
                            {option.tracks.map((track) => (
                              <li key={track.videoId}>
                                <span>{track.title} · {track.channel}</span>
                                <button
                                  aria-label={`${
                                    input.favoriteVideoIds.includes(track.videoId)
                                      ? "선호 영상 해제"
                                      : "선호 영상 저장"
                                  }: ${track.title}`}
                                  disabled={input.busy}
                                  onClick={() => input.onToggleFavorite(track)}
                                  type="button"
                                >
                                  {input.favoriteVideoIds.includes(track.videoId)
                                    ? "선호 해제"
                                    : "선호 저장"}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          disabled={
                            input.busy ||
                            candidate.integrity !== "current" ||
                            selected
                          }
                          onClick={() => input.onSelect(candidate, option)}
                          type="button"
                        >
                          {selected ? "저장됨" : "이 재생목록 저장"}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
