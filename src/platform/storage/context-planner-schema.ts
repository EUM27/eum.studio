const ENTITY_KINDS_SQL = [
  "'character'", "'character-relation'", "'lore-entry'", "'event-block'",
  "'plot-thread'", "'foreshadow-line'", "'scene'", "'continuity-thread'",
  "'character-knowledge'",
].join(", ");

const CAPABILITIES_SQL = [
  "'vocabulary-lookup'", "'lore-review'", "'character.extract'",
  "'scene.extract'", "'canon.review'", "'continuity.review'",
  "'narrative.digest'",
  "'publishing-operations'",
].join(", ");

const POLICY_REF_VALIDATION_SQL = `
  SELECT CASE
    WHEN NEW.entity_kind = 'character' AND NOT EXISTS (
      SELECT 1 FROM characters WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy Character is outside Work')
    WHEN NEW.entity_kind = 'character-relation' AND NOT EXISTS (
      SELECT 1 FROM character_relations WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy CharacterRelation is outside Work')
    WHEN NEW.entity_kind = 'lore-entry' AND NOT EXISTS (
      SELECT 1 FROM lore_entries WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy LoreEntry is outside Work')
    WHEN NEW.entity_kind = 'event-block' AND NOT EXISTS (
      SELECT 1 FROM event_blocks WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy EventBlock is outside Work')
    WHEN NEW.entity_kind = 'plot-thread' AND NOT EXISTS (
      SELECT 1 FROM plot_threads WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy PlotThread is outside Work')
    WHEN NEW.entity_kind = 'foreshadow-line' AND NOT EXISTS (
      SELECT 1 FROM foreshadow_lines WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy ForeshadowLine is outside Work')
    WHEN NEW.entity_kind = 'scene' AND NOT EXISTS (
      SELECT 1 FROM scene_identities WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy Scene is outside Work')
    WHEN NEW.entity_kind = 'continuity-thread' AND NOT EXISTS (
      SELECT 1 FROM continuity_threads WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy ContinuityThread is outside Work')
    WHEN NEW.entity_kind = 'character-knowledge' AND NOT EXISTS (
      SELECT 1 FROM character_knowledge WHERE work_id = NEW.work_id AND id = NEW.entity_id
    ) THEN RAISE(ABORT, 'context policy CharacterKnowledge is outside Work')
  END
`;

export const CONTEXT_PLANNER_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS assistant_entity_context_policies (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      entity_kind TEXT NOT NULL CHECK (entity_kind IN (${ENTITY_KINDS_SQL})),
      entity_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('required', 'relevant', 'withheld')),
      UNIQUE (work_id, id),
      UNIQUE (work_id, entity_kind, entity_id),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_entity_context_policies_work_idx
      ON assistant_entity_context_policies (work_id, mode, entity_kind, entity_id)
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_context_policy_ref_validate_insert
    BEFORE INSERT ON assistant_entity_context_policies
    BEGIN
      ${POLICY_REF_VALIDATION_SQL};
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_context_policy_ref_validate_update
    BEFORE UPDATE OF work_id, entity_kind, entity_id
    ON assistant_entity_context_policies
    BEGIN
      ${POLICY_REF_VALIDATION_SQL};
    END
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_context_manifests (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      receipt_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      entries_json TEXT NOT NULL,
      excluded_json TEXT NOT NULL,
      estimated_token_count INTEGER NOT NULL CHECK (estimated_token_count >= 0),
      created_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      UNIQUE (work_id, receipt_id),
      FOREIGN KEY (work_id, receipt_id)
        REFERENCES assistant_context_receipts (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_context_manifests_work_idx
      ON assistant_context_manifests (work_id, created_at, id)
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_context_manifests_no_update
    BEFORE UPDATE ON assistant_context_manifests
    BEGIN
      SELECT RAISE(ABORT, 'assistant_context_manifests is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_context_manifests_no_delete
    BEFORE DELETE ON assistant_context_manifests
    BEGIN
      SELECT RAISE(ABORT, 'assistant_context_manifests is immutable');
    END
  `,
  `
    CREATE TABLE IF NOT EXISTS assistant_context_activities (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      manifest_id TEXT NOT NULL,
      capability TEXT NOT NULL CHECK (capability IN (${CAPABILITIES_SQL})),
      destination_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      plan_duration_ms INTEGER NOT NULL CHECK (plan_duration_ms >= 0),
      authorize_duration_ms INTEGER NOT NULL CHECK (authorize_duration_ms >= 0),
      connector_duration_ms INTEGER NOT NULL CHECK (connector_duration_ms >= 0),
      persist_duration_ms INTEGER NOT NULL CHECK (persist_duration_ms >= 0),
      read_ranges_json TEXT NOT NULL,
      transmitted_ranges_json TEXT NOT NULL,
      read_character_count INTEGER NOT NULL CHECK (read_character_count >= 0),
      transmitted_character_count INTEGER NOT NULL CHECK (transmitted_character_count >= 0),
      candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, receipt_id)
        REFERENCES assistant_context_receipts (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, manifest_id)
        REFERENCES assistant_context_manifests (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS assistant_context_activities_work_idx
      ON assistant_context_activities (work_id, completed_at, id)
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_context_activities_no_update
    BEFORE UPDATE ON assistant_context_activities
    BEGIN
      SELECT RAISE(ABORT, 'assistant_context_activities is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS assistant_context_activities_no_delete
    BEFORE DELETE ON assistant_context_activities
    BEGIN
      SELECT RAISE(ABORT, 'assistant_context_activities is immutable');
    END
  `,
]);

export const CONTEXT_PLANNER_SCHEMA_SQL =
  `${CONTEXT_PLANNER_SCHEMA_STATEMENTS.join(";\n")};\n`;
