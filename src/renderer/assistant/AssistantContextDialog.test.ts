import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { AssistantContextDialog } from "./AssistantContextDialog";

describe("AssistantContextDialog", () => {
  it("shows scoped grants and value-free access receipts", () => {
    const workId = entityId<"Work">("work-a");
    const conversationId = entityId<"AssistantConversation">("conversation-a");
    const documentId = entityId<"Document">("document-a");
    const documentRevisionId = entityId<"DocumentRevision">("revision-a");
    const connectionId = entityId<"AssistantConnection">("connection-a");
    const markup = renderToStaticMarkup(
      createElement(AssistantContextDialog, {
        actionState: "idle",
        canRunExternalSettingReview: true,
        canRunNotationReview: true,
        canRunVocabularyLookup: true,
        connections: [{
          connectionId,
          label: "내 어휘 연결",
          model: "user-model",
        }],
        destinationProfile: {
          schemaVersion: 1,
          destinations: [
            {
              destinationId: "local-dictionary",
              label: "작품 내 정확 어휘 검색",
              kind: "local-exact-vocabulary-search",
              capabilities: ["vocabulary-lookup"],
              requiredLocalScope: "work",
              requiredExternalScope: "none",
            },
            {
              destinationId: "local-notation",
              label: "선택 범위 표기 점검",
              kind: "local-selected-notation-review",
              capabilities: ["vocabulary-lookup"],
              requiredLocalScope: "selection",
              requiredExternalScope: "none",
            },
            {
              destinationId: "local-setting-review",
              label: "설정 중복 검토",
              kind: "local-exact-setting-review",
              capabilities: ["lore-review"],
              requiredLocalScope: "work",
              requiredExternalScope: "none",
            },
          ],
        },
        documentLabels: { [documentId]: "첫 회차" },
        error: null,
        onClose: () => undefined,
        onGrant: () => undefined,
        onOpenConnections: () => undefined,
        onOpenNotationFinding: () => undefined,
        onOpenSettingReference: () => undefined,
        onOpenVocabularyOccurrence: () => undefined,
        onRevoke: () => undefined,
        onRunSettingReview: () => undefined,
        onRunNotationReview: () => undefined,
        onRunVocabularyLookup: () => undefined,
        onRunVocabularySuggestion: () => undefined,
        onRunExternalSettingReview: () => undefined,
        projection: {
          schemaVersion: 1,
          workId,
          conversationId,
          grants: [
            {
              schemaVersion: 1,
              grantId: entityId<"AssistantContextPermissionGrant">("grant-a"),
              revision: 1,
              workId,
              conversationId,
              capability: "vocabulary-lookup",
              destinationId: "local-dictionary",
              localScope: "selection",
              externalScope: "none",
              duration: "conversation",
              createdAt: "2026-08-10T01:00:00.000Z",
              revokedAt: null,
              consumedAt: null,
            },
          ],
          receipts: [
            {
              schemaVersion: 1,
              receiptId: entityId<"AssistantContextReceipt">("receipt-a"),
              requestId: entityId<"AssistantContextRequest">("request-a"),
              workId,
              conversationId,
              capability: "vocabulary-lookup",
              destinationId: "local-dictionary",
              readRanges: [
                {
                  documentId,
                  documentRevisionId,
                  from: 3,
                  to: 7,
                },
              ],
              transmittedRanges: [],
              readCharacterCount: 4,
              transmittedCharacterCount: 0,
              grantIds: [entityId<"AssistantContextPermissionGrant">("grant-a")],
              createdAt: "2026-08-10T01:01:00.000Z",
            },
          ],
          candidates: [{
            schemaVersion: 1,
            candidateId: entityId<"AssistantVocabularyCandidate">("candidate-a"),
            workId,
            conversationId,
            destinationId: "local-dictionary",
            sourceRange: {
              documentId,
              documentRevisionId,
              from: 3,
              to: 7,
            },
            query: "서늘한",
            occurrences: [{
              documentId,
              documentRevisionId,
              from: 3,
              to: 7,
            }],
            receiptId: entityId<"AssistantContextReceipt">("receipt-a"),
            createdAt: "2026-08-10T01:01:00.000Z",
          }],
          notationCandidates: [{
            schemaVersion: 1,
            candidateId: entityId<"AssistantNotationCandidate">(
              "notation-candidate-a",
            ),
            workId,
            conversationId,
            destinationId: "local-notation",
            sourceRange: {
              documentId,
              documentRevisionId,
              from: 8,
              to: 14,
            },
            findings: [{
              kind: "forbidden-term",
              range: {
                documentId,
                documentRevisionId,
                from: 9,
                to: 12,
              },
              label: "금칙어",
            }],
            regexError: null,
            receiptId: entityId<"AssistantContextReceipt">("notation-receipt-a"),
            createdAt: "2026-08-10T01:01:30.000Z",
          }],
          vocabularySuggestionCandidates: [{
            schemaVersion: 1,
            candidateId: entityId<"AssistantVocabularySuggestionCandidate">(
              "suggestion-candidate-a",
            ),
            workId,
            conversationId,
            connectionId,
            query: "이 문맥의 유의어",
            sourceRange: {
              documentId,
              documentRevisionId,
              from: 3,
              to: 7,
            },
            suggestions: [{
              word: "쌀쌀한",
              nuance: "체감 온도를 강조",
              example: "쌀쌀한 바람이 불었다.",
            }],
            note: "원고 반영 여부는 사용자가 정합니다.",
            connectorReceiptId: entityId<"ConnectorReceipt">(
              "connector-receipt-a",
            ),
            contextReceiptId: entityId<"AssistantContextReceipt">("receipt-a"),
            createdAt: "2026-08-10T01:03:00.000Z",
          }],
          settingReviewReceipts: [{
            schemaVersion: 1,
            receiptId: entityId<"AssistantSettingReviewReceipt">(
              "setting-receipt-a",
            ),
            requestId: entityId<"AssistantSettingReviewRequest">(
              "setting-request-a",
            ),
            workId,
            conversationId,
            capability: "lore-review",
            destinationId: "local-setting-review",
            reviewedSettings: [
              { kind: "character", entityId: "character-a", revision: 1 },
              { kind: "character", entityId: "character-b", revision: 2 },
            ],
            transmittedSettingCount: 0,
            grantIds: [entityId<"AssistantContextPermissionGrant">("grant-a")],
            createdAt: "2026-08-10T01:02:00.000Z",
          }],
          settingReviewFindings: [{
            schemaVersion: 1,
            findingId: entityId<"AssistantSettingReviewFinding">("finding-a"),
            workId,
            conversationId,
            destinationId: "local-setting-review",
            kind: "duplicate",
            settingKind: "character",
            label: "해린",
            references: [
              { kind: "character", entityId: "character-a", revision: 1 },
              { kind: "character", entityId: "character-b", revision: 2 },
            ],
            receiptId: entityId<"AssistantSettingReviewReceipt">(
              "setting-receipt-a",
            ),
            createdAt: "2026-08-10T01:02:00.000Z",
          }],
          settingConflictFindings: [{
            schemaVersion: 1,
            findingId: entityId<"AssistantSettingConflictFinding">(
              "setting-conflict-a",
            ),
            workId,
            conversationId,
            destinationId: "local-setting-review",
            kind: "conflict",
            settingKind: "character",
            label: "해린",
            field: "role",
            references: [
              { kind: "character", entityId: "character-a", revision: 1 },
              { kind: "character", entityId: "character-b", revision: 2 },
            ],
            receiptId: entityId<"AssistantSettingReviewReceipt">(
              "setting-receipt-a",
            ),
            createdAt: "2026-08-10T01:02:00.000Z",
          }],
          externalSettingReviewReceipts: [{
            schemaVersion: 1,
            receiptId: entityId<"AssistantExternalSettingReviewReceipt">(
              "external-setting-receipt-a",
            ),
            requestId: entityId<"AssistantExternalSettingReviewRequest">(
              "external-setting-request-a",
            ),
            workId,
            conversationId,
            connectionId,
            sourceRange: {
              documentId,
              documentRevisionId,
              from: 0,
              to: 20,
            },
            transmittedSettings: [
              { kind: "character", entityId: "character-a", revision: 1 },
            ],
            transmittedSettingCount: 1,
            connectorReceiptId: entityId<"ConnectorReceipt">(
              "external-connector-receipt-a",
            ),
            contextReceiptId: entityId<"AssistantContextReceipt">(
              "external-context-receipt-a",
            ),
            createdAt: "2026-08-10T01:04:00.000Z",
          }],
          externalSettingReviewCandidates: [{
            schemaVersion: 1,
            candidateId: entityId<"AssistantExternalSettingReviewCandidate">(
              "external-setting-candidate-a",
            ),
            workId,
            conversationId,
            connectionId,
            query: "현재 회차 설정 검토",
            reply: "명시된 역할과 정규 설정이 다릅니다.",
            proposals: [{
              action: "update",
              settingKind: "character",
              target: { kind: "character", entityId: "character-a", revision: 1 },
              label: "해린",
              field: "role",
              value: "왕실 항해사",
              evidenceRange: {
                documentId,
                documentRevisionId,
                from: 3,
                to: 8,
              },
              certainty: "explicit",
            }],
            reviewNotes: [{
              kind: "conflict",
              message: "회차와 역할이 다릅니다.",
              references: [
                { kind: "character", entityId: "character-a", revision: 1 },
              ],
            }],
            receiptId: entityId<"AssistantExternalSettingReviewReceipt">(
              "external-setting-receipt-a",
            ),
            createdAt: "2026-08-10T01:04:00.000Z",
          }],
        },
        workTitle: "테스트 작품",
      }),
    );

    expect(markup).toContain("조수 접근 권한");
    expect(markup).toContain("정확한 선택 범위");
    expect(markup).toContain("전송하지 않음");
    expect(markup).toContain("읽기 4자");
    expect(markup).toContain("서늘한");
    expect(markup).toContain("1곳");
    expect(markup).toContain("첫 회차");
    expect(markup).toContain("1. 첫 회차 3–7");
    expect(markup).toContain("선택 범위 표기 점검");
    expect(markup).toContain("금칙어 · 금칙어 9–12");
    expect(markup).toContain("설정 중복 검토");
    expect(markup).toContain("어휘·유의어 제안");
    expect(markup).toContain("내 어휘 연결");
    expect(markup).toContain("쌀쌀한");
    expect(markup).toContain("체감 온도를 강조");
    expect(markup).toContain("쌀쌀한 바람이 불었다.");
    expect(markup).toContain("해린");
    expect(markup).toContain("인물 안의 완전 일치 이름");
    expect(markup).toContain("인물 안의 역할 값이 서로 다름");
    expect(markup).toContain("“해린” 중복 인물 1 열기");
    expect(markup).toContain("“해린” 역할 충돌 인물 2 열기");
    expect(markup).toContain("인물 2 · r2");
    expect(markup).toContain("읽기 2개 · 외부 전송 0개");
    expect(markup).toContain("외부 설정 검토");
    expect(markup).toContain("회차·설정 전송 권한 승인");
    expect(markup).toContain("현재 회차 설정 검토");
    expect(markup).toContain("왕실 항해사");
    expect(markup).toContain("원고 근거 3–8 열기");
    expect(markup).toContain("설정 전송 1개");
    expect(markup).not.toContain("원고 비밀 문장");
    expect(markup).not.toContain("API key");
  });
});
