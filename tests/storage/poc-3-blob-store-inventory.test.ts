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
  join,
} from "node:path";
import {
  tmpdir,
} from "node:os";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BlobContentMismatchError,
} from "../../src/application/storage/blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";

type BlobFixtureManifest = {
  readonly layout: {
    readonly publishedDirectorySegmentCount:
      number;
    readonly temporaryDirectorySegmentCount:
      number;
    readonly shardWidths:
      readonly number[];
  };
  readonly materials: {
    readonly checksumAlgorithms:
      readonly string[];
    readonly byteText:
      readonly string[];
  };
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

describe(
  "POC-3 immutable blob inventory",
  () => {
    it(
      "reports verified and corrupt published objects without overwriting or deleting them",
      async () => {
        const fixture =
          await readFixture();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const algorithm =
          fixture.materials
            .checksumAlgorithms[0];
        if (
          algorithm === undefined
        ) {
          throw new Error(
            "Caller fixture requires a checksum algorithm material",
          );
        }
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
        const bytes =
          new TextEncoder().encode(
            [
              randomUUID(),
              ...fixture.materials
                .byteText,
              randomUUID(),
            ].join(randomUUID()),
          );
        const metadata = {
          [randomUUID()]:
            randomUUID(),
        };

        try {
          const store =
            await createNodeImmutableBlobStore(
              profile,
            );
          const receipt =
            await store.append({
              bytes,
              metadata,
              temporaryEntryIdentity:
                randomUUID(),
            });
          const inventory =
            await store.inventory({
              isReachable: async () =>
                false,
            });

          expect(
            inventory.checksumIdentity,
          ).toBe(
            profile.checksum.identity,
          );
          expect(
            inventory.fingerprint.length,
          ).toBeGreaterThan(0);
          expect(
            inventory.temporary,
          ).toEqual([]);
          expect(
            inventory.published,
          ).toHaveLength(1);
          const published =
            inventory.published[0];
          if (
            published === undefined
          ) {
            throw new Error(
              "Inventory requires the published caller object",
            );
          }
          expect(published).toMatchObject({
            address:
              receipt.address,
            actualChecksumValue:
              receipt.address
                .checksumValue,
            byteLength:
              bytes.byteLength,
            status: "verified",
            reachable: false,
          });
          const publishedPath = join(
            profile.rootDirectoryPath,
            ...published
              .relativePathSegments,
          );
          const corruptBytes =
            Uint8Array.from([
              ...bytes,
              ...new TextEncoder()
                .encode(
                  randomUUID(),
                ),
            ]);
          await writeFile(
            publishedPath,
            corruptBytes,
          );

          await expect(
            store.append({
              bytes,
              metadata,
              temporaryEntryIdentity:
                randomUUID(),
            }),
          ).rejects.toBeInstanceOf(
            BlobContentMismatchError,
          );
          expect(
            new Uint8Array(
              await readFile(
                publishedPath,
              ),
            ),
          ).toEqual(corruptBytes);
          const corruptInventory =
            await store.inventory({
              isReachable: async () =>
                false,
            });
          expect(
            corruptInventory
              .temporary,
          ).toEqual([]);
          expect(
            corruptInventory
              .published[0],
          ).toMatchObject({
            address:
              receipt.address,
            byteLength:
              corruptBytes.byteLength,
            status: "corrupt",
            reachable: false,
          });
        } finally {
          await rm(
            temporaryRoot,
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
