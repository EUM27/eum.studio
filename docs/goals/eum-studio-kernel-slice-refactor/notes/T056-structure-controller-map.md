# T056 StructureController bounded context

Events, plots, and scenes must remain one renderer coordination context with internal slices. EventRail installs events/sources/plot-event links/board together; event and plot mutations refresh rail and scene projections. Independent top-level controllers would create multiple writers for links, board, and derived scenes.

## Boundary

Own EventBlock/EventSource/EventRail; PlotBeat/source/link/board/placement/story time; derived SceneProjection/rules/overrides/event overrides; extraction Candidates/annotations; and draft Candidates. Keep canonical stores distinct and preserve the current event-, scene-, and plot-load lanes—including their present last-resolution-wins writes to shared board/link state.

External ports retain scene music queue ownership; read-only character/Lore snapshots; OAuth/conversation/permission state; shared character+event inspiration revision; CodeMirror/durable mechanics; and DocumentNavigator feature adapters.

## Safe internal order

1. Projection/load/reconciliation kernel only.
2. Event commands/source manuscript port.
3. Plot CRUD/source/link/board/story-time.
4. Scene rules/overrides/event membership.
5. Extraction Candidates and annotations.
6. Draft generate/edit/apply/compare.
7. StructureFeature UI composition.

Do not merge the separate action gates or canonical stores. Preserve exact revision/identity fields and partial-success boundaries: saved event/plot results survive refresh failure; annotation/scene changes survive music refresh failure; draft editor insertion/durable save is not rolled back when completion fails; scene refresh failure never changes a successful manuscript save into failure.

## First Worker

Move only projections and named reconciliation operations to injected `useStructureController`; move no mutation/UI. Files are App plus `features/structure/{structure-client,structure-state,useStructureController,useStructureController.test}.ts`. Preserve independent load/reset timing and the current event/plot shared-state race.

Verify all structure/plot/music contracts, renderer event/plot/scene components, focused bridge/runtime cases, Navigator, full check/build, and bidirectional links/event rail/final scenes/plot source/stale draft production Electron flows. Stop if one new authority must replace current load behavior, gates/refresh/partial success change, external feature state is copied, or bridge/runtime/editor/navigation/schema changes are required.
