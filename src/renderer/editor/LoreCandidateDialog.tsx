import { useState } from "react";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

import type {
  LoreCandidateProjection,
  LoreCandidateProposal,
} from "../../application/lore/lore-candidate-contract";
import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";

export type LoreCandidateActionState =
  | "idle"
  | "creating"
  | "approving"
  | "rejecting";

export type LoreCandidateDraft = {
  readonly proposal: LoreCandidateProposal;
  readonly reason: string;
};

function aliasesFromText(value: string): readonly string[] {
  return Object.freeze(
    value
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function approvalBlockLabel(
  reason: LoreCandidateProjection["approvalBlockReason"],
): string | null {
  switch (reason) {
    case null:
      return null;
    case "already-reviewed":
      return "이미 검토함";
    case "evidence-stale":
      return "원문이 변경됨";
    case "evidence-unresolved":
      return "원문 위치 검토 필요";
    case "inferred":
      return "추정 후보는 바로 승인할 수 없음";
    case "target-missing":
      return "수정할 별빛을 찾지 못함";
    case "target-stale":
      return "수정할 별빛이 변경됨";
  }
}

function statusLabel(candidate: LoreCandidateProjection): string {
  if (candidate.status === "approved") return "승인됨";
  if (candidate.status === "rejected") return "거절됨";
  return candidate.certainty === "explicit" ? "검토 대기" : "추정 검토 대기";
}

function proposalTitle(
  proposal: LoreCandidateProjection["proposal"],
  entries: readonly LoreEntryProjection[],
): string {
  if (proposal.kind === "create") return proposal.title;
  return entries.find((entry) => entry.loreEntryId === proposal.loreEntryId)?.title
    ?? "변경 대상 별빛";
}

export type LoreCandidateDialogProps = {
  readonly actionState: LoreCandidateActionState;
  readonly canCapture: boolean;
  readonly candidates: readonly LoreCandidateProjection[];
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly embedded?: boolean;
  readonly entries: readonly LoreEntryProjection[];
  readonly error: string | null;
  readonly onApprove: (candidate: LoreCandidateProjection) => void;
  readonly onClose: () => void;
  readonly onCreate: (draft: LoreCandidateDraft) => void;
  readonly onOpenEvidence: (candidate: LoreCandidateProjection) => void;
  readonly onReject: (candidate: LoreCandidateProjection) => void;
};

export type LoreCandidateContentProps = Omit<
  LoreCandidateDialogProps,
  "embedded" | "onClose"
>;

export function LoreCandidateDialog(input: LoreCandidateDialogProps) {
  const [proposalKind, setProposalKind] = useState<"create" | "update">("create");
  const [targetLoreEntryId, setTargetLoreEntryId] = useState(
    input.entries[0]?.loreEntryId ?? "",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [aliases, setAliases] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [reason, setReason] = useState("");
  const busy = input.actionState !== "idle";
  const onBackdropPointerDown = useDialogDismiss({
    active: !input.embedded,
    disabled: busy,
    onClose: input.onClose,
  });
  const selectedEntry = input.entries.find(
    (entry) => entry.loreEntryId === targetLoreEntryId,
  ) ?? input.entries[0] ?? null;
  const pendingCount = input.candidates.filter(
    (candidate) => candidate.status === "pending",
  ).length;
  const canSubmit =
    input.canCapture &&
    !busy &&
    (proposalKind === "create"
      ? title.trim().length > 0
      : selectedEntry !== null);

  const loadEntry = (entry: LoreEntryProjection) => {
    setTargetLoreEntryId(entry.loreEntryId);
    setTitle(entry.title);
    setContent(entry.content);
    setCategory(entry.category);
    setAliases(entry.aliases.join("\n"));
    setEnabled(entry.enabled);
  };

  const candidateContent = (
      <section
        aria-labelledby="lore-candidate-heading"
        aria-modal={input.embedded ? undefined : "true"}
        className={
          input.embedded
            ? "lore-candidate-dialog lore-candidate-content"
            : "lore-candidate-dialog"
        }
        role={input.embedded ? "region" : "dialog"}
      >
        <header className="lore-candidate-header">
          <div>
            <p className="panel-kicker">LORE REVIEW</p>
            <h2 id="lore-candidate-heading">별빛 검토함</h2>
            <p>승인 전에는 확정 별빛을 바꾸지 않습니다.</p>
          </div>
          {!input.embedded && (
            <button
              aria-label="별빛 검토함 닫기"
              className="dialog-close"
              disabled={busy}
              onClick={input.onClose}
              type="button"
            >
              ×
            </button>
          )}
        </header>

        <div className="lore-candidate-body">
          <form
            className="lore-candidate-create"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              const proposal: LoreCandidateProposal = proposalKind === "create"
                ? Object.freeze({
                    kind: "create",
                    title,
                    content,
                    category,
                    aliases: aliasesFromText(aliases),
                    enabled,
                  })
                : Object.freeze({
                    kind: "update",
                    loreEntryId: selectedEntry!.loreEntryId,
                    expectedLoreEntryRevision: selectedEntry!.revision,
                    changes: Object.freeze({
                      title,
                      content,
                      category,
                      aliases: aliasesFromText(aliases),
                      enabled,
                    }),
                  });
              input.onCreate(Object.freeze({ proposal, reason }));
            }}
          >
            <header>
              <div>
                <strong>현재 선택으로 후보 만들기</strong>
                <span>{input.canCapture ? "정확한 선택 범위 사용" : "원고 범위를 먼저 선택하세요"}</span>
              </div>
            </header>
            <label>
              <span>후보 종류</span>
              <select
                aria-label="별빛 후보 종류"
                disabled={busy}
                onChange={(event) => {
                  const kind = event.target.value as "create" | "update";
                  setProposalKind(kind);
                  if (kind === "update" && selectedEntry !== null) loadEntry(selectedEntry);
                }}
                value={proposalKind}
              >
                <option value="create">새 별빛</option>
                <option disabled={input.entries.length === 0} value="update">
                  기존 별빛 수정
                </option>
              </select>
            </label>
            {proposalKind === "update" && (
              <label>
                <span>수정할 별빛</span>
                <select
                  aria-label="수정할 별빛"
                  disabled={busy || input.entries.length === 0}
                  onChange={(event) => {
                    const entry = input.entries.find(
                      (candidate) => candidate.loreEntryId === event.target.value,
                    );
                    if (entry !== undefined) loadEntry(entry);
                  }}
                  value={selectedEntry?.loreEntryId ?? ""}
                >
                  {input.entries.map((entry) => (
                    <option key={entry.loreEntryId} value={entry.loreEntryId}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="lore-candidate-field-grid">
              <label>
                <span>별빛 이름</span>
                <input
                  aria-label="후보 별빛 이름"
                  disabled={busy}
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>
              <label>
                <span>사용자 분류</span>
                <input
                  aria-label="후보 별빛 분류"
                  disabled={busy}
                  onChange={(event) => setCategory(event.target.value)}
                  value={category}
                />
              </label>
            </div>
            <label>
              <span>별칭</span>
              <textarea
                aria-label="후보 별빛 별칭"
                disabled={busy}
                onChange={(event) => setAliases(event.target.value)}
                placeholder="한 줄에 하나"
                rows={2}
                value={aliases}
              />
            </label>
            <label>
              <span>제안 내용</span>
              <textarea
                aria-label="후보 별빛 내용"
                disabled={busy}
                onChange={(event) => setContent(event.target.value)}
                rows={4}
                value={content}
              />
            </label>
            <label>
              <span>후보로 남기는 이유</span>
              <textarea
                aria-label="별빛 후보 이유"
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                value={reason}
              />
            </label>
            <label className="lore-candidate-enabled">
              <input
                aria-label="후보 별빛 활성"
                checked={enabled}
                disabled={busy}
                onChange={(event) => setEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>승인 시 활성 별빛으로 사용</span>
            </label>
            <button className="primary-action" disabled={!canSubmit} type="submit">
              {input.actionState === "creating" ? "담는 중" : "현재 선택을 후보로 담기"}
            </button>
          </form>

          <section aria-label="별빛 후보 목록" className="lore-candidate-list">
            <header>
              <div>
                <strong>검토 기록</strong>
                <span>대기 {pendingCount} · 전체 {input.candidates.length}</span>
              </div>
            </header>
            {input.candidates.length === 0 ? (
              <p className="lore-candidate-empty">아직 검토할 별빛 후보가 없습니다.</p>
            ) : (
              <ul>
                {input.candidates.map((candidate) => {
                  const blockLabel = approvalBlockLabel(candidate.approvalBlockReason);
                  const canOpen =
                    candidate.evidence.integrity === "resolved" &&
                    candidate.evidence.range !== null;
                  return (
                    <li data-status={candidate.status} key={candidate.candidateId}>
                      <header>
                        <div>
                          <strong>{proposalTitle(candidate.proposal, input.entries)}</strong>
                          <span>{statusLabel(candidate)}</span>
                        </div>
                        <span>{input.documentLabels[candidate.evidence.sourceDocumentId] ?? "원본 회차"}</span>
                      </header>
                      <blockquote>{candidate.evidence.exactText}</blockquote>
                      {candidate.reason.length > 0 && <p>{candidate.reason}</p>}
                      {blockLabel !== null && (
                        <p className="lore-candidate-block" role="status">{blockLabel}</p>
                      )}
                      <footer>
                        <button
                          disabled={busy || !canOpen}
                          onClick={() => input.onOpenEvidence(candidate)}
                          type="button"
                        >
                          원문 열기
                        </button>
                        <button
                          disabled={busy || candidate.status !== "pending"}
                          onClick={() => input.onReject(candidate)}
                          type="button"
                        >
                          {input.actionState === "rejecting" ? "거절 중" : "거절"}
                        </button>
                        <button
                          className="primary-action"
                          disabled={
                            busy ||
                            candidate.status !== "pending" ||
                            candidate.approvalBlockReason !== null
                          }
                          onClick={() => input.onApprove(candidate)}
                          type="button"
                        >
                          {input.actionState === "approving" ? "승인 중" : "승인"}
                        </button>
                      </footer>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        {input.error !== null && <p className="dialog-error" role="alert">{input.error}</p>}
      </section>
  );
  return input.embedded ? candidateContent : (
    <div
      className="dialog-backdrop lore-candidate-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      {candidateContent}
    </div>
  );
}

export function LoreCandidateContent(input: LoreCandidateContentProps) {
  return <LoreCandidateDialog {...input} embedded onClose={() => undefined} />;
}
