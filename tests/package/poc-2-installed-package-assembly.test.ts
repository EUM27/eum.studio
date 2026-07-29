import {
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  join,
} from "node:path";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assembleInstalledPackage,
  removeVerifiedTemporaryPackageDirectory,
  type InstalledPackageAssemblyOperations,
} from "./poc-2-installed-package-assembly";
import {
  parsePoc2InstalledPackageProfile,
} from "./poc-2-installed-package-profile";

function createProfile() {
  return parsePoc2InstalledPackageProfile({
    schemaVersion: 1,
    electronRuntimeDirectoryPath:
      randomUUID(),
    applicationManifestPath:
      randomUUID(),
    applicationManifestTargetRelativePath:
      randomUUID(),
    mainBundleDirectoryPath:
      randomUUID(),
    mainBundleTargetRelativePath:
      randomUUID(),
    rendererBundleDirectoryPath:
      randomUUID(),
    rendererBundleTargetRelativePath:
      randomUUID(),
    applicationResourcesRelativePath:
      randomUUID(),
    electronExecutableRelativePath:
      randomUUID(),
    batching: {
      schemaVersion: 1,
      maxTransactionsPerBatch: 1,
      maxDelayMs: 0,
    },
  });
}

describe("installed-package assembly cleanup", () => {
  it("removes the verified temporary parent when any package copy fails", async () => {
    const parentDirectory =
      await mkdtemp(
        join(tmpdir(), randomUUID()),
      );
    const failure = new Error(
      randomUUID(),
    );
    const removeParentDirectory =
      vi.fn(
        removeVerifiedTemporaryPackageDirectory,
      );
    const operations:
      InstalledPackageAssemblyOperations = {
      async createParentDirectory() {
        return parentDirectory;
      },
      async copy() {
        throw failure;
      },
      async makeDirectory() {
        return undefined;
      },
      removeParentDirectory,
    };

    await expect(
      assembleInstalledPackage(
        createProfile(),
        operations,
      ),
    ).rejects.toBe(failure);
    expect(
      removeParentDirectory,
    ).toHaveBeenCalledWith(
      parentDirectory,
    );
    await expect(
      stat(parentDirectory),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reports both failures if cleanup itself cannot complete", async () => {
    const assemblyFailure =
      new Error(randomUUID());
    const cleanupFailure =
      new Error(randomUUID());
    const operations:
      InstalledPackageAssemblyOperations = {
      async createParentDirectory() {
        return join(
          tmpdir(),
          randomUUID(),
        );
      },
      async copy() {
        throw assemblyFailure;
      },
      async makeDirectory() {
        return undefined;
      },
      async removeParentDirectory() {
        throw cleanupFailure;
      },
    };

    await expect(
      assembleInstalledPackage(
        createProfile(),
        operations,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        errors: [
          assemblyFailure,
          cleanupFailure,
        ],
      }),
    );
  });
});
