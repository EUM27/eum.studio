import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { encodeDurableText } from "../persistence/change-batch";
import { createLegacyLoreDryRunPlan } from "./legacy-lore-dry-run";

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

describe("legacy lore dry-run plan", () => {
  it("derives stable ownership-scoped targets and preserves exact manuscript checksums", () => {
    const payload = {
      library: {
        works: [
          {
            id: "source-work",
            title: "사용자가 쓴 제목",
            description: "설명",
            episodeIds: ["source-document"],
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
            futureField: { stays: "raw" },
          },
        ],
        episodeFolders: [],
        episodes: [
          {
            id: "source-document",
            workId: "source-work",
            title: "1화",
            index: 1,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          },
        ],
      },
      manuscripts: {
        "source-document": "첫 줄\n둘째 줄 ⋯",
        "orphan-document": "귀속하지 않을 원문",
      },
      factTemplatesByEpisode: {},
      recentWork: {
        "source-work": {
          episodeId: "source-document",
          cursor: 3,
          updatedAt: 1_700_000_200_000,
        },
      },
      books: [],
      entries: [],
      sessionLogs: [{
        id: "source-session",
        workId: "source-work",
        episodeId: "source-document",
        mode: "free",
        createdAt: 1_700_000_000_000,
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_030_000,
        durationMs: 30_000,
        charDelta: 12,
        focusCompletion: null,
        focusTargetMs: null,
      }],
      providerSettings: {
        refreshToken: "must-not-reach-target",
      },
    };
    const createPlan = (
      sourceSnapshotId = "snapshot-a",
      sourceSnapshotChecksumValue = "source-checksum-a",
    ) => createLegacyLoreDryRunPlan({
      mapperVersion: "legacy-lore-v1",
      sourceSnapshotId,
      sourceSnapshotChecksumValue,
      createdAt: "2026-08-07T00:00:00.000Z",
      resumeWorkspaceMode: "manuscript",
      completedWritingSessionState: "completed",
      secretLikeFieldFragments: [
        "accessToken",
        "refreshToken",
        "apiKey",
        "clientSecret",
      ],
      secretRedactionValue: "[REDACTED]",
      payload,
      deriveTargetId: (identity) => digest(identity),
      describeManuscript: (text) => {
        const bytes = encodeDurableText(text);
        return {
          checksumIdentity: "sha256-utf16le",
          checksumValue: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.byteLength,
          lengthUtf16: text.length,
        };
      },
      describeRawItem: ({ value }) => {
        const bytes = new TextEncoder().encode(JSON.stringify(value));
        return {
          serializationIdentity: "json-utf8",
          checksumIdentity: "sha256-json-utf8",
          checksumValue: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.byteLength,
          bytes,
        };
      },
    });

    const first = createPlan();
    const second = createPlan();
    const otherArchive = createPlan("snapshot-b", "source-checksum-b");
    expect(second).toEqual(first);
    expect(otherArchive.batchId).not.toBe(first.batchId);
    expect(otherArchive.works[0]?.workId).not.toBe(first.works[0]?.workId);
    expect(first.works).toHaveLength(1);
    expect(first.documents).toHaveLength(1);
    expect(first.resumeCheckpoints).toEqual([
      expect.objectContaining({
        sourceWorkId: "source-work",
        sourceDocumentId: "source-document",
        cursorOffset: 3,
        workspaceMode: "manuscript",
      }),
    ]);
    expect(first.writingSessions).toEqual([
      expect.objectContaining({
        sourceSessionId: "source-session",
        state: "completed",
        modeRef: "free",
      }),
    ]);
    expect(first.receiptCoverage).toEqual({
      sourceItemCount: first.receipts.length,
      receiptCount: first.receipts.length,
      uncoveredItemCount: 0,
    });
    expect(first.rawItems).toHaveLength(first.receipts.length);
    expect(first.receipts.every((receipt) => receipt.rawItemId.length > 0)).toBe(
      true,
    );
    expect(
      first.rawItems.some((item) =>
        new TextDecoder().decode(item.bytes).includes("must-not-reach-target"),
      ),
    ).toBe(false);
    expect(first.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceCollection: "$",
        sourceIdentity: "providerSettings",
        issueKinds: expect.arrayContaining(["secret-field-redacted"]),
      }),
    ]));
    expect(first.documents[0]).toMatchObject({
      sourceDocumentId: "source-document",
      title: "1화",
      manuscript: "첫 줄\n둘째 줄 ⋯",
      manuscriptLengthUtf16: "첫 줄\n둘째 줄 ⋯".length,
    });
    expect(first.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceCollection: "manuscripts",
        sourceIdentity: "source-document",
        targetEntityKind: "DocumentRevision",
        disposition: "adapted",
      }),
      expect.objectContaining({
        sourceCollection: "manuscripts",
        sourceIdentity: "orphan-document",
        targetEntityKind: "RawPreservedItem",
        targetEntityId: null,
        disposition: "raw-only",
      }),
    ]));
    expect(JSON.stringify(first.receipts)).not.toContain("귀속하지 않을 원문");
  });
});
