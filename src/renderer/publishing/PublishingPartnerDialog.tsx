import { useState } from "react";

import type {
  CreatePublishingPartnerCommand,
  PublishingPartnerProjection,
  UpdatePublishingPartnerCommand,
} from "../../application/publishing/publishing-partner-contract";
import type {
  CreatePublishingSubmissionCommand,
  PublishingSubmissionProjection,
  UpdatePublishingSubmissionCommand,
} from "../../application/publishing/publishing-submission-contract";
import type {
  CreatePublishingContractCommand,
  PublishingContractProjection,
  UpdatePublishingContractCommand,
} from "../../application/publishing/publishing-contract-contract";
import type {
  CreatePublishingPublicationCommand,
  PublishingPublicationProjection,
  UpdatePublishingPublicationCommand,
} from "../../application/publishing/publishing-publication-contract";
import type {
  CreatePublishingSettlementCommand,
  PublishingSettlementLineItemInput,
  PublishingSettlementProjection,
  UpdatePublishingSettlementCommand,
} from "../../application/publishing/publishing-settlement-contract";
import {
  derivePublishingSettlementReceivable,
  type CreatePublishingPaymentCommand,
  type PublishingPaymentProjection,
  type UpdatePublishingPaymentCommand,
} from "../../application/publishing/publishing-payment-contract";
import type {
  CreatePublishingSourceCommand,
  PublishingSourceProjection,
} from "../../application/publishing/publishing-source-contract";
import type { PublishingEvidenceTargetKind } from "../../application/publishing/publishing-evidence-link-contract";
import type {
  ApplyPublishingPartnerCsvImportCommand,
  PublishingPartnerCsvSelectionProjection,
} from "../../application/publishing/publishing-partner-csv-import";
import type {
  ApplyPublishingSubmissionCsvImportCommand,
  PublishingSubmissionCsvSelectionProjection,
} from "../../application/publishing/publishing-submission-csv-import";
import type {
  PublishingMailCandidateProjection,
  UpdatePublishingMailCandidateCommand,
} from "../../application/publishing/publishing-mail-candidate-contract";
import type {
  PublishingMailConnectionProjection,
  PublishingMailSyncResult,
} from "../../application/publishing/publishing-mail-connection-contract";
import type { PublishingMailScheduleProjection } from "../../application/publishing/publishing-mail-schedule-contract";
import type {
  ApprovePublishingResearchCommand,
  PreviewPublishingResearchCommand,
  PublishingResearchCandidateProjection,
} from "../../application/publishing/publishing-research-contract";
import type { AssistantConnectionProjection } from "../../application/assistant/assistant-connection";
import type { PublishingAssistantResult } from "../../application/publishing/publishing-assistant-contract";
import type { WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import { PublishingPartnerCsvImportPanel } from "./PublishingPartnerCsvImportPanel";
import { PublishingSubmissionCsvImportPanel } from "./PublishingSubmissionCsvImportPanel";
import { PublishingMailCandidatePanel } from "./PublishingMailCandidatePanel";
import { PublishingResearchPanel } from "./PublishingResearchPanel";
import { PublishingAssistantPanel } from "./PublishingAssistantPanel";

export type PublishingPartnerDialogActionState =
  | "idle"
  | "loading"
  | "creating"
  | "updating"
  | "creating-submission"
  | "updating-submission"
  | "creating-contract"
  | "updating-contract"
  | "creating-publication"
  | "updating-publication"
  | "creating-settlement"
  | "updating-settlement"
  | "creating-payment"
  | "updating-payment"
  | "creating-source"
  | "saving-evidence-links"
  | "selecting-partner-csv"
  | "applying-partner-csv"
  | "selecting-submission-csv"
  | "applying-submission-csv"
  | "linking-mail-candidate"
  | "updating-mail-candidate"
  | "reviewing-mail-candidate"
  | "connecting-mail"
  | "syncing-mail"
  | "disconnecting-mail"
  | "saving-mail-schedule"
  | "previewing-research"
  | "approving-research"
  | "running-assistant"
  | "approving-assistant";

export type PublishingPartnerDraft = Omit<
  CreatePublishingPartnerCommand,
  "schemaVersion"
>;

export type PublishingSubmissionDraft = Omit<
  CreatePublishingSubmissionCommand,
  "schemaVersion"
>;

export type PublishingContractDraft = Omit<
  CreatePublishingContractCommand,
  "schemaVersion"
>;

export type PublishingPublicationDraft = Omit<
  CreatePublishingPublicationCommand,
  "schemaVersion"
>;

export type PublishingSettlementDraft = Omit<
  CreatePublishingSettlementCommand,
  "schemaVersion"
>;

export type PublishingPaymentDraft = Omit<
  CreatePublishingPaymentCommand,
  "schemaVersion"
>;

export type PublishingSourceDraft = Omit<
  CreatePublishingSourceCommand,
  "schemaVersion"
>;

function parseGenreLines(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function PublishingPartnerFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly partner: PublishingPartnerProjection | null;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly onCreate: (draft: PublishingPartnerDraft) => void;
  readonly onUpdate: (
    partner: PublishingPartnerProjection,
    changes: UpdatePublishingPartnerCommand["changes"],
  ) => void;
}) {
  const [name, setName] = useState(input.partner?.name ?? "");
  const [parentPartnerId, setParentPartnerId] = useState(
    input.partner?.parentPartnerId ?? "",
  );
  const [submissionMethod, setSubmissionMethod] = useState(
    input.partner?.submissionMethod ?? "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    input.partner?.websiteUrl ?? "",
  );
  const [email, setEmail] = useState(input.partner?.email ?? "");
  const [genres, setGenres] = useState(input.partner?.genres.join("\n") ?? "");
  const [requiredLength, setRequiredLength] = useState(
    input.partner?.requiredLength ?? "",
  );
  const [priority, setPriority] = useState(input.partner?.priority ?? "");
  const [note, setNote] = useState(input.partner?.note ?? "");
  const partner = input.partner;
  const busy = input.actionState !== "idle";
  const draft = (): PublishingPartnerDraft => ({
    name,
    parentPartnerId: parentPartnerId.length === 0
      ? null
      : entityId<"PublishingPartner">(parentPartnerId),
    submissionMethod,
    websiteUrl,
    email,
    genres: parseGenreLines(genres),
    requiredLength,
    priority,
    note,
  });

  return (
    <form
      className="publishing-partner-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (partner === null) {
          input.onCreate(draft());
          return;
        }
        input.onUpdate(partner, draft());
      }}
    >
      <div className="publishing-partner-field-grid">
        <label>
          <span>투고처 이름</span>
          <input
            aria-label="투고처 이름"
            autoFocus
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            placeholder="출판사·플랫폼·공모전 이름"
            value={name}
          />
        </label>
        <label>
          <span>모 출판사</span>
          <select
            aria-label="모 출판사"
            disabled={busy}
            onChange={(event) => setParentPartnerId(event.target.value)}
            value={parentPartnerId}
          >
            <option value="">연결하지 않음</option>
            {input.partners
              .filter((candidate) => candidate.partnerId !== partner?.partnerId)
              .map((candidate) => (
                <option key={candidate.partnerId} value={candidate.partnerId}>
                  {candidate.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>투고 방식</span>
          <input
            aria-label="투고 방식"
            disabled={busy}
            onChange={(event) => setSubmissionMethod(event.target.value)}
            placeholder="이메일, 온라인 폼 등"
            value={submissionMethod}
          />
        </label>
        <label>
          <span>투고 링크</span>
          <input
            aria-label="투고 링크"
            disabled={busy}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="안내 또는 접수 주소"
            value={websiteUrl}
          />
        </label>
        <label>
          <span>이메일</span>
          <input
            aria-label="투고처 이메일"
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="담당 또는 접수 이메일"
            value={email}
          />
        </label>
        <label>
          <span>투고 분량</span>
          <input
            aria-label="투고 분량"
            disabled={busy}
            onChange={(event) => setRequiredLength(event.target.value)}
            placeholder="요구 원고·시놉시스 분량"
            value={requiredLength}
          />
        </label>
        <label>
          <span>우선순위</span>
          <input
            aria-label="투고처 우선순위"
            disabled={busy}
            onChange={(event) => setPriority(event.target.value)}
            placeholder="자유롭게 적습니다"
            value={priority}
          />
        </label>
        <label className="publishing-partner-genres-field">
          <span>장르</span>
          <textarea
            aria-label="투고처 장르"
            disabled={busy}
            onChange={(event) => setGenres(event.target.value)}
            placeholder={'장르를 한 줄에 하나씩 적습니다'}
            rows={3}
            value={genres}
          />
        </label>
      </div>
      <label className="publishing-partner-note-field">
        <span>메모</span>
        <textarea
          aria-label="투고처 메모"
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
          placeholder="마감, 담당자, 확인할 내용을 적습니다."
          rows={5}
          value={note}
        />
      </label>
      {partner !== null && partner.sourceIds.length > 0 && (
        <p className="publishing-partner-source-count">
          연결된 근거 {partner.sourceIds.length}개
        </p>
      )}
      <div className="publishing-partner-field-actions">
        <button
          className="primary-button"
          disabled={busy || name.trim().length === 0}
          type="submit"
        >
          {partner === null
            ? input.actionState === "creating" ? "추가 중" : "투고처 추가"
            : input.actionState === "updating" ? "저장 중" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}

function responseDurationDays(
  submittedOn: string | null,
  respondedOn: string | null,
): number | null {
  if (submittedOn === null || respondedOn === null) return null;
  const submitted = Date.parse(`${submittedOn}T00:00:00.000Z`);
  const responded = Date.parse(`${respondedOn}T00:00:00.000Z`);
  if (responded < submitted) return null;
  return Math.floor((responded - submitted) / 86_400_000);
}

function PublishingSubmissionFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly onCreate: (draft: PublishingSubmissionDraft) => void;
  readonly onUpdate: (
    submission: PublishingSubmissionProjection,
    changes: UpdatePublishingSubmissionCommand["changes"],
  ) => void;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly submission: PublishingSubmissionProjection | null;
  readonly works: WorkspaceCatalogProjection["works"];
}) {
  const submission = input.submission;
  const [workId, setWorkId] = useState(submission?.workId ?? "");
  const [partnerId, setPartnerId] = useState(submission?.partnerId ?? "");
  const [title, setTitle] = useState(submission?.title ?? "");
  const [status, setStatus] = useState(submission?.status ?? "");
  const [submittedOn, setSubmittedOn] = useState(submission?.submittedOn ?? "");
  const [respondedOn, setRespondedOn] = useState(submission?.respondedOn ?? "");
  const [result, setResult] = useState(submission?.result ?? "");
  const [note, setNote] = useState(submission?.note ?? "");
  const [cardNote, setCardNote] = useState(submission?.cardNote ?? "");
  const busy = input.actionState !== "idle";
  const selectedWork = input.works.find((work) => work.workId === workId);
  const selectedPartner = input.partners.find(
    (partner) => partner.partnerId === partnerId,
  );
  const durationDays = responseDurationDays(
    submittedOn.length === 0 ? null : submittedOn,
    respondedOn.length === 0 ? null : respondedOn,
  );

  return (
    <form
      className="publishing-partner-fields publishing-submission-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (submission === null) {
          if (workId.length === 0 || partnerId.length === 0) return;
          input.onCreate({
            workId: entityId<"Work">(workId),
            partnerId: entityId<"PublishingPartner">(partnerId),
            title,
            status,
            submittedOn: submittedOn.length === 0 ? null : submittedOn,
            respondedOn: respondedOn.length === 0 ? null : respondedOn,
            result,
            note,
            cardNote,
          });
          return;
        }
        input.onUpdate(submission, {
          status,
          respondedOn: respondedOn.length === 0 ? null : respondedOn,
          result,
          note,
          cardNote,
        });
      }}
    >
      <div className="publishing-partner-field-grid">
        {submission === null ? (
          <>
            <label>
              <span>작품</span>
              <select
                aria-label="투고 작품"
                autoFocus
                disabled={busy}
                onChange={(event) => setWorkId(event.target.value)}
                value={workId}
              >
                <option value="">작품 선택</option>
                {input.works.map((work) => (
                  <option key={work.workId} value={work.workId}>
                    {work.title || "제목없음"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>투고처</span>
              <select
                aria-label="투고처 선택"
                disabled={busy}
                onChange={(event) => setPartnerId(event.target.value)}
                value={partnerId}
              >
                <option value="">투고처 선택</option>
                {input.partners.map((partner) => (
                  <option key={partner.partnerId} value={partner.partnerId}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="publishing-submission-ownership" role="group" aria-label="봉인 대상">
            <span>작품</span>
            <strong>{submission.package.workTitleSnapshot || "제목없음"}</strong>
            <span>투고처</span>
            <strong>{submission.package.partnerNameSnapshot}</strong>
          </div>
        )}
        <label>
          <span>기록 제목</span>
          <input
            aria-label="투고 기록 제목"
            disabled={busy || submission !== null}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="비워도 됩니다"
            value={title}
          />
        </label>
        <label>
          <span>상태</span>
          <input
            aria-label="투고 상태"
            disabled={busy}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="접수, 검토 중 등"
            value={status}
          />
        </label>
        <label>
          <span>투고일</span>
          <input
            aria-label="투고일"
            disabled={busy || submission !== null}
            onChange={(event) => setSubmittedOn(event.target.value)}
            type="date"
            value={submittedOn}
          />
        </label>
        <label>
          <span>회신일</span>
          <input
            aria-label="회신일"
            disabled={busy}
            onChange={(event) => setRespondedOn(event.target.value)}
            type="date"
            value={respondedOn}
          />
        </label>
        <label>
          <span>결과</span>
          <input
            aria-label="투고 결과"
            disabled={busy}
            onChange={(event) => setResult(event.target.value)}
            placeholder="결과를 자유롭게 적습니다"
            value={result}
          />
        </label>
        <label>
          <span>카드 메모</span>
          <input
            aria-label="투고 카드 메모"
            disabled={busy}
            onChange={(event) => setCardNote(event.target.value)}
            placeholder="목록에서 기억할 짧은 메모"
            value={cardNote}
          />
        </label>
      </div>
      <label className="publishing-partner-note-field">
        <span>메모</span>
        <textarea
          aria-label="투고 메모"
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
          placeholder="접수 번호, 회신 내용, 다음 행동을 적습니다."
          rows={5}
          value={note}
        />
      </label>
      {submission !== null && (
        <section className="publishing-submission-package" aria-label="제출 당시 원고 봉인본">
          <strong>제출 당시 원고 봉인본</strong>
          <span>{submission.package.documentRevisions.length}개 문서</span>
          <span>{new Date(submission.package.sealedAt).toLocaleString("ko-KR")}</span>
          <small>{submission.package.manifestHash}</small>
        </section>
      )}
      {durationDays !== null && (
        <p className="publishing-partner-source-count">회신까지 {durationDays}일</p>
      )}
      {submission === null && (selectedWork === undefined || selectedPartner === undefined) && (
        <p className="publishing-partner-source-count">
          작품과 투고처를 선택하면 현재 원고 revision이 함께 봉인됩니다.
        </p>
      )}
      <div className="publishing-partner-field-actions">
        <button
          className="primary-button"
          disabled={
            busy ||
            (submission === null &&
              (selectedWork === undefined || selectedPartner === undefined))
          }
          type="submit"
        >
          {submission === null
            ? input.actionState === "creating-submission"
              ? "봉인 중"
              : "현재 원고 버전으로 기록 추가"
            : input.actionState === "updating-submission"
              ? "저장 중"
              : "투고 이력 저장"}
        </button>
      </div>
    </form>
  );
}

function PublishingContractFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly contract: PublishingContractProjection | null;
  readonly onCreate: (draft: PublishingContractDraft) => void;
  readonly onUpdate: (
    contract: PublishingContractProjection,
    changes: UpdatePublishingContractCommand["changes"],
  ) => void;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly submissions: readonly PublishingSubmissionProjection[];
  readonly works: WorkspaceCatalogProjection["works"];
}) {
  const contract = input.contract;
  const [workId, setWorkId] = useState(contract?.workId ?? "");
  const [partnerId, setPartnerId] = useState(contract?.partnerId ?? "");
  const [submissionId, setSubmissionId] = useState(contract?.submissionId ?? "");
  const [title, setTitle] = useState(contract?.title ?? "");
  const [status, setStatus] = useState(contract?.status ?? "");
  const [signedOn, setSignedOn] = useState(contract?.signedOn ?? "");
  const [startsOn, setStartsOn] = useState(contract?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(contract?.endsOn ?? "");
  const [rightsScope, setRightsScope] = useState(contract?.rightsScope ?? "");
  const [advanceAmount, setAdvanceAmount] = useState(
    contract?.advanceAmount === null || contract === null
      ? ""
      : String(contract.advanceAmount),
  );
  const [currencyCode, setCurrencyCode] = useState(contract?.currencyCode ?? "");
  const [revenueShareNote, setRevenueShareNote] = useState(
    contract?.revenueShareNote ?? "",
  );
  const [note, setNote] = useState(contract?.note ?? "");
  const busy = input.actionState !== "idle";
  const selectedWork = input.works.find((work) => work.workId === workId);
  const selectedPartner = input.partners.find(
    (partner) => partner.partnerId === partnerId,
  );
  const matchingSubmissions = input.submissions.filter(
    (submission) =>
      submission.workId === workId && submission.partnerId === partnerId,
  );
  const linkedSubmission = input.submissions.find(
    (submission) => submission.submissionId === submissionId,
  );
  const parsedAdvanceAmount = advanceAmount.trim().length === 0
    ? null
    : Number(advanceAmount);
  const amountIsValid = parsedAdvanceAmount === null ||
    (Number.isFinite(parsedAdvanceAmount) && parsedAdvanceAmount >= 0);

  return (
    <form
      className="publishing-partner-fields publishing-contract-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (!amountIsValid) return;
        if (contract === null) {
          if (selectedWork === undefined || selectedPartner === undefined) return;
          input.onCreate({
            workId: entityId<"Work">(workId),
            partnerId: entityId<"PublishingPartner">(partnerId),
            submissionId: submissionId.length === 0
              ? null
              : entityId<"PublishingSubmission">(submissionId),
            title,
            status,
            signedOn: signedOn.length === 0 ? null : signedOn,
            startsOn: startsOn.length === 0 ? null : startsOn,
            endsOn: endsOn.length === 0 ? null : endsOn,
            rightsScope,
            advanceAmount: parsedAdvanceAmount,
            currencyCode,
            revenueShareNote,
            note,
          });
          return;
        }
        input.onUpdate(contract, {
          status,
          signedOn: signedOn.length === 0 ? null : signedOn,
          startsOn: startsOn.length === 0 ? null : startsOn,
          endsOn: endsOn.length === 0 ? null : endsOn,
          rightsScope,
          advanceAmount: parsedAdvanceAmount,
          currencyCode,
          revenueShareNote,
          note,
        });
      }}
    >
      <div className="publishing-partner-field-grid">
        {contract === null ? (
          <>
            <label>
              <span>작품</span>
              <select
                aria-label="계약 작품"
                autoFocus
                disabled={busy}
                onChange={(event) => {
                  setWorkId(event.target.value);
                  setSubmissionId("");
                }}
                value={workId}
              >
                <option value="">작품 선택</option>
                {input.works.map((work) => (
                  <option key={work.workId} value={work.workId}>
                    {work.title || "제목없음"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>거래처</span>
              <select
                aria-label="계약 거래처"
                disabled={busy}
                onChange={(event) => {
                  setPartnerId(event.target.value);
                  setSubmissionId("");
                }}
                value={partnerId}
              >
                <option value="">투고처 선택</option>
                {input.partners.map((partner) => (
                  <option key={partner.partnerId} value={partner.partnerId}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="publishing-partner-note-field">
              <span>연결 투고</span>
              <select
                aria-label="계약 연결 투고"
                disabled={busy || selectedWork === undefined || selectedPartner === undefined}
                onChange={(event) => setSubmissionId(event.target.value)}
                value={submissionId}
              >
                <option value="">연결하지 않음</option>
                {matchingSubmissions.map((submission) => (
                  <option key={submission.submissionId} value={submission.submissionId}>
                    {submission.title || `${submission.package.workTitleSnapshot} · ${submission.package.partnerNameSnapshot}`}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="publishing-submission-ownership" role="group" aria-label="계약 소유 관계">
            <span>작품</span>
            <strong>{contract.workTitleSnapshot || "제목없음"}</strong>
            <span>거래처</span>
            <strong>{contract.partnerNameSnapshot}</strong>
            <span>연결 투고</span>
            <strong>{linkedSubmission?.title || (contract.submissionId === null ? "연결하지 않음" : "연결 기록")}</strong>
          </div>
        )}
        <label>
          <span>계약명</span>
          <input
            aria-label="계약명"
            disabled={busy || contract !== null}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="비워도 됩니다"
            value={title}
          />
        </label>
        <label>
          <span>상태</span>
          <input
            aria-label="계약 상태"
            disabled={busy}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="자유롭게 적습니다"
            value={status}
          />
        </label>
        <label>
          <span>체결일</span>
          <input aria-label="계약 체결일" disabled={busy} onChange={(event) => setSignedOn(event.target.value)} type="date" value={signedOn} />
        </label>
        <label>
          <span>시작일</span>
          <input aria-label="계약 시작일" disabled={busy} onChange={(event) => setStartsOn(event.target.value)} type="date" value={startsOn} />
        </label>
        <label>
          <span>종료일</span>
          <input aria-label="계약 종료일" disabled={busy} onChange={(event) => setEndsOn(event.target.value)} type="date" value={endsOn} />
        </label>
        <label>
          <span>선급금</span>
          <input aria-label="계약 선급금" disabled={busy} min="0" onChange={(event) => setAdvanceAmount(event.target.value)} step="any" type="number" value={advanceAmount} />
        </label>
        <label>
          <span>통화</span>
          <input aria-label="계약 통화" disabled={busy} onChange={(event) => setCurrencyCode(event.target.value)} placeholder="직접 입력" value={currencyCode} />
        </label>
        <label className="publishing-partner-note-field">
          <span>권리 범위</span>
          <textarea aria-label="계약 권리 범위" disabled={busy} onChange={(event) => setRightsScope(event.target.value)} rows={3} value={rightsScope} />
        </label>
        <label className="publishing-partner-note-field">
          <span>수익 배분 메모</span>
          <textarea aria-label="계약 수익 배분 메모" disabled={busy} onChange={(event) => setRevenueShareNote(event.target.value)} rows={3} value={revenueShareNote} />
        </label>
      </div>
      <label className="publishing-partner-note-field">
        <span>메모</span>
        <textarea aria-label="계약 메모" disabled={busy} onChange={(event) => setNote(event.target.value)} rows={4} value={note} />
      </label>
      <div className="publishing-partner-field-actions">
        <button
          className="primary-button"
          disabled={busy || !amountIsValid || (contract === null && (selectedWork === undefined || selectedPartner === undefined))}
          type="submit"
        >
          {contract === null
            ? input.actionState === "creating-contract" ? "추가 중" : "계약 추가"
            : input.actionState === "updating-contract" ? "저장 중" : "계약 변경 저장"}
        </button>
      </div>
    </form>
  );
}

function PublishingPublicationFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly contracts: readonly PublishingContractProjection[];
  readonly onCreate: (draft: PublishingPublicationDraft) => void;
  readonly onUpdate: (
    publication: PublishingPublicationProjection,
    changes: UpdatePublishingPublicationCommand["changes"],
  ) => void;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly publication: PublishingPublicationProjection | null;
  readonly works: WorkspaceCatalogProjection["works"];
}) {
  const publication = input.publication;
  const [workId, setWorkId] = useState(publication?.workId ?? "");
  const [contractId, setContractId] = useState(publication?.contractId ?? "");
  const [channelPartnerId, setChannelPartnerId] = useState(
    publication?.channelPartnerId ?? "",
  );
  const [title, setTitle] = useState(publication?.title ?? "");
  const [status, setStatus] = useState(publication?.status ?? "");
  const [format, setFormat] = useState(publication?.format ?? "");
  const [scheduledOn, setScheduledOn] = useState(publication?.scheduledOn ?? "");
  const [startsOn, setStartsOn] = useState(publication?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(publication?.endsOn ?? "");
  const [publishedUnitCount, setPublishedUnitCount] = useState(
    publication?.publishedUnitCount?.toString() ?? "",
  );
  const [plannedUnitCount, setPlannedUnitCount] = useState(
    publication?.plannedUnitCount?.toString() ?? "",
  );
  const [scheduleNote, setScheduleNote] = useState(publication?.scheduleNote ?? "");
  const [note, setNote] = useState(publication?.note ?? "");
  const busy = input.actionState !== "idle";
  const selectedWork = input.works.find((work) => work.workId === workId);
  const contractOptions = input.contracts.filter(
    (contract) => contract.workId === workId,
  );
  const parseCount = (value: string) => value.trim().length === 0 ? null : Number(value);
  const parsedPublishedUnitCount = parseCount(publishedUnitCount);
  const parsedPlannedUnitCount = parseCount(plannedUnitCount);
  const countsAreValid = [parsedPublishedUnitCount, parsedPlannedUnitCount].every(
    (value) => value === null || (Number.isSafeInteger(value) && value >= 0),
  );

  return (
    <form
      className="publishing-partner-fields publishing-contract-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (!countsAreValid) return;
        const relations = {
          contractId: contractId.length === 0
            ? null
            : entityId<"PublishingContract">(contractId),
          channelPartnerId: channelPartnerId.length === 0
            ? null
            : entityId<"PublishingPartner">(channelPartnerId),
        };
        if (publication === null) {
          if (selectedWork === undefined) return;
          input.onCreate({
            workId: entityId<"Work">(workId),
            ...relations,
            title,
            status,
            format,
            scheduledOn: scheduledOn.length === 0 ? null : scheduledOn,
            startsOn: startsOn.length === 0 ? null : startsOn,
            endsOn: endsOn.length === 0 ? null : endsOn,
            publishedUnitCount: parsedPublishedUnitCount,
            plannedUnitCount: parsedPlannedUnitCount,
            scheduleNote,
            note,
          });
          return;
        }
        input.onUpdate(publication, {
          ...relations,
          status,
          format,
          scheduledOn: scheduledOn.length === 0 ? null : scheduledOn,
          startsOn: startsOn.length === 0 ? null : startsOn,
          endsOn: endsOn.length === 0 ? null : endsOn,
          publishedUnitCount: parsedPublishedUnitCount,
          plannedUnitCount: parsedPlannedUnitCount,
          scheduleNote,
          note,
        });
      }}
    >
      <div className="publishing-partner-field-grid">
        <label>
          <span>작품</span>
          <select
            aria-label="발행 작품"
            disabled={busy || publication !== null}
            onChange={(event) => {
              setWorkId(event.target.value);
              setContractId("");
            }}
            value={workId}
          >
            <option value="">작품 선택</option>
            {input.works.map((work) => (
              <option key={work.workId} value={work.workId}>{work.title || "제목없음"}</option>
            ))}
          </select>
        </label>
        <label>
          <span>연결 계약</span>
          <select
            aria-label="발행 연결 계약"
            disabled={busy || workId.length === 0}
            onChange={(event) => setContractId(event.target.value)}
            value={contractId}
          >
            <option value="">연결하지 않음</option>
            {contractOptions.map((contract) => (
              <option key={contract.contractId} value={contract.contractId}>
                {contract.title || contract.partnerNameSnapshot || "이름 없음"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>채널</span>
          <select
            aria-label="발행 채널"
            disabled={busy}
            onChange={(event) => setChannelPartnerId(event.target.value)}
            value={channelPartnerId}
          >
            <option value="">미지정</option>
            {input.partners.map((partner) => (
              <option key={partner.partnerId} value={partner.partnerId}>{partner.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>발행 단위 이름</span>
          <input
            aria-label="발행 단위 이름"
            disabled={busy || publication !== null}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label>
          <span>상태</span>
          <input aria-label="발행 상태" disabled={busy} onChange={(event) => setStatus(event.target.value)} placeholder="직접 입력" value={status} />
        </label>
        <label>
          <span>형태</span>
          <input aria-label="발행 형태" disabled={busy} onChange={(event) => setFormat(event.target.value)} placeholder="직접 입력" value={format} />
        </label>
        <label>
          <span>공개 예정일</span>
          <input aria-label="발행 공개 예정일" disabled={busy} onChange={(event) => setScheduledOn(event.target.value)} type="date" value={scheduledOn} />
        </label>
        <label>
          <span>시작일</span>
          <input aria-label="발행 시작일" disabled={busy} onChange={(event) => setStartsOn(event.target.value)} type="date" value={startsOn} />
        </label>
        <label>
          <span>종료일</span>
          <input aria-label="발행 종료일" disabled={busy} onChange={(event) => setEndsOn(event.target.value)} type="date" value={endsOn} />
        </label>
        <label>
          <span>공개 단위 수</span>
          <input aria-label="공개 단위 수" disabled={busy} min="0" onChange={(event) => setPublishedUnitCount(event.target.value)} step="1" type="number" value={publishedUnitCount} />
        </label>
        <label>
          <span>계획 단위 수</span>
          <input aria-label="계획 단위 수" disabled={busy} min="0" onChange={(event) => setPlannedUnitCount(event.target.value)} step="1" type="number" value={plannedUnitCount} />
        </label>
        <label className="publishing-partner-note-field">
          <span>일정 메모</span>
          <textarea aria-label="발행 일정 메모" disabled={busy} onChange={(event) => setScheduleNote(event.target.value)} rows={3} value={scheduleNote} />
        </label>
      </div>
      <label className="publishing-partner-note-field">
        <span>메모</span>
        <textarea aria-label="발행 메모" disabled={busy} onChange={(event) => setNote(event.target.value)} rows={4} value={note} />
      </label>
      <div className="publishing-partner-field-actions">
        <button
          className="primary-button"
          disabled={busy || !countsAreValid || (publication === null && selectedWork === undefined)}
          type="submit"
        >
          {publication === null
            ? input.actionState === "creating-publication" ? "추가 중" : "발행·연재 추가"
            : input.actionState === "updating-publication" ? "저장 중" : "발행·연재 변경 저장"}
        </button>
      </div>
    </form>
  );
}

function PublishingSettlementFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly onCreate: (draft: PublishingSettlementDraft) => void;
  readonly onUpdate: (
    settlement: PublishingSettlementProjection,
    changes: UpdatePublishingSettlementCommand["changes"],
  ) => void;
  readonly publications: readonly PublishingPublicationProjection[];
  readonly settlement: PublishingSettlementProjection | null;
  readonly works: WorkspaceCatalogProjection["works"];
}) {
  const settlement = input.settlement;
  const [workId, setWorkId] = useState(settlement?.workId ?? "");
  const [publicationId, setPublicationId] = useState(settlement?.publicationId ?? "");
  const [title, setTitle] = useState(settlement?.title ?? "");
  const [periodStartsOn, setPeriodStartsOn] = useState(settlement?.periodStartsOn ?? "");
  const [periodEndsOn, setPeriodEndsOn] = useState(settlement?.periodEndsOn ?? "");
  const [issuedOn, setIssuedOn] = useState(settlement?.issuedOn ?? "");
  const [reviewStatus, setReviewStatus] = useState(settlement?.reviewStatus ?? "");
  const [currencyCode, setCurrencyCode] = useState(settlement?.currencyCode ?? "");
  const [reportedAmount, setReportedAmount] = useState(
    settlement?.reportedAmount?.toString() ?? "",
  );
  const [items, setItems] = useState<readonly PublishingSettlementLineItemInput[]>(
    settlement?.items ?? [],
  );
  const [itemLabel, setItemLabel] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [note, setNote] = useState(settlement?.note ?? "");
  const busy = input.actionState !== "idle";
  const selectedWork = input.works.find((work) => work.workId === workId);
  const publicationOptions = input.publications.filter(
    (publication) => publication.workId === workId,
  );
  const parsedReportedAmount = reportedAmount.trim().length === 0
    ? null
    : Number(reportedAmount);
  const reportedAmountIsValid = parsedReportedAmount === null ||
    Number.isFinite(parsedReportedAmount);
  const parsedItemAmount = Number(itemAmount);
  const pendingItemIsValid = itemLabel.trim().length > 0 &&
    itemAmount.trim().length > 0 && Number.isFinite(parsedItemAmount);

  return (
    <form
      className="publishing-partner-fields publishing-contract-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (!reportedAmountIsValid) return;
        const mutable = {
          periodStartsOn: periodStartsOn.length === 0 ? null : periodStartsOn,
          periodEndsOn: periodEndsOn.length === 0 ? null : periodEndsOn,
          issuedOn: issuedOn.length === 0 ? null : issuedOn,
          reviewStatus,
          currencyCode,
          reportedAmount: parsedReportedAmount,
          items,
          note,
        };
        if (settlement === null) {
          if (selectedWork === undefined || publicationId.length === 0) return;
          input.onCreate({
            workId: entityId<"Work">(workId),
            publicationId: entityId<"PublishingPublication">(publicationId),
            title,
            ...mutable,
          });
          return;
        }
        input.onUpdate(settlement, mutable);
      }}
    >
      <div className="publishing-partner-field-grid">
        <label>
          <span>작품</span>
          <select
            aria-label="정산 작품"
            disabled={busy || settlement !== null}
            onChange={(event) => {
              setWorkId(event.target.value);
              setPublicationId("");
            }}
            value={workId}
          >
            <option value="">작품 선택</option>
            {input.works.map((work) => (
              <option key={work.workId} value={work.workId}>{work.title || "제목없음"}</option>
            ))}
          </select>
        </label>
        <label>
          <span>발행·연재</span>
          <select
            aria-label="정산 발행·연재"
            disabled={busy || settlement !== null || workId.length === 0}
            onChange={(event) => setPublicationId(event.target.value)}
            value={publicationId}
          >
            <option value="">선택</option>
            {publicationOptions.map((publication) => (
              <option key={publication.publicationId} value={publication.publicationId}>
                {publication.title || publication.channelNameSnapshot || "이름 없음"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>정산서 이름</span>
          <input aria-label="정산서 이름" disabled={busy || settlement !== null} onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>기간 시작</span>
          <input aria-label="정산 기간 시작" disabled={busy} onChange={(event) => setPeriodStartsOn(event.target.value)} type="date" value={periodStartsOn} />
        </label>
        <label>
          <span>기간 종료</span>
          <input aria-label="정산 기간 종료" disabled={busy} onChange={(event) => setPeriodEndsOn(event.target.value)} type="date" value={periodEndsOn} />
        </label>
        <label>
          <span>발행일</span>
          <input aria-label="정산 발행일" disabled={busy} onChange={(event) => setIssuedOn(event.target.value)} type="date" value={issuedOn} />
        </label>
        <label>
          <span>검토 상태</span>
          <input aria-label="정산 검토 상태" disabled={busy} onChange={(event) => setReviewStatus(event.target.value)} placeholder="직접 입력" value={reviewStatus} />
        </label>
        <label>
          <span>보고 금액</span>
          <input aria-label="정산 보고 금액" disabled={busy} onChange={(event) => setReportedAmount(event.target.value)} step="any" type="number" value={reportedAmount} />
        </label>
        <label>
          <span>통화</span>
          <input aria-label="정산 통화" disabled={busy} onChange={(event) => setCurrencyCode(event.target.value)} placeholder="직접 입력" value={currencyCode} />
        </label>
      </div>

      <fieldset className="publishing-package-summary">
        <legend>가감 항목</legend>
        {items.length === 0 ? (
          <p className="publishing-partner-empty">등록한 가감 항목이 없습니다.</p>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li key={item.settlementLineItemId ?? `new-${index}`}>
                <span>{item.label}</span>
                <strong>{item.amount}{currencyCode.length > 0 ? ` ${currencyCode}` : ""}</strong>
                <small>{item.note}</small>
                <button
                  disabled={busy}
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                >
                  항목 삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="publishing-partner-field-grid">
          <label>
            <span>항목명</span>
            <input aria-label="정산 가감 항목명" disabled={busy} onChange={(event) => setItemLabel(event.target.value)} value={itemLabel} />
          </label>
          <label>
            <span>금액</span>
            <input aria-label="정산 가감 금액" disabled={busy} onChange={(event) => setItemAmount(event.target.value)} step="any" type="number" value={itemAmount} />
          </label>
          <label>
            <span>항목 메모</span>
            <input aria-label="정산 가감 메모" disabled={busy} onChange={(event) => setItemNote(event.target.value)} value={itemNote} />
          </label>
        </div>
        <button
          disabled={busy || !pendingItemIsValid}
          onClick={() => {
            if (!pendingItemIsValid) return;
            setItems((current) => Object.freeze([
              ...current,
              Object.freeze({
                settlementLineItemId: null,
                label: itemLabel.trim(),
                amount: parsedItemAmount,
                note: itemNote,
              }),
            ]));
            setItemLabel("");
            setItemAmount("");
            setItemNote("");
          }}
          type="button"
        >
          항목 추가
        </button>
      </fieldset>

      <label className="publishing-partner-note-field">
        <span>메모</span>
        <textarea aria-label="정산 메모" disabled={busy} onChange={(event) => setNote(event.target.value)} rows={4} value={note} />
      </label>
      <div className="publishing-partner-field-actions">
        <button
          className="primary-button"
          disabled={
            busy || !reportedAmountIsValid ||
            (settlement === null && (selectedWork === undefined || publicationId.length === 0))
          }
          type="submit"
        >
          {settlement === null
            ? input.actionState === "creating-settlement" ? "추가 중" : "정산서 추가"
            : input.actionState === "updating-settlement" ? "저장 중" : "정산서 변경 저장"}
        </button>
      </div>
    </form>
  );
}

function PublishingPaymentFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly onCreate: (draft: PublishingPaymentDraft) => void;
  readonly onUpdate: (
    payment: PublishingPaymentProjection,
    changes: UpdatePublishingPaymentCommand["changes"],
  ) => void;
  readonly payment: PublishingPaymentProjection | null;
  readonly settlements: readonly PublishingSettlementProjection[];
  readonly works: WorkspaceCatalogProjection["works"];
}) {
  const payment = input.payment;
  const [workId, setWorkId] = useState(payment?.workId ?? "");
  const [settlementId, setSettlementId] = useState(payment?.settlementId ?? "");
  const [receivedOn, setReceivedOn] = useState(payment?.receivedOn ?? "");
  const [confirmedOn, setConfirmedOn] = useState(payment?.confirmedOn ?? "");
  const [amount, setAmount] = useState(payment?.amount.toString() ?? "");
  const [currencyCode, setCurrencyCode] = useState(payment?.currencyCode ?? "");
  const [matchStatus, setMatchStatus] = useState(payment?.matchStatus ?? "");
  const [payerLabel, setPayerLabel] = useState(payment?.payerLabel ?? "");
  const [reference, setReference] = useState(payment?.reference ?? "");
  const [note, setNote] = useState(payment?.note ?? "");
  const busy = input.actionState !== "idle";
  const selectedWork = input.works.find((work) => work.workId === workId);
  const settlementOptions = input.settlements.filter(
    (settlement) => settlement.workId === workId,
  );
  const parsedAmount = Number(amount);
  const amountIsValid = amount.trim().length > 0 && Number.isFinite(parsedAmount);

  return (
    <form
      className="publishing-partner-fields publishing-contract-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (!amountIsValid) return;
        const mutable = {
          settlementId: settlementId.length === 0
            ? null
            : entityId<"PublishingSettlement">(settlementId),
          receivedOn: receivedOn.length === 0 ? null : receivedOn,
          confirmedOn: confirmedOn.length === 0 ? null : confirmedOn,
          amount: parsedAmount,
          currencyCode,
          matchStatus,
          payerLabel,
          reference,
          note,
        };
        if (payment === null) {
          if (selectedWork === undefined) return;
          input.onCreate({
            workId: entityId<"Work">(workId),
            ...mutable,
          });
          return;
        }
        input.onUpdate(payment, mutable);
      }}
    >
      <div className="publishing-partner-field-grid">
        <label>
          <span>작품</span>
          <select
            aria-label="입금 작품"
            disabled={busy || payment !== null}
            onChange={(event) => {
              setWorkId(event.target.value);
              setSettlementId("");
            }}
            value={workId}
          >
            <option value="">작품 선택</option>
            {input.works.map((work) => (
              <option key={work.workId} value={work.workId}>{work.title || "제목없음"}</option>
            ))}
          </select>
        </label>
        <label>
          <span>정산서</span>
          <select
            aria-label="입금 정산서"
            disabled={busy || workId.length === 0}
            onChange={(event) => {
              const nextSettlementId = event.target.value;
              setSettlementId(nextSettlementId);
              const settlement = settlementOptions.find(
                (candidate) => candidate.settlementId === nextSettlementId,
              );
              if (settlement !== undefined) setCurrencyCode(settlement.currencyCode);
            }}
            value={settlementId}
          >
            <option value="">미매칭 입금</option>
            {settlementOptions.map((settlement) => (
              <option key={settlement.settlementId} value={settlement.settlementId}>
                {settlement.title || settlement.publicationTitleSnapshot || "이름 없음"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>입금일</span>
          <input aria-label="입금일" disabled={busy} onChange={(event) => setReceivedOn(event.target.value)} type="date" value={receivedOn} />
        </label>
        <label>
          <span>확인일</span>
          <input aria-label="입금 확인일" disabled={busy} onChange={(event) => setConfirmedOn(event.target.value)} type="date" value={confirmedOn} />
        </label>
        <label>
          <span>입금액</span>
          <input aria-label="입금액" disabled={busy} onChange={(event) => setAmount(event.target.value)} step="any" type="number" value={amount} />
        </label>
        <label>
          <span>통화</span>
          <input aria-label="입금 통화" disabled={busy} onChange={(event) => setCurrencyCode(event.target.value)} placeholder="직접 입력" value={currencyCode} />
        </label>
        <label>
          <span>매칭 상태</span>
          <input aria-label="입금 매칭 상태" disabled={busy} onChange={(event) => setMatchStatus(event.target.value)} placeholder="직접 입력" value={matchStatus} />
        </label>
        <label>
          <span>입금자</span>
          <input aria-label="입금자" disabled={busy} onChange={(event) => setPayerLabel(event.target.value)} value={payerLabel} />
        </label>
        <label>
          <span>거래 참조</span>
          <input aria-label="입금 거래 참조" disabled={busy} onChange={(event) => setReference(event.target.value)} value={reference} />
        </label>
      </div>
      <label className="publishing-partner-note-field">
        <span>메모</span>
        <textarea aria-label="입금 메모" disabled={busy} onChange={(event) => setNote(event.target.value)} rows={4} value={note} />
      </label>
      <div className="publishing-partner-field-actions">
        <button
          className="primary-button"
          disabled={busy || !amountIsValid || (payment === null && selectedWork === undefined)}
          type="submit"
        >
          {payment === null
            ? input.actionState === "creating-payment" ? "추가 중" : "입금 추가"
            : input.actionState === "updating-payment" ? "저장 중" : "입금 변경 저장"}
        </button>
      </div>
    </form>
  );
}

function toDateTimeLocalInput(value: string | null): string {
  if (value === null) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "";
  const offsetMilliseconds = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.valueOf() - offsetMilliseconds).toISOString().slice(0, 16);
}

function PublishingSourceFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly onCreate: (draft: PublishingSourceDraft) => void;
  readonly source: PublishingSourceProjection | null;
}) {
  const source = input.source;
  const [kind, setKind] = useState(source?.kind ?? "");
  const [label, setLabel] = useState(source?.label ?? "");
  const [url, setUrl] = useState(source?.url ?? "");
  const [observedAt, setObservedAt] = useState(toDateTimeLocalInput(source?.observedAt ?? null));
  const [authority, setAuthority] = useState(source?.authority ?? "");
  const busy = input.actionState !== "idle";

  return (
    <form
      className="publishing-partner-fields publishing-contract-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (source !== null || kind.trim().length === 0 || label.trim().length === 0) return;
        input.onCreate({
          kind: kind.trim(),
          label: label.trim(),
          url: url.trim().length === 0 ? null : url,
          observedAt: observedAt.length === 0 ? null : new Date(observedAt).toISOString(),
          authority,
          importedFields: Object.freeze({}),
        });
      }}
    >
      <div className="publishing-partner-field-grid">
        <label>
          <span>종류</span>
          <input aria-label="근거 종류" disabled={busy || source !== null} onChange={(event) => setKind(event.target.value)} placeholder="직접 입력" value={kind} />
        </label>
        <label>
          <span>표시명</span>
          <input aria-label="근거 표시명" disabled={busy || source !== null} onChange={(event) => setLabel(event.target.value)} value={label} />
        </label>
        <label>
          <span>URL</span>
          <input aria-label="근거 URL" disabled={busy || source !== null} onChange={(event) => setUrl(event.target.value)} type="url" value={url} />
        </label>
        <label>
          <span>확인 시각</span>
          <input aria-label="근거 확인 시각" disabled={busy || source !== null} onChange={(event) => setObservedAt(event.target.value)} type="datetime-local" value={observedAt} />
        </label>
        <label>
          <span>권위</span>
          <input aria-label="근거 권위" disabled={busy || source !== null} onChange={(event) => setAuthority(event.target.value)} placeholder="직접 입력" value={authority} />
        </label>
      </div>
      {source !== null && (
        <div className="publishing-package-summary">
          <strong>생성 후 원본</strong>
          <span>{source.createdAt}</span>
          <small>이 근거는 자동 수정하지 않습니다.</small>
          {Object.keys(source.importedFields).length > 0 && (
            <dl>
              {Object.entries(source.importedFields).map(([field, value]) => (
                <div key={field}><dt>{field}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          )}
        </div>
      )}
      {source === null && (
        <div className="publishing-partner-field-actions">
          <button
            className="primary-button"
            disabled={busy || kind.trim().length === 0 || label.trim().length === 0}
            type="submit"
          >
            {input.actionState === "creating-source" ? "추가 중" : "근거 추가"}
          </button>
        </div>
      )}
    </form>
  );
}

function PublishingEvidenceLinksFields(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly sourceIds: readonly string[];
  readonly sources: readonly PublishingSourceProjection[];
  readonly targetId: string;
  readonly targetKind: PublishingEvidenceTargetKind;
  readonly onSave: (
    targetKind: PublishingEvidenceTargetKind,
    targetId: string,
    sourceIds: readonly string[],
  ) => void;
}) {
  const [selectedSourceIds, setSelectedSourceIds] = useState<
    readonly string[]
  >(input.sourceIds);
  const busy = input.actionState !== "idle";

  return (
    <section aria-label="연결 근거" className="publishing-evidence-links">
      <strong>연결 근거</strong>
      {input.sources.length === 0 ? (
        <p>근거 원장에서 먼저 근거를 추가하세요.</p>
      ) : (
        <ul>
          {input.sources.map((source) => {
            const checked = selectedSourceIds.includes(source.sourceId);
            return (
              <li key={source.sourceId}>
                <label>
                  <input
                    aria-label={`${source.label} 근거 연결`}
                    checked={checked}
                    disabled={busy}
                    onChange={() => {
                      setSelectedSourceIds((current) => checked
                        ? Object.freeze(current.filter((sourceId) => sourceId !== source.sourceId))
                        : Object.freeze([...current, source.sourceId]));
                    }}
                    type="checkbox"
                  />
                  <span>{source.label}</span>
                  <small>{source.kind || source.authority || "종류·권위 미입력"}</small>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="publishing-partner-field-actions">
        <button
          disabled={busy}
          onClick={() => input.onSave(
            input.targetKind,
            input.targetId,
            selectedSourceIds,
          )}
          type="button"
        >
          {input.actionState === "saving-evidence-links" ? "저장 중" : "근거 연결 저장"}
        </button>
      </div>
    </section>
  );
}

export function PublishingPartnerDialog(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly contracts: readonly PublishingContractProjection[];
  readonly assistantConnections?: readonly AssistantConnectionProjection[];
  readonly error: string | null;
  readonly initialSection?: "submissions" | "partners" | "contracts" | "publications" | "settlements" | "payments" | "sources" | "research" | "assistant" | "imports" | "mail";
  readonly onClose: () => void;
  readonly onCreate: (draft: PublishingPartnerDraft) => void;
  readonly onCreateContract: (draft: PublishingContractDraft) => void;
  readonly onCreatePublication: (draft: PublishingPublicationDraft) => void;
  readonly onCreateSettlement: (draft: PublishingSettlementDraft) => void;
  readonly onCreatePayment?: (draft: PublishingPaymentDraft) => void;
  readonly onCreateSource?: (draft: PublishingSourceDraft) => void;
  readonly onPreviewResearch?: (
    command: Omit<PreviewPublishingResearchCommand, "schemaVersion">,
  ) => Promise<PublishingResearchCandidateProjection | null>;
  readonly onApproveResearch?: (
    command: Omit<ApprovePublishingResearchCommand, "schemaVersion">,
  ) => Promise<boolean>;
  readonly onRunAssistant?: (
    connectionId: EntityId<"AssistantConnection">,
    statement: string,
  ) => Promise<PublishingAssistantResult | null>;
  readonly onApproveAssistant?: (candidateId: string) => Promise<boolean>;
  readonly onSetEvidenceLinks?: (
    targetKind: PublishingEvidenceTargetKind,
    targetId: string,
    expectedRevision: number,
    sourceIds: readonly string[],
  ) => void;
  readonly onSelectPartnerCsv?: () => Promise<
    PublishingPartnerCsvSelectionProjection | null
  >;
  readonly onApplyPartnerCsv?: (
    command: Omit<ApplyPublishingPartnerCsvImportCommand, "schemaVersion">,
  ) => Promise<boolean>;
  readonly onSelectSubmissionCsv?: () => Promise<
    PublishingSubmissionCsvSelectionProjection | null
  >;
  readonly onApplySubmissionCsv?: (
    command: Omit<ApplyPublishingSubmissionCsvImportCommand, "schemaVersion">,
  ) => Promise<boolean>;
  readonly onLinkMailCandidate?: (
    candidate: PublishingMailCandidateProjection,
    submissionId: PublishingSubmissionProjection["submissionId"],
  ) => void;
  readonly onUpdateMailCandidate?: (
    candidate: PublishingMailCandidateProjection,
    changes: UpdatePublishingMailCandidateCommand["changes"],
  ) => void;
  readonly onReviewMailCandidate?: (
    candidate: PublishingMailCandidateProjection,
    decision: "approve" | "ignore",
  ) => void;
  readonly onConnectMail?: (connectorKind: string, clientId: string) => void;
  readonly onSyncMail?: () => void;
  readonly onDisconnectMail?: () => void;
  readonly onSaveMailSchedule?: (
    enabled: boolean,
    localTime: string | null,
  ) => void;
  readonly onCreateSubmission: (draft: PublishingSubmissionDraft) => void;
  readonly onSelect: (partnerId: string | null) => void;
  readonly onSelectContract: (contractId: string | null) => void;
  readonly onSelectPublication: (publicationId: string | null) => void;
  readonly onSelectSettlement: (settlementId: string | null) => void;
  readonly onSelectPayment?: (paymentId: string | null) => void;
  readonly onSelectSource?: (sourceId: string | null) => void;
  readonly onSelectSubmission: (submissionId: string | null) => void;
  readonly onUpdate: (
    partner: PublishingPartnerProjection,
    changes: UpdatePublishingPartnerCommand["changes"],
  ) => void;
  readonly onUpdateSubmission: (
    submission: PublishingSubmissionProjection,
    changes: UpdatePublishingSubmissionCommand["changes"],
  ) => void;
  readonly onUpdateContract: (
    contract: PublishingContractProjection,
    changes: UpdatePublishingContractCommand["changes"],
  ) => void;
  readonly onUpdatePublication: (
    publication: PublishingPublicationProjection,
    changes: UpdatePublishingPublicationCommand["changes"],
  ) => void;
  readonly onUpdateSettlement: (
    settlement: PublishingSettlementProjection,
    changes: UpdatePublishingSettlementCommand["changes"],
  ) => void;
  readonly onUpdatePayment?: (
    payment: PublishingPaymentProjection,
    changes: UpdatePublishingPaymentCommand["changes"],
  ) => void;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly mailCandidates?: readonly PublishingMailCandidateProjection[];
  readonly mailConnection?: PublishingMailConnectionProjection | null;
  readonly mailSchedule?: PublishingMailScheduleProjection | null;
  readonly mailSyncResult?: PublishingMailSyncResult | null;
  readonly payments?: readonly PublishingPaymentProjection[];
  readonly sources?: readonly PublishingSourceProjection[];
  readonly publications: readonly PublishingPublicationProjection[];
  readonly selectedContractId: string | null;
  readonly selectedPartnerId: string | null;
  readonly selectedPublicationId: string | null;
  readonly selectedSettlementId: string | null;
  readonly selectedPaymentId?: string | null;
  readonly selectedSourceId?: string | null;
  readonly settlements: readonly PublishingSettlementProjection[];
  readonly selectedSubmissionId: string | null;
  readonly submissions: readonly PublishingSubmissionProjection[];
  readonly works: WorkspaceCatalogProjection["works"];
}) {
  const [section, setSection] = useState<
    "submissions" | "partners" | "contracts" | "publications" | "settlements" | "payments" | "sources" | "research" | "assistant" | "imports" | "mail"
  >(
    input.initialSection ?? "submissions",
  );
  const [query, setQuery] = useState("");
  const busy = input.actionState !== "idle";
  const selectedPartner = input.partners.find(
    (partner) => partner.partnerId === input.selectedPartnerId,
  ) ?? null;
  const selectedSubmission = input.submissions.find(
    (submission) => submission.submissionId === input.selectedSubmissionId,
  ) ?? null;
  const selectedContract = input.contracts.find(
    (contract) => contract.contractId === input.selectedContractId,
  ) ?? null;
  const selectedPublication = input.publications.find(
    (publication) => publication.publicationId === input.selectedPublicationId,
  ) ?? null;
  const selectedSettlement = input.settlements.find(
    (settlement) => settlement.settlementId === input.selectedSettlementId,
  ) ?? null;
  const payments = input.payments ?? [];
  const selectedPayment = payments.find(
    (payment) => payment.paymentId === input.selectedPaymentId,
  ) ?? null;
  const sources = input.sources ?? [];
  const selectedSource = sources.find(
    (source) => source.sourceId === input.selectedSourceId,
  ) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePartners = normalizedQuery.length === 0
    ? input.partners
    : input.partners.filter((partner) =>
        [
          partner.name,
          partner.submissionMethod,
          partner.email,
          partner.genres.join("\n"),
        ].join("\n").toLocaleLowerCase().includes(normalizedQuery),
      );
  const visibleSubmissions = normalizedQuery.length === 0
    ? input.submissions
    : input.submissions.filter((submission) =>
        [
          submission.title,
          submission.status,
          submission.result,
          submission.cardNote,
          submission.package.workTitleSnapshot,
          submission.package.partnerNameSnapshot,
        ].join("\n").toLocaleLowerCase().includes(normalizedQuery),
      );
  const visibleContracts = normalizedQuery.length === 0
    ? input.contracts
    : input.contracts.filter((contract) =>
        [
          contract.title,
          contract.status,
          contract.rightsScope,
          contract.currencyCode,
          contract.workTitleSnapshot,
          contract.partnerNameSnapshot,
        ].join("\n").toLocaleLowerCase().includes(normalizedQuery),
      );
  const visiblePublications = normalizedQuery.length === 0
    ? input.publications
    : input.publications.filter((publication) =>
        [
          publication.title,
          publication.status,
          publication.format,
          publication.workTitleSnapshot,
          publication.channelNameSnapshot,
          publication.scheduleNote,
        ].join("\n").toLocaleLowerCase().includes(normalizedQuery),
      );
  const visibleSettlements = normalizedQuery.length === 0
    ? input.settlements
    : input.settlements.filter((settlement) =>
        [
          settlement.title,
          settlement.reviewStatus,
          settlement.currencyCode,
          settlement.workTitleSnapshot,
          settlement.publicationTitleSnapshot,
          settlement.note,
        ].join("\n").toLocaleLowerCase().includes(normalizedQuery),
      );
  const visiblePayments = normalizedQuery.length === 0
    ? payments
    : payments.filter((payment) =>
        [
          payment.workTitleSnapshot,
          payment.settlementTitleSnapshot,
          payment.currencyCode,
          payment.matchStatus,
          payment.payerLabel,
          payment.reference,
          payment.note,
        ].join("\n").toLocaleLowerCase().includes(normalizedQuery),
      );
  const visibleSources = normalizedQuery.length === 0
    ? sources
    : sources.filter((source) =>
        [source.kind, source.label, source.url ?? "", source.authority]
          .join("\n")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      );
  const parentName = (partner: PublishingPartnerProjection) =>
    input.partners.find(
      (candidate) => candidate.partnerId === partner.parentPartnerId,
    )?.name ?? null;
  const evidenceLinks = (
    targetKind: PublishingEvidenceTargetKind,
    targetId: string,
    revision: number,
    sourceIds: readonly string[],
  ) => input.onSetEvidenceLinks === undefined
    ? null
    : (
        <PublishingEvidenceLinksFields
          actionState={input.actionState}
          key={`${targetKind}-${targetId}-${revision}`}
          onSave={(kind, id, nextSourceIds) =>
            input.onSetEvidenceLinks?.(kind, id, revision, nextSourceIds)}
          sourceIds={sourceIds}
          sources={sources}
          targetId={targetId}
          targetKind={targetKind}
        />
      );

  return (
    <div className="dialog-backdrop publishing-partner-backdrop" role="presentation">
      <section
        aria-labelledby="publishing-partner-heading"
        aria-modal="true"
        className="publishing-partner-dialog"
        role="dialog"
      >
        <header className="publishing-partner-header">
          <div>
            <p className="panel-kicker">PUBLISHING</p>
            <h2 id="publishing-partner-heading">투고 운영</h2>
            <p>투고·계약·발행 이력과 공유 투고처를 한 로컬 원장에서 관리합니다.</p>
            <nav aria-label="투고 운영 보기" className="publishing-workspace-tabs">
              <button
                aria-pressed={section === "submissions"}
                disabled={busy}
                onClick={() => {
                  setSection("submissions");
                  setQuery("");
                }}
                type="button"
              >
                투고 이력
              </button>
              <button
                aria-pressed={section === "partners"}
                disabled={busy}
                onClick={() => {
                  setSection("partners");
                  setQuery("");
                }}
                type="button"
              >
                투고처 원장
              </button>
              <button
                aria-pressed={section === "contracts"}
                disabled={busy}
                onClick={() => {
                  setSection("contracts");
                  setQuery("");
                }}
                type="button"
              >
                계약 원장
              </button>
              <button
                aria-pressed={section === "publications"}
                disabled={busy}
                onClick={() => {
                  setSection("publications");
                  setQuery("");
                }}
                type="button"
              >
                발행·연재 원장
              </button>
              <button
                aria-pressed={section === "settlements"}
                disabled={busy}
                onClick={() => {
                  setSection("settlements");
                  setQuery("");
                }}
                type="button"
              >
                정산서 원장
              </button>
              <button
                aria-pressed={section === "payments"}
                disabled={busy}
                onClick={() => {
                  setSection("payments");
                  setQuery("");
                }}
                type="button"
              >
                입금 원장
              </button>
              <button
                aria-pressed={section === "sources"}
                disabled={busy}
                onClick={() => {
                  setSection("sources");
                  setQuery("");
                }}
                type="button"
              >
                근거 원장
              </button>
              <button
                aria-pressed={section === "research"}
                disabled={busy}
                onClick={() => {
                  setSection("research");
                  setQuery("");
                }}
                type="button"
              >
                웹 자료 검토
              </button>
              <button
                aria-pressed={section === "assistant"}
                disabled={busy}
                onClick={() => {
                  setSection("assistant");
                  setQuery("");
                }}
                type="button"
              >
                작업실 조수
              </button>
              <button
                aria-pressed={section === "imports"}
                disabled={busy}
                onClick={() => {
                  setSection("imports");
                  setQuery("");
                }}
                type="button"
              >
                CSV 가져오기
              </button>
              <button
                aria-pressed={section === "mail"}
                disabled={busy}
                onClick={() => {
                  setSection("mail");
                  setQuery("");
                }}
                type="button"
              >
                메일 후보
              </button>
            </nav>
          </div>
          <button
            aria-label="투고 운영 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        {section === "research" ? (
          <PublishingResearchPanel
            actionState={input.actionState}
            onApprove={input.onApproveResearch}
            onPreview={input.onPreviewResearch}
            partners={input.partners}
            selectedPartnerId={input.selectedPartnerId}
          />
        ) : section === "assistant" ? (
          <PublishingAssistantPanel
            actionState={input.actionState}
            connections={input.assistantConnections ?? []}
            onApprove={input.onApproveAssistant}
            onRun={input.onRunAssistant}
            partners={input.partners}
            submissions={input.submissions}
            works={input.works}
          />
        ) : section === "imports" ? (
          <div className="publishing-import-body">
            <PublishingPartnerCsvImportPanel
              actionState={input.actionState}
              onApply={(command) => input.onApplyPartnerCsv?.(command) ?? Promise.resolve(false)}
              onSelectFile={() => input.onSelectPartnerCsv?.() ?? Promise.resolve(null)}
              partners={input.partners}
            />
            <PublishingSubmissionCsvImportPanel
              actionState={input.actionState}
              onApply={(command) => input.onApplySubmissionCsv?.(command) ?? Promise.resolve(false)}
              onSelectFile={() => input.onSelectSubmissionCsv?.() ?? Promise.resolve(null)}
              partners={input.partners}
              works={input.works}
            />
          </div>
        ) : section === "mail" ? (
          <PublishingMailCandidatePanel
            actionState={input.actionState}
            candidates={input.mailCandidates ?? []}
            connection={input.mailConnection ?? null}
            key={input.mailConnection == null
              ? "mail-loading"
              : `${input.mailConnection.state}-${input.mailConnection.activeConnectorKind ?? "none"}`}
            lastSyncResult={input.mailSyncResult ?? null}
            schedule={input.mailSchedule ?? null}
            onConnect={(connectorKind, clientId) =>
              input.onConnectMail?.(connectorKind, clientId)}
            onDisconnect={() => input.onDisconnectMail?.()}
            onLink={(candidate, submissionId) =>
              input.onLinkMailCandidate?.(candidate, submissionId)}
            onReview={(candidate, decision) =>
              input.onReviewMailCandidate?.(candidate, decision)}
            onUpdate={(candidate, changes) =>
              input.onUpdateMailCandidate?.(candidate, changes)}
            onSync={() => input.onSyncMail?.()}
            onSaveSchedule={(enabled, localTime) =>
              input.onSaveMailSchedule?.(enabled, localTime)}
            submissions={input.submissions}
          />
        ) : section === "partners" ? (
          <div className="publishing-partner-body">
            <section aria-label="투고처 목록" className="publishing-partner-list">
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="투고처 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름·방식·이메일·장르 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelect(null)}
                  type="button"
                >
                  새 투고처
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">원장을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && input.partners.length === 0 && (
                <p className="publishing-partner-empty">등록한 투고처가 없습니다.</p>
              )}
              {input.partners.length > 0 && visiblePartners.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visiblePartners.map((partner) => (
                  <li key={partner.partnerId}>
                    <button
                      aria-pressed={partner.partnerId === selectedPartner?.partnerId}
                      disabled={busy}
                      onClick={() => input.onSelect(partner.partnerId)}
                      type="button"
                    >
                      <strong>{partner.name}</strong>
                      <span>
                        {parentName(partner) ?? (partner.submissionMethod || "방식 미입력")}
                      </span>
                      <small>{partner.email || partner.websiteUrl || "연락처 미입력"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="투고처 상세 편집" className="publishing-partner-detail">
              <PublishingPartnerFields
                actionState={input.actionState}
                key={selectedPartner?.partnerId ?? "new-publishing-partner"}
                onCreate={input.onCreate}
                onUpdate={input.onUpdate}
                partner={selectedPartner}
                partners={input.partners}
              />
              {selectedPartner !== null && evidenceLinks(
                "partner",
                selectedPartner.partnerId,
                selectedPartner.revision,
                selectedPartner.sourceIds,
              )}
            </section>
          </div>
        ) : section === "contracts" ? (
          <div className="publishing-partner-body publishing-contract-body">
            <section aria-label="계약 목록" className="publishing-partner-list">
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="계약 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="작품·거래처·계약명·권리 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelectContract(null)}
                  type="button"
                >
                  새 계약
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">계약 원장을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && input.contracts.length === 0 && (
                <p className="publishing-partner-empty">등록한 계약이 없습니다.</p>
              )}
              {input.contracts.length > 0 && visibleContracts.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visibleContracts.map((contract) => (
                  <li key={contract.contractId}>
                    <button
                      aria-pressed={contract.contractId === selectedContract?.contractId}
                      disabled={busy}
                      onClick={() => input.onSelectContract(contract.contractId)}
                      type="button"
                    >
                      <strong>{contract.title || contract.workTitleSnapshot || "이름 없음"}</strong>
                      <span>{contract.partnerNameSnapshot}</span>
                      <small>
                        {[contract.signedOn, contract.status]
                          .filter((value) => value !== null && value.length > 0)
                          .join(" · ") || "날짜·상태 미입력"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="계약 상세" className="publishing-partner-detail">
              <PublishingContractFields
                actionState={input.actionState}
                contract={selectedContract}
                key={selectedContract?.contractId ?? "new-publishing-contract"}
                onCreate={input.onCreateContract}
                onUpdate={input.onUpdateContract}
                partners={input.partners}
                submissions={input.submissions}
                works={input.works}
              />
              {selectedContract !== null && evidenceLinks(
                "contract",
                selectedContract.contractId,
                selectedContract.revision,
                selectedContract.sourceIds,
              )}
            </section>
          </div>
        ) : section === "publications" ? (
          <div className="publishing-partner-body publishing-contract-body">
            <section aria-label="발행·연재 목록" className="publishing-partner-list">
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="발행·연재 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="작품·채널·이름·상태·형태 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelectPublication(null)}
                  type="button"
                >
                  새 발행·연재
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">발행·연재 원장을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && input.publications.length === 0 && (
                <p className="publishing-partner-empty">등록한 발행·연재 항목이 없습니다.</p>
              )}
              {input.publications.length > 0 && visiblePublications.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visiblePublications.map((publication) => (
                  <li key={publication.publicationId}>
                    <button
                      aria-pressed={
                        publication.publicationId === selectedPublication?.publicationId
                      }
                      disabled={busy}
                      onClick={() => input.onSelectPublication(publication.publicationId)}
                      type="button"
                    >
                      <strong>{publication.title || publication.workTitleSnapshot || "이름 없음"}</strong>
                      <span>{publication.channelNameSnapshot || "채널 미지정"}</span>
                      <small>
                        {[publication.status, publication.format]
                          .filter((value) => value.length > 0)
                          .join(" · ") || "상태·형태 미입력"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="발행·연재 상세" className="publishing-partner-detail">
              <PublishingPublicationFields
                actionState={input.actionState}
                contracts={input.contracts}
                key={selectedPublication?.publicationId ?? "new-publishing-publication"}
                onCreate={input.onCreatePublication}
                onUpdate={input.onUpdatePublication}
                partners={input.partners}
                publication={selectedPublication}
                works={input.works}
              />
              {selectedPublication !== null && evidenceLinks(
                "publication",
                selectedPublication.publicationId,
                selectedPublication.revision,
                selectedPublication.sourceIds,
              )}
            </section>
          </div>
        ) : section === "settlements" ? (
          <div className="publishing-partner-body publishing-contract-body">
            <section aria-label="정산서 목록" className="publishing-partner-list">
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="정산서 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="작품·발행·이름·상태·통화 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelectSettlement(null)}
                  type="button"
                >
                  새 정산서
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">정산서 원장을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && input.settlements.length === 0 && (
                <p className="publishing-partner-empty">등록한 정산서가 없습니다.</p>
              )}
              {input.settlements.length > 0 && visibleSettlements.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visibleSettlements.map((settlement) => (
                  <li key={settlement.settlementId}>
                    <button
                      aria-pressed={settlement.settlementId === selectedSettlement?.settlementId}
                      disabled={busy}
                      onClick={() => input.onSelectSettlement(settlement.settlementId)}
                      type="button"
                    >
                      <strong>{settlement.title || settlement.publicationTitleSnapshot || "이름 없음"}</strong>
                      <span>{settlement.workTitleSnapshot}</span>
                      <small>
                        {[settlement.reviewStatus, settlement.currencyCode]
                          .filter((value) => value.length > 0)
                          .join(" · ") || "상태·통화 미입력"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="정산서 상세" className="publishing-partner-detail">
              <PublishingSettlementFields
                actionState={input.actionState}
                key={selectedSettlement?.settlementId ?? "new-publishing-settlement"}
                onCreate={input.onCreateSettlement}
                onUpdate={input.onUpdateSettlement}
                publications={input.publications}
                settlement={selectedSettlement}
                works={input.works}
              />
              {selectedSettlement !== null && evidenceLinks(
                "settlement",
                selectedSettlement.settlementId,
                selectedSettlement.revision,
                selectedSettlement.sourceIds,
              )}
            </section>
          </div>
        ) : section === "payments" ? (
          <div className="publishing-partner-body publishing-contract-body">
            <section aria-label="입금 목록" className="publishing-partner-list">
              {input.settlements.length > 0 && (
                <div aria-label="미수금 요약" className="publishing-package-summary" role="region">
                  <strong>미수금 요약</strong>
                  <ul>
                    {input.settlements.map((settlement) => {
                      const receivable = derivePublishingSettlementReceivable({
                        settlement,
                        payments,
                      });
                      return (
                        <li key={settlement.settlementId}>
                          <span>{settlement.title || settlement.publicationTitleSnapshot || "정산서"}</span>
                          <strong>
                            {receivable.outstandingAmount === null
                              ? "미수 미계산"
                              : `미수 ${receivable.outstandingAmount.toLocaleString()}`}
                            {receivable.currencyCode.length > 0 ? ` ${receivable.currencyCode}` : ""}
                          </strong>
                          <small>
                            입금 {receivable.matchedAmount.toLocaleString()}
                            {receivable.mismatchedPaymentIds.length > 0
                              ? ` · 통화 불일치 ${receivable.mismatchedPaymentIds.length}건`
                              : ""}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="입금 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="작품·정산서·입금자·거래 참조 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelectPayment?.(null)}
                  type="button"
                >
                  새 입금
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">입금 원장을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && payments.length === 0 && (
                <p className="publishing-partner-empty">등록한 입금이 없습니다.</p>
              )}
              {payments.length > 0 && visiblePayments.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visiblePayments.map((payment) => (
                  <li key={payment.paymentId}>
                    <button
                      aria-pressed={payment.paymentId === selectedPayment?.paymentId}
                      disabled={busy}
                      onClick={() => input.onSelectPayment?.(payment.paymentId)}
                      type="button"
                    >
                      <strong>{payment.reference || payment.payerLabel || "입금 기록"}</strong>
                      <span>{payment.settlementTitleSnapshot || "미매칭 입금"}</span>
                      <small>
                        {payment.amount.toLocaleString()}
                        {payment.currencyCode.length > 0 ? ` ${payment.currencyCode}` : ""}
                        {payment.matchStatus.length > 0 ? ` · ${payment.matchStatus}` : ""}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="입금 상세" className="publishing-partner-detail">
              <PublishingPaymentFields
                actionState={input.actionState}
                key={selectedPayment?.paymentId ?? "new-publishing-payment"}
                onCreate={(draft) => input.onCreatePayment?.(draft)}
                onUpdate={(payment, changes) => input.onUpdatePayment?.(payment, changes)}
                payment={selectedPayment}
                settlements={input.settlements}
                works={input.works}
              />
              {selectedPayment !== null && evidenceLinks(
                "payment",
                selectedPayment.paymentId,
                selectedPayment.revision,
                selectedPayment.sourceIds,
              )}
            </section>
          </div>
        ) : section === "sources" ? (
          <div className="publishing-partner-body publishing-contract-body">
            <section aria-label="근거 목록" className="publishing-partner-list">
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="근거 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="종류·표시명·URL·권위 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelectSource?.(null)}
                  type="button"
                >
                  새 근거
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">근거 원장을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && sources.length === 0 && (
                <p className="publishing-partner-empty">등록한 근거가 없습니다.</p>
              )}
              {sources.length > 0 && visibleSources.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visibleSources.map((source) => (
                  <li key={source.sourceId}>
                    <button
                      aria-pressed={source.sourceId === selectedSource?.sourceId}
                      disabled={busy}
                      onClick={() => input.onSelectSource?.(source.sourceId)}
                      type="button"
                    >
                      <strong>{source.label}</strong>
                      <span>{source.kind}</span>
                      <small>{source.authority || source.url || "권위·URL 미입력"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="근거 상세" className="publishing-partner-detail">
              <PublishingSourceFields
                actionState={input.actionState}
                key={selectedSource?.sourceId ?? "new-publishing-source"}
                onCreate={(draft) => input.onCreateSource?.(draft)}
                source={selectedSource}
              />
            </section>
          </div>
        ) : (
          <div className="publishing-partner-body publishing-submission-body">
            <section aria-label="투고 이력 목록" className="publishing-partner-list">
              <div className="publishing-partner-list-tools">
                <input
                  aria-label="투고 이력 검색"
                  disabled={busy}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="작품·투고처·상태·결과 검색"
                  value={query}
                />
                <button
                  disabled={busy}
                  onClick={() => input.onSelectSubmission(null)}
                  type="button"
                >
                  새 투고 기록
                </button>
              </div>
              {input.actionState === "loading" && (
                <p className="publishing-partner-empty">투고 이력을 불러오는 중입니다.</p>
              )}
              {input.actionState !== "loading" && input.submissions.length === 0 && (
                <p className="publishing-partner-empty">등록한 투고 이력이 없습니다.</p>
              )}
              {input.submissions.length > 0 && visibleSubmissions.length === 0 && (
                <p className="publishing-partner-empty">검색 결과가 없습니다.</p>
              )}
              <ul>
                {visibleSubmissions.map((submission) => (
                  <li key={submission.submissionId}>
                    <button
                      aria-pressed={
                        submission.submissionId === selectedSubmission?.submissionId
                      }
                      disabled={busy}
                      onClick={() => input.onSelectSubmission(submission.submissionId)}
                      type="button"
                    >
                      <strong>
                        {submission.title || submission.package.workTitleSnapshot || "제목없음"}
                      </strong>
                      <span>{submission.package.partnerNameSnapshot}</span>
                      <small>
                        {[submission.submittedOn, submission.status]
                          .filter((value) => value !== null && value.length > 0)
                          .join(" · ") || "날짜·상태 미입력"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="투고 이력 상세" className="publishing-partner-detail">
              <PublishingSubmissionFields
                actionState={input.actionState}
                key={selectedSubmission?.submissionId ?? "new-publishing-submission"}
                onCreate={input.onCreateSubmission}
                onUpdate={input.onUpdateSubmission}
                partners={input.partners}
                submission={selectedSubmission}
                works={input.works}
              />
              {selectedSubmission !== null && evidenceLinks(
                "submission",
                selectedSubmission.submissionId,
                selectedSubmission.revision,
                selectedSubmission.sourceIds,
              )}
            </section>
          </div>
        )}

        {input.error !== null && (
          <p className="publishing-partner-error" role="alert">{input.error}</p>
        )}
      </section>
    </div>
  );
}
