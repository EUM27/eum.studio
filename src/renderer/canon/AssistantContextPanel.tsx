import { useMemo, useState, type FormEvent } from "react";

import type { AssistantCapability } from "../../application/assistant/assistant-context-permission";
import type { CanonEntityRef } from "../../application/canon/canon-entity-ref";
import type { CharacterProjection } from "../../application/characters/character-contract";
import type { AssistantContextMode } from "../../application/continuity/assistant-context-policy";
import type { EntityId } from "../../domain/writing";
import type { useContextPlannerController } from "../features/context/useContextPlannerController";

export type ContextEntityOption = Readonly<{
  key: string;
  entity: CanonEntityRef;
  label: string;
}>;

export type AssistantContextPanelController = ReturnType<typeof useContextPlannerController>;

const MODE_LABELS: Readonly<Record<AssistantContextMode, string>> = Object.freeze({
  required: "항상 포함",
  relevant: "관련될 때 포함",
  withheld: "AI에 제공하지 않음",
});

const REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "required-policy": "필수 정책",
  "user-selected": "사용자 선택",
  "current-scene": "현재 장면",
  "exact-source-overlap": "정확 근거 겹침",
  "direct-relation": "직접 관계",
  "open-continuity": "열린 연속성",
  "pov-knowledge": "POV 지식",
  "recent-change": "최근 변경",
  "derived-digest": "현재 digest",
  "withheld-policy": "AI에 제공하지 않음",
  "outside-work": "작품 밖",
  "stale-derived": "stale 파생 데이터",
  duplicate: "중복",
  "over-budget": "예산 초과",
  "not-relevant": "관련 없음",
  "missing-revision": "revision 없음",
});

function entityKey(entity: CanonEntityRef): string {
  return `${entity.kind}:${entity.id}`;
}

function EntryLabel(input: Readonly<{
  entry: Readonly<{ kind: string; entity?: CanonEntityRef; digestId?: string }>;
  labels: ReadonlyMap<string, string>;
}>) {
  if (input.entry.kind === "entity" && input.entry.entity !== undefined) {
    return <>{input.labels.get(entityKey(input.entry.entity)) ?? entityKey(input.entry.entity)}</>;
  }
  return <>digest · {input.entry.digestId}</>;
}

export function AssistantContextPanel(input: Readonly<{
  characters: readonly CharacterProjection[];
  controller: AssistantContextPanelController;
  entityOptions: readonly ContextEntityOption[];
}>) {
  const busy = input.controller.actionState !== "idle";
  const labels = useMemo(() => new Map(input.entityOptions.map((entry) => [entry.key, entry.label])), [input.entityOptions]);
  const [connectorKind, setConnectorKind] = useState(input.controller.connectors[0]?.connectorKind ?? "");
  const selectedConnectorKind = input.controller.connectors.some((entry) =>
    entry.connectorKind === connectorKind
  ) ? connectorKind : input.controller.connectors[0]?.connectorKind ?? "";
  const connector = input.controller.connectors.find((entry) =>
    entry.connectorKind === selectedConnectorKind
  );
  const [capability, setCapability] = useState<AssistantCapability>(connector?.capabilities[0] ?? "vocabulary-lookup");
  const selectedCapability = connector?.capabilities.includes(capability) === true
    ? capability
    : connector?.capabilities[0] ?? capability;
  const plan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pov = form.get("povCharacterId");
    const query = form.get("userQuery");
    void input.controller.runPlan({
      connectorKind: selectedConnectorKind,
      capability: selectedCapability,
      povCharacterId: typeof pov === "string" && pov.length > 0
        ? pov as EntityId<"Character">
        : null,
      userQuery: typeof query === "string" ? query : "",
    });
  };
  return (
    <div className="assistant-context-panel">
      {(input.controller.error !== null || input.controller.message !== null) && (
        <p className={input.controller.error === null ? "canon-feedback" : "canon-feedback is-error"} role={input.controller.error === null ? "status" : "alert"}>{input.controller.error ?? input.controller.message}</p>
      )}
      <div className="canon-review-grid assistant-context-grid">
        <section aria-label="별빛별 AI 문맥 정책" className="canon-review-column context-policy-column">
          <header><div><span className="canon-eyebrow">Policy</span><h3>별빛별 AI 문맥 정책</h3></div><button disabled={busy} onClick={() => void input.controller.refresh()} type="button">새로고침</button></header>
          <p>저장하지 않은 별빛은 <strong>관련될 때 포함</strong>으로 projection됩니다.</p>
          <ol className="context-policy-list">{input.controller.policies.map((policy) => (
            <li key={entityKey(policy.entity)}>
              <div><strong>{labels.get(entityKey(policy.entity)) ?? entityKey(policy.entity)}</strong><small>revision {policy.revision}</small></div>
              <select aria-label={`${labels.get(entityKey(policy.entity)) ?? policy.entity.id} 문맥 정책`} disabled={busy} onChange={(event) => void input.controller.savePolicy(policy, event.currentTarget.value as AssistantContextMode)} value={policy.mode}>
                {(Object.keys(MODE_LABELS) as AssistantContextMode[]).map((mode) => <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>)}
              </select>
            </li>
          ))}</ol>
        </section>
        <section aria-label="결정적 문맥 plan" className="canon-review-column context-plan-column">
          <header><div><span className="canon-eyebrow">Deterministic plan</span><h3>결정적 문맥 plan</h3></div></header>
          <form aria-label="문맥 plan 실행" onSubmit={plan}>
            <label><span>connector manifest</span><select onChange={(event) => {
              const nextKind = event.currentTarget.value;
              setConnectorKind(nextKind);
              const next = input.controller.connectors.find((entry) => entry.connectorKind === nextKind);
              if (next?.capabilities[0] !== undefined) setCapability(next.capabilities[0]);
            }} value={selectedConnectorKind}>{input.controller.connectors.map((entry) => <option key={entry.connectorKind} value={entry.connectorKind}>{entry.displayName} · 예산 {entry.contextTokenBudget}</option>)}</select></label>
            <label><span>capability</span><select onChange={(event) => setCapability(event.currentTarget.value as AssistantCapability)} value={selectedCapability}>{(connector?.capabilities ?? []).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>POV 인물</span><select name="povCharacterId"><option value="">없음</option>{input.characters.filter((entry) => entry.retiredAt === null).map((entry) => <option key={entry.characterId} value={entry.characterId}>{entry.name}</option>)}</select></label>
            <label><span>사용자 질문</span><input name="userQuery" /></label>
            <button disabled={busy || connector === undefined} type="submit">문맥 plan 만들기</button>
          </form>
          {input.controller.plan === null ? <p className="canon-empty">connector manifest 예산으로 plan을 실행하세요.</p> : input.controller.plan.status === "required-context-over-budget" ? (
            <div className="context-over-budget" role="alert"><strong>필수 문맥이 예산을 초과했습니다.</strong><p>{input.controller.plan.requiredTokenCount} / {input.controller.plan.tokenBudget}</p></div>
          ) : (
            <div className="context-plan-result"><p>예상 token {input.controller.plan.estimatedTokenCount} / {input.controller.plan.tokenBudget}</p><h4>포함</h4><ol>{input.controller.plan.entries.map((entry, index) => <li key={`${entry.kind}:${index}`}><EntryLabel entry={entry} labels={labels} /><small>{REASON_LABELS[entry.inclusionReason] ?? entry.inclusionReason}{entry.kind === "entity" ? ` · revision ${entry.entityRevision}` : ""}</small></li>)}</ol><h4>제외</h4><ol>{input.controller.plan.excluded.map((entry, index) => <li key={`${entry.kind}:${index}`}><EntryLabel entry={entry} labels={labels} /><small>{REASON_LABELS[entry.reason] ?? entry.reason}</small></li>)}</ol></div>
          )}
        </section>
        <aside aria-label="AI 문맥 활동" className="canon-review-column context-activity-column">
          <header><div><span className="canon-eyebrow">Activity</span><h3>AI 문맥 활동</h3></div></header>
          <section><h4>manifest</h4>{input.controller.manifests.length === 0 ? <p className="canon-empty">기록된 manifest가 없습니다.</p> : <ol>{input.controller.manifests.map((manifest) => <li key={manifest.manifestId}><strong>{manifest.entries.length}개 포함 · {manifest.excluded.length}개 제외</strong><small>token {manifest.estimatedTokenCount} · receipt {manifest.receiptId}</small></li>)}</ol>}</section>
          <section><h4>실행 활동</h4>{input.controller.activities.length === 0 ? <p className="canon-empty">기록된 활동이 없습니다.</p> : <ol>{input.controller.activities.map((activity) => <li key={activity.activityId}><strong>{activity.capability} · {activity.providerId} / {activity.modelId}</strong><small>{activity.startedAt} → {activity.completedAt}</small><small>plan {activity.stageDurationsMs.plan}ms · authorize {activity.stageDurationsMs.authorize}ms · connector {activity.stageDurationsMs.connector}ms · persist {activity.stageDurationsMs.persist}ms</small><small>읽음 {activity.readCharacterCount}자 · 전송 {activity.transmittedCharacterCount}자 · Candidate {activity.candidateCount}개</small>{activity.readRanges.map((range, index) => <small key={`${range.documentId}:${index}`}>읽은 원고 {range.documentId} · {range.from}–{range.to} · revision {range.documentRevisionId}</small>)}</li>)}</ol>}</section>
        </aside>
      </div>
    </div>
  );
}
