# T050 FragmentsController boundary

Read-only mapping against the live `D:\eum.studio` tree after the fragment navigation channel migration.

## Smallest coherent boundary

Move the authoritative fragment projection, dialog visibility, single operation gate, shared error, Work-scoped load/reset, and capture/move/insert/update/retire orchestration into an injected `useFragmentsController`. Keep source navigation, runtime `FragmentShelfProfile`, editor mechanics, durable persistence, resume capture, and tab/session activation at the Workspace boundary.

The client is exactly:

```ts
type FragmentsClient = Pick<
  StudioBridge["fragments"],
  "capture" | "list" | "update" | "recordUse" | "retire"
>;
```

`getProfile` remains part of runtime bootstrap. The controller receives editor/persistence operations through a separate manuscript port and never reads `window.eumStudio` directly.

## Preserve

- Existing Work-load disposal/reset behavior; do not add visible loading, eager A-to-B clear, retry, or fallback.
- One operation gate and current error/dialog-close semantics.
- Capture and move persist the current document before the bridge command.
- Move remains capture-first. If delete, second persist, or list refresh fails, the captured fragment remains as the existing partial-success recovery.
- Insert remains editor mutation, then durable persist, then `recordUse(expectedRevision)`; never invent a use count.
- Update, retire, and recordUse send the exact current revision.
- Move success re-queries the authoritative list for Anchor integrity/range.
- Dialog query, filter, capture-kind draft, and confirmation stay component-local.
- Navigation retains current integrity/range and editor-ready behavior; add no revision check or stale cancellation in this controller slice.

## First Worker slice

Allowed files:

- `src/renderer/App.tsx`
- `src/renderer/features/fragments/fragments-client.ts`
- `src/renderer/features/fragments/fragments-state.ts`
- `src/renderer/features/fragments/useFragmentsController.ts`
- `src/renderer/features/fragments/useFragmentsController.test.tsx`

Do not touch FragmentShelfDialog, ManuscriptEditor, navigation, application contracts/runtime, preload, desktop, or E2E source. Verify controller failure ordering, fragment application/bridge/dialog/navigation units, `npm run check`, and the copy, cross-episode open, and move/insert packaged Electron flows.

Stop if the extraction requires changing editor APIs, durable save/resume, public bridge, schema/DB, source navigation, profile ownership, partial-success semantics, or current Work-load behavior.
