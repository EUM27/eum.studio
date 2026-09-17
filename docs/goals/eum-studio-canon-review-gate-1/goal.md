# 작품 별빛 변경 검토 Gate 1 독립 구현

## Objective

사용자가 지정한 설계 원문을 승인 기준으로 봉인하고, 현재 `D:\eum.studio` 소스 구조에 맞춰 Gate 0과 Gate 1의 작품 별빛 변경 검토 MVP를 독립 구현한 뒤 실제 production Electron 폐회로로 검증한다.

## Original Request

`C:\Users\limoj\OneDrive\바탕 화면\eum-studio-canon-continuity-independent-design.md`를 기준으로 "목표 잡고 실행".

## Intake Summary

- Input shape: `existing_plan`
- Audience: 이음 스튜디오 사용자
- Authority: `approved`
- Proof type: `test`, `demo`, `artifact`, `review`
- Likely misfire: 문서·fixture·성공 문자열만 추가하거나 기존 Character/Lore Candidate의 이름만 바꿔 실제 별빛 검토 폐회로와 원자 승인을 구현하지 않는 것.
- Blind spots considered: 설계 기준 커밋 이후의 renderer/runtime 분리, schema 16·17 stable scene identity 변경, 122개 dirty entry 보존, 기존 두 비관련 Vitest 실패, connector 미연결 환경에서도 검증 가능한 결정론적 fixture 경계.
- Existing plan facts: 설계 원문 SHA-256 `343577C44367C4E38A61913822A13400B5DAA028BE2EA76123F7BBF6A31F3FC5`; Gate 0 후 Gate 1만 구현; Character·CharacterRelation·LoreEntry create/update; exact evidence; strict model payload; no-op·duplicate 제거; 필드별 편집·부분 승인·거절; source/target stale 차단; 한 SQLite transaction 승인; typed preload bridge; React feature 경계; unit·integration·production Electron E2E·process-kill·성능 JSON.

## Goal Kind

`existing_plan`

## Current Tranche

설계의 구현자용 지시대로 Gate 0과 Gate 1만 완결한다. 후속 Gate 2~8은 이번 Goal의 완료 조건이 아니며 Gate 1이 검증된 뒤 별도 Goal로 진행한다.

첫 안전 slice는 현재 소스·schema·기존 Candidate·ContextReceipt·Anchor·Character/Relation/Lore 명령·분리된 bridge/IPC/renderer 조합 지점을 읽기 전용으로 지도화하고, 설계의 오래된 기준 커밋과 현재 dirty source 사이 drift를 검증하는 것이다.

## Non-Negotiable Constraints

- 기존 `Character`, `CharacterRelation`, `LoreEntry`가 유일한 별빛이며 Candidate는 승인 전 이를 쓰지 않는다.
- source·target Work 소유권, immutable `DocumentRevision`, exact `Anchor`, `expectedRevision`, `AssistantContextReceipt`, SQLite transaction, typed preload 경계를 유지한다.
- renderer는 DB·파일·token·model payload parser를 소유하지 않는다.
- `App.tsx`와 `local-workspace-runtime.ts`에는 조합 이상을 누적하지 않는다.
- 기존 122개 dirty entry를 사용자 소유로 보존하고 unrelated 변경을 되돌리거나 정리하지 않는다.
- 기능·버그 수정은 실패 검증부터 작성하고, 완료는 fresh 명령·artifact·production Electron 결과로만 판단한다.
- 커밋·푸시는 하지 않는다.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or task selection if a safe Worker task can be activated.

Do not stop after a single verified slice while Gate 0 or Gate 1 still has safe required work.

## Canonical Board

Machine truth lives at:

`docs/goals/eum-studio-canon-review-gate-1/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/eum-studio-canon-review-gate-1/goal.md.
```

## PM Loop

1. Read this charter and `state.yaml`.
2. Work only on the active task.
3. Preserve the exact design checksum and the current dirty fingerprint.
4. Record a compact receipt before selecting the next task.
5. Keep exactly one write-capable task active.
6. Finish only with a final audit receipt containing `full_outcome_complete: true`.
