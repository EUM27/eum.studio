# 이음 스튜디오 장면 편집 정상화

## Objective

`D:\eum.studio`의 현재 승인 설계와 실제 production 경로를 기준으로 첨부 검토안의 사실관계를 다시 확인하고, 이미 구현된 동작은 중복 재작성하지 않으면서 아직 남은 P0 장면 편집 결함을 안전한 명령·원장·UI·복구 계약으로 완성한다.

## Original Request

`골잡고 실행`

첨부 검토안의 1차 권장 범위:

- 안정적인 장면 식별과 lineage
- 명시적 장면 분할·병합 명령
- 선택 장면과 커서 위치, revision, IME, 중복 경계 검증
- 장면 삭제 미리보기·휴지통·복원
- 분할·병합·삭제 뒤 주석·사건·음악 연결 유지 또는 명시적 검토 상태

## Intake Summary

- Input shape: `existing_plan`
- Audience: 이음 스튜디오 사용자와 장면 편집 경계를 유지보수할 개발자
- Authority: `approved`
- Proof type: `test`, `demo`, `artifact`, `review`
- Completion proof: 현재 source와 승인 계약이 P0 장면 편집 요구를 실제 production 경로에서 구현하고, focused 단위·통합 검증, production build, 관련 Electron E2E, 최종 source/원장 감사가 통과한다.
- Likely misfire: 첨부 정적 검토를 현재 코드보다 우선해 이미 존재하는 `sceneId`·삭제 경로를 중복 구현하거나, 장면 projection을 불필요하게 새 원본으로 바꾸거나, 테스트만 통과하는 우회 경로를 만드는 것.
- Blind spots considered: 첨부 검토 이후 이미 들어온 장면 identity·교차 회차 segment·삭제 수정, 현재 대규모 dirty worktree, 승인 ADR의 파생 `SceneProjection` 원칙, 기존 사용자의 `장면 삭제` 의미 정정, 실사용 원고를 건드리는 파괴적 검증 위험, 현재 test suite의 알려진 실패.
- Existing plan facts: 첨부의 `1차: 장면 편집 정상화`를 우선하되, `plan.md`와 `docs/architecture/plot-event-scene-model.md`의 현재 계약 및 최신 source evidence로 각 항목을 검증한 후 아직 없는 항목만 한 Gate씩 구현한다.

## Goal Kind

`existing_plan`

## Current Tranche

P0 장면 편집 정상화를 전체 owner outcome으로 삼는다. 먼저 첨부 주장과 현재 source·dirty diff·테스트·승인 ADR의 차이를 읽기 전용으로 매핑하고, 가장 작은 미완성 동작부터 실패 검증을 만든 뒤 production 경로에 구현한다. 각 slice 뒤 감사에서 전체 P0가 아직 끝나지 않았으면 다음 안전 slice로 즉시 진행한다.

## Non-Negotiable Constraints

- 정확한 작업 대상은 `D:\eum.studio`다. `D:\eum.editor`는 읽기 전용이며 쓰지 않는다.
- 기존 dirty diff를 사용자 소유로 취급하고 되돌리거나 덮어쓰지 않는다.
- 승인 manifest가 불일치하면 구현을 중단하고 diff를 검토한다.
- 장면·사건·플롯 원본 및 파생 projection 경계는 현재 승인 ADR과 실제 후속 schema를 함께 검증한 뒤에만 바꾼다.
- 원고 변경은 명시적 편집 명령으로만 수행하고, 선택 범위를 임의로 확장하지 않는다.
- destructive flow 검증은 실사용 DB가 아니라 완전한 격리 복제본에서만 수행한다.
- IME 조합, stale revision, 중복 경계, 교차 회차 identity/segment를 성공 경로와 함께 검증한다.
- 신규 dependency, 커밋, 푸시는 이번 목표에 포함하지 않는다.
- 한 번에 하나의 write-capable task만 활성화한다.

## Stop Rule

Stop only when a final audit proves the full original P0 outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker slice when another required P0 slice can safely proceed.

If one destructive or policy-sensitive slice needs owner input, block only that slice and continue every safe local task that advances the P0 outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/eum-studio-scene-editing-normalization/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/eum-studio-scene-editing-normalization/goal.md.
```

## PM Loop

1. Read this charter and `state.yaml`.
2. Re-check current source, dirty scope, applicable instructions, manifest, and active task.
3. Work only on the active task and respect Worker `allowed_files`.
4. Record a compact receipt with fresh commands and evidence.
5. Activate the next safe task immediately unless a final audit proves the full P0 outcome complete.
6. Treat source, actual execution, and isolated destructive-flow evidence as authoritative over the attachment or prior reports.
