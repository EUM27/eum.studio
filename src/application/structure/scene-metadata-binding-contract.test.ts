import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parseRebindSceneMetadataCommand,
  parseSceneMetadataBindingProjection,
} from "./scene-metadata-binding-contract";

const createdAt = "2026-08-29T00:00:00.000Z";

describe("Scene metadata binding contract", () => {
  it("preserves a stable current Scene identity and raw sceneKey evidence", () => {
    const sceneId = randomUUID();
    expect(parseSceneMetadataBindingProjection({
      schemaVersion: 1,
      sceneMetadataBindingId: randomUUID(),
      revision: 1,
      workId: randomUUID(),
      metadataKind: "annotation",
      metadataId: randomUUID(),
      sourceSceneKey: "legacy-scene-key",
      sceneId,
      status: "current",
      proposedSceneId: null,
      lineageOperationId: null,
      createdAt,
      updatedAt: createdAt,
    })).toMatchObject({
      sceneId,
      status: "current",
      sourceSceneKey: "legacy-scene-key",
    });
  });

  it("keeps unresolved metadata in review and rejects current without sceneId", () => {
    const input = {
      schemaVersion: 1,
      sceneMetadataBindingId: randomUUID(),
      revision: 1,
      workId: randomUUID(),
      metadataKind: "music-queue",
      metadataId: randomUUID(),
      sourceSceneKey: "unresolved-scene-key",
      sceneId: null,
      status: "needsReview",
      proposedSceneId: null,
      lineageOperationId: null,
      createdAt,
      updatedAt: createdAt,
    } as const;
    expect(parseSceneMetadataBindingProjection(input)).toMatchObject({
      sceneId: null,
      status: "needsReview",
    });
    expect(() => parseSceneMetadataBindingProjection({
      ...input,
      status: "current",
    })).toThrow("current status requires sceneId");
  });

  it("requires a stable target identity or an explicit detach", () => {
    const command = parseRebindSceneMetadataCommand({
      schemaVersion: 1,
      workId: randomUUID(),
      sceneMetadataBindingId: randomUUID(),
      expectedBindingRevision: 2,
      targetSceneId: randomUUID(),
    });
    expect(command).toMatchObject({
      expectedBindingRevision: 2,
      targetSceneId: expect.any(String),
    });
    expect(parseRebindSceneMetadataCommand({
      ...command,
      targetSceneId: null,
    }).targetSceneId).toBeNull();
    expect(() => parseRebindSceneMetadataCommand({
      ...command,
      sceneKey: "raw-key-is-not-a-target",
    })).toThrow("fields do not match");
  });
});
