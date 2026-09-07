import { usePublishStudioTools } from "./StudioToolContext";

export const WORKSPACE_TOOL_DEFINITIONS = [
  { id: "write", label: "원고로 돌아가기", detail: "열어 둔 회차에서 집필을 이어갑니다.", group: "집필", keywords: ["쓰기", "편집기"] },
  { id: "focus", label: "집중 화면", detail: "원고만 넓게 보고 집필합니다.", group: "집필", keywords: ["전체 화면", "집중 모드"] },
  { id: "reading", label: "이어 읽기", detail: "회차를 이어 읽고 원고의 흐름을 확인합니다.", group: "집필", keywords: ["연속 읽기", "미리보기"] },
  { id: "fragments", label: "파편 서랍", detail: "남겨 둔 문장과 아이디어를 모아 봅니다.", group: "집필", keywords: ["보관", "메모", "문장"] },
  { id: "forward", label: "수정금지 집필", detail: "목표 글자 수를 정하고 멈추지 않고 씁니다.", group: "집필", keywords: ["집필 모드", "초고"] },
  { id: "export", label: "전체 다운로드", detail: "원하는 회차를 골라 TXT 파일로 저장합니다.", group: "집필", keywords: ["내보내기", "텍스트", "저장", "백업"] },
  { id: "import", label: "원고 TXT 가져오기", detail: "파일을 미리 보고 현재 회차에 적용합니다.", group: "집필", keywords: ["불러오기", "텍스트"] },
  { id: "overview", label: "작품 구조 개요", detail: "회차·인물·플롯·장면의 연결을 살펴봅니다.", group: "이야기 구성", keywords: ["전체 구조"] },
  { id: "characters", label: "인물 관리", detail: "인물과 관계를 정리하고 인물 뽑기를 사용합니다.", group: "이야기 구성", keywords: ["캐릭터", "관계", "인물 뽑기"] },
  { id: "plots", label: "플롯 관리", detail: "플롯을 구성하고 사건 아이디어를 뽑습니다.", group: "이야기 구성", keywords: ["사건 뽑기", "보드"] },
  { id: "events", label: "사건 관리", detail: "예정 사건과 원고에 연결된 사건을 정리합니다.", group: "이야기 구성", keywords: ["사건 추가"] },
  { id: "scenes", label: "장면 관리", detail: "장면의 경계와 원고 연결을 확인합니다.", group: "이야기 구성", keywords: ["장면 나누기", "분할", "합치기"] },
  { id: "foreshadow", label: "복선 관리", detail: "심은 복선과 회수 지점을 연결합니다.", group: "이야기 구성", keywords: ["떡밥", "회수"] },
  { id: "lore", label: "별빛 관리", detail: "작품 설정과 별칭, 원고 근거를 추가·편집합니다.", group: "이야기 구성", keywords: ["세계관", "설정집", "별빛 추가"] },
  { id: "canon", label: "확정된 별빛", detail: "인물·관계·설정을 한곳에서 검색합니다.", group: "별빛·연속성", keywords: ["정본", "설정"] },
  { id: "canon-review", label: "별빛 변경 검토", detail: "제안된 변경을 살펴보고 승인하거나 기각합니다.", group: "별빛·연속성", keywords: ["후보", "승인"] },
  { id: "continuity", label: "연속성", detail: "아직 이어져야 할 약속과 사건을 추적합니다.", group: "별빛·연속성", keywords: ["열린 연속성", "점검"] },
  { id: "knowledge", label: "인물 지식", detail: "각 인물이 무엇을 알고 있는지 확인합니다.", group: "별빛·연속성", keywords: ["정보", "인물별"] },
  { id: "digest", label: "이야기 흐름", detail: "장면 요약과 이야기의 변화 이력을 읽습니다.", group: "별빛·연속성", keywords: ["요약", "장면 이력"] },
  { id: "context", label: "문맥·활동", detail: "조수에게 전달할 문맥과 사용 기록을 확인합니다.", group: "별빛·연속성", keywords: ["AI", "컨텍스트"] },
  { id: "preflight", label: "원고 점검", detail: "문장·공백을 점검하고 선택한 범위를 정리합니다.", group: "검토·기록", keywords: ["정리", "교정"] },
  { id: "analysis", label: "원고 분석", detail: "반복 어휘와 문장 길이를 살펴봅니다.", group: "검토·기록", keywords: ["통계", "반복 단어"] },
  { id: "candidates", label: "후보 검토함", detail: "추출한 인물·장면·별빛 후보를 검토합니다.", group: "검토·기록", keywords: ["조수", "승인", "AI"] },
  { id: "records", label: "집필 기록", detail: "집필 시간·글자 수·목표·연독률을 확인합니다.", group: "검토·기록", keywords: ["통계", "기록 내보내기", "조회수"] },
  { id: "versions", label: "버전과 기준점", detail: "저장된 원고를 비교하고 이전 버전을 확인합니다.", group: "검토·기록", keywords: ["복구", "복원", "스냅샷"] },
  { id: "goal", label: "오늘 목표", detail: "오늘 쓸 글자 수와 집중 시간을 정합니다.", group: "집필 환경", keywords: ["일일 목표"] },
  { id: "pomodoro", label: "집중 시간 설정", detail: "작업·휴식 시간과 반복 횟수를 정합니다.", group: "집필 환경", keywords: ["뽀모도로", "타이머"] },
  { id: "schedule", label: "작업 일정", detail: "일정과 마감일, 회차 완료 계획을 관리합니다.", group: "집필 환경", keywords: ["달력", "디데이", "D-DAY"] },
  { id: "music", label: "음악 라이브러리", detail: "로컬 음악·영상과 재생목록을 관리합니다.", group: "집필 환경", keywords: ["선곡", "MP3", "MP4", "YouTube"] },
] as const;

export type WorkspaceToolId = typeof WORKSPACE_TOOL_DEFINITIONS[number]["id"];

export function WorkspaceTools(input: Readonly<{
  actions: Readonly<Record<WorkspaceToolId, () => void>>;
  disabledReason: string | null;
  editingDisabledReason: string | null;
}>) {
  usePublishStudioTools(WORKSPACE_TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    id: `workspace-tool:${tool.id}`,
    disabledReason: input.disabledReason ?? (
      tool.id === "import" || tool.id === "forward"
        ? input.editingDisabledReason
        : null
    ),
    run: input.actions[tool.id],
  })));
  return null;
}
