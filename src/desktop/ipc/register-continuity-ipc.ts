import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  CONTINUITY_CREATE_CHANNEL,
  CONTINUITY_DISMISS_CHANNEL,
  CONTINUITY_LIST_CHANNEL,
  CONTINUITY_RESOLVE_CHANNEL,
  CONTINUITY_REVIEW_DECIDE_CHANNEL,
  CONTINUITY_REVIEW_LIST_CHANNEL,
  CONTINUITY_REVIEW_RUN_CHANNEL,
  CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL,
  CONTINUITY_UPDATE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseDecideContinuityReviewItemCommand,
  parseListContinuityReviewCandidatesCommand,
  parseRunContinuityReviewCommand,
  parseUpdateContinuityReviewItemCommand,
  type ContinuityReviewCandidate,
  type ContinuityReviewCandidateList,
  type ContinuityReviewDecisionResult,
  type ContinuityReviewResult,
  type DecideContinuityReviewItemCommand,
  type ListContinuityReviewCandidatesCommand,
  type RunContinuityReviewCommand,
  type UpdateContinuityReviewItemCommand,
} from "../../application/continuity/continuity-review-contract";
import {
  parseCreateContinuityThreadCommand,
  parseDismissContinuityThreadCommand,
  parseListContinuityThreadsCommand,
  parseResolveContinuityThreadCommand,
  parseUpdateContinuityThreadCommand,
  type ContinuityOverviewProjection,
  type ContinuityThreadProjection,
  type CreateContinuityThreadCommand,
  type DismissContinuityThreadCommand,
  type ListContinuityThreadsCommand,
  type ResolveContinuityThreadCommand,
  type UpdateContinuityThreadCommand,
} from "../../application/continuity/continuity-thread-contract";

export type ContinuityIpcRuntime = Readonly<{
  createContinuityThread(
    command: CreateContinuityThreadCommand,
  ): Promise<ContinuityThreadProjection>;
  updateContinuityThread(
    command: UpdateContinuityThreadCommand,
  ): Promise<ContinuityThreadProjection>;
  listContinuityThreads(
    command: ListContinuityThreadsCommand,
  ): Promise<ContinuityOverviewProjection>;
  resolveContinuityThread(
    command: ResolveContinuityThreadCommand,
  ): Promise<ContinuityThreadProjection>;
  dismissContinuityThread(
    command: DismissContinuityThreadCommand,
  ): Promise<ContinuityThreadProjection>;
  runContinuityReview(
    command: RunContinuityReviewCommand,
  ): Promise<ContinuityReviewResult>;
  listContinuityReviewCandidates(
    command: ListContinuityReviewCandidatesCommand,
  ): Promise<ContinuityReviewCandidateList>;
  updateContinuityReviewItem(
    command: UpdateContinuityReviewItemCommand,
  ): Promise<ContinuityReviewCandidate>;
  decideContinuityReviewItem(
    command: DecideContinuityReviewItemCommand,
  ): Promise<ContinuityReviewDecisionResult>;
}>;

export function registerContinuityIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender(event: IpcMainInvokeEvent): void;
  runtime: ContinuityIpcRuntime;
}>): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ) => input.ipcMain.handle(channel, (event, value: unknown) => {
    input.authorizeSender(event);
    return run(parse(value));
  });
  handle(CONTINUITY_CREATE_CHANNEL, parseCreateContinuityThreadCommand, input.runtime.createContinuityThread);
  handle(CONTINUITY_UPDATE_CHANNEL, parseUpdateContinuityThreadCommand, input.runtime.updateContinuityThread);
  handle(CONTINUITY_LIST_CHANNEL, parseListContinuityThreadsCommand, input.runtime.listContinuityThreads);
  handle(CONTINUITY_RESOLVE_CHANNEL, parseResolveContinuityThreadCommand, input.runtime.resolveContinuityThread);
  handle(CONTINUITY_DISMISS_CHANNEL, parseDismissContinuityThreadCommand, input.runtime.dismissContinuityThread);
  handle(CONTINUITY_REVIEW_RUN_CHANNEL, parseRunContinuityReviewCommand, input.runtime.runContinuityReview);
  handle(
    CONTINUITY_REVIEW_LIST_CHANNEL,
    parseListContinuityReviewCandidatesCommand,
    input.runtime.listContinuityReviewCandidates,
  );
  handle(
    CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL,
    parseUpdateContinuityReviewItemCommand,
    input.runtime.updateContinuityReviewItem,
  );
  handle(
    CONTINUITY_REVIEW_DECIDE_CHANNEL,
    parseDecideContinuityReviewItemCommand,
    input.runtime.decideContinuityReviewItem,
  );
}
