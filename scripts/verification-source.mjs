import { execFileSync, spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readFileSync, readdirSync, watch } from "node:fs";
import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { captureGitSourceProvenance } from "../tests/evidence/git-source-provenance.ts";

// These are bookkeeping or generated data, not source inputs. Retained recovery
// scripts and documentation are deliberately included in the code fingerprint.
export const codeFingerprintExclusions = [
  "docs/goals/", "**/.goalbuddy-board/", "artifacts/", "node_modules/",
  "dist/", "dist-electron/", "dist-renderer/", "dist-tests/", "out/",
  "coverage/", "test-results/", "test-results-*/", "playwright-report/", ".tmp/",
  "recovery/** except *.ps1, *.mjs, *.cjs, *.js, *.ts, *.md and recovery/.gitignore",
];

function excludedTree(path) {
  if (path.split("/").includes(".goalbuddy-board")) return true;
  return /^(?:\.git|docs\/goals|artifacts|node_modules|dist(?:-electron|-renderer|-tests)?|out|coverage|test-results(?:-[^/]+)?|playwright-report|\.tmp)(?:\/|$)/u.test(path);
}

function included(path) {
  if (path.split("/").includes(".goalbuddy-board") || excludedTree(path)) return false;
  return !path.startsWith("recovery/") || path === "recovery/.gitignore" || /\.(?:ps1|mjs|cjs|js|ts|md)$/iu.test(path);
}

export function repositoryPath(root, path) {
  const target = resolve(root, path);
  const relation = relative(resolve(root), target);
  if (!relation || relation === ".." || relation.startsWith(`..\\`) || relation.startsWith("../") || isAbsolute(relation)) {
    throw new Error("Verification path escapes or aliases the repository root");
  }
  return target;
}

async function gitFileList(cwd) {
  const child = spawn("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  let errorText = "";
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.on("data", (chunk) => { errorText += chunk.toString("utf8"); });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Git file inventory failed (${code}): ${errorText.trim()}`)));
  });
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw !== "" && !raw.endsWith("\0")) throw new Error("Git file inventory was not NUL terminated");
  return [...new Set(raw.split("\0").filter(Boolean))].sort();
}

export async function fileChecksum(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function sameFileIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino;
}

function sameFileVersion(before, after) {
  return before.size === after.size && before.mtimeNs === after.mtimeNs && sameFileIdentity(before, after);
}

function currentFileVersion(path) {
  try { return lstatSync(path, { bigint: true }); }
  catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error; }
}

export function watchVerificationCode(cwd, source, { watchDirectory = watch } = {}) {
  const initial = new Map(source.codeFingerprint.entries.map((entry) => [entry.path, {
    metadata: currentFileVersion(repositoryPath(cwd, entry.path)), sha256: entry.sha256,
  }]));
  const knownDirectories = new Set();
  for (const path of initial.keys()) {
    let separator = path.lastIndexOf("/");
    while (separator !== -1) {
      const directory = path.slice(0, separator);
      knownDirectories.add(directory);
      separator = path.lastIndexOf("/", separator - 1);
    }
  }
  const topDirectories = new Set([...knownDirectories].map((path) => path.split("/")[0]));
  const directories = new Map();
  const watchers = new Map();
  const changed = new Set();
  const ignoredMetadata = new Set();
  const pathlessScopes = new Set();
  let pathlessEventCount = 0;
  let fullRescanCount = 0;
  let inventoryPending = false;
  let failure = null;
  const absolute = (path) => path === "" ? resolve(cwd) : repositoryPath(cwd, path);

  function ignoredByGit(path) {
    if (initial.has(path) || knownDirectories.has(path)) return false;
    try {
      execFileSync("git", ["check-ignore", "--quiet", "--", path], { cwd, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      return true;
    } catch (error) { if (error.status === 1) return false; throw error; }
  }

  function inspectFile(path, event = "change") {
    if (changed.has(path)) return;
    try {
      const target = absolute(path);
      const baseline = initial.get(path);
      const before = currentFileVersion(target);
      if (event !== "rename" && baseline?.metadata === null && baseline.sha256 === undefined && before === null) return;
      // A rename, replacement, deletion or write timestamp remains evidence of
      // a transient edit even when the final bytes have already been reverted.
      if (event === "rename" || baseline?.metadata == null || before === null || !before.isFile() || !sameFileVersion(baseline.metadata, before)) {
        changed.add(path);
        return;
      }
      // NTFS also emits change for reads/access-time or attribute updates.
      // ctime changes with those metadata operations, so it is not a write test.
      const sha256 = createHash("sha256").update(readFileSync(target)).digest("hex");
      const after = currentFileVersion(target);
      if (after === null || !after.isFile() || !sameFileVersion(before, after) || sha256 !== baseline.sha256) changed.add(path);
      else ignoredMetadata.add(path);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") changed.add(path);
      else failure = `Cannot inspect a source watch event for ${path}: ${error.message}`;
    }
  }

  function onEvent(directory, event, filename) {
    if (filename == null || filename.length === 0) {
      pathlessEventCount += 1;
      pathlessScopes.add(directory);
      inventoryPending = true;
      return;
    }
    const name = filename.toString().replaceAll("\\", "/");
    const path = directory === "" ? name : `${directory}/${name}`;
    try {
      if (excludedTree(path) || path.split("/").includes(".goalbuddy-board") || ignoredByGit(path)) return;
      const current = currentFileVersion(absolute(path));
      if (current?.isDirectory()) {
        const baseline = directories.get(path);
        if (baseline && (event === "rename" || !sameFileIdentity(baseline, current))) changed.add(path);
        else if (event === "rename" && topDirectories.has(path.split("/")[0])) changed.add(path);
        else ignoredMetadata.add(path);
        if (!baseline || event === "rename") {
          addDirectory(path, true);
          inventoryPending = true;
        }
      } else if (directories.has(path)) {
        changed.add(path);
      } else if (included(path)) inspectFile(path, event);
    } catch (error) { failure = `Cannot inspect source directory event: ${error.message}`; }
  }

  function addDirectory(directory, descendants) {
    if (directory !== "" && (excludedTree(directory) || directory.split("/").includes(".goalbuddy-board") || ignoredByGit(directory))) return;
    const current = currentFileVersion(absolute(directory));
    if (current === null || !current.isDirectory()) return;
    if (!directories.has(directory)) directories.set(directory, current);
    const coveredBySubtree = [...watchers].some(([parent, subscription]) => subscription.recursive && (directory === parent || directory.startsWith(`${parent}/`)));
    if (!watchers.has(directory) && !coveredBySubtree) {
      // Separate handles for every nested directory prevent ancestor renames on
      // Windows. One handle per source subtree preserves normal rename behavior.
      const recursive = directory !== "";
      const watcher = watchDirectory(absolute(directory), { recursive }, (event, filename) => onEvent(directory, event, filename));
      watcher.on("error", (error) => {
        if (currentFileVersion(absolute(directory)) === null) changed.add(directory || ".");
        else failure = error.message;
      });
      watchers.set(directory, { watcher, recursive });
    }
    if (descendants) {
      for (const entry of readdirSync(absolute(directory), { withFileTypes: true })) {
        if (entry.isDirectory()) addDirectory(directory === "" ? entry.name : `${directory}/${entry.name}`, true);
      }
    }
  }

  async function rescan() {
    while (inventoryPending || pathlessScopes.size > 0) {
      const scopes = [...pathlessScopes];
      pathlessScopes.clear();
      inventoryPending = false;
      fullRescanCount += 1;
      // Missing filenames require evidence reconstruction, not discarded events.
      if (scopes.length > 0) {
        for (const path of initial.keys()) inspectFile(path);
        for (const [path, baseline] of directories) {
          const current = currentFileVersion(absolute(path));
          if (current === null || !current.isDirectory() || !sameFileIdentity(baseline, current) || baseline.mtimeNs !== current.mtimeNs) changed.add(path || ".");
        }
      }
      const inventory = new Set((await gitFileList(cwd)).filter(included));
      for (const path of new Set([...initial.keys(), ...inventory])) {
        if (!initial.has(path) || !inventory.has(path)) changed.add(path);
      }
      for (const path of inventory) {
        const separator = path.lastIndexOf("/");
        if (separator !== -1) addDirectory(path.slice(0, separator), false);
      }
    }
  }

  // The shallow repository-parent watch observes top-level renames. Recursive
  // watches are limited to source subtrees, excluding generated top-level trees.
  try {
    addDirectory("", false);
    for (const directory of topDirectories) addDirectory(directory, true);
  } catch (error) {
    for (const { watcher } of watchers.values()) watcher.close();
    throw error;
  }
  return {
    close: () => { for (const { watcher } of watchers.values()) watcher.close(); },
    read: async () => {
      try { await rescan(); } catch (error) { failure = `Source inventory rescan failed: ${error.message}`; }
      return { changedPaths: [...changed].sort(), ignoredMetadataPaths: [...ignoredMetadata].filter((path) => !changed.has(path)).sort(),
        watchMode: "source-subtrees-with-shallow-parent-watch", watchedDirectories: [...watchers.keys()].map((path) => path || ".").sort(),
        subscriptions: [...watchers].map(([path, subscription]) => ({ path: path || ".", recursive: subscription.recursive })), pathlessEventCount, fullRescanCount, error: failure };
    },
  };
}

export async function captureVerificationSource(cwd) {
  const entries = [];
  for (const path of await gitFileList(cwd)) {
    if (!included(path)) continue;
    const target = repositoryPath(cwd, path);
    const before = await lstat(target, { bigint: true }).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (before === null) { entries.push({ path, missing: true }); continue; }
    if (!before.isFile()) throw new Error(`Verification source entry must be a regular file: ${path}`);
    const sha256 = await fileChecksum(target);
    const after = await lstat(target, { bigint: true });
    if (!after.isFile() || !sameFileVersion(before, after)) {
      throw new Error(`Source changed while hashing: ${path}`);
    }
    entries.push({ path, bytes: Number(after.size), sha256 });
  }
  const provenance = await captureGitSourceProvenance({ cwd, checksumAlgorithm: "sha256" });
  return {
    capturedAt: new Date().toISOString(),
    provenance,
    codeFingerprint: {
      schemaVersion: 1, algorithm: "sha256", scope: "current Git tracked and nonignored untracked file contents, excluding declared bookkeeping and generated data",
      exclusions: codeFingerprintExclusions,
      fileCount: entries.length,
      sha256: createHash("sha256").update(JSON.stringify(entries)).digest("hex"),
      entries,
    },
  };
}
