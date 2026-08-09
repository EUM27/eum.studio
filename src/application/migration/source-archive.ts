export type SourceArchiveFormat = {
  readonly identity: string;
  readonly version: string;
};

export type SourceSnapshotReceipt = {
  readonly snapshotId: string;
  readonly sourceKind: "file";
  readonly sourceLocator: string;
  readonly capturedAt: string;
  readonly byteLength: number;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly rawEntry: string;
};

export type ConnectorMetadataReceipt = {
  readonly connectorKind: string;
  readonly credentialKind: string;
  readonly present: boolean;
};

export type SourceArchiveManifest = {
  readonly schemaVersion: 1;
  readonly format: SourceArchiveFormat;
  readonly sourceProfileId: string;
  readonly capturedAt: string;
  readonly checksumIdentity: string;
  readonly snapshots: readonly SourceSnapshotReceipt[];
  readonly connectorMetadata: readonly ConnectorMetadataReceipt[];
};

export type SourceArchiveExportReport = {
  readonly manifest: SourceArchiveManifest;
  readonly finalArchiveRootPath: string;
  readonly publication: "published";
};
