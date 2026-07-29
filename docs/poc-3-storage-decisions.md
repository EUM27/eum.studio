# POC-3 SQLite·blob·backup 결정

기준일: 2026-07-30

## 완료 판정

POC-3은 정규 SQLite 원장, 불변 content-addressed blob, 원자 revision·checkpoint 저장, migration, consistent backup과 새 빈 위치 restore를 같은 저장 경계에서 검증했다.

통과한 폐회로:

- 작품·문서 composite foreign key와 불변 revision·snapshot·blob manifest
- blob publish·readback 뒤 한 SQLite transaction에서 reference와 manuscript pointer commit
- Anchor·ResumeCheckpoint·`Work.resumeCheckpointId`의 한 transaction 저장
- read-only integrity·reachability report와 명시적으로 선택한 unreachable blob 정리
- checksum이 고정된 연속 migration chain과 실패 rollback
- 기준 DB snapshot과 그 snapshot이 참조하는 blob만 포함하는 backup
- bundle 전체를 먼저 검증한 뒤 새 빈 위치에만 게시하는 restore
- revision commit 전·migration commit 전·backup publish 전 실제 process 종료
- 두 실제 process와 서로 다른 두 Windows Electron browser main의 같은 기준 revision 동시 쓰기 배제
- 개발 서버 없는 Windows Electron 설치본 main process의 전체 저장 폐회로

## 결정

### SQLite driver

`node:sqlite`를 application `StorageService` 뒤의 platform adapter로 사용한다.

두 후보의 동일 contract, Electron main load, 임시 설치본 정리와 관측 성능 근거는 [driver bake-off](poc-3-driver-bake-off.md)에 기록했다. Electron·Node runtime을 바꾸면 동일 contract와 설치본 검증을 다시 실행한다.

### 운영 journal과 동기화

쓰기 가능한 사용자 DB 연결은 runtime storage profile이 `WAL`, `synchronous=FULL`, `foreign_keys=ON`을 요청하고 실제 readback으로 확인해야 한다. adapter는 이 값에 fallback하지 않으며 profile이 없거나 readback이 다르면 쓰기를 열지 않는다.

backup 내부 SQLite snapshot은 독립 파일이어야 한다. caller가 요구한 standalone journal mode로 정규화한 뒤 `-wal`, `-shm`, rollback journal이 하나라도 남으면 manifest 작성이나 bundle publish를 거부한다. 검증한 POC profile의 standalone mode는 `DELETE`이며 제품 제한이나 사용자 데이터 경로가 아니다.

### revision compaction

검증된 journal prefix에 영향을 받은 각 문서를 완전한 새 불변 `DocumentRevision`으로 만든다. revision metadata는 SQLite가, 본문은 checksum 주소의 완전한 blob이 소유한다. 같은 bytes는 같은 주소를 재사용하지만 기존 revision이나 blob을 덮어쓰지 않는다.

물리 정리는 DB snapshot 기준 reachability report 뒤 사용자가 선택한 unreachable entry만 새 fingerprint와 도달성을 재검증해 수행한다. 임시·orphan blob을 자동 retry, 자동 귀속 또는 in-place revision 변경으로 숨기지 않는다.

### blob directory layout

정규 주소는 `checksumIdentity`와 `checksumValue` 쌍이다. platform runtime profile이 blob root, 안전한 상대 directory segment, checksum shard 폭, 파일명 prefix·suffix와 별도 temporary directory segment를 소유한다.

layout mapper는 주소에서만 상대 경로를 만들며 작품·문서명, 사용자 선택명, 절대 경로를 blob identity에 넣지 않는다. publish는 같은 파일시스템의 caller temporary entry를 write·sync한 뒤 no-replace 방식으로 수행한다.

### backup bundle format

backup은 versioned directory bundle이다.

구성:

- standalone SQLite snapshot
- snapshot revision manifest가 참조하는 content·change-set blob
- counts·logical checksums·DB checksum·blob checksum·상대 entry segment를 가진 canonical manifest
- canonical manifest checksum sidecar

DB snapshot을 먼저 고정하고 그 snapshot의 reference만 inventory한다. 이후 source write, 물리 orphan과 temporary blob은 bundle에 섞지 않는다. 모든 entry를 쓰고 sync한 뒤 same-parent temporary bundle을 최종 경로로 한 번만 게시하며 기존 bundle을 덮어쓰지 않는다.

restore는 sidecar, manifest exact shape, DB integrity·foreign key·storage identity·schema, revision reachability와 모든 참조 blob checksum을 대상 생성 전에 검증한다. caller preflight가 저장 공간과 권한을 승인한 뒤 sibling staging에 blob을 먼저 쓰고 DB를 쓰며, 재검증 후 새 빈 target만 원자 게시한다. 기존 source bundle·target·사용자 DB 위 in-place restore는 하지 않는다.

### migration rollback

연속 migration chain의 SQL, verification, receipt, storage identity와 `user_version` 변경은 하나의 `BEGIN IMMEDIATE` transaction에 들어간다. 각 정의 bytes checksum과 논리적 전후 checksum이 일치해야 한다.

SQL·verification·hook 실패 또는 commit 전 process 종료는 transaction 전체를 rollback한다. 이전 schema version, 사용자 데이터, receipt·progress가 그대로이고 이전 target profile로 DB를 안전하게 다시 열 수 있어야 한다. message 문자열을 분석한 retry나 fallback은 없다.

## 실패 증거

- blob 일부 쓰기·sync·publish 실패는 DB reference를 만들지 않는다.
- DB transaction 실패는 manuscript pointer를 바꾸지 않고 검증 가능한 physical orphan만 남긴다.
- 누락·변조 blob, DB, manifest, sidecar는 preflight와 target 생성 전에 restore를 거부한다.
- 용량·권한 preflight 거부와 기존 bundle·target 경합은 source와 caller 기존 target을 바꾸지 않는다.
- 두 process 및 packaged Electron 두 앱 경합에서는 holder 한 건만 commit되고 contender는 실제 SQLite lock으로 명시 실패한다.
- process 종료 뒤 revision DB, 이전 migration DB와 backup source가 각각 다시 열린다.

## 검증 명령

각 명령의 timeout, deadline, profile과 artifact path는 caller가 제공한다. 측정 fixture 수치와 경로는 제품 기본값이나 제한이 아니다.

```powershell
npm run check
npm run test:e2e
npm run test:process:poc-3
npm run test:package:poc-3
npm run performance:poc-3
```

성능 JSON은 raw open·append·checkpoint·backup·restore·materialize 시간과 DB·reachable blob·temporary·orphan·bundle·복원 target 크기를 설명용으로 기록한다. 시간·크기 숫자로 제품 동작을 제한하거나 POC 통과 여부를 바꾸지 않는다.
