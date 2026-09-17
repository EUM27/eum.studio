# T020 binding projection and UI plan

## Shared public contract

Add `SceneMetadataBindingProjection` with:

- binding ID/revision/Work
- metadata kind and source metadata ID
- preserved `sourceSceneKey`
- stable `sceneId | null`
- `current | needsReview | detached`
- proposed Scene ID and lineage operation ID
- created/updated instants

`SceneAnnotationProjection`, `SceneEventOverrideProjection`, and `SceneMusicQueueCandidate` require one binding. Their strict parsers validate Work, metadata kind/ID, raw key, and `current => sceneId` agreement.

## Runtime projection

- Metadata SELECTs join the active binding row and parse source+binding together.
- Missing binding rows are omitted only from the initial internal event-override projection used during startup recovery; the explicit reconciliation immediately creates them before runtime is returned.
- Current runtime list/query outputs always include binding.

## Renderer

- SceneList attaches annotation only when annotation binding is `current` and its `sceneId` equals the card Scene identity.
- SceneMusicQueuePanel filters candidates by current binding sceneId equality with the annotation binding.
- `needsReview` bindings never appear as current card data.
- SceneList shows a concise count of annotation/event/music bindings requiring review so data does not silently disappear.

## Worker scope

- new binding contract + test
- scene annotation, scene projection event override, and scene music contracts/tests
- runtime SQL/projectors/tests
- SceneList/SceneMusicQueuePanel and focused tests
- affected fixtures discovered by typecheck

Reassignment UI is the next explicit slice.
