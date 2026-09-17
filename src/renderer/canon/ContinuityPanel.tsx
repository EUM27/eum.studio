import { useMemo, useState, type FormEvent } from "react";

import type {
  CanonEntityKind,
  CanonEntityRef,
} from "../../application/canon/canon-entity-ref";
import type {
  ContinuityReviewCandidate,
  ContinuityReviewDecisionResult,
  ContinuityReviewDraft,
  ContinuityReviewItem,
} from "../../application/continuity/continuity-review-contract";
import {
  CONTINUITY_THREAD_KINDS,
  type ContinuityOverviewProjection,
  type ContinuityProjectedSource,
  type ContinuityThreadKind,
  type ContinuityThreadProjection,
} from "../../application/continuity/continuity-thread-contract";
import type { EntityId } from "../../domain/writing";
import type {
  ContinuityActionState,
  PendingContinuitySelection,
} from "../features/continuity/useContinuityController";
import {
  buildContinuityRadarProjection,
  type ContinuityRadarProjection,
  type ContinuityRadarSignalState,
} from "./continuity-radar";

export type ContinuityPanelEvidence = Readonly<{
  documentId: string;
  documentRevisionId: string;
  from: number;
  to: number;
  exactText: string;
}>;

export type ContinuitySubjectOption = Readonly<{
  key: string;
  entity: CanonEntityRef;
  label: string;
}>;

export type ContinuityPanelController = Readonly<{
  overview: ContinuityOverviewProjection | null;
  candidates: readonly ContinuityReviewCandidate[];
  selectedThread: ContinuityThreadProjection | null;
  selectedThreadId: string | null;
  selectedCandidate: ContinuityReviewCandidate | null;
  selectedItem: ContinuityReviewItem | null;
  selectedCandidateId: string | null;
  selectedItemId: string | null;
  pendingSelection: PendingContinuitySelection | null;
  actionState: ContinuityActionState;
  error: string | null;
  message: string | null;
  permissionRequired: boolean;
  refresh(): Promise<boolean>;
  clearPendingSelection(): void;
  createThread(draft: ContinuityReviewDraft): Promise<ContinuityThreadProjection | null>;
  updateThread(
    thread: ContinuityThreadProjection,
    draft: ContinuityReviewDraft,
  ): Promise<ContinuityThreadProjection | null>;
  resolveThread(
    thread: ContinuityThreadProjection,
    reason: string,
    usePendingEvidence: boolean,
  ): Promise<ContinuityThreadProjection | null>;
  dismissThread(
    thread: ContinuityThreadProjection,
    reason: string,
  ): Promise<ContinuityThreadProjection | null>;
  grantPermissionAndRetry(): Promise<ContinuityReviewCandidate | null>;
  updateItem(
    candidate: ContinuityReviewCandidate,
    item: ContinuityReviewItem,
    draft: ContinuityReviewDraft,
  ): Promise<ContinuityReviewCandidate | null>;
  decideItem(
    candidate: ContinuityReviewCandidate,
    item: ContinuityReviewItem,
    decision: "approve" | "reject",
    acknowledgedDuplicateThreadIds: readonly EntityId<"ContinuityThread">[],
  ): Promise<ContinuityReviewDecisionResult | null>;
  selectThread(threadId: string | null): void;
  selectCandidate(candidateId: string | null): void;
  selectItem(itemId: string | null): void;
}>;

const KIND_LABELS: Readonly<Record<ContinuityThreadKind, string>> = Object.freeze({
  promise: "약속",
  "open-question": "질문",
  "temporary-state": "상태",
  inventory: "소지품",
  location: "위치",
  injury: "부상",
  "relationship-state": "관계",
  constraint: "제약",
  other: "기타",
});

const SOURCE_LABELS: Readonly<Record<ContinuityProjectedSource["sourceKind"], string>> =
  Object.freeze({
    "plot-thread": "원본: 플롯",
    "foreshadow-line": "원본: 복선",
    "character-goal": "원본: 인물 목표",
  });

const RADAR_STATE_LABELS: Readonly<Record<ContinuityRadarSignalState, string>> =
  Object.freeze({
    "broken-evidence": "근거 연결 끊김",
    "missing-evidence": "근거 없음",
    "needs-review-evidence": "근거 재확인",
    connected: "원문 연결",
  });

const SUBJECT_KIND_LABELS: Readonly<Record<CanonEntityKind, string>> =
  Object.freeze({
    character: "인물",
    "character-relation": "인물 관계",
    "lore-entry": "별빛",
    "event-block": "사건",
    "plot-thread": "플롯",
    "foreshadow-line": "복선",
    scene: "장면",
    "continuity-thread": "연속성",
    "character-knowledge": "인물 지식",
  });

function selectedSubjectRefs(
  form: FormData,
  options: readonly ContinuitySubjectOption[],
): readonly CanonEntityRef[] {
  const selected = new Set(form.getAll("subjectRef").filter(
    (value): value is string => typeof value === "string",
  ));
  return Object.freeze(options.flatMap((option) =>
    selected.has(option.key) ? [option.entity] : []
  ));
}

function SubjectSelector(input: Readonly<{
  defaults: readonly CanonEntityRef[];
  disabled: boolean;
  options: readonly ContinuitySubjectOption[];
}>) {
  const selected = new Set(input.defaults.map((ref) => `${ref.kind}:${ref.id}`));
  if (input.options.length === 0) return null;
  return (
    <fieldset className="continuity-subject-selector">
      <legend>관련 별빛</legend>
      {input.options.map((option) => (
        <label key={option.key}>
          <input
            defaultChecked={selected.has(option.key)}
            disabled={input.disabled}
            name="subjectRef"
            type="checkbox"
            value={option.key}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

function KindSelect(input: Readonly<{
  defaultValue: ContinuityThreadKind;
  disabled: boolean;
}>) {
  return (
    <select defaultValue={input.defaultValue} disabled={input.disabled} name="kind">
      {CONTINUITY_THREAD_KINDS.map((kind) => (
        <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
      ))}
    </select>
  );
}

function draftFromForm(
  form: FormData,
  options: readonly ContinuitySubjectOption[],
): ContinuityReviewDraft | null {
  const kind = form.get("kind");
  const title = form.get("title");
  const note = form.get("note");
  if (
    typeof kind !== "string" ||
    !CONTINUITY_THREAD_KINDS.includes(kind as ContinuityThreadKind) ||
    typeof title !== "string" || title.trim().length === 0 ||
    typeof note !== "string"
  ) return null;
  return Object.freeze({
    kind: kind as ContinuityThreadKind,
    title: title.trim(),
    note,
    subjectRefs: selectedSubjectRefs(form, options),
  });
}

function ManualComposer(input: Readonly<{
  busy: boolean;
  controller: ContinuityPanelController;
  subjectOptions: readonly ContinuitySubjectOption[];
}>) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = draftFromForm(new FormData(event.currentTarget), input.subjectOptions);
    if (draft !== null) void input.controller.createThread(draft);
  };
  return (
    <section aria-label="연속성 메모 만들기" className="continuity-composer">
      <header><h3>새 연속성 메모</h3></header>
      {input.controller.pendingSelection !== null && (
        <aside className="continuity-selection-evidence">
          <strong>선택 원문 근거</strong>
          <blockquote>{input.controller.pendingSelection.exactText}</blockquote>
          <button
            disabled={input.busy}
            onClick={input.controller.clearPendingSelection}
            type="button"
          >
            근거 선택 해제
          </button>
        </aside>
      )}
      <form onSubmit={submit}>
        <label><span>종류</span><KindSelect defaultValue="promise" disabled={input.busy} /></label>
        <label><span>제목</span><input disabled={input.busy} name="title" required /></label>
        <label><span>메모</span><textarea disabled={input.busy} name="note" rows={3} /></label>
        <SubjectSelector defaults={[]} disabled={input.busy} options={input.subjectOptions} />
        <button className="is-primary" disabled={input.busy} type="submit">
          연속성 메모 저장
        </button>
      </form>
    </section>
  );
}

function EvidenceList(input: Readonly<{
  documentLabels: Readonly<Record<string, string>>;
  evidence: readonly Readonly<{
    anchorId?: string | null;
    documentId: string;
    documentRevisionId: string;
    exactText: string;
    from?: number;
    to?: number;
    integrity?: "resolved" | "needsReview" | "broken";
    range?: Readonly<{ from: number; to: number }> | null;
  }>[];
  onOpen?: (evidence: ContinuityPanelEvidence) => void;
}>) {
  if (input.evidence.length === 0) return <p className="canon-empty">연결된 원문 근거가 없습니다.</p>;
  return (
    <ol className="canon-evidence-list">
      {input.evidence.map((entry, index) => {
        const range = entry.range ?? (
          entry.from !== undefined && entry.to !== undefined
            ? { from: entry.from, to: entry.to }
            : null
        );
        const canOpen = range !== null && (entry.integrity ?? "resolved") === "resolved";
        return (
          <li key={entry.anchorId ?? `${entry.documentRevisionId}:${index}`}>
            <header>
              <strong>{input.documentLabels[entry.documentId] ?? "원고"}</strong>
              <span>{entry.integrity ?? "Candidate"}</span>
            </header>
            <blockquote>{entry.exactText}</blockquote>
            {canOpen && input.onOpen !== undefined && (
              <button onClick={() => input.onOpen?.({
                documentId: entry.documentId,
                documentRevisionId: entry.documentRevisionId,
                from: range.from,
                to: range.to,
                exactText: entry.exactText,
              })} type="button">
                원문 열기
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ThreadDetail(input: Readonly<{
  busy: boolean;
  controller: ContinuityPanelController;
  documentLabels: Readonly<Record<string, string>>;
  onEvidenceOpen?: (evidence: ContinuityPanelEvidence) => void;
  subjectOptions: readonly ContinuitySubjectOption[];
}>) {
  const thread = input.controller.selectedThread;
  if (thread === null) return <p className="canon-empty">연속성 메모를 선택해 주세요.</p>;
  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = draftFromForm(new FormData(event.currentTarget), input.subjectOptions);
    if (draft !== null) void input.controller.updateThread(thread, draft);
  };
  const close = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = form.get("reason");
    if (typeof reason !== "string" || reason.trim().length === 0) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "dismiss") {
      void input.controller.dismissThread(thread, reason.trim());
    } else {
      void input.controller.resolveThread(
        thread,
        reason.trim(),
        submitter?.value === "evidence",
      );
    }
  };
  return (
    <article aria-label="연속성 메모 상세" className="continuity-thread-detail">
      <header>
        <div><span className="canon-kind-badge">{KIND_LABELS[thread.kind]}</span><h3>{thread.title}</h3></div>
        <span className={`canon-status-badge is-${thread.status}`}>{thread.status}</span>
      </header>
      {thread.status === "open" && (
        <form key={thread.revision} onSubmit={update}>
          <label><span>종류</span><KindSelect defaultValue={thread.kind} disabled={input.busy} /></label>
          <label><span>제목</span><input defaultValue={thread.title} disabled={input.busy} name="title" /></label>
          <label><span>메모</span><textarea defaultValue={thread.note} disabled={input.busy} name="note" rows={3} /></label>
          <SubjectSelector
            defaults={thread.subjectRefs}
            disabled={input.busy}
            options={input.subjectOptions}
          />
          <button disabled={input.busy} type="submit">수정 저장</button>
        </form>
      )}
      <section><h4>열림 근거</h4><EvidenceList documentLabels={input.documentLabels} evidence={thread.openedEvidence} {...(input.onEvidenceOpen === undefined ? {} : { onOpen: input.onEvidenceOpen })} /></section>
      {thread.resolutionEvidence.length > 0 && (
        <section><h4>해결 근거</h4><EvidenceList documentLabels={input.documentLabels} evidence={thread.resolutionEvidence} {...(input.onEvidenceOpen === undefined ? {} : { onOpen: input.onEvidenceOpen })} /></section>
      )}
      <section className="continuity-history">
        <h4>변경 이력</h4>
        <ol>{thread.history.map((entry) => (
          <li key={entry.transitionId}><strong>{entry.kind}</strong><span>rev. {entry.revisionAfter}</span><small>{entry.reason}</small></li>
        ))}</ol>
      </section>
      {thread.status === "open" && (
        <form className="continuity-close-actions" onSubmit={close}>
          <label><span>해결·제외 이유</span><input disabled={input.busy} name="reason" required /></label>
          <div>
            <button disabled={input.busy} name="action" type="submit" value="manual">수동 해결</button>
            <button
              disabled={input.busy || input.controller.pendingSelection === null}
              name="action"
              type="submit"
              value="evidence"
            >
              선택 근거로 해결
            </button>
            <button className="is-secondary" disabled={input.busy} name="action" type="submit" value="dismiss">dismiss</button>
          </div>
        </form>
      )}
    </article>
  );
}

function ContinuityRadar(input: Readonly<{
  controller: ContinuityPanelController;
  documentLabels: Readonly<Record<string, string>>;
  onEvidenceOpen?: (evidence: ContinuityPanelEvidence) => void;
  projection: ContinuityRadarProjection;
  subjectOptions: readonly ContinuitySubjectOption[];
}>) {
  const subjectLabels = new Map(input.subjectOptions.map((option) => [
    option.key,
    option.label,
  ]));
  const lanes = [...input.projection.documentLanes].sort((left, right) =>
    (input.documentLabels[left.documentId] ?? left.documentId).localeCompare(
      input.documentLabels[right.documentId] ?? right.documentId,
      "ko",
    )
  );
  const openEvidence = (
    evidence: NonNullable<(typeof input.projection.threadSignals)[number]["openableEvidence"]>,
  ) => {
    if (evidence.range === null) return;
    input.onEvidenceOpen?.({
      documentId: evidence.documentId,
      documentRevisionId: evidence.documentRevisionId,
      from: evidence.range.from,
      to: evidence.range.to,
      exactText: evidence.exactText,
    });
  };
  return (
    <section aria-label="연속성 레이더" className="continuity-radar">
      <header className="continuity-radar-heading">
        <div>
          <span className="canon-eyebrow">A · 구조 분석</span>
          <h3>연속성 레이더</h3>
        </div>
        <p>저장된 연속성·플롯·복선·인물 목표와 원문 Anchor만 읽어 확인 순서를 계산합니다.</p>
      </header>
      <dl aria-label="연속성 요약" className="continuity-radar-metrics">
        <div><dt>열린 항목</dt><dd>{input.projection.counts.open}</dd></div>
        <div className={input.projection.counts.needsAttention > 0 ? "is-attention" : undefined}>
          <dt>확인 필요</dt><dd>{input.projection.counts.needsAttention}</dd>
        </div>
        <div><dt>원문 연결</dt><dd>{input.projection.counts.connected}</dd></div>
        <div><dt>해결됨</dt><dd>{input.projection.counts.resolved}</dd></div>
        <div><dt>연결 원본</dt><dd>{input.projection.counts.activeSources}</dd></div>
        <div><dt>AI 검토 대기</dt><dd>{input.projection.counts.pendingAi}</dd></div>
      </dl>
      <div className="continuity-radar-body">
        <section aria-label="열린 항목의 근거 상태" className="continuity-radar-signals">
          <header><h4>열린 항목</h4><span>근거 상태순</span></header>
          {input.projection.threadSignals.length === 0 ? (
            <p className="canon-empty">추적 중인 열린 항목이 없습니다.</p>
          ) : (
            <ol>
              {input.projection.threadSignals.map((signal) => {
                const subjects = signal.thread.subjectRefs.map((subject) =>
                  subjectLabels.get(`${subject.kind}:${subject.id}`) ??
                  SUBJECT_KIND_LABELS[subject.kind]
                );
                return (
                  <li className={`is-${signal.state}`} key={signal.threadId}>
                    <div>
                      <span>{RADAR_STATE_LABELS[signal.state]}</span>
                      <strong>{signal.thread.title}</strong>
                      <small>
                        {KIND_LABELS[signal.thread.kind]}
                        {subjects.length > 0 ? ` · ${subjects.join(" · ")}` : ""}
                      </small>
                    </div>
                    <nav aria-label={`${signal.thread.title} 이동`}>
                      <button
                        onClick={() => input.controller.selectThread(signal.threadId)}
                        type="button"
                      >
                        메모 열기
                      </button>
                      {signal.openableEvidence !== null && input.onEvidenceOpen !== undefined && (
                        <button
                          onClick={() => openEvidence(signal.openableEvidence!)}
                          type="button"
                        >
                          원문 열기
                        </button>
                      )}
                    </nav>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <aside aria-label="회차별 연속성 신호" className="continuity-radar-lanes">
          <header><h4>회차별 연결</h4><span>{lanes.length}개 회차</span></header>
          {lanes.length === 0 ? (
            <p className="canon-empty">원문 Anchor가 연결된 회차가 없습니다.</p>
          ) : (
            <ol>
              {lanes.map((lane) => (
                <li key={lane.documentId}>
                  <strong>{input.documentLabels[lane.documentId] ?? "현재 목록 밖 원고"}</strong>
                  <span>{lane.threadCount}개 항목</span>
                  <small>
                    원문 연결 {lane.connectedCount}
                    {lane.needsAttentionCount > 0
                      ? ` · 재확인 ${lane.needsAttentionCount}`
                      : ""}
                  </small>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}

function CandidateReview(input: Readonly<{
  busy: boolean;
  controller: ContinuityPanelController;
  documentLabels: Readonly<Record<string, string>>;
  onEvidenceOpen?: (evidence: ContinuityPanelEvidence) => void;
  subjectOptions: readonly ContinuitySubjectOption[];
}>) {
  const candidate = input.controller.selectedCandidate;
  const item = input.controller.selectedItem;
  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (candidate === null || item === null) return;
    const draft = draftFromForm(new FormData(event.currentTarget), input.subjectOptions);
    if (draft !== null) void input.controller.updateItem(candidate, item, draft);
  };
  const decide = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (candidate === null || item === null) return;
    const form = new FormData(event.currentTarget);
    const acknowledged = form.getAll("duplicate").map((value) => String(value) as EntityId<"ContinuityThread">);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void input.controller.decideItem(
      candidate,
      item,
      submitter?.value === "reject" ? "reject" : "approve",
      acknowledged,
    );
  };
  return (
    <section aria-label="AI 정밀 분석" className="continuity-candidate-review">
      <header><div><span className="canon-eyebrow">B · 선택형 AI</span><h3>AI 정밀 분석</h3></div><button disabled={input.busy} onClick={() => void input.controller.refresh()} type="button">새로고침</button></header>
      <p className="continuity-ai-guidance">원고에서 필요한 범위만 선택한 뒤 우클릭 <strong>연속성 점검</strong>을 실행하세요. 결과는 승인 전 Candidate로만 보관됩니다.</p>
      {input.controller.candidates.length === 0 ? (
        <p className="canon-empty">검토할 연속성 후보가 없습니다.</p>
      ) : (
        <div className="continuity-candidate-layout">
          <ol className="canon-item-list">
            {input.controller.candidates.map((entry) => (
              <li key={entry.candidateId}>
                <button onClick={() => input.controller.selectCandidate(entry.candidateId)} type="button">
                  <strong>{entry.items[0]?.draft.title ?? "연속성 후보"}</strong><small>{entry.status}</small>
                </button>
                {input.controller.selectedCandidateId === entry.candidateId && entry.items.map((candidateItem) => (
                  <button key={candidateItem.itemId} onClick={() => input.controller.selectItem(candidateItem.itemId)} type="button">
                    {KIND_LABELS[candidateItem.draft.kind]} · {candidateItem.draft.title}
                  </button>
                ))}
              </li>
            ))}
          </ol>
          {candidate !== null && item !== null && (
            <article>
              <p>{item.reason}</p>
              {item.assertionBasis === "model-inference" && <p className="canon-warning">모델 추론 제안입니다. 내용을 직접 확인한 뒤 결정해 주세요.</p>}
              <form key={`${candidate.revision}:${item.itemId}`} onSubmit={update}>
                <label><span>종류</span><KindSelect defaultValue={item.draft.kind} disabled={input.busy || item.status !== "pending"} /></label>
                <label><span>제목</span><input defaultValue={item.draft.title} disabled={input.busy || item.status !== "pending"} name="title" /></label>
                <label><span>메모</span><textarea defaultValue={item.draft.note} disabled={input.busy || item.status !== "pending"} name="note" rows={2} /></label>
                <SubjectSelector defaults={item.draft.subjectRefs} disabled={input.busy || item.status !== "pending"} options={input.subjectOptions} />
                <button disabled={input.busy || item.status !== "pending"} type="submit">수정값 저장</button>
              </form>
              <EvidenceList documentLabels={input.documentLabels} evidence={item.evidence} {...(input.onEvidenceOpen === undefined ? {} : { onOpen: input.onEvidenceOpen })} />
              <form className="continuity-decision" onSubmit={decide}>
                {item.potentialDuplicateThreadIds.length > 0 && (
                  <fieldset>
                    <legend>비슷한 열린 메모 확인</legend>
                    {item.potentialDuplicateThreadIds.map((threadId) => (
                      <label key={threadId}><input name="duplicate" type="checkbox" value={threadId} />{threadId}</label>
                    ))}
                  </fieldset>
                )}
                <button disabled={input.busy || item.status !== "pending"} type="submit" value="reject">기각</button>
                <button className="is-primary" disabled={input.busy || item.status !== "pending"} type="submit" value="approve">새 메모로 승인</button>
              </form>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

export function ContinuityPanel(input: Readonly<{
  controller: ContinuityPanelController;
  documentLabels: Readonly<Record<string, string>>;
  onEvidenceOpen?: (evidence: ContinuityPanelEvidence) => void;
  onProjectedSourceOpen?: (source: ContinuityProjectedSource) => void;
  subjectOptions: readonly ContinuitySubjectOption[];
}>) {
  const [status, setStatus] = useState<"all" | "open" | "closed">("open");
  const [kind, setKind] = useState<"all" | ContinuityThreadKind>("all");
  const busy = input.controller.actionState !== "idle";
  const threads = useMemo(() => (input.controller.overview?.threads ?? []).filter((thread) =>
    (status === "all" || (status === "open" ? thread.status === "open" : thread.status !== "open")) &&
    (kind === "all" || thread.kind === kind)
  ), [input.controller.overview, kind, status]);
  const sources = useMemo(() => (input.controller.overview?.projectedSources ?? []).filter((source) =>
    status !== "closed" && (kind === "all" || kind === "other") && source.active
  ), [input.controller.overview, kind, status]);
  const radar = useMemo(() => buildContinuityRadarProjection(
    input.controller.overview,
    input.controller.candidates,
  ), [input.controller.candidates, input.controller.overview]);
  return (
    <div className="continuity-panel">
      {(input.controller.error !== null || input.controller.message !== null) && (
        <p className={input.controller.error === null ? "canon-feedback" : "canon-feedback is-error"} role={input.controller.error === null ? "status" : "alert"}>
          {input.controller.error ?? input.controller.message}
        </p>
      )}
      {input.controller.permissionRequired && (
        <div className="canon-permission" role="alert"><p>선택 원문을 연속성 점검에 사용하는 1회 권한이 필요합니다.</p><button disabled={busy} onClick={() => void input.controller.grantPermissionAndRetry()} type="button">이번 선택만 허용하고 다시 실행</button></div>
      )}
      <ContinuityRadar
        controller={input.controller}
        documentLabels={input.documentLabels}
        {...(input.onEvidenceOpen === undefined ? {} : { onEvidenceOpen: input.onEvidenceOpen })}
        projection={radar}
        subjectOptions={input.subjectOptions}
      />
      <div className="continuity-main-grid">
        <aside className="canon-review-column continuity-list-column">
          <header><h3>연속성</h3><button disabled={busy} onClick={() => void input.controller.refresh()} type="button">새로고침</button></header>
          <nav aria-label="연속성 필터" className="continuity-filters">
            {(["open", "closed", "all"] as const).map((value) => (
              <button aria-pressed={status === value} key={value} onClick={() => setStatus(value)} type="button">
                {value === "open" ? "열림" : value === "closed" ? "해결됨" : "전체"}
              </button>
            ))}
            <select aria-label="연속성 종류" onChange={(event) => setKind(event.currentTarget.value as typeof kind)} value={kind}>
              <option value="all">모든 종류</option>
              {CONTINUITY_THREAD_KINDS.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
            </select>
          </nav>
          <ol className="continuity-record-list">
            {sources.map((source) => (
              <li key={`${source.sourceKind}:${source.entity.id}`}>
                <article className="continuity-source-card"><span>{SOURCE_LABELS[source.sourceKind]}</span><strong>{source.title}</strong><p>{source.note}</p>{input.onProjectedSourceOpen !== undefined && <button onClick={() => input.onProjectedSourceOpen?.(source)} type="button">원본 화면에서 편집</button>}</article>
              </li>
            ))}
            {threads.map((thread) => (
              <li key={thread.threadId}><button aria-pressed={input.controller.selectedThreadId === thread.threadId} onClick={() => input.controller.selectThread(thread.threadId)} type="button"><span>원본: 연속성 메모</span><strong>{thread.title}</strong><small>{KIND_LABELS[thread.kind]} · {thread.status}</small></button></li>
            ))}
          </ol>
        </aside>
        <section className="canon-review-column continuity-detail-column">
          <ManualComposer busy={busy} controller={input.controller} subjectOptions={input.subjectOptions} />
          <ThreadDetail busy={busy} controller={input.controller} documentLabels={input.documentLabels} {...(input.onEvidenceOpen === undefined ? {} : { onEvidenceOpen: input.onEvidenceOpen })} subjectOptions={input.subjectOptions} />
        </section>
        <aside className="canon-review-column continuity-review-column">
          <CandidateReview busy={busy} controller={input.controller} documentLabels={input.documentLabels} {...(input.onEvidenceOpen === undefined ? {} : { onEvidenceOpen: input.onEvidenceOpen })} subjectOptions={input.subjectOptions} />
        </aside>
      </div>
    </div>
  );
}
