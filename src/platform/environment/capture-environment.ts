import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { createEnvironmentManifest } from "../../application/measurement/environment-manifest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type LockManifest = {
  packages?: Record<string, { version?: string }>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

const projectRoot = process.cwd();
const packageManifest = readJson<PackageManifest>(
  path.join(projectRoot, "package.json"),
);
const lockManifest = readJson<LockManifest>(
  path.join(projectRoot, "package-lock.json"),
);
const dependencyNames = new Set([
  ...Object.keys(packageManifest.dependencies ?? {}),
  ...Object.keys(packageManifest.devDependencies ?? {}),
]);
const packages = [...dependencyNames].map((name) => {
  const installed = lockManifest.packages?.[`node_modules/${name}`]?.version;
  if (installed === undefined) {
    throw new Error(`Installed package version is unavailable: ${name}`);
  }
  return { name, version: installed };
});
const manifest = createEnvironmentManifest({
  capturedAt: new Date().toISOString(),
  platform: process.platform,
  architecture: process.arch,
  osRelease: os.release(),
  nodeVersion: process.version,
  packages,
});
const outputFlagIndex = process.argv.indexOf("--output");

if (outputFlagIndex === -1) {
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} else {
  const requestedOutput = process.argv[outputFlagIndex + 1];
  if (requestedOutput === undefined || requestedOutput.startsWith("--")) {
    throw new Error("--output requires a file path");
  }
  const outputPath = path.resolve(projectRoot, requestedOutput);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
}
