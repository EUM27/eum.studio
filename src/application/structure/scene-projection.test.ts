import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type {
  EventBlockProjection,
  EventSourceProjection,
} from "./event-block-contract";
import type { SceneOverrideProjection } from "./scene-override-contract";
import {
  deriveSceneProjection,
  parseSceneProjectionList,
  type SceneEventOverrideProjection,
  type SceneProjectionDocumentInput,
  type SceneRuleSetProjection,
} from "./scene-projection";

function ruleSet(
  workId: ReturnType<typeof entityId<"Work">>,
): SceneRuleSetProjection {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    sceneRuleSetId: entityId<"SceneRuleSet">(randomUUID()),
    revision: 3,
    workId,
    displayName: "작품 구분 규칙",
    boundaryRules: [
      {
        boundaryRuleId: "dash-divider",
        kind: "line-regexp",
        pattern: "^\\s*---\\s*$",
        flags: "u",
      },
    ],
    normalizationPolicy: "preserve",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function documentInput(
  workId: ReturnType<typeof entityId<"Work">>,
  documentId: ReturnType<typeof entityId<"Document">>,
  text: string,
): SceneProjectionDocumentInput {
  return {
    workId,
    documentId,
    documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
    title: "첫 회차",
    documentIndex: 0,
    text,
  };
}

function eventBlock(
  workId: ReturnType<typeof entityId<"Work">>,
  title: string,
): EventBlockProjection {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    eventBlockId: entityId<"EventBlock">(randomUUID()),
    revision: 1,
    workId,
    title,
    note: "",
    parentEventId: null,
    outlineOrderKey: randomUUID(),
    createdAt: now,
    updatedAt: now,
    retiredAt: null,
  };
}

function eventSource(
  input: {
    readonly workId: ReturnType<typeof entityId<"Work">>;
    readonly documentId: ReturnType<typeof entityId<"Document">>;
    readonly documentRevisionId: ReturnType<typeof entityId<"DocumentRevision">>;
    readonly eventBlockId: ReturnType<typeof entityId<"EventBlock">>;
    readonly from: number;
    readonly to: number;
    readonly exactQuote: string;
  },
): EventSourceProjection {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    eventSourceId: entityId<"EventSource">(randomUUID()),
    revision: 1,
    workId: input.workId,
    eventBlockId: input.eventBlockId,
    rangeGroupId: entityId<"RangeGroup">(randomUUID()),
    role: "primary",
    anchors: [
      {
        anchorId: entityId<"Anchor">(randomUUID()),
        documentId: input.documentId,
        documentRevisionId: input.documentRevisionId,
        exactQuote: input.exactQuote,
        integrity: "resolved",
        range: { from: input.from, to: input.to },
      },
    ],
    createdAt: now,
    updatedAt: now,
    retiredAt: null,
  };
}

function sceneOverride(
  input: {
    readonly workId: ReturnType<typeof entityId<"Work">>;
    readonly documentId: ReturnType<typeof entityId<"Document">>;
    readonly documentRevisionId: ReturnType<typeof entityId<"DocumentRevision">>;
    readonly operation: "add" | "ignore" | "merge" | "split";
    readonly from: number;
    readonly to: number;
    readonly exactQuote: string;
    readonly createdAt: string;
  },
): SceneOverrideProjection {
  return {
    schemaVersion: 1,
    sceneOverrideId: entityId<"SceneOverride">(randomUUID()),
    workId: input.workId,
    documentId: input.documentId,
    operation: input.operation,
    baseRuleSetRevision: 3,
    note: "",
    boundaries: [
      {
        anchorId: entityId<"Anchor">(randomUUID()),
        documentRevisionId: input.documentRevisionId,
        exactQuote: input.exactQuote,
        integrity: "resolved",
        range: { from: input.from, to: input.to },
      },
    ],
    createdAt: input.createdAt,
  };
}

describe("scene projection", () => {
  it("parses configured line rules into stable scene ranges without storing scene bodies", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const document = documentInput(workId, documentId, "하나\n---\n둘\n---\n셋");
    const input = {
      workId,
      ruleSet: ruleSet(workId),
      documents: [document],
      sceneOverrides: [],
      eventBlocks: [],
      eventSources: [],
      sceneEventOverrides: [],
    } as const;

    const first = deriveSceneProjection(input);
    const second = deriveSceneProjection(input);

    expect(first.status).toBe("clean");
    expect(first.scenes.map((scene) => scene.range)).toEqual([
      { start: 0, end: 3 },
      { start: 7, end: 9 },
      { start: 13, end: 14 },
    ]);
    expect(first.scenes.map((scene) => scene.sceneKey)).toEqual(
      second.scenes.map((scene) => scene.sceneKey),
    );
    expect(first.scenes.map((scene) => scene.source)).toEqual([
      "rule",
      "rule",
      "rule",
    ]);
    expect(JSON.stringify(first)).not.toContain("하나");
    expect(JSON.stringify(first)).not.toContain("둘");
    expect(JSON.stringify(first)).not.toContain("셋");
  });

  it("folds merge and split overrides in creation order", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const document = documentInput(workId, documentId, "하나\n---\n둘\n---\n셋");
    const merge = sceneOverride({
      workId,
      documentId,
      documentRevisionId: document.documentRevisionId,
      operation: "merge",
      from: 3,
      to: 7,
      exactQuote: "---\n",
      createdAt: "2026-08-16T00:00:00.000Z",
    });
    const split = sceneOverride({
      workId,
      documentId,
      documentRevisionId: document.documentRevisionId,
      operation: "split",
      from: 8,
      to: 8,
      exactQuote: "",
      createdAt: "2026-08-16T00:00:01.000Z",
    });

    const projection = deriveSceneProjection({
      workId,
      ruleSet: ruleSet(workId),
      documents: [document],
      sceneOverrides: [split, merge],
      eventBlocks: [],
      eventSources: [],
      sceneEventOverrides: [],
    });

    expect(projection.scenes.map((scene) => scene.range)).toEqual([
      { start: 0, end: 8 },
      { start: 8, end: 9 },
      { start: 13, end: 14 },
    ]);
    expect(projection.scenes.map((scene) => scene.source)).toEqual([
      "override",
      "override",
      "rule",
    ]);
  });

  it("combines automatic range overlap with manual include and exclude exceptions", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const document = documentInput(workId, documentId, "하나\n---\n둘");
    const automatic = eventBlock(workId, "자동 사건");
    const planned = eventBlock(workId, "예정 사건");
    const configuredRuleSet = ruleSet(workId);
    const source = eventSource({
      workId,
      documentId,
      documentRevisionId: document.documentRevisionId,
      eventBlockId: automatic.eventBlockId,
      from: 0,
      to: 2,
      exactQuote: "하나",
    });
    const base = deriveSceneProjection({
      workId,
      ruleSet: configuredRuleSet,
      documents: [document],
      sceneOverrides: [],
      eventBlocks: [automatic, planned],
      eventSources: [source],
      sceneEventOverrides: [],
    });
    const firstScene = base.scenes[0];
    const secondScene = base.scenes[1];
    if (firstScene === undefined || secondScene === undefined) {
      throw new Error("Expected two scenes");
    }
    const now = new Date().toISOString();
    const firstSceneId = entityId<"Scene">(randomUUID());
    const secondSceneId = entityId<"Scene">(randomUUID());
    const binding = (
      metadataId: ReturnType<typeof entityId<"SceneEventOverride">>,
      sourceSceneKey: string,
      sceneId: ReturnType<typeof entityId<"Scene">>,
    ) => ({
      schemaVersion: 1 as const,
      sceneMetadataBindingId: entityId<"SceneMetadataBinding">(randomUUID()),
      revision: 1,
      workId,
      metadataKind: "event-override" as const,
      metadataId,
      sourceSceneKey,
      sceneId,
      status: "current" as const,
      proposedSceneId: null,
      lineageOperationId: null,
      createdAt: now,
      updatedAt: now,
    });
    const firstOverrideId = entityId<"SceneEventOverride">(randomUUID());
    const secondOverrideId = entityId<"SceneEventOverride">(randomUUID());
    const exceptions: readonly SceneEventOverrideProjection[] = [
      {
        schemaVersion: 1,
        sceneEventOverrideId: firstOverrideId,
        revision: 1,
        workId,
        sceneKey: firstScene.sceneKey,
        binding: binding(firstOverrideId, firstScene.sceneKey, firstSceneId),
        eventBlockId: automatic.eventBlockId,
        operation: "exclude",
        createdAt: now,
        updatedAt: now,
      },
      {
        schemaVersion: 1,
        sceneEventOverrideId: secondOverrideId,
        revision: 1,
        workId,
        sceneKey: firstScene.sceneKey,
        binding: binding(secondOverrideId, firstScene.sceneKey, secondSceneId),
        eventBlockId: planned.eventBlockId,
        operation: "include",
        createdAt: now,
        updatedAt: now,
      },
    ];

    const projection = deriveSceneProjection({
      workId,
      ruleSet: configuredRuleSet,
      documents: [document],
      sceneOverrides: [],
      eventBlocks: [automatic, planned],
      eventSources: [source],
      sceneEventOverrides: exceptions,
      sceneSegments: [
        {
          segmentId: entityId<"EpisodeSceneSegment">(randomUUID()),
          sceneId: firstSceneId,
          documentId,
          documentRevisionId: document.documentRevisionId,
          documentTitle: document.title,
          documentIndex: document.documentIndex,
          range: firstScene.range,
          integrity: "resolved",
        },
        {
          segmentId: entityId<"EpisodeSceneSegment">(randomUUID()),
          sceneId: secondSceneId,
          documentId,
          documentRevisionId: document.documentRevisionId,
          documentTitle: document.title,
          documentIndex: document.documentIndex,
          range: secondScene.range,
          integrity: "resolved",
        },
      ],
    });

    expect(projection.scenes[0]?.events).toEqual([]);
    expect(projection.scenes[0]?.excludedEvents).toMatchObject([
      { eventBlockId: automatic.eventBlockId, title: "자동 사건" },
    ]);
    expect(projection.scenes[1]?.events).toMatchObject([
      {
        eventBlockId: planned.eventBlockId,
        title: "예정 사건",
        membership: "manual",
      },
    ]);
    expect(projection.unassignedEvents).toMatchObject([
      { eventBlockId: automatic.eventBlockId, title: "자동 사건" },
    ]);
  });

  it("marks the current projection for review when an override anchor is unresolved", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const document = documentInput(workId, documentId, "하나\n---\n둘");
    const unresolved: SceneOverrideProjection = {
      ...sceneOverride({
        workId,
        documentId,
        documentRevisionId: document.documentRevisionId,
        operation: "split",
        from: 1,
        to: 1,
        exactQuote: "",
        createdAt: new Date().toISOString(),
      }),
      boundaries: [
        {
          anchorId: entityId<"Anchor">(randomUUID()),
          documentRevisionId: document.documentRevisionId,
          exactQuote: "",
          integrity: "needsReview",
          range: null,
        },
      ],
    };

    const projection = deriveSceneProjection({
      workId,
      ruleSet: ruleSet(workId),
      documents: [document],
      sceneOverrides: [unresolved],
      eventBlocks: [],
      eventSources: [],
      sceneEventOverrides: [],
    });

    expect(projection.status).toBe("needsReview");
    expect(projection.scenes.every((scene) => scene.integrity === "needsReview"))
      .toBe(true);
  });

  it("rejects fields that were not derived by the scene projection contract", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const projection = deriveSceneProjection({
      workId,
      ruleSet: ruleSet(workId),
      documents: [documentInput(workId, documentId, "한 장면")],
      sceneOverrides: [],
      eventBlocks: [],
      eventSources: [],
      sceneEventOverrides: [],
    });

    expect(() => parseSceneProjectionList({ ...projection, sceneBodies: [] }))
      .toThrow(/Unsupported SceneProjectionList field/);
  });
});
