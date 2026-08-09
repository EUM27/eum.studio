import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseCreateSceneOverrideCommand,
  parseSceneOverrideListProjection,
} from "./scene-override-contract";

describe("scene override contract", () => {
  it("preserves a cursor or exact selected boundary without inserting manuscript text", () => {
    expect(
      parseCreateSceneOverrideCommand({
        schemaVersion: 1,
        workId: randomUUID(),
        documentId: randomUUID(),
        selection: { anchor: 7, head: 7 },
        exactQuote: "",
        operation: "add",
        note: "커서 경계",
      }),
    ).toMatchObject({
      selection: { anchor: 7, head: 7 },
      exactQuote: "",
      operation: "add",
    });
  });

  it("parses a Work-owned resolved SceneOverride boundary", () => {
    const workId = randomUUID();
    const projection = parseSceneOverrideListProjection({
      schemaVersion: 1,
      workId,
      sceneOverrides: [
        {
          schemaVersion: 1,
          sceneOverrideId: randomUUID(),
          workId,
          documentId: randomUUID(),
          operation: "split",
          baseRuleSetRevision: 4,
          note: "선택 경계",
          boundaries: [
            {
              anchorId: randomUUID(),
              documentRevisionId: randomUUID(),
              exactQuote: "***",
              integrity: "resolved",
              range: { from: 12, to: 15 },
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(projection.sceneOverrides[0]).toMatchObject({
      workId,
      operation: "split",
      baseRuleSetRevision: 4,
      boundaries: [{ range: { from: 12, to: 15 } }],
    });
  });
});
