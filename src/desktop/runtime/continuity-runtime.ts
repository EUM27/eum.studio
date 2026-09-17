import type { ContinuityIpcRuntime } from "../ipc/register-continuity-ipc";

export function pickContinuityRuntime(
  runtime: ContinuityIpcRuntime,
): ContinuityIpcRuntime {
  return Object.freeze({
    createContinuityThread: (command) => runtime.createContinuityThread(command),
    updateContinuityThread: (command) => runtime.updateContinuityThread(command),
    listContinuityThreads: (command) => runtime.listContinuityThreads(command),
    resolveContinuityThread: (command) => runtime.resolveContinuityThread(command),
    dismissContinuityThread: (command) => runtime.dismissContinuityThread(command),
    runContinuityReview: (command) => runtime.runContinuityReview(command),
    listContinuityReviewCandidates: (command) =>
      runtime.listContinuityReviewCandidates(command),
    updateContinuityReviewItem: (command) =>
      runtime.updateContinuityReviewItem(command),
    decideContinuityReviewItem: (command) =>
      runtime.decideContinuityReviewItem(command),
  });
}
