import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { CaptureFragmentCommand,FragmentListProjection,FragmentProjection,FragmentShelfProfile,ListFragmentsCommand,RecordFragmentUseCommand,RetireFragmentCommand,UpdateFragmentCommand } from "../../../application/fragments/fragment-contract";
import { parseCaptureFragmentCommand,parseFragmentListProjection,parseFragmentProjection,parseFragmentShelfProfile,parseListFragmentsCommand,parseRecordFragmentUseCommand,parseRetireFragmentCommand,parseUpdateFragmentCommand } from "../../../application/fragments/fragment-contract";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { StoredFragmentRow } from "../repositories/fragments";
import { readStoredFragmentRowById,readStoredFragmentRows } from "../repositories/fragments";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns fragments commands and their existing transaction boundaries. */
export class FragmentsService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "fragmentProfile" | "defaults">;
  readonly #database: NodeSqliteDatabase;
  readonly #revisionStore: RevisionStore;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "fragmentProfile" | "defaults">;
    readonly database: NodeSqliteDatabase;
    readonly revisionStore: RevisionStore;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#database = input.database;
    this.#revisionStore = input.revisionStore;
    this.#ledger = input.ledger;
    this.#infrastructure = input.infrastructure;
  }

  #getFragmentProfile(): FragmentShelfProfile {
    const profile = this.#options.fragmentProfile;
    if (profile === undefined) {
      throw new Error("Fragment shelf profile is not configured");
    }
    return parseFragmentShelfProfile(profile);
  }

  captureFragment(value: unknown): Promise<FragmentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCaptureFragmentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#captureFragmentSerially(command);
    });

    return execution;
  }

  listFragments(value: unknown): Promise<FragmentListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListFragmentsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listFragmentsSerially(command),
    );
  }

  updateFragment(value: unknown): Promise<FragmentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateFragmentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateFragmentSerially(command);
    });

    return execution;
  }

  recordFragmentUse(value: unknown): Promise<FragmentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRecordFragmentUseCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#recordFragmentUseSerially(command);
    });

    return execution;
  }

  retireFragment(value: unknown): Promise<FragmentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireFragmentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireFragmentSerially(command);
    });

    return execution;
  }

  #assertConfiguredFragmentKind(kindId: string): void {
    if (!this.#getFragmentProfile().kinds.some((kind) => kind.id === kindId)) {
      throw new Error(`Unknown fragment kind: ${kindId}`);
    }
  }

  async #projectFragmentRows(
    rows: readonly StoredFragmentRow[],
  ): Promise<readonly FragmentProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#state.documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return parseFragmentProjection({
          schemaVersion: 1,
          ...row,
          integrity: "broken",
          range: null,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      return parseFragmentProjection({
        schemaVersion: 1,
        ...row,
        integrity,
        range: resolution.status === "resolved"
          ? {
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            }
          : null,
      });
    }));
  }

  async #captureFragmentSerially(
    command: CaptureFragmentCommand,
  ): Promise<FragmentProjection> {
    this.#assertConfiguredFragmentKind(command.kindId);
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("Fragment selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Fragment selected text does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const fragmentId = entityId<"Fragment">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: fragmentId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "fragment",
        ...createRecordMeta(createdAt),
        id: fragmentId,
        workId: command.workId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        kindId: command.kindId,
        title: command.title,
        pinned: false,
        useCount: 0,
      });
    });
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      fragmentId,
    );
    if (stored === null) {
      throw new Error(`Stored fragment is missing: ${fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored fragment could not be projected: ${fragmentId}`);
    }
    return projection;
  }

  async #listFragmentsSerially(
    command: ListFragmentsCommand,
  ): Promise<FragmentListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const fragments = await this.#projectFragmentRows(
      readStoredFragmentRows(this.#database, command.workId),
    );
    return parseFragmentListProjection({
      schemaVersion: 1,
      workId: command.workId,
      fragments,
    });
  }

  async #updateFragmentSerially(
    command: UpdateFragmentCommand,
  ): Promise<FragmentProjection> {
    const current = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (current === null) {
      throw new Error(
        `Work/fragment boundary violation: ${command.workId}/${command.fragmentId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Fragment is retired: ${command.fragmentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const kindId = command.changes.kindId ?? current.kindId;
    this.#assertConfiguredFragmentKind(kindId);
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE fragments
      SET
        revision = revision + 1,
        updated_at = ?,
        kind_id = ?,
        title = ?,
        pinned = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      kindId,
      command.changes.title ?? current.title,
      (command.changes.pinned ?? current.pinned) ? 1 : 0,
      command.workId,
      command.fragmentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (stored === null) {
      throw new Error(`Updated fragment is missing: ${command.fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Updated fragment could not be projected: ${command.fragmentId}`);
    }
    return projection;
  }

  async #recordFragmentUseSerially(
    command: RecordFragmentUseCommand,
  ): Promise<FragmentProjection> {
    const current = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (current === null) {
      throw new Error(
        `Work/fragment boundary violation: ${command.workId}/${command.fragmentId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Fragment is retired: ${command.fragmentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    if (!Number.isSafeInteger(current.useCount + 1)) {
      throw new Error(`Fragment use count cannot advance: ${command.fragmentId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE fragments
      SET
        revision = revision + 1,
        updated_at = ?,
        use_count = use_count + 1
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.workId,
      command.fragmentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (stored === null) {
      throw new Error(`Used fragment is missing: ${command.fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Used fragment could not be projected: ${command.fragmentId}`);
    }
    return projection;
  }

  async #retireFragmentSerially(
    command: RetireFragmentCommand,
  ): Promise<FragmentProjection> {
    const current = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (current === null) {
      throw new Error(
        `Work/fragment boundary violation: ${command.workId}/${command.fragmentId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Fragment is already retired: ${command.fragmentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const retiredAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE fragments
      SET
        revision = revision + 1,
        updated_at = ?,
        retired_at = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      retiredAt,
      retiredAt,
      command.workId,
      command.fragmentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (stored === null) {
      throw new Error(`Retired fragment is missing: ${command.fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Retired fragment could not be projected: ${command.fragmentId}`);
    }
    return projection;
  }
}

