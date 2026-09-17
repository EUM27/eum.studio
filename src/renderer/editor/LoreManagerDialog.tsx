import { useState } from "react";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

import type {
  CreateLoreEntryCommand,
  LoreEntryEvidenceProjection,
  LoreEntryProjection,
  UpdateLoreEntryCommand,
} from "../../application/lore/lore-entry-contract";
import type {
  LoreForeshadowLinkProjection,
} from "../../application/lore/lore-foreshadow-link-contract";
import type {
  ForeshadowLineProjection,
} from "../../application/foreshadowing/foreshadow-line-contract";

export type LoreManagerActionState =
  | "idle"
  | "creating"
  | "updating"
  | "retiring"
  | "adding-evidence"
  | "linking-foreshadow"
  | "unlinking-foreshadow";

export type LoreEntryDraft = Pick<
  CreateLoreEntryCommand,
  "title" | "content" | "category" | "aliases" | "enabled"
> & {
  readonly includeCurrentSelection: boolean;
};

const HISTORY_LABELS: Readonly<
  Record<LoreEntryProjection["history"][number]["changeKind"], string>
> = Object.freeze({
  created: "생성",
  updated: "내용 변경",
  "evidence-added": "원고 근거 추가",
  retired: "목록에서 치움",
});

function aliasesFromText(value: string): readonly string[] {
  return Object.freeze(
    value
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function LoreEntryFields(input: {
  readonly actionState: LoreManagerActionState;
  readonly canCaptureEvidence: boolean;
  readonly entry: LoreEntryProjection | null;
  readonly onCreate: (draft: LoreEntryDraft) => void;
  readonly onRetire: (entry: LoreEntryProjection) => void;
  readonly onUpdate: (
    entry: LoreEntryProjection,
    changes: UpdateLoreEntryCommand["changes"],
  ) => void;
}) {
  const entry = input.entry;
  const creating = entry === null;
  const busy = input.actionState !== "idle";
  const [title, setTitle] = useState(entry?.title ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [aliases, setAliases] = useState(entry?.aliases.join("\n") ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [enabled, setEnabled] = useState(entry?.enabled ?? true);
  const [includeCurrentSelection, setIncludeCurrentSelection] = useState(
    input.canCaptureEvidence,
  );

  return (
    <form
      className="character-manager-fields lore-manager-fields"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedAliases = aliasesFromText(aliases);
        if (entry === null) {
          input.onCreate({
            title,
            content,
            category,
            aliases: normalizedAliases,
            enabled,
            includeCurrentSelection:
              input.canCaptureEvidence && includeCurrentSelection,
          });
          return;
        }
        input.onUpdate(entry, {
          title,
          content,
          category,
          aliases: normalizedAliases,
          enabled,
        });
      }}
    >
      <label>
        <span>별빛 이름</span>
        <input
          aria-label="별빛 이름"
          autoFocus
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="설정·장소·규칙의 이름을 적습니다"
          value={title}
        />
      </label>
      <label>
        <span>사용자 분류</span>
        <input
          aria-label="별빛 사용자 분류"
          disabled={busy}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="원하는 분류를 자유롭게 적습니다"
          value={category}
        />
      </label>
      <label>
        <span>별칭</span>
        <textarea
          aria-label="별빛 별칭"
          disabled={busy}
          onChange={(event) => setAliases(event.target.value)}
          placeholder={"한 줄에 별칭 하나씩 적습니다\n예: 북탑"}
          rows={3}
          value={aliases}
        />
      </label>
      <label>
        <span>확정 내용</span>
        <textarea
          aria-label="별빛 확정 내용"
          disabled={busy}
          onChange={(event) => setContent(event.target.value)}
          placeholder="작품 안에서 확정된 내용을 적습니다"
          rows={6}
          value={content}
        />
      </label>
      <label className="lore-manager-check-row">
        <input
          aria-label="별빛 활성"
          checked={enabled}
          disabled={busy}
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        <span>원고에서 활성 별빛으로 사용</span>
      </label>
      {creating && (
        <label className="lore-manager-check-row">
          <input
            aria-label="현재 선택을 첫 근거로 포함"
            checked={input.canCaptureEvidence && includeCurrentSelection}
            disabled={busy || !input.canCaptureEvidence}
            onChange={(event) => setIncludeCurrentSelection(event.target.checked)}
            type="checkbox"
          />
          <span>
            {input.canCaptureEvidence
              ? "현재 원고 선택을 첫 근거로 포함"
              : "첫 근거를 포함하려면 원고 범위를 선택하세요"}
          </span>
        </label>
      )}
      <div className="character-manager-field-actions lore-manager-field-actions">
        {entry !== null && (
          <button
            className="danger-action"
            disabled={busy}
            onClick={() => input.onRetire(entry)}
            type="button"
          >
            {input.actionState === "retiring" ? "치우는 중" : "별빛 치우기"}
          </button>
        )}
        <button
          className="primary-action"
          disabled={busy || title.trim().length === 0}
          type="submit"
        >
          {creating
            ? input.actionState === "creating" ? "만드는 중" : "별빛 만들기"
            : input.actionState === "updating" ? "저장 중" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}

function EvidenceItem(input: {
  readonly busy: boolean;
  readonly documentLabel: string;
  readonly evidence: LoreEntryEvidenceProjection;
  readonly onOpen: (evidence: LoreEntryEvidenceProjection) => void;
}) {
  const canOpen =
    input.evidence.integrity === "resolved" && input.evidence.range !== null;
  return (
    <li>
      <div>
        <strong>{input.documentLabel}</strong>
        <span>
          {input.evidence.integrity === "resolved"
            ? "정확한 위치 확인됨"
            : input.evidence.integrity === "needsReview"
              ? "위치 검토 필요"
              : "위치 연결 손상"}
        </span>
      </div>
      <blockquote>{input.evidence.exactText}</blockquote>
      <button
        disabled={input.busy || !canOpen}
        onClick={() => input.onOpen(input.evidence)}
        type="button"
      >
        원문 열기
      </button>
    </li>
  );
}

export type LoreManagerDialogProps = {
  readonly actionState: LoreManagerActionState;
  readonly canCaptureEvidence: boolean;
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly embedded?: boolean;
  readonly entries: readonly LoreEntryProjection[];
  readonly error: string | null;
  readonly foreshadowLines: readonly ForeshadowLineProjection[];
  readonly loreForeshadowLinks: readonly LoreForeshadowLinkProjection[];
  readonly onAddEvidence: (entry: LoreEntryProjection) => void;
  readonly onClose: () => void;
  readonly onCreate: (draft: LoreEntryDraft) => void;
  readonly onOpenEvidence: (evidence: LoreEntryEvidenceProjection) => void;
  readonly onLinkForeshadow: (
    entry: LoreEntryProjection,
    lineId: ForeshadowLineProjection["lineId"],
  ) => void;
  readonly onRetire: (entry: LoreEntryProjection) => void;
  readonly onSelect: (loreEntryId: string | null) => void;
  readonly onUpdate: (
    entry: LoreEntryProjection,
    changes: UpdateLoreEntryCommand["changes"],
  ) => void;
  readonly onUnlinkForeshadow: (link: LoreForeshadowLinkProjection) => void;
  readonly selectedLoreEntryId: string | null;
};

export type LoreManagerContentProps = Omit<
  LoreManagerDialogProps,
  "embedded" | "onClose"
>;

export function LoreManagerDialog(input: LoreManagerDialogProps) {
  const [query, setQuery] = useState("");
  const [draftRevision, setDraftRevision] = useState(0);
  const [linkLineId, setLinkLineId] = useState("");
  const busy = input.actionState !== "idle";
  const onBackdropPointerDown = useDialogDismiss({
    active: !input.embedded,
    disabled: busy,
    onClose: input.onClose,
  });
  const selectedEntry = input.entries.find(
    (entry) => entry.loreEntryId === input.selectedLoreEntryId,
  ) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = normalizedQuery.length === 0
    ? input.entries
    : input.entries.filter((entry) =>
        `${entry.title}\n${entry.category}\n${entry.aliases.join("\n")}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      );
  const activeForeshadowLinks = selectedEntry === null
    ? []
    : input.loreForeshadowLinks.filter(
        (link) =>
          link.loreEntryId === selectedEntry.loreEntryId &&
          link.unlinkedAt === null,
      );
  const activeLineIds = new Set(activeForeshadowLinks.map((link) => link.lineId));
  const availableForeshadowLines = input.foreshadowLines.filter(
    (line) => !activeLineIds.has(line.lineId),
  );
  const selectedLinkLineId = availableForeshadowLines.some(
    (line) => line.lineId === linkLineId,
  )
    ? linkLineId
    : (availableForeshadowLines[0]?.lineId ?? "");

  const content = (
      <section
        aria-labelledby="lore-manager-heading"
        aria-modal={input.embedded ? undefined : "true"}
        className={
          input.embedded
            ? "character-manager-dialog lore-manager-dialog lore-manager-content"
            : "character-manager-dialog lore-manager-dialog"
        }
        role={input.embedded ? "region" : "dialog"}
      >
        <header className="character-manager-header lore-manager-header">
          <div>
            <p className="panel-kicker">LORE</p>
            <h2 id="lore-manager-heading">별빛 관리</h2>
            <p>현재 작품에서 확정한 설정과 정확한 원고 근거를 관리합니다.</p>
          </div>
          {!input.embedded && (
            <button
              aria-label="별빛 관리 닫기"
              className="dialog-close"
              disabled={busy}
              onClick={input.onClose}
              type="button"
            >
              ×
            </button>
          )}
        </header>

        <div className="character-manager-body lore-manager-body">
          <section aria-label="별빛 목록" className="character-manager-list lore-manager-list">
            <div className="character-manager-list-tools lore-manager-list-tools">
              <input
                aria-label="별빛 검색"
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름·분류·별칭 검색"
                value={query}
              />
              <button
                disabled={busy}
                onClick={() => {
                  input.onSelect(null);
                  setDraftRevision((current) => current + 1);
                }}
                type="button"
              >
                새 별빛
              </button>
            </div>
            {input.entries.length === 0 && (
              <p className="character-manager-empty">이 작품에 등록한 별빛이 없습니다.</p>
            )}
            {input.entries.length > 0 && visibleEntries.length === 0 && (
              <p className="character-manager-empty">검색 결과가 없습니다.</p>
            )}
            <ul>
              {visibleEntries.map((entry) => (
                <li key={entry.loreEntryId}>
                  <button
                    aria-pressed={entry.loreEntryId === selectedEntry?.loreEntryId}
                    disabled={busy}
                    onClick={() => input.onSelect(entry.loreEntryId)}
                    type="button"
                  >
                    <strong>{entry.title}</strong>
                    <span>
                      {entry.category || "분류 미입력"}
                      {entry.enabled ? " · 활성" : " · 비활성"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="별빛 상세 편집" className="character-manager-detail lore-manager-detail">
            <LoreEntryFields
              actionState={input.actionState}
              canCaptureEvidence={input.canCaptureEvidence}
              entry={selectedEntry}
              key={selectedEntry?.loreEntryId ?? `new-lore-entry-${draftRevision}`}
              onCreate={input.onCreate}
              onRetire={input.onRetire}
              onUpdate={input.onUpdate}
            />
            {selectedEntry !== null && (
              <>
                <section aria-label="별빛 원고 근거" className="lore-evidence-panel">
                  <header>
                    <div>
                      <span>원고 근거</span>
                      <strong>{selectedEntry.evidences.length}</strong>
                    </div>
                    <button
                      disabled={busy || !input.canCaptureEvidence}
                      onClick={() => input.onAddEvidence(selectedEntry)}
                      type="button"
                    >
                      {input.actionState === "adding-evidence"
                        ? "추가 중"
                        : "현재 선택을 근거로 추가"}
                    </button>
                  </header>
                  {selectedEntry.evidences.length === 0 ? (
                    <p>아직 연결한 원고 근거가 없습니다.</p>
                  ) : (
                    <ul>
                      {selectedEntry.evidences.map((evidence) => (
                        <EvidenceItem
                          busy={busy}
                          documentLabel={
                            input.documentLabels[evidence.sourceDocumentId] ?? "원본 회차"
                          }
                          evidence={evidence}
                          key={evidence.anchorId}
                          onOpen={input.onOpenEvidence}
                        />
                      ))}
                    </ul>
                  )}
                </section>
                <section aria-label="별빛 변경 이력" className="lore-history-panel">
                  <header>
                    <span>변경 이력</span>
                    <strong>{selectedEntry.history.length}</strong>
                  </header>
                  <ol>
                    {[...selectedEntry.history].reverse().map((history) => (
                      <li key={history.historyId}>
                        <strong>{HISTORY_LABELS[history.changeKind]}</strong>
                        <span>{`revision ${history.entryRevision} · ${history.changedAt}`}</span>
                      </li>
                    ))}
                  </ol>
                </section>
                <section aria-label="별빛과 연결된 복선" className="lore-link-panel">
                  <header>
                    <div>
                      <span>연결된 복선</span>
                      <strong>{activeForeshadowLinks.length}</strong>
                    </div>
                    <div className="lore-link-create">
                      <select
                        aria-label="연결할 복선"
                        disabled={busy || availableForeshadowLines.length === 0}
                        onChange={(event) => setLinkLineId(event.target.value)}
                        value={selectedLinkLineId}
                      >
                        {availableForeshadowLines.map((line) => (
                          <option key={line.lineId} value={line.lineId}>
                            {line.title}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={busy || selectedLinkLineId.length === 0}
                        onClick={() => input.onLinkForeshadow(
                          selectedEntry,
                          selectedLinkLineId as ForeshadowLineProjection["lineId"],
                        )}
                        type="button"
                      >
                        {input.actionState === "linking-foreshadow"
                          ? "연결 중"
                          : "복선 연결"}
                      </button>
                    </div>
                  </header>
                  {input.foreshadowLines.length === 0 ? (
                    <p>먼저 이 작품에 복선 라인을 만드세요.</p>
                  ) : activeForeshadowLinks.length === 0 ? (
                    <p>아직 연결한 복선이 없습니다.</p>
                  ) : (
                    <ul>
                      {activeForeshadowLinks.map((link) => {
                        const line = input.foreshadowLines.find(
                          (candidate) => candidate.lineId === link.lineId,
                        );
                        return (
                          <li key={link.linkId}>
                            <strong>{line?.title ?? "연결된 복선"}</strong>
                            <button
                              disabled={busy}
                              onClick={() => input.onUnlinkForeshadow(link)}
                              type="button"
                            >
                              연결 해제
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
          </section>
        </div>

        {input.error !== null && (
          <p className="character-manager-error lore-manager-error" role="alert">
            {input.error}
          </p>
        )}
      </section>
  );
  return input.embedded ? content : (
    <div
      className="dialog-backdrop character-manager-backdrop lore-manager-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      {content}
    </div>
  );
}

export function LoreManagerContent(input: LoreManagerContentProps) {
  return <LoreManagerDialog {...input} embedded onClose={() => undefined} />;
}
