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
import type { EntityId } from "../../domain/writing";

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
  readonly activeDocumentId: EntityId<"Document"> | null;
  readonly busy: boolean;
  readonly onOpenScene: (scene: SceneProjection) => void;
  readonly onSplitScene: (scene: SceneProjection) => void;
  readonly onMergeWithPrevious: (
    scene: SceneProjection,
    previousScene: SceneProjection,
  ) => void;
  readonly onSetEventOverride: (
    scene: SceneProjection,
    eventBlockId: EntityId<"EventBlock">,
    operation: SceneEventOverrideOperation | null,
    expectedRevision: number | null,
  ) => void;
  readonly onUpdateRuleSet: (draft: SceneRuleSetDraft) => void;
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
                  <strong>{`장면 ${scene.sceneIndex}`}</strong>
                  <span>
                    {scene.range === null
                      ? "위치 없음"
                      : `${scene.range.start}–${scene.range.end}`}
                    {` · ${describeSceneIntegrity(scene.integrity)}`}
                    {` · ${describeSceneSource(scene.source)}`}
                  </span>
                </button>
                <div className="scene-list-actions">
                  <button
                    disabled={input.busy || scene.range === null}
                    onClick={() => input.onSplitScene(scene)}
                    type="button"
                  >
                    현재 위치에서 분할
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
                </div>
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
