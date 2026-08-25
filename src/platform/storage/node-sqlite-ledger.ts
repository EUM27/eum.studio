import type {
  StorageTransaction,
} from "../../application/storage/storage-service";
import type {
  CommitResumeCheckpointWithAnchorsInput,
  ResumeCheckpointWithAnchorsCaptureTransaction,
} from "../../application/checkpoints/capture-resume-checkpoint-with-anchors";
import {
  ResumeCheckpointConflictError,
} from "../../application/checkpoints/capture-resume-checkpoint";
import type {
  AppendRevisionInput,
  RevisionBlobDescriptor,
  RevisionBlobProfile,
  RevisionStore,
} from "../../application/revisions/revision-store";
import type {
  CommitEpisodeRangeMoveInput,
  EpisodeRangeMoveStore,
  EpisodeRangeMoveStoreReceipt,
  UndoEpisodeRangeMoveInput,
} from "../../application/editor/move-range-to-episode";
import {
  BlobContentMismatchError,
} from "../../application/storage/blob-store";
import type {
  BlobAddress,
  BlobMetadata,
  ImmutableBlobStore,
} from "../../application/storage/blob-store";
import type {
  Poc3RequestedSqliteSettings,
  Poc3SqliteReadbackValue,
  Poc3StorageOpenProfile,
  Poc3StorageOpenReceipt,
} from "./node-sqlite-ledger-profile";
import type {
  StorageService,
} from "../../application/storage/storage-service";
import type {
  Poc3AnchorRecord,
  Poc3LedgerRecord,
  Poc3MigrationDecisionRecord,
  Poc3RawPreservedItemRecord,
  Poc3ResumeCheckpointRecord,
} from "../../domain/poc-3-storage-ledger";
import {
  entityId,
} from "../../domain/writing";
import type {
  Anchor,
  AnchorMatchedEvidence,
  AnchorResolutionEvidence,
  AnchorResolutionMethod,
  AnchorStatus,
  ContextReference,
  DocumentRevision,
  EntityId,
  RecordMeta,
  ResumeCheckpoint,
  Work,
} from "../../domain/writing";

type NodeSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
  run(
    ...parameters: readonly unknown[]
  ): unknown;
};

type NodeSqliteDatabase = {
  exec(sql: string): void;
  prepare(
    sql: string,
  ): NodeSqliteStatement;
  close(): void;
};

type NodeSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
  ) => NodeSqliteDatabase;
};

export type NodeSqliteRevisionStoreOptions = {
  readonly blobStore:
    ImmutableBlobStore;
  readonly blobProfile:
    RevisionBlobProfile;
  readonly beforeDatabaseCommit?:
    () => Promise<void>;
};

export type NodeSqliteResumeCheckpointCaptureOptions = {
  readonly beforeDatabaseCommit?:
    () => Promise<void>;
};

const LEDGER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS storage_ledger_identity (
  checksum_identity TEXT PRIMARY KEY,
  target_schema_version INTEGER NOT NULL UNIQUE
) STRICT;

CREATE TABLE IF NOT EXISTS studios (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  locale TEXT NOT NULL,
  timezone TEXT NOT NULL,
  settings_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  studio_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  kind_ref TEXT,
  status_ref TEXT,
  order_key TEXT NOT NULL,
  resume_checkpoint_id TEXT,
  settings_id TEXT NOT NULL,
  custom_fields_json TEXT,
  UNIQUE (id, settings_id),
  FOREIGN KEY (studio_id)
    REFERENCES studios (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (id, settings_id)
    REFERENCES work_settings (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (id, resume_checkpoint_id)
    REFERENCES resume_checkpoints (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS activity_policies (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  idle_timeout INTEGER NOT NULL,
  navigation_grace INTEGER NOT NULL,
  hidden_window_policy TEXT NOT NULL,
  activity_class_rules_json TEXT NOT NULL,
  auto_start_enabled INTEGER NOT NULL,
  auto_resume_from_idle INTEGER NOT NULL,
  recovery_policy TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS focus_policies (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  phase_definitions_json TEXT NOT NULL,
  background_policy TEXT NOT NULL,
  music_start_policy TEXT NOT NULL,
  completion_policy TEXT NOT NULL,
  visibility TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS scene_rule_sets (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  boundary_rules_json TEXT NOT NULL,
  normalization_policy TEXT NOT NULL CHECK (
    normalization_policy IN ('preserve', 'trim-line-whitespace')
  ),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_settings (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL UNIQUE,
  scene_rule_set_id TEXT NOT NULL,
  activity_policy_id TEXT NOT NULL,
  focus_policy_id TEXT NOT NULL,
  rail_preferences_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, activity_policy_id)
    REFERENCES activity_policies (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, focus_policy_id)
    REFERENCES focus_policies (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_favorites (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  favorited_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_covers (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  media_type TEXT NOT NULL,
  content_base64 TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS app_settings (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  default_episode_characters INTEGER NOT NULL
    CHECK (default_episode_characters > 0),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS work_manuscript_layout_settings (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS work_music_settings (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_inspiration_settings (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS manuscript_preflight_settings (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_continuous_reading_progress (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  document_id TEXT,
  document_revision_id TEXT,
  text_offset INTEGER,
  updated_at TEXT NOT NULL,
  CHECK (
    (document_id IS NULL AND document_revision_id IS NULL AND text_offset IS NULL) OR
    (document_id IS NOT NULL AND document_revision_id IS NOT NULL AND text_offset >= 0)
  ),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, document_id, document_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_records_goals (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  goals_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_readthrough_settings (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  entries_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_quick_memos (
  work_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  memo_text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_context_permission_grants (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  conversation_id TEXT,
  capability TEXT NOT NULL
    CHECK (capability IN (
      'vocabulary-lookup', 'lore-review', 'character.extract', 'scene.extract'
    )),
  destination_id TEXT NOT NULL,
  local_scope TEXT NOT NULL
    CHECK (local_scope IN ('none', 'selection', 'paragraph', 'scene', 'chapter', 'work')),
  external_scope TEXT NOT NULL
    CHECK (external_scope IN ('none', 'selection', 'paragraph', 'scene', 'chapter', 'work')),
  duration TEXT NOT NULL
    CHECK (duration IN ('once', 'conversation', 'work')),
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  consumed_at TEXT,
  UNIQUE (work_id, id),
  CHECK (
    (duration = 'work' AND conversation_id IS NULL) OR
    (duration <> 'work' AND conversation_id IS NOT NULL)
  ),
  CHECK (duration = 'once' OR consumed_at IS NULL),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_context_receipts (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  capability TEXT NOT NULL
    CHECK (capability IN (
      'vocabulary-lookup', 'lore-review', 'character.extract', 'scene.extract'
    )),
  destination_id TEXT NOT NULL,
  read_ranges_json TEXT NOT NULL,
  transmitted_ranges_json TEXT NOT NULL,
  read_character_count INTEGER NOT NULL CHECK (read_character_count >= 0),
  transmitted_character_count INTEGER NOT NULL
    CHECK (transmitted_character_count >= 0),
  grant_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, request_id),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_connector_receipts (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  connector_kind TEXT NOT NULL,
  operation TEXT NOT NULL
    CHECK (operation IN ('vocabulary-suggestions', 'setting-review')),
  request_fingerprint TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  result_state TEXT NOT NULL CHECK (result_state = 'succeeded'),
  UNIQUE (work_id, request_id),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_vocabulary_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  source_range_json TEXT NOT NULL,
  query_text TEXT NOT NULL,
  occurrences_json TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, receipt_id)
    REFERENCES assistant_context_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_vocabulary_suggestion_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  source_range_json TEXT NOT NULL,
  suggestions_json TEXT NOT NULL,
  note_text TEXT NOT NULL,
  connector_receipt_id TEXT NOT NULL,
  context_receipt_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, context_receipt_id)
    REFERENCES assistant_context_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, connector_receipt_id)
    REFERENCES assistant_connector_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_external_setting_review_receipts (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  source_range_json TEXT NOT NULL,
  transmitted_settings_json TEXT NOT NULL,
  transmitted_setting_count INTEGER NOT NULL CHECK (transmitted_setting_count >= 0),
  connector_receipt_id TEXT NOT NULL,
  context_receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, request_id),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, connector_receipt_id)
    REFERENCES assistant_connector_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, context_receipt_id)
    REFERENCES assistant_context_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_external_setting_review_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  proposals_json TEXT NOT NULL,
  review_notes_json TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, receipt_id)
    REFERENCES assistant_external_setting_review_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_notation_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  source_range_json TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  regex_error TEXT,
  receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, receipt_id)
    REFERENCES assistant_context_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_setting_review_receipts (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  reviewed_settings_json TEXT NOT NULL,
  transmitted_setting_count INTEGER NOT NULL
    CHECK (transmitted_setting_count = 0),
  grant_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, request_id),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_setting_review_findings (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  finding_kind TEXT NOT NULL CHECK (finding_kind = 'duplicate'),
  setting_kind TEXT NOT NULL
    CHECK (setting_kind IN ('character', 'plot', 'foreshadow')),
  duplicate_label TEXT NOT NULL,
  references_json TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, receipt_id)
    REFERENCES assistant_setting_review_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS assistant_setting_conflict_findings (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  work_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  finding_kind TEXT NOT NULL CHECK (finding_kind = 'conflict'),
  setting_kind TEXT NOT NULL
    CHECK (setting_kind IN ('character', 'plot', 'foreshadow')),
  duplicate_label TEXT NOT NULL,
  field_name TEXT NOT NULL,
  references_json TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (work_id, receipt_id)
    REFERENCES assistant_setting_review_receipts (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_schedule_items (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('task', 'routine', 'dday')),
  label TEXT NOT NULL,
  schedule_date TEXT NOT NULL,
  schedule_time TEXT,
  workload_json TEXT,
  completed_at TEXT,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS work_routine_completions (
  work_id TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (work_id, routine_id, occurrence_date),
  FOREIGN KEY (work_id, routine_id)
    REFERENCES work_schedule_items (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS document_folders (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  parent_folder_id TEXT,
  title TEXT NOT NULL,
  order_key TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, parent_folder_id)
    REFERENCES document_folders (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  folder_id TEXT,
  document_kind_ref TEXT,
  title TEXT NOT NULL,
  order_key TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  scene_rule_set_id TEXT,
  archived_at TEXT,
  UNIQUE (work_id, id),
  UNIQUE (work_id, id, manuscript_id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, folder_id)
    REFERENCES document_folders (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, id, manuscript_id)
    REFERENCES manuscripts (work_id, document_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS blob_manifests (
  blob_ref TEXT PRIMARY KEY,
  checksum_identity TEXT NOT NULL,
  checksum_value TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  media_type TEXT,
  original_name TEXT,
  FOREIGN KEY (checksum_identity)
    REFERENCES storage_ledger_identity (checksum_identity)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS raw_preserved_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_snapshot_id TEXT NOT NULL,
  source_collection TEXT NOT NULL,
  source_identity TEXT NOT NULL,
  source_occurrence INTEGER NOT NULL,
  serialization_identity TEXT NOT NULL,
  raw_bytes BLOB NOT NULL,
  checksum_identity TEXT NOT NULL,
  checksum_value TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  mapper_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (
    batch_id,
    source_snapshot_id,
    source_collection,
    source_identity,
    source_occurrence
  )
) STRICT;

CREATE TABLE IF NOT EXISTS migration_decisions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_snapshot_id TEXT NOT NULL,
  source_collection TEXT NOT NULL,
  source_identity TEXT NOT NULL,
  command_kind TEXT NOT NULL,
  decision_payload_json TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  actor_ref TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS document_revisions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  parent_revision_id TEXT,
  content_ref TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  length INTEGER NOT NULL,
  change_set_ref TEXT,
  cause TEXT NOT NULL,
  created_at TEXT NOT NULL,
  durable_at TEXT NOT NULL,
  UNIQUE (work_id, document_id, id),
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    parent_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (content_ref)
    REFERENCES blob_manifests (blob_ref)
    ON DELETE RESTRICT,
  FOREIGN KEY (change_set_ref)
    REFERENCES blob_manifests (blob_ref)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS document_completion_status (
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  completed_at TEXT,
  completed_date TEXT,
  completed_time_zone TEXT,
  completed_document_revision_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (work_id, document_id),
  CHECK (
    (
      completed_at IS NULL AND
      completed_date IS NULL AND
      completed_time_zone IS NULL AND
      completed_document_revision_id IS NULL
    ) OR (
      completed_at IS NOT NULL AND
      completed_date IS NOT NULL AND
      completed_time_zone IS NOT NULL AND
      completed_document_revision_id IS NOT NULL
    )
  ),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    completed_document_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS document_completion_status_work_date
ON document_completion_status (
  work_id,
  completed_date
)
WHERE completed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS manuscripts (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL UNIQUE,
  current_revision_id TEXT NOT NULL,
  durable_revision_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, document_id, id),
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    work_id,
    document_id,
    current_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    work_id,
    document_id,
    durable_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS anchors (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  origin_revision_id TEXT NOT NULL,
  resolved_revision_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  exact_quote TEXT NOT NULL,
  prefix_context TEXT NOT NULL,
  suffix_context TEXT NOT NULL,
  quote_hash TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  lineage_ref TEXT,
  status TEXT NOT NULL,
  resolution_evidence_json TEXT NOT NULL,
  UNIQUE (work_id, id),
  UNIQUE (work_id, document_id, id),
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    origin_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    resolved_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS document_revision_editor_states (
  revision_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  editor_state_json TEXT NOT NULL,
  FOREIGN KEY (work_id, document_id, revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS scene_overrides (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  base_rule_set_revision INTEGER NOT NULL,
  note TEXT,
  UNIQUE (work_id, id),
  UNIQUE (work_id, document_id, id),
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS scene_override_anchors (
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  scene_override_id TEXT NOT NULL,
  anchor_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (scene_override_id, anchor_id),
  UNIQUE (scene_override_id, order_index),
  FOREIGN KEY (work_id, document_id, scene_override_id)
    REFERENCES scene_overrides (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id, anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS scene_identities (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS scene_episode_segments (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  anchor_id TEXT NOT NULL,
  UNIQUE (work_id, id),
  UNIQUE (work_id, scene_id, anchor_id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, scene_id)
    REFERENCES scene_identities (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id, anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS scene_episode_segments_active_scene_idx
ON scene_episode_segments (work_id, scene_id, document_id)
WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS episode_range_moves (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  undone_at TEXT,
  work_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  target_document_id TEXT NOT NULL,
  from_offset INTEGER NOT NULL CHECK (from_offset >= 0),
  to_offset INTEGER NOT NULL CHECK (to_offset > from_offset),
  placement TEXT NOT NULL CHECK (placement IN ('start', 'end')),
  source_before_revision_id TEXT NOT NULL,
  target_before_revision_id TEXT NOT NULL,
  source_after_revision_id TEXT NOT NULL,
  target_after_revision_id TEXT NOT NULL,
  created_scene_ids_json TEXT NOT NULL,
  scene_ids_json TEXT NOT NULL,
  created_segment_ids_json TEXT NOT NULL,
  retired_segment_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'undone')),
  UNIQUE (work_id, id),
  CHECK (source_document_id <> target_document_id),
  CHECK (
    (status = 'active' AND undone_at IS NULL) OR
    (status = 'undone' AND undone_at IS NOT NULL)
  ),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, target_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_before_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, target_document_id, target_before_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_after_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, target_document_id, target_after_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS episode_range_moves_active_documents_idx
ON episode_range_moves (
  work_id,
  source_document_id,
  target_document_id,
  status
);

CREATE TABLE IF NOT EXISTS scene_event_overrides (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  event_block_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('include', 'exclude')),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, event_block_id)
    REFERENCES event_blocks (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS scene_event_overrides_active_pair_idx
  ON scene_event_overrides (work_id, scene_key, event_block_id)
  WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS range_groups (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS range_group_anchors (
  work_id TEXT NOT NULL,
  range_group_id TEXT NOT NULL,
  anchor_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (
    range_group_id,
    anchor_id
  ),
  UNIQUE (
    range_group_id,
    order_index
  ),
  FOREIGN KEY (work_id, range_group_id)
    REFERENCES range_groups (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, anchor_id)
    REFERENCES anchors (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS event_blocks (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  parent_event_id TEXT,
  title TEXT NOT NULL,
  note TEXT,
  stage_ref TEXT,
  order_key TEXT NOT NULL,
  collapsed INTEGER NOT NULL,
  relation_ids_json TEXT,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, parent_event_id)
    REFERENCES event_blocks (work_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS event_sources (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  event_block_id TEXT NOT NULL,
  range_group_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'supporting')),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, event_block_id)
    REFERENCES event_blocks (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, range_group_id)
    REFERENCES range_groups (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS event_sources_event_block_active_idx
  ON event_sources (work_id, event_block_id, retired_at);

CREATE TABLE IF NOT EXISTS fragments (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  kind_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)),
  use_count INTEGER NOT NULL CHECK (use_count >= 0),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, source_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS characters (
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
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS character_evidence (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, character_id, source_anchor_id),
  FOREIGN KEY (work_id, character_id)
    REFERENCES characters (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS character_relations (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  retirement_reason TEXT CHECK (
    retirement_reason IN ('user', 'character-retired')
  ),
  work_id TEXT NOT NULL,
  from_character_id TEXT NOT NULL,
  to_character_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE (work_id, id),
  CHECK ((retired_at IS NULL) = (retirement_reason IS NULL)),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, from_character_id)
    REFERENCES characters (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, to_character_id)
    REFERENCES characters (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS character_relations_work_active_idx
  ON character_relations (
    work_id,
    from_character_id,
    to_character_id,
    retired_at
  );

CREATE TABLE IF NOT EXISTS assistant_character_extraction_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_document_revision_id TEXT NOT NULL,
  source_from INTEGER NOT NULL CHECK (source_from >= 0),
  source_to INTEGER NOT NULL CHECK (source_to > source_from),
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'stale', 'completed')),
  items_json TEXT NOT NULL,
  context_receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, context_receipt_id)
    REFERENCES assistant_context_receipts (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS assistant_character_extraction_work_status_idx
  ON assistant_character_extraction_candidates (work_id, status, updated_at);

CREATE TABLE IF NOT EXISTS assistant_character_generation_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  brief_json TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'completed')),
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS assistant_character_generation_work_status_idx
  ON assistant_character_generation_candidates (work_id, status, updated_at);

CREATE TABLE IF NOT EXISTS assistant_scene_extraction_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_document_revision_id TEXT NOT NULL,
  source_from INTEGER NOT NULL CHECK (source_from >= 0),
  source_to INTEGER NOT NULL CHECK (source_to > source_from),
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'stale', 'completed')),
  scenes_json TEXT NOT NULL,
  boundaries_json TEXT NOT NULL,
  context_receipt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, context_receipt_id)
    REFERENCES assistant_context_receipts (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS assistant_scene_extraction_work_status_idx
  ON assistant_scene_extraction_candidates (work_id, status, updated_at);

CREATE TABLE IF NOT EXISTS scene_annotations (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_revision_id TEXT NOT NULL,
  source_candidate_id TEXT NOT NULL,
  source_scene_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  pov_character_id TEXT,
  location TEXT NOT NULL,
  time TEXT NOT NULL,
  character_ids_json TEXT NOT NULL,
  goal TEXT NOT NULL,
  conflict TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  UNIQUE (work_id, scene_key),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id, document_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_candidate_id)
    REFERENCES assistant_scene_extraction_candidates (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, pov_character_id)
    REFERENCES characters (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS scene_annotations_work_document_idx
  ON scene_annotations (work_id, document_id, updated_at);

CREATE TABLE IF NOT EXISTS scene_music_queue_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  scene_annotation_id TEXT NOT NULL,
  scene_annotation_revision INTEGER NOT NULL
    CHECK (scene_annotation_revision > 0),
  provider_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ready', 'selected', 'superseded')),
  options_json TEXT NOT NULL,
  selected_option_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  CHECK (
    (status = 'ready' AND selected_option_id IS NULL)
    OR
    (status IN ('selected', 'superseded') AND selected_option_id IS NOT NULL)
  ),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, scene_annotation_id)
    REFERENCES scene_annotations (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS scene_music_queue_work_scene_status_idx
  ON scene_music_queue_candidates (work_id, scene_key, status, updated_at);

CREATE TABLE IF NOT EXISTS assistant_scene_draft_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  request_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  work_id TEXT NOT NULL,
  plot_thread_id TEXT NOT NULL,
  plot_thread_revision INTEGER NOT NULL CHECK (plot_thread_revision > 0),
  target_document_id TEXT NOT NULL,
  target_document_revision_id TEXT NOT NULL,
  insertion_offset INTEGER NOT NULL CHECK (insertion_offset >= 0),
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL CHECK (prompt_version = 'scene-draft-v1'),
  context_json TEXT NOT NULL,
  generated_text TEXT NOT NULL,
  draft_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'applied')),
  applied_document_revision_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  CHECK (
    (status = 'ready' AND applied_document_revision_id IS NULL)
    OR
    (status = 'applied' AND applied_document_revision_id IS NOT NULL)
  ),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, plot_thread_id)
    REFERENCES plot_threads (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, target_document_id, target_document_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, target_document_id, applied_document_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS assistant_scene_draft_work_plot_status_idx
  ON assistant_scene_draft_candidates (
    work_id,
    plot_thread_id,
    status,
    updated_at
  );

CREATE TABLE IF NOT EXISTS lore_entries (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS lore_entry_evidence (
  work_id TEXT NOT NULL,
  lore_entry_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (work_id, lore_entry_id, source_anchor_id),
  FOREIGN KEY (work_id, lore_entry_id)
    REFERENCES lore_entries (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS lore_entry_history (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  work_id TEXT NOT NULL,
  lore_entry_id TEXT NOT NULL,
  entry_revision INTEGER NOT NULL CHECK (entry_revision >= 1),
  change_kind TEXT NOT NULL
    CHECK (change_kind IN ('created', 'updated', 'evidence-added', 'retired')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  evidence_anchor_ids_json TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  UNIQUE (work_id, lore_entry_id, entry_revision),
  FOREIGN KEY (work_id, lore_entry_id)
    REFERENCES lore_entries (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS lore_entry_history_no_update
BEFORE UPDATE ON lore_entry_history
BEGIN
  SELECT RAISE(ABORT, 'lore_entry_history is immutable');
END;

CREATE TRIGGER IF NOT EXISTS lore_entry_history_no_delete
BEFORE DELETE ON lore_entry_history
BEGIN
  SELECT RAISE(ABORT, 'lore_entry_history is immutable');
END;

CREATE TABLE IF NOT EXISTS lore_foreshadow_links (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  lore_entry_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  unlinked_at TEXT,
  unlink_reason TEXT
    CHECK (
      unlink_reason IS NULL OR
      unlink_reason IN ('user', 'lore-retired', 'foreshadow-retired')
    ),
  CHECK ((unlinked_at IS NULL) = (unlink_reason IS NULL)),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, lore_entry_id)
    REFERENCES lore_entries (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, line_id)
    REFERENCES foreshadow_lines (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_lore_foreshadow_link
ON lore_foreshadow_links (work_id, lore_entry_id, line_id)
WHERE unlinked_at IS NULL AND retired_at IS NULL;

CREATE TABLE IF NOT EXISTS lore_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_document_revision_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  exact_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user', 'assistant')),
  certainty TEXT NOT NULL CHECK (certainty IN ('explicit', 'inferred')),
  proposal_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_lore_entry_id TEXT,
  reviewed_at TEXT,
  CHECK ((status = 'pending') = (reviewed_at IS NULL)),
  CHECK ((status = 'approved') = (approved_lore_entry_id IS NOT NULL)),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, source_document_id, source_anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_document_revision_id)
    REFERENCES document_revisions (work_id, document_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, approved_lore_entry_id)
    REFERENCES lore_entries (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_partners (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  name TEXT NOT NULL,
  parent_partner_id TEXT,
  submission_method TEXT NOT NULL,
  website_url TEXT NOT NULL,
  email TEXT NOT NULL,
  genres_json TEXT NOT NULL,
  required_length TEXT NOT NULL,
  priority TEXT NOT NULL,
  note TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  FOREIGN KEY (parent_partner_id)
    REFERENCES publishing_partners (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS plot_threads (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL,
  summary TEXT NOT NULL,
  note TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS plot_boards (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sequence', 'time-map')),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS plot_lanes (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  work_id TEXT NOT NULL,
  plot_board_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('default', 'main', 'subplot', 'stage', 'custom')
  ),
  order_key TEXT NOT NULL,
  UNIQUE (work_id, id),
  UNIQUE (work_id, plot_board_id, id),
  FOREIGN KEY (work_id, plot_board_id)
    REFERENCES plot_boards (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS plot_lanes_default_idx
  ON plot_lanes (work_id, plot_board_id)
  WHERE kind = 'default';

CREATE TABLE IF NOT EXISTS plot_placements (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  plot_board_id TEXT NOT NULL,
  plot_lane_id TEXT NOT NULL,
  plot_thread_id TEXT NOT NULL,
  order_key TEXT NOT NULL,
  story_time REAL,
  story_time_end REAL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, plot_board_id)
    REFERENCES plot_boards (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, plot_board_id, plot_lane_id)
    REFERENCES plot_lanes (work_id, plot_board_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, plot_thread_id)
    REFERENCES plot_threads (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS plot_placements_active_plot_idx
  ON plot_placements (work_id, plot_board_id, plot_thread_id)
  WHERE retired_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plot_placements_active_order_idx
  ON plot_placements (work_id, plot_board_id, plot_lane_id, order_key)
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS plot_placements_lane_active_idx
  ON plot_placements (work_id, plot_board_id, plot_lane_id, retired_at);

CREATE TABLE IF NOT EXISTS plot_event_links (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  plot_thread_id TEXT NOT NULL,
  event_block_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'supporting')),
  created_from TEXT NOT NULL CHECK (
    created_from IN ('event-to-plot', 'plot-to-event', 'manual-link')
  ),
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, plot_thread_id)
    REFERENCES plot_threads (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, event_block_id)
    REFERENCES event_blocks (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS plot_event_links_active_pair_idx
  ON plot_event_links (work_id, plot_thread_id, event_block_id)
  WHERE retired_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plot_event_links_active_primary_idx
  ON plot_event_links (work_id, plot_thread_id)
  WHERE retired_at IS NULL AND role = 'primary';

CREATE INDEX IF NOT EXISTS plot_event_links_event_active_idx
  ON plot_event_links (work_id, event_block_id, retired_at);

CREATE TABLE IF NOT EXISTS plot_thread_sources (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  plot_thread_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, plot_thread_id)
    REFERENCES plot_threads (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_plot_thread_source
ON plot_thread_sources (work_id, plot_thread_id)
WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS foreshadow_lines (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS foreshadow_points (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  note TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id, line_id)
    REFERENCES foreshadow_lines (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, source_document_id, source_anchor_id)
    REFERENCES anchors (work_id, document_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS resume_checkpoints (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_revision_id TEXT NOT NULL,
  cursor_anchor_id TEXT NOT NULL,
  selection_anchor_id TEXT,
  workspace_mode TEXT NOT NULL,
  context_refs_json TEXT,
  focus_checkpoint_id TEXT,
  music_checkpoint_id TEXT,
  captured_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    work_id,
    document_id,
    document_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    cursor_anchor_id
  )
    REFERENCES anchors (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    selection_anchor_id
  )
    REFERENCES anchors (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS writing_sessions (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  document_id TEXT,
  policy_id TEXT NOT NULL,
  state TEXT NOT NULL,
  mode_ref TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  last_durable_heartbeat_at TEXT NOT NULL,
  start_revision_id TEXT,
  end_revision_id TEXT,
  note TEXT,
  recovery_evidence_json TEXT,
  CHECK (
    document_id IS NOT NULL OR (
      start_revision_id IS NULL AND
      end_revision_id IS NULL
    )
  ),
  UNIQUE (work_id, id),
  UNIQUE (work_id, document_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, policy_id)
    REFERENCES activity_policies (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    start_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    end_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS activity_intervals (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  activity_class TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  document_id TEXT,
  evidence_count INTEGER NOT NULL,
  source TEXT NOT NULL,
  UNIQUE (work_id, session_id, id),
  FOREIGN KEY (work_id, session_id)
    REFERENCES writing_sessions (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, document_id)
    REFERENCES documents (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS activity_interval_event_blocks (
  work_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  activity_interval_id TEXT NOT NULL,
  event_block_id TEXT NOT NULL,
  PRIMARY KEY (
    activity_interval_id,
    event_block_id
  ),
  FOREIGN KEY (
    work_id,
    session_id,
    activity_interval_id
  )
    REFERENCES activity_intervals (
      work_id,
      session_id,
      id
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, event_block_id)
    REFERENCES event_blocks (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS focus_cycles (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  session_id TEXT,
  policy_id TEXT NOT NULL,
  phase_ref TEXT NOT NULL,
  state TEXT NOT NULL,
  pause_reason TEXT,
  target_duration INTEGER NOT NULL,
  started_at TEXT,
  deadline_at TEXT,
  remaining_at_pause INTEGER,
  completed_at TEXT,
  note TEXT,
  music_queue_id TEXT,
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, session_id)
    REFERENCES writing_sessions (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, policy_id)
    REFERENCES focus_policies (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS work_snapshots (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  structure_revision_refs_json TEXT NOT NULL,
  dictionary_revision_refs_json TEXT,
  manifest_hash TEXT NOT NULL,
  label TEXT,
  cause TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS work_snapshot_document_revisions (
  work_id TEXT NOT NULL,
  work_snapshot_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_revision_id TEXT NOT NULL,
  PRIMARY KEY (
    work_snapshot_id,
    document_id
  ),
  FOREIGN KEY (work_id, work_snapshot_id)
    REFERENCES work_snapshots (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    work_id,
    document_id,
    document_revision_id
  )
    REFERENCES document_revisions (
      work_id,
      document_id,
      id
    )
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS submission_packages (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  work_snapshot_id TEXT NOT NULL UNIQUE,
  work_title_snapshot TEXT NOT NULL,
  partner_name_snapshot TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  sealed_at TEXT NOT NULL,
  UNIQUE (work_id, partner_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (partner_id)
    REFERENCES publishing_partners (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, work_snapshot_id)
    REFERENCES work_snapshots (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_submissions (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  submission_package_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_on TEXT,
  responded_on TEXT,
  result TEXT NOT NULL,
  note TEXT NOT NULL,
  card_note TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (partner_id)
    REFERENCES publishing_partners (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, partner_id, submission_package_id)
    REFERENCES submission_packages (work_id, partner_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_contracts (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  submission_id TEXT,
  title TEXT NOT NULL,
  work_title_snapshot TEXT NOT NULL,
  partner_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  signed_on TEXT,
  starts_on TEXT,
  ends_on TEXT,
  rights_scope TEXT NOT NULL,
  advance_amount REAL,
  currency_code TEXT NOT NULL,
  revenue_share_note TEXT NOT NULL,
  note TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (partner_id)
    REFERENCES publishing_partners (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (submission_id)
    REFERENCES publishing_submissions (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_publications (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  contract_id TEXT,
  channel_partner_id TEXT,
  title TEXT NOT NULL,
  work_title_snapshot TEXT NOT NULL,
  channel_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  format TEXT NOT NULL,
  scheduled_on TEXT,
  starts_on TEXT,
  ends_on TEXT,
  published_unit_count INTEGER,
  planned_unit_count INTEGER,
  schedule_note TEXT NOT NULL,
  note TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  UNIQUE (work_id, id),
  CHECK (published_unit_count IS NULL OR published_unit_count >= 0),
  CHECK (planned_unit_count IS NULL OR planned_unit_count >= 0),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, contract_id)
    REFERENCES publishing_contracts (work_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (channel_partner_id)
    REFERENCES publishing_partners (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_settlements (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  publication_id TEXT NOT NULL,
  title TEXT NOT NULL,
  work_title_snapshot TEXT NOT NULL,
  publication_title_snapshot TEXT NOT NULL,
  period_starts_on TEXT,
  period_ends_on TEXT,
  issued_on TEXT,
  review_status TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  reported_amount REAL,
  items_json TEXT NOT NULL,
  note TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, publication_id)
    REFERENCES publishing_publications (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_payments (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  work_id TEXT NOT NULL,
  settlement_id TEXT,
  work_title_snapshot TEXT NOT NULL,
  settlement_title_snapshot TEXT NOT NULL,
  received_on TEXT,
  confirmed_on TEXT,
  amount REAL NOT NULL,
  currency_code TEXT NOT NULL,
  match_status TEXT NOT NULL,
  payer_label TEXT NOT NULL,
  reference TEXT NOT NULL,
  note TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  UNIQUE (work_id, id),
  FOREIGN KEY (work_id)
    REFERENCES works (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (work_id, settlement_id)
    REFERENCES publishing_settlements (work_id, id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_sources (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  source_kind TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT,
  observed_at TEXT,
  authority TEXT NOT NULL,
  imported_fields_json TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS publishing_mail_candidates (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT,
  source_id TEXT NOT NULL UNIQUE,
  source_account_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  received_at TEXT NOT NULL,
  snippet TEXT NOT NULL,
  body_fingerprint TEXT NOT NULL,
  submission_id TEXT,
  match_reason TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  proposed_result TEXT NOT NULL,
  proposed_responded_on TEXT,
  proposed_note TEXT NOT NULL,
  classification_connection_id TEXT,
  classification_model TEXT NOT NULL,
  review_status TEXT NOT NULL,
  UNIQUE (source_account_id, message_id),
  FOREIGN KEY (source_id)
    REFERENCES publishing_sources (id)
    ON DELETE RESTRICT,
  FOREIGN KEY (submission_id)
    REFERENCES publishing_submissions (id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS migration_receipts (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL UNIQUE,
  from_schema_version INTEGER NOT NULL,
  to_schema_version INTEGER NOT NULL,
  migration_checksum_identity TEXT NOT NULL,
  migration_checksum_value TEXT NOT NULL,
  before_checksum_value TEXT NOT NULL,
  after_checksum_value TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  progress_receipt_json TEXT,
  FOREIGN KEY (migration_checksum_identity)
    REFERENCES storage_ledger_identity (checksum_identity)
    ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS document_revisions_reject_update
BEFORE UPDATE ON document_revisions
BEGIN
  SELECT RAISE(
    ABORT,
    'DocumentRevision is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS document_revisions_reject_delete
BEFORE DELETE ON document_revisions
BEGIN
  SELECT RAISE(
    ABORT,
    'DocumentRevision is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS document_revision_editor_states_reject_update
BEFORE UPDATE ON document_revision_editor_states
BEGIN
  SELECT RAISE(
    ABORT,
    'DocumentRevision editor state is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS document_revision_editor_states_reject_delete
BEFORE DELETE ON document_revision_editor_states
BEGIN
  SELECT RAISE(
    ABORT,
    'DocumentRevision editor state is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS work_snapshots_reject_update
BEFORE UPDATE ON work_snapshots
BEGIN
  SELECT RAISE(
    ABORT,
    'WorkSnapshot is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS work_snapshots_reject_delete
BEFORE DELETE ON work_snapshots
BEGIN
  SELECT RAISE(
    ABORT,
    'WorkSnapshot is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS work_snapshot_document_revisions_reject_update
BEFORE UPDATE ON work_snapshot_document_revisions
BEGIN
  SELECT RAISE(
    ABORT,
    'WorkSnapshot manifest is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS work_snapshot_document_revisions_reject_delete
BEFORE DELETE ON work_snapshot_document_revisions
BEGIN
  SELECT RAISE(
    ABORT,
    'WorkSnapshot manifest is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS submission_packages_reject_update
BEFORE UPDATE ON submission_packages
BEGIN
  SELECT RAISE(
    ABORT,
    'SubmissionPackage is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS submission_packages_reject_delete
BEFORE DELETE ON submission_packages
BEGIN
  SELECT RAISE(
    ABORT,
    'SubmissionPackage is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS blob_manifests_reject_update
BEFORE UPDATE ON blob_manifests
BEGIN
  SELECT RAISE(
    ABORT,
    'Blob manifest is immutable'
  );
END;

CREATE TRIGGER IF NOT EXISTS blob_manifests_reject_delete
BEFORE DELETE ON blob_manifests
BEGIN
  SELECT RAISE(
    ABORT,
    'Blob manifest is immutable'
  );
END;
`;

const IDENTITY_ROWS_SQL = `
SELECT
  checksum_identity,
  target_schema_version
FROM storage_ledger_identity
`;

const USER_VERSION_SQL =
  "PRAGMA user_version";

const TABLE_NAMES_SQL = `
SELECT name
FROM sqlite_schema
WHERE
  type = 'table'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name
`;

function loadNodeSqlite(): NodeSqliteModule {
  const loaded =
    process.getBuiltinModule(
      "node:sqlite",
    ) as NodeSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error(
      "node:sqlite is unavailable",
    );
  }
  return loaded;
}

function normalizeRows(
  rows:
    readonly Record<string, unknown>[],
): readonly Readonly<
  Record<
    string,
    Poc3SqliteReadbackValue
  >
>[] {
  return Object.freeze(
    rows.map((row) => {
      const normalized:
        Record<
          string,
          Poc3SqliteReadbackValue
        > = {};
      for (
        const [column, value]
        of Object.entries(row)
      ) {
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "boolean" ||
          (
            typeof value === "number" &&
            Number.isSafeInteger(value)
          )
        ) {
          normalized[column] =
            value;
        } else if (
          typeof value === "bigint" &&
          value <=
            BigInt(
              Number.MAX_SAFE_INTEGER,
            ) &&
          value >=
            BigInt(
              Number.MIN_SAFE_INTEGER,
            )
        ) {
          normalized[column] =
            Number(value);
        } else {
          throw new Error(
            `Unsupported node:sqlite value in ${column}`,
          );
        }
      }
      return Object.freeze(
        normalized,
      );
    }),
  );
}

function queryRows(
  database: NodeSqliteDatabase,
  sql: string,
  parameters:
    readonly unknown[] = [],
): ReturnType<typeof normalizeRows> {
  return normalizeRows(
    database
      .prepare(sql)
      .all(...parameters),
  );
}

function assertSameRows(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (
    JSON.stringify(actual) !==
    JSON.stringify(expected)
  ) {
    throw new Error(
      `${label} readback did not match the caller request`,
    );
  }
}

function applyAndVerifySettings(
  database: NodeSqliteDatabase,
  requested:
    Poc3RequestedSqliteSettings,
): Poc3StorageOpenReceipt[
  "settingReadbacks"
] {
  const entries =
    Object.entries(requested) as [
      keyof Poc3RequestedSqliteSettings,
      Poc3RequestedSqliteSettings[
        keyof Poc3RequestedSqliteSettings
      ],
    ][];
  const readbacks:
    {
      -readonly [
        TSetting in keyof Poc3RequestedSqliteSettings
      ]?: Poc3StorageOpenReceipt[
        "settingReadbacks"
      ][TSetting];
    } = {};
  for (
    const [setting, request]
    of entries
  ) {
    database.exec(
      request.applySql,
    );
    const rows = queryRows(
      database,
      request.verifySql,
    );
    assertSameRows(
      rows,
      request.expectedRows,
      `SQLite ${setting}`,
    );
    readbacks[setting] = rows;
  }
  return Object.freeze(
    readbacks,
  ) as Poc3StorageOpenReceipt[
    "settingReadbacks"
  ];
}

function initializeOrVerifyIdentity(
  database: NodeSqliteDatabase,
  profile: Poc3StorageOpenProfile,
): void {
  const existing = queryRows(
    database,
    IDENTITY_ROWS_SQL,
  );
  if (existing.length === 0) {
    database.exec(
      "BEGIN IMMEDIATE",
    );
    try {
      database
        .prepare(`
          INSERT INTO storage_ledger_identity (
            checksum_identity,
            target_schema_version
          )
          VALUES (?, ?)
        `)
        .run(
          profile.checksumIdentity,
          profile.targetSchemaVersion,
        );
      database.exec(
        `PRAGMA user_version = ${profile.targetSchemaVersion}`,
      );
      const readback = queryRows(
        database,
        USER_VERSION_SQL,
      );
      assertSameRows(
        readback,
        [
          {
            user_version:
              profile
                .targetSchemaVersion,
          },
        ],
        "SQLite schema version",
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return;
  }
  assertSameRows(
    existing,
    [
      {
        checksum_identity:
          profile.checksumIdentity,
        target_schema_version:
          profile.targetSchemaVersion,
      },
    ],
    "SQLite ledger identity",
  );
  assertSameRows(
    queryRows(
      database,
      USER_VERSION_SQL,
    ),
    [
      {
        user_version:
          profile.targetSchemaVersion,
      },
    ],
    "SQLite schema version",
  );
}

function readSchemaTableNames(
  database: NodeSqliteDatabase,
): readonly string[] {
  return Object.freeze(
    queryRows(
      database,
      TABLE_NAMES_SQL,
    ).map((row) => {
      const name = row.name;
      if (
        typeof name !== "string"
      ) {
        throw new Error(
          "SQLite schema returned an invalid table name",
        );
      }
      return name;
    }),
  );
}

function nullable<T>(
  value: T | undefined,
): T | null {
  return value === undefined
    ? null
    : value;
}

function booleanInteger(
  value: boolean,
): number {
  return value ? 1 : 0;
}

function runStatement(
  database: NodeSqliteDatabase,
  sql: string,
  parameters: readonly unknown[],
): void {
  database
    .prepare(sql)
    .run(...parameters);
}

function writeLedgerRecord(
  database: NodeSqliteDatabase,
  record: Poc3LedgerRecord,
): void {
  switch (record.kind) {
    case "studio":
      runStatement(
        database,
        `
          INSERT INTO studios (
            id,
            display_name,
            locale,
            timezone,
            settings_revision,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          nullable(
            record.displayName,
          ),
          record.locale,
          record.timezone,
          record.settingsRevision,
          record.createdAt,
        ],
      );
      return;
    case "work":
      runStatement(
        database,
        `
          INSERT INTO works (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            studio_id,
            title,
            subtitle,
            kind_ref,
            status_ref,
            order_key,
            resume_checkpoint_id,
            settings_id,
            custom_fields_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.studioId,
          record.title,
          nullable(
            record.subtitle,
          ),
          nullable(
            record.kindRef,
          ),
          nullable(
            record.statusRef,
          ),
          record.orderKey,
          nullable(
            record
              .resumeCheckpointId,
          ),
          record.settingsId,
          nullable(
            record
              .customFieldsJson,
          ),
        ],
      );
      return;
    case "activityPolicy":
      runStatement(
        database,
        `
          INSERT INTO activity_policies (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            idle_timeout,
            navigation_grace,
            hidden_window_policy,
            activity_class_rules_json,
            auto_start_enabled,
            auto_resume_from_idle,
            recovery_policy
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          record.idleTimeout,
          record.navigationGrace,
          record
            .hiddenWindowPolicy,
          record
            .activityClassRulesJson,
          booleanInteger(
            record
              .autoStartEnabled,
          ),
          booleanInteger(
            record
              .autoResumeFromIdle,
          ),
          record.recoveryPolicy,
        ],
      );
      return;
    case "focusPolicy":
      runStatement(
        database,
        `
          INSERT INTO focus_policies (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            phase_definitions_json,
            background_policy,
            music_start_policy,
            completion_policy,
            visibility
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          record
            .phaseDefinitionsJson,
          record.backgroundPolicy,
          record.musicStartPolicy,
          record.completionPolicy,
          record.visibility,
        ],
      );
      return;
    case "sceneRuleSet":
      runStatement(
        database,
        `
          INSERT INTO scene_rule_sets (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            display_name,
            boundary_rules_json,
            normalization_policy,
            enabled
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.displayName,
          record.boundaryRulesJson,
          record.normalizationPolicy,
          booleanInteger(record.enabled),
        ],
      );
      return;
    case "sceneRuleSetUpdate":
      {
        const update = database.prepare(`
          UPDATE scene_rule_sets
          SET
            revision = revision + 1,
            updated_at = ?,
            display_name = ?,
            boundary_rules_json = ?,
            normalization_policy = ?,
            enabled = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.updatedAt,
          record.displayName,
          record.boundaryRulesJson,
          record.normalizationPolicy,
          booleanInteger(record.enabled),
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(update.changes) !== 1) {
          throw new Error(`SceneRuleSet revision conflict: ${record.id}`);
        }
      }
      return;
    case "workSettings":
      runStatement(
        database,
        `
          INSERT INTO work_settings (
            id,
            work_id,
            scene_rule_set_id,
            activity_policy_id,
            focus_policy_id,
            rail_preferences_json,
            revision
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.workId,
          record.sceneRuleSetId,
          record.activityPolicyId,
          record.focusPolicyId,
          record
            .railPreferencesJson,
          record.revision,
        ],
      );
      return;
    case "documentFolder":
      runStatement(
        database,
        `
          INSERT INTO document_folders (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            parent_folder_id,
            title,
            order_key
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          nullable(
            record.parentFolderId,
          ),
          record.title,
          record.orderKey,
        ],
      );
      return;
    case "document":
      runStatement(
        database,
        `
          INSERT INTO documents (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            folder_id,
            document_kind_ref,
            title,
            order_key,
            manuscript_id,
            scene_rule_set_id,
            archived_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          nullable(
            record.folderId,
          ),
          nullable(
            record
              .documentKindRef,
          ),
          record.title,
          record.orderKey,
          record.manuscriptId,
          nullable(
            record
              .sceneRuleSetId,
          ),
          nullable(
            record.archivedAt,
          ),
        ],
      );
      return;
    case "blobManifest":
      runStatement(
        database,
        `
          INSERT INTO blob_manifests (
            blob_ref,
            checksum_identity,
            checksum_value,
            byte_length,
            created_at,
            media_type,
            original_name
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.blobRef,
          record.checksumIdentity,
          record.checksumValue,
          record.byteLength,
          record.createdAt,
          nullable(
            record.mediaType,
          ),
          nullable(
            record.originalName,
          ),
        ],
      );
      return;
    case "rawPreservedItem":
      runStatement(
        database,
        `
          INSERT INTO raw_preserved_items (
            id,
            batch_id,
            source_snapshot_id,
            source_collection,
            source_identity,
            source_occurrence,
            serialization_identity,
            raw_bytes,
            checksum_identity,
            checksum_value,
            byte_length,
            mapper_version,
            created_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.batchId,
          record.sourceSnapshotId,
          record.sourceCollection,
          record.sourceIdentity,
          record.sourceOccurrence,
          record.serializationIdentity,
          record.rawBytes,
          record.checksumIdentity,
          record.checksumValue,
          record.byteLength,
          record.mapperVersion,
          record.createdAt,
        ],
      );
      return;
    case "migrationDecision":
      runStatement(
        database,
        `
          INSERT INTO migration_decisions (
            id,
            batch_id,
            source_snapshot_id,
            source_collection,
            source_identity,
            command_kind,
            decision_payload_json,
            decided_at,
            actor_ref
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.batchId,
          record.sourceSnapshotId,
          record.sourceCollection,
          record.sourceIdentity,
          record.commandKind,
          record.decisionPayloadJson,
          record.decidedAt,
          record.actorRef,
        ],
      );
      return;
    case "documentRevision":
      runStatement(
        database,
        `
          INSERT INTO document_revisions (
            id,
            work_id,
            document_id,
            parent_revision_id,
            content_ref,
            content_hash,
            length,
            change_set_ref,
            cause,
            created_at,
            durable_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.workId,
          record.documentId,
          nullable(
            record
              .parentRevisionId,
          ),
          record.contentRef,
          record.contentHash,
          record.length,
          nullable(
            record.changeSetRef,
          ),
          record.cause,
          record.createdAt,
          record.durableAt,
        ],
      );
      return;
    case "manuscript":
      runStatement(
        database,
        `
          INSERT INTO manuscripts (
            id,
            work_id,
            document_id,
            current_revision_id,
            durable_revision_id,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.workId,
          record.documentId,
          record.currentRevisionId,
          record.durableRevisionId,
          record.updatedAt,
        ],
      );
      return;
    case "anchor":
      runStatement(
        database,
        `
          INSERT INTO anchors (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            document_id,
            origin_revision_id,
            resolved_revision_id,
            start_offset,
            end_offset,
            exact_quote,
            prefix_context,
            suffix_context,
            quote_hash,
            context_hash,
            lineage_ref,
            status,
            resolution_evidence_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          record.documentId,
          record.originRevisionId,
          record.resolvedRevisionId,
          record.startOffset,
          record.endOffset,
          record.exactQuote,
          record.prefixContext,
          record.suffixContext,
          record.quoteHash,
          record.contextHash,
          nullable(
            record.lineageRef,
          ),
          record.status,
          record
            .resolutionEvidenceJson,
        ],
      );
      return;
    case "rangeGroup":
      runStatement(
        database,
        `
          INSERT INTO range_groups (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
        ],
      );
      record.orderedAnchorIds
        .forEach(
          (
            anchorId,
            orderIndex,
          ) => {
            runStatement(
              database,
              `
                INSERT INTO range_group_anchors (
                  work_id,
                  range_group_id,
                  anchor_id,
                  order_index
                )
                VALUES (?, ?, ?, ?)
              `,
              [
                record.workId,
                record.id,
                anchorId,
                orderIndex,
              ],
            );
          },
        );
      return;
    case "sceneOverride":
      runStatement(
        database,
        `
          INSERT INTO scene_overrides (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            document_id,
            operation,
            base_rule_set_revision,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.documentId,
          record.operation,
          record.baseRuleSetRevision,
          nullable(record.note),
        ],
      );
      record.anchorIds.forEach((anchorId, orderIndex) => {
        runStatement(
          database,
          `
            INSERT INTO scene_override_anchors (
              work_id,
              document_id,
              scene_override_id,
              anchor_id,
              order_index
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            record.workId,
            record.documentId,
            record.id,
            anchorId,
            orderIndex,
          ],
        );
      });
      return;
    case "sceneEventOverride":
      runStatement(
        database,
        `
          INSERT INTO scene_event_overrides (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            scene_key,
            event_block_id,
            operation
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.sceneKey,
          record.eventBlockId,
          record.operation,
        ],
      );
      return;
    case "sceneEventOverrideRetirement":
      {
        const retirement = database.prepare(`
          UPDATE scene_event_overrides
          SET
            revision = revision + 1,
            updated_at = ?,
            retired_at = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.retiredAt,
          record.retiredAt,
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(retirement.changes) !== 1) {
          throw new Error(`SceneEventOverride revision conflict: ${record.id}`);
        }
      }
      return;
    case "eventBlock":
      runStatement(
        database,
        `
          INSERT INTO event_blocks (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            parent_event_id,
            title,
            note,
            stage_ref,
            order_key,
            collapsed,
            relation_ids_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          nullable(
            record.parentEventId,
          ),
          record.title,
          nullable(
            record.note,
          ),
          nullable(
            record.stageRef,
          ),
          record.outlineOrderKey,
          booleanInteger(
            record.collapsed,
          ),
          nullable(
            record.relationIdsJson,
          ),
        ],
      );
      return;
    case "eventBlockOutlineMove":
      {
        const moved = database.prepare(`
          UPDATE event_blocks
          SET
            revision = revision + 1,
            updated_at = ?,
            order_key = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.updatedAt,
          record.outlineOrderKey,
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(moved.changes) !== 1) {
          throw new Error(`EventBlock revision conflict: ${record.id}`);
        }
      }
      return;
    case "eventBlockOutlineRebalance":
      for (const event of record.events) {
        const moved = database.prepare(`
          UPDATE event_blocks
          SET
            revision = revision + 1,
            updated_at = ?,
            order_key = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.updatedAt,
          event.outlineOrderKey,
          event.id,
          record.workId,
          event.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(moved.changes) !== 1) {
          throw new Error(`EventBlock revision conflict: ${event.id}`);
        }
      }
      return;
    case "eventSource":
      {
        const hasReplacement = record.replacesEventSourceId !== undefined;
        const hasExpectedRevision =
          record.expectedReplacedRevision !== undefined;
        if (hasReplacement !== hasExpectedRevision) {
          throw new Error(
            "EventSource replacement identity and revision must be supplied together",
          );
        }
        if (
          record.replacesEventSourceId !== undefined &&
          record.expectedReplacedRevision !== undefined
        ) {
          const replacement = database.prepare(`
            UPDATE event_sources
            SET
              revision = revision + 1,
              updated_at = ?,
              retired_at = ?
            WHERE
              id = ?
              AND work_id = ?
              AND event_block_id = ?
              AND role = ?
              AND revision = ?
              AND retired_at IS NULL
          `).run(
            record.createdAt,
            record.createdAt,
            record.replacesEventSourceId,
            record.workId,
            record.eventBlockId,
            record.role,
            record.expectedReplacedRevision,
          ) as { readonly changes: number | bigint };
          if (Number(replacement.changes) !== 1) {
            throw new Error(
              `EventSource revision conflict: ${record.replacesEventSourceId}`,
            );
          }
        }
      }
      runStatement(
        database,
        `
          INSERT INTO event_sources (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            event_block_id,
            range_group_id,
            role
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.eventBlockId,
          record.rangeGroupId,
          record.role,
        ],
      );
      return;
    case "eventSourceRetirement":
      {
        const retirement = database.prepare(`
          UPDATE event_sources
          SET
            revision = revision + 1,
            updated_at = ?,
            retired_at = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.retiredAt,
          record.retiredAt,
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(retirement.changes) !== 1) {
          throw new Error(`EventSource revision conflict: ${record.id}`);
        }
      }
      return;
    case "fragment":
      runStatement(
        database,
        `
          INSERT INTO fragments (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            source_document_id,
            source_anchor_id,
            kind_id,
            title,
            pinned,
            use_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.sourceDocumentId,
          record.sourceAnchorId,
          record.kindId,
          record.title,
          booleanInteger(record.pinned),
          record.useCount,
        ],
      );
      return;
    case "character":
      runStatement(
        database,
        `
          INSERT INTO characters (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            name,
            aliases_json,
            role,
            summary,
            appearance,
            personality,
            speech,
            goal,
            conflict,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.name,
          JSON.stringify(record.aliases),
          record.role,
          record.summary,
          record.appearance,
          record.personality,
          record.speech,
          record.goal,
          record.conflict,
          record.note,
        ],
      );
      return;
    case "characterUpdate": {
      const result = database.prepare(`
        UPDATE characters
        SET
          schema_version = ?,
          revision = revision + 1,
          updated_at = ?,
          name = ?,
          aliases_json = ?,
          role = ?,
          summary = ?,
          appearance = ?,
          personality = ?,
          speech = ?,
          goal = ?,
          conflict = ?,
          note = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        record.schemaVersion,
        record.updatedAt,
        record.name,
        JSON.stringify(record.aliases),
        record.role,
        record.summary,
        record.appearance,
        record.personality,
        record.speech,
        record.goal,
        record.conflict,
        record.note,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(`Character revision conflict: ${record.id}`);
      }
      return;
    }
    case "characterRetirement": {
      const result = database.prepare(`
        UPDATE characters
        SET
          revision = revision + 1,
          updated_at = ?,
          retired_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        record.retiredAt,
        record.retiredAt,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(`Character revision conflict: ${record.id}`);
      }
      return;
    }
    case "characterRelation":
      runStatement(
        database,
        `
          INSERT INTO character_relations (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            retirement_reason,
            work_id,
            from_character_id,
            to_character_id,
            kind,
            description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          nullable(record.retirementReason),
          record.workId,
          record.fromCharacterId,
          record.toCharacterId,
          record.relationKind,
          record.description,
        ],
      );
      return;
    case "characterRelationUpdate": {
      const result = database.prepare(`
        UPDATE character_relations
        SET
          revision = revision + 1,
          updated_at = ?,
          kind = ?,
          description = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        record.updatedAt,
        record.relationKind,
        record.description,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(`Character relation revision conflict: ${record.id}`);
      }
      return;
    }
    case "characterRelationRetirement": {
      const result = database.prepare(`
        UPDATE character_relations
        SET
          revision = revision + 1,
          updated_at = ?,
          retired_at = ?,
          retirement_reason = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        record.retiredAt,
        record.retiredAt,
        record.retirementReason,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(`Character relation revision conflict: ${record.id}`);
      }
      return;
    }
    case "characterEvidence":
      runStatement(
        database,
        `
          INSERT INTO character_evidence (
            id,
            work_id,
            character_id,
            source_document_id,
            source_anchor_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.workId,
          record.characterId,
          record.sourceDocumentId,
          record.sourceAnchorId,
          record.createdAt,
        ],
      );
      return;
    case "characterExtractionCandidateDecision": {
      const result = database.prepare(`
        UPDATE assistant_character_extraction_candidates
        SET
          revision = revision + 1,
          status = ?,
          items_json = ?,
          updated_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND status = 'ready'
      `).run(
        record.status,
        JSON.stringify(record.items),
        record.updatedAt,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(
          `Character extraction Candidate revision conflict: ${record.id}`,
        );
      }
      return;
    }
    case "characterGenerationCandidateDecision": {
      const updated = database.prepare(`
        UPDATE assistant_character_generation_candidates
        SET
          revision = revision + 1,
          status = ?,
          items_json = ?,
          updated_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND status = 'ready'
      `).run(
        record.status,
        JSON.stringify(record.items),
        record.updatedAt,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(updated.changes) !== 1) {
        throw new Error(
          `Character generation Candidate revision conflict: ${record.id}`,
        );
      }
      return;
    }
    case "sceneExtractionCandidateDecision": {
      const result = database.prepare(`
        UPDATE assistant_scene_extraction_candidates
        SET
          revision = revision + 1,
          status = ?,
          boundaries_json = ?,
          updated_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND status = 'ready'
      `).run(
        record.status,
        JSON.stringify(record.boundaries),
        record.updatedAt,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(
          `Scene extraction Candidate revision conflict: ${record.id}`,
        );
      }
      return;
    }
    case "sceneAnnotation":
      runStatement(
        database,
        `
          INSERT INTO scene_annotations (
            id, schema_version, revision, work_id, scene_key, document_id,
            document_revision_id, source_candidate_id, source_scene_item_id,
            title, summary, pov_character_id, location, time,
            character_ids_json, goal, conflict, outcome, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.workId,
          record.sceneKey,
          record.documentId,
          record.documentRevisionId,
          record.sourceCandidateId,
          record.sourceSceneItemId,
          record.title,
          record.summary,
          nullable(record.povCharacterId),
          record.location,
          record.time,
          JSON.stringify(record.characterIds),
          record.goal,
          record.conflict,
          record.outcome,
          record.createdAt,
          record.updatedAt,
        ],
      );
      return;
    case "sceneAnnotationUpdate": {
      const result = database.prepare(`
        UPDATE scene_annotations
        SET
          revision = revision + 1,
          document_id = ?,
          document_revision_id = ?,
          source_candidate_id = ?,
          source_scene_item_id = ?,
          title = ?,
          summary = ?,
          pov_character_id = ?,
          location = ?,
          time = ?,
          character_ids_json = ?,
          goal = ?,
          conflict = ?,
          outcome = ?,
          updated_at = ?
        WHERE work_id = ? AND id = ? AND revision = ?
      `).run(
        record.documentId,
        record.documentRevisionId,
        record.sourceCandidateId,
        record.sourceSceneItemId,
        record.title,
        record.summary,
        nullable(record.povCharacterId),
        record.location,
        record.time,
        JSON.stringify(record.characterIds),
        record.goal,
        record.conflict,
        record.outcome,
        record.updatedAt,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(`Scene annotation revision conflict: ${record.id}`);
      }
      return;
    }
    case "sceneExtractionAnnotationCandidateDecision": {
      const result = database.prepare(`
        UPDATE assistant_scene_extraction_candidates
        SET
          revision = revision + 1,
          status = ?,
          scenes_json = ?,
          updated_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND status = 'ready'
      `).run(
        record.status,
        JSON.stringify(record.scenes),
        record.updatedAt,
        record.workId,
        record.id,
        record.expectedRevision,
      ) as { readonly changes: number | bigint };
      if (Number(result.changes) !== 1) {
        throw new Error(
          `Scene extraction Candidate revision conflict: ${record.id}`,
        );
      }
      return;
    }
    case "loreEntry":
      runStatement(
        database,
        `
          INSERT INTO lore_entries (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            title,
            content,
            category,
            aliases_json,
            enabled
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.title,
          record.content,
          record.category,
          JSON.stringify(record.aliases),
          booleanInteger(record.enabled),
        ],
      );
      return;
    case "loreEntryEvidence":
      runStatement(
        database,
        `
          INSERT INTO lore_entry_evidence (
            work_id,
            lore_entry_id,
            source_document_id,
            source_anchor_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          record.workId,
          record.loreEntryId,
          record.sourceDocumentId,
          record.sourceAnchorId,
          record.createdAt,
        ],
      );
      return;
    case "loreEntryHistory":
      runStatement(
        database,
        `
          INSERT INTO lore_entry_history (
            id,
            schema_version,
            work_id,
            lore_entry_id,
            entry_revision,
            change_kind,
            title,
            content,
            category,
            aliases_json,
            enabled,
            evidence_anchor_ids_json,
            changed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.workId,
          record.loreEntryId,
          record.entryRevision,
          record.changeKind,
          record.title,
          record.content,
          record.category,
          JSON.stringify(record.aliases),
          booleanInteger(record.enabled),
          JSON.stringify(record.evidenceAnchorIds),
          record.changedAt,
        ],
      );
      return;
    case "loreForeshadowLink":
      runStatement(
        database,
        `
          INSERT INTO lore_foreshadow_links (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            lore_entry_id,
            line_id,
            linked_at,
            unlinked_at,
            unlink_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.loreEntryId,
          record.lineId,
          record.linkedAt,
          nullable(record.unlinkedAt),
          nullable(record.unlinkReason),
        ],
      );
      return;
    case "loreCandidate":
      runStatement(
        database,
        `
          INSERT INTO lore_candidates (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            source_document_id,
            source_document_revision_id,
            source_anchor_id,
            exact_text,
            source,
            certainty,
            proposal_json,
            reason,
            status,
            approved_lore_entry_id,
            reviewed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.sourceDocumentId,
          record.sourceDocumentRevisionId,
          record.sourceAnchorId,
          record.exactText,
          record.source,
          record.certainty,
          record.proposalJson,
          record.reason,
          record.status,
          nullable(record.approvedLoreEntryId),
          nullable(record.reviewedAt),
        ],
      );
      return;
    case "publishingPartner":
      runStatement(
        database,
        `
          INSERT INTO publishing_partners (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            name,
            parent_partner_id,
            submission_method,
            website_url,
            email,
            genres_json,
            required_length,
            priority,
            note,
            source_ids_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.name,
          nullable(record.parentPartnerId),
          record.submissionMethod,
          record.websiteUrl,
          record.email,
          JSON.stringify(record.genres),
          record.requiredLength,
          record.priority,
          record.note,
          JSON.stringify(record.sourceIds),
        ],
      );
      return;
    case "plotThread":
      runStatement(
        database,
        `
          INSERT INTO plot_threads (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            title,
            stage,
            summary,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.title,
          record.stage,
          record.summary,
          record.note,
        ],
      );
      return;
    case "plotBoard":
      runStatement(
        database,
        `
          INSERT INTO plot_boards (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            work_id,
            title,
            mode
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          record.workId,
          record.title,
          record.mode,
        ],
      );
      return;
    case "plotLane":
      runStatement(
        database,
        `
          INSERT INTO plot_lanes (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            work_id,
            plot_board_id,
            title,
            kind,
            order_key
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          record.workId,
          record.plotBoardId,
          record.title,
          record.laneKind,
          record.orderKey,
        ],
      );
      return;
    case "plotPlacement":
      runStatement(
        database,
        `
          INSERT INTO plot_placements (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            plot_board_id,
            plot_lane_id,
            plot_thread_id,
            order_key,
            story_time,
            story_time_end
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.plotBoardId,
          record.plotLaneId,
          record.plotThreadId,
          record.orderKey,
          nullable(record.storyTime),
          nullable(record.storyTimeEnd),
        ],
      );
      return;
    case "plotBoardTouch":
      {
        const touched = database.prepare(`
          UPDATE plot_boards
          SET revision = revision + 1, updated_at = ?
          WHERE id = ? AND work_id = ? AND revision = ?
        `).run(
          record.updatedAt,
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(touched.changes) !== 1) {
          throw new Error(`PlotBoard revision conflict: ${record.id}`);
        }
      }
      return;
    case "plotPlacementMove":
      {
        const moved = database.prepare(`
          UPDATE plot_placements
          SET
            revision = revision + 1,
            updated_at = ?,
            plot_board_id = ?,
            plot_lane_id = ?,
            order_key = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.updatedAt,
          record.plotBoardId,
          record.plotLaneId,
          record.orderKey,
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(moved.changes) !== 1) {
          throw new Error(`PlotPlacement revision conflict: ${record.id}`);
        }
        const touched = database.prepare(`
          UPDATE plot_boards
          SET revision = revision + 1, updated_at = ?
          WHERE id = ? AND work_id = ? AND revision = ?
        `).run(
          record.updatedAt,
          record.plotBoardId,
          record.workId,
          record.expectedBoardRevision,
        ) as { readonly changes: number | bigint };
        if (Number(touched.changes) !== 1) {
          throw new Error(`PlotBoard revision conflict: ${record.plotBoardId}`);
        }
      }
      return;
    case "plotPlacementStoryTime":
      {
        const positioned = database.prepare(`
          UPDATE plot_placements
          SET
            revision = revision + 1,
            updated_at = ?,
            story_time = ?,
            story_time_end = ?
          WHERE
            id = ?
            AND work_id = ?
            AND plot_board_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.updatedAt,
          record.storyTime,
          record.storyTimeEnd,
          record.id,
          record.workId,
          record.plotBoardId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(positioned.changes) !== 1) {
          throw new Error(`PlotPlacement revision conflict: ${record.id}`);
        }
        const touched = database.prepare(`
          UPDATE plot_boards
          SET revision = revision + 1, updated_at = ?
          WHERE id = ? AND work_id = ? AND revision = ?
        `).run(
          record.updatedAt,
          record.plotBoardId,
          record.workId,
          record.expectedBoardRevision,
        ) as { readonly changes: number | bigint };
        if (Number(touched.changes) !== 1) {
          throw new Error(`PlotBoard revision conflict: ${record.plotBoardId}`);
        }
      }
      return;
    case "plotPlacementRebalance":
      {
        const moveToTemporaryKey = database.prepare(`
          UPDATE plot_placements
          SET order_key = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `);
        for (const placement of record.placements) {
          const staged = moveToTemporaryKey.run(
            `__rebalance__${placement.id}`,
            placement.id,
            record.workId,
            placement.expectedRevision,
          ) as { readonly changes: number | bigint };
          if (Number(staged.changes) !== 1) {
            throw new Error(`PlotPlacement revision conflict: ${placement.id}`);
          }
        }
        const publishOrderKey = database.prepare(`
          UPDATE plot_placements
          SET
            revision = revision + 1,
            updated_at = ?,
            plot_board_id = ?,
            plot_lane_id = ?,
            order_key = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `);
        for (const placement of record.placements) {
          const published = publishOrderKey.run(
            record.updatedAt,
            record.plotBoardId,
            placement.plotLaneId,
            placement.orderKey,
            placement.id,
            record.workId,
            placement.expectedRevision,
          ) as { readonly changes: number | bigint };
          if (Number(published.changes) !== 1) {
            throw new Error(`PlotPlacement revision conflict: ${placement.id}`);
          }
        }
        const touched = database.prepare(`
          UPDATE plot_boards
          SET revision = revision + 1, updated_at = ?
          WHERE id = ? AND work_id = ? AND revision = ?
        `).run(
          record.updatedAt,
          record.plotBoardId,
          record.workId,
          record.expectedBoardRevision,
        ) as { readonly changes: number | bigint };
        if (Number(touched.changes) !== 1) {
          throw new Error(`PlotBoard revision conflict: ${record.plotBoardId}`);
        }
      }
      return;
    case "plotEventLink":
      runStatement(
        database,
        `
          INSERT INTO plot_event_links (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            plot_thread_id,
            event_block_id,
            role,
            created_from
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.plotThreadId,
          record.eventBlockId,
          record.role,
          record.createdFrom,
        ],
      );
      return;
    case "plotEventLinkRetirement":
      {
        const retirement = database.prepare(`
          UPDATE plot_event_links
          SET
            revision = revision + 1,
            updated_at = ?,
            retired_at = ?
          WHERE
            id = ?
            AND work_id = ?
            AND revision = ?
            AND retired_at IS NULL
        `).run(
          record.retiredAt,
          record.retiredAt,
          record.id,
          record.workId,
          record.expectedRevision,
        ) as { readonly changes: number | bigint };
        if (Number(retirement.changes) !== 1) {
          throw new Error(`PlotEventLink revision conflict: ${record.id}`);
        }
      }
      return;
    case "plotThreadSource":
      {
        const currentRows = database.prepare(`
          SELECT id
          FROM plot_thread_sources
          WHERE
            work_id = ?
            AND plot_thread_id = ?
            AND retired_at IS NULL
        `).all(record.workId, record.plotThreadId);
        if (currentRows.length > 1) {
          throw new Error(
            `Plot source lookup returned duplicate rows: ${record.plotThreadId}`,
          );
        }
        const currentRow = currentRows[0] as Record<string, unknown> | undefined;
        const currentSourceId = currentRow === undefined
          ? null
          : typeof currentRow.id === "string"
            ? currentRow.id
            : (() => {
                throw new Error("Plot source lookup returned an invalid id");
              })();
        if (currentSourceId !== record.expectedSourceId) {
          throw new Error(
            `Plot source revision conflict: ${record.plotThreadId}`,
          );
        }
        if (currentSourceId !== null) {
          const result = database.prepare(`
            UPDATE plot_thread_sources
            SET
              revision = revision + 1,
              updated_at = ?,
              retired_at = ?
            WHERE
              work_id = ?
              AND plot_thread_id = ?
              AND id = ?
              AND retired_at IS NULL
          `).run(
            record.createdAt,
            record.createdAt,
            record.workId,
            record.plotThreadId,
            currentSourceId,
          ) as { readonly changes: number | bigint };
          if (Number(result.changes) !== 1) {
            throw new Error(
              `Plot source revision conflict: ${record.plotThreadId}`,
            );
          }
        }
      }
      runStatement(
        database,
        `
          INSERT INTO plot_thread_sources (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            plot_thread_id,
            source_document_id,
            source_anchor_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.plotThreadId,
          record.sourceDocumentId,
          record.sourceAnchorId,
        ],
      );
      return;
    case "foreshadowLine":
      runStatement(
        database,
        `
          INSERT INTO foreshadow_lines (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            title,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.title,
          record.note,
        ],
      );
      return;
    case "foreshadowPoint":
      runStatement(
        database,
        `
          INSERT INTO foreshadow_points (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            line_id,
            source_document_id,
            source_anchor_id,
            role_id,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.lineId,
          record.sourceDocumentId,
          record.sourceAnchorId,
          record.roleId,
          record.note,
        ],
      );
      return;
    case "resumeCheckpoint":
      runStatement(
        database,
        `
          INSERT INTO resume_checkpoints (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            document_id,
            document_revision_id,
            cursor_anchor_id,
            selection_anchor_id,
            workspace_mode,
            context_refs_json,
            focus_checkpoint_id,
            music_checkpoint_id,
            captured_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          record.documentId,
          record.documentRevisionId,
          record.cursorAnchorId,
          nullable(
            record.selectionAnchorId,
          ),
          record.workspaceMode,
          nullable(
            record.contextRefsJson,
          ),
          nullable(
            record.focusCheckpointId,
          ),
          nullable(
            record.musicCheckpointId,
          ),
          record.capturedAt,
        ],
      );
      return;
    case "writingSession":
      runStatement(
        database,
        `
          INSERT INTO writing_sessions (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            document_id,
            policy_id,
            state,
            mode_ref,
            started_at,
            ended_at,
            last_durable_heartbeat_at,
            start_revision_id,
            end_revision_id,
            note,
            recovery_evidence_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          nullable(
            record.documentId,
          ),
          record.policyId,
          record.state,
          nullable(
            record.modeRef,
          ),
          record.startedAt,
          nullable(
            record.endedAt,
          ),
          record
            .lastDurableHeartbeatAt,
          nullable(
            record.startRevisionId,
          ),
          nullable(
            record.endRevisionId,
          ),
          nullable(
            record.note,
          ),
          nullable(
            record
              .recoveryEvidenceJson,
          ),
        ],
      );
      return;
    case "activityInterval":
      runStatement(
        database,
        `
          INSERT INTO activity_intervals (
            id,
            work_id,
            session_id,
            activity_class,
            started_at,
            ended_at,
            document_id,
            evidence_count,
            source
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.workId,
          record.sessionId,
          record.activityClass,
          record.startedAt,
          record.endedAt,
          nullable(
            record.documentId,
          ),
          record.evidenceCount,
          record.source,
        ],
      );
      record.eventBlockIds
        .forEach((eventBlockId) => {
          runStatement(
            database,
            `
              INSERT INTO activity_interval_event_blocks (
                work_id,
                session_id,
                activity_interval_id,
                event_block_id
              )
              VALUES (?, ?, ?, ?)
            `,
            [
              record.workId,
              record.sessionId,
              record.id,
              eventBlockId,
            ],
          );
        });
      return;
    case "focusCycle":
      runStatement(
        database,
        `
          INSERT INTO focus_cycles (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            session_id,
            policy_id,
            phase_ref,
            state,
            pause_reason,
            target_duration,
            started_at,
            deadline_at,
            remaining_at_pause,
            completed_at,
            note,
            music_queue_id
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?
          )
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(
            record.retiredAt,
          ),
          record.workId,
          nullable(
            record.sessionId,
          ),
          record.policyId,
          record.phaseRef,
          record.state,
          nullable(
            record.pauseReason,
          ),
          record.targetDuration,
          nullable(
            record.startedAt,
          ),
          nullable(
            record.deadlineAt,
          ),
          nullable(
            record
              .remainingAtPause,
          ),
          nullable(
            record.completedAt,
          ),
          nullable(
            record.note,
          ),
          nullable(
            record.musicQueueId,
          ),
        ],
      );
      return;
    case "workSnapshot":
      runStatement(
        database,
        `
          INSERT INTO work_snapshots (
            id,
            work_id,
            structure_revision_refs_json,
            dictionary_revision_refs_json,
            manifest_hash,
            label,
            cause,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.workId,
          record
            .structureRevisionRefsJson,
          nullable(
            record
              .dictionaryRevisionRefsJson,
          ),
          record.manifestHash,
          nullable(
            record.label,
          ),
          record.cause,
          record.createdAt,
        ],
      );
      record.documentRevisions
        .forEach((entry) => {
          runStatement(
            database,
            `
              INSERT INTO work_snapshot_document_revisions (
                work_id,
                work_snapshot_id,
                document_id,
                document_revision_id
              )
              VALUES (?, ?, ?, ?)
            `,
            [
              record.workId,
              record.id,
              entry.documentId,
              entry
                .documentRevisionId,
            ],
          );
        });
      return;
    case "submissionPackage":
      runStatement(
        database,
        `
          INSERT INTO submission_packages (
            id,
            work_id,
            partner_id,
            work_snapshot_id,
            work_title_snapshot,
            partner_name_snapshot,
            manifest_hash,
            sealed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.workId,
          record.partnerId,
          record.workSnapshotId,
          record.workTitleSnapshot,
          record.partnerNameSnapshot,
          record.manifestHash,
          record.sealedAt,
        ],
      );
      return;
    case "publishingSubmission":
      runStatement(
        database,
        `
          INSERT INTO publishing_submissions (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            partner_id,
            submission_package_id,
            title,
            status,
            submitted_on,
            responded_on,
            result,
            note,
            card_note,
            source_ids_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.partnerId,
          record.submissionPackageId,
          record.title,
          record.status,
          nullable(record.submittedOn),
          nullable(record.respondedOn),
          record.result,
          record.note,
          record.cardNote,
          JSON.stringify(record.sourceIds),
        ],
      );
      return;
    case "publishingContract":
      runStatement(
        database,
        `
          INSERT INTO publishing_contracts (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            partner_id,
            submission_id,
            title,
            work_title_snapshot,
            partner_name_snapshot,
            status,
            signed_on,
            starts_on,
            ends_on,
            rights_scope,
            advance_amount,
            currency_code,
            revenue_share_note,
            note,
            source_ids_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.partnerId,
          nullable(record.submissionId),
          record.title,
          record.workTitleSnapshot,
          record.partnerNameSnapshot,
          record.status,
          nullable(record.signedOn),
          nullable(record.startsOn),
          nullable(record.endsOn),
          record.rightsScope,
          nullable(record.advanceAmount),
          record.currencyCode,
          record.revenueShareNote,
          record.note,
          JSON.stringify(record.sourceIds),
        ],
      );
      return;
    case "publishingPublication":
      runStatement(
        database,
        `
          INSERT INTO publishing_publications (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            contract_id,
            channel_partner_id,
            title,
            work_title_snapshot,
            channel_name_snapshot,
            status,
            format,
            scheduled_on,
            starts_on,
            ends_on,
            published_unit_count,
            planned_unit_count,
            schedule_note,
            note,
            source_ids_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          nullable(record.contractId),
          nullable(record.channelPartnerId),
          record.title,
          record.workTitleSnapshot,
          record.channelNameSnapshot,
          record.status,
          record.format,
          nullable(record.scheduledOn),
          nullable(record.startsOn),
          nullable(record.endsOn),
          nullable(record.publishedUnitCount),
          nullable(record.plannedUnitCount),
          record.scheduleNote,
          record.note,
          JSON.stringify(record.sourceIds),
        ],
      );
      return;
    case "publishingSettlement":
      runStatement(
        database,
        `
          INSERT INTO publishing_settlements (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            publication_id,
            title,
            work_title_snapshot,
            publication_title_snapshot,
            period_starts_on,
            period_ends_on,
            issued_on,
            review_status,
            currency_code,
            reported_amount,
            items_json,
            note,
            source_ids_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          record.publicationId,
          record.title,
          record.workTitleSnapshot,
          record.publicationTitleSnapshot,
          nullable(record.periodStartsOn),
          nullable(record.periodEndsOn),
          nullable(record.issuedOn),
          record.reviewStatus,
          record.currencyCode,
          nullable(record.reportedAmount),
          JSON.stringify(record.items),
          record.note,
          JSON.stringify(record.sourceIds),
        ],
      );
      return;
    case "publishingPayment":
      runStatement(
        database,
        `
          INSERT INTO publishing_payments (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            settlement_id,
            work_title_snapshot,
            settlement_title_snapshot,
            received_on,
            confirmed_on,
            amount,
            currency_code,
            match_status,
            payer_label,
            reference,
            note,
            source_ids_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.workId,
          nullable(record.settlementId),
          record.workTitleSnapshot,
          record.settlementTitleSnapshot,
          nullable(record.receivedOn),
          nullable(record.confirmedOn),
          record.amount,
          record.currencyCode,
          record.matchStatus,
          record.payerLabel,
          record.reference,
          record.note,
          JSON.stringify(record.sourceIds),
        ],
      );
      return;
    case "publishingSource":
      runStatement(
        database,
        `
          INSERT INTO publishing_sources (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            source_kind,
            label,
            url,
            observed_at,
            authority,
            imported_fields_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.sourceKind,
          record.label,
          nullable(record.url),
          nullable(record.observedAt),
          record.authority,
          JSON.stringify(record.importedFields),
        ],
      );
      return;
    case "publishingMailCandidate":
      runStatement(
        database,
        `
          INSERT INTO publishing_mail_candidates (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            source_id,
            source_account_id,
            message_id,
            thread_id,
            sender,
            subject,
            received_at,
            snippet,
            body_fingerprint,
            submission_id,
            match_reason,
            proposed_status,
            proposed_result,
            proposed_responded_on,
            proposed_note,
            classification_connection_id,
            classification_model,
            review_status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.schemaVersion,
          record.revision,
          record.createdAt,
          record.updatedAt,
          nullable(record.retiredAt),
          record.sourceId,
          record.sourceAccountId,
          record.messageId,
          record.threadId,
          record.from,
          record.subject,
          record.receivedAt,
          record.snippet,
          record.bodyFingerprint,
          nullable(record.submissionId),
          record.matchReason,
          record.proposedStatus,
          record.proposedResult,
          nullable(record.proposedRespondedOn),
          record.proposedNote,
          nullable(record.classificationConnectionId),
          record.classificationModel,
          record.reviewStatus,
        ],
      );
      return;
    case "migrationReceipt":
      runStatement(
        database,
        `
          INSERT INTO migration_receipts (
            id,
            migration_id,
            from_schema_version,
            to_schema_version,
            migration_checksum_identity,
            migration_checksum_value,
            before_checksum_value,
            after_checksum_value,
            started_at,
            completed_at,
            progress_receipt_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `,
        [
          record.id,
          record.migrationId,
          record.fromSchemaVersion,
          record.toSchemaVersion,
          record
            .migrationChecksumIdentity,
          record
            .migrationChecksumValue,
          record.beforeChecksumValue,
          record.afterChecksumValue,
          record.startedAt,
          nullable(
            record.completedAt,
          ),
          nullable(
            record
              .progressReceiptJson,
          ),
        ],
      );
      return;
  }
}

type PublishedRevisionBlob = {
  readonly blobRef: string;
  readonly address: BlobAddress;
  readonly byteLength: number;
  readonly descriptor:
    RevisionBlobDescriptor;
  readonly manifestMetadata:
    ReturnType<
      RevisionBlobProfile[
        "manifestMetadataForAppend"
      ]
    >;
};

type DocumentPointerState = {
  readonly workId: string;
  readonly manuscriptId: string;
  readonly currentRevisionId:
    string;
  readonly durableRevisionId:
    string;
};

const REVISION_SELECT_SQL = `
SELECT
  id AS "id",
  document_id AS "documentId",
  parent_revision_id AS "parentRevisionId",
  content_ref AS "contentRef",
  content_hash AS "contentHash",
  length AS "length",
  change_set_ref AS "changeSetRef",
  cause AS "cause",
  created_at AS "createdAt",
  durable_at AS "durableAt"
FROM document_revisions
`;

const MANIFEST_SELECT_SQL = `
SELECT
  blob_ref AS "blobRef",
  checksum_identity AS "checksumIdentity",
  checksum_value AS "checksumValue",
  byte_length AS "byteLength",
  created_at AS "createdAt",
  media_type AS "mediaType",
  original_name AS "originalName"
FROM blob_manifests
WHERE blob_ref = ?
`;

function readRequiredString(
  row: Readonly<
    Record<string, unknown>
  >,
  column: string,
  label: string,
): string {
  const value = row[column];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label} returned an invalid ${column}`,
    );
  }
  return value;
}

function readNullableString(
  row: Readonly<
    Record<string, unknown>
  >,
  column: string,
  label: string,
): string | null {
  const value = row[column];
  if (
    value !== null &&
    typeof value !== "string"
  ) {
    throw new Error(
      `${label} returned an invalid ${column}`,
    );
  }
  return value;
}

function readNonNegativeSafeInteger(
  row: Readonly<
    Record<string, unknown>
  >,
  column: string,
  label: string,
): number {
  const value = row[column];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${label} returned an invalid ${column}`,
    );
  }
  return value;
}

function readRequiredBytes(
  row: Readonly<Record<string, unknown>>,
  column: string,
  label: string,
): Uint8Array {
  const value = row[column];
  if (!(value instanceof Uint8Array)) {
    throw new Error(`${label} returned an invalid ${column}`);
  }
  return new Uint8Array(value);
}

function sameAddress(
  left: BlobAddress,
  right: BlobAddress,
): boolean {
  return (
    left.checksumIdentity ===
      right.checksumIdentity &&
    left.checksumValue ===
      right.checksumValue
  );
}

function sameBytes(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  return (
    left.byteLength ===
      right.byteLength &&
    left.every(
      (value, index) =>
        value === right[index],
    )
  );
}

function sameMetadata(
  left: BlobMetadata,
  right: BlobMetadata,
): boolean {
  const leftEntries =
    Object.entries(left).sort(
      ([leftKey], [rightKey]) =>
        leftKey.localeCompare(
          rightKey,
        ),
    );
  const rightEntries =
    Object.entries(right).sort(
      ([leftKey], [rightKey]) =>
        leftKey.localeCompare(
          rightKey,
        ),
    );
  return (
    leftEntries.length ===
      rightEntries.length &&
    leftEntries.every(
      ([key, value], index) => {
        const rightEntry =
          rightEntries[index];
        return (
          rightEntry !==
            undefined &&
          rightEntry[0] === key &&
          rightEntry[1] === value
        );
      },
    )
  );
}

function assertDescriptor(
  descriptor:
    RevisionBlobDescriptor,
): void {
  if (
    !Number.isSafeInteger(
      descriptor.length,
    ) ||
    descriptor.length < 0
  ) {
    throw new Error(
      "Revision content length must be a non-negative integer",
    );
  }
  if (
    descriptor.contentHash.length ===
    0
  ) {
    throw new Error(
      "Revision contentHash must not be empty",
    );
  }
}

function assertCodecMaterialization(
  input: {
    readonly expectedContent:
      string;
    readonly expectedBytes:
      Uint8Array;
    readonly expectedDescriptor:
      RevisionBlobDescriptor;
    readonly blobProfile:
      RevisionBlobProfile;
  },
): void {
  const decoded =
    input.blobProfile.codec.decode(
      input.expectedBytes,
    );
  const reencoded =
    Uint8Array.from(
      input.blobProfile.codec.encode(
        decoded,
      ),
    );
  const redescribed =
    input.blobProfile.codec.describe(
      decoded,
    );
  assertDescriptor(redescribed);
  if (
    decoded !==
      input.expectedContent ||
    !sameBytes(
      reencoded,
      input.expectedBytes,
    ) ||
    redescribed.contentHash !==
      input.expectedDescriptor
        .contentHash ||
    redescribed.length !==
      input.expectedDescriptor.length
  ) {
    throw new BlobContentMismatchError(
      "Revision blob codec did not reproduce the exact caller content and descriptor",
    );
  }
}

async function publishRevisionBlob(
  input: AppendRevisionInput,
  options:
    NodeSqliteRevisionStoreOptions,
): Promise<
  PublishedRevisionBlob
> {
  const descriptor =
    options.blobProfile
      .codec.describe(
        input.content,
      );
  assertDescriptor(descriptor);
  const bytes =
    Uint8Array.from(
      options.blobProfile
        .codec.encode(
          input.content,
        ),
    );
  assertCodecMaterialization({
    expectedContent: input.content,
    expectedBytes: bytes,
    expectedDescriptor:
      descriptor,
    blobProfile:
      options.blobProfile,
  });
  const metadata =
    options.blobProfile
      .metadataForAppend(input);
  const publication =
    await options.blobStore.append({
      bytes,
      metadata,
      temporaryEntryIdentity:
        options.blobProfile
          .temporaryEntryIdentityForAppend(
            input,
          ),
    });
  if (
    publication.byteLength !==
      bytes.byteLength ||
    !sameMetadata(
      publication.metadata,
      metadata,
    )
  ) {
    throw new BlobContentMismatchError(
      "Published blob receipt does not match the exact caller bytes and metadata",
    );
  }
  const blobRef =
    options.blobProfile
      .blobRefForAddress(
        publication.address,
      );
  if (blobRef.length === 0) {
    throw new Error(
      "Revision contentRef must not be empty",
    );
  }
  const mappedAddress =
    options.blobProfile
      .addressForBlobRef(blobRef);
  if (
    !sameAddress(
      mappedAddress,
      publication.address,
    )
  ) {
    throw new BlobContentMismatchError(
      "Caller blobRef/address mapping did not round-trip exactly",
    );
  }
  const physical =
    await options.blobStore.readExact(
      publication.address,
    );
  if (
    !sameAddress(
      physical.address,
      publication.address,
    ) ||
    physical.byteLength !==
      publication.byteLength ||
    !sameBytes(
      physical.bytes,
      bytes,
    )
  ) {
    throw new BlobContentMismatchError(
      "Published blob physical readback does not match the exact caller bytes",
    );
  }
  assertCodecMaterialization({
    expectedContent: input.content,
    expectedBytes:
      physical.bytes,
    expectedDescriptor:
      descriptor,
    blobProfile:
      options.blobProfile,
  });
  return Object.freeze({
    blobRef,
    address:
      publication.address,
    byteLength:
      publication.byteLength,
    descriptor,
    manifestMetadata:
      options.blobProfile
        .manifestMetadataForAppend(
          input,
        ),
  });
}

function readDocumentPointerState(
  database: NodeSqliteDatabase,
  documentId: string,
): DocumentPointerState | null {
  const rows = queryRows(
    database,
    `
      SELECT
        documents.work_id AS "workId",
        documents.manuscript_id AS "manuscriptId",
        manuscripts.id AS "joinedManuscriptId",
        manuscripts.current_revision_id AS "currentRevisionId",
        manuscripts.durable_revision_id AS "durableRevisionId"
      FROM documents
      LEFT JOIN manuscripts
        ON manuscripts.id =
          documents.manuscript_id
        AND manuscripts.work_id =
          documents.work_id
        AND manuscripts.document_id =
          documents.id
      WHERE documents.id = ?
    `,
    [documentId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (
    rows.length !== 1 ||
    rows[0] === undefined
  ) {
    throw new Error(
      "Document lookup returned an invalid result",
    );
  }
  const row = rows[0];
  const manuscriptId =
    readRequiredString(
      row,
      "manuscriptId",
      "Document lookup",
    );
  const joinedManuscriptId =
    readNullableString(
      row,
      "joinedManuscriptId",
      "Document lookup",
    );
  if (
    joinedManuscriptId !==
      manuscriptId
  ) {
    throw new Error(
      `Missing manuscript for document ${documentId}`,
    );
  }
  return Object.freeze({
    workId:
      readRequiredString(
        row,
        "workId",
        "Document lookup",
      ),
    manuscriptId,
    currentRevisionId:
      readRequiredString(
        row,
        "currentRevisionId",
        "Document lookup",
      ),
    durableRevisionId:
      readRequiredString(
        row,
        "durableRevisionId",
        "Document lookup",
      ),
  });
}

function revisionFromRow(
  row: Readonly<
    Record<string, unknown>
  >,
): DocumentRevision {
  const parentRevisionId =
    readNullableString(
      row,
      "parentRevisionId",
      "Revision lookup",
    );
  const changeSetRef =
    readNullableString(
      row,
      "changeSetRef",
      "Revision lookup",
    );
  return Object.freeze({
    id:
      entityId<"DocumentRevision">(
        readRequiredString(
          row,
          "id",
          "Revision lookup",
        ),
      ),
    documentId:
      entityId<"Document">(
        readRequiredString(
          row,
          "documentId",
          "Revision lookup",
        ),
      ),
    ...(parentRevisionId ===
    null
      ? {}
      : {
          parentRevisionId:
            entityId<"DocumentRevision">(
              parentRevisionId,
            ),
        }),
    contentRef:
      readRequiredString(
        row,
        "contentRef",
        "Revision lookup",
      ),
    contentHash:
      readRequiredString(
        row,
        "contentHash",
        "Revision lookup",
      ),
    length:
      readNonNegativeSafeInteger(
        row,
        "length",
        "Revision lookup",
      ),
    ...(changeSetRef === null
      ? {}
      : { changeSetRef }),
    cause:
      readRequiredString(
        row,
        "cause",
        "Revision lookup",
      ),
    createdAt:
      readRequiredString(
        row,
        "createdAt",
        "Revision lookup",
      ),
    durableAt:
      readRequiredString(
        row,
        "durableAt",
        "Revision lookup",
      ),
  });
}

function readRevision(
  database: NodeSqliteDatabase,
  revisionId: string,
): DocumentRevision | null {
  const rows = queryRows(
    database,
    `${REVISION_SELECT_SQL}
     WHERE id = ?`,
    [revisionId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (
    rows.length !== 1 ||
    rows[0] === undefined
  ) {
    throw new Error(
      "Revision lookup returned an invalid result",
    );
  }
  return revisionFromRow(
    rows[0],
  );
}

function expectedManifestRow(
  published:
    PublishedRevisionBlob,
): Readonly<
  Record<
    string,
    Poc3SqliteReadbackValue
  >
> {
  return Object.freeze({
    blobRef: published.blobRef,
    checksumIdentity:
      published.address
        .checksumIdentity,
    checksumValue:
      published.address
        .checksumValue,
    byteLength:
      published.byteLength,
    createdAt:
      published.manifestMetadata
        .createdAt,
    mediaType:
      published.manifestMetadata
        .mediaType ?? null,
    originalName:
      published.manifestMetadata
        .originalName ?? null,
  });
}

function insertOrVerifyManifest(
  database: NodeSqliteDatabase,
  published:
    PublishedRevisionBlob,
): void {
  let rows = queryRows(
    database,
    MANIFEST_SELECT_SQL,
    [published.blobRef],
  );
  if (rows.length === 0) {
    runStatement(
      database,
      `
        INSERT INTO blob_manifests (
          blob_ref,
          checksum_identity,
          checksum_value,
          byte_length,
          created_at,
          media_type,
          original_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        published.blobRef,
        published.address
          .checksumIdentity,
        published.address
          .checksumValue,
        published.byteLength,
        published.manifestMetadata
          .createdAt,
        published.manifestMetadata
          .mediaType ?? null,
        published.manifestMetadata
          .originalName ?? null,
      ],
    );
    rows = queryRows(
      database,
      MANIFEST_SELECT_SQL,
      [published.blobRef],
    );
  }
  if (
    rows.length !== 1 ||
    rows[0] === undefined ||
    JSON.stringify(rows[0]) !==
      JSON.stringify(
        expectedManifestRow(
          published,
        ),
      )
  ) {
    throw new BlobContentMismatchError(
      "Blob manifest does not match the exact published blob and caller metadata",
    );
  }
}

function createCommittedRevision(
  input: AppendRevisionInput,
  published:
    PublishedRevisionBlob,
): DocumentRevision {
  return Object.freeze({
    id: input.revisionId,
    documentId:
      input.documentId,
    ...(input
      .expectedCurrentRevisionId ===
    null
      ? {}
      : {
          parentRevisionId:
            input
              .expectedCurrentRevisionId,
        }),
    contentRef:
      published.blobRef,
    contentHash:
      published.descriptor
        .contentHash,
    length:
      published.descriptor.length,
    ...(input.changeSetRef ===
    undefined
      ? {}
      : {
          changeSetRef:
            input.changeSetRef,
        }),
    cause: input.cause,
    createdAt: input.createdAt,
    durableAt: input.durableAt,
  });
}

function createNodeSqliteRevisionStore(
  database: NodeSqliteDatabase,
  assertOpen: () => void,
  options:
    NodeSqliteRevisionStoreOptions,
): RevisionStore {
  if (
    options.blobProfile.codec
      .identity.length === 0
  ) {
    throw new Error(
      "Revision blob codec identity must not be empty",
    );
  }
  return Object.freeze({
    append: async (
      input: AppendRevisionInput,
    ): Promise<DocumentRevision> => {
      assertOpen();
      const published =
        await publishRevisionBlob(
          input,
          options,
        );
      database.exec(
        "BEGIN IMMEDIATE",
      );
      let transactionActive =
        true;
      try {
        const pointer =
          readDocumentPointerState(
            database,
            input.documentId,
          );
        if (pointer === null) {
          throw new Error(
            `Unknown document: ${input.documentId}`,
          );
        }
        if (
          pointer.workId !==
            input.workId
        ) {
          throw new Error(
            `Work/document boundary violation: ${input.workId}/${input.documentId}`,
          );
        }
        if (
          pointer.currentRevisionId !==
            input
              .expectedCurrentRevisionId
        ) {
          throw new Error(
            `Revision conflict for document ${input.documentId}`,
          );
        }
        if (
          readRevision(
            database,
            input.revisionId,
          ) !== null
        ) {
          throw new Error(
            `Duplicate revision identity: ${input.revisionId}`,
          );
        }
        insertOrVerifyManifest(
          database,
          published,
        );
        const committedRevision =
          createCommittedRevision(
            input,
            published,
          );
        writeLedgerRecord(
          database,
          {
            kind:
              "documentRevision",
            id:
              committedRevision.id,
            workId: input.workId,
            documentId:
              committedRevision
                .documentId,
            ...(committedRevision
              .parentRevisionId ===
            undefined
              ? {}
              : {
                  parentRevisionId:
                    committedRevision
                      .parentRevisionId,
                }),
            contentRef:
              committedRevision
                .contentRef,
            contentHash:
              committedRevision
                .contentHash,
            length:
              committedRevision.length,
            ...(committedRevision
              .changeSetRef ===
            undefined
              ? {}
              : {
                  changeSetRef:
                    committedRevision
                      .changeSetRef,
                }),
            cause:
              committedRevision.cause,
            createdAt:
              committedRevision
                .createdAt,
            durableAt:
              committedRevision
                .durableAt,
          },
        );
        if (input.editorStateJson !== undefined) {
          runStatement(
            database,
            `
              INSERT INTO document_revision_editor_states (
                revision_id,
                work_id,
                document_id,
                editor_state_json
              ) VALUES (?, ?, ?, ?)
            `,
            [
              committedRevision.id,
              input.workId,
              input.documentId,
              input.editorStateJson,
            ],
          );
        }
        runStatement(
          database,
          `
            UPDATE manuscripts
            SET
              current_revision_id = ?,
              durable_revision_id = ?,
              updated_at = ?
            WHERE
              id = ?
              AND work_id = ?
              AND document_id = ?
              AND current_revision_id = ?
          `,
          [
            committedRevision.id,
            committedRevision.id,
            committedRevision
              .durableAt,
            pointer.manuscriptId,
            input.workId,
            input.documentId,
            pointer.currentRevisionId,
          ],
        );
        const updatedPointer =
          readDocumentPointerState(
            database,
            input.documentId,
          );
        if (
          updatedPointer === null ||
          updatedPointer.workId !==
            input.workId ||
          updatedPointer
            .manuscriptId !==
            pointer.manuscriptId ||
          updatedPointer
            .currentRevisionId !==
            committedRevision.id ||
          updatedPointer
            .durableRevisionId !==
            committedRevision.id
        ) {
          throw new Error(
            "Manuscript revision pointers were not updated atomically",
          );
        }
        if (
          options
            .beforeDatabaseCommit !==
          undefined
        ) {
          await options
            .beforeDatabaseCommit();
        }
        database.exec("COMMIT");
        transactionActive = false;
        return committedRevision;
      } catch (error) {
        if (transactionActive) {
          database.exec(
            "ROLLBACK",
          );
        }
        throw error;
      }
    },
    getCurrentRevision: async (
      documentId:
        EntityId<"Document">,
    ): Promise<
      DocumentRevision | null
    > => {
      assertOpen();
      const pointer =
        readDocumentPointerState(
          database,
          documentId,
        );
      if (pointer === null) {
        throw new Error(
          `Unknown document: ${documentId}`,
        );
      }
      const revision =
        readRevision(
          database,
          pointer.currentRevisionId,
        );
      if (
        revision === null ||
        revision.documentId !==
          documentId
      ) {
        throw new Error(
          `Missing current revision for document ${documentId}`,
        );
      }
      return revision;
    },
    getRevision: async (
      revisionId:
        EntityId<"DocumentRevision">,
    ): Promise<
      DocumentRevision | null
    > => {
      assertOpen();
      return readRevision(
        database,
        revisionId,
      );
    },
    materialize: async (
      revisionId:
        EntityId<"DocumentRevision">,
    ): Promise<string> => {
      assertOpen();
      const revision =
        readRevision(
          database,
          revisionId,
        );
      if (revision === null) {
        throw new Error(
          `Unknown revision: ${revisionId}`,
        );
      }
      const address =
        options.blobProfile
          .addressForBlobRef(
            revision.contentRef,
          );
      if (
        options.blobProfile
          .blobRefForAddress(
            address,
          ) !== revision.contentRef
      ) {
        throw new BlobContentMismatchError(
          "Stored revision blobRef/address mapping does not round-trip exactly",
        );
      }
      const manifestRows =
        queryRows(
          database,
          MANIFEST_SELECT_SQL,
          [revision.contentRef],
        );
      if (
        manifestRows.length !== 1 ||
        manifestRows[0] ===
          undefined
      ) {
        throw new Error(
          `Missing blob manifest for revision ${revisionId}`,
        );
      }
      const manifest =
        manifestRows[0];
      const manifestAddress =
        Object.freeze({
          checksumIdentity:
            readRequiredString(
              manifest,
              "checksumIdentity",
              "Blob manifest lookup",
            ),
          checksumValue:
            readRequiredString(
              manifest,
              "checksumValue",
              "Blob manifest lookup",
            ),
        });
      if (
        !sameAddress(
          address,
          manifestAddress,
        )
      ) {
        throw new BlobContentMismatchError(
          "Stored revision address does not match its exact manifest",
        );
      }
      const physical =
        await options.blobStore
          .readExact(address);
      const manifestByteLength =
        readNonNegativeSafeInteger(
          manifest,
          "byteLength",
          "Blob manifest lookup",
        );
      if (
        !sameAddress(
          physical.address,
          manifestAddress,
        ) ||
        physical.byteLength !==
          manifestByteLength
      ) {
        throw new BlobContentMismatchError(
          "Physical revision blob length does not match its exact manifest",
        );
      }
      const content =
        options.blobProfile
          .codec.decode(
            physical.bytes,
          );
      const reencoded =
        Uint8Array.from(
          options.blobProfile
            .codec.encode(content),
        );
      const descriptor =
        options.blobProfile
          .codec.describe(content);
      assertDescriptor(descriptor);
      if (
        !sameBytes(
          reencoded,
          physical.bytes,
        ) ||
        descriptor.contentHash !==
          revision.contentHash ||
        descriptor.length !==
          revision.length
      ) {
        throw new BlobContentMismatchError(
          "Materialized revision content does not match its exact stored descriptor",
        );
      }
      return content;
    },
  });
}

function writeRevisionAdvanceInTransaction(
  database: NodeSqliteDatabase,
  input: AppendRevisionInput,
  published: PublishedRevisionBlob,
): DocumentRevision {
  const pointer = readDocumentPointerState(database, input.documentId);
  if (pointer === null) {
    throw new Error(`Unknown document: ${input.documentId}`);
  }
  if (pointer.workId !== input.workId) {
    throw new Error(
      `Work/document boundary violation: ${input.workId}/${input.documentId}`,
    );
  }
  if (pointer.currentRevisionId !== input.expectedCurrentRevisionId) {
    throw new Error(`Revision conflict for document ${input.documentId}`);
  }
  if (readRevision(database, input.revisionId) !== null) {
    throw new Error(`Duplicate revision identity: ${input.revisionId}`);
  }
  insertOrVerifyManifest(database, published);
  const committedRevision = createCommittedRevision(input, published);
  writeLedgerRecord(database, {
    kind: "documentRevision",
    id: committedRevision.id,
    workId: input.workId,
    documentId: committedRevision.documentId,
    ...(committedRevision.parentRevisionId === undefined
      ? {}
      : { parentRevisionId: committedRevision.parentRevisionId }),
    contentRef: committedRevision.contentRef,
    contentHash: committedRevision.contentHash,
    length: committedRevision.length,
    ...(committedRevision.changeSetRef === undefined
      ? {}
      : { changeSetRef: committedRevision.changeSetRef }),
    cause: committedRevision.cause,
    createdAt: committedRevision.createdAt,
    durableAt: committedRevision.durableAt,
  });
  if (input.editorStateJson !== undefined) {
    runStatement(
      database,
      `
        INSERT INTO document_revision_editor_states (
          revision_id,
          work_id,
          document_id,
          editor_state_json
        ) VALUES (?, ?, ?, ?)
      `,
      [
        committedRevision.id,
        input.workId,
        input.documentId,
        input.editorStateJson,
      ],
    );
  }
  runStatement(
    database,
    `
      UPDATE manuscripts
      SET
        current_revision_id = ?,
        durable_revision_id = ?,
        updated_at = ?
      WHERE
        id = ?
        AND work_id = ?
        AND document_id = ?
        AND current_revision_id = ?
    `,
    [
      committedRevision.id,
      committedRevision.id,
      committedRevision.durableAt,
      pointer.manuscriptId,
      input.workId,
      input.documentId,
      pointer.currentRevisionId,
    ],
  );
  const updatedPointer = readDocumentPointerState(database, input.documentId);
  if (
    updatedPointer === null ||
    updatedPointer.workId !== input.workId ||
    updatedPointer.manuscriptId !== pointer.manuscriptId ||
    updatedPointer.currentRevisionId !== committedRevision.id ||
    updatedPointer.durableRevisionId !== committedRevision.id
  ) {
    throw new Error("Episode move revision pointers were not updated atomically");
  }
  return committedRevision;
}

function writePreparedEpisodeSegment(
  database: NodeSqliteDatabase,
  input: CommitEpisodeRangeMoveInput,
  segment: CommitEpisodeRangeMoveInput["createdSegments"][number],
): void {
  const anchor = segment.anchor;
  writeLedgerRecord(database, {
    kind: "anchor",
    id: anchor.meta.id,
    schemaVersion: anchor.meta.schemaVersion,
    revision: anchor.meta.revision,
    createdAt: anchor.meta.createdAt,
    updatedAt: anchor.meta.updatedAt,
    ...(anchor.meta.retiredAt === undefined
      ? {}
      : { retiredAt: anchor.meta.retiredAt }),
    workId: input.workId,
    documentId: anchor.documentId,
    originRevisionId: anchor.originRevisionId,
    resolvedRevisionId: anchor.resolvedRevisionId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    exactQuote: anchor.exactQuote,
    prefixContext: anchor.prefixContext,
    suffixContext: anchor.suffixContext,
    quoteHash: anchor.quoteHash,
    contextHash: anchor.contextHash,
    ...(anchor.lineageRef === undefined ? {} : { lineageRef: anchor.lineageRef }),
    status: anchor.status,
    resolutionEvidenceJson: JSON.stringify(anchor.resolutionEvidence),
  });
  runStatement(
    database,
    `
      INSERT INTO scene_episode_segments (
        id,
        schema_version,
        revision,
        created_at,
        updated_at,
        retired_at,
        work_id,
        scene_id,
        document_id,
        anchor_id
      ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, ?, ?)
    `,
    [
      segment.segmentId,
      input.sourceRevision.createdAt,
      input.sourceRevision.createdAt,
      input.workId,
      segment.sceneId,
      anchor.documentId,
      anchor.meta.id,
    ],
  );
}

function changedRows(result: unknown): number {
  if (
    typeof result !== "object" ||
    result === null ||
    !("changes" in result)
  ) {
    return 0;
  }
  const changes = (result as { readonly changes?: unknown }).changes;
  return typeof changes === "bigint" || typeof changes === "number"
    ? Number(changes)
    : 0;
}

function parseStoredIdArray<TKind extends string>(
  value: string,
  label: string,
): readonly EntityId<TKind>[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be an array`);
  }
  const ids = parsed.map((candidate, index) => {
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return entityId<TKind>(candidate);
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} must contain unique identities`);
  }
  return Object.freeze(ids);
}

function createNodeSqliteEpisodeRangeMoveStore(
  database: NodeSqliteDatabase,
  assertOpen: () => void,
  options: NodeSqliteRevisionStoreOptions,
): EpisodeRangeMoveStore {
  const publishPair = async (
    source: AppendRevisionInput,
    target: AppendRevisionInput,
  ) => Promise.all([
    publishRevisionBlob(source, options),
    publishRevisionBlob(target, options),
  ] as const);

  return Object.freeze({
    commit: async (
      input: CommitEpisodeRangeMoveInput,
    ): Promise<EpisodeRangeMoveStoreReceipt> => {
      assertOpen();
      if (
        input.sourceEpisodeId === input.targetEpisodeId ||
        input.sourceRevision.documentId !== input.sourceEpisodeId ||
        input.targetRevision.documentId !== input.targetEpisodeId ||
        input.sourceRevision.workId !== input.workId ||
        input.targetRevision.workId !== input.workId ||
        input.sourceRevision.expectedCurrentRevisionId === null ||
        input.targetRevision.expectedCurrentRevisionId === null
      ) {
        throw new Error("Episode move revision ownership is invalid");
      }
      const [sourcePublished, targetPublished] = await publishPair(
        input.sourceRevision,
        input.targetRevision,
      );
      database.exec("BEGIN IMMEDIATE");
      let transactionActive = true;
      try {
        const sourceRevision = writeRevisionAdvanceInTransaction(
          database,
          input.sourceRevision,
          sourcePublished,
        );
        const targetRevision = writeRevisionAdvanceInTransaction(
          database,
          input.targetRevision,
          targetPublished,
        );
        const changedAt = input.sourceRevision.createdAt;
        for (const sceneId of input.createdSceneIds) {
          runStatement(
            database,
            `
              INSERT INTO scene_identities (
                id, schema_version, revision, created_at, updated_at,
                retired_at, work_id
              ) VALUES (?, 1, 1, ?, ?, NULL, ?)
            `,
            [sceneId, changedAt, changedAt, input.workId],
          );
        }
        for (const segmentId of input.retiredSegmentIds) {
          const result = database.prepare(`
            UPDATE scene_episode_segments
            SET revision = revision + 1, updated_at = ?, retired_at = ?
            WHERE id = ? AND work_id = ? AND retired_at IS NULL
          `).run(changedAt, changedAt, segmentId, input.workId);
          if (changedRows(result) !== 1) {
            throw new Error(`Scene segment changed before move: ${segmentId}`);
          }
        }
        for (const segment of input.createdSegments) {
          writePreparedEpisodeSegment(database, input, segment);
        }
        const sceneIds = Object.freeze([
          ...new Set(input.createdSegments.map((segment) => segment.sceneId)),
        ]);
        runStatement(
          database,
          `
            INSERT INTO episode_range_moves (
              id, schema_version, revision, created_at, updated_at, undone_at,
              work_id, source_document_id, target_document_id,
              from_offset, to_offset, placement,
              source_before_revision_id, target_before_revision_id,
              source_after_revision_id, target_after_revision_id,
              created_scene_ids_json, scene_ids_json,
              created_segment_ids_json, retired_segment_ids_json, status
            ) VALUES (
              ?, 1, 1, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              'active'
            )
          `,
          [
            input.moveId,
            changedAt,
            changedAt,
            input.workId,
            input.sourceEpisodeId,
            input.targetEpisodeId,
            input.from,
            input.to,
            input.placement,
            input.sourceRevision.expectedCurrentRevisionId,
            input.targetRevision.expectedCurrentRevisionId,
            sourceRevision.id,
            targetRevision.id,
            JSON.stringify(input.createdSceneIds),
            JSON.stringify(sceneIds),
            JSON.stringify(input.createdSegments.map((segment) => segment.segmentId)),
            JSON.stringify(input.retiredSegmentIds),
          ],
        );
        await options.beforeDatabaseCommit?.();
        database.exec("COMMIT");
        transactionActive = false;
        return Object.freeze({
          sourceRevision,
          targetRevision,
          sceneIds,
          sourceEpisodeId: input.sourceEpisodeId,
          targetEpisodeId: input.targetEpisodeId,
        });
      } catch (error) {
        if (transactionActive) database.exec("ROLLBACK");
        throw error;
      }
    },
    undo: async (
      input: UndoEpisodeRangeMoveInput,
    ): Promise<EpisodeRangeMoveStoreReceipt> => {
      assertOpen();
      const rows = database.prepare(`
        SELECT
          source_document_id AS "sourceEpisodeId",
          target_document_id AS "targetEpisodeId",
          created_scene_ids_json AS "createdSceneIdsJson",
          scene_ids_json AS "sceneIdsJson",
          created_segment_ids_json AS "createdSegmentIdsJson",
          retired_segment_ids_json AS "retiredSegmentIdsJson",
          status
        FROM episode_range_moves
        WHERE id = ? AND work_id = ?
      `).all(input.moveId, input.workId);
      if (rows.length !== 1) {
        throw new Error(`Unknown Episode range move: ${input.moveId}`);
      }
      const row = rows[0] ?? {};
      const sourceEpisodeId = entityId<"Document">(
        readRequiredString(row, "sourceEpisodeId", "Episode range move row"),
      );
      const targetEpisodeId = entityId<"Document">(
        readRequiredString(row, "targetEpisodeId", "Episode range move row"),
      );
      if (
        readRequiredString(row, "status", "Episode range move row") !== "active" ||
        input.sourceRevision.documentId !== sourceEpisodeId ||
        input.targetRevision.documentId !== targetEpisodeId ||
        input.sourceRevision.workId !== input.workId ||
        input.targetRevision.workId !== input.workId
      ) {
        throw new Error(`Episode range move is not undoable: ${input.moveId}`);
      }
      const createdSceneIds = parseStoredIdArray<"Scene">(
        readRequiredString(row, "createdSceneIdsJson", "Episode range move row"),
        "Episode range move created Scene identities",
      );
      const sceneIds = parseStoredIdArray<"Scene">(
        readRequiredString(row, "sceneIdsJson", "Episode range move row"),
        "Episode range move Scene identities",
      );
      const createdSegmentIds = parseStoredIdArray<"EpisodeSceneSegment">(
        readRequiredString(row, "createdSegmentIdsJson", "Episode range move row"),
        "Episode range move created segments",
      );
      const retiredSegmentIds = parseStoredIdArray<"EpisodeSceneSegment">(
        readRequiredString(row, "retiredSegmentIdsJson", "Episode range move row"),
        "Episode range move retired segments",
      );
      const [sourcePublished, targetPublished] = await publishPair(
        input.sourceRevision,
        input.targetRevision,
      );
      database.exec("BEGIN IMMEDIATE");
      let transactionActive = true;
      try {
        const sourceRevision = writeRevisionAdvanceInTransaction(
          database,
          input.sourceRevision,
          sourcePublished,
        );
        const targetRevision = writeRevisionAdvanceInTransaction(
          database,
          input.targetRevision,
          targetPublished,
        );
        const changedAt = input.sourceRevision.createdAt;
        for (const segmentId of createdSegmentIds) {
          const result = database.prepare(`
            UPDATE scene_episode_segments
            SET revision = revision + 1, updated_at = ?, retired_at = ?
            WHERE id = ? AND work_id = ? AND retired_at IS NULL
          `).run(changedAt, changedAt, segmentId, input.workId);
          if (changedRows(result) !== 1) {
            throw new Error(`Created Scene segment changed before undo: ${segmentId}`);
          }
        }
        for (const segmentId of retiredSegmentIds) {
          const result = database.prepare(`
            UPDATE scene_episode_segments
            SET revision = revision + 1, updated_at = ?, retired_at = NULL
            WHERE id = ? AND work_id = ? AND retired_at IS NOT NULL
          `).run(changedAt, segmentId, input.workId);
          if (changedRows(result) !== 1) {
            throw new Error(`Prior Scene segment changed before undo: ${segmentId}`);
          }
        }
        for (const sceneId of createdSceneIds) {
          const result = database.prepare(`
            UPDATE scene_identities
            SET revision = revision + 1, updated_at = ?, retired_at = ?
            WHERE id = ? AND work_id = ? AND retired_at IS NULL
          `).run(changedAt, changedAt, sceneId, input.workId);
          if (changedRows(result) !== 1) {
            throw new Error(`Created Scene identity changed before undo: ${sceneId}`);
          }
        }
        const moveUpdate = database.prepare(`
          UPDATE episode_range_moves
          SET
            revision = revision + 1,
            updated_at = ?,
            undone_at = ?,
            status = 'undone'
          WHERE id = ? AND work_id = ? AND status = 'active'
        `).run(changedAt, changedAt, input.moveId, input.workId);
        if (changedRows(moveUpdate) !== 1) {
          throw new Error(`Episode range move changed before undo: ${input.moveId}`);
        }
        await options.beforeDatabaseCommit?.();
        database.exec("COMMIT");
        transactionActive = false;
        return Object.freeze({
          sourceRevision,
          targetRevision,
          sceneIds,
          sourceEpisodeId,
          targetEpisodeId,
        });
      } catch (error) {
        if (transactionActive) database.exec("ROLLBACK");
        throw error;
      }
    },
  });
}

function readStringValue(
  row: Readonly<
    Record<string, unknown>
  >,
  column: string,
  label: string,
): string {
  const value = row[column];
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `${label} returned an invalid ${column}`,
    );
  }
  return value;
}

function recordMetaFromRow<
  TEntity extends string,
>(
  row: Readonly<
    Record<string, unknown>
  >,
  label: string,
): RecordMeta<TEntity> {
  const retiredAt =
    readNullableString(
      row,
      "retiredAt",
      label,
    );
  return Object.freeze({
    id: entityId<TEntity>(
      readRequiredString(
        row,
        "id",
        label,
      ),
    ),
    schemaVersion:
      readNonNegativeSafeInteger(
        row,
        "schemaVersion",
        label,
      ),
    revision:
      readNonNegativeSafeInteger(
        row,
        "revision",
        label,
      ),
    createdAt:
      readStringValue(
        row,
        "createdAt",
        label,
      ),
    updatedAt:
      readStringValue(
        row,
        "updatedAt",
        label,
      ),
    ...(retiredAt === null
      ? {}
      : { retiredAt }),
  });
}

function readJsonRecord(
  value: unknown,
  label: string,
): Readonly<
  Record<string, unknown>
> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object`,
    );
  }
  return value as Readonly<
    Record<string, unknown>
  >;
}

function assertExactJsonFields(
  input: Readonly<
    Record<string, unknown>
  >,
  required:
    readonly string[],
  optional:
    readonly string[],
  label: string,
): void {
  const supported =
    new Set([
      ...required,
      ...optional,
    ]);
  for (
    const field of Object.keys(
      input,
    )
  ) {
    if (
      !supported.has(field)
    ) {
      throw new Error(
        `${label} contains unsupported field ${field}`,
      );
    }
  }
  for (
    const field of required
  ) {
    if (
      !(field in input)
    ) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
}

function readJsonString(
  input: Readonly<
    Record<string, unknown>
  >,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `${label}.${field} must be a string`,
    );
  }
  return value;
}

function anchorStatusFromString(
  value: string,
): AnchorStatus {
  switch (value) {
    case "resolved":
    case "needsReview":
    case "broken":
    case "retired":
      return value;
    default:
      throw new Error(
        "Anchor lookup returned an invalid status",
      );
  }
}

function anchorResolutionMethodFromValue(
  value: unknown,
): AnchorResolutionMethod {
  switch (value) {
    case "created":
    case "exact-offset":
    case "context-match":
    case "unique-quote":
      return value;
    default:
      throw new Error(
        "Anchor resolution evidence returned an invalid method",
      );
  }
}

function anchorMatchedEvidenceFromValue(
  value: unknown,
): AnchorMatchedEvidence {
  switch (value) {
    case "origin-revision":
    case "quote":
    case "prefix-context":
    case "suffix-context":
      return value;
    default:
      throw new Error(
        "Anchor resolution evidence returned invalid matched evidence",
      );
  }
}

function parseAnchorResolutionEvidence(
  json: string,
): AnchorResolutionEvidence {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "Anchor resolution evidence is not valid JSON",
    );
  }
  const label =
    "Anchor resolution evidence";
  const input =
    readJsonRecord(
      parsed,
      label,
    );
  assertExactJsonFields(
    input,
    [
      "targetRevisionId",
      "method",
      "matchedEvidence",
      "candidateOffsets",
      "policyVersion",
      "assessedAt",
    ],
    [
      "commandRef",
      "actorRef",
    ],
    label,
  );
  const matchedEvidence =
    input.matchedEvidence;
  if (
    !Array.isArray(
      matchedEvidence,
    )
  ) {
    throw new Error(
      `${label}.matchedEvidence must be an array`,
    );
  }
  const candidateOffsets =
    input.candidateOffsets;
  if (
    !Array.isArray(
      candidateOffsets,
    ) ||
    candidateOffsets.some(
      (value) =>
        typeof value !==
          "number" ||
        !Number.isSafeInteger(
          value,
        ) ||
        value < 0,
    )
  ) {
    throw new Error(
      `${label}.candidateOffsets must contain non-negative safe integers`,
    );
  }
  const commandRef =
    input.commandRef;
  const actorRef =
    input.actorRef;
  if (
    commandRef !== undefined &&
    typeof commandRef !==
      "string"
  ) {
    throw new Error(
      `${label}.commandRef must be a string`,
    );
  }
  if (
    actorRef !== undefined &&
    typeof actorRef !==
      "string"
  ) {
    throw new Error(
      `${label}.actorRef must be a string`,
    );
  }
  return Object.freeze({
    targetRevisionId:
      entityId<"DocumentRevision">(
        readJsonString(
          input,
          "targetRevisionId",
          label,
        ),
      ),
    method:
      anchorResolutionMethodFromValue(
        input.method,
      ),
    matchedEvidence:
      Object.freeze(
        matchedEvidence.map(
          (value) =>
            anchorMatchedEvidenceFromValue(
              value,
            ),
        ),
      ),
    candidateOffsets:
      Object.freeze([
        ...candidateOffsets,
      ]),
    policyVersion:
      readJsonString(
        input,
        "policyVersion",
        label,
      ),
    assessedAt:
      readJsonString(
        input,
        "assessedAt",
        label,
      ),
    ...(commandRef ===
    undefined
      ? {}
      : { commandRef }),
    ...(actorRef === undefined
      ? {}
      : { actorRef }),
  });
}

function parseContextReferences(
  json: string,
): readonly ContextReference[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "ResumeCheckpoint context references are not valid JSON",
    );
  }
  if (
    !Array.isArray(parsed)
  ) {
    throw new Error(
      "ResumeCheckpoint context references must be an array",
    );
  }
  return Object.freeze(
    parsed.map(
      (value, index) => {
        const label =
          `ResumeCheckpoint context reference ${index}`;
        const input =
          readJsonRecord(
            value,
            label,
          );
        assertExactJsonFields(
          input,
          [
            "entityType",
            "entityId",
          ],
          [],
          label,
        );
        return Object.freeze({
          entityType:
            readJsonString(
              input,
              "entityType",
              label,
            ),
          entityId:
            readJsonString(
              input,
              "entityId",
              label,
            ),
        });
      },
    ),
  );
}

function parseCustomFields(
  json: string,
): Readonly<
  Record<string, unknown>
> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "Work custom fields are not valid JSON",
    );
  }
  return Object.freeze({
    ...readJsonRecord(
      parsed,
      "Work custom fields",
    ),
  });
}

const WORK_SELECT_SQL = `
SELECT
  id AS "id",
  schema_version AS "schemaVersion",
  revision AS "revision",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  studio_id AS "studioId",
  title AS "title",
  subtitle AS "subtitle",
  kind_ref AS "kindRef",
  status_ref AS "statusRef",
  order_key AS "orderKey",
  resume_checkpoint_id AS "resumeCheckpointId",
  settings_id AS "settingsId",
  custom_fields_json AS "customFieldsJson"
FROM works
`;

function workFromRow(
  row: Readonly<
    Record<string, unknown>
  >,
): Work {
  const label = "Work lookup";
  const subtitle =
    readNullableString(
      row,
      "subtitle",
      label,
    );
  const kindRef =
    readNullableString(
      row,
      "kindRef",
      label,
    );
  const statusRef =
    readNullableString(
      row,
      "statusRef",
      label,
    );
  const resumeCheckpointId =
    readNullableString(
      row,
      "resumeCheckpointId",
      label,
    );
  const customFieldsJson =
    readNullableString(
      row,
      "customFieldsJson",
      label,
    );
  return Object.freeze({
    meta:
      recordMetaFromRow<"Work">(
        row,
        label,
      ),
    studioId:
      entityId<"Studio">(
        readRequiredString(
          row,
          "studioId",
          label,
        ),
      ),
    title:
      readStringValue(
        row,
        "title",
        label,
      ),
    ...(subtitle === null
      ? {}
      : { subtitle }),
    ...(kindRef === null
      ? {}
      : {
          kindRef:
            entityId<"DictionaryValue">(
              kindRef,
            ),
        }),
    ...(statusRef === null
      ? {}
      : {
          statusRef:
            entityId<"DictionaryValue">(
              statusRef,
            ),
        }),
    orderKey:
      readStringValue(
        row,
        "orderKey",
        label,
      ),
    ...(resumeCheckpointId ===
    null
      ? {}
      : {
          resumeCheckpointId:
            entityId<"ResumeCheckpoint">(
              resumeCheckpointId,
            ),
        }),
    settingsId:
      entityId<"WorkSettings">(
        readRequiredString(
          row,
          "settingsId",
          label,
        ),
      ),
    ...(customFieldsJson ===
    null
      ? {}
      : {
          customFields:
            parseCustomFields(
              customFieldsJson,
            ),
        }),
  });
}

function readWork(
  database: NodeSqliteDatabase,
  workId: string,
): Work | null {
  const rows = queryRows(
    database,
    `${WORK_SELECT_SQL}
     WHERE id = ?`,
    [workId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (
    rows.length !== 1 ||
    rows[0] === undefined
  ) {
    throw new Error(
      "Work lookup returned an invalid result",
    );
  }
  return workFromRow(
    rows[0],
  );
}

const ANCHOR_SELECT_SQL = `
SELECT
  id AS "id",
  schema_version AS "schemaVersion",
  revision AS "revision",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  document_id AS "documentId",
  origin_revision_id AS "originRevisionId",
  resolved_revision_id AS "resolvedRevisionId",
  start_offset AS "startOffset",
  end_offset AS "endOffset",
  exact_quote AS "exactQuote",
  prefix_context AS "prefixContext",
  suffix_context AS "suffixContext",
  quote_hash AS "quoteHash",
  context_hash AS "contextHash",
  lineage_ref AS "lineageRef",
  status AS "status",
  resolution_evidence_json AS "resolutionEvidenceJson"
FROM anchors
`;

function anchorFromRow(
  row: Readonly<
    Record<string, unknown>
  >,
): Anchor {
  const label =
    "Anchor lookup";
  const lineageRef =
    readNullableString(
      row,
      "lineageRef",
      label,
    );
  return Object.freeze({
    meta:
      recordMetaFromRow<"Anchor">(
        row,
        label,
      ),
    documentId:
      entityId<"Document">(
        readRequiredString(
          row,
          "documentId",
          label,
        ),
      ),
    originRevisionId:
      entityId<"DocumentRevision">(
        readRequiredString(
          row,
          "originRevisionId",
          label,
        ),
      ),
    resolvedRevisionId:
      entityId<"DocumentRevision">(
        readRequiredString(
          row,
          "resolvedRevisionId",
          label,
        ),
      ),
    startOffset:
      readNonNegativeSafeInteger(
        row,
        "startOffset",
        label,
      ),
    endOffset:
      readNonNegativeSafeInteger(
        row,
        "endOffset",
        label,
      ),
    exactQuote:
      readStringValue(
        row,
        "exactQuote",
        label,
      ),
    prefixContext:
      readStringValue(
        row,
        "prefixContext",
        label,
      ),
    suffixContext:
      readStringValue(
        row,
        "suffixContext",
        label,
      ),
    quoteHash:
      readStringValue(
        row,
        "quoteHash",
        label,
      ),
    contextHash:
      readStringValue(
        row,
        "contextHash",
        label,
      ),
    ...(lineageRef === null
      ? {}
      : {
          lineageRef:
            entityId<"AnchorLineage">(
              lineageRef,
            ),
        }),
    status:
      anchorStatusFromString(
        readStringValue(
          row,
          "status",
          label,
        ),
      ),
    resolutionEvidence:
      parseAnchorResolutionEvidence(
        readStringValue(
          row,
          "resolutionEvidenceJson",
          label,
        ),
      ),
  });
}

function readAnchor(
  database: NodeSqliteDatabase,
  anchorId: string,
): Anchor | null {
  const rows = queryRows(
    database,
    `${ANCHOR_SELECT_SQL}
     WHERE id = ?`,
    [anchorId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (
    rows.length !== 1 ||
    rows[0] === undefined
  ) {
    throw new Error(
      "Anchor lookup returned an invalid result",
    );
  }
  return anchorFromRow(
    rows[0],
  );
}

const CHECKPOINT_SELECT_SQL = `
SELECT
  id AS "id",
  schema_version AS "schemaVersion",
  revision AS "revision",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  work_id AS "workId",
  document_id AS "documentId",
  document_revision_id AS "documentRevisionId",
  cursor_anchor_id AS "cursorAnchorId",
  selection_anchor_id AS "selectionAnchorId",
  workspace_mode AS "workspaceMode",
  context_refs_json AS "contextRefsJson",
  focus_checkpoint_id AS "focusCheckpointId",
  music_checkpoint_id AS "musicCheckpointId",
  captured_at AS "capturedAt"
FROM resume_checkpoints
`;

function checkpointFromRow(
  row: Readonly<
    Record<string, unknown>
  >,
): ResumeCheckpoint {
  const label =
    "ResumeCheckpoint lookup";
  const selectionAnchorId =
    readNullableString(
      row,
      "selectionAnchorId",
      label,
    );
  const contextRefsJson =
    readNullableString(
      row,
      "contextRefsJson",
      label,
    );
  const focusCheckpointId =
    readNullableString(
      row,
      "focusCheckpointId",
      label,
    );
  const musicCheckpointId =
    readNullableString(
      row,
      "musicCheckpointId",
      label,
    );
  return Object.freeze({
    meta:
      recordMetaFromRow<
        "ResumeCheckpoint"
      >(
        row,
        label,
      ),
    workId:
      entityId<"Work">(
        readRequiredString(
          row,
          "workId",
          label,
        ),
      ),
    documentId:
      entityId<"Document">(
        readRequiredString(
          row,
          "documentId",
          label,
        ),
      ),
    documentRevisionId:
      entityId<"DocumentRevision">(
        readRequiredString(
          row,
          "documentRevisionId",
          label,
        ),
      ),
    cursorAnchorId:
      entityId<"Anchor">(
        readRequiredString(
          row,
          "cursorAnchorId",
          label,
        ),
      ),
    ...(selectionAnchorId ===
    null
      ? {}
      : {
          selectionAnchorId:
            entityId<"Anchor">(
              selectionAnchorId,
            ),
        }),
    workspaceMode:
      readStringValue(
        row,
        "workspaceMode",
        label,
      ),
    ...(contextRefsJson ===
    null
      ? {}
      : {
          contextRefs:
            parseContextReferences(
              contextRefsJson,
            ),
        }),
    ...(focusCheckpointId ===
    null
      ? {}
      : {
          focusCheckpointId:
            entityId<"FocusCheckpoint">(
              focusCheckpointId,
            ),
        }),
    ...(musicCheckpointId ===
    null
      ? {}
      : {
          musicCheckpointId:
            entityId<"MusicCheckpoint">(
              musicCheckpointId,
            ),
        }),
    capturedAt:
      readStringValue(
        row,
        "capturedAt",
        label,
      ),
  });
}

function readCheckpoint(
  database: NodeSqliteDatabase,
  checkpointId: string,
): ResumeCheckpoint | null {
  const rows = queryRows(
    database,
    `${CHECKPOINT_SELECT_SQL}
     WHERE id = ?`,
    [checkpointId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (
    rows.length !== 1 ||
    rows[0] === undefined
  ) {
    throw new Error(
      "ResumeCheckpoint lookup returned an invalid result",
    );
  }
  return checkpointFromRow(
    rows[0],
  );
}

const RAW_PRESERVED_ITEM_SELECT_SQL = `
SELECT
  id AS "id",
  batch_id AS "batchId",
  source_snapshot_id AS "sourceSnapshotId",
  source_collection AS "sourceCollection",
  source_identity AS "sourceIdentity",
  source_occurrence AS "sourceOccurrence",
  serialization_identity AS "serializationIdentity",
  raw_bytes AS "rawBytes",
  checksum_identity AS "checksumIdentity",
  checksum_value AS "checksumValue",
  byte_length AS "byteLength",
  mapper_version AS "mapperVersion",
  created_at AS "createdAt"
FROM raw_preserved_items
`;

function readRawPreservedItem(
  database: NodeSqliteDatabase,
  rawItemId: string,
): Poc3RawPreservedItemRecord | null {
  const rows = database
    .prepare(
      `${RAW_PRESERVED_ITEM_SELECT_SQL}
       WHERE id = ?`,
    )
    .all(rawItemId);
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new Error("RawPreservedItem lookup returned an invalid result");
  }
  const row = rows[0];
  const label = "RawPreservedItem lookup";
  return Object.freeze({
    kind: "rawPreservedItem",
    id: readRequiredString(row, "id", label),
    batchId: readRequiredString(row, "batchId", label),
    sourceSnapshotId: readRequiredString(row, "sourceSnapshotId", label),
    sourceCollection: readRequiredString(row, "sourceCollection", label),
    sourceIdentity: readRequiredString(row, "sourceIdentity", label),
    sourceOccurrence: readNonNegativeSafeInteger(
      row,
      "sourceOccurrence",
      label,
    ),
    serializationIdentity: readRequiredString(
      row,
      "serializationIdentity",
      label,
    ),
    rawBytes: readRequiredBytes(row, "rawBytes", label),
    checksumIdentity: readRequiredString(row, "checksumIdentity", label),
    checksumValue: readRequiredString(row, "checksumValue", label),
    byteLength: readNonNegativeSafeInteger(row, "byteLength", label),
    mapperVersion: readRequiredString(row, "mapperVersion", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

const MIGRATION_DECISION_SELECT_SQL = `
SELECT
  id AS "id",
  batch_id AS "batchId",
  source_snapshot_id AS "sourceSnapshotId",
  source_collection AS "sourceCollection",
  source_identity AS "sourceIdentity",
  command_kind AS "commandKind",
  decision_payload_json AS "decisionPayloadJson",
  decided_at AS "decidedAt",
  actor_ref AS "actorRef"
FROM migration_decisions
`;

function readMigrationDecision(
  database: NodeSqliteDatabase,
  decisionId: string,
): Poc3MigrationDecisionRecord | null {
  const rows = queryRows(
    database,
    `${MIGRATION_DECISION_SELECT_SQL}
     WHERE id = ?`,
    [decisionId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new Error("MigrationDecision lookup returned an invalid result");
  }
  const row = rows[0];
  const label = "MigrationDecision lookup";
  return Object.freeze({
    kind: "migrationDecision",
    id: readRequiredString(row, "id", label),
    batchId: readRequiredString(row, "batchId", label),
    sourceSnapshotId: readRequiredString(row, "sourceSnapshotId", label),
    sourceCollection: readRequiredString(row, "sourceCollection", label),
    sourceIdentity: readRequiredString(row, "sourceIdentity", label),
    commandKind: readRequiredString(row, "commandKind", label),
    decisionPayloadJson: readRequiredString(
      row,
      "decisionPayloadJson",
      label,
    ),
    decidedAt: readRequiredString(row, "decidedAt", label),
    actorRef: readRequiredString(row, "actorRef", label),
  });
}

function normalizeJsonValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      normalizeJsonValue,
    );
  }
  if (
    typeof value === "object" &&
    value !== null
  ) {
    const normalized:
      Record<string, unknown> =
      {};
    for (
      const key of Object.keys(
        value,
      ).sort()
    ) {
      const fieldValue = (
        value as Readonly<
          Record<string, unknown>
        >
      )[key];
      if (
        fieldValue !== undefined
      ) {
        normalized[key] =
          normalizeJsonValue(
            fieldValue,
          );
      }
    }
    return normalized;
  }
  return value;
}

function sameDomainPayload(
  left: unknown,
  right: unknown,
): boolean {
  return (
    JSON.stringify(
      normalizeJsonValue(left),
    ) ===
    JSON.stringify(
      normalizeJsonValue(right),
    )
  );
}

function resolutionEvidenceJson(
  evidence:
    AnchorResolutionEvidence,
): string {
  return JSON.stringify({
    targetRevisionId:
      evidence.targetRevisionId,
    method: evidence.method,
    matchedEvidence: [
      ...evidence.matchedEvidence,
    ],
    candidateOffsets: [
      ...evidence.candidateOffsets,
    ],
    policyVersion:
      evidence.policyVersion,
    assessedAt:
      evidence.assessedAt,
    ...(evidence.commandRef ===
    undefined
      ? {}
      : {
          commandRef:
            evidence.commandRef,
        }),
    ...(evidence.actorRef ===
    undefined
      ? {}
      : {
          actorRef:
            evidence.actorRef,
        }),
  });
}

function contextReferencesJson(
  contextRefs:
    readonly ContextReference[],
): string {
  return JSON.stringify(
    contextRefs.map(
      (contextRef) => ({
        entityType:
          contextRef.entityType,
        entityId:
          contextRef.entityId,
      }),
    ),
  );
}

function anchorRecordForCapture(
  workId:
    EntityId<"Work">,
  anchor: Anchor,
): Poc3AnchorRecord {
  return {
    kind: "anchor",
    id: anchor.meta.id,
    schemaVersion:
      anchor.meta.schemaVersion,
    revision:
      anchor.meta.revision,
    createdAt:
      anchor.meta.createdAt,
    updatedAt:
      anchor.meta.updatedAt,
    ...(anchor.meta.retiredAt ===
    undefined
      ? {}
      : {
          retiredAt:
            anchor.meta.retiredAt,
        }),
    workId,
    documentId:
      anchor.documentId,
    originRevisionId:
      anchor.originRevisionId,
    resolvedRevisionId:
      anchor.resolvedRevisionId,
    startOffset:
      anchor.startOffset,
    endOffset:
      anchor.endOffset,
    exactQuote:
      anchor.exactQuote,
    prefixContext:
      anchor.prefixContext,
    suffixContext:
      anchor.suffixContext,
    quoteHash:
      anchor.quoteHash,
    contextHash:
      anchor.contextHash,
    ...(anchor.lineageRef ===
    undefined
      ? {}
      : {
          lineageRef:
            anchor.lineageRef,
        }),
    status: anchor.status,
    resolutionEvidenceJson:
      resolutionEvidenceJson(
        anchor
          .resolutionEvidence,
      ),
  };
}

function checkpointRecordForCapture(
  checkpoint:
    ResumeCheckpoint,
): Poc3ResumeCheckpointRecord {
  return {
    kind:
      "resumeCheckpoint",
    id: checkpoint.meta.id,
    schemaVersion:
      checkpoint.meta
        .schemaVersion,
    revision:
      checkpoint.meta.revision,
    createdAt:
      checkpoint.meta.createdAt,
    updatedAt:
      checkpoint.meta.updatedAt,
    ...(checkpoint.meta
      .retiredAt === undefined
      ? {}
      : {
          retiredAt:
            checkpoint.meta
              .retiredAt,
        }),
    workId:
      checkpoint.workId,
    documentId:
      checkpoint.documentId,
    documentRevisionId:
      checkpoint
        .documentRevisionId,
    cursorAnchorId:
      checkpoint.cursorAnchorId,
    ...(checkpoint
      .selectionAnchorId ===
    undefined
      ? {}
      : {
          selectionAnchorId:
            checkpoint
              .selectionAnchorId,
        }),
    workspaceMode:
      checkpoint.workspaceMode,
    ...(checkpoint.contextRefs ===
    undefined
      ? {}
      : {
          contextRefsJson:
            contextReferencesJson(
              checkpoint
                .contextRefs,
            ),
        }),
    ...(checkpoint
      .focusCheckpointId ===
    undefined
      ? {}
      : {
          focusCheckpointId:
            checkpoint
              .focusCheckpointId,
        }),
    ...(checkpoint
      .musicCheckpointId ===
    undefined
      ? {}
      : {
          musicCheckpointId:
            checkpoint
              .musicCheckpointId,
        }),
    capturedAt:
      checkpoint.capturedAt,
  };
}

function checkpointIdForWork(
  work: Work,
): EntityId<"ResumeCheckpoint"> | null {
  return (
    work.resumeCheckpointId ??
    null
  );
}

function assertPlatformAnchor(
  anchor: Anchor,
  checkpoint:
    ResumeCheckpoint,
  expectedRevisionId:
    EntityId<"DocumentRevision">,
  revisionLength: number,
  zeroWidth: boolean,
  label: string,
): void {
  if (
    anchor.documentId !==
      checkpoint.documentId
  ) {
    throw new Error(
      `${label} Anchor document does not match the checkpoint document`,
    );
  }
  if (
    anchor.originRevisionId !==
      expectedRevisionId ||
    anchor.resolvedRevisionId !==
      expectedRevisionId
  ) {
    throw new Error(
      `${label} Anchor revision does not match the expected durable revision`,
    );
  }
  if (
    !Number.isSafeInteger(
      anchor.startOffset,
    ) ||
    !Number.isSafeInteger(
      anchor.endOffset,
    ) ||
    anchor.startOffset < 0 ||
    anchor.endOffset < 0 ||
    anchor.startOffset >
      anchor.endOffset ||
    anchor.endOffset >
      revisionLength
  ) {
    throw new Error(
      `${label} Anchor range is outside the expected durable revision`,
    );
  }
  if (
    zeroWidth &&
    anchor.startOffset !==
      anchor.endOffset
  ) {
    throw new Error(
      "Cursor Anchor must be zero-width",
    );
  }
}

function uniqueCaptureAnchors(
  input:
    CommitResumeCheckpointWithAnchorsInput,
): readonly Anchor[] {
  if (
    input.selectionAnchor ===
    undefined
  ) {
    return Object.freeze([
      input.cursorAnchor,
    ]);
  }
  if (
    input.selectionAnchor.meta.id !==
      input.cursorAnchor.meta.id
  ) {
    return Object.freeze([
      input.cursorAnchor,
      input.selectionAnchor,
    ]);
  }
  if (
    !sameDomainPayload(
      input.cursorAnchor,
      input.selectionAnchor,
    )
  ) {
    throw new Error(
      `Anchor identity conflict: ${input.cursorAnchor.meta.id}`,
    );
  }
  return Object.freeze([
    input.cursorAnchor,
  ]);
}

function assertPlatformCapturePayload(
  input:
    CommitResumeCheckpointWithAnchorsInput,
  revisionLength: number,
): readonly Anchor[] {
  if (
    input.checkpoint
      .cursorAnchorId !==
    input.cursorAnchor.meta.id
  ) {
    throw new Error(
      "Checkpoint cursor Anchor reference does not match the supplied Anchor",
    );
  }
  if (
    (
      input.checkpoint
        .selectionAnchorId ??
      null
    ) !==
    (
      input.selectionAnchor
        ?.meta.id ??
      null
    )
  ) {
    throw new Error(
      "Checkpoint selection Anchor reference does not match the supplied Anchor",
    );
  }
  if (
    input.checkpoint
      .documentRevisionId !==
    input
      .expectedDocumentRevisionId
  ) {
    throw new Error(
      "Checkpoint revision does not match the expected durable revision",
    );
  }
  assertPlatformAnchor(
    input.cursorAnchor,
    input.checkpoint,
    input
      .expectedDocumentRevisionId,
    revisionLength,
    true,
    "Cursor",
  );
  if (
    input.selectionAnchor !==
    undefined
  ) {
    assertPlatformAnchor(
      input.selectionAnchor,
      input.checkpoint,
      input
        .expectedDocumentRevisionId,
      revisionLength,
      false,
      "Selection",
    );
  }
  return uniqueCaptureAnchors(
    input,
  );
}

function expectedNextWorkForCapture(
  currentWork: Work,
  checkpoint:
    ResumeCheckpoint,
): Work {
  return {
    ...currentWork,
    meta: {
      ...currentWork.meta,
      revision:
        currentWork.meta.revision +
        1,
      updatedAt:
        checkpoint.capturedAt,
    },
    resumeCheckpointId:
      checkpoint.meta.id,
  };
}

function updateWorkForCapture(
  database: NodeSqliteDatabase,
  input:
    CommitResumeCheckpointWithAnchorsInput,
): void {
  runStatement(
    database,
    `
      UPDATE works
      SET
        resume_checkpoint_id = ?,
        revision = ?,
        updated_at = ?
      WHERE
        id = ?
        AND revision = ?
        AND (
          (
            ? IS NULL
            AND resume_checkpoint_id IS NULL
          )
          OR resume_checkpoint_id = ?
        )
    `,
    [
      input.checkpoint.meta.id,
      input.nextWork.meta
        .revision,
      input.nextWork.meta
        .updatedAt,
      input.checkpoint.workId,
      input.expectedWorkRevision,
      input
        .expectedResumeCheckpointId,
      input
        .expectedResumeCheckpointId,
    ],
  );
}

function createNodeSqliteResumeCheckpointCaptureTransaction(
  database: NodeSqliteDatabase,
  assertOpen: () => void,
  options:
    NodeSqliteResumeCheckpointCaptureOptions,
): ResumeCheckpointWithAnchorsCaptureTransaction {
  return Object.freeze({
    getWork: async (
      workId:
        EntityId<"Work">,
    ): Promise<Work | null> => {
      assertOpen();
      return readWork(
        database,
        workId,
      );
    },
    getCheckpointById: async (
      checkpointId:
        EntityId<"ResumeCheckpoint">,
    ): Promise<
      ResumeCheckpoint | null
    > => {
      assertOpen();
      return readCheckpoint(
        database,
        checkpointId,
      );
    },
    getAnchorById: async (
      anchorId:
        EntityId<"Anchor">,
    ): Promise<Anchor | null> => {
      assertOpen();
      return readAnchor(
        database,
        anchorId,
      );
    },
    commit: async (
      input:
        CommitResumeCheckpointWithAnchorsInput,
    ) => {
      assertOpen();
      database.exec(
        "BEGIN IMMEDIATE",
      );
      let transactionActive =
        true;
      try {
        const currentWork =
          readWork(
            database,
            input.checkpoint
              .workId,
          );
        if (
          currentWork === null
        ) {
          throw new Error(
            `Unknown work: ${input.checkpoint.workId}`,
          );
        }
        if (
          currentWork.meta
            .revision !==
          input
            .expectedWorkRevision
        ) {
          throw new ResumeCheckpointConflictError(
            `Work revision conflict for ${input.checkpoint.workId}`,
          );
        }
        if (
          checkpointIdForWork(
            currentWork,
          ) !==
          input
            .expectedResumeCheckpointId
        ) {
          throw new ResumeCheckpointConflictError(
            `Resume checkpoint pointer conflict for ${input.checkpoint.workId}`,
          );
        }

        const pointer =
          readDocumentPointerState(
            database,
            input.checkpoint
              .documentId,
          );
        if (pointer === null) {
          throw new Error(
            `Unknown document: ${input.checkpoint.documentId}`,
          );
        }
        if (
          pointer.workId !==
          input.checkpoint.workId
        ) {
          throw new Error(
            `Work/document boundary violation: ${input.checkpoint.workId}/${input.checkpoint.documentId}`,
          );
        }
        if (
          pointer
            .currentRevisionId !==
            input
              .expectedDocumentRevisionId ||
          pointer
            .durableRevisionId !==
            input
              .expectedDocumentRevisionId
        ) {
          throw new Error(
            `Manuscript revision conflict for document ${input.checkpoint.documentId}`,
          );
        }
        const revision =
          readRevision(
            database,
            input
              .expectedDocumentRevisionId,
          );
        if (
          revision === null ||
          revision.documentId !==
            input.checkpoint
              .documentId
        ) {
          throw new Error(
            `Missing expected revision for document ${input.checkpoint.documentId}`,
          );
        }
        if (
          !Number.isSafeInteger(
            input
              .expectedDocumentRevisionLength,
          ) ||
          input
            .expectedDocumentRevisionLength <
            0 ||
          revision.length !==
            input
              .expectedDocumentRevisionLength
        ) {
          throw new Error(
            `Document revision length conflict for ${input.checkpoint.documentId}`,
          );
        }
        const anchors =
          assertPlatformCapturePayload(
            input,
            revision.length,
          );
        const nextWork =
          expectedNextWorkForCapture(
            currentWork,
            input.checkpoint,
          );
        if (
          !sameDomainPayload(
            input.nextWork,
            nextWork,
          )
        ) {
          throw new Error(
            "Invalid Work update for ResumeCheckpoint capture",
          );
        }
        if (
          readCheckpoint(
            database,
            input.checkpoint.meta.id,
          ) !== null
        ) {
          throw new Error(
            `Duplicate checkpoint identity: ${input.checkpoint.meta.id}`,
          );
        }
        for (
          const anchor of anchors
        ) {
          if (
            readAnchor(
              database,
              anchor.meta.id,
            ) !== null
          ) {
            throw new Error(
              `Duplicate Anchor identity: ${anchor.meta.id}`,
            );
          }
        }

        for (
          const anchor of anchors
        ) {
          writeLedgerRecord(
            database,
            anchorRecordForCapture(
              input.checkpoint
                .workId,
              anchor,
            ),
          );
          const storedAnchor =
            readAnchor(
              database,
              anchor.meta.id,
            );
          if (
            storedAnchor === null ||
            !sameDomainPayload(
              storedAnchor,
              anchor,
            )
          ) {
            throw new Error(
              `Anchor round-trip did not match the exact caller payload: ${anchor.meta.id}`,
            );
          }
        }
        writeLedgerRecord(
          database,
          checkpointRecordForCapture(
            input.checkpoint,
          ),
        );
        const storedCheckpoint =
          readCheckpoint(
            database,
            input.checkpoint.meta.id,
          );
        if (
          storedCheckpoint ===
            null ||
          !sameDomainPayload(
            storedCheckpoint,
            input.checkpoint,
          )
        ) {
          throw new Error(
            `ResumeCheckpoint round-trip did not match the exact caller payload: ${input.checkpoint.meta.id}`,
          );
        }
        updateWorkForCapture(
          database,
          input,
        );
        const storedWork =
          readWork(
            database,
            input.checkpoint
              .workId,
          );
        if (
          storedWork === null ||
          !sameDomainPayload(
            storedWork,
            input.nextWork,
          )
        ) {
          throw new ResumeCheckpointConflictError(
            `Work update conflict for ${input.checkpoint.workId}`,
          );
        }
        if (
          options
            .beforeDatabaseCommit !==
          undefined
        ) {
          await options
            .beforeDatabaseCommit();
        }
        database.exec("COMMIT");
        transactionActive = false;
        return Object.freeze({
          checkpoint:
            storedCheckpoint,
          work: storedWork,
        });
      } catch (error) {
        if (transactionActive) {
          database.exec(
            "ROLLBACK",
          );
        }
        throw error;
      }
    },
  });
}

export async function openNodeSqliteLedger(
  profile: Poc3StorageOpenProfile,
): Promise<
  Pick<
    StorageService,
    "transaction"
  > & {
    readonly openReceipt:
      Poc3StorageOpenReceipt;
    createRevisionStore(
      options:
        NodeSqliteRevisionStoreOptions,
    ): RevisionStore;
    createEpisodeRangeMoveStore(
      options:
        NodeSqliteRevisionStoreOptions,
    ): EpisodeRangeMoveStore;
    createResumeCheckpointCaptureTransaction(
      options:
        NodeSqliteResumeCheckpointCaptureOptions,
    ):
      ResumeCheckpointWithAnchorsCaptureTransaction;
    getAnchorById(
      anchorId: EntityId<"Anchor">,
    ): Promise<Anchor | null>;
    getRawPreservedItemById(
      rawItemId: string,
    ): Promise<Poc3RawPreservedItemRecord | null>;
    getMigrationDecisionById(
      decisionId: string,
    ): Promise<Poc3MigrationDecisionRecord | null>;
    close(): void;
  }
> {
  const { DatabaseSync } =
    loadNodeSqlite();
  const database =
    new DatabaseSync(
      profile.databasePath,
    );
  try {
    const settingReadbacks =
      applyAndVerifySettings(
        database,
        profile.requestedSettings,
      );
    database.exec(
      LEDGER_SCHEMA_SQL,
    );
    initializeOrVerifyIdentity(
      database,
      profile,
    );

    const openReceipt:
      Poc3StorageOpenReceipt =
      Object.freeze({
        databasePath:
          profile.databasePath,
        checksumIdentity:
          profile.checksumIdentity,
        targetSchemaVersion:
          profile.targetSchemaVersion,
        settingReadbacks,
        schemaTableNames:
          readSchemaTableNames(
            database,
          ),
      });
    let closed = false;
    const assertOpen = (): void => {
      if (closed) {
        throw new Error(
          "StorageService is closed",
        );
      }
    };
    return Object.freeze({
      openReceipt,
      createRevisionStore: (
        options:
          NodeSqliteRevisionStoreOptions,
      ): RevisionStore => {
        assertOpen();
        return createNodeSqliteRevisionStore(
          database,
          assertOpen,
          options,
        );
      },
      createEpisodeRangeMoveStore: (
        options:
          NodeSqliteRevisionStoreOptions,
      ): EpisodeRangeMoveStore => {
        assertOpen();
        return createNodeSqliteEpisodeRangeMoveStore(
          database,
          assertOpen,
          options,
        );
      },
      createResumeCheckpointCaptureTransaction:
        (
          options:
            NodeSqliteResumeCheckpointCaptureOptions,
        ):
          ResumeCheckpointWithAnchorsCaptureTransaction => {
          assertOpen();
          return createNodeSqliteResumeCheckpointCaptureTransaction(
            database,
            assertOpen,
            options,
          );
        },
      getAnchorById: async (
        anchorId: EntityId<"Anchor">,
      ): Promise<Anchor | null> => {
        assertOpen();
        return readAnchor(database, anchorId);
      },
      getRawPreservedItemById: async (
        rawItemId: string,
      ): Promise<Poc3RawPreservedItemRecord | null> => {
        assertOpen();
        return readRawPreservedItem(database, rawItemId);
      },
      getMigrationDecisionById: async (
        decisionId: string,
      ): Promise<Poc3MigrationDecisionRecord | null> => {
        assertOpen();
        return readMigrationDecision(database, decisionId);
      },
      transaction: async <T>(
        run: (
          tx:
            StorageTransaction,
        ) => Promise<T>,
      ): Promise<T> => {
        assertOpen();
        database.exec(
          "BEGIN IMMEDIATE",
        );
        const transactionState = {
          active: true,
        };
        const transactionView:
          StorageTransaction =
          Object.freeze({
            write: (
              record:
                Poc3LedgerRecord,
            ): void => {
              if (
                !transactionState
                  .active
              ) {
                throw new Error(
                  "StorageTransaction is inactive",
                );
              }
              writeLedgerRecord(
                database,
                record,
              );
            },
          });
        try {
          const result =
            await run(
              transactionView,
            );
          database.exec("COMMIT");
          return result;
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        } finally {
          transactionState.active =
            false;
        }
      },
      close: () => {
        if (!closed) {
          closed = true;
          database.close();
        }
      },
    });
  } catch (error) {
    database.close();
    throw error;
  }
}
