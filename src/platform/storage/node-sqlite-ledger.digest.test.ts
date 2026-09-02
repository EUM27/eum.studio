import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { openNodeSqliteLedger } from "./node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "./node-sqlite-ledger-profile";

const now = "2026-08-29T00:00:00.000Z";
const meta = (id: string) => ({ id, schemaVersion: 22, revision: 1, createdAt: now, updatedAt: now } as const);

describe("node SQLite NarrativeDigest ledger", () => {
  it("stores immutable receipt-linked text and exact source revisions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-digest-ledger-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
      databasePath, checksumIdentity: "eum-studio-ledger-sha256-v1",
      requestedSettings: {
        journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
        synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
        foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
      }, targetSchemaVersion: 22,
    }));
    try {
      const records: Poc3LedgerRecord[] = [
        { kind: "studio", id: "studio-1", displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
        { kind: "work", ...meta("work-1"), studioId: "studio-1", title: "작품", orderKey: "a", settingsId: "settings-1" },
        { kind: "activityPolicy", ...meta("activity-1"), workId: "work-1", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
        { kind: "focusPolicy", ...meta("focus-1"), workId: "work-1", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
        { kind: "workSettings", id: "settings-1", workId: "work-1", sceneRuleSetId: "rules-1", activityPolicyId: "activity-1", focusPolicyId: "focus-1", railPreferencesJson: "{}", revision: 1 },
        { kind: "character", ...meta("character-1"), workId: "work-1", name: "윤서", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
        { kind: "document", ...meta("document-1"), workId: "work-1", title: "1화", orderKey: "a", manuscriptId: "manuscript-1" },
        { kind: "blobManifest", blobRef: "blob-1", checksumIdentity: "eum-studio-ledger-sha256-v1", checksumValue: "hash", byteLength: 2, createdAt: now },
        { kind: "documentRevision", id: "revision-1", workId: "work-1", documentId: "document-1", contentRef: "blob-1", contentHash: "hash", length: 2, cause: "test", createdAt: now, durableAt: now },
        { kind: "manuscript", id: "manuscript-1", workId: "work-1", documentId: "document-1", currentRevisionId: "revision-1", durableRevisionId: "revision-1", updatedAt: now },
      ];
      await ledger.transaction(async (transaction) => { for (const record of records) transaction.write(record); });
      const setup = new DatabaseSync(databasePath);
      try {
        setup.prepare(`INSERT INTO assistant_context_receipts (
          id,schema_version,request_id,work_id,conversation_id,capability,destination_id,
          read_ranges_json,transmitted_ranges_json,read_character_count,
          transmitted_character_count,grant_ids_json,created_at
        ) VALUES ('receipt-1',1,'request-1','work-1','conversation-1','narrative.digest',
          'provider-1','[]','[]',2,2,'[]',?)`).run(now);
      } finally { setup.close(); }
      const manifest = {
        schemaVersion: 1,
        scope: { kind: "document", documentId: "document-1" },
        promptVersion: "eum-narrative-digest-v1",
        documents: [{ documentId: "document-1", documentRevisionId: "revision-1" }],
        eventBlocks: [], characters: [{ entityId: "character-1", revision: 1 }],
        characterRelations: [], loreEntries: [], continuityThreads: [], characterKnowledge: [],
      };
      await ledger.transaction(async (transaction) => transaction.write({
        kind: "narrativeDigest", id: "digest-1", schemaVersion: 1, workId: "work-1",
        scopeKind: "document", scopeDocumentId: "document-1",
        scopeFirstCharacterId: null, scopeSecondCharacterId: null,
        sourceManifest: manifest, sourceManifestHash: "sha256:hash", text: "윤서는 기록했다.",
        providerId: "provider-1", modelId: "model-1", promptVersion: "eum-narrative-digest-v1",
        contextReceiptId: "receipt-1", createdAt: now,
        documents: [{ documentId: "document-1", documentRevisionId: "revision-1", orderIndex: 0 }],
      }));
      const audit = new DatabaseSync(databasePath);
      try {
        expect(audit.prepare(`SELECT text,source_manifest_hash AS hash FROM narrative_digests`).get())
          .toEqual({ text: "윤서는 기록했다.", hash: "sha256:hash" });
        expect(audit.prepare(`SELECT document_revision_id AS revision FROM narrative_digest_documents`).get())
          .toEqual({ revision: "revision-1" });
        expect(() => audit.prepare(`UPDATE narrative_digests SET text='변조'`).run()).toThrow(/immutable/u);
        expect(() => audit.prepare(`DELETE FROM narrative_digest_documents`).run()).toThrow(/immutable/u);
        expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally { audit.close(); }
    } finally {
      ledger.close(); await rm(root, { recursive: true, force: true });
    }
  });
});
