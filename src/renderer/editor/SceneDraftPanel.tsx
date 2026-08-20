import { useState, type FormEvent } from "react";

import type {
  ChatGptOAuthConnectionStatus,
} from "../../application/assistant/chatgpt-oauth";
import type {
  CharacterProjection,
} from "../../application/characters/character-contract";
import type {
  LoreEntryProjection,
} from "../../application/lore/lore-entry-contract";
import type {
  PlotThreadProjection,
} from "../../application/plots/plot-contract";
import type {
  SceneDraftCandidate,
} from "../../application/structure/scene-draft-contract";

export type SceneDraftActionState =
  | "idle"
  | "generating"
  | "updating"
  | "applying";

function insertionDiff(text: string): string {
  return text.split("\n").map((line) => `+ ${line}`).join("\n");
}

function CandidateCard(input: {
  readonly actionState: SceneDraftActionState;
  readonly candidate: SceneDraftCandidate;
  readonly documentLabel: string;
  readonly onApply: (candidate: SceneDraftCandidate) => void;
  readonly onCompare: (candidate: SceneDraftCandidate) => void;
  readonly onRegenerate: (candidate: SceneDraftCandidate) => void;
  readonly onUpdate: (candidate: SceneDraftCandidate, draftText: string) => void;
}) {
  const [draftText, setDraftText] = useState(input.candidate.draftText);
  const candidate = input.candidate;
  const busy = input.actionState !== "idle";
  return (
    <article
      className="scene-draft-candidate"
      data-scene-draft-candidate={candidate.candidateId}
    >
      <header>
        <div>
          <strong>{candidate.context.plot.title}</strong>
          <small>{`${input.documentLabel} · ${candidate.target.insertionOffset.toLocaleString()}자 위치`}</small>
        </div>
        <span>
          {candidate.status === "applied"
            ? "원고 반영됨"
            : candidate.integrity === "current"
              ? "검토 대기"
              : candidate.integrity === "inserted"
                ? "삽입 완료 기록 대기"
                : "기준 변경됨"}
        </span>
      </header>
      <textarea
        aria-label={`${candidate.context.plot.title} 장면 초안`}
        disabled={busy || candidate.status === "applied" || candidate.integrity !== "current"}
        onChange={(event) => setDraftText(event.currentTarget.value)}
        rows={12}
        value={draftText}
      />
      <details className="scene-draft-diff" open>
        <summary>삽입 위치와 변경 diff</summary>
        <p>{`${input.documentLabel}의 ${candidate.target.insertionOffset.toLocaleString()}자 위치에 다음 텍스트만 추가합니다.`}</p>
        <pre>{insertionDiff(draftText)}</pre>
      </details>
      <details className="scene-draft-context">
        <summary>GPT에 보낸 연결 컨텍스트</summary>
        <dl>
          <dt>연결 사건</dt>
          <dd>{candidate.context.events.map((event) => event.title).join(", ") || "없음"}</dd>
          <dt>선택 캐릭터</dt>
          <dd>{candidate.context.characters.map((character) => character.name).join(", ") || "없음"}</dd>
          <dt>선택 설정</dt>
          <dd>{candidate.context.settings.map((setting) => setting.title).join(", ") || "없음"}</dd>
        </dl>
      </details>
      <div className="scene-draft-actions">
        {candidate.status === "ready" && candidate.integrity === "current" && (
          <>
            <button
              disabled={busy || draftText.trim().length === 0 || draftText === candidate.draftText}
              onClick={() => input.onUpdate(candidate, draftText)}
              type="button"
            >
              후보 변경 저장
            </button>
            <button
              disabled={busy || draftText !== candidate.draftText}
              onClick={() => input.onApply(candidate)}
              type="button"
            >
              이 위치에 삽입
            </button>
          </>
        )}
        {candidate.status === "ready" && candidate.integrity === "inserted" && (
          <button disabled={busy} onClick={() => input.onApply(candidate)} type="button">
            삽입 완료 기록
          </button>
        )}
        {candidate.status === "ready" && candidate.integrity === "stale" && (
          <>
            <button disabled={busy} onClick={() => input.onCompare(candidate)} type="button">
              현재 원고와 비교
            </button>
            <button disabled={busy} onClick={() => input.onRegenerate(candidate)} type="button">
              다시 생성
            </button>
            <span>이 후보는 원본 그대로 보관됩니다.</span>
          </>
        )}
      </div>
    </article>
  );
}

export function SceneDraftPanel(input: {
  readonly actionState: SceneDraftActionState;
  readonly candidates: readonly SceneDraftCandidate[];
  readonly characters: readonly CharacterProjection[];
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly error: string | null;
  readonly linkedEventCount: number;
  readonly oauthStatus: ChatGptOAuthConnectionStatus | null;
  readonly onApply: (candidate: SceneDraftCandidate) => void;
  readonly onCompare: (candidate: SceneDraftCandidate) => void;
  readonly onGenerate: (
    plot: PlotThreadProjection,
    characterIds: readonly CharacterProjection["characterId"][],
    settingIds: readonly LoreEntryProjection["loreEntryId"][],
  ) => void;
  readonly onOpenSettings: () => void;
  readonly onRegenerate: (candidate: SceneDraftCandidate) => void;
  readonly onUpdate: (candidate: SceneDraftCandidate, draftText: string) => void;
  readonly plot: PlotThreadProjection;
  readonly settings: readonly LoreEntryProjection[];
}) {
  const [characterIds, setCharacterIds] = useState<readonly string[]>([]);
  const [settingIds, setSettingIds] = useState<readonly string[]>([]);
  const connected = input.oauthStatus?.connected === true;
  const busy = input.actionState !== "idle";
  const candidates = input.candidates.filter(
    (candidate) => candidate.context.plot.plotThreadId === input.plot.plotThreadId,
  );
  const toggle = (values: readonly string[], value: string, checked: boolean) =>
    checked ? [...values, value] : values.filter((entry) => entry !== value);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    input.onGenerate(
      input.plot,
      characterIds as readonly CharacterProjection["characterId"][],
      settingIds as readonly LoreEntryProjection["loreEntryId"][],
    );
  };

  return (
    <section aria-label="장면 초안" className="scene-draft-panel">
      <header>
        <div>
          <span>장면 초안</span>
          <strong>{candidates.length}</strong>
        </div>
        <small>{`연결 사건 ${input.linkedEventCount}개`}</small>
      </header>
      {!connected && (
        <p>
          GPT 연결 후 플롯 기반 장면 초안을 만들 수 있습니다.{" "}
          <button onClick={input.onOpenSettings} type="button">AI 연결 설정</button>
        </p>
      )}
      <details className="scene-draft-generate" open={candidates.length === 0}>
        <summary>새 장면 초안 생성</summary>
        <form onSubmit={submit}>
          <fieldset>
            <legend>이번 요청에 연결할 캐릭터</legend>
            {input.characters.length === 0 ? <p>선택할 캐릭터가 없습니다.</p> : (
              input.characters.map((character) => (
                <label key={character.characterId}>
                  <input
                    checked={characterIds.includes(character.characterId)}
                    disabled={busy}
                    onChange={(event) => setCharacterIds((current) =>
                      toggle(current, character.characterId, event.currentTarget.checked)
                    )}
                    type="checkbox"
                  />
                  {character.name}
                </label>
              ))
            )}
          </fieldset>
          <fieldset>
            <legend>이번 요청에 연결할 설정</legend>
            {input.settings.length === 0 ? <p>선택할 설정이 없습니다.</p> : (
              input.settings.map((setting) => (
                <label key={setting.loreEntryId}>
                  <input
                    checked={settingIds.includes(setting.loreEntryId)}
                    disabled={busy}
                    onChange={(event) => setSettingIds((current) =>
                      toggle(current, setting.loreEntryId, event.currentTarget.checked)
                    )}
                    type="checkbox"
                  />
                  {setting.title}
                </label>
              ))
            )}
          </fieldset>
          <button disabled={busy || !connected} type="submit">
            {input.actionState === "generating" ? "초안 만드는 중" : "장면 초안 생성"}
          </button>
        </form>
      </details>
      {input.error !== null && <p className="event-action-error" role="alert">{input.error}</p>}
      <div className="scene-draft-candidates">
        {candidates.map((candidate) => (
          <CandidateCard
            actionState={input.actionState}
            candidate={candidate}
            documentLabel={input.documentLabels[candidate.target.documentId] ?? "대상 회차"}
            key={`${candidate.candidateId}:${candidate.revision}`}
            onApply={input.onApply}
            onCompare={input.onCompare}
            onRegenerate={input.onRegenerate}
            onUpdate={input.onUpdate}
          />
        ))}
      </div>
    </section>
  );
}
