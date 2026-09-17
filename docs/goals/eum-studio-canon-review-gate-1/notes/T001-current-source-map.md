# T001 — 현재 소스·설계 검증 지도

## 정확한 입력

- 사용자 지정 설계 원문: `C:\Users\limoj\OneDrive\바탕 화면\eum-studio-canon-continuity-independent-design.md`
- 분량: 53,225 bytes, 1,688 lines
- SHA-256: `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5`
- 설계 기준 커밋: `main@19a7e745eeb5de4771ab39601087775a2dd2fc77`
- 실제 작업 기준: `codex/complete-studio-workflows@8f40406a29ebdeb5c1cc0726934ddff771d752c3`
- 시작 dirty fingerprint: `5A58A320DD4F7714873A5EA8B3DAC3468D0503041286FA4771012663688A212E`, 122 entries, staged 0, conflict 0, merge/rebase/cherry-pick 없음.

기존 승인 manifest 11개 원문은 모두 현재 파일과 SHA-256이 일치한다. 새 설계 원문은 아직 `docs/design-baseline.md`에 등록되지 않았으므로 Gate 0에서 정확한 외부 경로와 checksum을 승인 기능 설계로 추가해야 한다.

## fresh 기준선

- `npm run architecture:check` — exit 0, `architecture boundaries: ok`
- 별빛 의존 계약 6개 파일 — 91 tests passed
- `npm run typecheck` — exit 0
- `npm run test:run` — 255 files passed, 985 tests passed, 1 skipped, 2 failed
- 기존 실패 1: `studio-app-shell-layout.test.ts`가 이미 import된 `manuscript-annotations.css`를 기대 목록에 포함하지 않음
- 기존 실패 2: `RuntimeBootstrapController.test.ts`가 App의 `runtimeBootstrapController.load()`를 1회로 기대하지만 현재 source는 2회

두 실패는 새 별빛 코드가 없는 시작 시점에 재현됐으므로 Gate 1 회귀와 분리한다. 별빛 UI가 CSS import 목록을 직접 변경하면 첫 테스트는 현재 실제 import 목록에 맞춰 같은 slice에서 정합화할 수 있지만, RuntimeBootstrap 기대는 별빛 범위 밖이다.

## 현재 schema와 선행 조건

- 최신 schema는 `LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION = 17`이다.
- schema 16은 stable `sceneId`, segment, lineage, metadata binding을 이미 도입했다.
- schema 17은 Scene trash/delete/restore 원장을 이미 도입했다.
- Gate 1의 exact `Document` selection 실행은 scene 통합에 의존하지 않는다.
- 새 별빛 Candidate와 `canon.review` capability는 schema `17 → 18`로 추가하는 것이 현재 순서와 맞다.

## 실제 재사용 경계

### 권한과 exact 원고

- `src/application/assistant/assistant-context-permission.ts`
  - strict `AssistantContextRange`
  - Work·DocumentRevision·range 검증
  - local/external selection 권한
  - `AssistantContextReceipt`
- `DefaultLocalWorkspaceRuntime.#authorizeAssistantContextAccessSerially`
  - one-time grant 소비와 receipt 저장을 한 SQLite transaction에서 수행
  - current document target과 revision/length를 실제 검사
- `createAnchorForKnownRevisionContent`
  - 이미 검증된 현재 revision content와 exact UTF-16 range로 Anchor 생성 가능

### 기존 별빛

- `src/application/characters/character-contract.ts`
  - 10개 필드 create/update, expectedRevision, evidence projection
- `src/application/characters/character-relation-contract.ts`
  - create는 endpoint를 받지만 update는 현재 kind/description만 허용
  - Gate 1 설계의 endpoint field update를 위해 from/to optional change와 Work 소유 검증이 필요
- `src/application/lore/lore-entry-contract.ts`
  - 5개 필드 create/update, expectedRevision, exact evidence와 immutable history
- 저장 원본은 `characters`, `character_relations`, `lore_entries` 하나씩이며 새 별빛 테이블을 만들 필요가 없다.

### 기존 Candidate 선례

- `character-extraction-contract.ts`와 runtime은 strict model payload, paragraph/quote 해석, ContextReceipt, stale source, Candidate 승인 선례를 제공한다.
- 기존 Character extraction은 전체 item JSON과 create/merge 결정에 특화되어 있어 관계·Lore, field edit, 부분 승인, target revision, normalized evidence를 충족하지 못한다.
- 기존 Lore Candidate는 사용자 수동 후보 한 종류이며 field-level multi-target diff 엔진으로 이름만 바꿔 쓸 수 없다.

### 현재 분리 구조

- feature bridge: `src/application/contracts/bridge/*`
- feature preload: `src/preload/bridge/*`
- feature IPC: `src/desktop/ipc/register-*-ipc.ts`
- feature runtime picker: `src/desktop/runtime/*-runtime.ts`
- renderer controller: `src/renderer/features/*`
- renderer work surface: `src/renderer/workspace/*`
- `App.tsx`는 client/kernel 조립, `WorkspaceView.tsx`는 typed 화면 조립을 맡는다.

새 기능은 `canon` feature 경계로 추가하고 `App.tsx`와 `local-workspace-runtime.ts`에는 service 조합과 좁은 method forwarding만 추가해야 한다.

## 설계 drift와 결정 필요점

1. 설계 원문은 기준 커밋 이후의 controller/bridge/IPC 분리를 반영하지 않는다. 현재 feature module 구조가 우선한다.
3. `canon.review`는 현재 application capability union과 SQLite CHECK에 없다. parser와 schema 18의 grant/receipt table rebuild가 모두 필요하다.
4. 모델 payload의 `unresolved` UX에 대응하는 명령이 설계 예시에는 빠져 있다. `ResolveCanonReviewItemTargetCommand`를 추가해야 사용자가 create/update target을 명시 선택할 수 있다.
5. relation endpoint는 설계상 허용 필드지만 기존 update 계약과 ledger writer에는 없다. optional endpoint update를 추가하고 양 endpoint의 active same-Work 소유를 검증해야 한다.
6. Candidate pre-approval evidence에는 Anchor가 아직 없다. normalized evidence row에 immutable source revision/range/exact snapshot을 저장하고 승인 transaction에서 Anchor를 연결한다.
7. inferred proposal은 직접 승인할 수 없어야 한다. Gate 1에서는 승인 차단과 명확한 UI를 구현하고, 수동 별빛 작성 화면으로 보내는 동작만 허용한다. Continuity 전송은 Gate 2 범위다.
8. 현재 work navigation은 `쓰기 | 구조 | 검토 | 운영`이다. 사용자 지정 설계가 명시한 `별빛` work section을 그 사이에 추가하고 Gate 1에서는 `별빛 | 변경 검토`만 활성화하는 것이 가장 직접적인 구현이다.
9. connector 실행 동안 원고가 바뀌면 record 단계에서 Candidate를 `stale`로 저장해야 하므로 prepare → external execute → serialized record 경계를 유지한다.
10. 승인 transaction은 canonical write, Anchor, canonical evidence/history, Candidate item/candidate status, decision receipt를 같은 generic ledger transaction에 넣어야 한다.

## 계획된 bounded Worker slices

### T003 — Gate 0 봉인

- 승인 manifest의 새 설계 원문 경로/checksum
- 구현 입력·sceneId dependency 결정 기록
- README/plan에 Gate 0 기준 기록

### T004 — application contract·model parser·planner

- `src/application/canon/*`
- strict command/projection/model payload parser
- paragraph exact quote resolver
- current projection no-op 제거
- duplicate pending field 제거
- unique/update/create/unresolved target planner
- inference·Work·retired·invalid relation guard
- `canon.review` capability parser

### T005 — schema 18·ledger write kinds

- grant/receipt CHECK rebuild
- normalized Candidate/item/field/evidence/decision receipt tables
- base schema와 17→18 migration
- `canonReviewCandidate`, `canonReviewCandidateUpdate`, `canonReviewItemDecision`, `canonReviewEvidence` record kinds
- relation endpoint update writer

### T006 — local canon service

- `src/desktop/canon/local-canon-runtime.ts`
- current canonical snapshot query
- prepare/execute/record
- list/edit/resolve/decide
- exact source/target revision 검사
- duplicate create 차단
- canonical+Anchor+history+Candidate 원자 승인
- local workspace runtime에는 service 조합·queue forwarding만 추가

### T007 — connector·typed bridge·IPC

- 새 독립 prompt/schema와 ChatGPT OAuth adapter method
- bootstrap connector wiring과 configured-runtime fallback
- canon bridge/preload/IPC/runtime picker
- sender 인증 유지

### T008 — renderer controller

- Candidate load/run/permission/edit/resolve/approve/reject state
- approval 뒤 Character/Relation/Lore authoritative refresh
- Work 전환 격리

### T009 — Canon workspace UI

- work primary navigation `별빛`
- `별빛 | 변경 검토`
- Candidate list / field diff editor / exact evidence 3열
- inferred/unresolved/stale/permission 상태
- canonical browser search/filter와 canonical detail evidence 진입
- 1280×800, keyboard, 14 theme token surface

### T010 — exact selection entry·navigation

- 원고 우클릭 `별빛 변경 점검`
- IME 중 차단
- exact selection persist 뒤 current durable revision으로 실행
- Candidate workspace 이동
- exact revision evidence를 DocumentNavigator로 열기

### T011 — integration evidence

- schema 17 actual-copy migration
- focused/full static·unit·integration
- production Electron selection→permission→Candidate→edit/deselect→approve→detail/evidence→full restart
- source/target stale, inferred, unresolved, cross-Work, malformed/empty payload
- approval process-kill 전/후 restart consistency
- caller-owned performance profile과 raw/p50/p95 JSON

## Scout 결론

현재 소스는 Gate 1을 실제로 구현할 기반을 갖고 있으며 중대한 authority blocker는 없다. 첫 write slice는 기존 dirty product code와 겹치지 않는 Gate 0 문서·검사 surface로 제한한다. 이후 application 계약부터 실패 검증을 작성해 아래층에서 위층 순서로 진행한다.
