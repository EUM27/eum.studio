# Gate 8 — 별빛 Markdown 내보내기 검증

Gate 8은 SQLite 별빛 원장을 그대로 유지하고, 사용자가 별빛 작업면에서 명시적으로 실행할 때만 `canonical-to-markdown` 사본을 만든다. 새 Markdown 저장 원본, watcher, sync, parser, import, write-back 경로는 추가하지 않았다.

application adapter는 작품·현재 DocumentRevision과 인물, 인물 관계, 설정, 사건, 플롯, 복선, stable Scene, 연속성, 인물 지식의 9종 별빛을 결정적으로 정렬한다. 각 note에는 source entity ID·revision·상태·source manifest hash와 `read_only_copy: true`를 기록하고 typed relation을 Obsidian `[[note|표시명]]` 링크로 투영한다. 같은 별빛 상태는 엔티티 입력 순서나 앱 재실행과 무관하게 같은 source/bundle hash와 같은 UTF-8 bytes를 만든다.

Node adapter는 사용자가 선택한 상위 폴더 아래 새 디렉터리에만 게시한다. 절대/상위/역슬래시 경로, Markdown 이외 확장자, 중복 경로, byte/hash/manifest 불일치를 쓰기 전에 거부한다. 모든 파일을 별도 staging에서 write·sync·readback 검증한 뒤 디렉터리를 게시하고, 기존 결과는 덮어쓰지 않고 `-2`, `-3` 이름으로 보존한다. renderer에는 절대 경로를 반환하지 않는다.

## 최신 증거

- application·platform·bridge·IPC·renderer·실제 local workspace 집중 7파일 14개 통과, runtime의 9종 별빛 bundle 검증은 100개 비관련 테스트를 제외하고 별도 통과
- production Electron에서 별빛 9종 10행을 실제 생성하고 색인 포함 Markdown 11개를 게시, Obsidian 링크·manifest·FK 0 확인
- 첫 export의 인물 Markdown을 외부에서 변조한 뒤 앱을 완전히 재실행해도 SQLite 인물 별빛이 바뀌지 않았고, 두 번째 export는 변조가 없는 동일 bytes를 새 `-2` 폴더에 게시
- Gate 2–8 전용 production Electron E2E 8건 전체 통과. 첫 묶음 7건과 Windows GPU/sandbox 진단 뒤 별빛 검토 1건 재실행으로 확인했으며 제품 BrowserWindow sandbox 정책은 유지
- 전체 Vitest: 314파일·1,146개 통과, 1개 skip, 시작 시점과 같은 `RuntimeBootstrapController.test.ts:343` 1개 실패만 유지
- lint, 4개 TypeScript project, architecture, production build, diff check 통과
- Canon Markdown import/sync/watch/write-back surface scan: 0건

성능 fixture는 제품 제한이나 사용자 데이터 기본값이 아니다. 500개 DocumentRevision 참조와 별빛 종류별 100개, 총 900개 엔티티에서 901개 Markdown·914,934 bytes를 만든 p50/p95는 21.9911/28.9680ms였다. 10회 모두 bundle hash가 같았고 `importSupported`는 false다.
