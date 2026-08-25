import { useCallback, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  CreateWorkCommand,
  MoveDocumentCommand,
  WorkspaceCatalogProjection,
  WorkspaceDocumentFolderSummary,
  WorkspaceDocumentSummary,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";
import type { WorkspaceRuntimeState } from "../session/workspace-session-state";
import type { WorkspaceActionState } from "./useWorkspaceLifecycle";

export type WorkspaceCommandPorts = Readonly<{
  setActionState: (state: WorkspaceActionState) => void;
  setActionError: (error: string | null) => void;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  installCreatedDocument: (
    documentId: string,
    catalog: WorkspaceCatalogProjection,
  ) => Promise<void>;
  installRenamedCatalog: (catalog: WorkspaceCatalogProjection) => void;
  installReorderedCatalog: (catalog: WorkspaceCatalogProjection) => void;
  reloadRuntime: (preferredDocumentId: EntityId<"Document"> | null) =>
    Promise<WorkspaceCatalogProjection>;
  clearManuscriptSearch: () => void;
  publishCatalog: (catalog: WorkspaceCatalogProjection) => void;
  refreshSceneProjection: (workId: EntityId<"Work">) => Promise<unknown>;
}>;

export function useWorkspaceCommandsController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWork: WorkspaceWorkSummary | null;
  client: StudioBridge["workspace"];
  ports: WorkspaceCommandPorts;
  runtime: WorkspaceRuntimeState;
}>) {
  const [titleEditTarget, setTitleEditTarget] = useState<"work" | null>(null);
  const [titleEditValue, setTitleEditValue] = useState("");

  const currentRuntimeDocument = useCallback(() => {
    const runtime = input.runtime;
    return runtime.status === "ready"
      ? runtime.documentProfile.documents.find(
          (document) =>
            document.documentId === runtime.activeDocumentId,
        ) ?? null
      : null;
  },
  [input.runtime]);

  const createWork = useCallback(async (
    command: CreateWorkCommand,
  ): Promise<WorkspaceCatalogProjection> => {
    if (input.runtime.status !== "ready") {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("creating-work");
    input.ports.setActionError(null);
    try {
      const currentDocument = currentRuntimeDocument();
      if (currentDocument !== null) {
        await input.ports.persistDocument(currentDocument);
      }
      const created = await input.client.createWork(command);
      const catalog = await input.client.getCatalog();
      await input.ports.installCreatedDocument(created.documentId, catalog);
      return catalog;
    } catch (error) {
      input.ports.setActionError("새 작품을 만들지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [currentRuntimeDocument, input]);

  const createDocument = useCallback(async (title: string): Promise<void> => {
    if (input.runtime.status !== "ready" || input.activeWork === null) {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("creating-document");
    input.ports.setActionError(null);
    try {
      if (input.activeDocument !== null) {
        await input.ports.persistDocument(input.activeDocument);
      }
      const created = await input.client.createDocument({
        schemaVersion: 1,
        workId: input.activeWork.workId,
        title,
      });
      const catalog = await input.client.getCatalog();
      if (input.activeDocument === null) {
        input.ports.publishCatalog(
          await input.ports.reloadRuntime(created.documentId),
        );
      } else {
        await input.ports.installCreatedDocument(created.documentId, catalog);
      }
      await input.ports.refreshSceneProjection(input.activeWork.workId);
    } catch (error) {
      input.ports.setActionError("새 회차를 만들지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [input]);

  const renameWork = useCallback(async (
    workId: WorkspaceWorkSummary["workId"],
    title: string,
  ): Promise<WorkspaceCatalogProjection> => {
    if (input.runtime.status !== "ready") {
      throw new Error("The manuscript workspace is not ready");
    }
    const currentDocument = currentRuntimeDocument();
    if (currentDocument !== null) {
      await input.ports.persistDocument(currentDocument);
    }
    const catalog = await input.client.renameWork({
      schemaVersion: 1,
      workId,
      title,
    });
    input.ports.installRenamedCatalog(catalog);
    return catalog;
  }, [currentRuntimeDocument, input]);

  const renameActiveWork = useCallback(async (): Promise<void> => {
    if (input.runtime.status !== "ready" || input.activeWork === null) {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("renaming-work");
    input.ports.setActionError(null);
    try {
      await renameWork(input.activeWork.workId, titleEditValue);
      setTitleEditTarget(null);
      setTitleEditValue("");
    } catch (error) {
      input.ports.setActionError("작품 이름을 변경하지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [input, renameWork, titleEditValue]);

  const renameDocument = useCallback(async (
    document: WorkspaceDocumentSummary,
    title: string,
  ): Promise<void> => {
    if (input.runtime.status !== "ready" || input.activeWork === null) {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("renaming-document");
    input.ports.setActionError(null);
    try {
      if (input.activeDocument !== null) {
        await input.ports.persistDocument(input.activeDocument);
      }
      const catalog = await input.client.renameDocument({
        schemaVersion: 1,
        workId: input.activeWork.workId,
        documentId: document.documentId,
        title,
      });
      input.ports.installRenamedCatalog(catalog);
    } catch (error) {
      input.ports.setActionError("회차 이름을 변경하지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [input]);

  const retireWork = useCallback(async (
    workId: WorkspaceWorkSummary["workId"],
  ): Promise<WorkspaceCatalogProjection> => {
    if (input.runtime.status !== "ready") {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("retiring-work");
    input.ports.setActionError(null);
    try {
      const currentDocument = currentRuntimeDocument();
      if (currentDocument !== null) {
        await input.ports.persistDocument(currentDocument);
      }
      const catalog = await input.client.retireWork({
        schemaVersion: 1,
        workId,
      });
      if (!catalog.canCreateFirstWork) {
        await input.ports.reloadRuntime(catalog.activeDocumentId);
      }
      input.ports.clearManuscriptSearch();
      input.ports.publishCatalog(catalog);
      return catalog;
    } catch (error) {
      input.ports.setActionError("작품을 삭제하지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [currentRuntimeDocument, input]);

  const retireDocument = useCallback(async (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceDocumentSummary["documentId"],
  ): Promise<WorkspaceCatalogProjection> => {
    if (input.runtime.status !== "ready") {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("retiring-document");
    input.ports.setActionError(null);
    try {
      const currentDocument = currentRuntimeDocument();
      if (currentDocument !== null) {
        await input.ports.persistDocument(currentDocument);
      }
      const catalog = await input.client.retireDocument({
        schemaVersion: 1,
        workId,
        documentId,
      });
      await input.ports.reloadRuntime(catalog.activeDocumentId);
      input.ports.clearManuscriptSearch();
      input.ports.publishCatalog(catalog);
      return catalog;
    } catch (error) {
      input.ports.setActionError("회차를 삭제하지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [currentRuntimeDocument, input]);

  const moveDocument = useCallback(async (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceDocumentSummary["documentId"],
    direction: MoveDocumentCommand["direction"],
  ): Promise<WorkspaceCatalogProjection> => {
    if (input.runtime.status !== "ready") {
      throw new Error("The manuscript workspace is not ready");
    }
    input.ports.setActionState("moving-document");
    input.ports.setActionError(null);
    try {
      const currentDocument = currentRuntimeDocument();
      if (currentDocument !== null) {
        await input.ports.persistDocument(currentDocument);
      }
      const catalog = await input.client.moveDocument({
        schemaVersion: 1,
        workId,
        documentId,
        direction,
      });
      input.ports.installReorderedCatalog(catalog);
      return catalog;
    } catch (error) {
      input.ports.setActionError("회차 순서를 변경하지 못했습니다.");
      throw error;
    } finally {
      input.ports.setActionState("idle");
    }
  }, [currentRuntimeDocument, input]);

  const createDocumentFolder = useCallback(async (
    title: string,
    parentFolderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => runFolderCommand(
    input,
    "폴더를 만들지 못했습니다.",
    () => input.client.createDocumentFolder({
      schemaVersion: 1,
      workId: requireActiveWorkId(input),
      title,
      parentFolderId,
    }),
  ), [input]);

  const renameDocumentFolder = useCallback(async (
    folderId: WorkspaceDocumentFolderSummary["folderId"],
    title: string,
  ) => runFolderCommand(
    input,
    "폴더 이름을 변경하지 못했습니다.",
    () => input.client.renameDocumentFolder({
      schemaVersion: 1,
      workId: requireActiveWorkId(input),
      folderId,
      title,
    }),
  ), [input]);

  const placeDocumentInFolder = useCallback(async (
    documentId: WorkspaceDocumentSummary["documentId"],
    folderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => runFolderCommand(
    input,
    "회차의 폴더 위치를 변경하지 못했습니다.",
    () => input.client.placeDocumentInFolder({
      schemaVersion: 1,
      workId: requireActiveWorkId(input),
      documentId,
      folderId,
    }),
  ), [input]);

  const retireDocumentFolder = useCallback(async (
    folder: WorkspaceDocumentFolderSummary,
  ) => {
    requireActiveWorkId(input);
    if (!window.confirm(
      `‘${folder.title}’ 폴더를 삭제할까요?\n하위 폴더와 회차는 한 단계 위로 이동하고 원고는 보존됩니다.`,
    )) return;
    await runFolderCommand(
      input,
      "폴더를 삭제하지 못했습니다.",
      () => input.client.retireDocumentFolder({
        schemaVersion: 1,
        workId: requireActiveWorkId(input),
        folderId: folder.folderId,
      }),
    );
  }, [input]);

  const startWorkTitleEdit = useCallback((title: string) => {
    setTitleEditTarget("work");
    setTitleEditValue(title);
    input.ports.setActionError(null);
  }, [input.ports]);
  const cancelWorkTitleEdit = useCallback(() => {
    setTitleEditTarget(null);
    setTitleEditValue("");
    input.ports.setActionError(null);
  }, [input.ports]);
  const changeTitleEditValue = useCallback((value: string) => {
    setTitleEditValue(value);
  }, []);

  return {
    titleEditTarget,
    titleEditValue,
    createWork,
    createDocument,
    renameWork,
    renameActiveWork,
    renameDocument,
    retireWork,
    retireDocument,
    moveDocument,
    createDocumentFolder,
    renameDocumentFolder,
    placeDocumentInFolder,
    retireDocumentFolder,
    startWorkTitleEdit,
    cancelWorkTitleEdit,
    changeTitleEditValue,
  };
}

function requireActiveWorkId(input: Readonly<{
  activeWork: WorkspaceWorkSummary | null;
  runtime: WorkspaceRuntimeState;
}>): EntityId<"Work"> {
  if (input.runtime.status !== "ready" || input.activeWork === null) {
    throw new Error("The manuscript workspace is not ready");
  }
  return input.activeWork.workId;
}

async function runFolderCommand(
  input: Readonly<{
    activeDocument: ManuscriptDocumentSource | null;
    activeWork: WorkspaceWorkSummary | null;
    ports: WorkspaceCommandPorts;
    runtime: WorkspaceRuntimeState;
  }>,
  errorMessage: string,
  command: () => Promise<WorkspaceCatalogProjection>,
): Promise<void> {
  requireActiveWorkId(input);
  input.ports.setActionState("managing-document-folders");
  input.ports.setActionError(null);
  try {
    if (input.activeDocument !== null) {
      await input.ports.persistDocument(input.activeDocument);
    }
    input.ports.installReorderedCatalog(await command());
  } catch (error) {
    input.ports.setActionError(errorMessage);
    throw error;
  } finally {
    input.ports.setActionState("idle");
  }
}
