export const CANON_REVIEW_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS assistant_canon_review_candidates (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      request_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      source_from INTEGER NOT NULL CHECK (source_from >= 0),
      source_to INTEGER NOT NULL CHECK (source_to > source_from),
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      context_receipt_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('ready', 'stale', 'completed', 'superseded')
      ),
      UNIQUE (work_id, id),
      UNIQUE (work_id, request_id),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id)
        REFERENCES documents (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_document_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, context_receipt_id)
        REFERENCES assistant_context_receipts (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_canon_review_candidates_work_status_idx
      ON assistant_canon_review_candidates (work_id, status, updated_at, id)
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_canon_review_items (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      target_kind TEXT NOT NULL CHECK (
        target_kind IN ('character', 'character-relation', 'lore-entry')
      ),
      operation TEXT NOT NULL CHECK (
        operation IN ('create', 'update', 'unresolved')
      ),
      target_hint TEXT NOT NULL,
      target_id TEXT,
      matching_target_ids_json TEXT NOT NULL,
      expected_target_revision INTEGER CHECK (expected_target_revision > 0),
      assertion_basis TEXT NOT NULL CHECK (
        assertion_basis IN ('explicit-evidence', 'model-inference')
      ),
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      applied_target_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, candidate_id, id),
      CHECK (
        (operation = 'update' AND target_id IS NOT NULL AND expected_target_revision IS NOT NULL) OR
        (operation <> 'update' AND target_id IS NULL AND expected_target_revision IS NULL)
      ),
      CHECK (status = 'approved' OR applied_target_id IS NULL),
      FOREIGN KEY (work_id, candidate_id)
        REFERENCES assistant_canon_review_candidates (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_canon_review_items_candidate_status_idx
      ON assistant_canon_review_items (work_id, candidate_id, status, id)
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_canon_review_field_changes (
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      selected INTEGER NOT NULL CHECK (selected IN (0, 1)),
      order_index INTEGER NOT NULL CHECK (order_index >= 0),
      PRIMARY KEY (work_id, candidate_id, item_id, field_name),
      UNIQUE (work_id, candidate_id, item_id, order_index),
      FOREIGN KEY (work_id, candidate_id, item_id)
        REFERENCES assistant_canon_review_items (work_id, candidate_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_canon_review_evidence (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      source_from INTEGER NOT NULL CHECK (source_from >= 0),
      source_to INTEGER NOT NULL CHECK (source_to > source_from),
      exact_text TEXT NOT NULL,
      anchor_id TEXT,
      order_index INTEGER NOT NULL CHECK (order_index >= 0),
      UNIQUE (work_id, candidate_id, item_id, id),
      UNIQUE (work_id, candidate_id, item_id, order_index),
      FOREIGN KEY (work_id, candidate_id, item_id)
        REFERENCES assistant_canon_review_items (work_id, candidate_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id)
        REFERENCES documents (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_document_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, anchor_id)
        REFERENCES anchors (work_id, document_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_canon_review_evidence_item_idx
      ON assistant_canon_review_evidence (work_id, candidate_id, item_id, order_index)
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_canon_review_decision_receipts (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
      outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'noop', 'rejected')),
      target_kind TEXT CHECK (
        target_kind IN ('character', 'character-relation', 'lore-entry')
      ),
      target_id TEXT,
      target_revision_before INTEGER CHECK (target_revision_before > 0),
      target_revision_after INTEGER CHECK (target_revision_after > 0),
      selected_fields_json TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, candidate_id, item_id),
      CHECK ((target_kind IS NULL) = (target_id IS NULL)),
      FOREIGN KEY (work_id, candidate_id, item_id)
        REFERENCES assistant_canon_review_items (work_id, candidate_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_canon_review_decisions_candidate_idx
      ON assistant_canon_review_decision_receipts (work_id, candidate_id, created_at)
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_canon_review_decisions_no_update
    BEFORE UPDATE ON assistant_canon_review_decision_receipts
    BEGIN
      SELECT RAISE(ABORT, 'assistant_canon_review_decision_receipts is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_canon_review_decisions_no_delete
    BEFORE DELETE ON assistant_canon_review_decision_receipts
    BEGIN
      SELECT RAISE(ABORT, 'assistant_canon_review_decision_receipts is immutable');
    END
  `,
]);

export const CANON_REVIEW_SCHEMA_SQL =
  `${CANON_REVIEW_SCHEMA_STATEMENTS.join(";\n")};\n`;
