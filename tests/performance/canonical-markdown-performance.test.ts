import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_MARKDOWN_ENTITY_KINDS,
  createCanonicalMarkdownExportBundle,
  type CanonicalMarkdownEntitySource,
} from "../../src/application/export/canonical-markdown-export";
import fixture from "../fixtures/canonical-markdown-performance-profile.json";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]!;
}

describe("canonical Markdown export performance", () => {
  it("measures deterministic rendering for a large all-kind canonical source", async () => {
    const entities: CanonicalMarkdownEntitySource[] = CANONICAL_MARKDOWN_ENTITY_KINDS.flatMap(
      (kind) => Array.from({ length: fixture.measurement.entitiesPerKind }, (_, index) => ({
        kind,
        entityId: `${kind}-${String(index).padStart(4, "0")}`,
        revision: index + 1,
        title: `${kind} 제목 ${index}`,
        aliases: [`별칭 ${index}`],
        status: "active",
        updatedAt: "2026-08-29T00:00:00.000Z",
        fields: [
          { label: "요약", value: `${kind} 별빛 내용 ${index}` },
          { label: "순번", value: index },
        ],
        links: index === 0 || kind === "character"
          ? []
          : [{ label: "관련 인물", targetKind: "character" as const, targetId: `character-${String(index).padStart(4, "0")}` }],
      })),
    );
    const source = {
      schemaVersion: 1 as const,
      workId: "work-performance",
      workTitle: "대규모 별빛 측정",
      documents: Array.from({ length: fixture.measurement.documentCount }, (_, index) => ({
        documentId: `document-${String(index).padStart(4, "0")}`,
        title: `${index + 1}화`,
        documentRevisionId: `revision-${String(index).padStart(4, "0")}`,
      })),
      entities,
    };
    const timings: number[] = [];
    let canonicalHash = "";
    let fileCount = 0;
    let byteLength = 0;
    for (let iteration = 0; iteration < fixture.measurement.iterationCount; iteration += 1) {
      const started = performance.now();
      const bundle = createCanonicalMarkdownExportBundle(
        iteration % 2 === 0 ? source : { ...source, entities: [...entities].reverse() },
        sha256,
      );
      timings.push(performance.now() - started);
      if (canonicalHash === "") canonicalHash = bundle.bundleManifestHash;
      expect(bundle.bundleManifestHash).toBe(canonicalHash);
      expect(bundle.importSupported).toBe(false);
      fileCount = bundle.files.length;
      byteLength = bundle.files.reduce((sum, file) => sum + file.byteLength, 0);
    }
    const report = {
      schemaVersion: 1,
      fixtureUse: fixture.fixtureUse,
      environment: { platform: process.platform, architecture: process.arch, node: process.version },
      rowCounts: {
        documents: source.documents.length,
        entities: entities.length,
        entitiesPerKind: fixture.measurement.entitiesPerKind,
        markdownFiles: fileCount,
      },
      outputBytes: byteLength,
      timings: {
        canonicalToMarkdownMs: {
          raw: timings,
          p50: percentile(timings, 0.5),
          p95: percentile(timings, 0.95),
        },
      },
      deterministicBundle: true,
      importSupported: false,
      databaseBytes: { measured: false, growth: null, reason: "pure-application-harness" },
      rendererCommitCount: { measured: false, value: null, reason: "application-harness" },
    };
    const artifactPath = path.resolve(
      "docs/verification/canon-continuity-gates-2-8/gate-8-canonical-markdown-performance.json",
    );
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(JSON.parse(await readFile(artifactPath, "utf8"))).toEqual(report);
  });
});
