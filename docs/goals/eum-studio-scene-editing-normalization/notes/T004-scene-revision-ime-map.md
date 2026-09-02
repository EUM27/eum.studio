# T004 장면 명령 revision·IME 증거 지도

## Authoritative state

- 현재 durable DocumentRevision은 renderer `DurableSaveQueue.getCurrentRevisionId(documentId)`가 보유하고, main runtime의 `documentTargets.get(documentId).currentRevisionId`가 최종 권위다.
- `ManuscriptDocumentSource.documentRevisionId`는 projection snapshot이므로 persist 뒤에는 오래될 수 있다.
- 활성 IME 상태는 CodeMirror `EditorView.composing || EditorView.compositionStarted`가 보유한다.
- `ManuscriptEditorHandle`은 현재 selection/text만 노출하고 composition 여부는 노출하지 않는다.

## 현재 race

1. controller가 selection과 manuscript를 먼저 읽는다.
2. `persistDocument()`를 await한다.
3. zero-width command는 empty quote와 offset만 보낸다.
4. runtime은 offset bounds와 empty quote만 확인하며 command 생성 revision을 직접 비교하지 않는다.

따라서 persist 중 editor state가 바뀌거나, 명령이 만들어진 뒤 다른 durable save가 먼저 적용된 경우에도 같은 offset의 empty quote만으로는 stale을 식별할 수 없다.

## IME gap

- context-menu handler는 composition 중에도 selection을 dispatch하고 custom menu를 연다.
- scene controller는 split/add/merge 실행 직전 composition 상태를 확인하지 않는다.
- durable save 자체는 composition을 defer하지만 scene override 명령은 별도라서 명시 guard가 필요하다.

## P0-2 contract

1. `CreateSceneOverrideCommand.expectedDocumentRevisionId`를 non-null 필수 EntityId로 추가한다.
2. renderer는 `persistDocument()` 성공 뒤 queue의 current revision을 읽고, 그 revision을 command에 넣는다.
3. runtime은 ownership 확인 직후 `target.currentRevisionId === expectedDocumentRevisionId`를 검사한다.
4. controller는 persist 뒤 selection/text를 다시 읽고 command를 만든다.
5. `ManuscriptEditorHandle.isDocumentComposing(document)`를 추가해 active exact Document의 CodeMirror composition만 반환한다.
6. context-menu는 composition 중 custom 구조 메뉴를 열지 않고, controller도 split/add/merge/history 실행 직전에 다시 거부한다.
7. delete override도 동일 command contract를 사용하므로 각 Scene projection의 `documentRevisionId`를 명시한다. stale이면 안전하게 실패한다.

## Verification design

- contract: expected revision 필드 보존과 누락/잘못된 필드 거부.
- bridge: exact payload가 IPC channel에 그대로 전달됨.
- runtime: 이전 revision ID를 보낸 zero-width split/add가 명시적 revision conflict로 거부되고 원장 불변; current revision은 성공.
- production Electron: IME composition 중 우클릭 구조 메뉴/SceneOverride가 생기지 않고, composition commit 뒤 exact 위치 split은 성공.
- existing exact-position scene projection E2E와 build/typecheck를 재실행한다.

## Allowed files

- `src/application/structure/scene-override-contract.ts`
- `src/application/structure/scene-override-contract.test.ts`
- `src/application/contracts/studio-bridge.test.ts`
- `src/renderer/editor/ManuscriptEditor.tsx`
- `src/renderer/features/structure/useSceneWorkspaceController.ts`
- `src/renderer/workspace/useWorkspaceStoryFeatureKernel.ts`
- `src/desktop/local-workspace-runtime.ts`
- `src/desktop/local-workspace-runtime.test.ts`
- `tests/e2e/events-plots-scenes.spec.ts`

## Stop conditions

- authoritative current revision cannot be obtained after persist.
- implementation would require schema migration or secret/storage boundary changes.
- current dirty annotations/deletion changes cannot be preserved surgically.
- the same verification failure repeats twice.
