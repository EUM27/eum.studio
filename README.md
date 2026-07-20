# 이음 스튜디오

장편 집필, 구조 점검, 기록·복구, 투고 이후 운영을 하나의 로컬 우선 작업실로 연결하는 새 데스크톱 제품이다.

## 현재 상태

`Gate 0 — 새 프로젝트·측정 계약` 완료

Electron main·sandbox preload·React renderer의 최소 진단 셸과 공통 검증 기반을 만들었다. 이 저장소는 현행 `D:\eum.editor`의 연장선이나 복사본이 아니며, 승인된 제품 헌법과 POC 계획에서 새로 구축한다.

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

`npm run start`는 production bundle을 만든 뒤 데스크톱 진단 셸을 실행한다.

## 아직 하지 않는 것

- 현행 앱 코드 복사
- UI 전체 구현
- 제공자·모델·분류·경로의 고정
- SQLite 드라이버 선결정
- OAuth client 설정 내장
- 실제 사용자 데이터 쓰기

다음 단계는 POC-1 장편 편집기다. 저장소·별빛·음악·조수·투고 기능을 먼저 얹지 않고, 정확한 선택·한글 IME·괄호와 따옴표·문서 전환·작품별 복귀·장편 성능을 검증한다.
