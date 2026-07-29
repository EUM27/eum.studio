import {
  randomUUID,
} from "node:crypto";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc2InstalledPackageProfile,
} from "./poc-2-installed-package-profile";

function createProfile() {
  return {
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
  } as const;
}

describe("POC-2 installed-package profile", () => {
  it("strictly accepts and freezes caller-provided package inputs", () => {
    const input = createProfile();
    const profile =
      parsePoc2InstalledPackageProfile(
        input,
      );

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(
      true,
    );
  });

  it("rejects missing, unsupported, and absolute target-relative paths without defaults", () => {
    const missing = {
      ...createProfile(),
    } as Record<string, unknown>;
    Reflect.deleteProperty(
      missing,
      "electronRuntimeDirectoryPath",
    );

    expect(() =>
      parsePoc2InstalledPackageProfile(
        missing,
      ),
    ).toThrow(
      /electronRuntimeDirectoryPath/,
    );
    expect(() =>
      parsePoc2InstalledPackageProfile({
        ...createProfile(),
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow(/Unsupported/);
    expect(() =>
      parsePoc2InstalledPackageProfile({
        ...createProfile(),
        electronExecutableRelativePath:
          process.execPath,
      }),
    ).toThrow(/relative/);
  });
});
