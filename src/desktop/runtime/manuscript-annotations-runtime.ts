import type { ManuscriptAnnotationsIpcRuntime } from "../ipc/register-manuscript-annotations-ipc";

export function pickManuscriptAnnotationsRuntime(
  runtime: ManuscriptAnnotationsIpcRuntime,
): ManuscriptAnnotationsIpcRuntime {
  return Object.freeze({
    createManuscriptAnnotation: (command) =>
      runtime.createManuscriptAnnotation(command),
    listManuscriptAnnotations: (command) =>
      runtime.listManuscriptAnnotations(command),
    updateManuscriptAnnotation: (command) =>
      runtime.updateManuscriptAnnotation(command),
    retireManuscriptAnnotation: (command) =>
      runtime.retireManuscriptAnnotation(command),
  });
}
