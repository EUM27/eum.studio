import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  PUBLISHING_FORM_MIGRATION_DEFINITION_BYTES,
  PUBLISHING_FORM_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspacePublishingFormsIfNeeded,
} from "./local-workspace-publishing-form-migration";

function profile(databasePath: string) {
  return parsePoc3StorageOpenProfile({
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
    targetSchemaVersion: 25,
  });
}

function createSchema24Fixture(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE storage_ledger_identity(
        checksum_identity TEXT PRIMARY KEY,
        target_schema_version INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE migration_receipts(
        id TEXT PRIMARY KEY,
        migration_id TEXT UNIQUE NOT NULL,
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
      CREATE TABLE works(id TEXT PRIMARY KEY) STRICT;
      CREATE TABLE publishing_partners(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,retired_at TEXT,
        name TEXT NOT NULL,submission_method TEXT NOT NULL,
        required_length TEXT NOT NULL,source_ids_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE publishing_submissions(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,work_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,submission_package_id TEXT NOT NULL,
        status TEXT NOT NULL,source_ids_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE publishing_contracts(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,work_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,status TEXT NOT NULL,source_ids_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE publishing_publications(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,work_id TEXT NOT NULL,
        contract_id TEXT,status TEXT NOT NULL,source_ids_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE publishing_settlements(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,work_id TEXT NOT NULL,
        publication_id TEXT NOT NULL,review_status TEXT NOT NULL,
        source_ids_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE publishing_payments(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,work_id TEXT NOT NULL,
        settlement_id TEXT,match_status TEXT NOT NULL,source_ids_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE publishing_sources(
        id TEXT PRIMARY KEY,revision INTEGER NOT NULL,source_kind TEXT NOT NULL,
        label TEXT NOT NULL,imported_fields_json TEXT NOT NULL
      ) STRICT;
      INSERT INTO storage_ledger_identity
        VALUES('eum-studio-ledger-sha256-v1',24);
      INSERT INTO works VALUES('work-1');
      INSERT INTO publishing_partners
        VALUES('partner-1',3,NULL,'기존 투고처','이메일','3화','[]');
      PRAGMA user_version=24;
    `);
  } finally {
    database.close();
  }
}

describe("publishing form migration", () => {
  it("adds template and response ledgers without changing existing publishing data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-publishing-form-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    createSchema24Fixture(databasePath);
    try {
      await expect(migrateLocalWorkspacePublishingFormsIfNeeded(profile(databasePath)))
        .resolves.toBe(true);
      await expect(migrateLocalWorkspacePublishingFormsIfNeeded(profile(databasePath)))
        .resolves.toBe(false);
      const database = new DatabaseSync(databasePath);
      try {
        expect(database.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 25 });
        expect(database.prepare(`
          SELECT name,revision,required_length AS requiredLength
          FROM publishing_partners WHERE id='partner-1'
        `).get()).toEqual({
          name: "기존 투고처",
          revision: 3,
          requiredLength: "3화",
        });
        expect(database.prepare(`
          SELECT
            (SELECT COUNT(*) FROM publishing_form_templates) AS templates,
            (SELECT COUNT(*) FROM publishing_form_responses) AS responses,
            (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations
        `).get()).toEqual({ templates: 0, responses: 0, foreignKeyViolations: 0 });
      } finally {
        database.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed migration definition", () => {
    expect(createHash("sha256")
      .update(PUBLISHING_FORM_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(PUBLISHING_FORM_MIGRATION_DEFINITION_CHECKSUM);
  });
});
