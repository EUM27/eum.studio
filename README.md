# 이음 스튜디오

장편 집필, 구조 점검, 기록·복구, 투고 이후 운영을 하나의 로컬 우선 작업실로 연결하는 새 데스크톱 제품이다.

## 현재 상태

`POC-1 — 장편 편집기` 진행 중

Gate 0의 Electron main·sandbox preload·React renderer 셸과 공통 검증 기반을 완료했다. POC-1에서는 manifest 기반 장편 fixture와 함께 Work·Document 소유 관계, application revision, atomic ResumeCheckpoint envelope capture, 불변 in-memory adapter, 실제 CodeMirror 원고 편집 표면을 구현했다. checkpoint 삽입과 `Work.resumeCheckpointId`·Work revision 갱신은 전용 application transaction에서 함께 성공하거나 함께 실패하며, 작품별 현재 checkpoint 조회는 Work 포인터만 원본으로 사용한다. 포인터가 없으면 명시적 빈 상태이고, dangling·교차 작품 포인터는 다른 checkpoint로 대체하지 않고 무결성 오류로 구분한다. 정확한 작품 복귀를 주장하기 전에는 Anchor 소유권·복원 계약을 추가로 검증한다. CodeMirror transaction은 변경 span과 selection 좌표를 renderer의 불변 payload로 추출하며 저장소나 선택 원문 사본을 직접 소유하지 않는다. 마우스와 키보드로 선택한 일부 문자는 행·문단으로 확장하지 않고 방향과 경계를 그대로 보존한다. 선택 원문은 구조 명령 실행 시점에 현재 revision과 함께 다시 검증하는 경계에서만 구체화한다. 자동 닫힘 pair와 입력 치환은 schema로 검증한 runtime profile이 소유하며 제품 코드에 고정 목록을 두지 않는다. 등록된 괄호·따옴표는 자동으로 닫히고 이미 있는 닫는 기호 입력은 중복 삽입 없이 커서만 이동하며, 등록 규칙에 따라 마침표 세 개를 가운뎃 말줄임표 `⋯` 하나로 바꾼다. 실제 Electron의 한글 IME composition 경로는 조합 중 등록형 입력 규칙을 우회하고, 확정된 한글 본문과 커서를 한 단위로 undo·redo한다. 이 저장소는 현행 `D:\eum.editor`의 연장선이나 복사본이 아니며, 승인된 제품 헌법과 POC 계획에서 새로 구축한다.

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
npm run environment:report -- --output <사용자가 선택한 출력 경로>
```

`npm run start`는 production bundle을 만든 뒤 실제 CodeMirror POC 원고 편집 표면을 실행한다.

POC input profile을 적용해 실행할 때는 사용자가 선택한 JSON profile 원문을 runtime 입력으로 전달한다.

```powershell
$env:EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE = Get-Content -Raw <사용자가 선택한 profile 경로>
npm run start
```

## 아직 하지 않는 것

- 현행 앱 코드 복사
- UI 전체 구현
- 제공자·모델·분류·경로의 고정
- SQLite 드라이버 선결정
- OAuth client 설정 내장
- 실제 사용자 데이터 쓰기

다음 검증 단위는 문서 전환 전에 잠글 문서별 `EditorState` 보관·복원 정책이다. 그 뒤 문자 통계 규칙, 정확한 Anchor 복원, 문서 전환·장편 성능을 순서대로 검증한다. 저장소·별빛·음악·조수·투고 기능을 먼저 얹지 않는다.
