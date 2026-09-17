# Gate 3 CharacterKnowledge verification

Gate 3 was verified against the exact approved design checksum `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5` and current source. No live user workspace or legacy `D:\eum.editor` data was opened or modified.

## Production path

- Schema 20 and checksum-pinned migration `26636b137c36a7fadf7aea068f67e94fd787f014a96e860dee9632f228abf8cc` passed fresh-create, 19→20 migration, Work-boundary, foreign-key, immutable-history, and rollback tests.
- The Gate 3 Judge found that a second active row for the same Work, Character, and statement could bypass lineage. A partial unique index and a service-level explicit error now require the supersession command; focused service, direct-ledger, and migration tests pass.
- `LocalCharacterKnowledgeService` passed exact evidence, content-only update, atomic supersession, retirement, cross-Work rejection, stale range/revision rejection, and POV separation tests.
- The typed bridge passed command/result parsing, six-channel allowlisting, sender authentication, preload isolation, and StudioBridge regression tests.
- The renderer passed client/state, dedicated Canon tab, explicit Character target, independent stance/truth controls, lineage, exact evidence navigation, POV categories, context-menu entry, and IME-safe selection tests.

## Electron E2E

The production build was launched at 1280×800 using a caller-owned temporary workspace. The test selected exact manuscript text, invoked `인물 지식으로 저장`, explicitly selected the Character, saved `believes + false`, created a `knows + true` successor without overwriting its predecessor, projected POV context, completely closed and relaunched the app twice, and re-read both current and historical entries.

The first run exposed a real vertical overflow because both detail forms expanded beyond the viewport. The panel was changed to a bounded flex/grid surface whose three columns scroll internally. The rerun passed the viewport bounds and width checks.

Final read-only DB audit: 2 CharacterKnowledge rows, 3 immutable history rows, 1 evidence row linked to 1 exact Anchor, 1 active successor, 1 superseded predecessor, and 0 foreign-key violations.

On this Windows `10.0.26200` host, Electron's renderer sandbox child process fails before page creation. Only the E2E child uses `EUM_STUDIO_DISABLE_SANDBOX=1`; the product default remains `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and `webSecurity: true`.

## Fresh commands

- `npm run test:e2e -- tests/e2e/character-knowledge.spec.ts`: production build passed; the initial E2E found the viewport defect.
- `npx playwright test tests/e2e/character-knowledge.spec.ts`: 1 passed after the bounded-layout fix and audit-query scoping.
- `npx playwright test tests/e2e/continuity.spec.ts`: Gate 2 Electron regression 1 passed.
- `npm run test:run`: 289 files and 1,091 tests passed, 1 skipped, with the same pre-existing `RuntimeBootstrapController.test.ts:343` failure only.
- `npm run lint`, `npm run typecheck`, `npm run architecture:check`: passed.

The production build retained only the existing Vite warning for a JavaScript chunk above 500 kB.
