# 이음 스튜디오 비음악 기능 완성

## Objective

`D:\eum.editor`에서 확인한 사용자 기능 가운데 음악 관련 기능을 제외한 나머지를 `D:\eum.studio`의 승인 아키텍처와 로컬 우선 원칙에 맞게 구현하고, 실제 패키징된 Electron 앱에서 각 사용자 흐름을 검증한다.

## Original Request

음악은 일단 빼고 나머지는 목표 삼아서 구현 시작해.

## Intake Summary

- Input shape: `existing_plan`
- Audience: 이음 스튜디오에서 장편 원고를 집필하고 작품 운영 기능을 사용하는 사용자
- Authority: `requested`
- Proof type: `demo`
- Completion proof: 레거시 비교표의 음악 제외 기능이 모두 현재 스튜디오에서 실제 동작하고, 각 단계의 좁은 테스트와 패키징 Electron E2E 및 실제 앱 사용자 흐름 검증이 통과하며, 최종 감사에서 전체 목표 완료가 증명된다.
- Likely misfire: 화면 껍데기나 임시 데이터를 기능으로 간주하거나, 레거시 코드를 통째로 복사해 현재 작품 소유권·정확한 선택 범위·불변 revision·로컬 우선 경계를 훼손하는 것.
- Blind spots considered: 현재 작업 트리가 이미 크게 수정돼 있음, `plan.md`의 다음 Gate가 POC-M임, 외부 조수·투고 연결은 자격 증명과 권한 계약이 필요함, 레거시의 이전 화 흐름과 새 연속 읽기 모드는 서로 다른 기능임.
- Existing plan facts: POC-3 완료 및 POC-M 다음 Gate, 이전 화 흐름 최우선, 빈 회차 제목은 정확히 `제목없음`, `D:\eum.editor` 읽기 전용, Lazyweb 금지, 하드코딩 금지, 커밋·푸시는 별도 요청 전 금지.

## Goal Kind

`existing_plan`

## Current Tranche

기존 계획과 이번 기능 목표를 충돌 없이 재배치한 뒤, `이전 화 흐름`부터 하나의 검증 가능한 기능 단위씩 구현한다. 이후 회차·작품 관리, 원고 점검·내보내기, 파편·복선, 인물·플롯·구조, 기록·버전·집중, 별지도·검토함, 홈 일정·빠른 도구·설정, 조수, 투고 운영 순서로 계속 진행한다.

## Non-Negotiable Constraints

- 음악, Spotify, 음악 추천·재생·프로필·설정은 이 목표에서 전부 제외한다.
- `D:\eum.editor`는 읽기 전용 근거이며 수정하거나 통째로 복사하지 않는다.
- 원고가 주인공이며 정확한 선택 범위와 작품·문서 소유권을 보존한다.
- domain/application/platform/Electron/preload/renderer 경계를 보존한다.
- 파생 뷰를 독립 원본으로 중복 저장하지 않는다.
- 외부 조수·메일·가져오기 결과는 승인 전 Candidate로 유지한다.
- 제공자, 모델, endpoint, 사용자 경로, 작품·문서 ID와 이름을 하드코딩하지 않는다.
- 현재 dirty working tree의 기존 변경을 사용자 소유로 취급하고 되돌리지 않는다.
- 기능·버그 수정은 성공 경로 검증을 먼저 정의하고, 고의 실패만을 위한 테스트는 만들지 않는다.
- 사용자에게 보이는 변경은 실제 패키징 앱 또는 승인된 Electron 런타임에서 검증한다.
- 커밋과 푸시는 사용자가 다시 요청할 때만 한다.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if the user asked for working software or automation and a safe Worker task can be activated.

Do not stop after a single verified Worker slice when the broader owner outcome still has safe local follow-up slices. After each slice audit, advance the board to the next highest-leverage safe Worker task and continue.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/eum-studio-non-music-feature-parity/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/eum-studio-non-music-feature-parity/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Re-read repository instructions and the current Gate documents before product edits.
4. Re-check the intake, dirty working tree, active task, and required proof.
5. Work only on the active board task.
6. Use Scout, Judge, Worker, or PM responsibility according to the task; use PM fallback when a dedicated agent is unavailable.
7. Write a compact task receipt and update the board immediately.
8. Activate and execute the next safe bounded task without waiting for the user unless a genuine authority decision is required.
9. Treat each slice audit as a checkpoint, not completion.
10. Finish only with a Judge or PM receipt that records `full_outcome_complete: true` and maps every non-music inventory row to current implementation and verification evidence.

