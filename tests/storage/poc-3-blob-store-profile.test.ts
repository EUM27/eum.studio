import {
  randomUUID,
} from "node:crypto";
import {
  readFile,
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
  "POC-3 immutable blob store profile",
  () => {
    it(
      "preserves the exact caller root, layout and checksum identity without defaults",
      async () => {
        const fixture =
          await readFixture();
        const input = {
          rootDirectoryPath: join(
            tmpdir(),
            randomUUID(),
          ),
          checksum: {
            identity: randomUUID(),
            algorithm:
              fixture.materials
                .checksumAlgorithms[0],
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
        };

        const parsed =
          parseNodeImmutableBlobStoreProfile(
            input,
          );

        expect(parsed).toEqual(input);
        expect(
          Object.isFrozen(parsed),
        ).toBe(true);
        expect(
          Object.isFrozen(
            parsed.publishedLayout
              .directorySegments,
          ),
        ).toBe(true);
        expect(
          Object.isFrozen(
            parsed.publishedLayout
              .shardWidths,
          ),
        ).toBe(true);
      },
    );
  },
);
