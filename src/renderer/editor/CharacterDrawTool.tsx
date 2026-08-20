import { Dices, RefreshCw, X } from "lucide-react";
import { useState } from "react";

import inspirationDrawProfileValue from "../../../config/inspiration-draw.json";
import {
  drawCharacter,
  parseInspirationDrawProfile,
  parseKeywordDraft,
  type CharacterDrawDraft,
} from "../../application/inspiration/inspiration-draw";

const inspirationDrawProfile = parseInspirationDrawProfile(
  inspirationDrawProfileValue,
);

export function CharacterDrawTool(input: {
  readonly busy: boolean;
  readonly keywords: readonly string[];
  readonly onAddKeywords: (keywords: readonly string[]) => void;
  readonly onDeleteKeyword: (keyword: string) => void;
  readonly onSave: (draft: CharacterDrawDraft) => void;
}) {
  const [draft, setDraft] = useState<CharacterDrawDraft>(() => Object.freeze({
    name: "",
    traits: Object.freeze([]),
  }));
  const [keywordDraft, setKeywordDraft] = useState("");
  const hasDraw = draft.traits.length > 0;

  const roll = () => {
    setDraft(drawCharacter(inspirationDrawProfile, input.keywords));
  };
  const addKeywords = () => {
    const keywords = parseKeywordDraft(keywordDraft);
    if (keywords.length === 0) return;
    input.onAddKeywords(keywords);
    setKeywordDraft("");
  };

  return (
    <aside aria-label="인물 뽑기" className="inspiration-draw-tool character-draw-tool">
      <header>
        <div>
          <Dices aria-hidden="true" size={15} />
          <strong>인물 뽑기</strong>
        </div>
        <button
          aria-label="인물 다시 뽑기"
          disabled={input.busy}
          onClick={roll}
          title="다시 뽑기"
          type="button"
        >
          <RefreshCw aria-hidden="true" size={14} />
        </button>
      </header>

      <label className="inspiration-draw-name">
        <span>이름</span>
        <input
          aria-label="뽑힌 인물 이름"
          disabled={input.busy}
          onChange={(event) => setDraft((current) => Object.freeze({
            ...current,
            name: event.target.value,
          }))}
          placeholder="인물 이름"
          value={draft.name}
        />
      </label>

      <div className="inspiration-draw-results">
        {hasDraw ? draft.traits.map((trait, index) => (
          <div key={`${trait.category}:${trait.value}:${index}`}>
            <span>{trait.category}</span>
            <strong>{trait.value}</strong>
          </div>
        )) : (
          <p>아직 뽑은 인물이 없습니다.</p>
        )}
      </div>

      <button
        className="inspiration-draw-save"
        disabled={input.busy || !hasDraw || draft.name.trim().length === 0}
        onClick={() => input.onSave(draft)}
        type="button"
      >
        인물 항목으로 저장
      </button>

      <div className="inspiration-keyword-editor">
        <input
          aria-label="인물 뽑기 키워드"
          disabled={input.busy}
          onChange={(event) => setKeywordDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addKeywords();
            }
          }}
          placeholder="키워드 추가"
          value={keywordDraft}
        />
        <button
          disabled={input.busy || keywordDraft.trim().length === 0}
          onClick={addKeywords}
          type="button"
        >
          추가
        </button>
      </div>
      <div aria-label="인물 뽑기 사용자 키워드" className="inspiration-keywords">
        {input.keywords.map((keyword) => (
          <button
            disabled={input.busy}
            key={keyword}
            onClick={() => input.onDeleteKeyword(keyword)}
            title={`${keyword} 삭제`}
            type="button"
          >
            <span>{keyword}</span>
            <X aria-hidden="true" size={11} />
          </button>
        ))}
        {input.keywords.length === 0 && <small>사용자 키워드 없음</small>}
      </div>
    </aside>
  );
}
