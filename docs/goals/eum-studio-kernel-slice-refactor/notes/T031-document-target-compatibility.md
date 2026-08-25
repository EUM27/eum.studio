# T031: DocumentTarget 호환성 결정

Task: `T031`
Kind: `judge`
Status: `current`

## Decision

첫 `DocumentNavigator` slice는 새 navigation 정책을 도입하지 않고 현재 feature ref의 pending semantics만 구조화한다.

### 보존할 현재 동작

- 같은 feature channel의 새 요청은 이전 pending 값을 대체한다.
- 서로 다른 feature channel pending 값은 공존할 수 있다.
- 활성화된 Work/Document가 target과 다르면 pending은 소비하지 않고 유지한다.
- matching `onDocumentActivated`에서만 target을 소비한다.
- activation rejection 또는 기존 명시 reset 지점에서는 해당 channel만 지운다.
- 일반 selection target은 현재와 같이 revision을 강제하지 않는다.
- fragment same-document direct selection과 Structure/Review visibility 전환은 이번 slice에서 변경하지 않는다.

### 첫 타입 범위

```ts
type DocumentSelectionTarget = Readonly<{
  kind: "selection";
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  range: Readonly<{ from: number; to: number }>;
}>;

type DocumentNavigationChannel = "fragment-source";
```

offset, revision-bound selection, preview, diff target은 실제 해당 기능을 이동할 때 별도 variant로 추가한다. 지금 미리 일반화하지 않는다.

### 첫 coordinator 범위

`DocumentNavigator`는 순수 pending registry로 시작한다.

- `stage(channel, target)`
- `clear(channel)`
- `consumeActivated(channel, workId, documentId)`

App은 기존처럼 current document flush와 `activateWorkspaceLocation`을 소유한다. activation Promise에서 reveal하지 않고, 기존 `onDocumentActivated`가 navigator target을 consume한 뒤 현재 editor selection API를 호출한다.

## Rejected Changes

- 모든 selection target에 `documentRevisionId`를 새로 요구하지 않는다.
- 공통 request epoch나 stale-request 자동 무효화를 추가하지 않는다.
- scene offset을 cursor selection으로 바꾸지 않는다.
- scene draft diff를 navigator reveal로 옮기지 않는다.
- feature navigation을 다른 Work로 확장하지 않는다.

## First Worker Scope

- `src/renderer/App.tsx`
- `src/renderer/workspace/navigation/document-target.ts`
- `src/renderer/workspace/navigation/DocumentNavigator.ts`
- `src/renderer/workspace/navigation/document-navigator.test.ts`

`pendingFragmentSourceRef`의 cross-document stage/consume/clear만 새 coordinator로 옮긴다. 다른 pending ref와 fragment same-document branch는 그대로 둔다.

## Required Proof

- 순수 unit: same-channel overwrite, cross-channel coexistence 구조, mismatch retain, matching consume, channel clear.
- 새 fragment cross-episode exact-selection E2E.
- flush-before-document-switch E2E.
- IME defer/cancel E2E.
- lint, typecheck, build, diff check.
