# T001 — Gate 2–8 현재 소스 지도

## 정확한 기준점

- 승인 설계: `C:\Users\limoj\OneDrive\바탕 화면\eum-studio-canon-continuity-independent-design.md`
- 분량: 53,225 bytes, 1,688 lines
- SHA-256: `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5`
- 실제 작업 기준: `codex/complete-studio-workflows@8f40406a29ebdeb5c1cc0726934ddff771d752c3`
- precise 시작 dirty: 185 entries, staged 0, conflict 0, fingerprint `4A9BCE4FCF0769CA6E08A6E41F1E251EF3B6D32C6722C466674A4F239B866400`
- 승인 manifest 기존 원문: 11/11 checksum 일치
- 현재 local workspace schema: `18`
- Gate 0·1 보드: `docs/goals/eum-studio-canon-review-gate-1/state.yaml`, 최종 Judge `full_outcome_complete: true`

`docs/design-baseline.md`의 승인 기능 설계 범위는 아직 “Gate 0 및 Gate 1”로 적혀 있다. 사용자의 이번 명시 승인에 따라 첫 Gate 2 write slice에서 같은 exact checksum의 승인 범위를 Gate 0–8로 넓혀야 한다. 원문 파일이나 checksum은 바꾸지 않는다.

## fresh 기준선

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run architecture:check` — pass, `architecture boundaries: ok`
- `npm run test:run` — 267 files pass, 1 file fail; 1,034 tests pass, 1 skip, 1 fail
- 남은 실패는 시작 전부터 존재한 `RuntimeBootstrapController.test.ts:343`의 App `runtimeBootstrapController.load()` 기대 1 대 현재 source 2인 AST 소유권 기대다. Gate 2 코드가 없는 시작 상태에서 재현되므로 새 Gate 회귀와 분리한다.

## 공통 재사용 경계

### 별빛·근거·권한

- Gate 1의 `src/application/canon/`, `src/desktop/canon/local-canon-runtime.ts`, schema 18 normalized Candidate ledger, typed bridge/preload/IPC/controller/UI가 실제 production path다.
- `AssistantContextRange`, permission grant, one-use consumption, `AssistantContextReceipt`, exact DocumentRevision/range authorization은 `assistant-context-permission.ts`와 local runtime에 있다.
- `createAnchorForKnownRevisionContent`와 `DocumentNavigator`가 exact evidence 생성·재개방 경계다.
- 현재 capability에는 `canon.review`까지 있고 `continuity.review`·`narrative.digest`는 없다.

### 기존 별빛 projection

- `Character`, `CharacterRelation`, `LoreEntry`, `PlotThread`, `ForeshadowLine`, `EventBlock`은 모두 Work-owned revision 원장과 list command가 있다.
- Gate 2 연속성 화면은 Plot/Foreshadow/Character.goal을 복제하지 않고 기존 projection을 source badge와 함께 합성해야 한다.
- Gate 1의 `CanonEntityRef`는 현재 Character/Relation/Lore 세 종류뿐이다. Gate 2에서 공용 strict entity-ref 계약으로 추출·확장하되 기존 Canon review wire shape는 바꾸지 않아야 한다.

### 현재 feature 분리

- bridge: `src/application/contracts/bridge/*`
- preload: `src/preload/bridge/*`
- IPC: `src/desktop/ipc/register-*-ipc.ts`
- runtime picker: `src/desktop/runtime/*-runtime.ts`
- local service: `src/desktop/canon/*` 같은 feature service
- renderer controller: `src/renderer/features/*`
- renderer surface: `src/renderer/canon/*`, composition은 `WorkspaceView.tsx`

새 Gate는 이 feature 구조를 따르고 `local-workspace-runtime.ts`와 `App.tsx`에는 조합·좁은 forwarding 이상을 누적하지 않는다.

## Gate별 실제 상태와 차이

### Gate 2 — 열린 연속성

현재 `ContinuityThread`, continuity evidence/ref/history, continuity Candidate, runtime/bridge/UI는 모두 없다.

필요한 실제 폐회로:

- strict manual CRUD와 `expectedRevision` update/resolve/dismiss
- selection 수동 생성 시 exact Anchor
- resolution mode `manual | evidence`와 immutable transition history
- same-Work typed subject refs
- PlotThread·ForeshadowLine·Character.goal과 저장 중복 없는 통합 projection
- `continuity.review` permission/receipt와 별도 strict AI Candidate; 유사 thread 자동 병합 금지
- 별빛 작업면 `연속성` 탭과 원고 우클릭 `열린 연속성으로 저장`
- 완전 재실행, source/target stale, cross-Work, transaction kill 증거

Gate 1 field-diff Candidate 테이블을 억지로 확장하면 typed subject refs와 resolve history를 잃으므로 Gate 2 AI 결과는 continuity 전용 normalized Candidate 원장으로 두는 편이 현재 계약에 맞다. 기존 canonical ledgers는 변경하지 않는다.

### Gate 3 — 인물 지식·믿음

`CharacterKnowledge`·truth/stance·supersession·POV projection은 없다. 기존 Character와 Scene annotation의 POV character는 재사용 가능하다.

필요 범위:

- objective truth와 character stance를 분리한 strict claim CRUD
- `believes + false` 허용, unaware 남용 방지
- previous claim을 덮어쓰지 않는 supersession relation
- same-Work Character/about refs, exact evidence
- current scene POV 기준 author/objective/known/mistaken/withheld projection
- 원고 선택 수동 저장과 별빛 작업면 지식 UI

### Gate 4 — Context Planner와 활동

원고 permission/receipt와 기존 조수 활동 state는 있지만 entity policy, deterministic planner, entity/digest manifest, exclusion reason, required-budget failure, 별빛 활동 탭은 없다.

현재 connector manifests에는 token budget 필드가 없다. 숫자를 제품 기본값으로 추가하지 말고 connector/user runtime manifest가 positive budget을 명시하도록 계약을 확장해야 한다. budget이 없으면 planner를 실행하지 않고 명시적 unavailable 결과를 내야 한다.

### Gate 5 — 이야기 지금까지

`NarrativeDigest`와 source refs/hash/stale projection은 없다. 기존 WorkSnapshot은 원고 revision의 불변 기준점이며 digest가 아니다.

필요 범위:

- work/document/character/relationship scope
- 사용자가 고른 범위만 사용
- Document/Event/Character/Relation/Lore/Continuity/Knowledge revision을 결정적으로 정렬한 source manifest
- manifest hash 변화 시 과거 text를 지우지 않는 stale projection
- `narrative.digest` permission/receipt/context manifest와 명시 재생성
- 이야기 흐름 탭

### Gate 6 — 장면 통합

선행 조건은 현재 소스에 존재한다.

- schema 16: stable `Scene`, `EpisodeSceneSegment`, `SceneLineageOperation`, lineage member, metadata binding
- schema 17: delete/restore trash와 lineage
- split/merge/move/delete/restore runtime write와 `SceneIdentityProjection`
- annotation/event override/music queue binding의 current/needsReview/detached 상태

남은 것은 continuity/knowledge를 stable Scene에 연결하고 장면 확정 후 명시 점검, 장면별 상태/지식 projection, split/merge lineage 이후 자동 확정이 아닌 proposed inheritance review를 추가하는 일이다. 파생 `sceneKey`를 새 FK로 사용하면 안 된다.

### Gate 7 — 기준점과 대체 전개

기존 WorkSnapshot은 label, cause, manifestHash, immutable DocumentRevision 목록을 갖고 생성·조회·회차별 read-only 비교까지 동작한다. 현재 UI도 label 입력과 비교 dialog가 있다.

남은 것은 mutable named slot이 immutable snapshot을 가리키는 Work-owned pointer, slot expectedRevision, stable Scene segment 기반 장면별 comparison/selection plan이다. 자동 전체 병합·원고 쓰기는 금지하고 선택 결과는 read-only branch plan으로만 유지한다.

### Gate 8 — Markdown 내보내기

현재 UTF-8 text writer와 main 저장 dialog/typed export 선례는 있지만 별빛 serializer나 Obsidian adapter는 없다.

필요 범위:

- current Work canonical projection에서만 deterministic Markdown bundle preview
- 인물/관계/설정/연속성/지식/digest의 ID·revision·근거를 자체 layout으로 직렬화
- 사용자 선택 새 target에 temp→sync→publish, 기존 target 무음 overwrite 금지
- renderer에 path/파일 API 비노출
- import channel·parser·watcher는 만들지 않음
- source revision manifest/checksum과 export receipt

### 출시 전 독립 구현 점검

- reference 제품의 고정 수치·copy·layout을 사용하지 않음
- 신규 dependency가 없다면 현재 dependency manifest를 고정하고, 최종 단계에서 repository-level third-party notice/license 정책 부재를 사실대로 기록
- static license inventory와 수동 source/layout 유사성 감사를 최종 Judge 입력에 포함

## 예상 schema 순서

설계가 숫자를 예약하지 않으므로 각 Gate 시작 시 최신 version을 다시 확인한다. 현재 기준의 예상은 다음과 같다.

- Gate 2: 18→19, continuity + continuity review Candidate + `continuity.review` capability
- Gate 3: 19→20, knowledge + supersession
- Gate 4: 20→21, entity policies + context manifests
- Gate 5: 21→22, narrative digest + source refs + `narrative.digest`
- Gate 6: 필요 시 22→23, scene-context binding/inheritance review
- Gate 7: 필요 시 23→24, named snapshot slots/branch selection plan
- Gate 8: 저장 schema가 필요 없으면 version 증가 없이 export adapter만 추가

모든 migration은 새 테이블/명시적 CHECK rebuild만 수행하고 기존 별빛을 변환하지 않으며 definition checksum, 논리 pre/post checksum, receipt, FK 0을 검증한다.

## Gate 2 bounded Worker 제안

### T003 — 승인 범위·공용 entity ref·Continuity application 계약

- `src/application/canon/canon-entity-ref.ts`
- `src/application/continuity/continuity-thread-contract.ts`
- manual CRUD/list/resolve/dismiss/projection/history strict parser
- AI continuity model payload/parser/planner, exact quote, duplicate hint, no auto merge
- `continuity.review` application capability

### T004 — schema 19·ledger·migration

- continuity thread/ref/evidence/history tables
- continuity AI Candidate/item/evidence/decision tables
- grant/receipt CHECK에 `continuity.review`
- generic ledger record kinds와 immutable history/receipt triggers
- base schema와 checksum-pinned 18→19 migration

### T005 — LocalContinuityService

- manual create/update/list/resolve/dismiss
- exact selection Anchor와 same-Work refs
- Plot/Foreshadow/Character.goal 통합 projection
- prepare→connector→strict record, Candidate list/approve/reject
- canonical thread + Anchor + Candidate + history 한 transaction
- `local-workspace-runtime.ts`에는 service 조합/forwarding만

### T006 — connector·typed bridge·preload·IPC

- 독립 prompt/schema, requested exact paragraphs와 Work-local entity refs만 전송
- configured connector and official ChatGPT OAuth adapter capability wiring
- continuity namespace의 strict channels/result parse, sender authorization

### T007 — renderer controller·연속성 탭·selection entry

- CanonTab에 continuity 추가
- continuity controller state와 Work switch cancellation
- open/resolved/kind/source filter, canonical/plot/foreshadow source badges
- manual create/update/resolve/dismiss와 Candidate review
- 원고 컨텍스트 메뉴 exact selection·IME guard·DocumentNavigator evidence

### T008 — Gate 2 fresh 증거

- focused/full static·unit·integration/build
- production Electron manual selection→thread→resolve evidence→restart
- AI Candidate permission→approve/reject, stale/cross-Work/malformed/empty payload
- actual process-kill pre/post transaction consistency
- 1,000-thread integrated projection and Candidate performance JSON

### T009 — Gate 2 Judge 및 Gate 3 활성화

- Gate 2 승인 기준을 source/runtime/artifact에 대조
- 완료일 때만 Gate 3 bounded tasks를 보드에 추가

## Scout 결론

Gate 2–8을 막는 authority·source blocker는 없다. 현재 가장 안전한 첫 write slice는 승인 scope 확장과 순수 application 계약이다. Gate 2의 schema/runtime/UI를 완결·감사한 뒤 Gate 3으로 이동해야 하며, later-Gate table이나 UX를 Gate 2에 미리 넣지 않는다.

