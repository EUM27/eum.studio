import { useMemo, useState, type FormEvent } from "react";

import type { CanonEntityRef } from "../../application/canon/canon-entity-ref";
import type {
  CharacterKnowledgeProjection,
  CharacterKnowledgeStance,
  KnowledgeEvidenceProjection,
  KnowledgeTruthStatus,
  PovKnowledgeContextProjection,
} from "../../application/continuity/character-knowledge-contract";
import type { CharacterProjection } from "../../application/characters/character-contract";
import type { EntityId } from "../../domain/writing";
import type {
  CharacterKnowledgeActionState,
  CharacterKnowledgeStateDraft,
  PendingCharacterKnowledgeSelection,
} from "../features/knowledge/useCharacterKnowledgeController";
import {
  DEFAULT_CHARACTER_KNOWLEDGE_FILTER,
  filterCharacterKnowledge,
} from "../features/knowledge/character-knowledge-state";

export type CharacterKnowledgeReferenceOption = Readonly<{
  key: string;
  entity: CanonEntityRef;
  label: string;
}>;

export type CharacterKnowledgePanelEvidence = Readonly<{
  anchorId: string;
  documentId: string;
  documentRevisionId: string;
  exactText: string;
  from: number;
  to: number;
}>;

export type CharacterKnowledgePanelController = Readonly<{
  entries: readonly CharacterKnowledgeProjection[];
  selectedEntry: CharacterKnowledgeProjection | null;
  selectedKnowledgeId: string | null;
  pendingSelection: PendingCharacterKnowledgeSelection | null;
  pov: PovKnowledgeContextProjection | null;
  actionState: CharacterKnowledgeActionState;
  error: string | null;
  message: string | null;
  refresh: () => Promise<boolean>;
  create: (
    characterId: EntityId<"Character">,
    draft: CharacterKnowledgeStateDraft,
  ) => Promise<CharacterKnowledgeProjection | null>;
  update: (
    entry: CharacterKnowledgeProjection,
    statement: string,
    aboutRefs: readonly CanonEntityRef[],
  ) => Promise<CharacterKnowledgeProjection | null>;
  supersede: (
    entry: CharacterKnowledgeProjection,
    draft: CharacterKnowledgeStateDraft,
  ) => Promise<CharacterKnowledgeProjection | null>;
  retire: (
    entry: CharacterKnowledgeProjection,
    reason: string,
  ) => Promise<CharacterKnowledgeProjection | null>;
  projectPov: (
    characterId: EntityId<"Character">,
  ) => Promise<PovKnowledgeContextProjection | null>;
  clearPendingSelection: () => void;
  selectEntry: (knowledgeId: string | null) => void;
}>;

const STANCE_LABELS: Readonly<Record<CharacterKnowledgeStance, string>> = Object.freeze({
  knows: "알고 있음",
  believes: "믿고 있음",
  suspects: "의심함",
  denies: "부정함",
  unaware: "알지 못함",
});

const TRUTH_LABELS: Readonly<Record<KnowledgeTruthStatus, string>> = Object.freeze({
  true: "객관적 사실",
  false: "객관적으로 거짓",
  unknown: "객관적 여부 미확정",
});

function selectedRefs(
  form: FormData,
  options: readonly CharacterKnowledgeReferenceOption[],
): readonly CanonEntityRef[] {
  const keys = new Set(form.getAll("aboutRef").filter(
    (value): value is string => typeof value === "string",
  ));
  return Object.freeze(options.flatMap((option) =>
    keys.has(option.key) ? [option.entity] : []
  ));
}

function stateDraft(
  form: FormData,
  options: readonly CharacterKnowledgeReferenceOption[],
): CharacterKnowledgeStateDraft | null {
  const statement = form.get("statement");
  const stance = form.get("stance");
  const truthStatus = form.get("truthStatus");
  if (
    typeof statement !== "string" || statement.trim().length === 0 ||
    (stance !== "knows" && stance !== "believes" && stance !== "suspects" &&
      stance !== "denies" && stance !== "unaware") ||
    (truthStatus !== "true" && truthStatus !== "false" && truthStatus !== "unknown")
  ) return null;
  return Object.freeze({
    statement: statement.trim(),
    stance,
    truthStatus,
    aboutRefs: selectedRefs(form, options),
  });
}

function ReferenceChoices(input: Readonly<{
  defaults: readonly CanonEntityRef[];
  options: readonly CharacterKnowledgeReferenceOption[];
}>) {
  const defaults = new Set(input.defaults.map((ref) => `${ref.kind}:${ref.id}`));
  if (input.options.length === 0) return <p className="canon-empty">연결할 별빛이 없습니다.</p>;
  return (
    <fieldset className="knowledge-reference-options">
      <legend>관련 별빛</legend>
      {input.options.map((option) => (
        <label key={option.key}>
          <input
            defaultChecked={defaults.has(option.key)}
            name="aboutRef"
            type="checkbox"
            value={option.key}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function StateFields(input: Readonly<{
  defaultStatement: string;
  defaultStance: CharacterKnowledgeStance;
  defaultTruth: KnowledgeTruthStatus;
}>) {
  return (
    <>
      <label><span>내용</span><textarea defaultValue={input.defaultStatement} name="statement" required rows={3} /></label>
      <label><span>인물의 인식</span><select defaultValue={input.defaultStance} name="stance">
        {(Object.keys(STANCE_LABELS) as CharacterKnowledgeStance[]).map((value) => (
          <option key={value} value={value}>{STANCE_LABELS[value]}</option>
        ))}
      </select></label>
      <label><span>객관적 사실 여부</span><select defaultValue={input.defaultTruth} name="truthStatus">
        {(Object.keys(TRUTH_LABELS) as KnowledgeTruthStatus[]).map((value) => (
          <option key={value} value={value}>{TRUTH_LABELS[value]}</option>
        ))}
      </select></label>
    </>
  );
}

function EvidenceList(input: Readonly<{
  documentLabels: Readonly<Record<string, string>>;
  evidence: readonly KnowledgeEvidenceProjection[];
  onOpen?: (evidence: CharacterKnowledgePanelEvidence) => void;
}>) {
  if (input.evidence.length === 0) return <p className="canon-empty">연결된 원문 근거가 없습니다.</p>;
  return <ol className="canon-evidence-list">{input.evidence.map((evidence) => (
    <li key={evidence.anchorId}>
      <header><strong>{input.documentLabels[evidence.documentId] ?? "원고"}</strong><span>{evidence.integrity}</span></header>
      <blockquote>{evidence.exactText}</blockquote>
      {evidence.range !== null && input.onOpen !== undefined && (
        <button onClick={() => input.onOpen?.({
          anchorId: evidence.anchorId,
          documentId: evidence.documentId,
          documentRevisionId: evidence.documentRevisionId,
          exactText: evidence.exactText,
          from: evidence.range!.from,
          to: evidence.range!.to,
        })} type="button">원문 열기</button>
      )}
    </li>
  ))}</ol>;
}

function KnowledgeDetail(input: Readonly<{
  busy: boolean;
  controller: CharacterKnowledgePanelController;
  documentLabels: Readonly<Record<string, string>>;
  onEvidenceOpen?: (evidence: CharacterKnowledgePanelEvidence) => void;
  referenceOptions: readonly CharacterKnowledgeReferenceOption[];
}>) {
  const entry = input.controller.selectedEntry;
  if (entry === null) {
    return <section aria-label="인물 지식 상세" className="canon-review-column"><p className="canon-empty">왼쪽에서 인물 지식을 선택해 주세요.</p></section>;
  }
  const updateReferenceOptions = input.referenceOptions.filter((option) => !(
    option.entity.kind === "character-knowledge" &&
    option.entity.id === entry.knowledgeId
  ));
  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statement = form.get("statement");
    if (typeof statement !== "string" || statement.trim().length === 0) return;
    void input.controller.update(entry, statement.trim(), selectedRefs(form, updateReferenceOptions));
  };
  const supersede = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = stateDraft(new FormData(event.currentTarget), input.referenceOptions);
    if (draft !== null) void input.controller.supersede(entry, draft);
  };
  const retire = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get("reason");
    if (typeof reason === "string" && reason.trim().length > 0) {
      void input.controller.retire(entry, reason.trim());
    }
  };
  return (
    <section aria-label="인물 지식 상세" className="canon-review-column knowledge-detail-column">
      <header><div><span className="canon-eyebrow">CharacterKnowledge</span><h3>{entry.statement}</h3></div><span>{entry.status}</span></header>
      <dl className="knowledge-status-grid">
        <div><dt>인물 인식</dt><dd>{STANCE_LABELS[entry.stance]}</dd></div>
        <div><dt>객관적 사실</dt><dd>{TRUTH_LABELS[entry.truthStatus]}</dd></div>
        <div><dt>revision</dt><dd>{entry.revision}</dd></div>
      </dl>
      {(entry.supersedesKnowledgeId !== null || entry.supersededByKnowledgeId !== null) && (
        <p className="knowledge-lineage">계보: {entry.supersedesKnowledgeId ?? "시작"} → {entry.knowledgeId} → {entry.supersededByKnowledgeId ?? "현재"}</p>
      )}
      <section><h4>원문 근거</h4><EvidenceList documentLabels={input.documentLabels} evidence={entry.evidence} {...(input.onEvidenceOpen === undefined ? {} : { onOpen: input.onEvidenceOpen })} /></section>
      {entry.status === "active" && (
        <>
          <form aria-label="인물 지식 설명 수정" className="knowledge-edit-form" key={`edit:${entry.knowledgeId}:${entry.revision}`} onSubmit={update}>
            <h4>내용 수정</h4>
            <label><span>내용</span><textarea defaultValue={entry.statement} name="statement" required rows={3} /></label>
            <ReferenceChoices defaults={entry.aboutRefs} options={updateReferenceOptions} />
            <button disabled={input.busy} type="submit">설명 수정</button>
          </form>
          <form aria-label="인물 지식 새 상태" className="knowledge-edit-form" key={`supersede:${entry.knowledgeId}:${entry.revision}`} onSubmit={supersede}>
            <h4>새 인식 상태</h4>
            <p>기존 상태는 덮어쓰지 않고 계보에 보존됩니다.</p>
            <StateFields defaultStatement={entry.statement} defaultStance={entry.stance} defaultTruth={entry.truthStatus} />
            <ReferenceChoices defaults={entry.aboutRefs} options={input.referenceOptions} />
            <button disabled={input.busy} type="submit">이전 상태 보존 후 새 상태 만들기</button>
          </form>
          <form aria-label="인물 지식 보관" className="knowledge-retire-form" onSubmit={retire}>
            <label><span>보관 사유</span><input name="reason" required /></label>
            <button disabled={input.busy} type="submit">보관 처리</button>
          </form>
        </>
      )}
    </section>
  );
}

function PovColumn(input: Readonly<{
  busy: boolean;
  characters: readonly CharacterProjection[];
  controller: CharacterKnowledgePanelController;
}>) {
  const [characterId, setCharacterId] = useState<string>(input.characters[0]?.characterId ?? "");
  const groups = input.controller.pov === null ? [] : [
    ["작품의 객관적 사실", input.controller.pov.objectiveFacts],
    ["POV 인물이 아는 정보", input.controller.pov.povKnown],
    ["POV 인물의 잘못된 믿음", input.controller.pov.povFalseBeliefs],
    ["POV 인물이 알 수 없는 정보", input.controller.pov.povUnavailable],
  ] as const;
  return (
    <aside aria-label="POV 지식 문맥" className="canon-review-column knowledge-pov-column">
      <header><div><span className="canon-eyebrow">POV context</span><h3>POV 지식 문맥</h3></div></header>
      <form aria-label="POV 인물 선택" onSubmit={(event) => {
        event.preventDefault();
        if (characterId.length > 0) void input.controller.projectPov(characterId as EntityId<"Character">);
      }}>
        <label><span>POV 인물</span><select onChange={(event) => setCharacterId(event.currentTarget.value)} value={characterId}>
          {input.characters.filter((entry) => entry.retiredAt === null).map((entry) => (
            <option key={entry.characterId} value={entry.characterId}>{entry.name}</option>
          ))}
        </select></label>
        <button disabled={input.busy || characterId.length === 0} type="submit">문맥 보기</button>
      </form>
      {groups.length === 0 ? <p className="canon-empty">POV 인물을 선택해 문맥을 확인하세요.</p> : groups.map(([label, entries]) => (
        <section key={label}><h4>{label}</h4>{entries.length === 0 ? <p className="canon-empty">없음</p> : <ul>{entries.map((entry) => <li key={entry.knowledgeId}>{entry.statement}</li>)}</ul>}</section>
      ))}
    </aside>
  );
}

export function CharacterKnowledgePanel(input: Readonly<{
  characters: readonly CharacterProjection[];
  controller: CharacterKnowledgePanelController;
  documentLabels: Readonly<Record<string, string>>;
  onEvidenceOpen?: (evidence: CharacterKnowledgePanelEvidence) => void;
  referenceOptions: readonly CharacterKnowledgeReferenceOption[];
}>) {
  const [filter, setFilter] = useState(DEFAULT_CHARACTER_KNOWLEDGE_FILTER);
  const busy = input.controller.actionState !== "idle";
  const visible = useMemo(
    () => filterCharacterKnowledge(input.controller.entries, filter),
    [filter, input.controller.entries],
  );
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const characterId = form.get("characterId");
    const draft = stateDraft(form, input.referenceOptions);
    if (typeof characterId === "string" && characterId.length > 0 && draft !== null) {
      void input.controller.create(characterId as EntityId<"Character">, draft);
    }
  };
  return (
    <div className="character-knowledge-panel">
      {(input.controller.error !== null || input.controller.message !== null) && (
        <p className={input.controller.error === null ? "canon-feedback" : "canon-feedback is-error"} role={input.controller.error === null ? "status" : "alert"}>{input.controller.error ?? input.controller.message}</p>
      )}
      {input.controller.pendingSelection !== null && (
        <section aria-label="선택 원문을 인물 지식으로 저장" className="knowledge-selection-composer">
          <header><div><span className="canon-eyebrow">Exact evidence</span><h3>선택 원문을 인물 지식으로 저장</h3></div><button onClick={input.controller.clearPendingSelection} type="button">취소</button></header>
          <blockquote>{input.controller.pendingSelection.exactText}</blockquote>
          <form aria-label="선택 인물 지식 저장" key={`${input.controller.pendingSelection.sourceRange.documentRevisionId}:${input.controller.pendingSelection.sourceRange.from}`} onSubmit={create}>
            <label><span>대상 인물</span><select name="characterId" required><option value="">인물을 선택하세요</option>{input.characters.filter((entry) => entry.retiredAt === null).map((entry) => <option key={entry.characterId} value={entry.characterId}>{entry.name}</option>)}</select></label>
            <StateFields defaultStatement={input.controller.pendingSelection.exactText} defaultStance="knows" defaultTruth="unknown" />
            <ReferenceChoices defaults={[]} options={input.referenceOptions} />
            <button disabled={busy} type="submit">인물 지식 저장</button>
          </form>
        </section>
      )}
      <div className="canon-review-grid character-knowledge-grid">
        <section aria-label="인물 지식 목록" className="canon-review-column knowledge-list-column">
          <header><div><span className="canon-eyebrow">Knowledge</span><h3>인물 지식·믿음</h3></div><button disabled={busy} onClick={() => void input.controller.refresh()} type="button">새로고침</button></header>
          <form aria-label="인물 지식 필터" className="knowledge-filter-form">
            <select aria-label="상태" onChange={(event) => setFilter((current) => ({ ...current, status: event.currentTarget.value as typeof current.status }))} value={filter.status}><option value="current">현재</option><option value="history">이전 상태</option><option value="all">전체</option></select>
            <select aria-label="인물" onChange={(event) => setFilter((current) => ({ ...current, characterId: event.currentTarget.value || null }))} value={filter.characterId ?? ""}><option value="">모든 인물</option>{input.characters.map((entry) => <option key={entry.characterId} value={entry.characterId}>{entry.name}</option>)}</select>
            <input aria-label="내용 검색" onChange={(event) => setFilter((current) => ({ ...current, query: event.currentTarget.value }))} placeholder="내용 검색" value={filter.query} />
          </form>
          {visible.length === 0 ? <p className="canon-empty">표시할 인물 지식이 없습니다.</p> : <ol className="canon-candidate-list">{visible.map((entry) => <li key={entry.knowledgeId}><button aria-pressed={input.controller.selectedKnowledgeId === entry.knowledgeId} className={input.controller.selectedKnowledgeId === entry.knowledgeId ? "is-selected" : undefined} onClick={() => input.controller.selectEntry(entry.knowledgeId)} type="button"><strong>{entry.statement}</strong><span>{STANCE_LABELS[entry.stance]}</span><small>{TRUTH_LABELS[entry.truthStatus]} · {entry.status}</small></button></li>)}</ol>}
        </section>
        <KnowledgeDetail busy={busy} controller={input.controller} documentLabels={input.documentLabels} {...(input.onEvidenceOpen === undefined ? {} : { onEvidenceOpen: input.onEvidenceOpen })} referenceOptions={input.referenceOptions} />
        <PovColumn busy={busy} characters={input.characters} controller={input.controller} />
      </div>
    </div>
  );
}
