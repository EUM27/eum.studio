import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { openNodeSqliteLedger } from "./node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "./node-sqlite-ledger-profile";

const now = "2026-08-29T00:00:00.000Z";
const meta = (id: string) => ({ id, schemaVersion: 21, revision: 1, createdAt: now, updatedAt: now } as const);

function workspaceRecords(): readonly Poc3LedgerRecord[] {
  return [
    { kind: "studio", id: "studio-1", displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
    { kind: "work", ...meta("work-1"), studioId: "studio-1", title: "작품", orderKey: "a", settingsId: "settings-1" },
    { kind: "activityPolicy", ...meta("activity-1"), workId: "work-1", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta("focus-1"), workId: "work-1", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: "settings-1", workId: "work-1", sceneRuleSetId: "rules-1", activityPolicyId: "activity-1", focusPolicyId: "focus-1", railPreferencesJson: "{}", revision: 1 },
    { kind: "character", ...meta("character-1"), workId: "work-1", name: "윤서", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
    { kind: "work", ...meta("work-2"), studioId: "studio-1", title: "외부", orderKey: "b", settingsId: "settings-2" },
    { kind: "activityPolicy", ...meta("activity-2"), workId: "work-2", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta("focus-2"), workId: "work-2", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: "settings-2", workId: "work-2", sceneRuleSetId: "rules-2", activityPolicyId: "activity-2", focusPolicyId: "focus-2", railPreferencesJson: "{}", revision: 1 },
    { kind: "character", ...meta("character-outside"), workId: "work-2", name: "외부", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
  ];
}

describe("node SQLite Context Planner ledger", () => {
  it("stores Work-local policies and immutable receipt-linked manifests/activity", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-context-ledger-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
      databasePath,
      checksumIdentity: "eum-studio-ledger-sha256-v1",
      requestedSettings: {
        journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
        synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
        foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
      },
      targetSchemaVersion: 21,
    }));
    try {
      await ledger.transaction(async (transaction) => {
        for (const record of workspaceRecords()) transaction.write(record);
      });
      const setup = new DatabaseSync(databasePath);
      try {
        setup.prepare(`
          INSERT INTO assistant_context_receipts (
            id, schema_version, request_id, work_id, conversation_id,
            capability, destination_id, read_ranges_json, transmitted_ranges_json,
            read_character_count, transmitted_character_count, grant_ids_json, created_at
          ) VALUES (?, 1, ?, ?, ?, 'canon.review', ?, '[]', '[]', 12, 8, '[]', ?)
        `).run("receipt-1", "request-1", "work-1", "conversation-1", "provider-1", now);
      } finally {
        setup.close();
      }
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "assistantContextPolicy",
          id: "policy-1", schemaVersion: 1, revision: 1, createdAt: now, updatedAt: now,
          workId: "work-1", entityKind: "character", entityId: "character-1", mode: "required",
        });
        transaction.write({
          kind: "assistantContextManifest",
          id: "manifest-1", schemaVersion: 1, workId: "work-1", receiptId: "receipt-1",
          entries: [{ kind: "entity", entity: { kind: "character", id: "character-1" }, entityRevision: 1, inclusionReason: "required-policy" }],
          excluded: [], estimatedTokenCount: 3, createdAt: now,
        });
        transaction.write({
          kind: "assistantContextActivity",
          id: "context-activity-1", schemaVersion: 1, workId: "work-1",
          receiptId: "receipt-1", manifestId: "manifest-1", capability: "canon.review",
          destinationId: "provider-1", providerId: "provider-1", modelId: "model-1",
          startedAt: now, completedAt: "2026-08-29T00:00:01.000Z",
          planDurationMs: 3, authorizeDurationMs: 2, connectorDurationMs: 10,
          persistDurationMs: 1, readRanges: [], transmittedRanges: [],
          readCharacterCount: 12, transmittedCharacterCount: 8, candidateCount: 1,
        });
      });
      await ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "assistantContextPolicyUpdate",
          workId: "work-1", entityKind: "character", entityId: "character-1",
          expectedRevision: 1, mode: "withheld", updatedAt: "2026-08-29T00:00:02.000Z",
        });
      });
      await expect(ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "assistantContextPolicy",
          id: "policy-invalid", schemaVersion: 1, revision: 1, createdAt: now, updatedAt: now,
          workId: "work-1", entityKind: "character", entityId: "character-outside", mode: "required",
        });
      })).rejects.toThrow(/outside Work/u);

      const audit = new DatabaseSync(databasePath);
      try {
        expect(audit.prepare(`SELECT revision, mode FROM assistant_entity_context_policies WHERE id = 'policy-1'`).get())
          .toEqual({ revision: 2, mode: "withheld" });
        expect(() => audit.prepare(`UPDATE assistant_context_manifests SET estimated_token_count = 0`).run())
          .toThrow(/immutable/u);
        expect(() => audit.prepare(`DELETE FROM assistant_context_activities`).run())
          .toThrow(/immutable/u);
        expect(audit.prepare(`SELECT entries_json AS entries, excluded_json AS excluded FROM assistant_context_manifests WHERE id = 'manifest-1'`).get())
          .toEqual({
            entries: JSON.stringify([{ kind: "entity", entity: { kind: "character", id: "character-1" }, entityRevision: 1, inclusionReason: "required-policy" }]),
            excluded: "[]",
          });
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
