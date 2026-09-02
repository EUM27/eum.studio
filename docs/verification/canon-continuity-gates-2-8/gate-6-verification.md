# Gate 6 — 장면 통합 검증

Gate 6은 schema 16의 기존 `scene_identities`, `scene_episode_segments`, `scene_lineage_operations`, `scene_lineage_members`를 그대로 사용한다. 새 장면 식별 체계는 추가하지 않았다.

사용자가 장면 카드의 `이 장면 별빛 점검`을 누른 경우에만 현재 DocumentRevision과 exact 장면 범위를 다시 확인하고 stable `sceneId`를 확정한다. 그 범위로 기존 Canon review를 실행하며 저장·blur에는 연결하지 않는다. 같은 카드에서 해당 Scene을 직접 참조하는 열린 연속성 및 인물 지식 상태를 읽는다.

split/merge 뒤에는 parent Scene 참조와 child 후보를 lineage로 계산해 `needs-review`로 표시한다. ContinuityThread나 CharacterKnowledge 참조를 자동 복사·변경하거나 새 사실을 추론하지 않는다. 사용자는 별빛 작업면에서 기존 update 명령으로 대상 참조를 명시적으로 결정한다.

## 최신 증거

- 계약·SceneList 집중 검증 6개, 실제 local workspace의 stable ID 확정→장면 연속성/지식→split review→재시작 검증 통과
- production Electron에서 수동 확정, Canon 점검 진입, 연속성 1건·지식 1건, split 경고, 원본 sceneId 참조 유지, child 자동 상속 0건, FK 0, 완전 재실행 통과
- 전체 Vitest: 310파일·1,137개 통과, 1개 skip, 시작 시점과 같은 `RuntimeBootstrapController.test.ts:343` 1개 실패만 유지
- lint, 4개 TypeScript project, architecture, production build, diff check 통과

성능 fixture는 제품 제한이나 사용자 기본값이 아니다. 500 Scene·1,000 참조의 lineage review 1,000건 projection은 p50/p95 7.4450/9.1281ms였고 자동 참조 mutation은 0건이다.
