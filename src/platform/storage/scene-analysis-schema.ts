export const SCENE_ANALYSIS_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS work_scene_analysis_settings (
      work_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version=1),
      revision INTEGER NOT NULL CHECK (revision>=1),
      enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
      updated_at TEXT NOT NULL,
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE IF NOT EXISTS scene_analysis_runs (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version=1),
      revision INTEGER NOT NULL CHECK (revision>=1),
      work_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      digest_id TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL CHECK (length(trim(source_fingerprint))>0),
      trigger_kind TEXT NOT NULL CHECK (
        trigger_kind IN ('scene-transition','scene-split','episode-transition','manual')
      ),
      lore_status TEXT NOT NULL CHECK (
        lore_status IN (
          'pending','candidate','no-change','login-required',
          'permission-required','context-rejected','failed'
        )
      ),
      canon_candidate_id TEXT,
      attempt_count INTEGER NOT NULL CHECK (attempt_count>=0),
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id,id),
      UNIQUE (work_id,source_fingerprint),
      CHECK (
        (lore_status='candidate' AND canon_candidate_id IS NOT NULL) OR
        (lore_status<>'candidate' AND canon_candidate_id IS NULL)
      ),
      CHECK (
        (lore_status='failed' AND last_error IS NOT NULL AND length(trim(last_error))>0) OR
        (lore_status<>'failed' AND last_error IS NULL)
      ),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scene_id)
        REFERENCES scene_identities(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,digest_id)
        REFERENCES narrative_digests(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,canon_candidate_id)
        REFERENCES assistant_canon_review_candidates(work_id,id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_analysis_runs_work_updated_idx
      ON scene_analysis_runs(work_id,updated_at,id)
  `,
  `
    CREATE TABLE IF NOT EXISTS scene_information_update_batches (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version=1),
      revision INTEGER NOT NULL CHECK (revision>=1),
      work_id TEXT NOT NULL,
      scene_analysis_run_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL,
      packet_hash TEXT NOT NULL,
      previous_packet_hash TEXT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      reviewed_entities_json TEXT NOT NULL,
      digest_id TEXT NOT NULL,
      canon_candidate_id TEXT,
      continuity_candidate_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('complete','partial','failed')),
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id,id),
      UNIQUE (work_id,scene_analysis_run_id),
      UNIQUE (work_id,source_fingerprint),
      UNIQUE (work_id,packet_hash),
      CHECK (
        (status='complete' AND last_error IS NULL) OR
        (status<>'complete' AND last_error IS NOT NULL AND length(trim(last_error))>0)
      ),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scene_analysis_run_id)
        REFERENCES scene_analysis_runs(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scene_id)
        REFERENCES scene_identities(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,digest_id)
        REFERENCES narrative_digests(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,canon_candidate_id)
        REFERENCES assistant_canon_review_candidates(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,continuity_candidate_id)
        REFERENCES assistant_continuity_review_candidates(work_id,id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id,previous_packet_hash)
        REFERENCES scene_information_update_batches(work_id,packet_hash)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_information_update_batches_work_created_idx
      ON scene_information_update_batches(work_id,created_at,id)
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_information_update_batches_scene_created_idx
      ON scene_information_update_batches(work_id,scene_id,created_at,id)
  `,
  `
    CREATE TRIGGER IF NOT EXISTS scene_information_update_batches_no_update
    BEFORE UPDATE ON scene_information_update_batches
    BEGIN
      SELECT RAISE(ABORT, 'scene_information_update_batches is immutable');
    END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS scene_information_update_batches_no_delete
    BEFORE DELETE ON scene_information_update_batches
    BEGIN
      SELECT RAISE(ABORT, 'scene_information_update_batches is immutable');
    END
  `,
]);

export const SCENE_ANALYSIS_RUN_SCHEMA_STATEMENTS = Object.freeze(
  SCENE_ANALYSIS_SCHEMA_STATEMENTS.slice(1, 3),
);

export const WORK_SCENE_ANALYSIS_SETTINGS_SCHEMA_STATEMENTS = Object.freeze(
  SCENE_ANALYSIS_SCHEMA_STATEMENTS.slice(0, 1),
);

export const SCENE_INFORMATION_UPDATE_SCHEMA_STATEMENTS = Object.freeze(
  SCENE_ANALYSIS_SCHEMA_STATEMENTS.slice(3),
);

export const SCENE_ANALYSIS_SCHEMA_SQL =
  `${SCENE_ANALYSIS_SCHEMA_STATEMENTS.join(";\n")};\n`;
