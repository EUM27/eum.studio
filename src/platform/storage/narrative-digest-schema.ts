export const NARRATIVE_DIGEST_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS narrative_digests (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      scope_kind TEXT NOT NULL CHECK (scope_kind IN ('work','document','scene','character','relationship')),
      scope_document_id TEXT,
      scope_scene_id TEXT,
      scope_first_character_id TEXT,
      scope_second_character_id TEXT,
      source_manifest_json TEXT NOT NULL,
      source_manifest_hash TEXT NOT NULL,
      text TEXT NOT NULL CHECK (length(trim(text)) > 0),
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      context_receipt_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      CHECK (
        (scope_kind='work' AND scope_document_id IS NULL AND scope_scene_id IS NULL AND scope_first_character_id IS NULL AND scope_second_character_id IS NULL) OR
        (scope_kind='document' AND scope_document_id IS NOT NULL AND scope_scene_id IS NULL AND scope_first_character_id IS NULL AND scope_second_character_id IS NULL) OR
        (scope_kind='scene' AND scope_document_id IS NOT NULL AND scope_scene_id IS NOT NULL AND scope_first_character_id IS NULL AND scope_second_character_id IS NULL) OR
        (scope_kind='character' AND scope_document_id IS NULL AND scope_scene_id IS NULL AND scope_first_character_id IS NOT NULL AND scope_second_character_id IS NULL) OR
        (scope_kind='relationship' AND scope_document_id IS NULL AND scope_scene_id IS NULL AND scope_first_character_id IS NOT NULL AND scope_second_character_id IS NOT NULL AND scope_first_character_id<>scope_second_character_id)
      ),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scope_document_id) REFERENCES documents(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scope_scene_id) REFERENCES scene_identities(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scope_first_character_id) REFERENCES characters(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scope_second_character_id) REFERENCES characters(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,context_receipt_id)
        REFERENCES assistant_context_receipts(work_id,id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE IF NOT EXISTS narrative_digest_scene_sources (
      work_id TEXT NOT NULL,
      digest_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_revision_id TEXT NOT NULL,
      from_offset INTEGER NOT NULL CHECK (from_offset>=0),
      to_offset INTEGER NOT NULL CHECK (to_offset>from_offset),
      text_hash TEXT NOT NULL CHECK (length(trim(text_hash))>0),
      source_fingerprint TEXT NOT NULL CHECK (length(trim(source_fingerprint))>0),
      trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('scene-transition','scene-split','episode-transition','manual')),
      PRIMARY KEY (work_id,digest_id),
      UNIQUE (work_id,source_fingerprint),
      FOREIGN KEY (work_id,digest_id) REFERENCES narrative_digests(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scene_id) REFERENCES scene_identities(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,document_id,document_revision_id)
        REFERENCES document_revisions(work_id,document_id,id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS narrative_digests_work_scope_idx
      ON narrative_digests(work_id,scope_kind,created_at,id)
  `,
  `
    CREATE TABLE IF NOT EXISTS narrative_digest_documents (
      work_id TEXT NOT NULL,
      digest_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_revision_id TEXT NOT NULL,
      order_index INTEGER NOT NULL CHECK (order_index>=0),
      PRIMARY KEY (work_id,digest_id,document_id),
      UNIQUE (work_id,digest_id,order_index),
      FOREIGN KEY (work_id,digest_id) REFERENCES narrative_digests(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,document_id,document_revision_id)
        REFERENCES document_revisions(work_id,document_id,id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TRIGGER IF NOT EXISTS narrative_digests_no_update
    BEFORE UPDATE ON narrative_digests
    BEGIN SELECT RAISE(ABORT,'narrative_digests is immutable'); END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS narrative_digests_no_delete
    BEFORE DELETE ON narrative_digests
    BEGIN SELECT RAISE(ABORT,'narrative_digests is immutable'); END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS narrative_digest_documents_no_update
    BEFORE UPDATE ON narrative_digest_documents
    BEGIN SELECT RAISE(ABORT,'narrative_digest_documents is immutable'); END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS narrative_digest_documents_no_delete
    BEFORE DELETE ON narrative_digest_documents
    BEGIN SELECT RAISE(ABORT,'narrative_digest_documents is immutable'); END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS narrative_digest_scene_sources_no_update
    BEFORE UPDATE ON narrative_digest_scene_sources
    BEGIN SELECT RAISE(ABORT,'narrative_digest_scene_sources is immutable'); END
  `,
  `
    CREATE TRIGGER IF NOT EXISTS narrative_digest_scene_sources_no_delete
    BEFORE DELETE ON narrative_digest_scene_sources
    BEGIN SELECT RAISE(ABORT,'narrative_digest_scene_sources is immutable'); END
  `,
]);

export const NARRATIVE_DIGEST_SCHEMA_SQL =
  `${NARRATIVE_DIGEST_SCHEMA_STATEMENTS.join(";\n")};\n`;
