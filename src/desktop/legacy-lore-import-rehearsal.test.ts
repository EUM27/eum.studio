import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseLegacyLoreImportProfile } from "../application/migration/legacy-lore-import-profile";
import { runLegacyLoreImportRehearsal } from "./legacy-lore-import-rehearsal";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("legacy lore import rehearsal", () => {
  it("seals a read-only source, writes an exact rehearsal, and reuses it without duplicates", async () => {
    const parent = await mkdtemp(
      path.join(tmpdir(), `eum-legacy-import-${randomUUID()}-`),
    );
    const sourceRootPath = path.join(parent, "legacy-source");
    const targetRootPath = path.join(parent, "import-rehearsal");
    const sourceFilePath = path.join(sourceRootPath, "data", "lorebooks.json");
    const manuscript = "첫 줄\n둘째 줄 ⋯";
    await mkdir(path.dirname(sourceFilePath), { recursive: true });
    await writeFile(
      sourceFilePath,
      JSON.stringify({
        library: {
          works: [{
            id: "legacy-work",
            title: "가져올 작품",
            description: "설명",
            episodeIds: ["legacy-document"],
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
            futureField: { preserved: true },
          }],
          episodes: [{
            id: "legacy-document",
            workId: "legacy-work",
            title: "1화",
            index: 1,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          }],
          episodeFolders: [],
        },
        manuscripts: { "legacy-document": manuscript },
        recentWork: {
          "legacy-work": {
            episodeId: "legacy-document",
            cursor: 2,
            updatedAt: 1_700_000_200_000,
          },
        },
        factTemplatesByEpisode: {},
        books: [],
        entries: [],
        sessionLogs: [],
      }),
      "utf8",
    );
    const sourceChecksum = sha256(await readFile(sourceFilePath));
    const profile = parseLegacyLoreImportProfile(
      JSON.parse(
        readFileSync(
          path.join(process.cwd(), "config", "legacy-lore-import.json"),
          "utf8",
        ),
      ),
    );

    try {
      const first = await runLegacyLoreImportRehearsal({
        sourceRootPath,
        targetRootPath,
        studioDisplayName: "이음 스튜디오",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
        profile,
      });
      expect(first).toMatchObject({
        publication: "published",
        sourceChecksumValue: sourceChecksum,
        sourceUnchanged: true,
        counts: {
          workCount: 1,
          documentCount: 1,
          revisionCount: 1,
          uncoveredItemCount: 0,
        },
      });
      expect(sha256(await readFile(sourceFilePath))).toBe(sourceChecksum);

      const second = await runLegacyLoreImportRehearsal({
        sourceRootPath,
        targetRootPath,
        studioDisplayName: "이음 스튜디오",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
        profile,
      });
      expect(second).toEqual({ ...first, publication: "reused" });
      expect(sha256(await readFile(sourceFilePath))).toBe(sourceChecksum);
      const report = JSON.parse(await readFile(first.reportPath, "utf8"));
      expect(report.manuscripts[0]).toMatchObject({
        sourceDocumentId: "legacy-document",
        lengthUtf16: manuscript.length,
      });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
