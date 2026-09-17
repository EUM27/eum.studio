# T017 atomic new Scene metadata binding plan

## Shared identity preparation

Extract a synchronous runtime helper that validates one resolved Scene against the current document target and returns:

- existing `sceneId` with no records, or
- a new Scene identity, exact full-range Anchor, and episode segment records.

The helper does not commit. Each caller includes the prepared records in its own source-metadata transaction, so no orphan identity is required for success.

## Annotation approval

- Resolve and validate the exact matching Scene as today.
- Prepare identity records.
- In the existing annotation Candidate decision transaction, write identity records, annotation create/update, and binding create/update `status=current` together.
- Existing binding update uses exact revision.

## Event override

- Resolve the exact current Scene from the command fingerprint.
- Prepare identity records for a non-null include/exclude operation.
- Retire old override and its binding together.
- Create new override and current binding together.
- Null operation retires both without creating a replacement.

## Music Candidate

- Require the source annotation to have a current binding and stable sceneId.
- Add a `sceneMusicQueueCandidate` ledger record instead of direct SQL insert.
- Commit Candidate and current music binding in the same ledger transaction.
- Candidate selection/update behavior stays unchanged.

## Verification

- Runtime annotation approval, event override, and music search tests assert immediate current bindings before restart.
- Inject a binding trigger/source conflict and prove source metadata rolls back with the binding.
- Existing startup reconciliation remains for legacy/missing bindings and stays idempotent.
- Runtime suite, focused storage/type/lint/build, diff check.

## Worker scope

- `src/domain/poc-3-storage-ledger.ts`
- `src/platform/storage/node-sqlite-ledger.ts`
- `src/desktop/local-workspace-runtime.ts`
- `src/desktop/local-workspace-runtime.test.ts`

Public projection/UI shape remains the next slice.
