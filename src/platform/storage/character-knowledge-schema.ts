const KNOWLEDGE_STANCES_SQL = [
  "'knows'",
  "'believes'",
  "'suspects'",
  "'denies'",
  "'unaware'",
].join(", ");

const ABOUT_KINDS_SQL = [
  "'character'",
  "'character-relation'",
  "'lore-entry'",
  "'event-block'",
  "'plot-thread'",
  "'foreshadow-line'",
  "'scene'",
  "'continuity-thread'",
  "'character-knowledge'",
].join(", ");

const ABOUT_REF_VALIDATION_SQL = `
  SELECT CASE
    WHEN NEW.entity_kind = 'character' AND NOT EXISTS (
      SELECT 1 FROM characters WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference Character is outside Work')
    WHEN NEW.entity_kind = 'character-relation' AND NOT EXISTS (
      SELECT 1 FROM character_relations
      WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference CharacterRelation is outside Work')
    WHEN NEW.entity_kind = 'lore-entry' AND NOT EXISTS (
      SELECT 1 FROM lore_entries WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference LoreEntry is outside Work')
    WHEN NEW.entity_kind = 'event-block' AND NOT EXISTS (
      SELECT 1 FROM event_blocks WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference EventBlock is outside Work')
    WHEN NEW.entity_kind = 'plot-thread' AND NOT EXISTS (
      SELECT 1 FROM plot_threads WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference PlotThread is outside Work')
    WHEN NEW.entity_kind = 'foreshadow-line' AND NOT EXISTS (
      SELECT 1 FROM foreshadow_lines WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference ForeshadowLine is outside Work')
    WHEN NEW.entity_kind = 'scene' AND NOT EXISTS (
      SELECT 1 FROM scene_identities WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference Scene is outside Work')
    WHEN NEW.entity_kind = 'continuity-thread' AND NOT EXISTS (
      SELECT 1 FROM continuity_threads WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference ContinuityThread is outside Work')
    WHEN NEW.entity_kind = 'character-knowledge' AND NOT EXISTS (
      SELECT 1 FROM character_knowledge WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'knowledge reference CharacterKnowledge is outside Work')
  END
`;

export const CHARACTER_KNOWLEDGE_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS character_knowledge (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      statement TEXT NOT NULL CHECK (length(trim(statement)) > 0),
      stance TEXT NOT NULL CHECK (stance IN (${KNOWLEDGE_STANCES_SQL})),
      truth_status TEXT NOT NULL CHECK (truth_status IN ('true', 'false', 'unknown')),
      status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'retired')),
      supersedes_knowledge_id TEXT,
      superseded_by_knowledge_id TEXT,
      retired_reason TEXT,
      UNIQUE (work_id, id),
      UNIQUE (work_id, supersedes_knowledge_id),
      CHECK (id <> COALESCE(supersedes_knowledge_id, '')),
      CHECK (id <> COALESCE(superseded_by_knowledge_id, '')),
      CHECK (
        (status = 'active' AND superseded_by_knowledge_id IS NULL AND retired_reason IS NULL) OR
        (status = 'superseded' AND superseded_by_knowledge_id IS NOT NULL AND retired_reason IS NULL) OR
        (status = 'retired' AND superseded_by_knowledge_id IS NULL AND retired_reason IS NOT NULL)
      ),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, character_id)
        REFERENCES characters (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, supersedes_knowledge_id)
        REFERENCES character_knowledge (work_id, id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
      FOREIGN KEY (work_id, superseded_by_knowledge_id)
        REFERENCES character_knowledge (work_id, id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS character_knowledge_work_character_status_idx
      ON character_knowledge (work_id, character_id, status, updated_at, id)
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS character_knowledge_active_statement_idx
      ON character_knowledge (work_id, character_id, statement)
      WHERE status = 'active'
  `,
  `
    CREATE TABLE IF NOT EXISTS character_knowledge_entity_refs (
      work_id TEXT NOT NULL,
      knowledge_id TEXT NOT NULL,
      entity_kind TEXT NOT NULL CHECK (entity_kind IN (${ABOUT_KINDS_SQL})),
      entity_id TEXT NOT NULL,
      order_index INTEGER NOT NULL CHECK (order_index >= 0),
      PRIMARY KEY (work_id, knowledge_id, entity_kind, entity_id),
      UNIQUE (work_id, knowledge_id, order_index),
      CHECK (NOT (entity_kind = 'character-knowledge' AND entity_id = knowledge_id)),
      FOREIGN KEY (work_id, knowledge_id)
        REFERENCES character_knowledge (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TRIGGER IF NOT EXISTS character_knowledge_refs_validate_insert
    BEFORE INSERT ON character_knowledge_entity_refs
    BEGIN
      ${ABOUT_REF_VALIDATION_SQL};
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS character_knowledge_refs_validate_update
    BEFORE UPDATE OF work_id, entity_kind, entity_id
    ON character_knowledge_entity_refs
    BEGIN
      ${ABOUT_REF_VALIDATION_SQL};
    END
  `,
  `
    CREATE TABLE IF NOT EXISTS character_knowledge_evidence (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      knowledge_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      source_from INTEGER NOT NULL CHECK (source_from >= 0),
      source_to INTEGER NOT NULL CHECK (source_to > source_from),
      exact_text TEXT NOT NULL,
      anchor_id TEXT NOT NULL,
      order_index INTEGER NOT NULL CHECK (order_index >= 0),
      created_at TEXT NOT NULL,
      UNIQUE (work_id, knowledge_id, order_index),
      FOREIGN KEY (work_id, knowledge_id)
        REFERENCES character_knowledge (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_document_revision_id)
        REFERENCES document_revisions (work_id, document_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, anchor_id)
        REFERENCES anchors (work_id, document_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS character_knowledge_evidence_entry_idx
      ON character_knowledge_evidence (work_id, knowledge_id, order_index)
  `,
  `
    CREATE TABLE IF NOT EXISTS character_knowledge_history (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      knowledge_id TEXT NOT NULL,
      transition_kind TEXT NOT NULL CHECK (
        transition_kind IN ('created', 'updated', 'superseded', 'retired')
      ),
      revision_before INTEGER CHECK (revision_before > 0),
      revision_after INTEGER NOT NULL CHECK (revision_after > 0),
      successor_knowledge_id TEXT,
      reason TEXT NOT NULL,
      evidence_anchor_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, knowledge_id, revision_after),
      CHECK ((transition_kind = 'created') = (revision_before IS NULL)),
      CHECK (revision_before IS NULL OR revision_after = revision_before + 1),
      CHECK ((transition_kind = 'superseded') = (successor_knowledge_id IS NOT NULL)),
      FOREIGN KEY (work_id, knowledge_id)
        REFERENCES character_knowledge (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, successor_knowledge_id)
        REFERENCES character_knowledge (work_id, id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    CREATE TRIGGER IF NOT EXISTS character_knowledge_history_no_update
    BEFORE UPDATE ON character_knowledge_history
    BEGIN
      SELECT RAISE(ABORT, 'character_knowledge_history is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS character_knowledge_history_no_delete
    BEFORE DELETE ON character_knowledge_history
    BEGIN
      SELECT RAISE(ABORT, 'character_knowledge_history is immutable');
    END
  `,
]);

export const CHARACTER_KNOWLEDGE_SCHEMA_SQL =
  `${CHARACTER_KNOWLEDGE_SCHEMA_STATEMENTS.join(";\n")};\n`;
