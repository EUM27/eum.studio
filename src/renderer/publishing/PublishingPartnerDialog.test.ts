import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import type { PublishingSubmissionProjection } from "../../application/publishing/publishing-submission-contract";
import type { PublishingContractProjection } from "../../application/publishing/publishing-contract-contract";
import type { PublishingPublicationProjection } from "../../application/publishing/publishing-publication-contract";
import type { PublishingSettlementProjection } from "../../application/publishing/publishing-settlement-contract";
import type { PublishingPaymentProjection } from "../../application/publishing/publishing-payment-contract";
import type { PublishingSourceProjection } from "../../application/publishing/publishing-source-contract";
import type { PublishingMailCandidateProjection } from "../../application/publishing/publishing-mail-candidate-contract";
import { entityId } from "../../domain/writing";
import { PublishingPartnerDialog } from "./PublishingPartnerDialog";

const parent: PublishingPartnerProjection = Object.freeze({
  schemaVersion: 1,
  partnerId: entityId<"PublishingPartner">("parent-a"),
  revision: 1,
  name: "은하출판",
  parentPartnerId: null,
  submissionMethod: "이메일",
  websiteUrl: "https://publisher.example",
  email: "contact@publisher.example",
  genres: ["장르소설"],
  requiredLength: "원고 3화",
  priority: "검토 중",
  note: "공식 안내 확인",
  sourceIds: [],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
});

const partner: PublishingPartnerProjection = Object.freeze({
  ...parent,
  partnerId: entityId<"PublishingPartner">("partner-a"),
  revision: 2,
  name: "별빛문고",
  parentPartnerId: parent.partnerId,
  submissionMethod: "온라인 폼",
  websiteUrl: "https://publisher.example/submission",
  email: "novel@publisher.example",
  genres: ["판타지", "로맨스"],
  requiredLength: "시놉시스와 원고 3화",
  priority: "이번 달",
  note: "마감일 확인",
  sourceIds: ["source-a"],
});

const workId = entityId<"Work">("work-a");
const works = Object.freeze([{
  workId,
  title: "별빛 아래",
  updatedAt: "2026-08-10T00:00:00.000Z",
  folders: Object.freeze([]),
  documents: Object.freeze([{
    documentId: entityId<"Document">("document-a"),
    title: "1화",
    currentRevisionId: entityId<"DocumentRevision">("revision-b"),
    folderId: null,
    completion: Object.freeze({
      schemaVersion: 1,
      workId,
      documentId: entityId<"Document">("document-a"),
      revision: 0,
      completedAt: null,
      completedDate: null,
      completedTimeZone: null,
      completedDocumentRevisionId: null,
      state: "incomplete" as const,
      updatedAt: null,
    }),
  }]),
}]);

const submission: PublishingSubmissionProjection = Object.freeze({
  schemaVersion: 1,
  submissionId: entityId<"PublishingSubmission">("submission-a"),
  revision: 2,
  workId,
  partnerId: partner.partnerId,
  title: "봄 투고",
  status: "회신 완료",
  submittedOn: "2026-08-10",
  respondedOn: "2026-08-18",
  result: "수정 요청",
  note: "회신 원문 별도 보관",
  cardNote: "장르 편집부",
  sourceIds: Object.freeze([]),
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
  package: Object.freeze({
    schemaVersion: 1,
    submissionPackageId: entityId<"SubmissionPackage">("package-a"),
    workId,
    partnerId: partner.partnerId,
    workSnapshotId: entityId<"WorkSnapshot">("snapshot-a"),
    workTitleSnapshot: "별빛 아래",
    partnerNameSnapshot: "별빛문고",
    manifestHash: "package-manifest-a",
    sealedAt: "2026-08-10T00:00:00.000Z",
    documentRevisions: Object.freeze([{
      documentId: entityId<"Document">("document-a"),
      documentRevisionId: entityId<"DocumentRevision">("revision-a"),
    }]),
  }),
});

const contract: PublishingContractProjection = Object.freeze({
  schemaVersion: 1,
  contractId: entityId<"PublishingContract">("contract-a"),
  revision: 2,
  workId,
  partnerId: partner.partnerId,
  submissionId: submission.submissionId,
  title: "전자 출판 계약",
  workTitleSnapshot: "별빛 아래",
  partnerNameSnapshot: "별빛문고",
  status: "진행 중",
  signedOn: "2026-08-20",
  startsOn: "2026-09-01",
  endsOn: null,
  rightsScope: "국내 전자·오디오 출판권",
  advanceAmount: 1500000,
  currencyCode: "KRW",
  revenueShareNote: "순매출 기준",
  note: "원본 계약서는 별도 보관",
  sourceIds: Object.freeze([]),
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
});

const publication: PublishingPublicationProjection = Object.freeze({
  schemaVersion: 1,
  publicationId: entityId<"PublishingPublication">("publication-a"),
  revision: 2,
  workId,
  contractId: contract.contractId,
  channelPartnerId: partner.partnerId,
  title: "주 2회 연재",
  workTitleSnapshot: "별빛 아래",
  channelNameSnapshot: "별빛문고",
  status: "연재 중",
  format: "웹 연재",
  scheduledOn: "2026-09-01",
  startsOn: "2026-09-03",
  endsOn: null,
  publishedUnitCount: 12,
  plannedUnitCount: 40,
  scheduleNote: "화·금 공개",
  note: "채널 공지 확인",
  sourceIds: Object.freeze([]),
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
});

const settlement: PublishingSettlementProjection = Object.freeze({
  schemaVersion: 1,
  settlementId: entityId<"PublishingSettlement">("settlement-a"),
  revision: 2,
  workId,
  publicationId: publication.publicationId,
  title: "9월 정산서",
  workTitleSnapshot: "별빛 아래",
  publicationTitleSnapshot: "주 2회 연재",
  periodStartsOn: "2026-09-01",
  periodEndsOn: "2026-09-30",
  issuedOn: "2026-10-10",
  reviewStatus: "확인 완료",
  currencyCode: "KRW",
  reportedAmount: 1240000,
  items: Object.freeze([{
    settlementLineItemId: entityId<"PublishingSettlementLineItem">("item-a"),
    label: "플랫폼 수수료 조정",
    amount: -10000,
    note: "명세서 반영",
  }]),
  note: "차액 확인 완료",
  sourceIds: Object.freeze([]),
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-11T00:00:00.000Z",
});

const payment: PublishingPaymentProjection = Object.freeze({
  schemaVersion: 1,
  paymentId: entityId<"PublishingPayment">("payment-a"),
  revision: 2,
  workId,
  settlementId: settlement.settlementId,
  workTitleSnapshot: "별빛 아래",
  settlementTitleSnapshot: "9월 정산서",
  receivedOn: "2026-10-15",
  confirmedOn: "2026-10-16",
  amount: 590000,
  currencyCode: "KRW",
  matchStatus: "확인 완료",
  payerLabel: "별빛 콘텐츠",
  reference: "BANK-2026-10-R1",
  note: "수수료 차감 확인",
  sourceIds: Object.freeze([]),
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
});

const source: PublishingSourceProjection = Object.freeze({
  schemaVersion: 1,
  sourceId: entityId<"PublishingSource">("source-a"),
  revision: 1,
  kind: "사용자 진술",
  label: "계약서 원본 확인",
  url: null,
  observedAt: "2026-10-16T03:30:00.000Z",
  authority: "직접 확인",
  importedFields: Object.freeze({ 원본열: "보존값" }),
  createdAt: "2026-10-16T03:31:00.000Z",
});

const mailCandidate: PublishingMailCandidateProjection = Object.freeze({
  schemaVersion: 1,
  candidateId: entityId<"PublishingMailCandidate">("mail-candidate-a"),
  revision: 2,
  sourceId: source.sourceId,
  sourceAccountId: "account-a",
  messageId: "message-a",
  threadId: "thread-a",
  from: "editor@publisher.example",
  subject: "봄 투고 회신",
  receivedAt: "2026-08-18T02:30:00.000Z",
  snippet: "수정 방향을 확인해 주세요.",
  bodyFingerprint: "body-fingerprint-a",
  submissionId: submission.submissionId,
  partnerId: partner.partnerId,
  matchReason: "사용자 검토 대기",
  proposedStatus: "회신 완료",
  proposedResult: "수정 요청",
  proposedRespondedOn: "2026-08-18",
  proposedNote: "회신 요약",
  classificationConnectionId: null,
  classificationModel: "",
  reviewStatus: "unreviewed",
  createdAt: "2026-08-18T02:31:00.000Z",
  updatedAt: "2026-08-18T02:32:00.000Z",
});

describe("PublishingPartnerDialog", () => {
  it("shows every local partner field and an explicit create entry", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        initialSection: "partners",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner, parent],
        publications: [],
        settlements: [],
        selectedContractId: null,
        selectedPartnerId: partner.partnerId,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        submissions: [],
        works,
      }),
    );

    expect(markup).toContain("투고처 원장");
    expect(markup).toContain("새 투고처");
    expect(markup).toContain("별빛문고");
    expect(markup).toContain("은하출판");
    expect(markup).toContain("온라인 폼");
    expect(markup).toContain("novel@publisher.example");
    expect(markup).toContain("판타지\n로맨스");
    expect(markup).toContain("시놉시스와 원고 3화");
    expect(markup).toContain("이번 달");
    expect(markup).toContain("마감일 확인");
    expect(markup).toContain("연결된 근거 1개");
    expect(markup).toContain("변경 저장");
  });

  it("shows a blank local create form without fixed provider or category values", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        initialSection: "partners",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [],
        publications: [],
        settlements: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        submissions: [],
        works,
      }),
    );

    expect(markup).toContain("등록한 투고처가 없습니다.");
    expect(markup).toContain("투고처 이름");
    expect(markup).toContain("투고처 추가");
    expect(markup).not.toContain("네이버");
    expect(markup).not.toContain("카카오");
  });

  it("shows editable submission history beside an immutable submission package", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        publications: [],
        settlements: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: submission.submissionId,
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("투고 운영");
    expect(markup).toContain("투고 이력");
    expect(markup).toContain("봄 투고");
    expect(markup).toContain("회신 완료");
    expect(markup).toContain("수정 요청");
    expect(markup).toContain("회신 원문 별도 보관");
    expect(markup).toContain("제출 당시 원고 봉인본");
    expect(markup).toContain("1개 문서");
    expect(markup).toContain("package-manifest-a");
    expect(markup).toContain("회신까지 8일");
    expect(markup).toContain("투고 이력 저장");
  });

  it("shows the full contract ledger without fixed status or currency defaults", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [contract],
        error: null,
        initialSection: "contracts",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        publications: [],
        settlements: [],
        selectedContractId: contract.contractId,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("계약 원장");
    expect(markup).toContain("전자 출판 계약");
    expect(markup).toContain("진행 중");
    expect(markup).toContain("국내 전자·오디오 출판권");
    expect(markup).toContain("1500000");
    expect(markup).toContain("KRW");
    expect(markup).toContain("순매출 기준");
    expect(markup).toContain("원본 계약서는 별도 보관");
    expect(markup).toContain("봄 투고");
    expect(markup).toContain("계약 변경 저장");
  });

  it("shows the full publication ledger with independent contract and channel links", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [contract],
        error: null,
        initialSection: "publications",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        publications: [publication],
        settlements: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: publication.publicationId,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("발행·연재 원장");
    expect(markup).toContain("주 2회 연재");
    expect(markup).toContain("별빛문고");
    expect(markup).toContain("연재 중");
    expect(markup).toContain("웹 연재");
    expect(markup).toContain("12");
    expect(markup).toContain("40");
    expect(markup).toContain("화·금 공개");
    expect(markup).toContain("채널 공지 확인");
    expect(markup).toContain("전자 출판 계약");
    expect(markup).toContain("발행·연재 변경 저장");
  });

  it("shows the settlement ledger with signed line items and no fixed status defaults", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [contract],
        error: null,
        initialSection: "settlements",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        publications: [publication],
        settlements: [settlement],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: settlement.settlementId,
        selectedSubmissionId: null,
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("정산서 원장");
    expect(markup).toContain("9월 정산서");
    expect(markup).toContain("주 2회 연재");
    expect(markup).toContain("확인 완료");
    expect(markup).toContain("1240000");
    expect(markup).toContain("KRW");
    expect(markup).toContain("플랫폼 수수료 조정");
    expect(markup).toContain("-10000");
    expect(markup).toContain("명세서 반영");
    expect(markup).toContain("차액 확인 완료");
    expect(markup).toContain("정산서 변경 저장");
  });

  it("shows the payment ledger and derives the settlement receivable", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [contract],
        error: null,
        initialSection: "payments",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreatePayment: () => undefined,
        onSetEvidenceLinks: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectPayment: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdatePayment: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        payments: [{ ...payment, sourceIds: Object.freeze([source.sourceId]) }],
        publications: [publication],
        settlements: [settlement],
        sources: [source],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPaymentId: payment.paymentId,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("입금 원장");
    expect(markup).toContain("미수금 요약");
    expect(markup).toContain("미수 650,000 KRW");
    expect(markup).toContain("입금 590,000");
    expect(markup).toContain("BANK-2026-10-R1");
    expect(markup).toContain("별빛 콘텐츠");
    expect(markup).toContain("확인 완료");
    expect(markup).toContain("수수료 차감 확인");
    expect(markup).toContain("입금 변경 저장");
    expect(markup).toContain("계약서 원본 확인 근거 연결");
    expect(markup).toContain("근거 연결 저장");
  });

  it("shows the immutable shared source ledger without fixed kind defaults", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        initialSection: "sources",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [],
        publications: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        settlements: [],
        sources: [source],
        selectedSourceId: source.sourceId,
        submissions: [],
        works,
      }),
    );

    expect(markup).toContain("근거 원장");
    expect(markup).toContain("계약서 원본 확인");
    expect(markup).toContain("사용자 진술");
    expect(markup).toContain("직접 확인");
    expect(markup).toContain("보존값");
    expect(markup).toContain("이 근거는 자동 수정하지 않습니다.");
  });

  it("offers manual web research comparison and explicit field selection", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        initialSection: "research",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [parent],
        publications: [],
        selectedContractId: null,
        selectedPartnerId: parent.partnerId,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        settlements: [],
        submissions: [],
        works,
      }),
    );

    expect(markup).toContain("웹 자료 검토");
    expect(markup).toContain("사용자가 확인한 자료만 비교합니다.");
    expect(markup).toContain("자료 URL");
    expect(markup).toContain("확인한 날짜");
    expect(markup).toContain("현재 값과 비교");
  });

  it("offers a provider-neutral publishing assistant without manuscript transmission", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        assistantConnections: [{
          schemaVersion: 1,
          connectionId: entityId<"AssistantConnection">("connection-a"),
          revision: 1,
          connectorKind: "custom-json",
          label: "내 작업실 연결",
          endpoint: "https://assistant.example.test",
          model: "writer-model",
          credentialConfigured: true,
          createdAt: "2026-08-10T00:00:00.000Z",
          updatedAt: "2026-08-10T00:00:00.000Z",
        }],
        contracts: [],
        error: null,
        initialSection: "assistant",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        publications: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        settlements: [],
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("작업실 조수");
    expect(markup).toContain("내 작업실 연결 · writer-model");
    expect(markup).toContain("원고 본문은 전송하지 않습니다.");
    expect(markup).toContain("요청 해석");
    expect(markup).not.toContain("OpenAI");
    expect(markup).not.toContain("Anthropic");
  });

  it("offers publishing partner CSV selection without automatic mapping or immediate apply", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        initialSection: "imports",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        publications: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: null,
        settlements: [],
        submissions: [],
        works,
      }),
    );

    expect(markup).toContain("투고처 CSV 가져오기");
    expect(markup).toContain("투고 이력 CSV 가져오기");
    expect(markup).toContain("CSV 파일 선택");
    expect(markup).toContain("투고 이력 CSV 선택");
    expect(markup).toContain("열을 직접 연결하고 미리보기를 승인한 뒤에만 원장에 반영합니다.");
    expect(markup).toContain("선택한 CSV 파일이 없습니다.");
    expect(markup).toContain("선택한 투고 이력 CSV 파일이 없습니다.");
    expect(markup).not.toContain("자동 매핑");
    expect(markup).not.toContain("승인 반영");
  });

  it("shows metadata-only mail candidates with explicit link, proposal, approve, and ignore actions", () => {
    const needsLink: PublishingMailCandidateProjection = Object.freeze({
      ...mailCandidate,
      candidateId: entityId<"PublishingMailCandidate">("mail-candidate-b"),
      revision: 1,
      messageId: "message-b",
      threadId: "thread-b",
      subject: "추가 회신",
      submissionId: null,
      partnerId: null,
      reviewStatus: "needs-link",
    });
    const markup = renderToStaticMarkup(
      createElement(PublishingPartnerDialog, {
        actionState: "idle",
        contracts: [],
        error: null,
        initialSection: "mail",
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateContract: () => undefined,
        onCreatePublication: () => undefined,
        onCreateSettlement: () => undefined,
        onCreateSubmission: () => undefined,
        onSelect: () => undefined,
        onSelectContract: () => undefined,
        onSelectPublication: () => undefined,
        onSelectSettlement: () => undefined,
        onSelectSubmission: () => undefined,
        onUpdate: () => undefined,
        onUpdateContract: () => undefined,
        onUpdatePublication: () => undefined,
        onUpdateSettlement: () => undefined,
        onUpdateSubmission: () => undefined,
        partners: [partner],
        mailCandidates: [needsLink, mailCandidate],
        mailConnection: {
          schemaVersion: 1,
          connectors: [{ connectorKind: "mail-test-v1", displayName: "테스트 메일" }],
          state: "connected",
          activeConnectorKind: "mail-test-v1",
          accountLabel: "writer@example.test",
          clientId: "desktop-client",
          scopes: ["mail.readonly"],
          lastSyncedAt: "2026-08-10T10:30:00.000Z",
        },
        mailSyncResult: {
          schemaVersion: 1,
          discoveredCount: 2,
          newCandidateCount: 1,
          syncedAt: "2026-08-10T10:30:00.000Z",
        },
        mailSchedule: {
          schemaVersion: 1,
          enabled: true,
          localTime: "10:00",
          lastAttemptedAt: "2026-08-10T10:30:00.000Z",
          lastSuccessfulAt: "2026-08-10T10:30:00.000Z",
          lastAttemptStatus: "succeeded",
        },
        publications: [],
        selectedContractId: null,
        selectedPartnerId: null,
        selectedPublicationId: null,
        selectedSettlementId: null,
        selectedSubmissionId: submission.submissionId,
        settlements: [],
        submissions: [submission],
        works,
      }),
    );

    expect(markup).toContain("메일 회신 후보");
    expect(markup).toContain("writer@example.test");
    expect(markup).toContain("지금 동기화");
    expect(markup).toContain("앱 실행 중 자동 확인");
    expect(markup).toContain("10:00");
    expect(markup).toContain("마지막 확인 결과");
    expect(markup).toContain("성공");
    expect(markup).toContain("2건 확인 · 새 후보 1건");
    expect(markup).toContain("봄 투고 회신");
    expect(markup).toContain("수정 방향을 확인해 주세요.");
    expect(markup).toContain("메일 본문은 저장하지 않고 메타데이터와 본문 지문만 보관합니다.");
    expect(markup).toContain("투고 연결");
    expect(markup).toContain("제안 저장");
    expect(markup).toContain("승인 반영");
    expect(markup).toContain("무시");
    expect(markup).not.toContain("body-fingerprint-a");
  });
});
