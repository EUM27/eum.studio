import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceSceneExtractionIfNeeded } from "./local-workspace-scene-extraction-migration";

describe("local workspace scene extraction migration", () => {
  it("preserves v7 permission, character Candidate, and relation rows", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-extraction-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = randomUUID();
    const documentId = randomUUID();
    const firstCharacterId = randomUUID();
    const secondCharacterId = randomUUID();
    const receiptId = randomUUID();
    const now = "2026-08-17T00:00:00.000Z";
    const database = new DatabaseSync(databasePath);
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE storage_ledger_identity (
          checksum_identity TEXT PRIMARY KEY,
          target_schema_version INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE migration_receipts (
          id TEXT PRIMARY KEY, migration_id TEXT NOT NULL UNIQUE,
          from_schema_version INTEGER NOT NULL, to_schema_version INTEGER NOT NULL,
          migration_checksum_identity TEXT NOT NULL,
          migration_checksum_value TEXT NOT NULL, before_checksum_value TEXT NOT NULL,
          after_checksum_value TEXT NOT NULL, started_at TEXT NOT NULL,
          completed_at TEXT NOT NULL, progress_receipt_json TEXT NOT NULL
        ) STRICT;
        CREATE TABLE works (id TEXT PRIMARY KEY) STRICT;
        CREATE TABLE documents (
          id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE characters (
          id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL, created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, retired_at TEXT, work_id TEXT NOT NULL,
          name TEXT NOT NULL, aliases_json TEXT NOT NULL, role TEXT NOT NULL,
          summary TEXT NOT NULL, appearance TEXT NOT NULL, personality TEXT NOT NULL,
          speech TEXT NOT NULL, goal TEXT NOT NULL, conflict TEXT NOT NULL,
          note TEXT NOT NULL, UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE character_relations (
          id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL, created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, retired_at TEXT, retirement_reason TEXT,
          work_id TEXT NOT NULL, from_character_id TEXT NOT NULL,
          to_character_id TEXT NOT NULL, kind TEXT NOT NULL,
          description TEXT NOT NULL, UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id),
          FOREIGN KEY (work_id, from_character_id) REFERENCES characters (work_id, id),
          FOREIGN KEY (work_id, to_character_id) REFERENCES characters (work_id, id)
        ) STRICT;
        CREATE TABLE assistant_context_permission_grants (
          id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          revision INTEGER NOT NULL CHECK (revision > 0), work_id TEXT NOT NULL,
          conversation_id TEXT, capability TEXT NOT NULL CHECK (
            capability IN ('vocabulary-lookup', 'lore-review', 'character.extract')
          ), destination_id TEXT NOT NULL, local_scope TEXT NOT NULL,
          external_scope TEXT NOT NULL, duration TEXT NOT NULL,
          created_at TEXT NOT NULL, revoked_at TEXT, consumed_at TEXT,
          UNIQUE (work_id, id), FOREIGN KEY (work_id) REFERENCES works (id)
        ) STRICT;
        CREATE TABLE assistant_context_receipts (
          id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          request_id TEXT NOT NULL, work_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL, capability TEXT NOT NULL CHECK (
            capability IN ('vocabulary-lookup', 'lore-review', 'character.extract')
          ), destination_id TEXT NOT NULL, read_ranges_json TEXT NOT NULL,
          transmitted_ranges_json TEXT NOT NULL, read_character_count INTEGER NOT NULL,
          transmitted_character_count INTEGER NOT NULL, grant_ids_json TEXT NOT NULL,
          created_at TEXT NOT NULL, UNIQUE (work_id, request_id), UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id)
        ) STRICT;
        CREATE TABLE assistant_character_extraction_candidates (
          id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL,
          request_id TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL,
          work_id TEXT NOT NULL, source_document_id TEXT NOT NULL,
          source_document_revision_id TEXT NOT NULL, source_from INTEGER NOT NULL,
          source_to INTEGER NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL,
          prompt_version TEXT NOT NULL, status TEXT NOT NULL, items_json TEXT NOT NULL,
          context_receipt_id TEXT NOT NULL, created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id),
          FOREIGN KEY (work_id, source_document_id) REFERENCES documents (work_id, id),
          FOREIGN KEY (work_id, context_receipt_id)
            REFERENCES assistant_context_receipts (work_id, id)
        ) STRICT;
      `);
      database.prepare("INSERT INTO storage_ledger_identity VALUES (?, 7)")
        .run("eum-studio-ledger-sha256-v1");
      database.prepare("INSERT INTO works VALUES (?)").run(workId);
      database.prepare("INSERT INTO documents VALUES (?, ?)").run(documentId, workId);
      const insertCharacter = database.prepare(`
        INSERT INTO characters VALUES (?, 7, 1, ?, ?, NULL, ?, ?, '[]', '', '', '', '', '', '', '', '')
      `);
      insertCharacter.run(firstCharacterId, now, now, workId, "윤서");
      insertCharacter.run(secondCharacterId, now, now, workId, "재헌");
      database.prepare(`
        INSERT INTO character_relations VALUES (?, 7, 1, ?, ?, NULL, NULL, ?, ?, ?, '동료', '')
      `).run(randomUUID(), now, now, workId, firstCharacterId, secondCharacterId);
      const grantId = randomUUID();
      database.prepare(`
        INSERT INTO assistant_context_permission_grants
        VALUES (?, 1, 1, ?, ?, 'character.extract', ?, 'selection', 'selection', 'once', ?, NULL, NULL)
      `).run(grantId, workId, randomUUID(), "provider-a", now);
      database.prepare(`
        INSERT INTO assistant_context_receipts
        VALUES (?, 1, ?, ?, ?, 'character.extract', ?, '[]', '[]', 0, 0, ?, ?)
      `).run(receiptId, randomUUID(), workId, randomUUID(), "provider-a", JSON.stringify([grantId]), now);
      database.prepare(`
        INSERT INTO assistant_character_extraction_candidates
        VALUES (?, 1, ?, 1, ?, ?, ?, 0, 1, 'provider-a', 'model-a',
          'character-extraction-v1', 'completed', '[]', ?, ?, ?)
      `).run(randomUUID(), randomUUID(), workId, documentId, randomUUID(), receiptId, now, now);
      database.exec("PRAGMA user_version = 7");
    } finally {
      database.close();
    }

    try {
      const profile = parsePoc3StorageOpenProfile({
        databasePath,
        checksumIdentity: "eum-studio-ledger-sha256-v1",
        requestedSettings: {
          journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
          synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
          foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
        },
        targetSchemaVersion: 8,
      });
      await expect(migrateLocalWorkspaceSceneExtractionIfNeeded(profile)).resolves.toBe(true);
      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({ user_version: 8 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM assistant_character_extraction_candidates
        `).get()).toEqual({ count: 1 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM character_relations
        `).get()).toEqual({ count: 1 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM assistant_scene_extraction_candidates
        `).get()).toEqual({ count: 0 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM pragma_foreign_key_check
        `).get()).toEqual({ count: 0 });
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
