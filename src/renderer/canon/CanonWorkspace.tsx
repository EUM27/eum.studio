import { useMemo, useState, type FormEvent } from "react";

import type {
  CanonFieldChange,
  CanonFieldValue,
  CanonReviewCandidate,
  CanonReviewDecisionResult,
  CanonReviewItem,
  CanonReviewTargetSelection,
} from "../../application/canon/canon-review-contract";
import type { CharacterProjection } from "../../application/characters/character-contract";
import type { CharacterRelationProjection } from "../../application/characters/character-relation-contract";
import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import type { ExportCanonicalMarkdownResult } from "../../application/export/canonical-markdown-export";
import type { CanonTab } from "../navigation/studio-location";
import type { CanonReviewActionState } from "../features/canon/useCanonReviewController";
import {
  ContinuityPanel,
  type ContinuityPanelController,
  type ContinuityPanelEvidence,
  type ContinuitySubjectOption,
} from "./ContinuityPanel";
import type { ContinuityProjectedSource } from "../../application/continuity/continuity-thread-contract";
import type { CharacterKnowledgeProjection } from "../../application/continuity/character-knowledge-contract";
import {
  CharacterKnowledgePanel,
  type CharacterKnowledgePanelController,
  type CharacterKnowledgePanelEvidence,
  type CharacterKnowledgeReferenceOption,
} from "./CharacterKnowledgePanel";
import {
  AssistantContextPanel,
  type AssistantContextPanelController,
  type ContextEntityOption,
} from "./AssistantContextPanel";
import {
  NarrativeDigestPanel,
  type NarrativeDigestDocumentOption,
  type NarrativeDigestPanelController,
} from "./NarrativeDigestPanel";

export type CanonWorkspaceEvidence = Readonly<{
  key: string;
  documentId: string;
  documentRevisionId: string;
  from: number;
  to: number;
  exactText: string;
}>;

export type CanonWorkspaceController = Readonly<{
  candidates: readonly CanonReviewCandidate[];
  selectedCandidate: CanonReviewCandidate | null;
  selectedItem: CanonReviewItem | null;
  selectedCandidateId: string | null;
  selectedItemId: string | null;
  actionState: CanonReviewActionState;
  error: string | null;
  message: string | null;
  permissionRequired: boolean;
  selectCandidate: (candidateId: string | null) => void;
  selectItem: (itemId: string | null) => void;
  refreshCandidates: (
    status?: "all" | "actionable" | "completed",
  ) => Promise<boolean>;
  exportMarkdown: () => Promise<ExportCanonicalMarkdownResult | null>;
  grantPermissionAndRetry: () => Promise<CanonReviewCandidate | null>;
  updateItem: (
    candidate: CanonReviewCandidate,
    item: CanonReviewItem,
    fieldChanges: readonly CanonFieldChange[],
  ) => Promise<CanonReviewCandidate | null>;
  resolveTarget: (
    candidate: CanonReviewCandidate,
    item: CanonReviewItem,
    target: CanonReviewTargetSelection,
  ) => Promise<CanonReviewCandidate | null>;
  decideItem: (
    candidate: CanonReviewCandidate,
    item: CanonReviewItem,
    decision: "approve" | "reject",
  ) => Promise<CanonReviewDecisionResult | null>;
}>;

type CanonRecordKind = "character" | "character-relation" | "lore-entry";
type CanonRecord = Readonly<{
  evidence: readonly CanonWorkspaceEvidence[];
  fields: readonly Readonly<{ label: string; value: CanonFieldValue }>[];
  key: string;
  kind: CanonRecordKind;
  label: string;
  revision: number;
  retired: boolean;
  summary: string;
}>;

const TAB_LABELS: Readonly<Record<CanonTab, string>> = Object.freeze({
  canonical: "별빛",
  review: "변경 검토",
  continuity: "연속성",
  knowledge: "인물 지식",
  digest: "이야기 흐름",
  context: "문맥·활동",
});

const KIND_LABELS: Readonly<Record<CanonReviewItem["target"]["kind"], string>> = Object.freeze({
  character: "인물",
  "character-relation": "인물 관계",
  "lore-entry": "별빛",
  "character-knowledge": "인물 지식",
});

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  name: "이름",
  aliases: "별칭",
  role: "역할",
  summary: "요약",
  appearance: "외형",
  personality: "성격",
  speech: "말투",
  goal: "목표",
  conflict: "갈등",
  note: "메모",
  fromCharacterId: "출발 인물",
  toCharacterId: "도착 인물",
  kind: "관계 종류",
  description: "관계 설명",
  title: "제목",
  content: "내용",
  category: "분류",
  enabled: "활성",
  characterId: "대상 인물",
  statement: "지식·믿음 내용",
  stance: "인물의 인식",
  truthStatus: "객관적 사실 여부",
  aboutRefKeys: "관련 정보",
});

function displayValue(value: CanonFieldValue | null): string {
  if (value === null) return "없음";
  if (typeof value === "boolean") return value ? "활성" : "비활성";
  if (typeof value === "string") return value.length === 0 ? "비어 있음" : value;
  return value.length === 0 ? "없음" : value.join(", ");
}

function approvedRelationEvidence(
  candidates: readonly CanonReviewCandidate[],
  relation: CharacterRelationProjection,
): readonly CanonWorkspaceEvidence[] {
  const seen = new Set<string>();
  return Object.freeze(candidates.flatMap((candidate) => {
    if (candidate.workId !== relation.workId) return [];
    return candidate.items.flatMap((item) => {
      if (
        item.target.kind !== "character-relation" ||
        item.status !== "approved" ||
        item.appliedTargetId !== relation.relationId
      ) {
        return [];
      }
      return item.evidence.flatMap((entry) => {
        if (entry.anchorId === null || seen.has(entry.evidenceId)) return [];
        seen.add(entry.evidenceId);
        return [Object.freeze({
          key: entry.anchorId,
          documentId: entry.documentId,
          documentRevisionId: entry.documentRevisionId,
          from: entry.from,
          to: entry.to,
          exactText: entry.exactText,
        })];
      });
    });
  }));
}

function recordsFor(input: Readonly<{
  candidates: readonly CanonReviewCandidate[];
  characters: readonly CharacterProjection[];
  loreEntries: readonly LoreEntryProjection[];
  relations: readonly CharacterRelationProjection[];
}>): readonly CanonRecord[] {
  const names = new Map(input.characters.map((entry) => [entry.characterId, entry.name]));
  return Object.freeze([
    ...input.characters.map((entry): CanonRecord => Object.freeze({
      key: `character:${entry.characterId}`,
      kind: "character",
      label: entry.name,
      summary: entry.summary || entry.role || "인물 정보",
      revision: entry.revision,
      retired: entry.retiredAt !== null,
      evidence: Object.freeze(entry.evidences.flatMap((evidence) =>
        evidence.integrity === "resolved" && evidence.range !== null
          ? [Object.freeze({
              key: evidence.anchorId,
              documentId: evidence.documentId,
              documentRevisionId: evidence.documentRevisionId,
              from: evidence.range.from,
              to: evidence.range.to,
              exactText: evidence.exactText,
            })]
          : []
      )),
      fields: Object.freeze([
        { label: "별칭", value: entry.aliases },
        { label: "역할", value: entry.role },
        { label: "요약", value: entry.summary },
        { label: "외형", value: entry.appearance },
        { label: "성격", value: entry.personality },
        { label: "말투", value: entry.speech },
        { label: "목표", value: entry.goal },
        { label: "갈등", value: entry.conflict },
        { label: "메모", value: entry.note },
      ]),
    })),
    ...input.relations.map((entry): CanonRecord => Object.freeze({
      key: `character-relation:${entry.relationId}`,
      kind: "character-relation",
      label: `${names.get(entry.fromCharacterId) ?? entry.fromCharacterId} → ${
        names.get(entry.toCharacterId) ?? entry.toCharacterId
      }`,
      summary: entry.kind,
      revision: entry.revision,
      retired: entry.retiredAt !== null,
      evidence: approvedRelationEvidence(input.candidates, entry),
      fields: Object.freeze([
        { label: "관계 종류", value: entry.kind },
        { label: "관계 설명", value: entry.description },
      ]),
    })),
    ...input.loreEntries.map((entry): CanonRecord => Object.freeze({
      key: `lore-entry:${entry.loreEntryId}`,
      kind: "lore-entry",
      label: entry.title,
      summary: entry.category || entry.content,
      revision: entry.revision,
      retired: entry.retiredAt !== null,
      evidence: Object.freeze(entry.evidences.flatMap((evidence) =>
        evidence.integrity === "resolved" && evidence.range !== null
          ? [Object.freeze({
              key: evidence.anchorId,
              documentId: evidence.sourceDocumentId,
              documentRevisionId: evidence.sourceDocumentRevisionId,
              from: evidence.range.from,
              to: evidence.range.to,
              exactText: evidence.exactText,
            })]
          : []
      )),
      fields: Object.freeze([
        { label: "분류", value: entry.category },
        { label: "별칭", value: entry.aliases },
        { label: "내용", value: entry.content },
        { label: "상태", value: entry.enabled },
      ]),
    })),
  ]);
}

function CandidateList(input: Readonly<{
  controller: CanonWorkspaceController;
}>) {
  const { controller } = input;
  return (
    <section aria-label="변경 후보" className="canon-review-column canon-candidate-column">
      <header>
        <div>
          <span className="canon-eyebrow">Candidate</span>
          <h3>변경 후보</h3>
        </div>
        <button
          disabled={controller.actionState !== "idle"}
          onClick={() => void controller.refreshCandidates()}
          type="button"
        >
          새로고침
        </button>
      </header>
      {controller.candidates.length === 0 ? (
        <p className="canon-empty">검토할 변경 후보가 없습니다.</p>
      ) : (
        <ol className="canon-candidate-list">
          {controller.candidates.map((candidate) => (
            <li key={candidate.candidateId}>
              <button
                aria-pressed={controller.selectedCandidateId === candidate.candidateId}
                className={controller.selectedCandidateId === candidate.candidateId
                  ? "is-selected"
                  : undefined}
                onClick={() => controller.selectCandidate(candidate.candidateId)}
                type="button"
              >
                <strong>{candidate.items[0]?.targetHint ?? "변경 후보"}</strong>
                <span>{candidate.items.length}건 · {candidate.status}</span>
                <small>{new Date(candidate.updatedAt).toLocaleString("ko-KR")}</small>
              </button>
              {controller.selectedCandidateId === candidate.candidateId && (
                <ol className="canon-item-list" aria-label="후보 변경 항목">
                  {candidate.items.map((item) => (
                    <li key={item.itemId}>
                      <button
                        aria-current={controller.selectedItemId === item.itemId
                          ? "true"
                          : undefined}
                        onClick={() => controller.selectItem(item.itemId)}
                        type="button"
                      >
                        <span>{KIND_LABELS[item.target.kind]}</span>
                        <strong>{item.targetHint}</strong>
                        <small>{item.status}</small>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function parseEditedValue(value: FormDataEntryValue | null, original: CanonFieldValue) {
  const text = typeof value === "string" ? value : "";
  if (Array.isArray(original)) {
    return Object.freeze(text.split(",").map((entry) => entry.trim()).filter(Boolean));
  }
  if (typeof original === "boolean") return text === "true";
  return text;
}

function FieldChangeEditor(input: Readonly<{
  busy: boolean;
  candidate: CanonReviewCandidate;
  change: CanonFieldChange;
  controller: CanonWorkspaceController;
  item: CanonReviewItem;
}>) {
  const updateChanges = (next: CanonFieldChange) => {
    void input.controller.updateItem(
      input.candidate,
      input.item,
      input.item.fieldChanges.map((change) =>
        change.field === next.field ? next : change
      ),
    );
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateChanges(Object.freeze({
      ...input.change,
      after: parseEditedValue(form.get("after"), input.change.after),
    }));
  };
  return (
    <li className="canon-field-change">
      <header>
        <label>
          <input
            checked={input.change.selected}
            disabled={input.busy}
            onChange={(event) => updateChanges(Object.freeze({
              ...input.change,
              selected: event.currentTarget.checked,
            }))}
            type="checkbox"
          />
          {FIELD_LABELS[input.change.field] ?? input.change.field}
        </label>
      </header>
      <dl className="canon-diff-values">
        <div>
          <dt>현재</dt>
          <dd>{displayValue(input.change.before)}</dd>
        </div>
        <div>
          <dt>제안</dt>
          <dd>{displayValue(input.change.after)}</dd>
        </div>
      </dl>
      <form key={`${input.candidate.revision}:${input.change.field}`} onSubmit={handleSubmit}>
        <label>
          <span>사용할 값</span>
          {typeof input.change.after === "boolean" ? (
            <select defaultValue={String(input.change.after)} name="after">
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          ) : (
            <textarea
              defaultValue={Array.isArray(input.change.after)
                ? input.change.after.join(", ")
                : input.change.after}
              name="after"
              rows={2}
            />
          )}
        </label>
        <button disabled={input.busy} type="submit">수정값 저장</button>
      </form>
    </li>
  );
}

function targetRevision(input: Readonly<{
  characters: readonly CharacterProjection[];
  id: string;
  item: CanonReviewItem;
  knowledgeEntries: readonly CharacterKnowledgeProjection[];
  loreEntries: readonly LoreEntryProjection[];
  relations: readonly CharacterRelationProjection[];
}>): number | null {
  if (input.item.target.kind === "character") {
    return input.characters.find((entry) => entry.characterId === input.id)?.revision ?? null;
  }
  if (input.item.target.kind === "character-relation") {
    return input.relations.find((entry) => entry.relationId === input.id)?.revision ?? null;
  }
  if (input.item.target.kind === "lore-entry") {
    return input.loreEntries.find((entry) => entry.loreEntryId === input.id)?.revision ?? null;
  }
  return input.knowledgeEntries.find((entry) => entry.knowledgeId === input.id)?.revision ?? null;
}

function ReviewDiff(input: Readonly<{
  characters: readonly CharacterProjection[];
  controller: CanonWorkspaceController;
  knowledgeEntries: readonly CharacterKnowledgeProjection[];
  loreEntries: readonly LoreEntryProjection[];
  relations: readonly CharacterRelationProjection[];
}>) {
  const candidate = input.controller.selectedCandidate;
  const item = input.controller.selectedItem;
  const busy = input.controller.actionState !== "idle";
  if (candidate === null || item === null) {
    return (
      <section aria-label="필드 변경 비교" className="canon-review-column canon-diff-column">
        <p className="canon-empty">왼쪽에서 검토할 항목을 선택해 주세요.</p>
      </section>
    );
  }
  const resolveTarget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("target");
    if (typeof value !== "string") return;
    let target: CanonReviewTargetSelection;
    if (value === "create") {
      target = Object.freeze({ kind: "create" });
    } else {
      const id = value.slice("update:".length);
      const expectedRevision = targetRevision({ ...input, id, item });
      if (expectedRevision === null) return;
      target = Object.freeze({ kind: "update", targetId: id, expectedRevision });
    }
    void input.controller.resolveTarget(candidate, item, target);
  };
  return (
    <section aria-label="필드 변경 비교" className="canon-review-column canon-diff-column">
      <header className="canon-review-item-heading">
        <div>
          <span className="canon-kind-badge">{KIND_LABELS[item.target.kind]}</span>
          <h3>{item.targetHint}</h3>
        </div>
        <span className={`canon-status-badge is-${item.status}`}>{item.status}</span>
      </header>
      <p className="canon-review-reason">{item.reason}</p>
      {item.assertionBasis === "model-inference" && (
        <p className="canon-warning" role="note">
          모델 추론 제안은 그대로 승인할 수 없습니다. 내용을 직접 확인한 뒤 기각하거나 관리 화면에서 직접 작성해 주세요.
        </p>
      )}
      {item.target.operation === "unresolved" && (
        <form className="canon-target-resolver" onSubmit={resolveTarget}>
          <label>
            <span>반영 대상</span>
            <select name="target">
              <option value="create">새 기록 만들기</option>
              {item.target.matchingTargetIds.map((id) => (
                <option key={id} value={`update:${id}`}>{id}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} type="submit">대상 확정</button>
        </form>
      )}
      <ol className="canon-field-change-list">
        {item.fieldChanges.map((change) => (
          <FieldChangeEditor
            busy={busy || item.status !== "pending"}
            candidate={candidate}
            change={change}
            controller={input.controller}
            item={item}
            key={change.field}
          />
        ))}
      </ol>
      <footer className="canon-decision-actions">
        <button
          className="is-secondary"
          disabled={busy || item.status !== "pending"}
          onClick={() => void input.controller.decideItem(candidate, item, "reject")}
          type="button"
        >
          기각
        </button>
        <button
          className="is-primary"
          disabled={busy || item.status !== "pending" || item.assertionBasis === "model-inference"}
          onClick={() => void input.controller.decideItem(candidate, item, "approve")}
          type="button"
        >
          승인
        </button>
      </footer>
    </section>
  );
}

function EvidenceColumn(input: Readonly<{
  documentLabels: Readonly<Record<string, string>>;
  evidence: readonly CanonWorkspaceEvidence[];
  onEvidenceOpen?: (evidence: CanonWorkspaceEvidence) => void;
}>) {
  return (
    <aside aria-label="원문 근거" className="canon-review-column canon-evidence-column">
      <header>
        <span className="canon-eyebrow">Evidence</span>
        <h3>원문 근거</h3>
      </header>
      {input.evidence.length === 0 ? (
        <p className="canon-empty">연결된 원문 근거가 없습니다.</p>
      ) : (
        <ol className="canon-evidence-list">
          {input.evidence.map((evidence) => (
            <li key={evidence.key}>
              <header>
                <strong>{input.documentLabels[evidence.documentId] ?? "원고"}</strong>
                <span>{evidence.from}–{evidence.to}</span>
              </header>
              <blockquote>{evidence.exactText}</blockquote>
              {input.onEvidenceOpen !== undefined && (
                <button onClick={() => input.onEvidenceOpen?.(evidence)} type="button">
                  원문 열기
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function CanonicalBrowser(input: Readonly<{
  candidates: readonly CanonReviewCandidate[];
  characters: readonly CharacterProjection[];
  documentLabels: Readonly<Record<string, string>>;
  loreEntries: readonly LoreEntryProjection[];
  onEvidenceOpen?: (evidence: CanonWorkspaceEvidence) => void;
  relations: readonly CharacterRelationProjection[];
  onManageCharacters?: (() => void) | undefined;
  onManageLore?: (() => void) | undefined;
}>) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | CanonRecordKind>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const records = useMemo(() => recordsFor(input), [input]);
  const visibleRecords = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return records.filter((record) =>
      (kind === "all" || record.kind === kind) &&
      (normalized.length === 0 || `${record.label} ${record.summary}`
        .toLocaleLowerCase("ko-KR")
        .includes(normalized))
    );
  }, [kind, query, records]);
  const selected = visibleRecords.find((record) => record.key === selectedKey) ??
    visibleRecords[0] ?? null;
  return (
    <div className="canon-browser-grid">
      <section aria-label="별빛 필터" className="canon-browser-filter canon-review-column">
        <label>
          <span>검색</span>
          <input
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="이름 또는 내용"
            type="search"
            value={query}
          />
        </label>
        <label>
          <span>종류</span>
          <select
            onChange={(event) => setKind(event.currentTarget.value as typeof kind)}
            value={kind}
          >
            <option value="all">전체</option>
            <option value="character">인물</option>
            <option value="character-relation">인물 관계</option>
            <option value="lore-entry">별빛</option>
          </select>
        </label>
        <dl className="canon-browser-counts">
          <div><dt>인물</dt><dd>{input.characters.length}</dd></div>
          <div><dt>관계</dt><dd>{input.relations.length}</dd></div>
          <div><dt>별빛</dt><dd>{input.loreEntries.length}</dd></div>
        </dl>
      </section>
      <section aria-label="별빛 목록" className="canon-review-column canon-browser-list">
        <header><h3>별빛 목록</h3><span>{visibleRecords.length}건</span></header>
        {visibleRecords.length === 0 ? (
          <div className="canon-empty">
            <p>{records.length === 0 ? "아직 등록한 인물과 설정이 없습니다." : "조건에 맞는 별빛이 없습니다."}</p>
            {records.length === 0 && <div className="canon-empty-actions">
              {input.onManageCharacters !== undefined && <button onClick={input.onManageCharacters} type="button">인물 추가·관리</button>}
              {input.onManageLore !== undefined && <button onClick={input.onManageLore} type="button">별빛 추가·관리</button>}
            </div>}
            {records.length > 0 && <button onClick={() => { setQuery(""); setKind("all"); }} type="button">전체 보기</button>}
          </div>
        ) : (
          <ol>
            {visibleRecords.map((record) => (
              <li key={record.key}>
                <button
                  aria-pressed={selected?.key === record.key}
                  className={selected?.key === record.key ? "is-selected" : undefined}
                  onClick={() => setSelectedKey(record.key)}
                  type="button"
                >
                  <span>{KIND_LABELS[record.kind]}</span>
                  <strong>{record.label}</strong>
                  <small>{record.summary || "기록 없음"}</small>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-label="별빛 상세" className="canon-review-column canon-browser-detail">
        {selected === null ? (
          <p className="canon-empty">별빛을 선택해 주세요.</p>
        ) : (
          <>
            <header>
              <div>
                <span className="canon-kind-badge">{KIND_LABELS[selected.kind]}</span>
                <h3>{selected.label}</h3>
              </div>
              <span>rev. {selected.revision}</span>
            </header>
            {selected.retired && <p className="canon-warning">은퇴한 별빛 기록입니다.</p>}
            <dl className="canon-record-fields">
              {selected.fields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{displayValue(field.value)}</dd>
                </div>
              ))}
            </dl>
            <section aria-label="별빛 원문 근거" className="canon-record-evidence">
              <h4>원문 근거</h4>
              {selected.evidence.length === 0 ? (
                <p className="canon-empty">연결된 원문 근거가 없습니다.</p>
              ) : (
                <ol className="canon-evidence-list">
                  {selected.evidence.map((evidence) => (
                    <li key={evidence.key}>
                      <header>
                        <strong>{input.documentLabels[evidence.documentId] ?? "원고"}</strong>
                        <span>{evidence.from}–{evidence.to}</span>
                      </header>
                      <blockquote>{evidence.exactText}</blockquote>
                      {input.onEvidenceOpen !== undefined && (
                        <button
                          onClick={() => input.onEvidenceOpen?.(evidence)}
                          type="button"
                        >
                          원문 열기
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}

export function CanonWorkspace(input: Readonly<{
  activeTab: CanonTab;
  characters: readonly CharacterProjection[];
  controller: CanonWorkspaceController;
  continuityController: ContinuityPanelController;
  continuitySubjectOptions: readonly ContinuitySubjectOption[];
  characterKnowledgeController: CharacterKnowledgePanelController;
  characterKnowledgeReferenceOptions: readonly CharacterKnowledgeReferenceOption[];
  contextPlannerController: AssistantContextPanelController;
  contextEntityOptions: readonly ContextEntityOption[];
  narrativeDigestController?: NarrativeDigestPanelController;
  narrativeDigestDocuments?: readonly NarrativeDigestDocumentOption[];
  documentLabels: Readonly<Record<string, string>>;
  loreEntries: readonly LoreEntryProjection[];
  onContinuityEvidenceOpen?: (evidence: ContinuityPanelEvidence) => void;
  onContinuitySourceOpen?: (source: ContinuityProjectedSource) => void;
  onCharacterKnowledgeEvidenceOpen?: (evidence: CharacterKnowledgePanelEvidence) => void;
  onEvidenceOpen?: (evidence: CanonWorkspaceEvidence) => void;
  onTabChange: (tab: CanonTab) => void;
  relations: readonly CharacterRelationProjection[];
  workTitle: string;
  onManageCharacters?: (() => void) | undefined;
  onManageLore?: (() => void) | undefined;
}>) {
  const evidence = input.controller.selectedItem?.evidence ?? [];
  const reviewEvidence = evidence.map((entry) => Object.freeze({
    key: entry.evidenceId,
    documentId: entry.documentId,
    documentRevisionId: entry.documentRevisionId,
    from: entry.from,
    to: entry.to,
    exactText: entry.exactText,
  }));
  return (
    <section aria-label="별빛 작업" className="canon-workspace">
      <header className="canon-workspace-header">
        <div>
          <span className="canon-eyebrow">{input.workTitle}</span>
          <h2>별빛</h2>
        </div>
        <nav aria-label="별빛 화면" className="canon-workspace-tabs" role="tablist">
          {(Object.keys(TAB_LABELS) as CanonTab[]).map((tab) => (
            <button
              aria-selected={input.activeTab === tab}
              className={input.activeTab === tab ? "is-active" : undefined}
              key={tab}
              onClick={() => input.onTabChange(tab)}
              role="tab"
              type="button"
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
        <div className="canon-markdown-export">
          <button
            disabled={input.controller.actionState !== "idle"}
            onClick={() => void input.controller.exportMarkdown()}
            type="button"
          >
            {input.controller.actionState === "exporting"
              ? "Markdown 내보내는 중…"
              : "별빛 Markdown 내보내기"}
          </button>
          <small>Obsidian 호환 단방향 사본 · 다시 가져오기 없음</small>
        </div>
      </header>
      {input.activeTab !== "continuity" && input.activeTab !== "knowledge" && input.activeTab !== "digest" && input.activeTab !== "context" &&
        (input.controller.error !== null || input.controller.message !== null) && (
        <p
          className={input.controller.error === null ? "canon-feedback" : "canon-feedback is-error"}
          role={input.controller.error === null ? "status" : "alert"}
        >
          {input.controller.error ?? input.controller.message}
        </p>
      )}
      {input.activeTab === "review" && input.controller.permissionRequired && (
        <div className="canon-permission" role="alert">
          <p>선택한 원문을 별빛 변경 점검에 사용하는 1회 권한이 필요합니다.</p>
          <button
            disabled={input.controller.actionState !== "idle"}
            onClick={() => void input.controller.grantPermissionAndRetry()}
            type="button"
          >
            이번 선택만 허용하고 다시 실행
          </button>
        </div>
      )}
      <div className="canon-workspace-content">
        {input.activeTab === "canonical" ? (
          <CanonicalBrowser
            candidates={input.controller.candidates}
            characters={input.characters}
            documentLabels={input.documentLabels}
            loreEntries={input.loreEntries}
            {...(input.onEvidenceOpen === undefined
              ? {}
              : { onEvidenceOpen: input.onEvidenceOpen })}
            relations={input.relations}
            onManageCharacters={input.onManageCharacters}
            onManageLore={input.onManageLore}
          />
        ) : input.activeTab === "review" ? (
          <div className="canon-review-grid">
            <CandidateList controller={input.controller} />
            <ReviewDiff
              characters={input.characters}
              controller={input.controller}
              knowledgeEntries={input.characterKnowledgeController.entries}
              loreEntries={input.loreEntries}
              relations={input.relations}
            />
            <EvidenceColumn
              documentLabels={input.documentLabels}
              evidence={reviewEvidence}
              {...(input.onEvidenceOpen === undefined
                ? {}
                : { onEvidenceOpen: input.onEvidenceOpen })}
            />
          </div>
        ) : input.activeTab === "continuity" ? (
          <ContinuityPanel
            controller={input.continuityController}
            documentLabels={input.documentLabels}
            {...(input.onContinuityEvidenceOpen === undefined
              ? {}
              : { onEvidenceOpen: input.onContinuityEvidenceOpen })}
            {...(input.onContinuitySourceOpen === undefined
              ? {}
              : { onProjectedSourceOpen: input.onContinuitySourceOpen })}
            subjectOptions={input.continuitySubjectOptions}
          />
        ) : input.activeTab === "knowledge" ? (
          <CharacterKnowledgePanel
            characters={input.characters}
            controller={input.characterKnowledgeController}
            documentLabels={input.documentLabels}
            {...(input.onCharacterKnowledgeEvidenceOpen === undefined
              ? {}
              : { onEvidenceOpen: input.onCharacterKnowledgeEvidenceOpen })}
            referenceOptions={input.characterKnowledgeReferenceOptions}
          />
        ) : input.activeTab === "digest" ? (
          input.narrativeDigestController === undefined ? null : (
            <NarrativeDigestPanel
              characters={input.characters}
              controller={input.narrativeDigestController}
              documents={input.narrativeDigestDocuments ?? []}
            />
          )
        ) : (
          <AssistantContextPanel
            characters={input.characters}
            controller={input.contextPlannerController}
            entityOptions={input.contextEntityOptions}
          />
        )}
      </div>
    </section>
  );
}
