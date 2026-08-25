# T055 DocumentNavigator orchestration map

The current channel-based `DocumentNavigator` is a safe migration registry, not yet the planned navigation kernel. It still delegates ownership lookup, durable flush/activation, editor readiness, revision/range checks, reveal, feature result handling, and stale-request control to `App.tsx`.

## Target boundary

Add a promise-returning `open(request)` and `notifyEditorActivated(document)` behind the existing channel API, then migrate one feature at a time. The injected ports expose the current workspace snapshot, current durable revision, write-surface transition, existing `activateWorkspaceLocation`, tab policy, range selection, cursor placement, and preview-offset reveal. The Navigator must not import React, Electron, bridge, persistence, or feature UI.

Neutral results are `opened` with path/reveal metadata, `superseded`, `missing-document`, `stale-revision`, `invalid-range`, and narrowly reasoned `blocked`. Feature adapters keep every current Korean error, dialog reopen, busy-state reset, tab-open/preserve, and resume difference.

## Editor-ready and stale request rules

- Cross-document `open()` completes reveal only after the existing ManuscriptEditor `onDocumentActivated` fires after state installation (including current IME deferral).
- Same-document reveal requires the installed editor identity and does not force a flush.
- Do not add polling, timeout, retry, fallback, re-anchoring, or automatic correction.
- Each new `open()` supersedes the older unresolved request. It does not cancel IPC; every await checks generation so an old result cannot tab/reveal over the newer request.
- Revision-bound targets check before activation and again after editor readiness.

## Target distinctions

- Revision-bound exact selection for sources that already expose a source revision, including assistant occurrences.
- Current-document selection is required for existing projections that do not expose a source revision; do not manufacture one or change application contracts in this Gate.
- Scene boundary remains revision-bound preview offset, scroll/focus only.
- Scene draft compare remains current preview offset with the existing `min(offset, initialText.length)` clamp and no stale-revision rejection.
- Plain document open remains distinct from location reveal.

## Sequence

1. Seal assistant cross-episode success and stale-revision behavior, scene-boundary cross-episode preview, and stale scene-draft cross-episode compare.
2. Add the orchestration kernel and fake-port unit coverage while retaining `stage/clear/consumeActivated`.
3. Move fragment same/cross navigation to `open()` and remove its channel/activation branch.
4. Move each exact/current selection feature separately, preserving each tab/error/dialog/resume adapter.
5. Move assistant revision-aware selection.
6. Move scene boundary and scene draft offset variants separately.
7. Move same-document visible transitions/focusScene, then delete the last pending ref, channel API, and giant feature activation chain.

## Common stop conditions

Stop if a slice requires changing ManuscriptEditor imperative APIs, `activateWorkspaceLocation` durable-save/ownership semantics, public bridge/IPC/schema/DB, feature UI error policy, tab/session policy, scene reveal semantics, or adding retry/fallback/automatic correction. General tree/tab/work transitions remain for the later WorkspaceLifecycleCoordinator Gate.
