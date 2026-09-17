# f8215a5 검토 항목 완료

사용자 요청: 2026-09-05 코드 리뷰의 8개 항목을 목표로 잡고 끝까지 해결한다.

기준: `D:\eum.studio`, `codex/complete-studio-workflows`, 시작 HEAD `f8215a5bcb8fdab7f2970583fad3122a4382f020`, 시작 working tree clean.

범위와 완료 조건:

1. TXT는 같은 디렉터리 staging에 write/sync/readback 후 교체한다. 쓰기·검증·교체 실패와 Windows 잠금에서 기존 파일 bytes가 보존된다.
2. 선택 ID를 전체 metadata로 검증하고 순서대로 선택 회차 본문만 읽는다. 실제 controller 테스트가 미선택 read 0을 증명한다.
3. 완전 백업의 미디어 검증은 유지한다. 명시적 미디어 미포함 백업 모드는 원고·원장·리비전을 생성하고 빈 위치에 복원하며 UI와 manifest에 제한을 표시한다.
4. 자동 장면 분석은 Work와 요청 generation으로 늦은 성공·실패·retry 상태를 차단한다.
5. structured JSON HTTP 어댑터부터 UI까지 runtime 정책의 제한 시간·취소·응답 크기를 연결하고 서로 다른 오류로 반환한다.
6. 중앙 local-workspace-runtime의 업무별 소유권과 transaction을 유지한 채 실서비스로 분리하고 bootstrap/실제 IPC와 서비스 의존성을 구조 검사에 포함한다.
7. 기본 check에 구조 검사를 포함하고 핵심 저장·재열기·선택 다운로드·백업 복원을 자동 필수 검증으로 묶는다. 무거운 검증은 현재 SHA와 dirty source fingerprint를 남긴다.
8. 복구 원본은 소스 밖 별도 보관으로 checksum 검증 후 분리한다. 스크립트는 유지하고 재유입을 막는다. Git 이력 재작성과 원본 영구 삭제는 하지 않는다.

원고 저장의 identity/idempotency/sequence/transaction, 승인 Candidate, 소유권, secret/IPC 경계를 보존한다. 레거시와 실사용 workspace는 수정하지 않는다. 실행 중 기본 설치본을 종료·교체하지 않는다. 커밋·푸시는 요청 범위가 아니다.

Oracle: 항목별 실제 경로 회귀 + 전체 check + 격리된 production Electron 핵심 E2E + 별도 Windows 후보 package 검증 + source fingerprint와 복구 원본 hash manifest.

실패하기 쉬운 판정: helper만 통과하고 production 호출부를 누락하거나, 미디어 제외를 완전 성공으로 표시하거나, 큰 함수를 다른 한 파일로 옮긴 뒤 분리 완료라 하는 것. 최종 PM audit는 8개 항목의 실제 경로와 최신 증거를 모두 대조한다.
