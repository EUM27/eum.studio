# 승인 POC 실행 계획 전체 완료

## Objective

`D:\eum.studio`의 승인된 POC 실행 계획에서 남은 `POC-3 — SQLite·불변 blob·백업`, `POC-M — 현행 데이터 이주 rehearsal`, `POC-4 — OAuth·비밀정보`를 순서대로 TDD 구현·검증하고, 각 Gate 완료 단위로 커밋·`origin/main` 푸시한 뒤 전체 POC 완료 판정을 증명한다.

## Original Request

`POC-2만 말고 전부 끝까지`

## Intake Summary

- Input shape: `existing_plan`
- Audience: 이음 스튜디오 사용자
- Authority: `approved`
- Proof type: `test`, `demo`, `artifact`, `metric`, `review`
- Completion proof: 승인 계획의 POC-3·POC-M·POC-4 통과 조건을 최신 정적·단위·통합·production-bundle·installed-package·실패 주입·checksum 증거로 모두 충족하고 최종 PM/Judge audit가 `full_outcome_complete: true`를 판정한다.
- Likely misfire: POC adapter나 fixture를 제품 기본값으로 굳히거나, 물리 저장·이주·비밀 경계 중 하나만 구현한 뒤 전체 POC를 완료로 판정하는 것
- Blind spots considered: native addon의 Electron ABI·packaging, backup 중 종료, blob 누락·변조, 레거시 source snapshot 봉인, 미매핑·고아 데이터 원시 보존, 이주 멱등성·취소 복원, OAuth state·PKCE·callback 소유권, renderer secret 비노출, 실제 제공자 자격 증명 부재
- Existing plan facts: Gate 순서는 POC-3→POC-M→POC-4이며 SQLite driver는 bake-off 전 확정하지 않고, 레거시는 읽기 전용 snapshot을 사용하며, connector UI와 음악 SDK POC는 첫 출시 핵심 폐회로의 차단 항목이 아니다.

## Goal Kind

`existing_plan`

## Current Tranche

POC-2의 clean `main` 기준에서 POC-3을 먼저 검증하고 Gate audit·커밋·푸시로 닫는다. 이어서 같은 절차로 POC-M과 POC-4를 진행하며, 계획이나 한 구현 slice에서 멈추지 않고 승인 POC 전체 완료 audit까지 연속 실행한다.

## Non-Negotiable Constraints

- 저장소 문서와 Git 상태를 source of truth로 사용한다.
- 승인 설계 checksum이 manifest와 다르면 diff 검토 전 구현을 계속하지 않는다.
- `D:\eum.editor`는 읽기 전용 이주 근거이며 절대 수정하지 않는다.
- 원고 중심, 정확한 선택 범위, 작품·문서 데이터 소유권 분리, 로컬 우선 원칙을 보존한다.
- domain은 순수 TypeScript, renderer는 DB·파일·OAuth token에 직접 접근하지 않는다.
- 새 dependency와 런타임 버전은 공식 현재 지원 범위를 확인하고 lockfile에 정확히 고정한다.
- 물리 저장·driver·schema·경로·provider·model·endpoint·client ID·callback 주소·제품 제한을 하드코딩하지 않는다.
- 사용자가 요청하지 않은 behavior·default·fallback·retry·timeout·heuristic·UI·dependency를 추가하지 않는다.
- 모든 기능·버그 수정은 실패 검증부터 작성한다.
- fixture·측정 수치는 제품 제한이나 사용자 기본값으로 사용하지 않는다.
- Lazyweb을 사용하지 않는다.
- 각 Gate의 최신 완료 증거가 있을 때만 해당 Gate를 커밋·푸시한다.
- unrelated 사용자 변경을 정리하거나 되돌리지 않는다.

## Stop Rule

최종 PM/Judge audit가 전체 원래 목표의 완료를 증명할 때만 멈춘다.

계획·조사·Judge 선택·한 Worker slice·한 Gate 완료를 전체 종료 사유로 사용하지 않는다. 안전하게 진행 가능한 다음 task를 즉시 활성화해 계속한다.

자격 증명이나 외부 제공자 접근이 없는 경우 해당 실제 smoke task만 차단 영수증으로 남기고, fake provider·로컬 비밀 경계·패키징·실패 주입 등 안전한 로컬 증거를 계속 완성한다.

## Canonical Board

Machine truth lives at:

`docs/goals/approved-poc-plan-completion/state.yaml`

이 charter와 `state.yaml`이 충돌하면 task 상태, active task, receipt, 검증 freshness와 완료 판정은 `state.yaml`이 우선한다.

## Run Command

```text
/goal Follow docs/goals/approved-poc-plan-completion/goal.md.
```

## PM Loop

1. 이 charter와 `state.yaml`을 읽는다.
2. 현재 active task 하나만 수행한다.
3. 각 behavioral delta를 승인 계획 요구사항에 일대일로 연결한다.
4. 실패 검증을 확인한 뒤 최소 구현을 작성한다.
5. task receipt와 최신 검증을 `state.yaml`에 기록한다.
6. Gate audit가 통과하면 해당 Gate 전체를 커밋·`origin/main` 푸시한다.
7. slice·Gate audit를 전체 종료가 아니라 다음 task의 checkpoint로 취급한다.
8. 최종 audit만 `full_outcome_complete: true`를 선언할 수 있다.
