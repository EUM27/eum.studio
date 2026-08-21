import { useState, type FormEvent } from "react";
import {
  Bot,
  KeyRound,
  ListChecks,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

import {
  ASSISTANT_CAPABILITIES,
  ASSISTANT_PERMISSION_DURATIONS,
  type AssistantCapability,
  type AssistantContextPermissionGrant,
  type AssistantContextScope,
  type AssistantPermissionDuration,
} from "../../application/assistant/assistant-context-permission";
import type {
  AssistantContextStateProjection,
} from "../../application/assistant/assistant-context-state";
import type {
  AssistantDestinationProfile,
} from "../../application/assistant/assistant-destination-profile";
import type {
  AssistantVocabularyOccurrence,
} from "../../application/assistant/assistant-vocabulary-lookup";
import type {
  AssistantNotationFinding,
} from "../../application/assistant/assistant-notation-review";
import type {
  AssistantSettingReference,
} from "../../application/assistant/assistant-setting-review";

export type AssistantContextConnectionProjection = Readonly<{
  connectionId: string;
  label: string;
  model: string;
}>;

export type AssistantContextDialogActionState =
  | "loading"
  | "idle"
  | "granting"
  | "revoking"
  | "running-vocabulary"
  | "running-vocabulary-suggestion"
  | "running-external-setting-review"
  | "running-notation-review"
  | "running-setting-review";

export type AssistantPermissionDraft = {
  readonly capability: AssistantCapability;
  readonly destinationId: string;
  readonly localScope: AssistantContextScope;
  readonly externalScope: AssistantContextScope;
  readonly duration: AssistantPermissionDuration;
};

const CAPABILITY_LABELS: Readonly<Record<AssistantCapability, string>> = {
  "vocabulary-lookup": "어휘 확인",
  "lore-review": "설정 검토",
  "character.extract": "캐릭터 추출",
  "scene.extract": "장면 구분",
  "publishing-operations": "투고 운영",
};

const SCOPE_LABELS: Readonly<Record<AssistantContextScope, string>> = {
  none: "전송하지 않음",
  selection: "정확한 선택 범위",
  paragraph: "문단",
  scene: "장면",
  chapter: "회차",
  work: "작품 전체",
};

const DURATION_LABELS: Readonly<Record<AssistantPermissionDuration, string>> = {
  once: "한 번",
  conversation: "현재 대화",
  work: "이 작품",
};

const SETTING_KIND_LABELS = {
  character: "인물",
  plot: "플롯",
  foreshadow: "복선",
} as const;

const EXTERNAL_REVIEW_NOTE_LABELS = {
  duplicate: "중복 검토",
  conflict: "충돌 검토",
  category: "분류 검토",
} as const;

const SETTING_FIELD_LABELS = {
  character: {
    role: "역할",
    summary: "요약",
    note: "메모",
  },
  plot: {
    stage: "단계",
    summary: "요약",
    note: "메모",
  },
  foreshadow: {
    note: "메모",
  },
} as const;

function settingFieldLabel(
  settingKind: keyof typeof SETTING_FIELD_LABELS,
  field: string,
): string {
  const labels = SETTING_FIELD_LABELS[settingKind] as Readonly<
    Record<string, string>
  >;
  return labels[field] ?? field;
}

const NOTATION_KIND_LABELS = {
  "trailing-whitespace": "줄 끝 공백",
  tab: "탭 문자",
  "non-breaking-space": "줄바꿈 없는 공백",
  "mixed-line-ending": "혼합 줄바꿈",
  "excess-blank-line": "연속 빈 줄",
  "forbidden-term": "금칙어",
  "regex-match": "사용자 표기 규칙",
} as const;

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function grantStateLabel(grant: AssistantContextPermissionGrant): string {
  if (grant.revokedAt !== null) return "철회됨";
  if (grant.consumedAt !== null) return "사용됨";
  return "사용 가능";
}

export function AssistantContextDialog(input: {
  readonly actionState: AssistantContextDialogActionState;
  readonly canRunNotationReview: boolean;
  readonly canRunExternalSettingReview: boolean;
  readonly canRunVocabularyLookup: boolean;
  readonly connections: readonly AssistantContextConnectionProjection[];
  readonly destinationProfile: AssistantDestinationProfile | null;
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onGrant: (draft: AssistantPermissionDraft) => void;
  readonly onOpenVocabularyOccurrence: (
    occurrence: AssistantVocabularyOccurrence,
  ) => void;
  readonly onOpenConnections: () => void;
  readonly onOpenNotationFinding: (finding: AssistantNotationFinding) => void;
  readonly onOpenSettingReference: (
    reference: AssistantSettingReference,
  ) => void;
  readonly onRevoke: (grant: AssistantContextPermissionGrant) => void;
  readonly onRunSettingReview: (destinationId: string) => void;
  readonly onRunNotationReview: (destinationId: string) => void;
  readonly onRunVocabularyLookup: (destinationId: string) => void;
  readonly onRunVocabularySuggestion: (input: Readonly<{
    connectionId: string;
    query: string;
    includeSelection: boolean;
  }>) => void;
  readonly onRunExternalSettingReview: (input: Readonly<{
    connectionId: string;
    query: string;
  }>) => void;
  readonly projection: AssistantContextStateProjection | null;
  readonly workTitle: string;
}) {
  const [capability, setCapability] = useState<AssistantCapability>(
    ASSISTANT_CAPABILITIES[0],
  );
  const [destinationId, setDestinationId] = useState("");
  const [duration, setDuration] = useState<AssistantPermissionDuration>(
    ASSISTANT_PERMISSION_DURATIONS[0],
  );
  const [suggestionConnectionId, setSuggestionConnectionId] = useState("");
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [includeSuggestionSelection, setIncludeSuggestionSelection] =
    useState(false);
  const [reviewConnectionId, setReviewConnectionId] = useState("");
  const [reviewQuery, setReviewQuery] = useState("");
  const busy = input.actionState !== "idle";
  const destinations = input.destinationProfile?.destinations ?? [];
  const selectedDestination =
    destinations.find((destination) => destination.destinationId === destinationId) ??
    destinations[0] ??
    null;
  const selectedCapability =
    selectedDestination?.capabilities.includes(capability) === true
      ? capability
      : selectedDestination?.capabilities[0] ?? capability;
  const vocabularyDestination =
    selectedDestination?.kind === "local-exact-vocabulary-search"
      ? selectedDestination
      : destinations.find((destination) =>
          destination.kind === "local-exact-vocabulary-search",
        ) ?? null;
  const notationDestination =
    selectedDestination?.kind === "local-selected-notation-review"
      ? selectedDestination
      : destinations.find((destination) =>
          destination.kind === "local-selected-notation-review",
        ) ?? null;
  const settingReviewDestination =
    selectedDestination?.kind === "local-exact-setting-review"
      ? selectedDestination
      : destinations.find((destination) =>
          destination.kind === "local-exact-setting-review",
        ) ?? null;
  const suggestionConnection =
    input.connections.find((connection) =>
      connection.connectionId === suggestionConnectionId
    ) ?? input.connections[0] ?? null;
  const reviewConnection =
    input.connections.find((connection) =>
      connection.connectionId === reviewConnectionId
    ) ?? input.connections[0] ?? null;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: busy,
    onClose: input.onClose,
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (selectedDestination === null) return;
    input.onGrant({
      capability: selectedCapability,
      destinationId: selectedDestination.destinationId,
      localScope: selectedDestination.requiredLocalScope,
      externalScope: selectedDestination.requiredExternalScope,
      duration,
    });
  }

  return (
    <div
      className="dialog-backdrop assistant-context-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="assistant-context-title"
        aria-modal="true"
        className="assistant-context-dialog"
        role="dialog"
      >
        <header className="assistant-context-header">
          <div>
            <span aria-hidden="true" className="assistant-context-icon">
              <Bot size={18} />
            </span>
            <div>
              <p className="panel-kicker">ASSISTANT ACCESS</p>
              <h2 id="assistant-context-title">조수 접근 권한</h2>
              <p>{input.workTitle} 안에서 허용할 문맥만 정합니다.</p>
            </div>
          </div>
          <div className="assistant-context-header-actions">
            <button
              className="assistant-context-connections-button"
              disabled={busy}
              onClick={input.onOpenConnections}
              type="button"
            >
              <KeyRound aria-hidden="true" size={16} />
              연결 설정
            </button>
            <button
              aria-label="조수 접근 권한 닫기"
              className="dialog-close"
              disabled={busy}
              onClick={input.onClose}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        </header>

        <div className="assistant-context-body">
          <div className="assistant-context-tool-column">
            <section
              aria-label="어휘·유의어 제안"
              className="assistant-context-grant-form assistant-vocabulary-suggestion-runner"
            >
              <div className="assistant-context-section-heading">
                <Sparkles aria-hidden="true" size={17} />
                <div>
                  <h3>어휘·유의어 제안</h3>
                  <p>질문과 직접 승인한 선택 범위만 연결에 보내고 결과를 후보로 저장합니다.</p>
                </div>
              </div>
              {input.connections.length === 0 ? (
                <div className="assistant-context-empty">
                  <p>사용할 연결이 없습니다.</p>
                  <button onClick={input.onOpenConnections} type="button">
                    연결 설정 열기
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (suggestionConnection === null) return;
                    input.onRunVocabularySuggestion({
                      connectionId: suggestionConnection.connectionId,
                      query: suggestionQuery,
                      includeSelection: includeSuggestionSelection,
                    });
                  }}
                >
                  <label>
                    <span>연결</span>
                    <select
                      aria-label="어휘 제안 연결"
                      disabled={busy}
                      onChange={(event) =>
                        setSuggestionConnectionId(event.target.value)
                      }
                      value={suggestionConnection?.connectionId ?? ""}
                    >
                      {input.connections.map((connection) => (
                        <option
                          key={connection.connectionId}
                          value={connection.connectionId}
                        >
                          {connection.label} · {connection.model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>질문</span>
                    <input
                      aria-label="어휘 제안 질문"
                      autoComplete="off"
                      disabled={busy}
                      onChange={(event) => setSuggestionQuery(event.target.value)}
                      placeholder="예: 이 문맥에 어울리는 유의어와 뉘앙스"
                      required
                      value={suggestionQuery}
                    />
                  </label>
                  <label className="assistant-vocabulary-selection-toggle">
                    <input
                      checked={includeSuggestionSelection}
                      disabled={busy}
                      onChange={(event) =>
                        setIncludeSuggestionSelection(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>현재 원고의 정확한 선택 범위 함께 보내기</span>
                  </label>
                  <div className="assistant-vocabulary-suggestion-actions">
                    {includeSuggestionSelection && (
                      <button
                        disabled={busy || suggestionConnection === null}
                        onClick={() => {
                          if (suggestionConnection === null) return;
                          input.onGrant({
                            capability: "vocabulary-lookup",
                            destinationId: suggestionConnection.connectionId,
                            localScope: "selection",
                            externalScope: "selection",
                            duration,
                          });
                        }}
                        type="button"
                      >
                        선택 전송 권한 승인
                      </button>
                    )}
                    <button
                      className="primary-action assistant-context-grant-button"
                      disabled={
                        busy ||
                        suggestionConnection === null ||
                        suggestionQuery.trim().length === 0 ||
                        (includeSuggestionSelection &&
                          !input.canRunVocabularyLookup)
                      }
                      type="submit"
                    >
                      {input.actionState === "running-vocabulary-suggestion"
                        ? "제안 받는 중"
                        : "제안 받기"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section
              aria-label="외부 설정 검토"
              className="assistant-context-grant-form assistant-external-setting-review-runner"
            >
              <div className="assistant-context-section-heading">
                <ListChecks aria-hidden="true" size={17} />
                <div>
                  <h3>외부 설정 검토</h3>
                  <p>승인한 현재 회차와 이 작품의 인물·플롯·복선만 연결에 보내고 제안을 후보로 저장합니다.</p>
                </div>
              </div>
              {input.connections.length === 0 ? (
                <div className="assistant-context-empty">
                  <p>사용할 연결이 없습니다.</p>
                  <button onClick={input.onOpenConnections} type="button">
                    연결 설정 열기
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reviewConnection === null) return;
                    input.onRunExternalSettingReview({
                      connectionId: reviewConnection.connectionId,
                      query: reviewQuery,
                    });
                  }}
                >
                  <label>
                    <span>연결</span>
                    <select
                      aria-label="외부 설정 검토 연결"
                      disabled={busy}
                      onChange={(event) => setReviewConnectionId(event.target.value)}
                      value={reviewConnection?.connectionId ?? ""}
                    >
                      {input.connections.map((connection) => (
                        <option key={connection.connectionId} value={connection.connectionId}>
                          {connection.label} · {connection.model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>질문</span>
                    <input
                      aria-label="외부 설정 검토 질문"
                      autoComplete="off"
                      disabled={busy}
                      onChange={(event) => setReviewQuery(event.target.value)}
                      placeholder="예: 현재 회차와 확정 설정의 충돌을 검토"
                      required
                      value={reviewQuery}
                    />
                  </label>
                  <div className="assistant-vocabulary-suggestion-actions">
                    <button
                      disabled={busy || reviewConnection === null}
                      onClick={() => {
                        if (reviewConnection === null) return;
                        input.onGrant({
                          capability: "lore-review",
                          destinationId: reviewConnection.connectionId,
                          localScope: "work",
                          externalScope: "work",
                          duration,
                        });
                      }}
                      type="button"
                    >
                      회차·설정 전송 권한 승인
                    </button>
                    <button
                      className="primary-action assistant-context-grant-button"
                      disabled={
                        busy ||
                        reviewConnection === null ||
                        reviewQuery.trim().length === 0 ||
                        !input.canRunExternalSettingReview
                      }
                      type="submit"
                    >
                      {input.actionState === "running-external-setting-review"
                        ? "검토 받는 중"
                        : "외부 검토 받기"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section
              aria-label="작품 내 정확 어휘 검색"
              className="assistant-context-grant-form assistant-vocabulary-runner"
            >
              <div className="assistant-context-section-heading">
                <Search aria-hidden="true" size={17} />
                <div>
                  <h3>작품 내 정확 어휘 검색</h3>
                  <p>현재 선택한 문자열과 완전히 같은 위치를 이 작품에서 찾습니다.</p>
                </div>
              </div>
              <button
                className="primary-action assistant-context-grant-button"
                disabled={
                  busy ||
                  !input.canRunVocabularyLookup ||
                  vocabularyDestination === null
                }
                onClick={() => {
                  if (vocabularyDestination !== null) {
                    input.onRunVocabularyLookup(vocabularyDestination.destinationId);
                  }
                }}
                type="button"
              >
                {input.actionState === "running-vocabulary"
                  ? "검색 중"
                  : "선택 어휘 검색"}
              </button>
              {!input.canRunVocabularyLookup && (
                <p className="assistant-vocabulary-selection-help">
                  원고에서 검색할 어휘를 정확히 선택하세요.
                </p>
              )}
            </section>

            <section
              aria-label="선택 범위 표기 점검"
              className="assistant-context-grant-form assistant-notation-review-runner"
            >
              <div className="assistant-context-section-heading">
                <ScanText aria-hidden="true" size={17} />
                <div>
                  <h3>선택 범위 표기 점검</h3>
                  <p>현재 작품의 표기 규칙을 선택한 정확한 범위에만 적용합니다.</p>
                </div>
              </div>
              <button
                className="primary-action assistant-context-grant-button"
                disabled={
                  busy ||
                  !input.canRunNotationReview ||
                  notationDestination === null
                }
                onClick={() => {
                  if (notationDestination !== null) {
                    input.onRunNotationReview(notationDestination.destinationId);
                  }
                }}
                type="button"
              >
                {input.actionState === "running-notation-review"
                  ? "점검 중"
                  : "선택 표기 점검"}
              </button>
              {!input.canRunNotationReview && (
                <p className="assistant-vocabulary-selection-help">
                  원고에서 점검할 범위를 정확히 선택하세요.
                </p>
              )}
            </section>

            <section
              aria-label="설정 중복 검토"
              className="assistant-context-grant-form assistant-setting-review-runner"
            >
              <div className="assistant-context-section-heading">
                <ListChecks aria-hidden="true" size={17} />
                <div>
                  <h3>설정 중복 검토</h3>
                  <p>현재 작품의 인물·플롯·복선 안에서 완전히 같은 이름만 찾습니다.</p>
                </div>
              </div>
              <button
                className="primary-action assistant-context-grant-button"
                disabled={busy || settingReviewDestination === null}
                onClick={() => {
                  if (settingReviewDestination !== null) {
                    input.onRunSettingReview(settingReviewDestination.destinationId);
                  }
                }}
                type="button"
              >
                {input.actionState === "running-setting-review"
                  ? "검토 중"
                  : "설정 검토"}
              </button>
            </section>

            <form className="assistant-context-grant-form" onSubmit={submit}>
            <div className="assistant-context-section-heading">
              <ShieldCheck aria-hidden="true" size={17} />
              <div>
                <h3>새 권한</h3>
                <p>목적지·기능·범위·기간이 모두 일치할 때만 사용됩니다.</p>
              </div>
            </div>
            <label>
              <span>기능</span>
              <select
                disabled={busy}
                onChange={(event) =>
                  setCapability(event.target.value as AssistantCapability)
                }
                value={selectedCapability}
              >
                {(selectedDestination?.capabilities ?? ASSISTANT_CAPABILITIES).map((value) => (
                  <option key={value} value={value}>
                    {CAPABILITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>기능 목적지</span>
              <select
                disabled={busy}
                onChange={(event) => setDestinationId(event.target.value)}
                value={selectedDestination?.destinationId ?? ""}
              >
                {destinations.map((destination) => (
                  <option
                    key={destination.destinationId}
                    value={destination.destinationId}
                  >
                    {destination.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="assistant-context-field-row">
              <label>
                <span>로컬 읽기</span>
                <select disabled value={selectedDestination?.requiredLocalScope ?? "none"}>
                  <option value={selectedDestination?.requiredLocalScope ?? "none"}>
                    {SCOPE_LABELS[selectedDestination?.requiredLocalScope ?? "none"]}
                  </option>
                </select>
              </label>
              <label>
                <span>외부 전송</span>
                <select disabled value={selectedDestination?.requiredExternalScope ?? "none"}>
                  <option value={selectedDestination?.requiredExternalScope ?? "none"}>
                    {SCOPE_LABELS[selectedDestination?.requiredExternalScope ?? "none"]}
                  </option>
                </select>
              </label>
              <label>
                <span>기간</span>
                <select
                  disabled={busy}
                  onChange={(event) =>
                    setDuration(event.target.value as AssistantPermissionDuration)
                  }
                  value={duration}
                >
                  {ASSISTANT_PERMISSION_DURATIONS.map((value) => (
                    <option key={value} value={value}>
                      {DURATION_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="primary-action assistant-context-grant-button"
              disabled={busy || selectedDestination === null}
              type="submit"
            >
              {input.actionState === "granting" ? "승인 중" : "권한 승인"}
            </button>
            </form>
          </div>

          <div className="assistant-context-ledger-column">
            <section
              aria-label="표기 점검 결과"
              className="assistant-context-ledger assistant-notation-candidates"
            >
              <header>
                <div>
                  <h3>표기 점검 결과</h3>
                  <p>원고를 바꾸지 않는 정확한 선택 범위 후보 기록입니다.</p>
                </div>
                <span>{input.projection?.notationCandidates.length ?? 0}</span>
              </header>
              {input.projection === null ||
                  input.projection.notationCandidates.length === 0 ? (
                <p className="assistant-context-empty">저장된 표기 점검 결과가 없습니다.</p>
              ) : (
                <ul>
                  {input.projection.notationCandidates.map((candidate) => (
                    <li key={candidate.candidateId}>
                      <div>
                        <strong>
                          {input.documentLabels[candidate.sourceRange.documentId] ??
                            candidate.sourceRange.documentId}
                        </strong>
                        <span>{candidate.findings.length.toLocaleString()}곳</span>
                      </div>
                      <p>
                        선택 {candidate.sourceRange.from.toLocaleString()}–
                        {candidate.sourceRange.to.toLocaleString()}
                      </p>
                      {candidate.findings.length === 0 ? (
                        <p className="assistant-context-empty">발견된 표기 후보가 없습니다.</p>
                      ) : (
                        <div
                          aria-label="표기 후보 위치"
                          className="assistant-vocabulary-occurrence-list"
                        >
                          {candidate.findings.map((finding, index) => (
                            <button
                              disabled={busy}
                              key={[
                                finding.kind,
                                finding.range.documentId,
                                finding.range.documentRevisionId,
                                finding.range.from,
                                finding.range.to,
                                index,
                              ].join(":")}
                              onClick={() => input.onOpenNotationFinding(finding)}
                              type="button"
                            >
                              {NOTATION_KIND_LABELS[finding.kind]}
                              {finding.label === null ? "" : ` · ${finding.label}`}
                              {" "}{finding.range.from.toLocaleString()}–
                              {finding.range.to.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      )}
                      {candidate.regexError !== null && (
                        <p className="assistant-context-error">
                          정규식 오류: {candidate.regexError}
                        </p>
                      )}
                      <footer>
                        <span>{formatInstant(candidate.createdAt)}</span>
                      </footer>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-label="외부 설정 검토 결과"
              className="assistant-context-ledger assistant-external-setting-review-candidates"
            >
              <header>
                <div>
                  <h3>외부 설정 검토 결과</h3>
                  <p>원고와 정규 설정에 자동 반영하지 않는 작품 후보 기록입니다.</p>
                </div>
                <span>
                  {input.projection?.externalSettingReviewCandidates.length ?? 0}
                </span>
              </header>
              {input.projection === null ||
                  input.projection.externalSettingReviewCandidates.length === 0 ? (
                <p className="assistant-context-empty">
                  저장된 외부 설정 검토 결과가 없습니다.
                </p>
              ) : (
                <ul>
                  {input.projection.externalSettingReviewCandidates.map((candidate) => {
                    const receipt = input.projection?.externalSettingReviewReceipts.find(
                      (entry) => entry.receiptId === candidate.receiptId,
                    );
                    return (
                      <li
                        data-external-setting-review-candidate={candidate.candidateId}
                        key={candidate.candidateId}
                      >
                        <div>
                          <strong>“{candidate.query}”</strong>
                          <span>
                            {candidate.proposals.length.toLocaleString()}개 제안
                          </span>
                        </div>
                        <p>
                          {input.connections.find((connection) =>
                            connection.connectionId === candidate.connectionId
                          )?.label ?? candidate.connectionId}
                        </p>
                        {candidate.reply.length > 0 && <p>{candidate.reply}</p>}
                        {candidate.proposals.length === 0 ? (
                          <p className="assistant-context-empty">저장된 설정 제안이 없습니다.</p>
                        ) : (
                          <div className="assistant-external-setting-proposal-list">
                            {candidate.proposals.map((proposal, index) => (
                              <article key={`${candidate.candidateId}:proposal:${index}`}>
                                <div>
                                  <strong>
                                    {proposal.action === "create" ? "새 설정 후보" : "설정 수정 후보"}
                                    {" · "}{SETTING_KIND_LABELS[proposal.settingKind]}
                                  </strong>
                                  <span>{proposal.certainty === "explicit" ? "명시" : "추론"}</span>
                                </div>
                                <p>
                                  {proposal.label} · {proposal.field}: {proposal.value}
                                </p>
                                <div className="assistant-setting-reference-list">
                                  {proposal.target !== null && (
                                    <button
                                      disabled={busy}
                                      onClick={() => input.onOpenSettingReference(proposal.target!)}
                                      type="button"
                                    >
                                      검토 당시 {SETTING_KIND_LABELS[proposal.target.kind]} r{proposal.target.revision.toLocaleString()} 열기
                                    </button>
                                  )}
                                  {proposal.evidenceRange !== null && (
                                    <button
                                      disabled={busy}
                                      onClick={() => input.onOpenVocabularyOccurrence(proposal.evidenceRange!)}
                                      type="button"
                                    >
                                      원고 근거 {proposal.evidenceRange.from.toLocaleString()}–{proposal.evidenceRange.to.toLocaleString()} 열기
                                    </button>
                                  )}
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                        {candidate.reviewNotes.length > 0 && (
                          <div className="assistant-external-setting-review-note-list">
                            {candidate.reviewNotes.map((note, index) => (
                              <article key={`${candidate.candidateId}:note:${index}`}>
                                <strong>{EXTERNAL_REVIEW_NOTE_LABELS[note.kind]}</strong>
                                <p>{note.message}</p>
                                <div className="assistant-setting-reference-list">
                                  {note.references.map((reference, referenceIndex) => (
                                    <button
                                      disabled={busy}
                                      key={`${reference.kind}:${reference.entityId}:${reference.revision}`}
                                      onClick={() => input.onOpenSettingReference(reference)}
                                      type="button"
                                    >
                                      {SETTING_KIND_LABELS[reference.kind]} {referenceIndex + 1} · r{reference.revision.toLocaleString()}
                                    </button>
                                  ))}
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                        {receipt !== undefined && (
                          <p>
                            {input.documentLabels[receipt.sourceRange.documentId] ?? receipt.sourceRange.documentId}
                            {" "}{receipt.sourceRange.from.toLocaleString()}–{receipt.sourceRange.to.toLocaleString()}
                            {" · 설정 전송 "}{receipt.transmittedSettingCount.toLocaleString()}개
                          </p>
                        )}
                        <footer>
                          <span>{formatInstant(candidate.createdAt)}</span>
                        </footer>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              aria-label="설정 검토 결과"
              className="assistant-context-ledger assistant-setting-review-findings"
            >
              <header>
                <div>
                  <h3>설정 검토 결과</h3>
                  <p>정규 설정을 바꾸지 않는 작품 소유 검토 기록입니다.</p>
                </div>
                <span>
                  {(input.projection?.settingReviewFindings.length ?? 0) +
                    (input.projection?.settingConflictFindings.length ?? 0)}
                </span>
              </header>
              {input.projection === null ||
                  (input.projection.settingReviewFindings.length === 0 &&
                    input.projection.settingConflictFindings.length === 0) ? (
                <p className="assistant-context-empty">
                  {input.projection !== null &&
                      input.projection.settingReviewReceipts.length > 0
                    ? "저장된 완전 일치 중복이나 필드 충돌이 없습니다."
                    : "저장된 설정 검토 결과가 없습니다."}
                </p>
              ) : (
                <ul>
                  {input.projection.settingReviewFindings.map((finding) => (
                    <li key={finding.findingId}>
                      <div>
                        <strong>“{finding.label}”</strong>
                        <span>{finding.references.length.toLocaleString()}개</span>
                      </div>
                      <p>
                        {SETTING_KIND_LABELS[finding.settingKind]} 안의 완전 일치 이름
                      </p>
                      <div
                        aria-label={`“${finding.label}” 중복 원본`}
                        className="assistant-setting-reference-list"
                      >
                        {finding.references.map((reference, index) => (
                          <button
                            aria-label={`“${finding.label}” 중복 ${SETTING_KIND_LABELS[reference.kind]} ${index + 1} 열기`}
                            disabled={busy}
                            key={`${reference.kind}:${reference.entityId}:${reference.revision}`}
                            onClick={() => input.onOpenSettingReference(reference)}
                            type="button"
                          >
                            {SETTING_KIND_LABELS[reference.kind]} {index + 1}
                            {" · r"}{reference.revision.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <footer>
                        <span>{formatInstant(finding.createdAt)}</span>
                      </footer>
                    </li>
                  ))}
                  {input.projection.settingConflictFindings.map((finding) => (
                    <li key={finding.findingId}>
                      <div>
                        <strong>“{finding.label}”</strong>
                        <span>{finding.references.length.toLocaleString()}개</span>
                      </div>
                      <p>
                        {SETTING_KIND_LABELS[finding.settingKind]} 안의
                        {" "}{settingFieldLabel(finding.settingKind, finding.field)} 값이 서로 다름
                      </p>
                      <div
                        aria-label={`“${finding.label}” ${settingFieldLabel(finding.settingKind, finding.field)} 충돌 원본`}
                        className="assistant-setting-reference-list"
                      >
                        {finding.references.map((reference, index) => (
                          <button
                            aria-label={`“${finding.label}” ${settingFieldLabel(finding.settingKind, finding.field)} 충돌 ${SETTING_KIND_LABELS[reference.kind]} ${index + 1} 열기`}
                            disabled={busy}
                            key={`${reference.kind}:${reference.entityId}:${reference.revision}`}
                            onClick={() => input.onOpenSettingReference(reference)}
                            type="button"
                          >
                            {SETTING_KIND_LABELS[reference.kind]} {index + 1}
                            {" · r"}{reference.revision.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <footer>
                        <span>{formatInstant(finding.createdAt)}</span>
                      </footer>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-label="어휘·유의어 제안 결과"
              className="assistant-context-ledger assistant-vocabulary-suggestion-candidates"
            >
              <header>
                <div>
                  <h3>어휘·유의어 제안 결과</h3>
                  <p>원고에 자동 반영하지 않는 작품 후보 기록입니다.</p>
                </div>
                <span>
                  {input.projection?.vocabularySuggestionCandidates.length ?? 0}
                </span>
              </header>
              {input.projection === null ||
                  input.projection.vocabularySuggestionCandidates.length === 0 ? (
                <p className="assistant-context-empty">
                  저장된 어휘·유의어 제안이 없습니다.
                </p>
              ) : (
                <ul>
                  {input.projection.vocabularySuggestionCandidates.map(
                    (candidate) => (
                      <li
                        data-vocabulary-suggestion-candidate={candidate.candidateId}
                        key={candidate.candidateId}
                      >
                        <div>
                          <strong>“{candidate.query}”</strong>
                          <span>{candidate.suggestions.length.toLocaleString()}개</span>
                        </div>
                        <p>
                          {input.connections.find((connection) =>
                            connection.connectionId === candidate.connectionId
                          )?.label ?? candidate.connectionId}
                          {candidate.sourceRange === null
                            ? " · 선택 범위 전송 없음"
                            : ` · ${input.documentLabels[candidate.sourceRange.documentId] ?? candidate.sourceRange.documentId} ${candidate.sourceRange.from.toLocaleString()}–${candidate.sourceRange.to.toLocaleString()}`}
                        </p>
                        {candidate.suggestions.length === 0 ? (
                          <p className="assistant-context-empty">제안된 어휘가 없습니다.</p>
                        ) : (
                          <div className="assistant-vocabulary-suggestion-list">
                            {candidate.suggestions.map((suggestion, index) => (
                              <article key={`${candidate.candidateId}:${index}`}>
                                <strong>{suggestion.word}</strong>
                                {suggestion.nuance.length > 0 && (
                                  <p>{suggestion.nuance}</p>
                                )}
                                {suggestion.example.length > 0 && (
                                  <blockquote>{suggestion.example}</blockquote>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                        {candidate.note.length > 0 && <p>{candidate.note}</p>}
                        <footer>
                          <span>{formatInstant(candidate.createdAt)}</span>
                        </footer>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>

            <section
              aria-label="어휘 검색 결과"
              className="assistant-context-ledger assistant-vocabulary-candidates"
            >
              <header>
                <div>
                  <h3>어휘 검색 결과</h3>
                  <p>검색 결과는 원고와 분리된 작품 후보 기록으로 저장됩니다.</p>
                </div>
                <span>{input.projection?.candidates.length ?? 0}</span>
              </header>
              {input.projection === null || input.projection.candidates.length === 0 ? (
                <p className="assistant-context-empty">저장된 어휘 검색 결과가 없습니다.</p>
              ) : (
                <ul>
                  {input.projection.candidates.map((candidate) => (
                    <li key={candidate.candidateId}>
                      <div>
                        <strong data-candidate-query={candidate.query}>
                          “{candidate.query}”
                        </strong>
                        <span>{candidate.occurrences.length.toLocaleString()}곳</span>
                      </div>
                      <p>
                        {input.documentLabels[candidate.sourceRange.documentId] ??
                          candidate.sourceRange.documentId}
                        {" · "}
                        {candidate.sourceRange.from.toLocaleString()}–
                        {candidate.sourceRange.to.toLocaleString()}
                      </p>
                      <div
                        aria-label={`“${candidate.query}” 위치`}
                        className="assistant-vocabulary-occurrence-list"
                      >
                        {candidate.occurrences.map((occurrence, index) => (
                          <button
                            disabled={busy}
                            key={[
                              occurrence.documentId,
                              occurrence.documentRevisionId,
                              occurrence.from,
                              occurrence.to,
                            ].join(":")}
                            onClick={() =>
                              input.onOpenVocabularyOccurrence(occurrence)
                            }
                            type="button"
                          >
                            {index + 1}. {input.documentLabels[occurrence.documentId] ??
                              occurrence.documentId}
                            {" "}
                            {occurrence.from.toLocaleString()}–
                            {occurrence.to.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <footer>
                        <span>{formatInstant(candidate.createdAt)}</span>
                      </footer>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-label="설정 검토 접근 기록"
              className="assistant-context-ledger assistant-setting-review-receipts"
            >
              <header>
                <div>
                  <h3>설정 검토 기록</h3>
                  <p>설정 값 대신 읽은 항목의 ID와 revision만 저장합니다.</p>
                </div>
                <span>{input.projection?.settingReviewReceipts.length ?? 0}</span>
              </header>
              {input.projection === null ||
                  input.projection.settingReviewReceipts.length === 0 ? (
                <p className="assistant-context-empty">기록된 설정 검토가 없습니다.</p>
              ) : (
                <ul>
                  {input.projection.settingReviewReceipts.map((receipt) => (
                    <li key={receipt.receiptId}>
                      <div>
                        <strong>설정 검토</strong>
                        <span>{receipt.destinationId}</span>
                      </div>
                      <p>
                        읽기 {receipt.reviewedSettings.length.toLocaleString()}개 · 외부 전송 {receipt.transmittedSettingCount}개
                      </p>
                      <footer>
                        <span>{formatInstant(receipt.createdAt)}</span>
                      </footer>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="조수 권한 목록" className="assistant-context-ledger">
            <header>
              <div>
                <h3>승인 원장</h3>
                <p>현재 대화와 이 작품에 해당하는 권한만 표시합니다.</p>
              </div>
              <span>{input.projection?.grants.length ?? 0}</span>
            </header>
            {input.projection === null ? (
              <p className="assistant-context-empty">권한 원장을 불러오는 중입니다.</p>
            ) : input.projection.grants.length === 0 ? (
              <p className="assistant-context-empty">승인한 권한이 없습니다.</p>
            ) : (
              <ul>
                {input.projection.grants.map((grant) => (
                  <li key={grant.grantId}>
                    <div>
                      <strong>{CAPABILITY_LABELS[grant.capability]}</strong>
                      <span>{grant.destinationId}</span>
                    </div>
                    <p>
                      로컬 {SCOPE_LABELS[grant.localScope]} · 외부 {SCOPE_LABELS[grant.externalScope]}
                      {" · "}{DURATION_LABELS[grant.duration]}
                    </p>
                    <footer>
                      <span data-grant-state={grantStateLabel(grant)}>
                        {grantStateLabel(grant)} · {formatInstant(grant.createdAt)}
                      </span>
                      {grant.revokedAt === null && grant.consumedAt === null && (
                        <button
                          disabled={busy}
                          onClick={() => input.onRevoke(grant)}
                          type="button"
                        >
                          철회
                        </button>
                      )}
                    </footer>
                  </li>
                ))}
              </ul>
            )}
            </section>

            <section aria-label="조수 접근 기록" className="assistant-context-ledger assistant-context-receipts">
            <header>
              <div>
                <h3>접근 기록</h3>
                <p>원문 대신 실제로 읽거나 전송한 정확한 범위와 글자 수만 저장합니다.</p>
              </div>
              <span>{input.projection?.receipts.length ?? 0}</span>
            </header>
            {input.projection === null || input.projection.receipts.length === 0 ? (
              <p className="assistant-context-empty">기록된 문맥 접근이 없습니다.</p>
            ) : (
              <ul>
                {input.projection.receipts.map((receipt) => (
                  <li key={receipt.receiptId}>
                    <div>
                      <strong>{CAPABILITY_LABELS[receipt.capability]}</strong>
                      <span>{receipt.destinationId}</span>
                    </div>
                    <p>
                      읽기 {receipt.readCharacterCount.toLocaleString()}자 · 전송 {receipt.transmittedCharacterCount.toLocaleString()}자
                    </p>
                    <footer>
                      <span>{receipt.readRanges.length}개 정확 범위 · {formatInstant(receipt.createdAt)}</span>
                    </footer>
                  </li>
                ))}
              </ul>
            )}
            </section>
          </div>
        </div>

        {input.error !== null && (
          <p className="assistant-context-error" role="alert">{input.error}</p>
        )}
      </section>
    </div>
  );
}
