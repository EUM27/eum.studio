import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createEnvironmentManifest } from "./environment-manifest";

describe("environment manifest", () => {
  it("records only supplied diagnostics and normalizes package ordering", () => {
    const laterName = `z-${randomUUID()}`;
    const earlierName = `a-${randomUUID()}`;
    const manifest = createEnvironmentManifest({
      capturedAt: new Date().toISOString(),
      platform: randomUUID(),
      architecture: randomUUID(),
      osRelease: randomUUID(),
      nodeVersion: randomUUID(),
      packages: [
        { name: laterName, version: randomUUID() },
        { name: earlierName, version: randomUUID() },
      ],
    });

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.packages.map((item) => item.name)).toEqual([
      earlierName,
      laterName,
    ]);
    expect(JSON.stringify(manifest)).not.toContain("processEnvironment");
  });

  it("rejects duplicate package identities", () => {
    const duplicateName = randomUUID();
    const input = {
      capturedAt: new Date().toISOString(),
      platform: randomUUID(),
      architecture: randomUUID(),
      osRelease: randomUUID(),
      nodeVersion: randomUUID(),
      packages: [
        { name: duplicateName, version: randomUUID() },
        { name: duplicateName, version: randomUUID() },
      ],
    };

    expect(() => createEnvironmentManifest(input)).toThrow(
      "Duplicate package identity",
    );
  });
});
