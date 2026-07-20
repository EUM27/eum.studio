import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const requiredLayers = [
  "domain",
  "application",
  "platform",
  "desktop",
  "preload",
  "renderer",
] as const;

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const candidate = path.join(directory, entry);
    if (statSync(candidate).isDirectory()) {
      return collectSourceFiles(candidate);
    }
    return /\.(ts|tsx)$/.test(candidate) && !candidate.endsWith(".test.ts")
      ? [candidate]
      : [];
  });
}

describe("source architecture", () => {
  it("contains every approved Gate 0 layer", () => {
    const missing = requiredLayers.filter(
      (layer) => !existsSync(path.join(sourceRoot, layer)),
    );

    expect(missing).toEqual([]);
  });

  it("keeps Electron imports inside desktop platform boundaries", () => {
    const allowedDirectories = [
      path.join(sourceRoot, "desktop"),
      path.join(sourceRoot, "preload"),
      path.join(sourceRoot, "platform", "electron"),
    ];
    const violations = collectSourceFiles(sourceRoot)
      .filter((file) => readFileSync(file, "utf8").includes('from "electron"'))
      .filter(
        (file) =>
          !allowedDirectories.some((directory) => file.startsWith(directory)),
      )
      .map((file) => path.relative(projectRoot, file));

    expect(violations).toEqual([]);
  });

  it("keeps renderer source free of Electron and Node imports", () => {
    const rendererRoot = path.join(sourceRoot, "renderer");
    const forbiddenImport = /from\s+["'](?:electron|node:|fs(?:\/|["']))/;
    const violations = collectSourceFiles(rendererRoot)
      .filter((file) => forbiddenImport.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(projectRoot, file));

    expect(violations).toEqual([]);
  });

  it("declares a restrictive renderer content security policy", () => {
    const indexPath = path.join(projectRoot, "index.html");

    expect(existsSync(indexPath)).toBe(true);
    const html = readFileSync(indexPath, "utf8");
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("script-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'none'");
    expect(html).not.toContain("frame-ancestors");
  });
});
