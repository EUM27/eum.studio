# Runtime service map — read-only Scout receipt

Scout: `/root/runtime_service_map`. Checked actual f8215a5 source; no changes, builds or app/data access. `npm run architecture:check` passed although the central runtime contained 544 methods and 293 `.prepare` calls.

Preserve these execution contracts during extraction:

- Save waits on the previous save tail only.
- General mutations append to the create tail and await the current save tail.
- Read operations wait on both tails without installing a new tail.
- Range move and undo wait on both tails, then install the same settled promise into both tails.
- Automatic scene analysis owns its third analysis tail.
- Canon and continuity review prepare under the mutation lane, call the connector outside it, then record under the mutation lane.
- The ledger and direct DatabaseSync are two handles to the same DB. Never introduce a ledger transaction inside a transaction held by the direct handle.
- `#reload` replaces catalog/profile and preserves live document target/sequence state. Inject current getters, never captured snapshots.

Responsibility candidates, identified by symbols (line positions drift during active editing):

1. Publishing: public `createPublishingPartner` through `reviewPublishingMailCandidate`; serial methods of the same group; own `#publishingAssistantCandidates`; publishing row types, SQL and readers. Requires database, ledger, catalog getter, current document targets, publishing assistant and timezone. SubmissionSnapshot + SubmissionPackage + submission transaction stays intact. `parseStoredStringArray` and work structure revision readers are shared.
2. Manuscript/revision/resume: saveChangeBatch/saveDocumentChange/saveFormatting, duplicate-batch map, document target map, profile updates, resume, snapshots. Keep append-before-state publication and exact idempotency/sequence behavior.
3. Scene/Canon review: runCanonReview/runContinuityReview/runAutomaticSceneAnalysis, settings and analysis ledger. Reuse actual existing canon/continuity/context/digest services.
4. Music: work music settings and scene music queues. Keep superseding old selected candidate and selecting the new candidate in one transaction; external search between preparation and recording.
5. Remaining structure, character/lore, assistant permissions/extraction, activity/schedule/settings and workspace catalog operations must also acquire real owners before calling the central runtime composition-only.

Existing `src/desktop/runtime/*` are mostly IPC method pickers. New pickers alone are insufficient. Target services must own logic and transactions; the public facade delegates with preserved queue semantics.

Architecture checks must inventory all desktop source, forbid services importing the facade and importing IPC registration, detect service cycles, and prohibit domain SQL in composition files. Bootstrap's manuscript close channel belongs in a lifecycle adapter if IPC references become restricted.

Final verification should include the runtime suite, persistence/typing/reopen, publishing forms, delayed analysis, local-media backup/restore E2E, process POC-3 and Canon review process tests.
