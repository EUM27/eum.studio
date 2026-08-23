# 이음 스튜디오

장편 집필, 구조 점검, 기록·복구, 투고 이후 운영을 하나의 로컬 우선 작업실로 연결하는 새 데스크톱 제품이다.

## 현재 상태

`음악 Gate 14 — YouTube·로컬 파일 통합 미디어 플레이어` 완료

기존 YouTube 검색·장면 큐·집중 시작 재생을 유지하면서 작품별 미디어 라이브러리에 MP3·MP4를 등록하고 같은 재생목록에서 섞어 재생한다. 등록 기본값은 `원본 위치 연결`이며 `앱에 가져오기`도 선택할 수 있다. 로컬 절대 경로는 renderer에 노출하지 않고 main process의 opaque descriptor와 `eum-media://` 단일-range 스트리밍으로 재생한다. 상단 플레이어는 곡 정보·진행 위치·셔플·이전/재생/다음·반복·음량·영상·정지·목록을 한 줄에 둔 컴팩트 형태로 바꿨고, production Electron에서 YouTube→원본 MP3→관리형 MP4 혼합 큐와 완전 재실행 복원을 검증했다.

직전 `정식 작업면 복원 Gate 13 — 별빛 서재 테마 전체 이주`도 완료 상태를 유지한다.

지정된 `별빛서재_테마수정완료.html`의 테마 코드를 현재 제품 셸에 이식했다. 원본 순서와 표시명을 유지한 밝은 테마 7개·어두운 테마 7개, 각 배경·패널·본문·보조문자·강조·경계·입력·caret·버튼·그림자·focus backdrop 값, Pretendard UI 글꼴, 상단 300px 2열 테마 선택기, `starlight_theme` 선택 저장·재실행 복원을 production Electron에서 검증했다. 현재 Work·Document·원고·세션·저장 동작과 화면 구조는 바꾸지 않고 테마 표면만 대응했다.

지정된 별빛 서재 HTML의 사용자 기능을 현재 원장과 편집기 계약에 맞춰 이주했다. 접힌 전역 Pomodoro/세션 표시와 펼친 오늘 기록·실행 중 메모, 집중 화면, 목표 글자 수 기반 수정금지 집필, 문장 길이·반복 단어 히트맵, 상위 어휘·문장·반복 밀도 분석, 밝은/어두운 화면, 번들 manifest 기반 괄호 단계 전환·둥근 따옴표·말줄임표, UTF-8 TXT 미리보기·명시 교체·단일 undo/redo가 production Electron에서 검증됐다. 기존 작품·회차·자동 저장·백업·목표·기간/일별/연속/회차별 기록·서식·TXT/JSON/CSV 내보내기는 중복 원본을 만들지 않고 현행 구현을 그대로 사용한다.

인물 작업면은 `인물 목록 | 확정 상세 | 인물 뽑기`, 플롯 작업면은 `플롯 목록 | 확정 상세 | 사건 뽑기`의 3열 구조다. 두 뽑기 도구는 GPT가 아니라 런타임 manifest와 작품별 사용자 키워드를 사용하는 로컬 랜덤 도구이며, 키워드는 Work 소유 SQLite 설정으로 재실행 뒤에도 유지된다. GPT 원고 추출 Candidate는 뽑기 도구와 분리해 편집기 우측 `조수` 검토함에서만 실행·검토한다.

사건 레일은 플롯 탭이나 우측 검토 레일이 아니라 편집기 바로 아래 전체 폭에 놓인다. 원고 위치에서 파생된 동일 폭 사건 카드를 가로로 표시하고, 현재 커서 사건을 조용히 강조하며, 카드를 누르면 exact 원고 범위를 연다. 기본 레일은 구조를 편집하지 않는다. 음악은 Spotify 경로 없이 기존 YouTube Data API 검색·IFrame 재생과 로컬 MP3·MP4 재생을 같은 작품별 플레이어에 연결하며, 모든 작업면 상단에 항상 보이는 컴팩트 바와 필요할 때 여는 미디어 라이브러리로 표시한다. 상세 증거는 [현재 실행 상태](plan.md)에 기록한다.

POC-1의 장편 편집기 검증을 마치고 POC-2 저장 계약과 증거를 구현했다. 저장 offset은 UTF-16 code unit, 내부 줄바꿈은 LF, Unicode normalization은 적용하지 않으며, hash·Anchor 검증 입력 계약은 이 문자열의 UTF-16LE code unit bytes로 고정했다. 운영체제·파일 입력의 CRLF/CR 변환은 `ChangeBatch` 생성 전 platform adapter 경계의 책임이며, durable parser는 CR을 조용히 바꾸지 않고 거부한다. `ChangeBatch`는 작품·문서·base revision·순서·불투명 batch identity·schema version·정확한 변경 범위를 소유하고, 고정 필드 순서의 UTF-8 canonical bytes를 만든다. 같은 `batchId`와 같은 canonical bytes만 idempotent duplicate이며, 같은 identity의 다른 bytes는 충돌이다. application 소유권 경계는 등록 작품이 소유한 문서의 현재 durable revision identity를 확인하고, 변화하는 본문 길이는 journal replay의 현재 head에 원자 적용할 때 검증한다.

checksum 알고리즘을 고정하지 않는 adapter형 append-only journal frame, length·checksum 검증, 실제 파일 append 뒤 `FileHandle.sync()`, 정상 prefix와 손상·truncated tail 분리, canonical batch의 결정적·멱등 replay까지 구현했다. application의 직렬 save command는 현재 journal head·sequence·작품·문서·base revision을 append 전에 검증하고, append+sync port가 성공한 뒤에만 durable frame 범위를 식별하는 `SaveReceipt`를 반환한다. exact duplicate는 같은 receipt를 재사용하며 append 실패는 head를 전진시키지 않는다. runtime journal profile의 호출자 경로·현재 Node crypto algorithm·문서별 초기 sequence를 exact join한 좁은 typed bridge와 main handler를 실제 Electron에서 검증했다. storage profile과 분리된 caller batching policy는 path·algorithm 없이 policy·문서 sequence만 renderer에 strict projection한다. renderer는 transaction을 문서별 queue에 누적하고 blur·문서 전환에서 flush하며, IME 조합 중에는 durable save를 보류한다. 화면의 `편집 중 / 저장 중 / 저장됨 / 실패`는 문서별 queue 상태에서만 파생하고 `저장됨`은 exact durable receipt 이후에만 표시한다.

순수 application compaction protocol은 전역 journal prefix의 모든 영향 문서를 새 불변 revision으로 준비하고 source/result checksum을 검증한 뒤, 새 durable base·다음 sequence·consumed byte boundary를 한 번에 게시하도록 강제한다. 게시 전에는 journal reclamation을 호출하지 않고, 게시 후 reclamation 실패는 자동 retry나 성공으로 바꾸지 않고 `pending`으로 구분한다. caller exact paths만 사용하는 POC-only platform adapter는 실제 임시 파일에서 새 revision과 새 journal generation을 sync한 뒤 checksum-valid publication을 temp→sync→rename으로 게시하고, 게시 뒤에만 source journal을 reclaim한다. restart resolver는 유효한 publication과 revision checksum을 다시 검증한다.

ResumeCheckpoint POC publication도 caller exact paths·typed codec·checksum만 사용한다. 전체 Work 갱신·새 checkpoint·transaction Anchor 사본이 codec round-trip에서 완전히 같을 때만 single frame을 temp write·sync·rename하고, restart는 frame·codec·Work pointer·현재 durable revision 관계가 모두 유효할 때만 새 상태를 copy-on-write로 선택한다.

승인 crash matrix의 main 검증 직후·journal append 직전·frame write 후 sync 직전에는 explicit POC crash gate profile로만 stage hook을 주입한다. target stage에 도달하면 완성한 marker를 caller reached path에 원자 게시하고 IPC 동기화 채널을 유지한 채 harness 종료를 기다리며, profile이 없으면 callback과 추가 await를 save 경로에 넣지 않는다. actual process kill harness는 save 5단계, compaction 2단계, checkpoint 2단계에서 실제 Electron main 또는 Node worker PID를 종료하고 재실행 source·journal sequence·본문 checksum을 비교한다. 최신 실행은 9/9 통과했다. 생성 artifact는 commit과 tracked diff뿐 아니라 porcelain status·untracked 경로와 내용 checksum 집계까지 포함한 exact source fingerprint를 직접 소유하며 원고 원문은 기록하지 않는다. 이 POC adapter와 gate는 제품 storage layout이나 런타임 제어가 아니며, 물리 revision compaction 방식과 SQLite는 승인 계획대로 POC-3에서 결정한다.

desktop startup은 caller recovery apply profile이 있으면 final publication을 먼저 검증하고, baseline 또는 published immutable revision·active journal generation 하나만 확정 source로 선택한다. active journal의 checksum-valid·logically safe prefix는 자동 적용하지 않고 path·raw payload를 제외한 recovery preview로 projection한다. pending/read-only 동안 durable save command는 차단하며, renderer가 현재 후보의 exact boundary·문서 tuple을 승인한 뒤 final publication이 완료된 경우에만 새 revision·sequence·journal로 runtime을 재구성한다. invalid publication은 baseline으로 fallback하지 않고, issue suffix가 있는 이전 journal generation은 삭제하지 않는다.

renderer는 pending candidate의 영향 문서와 복구 본문을 먼저 표시하고 baseline 원고를 읽기 전용으로 유지한다. 사용자가 `복구 적용`을 명시적으로 실행해 durable publication acknowledgement를 받은 뒤에만 main의 document·persistence·recovery projection을 다시 조회한다. 같은 Electron 실행에서 새 revision으로 전환되는 경로와 앱을 완전히 닫아 다시 실행했을 때 published revision을 여는 경로를 production-bundle E2E로 검증했다. active journal read 오류도 창 생성을 중단하지 않고 path를 노출하지 않는 read-only issue로 표시한다.

startup은 확정된 원고 revision과 checkpoint publication을 결합한 뒤에만 cursor·selection Anchor를 해석한다. 정확한 offset 또는 유일한 quote·context만 방향 있는 selection으로 복원하고, 모호하거나 손상된 Anchor는 문서만 열 뿐 임의 위치로 이동하지 않는다. recovery publication 직후와 앱을 완전히 종료·재실행한 뒤의 정확한 selection을 production-bundle E2E와 installed-package 실행에서 검증했다.

정상 창 닫기는 preload가 일찍 받은 close request도 보관한 뒤 renderer의 모든 문서 queue를 flush하고, exact durable receipt를 모두 받은 경우에만 main에 종료 완료를 알린다. 저장 실패나 미확정 IME 원문이 있으면 `저장됨`으로 바꾸지 않고 창을 유지한다. save·recovery apply·close completion의 mutating IPC는 생성한 BrowserWindow의 정확한 webContents와 main frame sender만 허용한다.

POC-3은 `node:sqlite` 기반 정규 원장과 content-addressed 불변 blob 경계를 구현했다. revision 본문 blob을 먼저 publish·readback한 뒤 reference와 manuscript pointer를 한 SQLite transaction에서 commit하며, Anchor·ResumeCheckpoint·`Work.resumeCheckpointId`도 같은 작품·문서·현재 revision 검증 아래 한 transaction으로 저장한다. migration은 definition·논리적 전후 checksum과 receipt를 같은 `BEGIN IMMEDIATE` transaction에 묶고 실패나 commit 전 종료 시 이전 DB를 그대로 다시 연다.

backup은 기준 DB snapshot을 먼저 고정하고 그 snapshot이 참조하는 blob만 canonical manifest에 포함한다. standalone SQLite snapshot, DB·blob checksum, manifest checksum sidecar를 same-parent temporary directory에 완성한 뒤 기존 경로를 덮어쓰지 않고 게시한다. restore는 bundle 전체와 도달성을 대상 생성 전에 검증하고 caller 용량·권한 preflight 뒤 새 빈 sibling staging에만 복원한다. 실제 revision·migration·backup 종료와 두 process writer 경합 4개, 개발 서버 없는 Windows Electron 설치본의 revision→checkpoint→backup→빈 위치 restore 폐회로 및 서로 다른 두 browser main의 동일 저장소 쓰기 배제가 통과했다. raw 성능·크기 JSON은 설명용 측정이며 제품 제한이나 기본값이 아니다.

완료된 POC-1 편집 표면은 문서별 `EditorState`·selection·스크롤·undo 이력을 독립적으로 보관한다. 한글 IME 조합, runtime profile 기반 괄호·따옴표·가운뎃 말줄임표 `⋯`, 정확한 선택 좌표, grapheme 기반 공백 포함·제외 통계를 production-bundle Electron E2E에서 검증했다. 상시 transaction은 선택 원문을 복사하지 않으며, 문자 통계 구독 알림은 원고 snapshot 갱신 뒤 microtask로 분리해 입력 임계 경로에서 보조 React 렌더를 제거했다.

원고 중심 화면에는 Work별로 독립적인 좌우 레일, 활성 Work 안에서만 동작하는 최신 원고 검색, 항상 보이는 작품·문서·저장·집중 기록 상태가 있다. 검색은 상시 입력 경로에서 원고를 복사하지 않고 사용자가 실행한 순간에만 문서별 현재 상태를 읽는다. 2작품·작품별 500문서·1,000,000자 fixture의 production-bundle Electron 측정에서 문서 전환 p95 30.489ms, 작품 검색 p95 3.700ms, 입력 p95 15.400ms를 기록했고 120회 전환의 소유권 위반·검색 불일치·입력 불일치는 모두 0건이었다. 설치 패키지 POC도 별도 임시 package에서 완료했다. 이 저장소는 현행 `D:\eum.editor`의 연장선이나 복사본이 아니며, 승인된 제품 헌법과 POC 계획에서 새로 구축한다.

## 경계

- 제품 표시명: `이음 스튜디오`
- 프로젝트 식별 경로: `D:\eum.studio`
- 현행 앱: `D:\eum.editor` — 읽기 전용 이주 원본
- 제품 코드의 첫 목표: 장편 편집·정확한 복귀·영속화·백업 폐회로
- 외부 서비스: 없어도 핵심 집필 기능이 동작해야 함

## 기준 문서

- [설계 기준 manifest](docs/design-baseline.md)
- [Gate 0 런타임 결정과 검증](docs/gate-0-runtime.md)
- [POC-2 저장 문자열과 ChangeBatch v1](docs/poc-2-durable-change-batch.md)
- [POC-2 append-only journal framing](docs/poc-2-journal.md)
- [POC-3 SQLite driver bake-off](docs/poc-3-driver-bake-off.md)
- [POC-3 SQLite·blob·backup 결정](docs/poc-3-storage-decisions.md)
- [현재 실행 상태](plan.md)

원본 설계 문서는 `C:\Users\limoj\Documents\Codex\2026-07-15\new-chat-2`에 있다. 이 저장소는 manifest의 checksum으로 승인된 기준을 식별한다.

## 개발 명령

```powershell
npm install
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
npm run performance:poc-1
npm run crash:poc-2
npm run performance:poc-2
npm run test:package:poc-2
npm run test:process:poc-3
npm run test:package:poc-3
npm run performance:poc-3
npm run environment:report -- --output <사용자가 선택한 출력 경로>
```

`npm run start`는 production bundle을 만든 뒤 실제 CodeMirror POC 원고 편집 표면을 실행한다.

POC input profile을 적용해 실행할 때는 사용자가 선택한 JSON profile 원문을 runtime 입력으로 전달한다.

```powershell
$env:EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE = Get-Content -Raw <사용자가 선택한 profile 경로>
npm run start
```

여러 문서 전환 사용감을 확인할 때도 Work·Document·base revision·표시명·초기 본문을 담은 사용자 선택 JSON profile을 runtime 입력으로 전달한다. 작은 profile은 원문을 직접 전달할 수 있다.

```powershell
$env:EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE = Get-Content -Raw <사용자가 선택한 profile 경로>
npm run start
```

큰 장편 profile은 Windows 환경 변수 길이 제한을 피하도록 main process가 사용자 선택 파일을 직접 읽게 한다.

```powershell
$env:EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH = <사용자가 선택한 profile 경로>
npm run start
```

두 document profile 입력은 서로 대체하지 않으며 동시에 설정하면 실행을 거부한다.

durable command 폐회로를 POC runtime에서 검증할 때는 journal 경로·현재 Node.js runtime이 지원하는 checksum algorithm·document profile의 각 문서별 초기 sequence를 담은 사용자 선택 JSON profile을 별도로 전달한다.

```powershell
$env:EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE_PATH = <사용자가 선택한 journal profile 경로>
npm run start
```

작은 profile은 `EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE`에 원문을 직접 전달할 수 있다. 두 입력을 동시에 사용하면 거부하며, profile이 없을 때 save command는 파일을 만들거나 임의 경로·algorithm·sequence로 fallback하지 않는다.

renderer batching POC는 저장 profile과 분리된 사용자 선택 policy를 받는다. transaction 수와 delay는 제품 기본값이 아니라 성능 시험 입력이다.

```powershell
$env:EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE_PATH = <사용자가 선택한 batching profile 경로>
npm run start
```

작은 policy는 `EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE`에 원문을 직접 전달할 수 있다. journal과 batching 입력이 모두 있을 때 renderer query에는 policy와 문서별 sequence만 전달하며 journal 경로와 checksum algorithm은 노출하지 않는다.

actual kill harness에서만 사용하는 crash gate profile은 caller scenario ID·target stage·reached marker 경로를 모두 명시한다.

```powershell
$env:EUM_STUDIO_POC_2_CRASH_GATE_PROFILE_PATH = <harness가 생성한 crash gate profile 경로>
npm run start
```

작은 profile은 `EUM_STUDIO_POC_2_CRASH_GATE_PROFILE`에 원문을 직접 전달할 수 있다. 두 입력은 동시에 사용하지 않는다. 지원 target stage는 `save-target-validated`, `before-journal-append`, `journal-frame-written-before-sync`이며 target에 도달한 앱은 harness가 종료할 때까지 pending한다. 이 profile은 임시 POC 경로에서 actual kill 증거를 만들기 위한 것이며 사용자 실행 설정이 아니다.

전체 kill harness는 artifact path와 test timeout을 caller 입력으로 받아 실행한다. timeout은 제품 저장 제한이나 기본값이 아니다.

```powershell
$env:EUM_STUDIO_POC_2_CRASH_ARTIFACT_PATH = <사용자가 선택한 artifact 경로>
$env:EUM_STUDIO_POC_2_CRASH_TEST_TIMEOUT_MS = <사용자가 선택한 test timeout>
npm run crash:poc-2
```

POC-2 성능 측정은 fixture profile과 artifact path를 caller 입력으로 받는다. fixture의 실행 수·표본 수·batching policy는 제품 제한이나 사용자 기본값이 아니다.

```powershell
$env:EUM_STUDIO_POC_2_PERFORMANCE_PROFILE_PATH = <사용자가 선택한 측정 profile 경로>
$env:EUM_STUDIO_POC_2_PERFORMANCE_ARTIFACT_PATH = <사용자가 선택한 artifact 경로>
npm run performance:poc-2
```

최신 production-bundle 측정은 3개 독립 실행의 36개 durable ack raw sample이 승인된 p95 500ms 예산을 통과했다. 세 실행 모두 journal publication과 source reclamation, 복구 checksum 일치가 확인됐다. report에는 main RSS·renderer heap 45개와 renderer GC 전후 9개 raw sample, exact source provenance와 실행별 측정값이 들어 있다.

installed-package POC는 최종 installer 설정 대신 Electron 공식 prebuilt `resources/app` 수동 배포 구조를 caller profile에 따라 OS 임시 경로에 조립한다. package와 Chromium user-data는 검증 뒤 삭제하며 제품 packaging 설정을 확정하지 않는다.

```powershell
$env:EUM_STUDIO_POC_2_PACKAGE_PROFILE_PATH = <사용자가 선택한 package profile 경로>
$env:EUM_STUDIO_POC_2_PACKAGE_ARTIFACT_PATH = <사용자가 선택한 artifact 경로>
$env:EUM_STUDIO_POC_2_PACKAGE_TEST_TIMEOUT_MS = <사용자가 선택한 test timeout>
npm run test:package:poc-2
```

최신 installed-package 실행은 package executable에서 exact `저장됨` 주기를 관찰한 뒤 actual main 강제 종료, recovery publication 뒤 actual main 강제 종료, published immutable revision과 정확한 cursor의 세 번째 재실행을 모두 통과했다. package tree·실행 latency·checksum·exact source provenance는 생성 artifact가 직접 소유하며 최종 packaging 설정은 선택하지 않았다.

recovery apply POC profile은 compaction identity, expected source/safe boundary, content checksum algorithm, 새 revision identity·metadata, source/next journal·publication·revision content exact paths를 모두 caller가 제공한다.

```powershell
$env:EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE_PATH = <harness가 생성한 recovery apply profile 경로>
npm run start
```

작은 profile은 `EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE`에 원문을 직접 전달할 수 있다. 두 입력은 동시에 사용하지 않는다. 이 profile에도 identity·path·algorithm·boundary default가 없으며 실제 사용자 저장 layout 설정이 아니다.

POC-3 process 행렬은 제품 timeout이 아닌 caller future deadline을 받는다.

```powershell
$env:EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS = <caller가 선택한 미래 epoch millisecond>
npm run test:process:poc-3
```

설치본과 성능 검증도 caller profile·artifact path·test timeout 없이는 실행하지 않는다. 체크인된 fixture 수치는 측정 입력이며 제품 제한이나 사용자 기본값이 아니다.

```powershell
$env:EUM_STUDIO_POC_3_INSTALLED_PACKAGE_PROFILE_PATH = <caller가 선택한 package profile 경로>
$env:EUM_STUDIO_POC_3_INSTALLED_PACKAGE_ARTIFACT_PATH = <caller가 선택한 artifact 경로>
$env:EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS = <caller가 선택한 test timeout>
npm run test:package:poc-3

$env:EUM_STUDIO_POC_3_PERFORMANCE_PROFILE_PATH = <caller가 선택한 측정 profile 경로>
$env:EUM_STUDIO_POC_3_PERFORMANCE_ARTIFACT_PATH = <caller가 선택한 artifact 경로>
$env:EUM_STUDIO_POC_3_PERFORMANCE_TEST_TIMEOUT_MS = <caller가 선택한 test timeout>
npm run performance:poc-3
```

## 아직 하지 않는 것

- 현행 앱 코드 복사
- UI 전체 구현
- 제공자·모델·분류·경로의 고정
- OAuth client 설정 내장
- 레거시 원본 콘텐츠를 새 원장에 실제 import하기

`POC-3 — SQLite·불변 blob·백업`의 전체 통과 조건은 완료됐다. `POC-M — 현행 데이터 이주 rehearsal`은 읽기 전용 source snapshot·100% receipt coverage·원고 checksum·미매핑 raw 보존·멱등 재실행을 증명하기 전에는 실제 사용자 데이터 위치에 import를 확정하지 않는다. 2026-08-17의 명시적 정식 작업면 복원 요청으로 캐릭터·플롯·장면·음악 Gate는 이주와 분리해 진행했으며, 이는 레거시 실제 import 승인을 뜻하지 않는다.
