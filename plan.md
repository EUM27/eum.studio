# 이음 스튜디오 실행 상태

기준 계획: [신규 기반 POC 실행 계획](C:/Users/limoj/Documents/Codex/2026-07-15/new-chat-2/eum-implementation-foundation-2026-07-20/08-foundation-poc-execution-plan.md)

현재 저장 계약: [POC-2 저장 문자열과 ChangeBatch v1](docs/poc-2-durable-change-batch.md)

현재 journal 계약: [POC-2 append-only journal framing](docs/poc-2-journal.md)

현재 storage 결정: [POC-3 SQLite·blob·backup 결정](docs/poc-3-storage-decisions.md)

마지막 갱신: 2026-09-02

## 현재 Gate

`출판사별 투고 정보 입력 양식 — 기본 템플릿·출판사별 사본·작품별 작성값 구현·검증 완료`

### 2026-09-02 출판사별 투고 정보 입력 양식

- [x] 첨부된 바로나글 양식은 한 출판사의 사례로만 해석하고 범용 양식으로 고정하지 않았다. 기본 템플릿의 시작 필드는 사용자가 직접 예로 든 작가 정보 `필명`·`이메일`·`출간 이력`과 작품 정보 `작품명`·`로그라인`뿐이며 section·field ID는 런타임에서 생성한다.
- [x] 하나의 편집 가능한 기본 템플릿과 출판사별 독립 사본을 추가했다. 기본 템플릿을 출판사 양식으로 복제한 뒤 섹션·필드를 추가·삭제·위아래 이동하고, 필드 종류·필수 여부·도움말·placeholder·선택지를 출판사마다 따로 관리한다.
- [x] schema 25에 `publishing_form_templates`와 `publishing_form_responses` 원장을 추가했다. 활성 기본 템플릿 하나, 출판사별 템플릿 하나, 작품×출판사별 작성값 하나를 제약으로 보장하고 template revision·소유 Work·raw JSON·시각을 보존한다. 24→25 migration definition checksum은 `79cb1d4c1c5a9a7de65088bd66474b7f6e46396df224074b8532447b46442346`이다.
- [x] application parser, SQLite ledger, desktop runtime·IPC, typed preload bridge, renderer controller를 실제 production 경로로 연결했다. 출판사 편집 대화상자의 `투고 양식` 탭에서 템플릿을 관리하고, 작품을 선택해 동적 입력값을 저장·복원하며 템플릿이 바뀐 기존 작성값에는 revision 차이를 표시한다.
- [x] focused 계약·migration·bridge·controller·UI 7개 파일 30개, runtime 영속성·재시작 1개, 전체 Vitest 328개 파일·1,185개 통과·기존 1개 skip, lint, 네 TypeScript project와 Electron/preload/renderer production build, architecture check/report가 모두 통과했다.
- [x] 별도 임시 user-data·workspace를 쓰는 production Electron E2E에서 작품·출판사 생성, 기본 템플릿 편집, select/필수 필드 설정, 출판사 사본 생성·독립 수정, 작품별 답변 저장, bridge readback, 앱 종료·재실행 뒤 복원을 한 흐름으로 확인했다. Windows/D: 검증 환경의 기존 GPU sandbox `-1073741515` 제약은 다른 production E2E와 같은 test-only sandbox 해제로 분리했으며 제품 기본 sandbox 정책은 유지했다. 결과는 1개 통과, 46.9초다.
- 검증 참고: POC-3 전용 ledger fixture audit에서 이번 두 테이블 정의는 fixture와 일치했다. 해당 전용 명령 전체에는 이번 기능 이전부터 fixture에 누락된 장면 분석 테이블 3개가 있어 10개 통과·1개 실패하며, 범위를 넓혀 기존 fixture를 임의 수정하지 않았다.
- 범위 경계: HWP 생성·본문 분할·글꼴·크기·줄간격·여백은 이번 Gate에 포함하지 않았다.

이전 현재 Gate: `회차 연속 이동 안정화 — source·standalone 후보 검증 완료, 기본 설치 대기`

### 2026-09-01 회차 연속 이동 안정화

- [x] 실행 중 기본 설치본과 실사용 원장을 읽기 전용으로 확인했다. DB `quick_check`는 `ok`였고, 회차를 연속 이동한 구간에는 같은 1초 안에 2~4개 ResumeCheckpoint가 여러 회차에 겹쳐 기록됐다. 자동 장면 분석 설정·실행 행은 0건이어서 원인에서 제외했다.
- [x] 일반 회차 선택을 한 번에 한 작업만 실행하는 latest-pending lane으로 직렬화했다. 실행 중 추가 선택은 중간 요청을 누적하지 않고 마지막 대기 작업 하나로 합친다.
- [x] 같은 작품의 명시적 회차 전환은 이미 검증·적재된 `documentProfile`과 durable target을 재사용한다. main runtime은 전환마다 모든 활성 원고 blob을 다시 materialize/checksum 검증하지 않으며 작품 전환과 ResumeCheckpoint 기반 열기 경로는 기존 reload 계약을 유지한다.
- [x] renderer는 실제 durable queue의 최신 DocumentRevision과 selection이 같은 ResumeCheckpoint를 즉시 재사용한다. 성공 projection을 ref에 바로 보존해 React 재렌더 전 같은 체크포인트를 다시 쓰지 않는다.
- [x] focused 단위·통합은 activation lane, ResumeCheckpoint cache, persistence/session, 전체 local workspace runtime 5개 파일·127개가 통과했다. main runtime은 120회 전환에서 적재된 documents 배열 identity와 최종 회차를 보존했다.
- [x] fresh `npm run check`가 lint, 네 TypeScript project, Vitest 324개 파일·1,174개 통과·기존 1개 skip, Electron/preload/renderer production build를 통과했다.
- [x] production Electron에서 기존 저장-before-switch, 문서별 state/scroll, 회차 트리 재시작, 한글 IME 전환 보류·복귀 취소 5개 흐름이 통과했다. 신규 장시간 회귀는 48회 연속 회차 전환 동안 체크포인트 증가가 전환 수를 넘지 않고, 뒤이어 두 회차에 각각 입력·durable 저장·왕복 복원되는지 2분에 통과했다.
- [x] standalone 후보 `out/eum-studio-win-x64-episode-switch-stability-candidate`를 778 files·376,411,886 bytes로 생성했다. `file://`, packaged main, typed bridge, renderer 강제 종료 복구와 두 번째 인스턴스 exit 0이 통과했다. desktop main SHA-256은 `c0ce6ea10e1417c309280ec889025949172b0a44a600f9796c42721b96875e3e`다.
- [ ] 기본 `out/eum-studio-win-x64` 설치본은 사용자 작업을 보호하기 위해 실행 중 교체·종료하지 않았다. 정상 종료가 확인되면 현재 package를 복구 가능하게 보존하고 후보를 기본 경로에 원자 승격한 뒤 실제 사용자 창에서 회차 연속 이동을 확인한다.

이전 현재 Gate: `별빛 명칭 정리·외부 제품 흔적 제거·기본 standalone 설치 완료`

### 2026-08-31 별빛 명칭과 외부 흔적 정리

- [x] 저장소의 기존 명칭 217건을 이음 스튜디오의 `별빛`으로 교체했다. 화면·오류·메뉴·장면 연결·Markdown 내보내기 이름과 관련 테스트가 같은 용어를 사용하며 내부 bridge·DB schema·migration ID는 변경하지 않았다.
- [x] 요청되지 않았던 외부 출처 검사 스크립트·npm 명령·기록 문서와 canon 관련 계획·상태·검증 참조를 제거했다. 별도의 denylist나 대체 통제는 추가하지 않았다.
- [x] 현재 소스 1,148개 텍스트 파일, Electron bundle 682개, renderer bundle 3개, 기본 설치본과 후보 설치본 각 706개에서 사용자 지정 외부 명칭·변형·분할 표기·파일명과 이전 명칭이 0건이다.
- [x] fresh `npm run check`는 lint·네 TypeScript project·전체 Vitest 322개 파일·1,172개 통과·기존 1개 skip·실패 0과 production build를 통과했다. 관련 production Electron 9개 파일은 별빛 변경 검토·Markdown 내보내기·연속성·인물 지식·문맥·이야기 흐름·장면 연결·기준점 비교·재시작을 모두 통과했다.
- [x] 새 기본 standalone은 778 files·376,408,229 bytes이며 `file://`, typed bridge, renderer 강제 종료 복구와 두 번째 실행 exit 0을 통과했다.
- [x] 사용자 명시 승인 후 예전 standalone 백업 2개와 renderer 백업 1개, 합계 약 0.704 GiB를 영구 삭제했다. 현재 기본 설치본과 검증 후보만 보존했다.

### 2026-08-31 연속성 레이더 A·B

- [x] A — 기존 `ContinuityThread`, PlotThread·ForeshadowLine·Character.goal projection과 Anchor integrity만 읽는 결정론적 레이더를 연속성 작업면의 첫 층으로 추가했다. 열린 항목·확인 필요·원문 연결·해결됨·연결 원본·AI 검토 대기를 집계하고, 근거 없음·재확인·끊김·연결을 구분하며 유효한 Anchor만 `원문 열기`에 연결한다. 별도 원장을 만들거나 원고·별빛을 수정하지 않는다.
- [x] B — 기존 exact-selection `continuity.review` 경로를 `B · 선택형 AI / AI 정밀 분석`으로 명확히 분리했다. 원고 선택→우클릭 `연속성 점검`→1회 권한→Candidate→사용자 승인 계약, 중복 확인과 승인 전 원본 불변은 그대로 유지한다.
- fresh source 증거: 변경 파일 ESLint, 네 TypeScript project, 연속성 application/runtime/bridge/renderer 24개 파일 74개, 전체 Vitest 322개 파일·1,172개 통과·기존 1개 skip·실패 0, production Electron/preload/renderer build, architecture check/report이 통과했다.
- fresh Electron 증거: 별도 임시 작업실의 1280×800에서 수동 exact evidence, 통합 플롯·복선·인물 목표, A 레이더·회차 연결·원문 이동, B Candidate 승인, 완전 재시작 보존 1개 흐름이 통과했다. 실제 후보 화면 캡처는 `C:\Users\limoj\Documents\Codex\2026-08-30\new-chat\outputs\eum-studio-continuity-radar.png`다.
- standalone 후보는 `out/eum-studio-win-x64-continuity-radar-candidate`의 778 files·376,408,229 bytes이며 기본 설치본과 executable·desktop main·preload SHA-256이 일치한다. 후보와 기본 설치본 모두 `file://`, typed bridge, 빈 작업실 bootstrap, renderer 강제 종료 복구, 두 번째 실행 exit 0을 통과했다.
- [x] 실행 중 앱을 강제 종료하지 않고 기본 `out/eum-studio-win-x64`의 renderer만 후보와 byte-identical하게 설치했다. 이전 renderer와 manifest는 `out/renderer-backups/continuity-radar-before-20260831T0015`에 보존했다. 기본 package manifest의 renderer index SHA-256은 `c3f8e572f78928fae1f8e48353b82f7662c64fc4295a64bd2c7c42eb00e43408`이다.
- [ ] 설치 전부터 살아 있던 실제 main PID 25136의 renderer는 메모리에 이전 bundle을 들고 있을 수 있다. 사용자 작업을 보호하기 위해 강제 종료·reload하지 않았다. 정상 종료 뒤 기본 실행 파일을 다시 열어 실제 사용자 창에서 `연속성 레이더`와 `AI 정밀 분석`을 확인해야 한다.

### 2026-08-30 자동 분석 단계 복구·standalone 창 생명주기

- [x] schema 24 `scene_analysis_runs` 원장을 추가했다. stable Scene source fingerprint마다 불변 NarrativeDigest와 별빛 검토 단계를 연결하고 `pending / candidate / no-change / login-required / permission-required / context-rejected / failed`, Candidate ID, 시도 횟수와 오류를 revision으로 보존한다.
- [x] 자동 경로를 renderer의 수동 Canon 검토 controller에서 분리해 main/application runtime의 `runAutomaticSceneAnalysis` command로 수렴했다. 기능 OFF면 두 connector를 모두 호출하지 않고, 요약 완료 뒤 별빛 실패 시 다음 실행은 기존 요약을 재사용해 별빛만 재시도하며, Candidate 또는 무변경 완료 뒤에는 두 connector를 다시 호출하지 않는다.
- [x] 편집기 아래에 자동 분석 상태와 실패 후 `다시 시도`를 표시하고, 이야기 흐름 장면 카드에 장면 전환·분할·회차 전환과 별빛 후보/무변경/대기/실패 상태를 연결했다. 별빛은 계속 Candidate 승인 전 변경되지 않는다.
- [x] desktop startup promise의 예외를 native 오류와 clean quit로 회수하고, packaged app single-instance activation과 renderer `render-process-gone` reload를 추가했다. `ready-to-show`를 놓친 경우에도 renderer load 완료 뒤 창을 표시한다. 정상 close handshake와 미확정 원고 저장 계약은 변경하지 않았다.
- [x] App의 회차 이동·startup recovery가 하나의 `loadRuntimeProjection` callback을 공유하도록 수렴해 `RuntimeBootstrapController.test.ts`의 오래된 lexical 호출 수 실패를 기대값 완화 없이 해소했다.
- fresh source 증거: lint·네 TypeScript project·production build·architecture check/report 통과. 전체 Vitest 321개 파일·1,171개 통과·기존 1개 skip이며 제외 파일과 실패가 없다. schema 24 계약·migration·OFF gate·별빛 실패→별빛-only 재시도→완료 dedupe·재실행 원장 검증이 포함된다.
- fresh production Electron 증거: 자동 장면 분석, 기존 이야기 흐름, 수동 Scene Canon, renderer process kill 복구 4개와 pending 원고 graceful close 1개가 통과했다. 자동 분석은 장면 요약 2개·단계 원장 2개·별빛 Candidate 1개, schema 24·FK 위반 0을 확인했다.
- 실제 사용자 DB의 읽기 전용 사본 migration은 schema 23→24 receipt, 작품 4개·회차 53개 보존, FK 위반 0으로 통과했고 임시 사본을 제거했다. 설치 직전 SQLite backup API로 `workspace-v1/codex-backups/workspace-before-schema24-20260830T182655.sqlite3` 106,889,216 bytes·SHA-256 `946E0A835C26559164C379AEE21A33E4BF7D7F3E0421D481C78E6C7A5FF4F7D9` 복구 사본을 만들었다.
- 새 standalone은 778 files·376,397,660 bytes로 생성했다. executable SHA-256은 `12b61e817329db7db8e74d99a42e552e1a1f68db7ba3d4c2d4fb6441a3b07d26`, packaged bootstrap SHA-256은 `ea82d83faaf39145efa8b68c5ff26c6d210e32728dff298baa5269ae8a0cf1e8`; `file://`, packaged main, typed preload, 빈 작업실 bootstrap, renderer kill 뒤 새 PID 복구, 두 번째 실행 exit 0, 종료 뒤 해당 패키지 process 0건을 확인했다.
- [x] 사용자 명시 승인 후 창·renderer 없이 남은 구버전 main PID 15212를 종료해 자식 포함 process 0을 확인하고, 최종 후보를 `out/eum-studio-win-x64`로 원자 교체했다. 직전 package는 `out/eum-studio-win-x64-previous-20260830T1840`에 보존했다. 실제 `C:\Users\limoj\OneDrive\바탕 화면\이음 스튜디오.lnk`는 새 기본 실행 파일과 working directory를 가리킨다. process 0에서 바로가기를 한 번만 실행해 PID 23380의 `이음 스튜디오` 창 표시를 확인했다. 일반 권한 조회에서 같은 권한 상승 GUI의 window handle이 0으로 가려지는 진단 차이를 분리했고, 동일 GUI 권한의 30초 관찰에서는 계속 표시됐다. 정상 닫기 요청은 1초 안에 package process 0건으로 끝났다. 실제 사용자 DB는 schema/user_version 24, 23→24 receipt, 작품 4개·회차 53개·WritingSession 824개, FK 위반 0, quick check `ok`다.

### 2026-08-30 조건부 자동 장면 분석·별빛 연결

- [x] 작품별 자동 분석 스위치를 schema 23의 독립 설정 원장에 추가했다. 기본값은 OFF이며 사용자가 ON으로 저장할 때 `narrative.digest`와 `canon.review`의 Work 지속·Scene 범위 로컬 읽기/외부 전송 권한을 연결한다. OFF이거나 GPT OAuth가 끊겼으면 원고 저장·장면 이동·분할은 그대로 진행하고 모델 호출과 Candidate 저장은 하지 않는다.
- [x] 불변 `NarrativeDigest`에 stable Scene scope와 exact source 원장을 추가했다. `sceneId`, Document·DocumentRevision, UTF-16 from/to, 본문 hash, 사용 별빛 revision과 trigger를 보존하고, trigger를 제외한 source fingerprint가 같으면 `unchanged`로 재사용해 중복 모델 호출을 막는다.
- [x] 장면 전환은 나가는 장면, 회차 전환은 나가는 회차의 활성 장면, 장면 분할은 분할 뒤 양쪽 exact 장면을 직렬 background queue로 처리한다. 아직 stable ID가 없는 새 장면은 `sceneKey`를 저장 ID로 쓰지 않고 임시 탐색에만 사용하며 `finalizeSceneCanonCheck`로 stable ID를 만든 뒤 저장한다.
- [x] 자동 별빛 대상은 사용자가 지정한 별빛(`lore-entry`)만이다. 모델 결과는 기존 Canon 필드 Candidate로 저장되며 사용자 승인 전 `LoreEntry` 원본을 변경하지 않는다. 이야기 흐름 화면은 내부 ID 대신 회차 표시명과 exact 장면 범위를 보여준다.
- [x] schema 22→23 migration은 기존 불변 digest·document source 행을 새 제약으로 복사 검증하고 장면 source·작품 설정 테이블을 추가한다. 이전 21→22 migration은 별도 v22 schema 정의로 봉인해 기존 checksum을 유지했고, 새 definition checksum은 `05ed93aeb71fba328b6bb13bbbb03583e12c7700951cc9a000b874e40e701bcd`다.
- 오류 루프에서 기능 스위치 ON·분할 장면 2개·Work 권한 2개인데 요청 0건인 상태를 분리했고, 비동기 분할 이벤트가 이전 OFF callback을 잡던 stale closure를 최신 `useLayoutEffect` ref 갱신으로 수정했다.
- fresh 증거: 관련 계약·migration·runtime·renderer 12개 파일 28개 검증과 자동 trigger 집중 5개 파일 13개 검증 통과, 전체 local workspace runtime 103개 통과, 기존 unrelated `RuntimeBootstrapController.test.ts` 한 파일을 제외한 전체 Vitest 319개 파일·1,160개 통과·1개 skip, lint·네 TypeScript project·production build·architecture 통과. production Electron 한 worker에서 자동 장면 분석, 기존 NarrativeDigest 재실행, 기존 수동 Scene Canon·split lineage 3개가 모두 통과했다.
- standalone Windows package를 새 staging에서 완성한 뒤 `out/eum-studio-win-x64`에 원자 교체했다. 어제부터 창 없이 기존 package를 잠그던 exact PID 17360·20412만 종료했고 사용자 파일은 삭제하지 않았다. 최종 package는 774 files·376,300,966 bytes이며 executable SHA-256 `12b61e817329db7db8e74d99a42e552e1a1f68db7ba3d4c2d4fb6441a3b07d26`; `file://` renderer, `app.isPackaged=true`, typed bridge, 빈 작업실 bootstrap과 종료 뒤 package process 0건을 확인했다.
- 기존 알려진 전체-suite 항목: `RuntimeBootstrapController.test.ts`의 App loader 호출 기대 1 대 현재 2는 이번 기능 밖이며 테스트나 제품 동작을 약화해 숨기지 않았다.

### 2026-08-29 운영 시작·검토 화면 복구

- [x] 바탕화면 바로가기의 실제 실행 경로를 `scripts/start-eum-studio.ps1`로 확인하고, 창 없이 남은 Electron main을 정상 실행으로 오인하던 경로를 제거했다. 런처는 source/config가 bundle보다 새로우면 production build를 수행하고, Win32 visible window가 만들어진 뒤에만 성공하며, 기존 창은 같은 PID로 재활성화한다.
- [x] stale production bundle이 새 `narrative.digest` capability를 모르는 시작 실패와 context planner migration 정의 checksum 불일치를 현재 source에서 수정했다.
- [x] `검토` 진입 시 은퇴한 Document를 가리키는 과거 WritingSession이 현재 문서 목록에 없다는 이유로 기록 projection 전체를 throw하던 원인을 수정했다. 원장 DB의 원래 `document_id`는 보존하고, 현재 열 수 없는 회차 링크만 nullable projection으로 정규화한다.
- fresh 증거: context planner migration 2개와 activity/전체 local workspace runtime 묶음 102개 통과, 네 TypeScript project·Electron/preload/renderer production build 통과. 실제 사용자 DB에서 실패 session의 Document가 같은 Work 소유이며 `retired_at`만 설정된 것을 확인했고, 수정 bundle의 실제 사용자 데이터 검증은 renderer error 0건·`검토 작업면` visible·252개 WritingSession 보존으로 통과했다. stale-bundle launcher build도 exit 0으로 완료됐고, 실제 Win32 visible `이음 스튜디오` 창을 확인했다. 바로가기를 다시 실행하면 430ms 안에 exit 0으로 끝나며 main PID를 교체하지 않는다.

### 2026-08-29 어두운 테마 대비 보정

- [x] 사용자 제공 포커스D·노르딕 화면을 실제 기준으로 고정하고, production Electron에서 어두운 7개 테마의 상단바·서식 툴바·활성 회차·활성 작업면 계산 색을 측정했다. 서식 툴바의 고정 `#444444`는 `1.03–1.79:1`, 상단바의 고정 `#727272`는 `2.09–3.62:1`, 일부 활성 항목의 `accentHover` 글자색은 `1.35–3.74:1`에 불과했다.
- [x] 14개 원본 팔레트 값과 본문·선택 강조는 유지하고, 공통 `control text`와 dark-only `accent text` 의미 토큰을 분리했다. 상단바·서식 도구·활성 회차·활성 작업면만 의미 토큰을 사용하며 hover·구분선도 현재 테마 표면 토큰을 따른다.
- fresh 증거: 테마 단위 3개, 신규 dark contrast production Electron 1개, 기존 노르딕 전체 작업면 dark surface 1개, 신규 E2E ESLint, 네 TypeScript project와 Electron/preload/renderer production build가 통과했다. 어두운 7개 테마의 네 핵심 표면은 모두 `5.03:1` 이상이며, 포커스D 서식 툴바 `6.51:1`·상단바 `6.01:1`, 노르딕 서식 툴바·상단바 `7.45:1`이다. 실제 사용자 preference `focus-dark-theme`를 유지한 새 bundle을 정상 종료·재실행했고 Win32 visible `이음 스튜디오` 창을 확인했다.

### 2026-08-29 작품 별빛·연속성 독립 구현 Goal

- [x] Gate 0 — 사용자 지정 설계 원문 1,688줄·53,225 bytes의 SHA-256 `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5`를 승인 기능 설계 manifest에 등록했다. 기존 승인 manifest 11개 checksum도 모두 일치한다.
- [x] Gate 0 — schema 16 stable `sceneId`·lineage와 schema 17 Scene trash가 현재 source에 존재함을 확인했다. Gate 1 exact Document selection은 scene 선행 조건과 독립이고, 장면별 연속성·지식·문맥·digest는 후속 Gate까지 비활성화한다.
- [x] Gate 1 — Character·CharacterRelation·LoreEntry create/update Candidate, exact evidence, strict model payload, no-op·duplicate 제거.
- [x] Gate 1 — 필드별 before/after 편집·선택 승인·거절, unresolved target 명시 선택, inferred 직접 승인 차단.
- [x] Gate 1 — source/target expectedRevision, 한 SQLite transaction의 별빛·Anchor·Candidate·receipt 적용, typed bridge와 production Electron 재실행 복원.
- Gate 1 fresh 증거: 별빛 migration·ledger·local runtime 96개, renderer와 원고 진입 집중 검증 103개, production Electron 1개, 실제 process-kill 1개, 성능 harness 1개가 통과했다. production Electron은 승인된 인물뿐 아니라 인물 관계 별빛 상세도 완전 재실행 뒤 Anchor 기반 exact 원고 revision·범위를 여는지 확인한다. lint·네 TypeScript project·production build·architecture도 통과했다. 성능 fixture는 제품 제한이나 사용자 기본값이 아니며 최근 산출물은 DB 증가 1,228,800 bytes, 별빛 검색 p95 0.446ms, Candidate 1,000건 projection p95 147.116ms, planner p95 9.116ms를 기록했다. renderer commit 수는 storage/application harness에서 측정하지 않았고, 실제 UI 폐회로와 1280×800 경계는 production Electron에서 별도로 검증했다.
- 전체 Vitest는 1,033개 통과·1개 skip·1개 실패다. 남은 실패는 시작 시점부터 존재한 `RuntimeBootstrapController.load()` 호출 수 기대 1 대 현행 App 2이며 별빛 경로와 무관하므로 제품 동작이나 기존 테스트를 약화해 숨기지 않았다.
- GoalBuddy board: `docs/goals/eum-studio-canon-review-gate-1/state.yaml`.

### 2026-08-29 작품 별빛·연속성 Gate 2–8 연속 Goal

- [x] Gate 2 — ContinuityThread CRUD, exact selection 수동 생성, AI Candidate, PlotThread·ForeshadowLine·Character.goal 통합 projection, resolve/dismiss 이력. 실제 Electron 완전 재시작, process-kill 원자성, 1,000행 projection/planner, privacy까지 검증했다.
- [x] Gate 3 — CharacterKnowledge truth/stance·supersession·POV projection. schema 20, exact evidence, 활성 동일 문장 중복 차단, 명시적 계보, POV 분리, 실제 Electron 2회 재시작과 FK=0까지 검증했다.
- [x] Gate 4 — entity context policy·결정론적 planner·ContextManifest·활동 탭·required budget 오류. 실제 Canon/Continuity 실행도 plan→receipt→manifest→connector→activity 순서로 연결했다.
- [x] Gate 5 — work/document/character/relationship digest·source manifest·stale·재생성.
- [x] Gate 6 — stable Scene identity 기반 장면 점검·연속성·지식 변화·split/merge lineage 계승 검토.
- [x] Gate 7 — 명명된 WorkSnapshot slot과 장면 단위 read-only 비교/선택 plan. 자동 전체 병합은 제외.
- [x] Gate 8 — 별빛의 Obsidian 호환 단방향 Markdown export. Markdown import는 제외.
- Gate 2는 schema 19 원장, 분리된 local service, 좁은 typed bridge, IME-safe exact selection, Canon 3열 작업면, source-badged 통합 projection, Candidate 승인·거절·중복 확인, 재시작·process-kill·성능 증거까지 완료했다.
- Gate 3은 Judge가 발견한 동일 Work·인물·문장 활성 중복 우회까지 partial unique index와 서비스 오류로 차단한 뒤 완료했다.
- Gate 4는 별빛별 `required | relevant | withheld`, 결정적 우선순위와 예산 실패, receipt-linked manifest, 민감 본문·prompt·key를 제외한 활동 projection 및 실제 connector 실행 연결까지 완료했다.
- Gate 5는 명시적 work/document/character/relationship 범위와 planner가 선택한 전체 source revision manifest를 가진 immutable NarrativeDigest, stale text 보존, 새 행 재생성, typed bridge와 전용 UI를 완료했다. schema 22 checksum·실제 runtime·production Electron·500문서/2,400 source 성능 증거는 `docs/verification/canon-continuity-gates-2-8/gate-5-verification.*`에 기록했다.
- Gate 6은 사용자가 장면 카드에서 명시적으로 실행하는 exact 장면 Canon 점검, Scene을 참조하는 Continuity/CharacterKnowledge projection, split/merge 후 자동 상속 없는 lineage needs-review를 완료했다. 최신 runtime·Electron·성능 증거는 `docs/verification/canon-continuity-gates-2-8/gate-6-verification.*`에 기록했다.
- Gate 7은 기존 불변 WorkSnapshot의 label을 이름 있는 슬롯으로 투영하고 같은 이름의 이전 행을 이력으로 보존한다. stable Scene의 exact revision/range manifest를 스냅샷에 봉인해 현재 장면과 read-only로 비교하며, 선택 계획은 `canApply: false`, `applyCommand: null`, 자동 병합 금지를 계약과 UI에서 함께 강제한다. 최신 runtime·production Electron·성능 증거는 `docs/verification/canon-continuity-gates-2-8/gate-7-verification.*`에 기록했다.
- Gate 8은 별빛 9종과 현재 DocumentRevision manifest를 결정적인 Obsidian note·typed wikilink로 투영하고, main process가 새 폴더에 write·sync·readback 검증 후 게시하는 단방향 export adapter를 완료했다. 외부 Markdown 변조 뒤 완전 재실행에서도 별빛이 바뀌지 않고 새 export가 원장 bytes에서 다시 생성되는 것을 확인했다. 최신 runtime·production Electron·성능·역방향 surface 0건 증거는 `docs/verification/canon-continuity-gates-2-8/gate-8-verification.*`에 기록했다.
- GoalBuddy board: `docs/goals/eum-studio-canon-continuity-gates-2-8/state.yaml`.

### 2026-08-28 장면 편집 정상화 Goal

- [x] P0-1 — 장면 카드가 전달한 Scene을 버리고 다른 화면의 현재 커서에서 분할하던 `현재 위치에서 분할` 진입점을 제거했다. 원고 우클릭 `장면 나누기`가 실제 pointer 위치를 사용하며, 커서를 원고 끝에 둔 상태에서도 구분선 위치 split·사건 소속·완전 재실행 복원을 production Electron에서 확인했다.
- [x] P0-2 — `CreateSceneOverrideCommand`에 `expectedDocumentRevisionId`를 필수로 추가하고 renderer durable queue revision과 main runtime current target을 직접 비교한다. persist 중 source/selection 변경을 거부하며 CodeMirror context menu와 scene controller가 IME composition 중 구조 명령을 차단한다.
- P0-1/P0-2 fresh 증거: SceneList 2개, scene contract/runtime 86개, typed bridge 69개 검증, 전체 typecheck·production build, exact split Electron 1개와 IME composition 차단/commit 뒤 split Electron 1개 통과. sandbox 내부의 초기 Electron `Target crashed`는 같은 build를 sandbox 밖에서 실행해 제품 assertion과 분리했다.
- [x] P0-3 — schema 16에서 `SceneIdentity`·segment·split/merge/delete/restore lineage와 annotation·event override·music queue의 무손실 binding inventory를 도입했다. 신규 메타데이터는 stable `sceneId`에 즉시 원자 연결되고, split/merge 뒤에는 proposed target 검토 상태로 전환되며 사용자가 제안 승인 또는 연결 해제를 할 수 있다. 사건 override의 실제 적용 장면도 historical `sceneKey`가 아니라 current binding의 stable `sceneId`에서 결정한다.
- [x] P0-4 — schema 17의 Scene trash 원장과 strict preview/delete/list/restore/undo 계약을 구현했다. 첫·마지막 문장, 삭제 UTF-16 길이, 영향 회차와 연결 사건·주석·음악을 확인한 뒤에만 원고·경계·revision·identity·segment·binding·lineage를 한 transaction에서 휴지통으로 이동한다. 즉시 `Ctrl+Z`와 앱 재시작 뒤 별도 휴지통 복원이 동작하며, 삭제 뒤 원고·binding·규칙이 바뀌면 덮어쓰지 않고 복원을 거부한다.
- P0-3/P0-4 fresh 증거: Scene trash contract/planner/migration/runtime와 bridge/dialog/SceneList 집중 검증 176개 통과, backend 최종 묶음 99개 통과, 전체 lint와 네 TypeScript project 통과, production build 통과. production Electron 한 worker에서 exact split/rebind, IME guard, delete preview→원자 삭제→`Ctrl+Z`→재삭제→완전 재시작→휴지통 복원 3개가 통과했고 최종 build의 삭제/복원 흐름도 1개 재통과했다.
- 전체 `npm run check`의 Vitest 단계는 985개 통과·2개 실패·1개 skip이다. 실패는 이번 Goal 밖의 시작 시점 dirty CSS import 기대 1개와 기존 `RuntimeBootstrapController.load()` 호출 수 기대 1개이며, 이 때문에 check의 후속 build는 실행되지 않았다. 동일 최종 source의 별도 `npm run build`, architecture check/report, 관련 production Electron 검증은 통과했다.
- GoalBuddy board: `docs/goals/eum-studio-scene-editing-normalization/state.yaml`.

### 2026-08-25 편집 기능 변경

- 회차 끝 범위를 다음 회차 첫머리로 이동하면서 기존 장면 identity와 양쪽 회차 revision을 함께 기록하는 명령, 같은 회차의 장면 나누기·장면 구분 삭제, 작품·회차 삭제 진입점, 원고 우클릭 잘라내기·복사·붙여넣기, 1회 `Ctrl+A`, 이전 화 흐름의 옅은 시각 구분을 구현했다.
- 사용자 요청에 따라 이번 변경을 위해 추가한 단위·런타임·Electron E2E 테스트와 기존 테스트에 덧붙인 검증을 제거하고 추가 검증을 중단했다. 따라서 이 변경에는 완료 검증 주장을 남기지 않는다.
- 회차 삭제에는 `다음부터 회차 삭제 경고 표시하지 않기` preference를 저장하는 checkbox dialog를 적용하고, 작품의 활성 회차를 한 SQLite 트랜잭션에서 모두 retire하는 `회차 전체 삭제` 명령과 문서 레일 진입점을 추가했다.
- 이후 사용자 요청으로 남은 검증을 다시 실행했다. fresh typecheck·production build·lint·architecture check는 통과했다. Vitest는 957개 통과·1개 실패·1개 skip이며 `RuntimeBootstrapController.test.ts`의 App loader 호출 개수 기대가 1 대 실제 2로 실패했다. production Electron E2E는 95개 통과·28개 실패·1개 skip으로 끝났으므로 전체 통과나 완료를 주장하지 않는다.
- `여기서부터 다음 화로 보내기`가 구조 경계 없는 단일 장면을 중간에서 나눌 때 identity 계획에서 제외되던 원인을 수정했다. 이동점이 장면 내부라 양쪽 회차에 내용이 남으면 명시적 경계 여부와 무관하게 동일 Scene identity의 source/target segment를 만든다. production Electron 임시 작업실에서 `AAAA BBBBBB`를 중간 이동해 `AAAA ` / `BBBBBB`로 나뉘고 두 segment가 동일 `sceneId`를 공유함을 확인했다. 전체 `npm run build`는 별도 `WorkspaceStatusToolsHost.tsx` optional callback 타입 오류로 막혔지만 Electron·renderer 개별 production bundle은 통과했다.

리팩토링 Gate R1 현재 상태:

- [x] R1-0 — 현재 `D:\eum.studio`의 승인 설계 manifest SHA-256 11/11 일치와 깨끗한 시작 작업 트리를 확인하고, 첨부 리팩토링 제안의 첫 변경 단위를 현재 브랜치 기준으로 다시 고정했다.
- [x] R1-1 — `App.tsx` 안의 `DocumentFolderTree`와 문서 drag·폴더 편집 local state를 `src/renderer/workspace/documents/DocumentFolderTree.tsx`로 그대로 옮겼다. 두 호출부의 props, DOM class·접근성 표면, CSS, workspace 명령과 저장 동작은 변경하지 않았다.
- [x] R1-2 — 홈의 `WorkCard`·`LibraryPage`, Shell의 백업·가져오기·새 작품·이름 변경 dialog, App의 사건 dialog와 문서 제목/생성 control을 상태·명령 소유권 이동 없이 기능 폴더로 기계적으로 추출했다.
- [x] R1-3 — active renderer CSS를 기존 selector·선언·공백·개행·cascade 순서를 그대로 유지한 24개 기능/호환 shard와 0-byte legacy residual로 이동했다.
- [x] R1-4 — WorkspaceRoot의 core editor/activity/version dialog 10종을 조건·props·callback 변경 없이 각 controller를 직접 소비하는 typed `WorkspaceDialogHost`로 이동했다.
- [x] R1-5 — 조수 chat/connections/context dialog JSX를 controller와 navigation port를 소비하는 typed Assistant dialog host로 이동했다.
- [x] R1-6 — 작품 구조·별빛·인물·플롯·파편·복선 관리 dialog JSX를 기능 controller와 navigation port를 소비하는 typed host로 이동했다.
- [x] R1-7 — 구조 개요·플롯·사건·장면·인물·복선·별빛의 embedded workspace panel JSX를 typed structure host와 공유 Scene content로 이동했다.
- [x] R1-8 — 집필 기록·원고 검토·Candidate·버전의 review workspace panel JSX와 Candidate count 파생을 typed review host로 이동했다.
- [x] R1-9 — 현재 원고·조수·작품·버전의 오른쪽 review inspector rail JSX를 typed rail host로 이동했다.
- [x] R1-10 — 빈 작품/활성 회차 문서 레일, 폴더 트리, 원고 검색과 왼쪽 재진입 JSX를 typed document rail host로 이동했다.
- [x] R1-11 — 인물·플롯 전용 workspace surface JSX를 typed feature surface host로 이동하고 Scene content를 기존 typed component의 별도 인스턴스로 조립했다.
- [x] R1-12 — 집중 toolbar·열린 회차 tab·ManuscriptEditor·편집 오류 JSX를 typed manuscript surface host로 이동했다.
- [x] R1-13 — Work header·fallback manuscript header·startup recovery preview/action JSX를 typed host로 이동했다.
- [x] R4-29 — Scene·Assistant vocabulary·Character·Plot·Lore·Event·Work-structure·Foreshadow·Fragment의 exact source navigation callback을 typed feature navigation controller로 이동했다.
- [x] R5-32 — 문서 생성·이름/순서 변경 설치, schedule/완료 revision 열기, tab activation/close와 WorkspaceController install을 typed document controller로 이동했다.
- [x] R5-33 — Runtime projection 설치, editor activation, durable queue 등록과 bootstrap effect를 typed runtime projection controller로 이동했다.
- [x] R4-30 — 인물·별빛·파편의 editor-bound capture/create/insert와 manuscript transaction 기록을 typed manuscript-actions controller로 이동했다.
- [x] R1-14 — bottom event rail·statusbar·schedule·music library와 남은 workspace tool host JSX를 typed host로 이동했다.
- [x] R4-31 — structure/music projection state와 lifecycle을 `useWorkspaceStructureKernel`로 이동했다.
- [x] R4-32 — assistant/version/schedule/editor/activity/character/lore 조립과 plot/scene/foreshadow/fragment 조립을 core/story feature kernel로 이동했다.
- [x] R5-34 — 공통 workspace activation/DocumentNavigator port 조립을 typed document navigator controller로 이동했다.
- [x] R1-15 — WorkspaceRoot의 화면 조립을 `WorkspaceView`로 이동하고 `App.tsx`를 670 lines의 session/navigator/kernel 조립부로 축소했다.

리팩토링 Gate R1 현재 증거:

- 추출 전 `App.tsx` 블록과 새 컴포넌트 본문은 `export` 표기 정규화 뒤 SHA-256 `E4A5B5B09ADF9AD37212979CFF34833268C0E98248336FC3A91BA0517BF7BC01`로 일치한다.
- `WorkCard`, `LibraryPage`, Studio Shell dialog 4개, `EventBlockDialog`, 문서 control 2개의 각 원본/new 정규화 block hash가 일치한다. 새 static-render 검증은 각 selector·접근성 이름·표시 분기와 local form 상태를 고정한다.
- fresh `npm run check`에서 lint, 네 TypeScript project, Vitest 239개 파일·846개 검증, Electron/preload/renderer production build가 통과했고 기존 1개만 skip됐다.
- 현재 production Electron에서 작품 카드·즐겨찾기·이름 변경·재실행, 홈 native 회차 선택, 새 작품/백업/가져오기 dialog, exact-selection 사건 생성, `제목없음` 회차 2개 생성 흐름을 통과했다. 현재 완료 마커·IA와 맞지 않는 기존 E2E locator는 검증 실행에서만 좁혀 사용했고 모든 임시 test/workspace를 제거했다.
- production Electron에서 회차 완료→원고 저장→완전 재실행 복원이 통과했다. 폴더 생성·중첩·두 회차 drag·순서 변경·폴더 삭제·원고 undo/redo·완전 재실행 복원도 현재 완료 마커를 고려한 검증용 locator로 통과했으며, 검증용 테스트 변경은 즉시 제거했다.
- 체크인된 폴더 E2E의 exact 회차명 locator와 버튼 텍스트 기대는 R1-1 변경 전부터 완료 상태 마커 `○/✓/△`를 포함한 현재 접근성 이름·텍스트와 맞지 않아 같은 위치에서 실패한다. 이 리팩토링 범위에서는 제품 접근성 표면이나 기존 테스트를 바꾸지 않았다.
- CSS 25개 active import의 누적 원본은 266,778 bytes, LF 11,447, CR 3,953, SHA-256 `101FDA86519F33CFE90D22709C738D65E3C142592AB77FD7AA6460CC1E63A737`로 분할 전과 일치한다. Vite 산출 CSS도 225,897 bytes, SHA-256 `775B0343B70558A8C0081E06B0DF2D33DCEA1D8915D392F22F464556A7EDEBC5`로 단일 파일 기준과 동일하다.
- CSS 분할 대표 production Electron 흐름은 native 홈 회차 선택, 일정·집필 기록, exact-selection 내보내기, 투고·빠른 메모·음악 큐·플롯 보드, 장면 초안·원고 분석, 인물·영감·플롯, 장면 preview·TXT 가져오기·다크 테마, 14개 테마·150% 플레이어·혼합 로컬 미디어를 통과했다. 기존 Home 즐겨찾기 표기, sidebar 강제 표시, 검토 레일 action 폭, 옛 snapshot/rename/folder locator 불일치는 동일한 단일 CSS bundle에서도 재현되거나 현재 DOM 이전부터 어긋난 기준으로 확인해 제품을 바꾸지 않았다.
- SQLite schema·migration·durable save·CodeMirror·typed bridge·IPC·Electron main에는 변경이 없다. CSS는 파일 경계만 바뀌었고 selector·선언·원본 byte·production 계산 결과는 바뀌지 않았다.

리팩토링 Gate R2 — `DocumentNavigator` 통합 상태:

- [x] R2-0 — 조각·복선·별빛·별빛 Candidate·인물·플롯·사건·작품 구조·조수 어휘·장면 경계·장면 초안의 same/visible/cross-document 성공 경로와 assistant stale revision 경로를 production Electron characterization으로 봉인했다.
- [x] R2-1 — typed `DocumentTarget`, neutral result/port 계약, awaitable surface readiness, installed-editor handshake, exact revision 전후 확인, generation supersession을 `DocumentNavigator.open`에 추가했다.
- [x] R2-2 — revision을 보유한 조각·복선·별빛·별빛 Candidate·플롯·사건·조수·장면 focus/preview는 exact target으로, 기존 계약상 revision rejection이 없는 인물·작품 구조 범위·stale 장면 초안 비교는 current target으로 구분했다.
- [x] R2-3 — 작품 구조의 범위 없는 회차 열기는 `kind: "document"`로 이동했고, 일반 회차 트리·탭·완료 revision·활동 기록·홈·닫기 전환은 후속 `WorkspaceLifecycleCoordinator` 범위로 남겼다.
- [x] R2-4 — 8개 임시 channel registry와 `stage/clear/consumeActivated`, 12개 feature pending ref/type/effect, 활성화 후 feature 분기 체인을 제거했다. `handleDocumentActivated`는 editor identity 설치·telemetry·navigator notify·resume capture만 조정한다.
- [x] R2-5 — cross-episode 장면 preview에서 B의 extraction selection revision이 A Candidate decoration을 가리던 실제 실패를 exact navigation preview target으로 좁혀 수정하고, skip 없이 decoration·cursor·focus·scroll·tab·원고 불변을 통과했다.

리팩토링 Gate R2 현재 증거:

- `App.tsx`의 feature pending ref와 `pendingVisibleManuscriptSelection` 검색 결과는 0건이고, `test.fixme`도 0건이다. feature 위치 이동은 `documentNavigator.open` 13개 호출로 수렴했다.
- 직접 `selectDocumentRange`는 forward-writing의 현재 cursor 배치, 공통 navigator port, 현재 문서 안의 별빛 cue 선택만 남았다. 직접 `revealDocumentOffset`은 공통 navigator port 한 곳만 남았다.
- `activateWorkspaceLocation` 직접 호출은 navigator activation port와 완료 revision 보기·활동 기록 회차 열기·탭 닫기 같은 일반 lifecycle 전환만 남았다.
- fresh `npm run check`가 lint, 세 TypeScript project, Vitest 238개 파일·842개 검증 통과·기존 1개 skip, Electron/preload/renderer production build를 통과했다.
- production Electron에서 조각·인물·장면 boundary·stale draft·플롯·작품 구조·별빛·복선·조수 stale revision·별빛 Candidate·장면 focus·사건 레일·flush-before-switch·IME defer/cancel 15개 흐름이 한 worker에서 9.6분에 모두 통과했다.
- 오래된 final-scenes E2E는 App을 우회한 bridge 직접 setup 뒤 renderer scene projection이 갱신되지 않는 지점에서 focusScene 전에 멈춘다. Stage R2는 현재 UI의 우클릭 장면 생성 흐름에 visible-transition exact selection 검증을 추가해 focusScene을 증명했으며, 해당 오래된 fixture 구조는 Stage 7 E2E 분리/driver 정비에서 교체한다.

리팩토링 Gate R3 — 투고 운영 controller 상태:

- [x] `StudioShell`의 투고 route 3개와 persistent projection·선택·메일 상태 21개, 하나의 action/error gate, 11-query all-or-error 로드, 투고처·투고·계약·발행·정산·입금·근거·조사·조수·CSV·메일 동작을 항상 마운트되는 `usePublishingController`로 이동했다.
- [x] `PublishingPartnerDialog`의 현재 61개 prop surface, dialog-local form·검색·Candidate·CSV mapping/preview·메일 draft는 그대로 유지했다. controller는 주입된 client만 사용하며 `window` 직접 접근과 raw state setter 노출이 없다.
- [x] 조건부 dialog host와 61개 live prop mapping을 stateless `PublishingFeature`로 옮겼다. controller hook과 feature host는 Shell에서 각각 무조건 한 번 마운트되고, dialog 자체는 기존 visibility/catalog 조건에서만 마운트된다.
- [x] `StudioShell.tsx`는 87,863 bytes·2,473 lines에서 43,087 bytes로 줄었다. 새 controller/host는 투고 feature 안에서 orchestration과 화면 조립을 소유하고 public bridge/schema/SubmissionPackage/PublishingSource/Candidate/메일 보안 경계를 바꾸지 않는다.

리팩토링 Gate R3 현재 증거:

- normalized route·persistent state·966-line callback·dialog prop block hash 감사가 통과했다.
- 투고 controller와 기존 application/dialog/bridge/runtime/mail 집중 21개 파일·198개 검증이 통과했다.
- fresh `npm run check`가 lint, 네 TypeScript project, Vitest 240개 파일·852개 검증 통과·기존 1개 skip, Electron/preload/renderer production build를 통과했다.
- production Electron 한 worker에서 투고처·웹 조사·조수 승인·불변 제출 패키지·계약·발행·정산·입금·불변 근거·근거 연결·투고처/투고 CSV·메일 Candidate·메일 연결/일정/동기화 14개 흐름을 9.2분에 모두 통과했다.
- host 이동 뒤 fresh `npm run check`도 Vitest 242개 파일·863개 검증 통과·기존 1개 skip과 production build를 통과했고, 같은 production Electron 14개 흐름이 9.3분에 다시 모두 통과했다.

리팩토링 Gate R4 — 기능별 controller 상태:

- [x] R4-1 — 조각 projection·Work load/reset·dialog/gate/error와 capture/move/insert/update/retire를 injected `useFragmentsController`로 이동했다. App은 profile bootstrap, editor/durable/resume, exact-selection `DocumentNavigator`, rail/dialog UI만 유지한다.
- [x] R4-2 — 복선 lines/points와 line/point 동작을 `useForeshadowController`로 이동하고 shared Lore link와 exact source navigation을 App에 유지했다.
- [x] R4-3 — canonical Lore와 Lore Candidate를 함께 `useLoreController`로 이동하고 shared link·cue·exact evidence navigation을 App에 유지했다.
- [x] R4-4 — 인물·관계·수동 근거·추출/생성 Candidate를 `useCharactersController`로 이동하고 inspiration·OAuth·workspace/navigation을 App에 유지했다.
- [x] R4-5a — 사건·플롯·장면 projection state, 독립 load lane, refresh/reconcile kernel을 `useStructureController`로 이동하고 mutation/UI/music/navigation을 App에 유지했다.
- [x] R4-5b — 사건 create/move/source link·replace·retire의 payload와 persist→command→refresh를 StructureController에 이동하고 shared gate/error/UI/navigation을 App에 유지했다.
- [x] R4-5c — canonical PlotThread create/update/retire와 internal reconcile을 StructureController에 이동하고 swallowed-error rail refresh·selection/UI gate는 App에 유지했다.
- [x] R4-5d — plot source expectedSourceId·persist→linkSource→reconcile을 StructureController에 이동하고 editor capture·gate/UI/navigation을 App에 유지했다.
- [x] R4-5e — placement 이동·story-time payload와 authoritative board→selection→swallowed refresh를 StructureController에 이동하고 validation·UI/selection state는 App에 유지했다.
- [x] R4-5f — plot-to-event selected/anchorless 생성과 수동 link/unlink의 payload·mutation reconcile·swallowed refresh를 StructureController에 이동했다.
- [x] R4-5g — 마지막 createPlotFromEvent의 command→mutation→병렬 board/raw refresh→board→selection→tab 순서를 StructureController에 이동하고 App의 직접 plots 명령을 0으로 만들었다.
- [x] R4-6 — Work 음악 설정·YouTube 프로필·불변 단조 증가 재생 요청을 MusicController로 이동하고 transport·queue 저장·장면 음악·Pomodoro는 App에 유지했다.
- [x] R4-7 — 활동 state/lifecycle을 옮기지 않고 Work 활동·Pomodoro·목표·읽기 시간 네 조회의 atomic loader만 분리했다.
- [x] R4-8 — App 수명 ephemeral 조수 채팅의 message/sending/error/runChat만 AssistantController로 이동하고 Work·OAuth·context·connections·permissions·navigation은 App에 유지했다.
- [x] R5-1 — RuntimeProjection과 11-query atomic loader를 stable RuntimeBootstrapController로 이동하고 여섯 호출부의 install·recovery·durable·catalog 의미는 App에 유지했다.
- [x] R5-2 — continuous-reading의 promise tail·latest pending만 stable SerialPersistenceLane으로 이동하고 progress/location·bridge save·IME·switch·close 순서는 App에 유지했다.
- [x] R5-3 — 같은 lane을 Work manuscript layout save tail·latest pending에 적용하되 cache·load/change sequence·revision·optimistic rollback은 App에 유지했다.
- [x] R5-4 — regular manuscript persist의 queue flush→resume capture만 one-method facade와 pure helper로 이동하고 durable queue·IME·strict close·switch lifecycle은 App에 유지했다.
- [x] R5-5 — mutable store를 만들기 전에 active Work/Document/derived Work ID 선택만 pure immutable WorkspaceSession selector로 이동했다.
- [x] R5-6 — DocumentNavigator용 raw catalog Work ID·selected Document·document profile snapshot의 type/factory만 Store로 이동하고 ref/effect/editor/tab identity는 App에 유지했다.
- [x] R5-7 — mutable documentTabSession을 옮기지 않고 existing projectDocumentTabs 기반 open Document ID projection만 WorkspaceSession selector로 이동했다.
- [x] R5-8 — installed editor identity의 exact Work/Document 생성·비교만 pure helper로 이동하고 ref·notification·reveal·Navigator lifecycle은 App에 유지했다.
- [x] R5-9 — App의 동일한 openDocumentTab 전이 11개를 pure WorkspaceSession facade로 치환하고 mutable state·close·switch lifecycle은 App에 유지했다.
- [x] R5-10 — closeDocumentTab 계산 한 곳만 pure Store facade로 치환하고 activation 성공 후 session commit 순서는 App에 유지했다.
- [x] R5-11 — workspace activation의 current Document lookup·same-target 판단만 pure lifecycle plan으로 이동하고 모든 side effect/order는 App에 유지했다.
- [x] R5-12 — activation 결과의 selected Work/Document lookup만 pure lifecycle selector로 이동하고 validity/error/state order는 App에 유지했다.
- [x] R5-13 — successful activation의 catalog·selected Document ID runtime patch만 pure projection으로 이동하고 setRuntime·ready gate·callback은 App에 유지했다.
- [x] R5-14 — existing activateWorkspaceLocation의 전체 side-effect 순서를 injected lifecycle coordinator로 이동하고 App callback을 thin port composition으로 줄였다.
- [x] R5-15 — prepareForMain의 save→resume preview→catalog refresh→runtime/callback 순서를 injected lifecycle coordinator로 이동했다.
- [x] R5-16 — App component ref service를 stable WorkspaceController로 교체하고 forwardRef/useImperativeHandle을 제거했다.
- [x] R5-17 — window close의 flushForClose→reading/layout/focus/session/resume→ack 순서를 injected lifecycle coordinator로 이동했다.
- [x] R5-18 — runtime/recovery/tab session, lifecycle action, persistence ref/lane state를 각각 session/lifecycle/persistence hook으로 이동했다.
- [x] R5-19 — StudioRoot·WorkspaceRoot entry와 stable WorkspaceController를 도입하고 component imperative ref service를 제거했다.
- [x] R6-1 — fragments bridge contract·preload factory·desktop IPC registrar를 기능 파일로 분리하고 채널/public bridge/sender policy를 유지했다.
- [x] R6-2 — `studio-bridge.ts`·`preload/index.ts`·`desktop/main.ts` public entry를 기존 import/side-effect 시작 의미를 유지한 38/27/22-byte entry로 축소하고 구현을 core/bootstrap module로 옮겼다.
- [x] R6-3 — 19개 bridge capability와 preload factory, 20개 desktop IPC registrar를 기능 경계로 분리하고 단일 registrar composition으로 조립했다. 230개 채널 이름·문자열과 229개 handler 등록은 이전 단일 파일과 누락·추가·값 변경 없이 일치한다.
- [x] R6-4 — renderer leaf의 직접 global bridge 접근을 제거하고 Quick Tools·Schedule client를 root에서 주입했다. preload/main public entry와 renderer `StudioRoot`·`WorkspaceRoot` entry를 작은 조립 경계로 고정했다.
- [x] R4-9 — Assistant OAuth·connection·context permission·어휘/표기/설정 검토 state와 명령을 `useAssistantController`로 완전히 이동하고, 편집기·저장 revision 접근은 좁은 document port로 주입했다. 원문/설정 reference 이동은 기존 Navigator·feature 경계에 유지했다.
- [x] R4-10 — Activity session/focus/Pomodoro/goal/readthrough/export state와 명령을 `useActivityController`로 이동하고, close lifecycle ref와 Pomodoro 시작 뒤 음악 선택 큐 재생은 좁은 port로 주입했다.
- [x] R4-11 — Music playlist/local media/scene queue/favorite/playback state와 명령을 `useMusicController`로 이동하고, Structure projection load와 Pomodoro 시작 후 선택 큐 재생은 좁은 port로 연결했다.
- [x] R4-12 — DocumentRevision·WorkSnapshot 조회/미리보기/복원/생성/비교 state·supersession과 명령을 `useVersionController`로 이동하고 runtime 재설치는 callback port로 유지했다.
- [x] R4-13 — 작품 영감 설정 조회/저장과 인물·사건 키워드 편집 state·명령을 `useInspirationController`로 이동했다.
- [x] R4-14 — 원고 사전 점검·TXT 가져오기·분석/히트맵/수정금지 집필 state와 명령을 editor-tools controller로 이동하고 Editor mutation은 read/exact-replace/select port로 제한했다.
- [x] R5-20 — 연속 읽기 dialog/progress와 작품별 원고 layout load/save/rollback orchestration을 기존 serial lane·cache·sequence ref를 주입받는 session controller로 이동했다.
- [x] R4-15 — 작품 일정 load/open/close/settings-revision refresh와 Escape 처리를 `useScheduleController`로 이동했다.
- [x] R5-21 — Work/Document 생성·이름 변경·삭제·순서/폴더 명령과 title editor state를 기존 runtime/install/search port를 주입받는 workspace command controller로 이동했다.
- [x] R4-16 — 사건 생성 dialog/action과 move/source link·replace·retire wrapper를 exact editor/persistence/Structure mutation port를 주입받는 event workspace controller로 이동했다.
- [x] R4-17 — 장면 경계·규칙·사건 override와 장면 추출·초안 검토 state/명령을 injected Structure·Assistant·editor·persistence port 기반 scene workspace controller로 이동했다.
- [x] R4-18 — 플롯 dialog/selection/action과 CRUD·출처·배치·사건 연결 wrapper를 existing Structure mutation과 editor/persistence port 기반 plot workspace controller로 이동했다.
- [x] R4-19 — 별빛–복선 공유 link projection·Lore/Foreshadow 호환 port·link/unlink orchestration을 injected controller로 이동했다.
- [x] R4-20 — 원고 별빛 cue hover/pin/occurrence-selection state와 명령을 narrow editor/resume/rail port 기반 lore cue controller로 이동했다.
- [x] R5-22 — 작품 구조 dialog/action/error와 DocumentNavigator 결과 전이를 work-structure state controller로 이동했다.
- [x] R4-21 — 원고 집중 화면과 작품 UI preference state·변경 명령을 제품 소유 manuscript focus controller로 이동했다.
- [x] R5-23 — Work section·structure/review tab·return location·records clock state와 진입 전이를 workspace navigation controller로 이동했다.
- [x] R4-22 — 작품 원고 검색 query/result/sequence와 편집·활성화 무효화 전이를 manuscript search controller로 이동했다.
- [x] R5-24 — rail layout/visibility, inspector tab, event rail mode와 active manuscript position state를 workspace layout controller로 이동했다.
- [x] R5-25 — per-Document durable save state map을 PersistenceCoordinator hook으로 이동했다.
- [x] R4-23 — 회차 완료·취소·완료 revision 열기 orchestration을 shared workspace gate와 queue/client port 기반 document completion controller로 이동했다.
- [x] R5-26 — durable queue validation/construction, save callback과 save-state install을 PersistenceCoordinator로 이동했다.
- [x] R4-24 — StudioShell의 앱 설정·작품 음악 설정·YouTube 연결·ChatGPT OAuth state/명령을 injected settings controller로 이동했다.
- [x] R4-25 — 백업 상태/create/restore와 레거시 가져오기 rehearsal dialog/state/명령을 backup-migration controller로 이동했다.
- [x] R4-26 — 작품 catalog/favorites/covers/resume, 일정 요약과 Library CRUD/navigation/dialog gate를 LibraryController로 이동했다.
- [x] R4-27 — 테마·집중 UI preferences load/save/localStorage/body-class state를 UI preferences controller로 이동했다.
- [x] R5-27 — resume checkpoint capture validation/client call을 session controller로 이동했다.
- [x] R5-28 — startup recovery apply gate/command/runtime reinstall을 session controller로 이동했다.
- [x] R5-29 — close request listener와 focus/session/resume/ack port composition을 session controller로 이동했다.
- [x] R4-28 — Pomodoro 시작 시 current scene/selected queue 조회·재생 orchestration을 music controller로 이동했다.
- [x] R5-30 — 새 Document profile/persistence/resume 조회·검증·queue register를 PersistenceCoordinator로 이동했다.
- [x] R5-31 — editor activation의 resume capture 뒤 catalog refresh client call을 session controller로 이동했다.
- [x] R7-1 — `desktop-shell.spec.ts`를 공용 support와 8개 기능별 spec으로 test body 변경 없이 분리했다.
- [x] R9-1 — 원 승인 완료 기준을 current source·diff·GoalBuddy receipt로 source-only 감사하고, 테스트 중단 이후의 미검증 범위를 식별했다.
- [x] R9-2 — 사용자 테스트 중단 해제 후 fresh type/static/unit/integration/build/production Electron 검증, stale ownership expectation 정합화와 최종 감사를 완료했다.

리팩토링 Gate R6 source-only 증거:

- `studio-bridge-core.ts`는 148,200 bytes에서 26,789 bytes로 줄었고 기능 계약은 `src/application/contracts/bridge/` 19개 파일로 분리됐다.
- 이전 `studio-bridge.ts`와 현재 기능 계약의 채널 mapping은 old/new 각 230개, missing 0, extra 0, changed 0이다. import path를 제외한 문자열 literal multiset도 old/new 각 484개로 완전히 일치한다.
- 이전 `desktop/main.ts`와 현재 `src/desktop/ipc/` registrar의 handler mapping은 old/new 각 229개, 누락·추가·중복 0이다. 기존 무인증 profile/catalog/favorites/covers 조회와 sender 인증 명령의 구분을 유지했다.
- 사용자의 `테스트 그만해` 지시 이후 test·typecheck·lint·build·Electron E2E는 실행하지 않았다. 이 구간의 증거는 source mapping 감사뿐이며 runtime 완료 증거로 취급하지 않는다.
- core 10종, 조수 3종, 작품 구조·별빛·인물·플롯·파편·복선 7종 dialog가 controller를 직접 소비하는 세 typed host로 이동했다. 마지막 7종의 ready/active-Work gate, 표시 순서, source/capture 가능 조건, 선택 ID, profile, Lore-Foreshadow link와 navigation callback은 이전 App block과 동일하며 parser·relative import·unused import source 감사가 0건이다. `App.tsx`는 7,354 lines·267,117 bytes로 줄었고 project test는 실행하지 않았다.
- embedded 구조 workspace의 7개 tab과 공유 Scene content를 typed host로 이동했다. 기존 10개 주요 child component의 prop 이름/count, tab order, DOM·표시 literal multiset은 old/new 차이 0건이고 parser·relative import·unused import source 감사도 0건이다. `App.tsx`는 7,037 lines·254,229 bytes이며 project test는 실행하지 않았다.
- review workspace의 records/manuscript/candidates/versions 4개 tab을 typed host로 이동했다. 기존 7개 child component prop surface는 old/new 차이 0건이고 active-Work/activity gate, Candidate count, records/version command와 오류 우선순위를 유지했다. parser·relative import·unused import source 감사는 0건이며 `App.tsx`는 6,891 lines·248,294 bytes이다. project test는 실행하지 않았다.
- 오른쪽 review inspector의 current/assistant/work/versions 표면과 재진입 button을 typed rail host로 이동했다. 기존 JSX tag·attribute multiset 차이는 0건이고 Work-aware rail toggle, Candidate capture/permission, Lore/조수/버전/구조 명령과 오류 표시 조건을 유지했다. parser·relative import·unused import source 감사는 0건이며 `App.tsx`는 6,248 lines·221,737 bytes이다. project test는 실행하지 않았다.
- 빈 작품/활성 회차의 왼쪽 document rail, folder tree, manuscript search와 reentry를 typed host로 이동했다. 두 portal 표면의 native JSX tag·attribute multiset 차이는 0건이고 shared-sidebar/visibility, Work-bound document move, title/edit gate, search result와 accessibility 표면을 유지했다. parser·relative import·unused import source 감사는 0건이며 `App.tsx`는 6,030 lines·213,158 bytes이다. project test는 실행하지 않았다.
- Character와 Plot 전용 workspace surface를 typed feature host로 이동하고 Plot의 Scene tab은 기존 `SceneStructureContent`를 별도 컴포넌트 인스턴스로 조립했다. workspaceSurface/workSection gate, Character/Plot child prop surface, Candidate/inspiration/selection/source actions를 유지했고 parser·relative import·unused import source 감사는 0건이다. `App.tsx`는 5,684 lines·198,249 bytes이며 project test는 실행하지 않았다.
- manuscript focus toolbar, open-document tabs, ManuscriptEditor와 editor open-error 표면을 typed manuscript host로 이동했다. 기존 전체 JSX tag·attribute multiset 차이는 0건이고 manuscript-focus/forward-write, tab gate, editor props/ref/callback, recovery read-only, layout/lore/scene input과 error 조건을 유지했다. parser·relative import·unused import source 감사는 0건이며 `App.tsx`는 5,493 lines·190,732 bytes이다. project test는 실행하지 않았다.
- embedded Work header, fallback manuscript header와 startup recovery preview/issues/apply 표면을 typed host로 이동했다. 기존 header/recovery JSX tag·attribute multiset 차이는 0건이고 completion/title/schedule/navigation gate와 recovery candidate/issue/apply 조건을 유지했다. parser·relative import·unused import source 감사는 0건이며 `App.tsx`는 5,290 lines·183,262 bytes이다. project test는 실행하지 않았다.
- Scene부터 Fragment까지 exact-source navigation callback 22개를 기존 `DocumentNavigator` port를 소비하는 typed controller로 기계 이동했다. callback 본문, dependency, ownership/revision/range 검사, same/visible/cross-document outcome, hide/reopen/error transition을 바꾸지 않았고 parser·relative import·unused import source 감사는 0건이다. 이 시점 `App.tsx`는 3,666 lines였다.
- 문서 생성·rename/reorder 설치, WorkspaceCommands composition, controller imperative install, schedule/completed revision, document tab activate/close를 typed document controller로 기계 이동했다. command/portal이 아니라 기존 session/runtime/catalog/persistence callback을 그대로 소비하며 parser·relative import·unused import source 감사는 0건이다. `App.tsx`는 3,303 lines·116,253 bytes이며 project test는 실행하지 않았다.
- Runtime projection install, editor activation, durable queue scheduler/catalog/scene refresh와 bootstrap effect를 typed controller로 기계 이동했다. query/install/cleanup/error swallowing 순서를 유지했고 parser·relative import·unused import source 감사는 0건이다. 이동 뒤 `App.tsx`는 3,057 lines였다.
- Characters/Lore/Fragment manuscript port 생성과 capture/create/move/insert, transaction telemetry/search/Pomodoro/forward-write/scene-clear/durable record를 typed manuscript-actions controller로 기계 이동했다. parser·relative import·unused import source 감사는 0건이며 `App.tsx`는 2,822 lines·99,354 bytes이다. project test는 실행하지 않았다.
- bottom event rail, statusbar, Session feedback, schedule, core dialogs와 music library를 typed status/tools host로 이동했다. portal target, gate, action/error/visible copy와 JSX attribute surface를 유지했다.
- assistant setting reference와 공통 workspace activation/DocumentNavigator ports를 navigation controller로 이동하고, structure/music, core feature, story feature 조립을 세 typed kernel로 이동했다. 새 controller/kernel은 bridge client를 주입받으며 leaf `.tsx`의 직접 global bridge method 호출은 0건이다.
- 최종 화면 조립은 `WorkspaceView.tsx` 990 lines·37,654 bytes로 이동했고 `App.tsx`는 architecture report 기준 670 lines·21,485 bytes가 됐다. App의 실제 hook call은 `useState` 3, `useRef` 9, `useMemo` 6, `useCallback` 7, `useEffect` 2이며 feature projection local state는 없다.

리팩토링 Gate R7 source-only 증거:

- 기존 `tests/e2e/desktop-shell.spec.ts`의 helper 30,241 bytes를 `tests/e2e/support/desktop-shell-suite.ts`로 옮기고, 119개 test body 753,761 bytes를 8개 기능 spec으로 분리했다.
- 8개 body를 원래 group 순서로 다시 결합한 SHA-256은 분리 직전과 같은 `aa53d9e0bbc9cc75af37adc7e2ea67bcc521a3f8e6d53cb8a624d14be82cf6eb`이며 test count도 119개로 같다. 각 spec import는 support export에 모두 대응한다.
- architecture report의 E2E target을 새 support/spec 파일로 갱신했고 모든 19개 target path가 존재한다. 테스트 실행은 하지 않았다.

리팩토링 Gate R9 최종 감사:

- `StudioShell.tsx`는 499 source lines·16,774 bytes이고 UI host/sidebar/Quick Tools 조립만 local state로 남았다. `App.tsx`는 architecture report 기준 670 lines·21,485 bytes의 session/navigator/kernel 조립부이고, `WorkspaceView.tsx`는 990 lines·37,654 bytes의 typed 화면 조립부다. App local `useState`는 stable `DocumentNavigator`·telemetry store·runtime bootstrap instance 3개뿐이다.
- `App.tsx`와 `StudioShell.tsx`의 직접 `window.eumStudio.<capability>.<method>` 호출은 0건이다. leaf `.tsx`의 직접 global bridge method 호출도 0건이다.
- feature pending navigation ref/type은 0건이고 교차 회차 기능 이동은 `documentNavigator.open` 13개 경로로 수렴했다. 현재 `pending...` 검색 결과는 Candidate count와 Event dialog draft뿐이다.
- bridge/preload/desktop entry는 38/27/22 bytes이고 19 contract·19 preload factory·20 IPC registrar로 분리됐다. 앞선 source mapping 감사의 230 channel, 229 handler, 문자열 literal 누락·추가·변경 0 결과를 유지한다.
- CSS 24 shard+legacy residual, 9개 feature E2E spec+shared support와 별도 YouTube live smoke, architecture report/check script를 갖췄다. Playwright listing은 현재 10개 spec·123개 test이며 package dependency와 devDependency는 기준 브랜치와 동일하다.
- fresh `npm run check`에서 lint, 네 TypeScript project, Vitest 252개 파일·959개 통과·기존 1개 skip, Electron/preload/renderer production build가 통과했다. stale ownership expectation은 현재 controller/kernel/host 소유권으로 정합화했고 전체 suite가 이를 검증한다.
- production Electron E2E는 9개 feature spec의 122개 test가 모두 통과했다. API key가 있어야 하는 별도 YouTube live smoke 1개만 의도적으로 skip되어 전체 123개는 122 passed·1 skipped다. 장시간 전체 러너가 외부 세션 중단으로 71번째 뒤 종료된 뒤 각 spec을 종료 코드가 남는 bounded 실행으로 다시 검증했다.
- E2E current-IA 정합화는 현재 Work card/native select, 완료 마커, Review/Structure surface, assistant entry와 schedule copy를 실제 제품 표면에 맞췄다. IME 문서 전환의 비동기 React 상태 assertion은 제품 코드 변경 없이 `expect.poll`로 안정화했고 3회 반복 및 전체 29개 persistence spec에서 통과했다.
- fresh `npm run architecture:check`는 `architecture boundaries: ok`이고 report 생성도 통과했다. current contract channel은 기준 230개와 일치하며 누락·추가·중복 0, IPC registrar는 229개 handler channel과 outbound `MANUSCRIPT_CLOSE_REQUEST_CHANNEL` 1개를 참조한다. 직접 renderer bridge method와 leaf `.tsx` global bridge 접근은 모두 0건이다.
- `git diff --check`가 통과했고 신규 dependency, staged change, merge conflict는 없다. 원 승인안의 ownership·navigation·session/lifecycle·bridge/IPC·CSS·E2E 분리와 수백 줄 root 목표, fresh runtime behavior 보존 증거를 모두 충족해 R9-2와 전체 리팩토링 Gate를 완료한다.

타이틀바 음악 입력 후속:

- [x] 상단 음악 플레이어의 개별 버튼과 topbar host에 portal된 재생목록 닫기 버튼을 명시적 `no-drag` 영역으로 분리했다. 재생·목록 데이터와 다른 타이틀바 동작은 변경하지 않았다.
- focused Vitest 2개, lint, 전체 TypeScript 검사, production build가 통과했다. 재시작한 실제 Windows `이음 스튜디오` 창에서 재생목록 `X` 닫기와 첫 곡 재생 후 일시정지를 실제 마우스 입력으로 확인했다.

리팩토링 Gate R4 현재 증거:

- Resume controller가 editor activation의 capture→catalog query 순서를 함께 소유해 App과 StudioShell의 직접 bridge method 호출은 모두 0건이다. runtime/catalog callback과 swallowed failure 순서는 유지되며 project test·typecheck·lint·build는 실행하지 않았다.
- 새 Document의 document/persistence/resume 3-query, durable source·duplicate·sequence validation, queue register와 saved-state install을 PersistenceCoordinator로 이동했다. App의 직접 manuscript profile/persistence/resume method 호출은 0건이고 tab/runtime/catalog 후속 순서는 유지된다. project test·typecheck·lint·build는 실행하지 않았다.
- Pomodoro music controller가 auto-play gate, cursor 기준 resolved current scene, selected/current queue 조회, scene/music reconcile과 no-selection no-op 재생을 소유한다. App의 직접 `listSceneProjection` 호출은 0건이며 순서는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Workspace close controller가 close listener, queue/document snapshot, continuous-reading→layout→focus wait, owned WritingSession stop, resume capture와 ack client를 조립한다. App의 직접 close listener/activity stop/ack method 호출은 0건이고 기존 coordinator 순서는 유지된다. project test·typecheck·lint·build는 실행하지 않았다.
- Startup recovery controller가 recovery-pending/applyAvailable gate, active Document preference, apply command, runtime reload/install과 applying/idle/failed 전이를 소유한다. App의 직접 recovery apply method 호출은 0건이며 project test·typecheck·lint·build는 실행하지 않았다.
- Resume checkpoint controller가 unavailable short-circuit, editor state/selection validation, resolved exact-identity no-op과 capture payload를 소유한다. App의 직접 `captureResume` method 호출은 0건이고 오류 문자열·timing은 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- UI preferences controller가 theme/focus initial legacy localStorage, revision-zero seed, serialized compatibility mirror, serialized revision save chain, restore와 body theme class를 소유한다. StudioShell의 직접 settings method 호출은 0건이고 key/default/order는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- LibraryController가 catalog/favorites/covers initial·manual load, Work 일정 요약, resume, home/workspace 전환, 생성·이름 변경·삭제·회차 이동·표지·완료 revision·dialog gate를 소유한다. StudioShell의 workspace/schedule 직접 method 호출은 0건이고 옮긴 한국어 문구 12개는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Backup/migration controller가 initial·manual backup status, prepareForMain-before-create/rehearsal, create/restore summary, import rehearsal와 두 dialog gate를 소유한다. StudioShell의 backup/migration 직접 method 호출은 0건이고 옮긴 한국어 오류 문자열 4개는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Studio settings controller가 initial YouTube status, dialog visibility, six-query app/Work music/OAuth load, revision-checked settings/music/API-key save·remove, OAuth login과 schedule revision을 소유한다. StudioShell의 해당 direct client 호출과 raw setter는 0건이고 옮긴 한국어 오류 문자열 4개는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Durable queue document/revision/sequence validation, batching policy, saveChangeBatch/saveFormatting, catalog install, scene refresh trigger, scheduler, batch identity와 초기/변경 save state를 PersistenceCoordinator hook으로 이동했다. App의 직접 saveDocumentChange/saveFormatting 호출은 0건이며 project test·typecheck·lint·build는 실행하지 않았다.
- Document completion controller가 animation-frame→flushForClose→durable revision→complete, clear-completion, catalog/schedule refresh와 완료 revision 열기를 소유한다. App의 complete/clear 직접 bridge 호출은 0건이고 옮긴 한국어 오류 문자열 3개는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Per-Document `ManuscriptSaveState` map과 setter를 기존 `usePersistenceCoordinator`가 소유하도록 이동하고 queue reset/install/onStateChange와 표시 label은 바꾸지 않았다. App의 독립 save-state hook은 0건이며 project test·typecheck·lint·build는 실행하지 않았다.
- Workspace layout controller가 wide/narrow rail projection, rail open/toggle, review inspector tab, event rail mode와 active manuscript cursor position을 소유한다. 기존 ResizeObserver와 transaction/activation timing은 App 조정부에 유지하고 raw layout setter는 0건이다. project test·typecheck·lint·build는 실행하지 않았다.
- Manuscript search controller가 query, Work-scoped result, sequence ref, edit-only result invalidation과 activation/command clear를 소유한다. materialization은 검색 실행 순간의 injected reader에서만 수행되고 App의 search state/ref setter는 0건이다. project test·typecheck·lint·build는 실행하지 않았다.
- Workspace navigation controller가 Work section, structure/review tab, return location, records clock와 Work-switch reset을 소유한다. Character/Plot 준비 await 뒤 전환, Candidate refresh/capture 병렬 호출, focus exit와 records timestamp 순서를 유지하고 App의 navigation raw setter는 0건이다. project test·typecheck·lint·build는 실행하지 않았다.
- Manuscript focus controller가 활성 상태, 원고 폭, 글자 배율, 현재 문단 강조, 커서 따라가기 위치와 preference callback을 소유한다. 제품 소유 `eum_manuscript_focus_cursor_viewport_percent` key, 기본값·clamp·callback timing을 유지하고 shortcut의 overlay/forward-writing guard는 App에 그대로 남겼다. App의 manuscript-focus raw setter는 editor-tools port mapping을 제외하고 0건이며 project test·typecheck·lint·build는 실행하지 않았다.
- Work-structure state controller가 dialog open/close, opening gate, 오류와 same/visible/cross-document 결과 전이를 소유한다. 실제 대상 확인·tab policy·resume capture와 범위 열기는 기존 `DocumentNavigator` 경계에 그대로 있고 App의 work-structure raw setter는 0건이다. project test·typecheck·lint·build는 실행하지 않았다.
- Lore cue controller가 current-document hover/pin, inspector close, exact occurrence selection과 resume capture를 소유한다. App의 cue raw setter는 0건이고 옮긴 한국어 오류 문자열 2개는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Lore–Foreshadow link controller가 공유 projection, Lore load/clear/prune port, Foreshadow refresh/prune port와 revision-checked link/unlink 순서를 소유한다. App의 link state setter와 직접 list/link/unlink method 호출은 0건이고 옮긴 한국어 오류 문자열 4개는 이전 원문과 일치한다. project test·typecheck·lint·build는 실행하지 않았다.
- Plot workspace controller가 dialog/selection/gate/error, active selection projection, CRUD, 출처 exact selection, board 이동·이야기 시간과 양방향 event link wrapper를 소유한다. App에는 `DocumentNavigator` 기반 source open 조정만 남고 plot raw setter와 직접 plot mutation wrapper는 0건이다. 옮긴 한국어 문자열 15개는 이전 App 원문과 일치하며 project test·typecheck·lint·build는 실행하지 않았다.
- Scene workspace controller가 장면 경계/병합, 규칙·사건 override, exact-selection 추출·권한·Candidate 결정, 초안 생성·편집·stale 확인·삽입과 boundary preview projection을 소유한다. App에는 `DocumentNavigator` 기반 focus/preview/compare 조정만 남고 scene raw setter와 해당 직접 bridge 명령은 0건이다. 옮긴 한국어 문자열 30개는 이전 App 원문과 일치하며 project test·typecheck·lint·build는 실행하지 않았다.
- Event workspace controller가 selection/anchorless dialog, move, source link·replace·retire와 plot mutation 뒤 event refresh를 소유한다. App의 사건 state setter와 중복 wrapper는 0건이며, 옮긴 한국어 오류 문자열 10개는 이전 App 원문과 일치한다. 사용자의 중단 지시에 따라 project test·typecheck·lint·build는 실행하지 않았다.

- FragmentsController의 pure ordering/partial-success 검증 9개와 기존 fragment/dialog/bridge/runtime/navigation 집중 6개 파일·185개 검증이 통과했다.
- fresh `npm run check`가 lint, 네 TypeScript project, Vitest 241개 파일·861개 검증 통과·기존 1개 skip과 production build를 통과했다.
- production Electron에서 exact selection 조각 복사, 다른 회차 exact source 열기, 선택을 조각으로 이동한 뒤 cursor 삽입 3개 흐름이 모두 통과했다.
- ForeshadowController의 moved/retained hash, focused ESLint, 기존 계약·dialog·bridge·runtime·navigation 집중 8개 파일·189개 검증이 통과했다.
- fresh `npm run check`가 Vitest 243개 파일·870개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 line 재시작·Lore 양방향 연결·exact point/payoff·다른 회차 source 4개 흐름이 모두 통과했다.
- LoreController의 canonical/Candidate atomic load·approval·retire helper 9개와 기존 계약·dialog·cue·bridge·runtime·navigation 집중 11개 파일·194개 검증이 통과했다.
- fresh `npm run check`가 Vitest 244개 파일·879개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 canonical history·양방향 link·Candidate 비정규 원본/승인·다른 회차 Candidate 근거·확정 cue 5개 흐름이 모두 통과했다.
- CharactersController의 five-way load·relation/evidence·extraction/generation helper 9개와 기존 계약·workspace·dialog·inspiration·bridge·runtime·navigation 집중 11개 파일·195개 검증이 통과했다.
- fresh `npm run check`가 Vitest 245개 파일·888개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 인물 재시작·다른 회차 exact evidence·로컬 영감/GPT 분리 3개 흐름이 모두 통과했다.
- StructureController projection kernel의 race/asymmetric failure/music/refresh/reconcile 9개와 기존 구조·플롯·장면·음악·rail·bridge·runtime·navigation 집중 19개 파일·215개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·897개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 plot/event·전역 rail·exact plot source·scene preview/draft·우클릭 scene 6개 흐름이 모두 통과했다.
- 사건 mutation kernel의 여섯 payload·persist/command/refresh·short-circuit 검증 12개와 기존 계약·rail·dialog·bridge·runtime 집중 9개 파일·176개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·900개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 anchorless source lifecycle·exact-selection 생성·전역 rail navigation 3개 흐름이 모두 통과했다.
- PlotThread CRUD의 exact payload·private reconcile·swallowed refresh 검증 16개와 기존 plot/event/rail/dialog/bridge/runtime 집중 8개 파일·187개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·904개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 작품 소유 플롯 재시작과 bidirectional plot/event link 2개 흐름이 모두 통과했다.
- Plot source의 null/exact previous ID·directional selection·persist short-circuit 검증 19개와 기존 source/overview/dialog/bridge/runtime/navigation 집중 9개 파일·206개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·907개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron exact source replacement와 Work-structure source navigation이 통과했다.
- placement/story-time의 exact payload·optional neighbor omission·unsnapped decimal/null·authoritative board→selection→swallowed refresh 순서 검증 23개와 기존 board/plot/rail/dialog/bridge/runtime 집중 8개 파일·195개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·911개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron 기본 board 이동·재실행 흐름이 통과했다.
- drag와 story-time production Electron 검증은 제품 명령 전 단계에서 기존 non-exact `플롯 보드` region locator가 `플롯 보드 작업면`까지 함께 잡아 같은 strict-mode 오류로 중단됐다. 제품 동작은 바꾸지 않고 두 흐름의 initial·restart 네 locator만 정확 일치로 좁혀 실제 흐름 검증을 이어갔다.
- drag/story-time의 initial·restart 네 locator만 exact accessible-name으로 좁힌 뒤 story-time 재시작 흐름은 통과했다. drag는 active preview·삽입선까지 도달했지만, 현재 embedded 가로형 플롯 목록에 세로 overflow가 있다는 전제 없이 `scrollTop > 0`을 요구하는 기존 fixture에서 중단됐다.
- `PlotManagerDialog.tsx`는 HEAD와 62,702 bytes·SHA-256 `B3C56B11AE4D994B46BAE1B5B2286C203790A3416B3744A7629F855DC1EF1E90`로 같고, ordered split CSS의 정규화 SHA-256도 HEAD와 `BC33421F17F19541F85751B86C27105F19B8BE65D74AB570D4E298529FEE579E`로 일치한다. 이 pre-existing overflow fixture 간극은 제품 레이아웃을 바꾸지 않고 Stage 7 E2E 정비 범위에 남겼다.
- plot-to-event selected/anchorless와 manual link/unlink의 exact payload·persist/command short-circuit·mutation→translated refresh 검증 27개와 기존 계약·rail·dialog·bridge·runtime 집중 10개 파일·202개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·915개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron 양방향 plot/event link·unlink·재시작 흐름이 통과했다. App의 남은 직접 plots method는 createFromEvent와 getDefaultBoard 두 개뿐이다.
- createPlotFromEvent의 command→mutation reconcile→병렬 default board/raw refresh→board→selection→plots tab과 command/raw-refresh/board-query partial failure 검증 31개, 기존 계약·rail·dialog·bridge·runtime 집중 11개 파일·212개 검증이 통과했다.
- fresh `npm run check`가 Vitest 246개 파일·919개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron 양방향 plot/event와 기본 board 이동·재시작 2개 흐름이 통과했다. App의 직접 plots method 호출은 0개이고 `plotsClient` 주입만 남았으며, public plot reconciler 두 개도 controller 내부로 수렴했다.
- MusicController의 delayed reset·A→B 보존·silent failure·profile one-shot·즉시 단조 nonce·불변 queue request·settings-only reconcile 검증 6개와 기존 음악 계약·player/library·bridge/runtime/platform 집중 15개 파일·188개 검증이 통과했다.
- fresh `npm run check`가 Vitest 247개 파일·925개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron에서 YouTube 연결/작품 설정·전체 queue 재생·150% 한 줄 player·YouTube/linked/managed MP3·MP4 혼합 4개 흐름이 모두 통과했다. transport·queue 저장·장면 음악·Pomodoro는 App에 남고 Pomodoro block hash가 원본과 일치한다.
- Activity loader의 네 query 순서·exact payload·tuple identity·all-settle pending·single rejection atomic failure 검증 4개와 기존 활동 계약·bridge/runtime 집중 169개 검증이 통과했다.
- fresh `npm run check`가 Vitest 248개 파일·929개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron Pomodoro·집필 기록·작품 목표·회차 읽기 시간 4개 흐름이 모두 통과했다. App의 delayed reset·disposed guard·atomic install/failure·6개 mutation refresh는 원본과 일치한다.
- AssistantController의 frozen full-history·optimistic user·functional response append·raw/fallback error·failure retention·state gate·error clear 검증 5개와 기존 dialog·contract·platform·bridge 집중 77개 검증이 통과했다.
- fresh `npm run check`가 Vitest 249개 파일·934개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron local inspiration/GPT separation 흐름이 통과했다. App의 직접 runChat은 0개이고 dialog visibility·OAuth·context·connections·permissions·navigation과 외부 파일 hash는 유지된다.
- RuntimeBootstrapController의 11-query 순서·exact mapping/freeze·same rejection·반복/동시 load 무-cache 검증 4개와 기존 bridge/runtime 집중 157개 검증이 통과했다. 두 feature ownership 테스트는 App 직접 profile 호출 가정 대신 RuntimeBootstrap 소유와 stable App instance를 확인하도록 정확히 수정했다.
- fresh `npm run check`가 Vitest 250개 파일·938개 검증 통과·기존 1개 skip과 production build를 통과했고, production Electron 최초 작품 생성·명시적 startup recovery·published manuscript cursor replay 3개 흐름이 모두 통과했다. App에는 legacy queryRuntimeProjection이 0개, controller.load가 6개, stable instance가 1개다.
- SerialPersistenceLane의 microtask start·non-overlap·raw pending failure·swallowed tail-only continuation 검증 4개와 continuous-reading/durable/bridge 집중 90개 검증이 통과했고, T108 fresh `npm run check`는 Vitest 251개 파일·942개 검증 통과·기존 1개 skip과 production build를 통과했다.
- graceful-close의 오래된 exact-one journal 가정은 valid frame 1개 이상·exact ownership/base revision·연속 sequence·all-frame replay로 정정했다. direct production Electron continuous-reading 재시작과 graceful close 2개 흐름, lint, Electron/renderer build가 통과했다. 이후 fresh renderer `tsc` 한 번은 진단 없이 약 32GB로 runaway되어 중단했으며, 추가 App 축소 뒤 full check 재실행 대상으로 남겼다.
- Work-layout serialization은 같은 `SerialPersistenceLane`의 두 번째 stable instance와 swallowed tail 전용 `waitForSettled`로 이동했다. focused 82개 검증, lint, direct Electron/renderer build와 production Electron layout·reading·graceful-close 3개 흐름이 통과했다.
- 정확한 count는 lane 2개·enqueue 2개·continuous pending wait 3개·layout pending 1개·layout settled 1개이며, layout cache/load/change sequence/revision/optimistic rollback과 close 순서, 모든 외부 hash가 유지된다. renderer full tsc는 앞선 resource 경계에 따라 후속 App 축소 뒤 재실행한다.
- one-method `RegularPersistenceQueuePort`와 pure `persistDocumentRegularly`가 regular flush→resume capture만 소유한다. focused 92개 검증, lint, direct build와 production Electron regular switch·IME-deferred switch·graceful close 3개 흐름이 통과했다.
- queue identity/install, record/format/composition, revision/register, strict flushForClose, close/switch lifecycle은 App에 남고 pre-change App와 queue/IME/close/switch block 10개, durable/resume/bridge/E2E hash가 일치한다.
- WorkspaceSession selector는 null·exact/dangling Work·exact/null/dangling Document·cross-Work independent selection·identity/freeze를 검증하며, focused 38개 검증과 lint/test typecheck/direct build가 통과했다.
- production Electron 최초 작품 재시작·Ctrl+K Work 전환·회차 트리 전환 3개 흐름이 통과했다. 회차 트리의 두 stale raw-title locator는 completion-aware `.document-tree-open`과 UUID title filter로 정정했으며, RuntimeState·activeWorkDocuments·tabs·Navigator·installed editor·lifecycle은 App에 유지된다.
- DocumentNavigator workspace snapshot의 null/raw dangling Work ID/exact active Document/cross-Work identity/documents-array identity를 검증하는 focused 40개 검증, lint/test typecheck/direct build가 통과했다.
- production Electron mounted editor·Work switch·document-tree 3개 흐름이 통과했다. factory call은 initial ref와 sync effect 두 곳뿐이며 mutable ref/effect·installed editor·tab state·Navigator ports·lifecycle과 외부 hash는 유지된다.
- open Document ID selector는 existing `projectDocumentTabs`에 그대로 위임하며 focused 30개 검증, lint/test typecheck/direct build가 통과했다. Work switch와 document-tree production Electron 흐름도 통과했다.
- cross-episode scene preview의 6,614자 단일 `pressSequentially` setup은 같은 문단·줄바꿈·문자 순서를 보존한 72개 paragraph 단위 호출로 바꿨다. 이 변경 직후 사용자가 `테스트 그만해`라고 명시했으므로 이후 project test·typecheck·lint·build·Electron E2E 실행을 중단하고, 남은 구현은 source 범위 확인만으로 진행한다.
- installed editor identity의 frozen exact Work/Document 생성과 null-false equality만 Store helper로 이동했다. App은 ref assignment→notify 순서, telemetry·resume·reveal 실행·Navigator editorDocument·tabs·lifecycle을 계속 소유한다. 사용자 지시에 따라 이 slice부터 source/diff inspection 외 검증 명령은 실행하지 않았다.
- `openWorkspaceSessionDocumentTab`은 existing `openDocumentTab`에 그대로 위임하며 App의 11개 호출을 exact input/call timing 그대로 치환했다. App 직접 openDocumentTab 호출은 0개이고 mutable state/setter·close·switch·Navigator·durable·IME·UI는 유지된다. 테스트 명령은 실행하지 않았다.
- `closeWorkspaceSessionDocumentTab`은 existing `closeDocumentTab`에 그대로 위임하며 App 한 곳을 치환했다. closed-false, same-active 즉시 commit, 다른 active activation 성공 뒤 commit, 실패 시 prior session 유지 순서는 App에 남는다. 테스트 명령은 실행하지 않았다.
- `planWorkspaceLocationActivation`은 current active Document의 exact object lookup과 same Work+Document target 판단만 소유한다. App은 runtime gate·same-target callback·persist→bridge→ownership→search/runtime/catalog→catch/finally를 계속 소유한다. 테스트 명령은 실행하지 않았다.
- `selectActivatedWorkspaceLocationOwnership`은 Work를 먼저 찾고 없으면 Document lookup 없이 종료하며, 성공 시 exact Work/Document identity를 frozen outer result로 반환한다. App은 두 기존 오류 조건·문구와 search/runtime/catalog/catch/finally 순서를 유지한다. 테스트 명령은 실행하지 않았다.
- `createSuccessfulWorkspaceActivationRuntimeProjection`은 성공 catalog identity와 selected Document ID/null patch만 frozen 생성하며, App의 ready-gated setRuntime·search reset·catalog callback·catch/finally는 유지한다. 테스트 명령은 실행하지 않았다.
- `activateWorkspaceLocationThroughPorts`가 runtime-ready/same-target/action gate·persist→bridge→ownership validation→search reset→runtime/catalog callback→catch/finally 전체 순서를 소유한다. App callback은 injected client와 state ports만 조립하며 mutable 상태는 App에 남는다. 테스트 명령은 실행하지 않았다.
- `prepareWorkspaceForMainThroughPorts`가 current Document save→resume preview→catalog refresh→runtime install→catalog callback 순서를 소유한다. 이어 `WorkspaceController`를 도입해 StudioShell의 component ref 호출을 제거했고, Workspace가 기존 명령 ports를 stable service에 설치한다. 테스트 명령은 실행하지 않았다.
- window close participant 순서는 coordinator ports로 이동했고 queue/session/resume 구현과 refs는 App에 남았다. `useWorkspaceSession`, `useWorkspaceLifecycle`, `usePersistenceCoordinator`, `StudioRoot`, `WorkspaceRoot`, stable `WorkspaceController`를 추가했다. 사용자 지시에 따라 테스트 명령은 실행하지 않았다.
- fragments 채널 상수·타입·parser factory, preload feature factory, desktop registrar를 분리했다. `window.eumStudio.fragments`와 채널 문자열, profile read 및 mutating sender 검증 의미는 유지한다. 테스트 명령은 실행하지 않았다.

이전 현재 Gate: `음악 Gate 14 — YouTube·로컬 파일 통합 미디어 플레이어 완료`

음악 Gate 14 현재 상태:

- [x] YouTube 영상과 Work 소유 로컬 MP3·MP4를 하나의 `MusicTrackProjection`·즐겨찾기·순서 있는 재생목록에서 함께 다룬다. 기존 `favoriteVideos`·`playlistVideos` JSON은 읽을 때 새 통합 필드로 무손실 변환한다.
- [x] 미디어 등록은 `원본 위치 연결`을 기본으로 표시하고 `앱에 가져오기`를 함께 제공한다. 여러 MP3·MP4를 한 번에 선택하며 관리형 파일은 `local-media-library-v1` 아래 별도 파일로 복사한다.
- [x] 로컬 절대 경로는 renderer·typed bridge·Work settings projection에 넣지 않는다. main process descriptor가 opaque Work/media ID를 실제 위치로 해석하고 `eum-media://`가 GET·HEAD와 단일 byte range `206`을 스트리밍한다.
- [x] 기존 YouTube IFrame player와 HTML media element를 하나의 큐에서 전환한다. 진행 위치·셔플·이전/재생/다음·반복·정지·음량·영상 표시·큐 위치를 상단 한 줄 플레이어에 연결했다.
- [x] 선곡 창을 `내 미디어 | 재생목록 | YouTube 검색 | 즐겨찾기` 2×2 라이브러리로 재구성하고 Starlight 테마 토큰과 좁은 화면 단일 열을 유지했다.
- [x] 설정 창에서 YouTube 연결과 작품 음악 revision을 저장한 직후에도 App이 authoritative Work 음악 설정을 다시 읽어 로컬 등록 revision 충돌을 만들지 않는다.

음악 Gate 14 현재 증거:

- 승인 설계 manifest SHA-256 11/11 일치를 확인했다. 기존 SQLite schema와 migration, 장면 큐 Candidate 원장은 변경하지 않았다.
- `npm run lint`, `npm run build`, 음악 계약·main 전용 descriptor·range streaming·typed bridge·기존 local workspace runtime·renderer 집중 9개 파일 171개 검증이 통과했다.
- production Electron에서 960 CSS px 상단 플레이어와 `목록` 진입점이 한 줄에 유지됐다.
- production Electron에서 loopback YouTube 검색 결과, 원본 위치 MP3, 앱에 가져온 MP4를 한 큐에 저장했다. MP3·MP4 실제 `play` 이벤트, 각각 `audio/mpeg`·`video/mp4` range `206`, YouTube→로컬 다음 곡 전환, 관리형 파일 복사, 완전 종료·재실행 뒤 내 미디어 4건·혼합 큐 3건 복원이 통과했다.
- 검토 캡처에서 원고 작업면 높이와 기존 사건 레일을 바꾸지 않은 채 곡 정보·진행·재생 제어·음량·영상·목록이 상단에 한 줄로 표시되고, 라이브러리 등록/검색/목록/즐겨찾기 위계가 분리된 것을 확인했다. 임시 캡처 파일은 제거했다.
- 관리형 미디어의 기존 BackupArchive 포함 범위는 이번 Gate에서 확장하지 않았다.

이전 현재 Gate: `회차 완료 조건부 승인 후속 — 병합 전 P0·P1 수정과 패키징 앱 검증 완료`

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
- [x] 원고를 가리지 않는 원고 집중 화면 진입·이탈과 키보드 흐름
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
