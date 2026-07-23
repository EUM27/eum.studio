# 이음 스튜디오

장편 집필, 구조 점검, 기록·복구, 투고 이후 운영을 하나의 로컬 우선 작업실로 연결하는 새 데스크톱 제품이다.

## 현재 상태

`POC-1 — 장편 편집기` 완료

Gate 0의 Electron main·sandbox preload·React renderer 셸 위에 manifest 기반 장편 fixture, Work·Document 소유 경계, 불변 revision, atomic ResumeCheckpoint capture, Anchor 생성·복원·손상 계약과 실제 CodeMirror 원고 편집 표면을 구현했다. checkpoint와 Work 포인터는 한 transaction에서 함께 바뀌며, 작품 밖 데이터나 다른 checkpoint로 fallback하지 않는다. Anchor는 사용자가 지정한 정확한 범위를 현재 문서·revision과 함께 검증한다. 정확한 근거가 하나뿐일 때만 복원하고, 모호하면 `needsReview`, 사라졌으면 `broken`으로 남겨 임의 위치로 이동하지 않는다.

편집 표면은 문서별 `EditorState`·selection·스크롤·undo 이력을 독립적으로 보관한다. 한글 IME 조합, runtime profile 기반 괄호·따옴표·가운뎃 말줄임표 `⋯`, 정확한 선택 좌표, grapheme 기반 공백 포함·제외 통계를 실제 Electron에서 검증했다. 상시 transaction은 선택 원문을 복사하지 않으며, 문자 통계 구독 알림은 원고 snapshot 갱신 뒤 microtask로 분리해 입력 임계 경로에서 보조 React 렌더를 제거했다.

원고 중심 화면에는 Work별로 독립적인 좌우 레일, 활성 Work 안에서만 동작하는 최신 원고 검색, 항상 보이는 작품·문서·저장·집중 기록 상태가 있다. 검색은 상시 입력 경로에서 원고를 복사하지 않고 사용자가 실행한 순간에만 문서별 현재 상태를 읽는다. 2작품·작품별 500문서·1,000,000자 fixture의 production Electron 측정에서 문서 전환 p95 30.489ms, 작품 검색 p95 3.700ms, 입력 p95 15.400ms를 기록했고 120회 전환의 소유권 위반·검색 불일치·입력 불일치는 모두 0건이었다. 영속 저장과 강제 종료 복구는 아직 연결하지 않았으며 다음 Gate에서 검증한다. 이 저장소는 현행 `D:\eum.editor`의 연장선이나 복사본이 아니며, 승인된 제품 헌법과 POC 계획에서 새로 구축한다.

## 경계

- 제품 표시명: `이음 스튜디오`
- 프로젝트 식별 경로: `D:\eum.studio`
- 현행 앱: `D:\eum.editor` — 읽기 전용 이주 원본
- 제품 코드의 첫 목표: 장편 편집·정확한 복귀·영속화·백업 폐회로
- 외부 서비스: 없어도 핵심 집필 기능이 동작해야 함

## 기준 문서

- [설계 기준 manifest](docs/design-baseline.md)
- [Gate 0 런타임 결정과 검증](docs/gate-0-runtime.md)
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

## 아직 하지 않는 것

- 현행 앱 코드 복사
- UI 전체 구현
- 제공자·모델·분류·경로의 고정
- SQLite 드라이버 선결정
- OAuth client 설정 내장
- 실제 사용자 데이터 쓰기

다음 Gate는 `POC-2 — 영속화·강제 종료`다. 저장소·별빛·음악·조수·투고 기능을 먼저 얹지 않는다.
