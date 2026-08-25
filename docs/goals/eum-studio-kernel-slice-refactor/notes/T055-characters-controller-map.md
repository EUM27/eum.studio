# T055 CharactersController boundary

The first coherent owner includes canonical characters, relations, manual evidence, extraction Candidates, and generation Candidates together. Candidate decisions update canonical characters, and character retirement prunes relations, so splitting them would create competing authoritative owners.

Keep WorkInspirationSettings outside: character and event keywords share one revision. Keep ChatGPT OAuth/assistant connections outside: scene and assistant features also consume them. The current five-way Work load may expose OAuth status as a temporary read-through projection only; do not duplicate it.

## Clients and ports

`CharactersClient` is the existing 15-method characters namespace: canonical CRUD/evidence, relation CRUD, extraction run/list/decide, and generation run/list/decide. A narrow assistant client exposes only OAuth status and one-time context permission grant. Inputs retain the shared conversation ID and active Work ID.

The manuscript port captures/persists the current exact selection. The navigation port opens character evidence through `current-selection`; current behavior checks resolved integrity/range but does not reject on evidence revision mismatch. Workspace retains active session, CodeMirror, durable revision, DocumentNavigator, tab/resume, and the review-selection coupling shared with scene extraction.

## Preserve

- One five-way all-or-error Work load, no eager A-to-B clear, disposed stale responses only.
- Null reset timing and the current asymmetric action-gate resets.
- Load failure clears four lists and sets only the canonical error.
- Command-return reconciliation only; no follow-up list refresh.
- Candidate merge exact revisions, target revision, and explicit field set.
- Extraction login/result-driven permission flow (`character.extract`, selection scope, once); no OAuth preflight.
- Manual evidence order: capture selection, durable persist, current revision, addEvidence(expectedRevision).
- Local inspiration draw remains explicit canonical creation with no GPT call.
- `activeWorkCharacters` remains the projection shared by character UI, scene features, structure, and assistant setting references.
- Candidate UI remains in the existing review panel; do not add generation UI or delete dormant props.

The first Worker owns App plus `features/characters/{characters-client,characters-state,useCharactersController,useCharactersController.test}.ts`; component/application/runtime/bridge/preload/main/E2E/navigation files remain unchanged. Verify character/relation/extraction/generation/inspiration contracts and UI, bridge/runtime cases, Navigator, full check, and character/inspiration production Electron flows.
