const CONTINUITY_KINDS_SQL = [
  "'promise'",
  "'open-question'",
  "'temporary-state'",
  "'inventory'",
  "'location'",
  "'injury'",
  "'relationship-state'",
  "'constraint'",
  "'other'",
].join(", ");

const SUBJECT_KINDS_SQL = [
  "'character'",
  "'character-relation'",
  "'lore-entry'",
  "'event-block'",
  "'plot-thread'",
  "'foreshadow-line'",
  "'scene'",
].join(", ");

const SUBJECT_VALIDATION_SQL = `
  SELECT CASE
    WHEN NEW.entity_kind = 'character' AND NOT EXISTS (
      SELECT 1 FROM characters WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject Character is outside Work')
    WHEN NEW.entity_kind = 'character-relation' AND NOT EXISTS (
      SELECT 1 FROM character_relations
      WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject CharacterRelation is outside Work')
    WHEN NEW.entity_kind = 'lore-entry' AND NOT EXISTS (
      SELECT 1 FROM lore_entries WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject LoreEntry is outside Work')
    WHEN NEW.entity_kind = 'event-block' AND NOT EXISTS (
      SELECT 1 FROM event_blocks WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject EventBlock is outside Work')
    WHEN NEW.entity_kind = 'plot-thread' AND NOT EXISTS (
      SELECT 1 FROM plot_threads WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject PlotThread is outside Work')
    WHEN NEW.entity_kind = 'foreshadow-line' AND NOT EXISTS (
      SELECT 1 FROM foreshadow_lines WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject ForeshadowLine is outside Work')
    WHEN NEW.entity_kind = 'scene' AND NOT EXISTS (
      SELECT 1 FROM scene_identities WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'continuity subject Scene is outside Work')
  END
`;

export const CONTINUITY_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS continuity_threads (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN (${CONTINUITY_KINDS_SQL})),
      title TEXT NOT NULL,
      note TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
      opened_at TEXT NOT NULL,
      resolved_at TEXT,
      UNIQUE (work_id, id),
      CHECK ((status = 'open') = (resolved_at IS NULL)),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS continuity_threads_work_status_idx
      ON continuity_threads (work_id, status, updated_at, id)
  `,
  `
    CREATE TABLE IF NOT EXISTS continuity_thread_entity_refs (
      work_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      entity_kind TEXT NOT NULL CHECK (entity_kind IN (${SUBJECT_KINDS_SQL})),
      entity_id TEXT NOT NULL,
      order_index INTEGER NOT NULL CHECK (order_index >= 0),
      PRIMARY KEY (work_id, thread_id, entity_kind, entity_id),
      UNIQUE (work_id, thread_id, order_index),
      FOREIGN KEY (work_id, thread_id)
        REFERENCES continuity_threads (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TRIGGER IF NOT EXISTS continuity_thread_refs_validate_insert
    BEFORE INSERT ON continuity_thread_entity_refs
    BEGIN
      ${SUBJECT_VALIDATION_SQL};
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS continuity_thread_refs_validate_update
    BEFORE UPDATE OF work_id, entity_kind, entity_id
    ON continuity_thread_entity_refs
    BEGIN
      ${SUBJECT_VALIDATION_SQL};
    END
  `,
  `
    CREATE TABLE IF NOT EXISTS continuity_thread_evidence (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('opened', 'resolution')),
      source_document_id TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      source_from INTEGER NOT NULL CHECK (source_from >= 0),
      source_to INTEGER NOT NULL CHECK (source_to > source_from),
      exact_text TEXT NOT NULL,
      anchor_id TEXT NOT NULL,
      order_index INTEGER NOT NULL CHECK (order_index >= 0),
      created_at TEXT NOT NULL,
      UNIQUE (work_id, thread_id, phase, order_index),
      FOREIGN KEY (work_id, thread_id)
        REFERENCES continuity_threads (work_id, id) ON DELETE RESTRICT,
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
    CREATE INDEX IF NOT EXISTS continuity_thread_evidence_thread_idx
      ON continuity_thread_evidence (work_id, thread_id, phase, order_index)
  `,
  `
    CREATE TABLE IF NOT EXISTS continuity_thread_history (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      transition_kind TEXT NOT NULL CHECK (
        transition_kind IN ('created', 'updated', 'resolved', 'dismissed')
      ),
      revision_before INTEGER CHECK (revision_before > 0),
      revision_after INTEGER NOT NULL CHECK (revision_after > 0),
      resolution_mode TEXT CHECK (resolution_mode IN ('manual', 'evidence')),
      reason TEXT NOT NULL,
      evidence_anchor_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, thread_id, revision_after),
      CHECK ((transition_kind = 'created') = (revision_before IS NULL)),
      CHECK (revision_before IS NULL OR revision_after = revision_before + 1),
      FOREIGN KEY (work_id, thread_id)
        REFERENCES continuity_threads (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TRIGGER IF NOT EXISTS continuity_thread_history_no_update
    BEFORE UPDATE ON continuity_thread_history
    BEGIN
      SELECT RAISE(ABORT, 'continuity_thread_history is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS continuity_thread_history_no_delete
    BEFORE DELETE ON continuity_thread_history
    BEGIN
      SELECT RAISE(ABORT, 'continuity_thread_history is immutable');
    END
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_continuity_review_candidates (
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
    CREATE INDEX IF NOT EXISTS assistant_continuity_review_candidates_work_idx
      ON assistant_continuity_review_candidates (work_id, status, updated_at, id)
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_continuity_review_items (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      assertion_basis TEXT NOT NULL CHECK (
        assertion_basis IN ('explicit-evidence', 'model-inference')
      ),
      thread_kind TEXT NOT NULL CHECK (thread_kind IN (${CONTINUITY_KINDS_SQL})),
      title TEXT NOT NULL,
      note TEXT NOT NULL,
      subject_refs_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      potential_duplicate_thread_ids_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      applied_thread_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, candidate_id, id),
      CHECK ((status = 'approved') = (applied_thread_id IS NOT NULL)),
      FOREIGN KEY (work_id, candidate_id)
        REFERENCES assistant_continuity_review_candidates (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, applied_thread_id)
        REFERENCES continuity_threads (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_continuity_review_items_candidate_idx
      ON assistant_continuity_review_items (work_id, candidate_id, status, id)
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_continuity_review_evidence (
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
        REFERENCES assistant_continuity_review_items (work_id, candidate_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_document_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, anchor_id)
        REFERENCES anchors (work_id, document_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_continuity_review_decisions (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
      outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'rejected')),
      thread_id TEXT,
      thread_revision_after INTEGER CHECK (thread_revision_after > 0),
      source_document_revision_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, candidate_id, item_id),
      CHECK ((outcome = 'applied') = (thread_id IS NOT NULL)),
      CHECK ((thread_id IS NULL) = (thread_revision_after IS NULL)),
      FOREIGN KEY (work_id, candidate_id, item_id)
        REFERENCES assistant_continuity_review_items (work_id, candidate_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, thread_id)
        REFERENCES continuity_threads (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_continuity_review_decisions_no_update
    BEFORE UPDATE ON assistant_continuity_review_decisions
    BEGIN
      SELECT RAISE(ABORT, 'assistant_continuity_review_decisions is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_continuity_review_decisions_no_delete
    BEFORE DELETE ON assistant_continuity_review_decisions
    BEGIN
      SELECT RAISE(ABORT, 'assistant_continuity_review_decisions is immutable');
    END
  `,
]);

export const CONTINUITY_SCHEMA_SQL =
  `${CONTINUITY_SCHEMA_STATEMENTS.join(";\n")};\n`;

