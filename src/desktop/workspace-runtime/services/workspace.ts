import { randomUUID } from "node:crypto";
import type { RevisionBlobProfile,RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { SaveWorkCoverCommand,WorkCoverProjection,WorkCoversProjection } from "../../../application/workspace/work-covers";
import { parseSaveWorkCoverCommand,parseWorkCoverProjection,parseWorkCoversProjection } from "../../../application/workspace/work-covers";
import type { SetWorkFavoriteCommand,WorkFavoritesProjection } from "../../../application/workspace/work-favorites";
import { parseSetWorkFavoriteCommand,parseWorkFavoritesProjection } from "../../../application/workspace/work-favorites";
import type { ActivateWorkspaceLocationCommand,CreateDocumentFolderCommand,CreateDocumentResult,CreateFirstWorkCommand,CreateFirstWorkResult,CreateWorkResult,MoveDocumentCommand,PlaceDocumentInFolderCommand,RenameDocumentCommand,RenameDocumentFolderCommand,RenameWorkCommand,RetireAllDocumentsCommand,RetireDocumentCommand,RetireDocumentFolderCommand,RetireWorkCommand,WorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import { parseActivateWorkspaceLocationCommand,parseCreateDocumentCommand,parseCreateDocumentFolderCommand,parseCreateDocumentResult,parseCreateFirstWorkCommand,parseCreateWorkCommand,parseCreateWorkResult,parseMoveDocumentCommand,parsePlaceDocumentInFolderCommand,parseRenameDocumentCommand,parseRenameDocumentFolderCommand,parseRenameWorkCommand,parseRetireAllDocumentsCommand,parseRetireDocumentCommand,parseRetireDocumentFolderCommand,parseRetireWorkCommand,parseWorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import { entityId } from "../../../domain/writing";
import { createNodeImmutableBlobStore } from "../../../platform/storage/node-immutable-blob-store";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { shouldInsertBlobManifest } from "../repositories/revisions";
import { readRequiredInteger,readRequiredString } from "../repositories/scalars";
import { createDocumentRecords,createInitialRecords,readStoredDocumentFolderRows,readStoredDocumentRows,STUDIO_ROWS_SQL } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";
import { loadWorkspaceState } from "../workspace-state-loader";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns workspace commands and their existing transaction boundaries. */
export class WorkspaceService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #blobStore: Awaited<
    ReturnType<typeof createNodeImmutableBlobStore>
  >;
  readonly #blobProfile: RevisionBlobProfile;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "studioDisplayName" | "locale" | "timezone" | "defaults" | "emptyDocumentProfile">;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly blobStore: Awaited<
    ReturnType<typeof createNodeImmutableBlobStore>
  >;
    readonly blobProfile: RevisionBlobProfile;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "studioDisplayName" | "locale" | "timezone" | "defaults" | "emptyDocumentProfile">;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#blobStore = input.blobStore;
    this.#blobProfile = input.blobProfile;
    this.#ledger = input.ledger;
    this.#options = input.options;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
  }

  getWorkspaceCatalog(): WorkspaceCatalogProjection {
    this.#infrastructure.assertOpen();
    return this.#state.catalog;
  }

  getWorkFavorites(): WorkFavoritesProjection {
    this.#infrastructure.assertOpen();
    return this.#readWorkFavorites();
  }

  setWorkFavorite(value: unknown): Promise<WorkFavoritesProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSetWorkFavoriteCommand(value);
    const execution = this.#operations.enqueueMutation(() =>
      this.#setWorkFavoriteSerially(command));

    return execution;
  }

  getWorkCovers(): WorkCoversProjection {
    this.#infrastructure.assertOpen();
    return this.#readWorkCovers();
  }

  saveWorkCover(value: unknown): Promise<WorkCoverProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkCoverCommand(value);
    const execution = this.#operations.enqueueMutation(() =>
      this.#saveWorkCoverSerially(command));

    return execution;
  }

  activateWorkspaceLocation(
    value: unknown,
  ): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseActivateWorkspaceLocationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      const loadedActivation = this.#activateLoadedDocument(command);
      if (loadedActivation !== null) {
        return loadedActivation;
      }
      await this.reload(command);
      return this.#state.catalog;
    });

    return execution;
  }

  #activateLoadedDocument(
    command: ActivateWorkspaceLocationCommand,
  ): WorkspaceCatalogProjection | null {
    if (
      command.documentId === null ||
      command.workId !== this.#state.catalog.activeWorkId
    ) {
      return null;
    }
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    const catalogDocument = work?.documents.find(
      (document) => document.documentId === command.documentId,
    );
    const loadedDocument = this.#state.documentProfile.documents.find(
      (document) =>
        document.workId === command.workId &&
        document.documentId === command.documentId,
    );
    if (
      work === undefined ||
      catalogDocument === undefined ||
      loadedDocument === undefined
    ) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    this.#state.replaceCatalog(parseWorkspaceCatalogProjection({
      ...this.#state.catalog,
      activeWorkId: command.workId,
      activeDocumentId: command.documentId,
    }));
    this.#state.replaceDocumentProfile(Object.freeze({
      ...this.#state.documentProfile,
      initialDocumentId: command.documentId,
    }));
    return this.#state.catalog;
  }

  renameWork(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRenameWorkCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#renameWorkSerially(command);
    });

    return execution;
  }

  renameDocument(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRenameDocumentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#renameDocumentSerially(command);
    });

    return execution;
  }

  retireWork(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireWorkCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireWorkSerially(command);
    });

    return execution;
  }

  retireDocument(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireDocumentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireDocumentSerially(command);
    });

    return execution;
  }

  retireAllDocuments(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireAllDocumentsCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireAllDocumentsSerially(command);
    });

    return execution;
  }

  moveDocument(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseMoveDocumentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#moveDocumentSerially(command);
    });

    return execution;
  }

  createDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateDocumentFolderCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createDocumentFolderSerially(command);
    });

    return execution;
  }

  renameDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRenameDocumentFolderCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#renameDocumentFolderSerially(command);
    });

    return execution;
  }

  placeDocumentInFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePlaceDocumentInFolderCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#placeDocumentInFolderSerially(command);
    });

    return execution;
  }

  retireDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireDocumentFolderCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireDocumentFolderSerially(command);
    });

    return execution;
  }

  async #renameWorkSerially(
    command: RenameWorkCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const row = readStoredDocumentRows(this.#database).find(
      (candidate) => candidate.workId === command.workId,
    );
    if (row === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (row.workTitle === command.title) {
      return this.#state.catalog;
    }
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE works
        SET
          title = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        command.title,
        updatedAt,
        command.workId,
        row.workRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work changed before rename: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  #readWorkFavorites(): WorkFavoritesProjection {
    const workIds = this.#database
      .prepare(`
        SELECT favorite.work_id AS "workId"
        FROM work_favorites AS favorite
        JOIN works AS work ON work.id = favorite.work_id
        WHERE work.retired_at IS NULL
        ORDER BY favorite.favorited_at, favorite.work_id
      `)
      .all()
      .map((row) =>
        entityId<"Work">(
          readRequiredString(row, "workId", "Work favorite row"),
        ),
      );
    return parseWorkFavoritesProjection({ schemaVersion: 1, workIds });
  }

  #setWorkFavoriteSerially(
    command: SetWorkFavoriteCommand,
  ): WorkFavoritesProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (command.favorite) {
        this.#database
          .prepare(`
            INSERT INTO work_favorites (
              work_id,
              schema_version,
              favorited_at
            ) VALUES (?, 1, ?)
            ON CONFLICT (work_id) DO NOTHING
          `)
          .run(command.workId, new Date().toISOString());
      } else {
        this.#database
          .prepare("DELETE FROM work_favorites WHERE work_id = ?")
          .run(command.workId);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#readWorkFavorites();
  }

  #readWorkCovers(): WorkCoversProjection {
    const covers = this.#database
      .prepare(`
        SELECT
          cover.work_id AS "workId",
          cover.media_type AS "mediaType",
          cover.content_base64 AS "contentBase64"
        FROM work_covers AS cover
        JOIN works AS work ON work.id = cover.work_id
        WHERE work.retired_at IS NULL
        ORDER BY cover.updated_at, cover.work_id
      `)
      .all()
      .map((row) =>
        parseWorkCoverProjection({
          schemaVersion: 1,
          workId: readRequiredString(row, "workId", "Work cover row"),
          mediaType: readRequiredString(row, "mediaType", "Work cover row"),
          contentBase64: readRequiredString(
            row,
            "contentBase64",
            "Work cover row",
          ),
        }),
      );
    return parseWorkCoversProjection({ schemaVersion: 1, covers });
  }

  #saveWorkCoverSerially(
    command: SaveWorkCoverCommand,
  ): WorkCoverProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO work_covers (
            work_id,
            schema_version,
            media_type,
            content_base64,
            updated_at
          ) VALUES (?, 1, ?, ?, ?)
          ON CONFLICT (work_id) DO UPDATE SET
            media_type = excluded.media_type,
            content_base64 = excluded.content_base64,
            updated_at = excluded.updated_at
        `)
        .run(
          command.workId,
          command.mediaType,
          command.contentBase64,
          new Date().toISOString(),
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseWorkCoverProjection(command);
  }

  async #renameDocumentSerially(
    command: RenameDocumentCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const row = readStoredDocumentRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.documentId === command.documentId,
    );
    if (row === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (row.documentTitle === command.title) {
      return this.#state.catalog;
    }
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE documents
        SET
          title = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `).run(
        command.title,
        updatedAt,
        command.documentId,
        command.workId,
        row.documentRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(
          `Document changed before rename: ${command.documentId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  async #retireWorkSerially(
    command: RetireWorkCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const rows = this.#database.prepare(`
      SELECT revision
      FROM works
      WHERE id = ? AND retired_at IS NULL
    `).all(command.workId);
    if (rows.length === 0) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (rows.length !== 1) {
      throw new Error(`Work identity is ambiguous: ${command.workId}`);
    }
    const workRevision = readRequiredInteger(
      rows[0] ?? {},
      "revision",
      "Work retirement",
    );
    const remainingWorks = this.#state.catalog.works.filter(
      (work) => work.workId !== command.workId,
    );
    const activeWorkId = this.#state.catalog.activeWorkId;
    const preferredWork =
      activeWorkId === command.workId
        ? remainingWorks[0]
        : remainingWorks.find((work) => work.workId === activeWorkId);
    const preferredLocation =
      preferredWork === undefined
        ? undefined
        : {
            schemaVersion: 1 as const,
            workId: preferredWork.workId,
            documentId:
              activeWorkId === command.workId
                ? (preferredWork.documents[0]?.documentId ?? null)
                : this.#state.catalog.activeDocumentId,
          };
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE works
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        workRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work changed before retirement: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.reload(preferredLocation);
    return this.#state.catalog;
  }

  async #retireDocumentSerially(
    command: RetireDocumentCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const row = readStoredDocumentRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.documentId === command.documentId,
    );
    if (row === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const activeDocumentId = this.#state.catalog.activeDocumentId;
    const activeWorkId = this.#state.catalog.activeWorkId;
    const owner = this.#state.catalog.works.find(
      (work) => work.workId === command.workId,
    );
    if (owner === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const targetIndex = owner.documents.findIndex(
      (document) => document.documentId === command.documentId,
    );
    if (targetIndex < 0) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const remainingDocuments = owner.documents.filter(
      (document) => document.documentId !== command.documentId,
    );
    const adjacentDocument =
      remainingDocuments[targetIndex] ??
      remainingDocuments[targetIndex - 1] ??
      null;
    const preferredLocation =
      activeDocumentId === command.documentId
        ? {
            schemaVersion: 1 as const,
            workId: command.workId,
            documentId: adjacentDocument?.documentId ?? null,
          }
        : activeWorkId === null
          ? undefined
          : {
              schemaVersion: 1 as const,
              workId: activeWorkId,
              documentId: activeDocumentId,
            };
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updatedDocument = this.#database.prepare(`
        UPDATE documents
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.documentId,
        command.workId,
        row.documentRevision,
      );
      if (Number(updatedDocument.changes) !== 1) {
        throw new Error(
          `Document changed before retirement: ${command.documentId}`,
        );
      }
      this.#database.prepare(`
        UPDATE scene_episode_segments
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND document_id = ?
          AND retired_at IS NULL
      `).run(retiredAt, retiredAt, command.workId, command.documentId);
      this.#database.prepare(`
        UPDATE scene_identities
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND retired_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM scene_episode_segments AS segment
            WHERE
              segment.work_id = scene_identities.work_id
              AND segment.scene_id = scene_identities.id
              AND segment.retired_at IS NULL
          )
      `).run(retiredAt, retiredAt, command.workId);
      const updatedWork = this.#database.prepare(`
        UPDATE works
        SET
          resume_checkpoint_id = CASE
            WHEN resume_checkpoint_id IN (
              SELECT id
              FROM resume_checkpoints
              WHERE work_id = ? AND document_id = ?
            ) THEN NULL
            ELSE resume_checkpoint_id
          END,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        command.workId,
        command.documentId,
        retiredAt,
        command.workId,
        row.workRevision,
      );
      if (Number(updatedWork.changes) !== 1) {
        throw new Error(`Work changed before Document retirement: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.reload(preferredLocation);
    return this.#state.catalog;
  }

  async #retireAllDocumentsSerially(
    command: RetireAllDocumentsCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const owner = this.#state.catalog.works.find(
      (work) => work.workId === command.workId,
    );
    if (owner === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (owner.documents.length === 0) {
      return this.#state.catalog;
    }
    const activeWorkId = this.#state.catalog.activeWorkId;
    const activeDocumentId = this.#state.catalog.activeDocumentId;
    const preferredLocation = activeWorkId === command.workId
      ? {
          schemaVersion: 1 as const,
          workId: command.workId,
          documentId: null,
        }
      : activeWorkId === null
        ? undefined
        : {
            schemaVersion: 1 as const,
            workId: activeWorkId,
            documentId: activeDocumentId,
          };
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updatedDocuments = this.#database.prepare(`
        UPDATE documents
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `).run(retiredAt, retiredAt, command.workId);
      if (Number(updatedDocuments.changes) !== owner.documents.length) {
        throw new Error(
          `Documents changed before all-Document retirement: ${command.workId}`,
        );
      }
      this.#database.prepare(`
        UPDATE scene_episode_segments
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE work_id = ? AND retired_at IS NULL
      `).run(retiredAt, retiredAt, command.workId);
      this.#database.prepare(`
        UPDATE scene_identities
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE work_id = ? AND retired_at IS NULL
      `).run(retiredAt, retiredAt, command.workId);
      const updatedWork = this.#database.prepare(`
        UPDATE works
        SET
          resume_checkpoint_id = NULL,
          revision = revision + 1,
          updated_at = ?
        WHERE id = ? AND retired_at IS NULL
      `).run(retiredAt, command.workId);
      if (Number(updatedWork.changes) !== 1) {
        throw new Error(
          `Work changed before all-Document retirement: ${command.workId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.reload(preferredLocation);
    return this.#state.catalog;
  }

  async #moveDocumentSerially(
    command: MoveDocumentCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const owner = this.#state.catalog.works.find(
      (work) => work.workId === command.workId,
    );
    if (owner === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const currentIndex = owner.documents.findIndex(
      (document) => document.documentId === command.documentId,
    );
    if (currentIndex < 0) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const targetIndex =
      currentIndex + (command.direction === "earlier" ? -1 : 1);
    const targetSummary = owner.documents[targetIndex];
    if (targetSummary === undefined) {
      return this.#state.catalog;
    }
    const rows = readStoredDocumentRows(this.#database);
    const currentRow = rows.find(
      (row) =>
        row.workId === command.workId &&
        row.documentId === command.documentId,
    );
    const targetRow = rows.find(
      (row) =>
        row.workId === command.workId &&
        row.documentId === targetSummary.documentId,
    );
    if (currentRow === undefined || targetRow === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updateOrder = this.#database.prepare(`
        UPDATE documents
        SET
          order_key = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `);
      const moved = updateOrder.run(
        targetRow.documentOrderKey,
        updatedAt,
        currentRow.documentId,
        command.workId,
        currentRow.documentRevision,
      );
      const displaced = updateOrder.run(
        currentRow.documentOrderKey,
        updatedAt,
        targetRow.documentId,
        command.workId,
        targetRow.documentRevision,
      );
      if (Number(moved.changes) !== 1 || Number(displaced.changes) !== 1) {
        throw new Error(
          `Document order changed before move: ${command.documentId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  async #createDocumentFolderSerially(
    command: CreateDocumentFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (
      command.parentFolderId !== null &&
      !readStoredDocumentFolderRows(this.#database).some(
        (folder) =>
          folder.workId === command.workId &&
          folder.folderId === command.parentFolderId,
      )
    ) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.parentFolderId}`,
      );
    }
    const folderId = entityId<"DocumentFolder">(randomUUID());
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const created = this.#database.prepare(`
        INSERT INTO document_folders (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          work_id,
          parent_folder_id,
          title,
          order_key
        )
        SELECT ?, ?, ?, ?, ?, NULL, id, ?, ?, ?
        FROM works
        WHERE id = ? AND retired_at IS NULL
      `).run(
        folderId,
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        1,
        now,
        now,
        command.parentFolderId,
        command.title,
        JSON.stringify([now, folderId]),
        command.workId,
      );
      if (Number(created.changes) !== 1) {
        throw new Error(`Work changed before folder creation: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  async #renameDocumentFolderSerially(
    command: RenameDocumentFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const folder = readStoredDocumentFolderRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.folderId === command.folderId,
    );
    if (folder === undefined) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.folderId}`,
      );
    }
    if (folder.title === command.title) {
      return this.#state.catalog;
    }
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE document_folders
      SET
        title = ?,
        revision = revision + 1,
        updated_at = ?
      WHERE
        id = ?
        AND work_id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      command.title,
      updatedAt,
      command.folderId,
      command.workId,
      folder.revision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Document folder changed before rename: ${command.folderId}`);
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  async #placeDocumentInFolderSerially(
    command: PlaceDocumentInFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const document = readStoredDocumentRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.documentId === command.documentId,
    );
    if (document === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (
      command.folderId !== null &&
      !readStoredDocumentFolderRows(this.#database).some(
        (folder) =>
          folder.workId === command.workId &&
          folder.folderId === command.folderId,
      )
    ) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.folderId}`,
      );
    }
    if (document.folderId === command.folderId) {
      return this.#state.catalog;
    }
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE documents
      SET
        folder_id = ?,
        revision = revision + 1,
        updated_at = ?
      WHERE
        id = ?
        AND work_id = ?
        AND revision = ?
        AND retired_at IS NULL
        AND archived_at IS NULL
    `).run(
      command.folderId,
      updatedAt,
      command.documentId,
      command.workId,
      document.documentRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Document changed before folder placement: ${command.documentId}`);
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  async #retireDocumentFolderSerially(
    command: RetireDocumentFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const folder = readStoredDocumentFolderRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.folderId === command.folderId,
    );
    if (folder === undefined) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.folderId}`,
      );
    }
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(`
        UPDATE documents
        SET
          folder_id = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE work_id = ? AND folder_id = ?
      `).run(
        folder.parentFolderId,
        retiredAt,
        command.workId,
        command.folderId,
      );
      this.#database.prepare(`
        UPDATE document_folders
        SET
          parent_folder_id = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND parent_folder_id = ?
          AND retired_at IS NULL
      `).run(
        folder.parentFolderId,
        retiredAt,
        command.workId,
        command.folderId,
      );
      const retired = this.#database.prepare(`
        UPDATE document_folders
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.folderId,
        command.workId,
        folder.revision,
      );
      if (Number(retired.changes) !== 1) {
        throw new Error(`Document folder changed before retirement: ${command.folderId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#state.catalog;
  }

  async #reloadPreservingActiveLocation(): Promise<void> {
    const activeWorkId = this.#state.catalog.activeWorkId;
    if (activeWorkId === null) {
      await this.reload();
      return;
    }
    await this.reload({
      schemaVersion: 1,
      workId: activeWorkId,
      documentId: this.#state.catalog.activeDocumentId,
    });
  }

  createDocument(value: unknown): Promise<CreateDocumentResult> {
    this.#infrastructure.assertOpen();
    const execution = this.#operations.enqueueMutation(() =>
      this.#createDocumentSerially(value));

    return execution;
  }

  async #createDocumentSerially(value: unknown): Promise<CreateDocumentResult> {
    const command = parseCreateDocumentCommand(value);
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const now = new Date().toISOString();
    const documentId = randomUUID();
    const manuscriptId = randomUUID();
    const revisionId = randomUUID();
    const revisionInput = Object.freeze({
      revisionId: entityId<"DocumentRevision">(revisionId),
      workId: command.workId,
      documentId: entityId<"Document">(documentId),
      expectedCurrentRevisionId: null,
      content: "",
      cause: "create-document",
      createdAt: now,
      durableAt: now,
    });
    const published = await this.#blobStore.append({
      bytes: this.#blobProfile.codec.encode(revisionInput.content),
      metadata: this.#blobProfile.metadataForAppend(revisionInput),
      temporaryEntryIdentity:
        this.#blobProfile.temporaryEntryIdentityForAppend(revisionInput),
    });
    const blobRef = this.#blobProfile.blobRefForAddress(published.address);
    const descriptor = this.#blobProfile.codec.describe("");
    const records = createDocumentRecords({
      now,
      workId: command.workId,
      title: command.title,
      documentId,
      manuscriptId,
      revisionId,
      blobRef,
      checksumIdentity: published.address.checksumIdentity,
      checksumValue: published.address.checksumValue,
      byteLength: published.byteLength,
      contentHash: descriptor.contentHash,
      includeBlobManifest: shouldInsertBlobManifest(this.#database, {
        blobRef,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
      }),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });
    const location = parseActivateWorkspaceLocationCommand({
      schemaVersion: 1,
      workId: command.workId,
      documentId,
    });
    await this.reload(location);
    return parseCreateDocumentResult({
      schemaVersion: 1,
      workId: command.workId,
      documentId,
      revisionId,
    });
  }

  createFirstWork(value: unknown): Promise<CreateFirstWorkResult> {
    this.#infrastructure.assertOpen();
    const execution = this.#operations.enqueueMutation(() =>
      this.#createWorkSerially(
        parseCreateFirstWorkCommand(value),
        true,
      ));

    return execution;
  }

  createWork(value: unknown): Promise<CreateWorkResult> {
    this.#infrastructure.assertOpen();
    const execution = this.#operations.enqueueMutation(() =>
      this.#createWorkSerially(
        parseCreateWorkCommand(value),
        false,
      ));

    return execution;
  }

  async #createWorkSerially(
    command: CreateFirstWorkCommand,
    requireEmptyCatalog: boolean,
  ): Promise<CreateWorkResult> {
    if (requireEmptyCatalog && !this.#state.catalog.canCreateFirstWork) {
      throw new Error("The local workspace already contains a Work");
    }
    const studioRows = this.#database
      .prepare(STUDIO_ROWS_SQL)
      .all();
    if (studioRows.length > 1) {
      throw new Error("Local workspace has more than one Studio owner");
    }
    const includeStudio = studioRows.length === 0;
    const studioId = includeStudio
      ? randomUUID()
      : readRequiredString(
          studioRows[0] ?? {},
          "id",
          "Studio lookup",
        );
    const now = new Date().toISOString();
    const workId = randomUUID();
    const settingsId = randomUUID();
    const activityPolicyId = randomUUID();
    const focusPolicyId = randomUUID();
    const sceneRuleSetId = randomUUID();
    const plotBoardId = randomUUID();
    const plotLaneId = randomUUID();
    const documentId = randomUUID();
    const manuscriptId = randomUUID();
    const revisionId = randomUUID();
    const revisionInput = Object.freeze({
      revisionId: entityId<"DocumentRevision">(revisionId),
      workId: entityId<"Work">(workId),
      documentId: entityId<"Document">(documentId),
      expectedCurrentRevisionId: null,
      content: "",
      cause: "create-first-document",
      createdAt: now,
      durableAt: now,
    });
    const published = await this.#blobStore.append({
      bytes: this.#blobProfile.codec.encode(revisionInput.content),
      metadata: this.#blobProfile.metadataForAppend(revisionInput),
      temporaryEntryIdentity:
        this.#blobProfile.temporaryEntryIdentityForAppend(revisionInput),
    });
    const blobRef = this.#blobProfile.blobRefForAddress(
      published.address,
    );
    const descriptor = this.#blobProfile.codec.describe("");
    const records = createInitialRecords({
      includeStudio,
      studioId,
      studioDisplayName: this.#options.studioDisplayName,
      locale: this.#options.locale,
      timezone: this.#options.timezone,
      command,
      now,
      workId,
      settingsId,
      activityPolicyId,
      focusPolicyId,
      sceneRuleSetId,
      plotBoardId,
      plotLaneId,
      documentId,
      manuscriptId,
      revisionId,
      blobRef,
      checksumIdentity: published.address.checksumIdentity,
      checksumValue: published.address.checksumValue,
      byteLength: published.byteLength,
      contentHash: descriptor.contentHash,
      defaults: this.#options.defaults,
      includeBlobManifest: shouldInsertBlobManifest(this.#database, {
        blobRef,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
      }),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });
    await this.reload({
      schemaVersion: 1,
      workId: entityId<"Work">(workId),
      documentId: entityId<"Document">(documentId),
    });
    return parseCreateWorkResult({
      schemaVersion: 1,
      workId,
      documentId,
      revisionId,
    });
  }

  async reload(
    preferredLocation?: ActivateWorkspaceLocationCommand,
  ): Promise<void> {
    const existingTargets = new Map(this.#state.documentTargets);
    const loaded = await loadWorkspaceState(
      this.#database,
      this.#revisionStore,
      this.#options.emptyDocumentProfile,
      this.#ledger.createResumeCheckpointCaptureTransaction({}),
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      preferredLocation,
    );
    this.#state.replaceCatalog(loaded.catalog);
    this.#state.replaceDocumentProfile(loaded.documentProfile);
    this.#state.replaceResumeProjection(loaded.resumeProjection);
    this.#state.clearDocumentTargets();
    for (const loadedTarget of loaded.documentTargets) {
      const existingTarget = existingTargets.get(
        loadedTarget.documentId,
      );
      if (existingTarget === undefined) {
        this.#state.installDocumentTarget(
          loadedTarget.documentId,
          loadedTarget,
        );
        continue;
      }
      if (
        existingTarget.currentRevisionId !==
          loadedTarget.currentRevisionId ||
        existingTarget.text !== loadedTarget.text ||
        existingTarget.workId !== loadedTarget.workId
      ) {
        throw new Error(
          `Workspace reload diverged from the active durable target: ${loadedTarget.documentId}`,
        );
      }
      this.#state.installDocumentTarget(
        existingTarget.documentId,
        existingTarget,
      );
    }
  }
}

