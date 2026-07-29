# POC-2 — 영속화·강제 종료

## Objective

`D:\eum.studio`의 승인된 `plan.md`와 설계 기준에 따라 POC-2 전체를 구현·검증해, durable acknowledgement 이후 강제 종료해도 정확한 작품·문서 원고를 손실 없이 복구한다.

## Original Request

`POC 2 전체 골잡고 시작`

## Intake Summary

- Input shape: `existing_plan`
- Audience: 이음 스튜디오 사용자
- Authority: `approved`
- Proof type: `test`, `demo`, `artifact`, `metric`
- Completion proof: 승인된 POC-2 통과 조건을 최신 정적·단위·통합·production-bundle·installed-package·kill harness·성능/메모리 증거로 모두 충족한다.
- Likely misfire: journal append만 구현하고 durable flush·ack·결정적 replay·손상 tail 격리·crash matrix를 검증하지 않은 채 POC-2 또는 실사용 저장을 완료로 판정하는 것
- Blind spots considered: IME 확정/미확정 경계, ack 유실·중복, replay 중 재종료, compaction 중 종료, production-bundle과 installed-package 증거 구분
- Existing plan facts: `plan.md`의 POC-2 순서와 통과 조건, append-only journal 선행, SQLite 결정은 POC-3, 저장 문자열과 `ChangeBatch` v1 계약은 현재 미커밋 작업 트리에 구현됨

## Goal Kind

`existing_plan`

## Current Tranche

현재 미커밋 `ChangeBatch` 계약을 보존·검증한 뒤 append-only journal, replay, durable acknowledgement, 저장 상태, checkpoint·compaction 안전성, crash matrix·kill harness, 성능·메모리 재측정과 installed-package E2E까지 승인 순서로 연속 실행한다.

## Non-Negotiable Constraints

- 원고 중심, 정확한 선택 범위, 작품·문서 소유권 분리, 로컬 우선 원칙을 보존한다.
- `D:\eum.editor`는 읽기 전용이며 수정하지 않는다.
- 실사용 원고 저장은 POC-2 최종 통과 전까지 `NO-GO`다.
- SQLite와 FTS 결정은 POC-3로 미룬다.
- renderer는 파일·DB에 직접 접근하지 않고 preload는 좁은 typed bridge만 노출한다.
- 사용자가 명시하지 않은 behavior·schema·validator·default·limit·timeout·retry·fallback·heuristic·UI·dependency를 추가하지 않는다.
- 하드코딩하지 않는다.
- Lazyweb을 사용하지 않는다.
- 각 기능·버그 수정은 실패 검증부터 작성한다.
- 사용자가 요청하기 전에는 커밋하거나 푸시하지 않는다.
- 기존 작업 트리의 미커밋 POC-2 변경을 사용자 소유 변경으로 보존한다.

## Stop Rule

최종 PM/Judge audit가 전체 원래 목표의 완료를 증명할 때만 멈춘다.

계획·조사·한 구현 단위만 끝났다는 이유로 멈추지 않는다. 안전하게 진행 가능한 다음 단위가 있으면 활성화해 계속한다.

## Canonical Board

Machine truth lives at:

`docs/goals/poc-2-durability/state.yaml`

이 charter와 `state.yaml`이 충돌하면 task 상태, active task, receipt, 검증 freshness와 완료 판정은 `state.yaml`이 우선한다.

## Run Command

```text
/goal Follow docs/goals/poc-2-durability/goal.md.
```

## PM Loop

1. 이 charter와 `state.yaml`을 읽는다.
2. 현재 active task 하나만 수행한다.
3. 각 behavioral delta를 승인된 POC-2 요구사항에 일대일로 연결한다.
4. 실패 검증을 확인한 뒤 최소 구현을 작성한다.
5. task receipt와 최신 검증을 `state.yaml`에 기록한다.
6. slice audit는 전체 완료가 아니라 다음 task로 진행하는 checkpoint로 취급한다.
7. 최종 audit만 `full_outcome_complete: true`를 선언할 수 있다.
