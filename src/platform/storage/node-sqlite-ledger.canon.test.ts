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
    schemaVersion: 18,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  } as const;
}

describe("node SQLite canon review ledger", () => {
  it("writes, edits, attaches evidence, and decides one normalized Candidate transactionally", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-canon-ledger-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const profile = parsePoc3StorageOpenProfile({
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
      targetSchemaVersion: 18,
    });
    const ledger = await openNodeSqliteLedger(profile);
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
        ...["character-1", "character-2", "character-3"].map((id) => ({
          kind: "character" as const,
          ...meta(id),
          workId: "work-1",
          name: id,
          aliases: [],
          role: "",
          summary: "",
          appearance: "",
          personality: "",
          speech: "",
          goal: "",
          conflict: "",
          note: "",
        })),
        {
          kind: "characterRelation",
          ...meta("relation-1"),
          workId: "work-1",
          fromCharacterId: "character-1",
          toCharacterId: "character-2",
          relationKind: "동료",
          description: "",
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
          ) VALUES (?, 1, ?, ?, ?, 'canon.review', ?, ?, ?, 2, 2, '[]', ?)
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
          kind: "canonReviewCandidate",
          ...meta("candidate-1"),
          schemaVersion: 1,
          requestId: "canon-request-1",
          workId: "work-1",
          sourceDocumentId: "document-1",
          sourceDocumentRevisionId: "revision-1",
          sourceFrom: 0,
          sourceTo: 2,
          providerId: "provider-1",
          modelId: "model-1",
          promptVersion: "eum-canon-review-v1",
          status: "ready",
          contextReceiptId: "context-receipt-1",
          items: [{
            id: "item-1",
            targetKind: "character",
            operation: "update",
            targetHint: "윤서",
            targetId: "character-1",
            matchingTargetIds: ["character-1"],
            expectedTargetRevision: 1,
            assertionBasis: "explicit-evidence",
            reason: "직접 서술",
            status: "pending",
            appliedTargetId: null,
            fieldChanges: [{
              field: "role",
              before: "수습",
              after: "기록관",
              selected: true,
              orderIndex: 0,
            }],
            evidence: [{
              id: "evidence-1",
              sourceDocumentId: "document-1",
              sourceDocumentRevisionId: "revision-1",
              sourceFrom: 0,
              sourceTo: 2,
              exactText: "윤서",
              orderIndex: 0,
            }],
          }],
        });
        transaction.write({
          kind: "characterRelationUpdate",
          id: "relation-1",
          workId: "work-1",
          expectedRevision: 1,
          updatedAt: "2026-08-29T00:00:01.000Z",
          fromCharacterId: "character-2",
          toCharacterId: "character-3",
          relationKind: "협력자",
          description: "새 임무를 함께 맡는다.",
        });
      });
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "canonReviewCandidateUpdate",
          id: "candidate-1",
          workId: "work-1",
          expectedRevision: 1,
          itemId: "item-1",
          targetKind: "character",
          operation: "update",
          targetId: "character-1",
          matchingTargetIds: ["character-1"],
          expectedTargetRevision: 1,
          fieldChanges: [{
            field: "role",
            before: "수습",
            after: "정식 기록관",
            selected: false,
            orderIndex: 0,
          }],
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
          kind: "canonReviewEvidence",
          id: "evidence-1",
          workId: "work-1",
          candidateId: "candidate-1",
          itemId: "item-1",
          anchorId: "anchor-1",
        });
        transaction.write({
          kind: "canonReviewItemDecision",
          id: "candidate-1",
          workId: "work-1",
          itemId: "item-1",
          expectedRevision: 2,
          candidateStatus: "completed",
          itemStatus: "approved",
          appliedTargetId: null,
          updatedAt: "2026-08-29T00:00:02.000Z",
          receipt: {
            id: "decision-receipt-1",
            schemaVersion: 1,
            decision: "approve",
            outcome: "noop",
            targetKind: "character",
            targetId: "character-1",
            targetRevisionBefore: 1,
            targetRevisionAfter: 1,
            selectedFields: [],
            sourceDocumentRevisionId: "revision-1",
            createdAt: "2026-08-29T00:00:02.000Z",
          },
        });
      });
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "canonReviewCandidate",
          ...meta("candidate-2"),
          schemaVersion: 1,
          requestId: "canon-request-2",
          workId: "work-1",
          sourceDocumentId: "document-1",
          sourceDocumentRevisionId: "revision-1",
          sourceFrom: 0,
          sourceTo: 2,
          providerId: "provider-1",
          modelId: "model-1",
          promptVersion: "eum-canon-review-v1",
          status: "ready",
          contextReceiptId: "context-receipt-1",
          items: [{
            id: "item-2",
            targetKind: "character",
            operation: "create",
            targetHint: "새 인물",
            targetId: null,
            matchingTargetIds: [],
            expectedTargetRevision: null,
            assertionBasis: "explicit-evidence",
            reason: "직접 서술",
            status: "pending",
            appliedTargetId: null,
            fieldChanges: [{
              field: "name",
              before: null,
              after: "새 인물",
              selected: true,
              orderIndex: 0,
            }],
            evidence: [{
              id: "evidence-2",
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
          kind: "character",
          ...meta("rollback-character"),
          workId: "work-1",
          name: "되돌릴 인물",
          aliases: [],
          role: "",
          summary: "",
          appearance: "",
          personality: "",
          speech: "",
          goal: "",
          conflict: "",
          note: "",
        });
        transaction.write({
          kind: "canonReviewItemDecision",
          id: "candidate-2",
          workId: "work-1",
          itemId: "item-2",
          expectedRevision: 1,
          candidateStatus: "completed",
          itemStatus: "approved",
          appliedTargetId: "rollback-character",
          updatedAt: "2026-08-29T00:00:03.000Z",
          receipt: {
            id: "decision-receipt-1",
            schemaVersion: 1,
            decision: "approve",
            outcome: "applied",
            targetKind: "character",
            targetId: "rollback-character",
            targetRevisionBefore: null,
            targetRevisionAfter: 1,
            selectedFields: ["name"],
            sourceDocumentRevisionId: "revision-1",
            createdAt: "2026-08-29T00:00:03.000Z",
          },
        });
      })).rejects.toThrow(/UNIQUE/i);
      const audit = new DatabaseSync(databasePath, { readOnly: true });
      try {
        expect(audit.prepare(`
          SELECT revision, status FROM assistant_canon_review_candidates
          WHERE id = 'candidate-1'
        `).get()).toEqual({ revision: 3, status: "completed" });
        expect(audit.prepare(`
          SELECT after_json AS "afterJson", selected
          FROM assistant_canon_review_field_changes
          WHERE item_id = 'item-1' AND field_name = 'role'
        `).get()).toEqual({ afterJson: '"정식 기록관"', selected: 0 });
        expect(audit.prepare(`
          SELECT anchor_id AS "anchorId"
          FROM assistant_canon_review_evidence WHERE id = 'evidence-1'
        `).get()).toEqual({ anchorId: "anchor-1" });
        expect(audit.prepare(`
          SELECT outcome FROM assistant_canon_review_decision_receipts
          WHERE id = 'decision-receipt-1'
        `).get()).toEqual({ outcome: "noop" });
        expect(audit.prepare(`
          SELECT
            revision,
            from_character_id AS "fromCharacterId",
            to_character_id AS "toCharacterId",
            kind
          FROM character_relations WHERE id = 'relation-1'
        `).get()).toEqual({
          revision: 2,
          fromCharacterId: "character-2",
          toCharacterId: "character-3",
          kind: "협력자",
        });
        expect(audit.prepare(`
          SELECT revision, status FROM assistant_canon_review_candidates
          WHERE id = 'candidate-2'
        `).get()).toEqual({ revision: 1, status: "ready" });
        expect(audit.prepare(`
          SELECT status FROM assistant_canon_review_items WHERE id = 'item-2'
        `).get()).toEqual({ status: "pending" });
        expect(audit.prepare(`
          SELECT COUNT(*) AS count FROM characters WHERE id = 'rollback-character'
        `).get()).toEqual({ count: 0 });
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
