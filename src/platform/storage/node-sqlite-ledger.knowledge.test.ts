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
  return { id, schemaVersion: 1, revision: 1, createdAt: now, updatedAt: now } as const;
}

function baseRecords(): Poc3LedgerRecord[] {
  return [
    {
      kind: "studio", id: "studio-1", displayName: "이음", locale: "ko-KR",
      timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now,
    },
    {
      kind: "work", ...meta("work-1"), studioId: "studio-1", title: "작품 1",
      orderKey: "a", settingsId: "settings-1",
    },
    {
      kind: "activityPolicy", ...meta("activity-1"), workId: "work-1",
      idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause",
      activityClassRulesJson: "{}", autoStartEnabled: false,
      autoResumeFromIdle: false, recoveryPolicy: "manual",
    },
    {
      kind: "focusPolicy", ...meta("focus-1"), workId: "work-1",
      phaseDefinitionsJson: "[]", backgroundPolicy: "pause",
      musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work",
    },
    {
      kind: "workSettings", id: "settings-1", workId: "work-1",
      sceneRuleSetId: "scene-rules-1", activityPolicyId: "activity-1",
      focusPolicyId: "focus-1", railPreferencesJson: "{}", revision: 1,
    },
    {
      kind: "character", ...meta("character-1"), workId: "work-1", name: "윤서",
      aliases: [], role: "기록관", summary: "", appearance: "", personality: "",
      speech: "", goal: "", conflict: "", note: "",
    },
    {
      kind: "work", ...meta("work-2"), studioId: "studio-1", title: "작품 2",
      orderKey: "b", settingsId: "settings-2",
    },
    {
      kind: "activityPolicy", ...meta("activity-2"), workId: "work-2",
      idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause",
      activityClassRulesJson: "{}", autoStartEnabled: false,
      autoResumeFromIdle: false, recoveryPolicy: "manual",
    },
    {
      kind: "focusPolicy", ...meta("focus-2"), workId: "work-2",
      phaseDefinitionsJson: "[]", backgroundPolicy: "pause",
      musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work",
    },
    {
      kind: "workSettings", id: "settings-2", workId: "work-2",
      sceneRuleSetId: "scene-rules-2", activityPolicyId: "activity-2",
      focusPolicyId: "focus-2", railPreferencesJson: "{}", revision: 1,
    },
    {
      kind: "character", ...meta("character-2"), workId: "work-2", name: "도현",
      aliases: [], role: "", summary: "", appearance: "", personality: "",
      speech: "", goal: "", conflict: "", note: "",
    },
  ];
}

describe("node SQLite CharacterKnowledge ledger", () => {
  it("stores Work-local beliefs and commits supersession lineage atomically", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-knowledge-ledger-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
      databasePath,
      checksumIdentity: "eum-studio-ledger-sha256-v1",
      requestedSettings: {
        journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
        synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
        foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
      },
      targetSchemaVersion: 20,
    }));
    try {
      await ledger.transaction(async (transaction) => {
        for (const record of baseRecords()) transaction.write(record);
      });
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "characterKnowledge",
          ...meta("knowledge-1"),
          workId: "work-1",
          characterId: "character-1",
          statement: "열쇠는 북문을 연다",
          stance: "believes",
          truthStatus: "false",
          status: "active",
          supersedesKnowledgeId: null,
          supersededByKnowledgeId: null,
          retiredReason: null,
          aboutRefs: [],
        });
        transaction.write({
          kind: "characterKnowledgeTransition",
          id: "knowledge-transition-1",
          schemaVersion: 1,
          workId: "work-1",
          knowledgeId: "knowledge-1",
          transitionKind: "created",
          revisionBefore: null,
          revisionAfter: 1,
          successorKnowledgeId: null,
          reason: "사용자 생성",
          evidenceAnchorIds: [],
          createdAt: now,
        });
      });

      await expect(ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "characterKnowledge",
          ...meta("knowledge-invalid"),
          workId: "work-1",
          characterId: "character-1",
          statement: "다른 작품 인물",
          stance: "knows",
          truthStatus: "unknown",
          status: "active",
          supersedesKnowledgeId: null,
          supersededByKnowledgeId: null,
          retiredReason: null,
          aboutRefs: [{ entityKind: "character", entityId: "character-2", orderIndex: 0 }],
        });
      })).rejects.toThrow(/outside Work/u);

      await expect(ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "characterKnowledge",
          ...meta("knowledge-duplicate"),
          workId: "work-1",
          characterId: "character-1",
          statement: "열쇠는 북문을 연다",
          stance: "knows",
          truthStatus: "true",
          status: "active",
          supersedesKnowledgeId: null,
          supersededByKnowledgeId: null,
          retiredReason: null,
          aboutRefs: [],
        });
      })).rejects.toThrow(/UNIQUE/u);

      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "characterKnowledgeStatus",
          id: "knowledge-1",
          workId: "work-1",
          expectedRevision: 1,
          status: "superseded",
          supersededByKnowledgeId: "knowledge-2",
          retiredReason: null,
          updatedAt: "2026-08-29T00:00:01.000Z",
        });
        transaction.write({
          kind: "characterKnowledge",
          ...meta("knowledge-2"),
          createdAt: "2026-08-29T00:00:01.000Z",
          updatedAt: "2026-08-29T00:00:01.000Z",
          workId: "work-1",
          characterId: "character-1",
          statement: "열쇠는 남문을 연다",
          stance: "knows",
          truthStatus: "true",
          status: "active",
          supersedesKnowledgeId: "knowledge-1",
          supersededByKnowledgeId: null,
          retiredReason: null,
          aboutRefs: [],
        });
        transaction.write({
          kind: "characterKnowledgeTransition",
          id: "knowledge-transition-2",
          schemaVersion: 1,
          workId: "work-1",
          knowledgeId: "knowledge-1",
          transitionKind: "superseded",
          revisionBefore: 1,
          revisionAfter: 2,
          successorKnowledgeId: "knowledge-2",
          reason: "새 인식",
          evidenceAnchorIds: [],
          createdAt: "2026-08-29T00:00:01.000Z",
        });
        transaction.write({
          kind: "characterKnowledgeTransition",
          id: "knowledge-transition-3",
          schemaVersion: 1,
          workId: "work-1",
          knowledgeId: "knowledge-2",
          transitionKind: "created",
          revisionBefore: null,
          revisionAfter: 1,
          successorKnowledgeId: null,
          reason: "knowledge-1 대체",
          evidenceAnchorIds: [],
          createdAt: "2026-08-29T00:00:01.000Z",
        });
      });

      const audit = new DatabaseSync(databasePath);
      try {
        expect(audit.prepare(`
          SELECT revision, statement, stance, truth_status AS "truthStatus", status,
            superseded_by_knowledge_id AS "supersededByKnowledgeId"
          FROM character_knowledge WHERE id = 'knowledge-1'
        `).get()).toEqual({
          revision: 2,
          statement: "열쇠는 북문을 연다",
          stance: "believes",
          truthStatus: "false",
          status: "superseded",
          supersededByKnowledgeId: "knowledge-2",
        });
        expect(audit.prepare(`
          SELECT status, supersedes_knowledge_id AS "supersedesKnowledgeId"
          FROM character_knowledge WHERE id = 'knowledge-2'
        `).get()).toEqual({ status: "active", supersedesKnowledgeId: "knowledge-1" });
        expect(() => audit.prepare(`
          UPDATE character_knowledge_history SET reason = '변조'
          WHERE id = 'knowledge-transition-1'
        `).run()).toThrow(/immutable/u);
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
