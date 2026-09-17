import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  MANUSCRIPT_ANNOTATION_CREATE_CHANNEL,
  MANUSCRIPT_ANNOTATION_LIST_CHANNEL,
  MANUSCRIPT_ANNOTATION_RETIRE_CHANNEL,
  MANUSCRIPT_ANNOTATION_UPDATE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreateManuscriptAnnotationCommand,
  parseListManuscriptAnnotationsCommand,
  parseRetireManuscriptAnnotationCommand,
  parseUpdateManuscriptAnnotationCommand,
  type CreateManuscriptAnnotationCommand,
  type ListManuscriptAnnotationsCommand,
  type ManuscriptAnnotationListProjection,
  type ManuscriptAnnotationProjection,
  type RetireManuscriptAnnotationCommand,
  type UpdateManuscriptAnnotationCommand,
} from "../../application/review/manuscript-annotation-contract";

export type ManuscriptAnnotationsIpcRuntime = Readonly<{
  createManuscriptAnnotation: (
    command: CreateManuscriptAnnotationCommand,
  ) => Promise<ManuscriptAnnotationProjection>;
  listManuscriptAnnotations: (
    command: ListManuscriptAnnotationsCommand,
  ) => Promise<ManuscriptAnnotationListProjection>;
  updateManuscriptAnnotation: (
    command: UpdateManuscriptAnnotationCommand,
  ) => Promise<ManuscriptAnnotationProjection>;
  retireManuscriptAnnotation: (
    command: RetireManuscriptAnnotationCommand,
  ) => Promise<ManuscriptAnnotationProjection>;
}>;

export function registerManuscriptAnnotationsIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: ManuscriptAnnotationsIpcRuntime;
}>): void {
  input.ipcMain.handle(
    MANUSCRIPT_ANNOTATION_CREATE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.createManuscriptAnnotation(
        parseCreateManuscriptAnnotationCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    MANUSCRIPT_ANNOTATION_LIST_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.listManuscriptAnnotations(
        parseListManuscriptAnnotationsCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    MANUSCRIPT_ANNOTATION_UPDATE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.updateManuscriptAnnotation(
        parseUpdateManuscriptAnnotationCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    MANUSCRIPT_ANNOTATION_RETIRE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.retireManuscriptAnnotation(
        parseRetireManuscriptAnnotationCommand(value),
      );
    },
  );
}
