import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  buildPublishingAssistantRegistry,
  parseApprovePublishingAssistantCandidateCommand,
  parsePublishingAssistantIntentPayload,
  resolvePublishingAssistantIntent,
} from "./publishing-assistant-contract";

const workA = entityId<"Work">("work-a");
const workB = entityId<"Work">("work-b");
const partnerA = entityId<"PublishingPartner">("partner-a");
const partnerB = entityId<"PublishingPartner">("partner-b");
const connectionId = entityId<"AssistantConnection">("connection-a");
const requestId = entityId<"AssistantConnectorRequest">("request-a");
const receipt = Object.freeze({
  schemaVersion: 1 as const,
  receiptId: entityId<"ConnectorReceipt">("receipt-a"),
  requestId,
  connectionId,
  connectorKind: "test-connector",
  operation: "publishing-intent" as const,
  requestFingerprint: "sha256:registry",
  startedAt: "2026-08-10T00:00:00.000Z",
  completedAt: "2026-08-10T00:00:01.000Z",
  resultState: "succeeded" as const,
});
const references = {
  currentDate: "2026-08-10",
  works: [
    { workId: workA, title: "작품 A" },
    { workId: workB, title: "작품 B" },
  ],
  partners: [
    { partnerId: partnerA, name: "출판사 A" },
    { partnerId: partnerB, name: "출판사 B" },
  ],
  submissions: [{
    submissionId: entityId<"PublishingSubmission">("submission-a"),
    workId: workA,
    partnerId: partnerA,
    submittedOn: "2026-08-01",
    respondedOn: null,
  }],
} as const;

describe("publishing assistant contract", () => {
  it("builds an operational registry without manuscript, lore, or credentials", () => {
    const registry = buildPublishingAssistantRegistry(references);
    expect(registry).toEqual(references);
    const serialized = JSON.stringify(registry);
    expect(serialized).not.toContain("manuscript");
    expect(serialized).not.toContain("lore");
    expect(serialized).not.toContain("credential");
  });

  it("resolves open and unsubmitted queries from exact current records", () => {
    const open = resolvePublishingAssistantIntent({
      intent: parsePublishingAssistantIntentPayload({
        kind: "query-open",
        workLabel: null,
        partnerLabels: [],
        submittedOn: null,
      }),
      registry: buildPublishingAssistantRegistry(references),
      statement: "회신이 아직 없는 투고를 보여줘",
      connectionId,
      receipt,
      candidateId: "candidate-open",
      createdAt: "2026-08-10T00:00:01.000Z",
    });
    const unsubmitted = resolvePublishingAssistantIntent({
      intent: parsePublishingAssistantIntentPayload({
        kind: "query-unsubmitted",
        workLabel: "작품 A",
        partnerLabels: [],
        submittedOn: null,
      }),
      registry: buildPublishingAssistantRegistry(references),
      statement: "작품 A를 아직 보내지 않은 곳",
      connectionId,
      receipt,
      candidateId: "candidate-unsubmitted",
      createdAt: "2026-08-10T00:00:01.000Z",
    });

    expect(open).toMatchObject({
      status: "query",
      query: "open",
      submissionIds: ["submission-a"],
      partnerIds: [],
    });
    expect(unsubmitted).toMatchObject({
      status: "query",
      query: "unsubmitted",
      submissionIds: [],
      partnerIds: [partnerB],
    });
  });

  it("keeps an exact record request as a Candidate and refuses ambiguous labels", () => {
    const candidate = resolvePublishingAssistantIntent({
      intent: parsePublishingAssistantIntentPayload({
        kind: "record-submissions",
        workLabel: "작품 A",
        partnerLabels: ["출판사 A", "출판사 B"],
        submittedOn: "2026-08-09",
      }),
      registry: buildPublishingAssistantRegistry(references),
      statement: "어제 작품 A를 두 출판사에 보냈어",
      connectionId,
      receipt,
      candidateId: "candidate-record",
      createdAt: "2026-08-10T00:00:01.000Z",
    });
    expect(candidate).toMatchObject({
      status: "record-candidate",
      candidate: {
        candidateId: "candidate-record",
        workId: workA,
        records: [
          { partnerId: partnerA, submittedOn: "2026-08-09" },
          { partnerId: partnerB, submittedOn: "2026-08-09" },
        ],
      },
    });

    const ambiguous = resolvePublishingAssistantIntent({
      intent: parsePublishingAssistantIntentPayload({
        kind: "record-submissions",
        workLabel: "작품 A",
        partnerLabels: ["출판사 A"],
        submittedOn: null,
      }),
      registry: buildPublishingAssistantRegistry({
        ...references,
        partners: [...references.partners, {
          partnerId: entityId<"PublishingPartner">("partner-duplicate"),
          name: "출판사 A",
        }],
      }),
      statement: "작품 A를 출판사 A에 보냈어",
      connectionId,
      receipt,
      candidateId: "candidate-ambiguous",
      createdAt: "2026-08-10T00:00:01.000Z",
    });
    expect(ambiguous).toMatchObject({
      status: "needs-confirmation",
      reasons: ["출판사 A: 둘 이상 일치합니다."],
    });
  });

  it("approves only a server-issued Candidate identity", () => {
    expect(parseApprovePublishingAssistantCandidateCommand({
      schemaVersion: 1,
      candidateId: "candidate-record",
    })).toEqual({
      schemaVersion: 1,
      candidateId: "candidate-record",
    });
  });
});
