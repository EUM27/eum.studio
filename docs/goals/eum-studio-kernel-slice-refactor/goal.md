# 이음 스튜디오 작은 커널 + 수직 슬라이스 리팩토링

## Objective

`D:\eum.studio`의 현재 검증된 도메인·저장·보안·편집 계약과 사용자-visible 동작을 보존하면서, 첨부된 7단계 리팩토링 계획을 작은 작업실 커널과 기능별 수직 슬라이스 구조로 끝까지 구현하고 실제 production Electron 검증과 최종 감사를 통과한다.

## Original Request

`목표 잡아서 끝까지 진행해`

첨부 계획의 핵심 요청:

> 현재의 튼튼한 도메인·저장 계약은 건드리지 않고, 거대한 조립부를 ‘작은 작업실 커널 + 기능별 수직 슬라이스’로 분해한다.

## Intake Summary

- Input shape: `existing_plan`
- Audience: 이음 스튜디오 사용자와 이후 기능을 유지보수할 개발자
- Authority: `approved`
- Proof type: `test`, `demo`, `artifact`, `review`
- Completion proof: 첨부 계획의 완료 기준이 현재 source 구조에 반영되고, lint·typecheck·전체 단위/통합 검증·production build·관련 production Electron E2E와 최종 범위 감사가 통과한다.
- Likely misfire: 파일만 잘게 나누고 상태·명령 소유권은 거대한 Context나 다른 조립부로 옮기거나, 리팩토링을 이유로 저장·DB·IPC·편집 동작을 바꾸는 것.
- Blind spots considered: 계획 기준 커밋 이후의 Gate 14·회차 완료 변경, 기존 E2E locator 노후화, 거대한 파일 사이의 숨은 순환 의존성, CSS selector 계산값, Electron sender·secret 경계, 장기 작업 중 사용자/다른 작업의 dirty diff.
- Existing plan facts: 단계 0 기준선 봉인, 단계 1 renderer UI 기계적 추출, 단계 2 DocumentNavigator, 단계 3 publishing controller, 단계 4 기능별 controller, 단계 5 session/lifecycle, 단계 6 bridge/preload/main 분리, 단계 7 E2E/CSS/구조 규칙 분리 순서를 보존하되 현재 source evidence로 각 slice를 검증한다.

## Goal Kind

`existing_plan`

## Current Tranche

전체 owner outcome이 완료될 때까지 연속 실행한다. 현재 안전 slice는 이미 완료한 `DocumentFolderTree` 추출을 기준점으로 삼아, 현재 source에서 계획의 의존성·위험·검증 경로를 다시 매핑하고 R1의 다음 write-bounded 작업을 확정하는 것이다.

## Non-Negotiable Constraints

- 작업 대상은 정확히 `D:\eum.studio`다. `D:\eum.editor`는 읽기 전용 이주 원본이며 쓰지 않는다.
- domain → application → platform/desktop → preload → renderer 경계와 작품 소유권을 유지한다.
- durable save 알고리즘, SQLite schema/migration, revision/snapshot/backup 불변식, CodeMirror transaction/IME, OAuth/secret 저장, Candidate 승인 규칙을 리팩토링 명목으로 변경하지 않는다.
- 1차 bridge 분리에서 IPC 채널명과 `window.eumStudio` 공개 표면을 변경하지 않는다.
- 신규 런타임 dependency를 추가하지 않는다.
- view 컴포넌트에 새로운 bridge 직접 호출이나 전역 feature state를 만들지 않는다.
- 한 번에 하나의 write-capable task만 활성화하고, 기존 dirty diff와 다른 작업을 되돌리지 않는다.
- 사용자-visible UI slice는 production Electron에서 검증한다.
- 커밋·푸시는 사용자가 별도로 요청할 때만 한다.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified slice while the broader refactoring outcome still has safe local follow-up slices.

If one slice needs owner input or external authority, block only that slice and continue every safe local refactoring task.

## Canonical Board

Machine truth lives at:

`docs/goals/eum-studio-kernel-slice-refactor/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/eum-studio-kernel-slice-refactor/goal.md.
```

## PM Loop

1. Read this charter and `state.yaml`.
2. Re-check `git status --short`, applicable instructions, current active task, and exact allowed files.
3. Work only on the active task with one write-capable task at a time.
4. Preserve the existing plan facts but validate them against current source and runtime evidence.
5. Write a compact receipt, update verification freshness, then activate the next safe task.
6. Treat each slice audit as a checkpoint, not completion.
7. Finish only when the final audit records `full_outcome_complete: true` against the original request and current evidence.
