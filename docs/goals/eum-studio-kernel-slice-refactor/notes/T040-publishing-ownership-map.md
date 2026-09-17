# T040 publishing ownership map

Read-only mapping against the live `D:\eum.studio` tree.

## Smallest coherent boundary

Extract the whole persistent `usePublishingController` first and leave the existing dialog/host JSX mounted exactly as it is. A single ledger is not an independent boundary because `StudioShell` currently owns one shared operation/error gate, an all-or-error 11-query load, selection reconciliation, and cross-ledger updates for evidence, research, assistant approval, CSV imports, and mail review/sync.

The controller must remain mounted across dialog close. Current persistent projections and selected IDs survive close; only dialog-local drafts, research/assistant Candidates, CSV previews, and mail form drafts disappear on unmount.

## Current ownership

- `StudioShell.tsx:268-404`: route, 11 authoritative publishing projections, mail sync result, seven selected IDs, one action gate, one error.
- `StudioShell.tsx:463-581`: open/load uses `Promise.all` across 11 queries; installs only after all succeed and preserves or reconciles selected IDs.
- `StudioShell.tsx:583-971`: partner/submission/contract/publication/settlement/payment/source operations with one gate and exact revisions.
- `StudioShell.tsx:973-1428`: evidence, research, assistant, CSV, and mail orchestration with cross-ledger updates.
- `PublishingPartnerDialog` and its panels own only transient forms, filters/tabs, preview Candidates/results, CSV mapping/preview, and mail drafts.

## Preserve

- One operation gate and the current close gate; do not split busy states.
- Atomic initial load behavior, work-scoped filters, and selection reconciliation order.
- Every `expectedRevision`, immutable `SubmissionPackage`, immutable `PublishingSource`, source IDs, and unmapped CSV raw fields.
- Candidate approval boundaries; no canonical ledger mutation before explicit approval.
- Metadata-only assistant/mail boundaries and no renderer-visible credentials or mail body persistence.
- Existing manual retry behavior; add no automatic retry, fallback, partial load, epoch, or conflict refresh.

## First Worker slice

Allowed files:

- `src/renderer/StudioShell.tsx`
- `src/renderer/features/publishing/usePublishingController.ts`
- `src/renderer/features/publishing/usePublishingController.test.tsx`

Do not touch dialog/panel files, application publishing code, bridge contracts, preload, desktop main, schema, DB, or E2E source. Mechanically move the 24 publishing states plus open/load/close and all callbacks, and map the resulting model/actions back to the unchanged dialog props. Extract the feature host only in a later slice.

Verification must include the controller unit, existing publishing dialog/application/bridge tests, `npm run check`, all 14 packaged publishing E2E flows, and `git diff --check`.

Stop if the controller would need conditional mounting, raw setters exposed back to Shell, gate subdivision, dialog-local draft/Candidate migration, bridge/schema changes, or new recovery semantics.
