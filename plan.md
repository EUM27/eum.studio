# 이음 스튜디오 실행 상태

기준 계획: [신규 기반 POC 실행 계획](C:/Users/limoj/Documents/Codex/2026-07-15/new-chat-2/eum-implementation-foundation-2026-07-20/08-foundation-poc-execution-plan.md)

마지막 갱신: 2026-07-23

## 현재 Gate

`POC-1 — 장편 편집기` 완료

완료한 검증 단위:

- 장편 fixture manifest와 결정적 generator
- Work·Document·in-memory revision adapter
- ResumeCheckpoint envelope와 작품별 명시적 빈 상태
- 실제 CodeMirror 원고 편집 표면과 transaction 추출
- 정확한 마우스·키보드 선택 범위
- selection transaction의 선택 원문 hot path 제거
- 등록형 괄호·따옴표 자동 닫힘·닫는 기호 건너뛰기·가운뎃 말줄임표
- 본문·커서와 등록형 입력 규칙의 undo·redo
- atomic ResumeCheckpoint envelope capture
- 한글 IME 조합·확정·undo·redo
- 문서별 `EditorState`·선택·스크롤·undo 이력 보관과 복원
- CodeMirror 오프셋과 grapheme 기반 사용자 문자 통계 분리
- Anchor 소유권·revision 검증과 정확·모호·손상 복귀 계약
- Work별 독립 상태를 보존하는 닫을 수 있는 양쪽 레일 shell
- 활성 Work 원고 검색과 문서 전환·검색·입력 p50·p95 측정

다음 Gate: `POC-2 — 영속화·강제 종료`

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

## POC-1 완료

- [x] 장편 fixture manifest와 generator
- [x] Work·Document·in-memory revision adapter
- [x] ResumeCheckpoint envelope와 작품·문서·revision 소유 경계
- [x] CodeMirror 편집 표면
- [x] 정확한 선택 범위
- [x] selection transaction의 좌표 전용 payload
- [x] 괄호·따옴표 자동 닫힘과 기존 닫는 기호 건너뛰기
- [x] CodeMirror history 기반 undo·redo
- [x] ResumeCheckpoint 저장과 `Work.resumeCheckpointId` 갱신 transaction
- [x] 한글 IME
- [x] 문서 전환 전 문서별 EditorState 보관·복원 정책
- [x] CodeMirror 오프셋과 사용자 표시 문자 통계 분리
- [x] 정확한 복귀 전 Anchor 소유권·revision 검증과 복원·손상 계약
- [x] 닫을 수 있는 양쪽 레일 shell
- [x] 문서 전환·검색·입력 p50·p95 측정

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
- checkpoint 삽입, `Work.resumeCheckpointId` 변경, Work revision 1회 증가를 전용 application transaction으로 묶는다.
- application은 읽기 전용 WritingCatalog를 mutate하지 않고 새 Work 값을 구성하며, platform adapter가 Work·checkpoint 사본을 한 번의 copy-on-write state 게시로 원자적으로 바꾼다.
- 등록 작품에 Work 포인터가 없으면 작품 ID를 보존한 명시적 `missing` 상태를 반환하고, 등록되지 않은 작품과 구분한다.
- ResumeCheckpoint는 해당 작품 소유 문서의 현재 durable revision에만 저장할 수 있다.
- 작품별 checkpoint 조회는 `Work.resumeCheckpointId`만 원본으로 사용하며 다른 작품이나 다른 checkpoint로 fallback하지 않는다.
- dangling·교차 작품 Work 포인터는 명시적 무결성 오류로 거부한다.
- 교차 작품 문서, stale Work revision·포인터·document revision, 중복 checkpoint ID는 Work와 checkpoint 상태를 모두 바꾸지 않고 거부한다.
- 같은 Work 상태에서 시작한 동시 capture 두 건 중 정확히 하나만 성공하고 실패한 checkpoint는 저장되지 않는다.
- 이전 checkpoint와 중첩 메타·맥락 참조는 동결된 불변 이력으로 남고 Work 포인터만 새 checkpoint로 이동한다.
- 공식 현재 문서와 registry를 확인해 `@codemirror/state`와 `@codemirror/view`를 직접 dependency로 정확히 고정했다.
- React가 EditorView의 생성·정리 생명주기만 소유하고 renderer 밖 저장소나 Electron API를 편집 표면에 연결하지 않는다.
- CodeMirror transaction에서 변경된 span·삽입문과 결과 selection 좌표를 원고·선택 원문 사본 없이 불변 payload로 추출한다.
- 실제 production bundle의 편집 표면은 접근성 이름과 시각적 focus 표시가 있는 `textbox`이며, 입력 본문과 grapheme 기반 파생 문자 통계를 함께 표시한다.
- 실제 Electron E2E에서도 기존 sandbox typed bridge 경계와 console error 0을 유지한다.
- selection payload는 정규화된 `from/to`, 역방향 `anchor/head`, 빈 범위 여부만 보존한다.
- 선택 원문은 상시 transaction에서 복사하지 않고 구조 명령 실행 시점에 현재 revision과 함께 다시 검증하는 경계에서만 구체화한다.
- 실제 Electron에서 키보드 역방향 선택과 같은 줄 mouse drag가 선택한 일부 문자만 유지하며 행·문단 전체로 확장되지 않는다.
- 화면의 선택 활성 상태는 좌표 payload의 `empty` 값에서만 파생하며 선택 원문을 구체화하지 않는다. 실제 DOM selection과 좌표 경계가 일치하고, 무작위 mouse 범위 반복 5회에서 무단 확장 재현이 0이다.
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
- 한글 조합 문자열은 장편 fixture manifest에서 읽고 실제 Electron의 Chromium IME composition 경로로 후보·완성 문자열을 갱신한 뒤 확정한다.
- 조합 문자열과 같은 opener가 runtime profile에 등록돼 있어도 조합 중 자동 닫힘은 실행되지 않으며 확정 본문이 분해·중복되지 않는다.
- 확정된 한글 입력은 한 번의 undo·redo로 본문이 정확히 사라졌다 복원되고, redo 뒤 후속 입력이 복원된 커서 뒤에 이어진다.
- 문서 profile은 runtime이 제공한 Work·Document·base revision·표시명·초기 본문과 최초 문서를 schema로 검증하며, 중복 문서 ID나 등록되지 않은 최초 문서를 fallback 없이 거부한다.
- React 생명주기 동안 `EditorView` 하나만 유지하고 문서마다 별도 불변 `EditorState`를 보관해 본문·방향 있는 selection·CodeMirror history를 함께 복원한다.
- 스크롤 위치는 문서 본문 상태와 별도의 CodeMirror scroll snapshot으로 저장하며, 창 높이에 고정된 실제 editor scroller에서 복원한다.
- 같은 documentId를 다른 Work나 base revision에 재사용하면 저장 상태를 대체하지 않고 소유권·revision 충돌로 거부한다.
- 실제 Electron에서 두 문서의 본문·selection·스크롤·undo·redo 이력이 서로 섞이지 않는다.
- 한글 조합 중 문서 전환은 확정까지 미루며, 조합 문서로 다시 돌아온 경우 오래된 대기 전환을 취소한다.
- transaction의 문서 길이는 `beforeOffsetLength`·`afterOffsetLength`로 명시해 CodeMirror UTF-16 위치 범위임을 사용자 문자 통계와 구분한다.
- 사용자 문자 통계는 CodeMirror cursor와 같은 grapheme cluster 경계를 사용하고, Unicode 공백 포함·제외 값을 별도로 파생한다.
- 출판 통계 선호를 임의로 기본 설정하지 않고 공백 포함·제외 값을 같은 위계로 표시한다.
- 최초 문서 적재 때 전체 통계를 계산한 뒤 변경 transaction에서는 영향을 받은 줄만 다시 세며, selection-only transaction은 기존 통계 객체를 재사용한다.
- 반복 Unicode 경계 편집 64회를 전체 `Intl.Segmenter` 결과와 대조해 결합 문자·ZWJ emoji·공백·줄바꿈 이후에도 증분 통계가 일치한다.
- 실제 Electron에서 UTF-16 code unit 수가 다른 결합 문자와 ZWJ emoji를 각각 사용자 인식 문자 하나로 표시한다.
- Anchor 생성은 호출자가 지정한 정확한 `from`·`to`를 행·문단으로 확장하지 않고 Work·Document·revision 소유권과 함께 검증한다.
- Anchor 근거는 quote·좌우 context·본문 hash로 남기며 exact offset이 유지되면 그대로 복원한다.
- revision이 바뀐 뒤에도 quote와 context가 유일하게 일치할 때만 재매핑하고, 중복 후보는 `needsReview`, 근거 소실은 `broken`으로 반환한다.
- checkpoint의 cursor·selection Anchor가 다른 작품·문서·revision을 가리키거나 손상된 경우 문서는 열되 임의 위치로 이동하지 않는다.
- 좌우 레일의 수동 열림·닫힘 상태는 Work별로 독립 보관하며, 좁은 화면에서는 한쪽만 overlay로 열고 넓어진 뒤에도 사용자가 닫은 상태를 보존한다.
- 원고 중심 중앙 표면과 작품·문서·영속 저장·집중 기록 상태 바는 레일을 모두 닫아도 유지된다.
- 원고 검색은 활성 Work의 문서 표시명과 현재 원고만 조회하며 다른 Work 결과로 fallback하지 않는다. Work 전환과 원고 변경은 오래된 검색 결과를 무효화한다.
- 현재 원고는 검색 명령을 실행한 순간에만 활성 `EditorView` 또는 문서별 state registry에서 materialize하며 입력 hot path에는 전체 원고 사본을 만들지 않는다.
- 문자 통계 snapshot은 원고 transaction 안에서 즉시 갱신하지만 구독 알림은 microtask로 합쳐 보조 React 렌더를 입력 임계 경로에서 분리한다.
- 성능 profile과 품질 예산은 별도 fixture manifest가 소유하며 제품 제한이나 사용자 기본값으로 사용하지 않는다.
- 큰 장편 document profile은 caller가 선택한 파일 경로를 Electron main에 전달하고 renderer에는 파일 접근 권한을 노출하지 않는다.
- production Electron 성능 보고서는 실행 ID·commit·dirty 여부·환경·fixture/profile checksum·표본 수·p50·p95·max·정확성 판정·artifact 참조를 기록한다.
- 2작품·작품별 500문서·1,000,000자 profile에서 문서 전환 120회와 작품별 고유 probe를 검증해 소유권 위반 0건을 확인했다.
- 완료 측정 `f83e0fec-a97f-4e56-9333-fac1f89f6c2c`은 문서 전환 p50 23.519ms·p95 30.489ms, 작품 검색 p50 2.800ms·p95 3.700ms, 입력 p50 7.500ms·p95 15.400ms이며 모든 예산과 정확성 판정을 통과했다.

검증:

- `npx vitest run tests/unit/longform-fixture.test.ts` — 5개 통과
- `npx vitest run src/domain/writing-catalog.test.ts src/platform/revisions/in-memory-revision-store.test.ts` — 16개 통과
- `npx vitest run src/platform/checkpoints/in-memory-resume-checkpoint-capture.test.ts` — 원자성·충돌·동시성·포인터 무결성 7개 통과
- `npx vitest run src/renderer/editor/manuscript-transaction.test.ts` — 좌표 전용 selection payload 2개 통과
- `npx vitest run src/application/editor/manuscript-input-profile.test.ts src/renderer/editor/manuscript-input-rules.test.ts` — 10개 통과
- `npx vitest run src/application/contracts/studio-bridge.test.ts` — 6개 통과
- `npx vitest run src/application/editor/manuscript-document-profile.test.ts src/renderer/editor/manuscript-document-state.test.ts` — runtime 문서 profile·상태 소유권 6개 통과
- `npx vitest run src/renderer/editor/manuscript-text-statistics.test.ts` — grapheme·공백·증분 갱신·selection hot path 4개 통과
- `npx vitest run src/application/anchors/create-anchor.test.ts src/application/checkpoints/resolve-resume-checkpoint-for-work.test.ts` — Anchor 생성·복원·손상·복귀 6개 통과
- `npx vitest run src/renderer/workspace-rail-state.test.ts src/application/editor/search-manuscripts.test.ts` — 레일 상태·현재 원고 검색 5개 통과
- `npx vitest run src/application/measurement/poc-1-performance-profile.test.ts src/application/measurement/poc-1-performance-report.test.ts` — 성능 profile·보고서 4개 통과
- `npm run test:run` — 23개 파일·단위 88개 통과
- `npm run check` — lint·typecheck·단위 88개·production build 통과
- `npm run test:e2e` — sandbox bridge·실제 CodeMirror 입력·사용자 문자 통계·undo·redo·한글 IME·문서별 상태·정확한 선택·등록형 입력 규칙·양쪽 레일·작품 검색 14개 통과
- `npm run performance:poc-1` — production Electron 장편 profile의 문서 전환·작품 검색·입력 p50·p95와 소유권 정확성 통과
- `artifacts/poc-1-performance/f83e0fec-a97f-4e56-9333-fac1f89f6c2c/measurement.json` — dirty source 완료 측정 JSON
- `npm run test:e2e -- --grep "Hangul IME"` — 실제 Electron 조합·확정·undo·redo 1개 통과
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
