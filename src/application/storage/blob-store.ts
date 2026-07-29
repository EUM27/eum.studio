export type BlobMetadataValue =
  string | number | boolean | null;

export type BlobMetadata =
  Readonly<
    Record<
      string,
      BlobMetadataValue
    >
  >;

export type BlobAddress = {
  readonly checksumIdentity:
    string;
  readonly checksumValue: string;
};

export type AppendImmutableBlobInput = {
  readonly bytes: Uint8Array;
  readonly metadata: BlobMetadata;
  readonly temporaryEntryIdentity:
    string;
};

export type AppendImmutableBlobReceipt = {
  readonly address: BlobAddress;
  readonly byteLength: number;
  readonly metadata: BlobMetadata;
  readonly publication:
    | "published"
    | "existing-verified";
};

export type ReadImmutableBlobReceipt = {
  readonly address: BlobAddress;
  readonly bytes: Uint8Array;
  readonly byteLength: number;
};

export type BlobReachabilityQuery = {
  isReachable(
    address: BlobAddress,
  ): Promise<boolean>;
};

export type PublishedBlobInventoryEntry = {
  readonly address: BlobAddress;
  readonly actualChecksumValue:
    string;
  readonly byteLength: number;
  readonly relativePathSegments:
    readonly string[];
  readonly status:
    | "verified"
    | "corrupt";
  readonly reachable: boolean;
};

export type TemporaryBlobInventoryEntry = {
  readonly temporaryEntryIdentity:
    string;
  readonly actualChecksumValue:
    string;
  readonly byteLength: number;
  readonly relativePathSegments:
    readonly string[];
};

export type BlobInventoryReport = {
  readonly checksumIdentity:
    string;
  readonly fingerprint: string;
  readonly published:
    readonly PublishedBlobInventoryEntry[];
  readonly temporary:
    readonly TemporaryBlobInventoryEntry[];
};

export type CleanupImmutableBlobStoreInput = {
  readonly expectedInventoryFingerprint:
    string;
  readonly selectedPublishedAddresses:
    readonly BlobAddress[];
  readonly selectedTemporaryEntryIdentities:
    readonly string[];
  readonly reachability:
    BlobReachabilityQuery;
};

export type CleanupImmutableBlobStoreReceipt = {
  readonly inventoryFingerprintBefore:
    string;
  readonly inventoryFingerprintAfter:
    string;
  readonly deletedPublishedAddresses:
    readonly BlobAddress[];
  readonly deletedTemporaryEntryIdentities:
    readonly string[];
};

export interface ImmutableBlobStore {
  append(
    input: AppendImmutableBlobInput,
  ): Promise<
    AppendImmutableBlobReceipt
  >;
  readExact(
    address: BlobAddress,
  ): Promise<
    ReadImmutableBlobReceipt
  >;
  inventory(
    input: BlobReachabilityQuery,
  ): Promise<BlobInventoryReport>;
  cleanup(
    input:
      CleanupImmutableBlobStoreInput,
  ): Promise<
    CleanupImmutableBlobStoreReceipt
  >;
}

export class BlobContentMismatchError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BlobContentMismatchError";
  }
}

export class BlobNotFoundError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BlobNotFoundError";
  }
}

export class BlobCleanupRefusedError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BlobCleanupRefusedError";
  }
}

export class BlobPublicationConflictError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BlobPublicationConflictError";
  }
}
