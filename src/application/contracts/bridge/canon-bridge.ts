import {
  parseCanonReviewCandidate,
  parseCanonReviewCandidateList,
  parseCanonReviewDecisionResult,
  parseCanonReviewResult,
  parseDecideCanonReviewItemCommand,
  parseListCanonReviewCandidatesCommand,
  parseResolveCanonReviewItemTargetCommand,
  parseRunCanonReviewCommand,
  parseUpdateCanonReviewItemCommand,
  type CanonReviewCandidate,
  type CanonReviewCandidateList,
  type CanonReviewDecisionResult,
  type CanonReviewResult,
  type DecideCanonReviewItemCommand,
  type ListCanonReviewCandidatesCommand,
  type ResolveCanonReviewItemTargetCommand,
  type RunCanonReviewCommand,
  type UpdateCanonReviewItemCommand,
} from "../../canon/canon-review-contract";
import {
  parseExportCanonicalMarkdownCommand,
  parseExportCanonicalMarkdownResult,
  type ExportCanonicalMarkdownCommand,
  type ExportCanonicalMarkdownResult,
} from "../../export/canonical-markdown-export";

export const CANON_REVIEW_RUN_CHANNEL = "studio:canon:run-review";
export const CANON_REVIEW_LIST_CHANNEL = "studio:canon:list-candidates";
export const CANON_REVIEW_UPDATE_ITEM_CHANNEL = "studio:canon:update-item";
export const CANON_REVIEW_RESOLVE_TARGET_CHANNEL = "studio:canon:resolve-target";
export const CANON_REVIEW_DECIDE_CHANNEL = "studio:canon:decide-item";
export const CANON_MARKDOWN_EXPORT_CHANNEL = "studio:canon:export-markdown";

export type CanonBridgeChannel =
  | typeof CANON_REVIEW_RUN_CHANNEL
  | typeof CANON_REVIEW_LIST_CHANNEL
  | typeof CANON_REVIEW_UPDATE_ITEM_CHANNEL
  | typeof CANON_REVIEW_RESOLVE_TARGET_CHANNEL
  | typeof CANON_REVIEW_DECIDE_CHANNEL
  | typeof CANON_MARKDOWN_EXPORT_CHANNEL;

export type CanonBridgePayload =
  | RunCanonReviewCommand
  | ListCanonReviewCandidatesCommand
  | UpdateCanonReviewItemCommand
  | ResolveCanonReviewItemTargetCommand
  | DecideCanonReviewItemCommand
  | ExportCanonicalMarkdownCommand;

export type CanonBridge = Readonly<{
  runReview(command: RunCanonReviewCommand): Promise<CanonReviewResult>;
  listCandidates(
    command: ListCanonReviewCandidatesCommand,
  ): Promise<CanonReviewCandidateList>;
  updateItem(command: UpdateCanonReviewItemCommand): Promise<CanonReviewCandidate>;
  resolveTarget(
    command: ResolveCanonReviewItemTargetCommand,
  ): Promise<CanonReviewCandidate>;
  decideItem(
    command: DecideCanonReviewItemCommand,
  ): Promise<CanonReviewDecisionResult>;
  exportMarkdown(
    command: ExportCanonicalMarkdownCommand,
  ): Promise<ExportCanonicalMarkdownResult>;
}>;

export type CanonBridgeInvoke = (
  channel: CanonBridgeChannel,
  payload?: CanonBridgePayload,
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

export function createCanonBridge(invoke: CanonBridgeInvoke): CanonBridge {
  return Object.freeze({
    runReview: async (input) => parseResult(
      await invoke(CANON_REVIEW_RUN_CHANNEL, parseRunCanonReviewCommand(input)),
      parseCanonReviewResult,
      "Invalid canon review result",
    ),
    listCandidates: async (input) => parseResult(
      await invoke(
        CANON_REVIEW_LIST_CHANNEL,
        parseListCanonReviewCandidatesCommand(input),
      ),
      parseCanonReviewCandidateList,
      "Invalid canon review Candidate list",
    ),
    updateItem: async (input) => parseResult(
      await invoke(
        CANON_REVIEW_UPDATE_ITEM_CHANNEL,
        parseUpdateCanonReviewItemCommand(input),
      ),
      parseCanonReviewCandidate,
      "Invalid canon review Candidate update",
    ),
    resolveTarget: async (input) => parseResult(
      await invoke(
        CANON_REVIEW_RESOLVE_TARGET_CHANNEL,
        parseResolveCanonReviewItemTargetCommand(input),
      ),
      parseCanonReviewCandidate,
      "Invalid canon review target resolution",
    ),
    decideItem: async (input) => parseResult(
      await invoke(
        CANON_REVIEW_DECIDE_CHANNEL,
        parseDecideCanonReviewItemCommand(input),
      ),
      parseCanonReviewDecisionResult,
      "Invalid canon review decision result",
    ),
    exportMarkdown: async (input) => parseResult(
      await invoke(
        CANON_MARKDOWN_EXPORT_CHANNEL,
        parseExportCanonicalMarkdownCommand(input),
      ),
      parseExportCanonicalMarkdownResult,
      "Invalid canonical Markdown export result",
    ),
  });
}
