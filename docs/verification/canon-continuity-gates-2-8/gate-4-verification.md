# Gate 4 Context Planner and activity verification

Gate 4 was verified against approved design checksum `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5`. All execution used caller-owned temporary workspaces; no live user workspace or `D:\eum.editor` data was opened.

## Source and storage

- Pure contracts cover sparse `required | relevant | withheld` policies, deterministic plan results, explicit required-over-budget failure, receipt-linked manifests, inclusion/exclusion reasons, entity revisions, and activity fields that cannot contain prompt, response, credentials, manuscript body, or hidden reasoning.
- The planner prioritizes required, direct, continuity, recent, and supporting classes with deterministic tie-breaks. It excludes withheld, outside-Work, stale, and duplicate candidates, never truncates an entity, and continues with later whole candidates that fit.
- Schema 21 adds three ledgers. Manifest and activity rows are immutable; policies enforce Work-local canonical references. Migration checksum: `658624097e81eee0b670d7fc1e6319db1a1a3733819d9e5df33d77aa9166c064`.
- Unstored policies project as `relevant` revision 0 and do not prewrite one row per Work/entity.
- Connector manifests now provide `contextTokenBudget`; the planner UI does not invent a product-wide document count or token limit.
- The Gate 4 Judge found that the existing Canon/Continuity connector paths did not yet call this service. Both production paths now execute `plan → permission/ContextReceipt → immutable manifest → connector → Candidate persistence → privacy-safe activity`. Focused runtime tests verify both paths, while a one-token required-context case proves that planner failure occurs before receipt creation and before the connector is called.

## Production Electron

At 1280×800, the packaged app created Work-local Character and Lore sources, persisted required policies, produced a deterministic plan with the connector manifest's 32,768-token budget, returned explicit `required-context-over-budget` when required context alone exceeded it, and stayed within viewport bounds. After complete relaunches, the UI displayed a receipt-linked manifest plus provider/model, stage durations, read range/revision, character counts, and Candidate count without rendering the large Lore body.

Read-only audit: 2 policies, 1 manifest, 1 activity, and 0 foreign-key violations. The Gate 2 Continuity and Gate 3 CharacterKnowledge packaged flows also passed against the same build.

On Windows `10.0.26200`, only the E2E child uses the documented sandbox exception; the product's default BrowserWindow isolation settings remain unchanged and tested.

## Performance and regressions

The measurement-only fixture planned 1,000 candidates (10 required, 100 withheld) across reversed input orders. Planner p50/p95 were 2.3400/3.3282 ms; manifest projection p50/p95 were 0.3905/0.7915 ms. The fixture is not a user-data maximum or product default.

The full Vitest run passed 300 files and 1,115 tests with 1 skip. Only the same pre-existing `RuntimeBootstrapController.test.ts:343` baseline failure remains. The first full run also exposed a same-timestamp Gate 3 list-order assumption; production ordering now explicitly places active knowledge before superseded/retired history, and its focused regression passed.

