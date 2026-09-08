import { randomUUID } from "node:crypto";
import type { ManuscriptDocumentProfile } from "../../../application/editor/manuscript-document-profile";
import { parseManuscriptDocumentProfile } from "../../../application/editor/manuscript-document-profile";
import type { SaveManuscriptFormattingReceipt } from "../../../application/editor/manuscript-formatting";
import { createDefaultManuscriptEditorDocumentState,parseManuscriptEditorDocumentState,parseSaveManuscriptDocumentChangeCommand,parseSaveManuscriptFormattingCommand } from "../../../application/editor/manuscript-formatting";
import type { ExportManuscriptTextCommand } from "../../../application/editor/manuscript-preflight";
import { parseExportManuscriptTextCommand } from "../../../application/editor/manuscript-preflight";
import { applyChangeBatch } from "../../../application/persistence/apply-change-batch";
import { classifyChangeBatchIdentity,parseChangeBatch } from "../../../application/persistence/change-batch";
import type { ManuscriptPersistenceProfile } from "../../../application/persistence/manuscript-persistence-profile";
import { parseManuscriptPersistenceProfile } from "../../../application/persistence/manuscript-persistence-profile";
import type { SaveReceipt } from "../../../application/persistence/save-change-batch";
import { DurableChangeBatchSaveConflictError } from "../../../application/persistence/save-change-batch";
import type { ApplyStartupRecoveryAcknowledgement,StartupRecoveryProjection } from "../../../application/persistence/startup-recovery-contract";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { ClearDocumentCompletionCommand,CompleteDocumentCommand,DocumentCompletionProjection,GetDocumentCompletionCommand } from "../../../application/workspace/document-completion";
import { deriveDocumentCompletionDate,parseClearDocumentCompletionCommand,parseCompleteDocumentCommand,parseDocumentCompletionProjection,parseGetDocumentCompletionCommand } from "../../../application/workspace/document-completion";
import { parseWorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { AcceptedBatch } from "../repositories/revisions";
import { canonicalizeEditorStateJson,readRevisionEditorStateJson } from "../repositories/revisions";
import { readNullableIdentity,readNullableString,readRequiredInteger,readRequiredString } from "../repositories/scalars";
import type { MutableDocumentSaveTarget } from "../state-contracts";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns manuscript core commands and their existing transaction boundaries. */
export class ManuscriptCoreService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "documentCompletionClock" | "timezone" | "batchingPolicy" | "formattingProfile">;
  readonly #acceptedByBatchId = new Map<
    EntityId<"ChangeBatch">,
    AcceptedBatch
  >();
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "documentCompletionClock" | "timezone" | "batchingPolicy" | "formattingProfile">;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#options = input.options;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
  }

  #getDocumentCompletionSerially(
    command: GetDocumentCompletionCommand,
  ): DocumentCompletionProjection {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const rows = this.#database.prepare(`
      SELECT
        revision,
        completed_at AS "completedAt",
        completed_date AS "completedDate",
        completed_time_zone AS "completedTimeZone",
        completed_document_revision_id AS "completedDocumentRevisionId",
        updated_at AS "updatedAt"
      FROM document_completion_status
      WHERE work_id = ? AND document_id = ?
    `).all(command.workId, command.documentId);
    if (rows.length > 1) {
      throw new Error(`Document completion identity is ambiguous: ${command.documentId}`);
    }
    if (rows.length === 0) {
      return parseDocumentCompletionProjection({
        schemaVersion: 1,
        workId: command.workId,
        documentId: command.documentId,
        revision: 0,
        completedAt: null,
        completedDate: null,
        completedTimeZone: null,
        completedDocumentRevisionId: null,
        state: "incomplete",
        updatedAt: null,
      });
    }
    const row = rows[0] ?? {};
    const completedDocumentRevisionId = readNullableIdentity<"DocumentRevision">(
      row,
      "completedDocumentRevisionId",
      "Document completion row",
    );
    return parseDocumentCompletionProjection({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      revision: readRequiredInteger(row, "revision", "Document completion row"),
      completedAt: readNullableString(row, "completedAt", "Document completion row"),
      completedDate: readNullableString(row, "completedDate", "Document completion row"),
      completedTimeZone: readNullableString(
        row,
        "completedTimeZone",
        "Document completion row",
      ),
      completedDocumentRevisionId,
      state: completedDocumentRevisionId === null
        ? "incomplete"
        : completedDocumentRevisionId === target.currentRevisionId
          ? "current"
          : "edited-after-completion",
      updatedAt: readRequiredString(row, "updatedAt", "Document completion row"),
    });
  }

  #completeDocumentSerially(
    command: CompleteDocumentCommand,
  ): DocumentCompletionProjection {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    let completion: DocumentCompletionProjection;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const ownershipRows = this.#database.prepare(`
        SELECT m.current_revision_id AS "currentRevisionId"
        FROM documents AS d
        JOIN works AS w
          ON w.id = d.work_id
        JOIN manuscripts AS m
          ON m.work_id = d.work_id
          AND m.document_id = d.id
          AND m.id = d.manuscript_id
        WHERE
          d.work_id = ?
          AND d.id = ?
          AND w.retired_at IS NULL
          AND d.retired_at IS NULL
          AND d.archived_at IS NULL
      `).all(command.workId, command.documentId);
      if (ownershipRows.length !== 1) {
        throw new Error(
          `Document is unavailable for completion: ${command.documentId}`,
        );
      }
      const durableRevisionId = entityId<"DocumentRevision">(
        readRequiredString(
          ownershipRows[0] ?? {},
          "currentRevisionId",
          "Document completion ownership row",
        ),
      );
      if (
        durableRevisionId !== command.expectedDocumentRevisionId ||
        target.currentRevisionId !== command.expectedDocumentRevisionId
      ) {
        throw new Error(
          `Document revision conflict: expected ${command.expectedDocumentRevisionId}, current ${durableRevisionId}`,
        );
      }
      const current = this.#getDocumentCompletionSerially(command);
      if (current.revision !== command.expectedCompletionRevision) {
        throw new Error(
          `Document completion revision conflict: expected ${command.expectedCompletionRevision}, current ${current.revision}`,
        );
      }
      if (current.completedDocumentRevisionId === durableRevisionId) {
        completion = current;
      } else {
        const updatedAt = this.#options.documentCompletionClock?.now() ??
          new Date().toISOString();
        const completedDate = deriveDocumentCompletionDate(
          updatedAt,
          this.#options.timezone,
        );
        if (current.revision === 0) {
          this.#database.prepare(`
            INSERT INTO document_completion_status (
              work_id,
              document_id,
              schema_version,
              revision,
              completed_at,
              completed_date,
              completed_time_zone,
              completed_document_revision_id,
              updated_at
            ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?)
          `).run(
            command.workId,
            command.documentId,
            updatedAt,
            completedDate,
            this.#options.timezone,
            durableRevisionId,
            updatedAt,
          );
        } else {
          const updated = this.#database.prepare(`
            UPDATE document_completion_status
            SET
              revision = revision + 1,
              completed_at = ?,
              completed_date = ?,
              completed_time_zone = ?,
              completed_document_revision_id = ?,
              updated_at = ?
            WHERE work_id = ? AND document_id = ? AND revision = ?
          `).run(
            updatedAt,
            completedDate,
            this.#options.timezone,
            durableRevisionId,
            updatedAt,
            command.workId,
            command.documentId,
            current.revision,
          );
          if (Number(updated.changes) !== 1) {
            throw new Error(`Document completion changed: ${command.documentId}`);
          }
        }
        completion = this.#getDocumentCompletionSerially(command);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
    this.#updateCatalogDocumentCompletion(target, completion);
    return completion;
  }

  #clearDocumentCompletionSerially(
    command: ClearDocumentCompletionCommand,
  ): DocumentCompletionProjection {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    let completion: DocumentCompletionProjection;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.#getDocumentCompletionSerially(command);
      if (current.revision !== command.expectedCompletionRevision) {
        throw new Error(
          `Document completion revision conflict: expected ${command.expectedCompletionRevision}, current ${current.revision}`,
        );
      }
      if (current.completedAt === null) {
        completion = current;
      } else {
        const updatedAt = this.#options.documentCompletionClock?.now() ??
          new Date().toISOString();
        const updated = this.#database.prepare(`
          UPDATE document_completion_status
          SET
            revision = revision + 1,
            completed_at = NULL,
            completed_date = NULL,
            completed_time_zone = NULL,
            completed_document_revision_id = NULL,
            updated_at = ?
          WHERE work_id = ? AND document_id = ? AND revision = ?
        `).run(
          updatedAt,
          command.workId,
          command.documentId,
          current.revision,
        );
        if (Number(updated.changes) !== 1) {
          throw new Error(`Document completion changed: ${command.documentId}`);
        }
        completion = this.#getDocumentCompletionSerially(command);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
    this.#updateCatalogDocumentCompletion(target, completion);
    return completion;
  }

  #updateCatalogDocumentCompletion(
    target: MutableDocumentSaveTarget,
    completion = this.#getDocumentCompletionSerially({
      schemaVersion: 1,
      workId: target.workId,
      documentId: target.documentId,
    }),
  ): void {
    this.#state.replaceCatalog(parseWorkspaceCatalogProjection({
      ...this.#state.catalog,
      works: this.#state.catalog.works.map((work) =>
        work.workId === target.workId
          ? {
              ...work,
              documents: work.documents.map((document) =>
                document.documentId === target.documentId
                  ? {
                      ...document,
                      currentRevisionId: target.currentRevisionId,
                      completion,
                    }
                  : document
              ),
            }
          : work
      ),
    }));
  }

  getDocumentCompletion(
    value: unknown,
  ): Promise<DocumentCompletionProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetDocumentCompletionCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getDocumentCompletionSerially(command)
    );
  }

  completeDocument(
    value: unknown,
  ): Promise<DocumentCompletionProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCompleteDocumentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#completeDocumentSerially(command);
    });

    return execution;
  }

  clearDocumentCompletion(
    value: unknown,
  ): Promise<DocumentCompletionProjection> {
    this.#infrastructure.assertOpen();
    const command = parseClearDocumentCompletionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#clearDocumentCompletionSerially(command);
    });

    return execution;
  }

  getManuscriptDocumentProfile(): ManuscriptDocumentProfile {
    this.#infrastructure.assertOpen();
    return this.#state.documentProfile;
  }

  getManuscriptPersistenceProfile(): ManuscriptPersistenceProfile | null {
    this.#infrastructure.assertOpen();
    if (this.#state.documentTargets.size === 0) {
      return null;
    }
    return parseManuscriptPersistenceProfile({
      schemaVersion: 1,
      batching: this.#options.batchingPolicy,
      documentSequences: [...this.#state.documentTargets.values()].map(
        (target) => ({
          documentId: target.documentId,
          nextSequence: target.nextSequence,
        }),
      ),
    });
  }

  getManuscriptStartupRecovery(): StartupRecoveryProjection {
    this.#infrastructure.assertOpen();
    return Object.freeze({
      schemaVersion: 1,
      status: "clean",
      issues: Object.freeze([]),
    });
  }

  prepareManuscriptTextExport(
    value: unknown,
  ): Promise<ExportManuscriptTextCommand> {
    this.#infrastructure.assertOpen();
    const command = parseExportManuscriptTextCommand(value);
    return this.#operations.readBarrier().then(() => {
      const target = this.#state.documentTargets.get(command.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new Error(
          `Work/document boundary violation: ${command.workId}/${command.documentId}`,
        );
      }
      return command;
    });
  }

  saveChangeBatch(value: unknown): Promise<SaveReceipt> {
    this.#infrastructure.assertOpen();
    const execution = this.#operations.enqueueSave(() =>
      this.#saveChangeBatchSerially(value));

    return execution;
  }

  saveDocumentChange(value: unknown): Promise<SaveReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseSaveManuscriptDocumentChangeCommand(value);
    const execution = this.#operations.enqueueSave(() =>
      this.#saveChangeBatchSerially(
        command.batch,
        command.editorStateJson,
      ));

    return execution;
  }

  readEditorStateForRevision(
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
    textLength: number,
  ) {
    const stored = readRevisionEditorStateJson(this.#database, {
      workId,
      documentId,
      revisionId,
    });
    return stored === undefined
      ? createDefaultManuscriptEditorDocumentState(this.#options.formattingProfile)
      : parseManuscriptEditorDocumentState(
          JSON.parse(stored),
          this.#options.formattingProfile,
          textLength,
        );
  }

  installMovedDocumentTarget(
    target: MutableDocumentSaveTarget,
    revisionId: EntityId<"DocumentRevision">,
    text: string,
  ): void {
    target.baseRevisionId = revisionId;
    target.currentRevisionId = revisionId;
    target.nextSequence = 0;
    target.text = text;
    for (const [batchId, accepted] of this.#acceptedByBatchId) {
      if (accepted.batch.documentId === target.documentId) {
        this.#acceptedByBatchId.delete(batchId);
      }
    }
  }

  saveFormatting(value: unknown): Promise<SaveManuscriptFormattingReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseSaveManuscriptFormattingCommand(value);
    const execution = this.#operations.enqueueSave(async () => {
      const target = this.#state.documentTargets.get(command.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new DurableChangeBatchSaveConflictError(
          `Work/document boundary violation: ${command.workId}/${command.documentId}`,
        );
      }
      if (target.currentRevisionId !== command.expectedCurrentRevisionId) {
        throw new DurableChangeBatchSaveConflictError(
          `Revision conflict for document ${command.documentId}`,
        );
      }
      const editorStateJson = canonicalizeEditorStateJson(
        command.editorStateJson,
        this.#options.formattingProfile,
        target.text.length,
      );
      const now = new Date().toISOString();
      const revision = await this.#revisionStore.append({
        revisionId: entityId<"DocumentRevision">(randomUUID()),
        workId: target.workId,
        documentId: target.documentId,
        expectedCurrentRevisionId: target.currentRevisionId,
        content: target.text,
        editorStateJson,
        cause: JSON.stringify({ kind: "manuscript-formatting" }),
        createdAt: now,
        durableAt: now,
      });
      target.currentRevisionId = revision.id;
      this.#updateDocumentProfile(target, editorStateJson);
      return Object.freeze({
        schemaVersion: 1 as const,
        workId: target.workId,
        documentId: target.documentId,
        revisionId: revision.id,
      });
    });

    return execution;
  }

  async #saveChangeBatchSerially(
    value: unknown,
    editorStateJsonInput?: string,
  ): Promise<SaveReceipt> {
    const batch = parseChangeBatch(value);
    const accepted = this.#acceptedByBatchId.get(batch.batchId);
    if (accepted !== undefined) {
      if (
        classifyChangeBatchIdentity(accepted.batch, batch) ===
          "duplicate" &&
        accepted.editorStateJson === editorStateJsonInput
      ) {
        return accepted.receipt;
      }
      throw new DurableChangeBatchSaveConflictError(
        `Batch identity conflict: ${batch.batchId}`,
      );
    }
    const target = this.#state.documentTargets.get(batch.documentId);
    if (target === undefined) {
      throw new DurableChangeBatchSaveConflictError(
        `Unknown local workspace document: ${batch.documentId}`,
      );
    }
    if (target.workId !== batch.workId) {
      throw new DurableChangeBatchSaveConflictError(
        `Work/document boundary violation: ${batch.workId}/${batch.documentId}`,
      );
    }
    if (target.baseRevisionId !== batch.baseRevisionId) {
      throw new DurableChangeBatchSaveConflictError(
        `Base revision conflict for document ${batch.documentId}`,
      );
    }
    if (target.nextSequence !== batch.sequence) {
      throw new DurableChangeBatchSaveConflictError(
        `Sequence conflict for document ${batch.documentId}: expected ${target.nextSequence}, received ${batch.sequence}`,
      );
    }
    const nextText = applyChangeBatch(target.text, batch);
    const editorStateJson =
      editorStateJsonInput === undefined
        ? undefined
        : canonicalizeEditorStateJson(
            editorStateJsonInput,
            this.#options.formattingProfile,
            nextText.length,
          );
    const now = new Date().toISOString();
    const revision = await this.#revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: target.workId,
      documentId: target.documentId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: nextText,
      ...(editorStateJson === undefined ? {} : { editorStateJson }),
      cause: JSON.stringify({
        kind: "manuscript-edit",
        batchId: batch.batchId,
      }),
      createdAt: now,
      durableAt: now,
    });
    const receipt = Object.freeze({
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      revisionId: revision.id,
    });
    target.currentRevisionId = revision.id;
    target.nextSequence += 1;
    target.text = nextText;
    this.#updateDocumentProfile(target, editorStateJson);
    this.#acceptedByBatchId.set(batch.batchId, {
      batch,
      receipt,
      editorStateJson,
    });
    return receipt;
  }

  #updateDocumentProfile(
    target: MutableDocumentSaveTarget,
    editorStateJson: string | undefined,
  ): void {
    this.#state.replaceDocumentProfile(parseManuscriptDocumentProfile({
      ...this.#state.documentProfile,
      documents: this.#state.documentProfile.documents.map((document) =>
        document.documentId === target.documentId &&
        document.workId === target.workId
          ? {
              workId: document.workId,
              documentId: document.documentId,
              documentRevisionId: target.currentRevisionId,
              label: document.label,
              initialText: target.text,
              ...(editorStateJson === undefined ? {} : { editorStateJson }),
            }
          : document,
      ),
    }));
    this.#updateCatalogDocumentCompletion(target);
  }

  async applyManuscriptStartupRecovery(): Promise<ApplyStartupRecoveryAcknowledgement> {
    this.#infrastructure.assertOpen();
    throw new Error("Local workspace startup recovery is not pending");
  }
}

