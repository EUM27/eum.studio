# T058 ActivityController sequence

WorkActivity is the single authoritative projection for WritingSession, FocusCycle, records, and goals; actual time/characters derive only from WritingSession. Pomodoro is a second projection over the same FocusCycle store and must continue refreshing WorkActivity after mutations.

## Safe order

1. Injected four-query ActivityWorkBundle loader.
2. Projection owner plus goals/readthrough/export actions.
3. Shared activity gate and manual WritingSession lifecycle with synchronous ref.
4. Pomodoro clock/reconcile/alert with persistence and music ports.
5. Keep two distinct input adapters and blur ordering.
6. Focus-owned session identity/transition promise.
7. Close participant last; it settles only the exact owned session and never flushes itself.

The first Worker moves only `listWork`, `getPomodoro`, `getRecordsGoals`, and `getReadthrough` in one Promise.all. App keeps effect disposal/null reset/error/install/action behavior. Files are App plus `features/activity/{activity-client,activity-controller,activity-controller.test}.ts`.

## Critical invariants

- Session start/stop persists first, then bridge command, then immediately updates `activeWritingSessionRef` before React projection.
- Input resumes only paused Work Pomodoro, records durable change, then serially reconciles document-owned session. Blur in focus mode persists only; otherwise it stops the matching session or persists.
- Focus mode never claims an existing manual session. It records only the ID it starts, stops a late start after an enter/exit race, and clears/stops only that exact owned ID.
- Pomodoro start partial success is not rolled back by later activity/music refresh failure.
- Close order remains all-document flushForClose, reading, layout, focus transition, exact owned session stop, resume capture. Manual sessions are not closed. Any rejection keeps the window open.
- Restored running Pomodoro is paused/restore; first input resumes paused Work only, not break.
- Keep shared activity gate and separate goals/readthrough/export gates. Do not connect dormant startFocus or add retry/rollback/validation.

Before focus/close extraction, add direct characterizations for manual-session focus enter/exit preservation and focus-owned graceful close.
