# T060 Workspace session/lifecycle extraction order

The safe order is bootstrap query, persistence foundations, durable queue ownership, session store, bootstrap composition, lifecycle switch/home, then close. Close must wait until Activity/focus ownership is explicit.

## First slice

Move only the 11-query `RuntimeBootstrapController.load()` into an injected pure controller. Keep App's disposed effect, `installRuntimeProjection`, runtime state, active-location choice, queue construction, save state, and recovery behavior unchanged.

The exact client surface is runtime info; editor input/formatting/preflight/document/persistence/recovery/resume; fragment profile; foreshadow point profile; and workspace catalog. Preserve one `Promise.all` with the current evaluation/tuple mapping and raw rejection behavior. Add no retry, fallback, timeout, or epoch.

Baseline AST hashes:

- RuntimeProjection: `5ABCF99ABC14611637F13FB0C0BE752EE07CEB2E4152916664ACD11141BFB9AF`
- query body: `C07844875946BF27261F3407580E523A480F1CDFAF3B6CD7C30A026863E22153`

Allowed files are App plus `workspace/session/RuntimeBootstrapController.ts` and its test. Verify all 11 calls start once, tuple mapping/rejection, facade tests, full check, startup/recovery Electron flows, and diff-check.

## Later invariant sequence

- PersistenceCoordinator first moves Work-layout and continuous-reading serial chains, then wraps the existing durable queue without rewriting it.
- WorkspaceSessionStore owns runtime readiness/profiles/recovery/catalog/active IDs/tab session, but not the editor's actual installed document.
- Switch uses regular flush, resume capture, activation, ownership validation, then session/catalog update. Regular flush deliberately defers under IME.
- Close uses `flushForClose`, which rejects pending composition and keeps the window open; it also waits layout, reading, focus transitions, owned session stop, and resume capture. Never unify switch and close prepare semantics.
- Shell active page, App requested active document, and ManuscriptEditor's installed document remain distinct until final composition.

Do not touch transaction/blur handling, queue text-save callbacks, feature activation branches, focus-owned close handling, resume preview, recovery apply/restore, or the Shell workspace handle before their owning feature/session slices are complete.
