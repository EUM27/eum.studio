import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentFolderCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateFirstWorkResult,
  parseCreateWorkCommand,
  parseCreateWorkResult,
  parseMoveDocumentCommand,
  parsePlaceDocumentInFolderCommand,
  parseRenameDocumentFolderCommand,
  parseRenameDocumentCommand,
  parseRenameWorkCommand,
  parseRetireDocumentCommand,
  parseRetireAllDocumentsCommand,
  parseRetireDocumentFolderCommand,
  parseRetireWorkCommand,
  parseWorkspaceCatalogProjection,
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
} from "../../workspace/workspace-contract";
import {
  parseClearDocumentCompletionCommand,
  parseCompleteDocumentCommand,
  parseDocumentCompletionProjection,
  parseGetDocumentCompletionCommand,
  type ClearDocumentCompletionCommand,
  type CompleteDocumentCommand,
  type DocumentCompletionProjection,
  type GetDocumentCompletionCommand,
} from "../../workspace/document-completion";
import {
  parseSetWorkFavoriteCommand,
  parseWorkFavoritesProjection,
  type SetWorkFavoriteCommand,
  type WorkFavoritesProjection,
} from "../../workspace/work-favorites";
import {
  parseSelectWorkCoverCommand,
  parseWorkCoverProjection,
  parseWorkCoversProjection,
  type SelectWorkCoverCommand,
  type WorkCoverProjection,
  type WorkCoversProjection,
} from "../../workspace/work-covers";
import {
  parseManuscriptResumeCheckpointProjection,
  type ManuscriptResumeCheckpointProjection,
} from "../../checkpoints/manuscript-resume-checkpoint-projection";

export const WORKSPACE_CATALOG_CHANNEL = "studio:workspace:get-catalog";
export const WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL =
  "studio:workspace:get-document-completion";
export const WORKSPACE_COMPLETE_DOCUMENT_CHANNEL =
  "studio:workspace:complete-document";
export const WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL =
  "studio:workspace:clear-document-completion";
export const WORKSPACE_FAVORITES_CHANNEL = "studio:workspace:get-favorites";
export const WORKSPACE_SET_FAVORITE_CHANNEL = "studio:workspace:set-favorite";
export const WORKSPACE_COVERS_CHANNEL = "studio:workspace:get-covers";
export const WORKSPACE_SELECT_COVER_CHANNEL = "studio:workspace:select-cover";
export const WORKSPACE_CREATE_FIRST_WORK_CHANNEL =
  "studio:workspace:create-first-work";
export const WORKSPACE_CREATE_WORK_CHANNEL = "studio:workspace:create-work";
export const WORKSPACE_CREATE_DOCUMENT_CHANNEL =
  "studio:workspace:create-document";
export const WORKSPACE_RENAME_WORK_CHANNEL = "studio:workspace:rename-work";
export const WORKSPACE_RENAME_DOCUMENT_CHANNEL =
  "studio:workspace:rename-document";
export const WORKSPACE_RETIRE_WORK_CHANNEL = "studio:workspace:retire-work";
export const WORKSPACE_RETIRE_DOCUMENT_CHANNEL =
  "studio:workspace:retire-document";
export const WORKSPACE_RETIRE_ALL_DOCUMENTS_CHANNEL =
  "studio:workspace:retire-all-documents";
export const WORKSPACE_MOVE_DOCUMENT_CHANNEL = "studio:workspace:move-document";
export const WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL =
  "studio:workspace:create-document-folder";
export const WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL =
  "studio:workspace:rename-document-folder";
export const WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL =
  "studio:workspace:place-document-in-folder";
export const WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL =
  "studio:workspace:retire-document-folder";
export const WORKSPACE_ACTIVATE_LOCATION_CHANNEL =
  "studio:workspace:activate-location";
export const WORKSPACE_CAPTURE_RESUME_CHANNEL =
  "studio:workspace:capture-resume";

export type WorkspaceBridgeChannel =
  | typeof WORKSPACE_CATALOG_CHANNEL
  | typeof WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL
  | typeof WORKSPACE_COMPLETE_DOCUMENT_CHANNEL
  | typeof WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL
  | typeof WORKSPACE_FAVORITES_CHANNEL
  | typeof WORKSPACE_SET_FAVORITE_CHANNEL
  | typeof WORKSPACE_COVERS_CHANNEL
  | typeof WORKSPACE_SELECT_COVER_CHANNEL
  | typeof WORKSPACE_CREATE_FIRST_WORK_CHANNEL
  | typeof WORKSPACE_CREATE_WORK_CHANNEL
  | typeof WORKSPACE_CREATE_DOCUMENT_CHANNEL
  | typeof WORKSPACE_RENAME_WORK_CHANNEL
  | typeof WORKSPACE_RENAME_DOCUMENT_CHANNEL
  | typeof WORKSPACE_RETIRE_WORK_CHANNEL
  | typeof WORKSPACE_RETIRE_DOCUMENT_CHANNEL
  | typeof WORKSPACE_RETIRE_ALL_DOCUMENTS_CHANNEL
  | typeof WORKSPACE_MOVE_DOCUMENT_CHANNEL
  | typeof WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL
  | typeof WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL
  | typeof WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL
  | typeof WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL
  | typeof WORKSPACE_ACTIVATE_LOCATION_CHANNEL
  | typeof WORKSPACE_CAPTURE_RESUME_CHANNEL;

export type WorkspaceBridgePayload =
  | CreateFirstWorkCommand
  | CreateWorkCommand
  | CreateDocumentCommand
  | RenameWorkCommand
  | RenameDocumentCommand
  | RetireWorkCommand
  | RetireDocumentCommand
  | RetireAllDocumentsCommand
  | ActivateWorkspaceLocationCommand
  | CaptureWorkspaceResumeCommand;

export type WorkspaceBridge = Readonly<{
  shared?: import("../../workspace/shared-workspace-snapshot").SharedWorkspaceBridge;
  getCatalog: () => Promise<WorkspaceCatalogProjection>;
  getDocumentCompletion: (
    command: GetDocumentCompletionCommand,
  ) => Promise<DocumentCompletionProjection>;
  completeDocument: (
    command: CompleteDocumentCommand,
  ) => Promise<DocumentCompletionProjection>;
  clearDocumentCompletion: (
    command: ClearDocumentCompletionCommand,
  ) => Promise<DocumentCompletionProjection>;
  getFavorites: () => Promise<WorkFavoritesProjection>;
  setFavorite: (
    command: SetWorkFavoriteCommand,
  ) => Promise<WorkFavoritesProjection>;
  getCovers: () => Promise<WorkCoversProjection>;
  selectCover: (
    command: SelectWorkCoverCommand,
  ) => Promise<WorkCoverProjection | null>;
  activateLocation: (
    command: ActivateWorkspaceLocationCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  createWork: (command: CreateWorkCommand) => Promise<CreateWorkResult>;
  createFirstWork: (
    command: CreateFirstWorkCommand,
  ) => Promise<CreateFirstWorkResult>;
  createDocument: (
    command: CreateDocumentCommand,
  ) => Promise<CreateDocumentResult>;
  renameWork: (
    command: RenameWorkCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  renameDocument: (
    command: RenameDocumentCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  retireWork: (
    command: RetireWorkCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  retireDocument: (
    command: RetireDocumentCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  retireAllDocuments: (
    command: RetireAllDocumentsCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  moveDocument: (
    command: MoveDocumentCommand,
  ) => Promise<WorkspaceCatalogProjection>;
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
  captureResume: (
    command: CaptureWorkspaceResumeCommand,
  ) => Promise<ManuscriptResumeCheckpointProjection>;
}>;

export type WorkspaceBridgeInvoke = (
  channel: WorkspaceBridgeChannel,
  payload?: WorkspaceBridgePayload,
) => Promise<unknown>;

export function createWorkspaceBridge(
  invoke: WorkspaceBridgeInvoke,
): WorkspaceBridge {
  return Object.freeze({
    getCatalog: async () => {
      const value = await invoke(WORKSPACE_CATALOG_CHANNEL);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid workspace catalog");
      }
    },
    getDocumentCompletion: async (input) => {
      const command = parseGetDocumentCompletionCommand(input);
      const value = await invoke(
        WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
        command,
      );
      try {
        return parseDocumentCompletionProjection(value);
      } catch {
        throw new Error("Invalid Document completion projection");
      }
    },
    completeDocument: async (input) => {
      const command = parseCompleteDocumentCommand(input);
      const value = await invoke(WORKSPACE_COMPLETE_DOCUMENT_CHANNEL, command);
      try {
        return parseDocumentCompletionProjection(value);
      } catch {
        throw new Error("Invalid completed Document projection");
      }
    },
    clearDocumentCompletion: async (input) => {
      const command = parseClearDocumentCompletionCommand(input);
      const value = await invoke(
        WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
        command,
      );
      try {
        return parseDocumentCompletionProjection(value);
      } catch {
        throw new Error("Invalid cleared Document completion projection");
      }
    },
    getFavorites: async () => {
      const value = await invoke(WORKSPACE_FAVORITES_CHANNEL);
      try {
        return parseWorkFavoritesProjection(value);
      } catch {
        throw new Error("Invalid Work favorites projection");
      }
    },
    setFavorite: async (input) => {
      const command = parseSetWorkFavoriteCommand(input);
      const value = await invoke(WORKSPACE_SET_FAVORITE_CHANNEL, command);
      try {
        return parseWorkFavoritesProjection(value);
      } catch {
        throw new Error("Invalid Work favorites update result");
      }
    },
    getCovers: async () => {
      const value = await invoke(WORKSPACE_COVERS_CHANNEL);
      try {
        return parseWorkCoversProjection(value);
      } catch {
        throw new Error("Invalid Work covers projection");
      }
    },
    selectCover: async (input) => {
      const command = parseSelectWorkCoverCommand(input);
      const value = await invoke(WORKSPACE_SELECT_COVER_CHANNEL, command);
      if (value === null) return null;
      try {
        return parseWorkCoverProjection(value);
      } catch {
        throw new Error("Invalid Work cover selection result");
      }
    },
    activateLocation: async (input) => {
      const command = parseActivateWorkspaceLocationCommand(input);
      const value = await invoke(WORKSPACE_ACTIVATE_LOCATION_CHANNEL, command);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid workspace activation result");
      }
    },
    createWork: async (input) => {
      const command = parseCreateWorkCommand(input);
      const value = await invoke(WORKSPACE_CREATE_WORK_CHANNEL, command);
      try {
        return parseCreateWorkResult(value);
      } catch {
        throw new Error("Invalid Work creation result");
      }
    },
    createFirstWork: async (input) => {
      const command = parseCreateFirstWorkCommand(input);
      const value = await invoke(WORKSPACE_CREATE_FIRST_WORK_CHANNEL, command);
      try {
        return parseCreateFirstWorkResult(value);
      } catch {
        throw new Error("Invalid first Work creation result");
      }
    },
    createDocument: async (input) => {
      const command = parseCreateDocumentCommand(input);
      const value = await invoke(WORKSPACE_CREATE_DOCUMENT_CHANNEL, command);
      try {
        return parseCreateDocumentResult(value);
      } catch {
        throw new Error("Invalid Document creation result");
      }
    },
    renameWork: async (input) => {
      const command = parseRenameWorkCommand(input);
      const value = await invoke(WORKSPACE_RENAME_WORK_CHANNEL, command);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Work rename result");
      }
    },
    renameDocument: async (input) => {
      const command = parseRenameDocumentCommand(input);
      const value = await invoke(WORKSPACE_RENAME_DOCUMENT_CHANNEL, command);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document rename result");
      }
    },
    retireWork: async (input) => {
      const command = parseRetireWorkCommand(input);
      const value = await invoke(WORKSPACE_RETIRE_WORK_CHANNEL, command);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Work retirement result");
      }
    },
    retireDocument: async (input) => {
      const command = parseRetireDocumentCommand(input);
      const value = await invoke(WORKSPACE_RETIRE_DOCUMENT_CHANNEL, command);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document retirement result");
      }
    },
    retireAllDocuments: async (input) => {
      const command = parseRetireAllDocumentsCommand(input);
      const value = await invoke(
        WORKSPACE_RETIRE_ALL_DOCUMENTS_CHANNEL,
        command,
      );
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid all-Document retirement result");
      }
    },
    moveDocument: async (input) => {
      const command = parseMoveDocumentCommand(input);
      const value = await invoke(WORKSPACE_MOVE_DOCUMENT_CHANNEL, command);
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document move result");
      }
    },
    createDocumentFolder: async (input) => {
      const command = parseCreateDocumentFolderCommand(input);
      const value = await invoke(
        WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
        command,
      );
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document folder creation result");
      }
    },
    renameDocumentFolder: async (input) => {
      const command = parseRenameDocumentFolderCommand(input);
      const value = await invoke(
        WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
        command,
      );
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document folder rename result");
      }
    },
    placeDocumentInFolder: async (input) => {
      const command = parsePlaceDocumentInFolderCommand(input);
      const value = await invoke(
        WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
        command,
      );
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document folder placement result");
      }
    },
    retireDocumentFolder: async (input) => {
      const command = parseRetireDocumentFolderCommand(input);
      const value = await invoke(
        WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
        command,
      );
      try {
        return parseWorkspaceCatalogProjection(value);
      } catch {
        throw new Error("Invalid Document folder retirement result");
      }
    },
    captureResume: async (input) => {
      const command = parseCaptureWorkspaceResumeCommand(input);
      const value = await invoke(WORKSPACE_CAPTURE_RESUME_CHANNEL, command);
      try {
        return parseManuscriptResumeCheckpointProjection(value);
      } catch {
        throw new Error("Invalid workspace resume result");
      }
    },
  });
}
