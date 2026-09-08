# 작업공간 런타임 책임과 저장 경계

`src/desktop/local-workspace-runtime.ts`는 public import와 기존 `LocalWorkspaceRuntime` 계약을 유지한다. storage를 열고 `workspace-runtime/composition.ts`에서 실제 서비스를 조립한 다음 초기화를 기다린다. 초기화 실패 시 두 DB handle을 닫는다. 메서드만 다른 큰 파일로 옮긴 구조가 아니라 public facade의 각 함수가 책임 서비스의 구현에 bind된다.

`storage.ts`는 SQLite·ledger·revision store를 연다. `WorkspaceRuntimeState`는 모든 서비스가 사용하는 메모리 상태의 단일 소유자이며 state loader와 repository는 현재 DB에서 이를 구성한다. 서비스는 필요한 state/storage/options와 다른 서비스의 좁은 typed dependency port를 주입받는다. composition을 다시 import하거나 숨은 전역 런타임을 조회하지 않는다.

| 책임 | 구현 위치 (`workspace-runtime/services/`) |
|---|---|
| 원고 저장·리비전·복귀·회차 사이 이동 | `manuscript-core`, `manuscript-history`, `manuscript-resume`, `manuscript-transfer` |
| 원고 주석·조각·장면 구조와 휴지통 | `manuscript-annotations`, `fragments`, `scene-geometry`, `scene-annotations`, `scene-trash` |
| 작품·설정·활동·기반 저장 처리 | `workspace`, `settings`, `activity`, `infrastructure` |
| 인물·별빛·사건·플롯·복선 | `character-lore`, `events`, `event-rail`, `plots`, `foreshadowing` |
| 조수 실행·장면과 정본 검토 | `assistant`, `analysis` |
| 투고·음악·백업·Markdown 내보내기 | `publishing`, `music`, `backup`, `canonical-export` |

한 작업으로 함께 기록해야 하는 SQL과 transaction은 해당 command 구현에 함께 남겼다. 기존 `SaveChangeBatch`의 작품·문서·기준 리비전·순서·identity 검증과 동일 요청의 멱등 receipt는 바꾸지 않는다. append/sync 성공 전 메모리 head를 전진시키지 않는다. 승인 Candidate의 source/target 재검증, 원고와 Anchor의 원자 저장도 같은 실행 경로를 유지한다.

`WorkspaceOperationCoordinator`는 기존 세 tail을 소유한다. save는 저장 tail, 일반 변경은 mutation tail, 외부 분석은 별도 analysis tail을 사용한다. 각 mutation은 큐에 등록될 때 선행 save promise를 캡처하여 callback의 `priorSaves`로 받는다. callback 시작 뒤에 등록된 transfer를 다시 기다리지 않으므로 mutation과 transfer 사이의 순환 대기를 막는다. read barrier는 mutation과 save를 기다리며 새 작업을 enqueue하지 않는다. 회차 사이 이동은 두 tail이 모두 끝난 후 실행되고, 결과를 settle한 **같은 promise**를 두 tail에 등록한다. 서비스마다 별도 lock을 만드는 구조가 아니다. 실패한 호출은 원래 호출자에게 오류를 반환하되 다음 작업은 진행할 수 있다.

bootstrap은 앱 생명주기·창·기존 runtime 선택·IPC 조립을 소유한다. profile 입력은 `runtime/load-application-profiles.ts`가 읽고 충돌을 검증하며, `runtime/create-configured-application-runtime.ts`가 기존 구성형 runtime의 typed public API를 만든다. 개별 close IPC 전송도 `ipc/send-manuscript-close-request.ts`에 있다.

`architecture:report`는 production `src`의 TS·TSX·JS·MJS 파일 전체에서 크기·구문·resolved import를 측정한다. `architecture:check`는 기존 domain/application/renderer 경계 외에 main/bootstrap/runtime 진입점의 SQL과 개별 IPC 참조, 서비스의 composition 역참조·IPC·동적 module 접근·서비스 의존 순환을 검사한다. 큰 서비스도 보고서에 포함되므로 크기를 숨기지 않는다. 파일 크기 자체를 실행 성능으로 해석하거나 임의 줄 수를 통과 조건으로 사용하지 않는다.

저장 큐와 작품·연결 수명에 대한 회귀 범위는 [작업 흐름 검토 수정](verification/review-workflow-fixes.md)에 기록한다. 원고 연속 입력·재열기·회차 전환·정상 종료·강제 종료 복구·실제 패키지 실행의 결과는 실행별 검증 JSON으로 확인하며, 필수 실행 방법과 코드 지문 범위는 [검증 절차](verification.md)를 따른다.
