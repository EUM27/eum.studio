import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseLocalWorkspaceDefaults } from "./local-workspace-defaults";

describe("local workspace defaults", () => {
  it("loads a configured batching policy instead of immediate per-transaction persistence", () => {
    const defaults = parseLocalWorkspaceDefaults(
      JSON.parse(
        readFileSync(
          path.resolve("config", "local-workspace-defaults.json"),
          "utf8",
        ),
      ) as unknown,
    );

    expect(defaults.manuscriptBatchingPolicy.maxTransactionsPerBatch)
      .toBeGreaterThan(1);
    expect(defaults.manuscriptBatchingPolicy.maxDelayMs).toBeGreaterThan(0);
    expect(Object.isFrozen(defaults.manuscriptBatchingPolicy)).toBe(true);
  });
});
