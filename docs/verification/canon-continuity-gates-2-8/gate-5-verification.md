# Gate 5 — 이야기 지금까지 검증

Gate 5는 schema 22의 불변 `NarrativeDigest` 원장, 사용자가 직접 고르는 작품·회차·인물·관계 범위, 결정적 source manifest/hash, current/stale projection, 새 행을 만드는 재생성으로 구현했다. 기존 digest text는 별빛이나 원고가 바뀌어도 수정·삭제하지 않는다.

실제 실행 경로는 source revision 확인 → Context Planner → 권한/정확 범위 receipt → receipt-linked manifest → connector → digest 저장 → 민감 본문 없는 활동 기록 순서다. 작품 범위 digest는 문서 선택 수와 무관하게 local/external `work`, 단일 문서의 제한된 비작품 범위는 `chapter`, 여러 문서를 고른 비작품 범위는 `work` 권한을 요구한다. 필수 문맥이 connector manifest 예산을 넘으면 receipt나 connector 호출 전에 실패한다. `WorkQuickMemo`는 이 경로에서 읽거나 합치지 않는다.

## 최신 증거

- schema 21→22 migration checksum: `2a58768056ce93850de5c70508969e446480e77851b218b64d3b56fcbde81fcf`
- 집중 계약·ledger·migration·service·connector: 6파일 12검증 통과
- 실제 local workspace 생성·stale·재생성·재시작: 통과
- typed bridge·IPC·preload·전용 Canon 탭: 7파일 24검증 통과
- production Electron: 현재 digest → 별빛 변경 → 기존 text 보존 stale 경고 → 연결 없음 재생성 안전 실패 → 2회 완전 재실행, viewport, FK 0 통과
- 전체 Vitest: 309파일·1,133개 통과, 1개 skip, 시작 시점과 같은 `RuntimeBootstrapController.test.ts:343` 1개 실패만 유지
- lint, 4개 TypeScript project, architecture, production build, diff check: 통과

성능 fixture는 제품 제한이나 사용자 기본값이 아니다. 500문서와 2,400 canonical source에서 source hash p50/p95는 1.3824/2.0500ms, 한 DocumentRevision 변경을 포함한 stale rehash p50/p95는 1.4161/1.7531ms였다.
