import { useState } from "react";

import type {
  CharacterProjection,
  CreateCharacterCommand,
  UpdateCharacterCommand,
} from "../../application/characters/character-contract";

export type CharacterManagerActionState =
  | "idle"
  | "creating"
  | "updating"
  | "retiring";

export type CharacterDraft = Pick<
  CreateCharacterCommand,
  | "name"
  | "aliases"
  | "role"
  | "summary"
  | "appearance"
  | "personality"
  | "speech"
  | "goal"
  | "conflict"
  | "note"
>;

function parseAliases(value: string): readonly string[] {
  return Object.freeze([
    ...new Set(
      value
        .split(/[,\n]/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ]);
}

export function CharacterProfileFields(input: {
  readonly actionState: CharacterManagerActionState;
  readonly character: CharacterProjection | null;
  readonly onCreate: (draft: CharacterDraft) => void;
  readonly onRetire: (character: CharacterProjection) => void;
  readonly onUpdate: (
    character: CharacterProjection,
    changes: UpdateCharacterCommand["changes"],
  ) => void;
}) {
  const [name, setName] = useState(input.character?.name ?? "");
  const [aliases, setAliases] = useState(
    input.character?.aliases.join(", ") ?? "",
  );
  const [role, setRole] = useState(input.character?.role ?? "");
  const [summary, setSummary] = useState(input.character?.summary ?? "");
  const [appearance, setAppearance] = useState(
    input.character?.appearance ?? "",
  );
  const [personality, setPersonality] = useState(
    input.character?.personality ?? "",
  );
  const [speech, setSpeech] = useState(input.character?.speech ?? "");
  const [goal, setGoal] = useState(input.character?.goal ?? "");
  const [conflict, setConflict] = useState(input.character?.conflict ?? "");
  const [note, setNote] = useState(input.character?.note ?? "");
  const character = input.character;
  const busy = input.actionState !== "idle";
  const creating = character === null;

  return (
    <form
      className="character-manager-fields"
      onSubmit={(event) => {
        event.preventDefault();
        const profile = {
          name,
          aliases: parseAliases(aliases),
          role,
          summary,
          appearance,
          personality,
          speech,
          goal,
          conflict,
          note,
        };
        if (character === null) {
          input.onCreate(profile);
          return;
        }
        input.onUpdate(character, profile);
      }}
    >
      <label>
        <span>인물 이름</span>
        <input
          aria-label="인물 이름"
          autoFocus
          disabled={busy}
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="이름을 입력하세요"
          value={name}
        />
      </label>
      <label>
        <span>별칭</span>
        <input
          aria-label="인물 별칭"
          disabled={busy}
          name="aliases"
          onChange={(event) => setAliases(event.target.value)}
          placeholder="쉼표로 구분합니다"
          value={aliases}
        />
      </label>
      <label>
        <span>역할</span>
        <input
          aria-label="인물 역할"
          disabled={busy}
          name="role"
          onChange={(event) => setRole(event.target.value)}
          placeholder="자유롭게 적습니다"
          value={role}
        />
      </label>
      <label>
        <span>외형</span>
        <textarea
          aria-label="인물 외형"
          disabled={busy}
          name="appearance"
          onChange={(event) => setAppearance(event.target.value)}
          rows={3}
          value={appearance}
        />
      </label>
      <label>
        <span>성격·가치관</span>
        <textarea
          aria-label="인물 성격과 가치관"
          disabled={busy}
          name="personality"
          onChange={(event) => setPersonality(event.target.value)}
          rows={3}
          value={personality}
        />
      </label>
      <label>
        <span>말투</span>
        <textarea
          aria-label="인물 말투"
          disabled={busy}
          name="speech"
          onChange={(event) => setSpeech(event.target.value)}
          rows={3}
          value={speech}
        />
      </label>
      <label>
        <span>목표</span>
        <textarea
          aria-label="인물 목표"
          disabled={busy}
          name="goal"
          onChange={(event) => setGoal(event.target.value)}
          rows={2}
          value={goal}
        />
      </label>
      <label>
        <span>갈등</span>
        <textarea
          aria-label="인물 갈등"
          disabled={busy}
          name="conflict"
          onChange={(event) => setConflict(event.target.value)}
          rows={2}
          value={conflict}
        />
      </label>
      <label>
        <span>인물 요약</span>
        <textarea
          aria-label="인물 요약"
          disabled={busy}
          name="summary"
          onChange={(event) => setSummary(event.target.value)}
          placeholder="관점, 동기, 관계처럼 집필에 필요한 내용을 적습니다."
          rows={5}
          value={summary}
        />
      </label>
      <label>
        <span>작가 메모</span>
        <textarea
          aria-label="인물 작가 메모"
          disabled={busy}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="확인할 점이나 작업 메모를 적습니다."
          rows={3}
          value={note}
        />
      </label>
      <div className="character-manager-field-actions">
        {character !== null && (
          <button
            className="danger-action"
            disabled={busy}
            onClick={() => input.onRetire(character)}
            type="button"
          >
            {input.actionState === "retiring" ? "치우는 중" : "인물 치우기"}
          </button>
        )}
        <button
          className="primary-action"
          disabled={busy || name.trim().length === 0}
          type="submit"
        >
          {creating
            ? input.actionState === "creating" ? "만드는 중" : "인물 만들기"
            : input.actionState === "updating" ? "저장 중" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}

export function CharacterManagerDialog(input: {
  readonly actionState: CharacterManagerActionState;
  readonly characters: readonly CharacterProjection[];
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onCreate: (draft: CharacterDraft) => void;
  readonly onRetire: (character: CharacterProjection) => void;
  readonly onSelect: (characterId: string | null) => void;
  readonly onUpdate: (
    character: CharacterProjection,
    changes: UpdateCharacterCommand["changes"],
  ) => void;
  readonly selectedCharacterId: string | null;
}) {
  const [query, setQuery] = useState("");
  const busy = input.actionState !== "idle";
  const selectedCharacter = input.characters.find(
    (character) => character.characterId === input.selectedCharacterId,
  ) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCharacters = normalizedQuery.length === 0
    ? input.characters
    : input.characters.filter((character) =>
        `${character.name}\n${character.role}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      );

  return (
    <div className="dialog-backdrop character-manager-backdrop" role="presentation">
      <section
        aria-labelledby="character-manager-heading"
        aria-modal="true"
        className="character-manager-dialog"
        role="dialog"
      >
        <header className="character-manager-header">
          <div>
            <p className="panel-kicker">CHARACTERS</p>
            <h2 id="character-manager-heading">인물 관리</h2>
            <p>현재 작품의 인물 설정을 원고 가까이에서 관리합니다.</p>
          </div>
          <button
            aria-label="인물 관리 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="character-manager-body">
          <section aria-label="인물 목록" className="character-manager-list">
            <div className="character-manager-list-tools">
              <input
                aria-label="인물 검색"
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름·역할 검색"
                value={query}
              />
              <button
                disabled={busy}
                onClick={() => input.onSelect(null)}
                type="button"
              >
                새 인물
              </button>
            </div>
            {input.characters.length === 0 && (
              <p className="character-manager-empty">
                이 작품에 등록한 인물이 없습니다.
              </p>
            )}
            {input.characters.length > 0 && visibleCharacters.length === 0 && (
              <p className="character-manager-empty">검색 결과가 없습니다.</p>
            )}
            <ul>
              {visibleCharacters.map((character) => (
                <li key={character.characterId}>
                  <button
                    aria-pressed={character.characterId === selectedCharacter?.characterId}
                    disabled={busy}
                    onClick={() => input.onSelect(character.characterId)}
                    type="button"
                  >
                    <strong>{character.name}</strong>
                    <span>{character.role || "역할 미입력"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="인물 상세 편집" className="character-manager-detail">
            <CharacterProfileFields
              actionState={input.actionState}
              character={selectedCharacter}
              key={selectedCharacter?.characterId ?? "new-character"}
              onCreate={input.onCreate}
              onRetire={input.onRetire}
              onUpdate={input.onUpdate}
            />
          </section>
        </div>

        {input.error !== null && (
          <p className="character-manager-error" role="alert">{input.error}</p>
        )}
      </section>
    </div>
  );
}
