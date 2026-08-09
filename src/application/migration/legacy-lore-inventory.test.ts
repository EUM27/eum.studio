import { describe, expect, it } from "vitest";

import { inventoryLegacyLorePayload } from "./legacy-lore-inventory";
import { parseRawJsonInventory } from "./raw-json-inventory";

describe("legacy lore inventory", () => {
  it("inventories all raw fields and classifies ownership gaps without inventing fallback owners", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      schemaVersion: 3,
      library: {
        works: [
          {
            id: "work-a",
            episodeIds: ["doc-a"],
            futureWorkField: { preserved: true },
          },
        ],
        episodes: [
          { id: "doc-a", workId: "work-a" },
        ],
        episodeFolders: [],
      },
      manuscripts: {
        "doc-a": "본문",
        "orphan-doc": "보존할 고아 원고",
      },
      factTemplatesByEpisode: {
        "doc-a": { markers: [] },
        "orphan-structure": { markerRanges: [] },
      },
      recentWork: {
        "work-a": {
          episodeId: "doc-a",
          cursor: 2,
          updatedAt: 1_700_000_200_000,
        },
        "missing-work": { episodeId: "doc-a", cursor: 0 },
      },
      sessionLogs: [{ id: "session-a" }],
      books: [],
      entries: [],
      providerSettings: {
        refreshToken: "must-never-appear-in-inventory",
      },
    }));

    const parsed = parseRawJsonInventory(bytes, {
      dynamicObjectPaths: [
        "$.manuscripts",
        "$.factTemplatesByEpisode",
        "$.recentWork",
      ],
      knownObjectFields: [
        {
          objectPath: "$.library.works[]",
          fields: ["id", "episodeIds"],
        },
      ],
      secretLikeFieldFragments: ["token", "secret", "key"],
    });
    const report = inventoryLegacyLorePayload(parsed.value);

    expect(parsed.report.unknownFields).toEqual([
      {
        objectPath: "$.library.works[]",
        field: "futureWorkField",
        disposition: "raw-only",
      },
    ]);
    expect(parsed.report.secretLikePaths).toContain(
      "$.providerSettings.refreshToken",
    );
    expect(JSON.stringify(parsed.report)).not.toContain(
      "must-never-appear-in-inventory",
    );
    expect(report.counts).toMatchObject({
      workCount: 1,
      documentCount: 1,
      manuscriptCount: 2,
      registeredManuscriptCount: 1,
      orphanManuscriptCount: 1,
      structureSnapshotCount: 2,
      orphanStructureCount: 1,
      resumeCandidateCount: 2,
      validResumeCheckpointCount: 1,
      invalidResumeCheckpointCount: 1,
      sessionCount: 1,
    });
    expect(report.issues).toEqual(expect.arrayContaining([
      {
        kind: "orphan-manuscript",
        sourceCollection: "manuscripts",
        sourceIdentity: "orphan-doc",
        disposition: "quarantine",
      },
      {
        kind: "orphan-structure",
        sourceCollection: "factTemplatesByEpisode",
        sourceIdentity: "orphan-structure",
        disposition: "quarantine",
      },
      {
        kind: "invalid-resume-checkpoint",
        sourceCollection: "recentWork",
        sourceIdentity: "missing-work",
        disposition: "review",
      },
    ]));
  });
});
