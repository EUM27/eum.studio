import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
  WORKSPACE_CAPTURE_RESUME_CHANNEL,
  WORKSPACE_CATALOG_CHANNEL,
  WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
  WORKSPACE_COMPLETE_DOCUMENT_CHANNEL,
  WORKSPACE_COVERS_CHANNEL,
  WORKSPACE_CREATE_DOCUMENT_CHANNEL,
  WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
  WORKSPACE_CREATE_WORK_CHANNEL,
  WORKSPACE_FAVORITES_CHANNEL,
  WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
  WORKSPACE_MOVE_DOCUMENT_CHANNEL,
  WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
  WORKSPACE_RENAME_DOCUMENT_CHANNEL,
  WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_RENAME_WORK_CHANNEL,
  WORKSPACE_RETIRE_DOCUMENT_CHANNEL,
  WORKSPACE_RETIRE_ALL_DOCUMENTS_CHANNEL,
  WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_RETIRE_WORK_CHANNEL,
  WORKSPACE_SELECT_COVER_CHANNEL,
  WORKSPACE_SET_FAVORITE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentFolderCommand,
  parseCreateDocumentCommand,
  parseCreateFirstWorkCommand,
  parseCreateWorkCommand,
  parseMoveDocumentCommand,
  parsePlaceDocumentInFolderCommand,
  parseRenameDocumentFolderCommand,
  parseRenameDocumentCommand,
  parseRenameWorkCommand,
  parseRetireDocumentCommand,
  parseRetireAllDocumentsCommand,
  parseRetireDocumentFolderCommand,
  parseRetireWorkCommand,
  type ActivateWorkspaceLocationCommand,
  type CaptureWorkspaceResumeCommand,
  type CreateDocumentFolderCommand,
  type CreateDocumentCommand,
  type CreateDocumentResult,
  type CreateFirstWorkCommand,
  type CreateFirstWorkResult,
  type CreateWorkCommand,
  type CreateWorkResult,
  type MoveDocumentCommand,
  type PlaceDocumentInFolderCommand,
  type RenameDocumentFolderCommand,
  type RenameDocumentCommand,
  type RenameWorkCommand,
  type RetireDocumentCommand,
  type RetireAllDocumentsCommand,
  type RetireDocumentFolderCommand,
  type RetireWorkCommand,
  type WorkspaceCatalogProjection,
} from "../../application/workspace/workspace-contract";
import {
  parseClearDocumentCompletionCommand,
  parseCompleteDocumentCommand,
  parseGetDocumentCompletionCommand,
  type ClearDocumentCompletionCommand,
  type CompleteDocumentCommand,
  type DocumentCompletionProjection,
  type GetDocumentCompletionCommand,
} from "../../application/workspace/document-completion";
import {
  parseSetWorkFavoriteCommand,
  type SetWorkFavoriteCommand,
  type WorkFavoritesProjection,
} from "../../application/workspace/work-favorites";
import {
  parseSelectWorkCoverCommand,
  type SelectWorkCoverCommand,
  type WorkCoverProjection,
  type WorkCoversProjection,
} from "../../application/workspace/work-covers";
import type { ManuscriptResumeCheckpointProjection } from "../../application/checkpoints/manuscript-resume-checkpoint-projection";

type MaybePromise<T> = T | Promise<T>;

export type WorkspaceIpcRuntime = Readonly<{
  getWorkspaceCatalog: () => MaybePromise<WorkspaceCatalogProjection>;
  getDocumentCompletion: (
    command: GetDocumentCompletionCommand,
  ) => Promise<DocumentCompletionProjection>;
  completeDocument: (
    command: CompleteDocumentCommand,
  ) => Promise<DocumentCompletionProjection>;
  clearDocumentCompletion: (
    command: ClearDocumentCompletionCommand,
  ) => Promise<DocumentCompletionProjection>;
  getWorkFavorites: () => MaybePromise<WorkFavoritesProjection>;
  setWorkFavorite: (
    command: SetWorkFavoriteCommand,
  ) => Promise<WorkFavoritesProjection>;
  getWorkCovers: () => MaybePromise<WorkCoversProjection>;
  activateWorkspaceLocation: (
    command: ActivateWorkspaceLocationCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  createWork: (command: CreateWorkCommand) => Promise<CreateWorkResult>;
  createFirstWork: (
    command: CreateFirstWorkCommand,
  ) => Promise<CreateFirstWorkResult>;
  createDocument: (
    command: CreateDocumentCommand,
  ) => Promise<CreateDocumentResult>;
  renameWork: (command: RenameWorkCommand) => Promise<WorkspaceCatalogProjection>;
  renameDocument: (
    command: RenameDocumentCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  retireWork: (command: RetireWorkCommand) => Promise<WorkspaceCatalogProjection>;
  retireDocument: (
    command: RetireDocumentCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  retireAllDocuments: (
    command: RetireAllDocumentsCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  moveDocument: (command: MoveDocumentCommand) => Promise<WorkspaceCatalogProjection>;
  createDocumentFolder: (
    command: CreateDocumentFolderCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  renameDocumentFolder: (
    command: RenameDocumentFolderCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  placeDocumentInFolder: (
    command: PlaceDocumentInFolderCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  retireDocumentFolder: (
    command: RetireDocumentFolderCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  captureWorkspaceResume: (
    command: CaptureWorkspaceResumeCommand,
  ) => Promise<ManuscriptResumeCheckpointProjection>;
}>;

export function registerWorkspaceIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: WorkspaceIpcRuntime;
  selectCover: (
    command: SelectWorkCoverCommand,
  ) => Promise<WorkCoverProjection | null>;
}>): void {
  input.ipcMain.handle(WORKSPACE_CATALOG_CHANNEL, () =>
    input.runtime.getWorkspaceCatalog());
  input.ipcMain.handle(WORKSPACE_FAVORITES_CHANNEL, () =>
    input.runtime.getWorkFavorites());
  input.ipcMain.handle(WORKSPACE_COVERS_CHANNEL, () =>
    input.runtime.getWorkCovers());

  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ): void => {
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  };

  handle(WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
    parseGetDocumentCompletionCommand,
    (command) => input.runtime.getDocumentCompletion(command));
  handle(WORKSPACE_COMPLETE_DOCUMENT_CHANNEL, parseCompleteDocumentCommand,
    (command) => input.runtime.completeDocument(command));
  handle(WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
    parseClearDocumentCompletionCommand,
    (command) => input.runtime.clearDocumentCompletion(command));
  handle(WORKSPACE_SET_FAVORITE_CHANNEL, parseSetWorkFavoriteCommand,
    (command) => input.runtime.setWorkFavorite(command));
  handle(WORKSPACE_SELECT_COVER_CHANNEL, parseSelectWorkCoverCommand,
    input.selectCover);
  handle(WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
    parseActivateWorkspaceLocationCommand,
    (command) => input.runtime.activateWorkspaceLocation(command));
  handle(WORKSPACE_CREATE_WORK_CHANNEL, parseCreateWorkCommand,
    (command) => input.runtime.createWork(command));
  handle(WORKSPACE_CREATE_FIRST_WORK_CHANNEL, parseCreateFirstWorkCommand,
    (command) => input.runtime.createFirstWork(command));
  handle(WORKSPACE_CREATE_DOCUMENT_CHANNEL, parseCreateDocumentCommand,
    (command) => input.runtime.createDocument(command));
  handle(WORKSPACE_RENAME_WORK_CHANNEL, parseRenameWorkCommand,
    (command) => input.runtime.renameWork(command));
  handle(WORKSPACE_RENAME_DOCUMENT_CHANNEL, parseRenameDocumentCommand,
    (command) => input.runtime.renameDocument(command));
  handle(WORKSPACE_RETIRE_WORK_CHANNEL, parseRetireWorkCommand,
    (command) => input.runtime.retireWork(command));
  handle(WORKSPACE_RETIRE_DOCUMENT_CHANNEL, parseRetireDocumentCommand,
    (command) => input.runtime.retireDocument(command));
  handle(WORKSPACE_RETIRE_ALL_DOCUMENTS_CHANNEL,
    parseRetireAllDocumentsCommand,
    (command) => input.runtime.retireAllDocuments(command));
  handle(WORKSPACE_MOVE_DOCUMENT_CHANNEL, parseMoveDocumentCommand,
    (command) => input.runtime.moveDocument(command));
  handle(WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
    parseCreateDocumentFolderCommand,
    (command) => input.runtime.createDocumentFolder(command));
  handle(WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
    parseRenameDocumentFolderCommand,
    (command) => input.runtime.renameDocumentFolder(command));
  handle(WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
    parsePlaceDocumentInFolderCommand,
    (command) => input.runtime.placeDocumentInFolder(command));
  handle(WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
    parseRetireDocumentFolderCommand,
    (command) => input.runtime.retireDocumentFolder(command));
  handle(WORKSPACE_CAPTURE_RESUME_CHANNEL, parseCaptureWorkspaceResumeCommand,
    (command) => input.runtime.captureWorkspaceResume(command));
}
