# T014 split/merge lineage mutation plan

## Identity policy

### Split

- Ensure the source Scene has a left identity; create it if absent.
- Create a new right identity.
- Lineage operation `split`, `command_ref = SceneOverride ID`.
- Members: parent left[0], child left[0] (continuation), child right[1].
- Existing metadata bound to left is not silently declared current because the Scene content shrank. Update it to `needs-review`, keep `scene_id = left`, set `proposed_scene_id = left`, and reference the split lineage operation.

### Merge

- Ensure both source Scenes have identities even if they did not previously carry metadata.
- The left identity is the canonical merged child.
- Lineage operation `merge`, same SceneOverride command reference.
- Members: each distinct source identity as ordered parent, canonical left as child.
- Rebuild segments under canonical left and retire the distinct right identity after its active segments retire.
- Every non-detached binding on either parent becomes `needs-review` with canonical left as proposed target and the merge lineage operation.

This keeps identity continuity deterministic while refusing to guess that old annotation/music/event semantics remain correct after structural content changes.

## Atomicity

SceneOverride Anchor/row, any missing identities, segment retirement/creation, lineage operation/members, metadata binding revision updates, and right-identity retirement are written in the existing single ledger transaction.

## Verification

- Extend the runtime reconciliation integration:
  - start with one current event binding and stable identity;
  - split inside it;
  - assert split lineage parent/children and binding `needs-review` proposed left;
  - merge the two resulting Scenes;
  - assert merge parents/child, canonical identity continuity, right retirement, and binding review target;
  - reopen and prove rows/projection persist without duplicates.
- Full runtime suite, typecheck, build, diff check.

## Worker scope

- `src/desktop/local-workspace-runtime.ts`
- `src/desktop/local-workspace-runtime.test.ts`

Move lineage and delete/restore lineage remain subsequent explicit slices.
