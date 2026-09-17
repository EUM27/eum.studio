import type { EntityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceRuntimeState } from "../state";

/** Owns infrastructure commands and their existing transaction boundaries. */
export class InfrastructureService {
  readonly #state: WorkspaceRuntimeState;
  #closed = false;
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  }) {
    this.#state = input.state;
    this.#database = input.database;
    this.#ledger = input.ledger;
  }

  assertOpen(): void {
    if (this.#closed) {
      throw new Error("Local workspace runtime is closed");
    }
  }

  assertAssistantWorkExists(workId: EntityId<"Work">): void {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#database.close();
    this.#ledger.close();
  }
}

