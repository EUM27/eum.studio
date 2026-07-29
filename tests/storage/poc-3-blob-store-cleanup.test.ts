import {
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BlobCleanupRefusedError,
} from "../../src/application/storage/blob-store";
import type {
  AppendImmutableBlobReceipt,
  BlobReachabilityQuery,
} from "../../src/application/storage/blob-store";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";

type FaultStage =
  | "partial-write"
  | "sync"
  | "publish";

type BlobFixtureManifest = {
  readonly layout: {
    readonly publishedDirectorySegmentCount:
      number;
    readonly temporaryDirectorySegmentCount:
      number;
    readonly shardWidths:
      readonly number[];
  };
  readonly counts: {
    readonly partialWriteDivisor:
      number;
  };
  readonly materials: {
    readonly checksumAlgorithms:
      readonly string[];
    readonly byteText:
      readonly string[];
  };
  readonly faultStages:
    readonly FaultStage[];
};

async function readFixture(): Promise<
  BlobFixtureManifest
> {
  return JSON.parse(
    await readFile(
      new URL(
        "../fixtures/storage/poc-3-blob-store.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as BlobFixtureManifest;
}

function runtimeBytes(
  fixture: BlobFixtureManifest,
): Uint8Array {
  return new TextEncoder().encode(
    [
      randomUUID(),
      ...fixture.materials
        .byteText,
      randomUUID(),
    ].join(randomUUID()),
  );
}

async function createHarness() {
  const fixture =
    await readFixture();
  const algorithm =
    fixture.materials
      .checksumAlgorithms[0];
  const faultStage =
    fixture.faultStages[0];
  if (
    algorithm === undefined ||
    faultStage === undefined
  ) {
    throw new Error(
      "Caller fixture requires checksum and fault-stage materials",
    );
  }
  const temporaryRoot =
    await mkdtemp(
      join(
        tmpdir(),
        randomUUID(),
      ),
    );
  const profile =
    parseNodeImmutableBlobStoreProfile({
      rootDirectoryPath:
        join(
          temporaryRoot,
          randomUUID(),
        ),
      checksum: {
        identity:
          randomUUID(),
        algorithm,
      },
      publishedLayout: {
        directorySegments:
          Array.from(
            {
              length:
                fixture.layout
                  .publishedDirectorySegmentCount,
            },
            randomUUID,
          ),
        shardWidths:
          fixture.layout
            .shardWidths,
        fileNamePrefix:
          randomUUID(),
        fileNameSuffix:
          randomUUID(),
      },
      temporaryLayout: {
        directorySegments:
          Array.from(
            {
              length:
                fixture.layout
                  .temporaryDirectorySegmentCount,
            },
            randomUUID,
          ),
      },
    });
  const store =
    await createNodeImmutableBlobStore(
      profile,
    );
  return {
    fixture,
    faultStage,
    temporaryRoot,
    profile,
    store,
  };
}

async function appendRuntimeBlob(
  store: Awaited<
    ReturnType<
      typeof createNodeImmutableBlobStore
    >
  >,
  fixture: BlobFixtureManifest,
): Promise<
  AppendImmutableBlobReceipt
> {
  return store.append({
    bytes:
      runtimeBytes(fixture),
    metadata: {
      [randomUUID()]:
        randomUUID(),
    },
    temporaryEntryIdentity:
      randomUUID(),
  });
}

const unreachable:
  BlobReachabilityQuery = {
    isReachable:
      async () => false,
  };

describe(
  "POC-3 explicit blob cleanup",
  () => {
    it(
      "deletes only caller-selected unreachable published and temporary entries and returns a receipt",
      async () => {
        const harness =
          await createHarness();
        try {
          const retained =
            await appendRuntimeBlob(
              harness.store,
              harness.fixture,
            );
          const selected =
            await appendRuntimeBlob(
              harness.store,
              harness.fixture,
            );
          const failedBytes =
            runtimeBytes(
              harness.fixture,
            );
          const partialWriteByteCount =
            Math.floor(
              failedBytes.byteLength /
                harness.fixture.counts
                  .partialWriteDivisor,
            );
          const temporaryEntryIdentity =
            randomUUID();
          const injectedFailure =
            new Error(randomUUID());
          const faultStore =
            await createNodeImmutableBlobStore(
              harness.profile,
              {
                faultInjection: {
                  stage:
                    harness.faultStage,
                  partialWriteByteCount,
                  inject: async () => {
                    throw injectedFailure;
                  },
                },
              },
            );
          await expect(
            faultStore.append({
              bytes: failedBytes,
              metadata: {
                [randomUUID()]:
                  randomUUID(),
              },
              temporaryEntryIdentity,
            }),
          ).rejects.toBe(
            injectedFailure,
          );
          const reachability:
            BlobReachabilityQuery = {
              isReachable:
                async (address) =>
                  address
                    .checksumValue ===
                  retained.address
                    .checksumValue,
            };
          const inventory =
            await harness.store
              .inventory(
                reachability,
              );
          expect(
            inventory.temporary
              .map(
                (entry) =>
                  entry
                    .temporaryEntryIdentity,
              ),
          ).toContain(
            temporaryEntryIdentity,
          );

          await expect(
            harness.store.cleanup({
              expectedInventoryFingerprint:
                inventory.fingerprint,
              selectedPublishedAddresses: [
                retained.address,
              ],
              selectedTemporaryEntryIdentities:
                [],
              reachability,
            }),
          ).rejects.toBeInstanceOf(
            BlobCleanupRefusedError,
          );
          expect(
            await harness.store.inventory(
              reachability,
            ),
          ).toEqual(inventory);

          const receipt =
            await harness.store.cleanup({
              expectedInventoryFingerprint:
                inventory.fingerprint,
              selectedPublishedAddresses: [
                selected.address,
              ],
              selectedTemporaryEntryIdentities: [
                temporaryEntryIdentity,
              ],
              reachability,
            });
          expect(receipt).toMatchObject({
            inventoryFingerprintBefore:
              inventory.fingerprint,
            deletedPublishedAddresses: [
              selected.address,
            ],
            deletedTemporaryEntryIdentities: [
              temporaryEntryIdentity,
            ],
          });
          const after =
            await harness.store.inventory(
              reachability,
            );
          expect(
            receipt
              .inventoryFingerprintAfter,
          ).toBe(after.fingerprint);
          expect(
            after.published.map(
              (entry) =>
                entry.address,
            ),
          ).toEqual([
            retained.address,
          ]);
          expect(
            after.temporary,
          ).toEqual([]);
        } finally {
          await rm(
            harness.temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "refuses a caller inventory fingerprint after the selected object changes",
      async () => {
        const harness =
          await createHarness();
        try {
          const appended =
            await appendRuntimeBlob(
              harness.store,
              harness.fixture,
            );
          const inventory =
            await harness.store.inventory(
              unreachable,
            );
          const entry =
            inventory.published.find(
              (candidate) =>
                candidate.address
                  .checksumValue ===
                appended.address
                  .checksumValue,
            );
          if (entry === undefined) {
            throw new Error(
              "Published caller object was not inventoried",
            );
          }
          const changedBytes =
            runtimeBytes(
              harness.fixture,
            );
          const publishedPath =
            join(
              harness.profile
                .rootDirectoryPath,
              ...entry
                .relativePathSegments,
            );
          await writeFile(
            publishedPath,
            changedBytes,
          );

          await expect(
            harness.store.cleanup({
              expectedInventoryFingerprint:
                inventory.fingerprint,
              selectedPublishedAddresses: [
                appended.address,
              ],
              selectedTemporaryEntryIdentities:
                [],
              reachability:
                unreachable,
            }),
          ).rejects.toBeInstanceOf(
            BlobCleanupRefusedError,
          );
          expect(
            new Uint8Array(
              await readFile(
                publishedPath,
              ),
            ),
          ).toEqual(changedBytes);
        } finally {
          await rm(
            harness.temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "checks caller reachability again immediately before deleting a published object",
      async () => {
        const harness =
          await createHarness();
        try {
          const bytes =
            runtimeBytes(
              harness.fixture,
            );
          const appended =
            await harness.store.append({
              bytes,
              metadata: {
                [randomUUID()]:
                  randomUUID(),
              },
              temporaryEntryIdentity:
                randomUUID(),
            });
          const inventory =
            await harness.store.inventory(
              unreachable,
            );
          let queryCount = 0;
          const changingReachability:
            BlobReachabilityQuery = {
              isReachable:
                async () => {
                  queryCount += 1;
                  return queryCount > 1;
                },
            };

          await expect(
            harness.store.cleanup({
              expectedInventoryFingerprint:
                inventory.fingerprint,
              selectedPublishedAddresses: [
                appended.address,
              ],
              selectedTemporaryEntryIdentities:
                [],
              reachability:
                changingReachability,
            }),
          ).rejects.toBeInstanceOf(
            BlobCleanupRefusedError,
          );
          expect(queryCount).toBeGreaterThan(1);
          const after =
            await harness.store.inventory(
              unreachable,
            );
          expect(
            after.published.map(
              (entry) =>
                entry.address,
            ),
          ).toEqual([
            appended.address,
          ]);
        } finally {
          await rm(
            harness.temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );
  },
);
