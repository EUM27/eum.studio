import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { parsePoc3StorageOpenProfile } from "./node-sqlite-ledger-profile";
import { openNodeSqliteLedger } from "./node-sqlite-ledger";

const now = "2026-08-29T00:00:00.000Z";

function meta(id: string) {
  return {
    id,
    schemaVersion: 19,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  } as const;
}

describe("node SQLite continuity ledger", () => {
  it("writes canonical threads, history, evidence, and review decisions atomically", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-continuity-ledger-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
      databasePath,
      checksumIdentity: "eum-studio-ledger-sha256-v1",
      requestedSettings: {
        journalMode: {
          applySql: "PRAGMA journal_mode = WAL",
          verifySql: "PRAGMA journal_mode",
          expectedRows: [{ journal_mode: "wal" }],
        },
        synchronous: {
          applySql: "PRAGMA synchronous = FULL",
          verifySql: "PRAGMA synchronous",
          expectedRows: [{ synchronous: 2 }],
        },
        foreignKeys: {
          applySql: "PRAGMA foreign_keys = ON",
          verifySql: "PRAGMA foreign_keys",
          expectedRows: [{ foreign_keys: 1 }],
        },
      },
      targetSchemaVersion: 19,
    }));
    try {
      const records: Poc3LedgerRecord[] = [
        {
          kind: "studio",
          id: "studio-1",
          displayName: "이음",
          locale: "ko-KR",
          timezone: "Asia/Seoul",
          settingsRevision: 1,
          createdAt: now,
        },
        {
          kind: "work",
          ...meta("work-1"),
          studioId: "studio-1",
          title: "작품",
          orderKey: "a",
          settingsId: "settings-1",
        },
        {
          kind: "activityPolicy",
          ...meta("activity-1"),
          workId: "work-1",
          idleTimeout: 1,
          navigationGrace: 1,
          hiddenWindowPolicy: "pause",
          activityClassRulesJson: "{}",
          autoStartEnabled: false,
          autoResumeFromIdle: false,
          recoveryPolicy: "manual",
        },
        {
          kind: "focusPolicy",
          ...meta("focus-1"),
          workId: "work-1",
          phaseDefinitionsJson: "[]",
          backgroundPolicy: "pause",
          musicStartPolicy: "manual",
          completionPolicy: "manual",
          visibility: "work",
        },
        {
          kind: "workSettings",
          id: "settings-1",
          workId: "work-1",
          sceneRuleSetId: "scene-rules-1",
          activityPolicyId: "activity-1",
          focusPolicyId: "focus-1",
          railPreferencesJson: "{}",
          revision: 1,
        },
        {
          kind: "character",
          ...meta("character-1"),
          workId: "work-1",
          name: "윤서",
          aliases: [],
          role: "기록관",
          summary: "",
          appearance: "",
          personality: "",
          speech: "",
          goal: "기록을 되찾는다",
          conflict: "",
          note: "",
        },
        {
          kind: "document",
          ...meta("document-1"),
          workId: "work-1",
          title: "1화",
          orderKey: "a",
          manuscriptId: "manuscript-1",
        },
        {
          kind: "blobManifest",
          blobRef: "blob-1",
          checksumIdentity: "eum-studio-ledger-sha256-v1",
          checksumValue: "hash-1",
          byteLength: 2,
          createdAt: now,
        },
        {
          kind: "documentRevision",
          id: "revision-1",
          workId: "work-1",
          documentId: "document-1",
          contentRef: "blob-1",
          contentHash: "hash-1",
          length: 2,
          cause: "test",
          createdAt: now,
          durableAt: now,
        },
        {
          kind: "manuscript",
          id: "manuscript-1",
          workId: "work-1",
          documentId: "document-1",
          currentRevisionId: "revision-1",
          durableRevisionId: "revision-1",
          updatedAt: now,
        },
      ];
      await ledger.transaction(async (transaction) => {
        for (const record of records) transaction.write(record);
      });
      const setup = new DatabaseSync(databasePath);
      try {
        setup.prepare(`
          INSERT INTO assistant_context_receipts (
            id, schema_version, request_id, work_id, conversation_id,
            capability, destination_id, read_ranges_json,
            transmitted_ranges_json, read_character_count,
            transmitted_character_count, grant_ids_json, created_at
          ) VALUES (?, 1, ?, ?, ?, 'continuity.review', ?, ?, ?, 2, 2, '[]', ?)
        `).run(
          "context-receipt-1",
          "context-request-1",
          "work-1",
          "conversation-1",
          "provider-1",
          "[]",
          "[]",
          now,
        );
      } finally {
        setup.close();
      }
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "continuityThread",
          ...meta("thread-1"),
          schemaVersion: 1,
          workId: "work-1",
          threadKind: "promise",
          title: "북문에서 다시 만나기",
          note: "다음 회차에서 확인",
          status: "open",
          openedAt: now,
          resolvedAt: null,
          subjectRefs: [{
            entityKind: "character",
            entityId: "character-1",
            orderIndex: 0,
          }],
        });
        transaction.write({
          kind: "continuityTransition",
          id: "transition-created-1",
          schemaVersion: 1,
          workId: "work-1",
          threadId: "thread-1",
          transitionKind: "created",
          revisionBefore: null,
          revisionAfter: 1,
          resolutionMode: null,
          reason: "사용자 생성",
          evidenceAnchorIds: [],
          createdAt: now,
        });
        transaction.write({
          kind: "continuityReviewCandidate",
          ...meta("continuity-candidate-1"),
          schemaVersion: 1,
          requestId: "continuity-request-1",
          workId: "work-1",
          sourceDocumentId: "document-1",
          sourceDocumentRevisionId: "revision-1",
          sourceFrom: 0,
          sourceTo: 2,
          providerId: "provider-1",
          modelId: "model-1",
          promptVersion: "eum-continuity-review-v1",
          status: "ready",
          contextReceiptId: "context-receipt-1",
          items: [{
            id: "continuity-item-1",
            assertionBasis: "explicit-evidence",
            threadKind: "open-question",
            title: "누가 문을 열었는가",
            note: "답을 확인",
            subjectRefs: [{
              entityKind: "character",
              entityId: "character-1",
              orderIndex: 0,
            }],
            reason: "질문이 직접 남음",
            potentialDuplicateThreadIds: [],
            status: "pending",
            appliedThreadId: null,
            evidence: [{
              id: "continuity-review-evidence-1",
              sourceDocumentId: "document-1",
              sourceDocumentRevisionId: "revision-1",
              sourceFrom: 0,
              sourceTo: 2,
              exactText: "윤서",
              orderIndex: 0,
            }],
          }],
        });
      });
      await expect(ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "continuityThread",
          ...meta("thread-invalid"),
          schemaVersion: 1,
          workId: "work-1",
          threadKind: "promise",
          title: "잘못된 참조",
          note: "",
          status: "open",
          openedAt: now,
          resolvedAt: null,
          subjectRefs: [{
            entityKind: "character",
            entityId: "character-outside",
            orderIndex: 0,
          }],
        });
      })).rejects.toThrow(/outside Work/u);
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "continuityThreadUpdate",
          id: "thread-1",
          workId: "work-1",
          expectedRevision: 1,
          threadKind: "promise",
          title: "북문 약속",
          note: "수정됨",
          status: "open",
          resolvedAt: null,
          subjectRefs: [{
            entityKind: "character",
            entityId: "character-1",
            orderIndex: 0,
          }],
          updatedAt: "2026-08-29T00:00:01.000Z",
        });
        transaction.write({
          kind: "continuityTransition",
          id: "transition-updated-1",
          schemaVersion: 1,
          workId: "work-1",
          threadId: "thread-1",
          transitionKind: "updated",
          revisionBefore: 1,
          revisionAfter: 2,
          resolutionMode: null,
          reason: "사용자 수정",
          evidenceAnchorIds: [],
          createdAt: "2026-08-29T00:00:01.000Z",
        });
        transaction.write({
          kind: "continuityReviewCandidateUpdate",
          id: "continuity-candidate-1",
          workId: "work-1",
          expectedRevision: 1,
          itemId: "continuity-item-1",
          threadKind: "open-question",
          title: "문을 연 사람",
          note: "사용자 편집",
          subjectRefs: [],
          updatedAt: "2026-08-29T00:00:01.000Z",
        });
      });
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "anchor",
          ...meta("anchor-1"),
          workId: "work-1",
          documentId: "document-1",
          originRevisionId: "revision-1",
          resolvedRevisionId: "revision-1",
          startOffset: 0,
          endOffset: 2,
          exactQuote: "윤서",
          prefixContext: "",
          suffixContext: "",
          quoteHash: "quote-hash",
          contextHash: "context-hash",
          status: "resolved",
          resolutionEvidenceJson: "{}",
        });
        transaction.write({
          kind: "continuityThread",
          ...meta("thread-2"),
          schemaVersion: 1,
          workId: "work-1",
          threadKind: "open-question",
          title: "문을 연 사람",
          note: "사용자 편집",
          status: "open",
          openedAt: "2026-08-29T00:00:02.000Z",
          resolvedAt: null,
          subjectRefs: [],
        });
        transaction.write({
          kind: "continuityEvidence",
          id: "thread-evidence-1",
          schemaVersion: 1,
          workId: "work-1",
          threadId: "thread-2",
          phase: "opened",
          sourceDocumentId: "document-1",
          sourceDocumentRevisionId: "revision-1",
          sourceFrom: 0,
          sourceTo: 2,
          exactText: "윤서",
          anchorId: "anchor-1",
          orderIndex: 0,
          createdAt: "2026-08-29T00:00:02.000Z",
        });
        transaction.write({
          kind: "continuityTransition",
          id: "transition-created-2",
          schemaVersion: 1,
          workId: "work-1",
          threadId: "thread-2",
          transitionKind: "created",
          revisionBefore: null,
          revisionAfter: 1,
          resolutionMode: null,
          reason: "Candidate 승인",
          evidenceAnchorIds: ["anchor-1"],
          createdAt: "2026-08-29T00:00:02.000Z",
        });
        transaction.write({
          kind: "continuityReviewEvidence",
          id: "continuity-review-evidence-1",
          workId: "work-1",
          candidateId: "continuity-candidate-1",
          itemId: "continuity-item-1",
          anchorId: "anchor-1",
        });
        transaction.write({
          kind: "continuityReviewItemDecision",
          id: "continuity-candidate-1",
          workId: "work-1",
          itemId: "continuity-item-1",
          expectedRevision: 2,
          candidateStatus: "completed",
          itemStatus: "approved",
          appliedThreadId: "thread-2",
          updatedAt: "2026-08-29T00:00:02.000Z",
          receipt: {
            id: "continuity-decision-1",
            schemaVersion: 1,
            decision: "approve",
            outcome: "applied",
            threadId: "thread-2",
            threadRevisionAfter: 1,
            sourceDocumentRevisionId: "revision-1",
            createdAt: "2026-08-29T00:00:02.000Z",
          },
        });
      });
      await expect(ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "continuityThreadUpdate",
          id: "thread-1",
          workId: "work-1",
          expectedRevision: 2,
          threadKind: "promise",
          title: "롤백되어야 함",
          note: "",
          status: "open",
          resolvedAt: null,
          subjectRefs: [],
          updatedAt: "2026-08-29T00:00:03.000Z",
        });
        transaction.write({
          kind: "continuityTransition",
          id: "transition-updated-1",
          schemaVersion: 1,
          workId: "work-1",
          threadId: "thread-1",
          transitionKind: "updated",
          revisionBefore: 2,
          revisionAfter: 3,
          resolutionMode: null,
          reason: "중복 receipt",
          evidenceAnchorIds: [],
          createdAt: "2026-08-29T00:00:03.000Z",
        });
      })).rejects.toThrow(/UNIQUE/u);
      const audit = new DatabaseSync(databasePath, { readOnly: true });
      try {
        expect(audit.prepare(`
          SELECT revision, title, status FROM continuity_threads
          WHERE id = 'thread-1'
        `).get()).toEqual({ revision: 2, title: "북문 약속", status: "open" });
        expect(audit.prepare(`
          SELECT revision, status FROM assistant_continuity_review_candidates
          WHERE id = 'continuity-candidate-1'
        `).get()).toEqual({ revision: 3, status: "completed" });
        expect(audit.prepare(`
          SELECT anchor_id AS "anchorId"
          FROM assistant_continuity_review_evidence
          WHERE id = 'continuity-review-evidence-1'
        `).get()).toEqual({ anchorId: "anchor-1" });
        expect(audit.prepare(`
          SELECT outcome, thread_id AS "threadId"
          FROM assistant_continuity_review_decisions
          WHERE id = 'continuity-decision-1'
        `).get()).toEqual({ outcome: "applied", threadId: "thread-2" });
        expect(audit.prepare(`
          SELECT COUNT(*) AS count FROM continuity_thread_history
        `).get()).toEqual({ count: 3 });
        expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        audit.close();
      }
    } finally {
      ledger.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
