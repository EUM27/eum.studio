# T008 stable Scene metadata schema map

## Current source and live schema

- schema 15 already has `scene_identities` and `scene_episode_segments`; live read-only inventory found 8 identities and 32 segments.
- `scene_annotations`, `scene_event_overrides`, and `scene_music_queue_candidates` persist only `scene_key` and have no stable Scene FK.
- live metadata counts are currently 0/0/0, but migration must preserve non-empty fixtures and older backups.
- current dirty manuscript-annotation work added `manuscript_annotations` to the base `CREATE IF NOT EXISTS` schema without a schema-version migration. The live schema 15 DB already contains that empty table after a current app open. A 15→16 migration must normalize both schema-15 shapes: with or without that table.

## Chosen normalized foundation

Do not rebuild or delete the existing metadata tables. Preserve every legacy `scene_key` as raw evidence and add:

1. `scene_lineage_operations`
   - Work-owned immutable operation header.
   - operation: `split | merge | move | delete | restore`.
   - exact `command_ref`, revision/timestamps, soft retirement.

2. `scene_lineage_members`
   - Work/operation/Scene membership with `parent | child` role and ordinal.
   - permits multiple parents/children and the same Scene in both roles for continuation/move semantics.
   - composite FKs to lineage operation and `scene_identities`.

3. `scene_metadata_bindings`
   - `metadata_kind: annotation | event-override | music-queue` and source metadata ID.
   - raw `source_scene_key` preserved.
   - nullable stable `scene_id`, `status: current | needs-review | detached`, nullable `proposed_scene_id`, optional lineage operation.
   - active source metadata identity is unique.
   - Scene/lineage FKs and source-existence triggers protect ownership without deleting the legacy row.

4. `manuscript_annotations`
   - `CREATE TABLE IF NOT EXISTS` with the exact current dirty base-schema definition, so both existing schema-15 shapes become explicit schema 16.

## Migration behavior

- Create lineage/binding tables, indexes and source-validation triggers in one migration transaction.
- Insert exactly one `needs-review` binding for every existing active or historical Scene annotation, Scene event override and Scene music queue Candidate.
- Do not guess a `scene_id` in SQL; leave it null until the runtime reconciliation slice can derive the current projection and create/confirm exact identity segments.
- Verify source count equals binding count per metadata kind, source rows/checksums are unchanged, binding source keys match, and foreign-key violations are zero.
- Migration is idempotent by the normal schema-version gate and receipt.

## Subsequent P0-3 slices enabled by this foundation

- Runtime reconciliation upgrades resolvable bindings to `current`, creates missing Scene identity/segment records, and leaves ambiguous rows `needs-review`.
- split/merge/move/delete/restore transactions write lineage operations/members.
- split keeps left Scene identity as continuation and creates a right child; bindings on the continued parent are marked `needs-review` rather than silently copied.
- merge keeps one canonical identity, records every participating parent/child, and marks affected bindings with a proposed target for review.
- UI and projections match metadata by stable Scene identity; `scene_key` remains raw fingerprint/evidence only.

## First Worker slice: schema 16 foundation

Allowed files:

- `src/desktop/local-workspace-scene-metadata-migration.ts` (new)
- `src/desktop/local-workspace-scene-metadata-migration.test.ts` (new)
- `src/desktop/local-workspace-runtime.ts`
- `src/desktop/local-workspace-runtime.test.ts`
- `src/domain/poc-3-storage-ledger.ts`
- `src/platform/storage/node-sqlite-ledger.ts`

Verification:

- focused 15→16 migration with non-empty metadata and no pre-existing manuscript annotation table;
- exact 3/3 binding coverage, source preservation, schema/trigger/index/FK checks, second-run no-op;
- current runtime migration-chain tests updated to schema 16;
- typecheck, production build, scoped diff check.

Stop conditions:

- migration cannot represent all existing metadata without deleting or guessing;
- current dirty manuscript annotation schema differs from the DDL being normalized;
- migration runner cannot keep the change in one transaction;
- same verification failure repeats twice.
