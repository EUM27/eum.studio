# Gate 7 — 기준점과 대체 전개 검증

Gate 7은 기존 불변 `WorkSnapshot` 행과 `label`을 그대로 재사용한다. 같은 이름으로 새 기준점을 만들면 가장 최근 행이 현재 슬롯이 되고 이전 행은 삭제·갱신되지 않은 이력으로 남는다. 별도 기준점 저장 원본이나 수정 가능한 분기 원장은 만들지 않았다.

스냅샷을 만들 때 기존 `structure_revision_refs_json`에 stable Scene의 exact DocumentRevision·범위를 담은 versioned manifest를 함께 봉인한다. 비교 시에는 현재 Scene segment와 불변 manifest를 다시 읽어 `unchanged`, `changed`, `added-after-snapshot`, `removed-after-snapshot`을 계산한다. 오래된 스냅샷처럼 장면 manifest가 없으면 `snapshot-structure-unavailable`로 명시하고 사실을 추정하지 않는다.

장면 checkbox는 적용 대상이 아니라 read-only 선택 계획만 바꾼다. 계약은 `mode: read-only-selection-plan`, `automaticMergeAllowed: false`, `canApply: false`, `applyCommand: null`을 강제하며 renderer에는 병합·적용 버튼이나 명령이 없다. 자동 전체 병합은 별도 ADR 전까지 구현하지 않았다.

## 최신 증거

- 순수 계약·기존 WorkSnapshot 비교·dialog 4개 파일 6개 검증 통과
- 실제 local workspace에서 같은 이름의 불변 스냅샷 2개, 현재 슬롯 1개와 이전 이력 1개, 대체 장면 added/removed, 선택 계획 무저장, 재시작 동일성, FK 0 통과
- 새 production Electron에서 슬롯 생성→원고 변경→대체 Scene 확정→같은 슬롯 재생성→이력 비교→장면 선택→적용 명령 0→완전 재실행을 검증했고, 기존 immutable WorkSnapshot 문서 비교 회귀도 같은 build에서 통과
- 전체 Vitest: 311파일·1,140개 통과, 1개 skip, 시작 시점과 같은 `RuntimeBootstrapController.test.ts:343` 1개 실패만 유지
- lint, 4개 TypeScript project, architecture, production build, diff check 통과

성능 fixture는 제품 제한이나 사용자 데이터 기본값이 아니다. 1,000개 스냅샷을 100개 슬롯으로 투영한 p50/p95는 0.2053/0.3289ms, 500개 장면의 read-only 선택 계획 파싱 p50/p95는 0.9076/2.6638ms였다. 자동 병합 허용과 적용 명령 생성은 모두 false다.
