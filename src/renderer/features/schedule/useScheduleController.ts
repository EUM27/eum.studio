import { useCallback, useEffect, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { WorkCalendarProjection } from "../../../application/schedule/work-calendar-contract";
import type { EntityId } from "../../../domain/writing";
import { localDateKey } from "../../schedule/work-schedule-summary";

export function useScheduleController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: Pick<StudioBridge["schedule"], "listCalendar">;
  onScheduleChange?: () => void;
  settingsRevision: number;
}>) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [workSchedule, setWorkSchedule] =
    useState<WorkCalendarProjection | null>(null);
  const [scheduleRefreshRevision, setScheduleRefreshRevision] = useState(0);

  useEffect(() => {
    if (input.activeWorkId === null) {
      const reset = window.setTimeout(() => {
        setWorkSchedule(null);
        setShowSchedule(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let disposed = false;
    const today = localDateKey();
    void input.client.listCalendar({
      schemaVersion: 1,
      workId: input.activeWorkId,
      range: { from: today, to: today },
    }).then(
      (projection) => {
        if (!disposed) setWorkSchedule(projection);
      },
      () => {
        if (!disposed) setWorkSchedule(null);
      },
    );
    return () => {
      disposed = true;
    };
  }, [
    input.activeWorkId,
    input.client,
    input.settingsRevision,
    scheduleRefreshRevision,
  ]);

  const openSchedule = useCallback(() => {
    if (input.activeWorkId !== null) setShowSchedule(true);
  }, [input.activeWorkId]);

  const closeSchedule = useCallback(() => {
    setShowSchedule(false);
    setScheduleRefreshRevision((current) => current + 1);
    input.onScheduleChange?.();
  }, [input]);

  useEffect(() => {
    if (!showSchedule) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        document.querySelector(".schedule-item-dialog") !== null
      ) return;
      event.preventDefault();
      closeSchedule();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [closeSchedule, showSchedule]);

  return {
    showSchedule,
    workSchedule,
    openSchedule,
    closeSchedule,
  };
}
