# 이음 스튜디오 실행 상태

기준 계획: [신규 기반 POC 실행 계획](C:/Users/limoj/Documents/Codex/2026-07-15/new-chat-2/eum-implementation-foundation-2026-07-20/08-foundation-poc-execution-plan.md)

마지막 갱신: 2026-07-22

## 현재 Gate

`POC-1 — 장편 편집기` 진행 중

완료한 검증 단위:

- 장편 fixture manifest와 결정적 generator
- Work·Document·in-memory revision adapter
- ResumeCheckpoint envelope와 작품별 명시적 빈 상태
- 실제 CodeMirror 원고 편집 표면과 transaction 추출
- 정확한 마우스·키보드 선택 범위
- selection transaction의 선택 원문 hot path 제거
- 등록형 괄호·따옴표 자동 닫힘·닫는 기호 건너뛰기·가운뎃 말줄임표
- 본문·커서와 등록형 입력 규칙의 undo·redo

다음 검증 단위: ResumeCheckpoint 저장과 `Work.resumeCheckpointId` 갱신의 단일 transaction

## 완료

- [x] 현행 `D:\eum.editor`와 분리된 프로젝트 경로 선택
- [x] `D:\eum.studio` 생성
- [x] 제품명 `이음 스튜디오` 확정
- [x] 레거시 읽기 전용 경계 기록
- [x] 루트 프로젝트 지침 기록
- [x] 승인 설계 checksum manifest 기록
- [x] 공식 Electron·Node 지원 조합 확인
- [x] npm과 단일 package 기반 scaffold 결정
- [x] domain·application·platform·desktop·preload·renderer 경계 생성
- [x] renderer sandbox·CSP·navigation 정책 검증
- [x] 공통 환경·성능 측정 manifest 정의
- [x] 빌드·타입·단위·데스크톱 E2E 명령 기록

## POC-1 다음 묶음

- [x] 장편 fixture manifest와 generator
- [x] Work·Document·in-memory revision adapter
- [x] ResumeCheckpoint envelope와 작품·문서·revision 소유 경계
- [x] CodeMirror 편집 표면
- [x] 정확한 선택 범위
- [x] selection transaction의 좌표 전용 payload
- [x] 괄호·따옴표 자동 닫힘과 기존 닫는 기호 건너뛰기
- [x] CodeMirror history 기반 undo·redo
- [ ] ResumeCheckpoint 저장과 `Work.resumeCheckpointId` 갱신 transaction
- [ ] 한글 IME
- [ ] 문서 전환 전 문서별 EditorState 보관·복원 정책
- [ ] CodeMirror 오프셋과 사용자 표시 문자 통계 분리
- [ ] 정확한 복귀 전 Anchor 소유권·revision 검증과 복원·손상 계약
- [ ] 닫을 수 있는 양쪽 레일 shell
- [ ] 문서 전환·검색·입력 p50·p95 측정

## POC-1 현재 증거

- manifest가 작품 수·문서 수·작품별 문자 수·장문 문서·장문 단락·텍스트 재료를 소유한다.
- generator는 seed로 결정되며 입력 manifest를 변경하지 않는다.
- 체크인된 프로필은 작품마다 1,000,000자와 500개 문서를 생성한다.
- 한글·영문·숫자·따옴표·괄호·반복 문장·장면 구분자 후보를 자동 검증한다.
- 품질 프로필 수치는 fixture에만 있으며 제품 제한이나 사용자 기본값으로 사용하지 않는다.
- Work와 Document는 호출자가 제공한 불투명 ID를 사용하며 중복 ID와 소유 작품이 없는 문서를 거부한다.
- workId와 documentId가 실제 소유 관계일 때만 revision append를 허용한다.
- append는 기대 현재 revision을 검사하고 stale·중복 revision을 기존 이력 변경 없이 거부한다.
- 생성한 DocumentRevision은 동결하며 부모 revision 본문을 별도 불변 이력으로 유지한다.
- 등록 문서의 빈 revision 상태와 등록되지 않은 문서를 구분한다.
- 등록 작품에 checkpoint가 없으면 작품 ID를 보존한 명시적 `missing` 상태를 반환하고, 등록되지 않은 작품과 구분한다.
- ResumeCheckpoint는 해당 작품 소유 문서의 현재 durable revision에만 저장할 수 있다.
- 작품별 checkpoint를 독립 조회하며 다른 작품의 마지막 위치를 전역 fallback으로 사용하지 않는다.
- 교차 작품 문서·stale revision·stale checkpoint 쓰기는 현재 checkpoint를 바꾸지 않고 거부한다.
- 저장한 checkpoint와 중첩 메타·맥락 참조를 동결하고 낙관적 현재 checkpoint ID로 교체를 보호한다.
- 공식 현재 문서와 registry를 확인해 `@codemirror/state`와 `@codemirror/view`를 직접 dependency로 정확히 고정했다.
- React가 EditorView의 생성·정리 생명주기만 소유하고 renderer 밖 저장소나 Electron API를 편집 표면에 연결하지 않는다.
- CodeMirror transaction에서 변경된 span·삽입문과 결과 selection 좌표를 원고·선택 원문 사본 없이 불변 payload로 추출한다.
- 실제 production bundle의 편집 표면은 접근성 이름과 시각적 focus 표시가 있는 `textbox`이며, 입력 본문과 파생 문자 수가 일치한다.
- 실제 Electron E2E에서도 기존 sandbox typed bridge 경계와 console error 0을 유지한다.
- selection payload는 정규화된 `from/to`, 역방향 `anchor/head`, 빈 범위 여부만 보존한다.
- 선택 원문은 상시 transaction에서 복사하지 않고 구조 명령 실행 시점에 현재 revision과 함께 다시 검증하는 경계에서만 구체화한다.
- 실제 Electron에서 키보드 역방향 선택과 같은 줄 mouse drag가 선택한 일부 문자만 유지하며 행·문단 전체로 확장되지 않는다.
- 화면의 파생 선택 문자 수가 실제 DOM selection과 일치하고, 무작위 mouse 범위 반복 5회에서 무단 확장 재현이 0이다.
- 자동 닫힘 pair와 입력 치환은 schemaVersion을 포함한 runtime profile에서 받아 깊게 동결하며, 제품 코드에 특정 pair 목록을 두지 않는다.
- 같은 여는 token에 서로 다른 닫는 token을 등록하거나 같은 치환 trigger를 중복 등록하면 모호한 profile로 거부한다.
- CodeMirror input handler는 전체 원고 사본 대신 현재 입력 주변의 필요한 문자열만 읽고, 단일 cursor의 `input.type`만 처리한다.
- 조합 입력·붙여넣기·선택 범위 교체는 가로채지 않고 CodeMirror 기본 동작에 맡긴다.
- 대칭 따옴표처럼 여는 token과 닫는 token이 같아도 기존 닫는 기호 건너뛰기를 자동 닫힘보다 먼저 적용한다.
- 실제 Electron에서 fixture manifest가 등록한 대괄호·큰따옴표·작은따옴표·임의 두 글자 사용자 pair가 모두 자동으로 닫히며, 닫는 기호를 입력한 뒤 suffix가 기존 closer 뒤에 이어진다.
- runtime profile의 `...` 입력 치환은 사용자가 지정한 가운뎃 말줄임표 `⋯` 하나를 삽입한다.
- 공식 registry의 `@codemirror/commands`를 직접 dependency로 정확히 고정하고 CodeMirror history와 플랫폼 기본 keymap만 사용한다.
- 일반 중간 삽입을 undo·redo한 뒤 본문과 커서가 함께 복원된다.
- 자동 닫힘 pair는 opener와 closer를 한 편집 단위로 undo·redo해 고아 closer를 남기지 않는다.

검증:

- `npx vitest run tests/unit/longform-fixture.test.ts` — 5개 통과
- `npx vitest run src/domain/writing-catalog.test.ts src/platform/revisions/in-memory-revision-store.test.ts` — 16개 통과
- `npx vitest run src/platform/checkpoints/in-memory-resume-checkpoint-store.test.ts` — 6개 통과
- `npx vitest run src/renderer/editor/manuscript-transaction.test.ts` — 좌표 전용 selection payload 2개 통과
- `npx vitest run src/application/editor/manuscript-input-profile.test.ts src/renderer/editor/manuscript-input-rules.test.ts` — 10개 통과
- `npx vitest run src/application/contracts/studio-bridge.test.ts` — 5개 통과
- `npm run test:run` — 12개 파일·단위 55개 통과
- `npm run check` — lint·typecheck·단위 55개·production build 통과
- `npm run test:e2e` — sandbox bridge·실제 CodeMirror 입력·undo·redo·정확한 선택·등록형 입력 규칙 6개 통과
- `npm run test:e2e -- --grep "undoes and redoes"` — 일반 입력·등록형 입력 규칙 2개 통과
- `npm run test:e2e -- --grep "keeps keyboard and mouse selections"` — 좌표 전용 payload 적용 후 실제 선택 1개 통과
- `npm run test:e2e -- --grep "keeps keyboard and mouse selections" --repeat-each=5` — 5개 통과
- `npm run test:e2e -- --grep "applies registered pairs" --repeat-each=5` — 5개 통과

## 보류

- SQLite driver — POC-3 결과로 결정
- FTS 사용 — 패키징 런타임 시험 후 결정
- 공용 별빛 canonical 소유권 — SharedLoreEntry 결정 필요
- 음악 SDK — 첫 출시 비차단 POC
- 외부 connector UI — 첫 출시 핵심 폐회로 이후

## 중단 조건

- 새 프로젝트가 현행 앱 파일을 쓰는 경우
- renderer sandbox를 유지할 수 없는 경우
- 측정과 검증 없이 dependency·driver를 확정해야 하는 경우
- 승인 설계 checksum이 달라졌는데 검토하지 않은 경우

## Gate 0 검증 명령

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run test:e2e`
- `npm run environment:report -- --output <출력 경로>`
