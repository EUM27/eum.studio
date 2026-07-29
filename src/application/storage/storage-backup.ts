export type StorageBackupManifestData =
  Readonly<Record<string, unknown>>;

export type StorageBackupReportData =
  Readonly<Record<string, unknown>>;

export interface StorageBackupPort {
  create(): Promise<
    StorageBackupReportData
  >;
  restore(
    manifest:
      StorageBackupManifestData,
  ): Promise<
    StorageBackupReportData
  >;
}
