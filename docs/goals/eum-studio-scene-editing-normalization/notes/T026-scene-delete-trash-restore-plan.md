# T026 Scene delete, trash, restore map

## Current source truth

- `SceneList` labels the existing `SceneOverride(operation: "delete")` action as `장면 삭제`, while its confirmation explicitly says manuscript text is not removed.
- `useSceneWorkspaceController.deleteScenes` persists at most the active document and then writes one or more delete overrides. It does not create a manuscript revision, preview, trash entry, restore receipt, or undo record.
- `LocalWorkspaceRuntime.#createSceneOverrideSerially` retires a resolved Scene identity and its segments for `delete`, but does not create delete lineage and does not transition Scene metadata bindings.
- `SceneProjection` remains derived from manuscript revision, rules, and active overrides. A real delete must advance manuscript revisions and normalize affected override boundaries rather than store a second Scene body.
- `moveRangeToEpisode` is the current atomic model: immutable blobs are published first, then all document revision advances and structural records commit inside one `BEGIN IMMEDIATE` transaction. Its explicit undo command and renderer `onUndoExternal` hook are reusable patterns.

## Scope decision

- Phase-1 completion requires actual Scene deletion, preview, durable trash, restore, immediate one-step undo, delete/restore lineage, and Scene metadata handling.
- Arbitrary `MoveScene` remains absent. The attachment's actual recommended sequence places Scene/episode drag movement in phase 2, so it is recorded but not included in this phase-1 worker chain.
- The old non-destructive delete override is not the new user-facing delete. Existing rows remain readable for compatibility; new delete UI must use the new transaction.

## Deletion target and envelope

- A target is one stable Scene identity and all of its resolved episode segments. A Scene without an identity is accepted by exact `(documentId, sceneKey, revision, range)` and receives an identity inside the delete transaction before that identity is retired.
- Preview is recomputed by runtime and fingerprinted. Commit carries the fingerprint and exact expected document revisions; it never trusts renderer offsets alone.
- Each segment has a content range and a deletion envelope. The envelope removes the Scene text plus exactly one adjacent boundary when another Scene exists. For a sole Scene it removes only its content. Rule delimiters are removed as text; active manual boundary overrides touching the removed boundary are retired atomically and snapshotted for restore.
- Multi-episode Scene segments advance every affected document revision in one transaction. Any stale revision cancels the entire command.

## Public contracts

Create `scene-trash-contract.ts` with strict parsers for:

- `PrepareSceneDeletionCommand` and `SceneDeletionPreview`
- `DeleteSceneCommand` and `SceneDeletionReceipt`
- `ListSceneTrashCommand` and `SceneTrashListProjection`
- `RestoreSceneTrashCommand`
- `UndoSceneDeletionCommand`

Preview includes affected episode titles, UTF-16 deletion count, first and last non-empty text excerpts, automatic/manual event summaries, annotation summaries, music queue summaries, exact expected revisions, and a deterministic fingerprint. It does not expose OAuth data or duplicate a mutable Scene body.

Trash projection includes status, source Scene identity, affected documents, before/deleted/restored revision IDs, metadata counts, deletion time, and `canRestore`/conflict reason derived from current revisions and rule-set revision.

## Schema 17

Add a verified 16-to-17 migration and matching base schema tables:

- `scene_trash_entries`: Work, source Scene/fingerprint, source rule revision, delete/restore lineage IDs, status (`active | restored | undone`), timestamps.
- `scene_trash_documents`: ordered document snapshots with before/deleted/restored revision IDs, source and deletion ranges, exact deleted-text hash/length/excerpts.
- `scene_trash_segments`: original Scene segment IDs for exact undo/restore.
- `scene_trash_overrides`: affected manual boundary override IDs and revisions.
- `scene_trash_bindings`: pre-delete binding state plus the post-delete revision used as the restore concurrency guard.

No time-based purge or permanent-delete policy is introduced.

## Atomic storage transaction

Add a dedicated `SceneTrashStore`, modeled on `EpisodeRangeMoveStore`.

Delete:

1. Publish all new immutable revision blobs.
2. `BEGIN IMMEDIATE`.
3. Recheck and advance every manuscript revision.
4. Insert the trash entry and immutable snapshots.
5. Retire affected manual boundary overrides, Scene segments, and Scene identity.
6. Create one `delete` lineage operation with the source Scene as parent.
7. Move every current Scene metadata binding to detached state and record its prior state/revisions in the trash snapshot.
8. Clear affected resume checkpoint state, run the injected pre-commit hook, and commit.

Undo/restore:

1. Require the trash entry to be active, the source rule-set revision unchanged, every document current revision to equal its delete revision, and every snapshotted binding to equal its post-delete revision.
2. Publish revisions whose content/editor state exactly match the before-delete revisions.
3. In one transaction advance all documents, reactivate snapshotted overrides/segments/identity, restore binding states to the same stable Scene, create one `restore` lineage operation (same Scene as parent and child), and mark trash `undone` or `restored`.
4. If any document or binding changed after deletion, keep the trash entry active and return a conflict. Do not guess an insertion point or overwrite later edits.

This first safe restore contract handles immediate undo, app restart, and later restore while affected documents remain unchanged. Conflict-aware insertion after subsequent manuscript edits is a separate extension.

## Renderer path

- Replace `window.confirm` with `SceneDeletionDialog`; no destructive command is sent before preview confirmation.
- Reuse the same dialog from Scene cards and bottom grouped Scene rail.
- Show exact excerpt, character count, affected episodes, and linked events/annotations/music.
- Add a separate Scene trash details list with explicit restore buttons.
- Reload authoritative runtime and Scene/metadata/music projections after delete, undo, or restore.
- Keep the last deletion receipt in the Scene controller. `ManuscriptEditor.onUndoExternal` should attempt a still-undoable Scene deletion before the older episode-move external undo. It returns false when current revision no longer equals the delete revision.

## Verification

- Strict contract tests, including extra fields, duplicate documents, empty targets, and revision/fingerprint validation.
- Migration checksum, schema/readback, empty upgrade, populated 16-to-17 upgrade, idempotent reopen, and rollback.
- Pure envelope tests for first/middle/last/sole Scene and rule/manual boundaries.
- Storage/runtime integration for single- and multi-document Scene deletion, source text/revision changes, trash snapshots, delete/restore lineage, detached/restored bindings, stale document/binding/rule conflicts, injected commit failure, undo, reopen, and restore.
- Renderer tests for preview details and no command before confirm.
- Production Electron: delete a Scene with linked event/metadata, verify exact manuscript change and trash; immediate `Ctrl+Z`; delete again, restart, restore from trash, and verify exact manuscript/Scene/metadata recovery.

## First Worker slice

Implement the schema-17 migration, strict contracts, pure deletion-envelope planner, `SceneTrashStore`, and LocalWorkspaceRuntime prepare/delete/list/undo/restore methods with integration tests. Do not expose a delete button until the full backend restore path passes.

### Allowed files

- `src/application/structure/scene-trash-contract.ts`
- `src/application/structure/scene-trash-contract.test.ts`
- `src/application/structure/scene-deletion-plan.ts`
- `src/application/structure/scene-deletion-plan.test.ts`
- `src/application/editor/manuscript-formatting.ts` or a new narrowly named formatting transform and its test
- `src/application/editor/move-range-to-episode.ts` only if a shared editor-state range transform is extracted without changing move behavior
- `src/domain/poc-3-storage-ledger.ts`
- `src/platform/storage/node-sqlite-ledger.ts`
- `src/platform/storage/node-sqlite-ledger.test.ts`
- `src/desktop/local-workspace-scene-trash-migration.ts`
- `src/desktop/local-workspace-scene-trash-migration.test.ts`
- `src/desktop/local-workspace-runtime.ts`
- `src/desktop/local-workspace-runtime.test.ts`

### Stop if

- Immutable revisions and trash/lineage/binding changes cannot share one DB commit.
- Restore would overwrite a document or binding revision changed after deletion.
- A Scene target or deletion envelope is ambiguous.
- Existing user-owned dirty changes overlap in a way that cannot be preserved.
