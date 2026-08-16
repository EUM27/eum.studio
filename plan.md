# 이음 스튜디오 실행 상태

기준 계획: [신규 기반 POC 실행 계획](C:/Users/limoj/Documents/Codex/2026-07-15/new-chat-2/eum-implementation-foundation-2026-07-20/08-foundation-poc-execution-plan.md)

현재 저장 계약: [POC-2 저장 문자열과 ChangeBatch v1](docs/poc-2-durable-change-batch.md)

현재 journal 계약: [POC-2 append-only journal framing](docs/poc-2-journal.md)

현재 storage 결정: [POC-3 SQLite·blob·backup 결정](docs/poc-3-storage-decisions.md)

마지막 갱신: 2026-08-12

## 현재 Gate

`POC-3 — SQLite·불변 blob·백업` 완료

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

다음 Gate: `POC-M — 현행 데이터 이주 rehearsal`

실사용 원고 저장: `GO`

POC-3 완료: `GO`

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
