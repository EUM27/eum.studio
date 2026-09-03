import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseLocalWorkspaceDefaults } from "./local-workspace-defaults";

describe("local workspace defaults", () => {
  it("loads the durable batching policy from runtime configuration", () => {
    const configured = JSON.parse(
      readFileSync(
        path.resolve("config", "local-workspace-defaults.json"),
        "utf8",
      ),
    ) as { readonly manuscriptBatchingPolicy: unknown };
    const defaults = parseLocalWorkspaceDefaults(
      configured,
    );

    expect(defaults.manuscriptBatchingPolicy)
      .toEqual(configured.manuscriptBatchingPolicy);
    expect(Object.isFrozen(defaults.manuscriptBatchingPolicy)).toBe(true);
  });
});
