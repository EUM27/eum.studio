import { describe, expect, it } from "vitest";

import {
  parseSceneAnnotationList,
  parseSceneAnnotationProjection,
} from "./scene-annotation-contract";
import {
  parseDecideSceneExtractionAnnotationCommand,
} from "./scene-extraction-contract";

const annotation = {
  schemaVersion: 1,
  sceneAnnotationId: "annotation-a",
  revision: 1,
  workId: "work-a",
  sceneKey: "scene-key-a",
  binding: {
    schemaVersion: 1,
    sceneMetadataBindingId: "binding-annotation-a",
    revision: 1,
    workId: "work-a",
    metadataKind: "annotation",
    metadataId: "annotation-a",
    sourceSceneKey: "scene-key-a",
    sceneId: "scene-a",
    status: "current",
    proposedSceneId: null,
    lineageOperationId: null,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  },
  documentId: "document-a",
  documentRevisionId: "revision-a",
  sourceCandidateId: "candidate-a",
  sourceSceneItemId: "scene-item-a",
  title: "닫힌 방",
  summary: "문이 닫힌다.",
  povCharacterId: null,
  location: "방",
  time: "밤",
  characterIds: [],
  goal: "문을 연다.",
  conflict: "문이 잠겼다.",
  outcome: "",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
} as const;

describe("scene annotation contract", () => {
  it("keeps approved metadata attached to a Work-owned SceneProjection key", () => {
    expect(parseSceneAnnotationProjection(annotation)).toMatchObject({
      workId: "work-a",
      sceneKey: "scene-key-a",
      title: "닫힌 방",
      documentRevisionId: "revision-a",
    });
    expect(parseSceneAnnotationList({
      schemaVersion: 1,
      workId: "work-a",
      annotations: [annotation],
    }).annotations).toHaveLength(1);
  });

  it("requires the exact projected scene key and annotation revision on approval", () => {
    expect(parseDecideSceneExtractionAnnotationCommand({
      schemaVersion: 1,
      workId: "work-a",
      candidateId: "candidate-a",
      expectedCandidateRevision: 2,
      sceneItemId: "scene-item-a",
      decision: {
        kind: "accept",
        sceneKey: "scene-key-a",
        expectedAnnotationRevision: null,
      },
    }).decision).toEqual({
      kind: "accept",
      sceneKey: "scene-key-a",
      expectedAnnotationRevision: null,
    });
  });
});
