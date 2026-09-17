import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

const scriptNames = ["recovery-output.ps1", "copy-eum-vss-workspace.ps1", "copy-eum-wer-report.ps1", "list-eum-vss.ps1", "list-eum-wer-temp.ps1"];
type Fixture = { root: string; repository: string; source: string; output: string; invoke: (script: string, parameters: Record<string, unknown>) => Promise<{ status: number | null; stdout: string; stderr: string }> };

async function withFixture(run: (fixture: Fixture) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "eum-recovery-scripts-"));
  const relative = path.relative(tmpdir(), root);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid temporary recovery fixture root");
  const repository = path.join(root, "source repository");
  const source = path.join(root, "synthetic source");
  const output = path.join(root, "recovered");
  try {
    await mkdir(path.join(repository, "recovery"), { recursive: true });
    await mkdir(source);
    for (const name of scriptNames) await copyFile(path.join(process.cwd(), "recovery", name), path.join(repository, "recovery", name));
    const wrapper = path.join(root, "invoke.ps1");
    await writeFile(wrapper, `param([string]$ScriptPath,[string]$ParametersPath)
$ErrorActionPreference='Stop'
$parameters=Get-Content -LiteralPath $ParametersPath -Raw | ConvertFrom-Json -AsHashtable -DateKind String
foreach($name in @('StartTime','EndTime')) { if($parameters.ContainsKey($name)) { $parameters[$name]=[datetime]::Parse($parameters[$name],[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind) } }
& $ScriptPath @parameters
if(-not $?) { exit 1 }
`);
    const invoke: Fixture["invoke"] = async (script, parameters) => {
      const parametersPath = path.join(root, `${randomUUID()}.json`);
      await writeFile(parametersPath, JSON.stringify(parameters));
      const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-File", wrapper, "-ScriptPath", path.join(repository, "recovery", script), "-ParametersPath", parametersPath], {
        cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024,
      });
      if (result.error) throw result.error;
      return { status: result.status, stdout: result.stdout, stderr: result.stderr };
    };
    await run({ root, repository, source, output, invoke });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
async function exists(filename: string) { return stat(filename).then(() => true, () => false); }

it("copies only caller-selected existing workspace files with unchanged source bytes and matching SHA-256", async () => {
  await withFixture(async ({ source, output, invoke }) => {
    const selected = [`${randomUUID()}.sqlite3`, `${randomUUID()}.wal`];
    const unselected = `${randomUUID()}.bin`;
    const bytes = new Map<string, Buffer>();
    for (const name of [...selected, unselected]) {
      const content = Buffer.concat([Buffer.from(randomUUID(), "utf16le"), Buffer.from([0, 255, 13, 10])]);
      bytes.set(name, content);
      await writeFile(path.join(source, name), content);
    }
    const result = await invoke("copy-eum-vss-workspace.ps1", { SourceRoot: source, TargetRoot: output, FileNames: [...selected, `${randomUUID()}.missing`] });
    expect(result.status, result.stderr).toBe(0);
    expect((await readdir(output)).sort()).toEqual([...selected].sort());
    const receipt = JSON.parse(await readFile(`${output}-files.json`, "utf8"));
    expect(receipt.Files).toHaveLength(selected.length);
    for (const [name, content] of bytes) {
      expect(await readFile(path.join(source, name))).toEqual(content);
      if (selected.includes(name)) {
        expect(await readFile(path.join(output, name))).toEqual(content);
        expect(receipt.Files.find((file: { FileName: string }) => file.FileName === name)).toMatchObject({ SHA256: digest(content), Length: content.length });
      }
    }
  });
});

it("copies a nested WER report preserving relative files, bytes, checksums and write timestamps", async () => {
  await withFixture(async ({ source, output, invoke }) => {
    const files = [`${randomUUID()}.wer`, path.join("nested folder", `${randomUUID()}.dmp`)];
    const timestamp = new Date("2025-04-10T12:00:00.000Z");
    const originals = new Map<string, Buffer>();
    for (const file of files) {
      await mkdir(path.dirname(path.join(source, file)), { recursive: true });
      const content = Buffer.from(`synthetic ${randomUUID()}\r\n`, "utf8");
      originals.set(file, content);
      await writeFile(path.join(source, file), content);
      await utimes(path.join(source, file), timestamp, timestamp);
    }
    const result = await invoke("copy-eum-wer-report.ps1", { SourceReport: source, TargetReport: output });
    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(await readFile(`${output}-files.json`, "utf8"));
    expect(receipt.Files).toHaveLength(files.length);
    for (const [file, content] of originals) {
      expect(await readFile(path.join(source, file))).toEqual(content);
      expect(await readFile(path.join(output, file))).toEqual(content);
      expect((await stat(path.join(output, file))).mtimeMs).toBe((await stat(path.join(source, file))).mtimeMs);
      expect(receipt.Files.find((entry: { RelativePath: string }) => entry.RelativePath === file)).toMatchObject({ SHA256: digest(content), Length: content.length });
    }
  });
});

it("refuses an existing destination and an existing receipt without overwriting either", async () => {
  await withFixture(async ({ source, output, invoke }) => {
    const selected = `${randomUUID()}.bin`;
    await writeFile(path.join(source, selected), "synthetic input");
    await mkdir(output);
    const preserved = path.join(output, "keep.bin");
    await writeFile(preserved, "existing destination");
    const first = await invoke("copy-eum-vss-workspace.ps1", { SourceRoot: source, TargetRoot: output, FileNames: [selected] });
    expect(first.status).not.toBe(0);
    expect(await readFile(preserved, "utf8")).toBe("existing destination");
    expect(await exists(path.join(output, selected))).toBe(false);
    const freshOutput = `${output}-next`;
    await writeFile(`${freshOutput}-files.json`, "existing receipt");
    const second = await invoke("copy-eum-wer-report.ps1", { SourceReport: source, TargetReport: freshOutput });
    expect(second.status).not.toBe(0);
    expect(await readFile(`${freshOutput}-files.json`, "utf8")).toBe("existing receipt");
    expect(await exists(freshOutput)).toBe(false);
    expect(await readFile(path.join(source, selected), "utf8")).toBe("synthetic input");
  });
});

const rejectedOutputCases: ReadonlyArray<readonly [string, (fixture: Fixture) => string]> = [
  ["repository output", ({ repository }) => path.join(repository, "blocked")],
  ["normalized traversal", ({ root }) => root + path.sep + "outside" + path.sep + ".." + path.sep + "source repository" + path.sep + "blocked"],
  ["relative output", () => "relative-output"],
  ...(process.platform === "win32" ? [
    ["drive-relative output", ({ root }: Fixture) => path.parse(root).root.slice(0, 2) + "relative-output"] as const,
    ["device-prefixed output", ({ repository }: Fixture) => "\\\\?\\" + path.join(repository, "device-blocked")] as const,
  ] : []),
];

it.each(rejectedOutputCases)("rejects %s before writing", async (_label, selectPath) => {
  await withFixture(async (fixture) => {
    const { repository, source, invoke } = fixture;
    const selected = randomUUID() + ".bin";
    await writeFile(path.join(source, selected), "synthetic input");
    const target = selectPath(fixture);
    const result = await invoke("copy-eum-vss-workspace.ps1", { SourceRoot: source, TargetRoot: target, FileNames: [selected] });
    expect(result.status, "accepted " + target + ": " + result.stderr).not.toBe(0);
    expect(await exists(path.join(repository, "blocked"))).toBe(false);
    expect(await exists(path.join(repository, "device-blocked"))).toBe(false);
  });
});

it("rejects a reparse parent that aliases the repository without copying into it", async () => {
  await withFixture(async ({ root, repository, source, invoke }) => {
    const alias = path.join(root, "outside-alias");
    await symlink(repository, alias, process.platform === "win32" ? "junction" : "dir");
    const selected = `${randomUUID()}.bin`;
    await writeFile(path.join(source, selected), "synthetic input");
    const result = await invoke("copy-eum-vss-workspace.ps1", { SourceRoot: source, TargetRoot: path.join(alias, "nested", "blocked"), FileNames: [selected] });
    expect(result.status, result.stderr).not.toBe(0);
    expect(await exists(path.join(repository, "nested"))).toBe(false);
    expect(await readFile(path.join(source, selected), "utf8")).toBe("synthetic input");
  });
});

it("rejects a selected file path escape before creating a workspace destination", async () => {
  await withFixture(async ({ root, source, output, invoke }) => {
    await writeFile(path.join(root, "outside.bin"), "synthetic outside");
    const result = await invoke("copy-eum-vss-workspace.ps1", { SourceRoot: source, TargetRoot: output, FileNames: ["../outside.bin"] });
    expect(result.status).not.toBe(0);
    expect(await exists(output)).toBe(false);
    expect(await readFile(path.join(root, "outside.bin"), "utf8")).toBe("synthetic outside");
  });
});

it("keeps both report and selected-workspace copies out of their source directory", async () => {
  await withFixture(async ({ source, invoke }) => {
    const selected = `${randomUUID()}.bin`;
    await writeFile(path.join(source, selected), "synthetic input");
    for (const script of ["copy-eum-wer-report.ps1", "copy-eum-vss-workspace.ps1"]) {
      const target = path.join(source, `${randomUUID()}-output`);
      const parameters = script === "copy-eum-wer-report.ps1" ? { SourceReport: source, TargetReport: target } : { SourceRoot: source, TargetRoot: target, FileNames: [selected] };
      const result = await invoke(script, parameters);
      expect(result.status, result.stderr).not.toBe(0);
      expect(await exists(target)).toBe(false);
    }
    expect(await readdir(source)).toEqual([selected]);
  });
});

it("filters WER temp files by inclusive UTC instants and keeps nested files out of the top-level inventory", async () => {
  await withFixture(async ({ source, output, invoke }) => {
    const start = new Date("2025-04-10T12:00:00.000Z");
    const end = new Date("2025-04-10T12:10:00.000Z");
    const included: string[] = [];
    for (const offset of [-1000, 0, 120000, 600000, 601000]) {
      const name = `${randomUUID()}.tmp`;
      await writeFile(path.join(source, name), `synthetic ${offset}`);
      const instant = new Date(start.getTime() + offset);
      await utimes(path.join(source, name), instant, instant);
      if (offset >= 0 && offset <= 600000) included.push(name);
    }
    await mkdir(path.join(source, "nested"));
    const nested = path.join(source, "nested", `${randomUUID()}.tmp`);
    await writeFile(nested, "nested synthetic input");
    await utimes(nested, start, start);
    const result = await invoke("list-eum-wer-temp.ps1", { SourceRoot: source, OutputPath: output, StartTime: start.toISOString(), EndTime: end.toISOString() });
    expect(result.status, result.stderr).toBe(0);
    const inventory = JSON.parse(await readFile(output, "utf8"));
    expect(inventory.Files.map((file: { Name: string }) => file.Name).sort()).toEqual(included.sort());
    for (const file of inventory.Files) expect(new Date(file.LastWriteTimeUtc).getTime()).toBeGreaterThanOrEqual(start.getTime());
  });
});

it("rejects an inverted WER time range without creating an inventory", async () => {
  await withFixture(async ({ source, output, invoke }) => {
    const result = await invoke("list-eum-wer-temp.ps1", { SourceRoot: source, OutputPath: output, StartTime: "2025-04-10T12:10:00Z", EndTime: "2025-04-10T12:00:00Z" });
    expect(result.status).not.toBe(0);
    expect(await exists(output)).toBe(false);
  });
});
