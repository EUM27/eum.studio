import type { CanonIpcRuntime } from "../ipc/register-canon-ipc";

export function pickCanonRuntime(runtime: CanonIpcRuntime): CanonIpcRuntime {
  return Object.freeze({
    runCanonReview: (command) => runtime.runCanonReview(command),
    listCanonReviewCandidates: (command) =>
      runtime.listCanonReviewCandidates(command),
    updateCanonReviewItem: (command) => runtime.updateCanonReviewItem(command),
    resolveCanonReviewItemTarget: (command) =>
      runtime.resolveCanonReviewItemTarget(command),
    decideCanonReviewItem: (command) => runtime.decideCanonReviewItem(command),
  });
}
