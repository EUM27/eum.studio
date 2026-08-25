# T048 scene navigation characterization map

Use the existing E2E fake ChatGPT OAuth/SSE bootstrap and only UI-triggered scene generation. Direct bridge calls are read-only for candidate IDs, source revision, offsets, and integrity. Do not seed Candidates through bridge, SQLite, or private IPC because App-local candidate state would be bypassed.

## Scene boundary preview

- Generate an extraction Candidate from a long, runtime-created episode A with a boundary outside the initial viewport.
- Reset A cursor to offset 1 and `.cm-scroller.scrollTop` to 0, then create/switch to episode B.
- From the Scene surface click `원고에서 분할선 미리보기`.
- Prove A active title/ID, selection anchor/head still 1, editor focused, scrollTop greater than 0, one `.cm-scene-boundary-preview`, unchanged A/B text, and no new target tab.
- Use a 180-second focused test budget. If the scroll delta is not observable, lengthen only the runtime-generated source/boundary placement; do not change product behavior.

## Stale scene draft compare

- Generate a scene draft at the end of a long episode A through the existing UI.
- Replace A with shorter but still scrollable current text and save it.
- Click `이 위치에 삽입` once so the application returns the stale Candidate and the card changes to `기준 변경됨` / `현재 원고와 비교`.
- Read-only bridge proof: stale integrity, old insertion offset greater than current length.
- Reset A cursor to 0 and scrollTop to 0; create/switch to episode B; reopen the plot Candidate and click `현재 원고와 비교`.
- Prove A active, cursor still 0, editor focused, scrollTop greater than 0 (current-length clamp), unchanged diff text and stale state, unchanged shortened A and B manuscripts, and no new target tab.

Reuse existing E2E helpers and unique runtime plot/title/text values. Stop if the Candidate requires a direct write, stale transition requires DB mutation, current product fails the expected flow, or product code must change to make the evidence observable.
