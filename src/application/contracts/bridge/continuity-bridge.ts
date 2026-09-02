import {
  parseContinuityReviewCandidate,
  parseContinuityReviewCandidateList,
  parseContinuityReviewDecisionResult,
  parseContinuityReviewResult,
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
} from "../../continuity/continuity-review-contract";
import {
  parseCreateContinuityThreadCommand,
  parseDismissContinuityThreadCommand,
  parseListContinuityThreadsCommand,
  parseContinuityOverviewProjection,
  parseContinuityThreadProjection,
  parseResolveContinuityThreadCommand,
  parseUpdateContinuityThreadCommand,
  type ContinuityOverviewProjection,
  type ContinuityThreadProjection,
  type CreateContinuityThreadCommand,
  type DismissContinuityThreadCommand,
  type ListContinuityThreadsCommand,
  type ResolveContinuityThreadCommand,
  type UpdateContinuityThreadCommand,
} from "../../continuity/continuity-thread-contract";

export const CONTINUITY_CREATE_CHANNEL = "studio:continuity:create";
export const CONTINUITY_UPDATE_CHANNEL = "studio:continuity:update";
export const CONTINUITY_LIST_CHANNEL = "studio:continuity:list";
export const CONTINUITY_RESOLVE_CHANNEL = "studio:continuity:resolve";
export const CONTINUITY_DISMISS_CHANNEL = "studio:continuity:dismiss";
export const CONTINUITY_REVIEW_RUN_CHANNEL = "studio:continuity:run-review";
export const CONTINUITY_REVIEW_LIST_CHANNEL = "studio:continuity:list-candidates";
export const CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL = "studio:continuity:update-item";
export const CONTINUITY_REVIEW_DECIDE_CHANNEL = "studio:continuity:decide-item";

export type ContinuityBridgeChannel =
  | typeof CONTINUITY_CREATE_CHANNEL
  | typeof CONTINUITY_UPDATE_CHANNEL
  | typeof CONTINUITY_LIST_CHANNEL
  | typeof CONTINUITY_RESOLVE_CHANNEL
  | typeof CONTINUITY_DISMISS_CHANNEL
  | typeof CONTINUITY_REVIEW_RUN_CHANNEL
  | typeof CONTINUITY_REVIEW_LIST_CHANNEL
  | typeof CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL
  | typeof CONTINUITY_REVIEW_DECIDE_CHANNEL;

export type ContinuityBridgePayload =
  | CreateContinuityThreadCommand
  | UpdateContinuityThreadCommand
  | ListContinuityThreadsCommand
  | ResolveContinuityThreadCommand
  | DismissContinuityThreadCommand
  | RunContinuityReviewCommand
  | ListContinuityReviewCandidatesCommand
  | UpdateContinuityReviewItemCommand
  | DecideContinuityReviewItemCommand;

export type ContinuityBridge = Readonly<{
  create(command: CreateContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  update(command: UpdateContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  list(command: ListContinuityThreadsCommand): Promise<ContinuityOverviewProjection>;
  resolve(command: ResolveContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  dismiss(command: DismissContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  runReview(command: RunContinuityReviewCommand): Promise<ContinuityReviewResult>;
  listCandidates(
    command: ListContinuityReviewCandidatesCommand,
  ): Promise<ContinuityReviewCandidateList>;
  updateItem(command: UpdateContinuityReviewItemCommand): Promise<ContinuityReviewCandidate>;
  decideItem(
    command: DecideContinuityReviewItemCommand,
  ): Promise<ContinuityReviewDecisionResult>;
}>;

export type ContinuityBridgeInvoke = (
  channel: ContinuityBridgeChannel,
  payload?: ContinuityBridgePayload,
) => Promise<unknown>;

function parseResult<T>(
  value: unknown,
  parser: (value: unknown) => T,
  message: string,
): T {
  try {
    return parser(value);
  } catch {
    throw new Error(message);
  }
}

export function createContinuityBridge(
  invoke: ContinuityBridgeInvoke,
): ContinuityBridge {
  return Object.freeze({
    create: async (command) => parseResult(
      await invoke(CONTINUITY_CREATE_CHANNEL, parseCreateContinuityThreadCommand(command)),
      parseContinuityThreadProjection,
      "Invalid Continuity thread creation",
    ),
    update: async (command) => parseResult(
      await invoke(CONTINUITY_UPDATE_CHANNEL, parseUpdateContinuityThreadCommand(command)),
      parseContinuityThreadProjection,
      "Invalid Continuity thread update",
    ),
    list: async (command) => parseResult(
      await invoke(CONTINUITY_LIST_CHANNEL, parseListContinuityThreadsCommand(command)),
      parseContinuityOverviewProjection,
      "Invalid Continuity overview",
    ),
    resolve: async (command) => parseResult(
      await invoke(CONTINUITY_RESOLVE_CHANNEL, parseResolveContinuityThreadCommand(command)),
      parseContinuityThreadProjection,
      "Invalid Continuity resolution",
    ),
    dismiss: async (command) => parseResult(
      await invoke(CONTINUITY_DISMISS_CHANNEL, parseDismissContinuityThreadCommand(command)),
      parseContinuityThreadProjection,
      "Invalid Continuity dismissal",
    ),
    runReview: async (command) => parseResult(
      await invoke(CONTINUITY_REVIEW_RUN_CHANNEL, parseRunContinuityReviewCommand(command)),
      parseContinuityReviewResult,
      "Invalid Continuity review result",
    ),
    listCandidates: async (command) => parseResult(
      await invoke(
        CONTINUITY_REVIEW_LIST_CHANNEL,
        parseListContinuityReviewCandidatesCommand(command),
      ),
      parseContinuityReviewCandidateList,
      "Invalid Continuity Candidate list",
    ),
    updateItem: async (command) => parseResult(
      await invoke(
        CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL,
        parseUpdateContinuityReviewItemCommand(command),
      ),
      parseContinuityReviewCandidate,
      "Invalid Continuity Candidate update",
    ),
    decideItem: async (command) => parseResult(
      await invoke(
        CONTINUITY_REVIEW_DECIDE_CHANNEL,
        parseDecideContinuityReviewItemCommand(command),
      ),
      parseContinuityReviewDecisionResult,
      "Invalid Continuity decision result",
    ),
  });
}
