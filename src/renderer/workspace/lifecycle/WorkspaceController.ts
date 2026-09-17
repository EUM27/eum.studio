import type {
  ActivateWorkspaceLocationCommand,
  CreateWorkCommand,
  MoveDocumentCommand,
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";

export type WorkspaceControllerCommands = Readonly<{
  activateLocation: (
    command: ActivateWorkspaceLocationCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  createWork: (
    command: CreateWorkCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  renameWork: (
    workId: WorkspaceWorkSummary["workId"],
    title: string,
  ) => Promise<WorkspaceCatalogProjection>;
  retireWork: (
    workId: WorkspaceWorkSummary["workId"],
  ) => Promise<WorkspaceCatalogProjection>;
  retireDocument: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
  ) => Promise<WorkspaceCatalogProjection>;
  moveDocument: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
    direction: MoveDocumentCommand["direction"],
  ) => Promise<WorkspaceCatalogProjection>;
  prepareForMain: () => Promise<WorkspaceCatalogProjection>;
  openSchedule: () => void;
  openCompletedRevision: (
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
  ) => Promise<WorkspaceCatalogProjection>;
}>;

export class WorkspaceController {
  private commands: WorkspaceControllerCommands | null = null;

  install(commands: WorkspaceControllerCommands): () => void {
    this.commands = commands;
    return () => {
      if (this.commands === commands) this.commands = null;
    };
  }

  isAvailable(): boolean {
    return this.commands !== null;
  }

  private requireCommands(): WorkspaceControllerCommands {
    if (this.commands === null) {
      throw new Error("The manuscript workspace is unavailable");
    }
    return this.commands;
  }

  activateLocation(
    command: ActivateWorkspaceLocationCommand,
  ): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().activateLocation(command);
  }

  createWork(command: CreateWorkCommand): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().createWork(command);
  }

  renameWork(
    workId: WorkspaceWorkSummary["workId"],
    title: string,
  ): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().renameWork(workId, title);
  }

  retireWork(
    workId: WorkspaceWorkSummary["workId"],
  ): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().retireWork(workId);
  }

  retireDocument(
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
  ): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().retireDocument(workId, documentId);
  }

  moveDocument(
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
    direction: MoveDocumentCommand["direction"],
  ): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().moveDocument(workId, documentId, direction);
  }

  prepareForMain(): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().prepareForMain();
  }

  openSchedule(): void {
    this.requireCommands().openSchedule();
  }

  openCompletedRevision(
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
  ): Promise<WorkspaceCatalogProjection> {
    return this.requireCommands().openCompletedRevision(
      workId,
      documentId,
      revisionId,
    );
  }
}
