# f8215a5 리뷰 보완 최종 확인

2026-09-05, `D:\eum.studio`의 `codex/complete-studio-workflows`에서 사용자 리뷰 8개 항목을 구현하고 현재 소스와 별도 Windows 후보로 검증했다. 시작 HEAD는 `f8215a5bcb8fdab7f2970583fad3122a4382f020`, 작업 트리는 clean이었다. 현재 HEAD도 같고 수정 사항은 미커밋 상태다. 커밋·푸시·원격 Actions 실행·기본 설치본 교체는 하지 않았다.

검증한 현재 코드 지문은 **`efbb9772ed6b1cc9ef1983309f69999c3f2ad18f8a1232b7d60eb7283e8f69a4`**다. Git tracked/untracked의 실제 코드 파일 1,235개를 대상으로 하며, 명시된 생성물·복구 원본·goal 관리 자료는 제외한다. core 시작/종료, heavy 시작/종료, 추가 패키지 E2E 이후의 코드 지문이 모두 일치했다. 단순히 기준 커밋만 검사했다는 뜻이 아니다.

| 검토 항목 | 실제 변경과 연결 | 완료 근거 |
|---|---|---|
| TXT 실패 보존 | [내보내기 adapter](../../../../src/platform/export/node-manuscript-text-export.ts)가 같은 디렉터리의 exclusive staging에 write·sync·바이트 검증 후 rename한다. 기존 최종 파일을 먼저 열거나 비우지 않는다. | 쓰기·sync·검증·교체 실패 및 별도 Windows 프로세스의 delete-sharing 잠금에서 기존 TXT 바이트 유지. 전체 단위 검사와 실제 선택 TXT 다운로드 통과. |
| 선택 회차만 읽기 | [controller](../../../../src/renderer/features/editor-tools/useEditorToolsController.ts)가 전체 metadata 검증 후 선택 회차만 원래 순서로 materialize한다. 결합 함수도 같은 선택 검증을 사용한다. | 실제 controller callback에서 미선택 본문 읽기 0회, 잘못된 선택에서 전체 읽기 0회. source/packaged 선택 다운로드 통과. |
| 미디어와 원고 백업 분리 | [backup service](../../../../src/desktop/local-workspace-backup-service.ts), typed IPC와 UI가 `complete`와 `manuscript-only`를 구분한다. 후자는 별도 manifest identity를 사용하며 미디어 미포함을 표시한다. | 외부/관리 파일 변조·관리 파일 누락에서 완전 백업 거부. 명시적 원고 백업 생성·빈 위치 복원·원고 재열기 통과. 기존 완전 미디어 복원·재연결도 통과. |
| 늦은 장면 분석 격리 | [automatic controller](../../../../src/renderer/features/analysis/useAutomaticSceneAnalysisController.ts)가 작품·세대·요청 identity를 확인하고 전환/해제 때 대기 작업을 무효화한다. 늦은 refresh도 차단한다. | 실제 hook의 늦은 성공/실패·A→B→A·대기 작업 회귀. 패키지에서 지연 실패/로그인 요구 후 B 상태 불변, 정상 통합 분석과 승인·재시작 통과. |
| HTTP 수명 제어 | [lifecycle 계약](../../../../src/application/assistant/assistant-request-lifecycle.ts)에서 [HTTP adapter](../../../../src/platform/assistant/structured-json-http-connector.ts), main registry, authorized IPC, preload, UI까지 취소와 정책을 연결했다. | 취소·시간 초과·서버/형식 오류·chunked 응답 상한과 명시적 재시도 E2E 통과. 취소된 늦은 응답의 Candidate 저장 없음. 기본 manifest는 120,000ms/4,194,304 bytes이며 코드 상수 제한이 아니다. OAuth transport 변경을 주장하지 않는다. |
| 런타임 책임 분리 | [public 진입점](../../../../src/desktop/local-workspace-runtime.ts) → [composition](../../../../src/desktop/workspace-runtime/composition.ts) → 24개 서비스. 한 state 소유자와 세 operation tail을 유지했다. bootstrap profile/factory도 분리했다. | 545개 메서드 누락/추가 없음, prepare 293개·transaction 경계 99개·SQL literal 271개 대조 일치. 진입점 1,145 bytes, bootstrap 78,376 bytes. 651개 production TS/JS 파일을 구조 검사하며 실행 의존 순환/위반 0. |
| 필수 검증 자동화 | [검증 실행기](../../../../scripts/run-verification.mjs), [core 목록](../../../../playwright.core.config.ts), Windows push/PR와 별도 수동 heavy workflow를 추가했다. `check`도 구조 검사를 포함한다. | 실제 명령·종료 코드·로그 hash·현재 파일 지문을 기록한다. core 8개 시나리오가 각각 정확히 1회 통과했는지도 검사. 실패/누락/skip/수정 후 되돌리기/경로 없는 native 이벤트 등 실행기 회귀 26개 통과. |
| 복구 자료 분리 | [복구 도구](../../../../recovery/README.md)는 유지하고 caller 입력·저장소 밖 새 경로·checksum 검증을 사용한다. 원시 자료 13개는 Git 추적에서 제외하고 재유입을 막았다. | 별도 접근 제한 보관본 17개, 1,105,362,438 bytes가 원본 hash와 일치. 실제 PowerShell 합성 복사·경로/시간/덮어쓰기 거부 9개 회귀 통과. 물리 보존 상태와 제한은 아래와 별도 receipt에 명시한다. |

최신 실행 결과:

| 명령 | 실제 결과 |
|---|---|
| `npm run verification:core` | exit 0. lint, 네 TypeScript project, Vitest 351 files/1,299 pass, architecture, production build, Electron 8/8. 09:20:03–09:26:33 KST. |
| `npm run verification:heavy -- --process-budget-ms 1800000` | exit 0. process 실패/복구 3 files/4 pass, 새 Windows candidate package, 실제 package smoke, packaged core 8/8. 09:27:07–09:31:51 KST. |
| 후보 실행 파일을 지정한 automatic-analysis/HTTP lifecycle Playwright | exit 0. 4/4 pass, skip/flaky/failure 0, 124.6초. |
| 명시적 POC-3 profile·출력·300,000ms 예산으로 `performance:poc-3` | exit 0, correctness-pass. 4,096 UTF-16 code unit fixture의 2회 반복·append 6회. append p95 13.92ms, backup p95 54.48ms, preverify/restore p95 37.37ms. 제품 제한이나 대규모 실사용 성능 보장은 아니다. |
| package 파일 재읽기 | `dist-electron`, `dist-renderer`, `config`의 830개 파일/12,897,271 bytes가 현재 build와 일치하고 패키지 E2E 이후에도 그대로다. |
| 원본/설치본 보존 재읽기 | primary archive 17개 hash·ACL, 남겨 둔 로컬 원본 12개와 별도 variant 1개 확인. 기본 설치 EXE/manifest hash 유지, 기존 PID 24336도 같은 경로에서 실행 중. |

전체 단위 검사에서 건너뛴 1개는 `EUM_STUDIO_LEGACY_SOURCE_ROOT`를 명시해야 하는 기존 실제 레거시 이주 rehearsal이다. 새 필수 Electron 8개에는 skip이나 재시도가 없다. 초기 검증 실패 결과를 최종 성공으로 바꾸지 않고 그대로 보존했다.

실제 통합 검증 중 발견한 추가 문제도 해결했다. 취소 IPC의 preload 허용 목록 누락, 큰 dirty diff에서 provenance 수집의 ENOBUFS, NTFS 접근 시간/파일명 누락 알림 및 중첩 watch의 rename 잠금, 사건 열기/해제 버튼을 함께 잡던 E2E locator를 수정했다. 기본 접힌 집중 패널이 검토 레일의 장면 추가 버튼을 가리던 문제는 기존 상태줄 배치 규칙을 재사용해 고쳤다. 사용자가 옮긴 위치는 보존되며 실제 mouse drag·저장된 좌표·클릭과 screenshot으로 확인했다. 단위/형식 검사만으로 완료 판정을 하지 않았다.

후보 위치는 `D:\eum.studio\out\eum-studio-verification-2026-09-05T00-27-07-293Z-3ae7a525-af2d-49d9-89fe-f7a1fc86b97d`다. 전체 패키지는 906 files/377,032,263 bytes다. `file://` renderer, `isPackaged: true`, typed bridge, 첫 작품 생성, renderer 복구, 두 번째 인스턴스 exit 0을 실제 실행에서 확인했다. 기본 설치본으로 승격하지 않았다.

복구 보관 위치는 `D:\Eum-Studio-Recovery-Archive\review-f8215a5-20260904T231057Z-8ff9ef1b`이며 sealed manifest SHA-256은 `0BC59096EBD6B4DFC6066C6E376353F0CD74CDE7D860F97A6EF40F0BE6C74F1D`다. 삭제 명령의 자동 승인 차단과 원본 dump의 Windows 읽기 권한 때문에 모든 로컬 사본을 물리 제거하지 않았다. 13개 자료는 index에서만 제거되어 현재 소스 관리/향후 변경에서 분리됐으며 Git 이력은 재작성하지 않았다.

이동했던 읽기용 `.bin` 사본은 move-back 검사에서 hash 차이가 발견돼 별도 보존했다. 원인을 확정하지 않았고 파일 내용을 덮어써 맞추지 않았다. 해당 파일의 원래 bytes는 primary archive와 로컬 `.dmp`에서 일치한다. primary archive 17개는 모두 최초 hash를 유지한다. 자세한 상태는 [복구 보존 기록](T005-recovery-preservation.md)에 있다.

주요 증거는 [최종 검증 index](../../../../artifacts/review-f8215a5/final-verification-index.json), [core 실행](../../../../artifacts/verification/2026-09-05T00-20-03-041Z-a03098d3-7b6f-48fe-9965-1937a9c55b49/verification.json), [heavy 실행](../../../../artifacts/verification/2026-09-05T00-27-07-293Z-3ae7a525-af2d-49d9-89fe-f7a1fc86b97d/verification.json), [추가 패키지 E2E](../../../../artifacts/review-f8215a5/packaged-lifecycle-results.json), [패키지 바이트 대조](../../../../artifacts/review-f8215a5/package-build-readback.json), [최종 보존 확인](../../../../artifacts/review-f8215a5/preservation-final.json)에 연결되어 있다.

PM 최종 판단: **full_outcome_complete: true**. 요청한 여덟 항목의 source 변경, 실제 호출 경로, 실패 회귀, 현재 bundle과 Windows candidate 실행, 원본 보존을 대조했다. 이 결과를 저장소 전체의 모든 버그 부재나 원격 CI 통과로 확대하지 않는다.
