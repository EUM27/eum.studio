import {
  describe,
  expect,
  it,
} from "vitest";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import {
  randomUUID,
} from "node:crypto";
import {
  tmpdir,
} from "node:os";
import {
  join,
  resolve,
} from "node:path";

import {
  parsePoc3DriverBakeOffManifest,
} from "../../src/application/storage/poc-3-driver-bake-off-contract";

function callerManifestPath(): string {
  const value =
    process.env
      .EUM_STUDIO_POC_3_DRIVER_MANIFEST_PATH;
  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(
      "EUM_STUDIO_POC_3_DRIVER_MANIFEST_PATH is required",
    );
  }
  return resolve(value);
}

async function readCallerManifestRaw(): Promise<string> {
  return readFile(
    callerManifestPath(),
    "utf8",
  );
}

describe("POC-3 driver bake-off contract", () => {
  it("exposes a parser that rejects an incomplete caller manifest", async () => {
    let implementation:
      | typeof import("../../src/application/storage/poc-3-driver-bake-off-contract")
      | undefined;
    try {
      implementation =
        await import(
          "../../src/application/storage/poc-3-driver-bake-off-contract"
        );
    } catch {
      implementation = undefined;
    }

    expect(
      implementation
        ?.parsePoc3DriverBakeOffManifest,
    ).toBeTypeOf("function");
    expect(() =>
      implementation!
        .parsePoc3DriverBakeOffManifest({}),
    ).toThrow(
      "POC-3 driver bake-off manifest",
    );
  });

  it("runs both adapters through the identical correctness contract", async () => {
    const raw =
      await readCallerManifestRaw();
    const manifest =
      parsePoc3DriverBakeOffManifest(
        JSON.parse(raw),
      );
    const modulePath =
      "../../src/platform/storage/poc-3-driver-bake-off";
    let implementation:
      | Record<string, unknown>
      | undefined;
    try {
      implementation =
        await import(modulePath);
    } catch {
      implementation = undefined;
    }

    expect(
      implementation
        ?.createPoc3DriverAdapters,
    ).toBeTypeOf("function");
    expect(
      implementation
        ?.runPoc3DriverCorrectnessContract,
    ).toBeTypeOf("function");

    const createAdapters =
      implementation!
        .createPoc3DriverAdapters as (
          candidates:
            typeof manifest.candidates,
        ) => Promise<
          readonly object[]
        >;
    const contractImplementation =
      await import(
        "../../src/application/storage/poc-3-driver-bake-off-contract"
      );
    const fixture =
      contractImplementation
        .generatePoc3DriverFixture(
          manifest,
          randomUUID,
          () => randomUUID(),
        );
    const runContract =
      implementation!
        .runPoc3DriverCorrectnessContract as (
          input: {
            readonly manifest:
              typeof manifest;
            readonly adapter: {
              readonly candidateId:
                string;
            };
            readonly fixture:
              typeof fixture;
            readonly databasePath:
              string;
            readonly backupPath:
              string;
          },
        ) => Promise<{
          readonly candidateId: string;
          readonly contractChecksum:
            string;
          readonly ledgerChecksum:
            string;
          readonly backupLedgerChecksum:
            string;
          readonly sqliteVersion: string;
          readonly correctness: {
            readonly pragma: true;
            readonly transaction: true;
            readonly rollback: true;
            readonly foreignKey: true;
            readonly backup: true;
          };
        }>;
    const temporaryRoot =
      await mkdtemp(
        join(
          tmpdir(),
          randomUUID(),
        ),
      );
    try {
      const adapters =
        await createAdapters(
          manifest.candidates,
        );
      const results = [];
      for (const adapter of adapters) {
        const candidateRoot =
          await mkdtemp(
            join(
              temporaryRoot,
              randomUUID(),
            ),
          );
        results.push(
          await runContract({
            manifest,
            adapter:
              adapter as {
                readonly candidateId:
                  string;
              },
            fixture,
            databasePath: join(
              candidateRoot,
              manifest.databaseFiles
                .primaryFileName,
            ),
            backupPath: join(
              candidateRoot,
              manifest.databaseFiles
                .backupFileName,
            ),
          }),
        );
      }

      expect(
        results.map(
          (result) =>
            result.candidateId,
        ),
      ).toEqual(
        manifest.candidates.map(
          (candidate) => candidate.id,
        ),
      );
      expect(
        new Set(
          results.map(
            (result) =>
              result.contractChecksum,
          ),
        ).size,
      ).toBe(1);
      expect(
        new Set(
          results.map(
            (result) =>
              result.ledgerChecksum,
          ),
        ).size,
      ).toBe(1);
      for (const result of results) {
        expect(
          result.backupLedgerChecksum,
        ).toBe(result.ledgerChecksum);
        expect(
          result.sqliteVersion.length,
        ).toBeGreaterThan(0);
        expect(
          Object.values(
            result.correctness,
          ),
        ).toEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      }
    } finally {
      await rm(
        temporaryRoot,
        {
          recursive: true,
          force: true,
        },
      );
    }
  });

  it("parses and freezes the complete caller-owned comparison contract", async () => {
    const raw =
      await readCallerManifestRaw();
    const rawManifest =
      JSON.parse(raw) as {
        readonly fixtureGeneration: {
          readonly displayNameMaterials:
            readonly unknown[];
        };
      };

    const manifest =
      parsePoc3DriverBakeOffManifest(
        rawManifest,
      );

    expect(
      manifest.candidates.map(
        (candidate) => candidate.id,
      ),
    ).toEqual([
      "node-sqlite",
      "better-sqlite3",
    ]);
    expect(manifest.pragmaSteps).toHaveLength(
      JSON.parse(raw).pragmaSteps.length,
    );
    expect(Object.isFrozen(manifest)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        manifest.fixtureGeneration
          .displayNameMaterials,
      ),
    ).toBe(true);
    expect(
      manifest.fixtureGeneration
        .displayNameMaterials,
    ).toHaveLength(
      rawManifest.fixtureGeneration
        .displayNameMaterials.length,
    );
  });

  it("generates entity values and expected ledger rows at runtime", async () => {
    const raw =
      await readCallerManifestRaw();
    const manifest =
      parsePoc3DriverBakeOffManifest(
        JSON.parse(raw),
      );

    const contractModulePath =
      "../../src/application/storage/poc-3-driver-bake-off-contract";
    const contractImplementation =
      await import(
        contractModulePath
      ) as Record<string, unknown>;
    expect(
      contractImplementation
        .generatePoc3DriverFixture,
    ).toBeTypeOf("function");
    const generateFixture =
      contractImplementation
        .generatePoc3DriverFixture as (
          input: typeof manifest,
          createId: () => string,
          createChecksum:
            (value: string) => string,
        ) => {
          readonly works: readonly {
            readonly workId: string;
          }[];
          readonly revisions: readonly {
            readonly workId: string;
            readonly contentChecksum:
              string;
          }[];
          readonly ledgerExpectedRows:
            readonly {
              readonly work_id:
                string;
            }[];
        };
    const first =
      generateFixture(
        manifest,
        randomUUID,
        () => randomUUID(),
      );
    const generatedChecksums:
      string[] = [];
    const second =
      generateFixture(
        manifest,
        randomUUID,
        () => {
          const checksum =
            randomUUID();
          generatedChecksums.push(
            checksum,
          );
          return checksum;
        },
      );

    expect(first.works).toHaveLength(
      manifest.fixtureGeneration
        .workCount,
    );
    expect(
      new Set(
        first.works.map(
          (work) => work.workId,
        ),
      ).size,
    ).toBe(first.works.length);
    expect(
      first.ledgerExpectedRows.map(
        (row) => row.work_id,
      ).sort(),
    ).toEqual(
      first.revisions.map(
        (revision) =>
          revision.workId,
      ).sort(),
    );
    expect(
      new Set([
        ...first.works.map(
          (work) => work.workId,
        ),
        ...second.works.map(
          (work) => work.workId,
        ),
      ]).size,
    ).toBe(
      first.works.length +
        second.works.length,
    );
    expect(
      second.revisions.map(
        (revision) =>
          revision.contentChecksum,
      ),
    ).toEqual(generatedChecksums);
    expect(
      JSON.parse(raw)
        .writeTransaction,
    ).not.toHaveProperty(
      "statements",
    );
  });

  it("rejects unknown fields instead of changing the comparison contract", async () => {
    const raw =
      await readCallerManifestRaw();
    const input = {
      ...JSON.parse(raw),
      fallbackDriver: randomUUID(),
    };

    expect(() =>
      parsePoc3DriverBakeOffManifest(
        input,
      ),
    ).toThrow(
      "Unsupported POC-3 driver bake-off manifest field",
    );
  });
});
