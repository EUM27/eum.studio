import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  authorizeAssistantExternalSettingReview,
  createAssistantExternalSettingReviewRecords,
  parseAssistantExternalSettingReviewResult,
} from "./assistant-external-setting-review";

describe("assistant external setting review", () => {
  it("authorizes the exact current chapter and Work settings for the selected connection", () => {
    const workId = entityId<"Work">(randomUUID());
    const conversationId = entityId<"AssistantConversation">(randomUUID());
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const command = {
      schemaVersion: 1 as const,
      requestId: entityId<"AssistantExternalSettingReviewRequest">(randomUUID()),
      workId,
      conversationId,
      connectionId,
      query: "현재 회차와 설정의 충돌을 검토해 주세요.",
      sourceRange: { documentId, documentRevisionId, from: 0, to: 12 },
    };
    const authorization = authorizeAssistantExternalSettingReview({
      command,
      grants: [{
        schemaVersion: 1,
        grantId: entityId<"AssistantContextPermissionGrant">(randomUUID()),
        revision: 1,
        workId,
        conversationId,
        capability: "lore-review",
        destinationId: connectionId,
        localScope: "work",
        externalScope: "work",
        duration: "conversation",
        createdAt: "2026-08-10T00:00:00.000Z",
        revokedAt: null,
        consumedAt: null,
      }],
      documents: [{ workId, documentId, documentRevisionId, length: 12 }],
      settings: [{
        kind: "character",
        entityId: randomUUID(),
        revision: 2,
        workId,
        label: "윤",
        fields: [{ field: "role", value: "항해사" }],
      }],
    });

    expect(authorization.allowed).toBe(true);
    if (!authorization.allowed) return;
    expect(authorization.context.request).toMatchObject({
      capability: "lore-review",
      destinationId: connectionId,
      requiredLocalScope: "work",
      requiredExternalScope: "work",
      readRanges: [command.sourceRange],
      transmittedRanges: [command.sourceRange],
    });
    expect(authorization.settings).toHaveLength(1);
  });

  it("creates persisted proposal and review-note Candidates without a manuscript or canonical-setting mutation command", () => {
    const workId = entityId<"Work">(randomUUID());
    const conversationId = entityId<"AssistantConversation">(randomUUID());
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const source = {
      kind: "character" as const,
      entityId: randomUUID(),
      revision: 2,
      workId,
      label: "윤",
      fields: [{ field: "role", value: "항해사" }],
    };
    const authorization = authorizeAssistantExternalSettingReview({
      command: {
        schemaVersion: 1,
        requestId: entityId<"AssistantExternalSettingReviewRequest">(randomUUID()),
        workId,
        conversationId,
        connectionId,
        query: "명시된 설정만 검토",
        sourceRange: { documentId, documentRevisionId, from: 0, to: 20 },
      },
      grants: [{
        schemaVersion: 1,
        grantId: entityId<"AssistantContextPermissionGrant">(randomUUID()),
        revision: 1,
        workId,
        conversationId,
        capability: "lore-review",
        destinationId: connectionId,
        localScope: "work",
        externalScope: "work",
        duration: "conversation",
        createdAt: "2026-08-10T00:00:00.000Z",
        revokedAt: null,
        consumedAt: null,
      }],
      documents: [{ workId, documentId, documentRevisionId, length: 20 }],
      settings: [source],
    });
    expect(authorization.allowed).toBe(true);
    if (!authorization.allowed) return;
    const records = createAssistantExternalSettingReviewRecords({
      authorization,
      payload: {
        reply: "검토 결과입니다.",
        proposals: [{
          action: "update",
          settingKind: "character",
          target: { kind: source.kind, entityId: source.entityId, revision: source.revision },
          label: source.label,
          field: "role",
          value: "왕실 항해사",
          evidenceRange: { documentId, documentRevisionId, from: 3, to: 8 },
          certainty: "explicit",
        }],
        reviewNotes: [{
          kind: "conflict",
          message: "현재 역할과 회차의 명시가 다릅니다.",
          references: [{ kind: source.kind, entityId: source.entityId, revision: source.revision }],
        }],
      },
      candidateId: randomUUID(),
      receiptId: randomUUID(),
      connectorReceiptId: randomUUID(),
      contextReceiptId: randomUUID(),
      createdAt: "2026-08-10T00:01:00.000Z",
    });

    const result = parseAssistantExternalSettingReviewResult({
      schemaVersion: 1,
      status: "candidate",
      ...records,
    });
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.receipt.transmittedSettings).toEqual([
      { kind: "character", entityId: source.entityId, revision: 2 },
    ]);
    expect(result.candidate.proposals[0]).toMatchObject({
      action: "update",
      value: "왕실 항해사",
      certainty: "explicit",
    });
    expect(result.candidate.reviewNotes[0]?.kind).toBe("conflict");
    expect(result.candidate).not.toHaveProperty("changes");
    expect(result.candidate).not.toHaveProperty("manuscriptCommand");
    expect(result.candidate).not.toHaveProperty("apply");
  });
});
