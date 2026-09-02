# T011 Scene metadata binding reconciliation plan

## Binding meaning

`scene_metadata_bindings.status = current` means only that the preserved raw `source_scene_key` resolves to exactly one current, resolved Scene identity. It does not claim that annotation content or a music Candidate revision is current; those existing integrity checks remain independent.

## Startup reconciliation algorithm

For each active Work, before returning the opened runtime:

1. Inventory every source row from `scene_annotations`, `scene_event_overrides`, and `scene_music_queue_candidates`.
2. Synthesize deterministic missing binding IDs for source rows created after schema migration.
3. Compute the current SceneProjection once.
4. For each active `needs-review` or missing binding, match `source_scene_key` to exactly one Scene with non-null range and resolved integrity.
5. If that Scene has an identity, reuse it.
6. If it lacks an identity, prepare one Scene identity, one exact full-range Anchor, and one episode segment. Reuse that prepared identity for every metadata row targeting the same Scene.
7. Commit all new identities, anchors, segments, new bindings, and binding updates in one ledger transaction.
8. Leave unmatched/ambiguous bindings `needs-review` with `scene_id = NULL` and preserve the raw key.
9. A second startup is a no-op: no duplicate identity, segment, or binding.

The reconciliation is an explicit startup step, not a hidden write inside the list/query path. Each resulting binding/identity/segment row is durable evidence.

## New metadata after schema 16

This slice inventories missing source rows on the next startup so no row is lost. The following slice will make each annotation/event/music creation transaction write its `current` binding immediately, avoiding a restart delay.

## Verification

- Runtime integration: create an event override for a Scene without identity, close, reopen, then prove one current binding, one identity, one segment, matching projection identity, and second-reopen count stability.
- Unit/integration: unmatched raw scene key stays `needs-review` and no identity is guessed.
- Existing 84 runtime tests, typecheck, build, diff check.

## Worker scope

- `src/desktop/local-workspace-runtime.ts`
- `src/desktop/local-workspace-runtime.test.ts`

Stop if exact source Scene cannot be identified, any source row is deleted/rewritten, identity/binding cannot share one transaction, or an existing binding would be silently reassigned.
