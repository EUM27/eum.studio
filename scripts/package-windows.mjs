import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, "out");
const packageDirectoryName =
  process.env.EUM_STUDIO_WINDOWS_PACKAGE_DIRECTORY_NAME?.trim() ||
  `eum-studio-candidate-${randomUUID()}`;
if (
  basename(packageDirectoryName) !== packageDirectoryName ||
  packageDirectoryName === "." ||
  packageDirectoryName === ".."
) {
  throw new Error("Windows package directory name must be one path segment");
}
const packageRoot = resolveInside(outputRoot, packageDirectoryName);
const stagingRoot = resolveInside(
  outputRoot,
  `.${packageDirectoryName}-staging-${randomUUID()}`,
);
const executableName = "이음 스튜디오.exe";

async function requireNewPackageTarget() {
  try {
    await lstat(packageRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Package target already exists; choose a new candidate directory: ${packageRoot}`);
}

await requireNewPackageTarget();

function resolveInside(root, targetRelativePath) {
  const target = resolve(root, targetRelativePath);
  const relation = relative(root, target);
  if (
    relation.length === 0 ||
    relation === ".." ||
    relation.startsWith("../") ||
    relation.startsWith("..\\") ||
    isAbsolute(relation)
  ) {
    throw new Error("Package path escapes or aliases its output root");
  }
  return target;
}

async function requireFile(path, label) {
  const details = await stat(path).catch(() => null);
  if (details === null || !details.isFile()) {
    throw new Error(`${label} is missing: ${path}`);
  }
}

async function requireDirectory(path, label) {
  const details = await stat(path).catch(() => null);
  if (details === null || !details.isDirectory()) {
    throw new Error(`${label} is missing: ${path}`);
  }
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function collectTree(root) {
  const files = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        const details = await stat(path);
        files.push({
          path: relative(root, path).replaceAll("\\", "/"),
          bytes: details.size,
        });
      } else {
        throw new Error(`Unsupported package entry: ${path}`);
      }
    }
  };
  await visit(root);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  });
}

async function listExternalDesktopRequires(root) {
  const external = new Set();
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const source = await readFile(path, "utf8");
        for (const match of source.matchAll(/require\((['"])([^'"]+)\1\)/gu)) {
          const specifier = match[2];
          if (
            specifier !== undefined &&
            !specifier.startsWith(".") &&
            !specifier.startsWith("/") &&
            !specifier.startsWith("node:")
          ) {
            external.add(specifier);
          }
        }
      }
    }
  };
  await visit(root);
  return [...external].sort();
}

const electronRuntimeSource = resolve(
  projectRoot,
  "node_modules/electron/dist",
);
const desktopBundleSource = resolve(projectRoot, "dist-electron");
const rendererBundleSource = resolve(projectRoot, "dist-renderer");
const configurationSource = resolve(projectRoot, "config");
const sourcePackagePath = resolve(projectRoot, "package.json");

await requireDirectory(electronRuntimeSource, "Electron runtime");
await requireDirectory(desktopBundleSource, "Desktop production bundle");
await requireDirectory(rendererBundleSource, "Renderer production bundle");
await requireDirectory(configurationSource, "Application configuration");
await requireFile(sourcePackagePath, "Application manifest");

const externalRequires = await listExternalDesktopRequires(desktopBundleSource);
if (JSON.stringify(externalRequires) !== JSON.stringify(["electron"])) {
  throw new Error(
    `Standalone package has unsupported runtime requires: ${externalRequires.join(", ")}`,
  );
}

const sourcePackage = JSON.parse(await readFile(sourcePackagePath, "utf8"));
const applicationManifest = Object.freeze({
  name: sourcePackage.name,
  productName: sourcePackage.productName,
  version: sourcePackage.version,
  private: true,
  main: sourcePackage.main,
});

await mkdir(outputRoot, { recursive: true });
await rm(stagingRoot, { recursive: true, force: true });

try {
  await cp(electronRuntimeSource, stagingRoot, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
  const applicationRoot = resolveInside(stagingRoot, "resources/app");
  await mkdir(applicationRoot, { recursive: true });
  await writeFile(
    resolveInside(applicationRoot, "package.json"),
    `${JSON.stringify(applicationManifest, null, 2)}\n`,
    "utf8",
  );
  await cp(
    desktopBundleSource,
    resolveInside(applicationRoot, "dist-electron"),
    { recursive: true, force: false, errorOnExist: true },
  );
  await cp(
    rendererBundleSource,
    resolveInside(applicationRoot, "dist-renderer"),
    { recursive: true, force: false, errorOnExist: true },
  );
  await cp(
    configurationSource,
    resolveInside(applicationRoot, "config"),
    { recursive: true, force: false, errorOnExist: true },
  );

  const electronExecutable = resolveInside(stagingRoot, "electron.exe");
  const standaloneExecutable = resolveInside(stagingRoot, executableName);
  await requireFile(electronExecutable, "Electron executable");
  await rename(electronExecutable, standaloneExecutable);

  const rendererIndex = resolveInside(
    applicationRoot,
    "dist-renderer/index.html",
  );
  const desktopMain = resolveInside(
    applicationRoot,
    "dist-electron/desktop/main.js",
  );
  const preloadMain = resolveInside(
    applicationRoot,
    "dist-electron/preload/index.js",
  );
  await Promise.all([
    requireFile(rendererIndex, "Packaged renderer"),
    requireFile(desktopMain, "Packaged desktop main"),
    requireFile(preloadMain, "Packaged preload"),
  ]);
  const tree = await collectTree(stagingRoot);
  const packageManifest = Object.freeze({
    schemaVersion: 1,
    productName: applicationManifest.productName,
    version: applicationManifest.version,
    executable: executableName,
    runtimeRequires: externalRequires,
    rendererProtocol: "file:",
    tree,
    sha256: Object.freeze({
      executable: await sha256(standaloneExecutable),
      desktopMain: await sha256(desktopMain),
      preloadMain: await sha256(preloadMain),
      rendererIndex: await sha256(rendererIndex),
    }),
  });
  await writeFile(
    resolveInside(stagingRoot, "package-manifest.json"),
    `${JSON.stringify(packageManifest, null, 2)}\n`,
    "utf8",
  );

  await requireNewPackageTarget();
  await rename(stagingRoot, packageRoot);

  process.stdout.write(`${JSON.stringify({
    packageRoot,
    executablePath: join(packageRoot, executableName),
    manifestPath: join(packageRoot, "package-manifest.json"),
    ...packageManifest,
  }, null, 2)}\n`);
} catch (error) {
  await rm(stagingRoot, { recursive: true, force: true });
  throw error;
}
