# 이음 스튜디오 실행 상태

기준 계획: [신규 기반 POC 실행 계획](C:/Users/limoj/Documents/Codex/2026-07-15/new-chat-2/eum-implementation-foundation-2026-07-20/08-foundation-poc-execution-plan.md)

현재 저장 계약: [POC-2 저장 문자열과 ChangeBatch v1](docs/poc-2-durable-change-batch.md)

현재 journal 계약: [POC-2 append-only journal framing](docs/poc-2-journal.md)

현재 storage 결정: [POC-3 SQLite·blob·backup 결정](docs/poc-3-storage-decisions.md)

마지막 갱신: 2026-08-21

## 현재 Gate

`회차 완료 조건부 승인 후속 — 병합 전 P0·P1 수정과 패키징 앱 검증 완료`

회차 완료 현재 상태:

- [x] DC-0 — 첨부 설계 SHA-256과 승인 설계 manifest 11/11을 확인하고, `Document`·`ScheduleItem`과 분리된 완료 원장, 완료 시각·로컬 날짜·시간대·완료 revision, 상태 전이, 안전 저장 순서, 달력 projection과 D-DAY 호환 규칙을 [ADR](docs/architecture/document-completion-model.md)로 고정했다.
- [x] DC-1 — `document_completion_status` SQLite 원장과 13→14 migration, 소유권·revision·backup/restore 검증.
- [x] DC-2 — 완료/취소 application 명령, optimistic concurrency, catalog completion summary, typed bridge.
- [x] DC-3~DC-4 — 원고 입력 잠금·durable flush 뒤 완료 저장과 회차 트리 `○/✓/△`, 공통 헤더 동작.
- [x] DC-5~DC-6 — 일정 원장과 완료 원장을 중복 저장 없이 합성하는 `WorkCalendarProjection`과 읽기 전용 완료 occurrence.
- [x] DC-7~DC-8 — 기존 글자 수 D-DAY 모드 보존, 명시 완료 기준 두 모드와 모든 작품의 `StudioTodayProjection`.

조건부 승인 후속 상태:

- [x] 완료와 완료 취소를 `CompleteDocumentCommand`·`ClearDocumentCompletionCommand`로 분리하고, 취소에서 불필요한 원고 revision 조건을 제거했다.
- [x] DB `COMMIT` 뒤 catalog 갱신을 transaction catch 밖으로 옮겨, 커밋 후 오류가 `ROLLBACK` 오류로 덮이지 않게 했다.
- [x] 완료 상태를 파괴적 토글에서 `✓ 완료됨` 상태·`다시 완료`·별도 `완료 취소` 메뉴로 분리했다.
- [x] 완료 occurrence에 `current | edited-after-completion` 상태를 합성하고, 헤더·달력·오늘에서 완료 당시 불변 revision 본문을 읽기 전용으로 연다.
- [x] 완료 날짜·절대 시각·IANA 시간대를 엄격히 검증하고 완료 날짜 partial index를 추가했다.
- [x] 달력 조회를 실제 42칸 범위로 넓히고, 월 이동 시 선택 날짜를 함께 옮기며, 조회 실패 시 이전 projection을 비운다.
- [x] 기존 회차 수 D-DAY는 `글자 수 기준`, 명시 완료 모드는 `완료 체크 기준`으로 구분했다.
- [x] 기본 `npm test` 명령과 명시적 탐색 제외·Windows 안정 worker 수를 설정했다.

회차 완료 현재 증거:

- schema 13 실사용 DB의 온라인 백업 복사본을 14로 이주해 작품 3·문서 31·revision 23,591·투고처 1 수량과 논리 checksum을 보존하고, 완료 원장 0건·foreign key 위반 0건을 확인했다. 실행 중인 실사용 DB 원본은 쓰지 않았다.
- 완료 시 현재 원고 durable revision을 먼저 확정하고, 저장 실패 시 완료 명령이 실행되지 않는 경계를 renderer·runtime·typed bridge에 연결했다. 완료→수정 후 `△`→다시 완료→취소와 재실행 복원을 검증했다.
- 달력은 `WorkScheduleItem`을 만들지 않고 일정 occurrence와 `document-completion:{documentId}` occurrence를 application에서 합성한다. 완료 취소 뒤 완료 occurrence만 사라지고 기존 일정은 유지된다.
- 완료 날짜는 완료 당시 시간대와 함께 저장하며 한국 자정, 월말, 연말, 뉴욕 DST 전환, 현재 시간대 변경 후에도 저장 날짜를 재해석하지 않는 검증을 통과했다.
- 기존 `episodeCount`·`episodeNumber`는 글자 수 기준 의미를 유지하고, 신규 `additionalCompletedDocuments`·`totalCompletedDocuments`만 명시 완료 원장 개수를 사용한다.
- production Electron에서 저장되지 않은 원고 입력 직후 완료→달력 읽기 전용 표시→전역 오늘의 정확한 작품·회차 열기→완료 취소 시 제거→완전 재시작 원고와 미완료 상태 복원을 통과했다.
- 최신 실제 앱을 기본 사용자 데이터 경로로 정상 기동해 `user_version`·storage identity 14, 활성 작품 1·문서 31 보존, 완료 원장 0건, foreign key 위반 0건을 확인했다. 13→14 migration receipt의 논리 checksum은 전후 `a095a916…09cb`로 일치한다.
- post-COMMIT catalog 오류, stale 완료/원고 revision, 동시 완료 두 요청, 수정 뒤 완료 취소, 42칸 범위·월 이동, 불변 revision 본문 읽기와 날짜 경계를 집중 검증했다.
- `npm run lint`, `npm run typecheck`, `npm run build`, 기본 `npm test` 226개 파일·799개 통과·1개 skip이 통과했다.
- production Electron에서 완료 durable flush→달력/오늘→완료 당시 본문 보기·닫기→수정 후 재완료→메뉴 취소→재실행을 통과했다.

IA 패키징 후속 회귀 복구:

- [x] 개요·복선·별빛·집필 기록·후보 검토함의 embedded 옛 모달 배경·글자·테두리를 현재 Starlight 테마 토큰에 연결했다.
- [x] 작품 구조 개요의 회차 목록을 자르지 않으면서 작업면 내부 가로 넘침을 제거하고, 다른 구조 탭과 쓰기 작업면으로 즉시 전환되도록 유지했다.
- [x] 1080 CSS px 이하에서 음악 미니 플레이어의 4번째 `선곡·목록` 항목이 둘째 줄로 밀리던 grid 정의를 한 줄 4열로 바로잡았다.
- [x] 항목이 0건일 때 `새 플롯`·`인물 추가`·`새 별빛`·투고 운영의 모든 `새 …` 버튼이 같은 `null` 선택만 반복하던 동작을 새 빈 draft remount와 첫 입력 포커스로 바꿨다.
- [x] production Electron에서 960 CSS px 상단 음악 바 좌표와 `white-space: nowrap`, 14개 테마와 새 작업면 5종, 개요 가로 폭, 새 플롯·새 투고처 생성, 작업면 이탈을 통과했다.
- [x] 실제 Windows `device-scale-factor=1.5` 사용자 창을 window handle로 다시 렌더링해 `선곡·목록`이 상단 한 줄에 남고, 새 전역 오늘 패널이 현재 어두운 테마를 그대로 사용하는 것을 확인했다.
- [x] 노르딕 테마에서 구조 7개·검토 4개·운영·투고·일정·일정 추가·오늘을 실제 Electron으로 순회해 가시 요소의 밝은 배경 계산값이 0개임을 확인했다.
- [x] 실제 사용자 데이터 창의 `focus-dark-theme` 일정 화면을 직접 열어 밝은 배경 계산값 0개와 어두운 달력·오늘 일정·D-DAY 패널을 확인한 뒤 검사 포트 없이 일반 실행으로 복원했다.

IA 실제 기능 연결 복구:

- [x] 홈 `오늘 할 일`의 달력 아이콘을 현재 작품 일정 명령에 연결하고, 작품 이동 뒤 실제 일정 창이 열리도록 했다.
- [x] 모든 modal backdrop에 `X`·`Esc`·바깥 클릭 닫기 계약을 연결했다. 중첩 일정 편집기는 `Esc` 한 번에 안쪽 창만 닫고 바깥 일정 창을 유지한다.
- [x] 편집기 하단 사건 카드를 마우스로 드래그해 `EventBlock.outlineOrderKey`를 이동하는 typed 명령·bridge·SQLite transaction을 추가했다. 원고 Anchor 순서와 PlotPlacement 순서는 바꾸지 않는다.
- [x] 기존 timestamp JSON 사건 순서는 첫 수동 이동 때 한 transaction으로 fractional key에 재배치하고, 이후 이동·새 사건 추가·재실행에서 같은 순서를 유지한다.
- [x] 작품 운영 진입은 현재 작품으로 query 범위를 고정하고 `투고·투고처`, `계약·발행`, `정산·입금`만 각각 노출한다. 투고 화면에 입금·정산·작업실 조수가 함께 나타나지 않는다.
- [x] 작품 운영의 새 기록 form은 현재 작품을 미리 선택하며, 투고처·투고/봉인·계약·발행·정산·입금이 각각 기존 독립 원장 명령으로 저장된다.
- [x] 오른쪽 `조수` 탭에서 현재 선택으로 별빛 Candidate를 만들고 정식 `후보 검토함`으로 이동할 수 있게, 구형 숨은 작품 탭에 남아 있던 진입점을 복원했다.
- [x] 전역 상단 음악 플레이어에서 연 재생목록 창을 숨은 작품 작업면 밖의 실제 상단 host에 portal해 홈에서도 표시·테마·닫기가 동작하도록 했다.

IA 실제 기능별 예시와 복원 증거:

- 실제 기본 사용자 원장을 `workspace-v1/codex-backups/before-full-feature-pass-20260821-192837.sqlite3`로 먼저 복사 보관했다.
- 실제 작품의 정식 화면에서 `[기능 확인]` 플롯·사건·인물·복선·별빛·별빛-복선 연결·승인 전 후보·파편·장면 분할·작품 스냅샷을 각각 1건 만들었다.
- 집필 기록 화면에서 오늘/주간 집중·글자 목표와 1·2회차 연독률 예시를 저장했다.
- 작품 운영의 각 독립 화면에서 `[기능 확인]` 투고처·투고 기록/불변 봉인·계약·발행·정산서·입금을 각각 1건 만들었다.
- 일정 화면에서 `[기능 확인] 오늘 일정`, `집필 루틴`, `투고 마감` D-DAY를 각각 1건 만들었다.
- 실제 앱을 반복 종료·재실행한 뒤 위 행과 사건 순서 `줄리안 통화사건 → 햄버거 참사 → [기능 확인] 예시 사건`을 SQLite 원장과 정식 화면에서 다시 확인했다.
- 실제 `focus-dark-theme`에서 구조·일정·음악 창 배경/글자색을 확인했고, 선곡·목록 버튼은 960 CSS px에서 `nowrap`, 25px 높이로 한 줄을 유지했다.
- `npm run lint`, `npm run typecheck`, renderer/electron production build가 통과했다.
- 관련 Vitest 6개 파일 88개와 사건 순서 runtime 재실행 검증 1개가 통과했다.
- production Electron E2E는 공통 IA 작업면/새 플롯/실제 투고 기록, 원고 분석 닫기, 선곡목록 한 줄과 홈 음악 창, 승격 작업면 전체 다크 테마, 사건 마우스 드래그와 재실행 복원 5개가 통과했다.
- 140ms 휴식 시간이 런타임 재개 전에 만료되던 Pomodoro 복원 검증은 제품 동작을 바꾸지 않고 테스트 시간 여유만 늘려 전체 병렬 실행에서도 안정화했다.

이전 현재 Gate: `정보구조 개편 IA-1~IA-4 — 작품 공통 셸·구조·검토·일정 노출` 완료

IA-1~IA-4 현재 상태:

- [x] 작품 안에서 항상 같은 위치에 `쓰기 | 구조 | 검토 | 운영` 공통 헤더를 표시하고, 작품 목록 복귀·작품명·일정 요약·달력 진입점을 한곳에 고정했다.
- [x] `구조`에 `개요 | 플롯 | 사건 | 장면 | 인물 | 복선 | 별빛` 정식 작업면을 연결했다. 기존 원장과 명령을 그대로 사용하며 모달 콘텐츠는 embedded content로 재사용한다.
- [x] `검토`에 `집필 기록 | 원고 점검 | 후보 검토함 | 버전` 정식 작업면을 연결했다. 후보 승인 전 canonical 원본 불변과 기록·구조·후보에서 원고로 돌아오는 정확 범위 선택을 유지한다.
- [x] 쓰기 오른쪽 검사기는 `현재 | 조수`만 노출한다. 작품 전체 구조·버전 관리의 구형 레일 항목은 새 정식 작업면에서만 접근하며 실제 제거는 IA-8 이후로 남긴다.
- [x] 일정은 작품 헤더에서 한 번에 열고, 작품 카드의 오늘 건수·가장 가까운 D-DAY와 홈의 작품별 오늘 일정 projection으로 노출한다. 일정과 집필 기록은 작품 `…` 메뉴에서 제거했다.
- [x] `새 플롯`은 좁은 786×538 패키징 Electron에서도 첫 플롯 생성 뒤 두 번째 플롯을 연속 생성·선택하고 재시작 뒤 복원한다.
- [x] 작품 전환 시 다른 작품의 section/tab 상태가 섞이지 않고, 버전 복원 중에는 작품 작업면 이동을 막아 durable 복원이 끝난 뒤 이동한다.

IA-1~IA-4 완료 증거:

- 승인 설계 manifest의 checksum 11/11 일치를 다시 확인하고, 데이터 schema·SQLite migration·정규 원장은 변경하지 않았다.
- `npm run lint`, `npm run typecheck`, production renderer/electron build가 통과했다.
- 현재 투명 표지 버튼 계약과 레이아웃 검증을 일치시켰고, 기본 Vitest 226개 파일·799개 검증이 통과했으며 1개가 skip됐다.
- production Electron에서 공통 헤더·두 번째 새 플롯·원고 mount/selection/undo 보존, 작품 격리, 일정 CRUD, 집필 기록 내보내기, 구조 개요 원문 이동, 플롯·사건·장면·복선·별빛·후보·버전의 재시작 회귀를 통과했다.

다음 회차 완료 Gate: 없음. 조건부 승인 지적과 DC-0~DC-8 회귀 검증을 마쳐 병합 가능한 상태다.

이전 현재 Gate: `정식 작업면 복원 Gate 13 — 별빛 서재 테마 전체 이주` 완료

POC-3 완료 증거:

- 동일 `StorageService` contract의 `node:sqlite`·`better-sqlite3` bake-off와 설치본 load
- `node:sqlite` 기반 정규 원장·composite 작품 소유 foreign key·불변 revision/snapshot/blob manifest
- content-addressed blob write·sync·no-replace publish·readback 뒤 DB reference transaction
- Anchor·ResumeCheckpoint·`Work.resumeCheckpointId`의 원자 저장
- reachability·checksum integrity report와 재검증된 selected orphan cleanup
- definition·논리적 전후 checksum·receipt·identity·`user_version`의 단일 migration transaction
- 기준 DB snapshot과 참조 blob만 포함하는 canonical backup manifest
- bundle 전체 사전검증·caller preflight·새 빈 위치 restore·count/checksum 대조
- revision·migration·backup commit/publish 전 actual process kill과 안전 재개방
- 두 actual process와 packaged Electron 두 browser main의 같은 기준 revision 쓰기 배제와 정확히 한 commit
- 개발 서버 없는 Windows Electron 설치본 main의 revision→checkpoint→backup→restore 폐회로
- raw timing·p50·p95와 DB·blob·bundle·restore 크기 JSON 측정

별도 보류 Gate: `POC-M — 현행 데이터 이주 rehearsal` 보류 상태 유지

실사용 원고 저장: `GO`

POC-3 완료: `GO`

## 정식 작업면 복원

- [x] Gate 1 — 인물 정식 작업면, 수동 CRUD, 별칭, 독립 관계, exact 원문 근거, 우측 조수의 GPT 인물 후보 검토
- [x] Gate 2 — `플롯 목록 | 상세 | 사건 뽑기` 작업면, 별도 장면 탭, 편집기 하단 전체 폭 사건 레일 연결
- [x] Gate 3 — `scene.extract` 후보·미리보기·승인 `SceneOverride` 적용
- [x] Gate 4 — 모든 작업면 상단에 남는 YouTube 음악 미니 플레이어와 집중 세션 연결
- [x] Gate 5 — GPT 인물 Candidate 기능을 로컬 `인물 뽑기`와 분리해 우측 조수 검토함으로 이동
- [x] Gate 6 — 승인 전 Scene Candidate 정보를 정규 장면 주석과 분리하고 원고 위 분할선 미리보기 연결
- [x] Gate 7 — 확정 장면 정보 기반 음악 큐 후보, 사용자 큐 선택, 선택된 큐의 집중 시작 재생 연결
- [x] Gate 8 — 플롯으로 장면 초안 생성, Candidate 편집·삽입 위치/diff, exact revision 승인 삽입
- [x] Gate 9 — 원 첨부 기준의 남은 GPT 작업면·음악 외부 상태 조건 완료 감사와 필요한 bounded Gate 확정
- [x] Gate 10 — 잘못 추가한 Spotify 경로를 제거하고 기존 YouTube Data API 키 검색·마리나라 엔진 방식 IFrame 재생·실사용 키 검증
- [x] Gate 11 — 레거시의 로컬 `인물 뽑기`·`사건 뽑기`, 편집기 하단 사건 레일, 상단 YouTube 플레이어 배치 복원
- [x] Gate 12 — 지정 HTML의 사용자 기능 전체 대조·이주. Pomodoro/WritingSession 우선, 집중·수정금지·분석·입출력 순으로 실제 Electron 검증
- [x] Gate 13 — 지정 HTML의 14개 테마 팔레트·선택기·저장/복원 코드를 현재 제품 셸 전역에 이식하고 실제 Electron 검증

Gate 12 이주 기준:

- 정확한 원본: `E:\_정리_20260506\02_백업_압축_기록\별빛서재 완성까지의 기록들\하씨_저장_문제__2___1_.html`
- source SHA-256: `C4E7E9B01226B0E1440652C1FE081199C178268E410DFEDF9351B0DCF05762BF`
- 원본 HTML·`localStorage` 구현을 복사하지 않고 현재 Work·Document·DocumentRevision·WritingSession·FocusCycle 원장과 typed bridge에 기능을 대응한다.
- 기존 대응 완료: 작품/회차 CRUD, 자동 durable 저장·불변 revision·backup, 전체 원고 편집, 글꼴·크기·본문 폭·문단 정렬, 오늘/주간 목표, 기간·일별·연속·회차별 집필 기록, TXT·기록 JSON/CSV 내보내기, Pomodoro 작업/휴식·주기·pause/resume·복원.
- [x] 항상 접근 가능한 접힌 집중 표시와 펼친 세션 피드백, 이번 집필·오늘 완료 세션·평균·최근 기록 표시
- [x] 실행 중인 Pomodoro 작업 단계의 세션 메모 수정·SQLite 저장·단계 전환과 재실행 보존
- [x] 원고를 가리지 않는 집중 모드 진입·이탈과 키보드 흐름
- [x] 목표 글자 수 기반 수정금지 집필과 기존 원고 보호·진행 표시
- [x] 문장 길이·반복 단어 히트맵과 원고 무변경 검증
- [x] 상위 어휘·문장 길이·반복 밀도 분석을 현재 원고 파생 화면에 연결하고 최근 기록은 기존 WritingSession 기록 화면으로 유지
- [x] 원고 데이터·서식 원본을 바꾸지 않는 밝은/어두운 화면 전환
- [x] 사용자 선택 UTF-8 TXT 가져오기와 현재 원고 교체 전 미리보기·명시 적용
- [x] 원본의 괄호 단계 전환·둥근 따옴표·말줄임표 입력을 번들 runtime manifest 기반 입력 규칙으로 대응

Gate 12 현재 증거:

- 승인 설계 checksum 11/11 일치, 원본 경로와 저장소 보존 사본 checksum 일치.
- Pomodoro 계약·typed bridge·SQLite runtime·세션 패널 4개 파일 150개 검증 통과.
- production Electron `runs and restores one Work Pomodoro lifecycle without music`에서 접힌 표시→펼치기→오늘 요약→실행 중 메모 저장→pause/resume→단계 전환→완전 재실행 복원 통과.
- 관련 계약·typed bridge·SQLite runtime·renderer 단위/통합 12개 파일 173개, 전체 lint·typecheck·production build, `git diff --check`가 통과.
- production Electron 집중 검증 7개를 한 worker에서 연속 실행해 Pomodoro 재실행·세션 메모, 집중 화면 Esc 왕복, 수정금지 원문 보호·끝 추가, 문장/반복 히트맵·분석 원고 불변, 번들 입력 규칙, 밝은/어두운 화면 전환, TXT 미리보기·경로 비노출·명시 적용·단일 undo/redo를 모두 통과.
- 실제 사용자 백그라운드 앱의 최종 bundle에서 접힌 패널 380×49 CSS px와 검토 버튼 비겹침, 번들 둥근 따옴표·4개 괄호 cycle profile, TXT 가져오기 진입점을 확인하고 밝은 화면·디버그 포트 없는 숨김 실행 PID `44224`로 복원.

Gate 13 이주 기준:

- 정확한 원본: `E:\_정리_20260506\02_백업_압축_기록\별빛서재 완성까지의 기록들\별빛서재_테마수정완료.html`
- source SHA-256: `B8A3071F42F8BCE60898EE0C478A088E3A652D441EE503FFF2EEF03690DB9E1D`
- 원본의 라이트·크림·세피아·소프트·뉴트럴·베이지·포커스L·다크·미드나잇·그레이·소프트D·웜다크·노르딕·포커스D 순서와 표시명, 모든 색상·그림자·backdrop 값을 데이터형 테마 계약으로 그대로 보존한다.
- 원본과 같은 상단 태양 아이콘·300px 2열 선택기를 사용하고, 선택값은 원본과 같은 `starlight_theme` 키로 저장·복원한다.
- 현재 앱의 Work·Document·원고·WritingSession·FocusCycle·저장·백업·편집기 구조는 테마 선택에 의해 변경하지 않는다.

Gate 13 현재 증거:

- 승인 설계 checksum 11/11 일치, 원본 4,107줄·156,236 bytes의 작업 전후 SHA-256 일치.
- 14개 테마 순서·표시명·swatch와 대표 light/dark/focus token, 등록 키 복원·CSS 변수 projection 단위 검증 3개 통과.
- production Electron에서 상단 선택기 14개 표시→노르딕의 `#2e3440/#3b4252/#eceff4/#88c0d0` 계산값→완전 종료·재실행 복원→라이트·다크 빠른 전환을 통과.
- 같은 production bundle에서 집중 화면 Escape 왕복과 테마 선택·재시작 2개 회귀를 함께 통과해 숨은 테마 그룹이 기존 context menu 보호 조건을 차단하지 않음을 확인.
- 최종 production Electron 1 worker 연속 실행에서 Pomodoro 재실행·집중 화면·수정금지 집필·히트맵/분석·번들 입력 규칙·14개 테마·TXT 가져오기 7개가 모두 통과.
- 실제 사용자 백그라운드 앱에서 300×412.667 CSS px 선택기, 14개 순서, 노르딕 계산값, 숨은 `[role="menu"]` 0개를 확인한 뒤 라이트 테마·디버그 포트 없는 PID `34208`로 복원.

Gate 1–12의 아래 기록은 당시 구현 이력이다. 현재 보이는 화면과 사용자 동선은 Gate 13 상태가 우선한다.

Gate 1 현재 상태:

- 왼쪽 작업면 전환에 `캐릭터`를 추가하고 목록·검색·생성·편집·삭제, 별칭, 외형, 성격·가치관, 말투, 목표, 갈등, 메모, exact 원문 근거를 정식 가운데 작업면에 연결했다. 기존 우측 검토 레일의 수동 인물 관리 진입점은 그대로 보존했다.
- `CharacterRelation`을 캐릭터 본문의 문자열 배열이 아닌 Work 소유 독립 원장으로 추가했다. 두 캐릭터의 같은 Work foreign key, 관계 revision, 자유 형식 종류·설명, 수정·soft retirement 이력을 저장하며 캐릭터 retirement transaction은 관련 활성 관계만 `character-retired` 사유로 비활성화하고 다른 캐릭터 원본은 바꾸지 않는다.
- 공식 ChatGPT OAuth credential은 main process의 기존 암호화 저장소 밖으로 노출하지 않고, runtime manifest가 고른 provider·model·endpoint로 `character.extract` 작업만 실행한다. renderer는 exact selection 좌표·DocumentRevision만 명령에 넘기고 main이 실행 시점 원문을 읽는다.
- GPT 결과는 canonical 캐릭터를 직접 쓰지 않고 provider/model/prompt version·문서 revision·exact quote 근거를 가진 Candidate로 저장한다. 사용자가 후보별 `새로 만들기`, 명시 필드 `기존 캐릭터와 합치기`, `제외`를 결정할 때만 한 transaction으로 적용하며 생성 뒤 원고가 바뀐 응답은 `stale`로 차단한다.
- schema v5→v6은 캐릭터 프로필·근거·후보·`character.extract` 권한을, v6→v7은 독립 관계 원장을 checksum·receipt·foreign-key 검증과 함께 추가한다. 실행 중인 실제 `C:\Users\limoj\AppData\Roaming\이음 스튜디오\workspace-v1\workspace.sqlite3` 원본은 닫거나 쓰지 않았고, SQLite 온라인 백업 복사본의 6→7 이주에서 기존 수량 보존·관계 12열·foreign key 위반 0건을 확인했다.
- 최신 production build의 실제 Electron E2E에서 exact 원고 선택→1회 외부 전송 승인→GPT 후보→새 캐릭터 승인·근거 저장→두 번째 캐릭터 수동 생성→독립 관계 생성→완전 재시작 뒤 후보·프로필·근거·관계 복원을 통과했다. 기존 수동 인물 생성·수정·작품 격리·재시작·삭제 E2E도 같은 build에서 통과했다.
- `npm run lint`, `npm run typecheck`, production build, 관계 계약·migration·bridge·UI 72개, 관계 runtime 재시작 1개, 이전 schema 1·2·4 연쇄 이주 3개가 통과했다. 전체 Vitest는 175개 파일 중 174개, 684개 중 682개가 통과하고 1개가 skip됐으며, 변경 전부터 기록된 `studio-app-shell-layout.test.ts`의 표지 버튼 실제 `background: transparent`와 테스트의 `#ffffff` 기대 불일치 1개만 남아 있다.

Gate 2 현재 상태:

- 왼쪽 작업면 전환에 `플롯`을 추가하고 가운데 정식 작업면에 `플롯 보드 | 사건 레일 | 장면` 탭을 연결했다. 새 원본이나 복제 projection을 만들지 않고 기존 `PlotManagerDialog`의 보드 저장 동작, `EventRail`, `SceneList`를 같은 application/runtime projection으로 재사용한다.
- 기존 플롯 관리 모달은 그대로 유지하고 같은 컴포넌트에 명시적인 embedded 표시만 추가했다. 플롯 생성·수정·삭제, fractional placement 이동·시간 지도, 사건 연결, exact 원문 출처, 장면 규칙·override 동작은 기존 typed command를 그대로 사용한다.
- 플롯 작업면 컴포넌트·기존 보드·사건·장면 UI 집중 4개 파일 14개, `npm run lint`, `npm run typecheck`, production build가 통과했다. 전체 Vitest는 176개 파일 중 175개, 686개 중 684개가 통과하고 1개가 skip됐으며 같은 기존 홈 표지 버튼 기대 불일치 1개만 남아 있다.
- 최신 production Electron에서 왼쪽 `플롯` 진입, 두 플롯 생성, 카드 순서 이동, 사건 레일·장면 탭 노출, 원고 복귀 뒤 본문 불변, 완전 재시작 뒤 이동 순서 복원을 통과했다.

Gate 3 현재 상태:

- `scene.extract`는 renderer가 원문을 payload에 넣지 않고 exact selection 좌표·DocumentRevision만 typed command로 넘긴다. main runtime이 승인된 범위를 실행 시점에 읽어 `p1`, `p2` 문단 ID와 본문만 공식 ChatGPT OAuth 작업 요청으로 전송한다.
- GPT는 순서가 있고 겹치지 않는 `fromParagraphId`·`toParagraphId` 장면 후보만 strict schema로 반환한다. runtime은 현재 revision 문단 offset으로 다시 해석하고, 확정 캐릭터 이름·별칭의 정확한 단일 일치만 Candidate의 character ID로 연결한다.
- 장면 제목·요약·장소·시간·인물·목표·갈등·결과와 인접 장면 경계를 승인 전 `assistant_scene_extraction_candidates`에 저장한다. UI는 장면 미리보기와 각 경계의 `분할 승인`·`앞 장면과 합치기`를 제공한다.
- `분할 승인` 순간에만 exact point Anchor와 기존 `SceneOverride(split)`를 Candidate 결정과 같은 SQLite transaction에 저장한다. 제외는 정규 장면 원장을 바꾸지 않는다. 생성 뒤 원고 revision이 달라진 Candidate는 `stale`로 바꾸고 SceneOverride를 추가하지 않는다.
- schema v7→v8은 `scene.extract` 권한·receipt 허용값과 scene Candidate 원장을 checksum·논리 전후 snapshot·receipt·foreign-key 검증으로 추가한다. 실행 중인 실사용 DB 원본은 쓰지 않고 온라인 백업 복사본의 6→7→8 연쇄 이주에서 기존 수량 보존, scene Candidate 18열, capability table 2개, foreign key 위반 0건을 확인했다.
- 장면 contract·OAuth gateway·migration·bridge·UI 집중 5개 파일 73개, scene 승인·stale·재시작 runtime, 이전 schema 1→8 연쇄 이주 3개, `npm run lint`, `npm run typecheck`, production build가 통과했다. 전체 Vitest는 179개 파일 중 178개, 692개 중 690개가 통과하고 1개가 skip됐으며 같은 기존 홈 표지 버튼 기대 불일치 1개만 남아 있다.
- 최신 production Electron에서 원고 선택 메뉴 `선택에서 장면 분석`→1회 외부 전송 승인→문단 3개·장면 2개 Candidate→경계 분할 승인→SceneProjection 2개→완전 재시작 뒤 Candidate·분할·장면 2개 복원을 통과했다. 같은 schema 8 build에서 플롯 탭·이동·원고 불변 회귀도 다시 통과했다.

Gate 4 현재 상태:

- 기존 YouTube Data API 연결 저장소를 음악 원본으로 사용한다. API 키는 Electron `safeStorage` 암호화 파일에만 있고 renderer·SQLite·작품 backup·로그로 보내지 않으며, main process 검색 클라이언트만 실행 시점에 읽는다.
- 유튜브 검색 결과는 `videoId`·제목·채널·썸네일·watch URL projection으로 좁혀 장면 큐 Candidate에 저장한다. Spotify Client ID·OAuth·Premium·외부 재생 기기 경로는 제거했다.
- 모든 원고·캐릭터·플롯 작업면의 하단 상태바에 현재 영상 제목·채널·이전/재생/일시정지/다음·음량·영상 표시·연결 상태와 현재 집중 시간을 표시한다. 사이드바와 우측 레일 상태에 의존하지 않는다.
- 재생은 `D:\MarinaraEngine`의 검증된 방식과 같이 YouTube IFrame API를 한 번 로드하고 선택한 `videoId`를 `loadVideoById`로 전달한다. Electron `file://` renderer의 빈 Referer로 발생한 실제 YouTube 오류 153은 YouTube 요청에만 설정 manifest의 앱 식별 Referer를 넣어 해결했다.
- 작품 음악 설정의 `autoPlayOnPomodoroStart`가 켜져 있고 현재 장면에 사용자가 명시 선택한 최신 큐가 있을 때만 Pomodoro 저장 성공 뒤 그 큐를 시작한다. 선택 큐가 없으면 음악 명령을 보내지 않는다.
- YouTube 계약·main 검색·설정·mini player·bridge·runtime 집중 9개 파일 155개, `npm run lint`, `npm run typecheck`, production build가 통과했다. 전체 Vitest는 193개 파일 중 192개, 717개 중 715개가 통과하고 1개가 skip됐으며 동일한 기존 홈 표지 버튼 기대 불일치 1개만 남아 있다.

Gate 5 현재 상태:

- 캐릭터 작업면 헤더의 단일 추출 버튼을 `캐릭터 뽑기` 메뉴로 바꾸고 `원고에서 캐릭터 추출`과 `새 캐릭터 설정 생성`을 분리했다. 기존 exact selection 추출 권한·근거·stale 경로는 그대로 보존한다.
- 새 설정 생성은 사용자가 직접 입력한 역할·성격·관계·장르 조건만 공식 ChatGPT OAuth main-process gateway에 보낸다. 원고 범위·가짜 근거·기존 캐릭터 원본을 전송하거나 생성하지 않는다.
- GPT 결과는 별도 Work 소유 `CharacterGenerationCandidate`로 저장하며 정확한 이름·별칭 충돌 후보만 표시한다. 각 항목은 사용자가 `새로 만들기`, 명시 필드 `기존 캐릭터와 합치기`, `제외`를 결정할 때만 캐릭터 원장과 Candidate revision을 한 SQLite transaction에서 갱신한다.
- schema v8→v9는 생성 조건·provider/model/prompt version·항목·결정 상태를 가진 `assistant_character_generation_candidates` 원장을 추가한다. 실제 사용자 DB를 최신 production 앱으로 정상 실행·종료해 8→9 이주했으며 작품 3개와 기존 캐릭터/추출/관계/장면 수량 보존, migration 논리 checksum 전후 동일, 신규 13열, foreign key 위반 0건을 확인했다.
- 캐릭터 생성 계약·OAuth gateway·typed bridge·UI·migration 5개 파일 73개와 runtime 생성→승인→완전 재시작 1개가 통과했다. 전체 Vitest는 185개 파일 중 184개, 700개 중 698개가 통과하고 1개가 skip됐으며, 변경 전부터 기록된 `studio-app-shell-layout.test.ts`의 표지 버튼 실제 `background: transparent`와 테스트의 `#ffffff` 기대 불일치 1개만 남아 있다.
- 최신 production Electron의 fake ChatGPT OAuth 경계에서 `캐릭터 뽑기` 메뉴→사용자 조건 4필드 전송→Candidate 상태에서 캐릭터 목록 불변→명시 승인→프로필 생성→완전 재시작 뒤 생성 Candidate·프로필 복원을 기존 캐릭터 추출·관계·장면 추출·YouTube 미니 플레이어 회귀와 함께 통과했다.

Gate 6 현재 상태:

- 장면을 별도 저장 원본으로 만들지 않고 기존 `SceneProjection.sceneKey`에만 Work 소유 `SceneAnnotation`을 연결했다. 주석은 exact Document·DocumentRevision, 원본 Scene Candidate·item, 제목·요약·시점 인물·장소·시간·인물·목표·갈등·결과와 revision을 보존한다.
- Scene Candidate의 각 장면에는 `pending | approved | excluded` 주석 결정 상태를 두고, 모든 분할·병합 경계를 먼저 결정한 뒤 현재 resolved SceneProjection 범위와 일치하는 장면만 승인한다. 사용자 승인 전에는 SceneOverride·SceneAnnotation을 만들지 않고, 원고 revision이 달라지면 기존 stale 경계와 같은 방식으로 차단한다.
- pending Candidate 경계는 원고 밖 임의 overlay가 아니라 CodeMirror block decoration으로 표시한다. `원고에서 분할선 미리보기`로 exact 회차·offset을 열며, 승인하면 decoration이 사라지고 원고가 편집되면 `docChanged`에서 즉시 제거된다. 원고 본문·selection·undo·저장 transaction은 바꾸지 않는다.
- 승인한 주석은 플롯 작업면과 기존 SceneList의 정규 장면 카드에만 표시한다. Candidate 메타데이터를 승인 전 정규 장면 정보처럼 노출하지 않으며, 범위가 맞지 않는 후보는 annotation 저장을 거부한다.
- schema v9→v10은 기존 scene Candidate item을 주석 검토 `pending`으로 무손실 변환하고 20열 `scene_annotations` 원장·4개 작품 소유 FK를 추가한다. 실제 사용자 DB를 최신 production 앱으로 정상 실행·종료해 9→10 이주했으며 작품 3개와 기존 수량 보존, migration 논리 checksum 전후 동일, foreign key 위반 0건을 확인했다.
- 장면 주석 계약·migration·CodeMirror preview·검토 UI·SceneList·bridge 집중 7개 파일 77개와 runtime 경계 승인→주석 2건 승인→완전 재시작 1개가 통과했다. 전체 Vitest는 188개 파일 중 187개, 704개 중 702개가 통과하고 1개가 skip됐으며 동일한 기존 홈 표지 버튼 기대 불일치 1개만 남아 있다.
- 최신 production Electron에서 장면 Candidate→승인 전 원고 분할선 1개 표시→경계 승인 후 분할선 제거→두 장면 정보 명시 승인→정규 장면 카드 주석 2건→완전 재시작 뒤 Candidate 완료 상태·SceneAnnotation·장면 카드 복원을 기존 캐릭터 추출·설정 생성·관계·YouTube 미니 플레이어 회귀와 함께 통과했다.

Gate 7 현재 상태:

- 음악 검색은 승인된 `SceneAnnotation`의 Work·`sceneKey`·annotation ID·revision과 현재 resolved `SceneProjection`이 모두 일치할 때만 시작한다. 장면 카드에 확정 제목·장소·시간·목표·갈등·결과로 만든 검색어를 먼저 표시하며, 사용자가 확인·수정해 누른 exact 문자열만 main-process YouTube Data API 검색 adapter로 보낸다. 검색 결과를 GPT나 다른 AI 입력으로 보내지 않는다.
- 검색 결과는 자동 재생하지 않고 Work 소유 `SceneMusicQueueCandidate`로 저장한다. runtime profile의 `searchLimit`·`tracksPerOption`으로 후보 큐를 묶고, 사용자가 정확한 Candidate revision과 option ID의 `이 큐 선택`을 실행할 때만 같은 장면의 이전 선택을 `superseded`로 바꾸고 새 큐를 한 SQLite transaction에서 `selected`로 승격한다.
- 장면 카드의 `선택 큐 재생`과 Pomodoro 시작은 `selected`이면서 현재 annotation revision과 일치하는 큐의 YouTube `videoId`만 IFrame player에 보낸다. 검색·후보 표시·큐 선택 자체는 재생 요청을 만들지 않는다. 선택 큐가 없으면 집중 시작은 음악 명령을 보내지 않는다.
- schema v10→v11은 15열 `scene_music_queue_candidates`와 Work·SceneAnnotation 소유 FK, scene/status index를 추가한다. 닫힌 실제 사용자 DB `C:\Users\limoj\AppData\Roaming\이음 스튜디오\workspace-v1\workspace.sqlite3`에 단일 migration transaction을 적용해 `user_version`·identity 11, 작품 3개·장면 주석 0개 유지, 신규 Candidate 0개, FK 위반 0개, receipt 논리 checksum 전후 동일을 확인했다.
- 큐 계약·YouTube 검색/videoId 재생 adapter·migration·장면 카드와 scene 승인→검색→2개 큐 후보→명시 선택→원고 변경 stale→완전 재시작 runtime, bridge 집중 검증이 통과했다.
- 최신 production Electron 경계에서 선택 큐 없는 집중 시작 재생 0회, 검색 뒤 재생 0회, 큐 선택 뒤 재생 0회, 명시 재생의 첫 `videoId`, 다음 곡의 두 번째 `videoId`, 일시정지, 같은 장면의 집중 시작에서 선택 큐 첫 `videoId` 재로드를 확인했다. 완전 재시작 뒤 검색 query·선택 Candidate·선택 option 복원도 기존 캐릭터 추출·생성·관계·장면 추출·주석·미니 플레이어 회귀와 함께 통과했다.

Gate 8 현재 상태:

- 원 첨부의 `장면 뽑기` 두 번째 동작인 `플롯으로 장면 초안 생성`을 복원했다. 레거시에는 실행 가능한 구현이 없고 승인 설계만 있었으므로 파일을 복사하지 않고 현재 `PlotThread`·`PlotEventLink`·Character·Lore·DocumentRevision 계약으로 새로 연결했다.
- 플롯 카드에서 현재 연결 사건은 자동으로, 캐릭터·설정은 사용자가 이번 요청에서 명시 선택한 항목만 context snapshot에 넣는다. GPT에는 ID·revision·원고 본문을 보내지 않고 승인된 표시 필드만 공식 ChatGPT OAuth main-process gateway로 전송한다. provider/model/prompt version과 exact input snapshot·대상 DocumentRevision·삽입 offset을 Work 소유 Candidate에 저장한다.
- GPT 결과는 원고를 직접 수정하지 않는다. 별도 Candidate 편집기에서 초안 원문을 수정·저장하고 대상 회차·offset과 `+` insertion diff를 확인한 뒤 `이 위치에 삽입`을 누른 경우에만 기존 CodeMirror transaction→ChangeBatch→durable revision 경로를 사용한다. runtime은 base revision의 정확한 offset에 Candidate 텍스트만 추가된 직계 자식 revision인지 다시 materialize해 확인한 뒤에만 Candidate를 `applied`로 기록한다.
- 삽입 저장 뒤 Candidate 완료 기록이 끊겨도 현재 revision이 exact insertion인지 재검증해 `inserted` 상태로 보여주고 중복 삽입 대신 완료 기록만 재개한다. 생성 뒤 플롯 revision·연결 사건·선택 캐릭터·설정·대상 원고가 달라지면 `stale`로 차단하며 `현재 원고와 비교`·`다시 생성`·후보 보관 경로를 제공한다.
- schema v11→v12는 20열 `assistant_scene_draft_candidates`와 Work·PlotThread·base/applied DocumentRevision FK를 추가한다. 닫힌 실제 사용자 DB `C:\Users\limoj\AppData\Roaming\이음 스튜디오\workspace-v1\workspace.sqlite3`에 단일 migration transaction을 적용해 `user_version`·identity 12, 작품 3개·기존 음악 큐 0개 유지, 신규 Candidate 0개, FK 위반 0개, receipt 논리 checksum 전후 동일을 확인했다.
- 계약·OAuth payload·migration·Candidate UI·bridge 집중 5개 파일 75개와 생성→편집→exact 삽입→applied→재시작 및 플롯 변경 stale runtime 1개, `npm run lint`, `npm run typecheck`, production build가 통과했다. 전체 Vitest는 193개 파일 중 192개, 716개 중 714개가 통과하고 1개가 skip됐으며 동일한 기존 홈 표지 버튼 기대 불일치 1개만 남아 있다.
- 최신 production Electron에서 첫 회차의 캐릭터 추출·설정 생성·관계·장면 구분/주석·음악 큐를 유지한 채 두 번째 회차를 사용자 생성하고, 플롯→연결 사건→명시 선택 캐릭터만 GPT 전송→Candidate 상태에서 원고 불변→초안 편집→0자 위치 diff→명시 삽입→durable 저장→완전 재시작 뒤 `원고 반영됨` Candidate와 정확한 원고 복원을 통과했다.

Gate 9 완료 감사:

- 원 첨부 마지막의 12개 완료 기준을 현재 source·runtime tests·production Electron E2E와 항목별로 다시 대조했다. 왼쪽 캐릭터/플롯 작업면, 연결/미연결 GPT 안내, 승인 전 canonical 불변, 플롯 이동 시 원고·anchor 불변, anchorless 미작성 사건, AI stale 차단, Work 전환 초기화, 승인 전 장면 경계 preview, 하단 실제 플레이어, 큐 선택 전 재생 0회, 접힌 사이드바에서도 곡·집중 시간 유지까지 현재 증거가 있다.
- `character.patch`, `plot.expand`, `plot.check`, 기본 재생 기기 선택, 유휴 임계값 같은 항목은 원문에서 capability·설정 예시 또는 후속 권장으로 제시됐지만 활성 목표의 네 사용자 기능과 마지막 완료 기준에는 정확한 명령·상태 전이가 지정되지 않았다. Change-Control 규칙에 따라 임의 동작·기본값·유휴 시간·외부 기기 전환을 추가하지 않았다.
- 원 첨부의 Spotify 전제는 사용자의 2026-08-18 정정으로 폐기했다. 음악 완료 기준은 기존 YouTube Data API 연결과 마리나라 엔진 방식의 내장 IFrame player를 사용하도록 Gate 10에서 다시 검증했다.

Gate 10 현재 상태:

- `D:\MarinaraEngine\packages\server\src\routes\youtube.routes.ts`의 main/server 검색 경계와 `packages\client\src\components\chat\YouTubePlayer.tsx`의 IFrame API 로드·`loadVideoById`·재생/일시정지·음량 방식을 읽기 전용 구현 원본으로 사용했다.
- 사용자 연결 원본 `C:\Users\limoj\AppData\Roaming\이음 스튜디오\youtube-music-connection-v1\connection.json`은 길이 189 bytes·수정 시각 `2026-08-13T14:12:39.662688Z` 그대로 유지한 채 production 검색 모듈로 실제 YouTube 결과를 받았다. 키 값은 renderer·출력·로그에 노출하지 않았다.
- 첫 실제 IFrame smoke에서 YouTube 오류 153을 재현했고, 원인은 `file://` renderer의 빈 HTTP Referer였다. 설정 manifest의 `playerReferer`를 YouTube·YouTube nocookie 요청에만 main-process `webRequest.onBeforeSendHeaders`로 넣은 뒤 실제 IFrame 준비가 `ready: true`, `errorCode: null`로 통과했다.
- production Electron 통합 E2E는 검색·큐 선택까지 재생 0회, 명시 재생 `queue-video-4`, 다음 곡 `queue-video-5`, 일시정지, 선택 큐의 집중 시작 재로드, GPT 캐릭터·장면·장면 초안 회귀와 완전 재시작 복원을 2.0분에 통과했다.

Gate 11 현재 상태:

- 읽기 전용 이주 원본 `D:\eum.editor`의 인물·플롯 화면과 하단 `Structure Rail`, 상단 `MusicMiniPlayer`를 다시 대조했다. 인물·사건 뽑기는 GPT 호출이 아니라 로컬 랜덤 도구라는 기존 동작을 복원했다.
- 인물 화면은 목록·확정 상세·오른쪽 `인물 뽑기`, 플롯 화면은 목록·확정 상세·오른쪽 `사건 뽑기` 3열이다. 분류값과 카드 풀은 `config/inspiration-draw.json` manifest에서 읽고, 작품별 사용자 키워드는 `work_inspiration_settings` 원장에 revision과 함께 저장한다.
- GPT 인물 추출·기존 Candidate 검토는 뽑기 UI에서 제거하고 편집기 우측 `조수` 탭으로 옮겼다. 로컬 뽑기는 GPT 로그인·권한·Candidate 상태의 영향을 받지 않는다.
- 사건 레일은 플롯 탭과 우측 검토 레일에서 제거하고 앱 그리드 3행, 편집기 바로 아래 전체 폭에 portal로 배치했다. 원고 순서·미배치 사건을 같은 폭 카드로 표시하고, exact source 카드만 원고 이동을 요청한다.
- YouTube 플레이어는 하단 상태줄에서 상단 bar로 옮겼다. main-process 검색은 마리나라 엔진과 같이 Shorts·밈류 제외 검색어, embeddable 영상, 중·장시간 우선 검색과 fallback을 사용하고 renderer는 IFrame API `loadVideoById`만 사용한다.
- `npm run typecheck`, production build, 영감 뽑기·Work별 키워드 재시작·YouTube 검색·인물/플롯 UI 집중 Vitest가 통과했다. production Electron E2E는 로컬 인물 뽑기와 GPT 장면 분리, 플롯 목록·사건 뽑기와 키워드 재시작 복원, 편집기 하단 사건 레일 exact 이동·재시작 복원의 세 경로를 통과했다.

## 사건·플롯·장면 구조 모델

현재 사용자 승인 기준: [사건·플롯·장면 정규 모델](docs/architecture/plot-event-scene-model.md)

- [x] 1단계 — ADR과 불변식 확정
- [x] 2단계 — `EventSource` 분리, 기존 사건 backfill, 원고 미연결 사건, source 연결·교체·해제
- [x] 3단계 — `PlotEventLink`, 양방향 생성, 수동 연결·해제, idempotency, 제목 불일치 projection
- [x] 4단계 — 작품별 기본 `PlotBoard`·`PlotLane`, `PlotPlacement`, fractional order key, 앞·뒤 이동, 재시작 보존
- [x] 5단계 — 마우스 drag의 로컬 preview, 삽입선, 취소, drop당 한 command, 충돌 rollback
- [x] 6단계 — 작품 전역 사건레일과 `원고 순서 / 플롯 순서` 모드
- [x] 7단계 — 장면 규칙·override fold·사건 범위 중첩을 반영한 최종 `SceneProjection`
- [x] 8단계 — 앞뒤 순서 이동 완료 뒤 정규화된 `storyTime 0..100` 시간 지도

2단계 현재 상태:

- `EventBlock`에서 원고 범위를 분리한 `EventSource` 계약·SQLite 원장·typed bridge·원고 미연결 사건과 source 연결·교체·해제 UI를 구현했다.
- 기존 schema v1 사건마다 primary source 하나를 backfill하고 `event_blocks.range_group_id`를 제거하는 v1→v2 migration을 같은 migration transaction·검증 receipt 경계에 연결했다.
- exact selection 사건 생성 회귀와 원고 미연결→연결→교체→재시작→해제→재시작 runtime 흐름, 실제 v1 DB backfill integration이 통과했다.
- `npm run lint`와 `npm run build`는 통과했다. 전체 Vitest는 이번 단계 관련 검증을 포함해 633개가 통과했고, 변경하지 않은 `studio-app-shell-layout.test.ts`의 현재 투명 버튼 CSS/흰색 기대값 불일치 1개가 남아 있다.
- Codex Windows sandbox 안에서는 변경하지 않은 기존 기준 E2E도 GPU process `-1073741515` 뒤 `Target crashed`로 종료됐다. 같은 production build를 sandbox 밖에서 실행해 exact-selection 사건 생성·재시작 원문 복귀와 원고 미연결→연결→교체→재시작→해제→재시작 실제 Electron E2E 2개를 함께 통과했다.

3단계 현재 상태:

- 독립 `EventBlock`·`PlotThread` 사이의 `PlotEventLink` 계약과 작품 소유 foreign key, 활성 pair 중복 금지, 플롯별 활성 primary 사건 1개 제한, revision·soft retirement를 schema v3 원장에 구현했다.
- 사건→플롯과 플롯→사건 생성은 첫 호출에서만 두 원본과 연결을 만들고 같은 명령은 기존 authoritative projection을 반환한다. exact selection 방향은 `Anchor`·`RangeGroup`·`EventSource`까지 한 transaction에서 만들며, 예정 사건 방향은 원고 범위를 만들지 않는다.
- 수동 primary/supporting 연결·해제와 재연결, 생성 시점 제목 복사 뒤 독립 수정, 제목 일치·불일치 projection을 typed bridge와 기존 사건 레일·플롯 관리 화면에 연결했다. `PlotBoard`·`PlotLane`·`PlotPlacement`·drag 동작은 추가하지 않았다.
- v2→v3 migration은 기존 사건·플롯을 바꾸지 않고 빈 연결 원장과 인덱스를 추가하며 checksum·post-verification·foreign key 검증을 통과했다.
- `npm run lint`와 `npm run build`, Gate 3 집중 계약·bridge·runtime·dialog 129개, POC-3 `PlotEventLink` schema 검증 1개가 통과했다. 전체 일반 Vitest는 161개 파일·638개가 통과하고 1개가 skip됐으며, 변경하지 않은 `studio-app-shell-layout.test.ts`의 투명 버튼 CSS/흰색 기대값 불일치 1개가 그대로 남아 있다.
- 같은 production build를 sandbox 밖의 실제 Electron에서 실행해 Gate 2 사건 회귀 2개와 사건→플롯 멱등 생성·독립 제목·수동 보조 연결/해제/재연결·예정/정확 범위 플롯→사건 생성·완전 재시작 보존 Gate 3 E2E 1개를 함께 통과했다.

4단계 현재 상태:

- 작품 생성 transaction에 runtime manifest의 표시명을 쓰는 기본 sequence `PlotBoard`·default `PlotLane`을 추가하고, v3→v4 migration 뒤 기존 작품·활성 플롯을 원본 변경 없이 같은 기본 보드에 backfill했다. 한 작품의 같은 보드에는 같은 활성 플롯 배치를 하나만 허용하되 다른 보드의 별도 배치는 막지 않는다.
- 플롯 내용 원장과 `PlotPlacement` 위치 원장을 분리하고 canonical fractional order key, 실제 이웃 ID·placement/board revision을 받는 상대 위치 이동 command, authoritative board projection을 application·SQLite·main·preload·renderer 경계에 연결했다.
- 일반 이동은 대상 placement의 정렬 key와 revision, board revision만 바꾼다. runtime manifest의 key 길이 경계에 도달한 경우에만 lane 전체를 한 transaction에서 재균형하며, 성공 경로에서 재균형과 재시작 보존을 직접 검증했다.
- 플롯 관리 화면에 기본 보드와 접근 가능한 `앞으로 이동`·`뒤로 이동`을 연결했다. Gate 5 범위인 pointer drag·preview·삽입선·auto-scroll·키보드 단축키는 앞당겨 추가하지 않았다.
- Gate 4 집중 계약·domain·bridge·runtime·dialog 132개와 신규 보드 schema/FK/index 검증 1개, `npm run lint`, `npm run build`가 통과했다. 전체 일반 Vitest는 163개 파일·643개가 통과하고 1개가 skip됐으며, 변경하지 않은 `studio-app-shell-layout.test.ts`의 투명 버튼 CSS/흰색 기대값 불일치 1개가 그대로 남아 있다. 전체 POC-3 schema suite의 신규 보드 검증을 포함한 9개는 통과했고 기존 fixture에 이미 존재하는 `work_covers`·`work_favorites`·`work_music_settings`가 누락된 기대 목록 실패 1개는 이 Gate에서 수정하지 않았다.
- 같은 production build를 sandbox 밖 실제 Electron에서 실행해 Gate 2 사건 회귀 2개, Gate 3 양방향 사건↔플롯 회귀 1개, `A→B` 배치를 `B→A`로 이동·사건 연결 해제 후 배치 유지·완전 재시작 후 순서와 정확한 원문 선택 복원 Gate 4 E2E 1개를 함께 통과했다.

5단계 현재 상태:

- 플롯 카드의 primary pointer가 6px 이상 움직인 뒤에만 drag를 시작하고, 이동 중에는 renderer의 source preview와 target lane 삽입선만 갱신한다. 카드 위쪽 절반은 앞, 아래쪽 절반은 뒤, 목록 끝은 마지막 위치로 해석하며 pointer move 중 저장 호출은 하지 않는다.
- 검토 레일의 실제 scroll container 경계에서 requestAnimationFrame 기반 auto-scroll을 수행한다. `Escape`, `pointercancel`, pointer capture 상실은 preview와 삽입선을 지우며 `MovePlotPlacementCommand`를 실행하지 않는다.
- pointer up은 Gate 4의 실제 이웃 ID·placement/board revision 상대 이동 command를 정확히 한 번 호출한다. 저장 promise가 끝날 때까지 로컬 pending 경계로 두 번째 drag를 막고, revision 충돌 시 authoritative board prop을 유지한 채 preview만 롤백한다.
- 접근 가능한 `앞으로 이동`·`뒤로 이동`과 `Alt+↑`·`Alt+↓`가 pointer drop과 같은 target 계산 함수와 같은 command를 사용한다. 플롯 내용·원고·사건·schema에는 Gate 5 변경을 추가하지 않았다.
- Gate 5 target 계산·dialog 검증 3개, `npm run lint`, `npm run build`가 통과했다. 전체 일반 Vitest는 163개 파일·644개가 통과하고 1개가 skip됐으며, 변경하지 않은 `studio-app-shell-layout.test.ts`의 투명 버튼 CSS/흰색 기대값 불일치 1개가 그대로 남아 있다.
- 같은 production build를 sandbox 밖 실제 Electron에서 실행해 Gate 4 이동 회귀와 Gate 5 실제 drag를 함께 2개 통과했다. Gate 5 E2E는 5px 이동 무저장, 6px 이후 로컬 preview·삽입선, 실제 auto-scroll, `Escape`·`pointercancel` 뒤 board revision 불변, drop 뒤 board revision 정확히 1 증가와 비대상 placement revision 불변, `Alt+↓`, 완전 재시작 순서 보존, 의도적으로 만든 stale revision 충돌의 UI rollback과 DB 무변경을 직접 확인했다.

6단계 현재 상태:

- renderer가 사건·출처·연결·보드를 따로 조합하지 않도록 작품 소유 회차 순서, `EventBlock`·`EventSource`·`PlotEventLink`·기본 `PlotBoard`를 한 번에 반환하는 읽기 전용 `structure.listEventRail` projection을 application·runtime·main·preload·renderer 경계에 연결했다. 저장 schema와 원본 원장은 변경하지 않았다.
- 원고 순서는 회차 index와 Anchor offset의 작품 전역 좌표로 계산하고, 원고 위치가 없는 예정 사건은 별도 목록으로 유지한다. 플롯 순서는 실제 `PlotPlacement.orderKey` 순서를 사용하며 각 카드에 원고 위치·플롯 위치·차이를 함께 표시한다.
- 검토 레일에 명시적인 `원고 순서`·`플롯 순서` 모드를 추가했다. 원고 모드에서는 회차명·정확 범위·Anchor integrity와 다른 회차의 정확 원문 이동을 제공하고, 플롯 모드에서는 원고 미연결 사건·보드 밖 사건, 한 transaction의 사건→플롯·연결·배치, 기존 relative placement 이동을 제공한다.
- Gate 6 projection·bridge·runtime·renderer 집중 4개 파일·133개 검증, `npm run lint`, `npm run build`가 통과했다. 전체 Vitest는 165개 파일·649개가 통과하고 1개가 skip됐으며, 변경하지 않은 `studio-app-shell-layout.test.ts`의 투명 버튼 CSS/흰색 기대값 불일치 1개가 그대로 남아 있다.
- 같은 production build를 sandbox 밖 실제 Electron에서 실행해 Gate 2~6 사건·플롯 회귀 6개를 4.2분에 통과했다. Gate 6 E2E는 두 회차의 작품 전역 원고 순서와 역방향 플롯 순서, 양쪽 정확 원문 이동, Anchor integrity, 예정 사건의 단일 plotification 결과, 기존 카드 이동 시 board·대상 placement revision만 증가하고 사건·출처·연결은 불변인 점, 완전 재시작 뒤 두 순서와 정확 근거 보존을 확인했다.

7단계 현재 상태:

- runtime manifest가 소유하는 작품별 `SceneRuleSet`의 line-regexp 규칙으로 현재 `DocumentRevision`의 기본 경계를 계산하고, `SceneOverride(add/ignore/merge/split)`를 생성 순서대로 fold해 본문 사본 없는 안정적인 최종 `SceneProjection`을 만든다. 미해결 Anchor·규칙 revision 불일치는 `needsReview`, 겹치는 경계는 `invalid`로 노출한다.
- `EventSource` 범위와 최종 장면 범위를 중첩해 자동 사건 소속을 계산하고, 자동 계산이 틀린 pair에만 `SceneEventOverride(include/exclude)` revision 원장을 저장한다. 원고 미연결 예정 사건은 미배정으로 남거나 사용자가 특정 장면에 수동 포함할 수 있다.
- schema 5에 `scene_rule_sets`·`scene_event_overrides`와 활성 pair 유일 인덱스를 추가했다. schema 4→5 migration은 기존 `EventBlock`·`SceneOverride` 논리 checksum을 전후 비교하고, config 기반 rule backfill 뒤 기존 입력과 projection을 그대로 보존한다. schema 1·2 연쇄 migration과 schema 4 실제 이주 3개가 함께 통과했다.
- 검토 레일의 저장 override 작업 목록을 최종 장면 목록으로 교체하고, 규칙 편집·장면 범위 이동·현재 위치 분할·앞 장면 병합·자동 사건 제외·미배정 사건 포함을 typed bridge의 authoritative projection 응답에 연결했다. 원고 저장·사건 변경·새 회차 생성 뒤에도 같은 작품 projection을 다시 계산한다. 작품 구조 화면도 경계 수가 아니라 최종 장면 수와 사건 소속을 표시한다.
- Gate 7 집중 계약·runtime·migration·bridge·UI 12개, 신규 SceneProjection schema/FK/index 검증 1개, `npm run lint`, `npm run build`가 통과했다. 전체 일반 Vitest는 168개 파일·661개가 통과하고 1개가 skip됐으며, 변경하지 않은 `studio-app-shell-layout.test.ts`의 투명 버튼 CSS/흰색 기대값 불일치 1개가 그대로 남아 있다. 전체 POC-3 schema suite도 기존 fixture의 `work_covers`·`work_favorites`·`work_music_settings` 누락 1개만 남겨 이 Gate에서 수정하지 않았다.
- 최신 production build를 sandbox 밖 실제 Electron에서 실행해 config `***` 파싱→사용자 규칙 `---` 전환/복원→병합/분할 fold→자동 사건 소속→예정 사건 수동 포함→자동 사건 수동 제외→완전 재시작 보존→정확 장면 범위 이동 E2E 1개를 통과했다. 새 회차 생성 뒤 작품 구조가 빈 회차 장면까지 포함하는 회귀도 같은 build에서 통과했다. 기존 대형 first-work E2E는 장면 경로 뒤 현재 제품에 없는 수동 `기록 시작` 버튼을 기다리는 오래된 기대에서 멈췄고, 이를 맞추기 위한 제품 변경은 하지 않았다.

8단계 현재 상태:

- `SetPlotPlacementStoryTimeCommand`에 정규화된 `storyTime 0..100`과 nullable `storyTimeEnd` 계약을 추가했다. 끝값은 시작값 이상 100 이하만 허용하고, pixel·screen 좌표를 비롯한 계약 밖 필드는 거부한다.
- 기존 `plot_placements.story_time`·`story_time_end`에 drop 시점의 정규화 값만 저장한다. 저장 transaction은 대상 placement revision과 board revision만 증가시키며 `order_key`·플롯 원본·원고·사건 원장을 바꾸지 않는다. 소수 좌표와 같은 좌표의 겹침을 허용하고 완전 재시작 뒤 그대로 복원한다.
- 플롯 관리 화면에 저장된 보드 mode와 독립적인 `순서 보드 / 시간 지도` 보기를 추가했다. 시간 지도는 snap 없는 자유 가로 drag, 저장 전 로컬 preview, 실제 렌더링 카드 폭을 반영한 겹침 적층, 구간 길이 보존을 제공하고 pointer up에서만 typed bridge command를 한 번 실행한다.
- Gate 8 계약·runtime·bridge·UI 표적 Vitest 9개, `npm run lint`, `npm run build`가 통과했다. 전체 Vitest는 169개 파일 중 168개 파일, 671개 테스트 중 669개가 통과하고 1개가 skip됐으며, 변경하지 않은 `studio-app-shell-layout.test.ts`의 투명 버튼 CSS/흰색 기대값 불일치 1개만 그대로 남아 있다.
- 최신 production build를 sandbox 밖 실제 Electron에서 실행해 소수 좌표 preview 무저장→세 플롯 drop→근접 겹침 적층→revision·순서 불변 확인→완전 재시작 보존→의도적 stale revision 충돌 rollback→재시작 authoritative 값 보존 Gate 8 E2E를 통과했다. 같은 build에서 Gate 4 순서 이동, Gate 5 drag·취소·키보드·충돌 rollback, Gate 6 원고/플롯 사건 순서 독립성, Gate 8 시간 지도 회귀 4개도 함께 통과했다.

구조 모델 진행 규칙:

- 사건과 플롯은 독립 원본이며 `PlotEventLink`로만 의미 관계를 맺는다.
- 사건의 원고 범위는 `EventSource` 관계이고, 사건은 원고 범위 없이 존재할 수 있다.
- 플롯 배치 이동은 원고 revision·anchor·range group·사건 개요 순서를 변경하지 않는다.
- 장면은 원고와 장면 규칙·override에서 계산한 projection이다.
- 각 단계의 계약·저장·실제 패키징 데스크톱 경로를 검증한 뒤 다음 단계로 진행한다.

## 제품 화면 연결

- [x] 노션의 화면 구조를 참고해 만든 로컬 작업실 셸을 renderer 진입점으로 연결
- [x] `오늘`의 이어 쓰기와 사이드바 `작업실`에서 실제 CodeMirror 원고 편집기 열기
- [x] 화면을 이동해도 편집기를 파괴하지 않아 종료 전 flush·문서별 undo·selection·scroll 상태 계약 유지
- [x] 기존 typed preload·durable save·recovery·IME·문서 전환·검색 경계를 변경 없이 보존
- [x] production build와 단위·통합 153개 파일 611개(1개 명시적 skip), 실제 Electron E2E 80개 통과
- [x] 빈 로컬 작업실에서 작품·첫 원고를 생성하고 불변 revision으로 저장한 뒤 같은 저장소를 재실행해 정확한 작품·원고·본문 재개방
- [x] 원고 화면에서 글꼴·글자 크기·본문 폭과 정확한 선택 범위의 굵게·기울임·밑줄을 편집하고 같은 불변 revision 흐름으로 저장·undo/redo·재실행 복원
- [x] 현재 작품의 바로 앞 회차 끝 흐름만 원고 시작 위치의 읽기 전용 파생 보기로 표시하고 원고·선택·undo·저장 상태와 분리
- [x] 첫 회차와 추가 회차 제목을 비워도 application command 경계에서 정확히 `제목없음`으로 생성하고 로컬 저장소 재개방 후 유지
- [x] 현재 작품과 회차 이름을 소유권 검증된 metadata revision으로 변경하고 원고 revision·본문·문서별 undo/redo를 보존한 채 재실행 복원
- [x] 작품 삭제는 Work의 `retired_at`만 갱신해 자식 문서·원고·revision을 보존하고 활성·비활성·마지막 작품 이동과 재실행 숨김을 검증
- [x] 회차 삭제는 Document의 `retired_at`만 갱신해 원고·불변 revision을 보존하고, 인접 회차 이동·빈 작품 재실행 복원·정확한 `제목없음` 회차 재생성을 검증
- [x] 같은 작품의 인접 회차 순서를 `documents.order_key`에서만 교환하고 원고·불변 revision·문서별 undo/redo·이전 화 흐름·재실행 순서를 보존
- [x] 작품 소유 회차 폴더를 생성·이름 변경하고 정확한 회차를 폴더 또는 작품 루트에 배치하며, 폴더 soft retirement 뒤 하위 폴더·회차·원고·revision과 재실행 위치를 보존
- [x] 현재 작품의 열린 회차 탭을 작품별 세션 view로 표시하고 열기·닫기·활성 전환을 문서별 EditorState에 연결하며 재실행 시 저장된 exact active Document 탭만 복원
- [x] 작품별 원고 점검 설정과 전체 회차·exact selection 진단/미리보기를 연결하고 stale source 확인 뒤 단일 undo 가능한 변경 적용 및 사용자 선택 경로 UTF-8 TXT 내보내기
- [x] 현재 작품의 exact selection을 명령 순간에만 파편으로 복사해 원문 Anchor와 함께 영속 저장하고 종류·제목·고정·검색·soft retirement·정확한 원문 복귀를 기존 검토 레일에 연결
- [x] exact selection을 안전한 파편으로 게시한 뒤 stale-checked 단일 transaction으로 원문에서 이동하고, 비어 있는 현재 커서에 파편을 한 번의 undo 가능한 transaction으로 삽입한 뒤 durable 성공 시에만 사용 횟수 기록
- [x] 작품 소유 복선 라인을 독립 SQLite 원본으로 생성·이름·메모 수정·soft retirement하고 회수 상태를 저장하지 않은 채 기존 검토 레일과 재실행 복원에 연결
- [x] exact selection을 runtime profile의 배치·강화·회수 복선 지점으로 Anchor와 함께 저장하고, 회수 상태를 지점에서만 파생해 재실행 뒤 정확한 원문 선택 복귀에 연결
- [x] 작품 소유 인물의 이름·역할·요약·메모를 독립 SQLite 원본과 typed bridge로 생성·조회·수정·soft retirement하고 기존 검토 레일 관리 화면에서 작품 격리·재실행 보존
- [x] 작품 소유 플롯의 제목·자유 입력 단계·요약·메모를 독립 SQLite 원본과 typed bridge로 생성·조회·수정·soft retirement하고 기존 검토 레일 관리 화면에서 작품 격리·재실행 보존
- [x] 현재 원고의 exact selection을 플롯 출처 Anchor relation으로 저장·교체하고 재실행 뒤 다른 회차에서도 정확한 원문 범위로 복귀
- [x] 현재 작품의 회차·인물·플롯·플롯 출처·사건·장면 경계를 저장 사본 없이 순수 파생해 한 화면에서 집계하고 정확한 대상과 원문으로 이동
- [x] 현재 작품의 WritingSession 원장에서 기간 합계·글자 변화·일별 흐름·연속 기록·회차별 통계를 순수 파생해 기존 메인의 집필 기록 상세에서 한 화면으로 보고 정확한 회차로 이동
- [x] 현재 작품에서 사용자가 명시한 기간의 WritingSession만 canonical JSON/CSV로 직렬화하고 main 저장 대화상자와 실제 UTF-8 파일 writer를 통해 내보내기
- [x] 선택한 불변 WorkSnapshot과 현재 작품 회차를 runtime에서 exact text로 비교해 전체·회차별 글자 차이와 같음·변경·추가·삭제 상태만 읽기 전용 화면에 표시
- [x] Work 소유 FocusCycle 원장 위에 사용자 입력 작업·휴식 시간과 주기, 수동 pause/resume, deadline 완료, 작업/휴식 전환, 자동 전환, 재실행 안전 정지를 음악 없이 연결
- [x] 메인 한 화면에 활성 작품의 월간 달력·선택 날짜 일정·일일 루틴·D-DAY를 연결하고 작품 소유 SQLite 원장으로 재실행 복원
- [x] Ctrl/Cmd+K 명령·작품·회차 검색과 키보드 전환, 원고에 자동 삽입되지 않는 작품별 빠른 메모의 exact 저장·재실행 복원
- [x] runtime profile의 `1회 기준 글자수`를 전역 typed SQLite 설정으로 저장하고 작품별 grapheme 회차 완료 수에서 D-DAY 진척을 파생·즉시 갱신·재실행 복원

최신 제품 화면 검증:

- `npm run check`: 153개 파일·611개 테스트 통과, 1개 명시적 skip, lint·typecheck·production build 통과
- `npx playwright test tests/e2e/desktop-shell.spec.ts`: 단일 사이드바·원고 서식·IME·정확 선택·종료 저장·복구·재시작·문서 전환·이전화·연속 읽기·일정·기록·복선·설정·투고를 포함한 실제 Electron E2E 80개 전체 통과
- 보이는 로컬 Electron 런타임에서 빈 작업실의 작품 생성·`제목없음` 첫 회차·한글 원고 입력·글자 수 갱신·`저장됨` 표시·정상 종료를 직접 확인하고 검증용 임시 작업실을 제거
- 현재 production build에서 exact selection 파편 복사와 이동·커서 삽입·단일 undo/redo·재시작 복원 2개 focused Electron E2E 재통과
- 현재 production build에서 복선 라인의 작품 격리·이름·메모 수정·재시작 복원·soft retirement와 exact selection 배치·강화·회수·파생 회수 상태·원문 복귀 Electron E2E 2개 통과
- 파편·복선 tranche 감사: 계약·runtime·UI 70개와 저장 스키마 8개 통과, exact selection 명령 시점 materialize·Work FK·불변 revision·파생 회수 상태 경계를 확인했으며 실제 Electron 4개 흐름을 현재 build에서 각각 통과
- 현재 production build에서 플롯 출처의 첫 exact selection 연결·다른 회차 선택으로 원자적 교체·full restart 복원·정확한 원문 회차와 범위 복귀 Electron E2E 통과
- 현재 production Electron에서 인물 이름·자유 입력 역할·요약·작가 메모의 생성·수정, 다른 작품 격리, 재시작 복원, soft retirement 후 재시작 숨김 흐름 통과
- 현재 production Electron에서 플롯 제목·자유 입력 단계·요약·작가 메모의 생성·수정, 다른 작품 격리, 재시작 복원, soft retirement 후 재시작 숨김 흐름 통과
- 현재 production Electron에서 회차 2개와 인물·플롯·정확한 플롯 출처·사건·장면 경계를 한 작품 구조 화면에 집계하고 회차·인물·플롯·교차 회차 원문으로 정확히 이동하는 흐름 통과
- 현재 production Electron에서 기록 시작·원고 저장·기록 종료 뒤 WritingSession 원장으로 세션 수와 글자 변화를 파생하고, 메인 집필 기록 상세의 일별·연속·회차별 화면에서 정확한 회차 원고로 복귀하는 흐름 통과
- 현재 production Electron에서 숫자 기본값을 만들지 않는 작품별 오늘/이번 주 시간·글자 목표를 저장하고 WritingSession 원장에서 진척을 파생한 뒤 앱 재실행 후 exact Work 설정과 진척을 복원하는 흐름 통과
- 현재 production Electron에서 두 작품의 세션을 만든 뒤 현재 작품과 사용자가 지정한 날짜의 세션 1개만 JSON/CSV로 내보내고, canonical JSON LF·CSV CRLF와 다른 작품 회차 미포함을 실제 파일 바이트로 확인
- 현재 production Electron에서 불변 WorkSnapshot의 두 회차와 현재 세 회차를 비교해 같음·변경됨·스냅샷 뒤 추가 상태와 exact 문자 합계를 확인하고, dialog 종료 뒤 현재 원고 불변을 확인
- 현재 production Electron에서 숫자 기본값 없는 작품별 Pomodoro 설정, 작업 수동 pause/resume, 작업→휴식→다음 작업, 실행 중 종료 뒤 restore pause, 최종 완료, 재실행 뒤 완료와 exact 설정 복원 흐름 통과
- 현재 production Electron에서 사용자가 고른 기존 폴더와 명시적 browser export JSON을 함께 source archive에 봉인하고 6개 browser 항목의 누락 없는 redacted receipt·보고서 비노출·원본 불변을 검증
- 현재 production Electron 메인에서 일정·루틴·D-DAY 생성·수정·완료와 재시작 복원을 검증하고 786×538에서 dashboard 가로 overflow가 없음을 확인
- 현재 production Electron에서 Ctrl+K, 방향키, Enter, NFKC 검색으로 exact Work·Document를 전환하고 작품별 빠른 메모가 재시작 뒤 그대로 복원되며 어느 원고에도 삽입되지 않음을 확인
- 현재 production Electron에서 `1회 기준 글자수`를 4자에서 2자로 바꾸자 D-DAY 추가 회차 진척이 1/2에서 2/2 목표 달성으로 즉시 재계산되고, 786×538 설정 dialog와 완전 재시작 뒤 설정·진척 복원을 확인
- 현재 production Electron에서 작품의 첫 회차만 연 뒤 스크롤 경계마다 다음 회차를 작품 순서대로 추가 로딩하고, exact Document revision·UTF-16 줄 시작 위치를 저장해 완전 재시작 뒤 같은 줄로 복원하는 흐름 통과
- 현재 production Electron에서 같은 이름의 인물·플롯·복선 중복과 역할·단계·메모 충돌을 값 복사 없이 저장하고, 각 검토 당시 revision 참조를 정확한 관리 화면으로 열어 두 원본씩 확인한 뒤 완전 재시작 후 여섯 정규 설정이 그대로 남는 흐름 통과

다음 제품 단위:

- [x] 원고 사전 점검·정리·TXT 내보내기를 전체 원고 또는 사용자가 정확히 선택한 범위에 연결
- [x] 파편 서랍의 exact selection 복사·작품별 목록·메타데이터·원문 범위 복귀를 연결
- [x] 파편 이동과 현재 커서 재삽입을 원고 불변 revision·단일 undo·사용 횟수 성공 순서에 연결
- [x] 복선 라인의 작품별 생성·이름·메모·soft retirement 원본과 typed bridge를 연결
- [x] 복선을 정확한 선택 원문·출처·배치·강화·회수 계약으로 연결
- [x] 작품 소유 인물의 이름·역할·요약·메모 원본과 관리 화면을 연결
- [x] 작품 소유 플롯의 제목·자유 입력 단계·요약·메모 원본과 관리 화면을 연결
- [x] 현재 원고의 exact selection을 플롯 출처 Anchor로 연결·교체하고 정확한 원문 복귀를 연결
- [x] 문서·인물·플롯·사건·장면 경계에서 작품 구조 보기를 파생해 한 화면에 연결
- [x] 작품 소유 별빛의 확정 내용·사용자 분류·별칭·활성 상태·정확한 원고 근거·변경 이력을 독립 원장과 기존 작품 구조 화면에 연결 (공용 별빛 이주 제외)
- [x] 별빛과 복선을 내용을 복제하지 않는 작품 소유 다대다 연결 원장으로 연결하고 한쪽 retirement가 반대쪽 원본을 변경하지 않음을 검증
- [x] 회차·정확한 근거 범위가 있는 별빛 Candidate를 승인 전 정규 원본과 분리하고 승인·거절·근거 복귀를 기존 검토 흐름에 연결
- [x] 확정 별빛의 별칭을 현재 원고에서 파생해 작은 여백 신호·툴팁·고정 검사기로만 표시하고 후보는 원고에 확정 정보처럼 노출하지 않음
- [x] WritingSession 원장에서 기간·일별·연속·회차별 집필 기록을 파생하고 exact Document 이동을 연결
- [x] 작품별 nullable 오늘/이번 주 시간·글자 목표를 typed 로컬 설정으로 저장하고 WritingSession 원장 진척과 재실행 복원을 연결
- [x] 작품의 실제 회차 순서에 조회수를 typed 로컬 설정으로 저장하고 직전 화·1화 대비 연독률을 미입력·0분모 추정 없이 파생해 재실행 복원까지 연결
- [x] 작품의 회차를 첫 화부터 스크롤로 순차 로딩하고 exact Document revision·줄 시작 읽기 위치를 typed SQLite에 저장해 재실행 복원까지 연결
- [x] 명시적 기간의 현재 작품 WritingSession을 JSON/CSV로 main 저장 대화상자와 실제 파일 경계에 연결
- [x] 불변 WorkSnapshot과 현재 Work의 회차별 exact-text 비교를 원고 원문 노출이나 복원 동작 없이 읽기 전용으로 연결
- [x] Work FocusCycle 원장에 음악 없는 Pomodoro 작업·휴식 설정과 pause/resume/deadline/restart lifecycle을 연결
- [x] 메인 월간 일정·일일 루틴·D-DAY를 작품 소유 로컬 원장과 재실행 복원에 연결
- [x] Ctrl/Cmd+K 빠른 전환과 작품별 빠른 메모를 typed SQLite 저장과 실제 앱 키보드 흐름에 연결
- [x] runtime profile 기반 `1회 기준 글자수`를 typed SQLite 설정과 작품별 회차/D-DAY 진척에 연결
- [x] 사용자 지시에 따라 기능을 개별 단위로 진행해 provider-neutral 조수 권한·정확 범위 receipt와 작품 내 정확 어휘 검색 Candidate를 typed SQLite 저장·재실행 복원에 연결 (POC-M actual-input GO를 대신하지 않음)
- [x] 사용자가 직접 선택한 provider-neutral 연결에 사용자 질의와 승인된 exact selection만 전송하고 어휘·유의어·뉘앙스·짧은 용례를 원고 수정 명령 없는 Work Candidate와 value-free connector/context receipt로 저장해 실제 Electron 재실행 복원까지 검증
- [x] 사용자가 승인한 현재 회차 원고와 현재 작품의 활성 인물·플롯·복선만 provider-neutral 연결에 전송하고 설정 생성·수정 제안과 중복·충돌·분류 메모를 정규 원본 자동 반영 없는 Work Candidate로 저장해 정확한 근거/설정 revision 복귀·재실행 복원까지 실제 Electron에서 검증
- [x] 작품 소유 인물·플롯·복선의 완전 일치 이름과 동일 이름 안의 명시적 비어 있지 않은 필드 값 차이만 읽는 로컬 설정 검토를 별도 value-free receipt·중복/충돌 기록으로 저장하고 검토 당시 entity/revision을 정확한 관리 화면으로 열어 실제 Electron 재실행 복원까지 검증 (추정·자동 수정·값 복사·외부 전송 없음)
- [x] 사용자가 직접 이름·endpoint·model을 입력하는 provider-neutral 조수 연결 설정을 Electron `safeStorage` 비밀 경계와 재실행 복원에 연결 (대표 제공자·기본 endpoint·renderer 비밀 노출 없음)
- [x] 작품별 원고 사전 점검 규칙을 현재 원고의 정확한 선택 범위에만 적용하는 표기 Candidate를 typed SQLite에 저장하고 위치 복귀·재실행 복원·원고 무변경을 실제 Electron에서 검증 (외부 전송 0자)
- [x] 작품 밖 공유 로컬 투고처 원장을 이름·모 출판사·방식·링크·이메일·장르·분량·우선순위·메모 전체 필드의 생성·수정과 typed SQLite 재실행 복원에 연결하고 실제 Electron에서 검증 (외부 조사·CSV·메일 후보는 별도 개별 단위)
- [x] 작품·공유 투고처를 연결한 투고 이력을 만들 때 현재 작품의 모든 문서 revision을 불변 SubmissionPackage로 원자적 봉인하고, 상태·회신일·결과·메모만 독립 수정해 이후 원고 수정과 완전 재실행 뒤에도 같은 봉인 hash가 유지됨을 실제 Electron에서 검증
- [x] Work·공유 거래처·선택적 동일 경계 투고를 연결하는 계약 원장을 계약명·상태·체결/시작/종료일·권리 범위·선급금·통화·수익 배분·메모의 생성·revision 수정·재실행 복원에 연결하고 실제 Electron에서 검증 (고정 상태·통화 기본값 없음)
- [x] Work 소유 발행·연재 원장을 선택적 동일 Work 계약과 독립 공유 채널에 연결하고 발행 단위 이름·자유 입력 상태/형태·공개/시작/종료일·공개/계획 단위 수·일정 메모·메모의 생성·revision 수정·재실행 복원에 연결해 실제 Electron에서 검증
- [x] Work 소유 정산서 원장을 동일 Work 발행·연재에 연결하고 정산 기간·발행일·자유 입력 검토 상태·보고 금액·통화·부호 있는 가감 항목·메모의 생성·revision 수정·재실행 복원에 연결해 실제 Electron에서 검증
- [x] Work 소유 입금 원장을 선택적 동일 Work 정산서에 연결하고 입금/확인일·부호 있는 금액·통화·자유 입력 매칭 상태·입금자·거래 참조·메모의 생성·revision 수정·재실행 복원에 연결하며, 정산 보고액에서 동일 통화 입금만 합산한 미수금과 통화 불일치를 저장 중복 없이 파생해 실제 Electron에서 검증
- [x] Studio 공유 투고 운영 근거 원장을 종류·표시명·URL·관찰 시각·권위·가져온 원시 필드의 생성 후 원본으로 typed SQLite에 저장하고, 종류·권위를 고정 기본값 없이 자유 입력해 완전 재실행 복원을 실제 Electron에서 검증
- [x] 사용자가 공유 근거를 투고처·투고·계약·발행·정산·입금 각 항목에 직접 선택해 연결·해제하고 revision 경계와 완전 재실행 복원을 실제 Electron에서 검증 (자동 연결·외부 조사 승격 없음)
- [x] 사용자가 선택한 투고처 CSV의 열을 직접 연결해 미리보기하고 승인한 준비 행만 투고처 원장에 반영하며, 각 반영 행의 원시 CSV 필드를 불변 공유 근거로 보존하고 완전 재실행 복원을 실제 Electron에서 검증 (자동 열 추정·문제 행 반영 없음)
- [x] 사용자가 선택한 투고 이력 CSV의 작품·투고처와 기록 열을 직접 연결해 미리보기하고 승인한 준비 행만 반영하며, 승인 순간의 현재 작품 전체 revision을 불변 SubmissionPackage로 봉인하고 exact raw CSV 근거와 완전 재실행 복원을 실제 Electron에서 검증 (관계·날짜 문제 행 반영 없음)
- [x] 메일 회신은 본문을 저장하지 않는 metadata-only Candidate와 불변 PublishingSource로 기록하고, 사용자가 기존 투고를 명시 연결해 제안을 수정한 뒤 승인 반영 또는 무시하며 SubmissionPackage 불변·완전 재실행 복원을 실제 Electron에서 검증
- [x] runtime manifest의 읽기 전용 메일 커넥터를 데스크톱 loopback PKCE와 Electron `safeStorage` 토큰 경계에 연결하고, 사용자가 누른 수동 동기화만 등록 투고처 이메일을 조회해 본문 비저장 Candidate로 기록하며 암호화·멱등 수집·완전 재실행 복원·연결 해제를 실제 Electron에서 검증 (자동 투고 연결·AI 분류 없음)
- [x] 사용자가 지정한 단일 로컬 시각의 메일 자동 확인 일정을 원자적 로컬 파일에 저장하고 앱 실행·계정 연결 중 due 시점에 하루 한 번만 실행하며, 수동·자동 확인의 마지막 성공/실패 상태와 일정 설정을 완전 재실행 뒤 복원하도록 실제 Electron에서 검증 (OS 백그라운드 서비스·임의 재시도·자동 투고 연결 없음)
- [x] 사용자가 직접 입력한 웹 자료의 URL·확인일·권위·제안값만 현재 투고처와 비교하고 선택한 필드만 불변 PublishingSource 생성·sourceIds 연결과 한 SQLite transaction에서 승인해 미선택 필드 보존·stale rollback·완전 재실행 복원을 실제 Electron에서 검증 (자동 검색·URL 내용 수집 없음)
- [x] 선택한 provider-neutral 조수 연결에는 사용자 요청과 작품·투고처·투고 운영 메타데이터만 전송하고, 조회는 현재 로컬 원장에서 파생하며 기록은 명시 승인 전 메모리 Candidate로 유지한 뒤 승인 순간 현재 Work revision을 불변 SubmissionPackage와 사용자 진술 근거로 원자 봉인해 완전 재실행 복원을 실제 Electron에서 검증 (원고·설정·복선·인물·비밀값 전송 없음)
- [ ] POC-M 읽기 전용 source snapshot·100% receipt coverage·원고 checksum·미매핑 raw 보존·멱등 재실행
- [x] POC-M M0 파일 source를 live JSON·독립 `.bak` snapshot과 credential 존재 metadata로 봉인하고 실제 `D:\eum.editor`에서 전후 checksum 불변을 검증
- [x] POC-M M1 각 source snapshot의 전체 key inventory와 live·backup 동일/충돌 후보를 자동 승자 없이 report에 기록
- [x] POC-M M2~M3 source→target·field/raw-only receipt와 실제 관측 원고 checksum·격리·검토 수량을 report에서 대조
- [x] POC-M M4~M5 멱등 재실행·다른 batch 격리·사용자 결정 보존·취소·POC-3 백업·빈 위치 복원
- [x] POC-M localStorage·IndexedDB 명시적 export bundle schema·전체 항목 coverage·비밀값 redaction·분기 inventory 계약과 fixture 검증
- [x] 명시적 browser export JSON 선택을 기존 폴더·새 리허설 위치 선택과 연결하고 file live/.bak·browser 분기를 단일 report와 source archive에 포함
- [ ] 실제 사용자 제공 browser export bundle을 선택해 POC-M source archive·rehearsal에 포함하고 전후 checksum을 검증
- 레거시 `통합 백업 내보내기`는 IndexedDB Work·WorkBackup, 회차별 모델 후보, 별빛 조수 대화와 일부 localStorage 원시 항목을 포함하지 않으므로 actual browser export bundle 또는 100% coverage 증거를 대신하지 않는다.

현재 셸은 노션 데이터를 가져오거나 쓰지 않는다. 로컬 첫 작품 생성·durable 저장·재실행 후 exact reopen 폐회로가 실제 Electron에서 통과했으므로 실사용 원고 저장은 `GO`다.

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

## POC-2 완료

- [x] 저장 offset을 UTF-16 code unit로 유지
- [x] 내부 저장 줄바꿈 LF와 CRLF/LF 변환 경계 명시
- [x] Unicode normalization 미적용
- [x] hash·Anchor 검증 입력 문자열과 byte encoding 명시
- [x] `ChangeBatch` schema version·작품·문서·base revision·sequence·batch identity 정의
- [x] 변경 범위 순서·중첩·결과 UTF-16 길이 불변식 검증
- [x] canonical serialization
- [x] 동일 identity duplicate·conflict 분류 계약
- [x] 작품·문서 소유권과 현재 durable revision 검증
- [x] append-only journal record framing·length·checksum
- [x] torn write·truncated/corrupted tail의 논리적 격리 정보와 정상 prefix 복구
- [x] 결정적 replay와 sequence gap 격리
- [x] durable acknowledgement와 실패 UI 상태
- [x] startup journal scan·복구 preview 계약·명시적 새 revision 적용
- [x] checkpoint·compaction crash-safe 경계
- [x] crash injection matrix와 kill harness
- [x] POC-2 성능·메모리 재측정
- [x] installed-package Electron E2E

## POC-3 완료

- [x] 두 SQLite driver의 동일 contract·Electron package load bake-off
- [x] 최소 정규 원장과 작품·문서 소유 foreign key
- [x] 불변 content-addressed blob publish·inventory·selected cleanup
- [x] blob-first 불변 DocumentRevision·manuscript pointer transaction
- [x] Anchor·ResumeCheckpoint·Work pointer transaction
- [x] read-only integrity·reachability report
- [x] checksum·receipt·rollback을 포함한 migration runner
- [x] concurrent source write 중 기준 DB snapshot·참조 blob manifest 고정
- [x] standalone SQLite DB·canonical manifest·checksum sidecar backup bundle
- [x] restore 사전검증·caller preflight·새 빈 target 원자 게시
- [x] 손상·누락·용량·권한·기존 target·hook failure injection
- [x] revision·migration·backup actual process termination과 재개방
- [x] 두 actual process writer 경합과 정확히 한 commit
- [x] installed-package Windows Electron main 저장 폐회로
- [x] raw 성능·저장 크기 JSON

## POC-2 현재 증거

- canonical text는 LF만 허용하며 Unicode normalization을 적용하지 않아 NFC와 NFD 입력이 서로 다른 bytes로 남는다.
- hash·Anchor 검증 입력 계약은 문자열의 UTF-16 code unit을 little-endian bytes로 직렬화해 원고 offset 좌표와 동일한 표현을 사용한다.
- 운영체제·파일 입력의 CRLF/CR 변환은 `ChangeBatch` 생성 전 platform adapter 경계의 책임이며 durable parser는 CR을 조용히 바꾸지 않고 거부한다.
- `ChangeBatch` parser는 schema에 없는 필드를 버리지 않고 거부하며, 안전한 정수 범위를 벗어난 sequence·offset·길이를 거부한다.
- 변경 목록은 base revision의 UTF-16 좌표에서 순서대로 겹치지 않아야 하고, 삽입·삭제를 적용한 결과 길이가 선언 길이와 정확히 일치해야 한다.
- canonical serialization은 고정 순서 tuple을 UTF-8로 인코딩해 객체 key 순서가 달라도 같은 논리적 batch가 같은 bytes를 만든다.
- 같은 `batchId`와 같은 canonical bytes는 `duplicate`, 같은 identity의 다른 bytes는 `conflict`, 다른 identity는 `distinct`로 분류한다.
- application validator는 등록 작품이 소유한 문서만 허용하고 현재 durable revision identity가 일치하지 않으면 journal 진입 전에 거부한다.
- 연속 batch의 `beforeTextLengthUtf16`은 durable base revision 길이가 아니라 replay의 현재 journal head 길이와 원자 적용 시점에 검증한다.
- checksum adapter identity·payload length·checksum length를 포함한 canonical binary frame을 만들고 header+payload checksum을 검증한다.
- 실제 임시 파일에 frame 전체를 append한 뒤 `FileHandle.sync()`가 성공한 경우에만 byte 범위를 반환한다.
- checksum 손상과 뒤따르는 frame의 모든 truncated cut에서 이전 정상 prefix만 복구하고 tail offset·reason·원시 bytes를 보존한다.
- scanner는 손상 뒤 bytes를 resync하거나 원본 journal을 truncate·교정하지 않는다.
- canonical payload를 다시 같은 bytes로 직렬화할 수 있을 때만 `ChangeBatch`로 decode한다.
- replay는 호출자가 제공한 expected sequence부터 ordered changes를 원자 적용하며 duplicate는 한 번만 적용하고 gap·stale·identity·소유권·길이 충돌에서 멈춘다.
- application save command는 concurrent 호출을 직렬화해 각 batch를 현재 durable journal head에 검증하고 append+sync port가 성공한 뒤에만 정확한 target·sequence·frame byte 범위의 `SaveReceipt`를 반환한다.
- 같은 session의 exact duplicate는 기존 receipt를 반환하고, identity·gap·stale·overflow·소유권·base revision·본문 apply 충돌은 append하지 않는다.
- append·sync 실패는 journal head와 accepted identity를 전진시키거나 성공 receipt로 바꾸지 않는다.
- runtime journal profile은 호출자 journal 경로·Node crypto checksum algorithm·문서별 초기 sequence만 소유하고 작품·base revision·본문은 document profile에서 exact join한다.
- preload는 strict `ChangeBatch → SaveReceipt` command channel 하나만 추가로 노출하며 실제 Electron에서 main append+sync 뒤 receipt와 scan frame 범위가 일치한다.
- journal profile이 없으면 save handler는 파일·fallback 없이 persistence-unavailable로 실패한다.
- batching policy는 transaction 수·delay만 소유하며 renderer persistence query에는 path·checksum 없이 policy와 document sequence만 projection한다.
- renderer는 CodeMirror transaction을 문서별 queue에 누적하고 caller transaction 수·delay 경계와 blur·문서 전환에서 composed batch를 flush한다.
- 한글 IME 조합 중에는 timer·크기·명시적 flush가 durable command를 시작하지 않으며 조합 확정 뒤에만 저장한다.
- `편집 중 / 저장 중 / 저장됨 / 실패`는 문서별 queue 상태에서만 파생하고 exact durable receipt 전에는 `저장됨`으로 표시하지 않는다.
- append·sync 실패는 실제 Electron 화면에서 `실패`로 표시하며 성공으로 바꾸지 않는다.
- 정상 종료는 preload의 early close request를 보존하고 모든 문서 queue가 exact durable receipt를 받은 뒤에만 완료하며, 저장 실패나 미확정 IME 원문이 있으면 종료를 보류한다.
- save·recovery apply·close completion IPC는 생성된 BrowserWindow의 exact webContents와 main frame sender가 아니면 mutating handler에 진입하지 않는다.
- application compaction protocol은 verified journal prefix의 모든 영향 문서를 준비·materialize하고 source/result UTF-16LE checksum이 일치한 뒤에만 새 durable base·다음 sequence·consumed byte boundary의 원자 게시를 요청한다.
- global journal의 consumed boundary는 게시 시점의 exact end여야 하며, 모든 영향 문서 revision은 한 publication에 포함된다.
- publish 전에는 journal reclamation을 시작하지 않고 publish 후 reclamation 실패는 자동 retry하지 않으며 `pending`으로 구분한다.
- 물리 revision·journal 배치와 SQLite transaction 방식은 POC-3 결정으로 남겨 두며, POC-2 checkpoint·compaction 경계는 caller exact paths를 사용하는 process-durable generation으로만 검증한다.
- caller exact paths만 사용하는 POC-only platform adapter는 새 revision content와 새 journal generation을 각각 sync한 뒤 checksum frame publication을 temp write·sync·rename으로 게시한다.
- POC restart resolver는 publication frame·identity·active journal generation·revision materialization checksum을 모두 검증하고, publication 전 중단은 기존 base+journal을 유지한다.
- publication 뒤 source journal reclamation 실패는 새 publication을 되돌리지 않고 `pending`으로 남긴다. 이 generation layout은 POC 증거용이며 제품 storage 결정이 아니다.
- ResumeCheckpoint POC transaction은 caller codec이 Work 갱신·checkpoint·전체 Anchor payload를 완전하게 round-trip한 뒤 single checksum frame을 temp write·sync·rename한다.
- checkpoint publication rename 전 failure는 in-process state와 restart baseline의 기존 Work pointer를 유지하고, rename 뒤 acknowledgement 유실은 새 Work pointer·checkpoint pair를 함께 복구한다.
- checkpoint final 손상·codec·identity·현재 durable revision 충돌은 새 상태로 fallback하지 않고 explicit invalid reason과 baseline state로 분리한다.
- application save command는 caller hook이 있을 때만 target validation 완료와 journal append 직전 stage를 await하며 hook rejection은 append·head·receipt를 전진시키지 않는다.
- append-only journal은 frame 전체 write 뒤 `FileHandle.sync()` 직전에 caller stage hook을 제공하고 hook rejection에는 durable receipt를 반환하지 않는다.
- explicit POC crash gate profile은 caller scenario·target stage·reached path만 소유하며 target 도달 marker를 exclusive write·sync한 뒤 timeout 없이 pending한다.
- crash profile이 없으면 desktop runtime은 stage callback을 구성하지 않아 기존 save 경로에 추가 await를 넣지 않는다.
- actual process kill harness는 renderer send 전, main target 검증 뒤, append 전, frame write 후 sync 전, durable ack 관찰 뒤와 compaction/checkpoint publication temp sync·rename 뒤를 각각 종료한다.
- 최신 production build 실행은 승인된 9개 scenario를 모두 통과했고, `artifacts/poc-2-crash/crash-matrix.json`이 실행별 결과를 소유한다.
- harness는 원고 원문 대신 source·recoverable·displayed checksum과 journal sequence, recovery classification, commit·porcelain status·tracked diff·untracked 경로/내용 집계·Node·Electron·platform provenance를 기록한다.
- POC-2 production-bundle 측정은 입력 전에 설치한 save-state observer로 exact `저장됨` 주기를 측정했다. 3개 독립 실행·36개 durable ack raw sample이 승인된 500ms p95 예산을 통과했다.
- 각 실행의 journal은 compaction 뒤 next generation 0 bytes, publication `published`, source journal reclaimed, 복구 checksum 일치로 판정됐다.
- 같은 report는 main RSS·renderer heap 45개와 renderer GC 전후 9개 raw sample, exact source provenance와 모든 실행별 값을 기록한다.
- installed-package POC는 caller profile의 Electron runtime·application manifest·main/preload·renderer production bundle source/target을 사용해 OS 임시 `resources/app` package를 조립하며 Chromium user-data도 같은 임시 경로에 둔다.
- package executable에서 durable `저장됨`을 관찰한 뒤 actual main PID를 종료하고, 명시적 recovery apply publication 뒤 다시 main PID를 종료한 다음 세 번째 실행에서 published immutable revision·정확한 cursor·writable next journal을 복원했다.
- 실패한 package 조립은 검증된 임시 parent를 제거하고, 실행 중 실패는 현재 active Electron tree를 강제 정리한다. 생성 artifact가 package tree·latency·checksum·exact source provenance를 직접 소유하며 최종 installer·shipping packaging 설정은 선택하지 않았다.

## POC-3 현재 증거

- `node:sqlite`와 `better-sqlite3`가 동일 runtime fixture의 PRAGMA·commit·rollback·foreign key·backup·Electron main load contract를 통과했다.
- POC-3 adapter는 별도 native addon shipping·ABI rebuild가 필요 없는 `node:sqlite`로 결정했고 runtime 변경 시 contract를 다시 연다.
- 정규 원장은 Work·Document 소유권을 composite foreign key로 강제하고 불변 revision·snapshot·blob manifest의 update·delete를 거부한다.
- RevisionStore는 content blob publish와 exact readback을 완료한 뒤에만 manifest·revision·manuscript current/durable pointer를 한 `BEGIN IMMEDIATE` transaction에 쓴다.
- DB conflict·rollback은 기존 pointer와 원장을 바꾸지 않으며 새 physical blob은 verified unreachable orphan으로 명시된다.
- Anchor·ResumeCheckpoint·Work pointer는 현재 durable revision·정확한 range·이전 Work revision/pointer를 재검증한 한 transaction에서만 바뀐다.
- integrity report는 pinned read-only DB snapshot과 caller fingerprint를 사용해 foreign key·DB·manifest·revision reference·physical blob·temporary·orphan을 분리하고 저장소를 수정하지 않는다.
- migration runner는 caller catalog definition checksum, logical pre/post checksum, receipt, identity와 `user_version`을 한 transaction에 묶는다.
- migration SQL·verification·hook 실패와 commit 전 actual process 종료 뒤 이전 version DB가 그대로 다시 열린다.
- backup은 DB snapshot을 먼저 고정하고 이후 source revision, physical orphan과 temporary blob을 제외한다.
- archive DB를 caller standalone journal mode로 정규화하고 unmanifested WAL·SHM·rollback journal이 있으면 publish를 거부한다.
- restore는 sidecar·manifest exact shape·DB integrity/FK/identity/schema·revision reachability·모든 참조 blob checksum을 target 생성 전에 검증한다.
- caller 용량·권한 preflight 뒤 새 빈 sibling staging에 blob을 먼저 쓰고 DB를 쓴 뒤 재검증하며 기존 bundle·target을 덮어쓰지 않는다.
- actual child process 종료 3종과 두 process writer 경합은 DB·source 불변, 안전 재개방, 정확히 한 commit을 확인했다.
- installed Windows Electron normal main은 local file renderer와 컴파일된 POC-3 adapter로 revision→checkpoint→backup→empty restore→integrity→materialize를 개발 서버 없이 완료했고, 서로 다른 두 browser main의 holder만 commit되며 contender는 `SQLITE_BUSY`로 명시 실패했다.
- performance artifact는 caller iteration의 raw timing·설명용 p50/p95와 DB·blob·bundle·restore byte 크기만 기록하고 시간·크기 threshold를 두지 않는다.
- 2026-07-30 최신 Gate 감사에서 승인 설계 checksum 11/11, `npm run check` 54 files·279 tests, production-bundle Electron E2E 23/23, POC-3 storage·driver contract 16 files·93 tests, actual process 행렬 3 files·4 tests, installed-package 3 files·5 tests, 성능·크기 측정 1/1이 통과했다. 생성 JSON은 비밀값·절대 경로를 포함하지 않고 Git ignore 상태다.

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
- production-bundle Electron 성능 보고서는 실행 ID·commit·dirty 여부·환경·fixture/profile checksum·표본 수·p50·p95·max·정확성 판정·artifact 참조를 기록한다.
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
- `npm run test:run` — 46개 파일·단위·통합 254개 통과
- `npm run check` — lint·typecheck·46개 파일·254개 검증·production build 통과
- `npm run test:e2e` — production-bundle Electron 21개 통과
- `npm run test:e2e` — sandbox bridge·durable typed save command·renderer blur 저장·append 실패 UI·IME 저장 보류·문서 전환 flush·기존 CodeMirror 회귀 19개 통과
- `npm run performance:poc-1` — production-bundle Electron 장편 profile의 문서 전환·작품 검색·입력 p50·p95와 소유권 정확성 통과
- `npm run test:run -- src/application/persistence/change-batch.test.ts src/application/persistence/validate-change-batch-target.test.ts` — 저장 문자열·canonical serialization·batch identity·소유권·현재 revision 계약 14개 통과
- `npm run test:run -- src/platform/journal/journal-frame.test.ts src/platform/journal/append-only-journal.integration.test.ts` — frame round-trip·checksum 손상·모든 truncated cut·실제 durable file append 4개 통과
- `npm run test:run -- src/application/persistence/change-batch.test.ts src/application/persistence/validate-change-batch-target.test.ts src/application/persistence/apply-change-batch.test.ts src/application/persistence/replay-journal.test.ts` — canonical decode·연속 replay·duplicate·gap·cross-work·길이·identity·sequence overflow 22개 통과
- `npm run test:run -- src/application/persistence/save-change-batch.test.ts` — sync 이후 receipt·직렬 sequence·duplicate·충돌·실패 원자성 10개 통과
- `npm run test:run -- src/application/contracts/studio-bridge.test.ts src/application/persistence/save-change-batch.test.ts src/platform/journal/node-crypto-journal-checksum.test.ts src/desktop/manuscript-journal-runtime-profile.test.ts src/desktop/manuscript-persistence-runtime.test.ts` — strict bridge·receipt·runtime profile·동적 checksum·desktop durable wiring 31개 통과
- `npm run test:e2e -- --grep durable` — 실제 Electron typed save command·append+sync·receipt·frame scan 1개 통과
- `artifacts/poc-1-performance/f83e0fec-a97f-4e56-9333-fac1f89f6c2c/measurement.json` — dirty source 완료 측정 JSON
- `npm run test:e2e -- --grep "Hangul IME"` — 실제 Electron 조합·확정·undo·redo 1개 통과
- `npm run test:e2e -- --grep "undoes and redoes"` — 일반 입력·등록형 입력 규칙 2개 통과
- `npm run test:e2e -- --grep "keeps keyboard and mouse selections"` — 좌표 전용 payload 적용 후 실제 선택 1개 통과
- `npm run test:e2e -- --grep "keeps keyboard and mouse selections" --repeat-each=5` — 5개 통과
- `npm run test:e2e -- --grep "applies registered pairs" --repeat-each=5` — 5개 통과
- `npm run test:e2e -- --grep durable --repeat-each=5` — Electron·test Node checksum runtime 교집합을 매회 probe해 5개 통과
- `npm run test:run -- src/application/persistence/manuscript-persistence-profile.test.ts src/application/contracts/studio-bridge.test.ts` — strict batching policy·path-free projection·bridge query 17개 통과
- `npm run test:run -- src/application/persistence/compact-journal-into-revision.test.ts` — 다중 문서 원자 게시·replay·plan·checksum·journal-end conflict·reclamation pending 6개 통과
- `npm run test:run -- src/platform/persistence/poc-journal-compaction-port.test.ts` — caller path 검증·실제 sync publication·rename 전 중단·journal 증가 conflict·reclamation pending·revision 손상 감지 6개 통과
- `npm run test:run -- src/platform/checkpoints/poc-resume-checkpoint-publication.test.ts` — Work·checkpoint·Anchor 원자 게시·rename 전 fault·rename 후 ack 유실·손상·codec failure·codec round-trip·caller path 7개 통과
- `npm run test:run -- src/application/persistence/save-change-batch.test.ts src/platform/journal/append-only-journal.integration.test.ts src/desktop/poc-2-crash-gate-profile.test.ts src/desktop/manuscript-persistence-runtime.test.ts` — validation·append·write/sync stage ordering·gate rejection·durable marker·profile 없는 기본 경로 23개 통과

## 보류

- FTS 사용 — 패키징 런타임 시험 후 결정
- 공용 별빛 canonical 소유권 — SharedLoreEntry 결정 필요
- 음악 SDK — 첫 출시 비차단 POC
- 외부 connector UI — 첫 출시 핵심 폐회로 이후

## 중단 조건

- 새 프로젝트가 현행 앱 파일을 쓰는 경우
- renderer sandbox를 유지할 수 없는 경우
- 측정과 검증 없이 dependency·driver를 확정해야 하는 경우
- 승인 설계 checksum이 달라졌는데 검토하지 않은 경우

## 검증 명령

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run test:e2e`
- `npm run test:process:poc-3`
- `npm run test:package:poc-3`
- `npm run performance:poc-3`
- `npm run environment:report -- --output <출력 경로>`
