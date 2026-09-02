import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createCanonicalMarkdownExportBundle,
  parseExportCanonicalMarkdownCommand,
  parseExportCanonicalMarkdownResult,
} from "./canonical-markdown-export";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("canonical Markdown export", () => {
  it("creates a deterministic one-way Obsidian note bundle with typed links", () => {
    const source = {
      schemaVersion: 1 as const,
      workId: "work-1",
      workTitle: "북문 / 연대기",
      documents: [
        { documentId: "doc-1", title: "1화", documentRevisionId: "revision-1" },
      ],
      entities: [
        {
          kind: "character" as const,
          entityId: "character-1",
          revision: 3,
          title: "윤서",
          aliases: ["북문의 파수꾼"],
          status: "active",
          updatedAt: "2026-08-29T00:00:00.000Z",
          fields: [
            { label: "역할", value: "파수꾼" },
            { label: "활성", value: true },
          ],
          links: [],
        },
        {
          kind: "continuity-thread" as const,
          entityId: "thread-1",
          revision: 2,
          title: "북문 열쇠의 행방",
          aliases: [],
          status: "open",
          updatedAt: "2026-08-29T01:00:00.000Z",
          fields: [{ label: "메모", value: "열쇠를 회수해야 한다." }],
          links: [
            {
              label: "관련 인물",
              targetKind: "character" as const,
              targetId: "character-1",
            },
          ],
        },
      ],
    };

    const first = createCanonicalMarkdownExportBundle(source, sha256);
    const second = createCanonicalMarkdownExportBundle(
      { ...source, entities: [...source.entities].reverse() },
      sha256,
    );

    expect(second).toEqual(first);
    expect(first.direction).toBe("canonical-to-markdown");
    expect(first.importSupported).toBe(false);
    expect(first.files).toHaveLength(3);
    expect(first.files.every((file) => file.relativePath.endsWith(".md"))).toBe(true);
    expect(first.files.map((file) => file.relativePath)).toEqual(
      [...first.files.map((file) => file.relativePath)].sort((a, b) => a.localeCompare(b)),
    );
    expect(first.suggestedDirectoryName).not.toContain("/");
    expect(first.files[0]?.content).toContain("export_direction: \"canonical-to-markdown\"");
    expect(first.files[0]?.content).toContain("read_only_copy: true");
    const continuity = first.files.find((file) => file.relativePath.startsWith("연속성/"));
    const character = first.files.find((file) => file.relativePath.startsWith("인물/"));
    expect(continuity?.content).toContain(`[[${character?.relativePath.replace(/\.md$/u, "")}|윤서]]`);
    expect(continuity?.content).toContain("다시 가져오지 않습니다");
    expect(first.entityCounts).toEqual({
      character: 1,
      "character-relation": 0,
      "lore-entry": 0,
      "event-block": 0,
      "plot-thread": 0,
      "foreshadow-line": 0,
      scene: 0,
      "continuity-thread": 1,
      "character-knowledge": 0,
    });
  });

  it("keeps the public command and result strictly export-only", () => {
    expect(parseExportCanonicalMarkdownCommand({ schemaVersion: 1, workId: "work-1" })).toEqual({
      schemaVersion: 1,
      workId: "work-1",
    });
    expect(() => parseExportCanonicalMarkdownCommand({
      schemaVersion: 1,
      workId: "work-1",
      markdownImportPath: "vault",
    })).toThrow(/fields/u);
    expect(parseExportCanonicalMarkdownResult({
      schemaVersion: 1,
      status: "completed",
      directoryName: "북문-이음-별빛",
      fileCount: 3,
      byteLength: 1200,
      sourceManifestHash: "a".repeat(64),
      bundleManifestHash: "b".repeat(64),
      entityCounts: {
        character: 1,
        "character-relation": 0,
        "lore-entry": 0,
        "event-block": 0,
        "plot-thread": 0,
        "foreshadow-line": 0,
        scene: 0,
        "continuity-thread": 1,
        "character-knowledge": 0,
      },
    }).status).toBe("completed");
    expect(() => parseExportCanonicalMarkdownResult({
      schemaVersion: 1,
      status: "completed",
      importSupported: true,
    })).toThrow();
  });
});
