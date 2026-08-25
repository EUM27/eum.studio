# R1-3 active CSS split map

The only runtime cascade entry is `src/renderer/main.tsx` importing `shell/studio-app-shell.css`. Root `styles.css` and `shell.css` are dormant lookalikes; importing their backup/import/event rules would activate new behavior and is forbidden.

Feature rules and late responsive/theme overrides are interleaved. Stage 1 therefore uses ordered compatibility shards split only from the front of the active file, imported centrally from `main.tsx`. Component-local imports or selector regrouping would change cascade order.

## Ordered slices

1. R1-3a: active CSS original lines 1-605 to `styles/shell-foundation.css`, 606-802 to `styles/library.css`, retain 803-end in the residual active file; import in exactly that order.
2. R1-3b: next 803-817 shared controls and 818-1113 library cards; keep the mixed secondary/library/work-card selector group intact.
3. R1-3c: 1114-1240 workspace editor shell and 1241-1254 document controls.
4. R1-3d: 1255-2467 workspace layout and 2468-3377 document-rail compatibility as whole contiguous blocks; the latter intentionally keeps document tree/completion/activity/title coupling.
5. R1-3e: 3378-4775 workspace IA compatibility and 4776-5172 dialogs; leave later responsive/theme overrides in the residual until a separate ordered pass.

The baseline active CSS SHA-256 is `101FDA86519F33CFE90D22709C738D65E3C142592AB77FD7AA6460CC1E63A737`.

## First Worker slice

Allowed files:

- `src/renderer/main.tsx`
- `src/renderer/shell/studio-app-shell.css`
- `src/renderer/styles/shell-foundation.css`
- `src/renderer/styles/library.css`
- `src/renderer/shell/studio-app-shell-layout.test.ts`

Concatenating the three ordered CSS files must reproduce the exact original byte sequence and hash. Verify shell layout, LibraryPage, WorkCard units, lint, typecheck, build, the one-sidebar layout E2E, and the responsive Work-card E2E.

Stop if the baseline hash drifted, selectors/declarations/whitespace/media/theme rules would be changed/duplicated/reordered, dormant CSS would be imported, raw-CSS expectations need more than ordered-path adjustment, or the concatenation hash differs.
