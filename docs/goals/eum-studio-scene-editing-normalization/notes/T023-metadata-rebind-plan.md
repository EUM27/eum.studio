# T023 Scene metadata rebind plan

## Command

`RebindSceneMetadataCommand`:

- schemaVersion 1
- workId
- sceneMetadataBindingId
- expectedBindingRevision
- targetSceneId: stable Scene ID or null

The command never accepts a raw sceneKey as target.

## Runtime

- Load the exact active binding by Work/ID and compare revision.
- For non-null target, require exactly one current resolved SceneProjection carrying that stable sceneId.
- Update only the binding: `scene_id = target`, `status = current`, clear proposed/lineage review pointers.
- Null target sets `status = detached`, clears current/proposed target.
- Do not rewrite annotation, event override, music Candidate, or preserved source_scene_key.
- Return strict `SceneMetadataBindingProjection`.

## UI

- Expand SceneList review summary into items grouped by annotation/event/music.
- If proposedSceneId resolves, expose `제안 장면에 연결`.
- Expose `연결 해제` for explicit detachment.
- After command, reload Scene projection, annotations and music candidates so the item either attaches to the target card or leaves the review queue.

## Bridge path

Add one typed Structure capability through contract → preload → IPC → runtime → renderer client. Configured manuscript runtime parses then rejects it consistently with other unavailable structure mutations.

## Verification

- contract parser rejects raw key/unknown fields/stale revision shape;
- runtime accepts current proposed target, rejects stale binding and unknown/retired Scene, detaches without source mutation;
- SceneList static tests for proposed action and current-card attachment after result;
- typed bridge tests, typecheck/lint/build;
- focused production Electron split → review count → accept proposed → metadata visible on target card.

## Expected files

- binding contract/test
- structure bridge, preload, IPC, structure runtime, bootstrap
- local runtime/test
- renderer structure client/controller/host/SceneList/tests
- ownership/bridge tests discovered by typecheck
