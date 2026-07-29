import {
  randomUUID,
} from "node:crypto";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc3InstalledPackageProbeProfile,
} from "../../src/desktop/poc-3-installed-package-probe";

describe(
  "POC-3 installed-package probe profile",
  () => {
    it("rejects incomplete and unsupported caller input without a default", () => {
      expect(() =>
        parsePoc3InstalledPackageProbeProfile({
          schemaVersion: 1,
        }),
      ).toThrow(/runIdentity/);
      expect(() =>
        parsePoc3InstalledPackageProbeProfile({
          schemaVersion: 1,
          [randomUUID()]:
            randomUUID(),
        }),
      ).toThrow(/Unsupported/);
    });
  },
);
