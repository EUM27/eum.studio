import type { ListSceneAnnotationsCommand,SceneAnnotationList } from "../../../application/structure/scene-annotation-contract";
import { parseListSceneAnnotationsCommand,parseSceneAnnotationList } from "../../../application/structure/scene-annotation-contract";
import { readStoredSceneAnnotationRows } from "../repositories/scene-annotations";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { InfrastructureService } from "./infrastructure";

/** Owns scene annotations commands and their existing transaction boundaries. */
export class SceneAnnotationsService {
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen" | "assertAssistantWorkExists">;

  constructor(input: {
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen" | "assertAssistantWorkExists">;
  }) {
    this.#operations = input.operations;
    this.#database = input.database;
    this.#infrastructure = input.infrastructure;
  }

  listSceneAnnotations(value: unknown): Promise<SceneAnnotationList> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneAnnotationsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listSceneAnnotationsSerially(command)
    );
  }

  listSceneAnnotationsSerially(
    command: ListSceneAnnotationsCommand,
  ): SceneAnnotationList {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    return parseSceneAnnotationList({
      schemaVersion: 1,
      workId: command.workId,
      annotations: readStoredSceneAnnotationRows(this.#database, command.workId),
    });
  }
}

