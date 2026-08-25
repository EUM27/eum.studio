import type {
  PublishingIpcRuntime,
  PublishingRuntimeMethod,
} from "../ipc/register-publishing-ipc";

const PUBLISHING_RUNTIME_METHODS = Object.freeze([
  "createPublishingPartner",
  "listPublishingPartners",
  "updatePublishingPartner",
  "createPublishingSubmission",
  "listPublishingSubmissions",
  "updatePublishingSubmission",
  "createPublishingContract",
  "listPublishingContracts",
  "updatePublishingContract",
  "createPublishingPublication",
  "listPublishingPublications",
  "updatePublishingPublication",
  "createPublishingSettlement",
  "listPublishingSettlements",
  "updatePublishingSettlement",
  "createPublishingPayment",
  "listPublishingPayments",
  "updatePublishingPayment",
  "createPublishingSource",
  "listPublishingSources",
  "previewPublishingResearch",
  "approvePublishingResearch",
  "runPublishingAssistant",
  "approvePublishingAssistantCandidate",
  "setPublishingEvidenceLinks",
  "applyPublishingPartnerCsvImport",
  "applyPublishingSubmissionCsvImport",
  "listPublishingMailCandidates",
  "linkPublishingMailCandidate",
  "updatePublishingMailCandidate",
  "reviewPublishingMailCandidate",
  "getPublishingMailConnection",
  "connectPublishingMail",
  "syncPublishingMail",
  "disconnectPublishingMail",
  "getPublishingMailSchedule",
  "savePublishingMailSchedule",
] satisfies readonly PublishingRuntimeMethod[]);

export function pickPublishingRuntime(
  runtime: PublishingIpcRuntime,
): PublishingIpcRuntime {
  return Object.freeze(Object.fromEntries(
    PUBLISHING_RUNTIME_METHODS.map((method) => [
      method,
      (command: unknown) => runtime[method](command),
    ]),
  )) as PublishingIpcRuntime;
}
