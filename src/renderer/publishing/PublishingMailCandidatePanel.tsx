import { useState } from "react";

import type {
  PublishingMailCandidateProjection,
  UpdatePublishingMailCandidateCommand,
} from "../../application/publishing/publishing-mail-candidate-contract";
import type {
  PublishingMailConnectionProjection,
  PublishingMailSyncResult,
} from "../../application/publishing/publishing-mail-connection-contract";
import type {
  PublishingMailScheduleProjection,
} from "../../application/publishing/publishing-mail-schedule-contract";
import type { PublishingSubmissionProjection } from "../../application/publishing/publishing-submission-contract";
import { entityId } from "../../domain/writing";
import type { PublishingPartnerDialogActionState } from "./PublishingPartnerDialog";

function reviewStatusLabel(candidate: PublishingMailCandidateProjection): string {
  switch (candidate.reviewStatus) {
    case "needs-link":
      return "투고 연결 필요";
    case "unreviewed":
      return "승인 대기";
    case "approved":
      return "반영 완료";
    case "ignored":
      return "무시됨";
  }
}

function submissionLabel(submission: PublishingSubmissionProjection): string {
  return [
    submission.package.workTitleSnapshot || "제목없음",
    submission.package.partnerNameSnapshot,
    submission.title || submission.status || "투고 기록",
  ].join(" · ");
}

function PublishingMailCandidateCard(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly candidate: PublishingMailCandidateProjection;
  readonly onLink: (
    candidate: PublishingMailCandidateProjection,
    submissionId: PublishingSubmissionProjection["submissionId"],
  ) => void;
  readonly onReview: (
    candidate: PublishingMailCandidateProjection,
    decision: "approve" | "ignore",
  ) => void;
  readonly onUpdate: (
    candidate: PublishingMailCandidateProjection,
    changes: UpdatePublishingMailCandidateCommand["changes"],
  ) => void;
  readonly submissions: readonly PublishingSubmissionProjection[];
}) {
  const { candidate } = input;
  const [submissionId, setSubmissionId] = useState(candidate.submissionId ?? "");
  const [proposedStatus, setProposedStatus] = useState(candidate.proposedStatus);
  const [proposedResult, setProposedResult] = useState(candidate.proposedResult);
  const [proposedRespondedOn, setProposedRespondedOn] = useState(
    candidate.proposedRespondedOn ?? "",
  );
  const [proposedNote, setProposedNote] = useState(candidate.proposedNote);
  const busy = input.actionState !== "idle";
  const linkedSubmission = input.submissions.find(
    (submission) => submission.submissionId === candidate.submissionId,
  ) ?? null;
  const reviewed = candidate.reviewStatus === "approved" || candidate.reviewStatus === "ignored";
  const displayName = candidate.subject || candidate.messageId;

  return (
    <article
      aria-label={`${displayName} 메일 후보`}
      className="publishing-mail-candidate-card"
    >
      <header>
        <div>
          <strong>{displayName}</strong>
          <span>{candidate.from || "보낸 사람 미표시"}</span>
          <small>{new Date(candidate.receivedAt).toLocaleString("ko-KR")}</small>
        </div>
        <span className={`publishing-mail-status publishing-mail-status-${candidate.reviewStatus}`}>
          {reviewStatusLabel(candidate)}
        </span>
      </header>

      {candidate.snippet.length > 0 && (
        <p className="publishing-mail-snippet">{candidate.snippet}</p>
      )}
      <p className="publishing-mail-metadata-note">
        메일 본문은 저장하지 않고 메타데이터와 본문 지문만 보관합니다.
      </p>

      {candidate.reviewStatus === "needs-link" && (
        <section className="publishing-mail-link" aria-label="투고 연결">
          <label>
            <span>연결할 투고</span>
            <select
              aria-label="메일 후보 투고 연결"
              disabled={busy}
              onChange={(event) => setSubmissionId(event.target.value)}
              value={submissionId}
            >
              <option value="">투고를 선택하세요</option>
              {input.submissions.map((submission) => (
                <option key={submission.submissionId} value={submission.submissionId}>
                  {submissionLabel(submission)}
                </option>
              ))}
            </select>
          </label>
          <div className="publishing-mail-actions">
            <button
              disabled={busy}
              onClick={() => input.onReview(candidate, "ignore")}
              type="button"
            >
              무시
            </button>
            <button
              className="primary-button"
              disabled={busy || submissionId.length === 0}
              onClick={() => input.onLink(
                candidate,
                entityId<"PublishingSubmission">(submissionId),
              )}
              type="button"
            >
              {input.actionState === "linking-mail-candidate" ? "연결 중" : "투고 연결"}
            </button>
          </div>
        </section>
      )}

      {candidate.reviewStatus !== "needs-link" && linkedSubmission !== null && (
        <div className="publishing-submission-ownership" role="group" aria-label="메일 후보 연결 대상">
          <span>작품</span>
          <strong>{linkedSubmission.package.workTitleSnapshot || "제목없음"}</strong>
          <span>투고처</span>
          <strong>{linkedSubmission.package.partnerNameSnapshot}</strong>
          <span>투고 기록</span>
          <strong>{linkedSubmission.title || linkedSubmission.status || "이름 없음"}</strong>
        </div>
      )}

      {candidate.reviewStatus === "unreviewed" && (
        <form
          className="publishing-mail-proposal"
          onSubmit={(event) => {
            event.preventDefault();
            input.onUpdate(candidate, {
              proposedStatus,
              proposedResult,
              proposedRespondedOn: proposedRespondedOn.length === 0
                ? null
                : proposedRespondedOn,
              proposedNote,
            });
          }}
        >
          <div className="publishing-partner-field-grid">
            <label>
              <span>반영할 상태</span>
              <input
                aria-label="메일 제안 상태"
                disabled={busy}
                onChange={(event) => setProposedStatus(event.target.value)}
                value={proposedStatus}
              />
            </label>
            <label>
              <span>반영할 결과</span>
              <input
                aria-label="메일 제안 결과"
                disabled={busy}
                onChange={(event) => setProposedResult(event.target.value)}
                value={proposedResult}
              />
            </label>
            <label>
              <span>회신일</span>
              <input
                aria-label="메일 제안 회신일"
                disabled={busy}
                onChange={(event) => setProposedRespondedOn(event.target.value)}
                type="date"
                value={proposedRespondedOn}
              />
            </label>
          </div>
          <label>
            <span>반영할 메모</span>
            <textarea
              aria-label="메일 제안 메모"
              disabled={busy}
              onChange={(event) => setProposedNote(event.target.value)}
              rows={4}
              value={proposedNote}
            />
          </label>
          <div className="publishing-mail-actions">
            <button
              disabled={busy}
              onClick={() => input.onReview(candidate, "ignore")}
              type="button"
            >
              무시
            </button>
            <button disabled={busy} type="submit">
              {input.actionState === "updating-mail-candidate" ? "저장 중" : "제안 저장"}
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => input.onReview(candidate, "approve")}
              type="button"
            >
              {input.actionState === "reviewing-mail-candidate" ? "반영 중" : "승인 반영"}
            </button>
          </div>
        </form>
      )}

      {reviewed && (
        <dl className="publishing-mail-reviewed-proposal">
          <div><dt>상태</dt><dd>{candidate.proposedStatus || "미입력"}</dd></div>
          <div><dt>결과</dt><dd>{candidate.proposedResult || "미입력"}</dd></div>
          <div><dt>회신일</dt><dd>{candidate.proposedRespondedOn ?? "미입력"}</dd></div>
          <div><dt>메모</dt><dd>{candidate.proposedNote || "미입력"}</dd></div>
        </dl>
      )}
    </article>
  );
}

export function PublishingMailCandidatePanel(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly candidates: readonly PublishingMailCandidateProjection[];
  readonly connection: PublishingMailConnectionProjection | null;
  readonly lastSyncResult: PublishingMailSyncResult | null;
  readonly schedule: PublishingMailScheduleProjection | null;
  readonly onConnect: (connectorKind: string, clientId: string) => void;
  readonly onDisconnect: () => void;
  readonly onLink: (
    candidate: PublishingMailCandidateProjection,
    submissionId: PublishingSubmissionProjection["submissionId"],
  ) => void;
  readonly onReview: (
    candidate: PublishingMailCandidateProjection,
    decision: "approve" | "ignore",
  ) => void;
  readonly onUpdate: (
    candidate: PublishingMailCandidateProjection,
    changes: UpdatePublishingMailCandidateCommand["changes"],
  ) => void;
  readonly onSync: () => void;
  readonly onSaveSchedule: (enabled: boolean, localTime: string | null) => void;
  readonly submissions: readonly PublishingSubmissionProjection[];
}) {
  const [clientId, setClientId] = useState(input.connection?.clientId ?? "");
  const [connectorKind, setConnectorKind] = useState(
    input.connection?.activeConnectorKind ?? input.connection?.connectors[0]?.connectorKind ?? "",
  );
  const busy = input.actionState !== "idle";
  return (
    <div className="publishing-mail-candidate-body">
      <header>
        <div>
          <p className="panel-kicker">MAIL CANDIDATES</p>
          <h3>메일 회신 후보</h3>
        </div>
        <span>{input.candidates.length}건</span>
      </header>
      <section aria-label="메일 계정 연결" className="publishing-mail-connection">
        {input.connection === null ? (
          <p className="publishing-partner-empty">메일 연결 상태를 불러오는 중입니다.</p>
        ) : input.connection.state === "connected" ? (
          <>
            <div className="publishing-mail-connection-status">
              <div>
                <span>연결된 계정</span>
                <strong>{input.connection.accountLabel}</strong>
              </div>
              <div>
                <span>마지막 동기화</span>
                <strong>{input.connection.lastSyncedAt === null
                  ? "아직 없음"
                  : new Date(input.connection.lastSyncedAt).toLocaleString("ko-KR")}</strong>
              </div>
            </div>
            <p className="publishing-mail-metadata-note">
              등록된 투고처 이메일의 회신을 사용자가 요청할 때만 읽고, 본문은 저장하지 않습니다.
            </p>
            <section
              aria-label="메일 자동 확인 일정"
              className="publishing-mail-schedule"
            >
              <div className="publishing-mail-schedule-heading">
                <div>
                  <strong>앱 실행 중 자동 확인</strong>
                  <span>지정한 시각에 하루 한 번 확인합니다.</span>
                </div>
                {input.schedule === null ? (
                  <span>불러오는 중</span>
                ) : (
                  <label className="publishing-mail-schedule-toggle">
                    <input
                      aria-label="앱 실행 중 자동 확인"
                      checked={input.schedule.enabled}
                      disabled={busy}
                      onChange={(event) => input.onSaveSchedule(
                        event.target.checked,
                        input.schedule?.localTime ?? null,
                      )}
                      type="checkbox"
                    />
                    <span>{input.schedule.enabled ? "켜짐" : "꺼짐"}</span>
                  </label>
                )}
              </div>
              {input.schedule !== null && (
                <div className="publishing-mail-schedule-details">
                  <label>
                    <span>확인 시각</span>
                    <input
                      aria-label="자동 확인 시각"
                      disabled={busy}
                      onChange={(event) => input.onSaveSchedule(
                        input.schedule?.enabled ?? false,
                        event.target.value.length === 0 ? null : event.target.value,
                      )}
                      type="time"
                      value={input.schedule.localTime ?? ""}
                    />
                  </label>
                  <div>
                    <span>마지막 확인 결과</span>
                    <strong>
                      {input.schedule.lastAttemptedAt === null
                        ? "아직 없음"
                        : `${input.schedule.lastAttemptStatus === "succeeded" ? "성공" : "실패"} · ${new Date(input.schedule.lastAttemptedAt).toLocaleString("ko-KR")}`}
                    </strong>
                  </div>
                </div>
              )}
              {input.actionState === "saving-mail-schedule" && (
                <small>일정을 저장하는 중입니다.</small>
              )}
            </section>
            <div className="publishing-mail-actions">
              <button disabled={busy} onClick={input.onSync} type="button">
                {input.actionState === "syncing-mail" ? "동기화 중…" : "지금 동기화"}
              </button>
              <button disabled={busy} onClick={input.onDisconnect} type="button">
                {input.actionState === "disconnecting-mail" ? "연결 해제 중…" : "연결 해제"}
              </button>
            </div>
            {input.lastSyncResult !== null && (
              <p className="publishing-mail-sync-result" role="status">
                {input.lastSyncResult.discoveredCount}건 확인 · 새 후보 {input.lastSyncResult.newCandidateCount}건
              </p>
            )}
          </>
        ) : input.connection.connectors.length === 0 ? (
          <p className="publishing-partner-empty">사용 가능한 메일 연결 설정이 없습니다.</p>
        ) : (
          <form
            className="publishing-mail-connect-form"
            onSubmit={(event) => {
              event.preventDefault();
              input.onConnect(connectorKind, clientId);
            }}
          >
            <label>
              <span>메일 서비스</span>
              <select
                aria-label="메일 서비스"
                disabled={busy}
                onChange={(event) => setConnectorKind(event.target.value)}
                value={connectorKind}
              >
                {input.connection.connectors.map((connector) => (
                  <option key={connector.connectorKind} value={connector.connectorKind}>
                    {connector.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>데스크톱 앱 OAuth client ID</span>
              <input
                aria-label="메일 OAuth client ID"
                disabled={busy}
                onChange={(event) => setClientId(event.target.value)}
                value={clientId}
              />
            </label>
            <button
              disabled={busy || connectorKind.length === 0 || clientId.trim().length === 0}
              type="submit"
            >
              {input.actionState === "connecting-mail" ? "연결 중…" : "메일 계정 연결"}
            </button>
          </form>
        )}
      </section>
      {input.actionState === "loading" && (
        <p className="publishing-partner-empty">메일 후보를 불러오는 중입니다.</p>
      )}
      {input.actionState !== "loading" && input.candidates.length === 0 && (
        <p className="publishing-partner-empty">검토할 메일 회신 후보가 없습니다.</p>
      )}
      <div className="publishing-mail-candidate-list">
        {input.candidates.map((candidate) => (
          <PublishingMailCandidateCard
            actionState={input.actionState}
            candidate={candidate}
            key={`${candidate.candidateId}-${candidate.revision}`}
            onLink={input.onLink}
            onReview={input.onReview}
            onUpdate={input.onUpdate}
            submissions={input.submissions}
          />
        ))}
      </div>
    </div>
  );
}
