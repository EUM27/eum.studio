import { useMemo, useState } from "react";

import type { AssistantConnectionProjection } from "../../application/assistant/assistant-connection";
import type {
  PublishingAssistantResult,
} from "../../application/publishing/publishing-assistant-contract";
import type { PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import type { PublishingSubmissionProjection } from "../../application/publishing/publishing-submission-contract";
import type { WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import type { PublishingPartnerDialogActionState } from "./PublishingPartnerDialog";

export function PublishingAssistantPanel(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly connections: readonly AssistantConnectionProjection[];
  readonly partners: readonly PublishingPartnerProjection[];
  readonly submissions: readonly PublishingSubmissionProjection[];
  readonly works: WorkspaceCatalogProjection["works"];
  readonly onRun?: ((
    connectionId: EntityId<"AssistantConnection">,
    statement: string,
  ) => Promise<PublishingAssistantResult | null>) | undefined;
  readonly onApprove?: ((candidateId: string) => Promise<boolean>) | undefined;
}) {
  const availableConnections = useMemo(
    () => input.connections.filter((connection) => connection.connectorKind !== null),
    [input.connections],
  );
  const [connectionId, setConnectionId] = useState(
    availableConnections[0]?.connectionId ?? "",
  );
  const [statement, setStatement] = useState("");
  const [result, setResult] = useState<PublishingAssistantResult | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const busy = input.actionState !== "idle";
  const canRun = connectionId.length > 0 && statement.trim().length > 0;
  const partnerName = (partnerId: string) =>
    input.partners.find((partner) => partner.partnerId === partnerId)?.name ?? partnerId;
  const workTitle = (workId: string) =>
    input.works.find((work) => work.workId === workId)?.title || "제목없음";

  return (
    <div className="publishing-assistant-body">
      <section className="publishing-assistant-intro">
        <p className="panel-kicker">WORKSPACE ASSISTANT</p>
        <h3>작업실 조수</h3>
        <p>
          선택한 연결은 요청과 작품·투고처·투고 이력 메타데이터만 받습니다.
          원고 본문은 전송하지 않습니다.
        </p>
      </section>

      <form
        className="publishing-assistant-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canRun || input.onRun === undefined) return;
          setSavedMessage(null);
          void input.onRun(
            connectionId as EntityId<"AssistantConnection">,
            statement.trim(),
          ).then(setResult);
        }}
      >
        <label>
          <span>조수 연결</span>
          <select
            aria-label="투고 작업실 조수 연결"
            disabled={busy}
            onChange={(event) => {
              setConnectionId(event.target.value);
              setResult(null);
              setSavedMessage(null);
            }}
            value={connectionId}
          >
            {availableConnections.length === 0 && (
              <option value="">설정된 연결 없음</option>
            )}
            {availableConnections.map((connection) => (
              <option key={connection.connectionId} value={connection.connectionId}>
                {connection.label} · {connection.model}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>요청</span>
          <textarea
            aria-label="투고 작업실 조수 요청"
            disabled={busy}
            onChange={(event) => {
              setStatement(event.target.value);
              setResult(null);
              setSavedMessage(null);
            }}
            placeholder="예: 어제 별빛 아래를 은하출판과 별빛문고에 보냈어"
            rows={4}
            value={statement}
          />
        </label>
        {availableConnections.length === 0 && (
          <p className="publishing-assistant-notice">
            설정에서 사용할 조수 연결을 먼저 등록하세요.
          </p>
        )}
        <button className="primary-button" disabled={busy || !canRun} type="submit">
          {input.actionState === "running-assistant" ? "해석 중" : "요청 해석"}
        </button>
      </form>

      {savedMessage !== null && (
        <p className="publishing-assistant-saved" role="status">{savedMessage}</p>
      )}

      {result?.status === "needs-confirmation" && (
        <section aria-label="작업실 조수 확인 필요" className="publishing-assistant-result">
          <h3>확인이 필요합니다</h3>
          <ul>
            {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>
      )}

      {result?.status === "query" && (
        <section aria-label="작업실 조수 조회 결과" className="publishing-assistant-result">
          <h3>{result.query === "open" ? "회신이 없는 투고" : "아직 보내지 않은 투고처"}</h3>
          {result.query === "open" ? (
            result.submissionIds.length === 0 ? (
              <p>조건에 맞는 투고가 없습니다.</p>
            ) : (
              <ul>
                {result.submissionIds.map((submissionId) => {
                  const submission = input.submissions.find(
                    (entry) => entry.submissionId === submissionId,
                  );
                  return (
                    <li key={submissionId}>
                      <strong>{submission === undefined ? submissionId : workTitle(submission.workId)}</strong>
                      {submission !== undefined && (
                        <span>
                          {partnerName(submission.partnerId)}
                          {submission.submittedOn === null ? "" : ` · ${submission.submittedOn}`}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : result.partnerIds.length === 0 ? (
            <p>조건에 맞는 투고처가 없습니다.</p>
          ) : (
            <ul>
              {result.partnerIds.map((partnerId) => (
                <li key={partnerId}><strong>{partnerName(partnerId)}</strong></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {result?.status === "record-candidate" && (
        <section aria-label="작업실 조수 기록 후보" className="publishing-assistant-result">
          <h3>저장 전 확인</h3>
          <p>
            아직 원장에는 기록되지 않았습니다. 확인하면 현재 원고 revision을 각 투고 패키지로 봉인합니다.
          </p>
          <strong>{result.candidate.workTitleSnapshot || "제목없음"}</strong>
          <ul>
            {result.candidate.records.map((record) => (
              <li key={record.partnerId}>
                <strong>{record.partnerNameSnapshot}</strong>
                <span>{record.submittedOn ?? "투고일 미입력"}</span>
              </li>
            ))}
          </ul>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => {
              if (input.onApprove === undefined) return;
              const count = result.candidate.records.length;
              void input.onApprove(result.candidate.candidateId).then((approved) => {
                if (!approved) return;
                setResult(null);
                setSavedMessage(`투고 이력 ${count}건을 현재 원고 버전으로 저장했습니다.`);
              });
            }}
            type="button"
          >
            {input.actionState === "approving-assistant" ? "저장 중" : "확인하고 저장"}
          </button>
        </section>
      )}
    </div>
  );
}
