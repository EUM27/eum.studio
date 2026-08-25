# T057 MusicController boundary

MusicController owns WorkMusicSettings (playlist/favorites/local media under one revision), library projection/gates/errors, SceneMusicQueueCandidate ledger, YouTube profile, and monotonic immutable playback requests. `MusicMiniPlayer` remains the single transport engine owning IFrame/HTMLMediaElement refs, queue/index/time/paused/loading/repeat/shuffle/volume/video state.

Shell retains the always-mounted topbar portal, settings dialog/API-key status, transient Work projection, and revision invalidation. API key plaintext and local absolute paths never enter controller state: safeStorage and media descriptors remain main/platform; renderer sees only configured status and `eum-media://` URLs.

## Preserve

- Work settings reload on active Work/settings revision, delayed null reset, no eager A-to-B clear, silent load failure to null/empty.
- Playback survives Work/home navigation; do not remount/key player or auto-stop.
- Playlist/local media/favorites stay one revision owner. Queue save optimistic rollback only restores the previous playlist.
- Registered external/managed media is not auto-deleted if later settings save fails.
- Scene search uses exact Work/scene/annotation revision and explicit query; Candidate selection uses exact revision/option; no auto-play before explicit selected/current queue.
- Queue refresh failure never rolls back the saved selection or Structure annotation.
- Pomodoro autoplay ordering remains durable persist, Pomodoro start/install, activity refresh, explicit setting check, cursor/scene+queue refresh, resolved current scene, selected/current option, then playback request. No selected queue means no request.
- Do not activate currently unimplemented automatic episode/scene transitions or precise selection.

First slice moves only Work settings/profile/play-request core into App plus `features/music/{music-client,music-state,useMusicController,useMusicController.test}.ts`. Existing library/scene mutation callbacks use compatibility reconciliation methods. Shell/player/library/Structure/Activity/CSS/bridge/platform remain untouched. Verify music application/platform/renderer contracts, bridge/runtime cases, full check, and connection/inspiration/queue/topbar/local-media production flows.
