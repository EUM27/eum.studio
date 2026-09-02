import {
  useId,
  useState,
  type FormEvent,
  type SetStateAction,
} from "react";

import type {
  SceneBoundaryRule,
  SceneEventOverrideOperation,
  SceneProjection,
  SceneProjectionList,
  UpdateSceneRuleSetCommand,
} from "../../application/structure/scene-projection";
import type { SceneCanonContextProjection } from "../../application/structure/scene-canon-context";
import type {
  SceneAnnotationProjection,
} from "../../application/structure/scene-annotation-contract";
import type { SceneMetadataBindingProjection } from "../../application/structure/scene-metadata-binding-contract";
import type { SceneTrashEntryProjection } from "../../application/structure/scene-trash-contract";
import type {
  SceneMusicQueueCandidate,
  SceneMusicQueueOption,
} from "../../application/music/scene-music-queue-contract";
import type { EntityId } from "../../domain/writing";
import type { YouTubeVideoProjection } from "../../application/music/youtube-music";
import { SceneMusicQueuePanel } from "../music/SceneMusicQueuePanel";

type SceneRuleSetDraft = Pick<
  UpdateSceneRuleSetCommand,
  "displayName" | "boundaryRules" | "normalizationPolicy" | "enabled"
>;

function draftFromProjection(
  projection: SceneProjectionList | null,
): SceneRuleSetDraft {
  return {
    displayName: projection?.ruleSet.displayName ?? "",
    boundaryRules: projection?.ruleSet.boundaryRules ?? [],
    normalizationPolicy:
      projection?.ruleSet.normalizationPolicy ?? "preserve",
    enabled: projection?.ruleSet.enabled ?? false,
  };
}

function describeProjectionStatus(
  status: SceneProjectionList["status"],
): string {
  if (status === "clean") return "현재 원고 기준";
  if (status === "needsReview") return "검토 필요";
  return "장면 범위 오류";
}

function describeSceneIntegrity(
  integrity: SceneProjection["integrity"],
): string {
  if (integrity === "resolved") return "범위 확인됨";
  if (integrity === "needsReview") return "범위 검토 필요";
  return "범위 연결 손상";
}

function describeSceneSource(source: SceneProjection["source"]): string {
  return source === "rule" ? "규칙 계산" : "수동 조정 반영";
}

function createBoundaryRule(): SceneBoundaryRule {
  return Object.freeze({
    boundaryRuleId: crypto.randomUUID(),
    kind: "line-regexp",
    pattern: "",
    flags: "u",
  });
}

export function SceneList(input: {
  readonly projection: SceneProjectionList | null;
  readonly annotations: readonly SceneAnnotationProjection[];
  readonly musicQueueCandidates: readonly SceneMusicQueueCandidate[];
  readonly musicQueueBusy: boolean;
  readonly musicConnected: boolean;
  readonly favoriteMusicVideos: readonly YouTubeVideoProjection[];
  readonly musicPlaybackAvailable: boolean;
  readonly sceneTrashEntries: readonly SceneTrashEntryProjection[];
  readonly activeDocumentId: EntityId<"Document"> | null;
  readonly documentTitles?: Readonly<Record<string, string>>;
  readonly busy: boolean;
  readonly sceneCanonContexts?: readonly SceneCanonContextProjection[];
  readonly onReviewSceneCanon?: (scene: SceneProjection) => void;
  readonly onOpenSceneContinuity?: (scene: SceneProjection) => void;
  readonly onOpenSceneKnowledge?: (scene: SceneProjection) => void;
  readonly onRefreshSceneCanonContexts?: () => void;
  readonly onOpenScene: (scene: SceneProjection) => void;
  readonly onMergeWithPrevious: (
    scene: SceneProjection,
    previousScene: SceneProjection,
  ) => void;
  readonly onDeleteScene: (scene: SceneProjection) => void;
  readonly onSetEventOverride: (
    scene: SceneProjection,
    eventBlockId: EntityId<"EventBlock">,
    operation: SceneEventOverrideOperation | null,
    expectedRevision: number | null,
  ) => void;
  readonly onRebindSceneMetadata: (
    binding: SceneMetadataBindingProjection,
    targetSceneId: EntityId<"Scene"> | null,
  ) => void;
  readonly onRestoreSceneTrash: (entry: SceneTrashEntryProjection) => void;
  readonly onUpdateRuleSet: (draft: SceneRuleSetDraft) => void;
  readonly onOpenMusicSettings: () => void;
  readonly onSearchSceneMusic: (
    annotation: SceneAnnotationProjection,
    query: string,
  ) => void;
  readonly onSelectSceneMusicQueue: (
    candidate: SceneMusicQueueCandidate,
    option: SceneMusicQueueOption,
  ) => void;
  readonly onPlaySceneMusicQueue: (
    candidate: SceneMusicQueueCandidate,
  ) => void;
  readonly onPlayFavoriteMusicVideo: (video: YouTubeVideoProjection) => void;
  readonly onToggleFavoriteMusicVideo: (video: YouTubeVideoProjection) => void;
}) {
  const projection = input.projection;
  const ruleEditorId = useId();
  const ruleDraftKey = projection === null
    ? "unavailable"
    : `${projection.ruleSet.sceneRuleSetId}:${projection.ruleSet.revision}`;
  const [ruleDraftState, setRuleDraftState] = useState(() => ({
    key: ruleDraftKey,
    draft: draftFromProjection(projection),
  }));
  const ruleDraft = ruleDraftState.key === ruleDraftKey
    ? ruleDraftState.draft
    : draftFromProjection(projection);
  const setRuleDraft = (action: SetStateAction<SceneRuleSetDraft>): void => {
    setRuleDraftState((current) => {
      const currentDraft = current.key === ruleDraftKey
        ? current.draft
        : draftFromProjection(projection);
      return {
        key: ruleDraftKey,
        draft:
          typeof action === "function" ? action(currentDraft) : action,
      };
    });
  };
  const scenes = projection === null || input.activeDocumentId === null
    ? []
    : projection.scenes.filter(
        (scene) => scene.documentId === input.activeDocumentId,
      );
  const metadataReviewItems = [
    ...input.annotations.flatMap((annotation) =>
      annotation.binding.status === "needsReview"
        ? [{ binding: annotation.binding, label: `주석 · ${annotation.title}` }]
        : []
    ),
    ...(projection?.sceneEventOverrides.flatMap((eventOverride) =>
      eventOverride.binding.status === "needsReview"
        ? [{ binding: eventOverride.binding, label: "사건 연결" }]
        : []
    ) ?? []),
    ...input.musicQueueCandidates.flatMap((candidate) =>
      candidate.binding.status === "needsReview"
        ? [{ binding: candidate.binding, label: `음악 · ${candidate.query}` }]
        : []
    ),
  ];
  const activeTrashEntries = input.sceneTrashEntries.filter(
    (entry) => entry.status === "active",
  );

  const submitRuleSet = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    input.onUpdateRuleSet(ruleDraft);
  };

  const updateBoundaryRule = (
    boundaryRuleId: string,
    changes: Partial<Pick<SceneBoundaryRule, "pattern" | "flags">>,
  ): void => {
    setRuleDraft((current) => ({
      ...current,
      boundaryRules: current.boundaryRules.map((rule) =>
        rule.boundaryRuleId === boundaryRuleId
          ? Object.freeze({ ...rule, ...changes })
          : rule,
      ),
    }));
  };

  return (
    <section
      aria-label="현재 회차 장면"
      className="event-block-list scene-list"
    >
      <header>
        <div>
          <h4>장면</h4>
          {projection !== null && (
            <small>{describeProjectionStatus(projection.status)}</small>
          )}
        </div>
        <span>{scenes.length}</span>
      </header>

      {metadataReviewItems.length > 0 && (
        <details className="scene-metadata-review-summary">
          <summary role="status">
            {`장면 연결 재검토 ${metadataReviewItems.length}건`}
          </summary>
          <ul>
            {metadataReviewItems.map(({ binding, label }) => {
              const proposedScene = projection?.scenes.find(
                (scene) =>
                  binding.proposedSceneId !== null &&
                  scene.sceneIdentity?.sceneId === binding.proposedSceneId,
              );
              return (
                <li key={binding.sceneMetadataBindingId}>
                  <span>{label}</span>
                  {proposedScene !== undefined && binding.proposedSceneId !== null && (
                    <button
                      disabled={input.busy}
                      onClick={() => input.onRebindSceneMetadata(
                        binding,
                        binding.proposedSceneId,
                      )}
                      type="button"
                    >
                      {`제안 장면 ${proposedScene.sceneIndex}에 연결`}
                    </button>
                  )}
                  <button
                    disabled={input.busy}
                    onClick={() => input.onRebindSceneMetadata(binding, null)}
                    type="button"
                  >
                    연결 해제
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <details className="scene-trash-summary">
        <summary>{`장면 휴지통 ${activeTrashEntries.length}건`}</summary>
        {activeTrashEntries.length === 0 ? (
          <p>휴지통에 있는 장면이 없습니다.</p>
        ) : (
          <ul>
            {activeTrashEntries.map((entry) => (
              <li key={entry.sceneTrashEntryId}>
                <span>
                  <strong>{entry.documents.map((document) => document.documentTitle).join(" · ")}</strong>
                  <small>{entry.documents[0]?.firstExcerpt ?? entry.sourceSceneKey}</small>
                </span>
                {entry.conflictReason !== null && <small>{entry.conflictReason}</small>}
                <button
                  disabled={input.busy || !entry.canRestore}
                  onClick={() => input.onRestoreSceneTrash(entry)}
                  type="button"
                >
                  복원
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <section aria-label="선호 영상" className="scene-music-favorites">
        <header>
          <strong>선호 영상</strong>
          <span>{input.favoriteMusicVideos.length}</span>
        </header>
        {input.favoriteMusicVideos.length === 0 ? (
          <p>검색 결과에서 선호 영상을 저장하면 여기에 모입니다.</p>
        ) : (
          <ul>
            {input.favoriteMusicVideos.map((video) => (
              <li key={video.videoId}>
                <span>
                  <strong>{video.title}</strong>
                  <small>{video.channel}</small>
                </span>
                <button
                  onClick={() => input.onPlayFavoriteMusicVideo(video)}
                  type="button"
                >
                  재생
                </button>
                <button
                  aria-label={`선호 영상 해제: ${video.title}`}
                  onClick={() => input.onToggleFavoriteMusicVideo(video)}
                  type="button"
                >
                  해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="scene-rule-settings">
        <summary>장면 규칙 설정</summary>
        {projection === null ? (
          <p className="empty-event-list">장면 규칙을 불러오는 중입니다.</p>
        ) : (
          <form onSubmit={submitRuleSet}>
            <label htmlFor={`${ruleEditorId}-name`}>규칙 이름</label>
            <input
              disabled={input.busy}
              id={`${ruleEditorId}-name`}
              onChange={(event) => {
                setRuleDraft((current) => ({
                  ...current,
                  displayName: event.currentTarget.value,
                }));
              }}
              required
              value={ruleDraft.displayName}
            />
            <label htmlFor={`${ruleEditorId}-normalization`}>줄 정규화</label>
            <select
              disabled={input.busy}
              id={`${ruleEditorId}-normalization`}
              onChange={(event) => {
                setRuleDraft((current) => ({
                  ...current,
                  normalizationPolicy: event.currentTarget.value as
                    SceneRuleSetDraft["normalizationPolicy"],
                }));
              }}
              value={ruleDraft.normalizationPolicy}
            >
              <option value="preserve">원문 그대로</option>
              <option value="trim-line-whitespace">줄 양끝 공백 제외</option>
            </select>
            <label className="scene-rule-enabled">
              <input
                checked={ruleDraft.enabled}
                disabled={input.busy}
                onChange={(event) => {
                  setRuleDraft((current) => ({
                    ...current,
                    enabled: event.currentTarget.checked,
                  }));
                }}
                type="checkbox"
              />
              기본 장면 파서 사용
            </label>
            <div className="scene-rule-list">
              {ruleDraft.boundaryRules.map((rule, index) => (
                <fieldset key={rule.boundaryRuleId}>
                  <legend>{`구분 규칙 ${index + 1}`}</legend>
                  <label htmlFor={`${ruleEditorId}-${rule.boundaryRuleId}-pattern`}>
                    정규식
                  </label>
                  <input
                    aria-label={`장면 규칙 ${index + 1} 정규식`}
                    disabled={input.busy}
                    id={`${ruleEditorId}-${rule.boundaryRuleId}-pattern`}
                    onChange={(event) => {
                      updateBoundaryRule(rule.boundaryRuleId, {
                        pattern: event.currentTarget.value,
                      });
                    }}
                    value={rule.pattern}
                  />
                  <label htmlFor={`${ruleEditorId}-${rule.boundaryRuleId}-flags`}>
                    플래그
                  </label>
                  <input
                    aria-label={`장면 규칙 ${index + 1} 플래그`}
                    disabled={input.busy}
                    id={`${ruleEditorId}-${rule.boundaryRuleId}-flags`}
                    onChange={(event) => {
                      updateBoundaryRule(rule.boundaryRuleId, {
                        flags: event.currentTarget.value,
                      });
                    }}
                    value={rule.flags}
                  />
                  <button
                    disabled={input.busy}
                    onClick={() => {
                      setRuleDraft((current) => ({
                        ...current,
                        boundaryRules: current.boundaryRules.filter(
                          (candidate) =>
                            candidate.boundaryRuleId !== rule.boundaryRuleId,
                        ),
                      }));
                    }}
                    type="button"
                  >
                    규칙 제거
                  </button>
                </fieldset>
              ))}
            </div>
            <div className="scene-rule-actions">
              <button
                disabled={input.busy}
                onClick={() => {
                  setRuleDraft((current) => ({
                    ...current,
                    boundaryRules: [
                      ...current.boundaryRules,
                      createBoundaryRule(),
                    ],
                  }));
                }}
                type="button"
              >
                규칙 추가
              </button>
              <button disabled={input.busy} type="submit">
                규칙 저장
              </button>
            </div>
          </form>
        )}
      </details>

      {projection === null ? (
        <p className="empty-event-list">장면 목록을 불러오는 중입니다.</p>
      ) : scenes.length === 0 ? (
        <p className="empty-event-list">현재 회차에 계산된 장면이 없습니다.</p>
      ) : (
        <ol className="scene-list-items">
          {scenes.map((scene, index) => {
            const previousScene = scenes[index - 1];
            const episodeSpan = scene.sceneIdentity === undefined
              ? []
              : [...new Set(
                  scene.sceneIdentity.segments.map(
                    (segment) =>
                      input.documentTitles?.[segment.documentId] ??
                      segment.documentTitle,
                  ),
                )];
            const annotation = input.annotations.find(
              (candidate) =>
                candidate.binding.status === "current" &&
                candidate.binding.sceneId !== null &&
                candidate.binding.sceneId === scene.sceneIdentity?.sceneId,
            ) ?? null;
            const canonContext=input.sceneCanonContexts?.find((context)=>
              context.sceneId===scene.sceneIdentity?.sceneId
            )??null;
            const currentEventIds = new Set([
              ...scene.events.map((event) => event.eventBlockId),
              ...scene.excludedEvents.map((event) => event.eventBlockId),
            ]);
            const availableUnassignedEvents =
              projection.unassignedEvents.filter(
                (event) => !currentEventIds.has(event.eventBlockId),
              );
            return (
              <li className="scene-list-card" key={scene.sceneKey}>
                <button
                  className="scene-list-open-button"
                  disabled={
                    input.busy ||
                    scene.integrity !== "resolved" ||
                    scene.range === null
                  }
                  onClick={() => input.onOpenScene(scene)}
                  type="button"
                >
                  <strong>
                    {annotation === null
                      ? `장면 ${scene.sceneIndex}`
                      : `장면 ${scene.sceneIndex} · ${annotation.title}`}
                  </strong>
                  {episodeSpan.length > 1 && (
                    <small className="scene-episode-span">
                      {episodeSpan.join(" → ")}
                    </small>
                  )}
                  <span>
                    {scene.range === null
                      ? "위치 없음"
                      : `${scene.range.start}–${scene.range.end}`}
                    {` · ${describeSceneIntegrity(scene.integrity)}`}
                    {` · ${describeSceneSource(scene.source)}`}
                  </span>
                </button>
                {annotation !== null && (
                  <>
                    <dl
                      className="scene-list-annotation"
                      data-scene-annotation={annotation.sceneAnnotationId}
                    >
                      {annotation.summary && (
                        <><dt>요약</dt><dd>{annotation.summary}</dd></>
                      )}
                      {annotation.location && (
                        <><dt>장소</dt><dd>{annotation.location}</dd></>
                      )}
                      {annotation.time && (
                        <><dt>시간</dt><dd>{annotation.time}</dd></>
                      )}
                      {annotation.goal && (
                        <><dt>목표</dt><dd>{annotation.goal}</dd></>
                      )}
                      {annotation.conflict && (
                        <><dt>갈등</dt><dd>{annotation.conflict}</dd></>
                      )}
                      {annotation.outcome && (
                        <><dt>결과</dt><dd>{annotation.outcome}</dd></>
                      )}
                    </dl>
                    <SceneMusicQueuePanel
                      annotation={annotation}
                      busy={input.busy || input.musicQueueBusy}
                      candidates={input.musicQueueCandidates}
                      connected={input.musicConnected}
                      error={null}
                      favoriteVideoIds={input.favoriteMusicVideos.map(
                        (video) => video.videoId,
                      )}
                      onOpenSettings={input.onOpenMusicSettings}
                      onPlay={input.onPlaySceneMusicQueue}
                      onSearch={input.onSearchSceneMusic}
                      onSelect={input.onSelectSceneMusicQueue}
                      onToggleFavorite={input.onToggleFavoriteMusicVideo}
                      playbackAvailable={input.musicPlaybackAvailable}
                    />
                  </>
                )}
                <div className="scene-list-actions">
                  <button
                    disabled={input.busy||scene.integrity!=="resolved"||scene.range===null}
                    onClick={()=>input.onReviewSceneCanon?.(scene)}
                    type="button"
                  >
                    이 장면 별빛 점검
                  </button>
                  {previousScene !== undefined && (
                    <button
                      disabled={
                        input.busy ||
                        scene.range === null ||
                        previousScene.range === null
                      }
                      onClick={() =>
                        input.onMergeWithPrevious(scene, previousScene)
                      }
                      type="button"
                    >
                      앞 장면과 병합
                    </button>
                  )}
                  <button
                    disabled={
                      input.busy ||
                      scene.range === null
                    }
                    onClick={() => input.onDeleteScene(scene)}
                    type="button"
                  >
                    장면 삭제
                  </button>
                </div>
                {scene.sceneIdentity!==undefined&&(
                  <section aria-label={`장면 ${scene.sceneIndex} 별빛 연결`} className="scene-canon-context">
                    <header><h5>별빛 연결</h5><code>{scene.sceneIdentity.sceneId}</code><button disabled={input.busy} onClick={()=>input.onRefreshSceneCanonContexts?.()} type="button">별빛 연결 새로고침</button></header>
                    <div className="scene-canon-context-actions">
                      <button disabled={input.busy} onClick={()=>input.onOpenSceneContinuity?.(scene)} type="button">{`연속성 ${canonContext?.continuity.length??0}건 보기`}</button>
                      <button disabled={input.busy} onClick={()=>input.onOpenSceneKnowledge?.(scene)} type="button">{`지식 변화 ${canonContext?.knowledge.length??0}건 보기`}</button>
                    </div>
                    {(canonContext?.continuity.length??0)>0&&<ul>{canonContext!.continuity.map((thread)=><li key={thread.threadId}>{thread.status==="open"?"열림":"이력"} · {thread.title}</li>)}</ul>}
                    {(canonContext?.knowledge.length??0)>0&&<ul>{canonContext!.knowledge.map((knowledge)=><li key={knowledge.knowledgeId}>{knowledge.statement}</li>)}</ul>}
                    {(canonContext?.lineageReviews.some((review)=>review.status==="needs-review")??false)&&<div className="scene-canon-lineage-review" role="status"><strong>분할·병합 뒤 별빛 연결 검토 필요</strong><ul>{canonContext!.lineageReviews.filter((review)=>review.status==="needs-review").map((review)=><li key={`${review.lineageOperationId}:${review.referenceKind}:${review.referenceId}`}>{review.operation==="split"?"분할":"병합"} · {review.referenceKind==="continuity-thread"?"연속성":"인물 지식"} · 후보 장면 {review.candidateSceneIds.length}개</li>)}</ul><p>자동 계승하지 않았습니다. 별빛 작업면에서 대상 장면을 명시적으로 확인하세요.</p></div>}
                  </section>
                )}
                <div className="scene-event-membership">
                  <h5>사건</h5>
                  {scene.events.length === 0 ? (
                    <p>소속 사건이 없습니다.</p>
                  ) : (
                    <ul>
                      {scene.events.map((event) => (
                        <li key={event.eventBlockId}>
                          <span>
                            <strong>{event.title}</strong>
                            <small>
                              {event.membership === "automatic"
                                ? "자동 소속"
                                : "수동 포함"}
                            </small>
                          </span>
                          <button
                            disabled={input.busy}
                            onClick={() =>
                              input.onSetEventOverride(
                                scene,
                                event.eventBlockId,
                                event.membership === "automatic"
                                  ? "exclude"
                                  : null,
                                event.sceneEventOverrideRevision,
                              )
                            }
                            type="button"
                          >
                            {event.membership === "automatic"
                              ? "수동 제외"
                              : "수동 포함 해제"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {scene.excludedEvents.length > 0 && (
                    <div className="scene-excluded-events">
                      <h6>수동 제외</h6>
                      <ul>
                        {scene.excludedEvents.map((event) => (
                          <li key={event.eventBlockId}>
                            <span>{event.title}</span>
                            <button
                              disabled={input.busy}
                              onClick={() =>
                                input.onSetEventOverride(
                                  scene,
                                  event.eventBlockId,
                                  null,
                                  event.sceneEventOverrideRevision,
                                )
                              }
                              type="button"
                            >
                              제외 해제
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {availableUnassignedEvents.length > 0 && (
                    <details className="scene-unassigned-events">
                      <summary>미배정 사건 포함</summary>
                      <ul>
                        {availableUnassignedEvents.map((event) => (
                          <li key={event.eventBlockId}>
                            <span>{event.title}</span>
                            <button
                              disabled={input.busy}
                              onClick={() =>
                                input.onSetEventOverride(
                                  scene,
                                  event.eventBlockId,
                                  "include",
                                  null,
                                )
                              }
                              type="button"
                            >
                              이 장면에 포함
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {projection !== null &&
        projection.unassignedEvents.length > 0 && (
          <div className="scene-unassigned-summary">
            <h5>미배정 사건</h5>
            <ul>
              {projection.unassignedEvents.map((event) => (
                <li key={event.eventBlockId}>
                  <span>{event.title}</span>
                  <small>원고 장면 미배정</small>
                </li>
              ))}
            </ul>
          </div>
        )}
    </section>
  );
}
