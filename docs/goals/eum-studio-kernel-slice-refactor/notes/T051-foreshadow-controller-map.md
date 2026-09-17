# T051 ForeshadowController core boundary

Foreshadow core can move after FragmentsController, but `loreForeshadowLinks` is one shared Lore/Foreshadow ledger and must not become ForeshadowController-owned state.

## Core ownership

Move lines, points, dialog visibility, selected line, the existing single action gate/error, Work-scoped `Promise.all` load/disposal/null reset, line create/update/retire, and exact-selection point capture into an injected controller. Keep the runtime point profile, source navigation, editor/durable implementation, Lore entries, shared link projection, and link/unlink orchestration at App compatibility ports.

```ts
type ForeshadowClient = Pick<
  StudioBridge["foreshadowing"],
  "createLine" | "listLines" | "updateLine" | "retireLine" |
    "createPoint" | "listPoints"
>;

type LoreForeshadowLinksClient = Pick<
  StudioBridge["loreForeshadowLinks"],
  "link" | "list" | "unlink"
>;
```

The core client excludes `getPointProfile`. There are no point update/retire APIs today; do not invent them.

## Preserve

- No eager A-to-B clear/loading UI; stale responses are only ignored by the current disposed flag.
- Null-Work reset remains `setTimeout(0)` and does not reset the action gate.
- New lines prepend; captured points append.
- Update/retire send exact line revision.
- Capture order remains line/selection check, materialize exact directional text, durable persist, then createPoint.
- Line retirement first removes line/points, then refreshes the shared link ledger; refresh failure locally prunes only that line's links and reports the existing partial-success error.
- Resolution stays data-driven by runtime `payoffRoleId` and point roles.
- Navigation keeps existing integrity/range, same/visible/cross paths, tab/session, dialog reopen, and best-effort resume behavior.

The shared link ledger is loaded with Lore, gates on both Lore and Foreshadow action states, appears on both surfaces, and is refreshed/pruned by both line and Lore retirement. It belongs in a later Lore-paired shared controller.

First Worker files are App plus `features/foreshadow/{foreshadow-client,foreshadow-state,useForeshadowController,useForeshadowController.test}.ts[x]`; dialog, Lore, navigation, editor, application/runtime/bridge/preload/main/E2E stay untouched. Verify controller, dialog, line/point/link contracts, bridge, three runtime cases, full check, and all line/link/point/navigation Electron flows.
