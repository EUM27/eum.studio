import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

async function inspectFixture(files: Readonly<Record<string, string>>, report = false) {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-architecture-"));
  const relative = path.relative(tmpdir(), directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid architecture fixture cleanup path");
  try {
    for (const [name, source] of Object.entries(files)) {
      const file = path.join(directory, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, source, "utf8");
    }
    const result = spawnSync(process.execPath, [
      path.join(process.cwd(), "scripts", report ? "architecture-report.mjs" : "check-architecture-boundaries.mjs"),
      "--root", directory,
    ], { encoding: "utf8", windowsHide: true });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

it("checks actual desktop entrypoints, including bootstrap and the local runtime", async () => {
  const result = await inspectFixture({
    "src/desktop/bootstrap.ts": "const REQUEST_CHANNEL = 'studio:request'; export { REQUEST_CHANNEL };",
    "src/desktop/local-workspace-runtime.ts": "export const query = `SELECT id FROM works`;",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("bootstrap.ts imports or references an individual IPC channel");
  expect(result.stderr).toContain("local-workspace-runtime.ts contains business SQL");
});

it("rejects service cycles and reverse dependencies on the facade", async () => {
  const result = await inspectFixture({
    "src/desktop/local-workspace-runtime.ts": "export type Runtime = {};",
    "src/desktop/workspace-runtime/a.ts": "import { b } from './b'; export const a = () => b;",
    "src/desktop/workspace-runtime/b.ts": "import { a } from './a'; import type { Runtime } from '../local-workspace-runtime'; export const b = () => a;",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("imports the central runtime facade");
  expect(result.stderr).toContain("runtime service dependency cycle:");
});

it("allows type-only dependency cycles without turning them into runtime dependencies", async () => {
  const result = await inspectFixture({
    "src/desktop/workspace-runtime/a.ts": "import type { B } from './b'; export type A = { b?: B };",
    "src/desktop/workspace-runtime/b.ts": "import { type A } from './a'; export type B = { a?: A };",
  });
  expect(result.status).toBe(0);
});

it("retains domain, view and unique IPC ownership boundaries", async () => {
  const channel = `studio:${randomUUID()}`;
  const result = await inspectFixture({
    "src/domain/record.ts": "import { readFile } from 'node:fs/promises'; export { readFile };",
    "src/renderer/View.tsx": "export const view = () => window['eumStudio'];",
    "src/application/contracts/a.ts": `export const A_CHANNEL = '${channel}';`,
    "src/application/contracts/b.ts": `export const B_CHANNEL = '${channel}';`,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("imports a forbidden runtime layer");
  expect(result.stderr).toContain("accesses window.eumStudio from a view");
  expect(result.stderr).toContain("duplicate bridge channel");
});

it("reports every runtime service without a hand-maintained target allowlist", async () => {
  const filename = `src/desktop/workspace-runtime/${randomUUID()}.ts`;
  const source = "export class Service { read() { return 'SELECT id FROM works'; } }";
  const result = await inspectFixture({ [filename]: source, "src/desktop/local-workspace-runtime.ts": "export {};" }, true);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { summary: { runtimeServiceFiles: number }; files: { file: string; bytes: number; methods: number; sqlStatements: number }[] };
  expect(report.summary.runtimeServiceFiles).toBe(1);
  expect(report.files.find((entry) => entry.file === filename)).toMatchObject({ bytes: Buffer.byteLength(source), methods: 1, sqlStatements: 1 });
  expect(report.files.some((entry) => entry.file === "src/desktop/local-workspace-runtime.ts")).toBe(true);
});
