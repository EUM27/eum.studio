# T001 현재 장면 편집 증거 지도

## 결론

첨부 검토는 현재 구현보다 일부 오래됐다. stable Scene identity와 split/merge/delete별 runtime side effect는 이미 존재하지만, 장면 카드 분할의 장면/커서 불일치, `sceneKey` 기반 장기 메타데이터, lineage 부재, 삭제 복원 부재, 명시 revision·IME guard 부재는 현재 source에서도 확인된다.

## 첨부 주장별 현재 상태

1. **장면 카드 분할이 전달받은 장면을 무시한다 — 현재도 사실.**
   - `src/renderer/editor/SceneList.tsx`는 `onSplitScene(scene)`를 호출한다.
   - `src/renderer/features/structure/StructureWorkspaceHost.tsx`는 callback argument를 받지 않고 `scene.createSceneBoundary("split")`을 호출한다.
   - controller는 이 경우 현재 활성 편집기의 selection을 읽는다.
   - `tests/e2e/events-plots-scenes.spec.ts`도 먼저 편집기 커서를 옮긴 뒤 카드 버튼을 눌러 이 결함을 가린다.

2. **split/merge가 단순한 add/ignore 별칭뿐이다 — projection fold만 보면 같지만 runtime 전체로는 오래된 주장.**
   - `scene-projection.ts`에서 `add|split`은 경계 추가, `ignore|merge`는 경계 제거로 fold된다.
   - 그러나 `local-workspace-runtime.ts`는 `split`, `merge`, `delete`마다 Scene identity와 episode segment를 별도로 생성·retire한다.
   - split은 현재 Scene 내부만 허용하고, merge는 인접 Scene을 해석하며, delete는 identity와 모든 활성 segment를 retire한다.

3. **stable `sceneId`가 없다 — 부분적으로 해결됨.**
   - schema 15에 `scene_identities`, `scene_episode_segments`, `episode_range_moves`가 있다.
   - `SceneProjection.sceneIdentity`가 optional로 stable `sceneId`와 cross-episode segment를 노출한다.
   - 초기 계산 Scene은 identity가 없을 수 있고, split/merge/range move 등 구조 작업 시 identity가 생긴다.
   - `scene_lineage` 또는 동등한 parent/child 관계 원장은 없다.

4. **장면 삭제가 없다 — 현재는 Scene projection/identity 삭제가 있으나 첨부가 말한 본문 삭제·휴지통·복원은 없다.**
   - `SceneOverride(operation: "delete")`가 exact Scene range를 projection에서 숨긴다.
   - identity가 있으면 모든 활성 segment와 identity를 같은 ledger transaction에서 retire한다.
   - 원고 텍스트는 유지하며 UI도 이를 명시한다.
   - 삭제 미리보기, 별도 휴지통, restore command, Ctrl+Z 경로는 없다.
   - 현재 dirty diff는 교차 회차 삭제에서 숨은/retired 회차 segment까지 모두 retire하도록 고친 사용자 작업이다.

5. **구조 변경 뒤 메타데이터 참조가 끊길 수 있다 — 현재도 사실.**
   - `SceneAnnotation`, `SceneEventOverride`, `SceneMusicQueueCandidate`는 `sceneId`가 아니라 `sceneKey`를 저장한다.
   - split/merge runtime은 identity segment를 갱신하지만 이 세 원장의 `sceneKey`를 이관하지 않는다.
   - event override의 키가 현재 projection에 없으면 `needsReview`; 음악 Candidate는 `stale`; annotation은 SceneList에서 더 이상 일치하지 않는다.

6. **분할 안전 검사 — 일부 구현, 일부 부재.**
   - runtime은 split offset이 현재 Scene의 엄격한 내부인지 검사하므로 경계/장면 밖 위치와 duplicate boundary는 실패한다.
   - controller는 먼저 durable persist를 요청하고 runtime은 현재 text와 exactQuote를 대조한다.
   - 하지만 zero-width split command에 명시 `expectedDocumentRevisionId`가 없고 empty quote는 같은 offset의 stale 상태를 충분히 식별하지 못한다.
   - context-menu 생성/실행에는 `EditorView.composing` 기반 disable/거부가 없다.

7. **테스트 간극 — 현재도 존재.**
   - SceneList unit test는 버튼 callback 의미를 검증하지 않는다.
   - E2E는 cursor와 card가 일치하는 경우만 검증한다.
   - 현재 runtime test에는 split/merge의 stable identity와 metadata 이관/검토 정책을 직접 검증하는 assertion이 없다.
   - dirty E2E diff에서 삭제와 cross-episode move 검증 일부가 제거되어 최신 fresh 증거가 더 약해졌다.

## 실제 호출 경로

```text
SceneList card
→ StructureWorkspaceHost (scene argument discarded)
→ useSceneWorkspaceController.createSceneBoundary("split")
→ editor current selection + manuscript materialization
→ persistDocument
→ typed structure.createSceneOverride
→ local-workspace-runtime #createSceneOverrideSerially
→ Anchor + SceneOverride + SceneIdentity/segment records in one ledger transaction
→ listSceneProjection refresh
```

원고 우클릭 경로는 `ManuscriptEditor`가 실제 pointer offset과 active Document를 전달하므로 카드 경로보다 정확하다.

## 첫 안전 Worker slice

장면 카드의 `현재 위치에서 분할` 버튼과 unused `onSplitScene(scene)` prop을 제거하고, 기존 원고 우클릭 `장면 나누기`를 유일한 사용자 실행 경로로 유지한다. 기존 E2E는 카드 클릭 대신 exact 원고 offset 우클릭으로 같은 split 결과를 검증한다.

이 slice는 DB·bridge·runtime·identity·원고를 바꾸지 않고, 확인된 오작동 진입점만 제거한다. 이후 slice에서 명시 revision/IME guard와 `sceneId` 기반 metadata/lineage를 다룬다.

## 제안 범위

- allowed files:
  - `src/renderer/editor/SceneList.tsx`
  - `src/renderer/editor/SceneList.test.ts`
  - `src/renderer/features/structure/StructureWorkspaceHost.tsx`
  - `tests/e2e/events-plots-scenes.spec.ts`
- verify:
  - red: focused SceneList assertion that card split control is absent
  - green: focused SceneList test
  - TypeScript typecheck
  - production build
  - focused production Electron `projects final scenes...` E2E using right-click `장면 나누기`
- stop if:
  - current dirty E2E edits cannot be preserved surgically
  - removing the card path leaves no exact-offset split entry
  - verification repeats the same failure twice
