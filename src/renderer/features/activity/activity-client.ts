import type { StudioBridge } from "../../../application/contracts/studio-bridge";

export type ActivityWorkBundleClient = Pick<
  StudioBridge["activity"],
  "listWork" | "getPomodoro" | "getRecordsGoals" | "getReadthrough"
>;
