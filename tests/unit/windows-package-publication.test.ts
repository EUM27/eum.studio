import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

async function withPackageFixture(run: (input: { root: string; packageOnce: (name?: string) => ReturnType<typeof spawnSync> }) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "eum-package-publication-"));
  const relative = path.relative(tmpdir(), root);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid package fixture root");
  try {
    for (const directory of ["scripts", "node_modules/electron/dist", "dist-electron/desktop", "dist-electron/preload", "dist-renderer", "config", "out/eum-studio-win-x64"]) await mkdir(path.join(root, directory), { recursive: true });
    await copyFile(path.resolve("scripts/package-windows.mjs"), path.join(root, "scripts/package-windows.mjs"));
    for (const [file, content] of [
      ["node_modules/electron/dist/electron.exe", "fixture runtime"],
      ["dist-electron/desktop/main.js", 'require("electron");'],
      ["dist-electron/preload/index.js", "fixture preload"],
      ["dist-renderer/index.html", "fixture renderer"],
      ["out/eum-studio-win-x64/preserved.txt", "existing user package"],
      ["package.json", JSON.stringify({ name: randomUUID(), productName: randomUUID(), version: "0.0.0", main: "dist-electron/desktop/main.js" })],
    ]) await writeFile(path.join(root, file!), content!);
    await run({ root, packageOnce: (name) => {
      const env = { ...process.env };
      delete env.EUM_STUDIO_WINDOWS_PACKAGE_DIRECTORY_NAME;
      if (name !== undefined) env.EUM_STUDIO_WINDOWS_PACKAGE_DIRECTORY_NAME = name;
      return spawnSync(process.execPath, [path.join(root, "scripts/package-windows.mjs")], { cwd: root, env, encoding: "utf8", windowsHide: true });
    } });
  } finally { await rm(root, { recursive: true, force: true }); }
}

it("builds unique candidates by default and preserves the existing user package", async () => {
  await withPackageFixture(async ({ root, packageOnce }) => {
    const first = packageOnce(); const second = packageOnce();
    expect(first.status, String(first.stderr)).toBe(0); expect(second.status, String(second.stderr)).toBe(0);
    const a = JSON.parse(String(first.stdout)); const b = JSON.parse(String(second.stdout));
    expect(a.packageRoot).not.toBe(b.packageRoot);
    expect(a.packageRoot).not.toBe(path.join(root, "out/eum-studio-win-x64"));
    expect(await readFile(path.join(root, "out/eum-studio-win-x64/preserved.txt"), "utf8")).toBe("existing user package");
    expect(await readFile(a.manifestPath, "utf8")).toContain('"schemaVersion": 1');
  });
});

it("refuses an explicitly named existing package without replacing or deleting its files", async () => {
  await withPackageFixture(async ({ root, packageOnce }) => {
    const result = packageOnce("eum-studio-win-x64");
    expect(result.status).not.toBe(0);
    expect(await readdir(path.join(root, "out/eum-studio-win-x64"))).toEqual(["preserved.txt"]);
    expect(await readFile(path.join(root, "out/eum-studio-win-x64/preserved.txt"), "utf8")).toBe("existing user package");
  });
});
