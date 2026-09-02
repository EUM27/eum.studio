import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  CANON_REVIEW_DECIDE_CHANNEL,
  CANON_REVIEW_LIST_CHANNEL,
  CANON_REVIEW_RESOLVE_TARGET_CHANNEL,
  CANON_REVIEW_RUN_CHANNEL,
  CANON_REVIEW_UPDATE_ITEM_CHANNEL,
  CANON_MARKDOWN_EXPORT_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseExportCanonicalMarkdownCommand,
  type ExportCanonicalMarkdownCommand,
  type ExportCanonicalMarkdownResult,
} from "../../application/export/canonical-markdown-export";
import {
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
} from "../../application/canon/canon-review-contract";

export type CanonIpcRuntime = Readonly<{
  runCanonReview(command: RunCanonReviewCommand): Promise<CanonReviewResult>;
  listCanonReviewCandidates(
    command: ListCanonReviewCandidatesCommand,
  ): Promise<CanonReviewCandidateList>;
  updateCanonReviewItem(
    command: UpdateCanonReviewItemCommand,
  ): Promise<CanonReviewCandidate>;
  resolveCanonReviewItemTarget(
    command: ResolveCanonReviewItemTargetCommand,
  ): Promise<CanonReviewCandidate>;
  decideCanonReviewItem(
    command: DecideCanonReviewItemCommand,
  ): Promise<CanonReviewDecisionResult>;
}>;

export function registerCanonIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender(event: IpcMainInvokeEvent): void;
  runtime: CanonIpcRuntime;
  exportMarkdown(
    command: ExportCanonicalMarkdownCommand,
  ): Promise<ExportCanonicalMarkdownResult>;
}>): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ) => input.ipcMain.handle(channel, (event, value: unknown) => {
    input.authorizeSender(event);
    return run(parse(value));
  });
  handle(CANON_REVIEW_RUN_CHANNEL, parseRunCanonReviewCommand, input.runtime.runCanonReview);
  handle(
    CANON_REVIEW_LIST_CHANNEL,
    parseListCanonReviewCandidatesCommand,
    input.runtime.listCanonReviewCandidates,
  );
  handle(
    CANON_REVIEW_UPDATE_ITEM_CHANNEL,
    parseUpdateCanonReviewItemCommand,
    input.runtime.updateCanonReviewItem,
  );
  handle(
    CANON_REVIEW_RESOLVE_TARGET_CHANNEL,
    parseResolveCanonReviewItemTargetCommand,
    input.runtime.resolveCanonReviewItemTarget,
  );
  handle(
    CANON_REVIEW_DECIDE_CHANNEL,
    parseDecideCanonReviewItemCommand,
    input.runtime.decideCanonReviewItem,
  );
  handle(
    CANON_MARKDOWN_EXPORT_CHANNEL,
    parseExportCanonicalMarkdownCommand,
    input.exportMarkdown,
  );
}
