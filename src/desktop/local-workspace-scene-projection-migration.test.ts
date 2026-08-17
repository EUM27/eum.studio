import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SCENE_PROJECTION_MIGRATION_DEFINITION_BYTES } from "./local-workspace-scene-projection-migration";

describe("local workspace scene projection migration", () => {
  it("keeps the reviewed schema 4 to 5 migration definition fixed", () => {
    expect(
      createHash("sha256")
        .update(SCENE_PROJECTION_MIGRATION_DEFINITION_BYTES)
        .digest("hex"),
    ).toBe("060d616b6c39b94044040a22871a86676c442935cc84048489c0850f40e34593");
  });
});
