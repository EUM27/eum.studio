# Gate 2 열린 연속성 검증 기록

- 검증일: 2026-08-29 (Asia/Seoul)
- 설계 SHA-256: `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5`
- 시작 schema: 18
- 결과 schema: 19
- 18→19 migration definition SHA-256: `d653b477fea88adab8fa4e9b3db17012b5641c047cd660b1a683973775205f48`

## 실제 구현 폐회로

1. exact 원고 selection을 현재 `DocumentRevision`으로 저장한다.
2. 수동 경로는 `ContinuityThread`와 exact Anchor, opened evidence, created history를 한 transaction에 기록한다.
3. AI 경로는 `continuity.review` 권한과 `AssistantContextReceipt` 뒤 exact paragraph와 Work-local typed reference만 connector에 전달한다.
4. strict model payload를 exact quote로 해석한 결과는 `ContinuityReviewCandidate`로만 저장한다.
5. 사용자는 Candidate의 종류·제목·메모·subject를 편집하고 현재 열린 중복 후보를 명시적으로 확인한 뒤 승인하거나 거절한다.
6. 승인은 새 Thread·Anchor·evidence·history·decision을 한 transaction에 기록한다. 자동 병합은 없다.
7. 기존 `PlotThread`, `ForeshadowLine`, `Character.goal`은 별도 Thread로 복제하지 않고 읽기 전용 source badge projection으로 표시한다.
8. resolve는 `expectedRevision`과 `manual | evidence`를 구분하고, dismiss와 함께 불변 history를 남긴다.

## Fresh 명령과 결과

| 명령 | 결과 |
|---|---|
| `npm run test:run -- src/application/continuity src/desktop/continuity/local-continuity-runtime.test.ts` | PASS — 5 files, 19 tests |
| `npm run test:run -- src/desktop/continuity/local-continuity-runtime.test.ts src/desktop/local-workspace-runtime.test.ts` | PASS — 2 files, 97 tests |
| `npm run test:run -- src/application/contracts src/platform/assistant src/desktop/continuity` | PASS — 8 files, 84 tests |
| `npm run test:run -- src/renderer/features/continuity src/renderer/canon src/renderer/editor src/renderer/workspace/navigation` | PASS — 39 files, 109 tests |
| migration·ledger·window policy·bridge·connector 집중 5파일 | PASS — 11 tests |
| `npm run test:process:continuity` | PASS — 1 file, 1 test |
| `npm run performance:continuity` | PASS — 1 file, 1 test |
| `npm run test:e2e -- tests/e2e/continuity.spec.ts` | PASS — production build + Electron 1 test |
| `npm run typecheck` | PASS — renderer/electron/preload/test 4 projects |
| `npm run lint` | PASS |
| `npm run architecture:check` | PASS |
| `git diff --check` | PASS |
| `npm run test:run` | 279 files PASS, 1,069 tests PASS, 1 skipped, 1 pre-existing unrelated failure |

전체 Vitest의 유일한 실패는 시작 baseline과 동일한
`src/renderer/workspace/session/RuntimeBootstrapController.test.ts:343`의
`runtimeBootstrapController.load()` AST 기대 1 대 현행 App 2다. Gate 2 코드·테스트 실패는 없다.

## Process-kill 결과

산출물: `gate-2-process-kill.json`

- 열린 transaction 강제 종료: Thread/history/evidence/Anchor/decision 모두 0, Candidate revision 1 `ready`, item `pending`, FK 위반 0.
- commit 뒤 강제 종료: Thread/history/evidence/Anchor/decision 각각 1, Candidate revision 2 `completed`, item `approved`, FK 위반 0.

## 성능 결과

산출물: `gate-2-performance.json`

- 측정 행: Thread 1,000, history 1,000, Candidate 1,000, Candidate item 1,000, planner proposal 200.
- Thread projection p95: 120.3415ms.
- Candidate projection p95: 86.3376ms.
- planner p95: 1.3853ms.
- DB 증가: 1,470,464 bytes.
- fixture는 측정 입력일 뿐 제품 제한·사용자 기본값이 아니다.
- renderer commit 수는 이 storage/application harness에서 측정하지 않았고 실제 1280×800 UI는 Electron E2E에서 별도 검증했다.

## Electron 및 보안 경계

Electron E2E는 1280×800에서 다음을 확인했다.

- exact 선택 → `열린 연속성으로 저장` → 수동 Thread/Anchor 생성.
- 플롯·복선·인물 목표 source badge와 원본 화면 이동.
- AI Candidate 표시·승인, exact Anchor 생성, 두 차례 완전 종료·재실행 보존.
- 최종 DB Thread 2, history 2, evidence 2, decision 1, FK 위반 0.
- renderer에는 DB, 파일 경로, OAuth token, raw model response가 노출되지 않는다.

현재 호스트는 Windows `10.0.26200`의 Chromium/Electron sandbox child-process 회귀를 재현한다. 정상 옵션에서는 기존 Gate 1 E2E도 동일하게 GPU/renderer child가 종료됐다. 시스템 ACL은 변경하지 않았다. Gate 2 E2E의 임시 프로세스에만 `EUM_STUDIO_DISABLE_SANDBOX=1`을 주어 실행했으며, 제품 기본값은 다음 fresh 테스트로 별도 확인했다.

- `createMainWindowWebPreferences`: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`.
- 외부 connector request body: exact paragraph text와 typed subject reference만 포함하며 Document/DocumentRevision ID는 제외.
- typed preload: 정해진 9개 continuity channel만 허용.
- 참고: [Electron sandbox 문서](https://github.com/electron/electron/blob/main/docs/tutorial/sandbox.md), [Windows 26200 GPU sandbox 회귀](https://github.com/desktop/desktop/issues/22306).

## 최종 소스 대조

- schema 19의 8개 continuity/Candidate 표와 Work composite FK, immutable history/decision trigger가 production ledger writer와 일치한다.
- LocalWorkspaceRuntime은 상세 SQL을 소유하지 않고 service 조합·save queue 직렬화만 수행한다.
- renderer는 typed bridge만 사용하고 원고 편집기는 다른 작업면에서도 마운트 상태를 유지한다.
- IME composition 중 우클릭 메뉴가 생성되지 않으며 selection을 행·문단으로 확장하지 않는다.
- 기존 Plot/Foreshadow/Character.goal 원장은 변경하거나 복제하지 않는다.
