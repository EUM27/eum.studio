import { Dices, RefreshCw, X } from "lucide-react";
import { useState } from "react";

import inspirationDrawProfileValue from "../../../config/inspiration-draw.json";
import {
  drawEvents,
  parseInspirationDrawProfile,
  parseKeywordDraft,
  type EventDrawDraft,
} from "../../application/inspiration/inspiration-draw";

const inspirationDrawProfile = parseInspirationDrawProfile(
  inspirationDrawProfileValue,
);

export function EventDrawTool(input: {
  readonly busy: boolean;
  readonly keywords: readonly string[];
  readonly onAddKeywords: (keywords: readonly string[]) => void;
  readonly onDeleteKeyword: (keyword: string) => void;
  readonly onSave: (draft: EventDrawDraft) => void;
}) {
  const [draft, setDraft] = useState<EventDrawDraft>(() => Object.freeze({
    cards: Object.freeze([]),
  }));
  const [keywordDraft, setKeywordDraft] = useState("");
  const hasDraw = draft.cards.length > 0;

  const addKeywords = () => {
    const keywords = parseKeywordDraft(keywordDraft);
    if (keywords.length === 0) return;
    input.onAddKeywords(keywords);
    setKeywordDraft("");
  };

  return (
    <aside aria-label="사건 뽑기" className="inspiration-draw-tool event-draw-tool">
      <header>
        <div>
          <Dices aria-hidden="true" size={15} />
          <strong>사건 뽑기</strong>
        </div>
        <button
          aria-label="사건 다시 뽑기"
          disabled={input.busy}
          onClick={() => setDraft(drawEvents(inspirationDrawProfile, input.keywords))}
          title="다시 뽑기"
          type="button"
        >
          <RefreshCw aria-hidden="true" size={14} />
        </button>
      </header>

      <div className="inspiration-draw-results">
        {hasDraw ? draft.cards.map((card, index) => (
          <div key={`${card.title}:${index}`}>
            <span>카드 {index + 1}</span>
            <strong>{card.title}</strong>
            <small>{card.description}</small>
          </div>
        )) : (
          <p>아직 뽑은 사건이 없습니다.</p>
        )}
      </div>

      <button
        className="inspiration-draw-save"
        disabled={input.busy || !hasDraw}
        onClick={() => input.onSave(draft)}
        type="button"
      >
        플롯 항목으로 저장
      </button>

      <div className="inspiration-keyword-editor">
        <input
          aria-label="사건 뽑기 키워드"
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
      <div aria-label="사건 뽑기 사용자 키워드" className="inspiration-keywords">
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
