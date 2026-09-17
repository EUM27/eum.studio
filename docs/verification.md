# 현재 코드 검증

`npm ci`로 lockfile의 의존성을 준비하고 `package.json`의 Node 지원 범위에서 실행한다. 검증 명령은 실제 자식 프로세스의 결과를 기록하며 자동 재시도하지 않는다. 원고와 사용자 데이터는 테스트가 만든 격리 경로에서만 다룬다.

## 일반 변경의 필수 검증

```powershell
npm run verification:core
```

실행 순서는 `lint → typecheck → test:run → architecture:check → build → test:e2e:core`다. `test:run`은 현재 Vitest 설정의 전체 단위·통합 검사를 실행한다. 기존 `npm run check`도 같은 정적·단위·구조·빌드 순서를 사용한다. `check` 자체는 Electron을 실행하지 않으므로 핵심 동작까지 검증하려면 `verification:core`를 사용한다.

핵심 Electron 목록은 [playwright.core.config.ts](../playwright.core.config.ts)의 `coreScenarios` 한 곳에서 관리한다. 파일과 정확한 테스트 제목으로 선택하며 다음 8개 흐름을 실제 production bundle에서 실행한다.

| 흐름 | 검증 대상 |
|---|---|
| 연속 입력과 재열기 | 입력한 모든 문자의 저장과 복원 |
| 첫 작품 저장과 재열기 | 실제 작업공간 생성·저장·재시작 |
| 선택 회차 TXT | 선택 회차를 실제 회차 순서로 다운로드 |
| durable receipt | typed Electron 저장 명령과 실제 기록 |
| 정상 종료 flush | 닫기 전에 미저장 원고를 durable 기록 |
| 리비전·선택 복원 | 완전 종료 뒤 원고와 정확한 선택 복원 |
| 완전 미디어 백업 | 관리 복사본·외부 참조의 백업과 빈 위치 복원 |
| 미디어 미포함 백업 | 완전 백업 거부 후 명시적 원고 백업·복원·재열기 |

실행기는 Playwright 종료 코드뿐 아니라 결과 JSON에 이 8개 시나리오가 각각 정확히 한 번 통과했는지 확인한다. 누락·skip·재시도 후 성공을 필수 검증 성공으로 인정하지 않는다. 목록만 확인하려면 `npm run test:e2e:core -- --list`를 사용한다. 이 명령과 `test:e2e:core` 단독 실행은 빌드를 갱신하지 않는다.

## 강제 종료와 Windows 후보 패키지

일반 `npm run package:win`도 이제 매번 고유한 `out/eum-studio-candidate-<UUID>` 후보를 생성한다. 이름을 명시한 경우에도 기존 파일·폴더·링크가 있으면 교체 전에 거부한다. 패키징은 기본 설치본과 이전 후보를 삭제하거나 승격하지 않는다. 같은 후보를 검증하려면 호출자가 새 이름을 선택해 두 명령에 전달한다.

```powershell
$env:EUM_STUDIO_WINDOWS_PACKAGE_DIRECTORY_NAME = 'eum-studio-candidate-' + [guid]::NewGuid().ToString('N')
npm run package:win
npm run verify:package:win
```

`verify:package:win`을 환경값 없이 직접 실행하면 기존 기본 설치 경로를 검사한다. 마지막으로 생성한 후보를 자동 추정하지 않는다.

```powershell
npm run verification:heavy -- --process-budget-ms 1800000
```

`--process-budget-ms`는 호출자가 선택하는 POC-3 프로세스 검증 예산이다. 예시의 30분은 제품 성능 제한이 아니다. 실행기는 이 단계 시작 시점에 `EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS`를 계산해 기존 테스트 계약에 전달한다. 생략·잘못된 값·Windows가 아닌 환경은 실패로 기록한다.

실행 순서는 `test:process:poc-3 → package:win → verify:package:win → test:e2e:core`다. 마지막 단계의 8개 Electron 시나리오는 방금 만든 실행 파일을 `EUM_STUDIO_E2E_EXECUTABLE_PATH`로 지정해 다시 실행한다. heavy는 일반 필수 검사를 대체하지 않으며 같은 최종 코드에서 core와 heavy 결과를 함께 확인한다.

패키지 경로는 `out/eum-studio-verification-<runId>`다. `--package-directory-name <새 디렉터리명>`으로 명시할 수도 있다. 기존 후보 디렉터리와 기본 `out/eum-studio-win-x64`는 거부한다. 후보는 자동 삭제하거나 실사용 설치로 승격하지 않는다. 실행 ID는 자동 생성되며 `--run-id <고유 ID>`로 지정할 수 있다. 이미 사용한 실행 ID는 결과를 덮어쓰지 않고 거부한다.

## 결과와 코드 지문

결과는 Git에서 무시되는 `artifacts/verification/<runId>/verification.json`과 단계별 `.log`에 저장된다. `playwright-results.json`과 실패 trace도 같은 실행 아래 보관한다. Electron 사용자 데이터와 기타 임시 실행 파일은 별도 `test-results-verification-<runId>`에 있으며 업로드 대상에 포함하지 않는다. trace는 격리된 테스트 fixture만을 대상으로 한다. 환경 전체·자격 증명·실사용 원고·복구 원본 파일을 결과에 복사하지 않는다.

JSON에는 다음 근거가 있다.

- 시작·종료 시간, Node 버전과 플랫폼, 실행한 명령과 실제 종료 코드·signal, 로그 경로와 SHA-256.
- 실행 전후 commit SHA·branch·dirty 상태와 전체 Git provenance checksum. 전체 Git provenance는 기존 공용 `tests/evidence/git-source-provenance.ts`를 사용한다.
- `codeFingerprint`: 현재 Git tracked 파일과 무시되지 않는 untracked 파일의 실제 바이트·길이·경로를 SHA-256으로 집계한다. 새 소스·테스트·설정·스크립트·manifest도 포함한다.
- 각 단계 전후 코드 지문과 commit, 실행 중 파일 변경 감시 결과. 이벤트를 받은 파일의 크기·나노초 단위 수정 시각·파일 식별자와 실제 SHA-256을 확인한다. 읽기나 접근 시각·속성만 바뀌고 나머지가 같으면 `ignoredMetadataPaths`에 기록한다. 디렉터리의 접근 메타데이터도 코드 변경으로 간주하지 않으며, 파일 목록은 단계 전후 지문에서 계속 확인한다. NTFS의 `ctime`은 접근 메타데이터로도 바뀔 수 있어 코드 쓰기 증거로 사용하지 않는다. 내용 변경·파일 생성·삭제·파일이나 디렉터리의 이름 변경·파일 교체·수정 시각 변화는 명령 종료 코드가 0이어도 실행 전체를 실패시킨다. 수정 시각이나 이름 변경 흔적이 남은 수정 후 원상 복원도 실패로 남긴다.

감시는 저장소 루트에 **비재귀 watcher**, Git 소스의 실제 최상위 하위 트리에 **재귀 watcher 하나씩**을 설치한다. `dist-*`, `out`, `node_modules` 생성물 트리는 감시 대상으로 등록하지 않는다. Windows에서 중첩 디렉터리마다 별도 감시 핸들을 열면 상위 폴더의 이름 변경이 막히므로 하위 디렉터리 상태는 추가 핸들 없이 읽어서 보관한다. 새 소스 디렉터리는 부모 알림과 Git 목록 재검사로 발견한다. 빌드·패키지·Electron 출력 루트는 감시 기준을 잡기 전에 준비하며 실제 구독 경로와 재귀 여부는 `subscriptions`에 남긴다.

Node가 이벤트의 파일명을 제공하지 않으면 알림을 버리지 않고 기존 파일의 버전·해시, 소스 디렉터리의 식별자·수정 시각, 현재 Git 파일 목록을 다시 검사한다. 이 검사가 끝나야 다음 단계로 진행하며 `pathlessEventCount`, `fullRescanCount`, `watchedDirectories`에 근거를 남긴다. 재검사에서 수정 후 원상 복원 흔적이나 경로 변경을 발견하면 실패한다. 운영체제 감시는 악의적으로 내용과 모든 메타데이터까지 함께 복원하는 행위를 증명하는 장치가 아니며, 단계 전후 전체 코드 지문 검사를 함께 유지한다. [Node의 filename 누락 계약](https://nodejs.org/docs/latest-v24.x/api/fs.html#filename-argument)

`codeFingerprint`는 전체 저장소 지문이라는 뜻이 아니다. 선언된 제외 범위는 goal 관리 자료(`docs/goals`, `.goalbuddy-board`)와 생성물(`artifacts`, `out`, 빌드 출력·테스트 출력·의존성 디렉터리 등), `recovery`의 원본 데이터다. 정확한 목록은 JSON에 기록한다. `recovery`의 보존된 스크립트·문서와 원본 자료 재유입을 막는 `recovery/.gitignore`는 코드 지문과 변경 감시에 포함한다. goal receipt 갱신은 전체 Git provenance에 남지만 유효 코드 지문을 바꾸지 않는다.

실패가 있으면 남은 명령은 실행하지 않고 보고서를 `failed`로 저장한 뒤 종료 코드 1을 반환한다. 코드를 고친 뒤 새 실행 ID로 다시 검증한다. 실행 중이거나 중단된 보고서는 성공 증거가 아니다.

## 별도 POC package·성능 명령

기존 `test:package:poc-3`는 현재 Windows 후보 검사와 다른, fixture manifest가 소유하는 POC 설치 패키지 폐회로다. 직접 실행할 때 다음 세 환경값이 필요하다.

```powershell
$env:EUM_STUDIO_POC_3_INSTALLED_PACKAGE_PROFILE_PATH = (Resolve-Path tests/fixtures/package/poc-3-installed-package.manifest.json).Path
$env:EUM_STUDIO_POC_3_INSTALLED_PACKAGE_ARTIFACT_PATH = Join-Path (Get-Location) 'artifacts/poc-3-package/caller-run.json'
$env:EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS = '1800000'
npm run test:package:poc-3
```

저장 성능 원시 측정은 별도 호출자 profile·출력 경로·시간 예산을 사용한다.

```powershell
$env:EUM_STUDIO_POC_3_PERFORMANCE_PROFILE_PATH = (Resolve-Path tests/fixtures/performance/poc-3-storage-performance.manifest.json).Path
$env:EUM_STUDIO_POC_3_PERFORMANCE_ARTIFACT_PATH = Join-Path (Get-Location) 'artifacts/poc-3-performance/caller-run.json'
$env:EUM_STUDIO_POC_3_PERFORMANCE_TEST_TIMEOUT_MS = '1800000'
npm run build
npm run performance:poc-3
```

출력은 매번 새 경로를 사용한다. 이 예시는 호출자가 실제 측정 profile과 예산을 선택한 뒤 실행하는 명령이며 core/heavy에서 자동 실행되었다는 뜻이 아니다. 두 POC의 JSON에는 해당 검사의 기존 source·fixture provenance가 기록된다. 필수 실행기는 상속된 `EUM_STUDIO_*` 값을 제거하고 해당 단계의 테스트용 값만 전달하므로 외부에 지정한 실사용 작업공간을 상속하지 않는다.

## GitHub Actions

`Required core verification`은 push와 pull request에서 Windows core를 실행한다. `Heavy Windows verification`은 수동 workflow dispatch로 별도 실행한다. 두 workflow는 `contents: read`, checkout의 `persist-credentials: false`, lockfile 설치, 지원 Node 범위를 사용하며 별도 secret을 요구하지 않는다. 업로드 대상은 검증 JSON·단계 로그·실패 trace로 제한한다.

Actions는 공식 저장소에서 2026-09-05 확인한 [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), [upload-artifact v7.0.1](https://github.com/actions/upload-artifact/releases/tag/v7.0.1)의 불변 commit SHA에 고정했다. workflow 파일을 추가하는 것과 원격 실행·branch protection 설정은 별개다. 실제 Actions 실행 기록이 생기기 전에는 CI 통과로 보고하지 않는다.
