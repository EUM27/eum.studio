import {
  cp,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { randomUUID } from "node:crypto";

import type {
  parsePoc2InstalledPackageProfile,
} from "./poc-2-installed-package-profile";

type InstalledPackageProfile = ReturnType<
  typeof parsePoc2InstalledPackageProfile
>;

export type InstalledPackageAssembly = {
  readonly parentDirectory: string;
  readonly packageRoot: string;
  readonly applicationRoot: string;
  readonly executablePath: string;
  readonly applicationManifestPath:
    string;
  readonly mainBundlePath: string;
  readonly rendererBundlePath: string;
};

export type InstalledPackageAssemblyOperations = {
  createParentDirectory(): Promise<string>;
  copy(
    source: string,
    target: string,
    options: {
      readonly recursive?: boolean;
      readonly force: false;
      readonly errorOnExist: true;
    },
  ): Promise<void>;
  makeDirectory(
    directory: string,
  ): Promise<void>;
  removeParentDirectory(
    directory: string,
  ): Promise<void>;
};

function resolveInside(
  root: string,
  targetRelativePath: string,
): string {
  const target = resolve(
    root,
    targetRelativePath,
  );
  const relation = relative(root, target);
  if (
    relation === "" ||
    relation === ".." ||
    relation.startsWith("../") ||
    relation.startsWith("..\\") ||
    isAbsolute(relation)
  ) {
    throw new Error(
      "Package target path escapes or aliases its root",
    );
  }
  return target;
}

export async function removeVerifiedTemporaryPackageDirectory(
  directory: string,
): Promise<void> {
  const root = resolve(tmpdir());
  const target = resolve(directory);
  const relation = relative(root, target);
  if (
    relation === "" ||
    relation === ".." ||
    relation.startsWith("../") ||
    relation.startsWith("..\\") ||
    isAbsolute(relation)
  ) {
    throw new Error(
      "Refusing to remove a package directory outside the OS temporary root",
    );
  }
  await rm(target, {
    recursive: true,
    force: true,
  });
}

export function createNodeInstalledPackageAssemblyOperations():
  InstalledPackageAssemblyOperations {
  return Object.freeze({
    createParentDirectory: () =>
      mkdtemp(
        join(tmpdir(), randomUUID()),
      ),
    copy: (source, target, options) =>
      cp(source, target, options),
    makeDirectory: (directory) =>
      mkdir(directory, {
        recursive: true,
      }).then(() => undefined),
    removeParentDirectory:
      removeVerifiedTemporaryPackageDirectory,
  });
}

export async function assembleInstalledPackage(
  profile: InstalledPackageProfile,
  operations:
    InstalledPackageAssemblyOperations,
): Promise<InstalledPackageAssembly> {
  const parentDirectory =
    await operations.createParentDirectory();
  try {
    const packageRoot =
      resolveInside(
        parentDirectory,
        randomUUID(),
      );
    const runtimeSource = resolve(
      profile.electronRuntimeDirectoryPath,
    );
    await operations.copy(
      runtimeSource,
      packageRoot,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    const applicationRoot =
      resolveInside(
        packageRoot,
        profile.applicationResourcesRelativePath,
      );
    await operations.makeDirectory(
      applicationRoot,
    );
    const applicationManifestPath =
      resolveInside(
        applicationRoot,
        profile.applicationManifestTargetRelativePath,
      );
    const mainBundlePath =
      resolveInside(
        applicationRoot,
        profile.mainBundleTargetRelativePath,
      );
    const rendererBundlePath =
      resolveInside(
        applicationRoot,
        profile.rendererBundleTargetRelativePath,
      );
    await operations.copy(
      resolve(
        profile.applicationManifestPath,
      ),
      applicationManifestPath,
      {
        force: false,
        errorOnExist: true,
      },
    );
    await operations.copy(
      resolve(
        profile.mainBundleDirectoryPath,
      ),
      mainBundlePath,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    await operations.copy(
      resolve(
        profile.rendererBundleDirectoryPath,
      ),
      rendererBundlePath,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    return Object.freeze({
      parentDirectory,
      packageRoot,
      applicationRoot,
      executablePath: resolveInside(
        packageRoot,
        profile.electronExecutableRelativePath,
      ),
      applicationManifestPath,
      mainBundlePath,
      rendererBundlePath,
    });
  } catch (error) {
    try {
      await operations.removeParentDirectory(
        parentDirectory,
      );
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Installed-package assembly and cleanup both failed",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}
