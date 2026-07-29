import type {
  Poc3LedgerRecord,
} from "../../domain/poc-3-storage-ledger";

export interface StorageTransaction {
  write(
    record: Poc3LedgerRecord,
  ): void;
}

export type StorageIdentityReceipt = {
  readonly identity: string;
  readonly checksumIdentity: string;
};

export type BackupTarget = {
  readonly identity: string;
};

export type SnapshotReceipt =
  StorageIdentityReceipt;

export type IntegrityReport =
  StorageIdentityReceipt;

export type MigrationReport =
  StorageIdentityReceipt & {
    readonly targetSchemaVersion:
      number;
  };

export interface StorageService {
  transaction<T>(
    run: (
      tx: StorageTransaction,
    ) => Promise<T>,
  ): Promise<T>;
  createConsistentSnapshot(
    target: BackupTarget,
  ): Promise<SnapshotReceipt>;
  verifyIntegrity():
    Promise<IntegrityReport>;
  migrate(
    targetSchemaVersion: number,
  ): Promise<MigrationReport>;
}
