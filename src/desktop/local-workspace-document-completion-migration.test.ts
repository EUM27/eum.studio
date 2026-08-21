import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { migrateLocalWorkspaceDocumentCompletionIfNeeded } from "./local-workspace-document-completion-migration";
import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

describe("local Document completion migration", () => {
  it("adds an empty completion ledger without changing existing Work or Document rows", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-completion-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    try {
      const workId = randomUUID();
      const documentId = randomUUID();
      const revisionId = randomUUID();
      const changedAt = "2026-08-21T00:00:00.000Z";
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
          CREATE TABLE works (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            retired_at TEXT
          ) STRICT;
          CREATE TABLE documents (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL,
            work_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            retired_at TEXT,
            archived_at TEXT,
            UNIQUE (work_id, id)
          ) STRICT;
          CREATE TABLE document_revisions (
            id TEXT PRIMARY KEY,
            work_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            UNIQUE (work_id, document_id, id)
          ) STRICT;
        `);
        database.prepare("INSERT INTO storage_ledger_identity VALUES (?, 13)")
          .run("eum-studio-ledger-sha256-v1");
        database.prepare("INSERT INTO works VALUES (?, 1, ?, ?, ?, NULL)")
          .run(workId, "작품", changedAt, changedAt);
        database.prepare(`
          INSERT INTO documents
          VALUES (?, 1, ?, ?, ?, ?, NULL, NULL)
        `).run(documentId, workId, "1화", changedAt, changedAt);
        database.prepare("INSERT INTO document_revisions VALUES (?, ?, ?)")
          .run(revisionId, workId, documentId);
        database.exec("PRAGMA user_version = 13");
      } finally {
        database.close();
      }

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
        targetSchemaVersion: 13,
      });

      await expect(migrateLocalWorkspaceDocumentCompletionIfNeeded(profile))
        .resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 14 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count
          FROM pragma_table_info('document_completion_status')
        `).get()).toEqual({ count: 9 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM document_completion_status
        `).get()).toEqual({ count: 0 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count
          FROM pragma_index_list('document_completion_status')
          WHERE name = 'document_completion_status_work_date'
            AND partial = 1
        `).get()).toEqual({ count: 1 });
        expect(migrated.prepare("SELECT title FROM works WHERE id = ?").get(workId))
          .toEqual({ title: "작품" });
        expect(migrated.prepare("SELECT title FROM documents WHERE id = ?").get(documentId))
          .toEqual({ title: "1화" });
        expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
