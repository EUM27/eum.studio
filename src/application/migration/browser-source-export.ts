import type {
  MigrationSourceBranchInventory,
  MigrationSourceBranchKind,
} from "./source-branch-inventory";

export type LegacyBrowserSourceExportProfile = {
  readonly schemaVersion: 1;
  readonly formatIdentity: string;
  readonly formatVersion: string;
  readonly checksumIdentity: string;
  readonly checksumAlgorithm: string;
  readonly secretLikeFieldFragments: readonly string[];
  readonly secretRedactionValue: string;
  readonly bundleArchive: {
    readonly sourceLocator: string;
    readonly rawEntrySegments: readonly string[];
  };
  readonly localStorageOwnershipIndex: {
    readonly key: string;
    readonly worksField: string;
    readonly documentsField: string;
    readonly workIdField: string;
    readonly documentIdField: string;
    readonly documentWorkIdField: string;
  };
  readonly localStorageRoutes: readonly {
    readonly matchKind: "exact" | "prefix";
    readonly matchValue: string;
    readonly sourceCollection: string;
    readonly sourceIdentityKind: "key" | "suffix";
    readonly valueKind: "text" | "json-or-text";
    readonly ownershipKind: "none" | "document-index";
  }[];
  readonly indexedDbRoutes: readonly {
    readonly databaseName: string;
    readonly storeName: string;
    readonly sourceCollection: string;
    readonly ownershipField: string | null;
    readonly required: boolean;
  }[];
};

export type LegacyBrowserSourceExportItem = {
  readonly branchKind: Extract<
    MigrationSourceBranchKind,
    "local-storage" | "indexed-db"
  >;
  readonly sourceLocator: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly sourceOccurrence: number;
  readonly ownershipRef: string | null;
  readonly disposition: "captured" | "secret-redacted";
  readonly redactedFieldCount: number;
  readonly value: unknown;
};

export type LegacyBrowserSourceExportCapture = {
  readonly exportedAt: string;
  readonly sourceOrigin: string;
  readonly items: readonly LegacyBrowserSourceExportItem[];
  readonly coverage: {
    readonly sourceEntryCount: number;
    readonly capturedEntryCount: number;
    readonly uncoveredEntryCount: number;
  };
};

export type LegacyBrowserSourceExportEntryReceipt = {
  readonly snapshotId: string;
  readonly sourceLocator: string;
  readonly branchKind: Extract<
    MigrationSourceBranchKind,
    "local-storage" | "indexed-db"
  >;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly sourceOccurrence: number;
  readonly ownershipRef: string | null;
  readonly disposition: "captured" | "secret-redacted";
  readonly redactedFieldCount: number;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
};

export type LegacyBrowserSourceExportReceipt = {
  readonly schemaVersion: 1;
  readonly formatIdentity: string;
  readonly formatVersion: string;
  readonly exportedAt: string;
  readonly sourceOrigin: string;
  readonly bundleByteLength: number;
  readonly bundleChecksumIdentity: string;
  readonly bundleChecksumValue: string;
  readonly coverage: LegacyBrowserSourceExportCapture["coverage"];
  readonly branchReceipts: MigrationSourceBranchInventory["branches"];
  readonly entryReceipts: readonly LegacyBrowserSourceExportEntryReceipt[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function text(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function nullableText(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return value;
}

function boolean(
  input: Record<string, unknown>,
  field: string,
  label: string,
): boolean {
  const value = input[field];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

function count(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const result = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return entry;
  });
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return Object.freeze(result);
}

export function serializeCanonicalBrowserSourceValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Browser source export contains a non-finite number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalBrowserSourceValue).join(",")}]`;
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    return `{${Object.keys(input)
      .sort((left, right) => left.localeCompare(right))
      .map((key) =>
        `${JSON.stringify(key)}:${serializeCanonicalBrowserSourceValue(input[key])}`
      )
      .join(",")}}`;
  }
  throw new Error("Browser source export contains a non-JSON value");
}

export function parseLegacyBrowserSourceExportProfile(
  value: unknown,
): LegacyBrowserSourceExportProfile {
  const label = "LegacyBrowserSourceExportProfile";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "formatIdentity",
      "formatVersion",
      "checksumIdentity",
      "checksumAlgorithm",
      "secretLikeFieldFragments",
      "secretRedactionValue",
      "bundleArchive",
      "localStorageOwnershipIndex",
      "localStorageRoutes",
      "indexedDbRoutes",
    ],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label}.schemaVersion`);
  }
  const bundleArchiveLabel = `${label}.bundleArchive`;
  const bundleArchiveInput = record(input.bundleArchive, bundleArchiveLabel);
  exact(
    bundleArchiveInput,
    ["sourceLocator", "rawEntrySegments"],
    bundleArchiveLabel,
  );
  const ownershipLabel = `${label}.localStorageOwnershipIndex`;
  const ownershipInput = record(input.localStorageOwnershipIndex, ownershipLabel);
  const ownershipFields = [
    "key",
    "worksField",
    "documentsField",
    "workIdField",
    "documentIdField",
    "documentWorkIdField",
  ] as const;
  exact(ownershipInput, ownershipFields, ownershipLabel);
  if (!Array.isArray(input.localStorageRoutes)) {
    throw new Error(`${label}.localStorageRoutes must be an array`);
  }
  const localRouteIdentities = new Set<string>();
  const localStorageRoutes = Object.freeze(input.localStorageRoutes.map(
    (entry, index) => {
      const entryLabel = `${label}.localStorageRoutes[${index}]`;
      const entryInput = record(entry, entryLabel);
      exact(
        entryInput,
        [
          "matchKind",
          "matchValue",
          "sourceCollection",
          "sourceIdentityKind",
          "valueKind",
          "ownershipKind",
        ],
        entryLabel,
      );
      if (
        entryInput.matchKind !== "exact" &&
        entryInput.matchKind !== "prefix"
      ) {
        throw new Error(`${entryLabel}.matchKind is unsupported`);
      }
      if (
        entryInput.sourceIdentityKind !== "key" &&
        entryInput.sourceIdentityKind !== "suffix"
      ) {
        throw new Error(`${entryLabel}.sourceIdentityKind is unsupported`);
      }
      if (
        entryInput.matchKind === "exact" &&
        entryInput.sourceIdentityKind === "suffix"
      ) {
        throw new Error(`${entryLabel} cannot derive a suffix from an exact key`);
      }
      if (
        entryInput.valueKind !== "text" &&
        entryInput.valueKind !== "json-or-text"
      ) {
        throw new Error(`${entryLabel}.valueKind is unsupported`);
      }
      if (
        entryInput.ownershipKind !== "none" &&
        entryInput.ownershipKind !== "document-index"
      ) {
        throw new Error(`${entryLabel}.ownershipKind is unsupported`);
      }
      const matchValue = text(entryInput, "matchValue", entryLabel);
      const identity = JSON.stringify([entryInput.matchKind, matchValue]);
      if (localRouteIdentities.has(identity)) {
        throw new Error(`${label}.localStorageRoutes contains a duplicate route`);
      }
      localRouteIdentities.add(identity);
      return Object.freeze({
        matchKind: entryInput.matchKind,
        matchValue,
        sourceCollection: text(entryInput, "sourceCollection", entryLabel),
        sourceIdentityKind: entryInput.sourceIdentityKind,
        valueKind: entryInput.valueKind,
        ownershipKind: entryInput.ownershipKind,
      });
    },
  ));
  if (!Array.isArray(input.indexedDbRoutes)) {
    throw new Error(`${label}.indexedDbRoutes must be an array`);
  }
  const indexedRouteIdentities = new Set<string>();
  const indexedDbRoutes = Object.freeze(input.indexedDbRoutes.map(
    (entry, index) => {
      const entryLabel = `${label}.indexedDbRoutes[${index}]`;
      const entryInput = record(entry, entryLabel);
      exact(
        entryInput,
        [
          "databaseName",
          "storeName",
          "sourceCollection",
          "ownershipField",
          "required",
        ],
        entryLabel,
      );
      const databaseName = text(entryInput, "databaseName", entryLabel);
      const storeName = text(entryInput, "storeName", entryLabel);
      const identity = JSON.stringify([databaseName, storeName]);
      if (indexedRouteIdentities.has(identity)) {
        throw new Error(`${label}.indexedDbRoutes contains a duplicate route`);
      }
      indexedRouteIdentities.add(identity);
      return Object.freeze({
        databaseName,
        storeName,
        sourceCollection: text(entryInput, "sourceCollection", entryLabel),
        ownershipField: nullableText(entryInput, "ownershipField", entryLabel),
        required: boolean(entryInput, "required", entryLabel),
      });
    },
  ));
  return Object.freeze({
    schemaVersion: 1,
    formatIdentity: text(input, "formatIdentity", label),
    formatVersion: text(input, "formatVersion", label),
    checksumIdentity: text(input, "checksumIdentity", label),
    checksumAlgorithm: text(input, "checksumAlgorithm", label),
    secretLikeFieldFragments: stringArray(
      input.secretLikeFieldFragments,
      `${label}.secretLikeFieldFragments`,
    ),
    secretRedactionValue: text(input, "secretRedactionValue", label),
    bundleArchive: Object.freeze({
      sourceLocator: text(
        bundleArchiveInput,
        "sourceLocator",
        bundleArchiveLabel,
      ),
      rawEntrySegments: stringArray(
        bundleArchiveInput.rawEntrySegments,
        `${bundleArchiveLabel}.rawEntrySegments`,
      ),
    }),
    localStorageOwnershipIndex: Object.freeze(Object.fromEntries(
      ownershipFields.map((field) => [
        field,
        text(ownershipInput, field, ownershipLabel),
      ]),
    )) as LegacyBrowserSourceExportProfile["localStorageOwnershipIndex"],
    localStorageRoutes,
    indexedDbRoutes,
  });
}

export function parseLegacyBrowserSourceExportReceipt(
  value: unknown,
): LegacyBrowserSourceExportReceipt {
  const label = "LegacyBrowserSourceExportReceipt";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "formatIdentity",
      "formatVersion",
      "exportedAt",
      "sourceOrigin",
      "bundleByteLength",
      "bundleChecksumIdentity",
      "bundleChecksumValue",
      "coverage",
      "branchReceipts",
      "entryReceipts",
    ],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label}.schemaVersion`);
  }
  const coverageLabel = `${label}.coverage`;
  const coverageInput = record(input.coverage, coverageLabel);
  exact(
    coverageInput,
    ["sourceEntryCount", "capturedEntryCount", "uncoveredEntryCount"],
    coverageLabel,
  );
  const coverage = Object.freeze({
    sourceEntryCount: count(coverageInput, "sourceEntryCount", coverageLabel),
    capturedEntryCount: count(
      coverageInput,
      "capturedEntryCount",
      coverageLabel,
    ),
    uncoveredEntryCount: count(
      coverageInput,
      "uncoveredEntryCount",
      coverageLabel,
    ),
  });
  if (
    coverage.capturedEntryCount + coverage.uncoveredEntryCount !==
      coverage.sourceEntryCount ||
    !Array.isArray(input.branchReceipts) ||
    !Array.isArray(input.entryReceipts)
  ) {
    throw new Error(`${label} coverage is inconsistent`);
  }
  const branchesBySnapshot = new Map<
    string,
    MigrationSourceBranchInventory["branches"][number]
  >();
  const sourceLocators = new Set<string>();
  const branchReceipts = Object.freeze(input.branchReceipts.map(
    (entry, index) => {
      const entryLabel = `${label}.branchReceipts[${index}]`;
      const entryInput = record(entry, entryLabel);
      exact(
        entryInput,
        ["snapshotId", "sourceLocator", "branchKind", "itemCount"],
        entryLabel,
      );
      if (
        entryInput.branchKind !== "local-storage" &&
        entryInput.branchKind !== "indexed-db"
      ) {
        throw new Error(`${entryLabel}.branchKind is unsupported`);
      }
      const branch = Object.freeze({
        snapshotId: text(entryInput, "snapshotId", entryLabel),
        sourceLocator: text(entryInput, "sourceLocator", entryLabel),
        branchKind: entryInput.branchKind,
        itemCount: count(entryInput, "itemCount", entryLabel),
      });
      if (
        branchesBySnapshot.has(branch.snapshotId) ||
        sourceLocators.has(branch.sourceLocator)
      ) {
        throw new Error(`${label}.branchReceipts contains a duplicate branch`);
      }
      branchesBySnapshot.set(branch.snapshotId, branch);
      sourceLocators.add(branch.sourceLocator);
      return branch;
    },
  ));
  const receiptCountsBySnapshot = new Map<string, number>();
  const receiptIdentities = new Set<string>();
  const entryReceipts = Object.freeze(input.entryReceipts.map(
    (entry, index) => {
      const entryLabel = `${label}.entryReceipts[${index}]`;
      const entryInput = record(entry, entryLabel);
      exact(
        entryInput,
        [
          "snapshotId",
          "sourceLocator",
          "branchKind",
          "sourceCollection",
          "sourceIdentity",
          "sourceOccurrence",
          "ownershipRef",
          "disposition",
          "redactedFieldCount",
          "checksumIdentity",
          "checksumValue",
        ],
        entryLabel,
      );
      if (
        entryInput.branchKind !== "local-storage" &&
        entryInput.branchKind !== "indexed-db"
      ) {
        throw new Error(`${entryLabel}.branchKind is unsupported`);
      }
      if (
        entryInput.disposition !== "captured" &&
        entryInput.disposition !== "secret-redacted"
      ) {
        throw new Error(`${entryLabel}.disposition is unsupported`);
      }
      const ownershipRef = entryInput.ownershipRef;
      if (
        ownershipRef !== null &&
        (typeof ownershipRef !== "string" || ownershipRef.length === 0)
      ) {
        throw new Error(`${entryLabel}.ownershipRef is invalid`);
      }
      const receipt = Object.freeze({
        snapshotId: text(entryInput, "snapshotId", entryLabel),
        sourceLocator: text(entryInput, "sourceLocator", entryLabel),
        branchKind: entryInput.branchKind,
        sourceCollection: text(entryInput, "sourceCollection", entryLabel),
        sourceIdentity: text(entryInput, "sourceIdentity", entryLabel),
        sourceOccurrence: count(entryInput, "sourceOccurrence", entryLabel),
        ownershipRef,
        disposition: entryInput.disposition,
        redactedFieldCount: count(
          entryInput,
          "redactedFieldCount",
          entryLabel,
        ),
        checksumIdentity: text(entryInput, "checksumIdentity", entryLabel),
        checksumValue: text(entryInput, "checksumValue", entryLabel),
      });
      const branch = branchesBySnapshot.get(receipt.snapshotId);
      if (
        branch === undefined ||
        branch.sourceLocator !== receipt.sourceLocator ||
        branch.branchKind !== receipt.branchKind
      ) {
        throw new Error(`${entryLabel} references an unknown branch`);
      }
      const identity = JSON.stringify([
        receipt.snapshotId,
        receipt.sourceCollection,
        receipt.sourceIdentity,
        receipt.sourceOccurrence,
      ]);
      if (receiptIdentities.has(identity)) {
        throw new Error(`${label}.entryReceipts contains a duplicate entry`);
      }
      receiptIdentities.add(identity);
      receiptCountsBySnapshot.set(
        receipt.snapshotId,
        (receiptCountsBySnapshot.get(receipt.snapshotId) ?? 0) + 1,
      );
      return receipt;
    },
  ));
  if (
    entryReceipts.length !== coverage.capturedEntryCount ||
    branchReceipts.some((branch) =>
      (receiptCountsBySnapshot.get(branch.snapshotId) ?? 0) !== branch.itemCount
    )
  ) {
    throw new Error(`${label} entry receipts do not match branch coverage`);
  }
  return Object.freeze({
    schemaVersion: 1,
    formatIdentity: text(input, "formatIdentity", label),
    formatVersion: text(input, "formatVersion", label),
    exportedAt: text(input, "exportedAt", label),
    sourceOrigin: text(input, "sourceOrigin", label),
    bundleByteLength: count(input, "bundleByteLength", label),
    bundleChecksumIdentity: text(input, "bundleChecksumIdentity", label),
    bundleChecksumValue: text(input, "bundleChecksumValue", label),
    coverage,
    branchReceipts,
    entryReceipts,
  });
}

function redactValue(
  value: unknown,
  fragments: readonly string[],
  redactionValue: string,
): { readonly value: unknown; readonly redactedFieldCount: number } {
  if (Array.isArray(value)) {
    let redactedFieldCount = 0;
    const items = value.map((entry) => {
      const redacted = redactValue(entry, fragments, redactionValue);
      redactedFieldCount += redacted.redactedFieldCount;
      return redacted.value;
    });
    return { value: Object.freeze(items), redactedFieldCount };
  }
  if (typeof value !== "object" || value === null) {
    serializeCanonicalBrowserSourceValue(value);
    return { value, redactedFieldCount: 0 };
  }
  let redactedFieldCount = 0;
  const result: Record<string, unknown> = {};
  for (const [field, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedField = field.toLocaleLowerCase("en-US");
    if (fragments.some((fragment) => normalizedField.includes(fragment))) {
      result[field] = redactionValue;
      redactedFieldCount += 1;
      continue;
    }
    const redacted = redactValue(entry, fragments, redactionValue);
    result[field] = redacted.value;
    redactedFieldCount += redacted.redactedFieldCount;
  }
  return { value: Object.freeze(result), redactedFieldCount };
}

function parseJsonOrText(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    serializeCanonicalBrowserSourceValue(parsed);
    return parsed;
  } catch {
    return value;
  }
}

function indexedDbSourceIdentity(key: unknown): string {
  return typeof key === "string" && key.length > 0
    ? key
    : serializeCanonicalBrowserSourceValue(key);
}

function documentOwnershipIndex(
  entries: readonly { readonly key: string; readonly value: string }[],
  profile: LegacyBrowserSourceExportProfile,
): ReadonlyMap<string, string> {
  const indexEntry = entries.find(
    (entry) => entry.key === profile.localStorageOwnershipIndex.key,
  );
  if (indexEntry === undefined) {
    return new Map();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(indexEntry.value);
  } catch {
    return new Map();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return new Map();
  }
  const input = parsed as Record<string, unknown>;
  const works = input[profile.localStorageOwnershipIndex.worksField];
  const documents = input[profile.localStorageOwnershipIndex.documentsField];
  if (!Array.isArray(works) || !Array.isArray(documents)) {
    return new Map();
  }
  const workIds = new Set(works.flatMap((work) => {
    if (typeof work !== "object" || work === null || Array.isArray(work)) {
      return [];
    }
    const id = (work as Record<string, unknown>)[
      profile.localStorageOwnershipIndex.workIdField
    ];
    return typeof id === "string" && id.length > 0 ? [id] : [];
  }));
  return new Map(documents.flatMap((document) => {
    if (
      typeof document !== "object" ||
      document === null ||
      Array.isArray(document)
    ) {
      return [];
    }
    const documentInput = document as Record<string, unknown>;
    const documentId = documentInput[
      profile.localStorageOwnershipIndex.documentIdField
    ];
    const workId = documentInput[
      profile.localStorageOwnershipIndex.documentWorkIdField
    ];
    return (
      typeof documentId === "string" &&
      documentId.length > 0 &&
      typeof workId === "string" &&
      workIds.has(workId)
    ) ? [[documentId, workId] as const] : [];
  }));
}

export function parseLegacyBrowserSourceExportBundle(
  value: unknown,
  profile: LegacyBrowserSourceExportProfile,
): LegacyBrowserSourceExportCapture {
  const label = "LegacyBrowserSourceExportBundle";
  const input = record(value, label);
  exact(
    input,
    [
      "formatIdentity",
      "formatVersion",
      "exportedAt",
      "sourceOrigin",
      "localStorageEntries",
      "indexedDatabases",
    ],
    label,
  );
  if (
    input.formatIdentity !== profile.formatIdentity ||
    input.formatVersion !== profile.formatVersion
  ) {
    throw new Error(`${label} format does not match the import profile`);
  }
  const exportedAt = text(input, "exportedAt", label);
  if (Number.isNaN(new Date(exportedAt).getTime())) {
    throw new Error(`${label}.exportedAt must be a valid instant`);
  }
  if (!Array.isArray(input.localStorageEntries)) {
    throw new Error(`${label}.localStorageEntries must be an array`);
  }
  const localKeys = new Set<string>();
  const localStorageEntries = Object.freeze(input.localStorageEntries.map(
    (entry, index) => {
      const entryLabel = `${label}.localStorageEntries[${index}]`;
      const entryInput = record(entry, entryLabel);
      exact(entryInput, ["key", "value"], entryLabel);
      const key = text(entryInput, "key", entryLabel);
      const entryValue = text(entryInput, "value", entryLabel);
      if (localKeys.has(key)) {
        throw new Error(`${label}.localStorageEntries contains a duplicate key`);
      }
      localKeys.add(key);
      return Object.freeze({ key, value: entryValue });
    },
  ));
  if (!Array.isArray(input.indexedDatabases)) {
    throw new Error(`${label}.indexedDatabases must be an array`);
  }
  const databaseNames = new Set<string>();
  const indexedDatabases = Object.freeze(input.indexedDatabases.map(
    (database, databaseIndex) => {
      const databaseLabel = `${label}.indexedDatabases[${databaseIndex}]`;
      const databaseInput = record(database, databaseLabel);
      exact(databaseInput, ["databaseName", "version", "stores"], databaseLabel);
      const databaseName = text(databaseInput, "databaseName", databaseLabel);
      if (databaseNames.has(databaseName)) {
        throw new Error(`${label}.indexedDatabases contains a duplicate database`);
      }
      databaseNames.add(databaseName);
      if (
        typeof databaseInput.version !== "number" ||
        !Number.isSafeInteger(databaseInput.version) ||
        databaseInput.version < 1 ||
        !Array.isArray(databaseInput.stores)
      ) {
        throw new Error(`${databaseLabel} version or stores are invalid`);
      }
      const storeNames = new Set<string>();
      const stores = Object.freeze(databaseInput.stores.map((store, storeIndex) => {
        const storeLabel = `${databaseLabel}.stores[${storeIndex}]`;
        const storeInput = record(store, storeLabel);
        exact(storeInput, ["storeName", "records"], storeLabel);
        const storeName = text(storeInput, "storeName", storeLabel);
        if (storeNames.has(storeName) || !Array.isArray(storeInput.records)) {
          throw new Error(`${databaseLabel}.stores is invalid`);
        }
        storeNames.add(storeName);
        const recordKeys = new Set<string>();
        const records = Object.freeze(storeInput.records.map((entry, recordIndex) => {
          const recordLabel = `${storeLabel}.records[${recordIndex}]`;
          const recordInput = record(entry, recordLabel);
          exact(recordInput, ["key", "value"], recordLabel);
          const key = serializeCanonicalBrowserSourceValue(recordInput.key);
          serializeCanonicalBrowserSourceValue(recordInput.value);
          if (recordKeys.has(key)) {
            throw new Error(`${storeLabel}.records contains a duplicate key`);
          }
          recordKeys.add(key);
          return Object.freeze({ key: recordInput.key, value: recordInput.value });
        }));
        return Object.freeze({ storeName, records });
      }));
      return Object.freeze({
        databaseName,
        version: databaseInput.version,
        stores,
      });
    },
  ));
  for (const route of profile.indexedDbRoutes.filter((entry) => entry.required)) {
    const database = indexedDatabases.find(
      (entry) => entry.databaseName === route.databaseName,
    );
    if (!database?.stores.some((store) => store.storeName === route.storeName)) {
      throw new Error(`${label} is missing a required IndexedDB store`);
    }
  }

  const fragments = Object.freeze(profile.secretLikeFieldFragments.map(
    (fragment) => fragment.toLocaleLowerCase("en-US"),
  ));
  const ownershipByDocument = documentOwnershipIndex(
    localStorageEntries,
    profile,
  );
  const pendingItems: Omit<LegacyBrowserSourceExportItem, "sourceOccurrence">[] = [];
  for (const entry of localStorageEntries) {
    const routes = profile.localStorageRoutes.filter((route) =>
      route.matchKind === "exact"
        ? entry.key === route.matchValue
        : entry.key.startsWith(route.matchValue)
    );
    if (routes.length > 1) {
      throw new Error(`${label} localStorage key matches multiple routes`);
    }
    const route = routes[0];
    const sourceIdentity = route?.sourceIdentityKind === "suffix"
      ? entry.key.slice(route.matchValue.length)
      : entry.key;
    if (sourceIdentity.length === 0) {
      throw new Error(`${label} localStorage route produced an empty identity`);
    }
    const keyIsSecret = fragments.some((fragment) =>
      entry.key.toLocaleLowerCase("en-US").includes(fragment)
    );
    const candidateValue = route?.valueKind === "text"
      ? entry.value
      : parseJsonOrText(entry.value);
    const redacted = keyIsSecret
      ? { value: profile.secretRedactionValue, redactedFieldCount: 1 }
      : redactValue(
        candidateValue,
        fragments,
        profile.secretRedactionValue,
      );
    pendingItems.push(Object.freeze({
      branchKind: "local-storage",
      sourceLocator: "browser-export:localStorage",
      sourceCollection: route?.sourceCollection ?? "localStorage",
      sourceIdentity,
      ownershipRef: route?.ownershipKind === "document-index"
        ? ownershipByDocument.get(sourceIdentity) ?? null
        : null,
      disposition: redacted.redactedFieldCount > 0
        ? "secret-redacted"
        : "captured",
      redactedFieldCount: redacted.redactedFieldCount,
      value: redacted.value,
    }));
  }
  for (const database of indexedDatabases) {
    for (const store of database.stores) {
      const route = profile.indexedDbRoutes.find((entry) =>
        entry.databaseName === database.databaseName &&
        entry.storeName === store.storeName
      );
      for (const entry of store.records) {
        const redacted = redactValue(
          entry.value,
          fragments,
          profile.secretRedactionValue,
        );
        const ownershipValue = route?.ownershipField === null ||
          route?.ownershipField === undefined ||
          typeof redacted.value !== "object" ||
          redacted.value === null ||
          Array.isArray(redacted.value)
          ? null
          : (redacted.value as Record<string, unknown>)[route.ownershipField];
        pendingItems.push(Object.freeze({
          branchKind: "indexed-db",
          sourceLocator:
            `browser-export:indexedDB:${database.databaseName}/${store.storeName}`,
          sourceCollection: route?.sourceCollection ?? "indexedDb",
          sourceIdentity: indexedDbSourceIdentity(entry.key),
          ownershipRef: typeof ownershipValue === "string" &&
            ownershipValue.length > 0
            ? ownershipValue
            : null,
          disposition: redacted.redactedFieldCount > 0
            ? "secret-redacted"
            : "captured",
          redactedFieldCount: redacted.redactedFieldCount,
          value: redacted.value,
        }));
      }
    }
  }
  const occurrences = new Map<string, number>();
  const items = Object.freeze(pendingItems.map((item) => {
    const identity = JSON.stringify([
      item.sourceLocator,
      item.sourceCollection,
      item.sourceIdentity,
    ]);
    const sourceOccurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, sourceOccurrence + 1);
    return Object.freeze({ ...item, sourceOccurrence });
  }));
  return Object.freeze({
    exportedAt,
    sourceOrigin: text(input, "sourceOrigin", label),
    items,
    coverage: Object.freeze({
      sourceEntryCount: items.length,
      capturedEntryCount: items.length,
      uncoveredEntryCount: 0,
    }),
  });
}
