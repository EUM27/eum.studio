import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");

function filesUnder(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(path));
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(path))) result.push(path);
  }
  return result;
}

const errors = [];
const domainRoot = resolve(root, "src/domain");
for (const file of filesUnder(domainRoot)) {
  const source = readFileSync(file, "utf8");
  if (/from\s+["'][^"']*(?:react|electron|platform|desktop)[^"']*["']/u.test(source)) {
    errors.push(`${relative(root, file)} imports a forbidden runtime layer`);
  }
}

const rendererRoot = resolve(root, "src/renderer");
const rootCompositionFiles = new Set([
  resolve(rendererRoot, "App.tsx"),
  resolve(rendererRoot, "StudioShell.tsx"),
  resolve(rendererRoot, "WorkspaceRoot.tsx"),
  resolve(rendererRoot, "StudioRoot.tsx"),
]);
for (const file of filesUnder(rendererRoot)) {
  if (extname(file) !== ".tsx" || rootCompositionFiles.has(file)) continue;
  if (readFileSync(file, "utf8").includes("window.eumStudio")) {
    errors.push(`${relative(root, file)} accesses window.eumStudio from a view`);
  }
}

const channelOwners = new Map();
for (const file of filesUnder(resolve(root, "src/application/contracts"))) {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/["'](studio:[^"']+)["']/gu)) {
    const channel = match[1];
    const owner = channelOwners.get(channel);
    if (owner !== undefined) {
      errors.push(`duplicate bridge channel ${channel}: ${relative(root, owner)} and ${relative(root, file)}`);
    } else {
      channelOwners.set(channel, file);
    }
  }
}

const desktopMain = readFileSync(resolve(root, "src/desktop/main.ts"), "utf8");
if (/_CHANNEL/u.test(desktopMain)) {
  errors.push("src/desktop/main.ts imports or references an individual IPC channel");
}

if (errors.length !== 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("architecture boundaries: ok\n");
}
