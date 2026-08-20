import { Bot, Scissors, Sparkles } from "lucide-react";

import type { ChatGptOAuthConnectionStatus } from "../../application/assistant/chatgpt-oauth";
import type { CharacterProjection } from "../../application/characters/character-contract";
import type {
  SceneExtractionAnnotationDecision,
  SceneExtractionBoundary,
  SceneExtractionCandidate,
  SceneExtractionScene,
} from "../../application/structure/scene-extraction-contract";
import type {
  SceneAnnotationProjection,
} from "../../application/structure/scene-annotation-contract";
import type {
  SceneProjection,
  SceneProjectionList,
} from "../../application/structure/scene-projection";

export type SceneExtractionActionState =
  | "idle"
  | "extracting"
  | "granting"
  | "deciding"
  | "previewing";

export type SceneExtractionSelection = Readonly<{
  documentId: string;
  documentTitle: string;
  documentRevisionId: string;
  from: number;
  to: number;
}>;

function SceneCandidateCard(input: {
  readonly annotations: readonly SceneAnnotationProjection[];
  readonly busy: boolean;
  readonly candidate: SceneExtractionCandidate;
  readonly characters: readonly CharacterProjection[];
  readonly onDecideAnnotation: (
    candidate: SceneExtractionCandidate,
    scene: SceneExtractionScene,
    decision: SceneExtractionAnnotationDecision,
  ) => void;
  readonly projection: SceneProjectionList | null;
}) {
  const characterName = (characterId: string) =>
    input.characters.find((character) => character.characterId === characterId)
      ?.name ?? characterId;
  const boundariesDecided = input.candidate.boundaries.every(
    (boundary) => boundary.status !== "pending",
  );
  const projectionFor = (scene: SceneExtractionScene): SceneProjection | null =>
    input.projection?.scenes.find((projection) =>
      projection.documentId === scene.range.documentId &&
      projection.documentRevisionId === scene.range.documentRevisionId &&
      projection.integrity === "resolved" &&
      projection.range?.start === scene.range.from &&
      projection.range.end >= scene.range.to
    ) ?? null;
  return (
    <ol className="scene-extraction-scene-list">
      {input.candidate.scenes.map((scene) => {
        const resolvedScene = projectionFor(scene);
        const annotation = resolvedScene === null
          ? null
          : input.annotations.find(
              (candidate) => candidate.sceneKey === resolvedScene.sceneKey,
            ) ?? null;
        return (
        <li data-scene-item={scene.sceneItemId} key={scene.sceneItemId}>
          <header>
            <strong>{scene.title}</strong>
            <span>{scene.range.from.toLocaleString()}–{scene.range.to.toLocaleString()}</span>
          </header>
          {scene.summary && <p>{scene.summary}</p>}
          <dl>
            {scene.povCharacterId !== null && (
              <><dt>시점</dt><dd>{characterName(scene.povCharacterId)}</dd></>
            )}
            {scene.location && <><dt>장소</dt><dd>{scene.location}</dd></>}
            {scene.time && <><dt>시간</dt><dd>{scene.time}</dd></>}
            {scene.characterIds.length > 0 && (
              <><dt>인물</dt><dd>{scene.characterIds.map(characterName).join(", ")}</dd></>
            )}
            {scene.goal && <><dt>목표</dt><dd>{scene.goal}</dd></>}
            {scene.conflict && <><dt>갈등</dt><dd>{scene.conflict}</dd></>}
            {scene.outcome && <><dt>결과</dt><dd>{scene.outcome}</dd></>}
          </dl>
          {scene.annotationStatus === "pending" ? (
            <div className="scene-extraction-annotation-actions">
              <button
                disabled={
                  input.busy ||
                  input.candidate.status !== "ready" ||
                  !boundariesDecided ||
                  resolvedScene === null
                }
                onClick={() => {
                  if (resolvedScene === null) return;
                  input.onDecideAnnotation(input.candidate, scene, {
                    kind: "accept",
                    sceneKey: resolvedScene.sceneKey,
                    expectedAnnotationRevision: annotation?.revision ?? null,
                  });
                }}
                type="button"
              >
                {annotation === null ? "장면 정보 승인" : "장면 정보 다시 승인"}
              </button>
              <button
                disabled={input.busy || input.candidate.status !== "ready"}
                onClick={() => input.onDecideAnnotation(
                  input.candidate,
                  scene,
                  { kind: "exclude" },
                )}
                type="button"
              >
                주석 제외
              </button>
              {!boundariesDecided && <small>분할·병합 경계를 먼저 결정하세요.</small>}
              {boundariesDecided && resolvedScene === null && (
                <small>현재 장면 범위와 정확히 일치할 때만 승인할 수 있습니다.</small>
              )}
            </div>
          ) : (
            <strong className={`scene-annotation-status is-${scene.annotationStatus}`}>
              {scene.annotationStatus === "approved"
                ? "장면 정보 저장됨"
                : "주석 제외됨"}
            </strong>
          )}
        </li>
        );
      })}
    </ol>
  );
}

function SceneBoundaryReview(input: {
  readonly boundary: SceneExtractionBoundary;
  readonly busy: boolean;
  readonly candidate: SceneExtractionCandidate;
  readonly onDecide: (
    candidate: SceneExtractionCandidate,
    boundary: SceneExtractionBoundary,
    decision: "accept" | "exclude",
  ) => void;
}) {
  const before = input.candidate.scenes.find(
    (scene) => scene.sceneItemId === input.boundary.fromSceneItemId,
  );
  const after = input.candidate.scenes.find(
    (scene) => scene.sceneItemId === input.boundary.toSceneItemId,
  );
  return (
    <li data-scene-boundary={input.boundary.boundaryId}>
      <div>
        <Scissors aria-hidden="true" size={14} />
        <span>
          {before?.title ?? "이전 장면"} → {after?.title ?? "다음 장면"}
        </span>
        <small>{input.boundary.offset.toLocaleString()}자</small>
      </div>
      {input.boundary.status === "pending" ? (
        <div className="scene-extraction-boundary-actions">
          <button
            disabled={input.busy || input.candidate.status !== "ready"}
            onClick={() => input.onDecide(
              input.candidate,
              input.boundary,
              "accept",
            )}
            type="button"
          >
            분할 승인
          </button>
          <button
            disabled={input.busy || input.candidate.status !== "ready"}
            onClick={() => input.onDecide(
              input.candidate,
              input.boundary,
              "exclude",
            )}
            type="button"
          >
            앞 장면과 합치기
          </button>
        </div>
      ) : (
        <strong className={`is-${input.boundary.status}`}>
          {input.boundary.status === "accepted" ? "분할 저장됨" : "병합 유지"}
        </strong>
      )}
    </li>
  );
}

export function SceneExtractionPanel(input: {
  readonly actionState: SceneExtractionActionState;
  readonly annotations: readonly SceneAnnotationProjection[];
  readonly candidates: readonly SceneExtractionCandidate[];
  readonly characters: readonly CharacterProjection[];
  readonly error: string | null;
  readonly oauthStatus: ChatGptOAuthConnectionStatus | null;
  readonly onDecide: (
    candidate: SceneExtractionCandidate,
    boundary: SceneExtractionBoundary,
    decision: "accept" | "exclude",
  ) => void;
  readonly onDecideAnnotation: (
    candidate: SceneExtractionCandidate,
    scene: SceneExtractionScene,
    decision: SceneExtractionAnnotationDecision,
  ) => void;
  readonly onOpenSettings: () => void;
  readonly onPreviewCandidate: (candidate: SceneExtractionCandidate) => void;
  readonly onRequestPermission: () => void;
  readonly onRun: () => void;
  readonly permissionRequired: boolean;
  readonly projection: SceneProjectionList | null;
  readonly selection: SceneExtractionSelection | null;
}) {
  const busy = input.actionState !== "idle";
  return (
    <section aria-label="장면 뽑기" className="scene-extraction-panel">
      <header>
        <div>
          <p className="panel-kicker">ASSISTANT</p>
          <h3>장면 뽑기</h3>
        </div>
        <button
          disabled={busy || input.selection === null || !input.oauthStatus?.connected}
          onClick={input.onRun}
          type="button"
        >
          <Sparkles aria-hidden="true" size={14} />
          {input.actionState === "extracting" ? "장면 구분 중" : "원고에서 장면 구분"}
        </button>
      </header>
      {!input.oauthStatus?.connected && (
        <div className="scene-extraction-callout" role="status">
          <Bot aria-hidden="true" size={16} />
          <span>GPT를 연결하면 선택한 원고를 문단 경계 기준으로 분석할 수 있습니다.</span>
          <button onClick={input.onOpenSettings} type="button">GPT 연결 열기</button>
        </div>
      )}
      {input.selection !== null && (
        <p className="scene-extraction-selection">
          분석 범위 · {input.selection.documentTitle} {input.selection.from.toLocaleString()}–
          {input.selection.to.toLocaleString()}
        </p>
      )}
      {input.permissionRequired && (
        <div className="scene-extraction-callout is-permission" role="alert">
          <span>이 정확한 선택 범위를 GPT로 전송하려면 권한 승인이 필요합니다.</span>
          <button disabled={busy} onClick={input.onRequestPermission} type="button">
            이번 선택 전송 허용
          </button>
        </div>
      )}
      {input.candidates.length === 0 ? (
        <p className="empty-event-list">저장된 장면 후보가 없습니다.</p>
      ) : (
        <div className="scene-extraction-candidates">
          {input.candidates.map((candidate) => (
            <article key={candidate.candidateId}>
              <header>
                <strong>{candidate.modelId}</strong>
                <div>
                  <span>
                    {candidate.status === "stale"
                      ? "원고 변경으로 만료됨"
                      : candidate.status === "completed"
                        ? "검토 완료"
                        : "검토 중"}
                  </span>
                  <button
                    disabled={
                      busy ||
                      candidate.status !== "ready" ||
                      candidate.boundaries.every(
                        (boundary) => boundary.status !== "pending",
                      )
                    }
                    onClick={() => input.onPreviewCandidate(candidate)}
                    type="button"
                  >
                    원고에서 분할선 미리보기
                  </button>
                </div>
              </header>
              <SceneCandidateCard
                annotations={input.annotations}
                busy={busy}
                candidate={candidate}
                characters={input.characters}
                onDecideAnnotation={input.onDecideAnnotation}
                projection={input.projection}
              />
              {candidate.boundaries.length === 0 ? (
                <p>이 범위에는 승인할 추가 장면 경계가 없습니다.</p>
              ) : (
                <ul className="scene-extraction-boundaries">
                  {candidate.boundaries.map((boundary) => (
                    <SceneBoundaryReview
                      boundary={boundary}
                      busy={busy}
                      candidate={candidate}
                      key={boundary.boundaryId}
                      onDecide={input.onDecide}
                    />
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
      {input.error !== null && (
        <p className="event-action-error" role="alert">{input.error}</p>
      )}
    </section>
  );
}
