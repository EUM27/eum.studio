import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
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
  readonly counts: {
    readonly concurrentWriteCount:
      number;
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
  "POC-3 immutable blob publication",
  () => {
    it(
      "publishes one synced checksum object without replacing it under concurrent writers",
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
        const rootDirectoryPath =
          join(
            temporaryRoot,
            randomUUID(),
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
            rootDirectoryPath,
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
          [randomUUID()]:
            Date.now(),
        };
        const checksum =
          createHash(algorithm)
            .update(bytes)
            .digest("hex");
        let shardOffset = 0;
        const shardSegments =
          profile.publishedLayout
            .shardWidths
            .map((width) => {
              const shard =
                checksum.slice(
                  shardOffset,
                  shardOffset +
                    width,
                );
              shardOffset += width;
              return shard;
            });
        const publishedPath = join(
          profile.rootDirectoryPath,
          ...profile
            .publishedLayout
            .directorySegments,
          ...shardSegments,
          `${
            profile.publishedLayout
              .fileNamePrefix
          }${checksum}${
            profile.publishedLayout
              .fileNameSuffix
          }`,
        );

        try {
          const store =
            await createNodeImmutableBlobStore(
              profile,
            );
          const receipts =
            await Promise.all(
              Array.from(
                {
                  length:
                    fixture.counts
                      .concurrentWriteCount,
                },
                () =>
                  store.append({
                    bytes,
                    metadata,
                    temporaryEntryIdentity:
                      randomUUID(),
                  }),
              ),
            );

          expect(
            receipts.map(
              (receipt) =>
                receipt.address,
            ),
          ).toEqual(
            receipts.map(() => ({
              checksumIdentity:
                profile.checksum
                  .identity,
              checksumValue:
                checksum,
            })),
          );
          expect(
            receipts.filter(
              (receipt) =>
                receipt.publication ===
                "published",
            ),
          ).toHaveLength(1);
          expect(
            receipts.filter(
              (receipt) =>
                receipt.publication ===
                "existing-verified",
            ),
          ).toHaveLength(
            fixture.counts
              .concurrentWriteCount -
              1,
          );
          expect(
            receipts.every(
              (receipt) =>
                receipt.metadata ===
                  metadata &&
                receipt.byteLength ===
                  bytes.byteLength,
            ),
          ).toBe(true);
          expect(
            new Uint8Array(
              await readFile(
                publishedPath,
              ),
            ),
          ).toEqual(bytes);
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
