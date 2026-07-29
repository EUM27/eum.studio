# POC-3 SQLite driver bake-off 결정

기준일: 2026-07-30

## 질문

같은 `StorageService` 경계 뒤에서 동일 fixture·SQL·PRAGMA·transaction·foreign key·backup 계약을 실제 패키지형 Electron main process에서 만족하는 드라이버는 무엇인가.

## 후보와 증거

비교 후보는 Electron 43.1.1에 내장된 `node:sqlite`와 `better-sqlite3` 13.0.2다. 비교용 fixture는 크기·SQL template·반복 횟수만 manifest가 소유한다. 작품·문서·revision 식별자와 표시 문자열은 실행 시 생성한 뒤 같은 fixture 객체를 두 후보에 전달한다.

두 후보는 다음을 모두 통과했다.

- requested PRAGMA readback
- commit·rollback
- foreign key 위반 거부
- 원장 query checksum 일치
- online backup의 integrity와 원장 checksum 일치
- 일반 Electron main process에서 load
- 임시 `resources/app` 삭제와 잔류 package process 없음

최신 동일 조건 raw sample에서 관측한 p95는 다음과 같다.

| 항목 | `node:sqlite` | `better-sqlite3` |
|---|---:|---:|
| open | 0.719 ms | 41.585 ms |
| write transaction | 1.232 ms | 1.041 ms |
| backup | 6.053 ms | 6.158 ms |

이 수치는 POC 관측값이며 제품 제한이나 사용자 데이터 기본값이 아니다.

## 결정

POC-3의 SQLite adapter는 `node:sqlite`를 사용한다.

근거:

- 고정한 Electron main runtime에서 필요한 정확성 계약과 online backup API를 실제 실행으로 검증했다.
- 별도 native addon 설치·Electron ABI rebuild·shipping dependency가 없다.
- 비교 fixture에서 transaction·backup 차이는 결정적 열위가 없고 open 비용은 더 작았다.
- 외부 후보의 정확 버전은 비교 재현을 위한 dev dependency로만 유지하며 제품 adapter 기본값으로 사용하지 않는다.

## 위험과 재검증 조건

Node 24 공식 문서는 `node:sqlite`를 stability 1.2 release candidate로 분류한다. 따라서 Electron·Node runtime을 변경할 때는 같은 contract와 installed-package probe를 다시 실행해야 한다. 내장 API가 사라지거나 계약 결과가 달라지면 쓰기를 활성화하지 않고 driver 결정을 다시 연다.

WAL·synchronous 정책, revision compaction, blob directory layout, backup bundle 형식과 migration rollback 방식은 이 bake-off만으로 확정하지 않았다. 후속 blob·backup·failure injection·설치본 결과를 포함한 최종 Gate 결정은 [POC-3 저장 결정](poc-3-storage-decisions.md)에 기록했다.
