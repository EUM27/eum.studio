import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceCharacterRelationsIfNeeded } from "./local-workspace-character-relation-migration";

describe("local workspace character relation migration", () => {
  it("preserves v6 characters and adds Work-scoped relation references", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-character-relation-migration-"),
    );
    const databasePath = path.join(rootDirectoryPath, "workspace.sqlite3");
    const firstWorkId = randomUUID();
    const secondWorkId = randomUUID();
    const firstCharacterId = randomUUID();
    const secondCharacterId = randomUUID();
    const createdAt = "2026-08-17T00:00:00.000Z";
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
        CREATE TABLE characters (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          retired_at TEXT,
          work_id TEXT NOT NULL,
          name TEXT NOT NULL,
          aliases_json TEXT NOT NULL,
          role TEXT NOT NULL,
          summary TEXT NOT NULL,
          appearance TEXT NOT NULL,
          personality TEXT NOT NULL,
          speech TEXT NOT NULL,
          goal TEXT NOT NULL,
          conflict TEXT NOT NULL,
          note TEXT NOT NULL,
          UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        ) STRICT;
      `);
      database.prepare(
        "INSERT INTO storage_ledger_identity VALUES (?, 6)",
      ).run("eum-studio-ledger-sha256-v1");
      database.prepare("INSERT INTO works VALUES (?)").run(firstWorkId);
      database.prepare("INSERT INTO works VALUES (?)").run(secondWorkId);
      const insertCharacter = database.prepare(`
        INSERT INTO characters VALUES (
          ?, 6, 1, ?, ?, NULL, ?, ?, '[]', '', '', '', '', '', '', '', ''
        )
      `);
      insertCharacter.run(
        firstCharacterId,
        createdAt,
        createdAt,
        firstWorkId,
        "윤서",
      );
      insertCharacter.run(
        secondCharacterId,
        createdAt,
        createdAt,
        secondWorkId,
        "재헌",
      );
      database.exec("PRAGMA user_version = 6");
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
        targetSchemaVersion: 7,
      });
      await expect(
        migrateLocalWorkspaceCharacterRelationsIfNeeded(profile),
      ).resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      migrated.exec("PRAGMA foreign_keys = ON");
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 7,
        });
        expect(migrated.prepare(
          "SELECT name, aliases_json AS aliasesJson FROM characters WHERE id = ?",
        ).get(firstCharacterId)).toEqual({ name: "윤서", aliasesJson: "[]" });
        expect(migrated.prepare(
          "SELECT COUNT(*) AS count FROM character_relations",
        ).get()).toEqual({ count: 0 });
        expect(() => migrated.prepare(`
          INSERT INTO character_relations VALUES (
            ?, 7, 1, ?, ?, NULL, NULL, ?, ?, ?, '동료', ''
          )
        `).run(
          randomUUID(),
          createdAt,
          createdAt,
          firstWorkId,
          firstCharacterId,
          secondCharacterId,
        )).toThrow(/FOREIGN KEY/u);
        expect(migrated.prepare(
          "SELECT COUNT(*) AS count FROM pragma_foreign_key_check",
        ).get()).toEqual({ count: 0 });
      } finally {
        migrated.close();
      }
    } finally {
      await rm(rootDirectoryPath, { force: true, recursive: true });
    }
  });
});
