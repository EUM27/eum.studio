import { useMemo, useState } from "react";
import { Link2, Plus, Search, Trash2, UserRound } from "lucide-react";

import type { ChatGptOAuthConnectionStatus } from "../../application/assistant/chatgpt-oauth";
import {
  CHARACTER_EXTRACTION_MERGE_FIELDS,
  type CharacterExtractionCandidate,
  type CharacterExtractionDecision,
  type CharacterExtractionItem,
  type CharacterExtractionMergeField,
} from "../../application/characters/character-extraction-contract";
import type {
  CharacterGenerationBrief,
  CharacterGenerationCandidate,
  CharacterGenerationItem,
} from "../../application/characters/character-generation-contract";
import type {
  CharacterProjection,
  UpdateCharacterCommand,
} from "../../application/characters/character-contract";
import type {
  CharacterRelationProjection,
  UpdateCharacterRelationCommand,
} from "../../application/characters/character-relation-contract";
import {
  CharacterProfileFields,
  type CharacterDraft,
  type CharacterManagerActionState,
} from "./CharacterManagerDialog";
import { CharacterDrawTool } from "./CharacterDrawTool";
import type { CharacterDrawDraft } from "../../application/inspiration/inspiration-draw";

export type CharacterWorkspaceSelection = Readonly<{
  documentId: string;
  documentTitle: string;
  documentRevisionId: string;
  from: number;
  to: number;
}>;

export type CharacterExtractionActionState =
  | "idle"
  | "extracting"
  | "granting"
  | "deciding"
  | "adding-evidence";

export type CharacterGenerationActionState =
  | "idle"
  | "generating"
  | "deciding";

export type CharacterRelationActionState =
  | "idle"
  | "creating"
  | "updating"
  | "retiring";

export type CharacterRelationDraft = Readonly<{
  toCharacterId: string;
  kind: string;
  description: string;
}>;

const MERGE_FIELD_LABELS: Readonly<
  Record<CharacterExtractionMergeField, string>
> = {
  name: "이름",
  aliases: "별칭",
  role: "역할",
  summary: "요약",
  appearance: "외형",
  personality: "성격·가치관",
  speech: "말투",
  goal: "목표",
  conflict: "갈등",
  note: "메모",
};

function CandidateReviewCard(input: {
  readonly busy: boolean;
  readonly candidateStatus: "ready" | "stale" | "completed";
  readonly characters: readonly CharacterProjection[];
  readonly item: CharacterExtractionItem | CharacterGenerationItem;
  readonly onDecide: (decision: CharacterExtractionDecision) => void;
}) {
  const [targetCharacterId, setTargetCharacterId] = useState("");
  const [fields, setFields] = useState<readonly CharacterExtractionMergeField[]>(
    [],
  );
  const pending = input.item.status === "pending";
  const actionable = input.candidateStatus === "ready" && pending;
  const target = input.characters.find(
    (character) => character.characterId === targetCharacterId,
  );

  return (
    <article
      className="character-candidate-card"
      data-candidate-item={input.item.itemId}
    >
      <header>
        <div>
          <strong>{input.item.name}</strong>
          <span>{input.item.role || "역할 후보 없음"}</span>
        </div>
        <span className={`character-candidate-status is-${input.item.status}`}>
          {input.item.status === "pending"
            ? "검토 대기"
            : input.item.status === "created"
              ? "새 인물로 저장됨"
              : input.item.status === "merged"
                ? "기존 인물에 반영됨"
                : "제외됨"}
        </span>
      </header>

      {input.item.aliases.length > 0 && (
        <p>별칭 · {input.item.aliases.join(", ")}</p>
      )}
      {input.item.summary.length > 0 && <p>{input.item.summary}</p>}
      {"evidences" in input.item && input.item.evidences.length > 0 && (
        <div className="character-candidate-evidence-list">
          {input.item.evidences.map((evidence) => (
          <span
            key={`${evidence.documentId}:${evidence.from}:${evidence.to}`}
          >
            근거 {evidence.from.toLocaleString()}–{evidence.to.toLocaleString()}
          </span>
          ))}
        </div>
      )}

      {input.item.matchingCharacterIds.length > 0 && (
        <p className="character-candidate-match">
          같은 이름·별칭 후보 · {input.item.matchingCharacterIds
            .map((characterId) => input.characters.find(
              (character) => character.characterId === characterId,
            )?.name ?? characterId)
            .join(", ")}
        </p>
      )}

      {actionable && (
        <div className="character-candidate-actions">
          <button
            disabled={input.busy}
            onClick={() => input.onDecide({ kind: "create" })}
            type="button"
          >
            새로 만들기
          </button>
          <label>
            <span>합칠 인물</span>
            <select
              disabled={input.busy}
              onChange={(event) => setTargetCharacterId(event.target.value)}
              value={targetCharacterId}
            >
              <option value="">선택</option>
              {input.characters.map((character) => (
                <option
                  key={character.characterId}
                  value={character.characterId}
                >
                  {character.name}
                </option>
              ))}
            </select>
          </label>
          {target !== undefined && (
            <fieldset>
              <legend>반영할 필드</legend>
              {CHARACTER_EXTRACTION_MERGE_FIELDS.map((field) => (
                <label key={field}>
                  <input
                    checked={fields.includes(field)}
                    disabled={input.busy}
                    onChange={(event) => setFields((current) =>
                      event.target.checked
                        ? Object.freeze([...current, field])
                        : Object.freeze(current.filter((entry) => entry !== field))
                    )}
                    type="checkbox"
                  />
                  <span>{MERGE_FIELD_LABELS[field]}</span>
                </label>
              ))}
            </fieldset>
          )}
          <button
            disabled={input.busy || target === undefined || fields.length === 0}
            onClick={() => {
              if (target === undefined || fields.length === 0) return;
               input.onDecide({
                kind: "merge",
                targetCharacterId: target.characterId,
                expectedCharacterRevision: target.revision,
                fields,
              });
            }}
            type="button"
          >
            선택한 필드 합치기
          </button>
          <button
            disabled={input.busy}
            onClick={() => input.onDecide({ kind: "exclude" })}
            type="button"
          >
            제외
          </button>
        </div>
      )}
    </article>
  );
}

export function CharacterCandidateReviewPanel(input: {
  readonly busy: boolean;
  readonly candidates: readonly CharacterExtractionCandidate[];
  readonly characters: readonly CharacterProjection[];
  readonly generationCandidates: readonly CharacterGenerationCandidate[];
  readonly onDecideCandidate: (
    candidate: CharacterExtractionCandidate,
    item: CharacterExtractionItem,
    decision: CharacterExtractionDecision,
  ) => void;
  readonly onDecideGenerationCandidate: (
    candidate: CharacterGenerationCandidate,
    item: CharacterGenerationItem,
    decision: CharacterExtractionDecision,
  ) => void;
}) {
  const pendingCount = input.candidates.reduce(
    (count, candidate) => count + candidate.items.filter(
      (item) => item.status === "pending",
    ).length,
    0,
  ) + input.generationCandidates.reduce(
    (count, candidate) => count + candidate.items.filter(
      (item) => item.status === "pending",
    ).length,
    0,
  );

  return (
    <section
      aria-label="인물 후보 검토"
      className="character-workspace-candidates assistant-character-candidates"
    >
      <header>
        <div>
          <p className="panel-kicker">ASSISTANT</p>
          <h3>인물 후보</h3>
        </div>
        <span>{pendingCount}</span>
      </header>
      {input.candidates.length === 0 && input.generationCandidates.length === 0 ? (
        <p className="character-manager-empty">저장된 인물 후보가 없습니다.</p>
      ) : (
        <div className="character-candidate-list">
          {input.candidates.map((candidate) => (
            <section key={candidate.candidateId}>
              <header>
                <span>{candidate.modelId}</span>
                <span>
                  {candidate.status === "stale"
                    ? "원고 변경으로 만료됨"
                    : candidate.status === "completed"
                      ? "검토 완료"
                      : "검토 중"}
                </span>
              </header>
              {candidate.items.length === 0 ? (
                <p>이 범위에서 명시적인 인물을 찾지 못했습니다.</p>
              ) : candidate.items.map((item) => (
                <CandidateReviewCard
                  busy={input.busy}
                  candidateStatus={candidate.status}
                  characters={input.characters}
                  item={item}
                  key={item.itemId}
                  onDecide={(decision) => input.onDecideCandidate(
                    candidate,
                    item,
                    decision,
                  )}
                />
              ))}
            </section>
          ))}
          {input.generationCandidates.map((candidate) => (
            <section key={candidate.candidateId}>
              <header>
                <span>설정 생성 · {candidate.modelId}</span>
                <span>
                  {candidate.status === "completed" ? "검토 완료" : "검토 중"}
                </span>
              </header>
              {candidate.items.map((item) => (
                <CandidateReviewCard
                  busy={input.busy}
                  candidateStatus={candidate.status}
                  characters={input.characters}
                  item={item}
                  key={item.itemId}
                  onDecide={(decision) => input.onDecideGenerationCandidate(
                    candidate,
                    item,
                    decision,
                  )}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function CharacterRelationRow(input: {
  readonly busy: boolean;
  readonly characters: readonly CharacterProjection[];
  readonly relation: CharacterRelationProjection;
  readonly onRetire: (relation: CharacterRelationProjection) => void;
  readonly onUpdate: (
    relation: CharacterRelationProjection,
    changes: UpdateCharacterRelationCommand["changes"],
  ) => void;
}) {
  const [kind, setKind] = useState(input.relation.kind);
  const [description, setDescription] = useState(input.relation.description);
  const fromName = input.characters.find(
    (character) => character.characterId === input.relation.fromCharacterId,
  )?.name ?? "삭제된 인물";
  const toName = input.characters.find(
    (character) => character.characterId === input.relation.toCharacterId,
  )?.name ?? "삭제된 인물";
  const changed =
    kind.trim() !== input.relation.kind ||
    description !== input.relation.description;

  return (
    <li className="character-relation-item">
      <header>
        <Link2 aria-hidden="true" size={14} />
        <strong>{fromName} → {toName}</strong>
      </header>
      <label>
        <span>{fromName} → {toName} 관계 종류</span>
        <input
          disabled={input.busy}
          onChange={(event) => setKind(event.target.value)}
          value={kind}
        />
      </label>
      <label>
        <span>{fromName} → {toName} 관계 설명</span>
        <textarea
          disabled={input.busy}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          value={description}
        />
      </label>
      <div className="character-relation-actions">
        <button
          disabled={input.busy || !changed || kind.trim().length === 0}
          onClick={() => input.onUpdate(input.relation, {
            kind: kind.trim(),
            description,
          })}
          type="button"
        >
          관계 저장
        </button>
        <button
          disabled={input.busy}
          onClick={() => input.onRetire(input.relation)}
          type="button"
        >
          <Trash2 aria-hidden="true" size={13} />
          관계 삭제
        </button>
      </div>
    </li>
  );
}

function CharacterRelationsEditor(input: {
  readonly actionState: CharacterRelationActionState;
  readonly character: CharacterProjection;
  readonly characters: readonly CharacterProjection[];
  readonly relations: readonly CharacterRelationProjection[];
  readonly onCreate: (draft: CharacterRelationDraft) => void;
  readonly onRetire: (relation: CharacterRelationProjection) => void;
  readonly onUpdate: (
    relation: CharacterRelationProjection,
    changes: UpdateCharacterRelationCommand["changes"],
  ) => void;
}) {
  const [toCharacterId, setToCharacterId] = useState("");
  const [kind, setKind] = useState("");
  const [description, setDescription] = useState("");
  const busy = input.actionState !== "idle";
  const targets = input.characters.filter(
    (character) => character.characterId !== input.character.characterId,
  );
  const activeRelations = input.relations.filter((relation) =>
    relation.retiredAt === null &&
    (
      relation.fromCharacterId === input.character.characterId ||
      relation.toCharacterId === input.character.characterId
    )
  );

  return (
    <section aria-label="인물 관계" className="character-workspace-relations">
      <header>
        <h3>관계</h3>
        <span>{activeRelations.length}</span>
      </header>
      {targets.length === 0 ? (
        <p>관계를 연결하려면 다른 인물을 먼저 만드세요.</p>
      ) : (
        <div className="character-relation-create">
          <label>
            <span>관계 대상</span>
            <select
              disabled={busy}
              onChange={(event) => setToCharacterId(event.target.value)}
              value={toCharacterId}
            >
              <option value="">선택</option>
              {targets.map((character) => (
                <option key={character.characterId} value={character.characterId}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>관계 종류</span>
            <input
              disabled={busy}
              onChange={(event) => setKind(event.target.value)}
              placeholder="예: 동료, 경쟁자"
              value={kind}
            />
          </label>
          <label>
            <span>관계 설명</span>
            <textarea
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              value={description}
            />
          </label>
          <button
            disabled={busy || toCharacterId.length === 0 || kind.trim().length === 0}
            onClick={() => {
              input.onCreate({
                toCharacterId,
                kind: kind.trim(),
                description,
              });
              setToCharacterId("");
              setKind("");
              setDescription("");
            }}
            type="button"
          >
            관계 추가
          </button>
        </div>
      )}
      {activeRelations.length === 0 ? (
        <p>등록한 관계가 없습니다.</p>
      ) : (
        <ul>
          {activeRelations.map((relation) => (
            <CharacterRelationRow
              busy={busy}
              characters={input.characters}
              key={`${relation.relationId}:${relation.revision}`}
              onRetire={input.onRetire}
              onUpdate={input.onUpdate}
              relation={relation}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function CharacterWorkspace(input: {
  readonly actionState: CharacterManagerActionState;
  readonly candidates: readonly CharacterExtractionCandidate[];
  readonly characters: readonly CharacterProjection[];
  readonly error: string | null;
  readonly extractionActionState: CharacterExtractionActionState;
  readonly extractionError: string | null;
  readonly generationActionState: CharacterGenerationActionState;
  readonly generationCandidates: readonly CharacterGenerationCandidate[];
  readonly generationError: string | null;
  readonly inspirationBusy: boolean;
  readonly inspirationKeywords: readonly string[];
  readonly relationActionState: CharacterRelationActionState;
  readonly relations: readonly CharacterRelationProjection[];
  readonly oauthStatus: ChatGptOAuthConnectionStatus | null;
  readonly onAddEvidence: (character: CharacterProjection) => void;
  readonly onAddInspirationKeywords: (keywords: readonly string[]) => void;
  readonly onCreate: (draft: CharacterDraft) => void;
  readonly onDecideCandidate: (
    candidate: CharacterExtractionCandidate,
    item: CharacterExtractionItem,
    decision: CharacterExtractionDecision,
  ) => void;
  readonly onDecideGenerationCandidate: (
    candidate: CharacterGenerationCandidate,
    item: CharacterGenerationItem,
    decision: CharacterExtractionDecision,
  ) => void;
  readonly onOpenEvidence: (
    character: CharacterProjection,
    evidence: CharacterProjection["evidences"][number],
  ) => void;
  readonly onOpenSettings: () => void;
  readonly onDeleteInspirationKeyword: (keyword: string) => void;
  readonly onCreateRelation: (
    character: CharacterProjection,
    draft: CharacterRelationDraft,
  ) => void;
  readonly onRequestExtractionPermission: () => void;
  readonly onRetire: (character: CharacterProjection) => void;
  readonly onRetireRelation: (relation: CharacterRelationProjection) => void;
  readonly onRunGeneration: (brief: CharacterGenerationBrief) => void;
  readonly onRunExtraction: () => void;
  readonly onSaveDraw: (draft: CharacterDrawDraft) => void;
  readonly onSelect: (characterId: string | null) => void;
  readonly onUpdate: (
    character: CharacterProjection,
    changes: UpdateCharacterCommand["changes"],
  ) => void;
  readonly onUpdateRelation: (
    relation: CharacterRelationProjection,
    changes: UpdateCharacterRelationCommand["changes"],
  ) => void;
  readonly permissionRequired: boolean;
  readonly selectedCharacterId: string | null;
  readonly selection: CharacterWorkspaceSelection | null;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const selectedCharacter = input.characters.find(
    (character) => character.characterId === input.selectedCharacterId,
  ) ?? null;
  const visibleCharacters = useMemo(() =>
    normalizedQuery.length === 0
      ? input.characters
      : input.characters.filter((character) =>
          [character.name, ...character.aliases, character.role]
            .join("\n")
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        ),
  [input.characters, normalizedQuery]);
  const busy =
    input.actionState !== "idle" ||
    input.relationActionState !== "idle" ||
    input.inspirationBusy;

  return (
    <section aria-label="인물 작업면" className="character-workspace">
      <div className="character-workspace-body">
        <aside aria-label="인물 목록" className="character-workspace-list">
          <div className="character-workspace-list-heading">
            <strong>인물 목록</strong>
            <button
              disabled={busy}
              onClick={() => input.onSelect(null)}
              type="button"
            >
              <Plus aria-hidden="true" size={13} />
              인물 추가
            </button>
          </div>
          <label className="character-workspace-search">
            <Search aria-hidden="true" size={15} />
            <input
              aria-label="인물 검색"
              disabled={busy}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름·별칭·역할 검색"
              value={query}
            />
          </label>
          {visibleCharacters.length === 0 ? (
            <p className="character-manager-empty">
              {input.characters.length === 0
                ? "이 작품에 등록한 인물이 없습니다."
                : "검색 결과가 없습니다."}
            </p>
          ) : (
            <ul>
              {visibleCharacters.map((character) => (
                <li key={character.characterId}>
                  <button
                    aria-pressed={character.characterId === selectedCharacter?.characterId}
                    disabled={busy}
                    onClick={() => input.onSelect(character.characterId)}
                    type="button"
                  >
                    <UserRound aria-hidden="true" size={16} />
                    <span>
                      <strong>{character.name}</strong>
                      <small>{character.role || "역할 미입력"}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main aria-label="인물 상세" className="character-workspace-detail">
          <CharacterProfileFields
            actionState={input.actionState}
            character={selectedCharacter}
            key={selectedCharacter?.characterId ?? "new-character-workspace"}
            onCreate={input.onCreate}
            onRetire={input.onRetire}
            onUpdate={input.onUpdate}
          />
          {selectedCharacter !== null && (
            <CharacterRelationsEditor
              actionState={input.relationActionState}
              character={selectedCharacter}
              characters={input.characters}
              onCreate={(draft) => input.onCreateRelation(
                selectedCharacter,
                draft,
              )}
              onRetire={input.onRetireRelation}
              onUpdate={input.onUpdateRelation}
              relations={input.relations}
            />
          )}
          {selectedCharacter !== null && (
            <section className="character-workspace-evidence">
              <header>
                <h3>등장·근거</h3>
                <button
                  disabled={busy || input.selection === null}
                  onClick={() => input.onAddEvidence(selectedCharacter)}
                  type="button"
                >
                  현재 선택 연결
                </button>
              </header>
              {selectedCharacter.evidences.length === 0 ? (
                <p>연결한 원고 근거가 없습니다.</p>
              ) : (
                <ul>
                  {selectedCharacter.evidences.map((evidence) => (
                    <li key={evidence.anchorId}>
                      <button
                        disabled={busy}
                        onClick={() => input.onOpenEvidence(
                          selectedCharacter,
                          evidence,
                        )}
                        type="button"
                      >
                        {evidence.integrity === "resolved" && evidence.range !== null
                          ? `${evidence.range.from.toLocaleString()}–${evidence.range.to.toLocaleString()}`
                          : evidence.integrity === "needsReview"
                            ? "위치 검토 필요"
                            : "연결 손상"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>

        <CharacterDrawTool
          busy={busy}
          keywords={input.inspirationKeywords}
          onAddKeywords={input.onAddInspirationKeywords}
          onDeleteKeyword={input.onDeleteInspirationKeyword}
          onSave={input.onSaveDraw}
        />
      </div>

      {input.error !== null && (
        <p className="character-workspace-error" role="alert">
          {input.error}
        </p>
      )}
    </section>
  );
}
