import type { PomodoroProjection } from "../../../application/activity/pomodoro-contract";
import type { WorkActivityProjection } from "../../../application/activity/work-activity-contract";
import type { WorkReadthroughProjection } from "../../../application/activity/work-readthrough-calculator";
import type { WorkRecordsGoalsProjection } from "../../../application/activity/work-records-preferences";
import type { EntityId } from "../../../domain/writing";
import type { ActivityWorkBundleClient } from "./activity-client";

export type ActivityWorkBundle = readonly [
  WorkActivityProjection,
  PomodoroProjection,
  WorkRecordsGoalsProjection,
  WorkReadthroughProjection,
];

export function loadActivityWorkBundle(
  client: ActivityWorkBundleClient,
  workId: EntityId<"Work">,
): Promise<ActivityWorkBundle> {
  return Promise.all([
    client.listWork({ schemaVersion: 1, workId }),
    client.getPomodoro({ schemaVersion: 1, workId }),
    client.getRecordsGoals({ schemaVersion: 1, workId }),
    client.getReadthrough({ schemaVersion: 1, workId }),
  ]);
}
