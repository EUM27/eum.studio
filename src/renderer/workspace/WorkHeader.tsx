import { CalendarDays, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import type { WorkSection } from "../navigation/studio-location";
import { WorkPrimaryNavigation } from "../navigation/WorkPrimaryNavigation";

export type WorkHeaderScheduleSummary = Readonly<{
  todayCount: number;
  nearestDday: Readonly<{
    label: string;
    days: number;
  }> | null;
}>;

function ddayLabel(days: number): string {
  return days === 0 ? "D-DAY" : `D-${days}`;
}

export function WorkHeader(input: {
  readonly activeSection: WorkSection;
  readonly actions?: ReactNode | undefined;
  readonly heading: string;
  readonly headingTestId?: string | undefined;
  readonly navigationDisabled?: boolean;
  readonly onBack: () => void;
  readonly onOpenSchedule: () => void;
  readonly onSectionChange: (section: WorkSection) => void;
  readonly returnAction?: Readonly<{
    label: string;
    onClick: () => void;
  }> | undefined;
  readonly schedule: WorkHeaderScheduleSummary | null;
  readonly titleEditor?: ReactNode | undefined;
  readonly workTitle: string;
}) {
  return (
    <header className="work-header manuscript-header manuscript-header-embedded">
      <div className="work-header-location">
        <button
          aria-label="작품 목록으로 돌아가기"
          className="work-header-back"
          disabled={input.navigationDisabled}
          onClick={input.onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          <span>작품</span>
        </button>
        <div className="manuscript-title-block work-header-title-block">
          <span className="work-header-work-title">{input.workTitle}</span>
          <span aria-hidden="true" className="work-header-title-divider">/</span>
          <h2 data-testid={input.headingTestId} id="manuscript-heading">
            {input.heading}
          </h2>
          {input.returnAction !== undefined && (
            <button
              className="work-header-return"
              disabled={input.navigationDisabled}
              onClick={input.returnAction.onClick}
              type="button"
            >
              {input.returnAction.label}
            </button>
          )}
          {input.titleEditor}
        </div>
      </div>

      <WorkPrimaryNavigation
        activeSection={input.activeSection}
        disabled={input.navigationDisabled === true}
        onChange={input.onSectionChange}
      />

      <div className="work-header-tools">
        <button
          aria-label="작업 일정 열기"
          className="work-header-schedule"
          disabled={input.navigationDisabled}
          onClick={input.onOpenSchedule}
          type="button"
        >
          <span>{`오늘 ${input.schedule?.todayCount ?? 0}`}</span>
          {input.schedule?.nearestDday !== null &&
            input.schedule?.nearestDday !== undefined && (
              <span title={input.schedule.nearestDday.label}>
                {ddayLabel(input.schedule.nearestDday.days)}
              </span>
            )}
          <CalendarDays aria-hidden="true" size={16} />
        </button>
        {input.actions}
      </div>
    </header>
  );
}
