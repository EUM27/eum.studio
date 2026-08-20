import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceCharacterExtractionIfNeeded } from "./local-workspace-character-extraction-migration";

describe("local workspace character extraction migration", () => {
  it("preserves characters, permissions, receipts, and referencing candidates from v5 to v6", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-character-migration-"),
    );
    const databasePath = path.join(rootDirectoryPath, "workspace.sqlite3");
    const workId = randomUUID();
    const documentId = randomUUID();
    const characterId = randomUUID();
    const grantId = randomUUID();
    const receiptId = randomUUID();
    const requestId = randomUUID();
    const database = new DatabaseSync(databasePath);
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE storage_ledger_identity (
          checksum_identity TEXT PRIMARY KEY,
          target_schema_version INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE migration_receipts (
          id TEXT PRIMARY KEY,
          migration_id TEXT NOT NULL UNIQUE,
          from_schema_version INTEGER NOT NULL,
          to_schema_version INTEGER NOT NULL,
          migration_checksum_identity TEXT NOT NULL,
          migration_checksum_value TEXT NOT NULL,
          before_checksum_value TEXT NOT NULL,
          after_checksum_value TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          progress_receipt_json TEXT NOT NULL
        ) STRICT;
        CREATE TABLE works (id TEXT PRIMARY KEY) STRICT;
        CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE anchors (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          UNIQUE (work_id, document_id, id),
          FOREIGN KEY (work_id, document_id)
            REFERENCES documents (work_id, id)
            ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE characters (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          retired_at TEXT,
          work_id TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          summary TEXT NOT NULL,
          note TEXT NOT NULL,
          UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE assistant_context_permission_grants (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          revision INTEGER NOT NULL CHECK (revision > 0),
          work_id TEXT NOT NULL,
          conversation_id TEXT,
          capability TEXT NOT NULL CHECK (
            capability IN ('vocabulary-lookup', 'lore-review')
          ),
          destination_id TEXT NOT NULL,
          local_scope TEXT NOT NULL CHECK (
            local_scope IN ('none', 'selection', 'paragraph', 'scene', 'chapter', 'work')
          ),
          external_scope TEXT NOT NULL CHECK (
            external_scope IN ('none', 'selection', 'paragraph', 'scene', 'chapter', 'work')
          ),
          duration TEXT NOT NULL CHECK (duration IN ('once', 'conversation', 'work')),
          created_at TEXT NOT NULL,
          revoked_at TEXT,
          consumed_at TEXT,
          UNIQUE (work_id, id),
          CHECK (
            (duration = 'work' AND conversation_id IS NULL) OR
            (duration <> 'work' AND conversation_id IS NOT NULL)
          ),
          CHECK (duration = 'once' OR consumed_at IS NULL),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE assistant_context_receipts (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          request_id TEXT NOT NULL,
          work_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          capability TEXT NOT NULL CHECK (
            capability IN ('vocabulary-lookup', 'lore-review')
          ),
          destination_id TEXT NOT NULL,
          read_ranges_json TEXT NOT NULL,
          transmitted_ranges_json TEXT NOT NULL,
          read_character_count INTEGER NOT NULL CHECK (read_character_count >= 0),
          transmitted_character_count INTEGER NOT NULL CHECK (
            transmitted_character_count >= 0
          ),
          grant_ids_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (work_id, request_id),
          UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
        CREATE TABLE assistant_vocabulary_candidates (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          work_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          destination_id TEXT NOT NULL,
          source_range_json TEXT NOT NULL,
          query_text TEXT NOT NULL,
          occurrences_json TEXT NOT NULL,
          receipt_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT,
          FOREIGN KEY (work_id, receipt_id)
            REFERENCES assistant_context_receipts (work_id, id)
            ON DELETE RESTRICT
        ) STRICT;
      `);
      database.prepare(
        "INSERT INTO storage_ledger_identity VALUES (?, 5)",
      ).run("eum-studio-ledger-sha256-v1");
      database.prepare("INSERT INTO works VALUES (?)").run(workId);
      database.prepare("INSERT INTO documents VALUES (?, ?)").run(
        documentId,
        workId,
      );
      const createdAt = "2026-08-17T00:00:00.000Z";
      database.prepare(`
        INSERT INTO characters VALUES (?, 5, 2, ?, ?, NULL, ?, ?, ?, ?, ?)
      `).run(
        characterId,
        createdAt,
        createdAt,
        workId,
        "윤서",
        "기록자",
        "요약",
        "메모",
      );
      database.prepare(`
        INSERT INTO assistant_context_permission_grants
        VALUES (?, 1, 1, ?, ?, 'lore-review', ?, 'work', 'work',
          'conversation', ?, NULL, NULL)
      `).run(grantId, workId, randomUUID(), "destination-a", createdAt);
      database.prepare(`
        INSERT INTO assistant_context_receipts
        VALUES (?, 1, ?, ?, ?, 'lore-review', ?, '[]', '[]', 0, 0, ?, ?)
      `).run(
        receiptId,
        requestId,
        workId,
        randomUUID(),
        "destination-a",
        JSON.stringify([grantId]),
        createdAt,
      );
      database.prepare(`
        INSERT INTO assistant_vocabulary_candidates
        VALUES (?, 1, ?, ?, ?, ?, ?, '[]', ?, ?)
      `).run(
        randomUUID(),
        workId,
        randomUUID(),
        "destination-a",
        JSON.stringify({
          documentId,
          documentRevisionId: randomUUID(),
          from: 0,
          to: 0,
        }),
        "질문",
        receiptId,
        createdAt,
      );
      database.exec("PRAGMA user_version = 5");
    } finally {
      database.close();
    }

    try {
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
        targetSchemaVersion: 6,
      });
      await expect(
        migrateLocalWorkspaceCharacterExtractionIfNeeded(profile),
      ).resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 6,
        });
        expect(migrated.prepare(`
          SELECT name, aliases_json AS aliasesJson, role, summary, note
          FROM characters WHERE id = ?
        `).get(characterId)).toEqual({
          name: "윤서",
          aliasesJson: "[]",
          role: "기록자",
          summary: "요약",
          note: "메모",
        });
        expect(migrated.prepare(`
          SELECT capability, destination_id AS destinationId
          FROM assistant_context_permission_grants WHERE id = ?
        `).get(grantId)).toEqual({
          capability: "lore-review",
          destinationId: "destination-a",
        });
        expect(migrated.prepare(`
          SELECT capability, destination_id AS destinationId
          FROM assistant_context_receipts WHERE id = ?
        `).get(receiptId)).toEqual({
          capability: "lore-review",
          destinationId: "destination-a",
        });
        expect(migrated.prepare(
          "SELECT COUNT(*) AS count FROM assistant_vocabulary_candidates",
        ).get()).toEqual({ count: 1 });
        expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
        expect(() => migrated.prepare(`
          INSERT INTO assistant_context_permission_grants
          VALUES (?, 1, 1, ?, ?, 'character.extract', ?, 'selection',
            'selection', 'conversation', ?, NULL, NULL)
        `).run(
          randomUUID(),
          workId,
          randomUUID(),
          "chatgpt-a",
          "2026-08-17T00:00:01.000Z",
        )).not.toThrow();
      } finally {
        migrated.close();
      }
    } finally {
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });
});
