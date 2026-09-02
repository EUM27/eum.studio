import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createCanonicalMarkdownExportBundle } from "../../application/export/canonical-markdown-export";
import { exportNodeCanonicalMarkdownBundle } from "./node-canonical-markdown-export";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function bundle() {
  return createCanonicalMarkdownExportBundle({
    schemaVersion: 1,
    workId: "work-platform",
    workTitle: `작품-${randomUUID()}`,
    documents: [],
    entities: [{
      kind: "lore-entry",
      entityId: "lore-1",
      revision: 1,
      title: "북문",
      aliases: [],
      status: "active",
      updatedAt: "2026-08-29T00:00:00.000Z",
      fields: [{ label: "내용", value: "밤에는 닫힌다." }],
      links: [],
    }],
  }, sha256);
}

describe("Node canonical Markdown export adapter", () => {
  it("publishes verified UTF-8 Markdown in a new collision-safe directory", async () => {
    const baseDirectoryPath = await mkdtemp(path.join(tmpdir(), "eum-canonical-export-"));
    const prepared = bundle();
    try {
      const first = await exportNodeCanonicalMarkdownBundle({ baseDirectoryPath, bundle: prepared });
      const second = await exportNodeCanonicalMarkdownBundle({ baseDirectoryPath, bundle: prepared });

      expect(first.directoryName).toBe(prepared.suggestedDirectoryName);
      expect(second.directoryName).toBe(`${prepared.suggestedDirectoryName}-2`);
      expect(first.fileCount).toBe(prepared.files.length);
      expect(first.byteLength).toBe(prepared.files.reduce((sum, file) => sum + file.byteLength, 0));
      expect(first.bundleManifestHash).toBe(prepared.bundleManifestHash);
      expect(await readFile(path.join(first.finalDirectoryPath, "00-별빛-색인.md"), "utf8"))
        .toBe(prepared.files.find((file) => file.relativePath === "00-별빛-색인.md")?.content);
      expect((await readdir(baseDirectoryPath)).some((name) => name.startsWith(".eum-export-stage-")))
        .toBe(false);
    } finally {
      await rm(baseDirectoryPath, { recursive: true, force: true });
    }
  });

  it("rejects traversal before writing any file", async () => {
    const baseDirectoryPath = await mkdtemp(path.join(tmpdir(), "eum-canonical-export-invalid-"));
    const prepared = bundle();
    try {
      await expect(exportNodeCanonicalMarkdownBundle({
        baseDirectoryPath,
        bundle: {
          ...prepared,
          files: [{ ...prepared.files[0]!, relativePath: "../outside.md" }],
        },
      })).rejects.toThrow(/relative Markdown path/u);
      expect(await readdir(baseDirectoryPath)).toEqual([]);
    } finally {
      await rm(baseDirectoryPath, { recursive: true, force: true });
    }
  });
});
