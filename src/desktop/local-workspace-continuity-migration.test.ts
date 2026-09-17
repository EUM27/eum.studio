import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  CONTINUITY_MIGRATION_DEFINITION_BYTES,
  CONTINUITY_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceContinuityIfNeeded,
} from "./local-workspace-continuity-migration";

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
    targetSchemaVersion: 19,
  });
}

function createSchema18(databasePath: string) {
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
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE (id)
      ) STRICT;
      CREATE TABLE documents (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE document_revisions (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, document_id TEXT NOT NULL,
        UNIQUE (work_id, document_id, id),
        FOREIGN KEY (work_id, document_id) REFERENCES documents (work_id, id)
      ) STRICT;
      CREATE TABLE anchors (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, document_id TEXT NOT NULL,
        UNIQUE (work_id, document_id, id),
        FOREIGN KEY (work_id, document_id) REFERENCES documents (work_id, id)
      ) STRICT;
      CREATE TABLE characters (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE character_relations (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE lore_entries (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE event_blocks (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE plot_threads (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE foreshadow_lines (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE scene_identities (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE assistant_context_permission_grants (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL CHECK (schema_version = 1),
        revision INTEGER NOT NULL CHECK (revision > 0),
        work_id TEXT NOT NULL,
        conversation_id TEXT,
        capability TEXT NOT NULL CHECK (capability IN (
          'vocabulary-lookup', 'lore-review', 'character.extract',
          'scene.extract', 'canon.review', 'publishing-operations'
        )),
        destination_id TEXT NOT NULL,
        local_scope TEXT NOT NULL,
        external_scope TEXT NOT NULL,
        duration TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        consumed_at TEXT,
        UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE assistant_context_receipts (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL CHECK (schema_version = 1),
        request_id TEXT NOT NULL,
        work_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        capability TEXT NOT NULL CHECK (capability IN (
          'vocabulary-lookup', 'lore-review', 'character.extract',
          'scene.extract', 'canon.review', 'publishing-operations'
        )),
        destination_id TEXT NOT NULL,
        read_ranges_json TEXT NOT NULL,
        transmitted_ranges_json TEXT NOT NULL,
        read_character_count INTEGER NOT NULL,
        transmitted_character_count INTEGER NOT NULL,
        grant_ids_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (work_id, request_id),
        UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE assistant_canon_review_candidates (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        retired_at TEXT,
        request_id TEXT NOT NULL,
        work_id TEXT NOT NULL,
        source_document_id TEXT NOT NULL,
        source_document_revision_id TEXT NOT NULL,
        source_from INTEGER NOT NULL,
        source_to INTEGER NOT NULL,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        context_receipt_id TEXT NOT NULL,
        status TEXT NOT NULL,
        UNIQUE (work_id, id),
        FOREIGN KEY (work_id, context_receipt_id)
          REFERENCES assistant_context_receipts (work_id, id)
      ) STRICT;
      INSERT INTO storage_ledger_identity VALUES ('eum-studio-ledger-sha256-v1', 18);
      INSERT INTO works VALUES ('work-1', 4, '2026-08-29T00:00:00.000Z', NULL);
      INSERT INTO documents VALUES ('document-1', 'work-1');
      INSERT INTO document_revisions VALUES ('revision-1', 'work-1', 'document-1');
      INSERT INTO characters VALUES (
        'character-1', 'work-1', 2, '2026-08-29T00:00:00.000Z', NULL
      );
      INSERT INTO character_relations VALUES (
        'relation-1', 'work-1', 1, '2026-08-29T00:00:00.000Z', NULL
      );
      INSERT INTO lore_entries VALUES (
        'lore-1', 'work-1', 3, '2026-08-29T00:00:00.000Z', NULL
      );
      INSERT INTO event_blocks VALUES ('event-1', 'work-1');
      INSERT INTO plot_threads VALUES ('plot-1', 'work-1');
      INSERT INTO foreshadow_lines VALUES ('foreshadow-1', 'work-1');
      INSERT INTO scene_identities VALUES ('scene-1', 'work-1');
      INSERT INTO assistant_context_permission_grants VALUES (
        'grant-1', 1, 1, 'work-1', 'conversation-1', 'canon.review',
        'provider-1', 'selection', 'selection', 'conversation',
        '2026-08-29T00:00:00.000Z', NULL, NULL
      );
      INSERT INTO assistant_context_receipts VALUES (
        'receipt-1', 1, 'request-1', 'work-1', 'conversation-1',
        'canon.review', 'provider-1', '[]', '[]', 0, 0,
        '["grant-1"]', '2026-08-29T00:00:01.000Z'
      );
      INSERT INTO assistant_canon_review_candidates VALUES (
        'canon-candidate-1', 1, 1, '2026-08-29T00:00:02.000Z',
        '2026-08-29T00:00:02.000Z', NULL, 'canon-request-1', 'work-1',
        'document-1', 'revision-1', 0, 1, 'provider-1', 'model-1',
        'eum-canon-review-v1', 'receipt-1', 'ready'
      );
      PRAGMA user_version = 18;
    `);
  } finally {
    database.close();
  }
}

describe("local workspace continuity migration", () => {
  it("preserves schema 18 context and Canon rows while adding Gate 2 ledgers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-continuity-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    createSchema18(databasePath);
    try {
      await expect(migrateLocalWorkspaceContinuityIfNeeded(profile(databasePath)))
        .resolves.toBe(true);
      await expect(migrateLocalWorkspaceContinuityIfNeeded(profile(databasePath)))
        .resolves.toBe(false);
      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 19 });
        expect(migrated.prepare(`
          SELECT status, context_receipt_id AS "contextReceiptId"
          FROM assistant_canon_review_candidates WHERE id = 'canon-candidate-1'
        `).get()).toEqual({ status: "ready", contextReceiptId: "receipt-1" });
        migrated.prepare(`
          INSERT INTO assistant_context_permission_grants (
            id, schema_version, revision, work_id, conversation_id, capability,
            destination_id, local_scope, external_scope, duration, created_at,
            revoked_at, consumed_at
          ) VALUES (?, 1, 1, ?, ?, 'continuity.review', ?, 'selection',
            'selection', 'conversation', ?, NULL, NULL)
        `).run(
          "grant-continuity",
          "work-1",
          "conversation-1",
          "provider-1",
          "2026-08-29T00:00:03.000Z",
        );
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM sqlite_master
          WHERE type = 'table' AND (
            name LIKE 'continuity_thread%' OR
            name LIKE 'assistant_continuity_review_%'
          )
        `).get()).toEqual({ count: 8 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM migration_receipts
          WHERE migration_id = 'local-workspace-continuity-v18-to-v19'
        `).get()).toEqual({ count: 1 });
        expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed migration definition checksum", () => {
    expect(createHash("sha256")
      .update(CONTINUITY_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(CONTINUITY_MIGRATION_DEFINITION_CHECKSUM);
  });
});

