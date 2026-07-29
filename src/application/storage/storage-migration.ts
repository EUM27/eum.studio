export type StorageMigrationStepReceipt = {
  readonly receiptId: string;
  readonly migrationId: string;
  readonly fromSchemaVersion:
    number;
  readonly toSchemaVersion: number;
  readonly definitionChecksumIdentity:
    string;
  readonly definitionChecksumValue:
    string;
  readonly logicalSnapshotScopeIdentity:
    string;
  readonly beforeLogicalSnapshotChecksumValue:
    string;
  readonly afterLogicalSnapshotChecksumValue:
    string;
  readonly startedAt: string;
  readonly completedAt: string;
};

export type StorageMigrationReport = {
  readonly requestedTargetSchemaVersion:
    number;
  readonly initialSchemaVersion:
    number;
  readonly finalSchemaVersion:
    number;
  readonly noOp: boolean;
  readonly steps:
    readonly StorageMigrationStepReceipt[];
};

export interface StorageMigrationRunnerPort {
  migrateTo(
    targetSchemaVersion: number,
  ): Promise<
    StorageMigrationReport
  >;
}

export type MigrateStorageInput = {
  readonly targetSchemaVersion:
    number;
  readonly runner:
    StorageMigrationRunnerPort;
};

export async function migrateStorage(
  input: MigrateStorageInput,
): Promise<
  StorageMigrationReport
> {
  return input.runner.migrateTo(
    input.targetSchemaVersion,
  );
}
