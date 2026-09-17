# T029: 현재 문서 이동 경로 지도

Task: `T029`
Kind: `scout`
Status: `current`

## Summary

현재 교차 회차 이동의 공통 동기화 지점은 `activateWorkspaceLocation()`의 Promise 완료가 아니라 `ManuscriptEditor.onDocumentActivated`다. 작품/회차 identity가 바뀌면 App이 현재 원고를 먼저 flush하고 workspace 위치를 활성화한 뒤 runtime active ID를 갱신한다. ManuscriptEditor가 실제 대상 EditorState를 설치하거나 IME 종료 뒤 지연 전환을 완료한 다음에만 matching pending ref를 소비해 selection·offset reveal을 수행한다.

첨부 계획의 `documentRevisionId` 강제와 오래된 요청 epoch 무효화는 현재 공통 동작이 아니다. assistant vocabulary만 revision을 재검증하며, 나머지 대부분은 source projection의 resolved integrity와 현재 range/offset만 사용한다. 이를 공통 navigator의 기본 규칙으로 추가하면 리팩토링이 아니라 동작 변경이 된다.

## Shared Flows

- `ACT`: identity 변경 시 current document flush → `workspace.activateLocation` → 반환 catalog의 Work/Document 소유권 검증 → runtime active ID 갱신 → editor state 설치/IME 완료 → `onDocumentActivated`에서 reveal.
- `VIS`: 이미 같은 document가 mount된 Structure/Review 화면에서 Write로 전환한 뒤 effect가 `pendingVisibleManuscriptSelectionRef`를 소비한다. flush나 editor activation은 없다.
- `SEL`: editor identity와 safe integer range, `0 <= from <= to <= doc.length`를 확인한 뒤 select·scroll·focus한다. 일반 경로는 revision/exactText를 확인하지 않는다.
- `OFFSET`: editor identity와 in-bounds offset을 확인한 뒤 scroll·focus만 하며 cursor/selection은 옮기지 않는다.

## Navigation Matrix

| Ref | Current reveal | Revision behavior | Cross-document E2E |
|---|---|---|---|
| `pendingFragmentSourceRef` | `SEL` | source revision dropped | 없음 |
| `pendingForeshadowPointSourceRef` | `VIS`/`SEL` | source revision dropped | 없음 |
| `pendingPlotThreadSourceRef` | `VIS`/`SEL` | source revision dropped | 있음 |
| `pendingWorkStructureRangeRef` | `VIS`/`SEL` | plot/event target revision 없음, scene revision dropped | plot source만 있음 |
| `pendingCharacterEvidenceRef` | `VIS`/`SEL` | evidence revision dropped | 없음 |
| `pendingSceneBoundaryPreviewRef` | `OFFSET` + decoration | candidate revision dropped | 없음 |
| `pendingSceneDraftCompareRef` | `OFFSET`; diff는 panel에 남음 | target revision dropped | 없음 |
| `pendingEventRailRangeRef` | `VIS`/`SEL` | source revision dropped | 있음 |
| `pendingLoreEvidenceRef` | `VIS`/`SEL` | source revision dropped | 있음 |
| `pendingLoreCandidateEvidenceRef` | `VIS`/`SEL` | evidence revision dropped | 없음 |
| `pendingAssistantVocabularyOccurrenceRef` | `SEL` | 유일하게 revision 사전/사후 재검증 | same-document만 있음 |
| `pendingVisibleManuscriptSelectionRef` | `VIS`/`SEL` | caller별 integrity, 공통 revision 없음 | same-document 전환만 있음 |

## Cancellation Truth

- matching consumption 전에 ref를 지우고 reveal을 시도한다.
- activation rejection에서 해당 feature ref를 지우는 경로가 대부분이다.
- 공통 request epoch는 없다.
- 서로 다른 feature ref가 동시에 존재할 수 있다.
- mismatch ref는 남을 수 있고, IME queued switch가 원래 document 복귀로 취소돼도 feature ref가 남을 수 있다.
- 이 동작을 무효화하는 공통 epoch는 별도 승인 없이는 추가하지 않는다.

## Evidence

- `src/renderer/App.tsx`: pending type/ref 정의, `onDocumentActivated`, `activateWorkspaceLocation`, 각 open handler.
- `src/renderer/editor/ManuscriptEditor.tsx`: state 설치, IME deferral, selection/offset reveal.
- `src/application/workspace/workspace-contract.ts`: active Work/Document identity 계약.
- `tests/e2e/desktop-shell.spec.ts`: plot/work-structure/lore/event 교차 회차, flush-before-switch, IME defer/cancel, same-document fragment/foreshadow/candidate/assistant.

## Recommended Sequence

1. 파편 source를 회차 A에서 만들고 회차 B로 이동한 뒤 `원문 열기`로 A의 exact range를 선택하는 current-success E2E를 추가한다.
2. Judge/PM이 revision·cancellation·reveal taxonomy를 “현재 semantics 보존”으로 확정한다.
3. `pendingFragmentSourceRef` 하나만 새로운 navigator로 옮긴다.
4. plot/event/lore의 기존 cross-document E2E를 회귀로 유지하며 기능별 batch로 확장한다.
5. scene offset 경로와 assistant revision 경로는 별도 target variant로 남긴다.

## Board Receipt Snippet

```yaml
receipt:
  result: done
  note: notes/T029-document-navigation-map.md
  summary: "Mapped all 12 refs; editor activation callback is the shared readiness boundary, while revision and reveal semantics are feature-specific."
```
