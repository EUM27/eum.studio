# 이음 스튜디오

장편 집필, 구조 점검, 기록·복구, 투고 이후 운영을 하나의 로컬 우선 작업실로 연결하는 새 데스크톱 제품이다.

## 현재 상태

`POC-1 — 장편 편집기` 진행 중

Gate 0의 Electron main·sandbox preload·React renderer 셸과 공통 검증 기반을 완료했다. POC-1에서는 manifest 기반 장편 fixture와 함께 Work·Document 소유 관계, application revision·ResumeCheckpoint port, 불변 in-memory adapter, 실제 CodeMirror 원고 편집 표면을 구현했다. 작품별 checkpoint는 다른 작품으로 fallback하지 않으며, checkpoint가 없는 등록 작품은 명시적 빈 상태로 구분한다. CodeMirror transaction은 변경 span과 selection을 renderer의 불변 payload로 추출하며 저장소를 직접 소유하지 않는다. 마우스와 키보드로 선택한 일부 문자는 행·문단으로 확장하지 않고 방향·경계·선택 원문을 그대로 보존한다. 자동 닫힘 pair와 입력 치환은 schema로 검증한 runtime profile이 소유하며 제품 코드에 고정 목록을 두지 않는다. 등록된 괄호·따옴표는 자동으로 닫히고 이미 있는 닫는 기호 입력은 중복 삽입 없이 커서만 이동하며, 등록 규칙에 따라 마침표 세 개를 가운뎃 말줄임표 `⋯` 하나로 바꾼다. 이 저장소는 현행 `D:\eum.editor`의 연장선이나 복사본이 아니며, 승인된 제품 헌법과 POC 계획에서 새로 구축한다.

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

다음 검증 단위는 한글 IME 조합 입력과 undo·redo다. 저장소·별빛·음악·조수·투고 기능을 먼저 얹지 않고, 문서 전환·작품별 복귀·장편 성능을 순서대로 검증한다.
