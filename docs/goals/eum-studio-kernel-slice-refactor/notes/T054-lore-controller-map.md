# T054 Lore core and shared-link sequence

The compatible sequence is Foreshadow core, then one Lore core owning canonical entries and Candidates together, then a shared LoreForeshadowLinksController. Candidate approval updates the Candidate record and canonical Lore atomically, so separate initial owners would create an unstable cross-controller transaction.

## Lore core ownership

- canonical entries and Lore Candidates
- canonical/Candidate dialogs and selected entry
- separate canonical and Candidate action/error gates
- current Work three-way load/reset orchestration
- canonical create/update/retire/add-evidence
- Candidate refresh/create/approve/reject
- approval result reconciliation for both Candidate and canonical entry

Keep shared links, Foreshadow state, cues/hover/pin, source navigation, runtime/editor/durable implementation, and form/search/link-select drafts outside the first controller.

```ts
type LoreEntriesClient = Pick<
  StudioBridge["loreEntries"],
  "create" | "list" | "update" | "addEvidence" | "retire"
>;
type LoreCandidatesClient = Pick<
  StudioBridge["loreCandidates"],
  "create" | "list" | "approve" | "reject"
>;
```

## Preserve

- Current entries/candidates/links `Promise.all` all-or-error load and null-Work delayed reset; compatibility ports keep links in this first slice.
- No eager A-to-B clear/loading state; disposed stale responses only.
- Candidate creation persists exact directional selection first and changes no canonical Lore.
- Approval requires pending/unblocked/exact revision and reconciles Candidate plus canonical entry; failure keeps the original error even if best-effort Candidate refresh fails.
- Reject changes only the Candidate.
- Canonical update/evidence/retire sends exact revision. Retire partial success refreshes shared links or prunes only the retired Lore ID with the existing error.
- Candidates never appear in cues before approval. Cue derivation and hover/pin remain current-document UI state.
- Evidence navigation preserves resolved-range, same/visible/cross, tab/dialog/error/resume behavior.

The first Worker owns App plus `features/lore/{lore-client,lore-state,useLoreController,useLoreController.test}.ts[x]`; dialog/cue/navigation/application/runtime/bridge/preload/main/E2E files stay untouched. A later shared-link Worker must supply the same projection instance to Lore and Foreshadow while preserving both surface-specific busy/error gates.
