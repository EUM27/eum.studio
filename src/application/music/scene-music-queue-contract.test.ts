import { describe, expect, it } from "vitest";

import {
  parseSceneMusicQueueCandidate,
  parseSearchSceneMusicQueuesCommand,
  selectedSceneMusicQueueOption,
} from "./scene-music-queue-contract";

const candidateValue = {
  schemaVersion: 1,
  candidateId: "candidate-a",
  revision: 2,
  workId: "work-a",
  sceneKey: "scene-a",
  binding: {
    schemaVersion: 1,
    sceneMetadataBindingId: "binding-music-a",
    revision: 1,
    workId: "work-a",
    metadataKind: "music-queue",
    metadataId: "candidate-a",
    sourceSceneKey: "scene-a",
    sceneId: "scene-identity-a",
    status: "current",
    proposedSceneId: null,
    lineageOperationId: null,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:01:00.000Z",
  },
  sceneAnnotationId: "annotation-a",
  sceneAnnotationRevision: 3,
  providerId: "youtube",
  query: "닫힌 방 밤",
  status: "selected",
  integrity: "current",
  options: [{
    optionId: "option-a",
    tracks: [{
      providerId: "youtube",
      videoId: "video-a",
      title: "밤의 문",
      channel: "작곡가",
      thumbnailUrl: null,
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    }],
  }],
  selectedOptionId: "option-a",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:01:00.000Z",
} as const;

describe("scene music queue contract", () => {
  it("binds a search to an exact Work, scene, and annotation revision", () => {
    expect(parseSearchSceneMusicQueuesCommand({
      schemaVersion: 1,
      requestId: "request-a",
      workId: "work-a",
      sceneKey: "scene-a",
      expectedAnnotationRevision: 3,
      query: "  닫힌 방 밤  ",
    })).toMatchObject({
      requestId: "request-a",
      workId: "work-a",
      sceneKey: "scene-a",
      expectedAnnotationRevision: 3,
      query: "닫힌 방 밤",
    });
  });

  it("returns tracks only from an explicitly selected current option", () => {
    const candidate = parseSceneMusicQueueCandidate(candidateValue);
    expect(selectedSceneMusicQueueOption(candidate)?.tracks.map(
      (track) => track.videoId,
    )).toEqual(["video-a"]);
    expect(selectedSceneMusicQueueOption({
      ...candidate,
      integrity: "stale",
    })).toBeNull();
  });

  it("rejects a selected status without an exact option identity", () => {
    expect(() => parseSceneMusicQueueCandidate({
      ...candidateValue,
      selectedOptionId: "option-missing",
    })).toThrow("selectedOptionId");
  });
});
