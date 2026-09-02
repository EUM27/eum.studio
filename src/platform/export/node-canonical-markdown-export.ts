import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

import type { PreparedCanonicalMarkdownExport } from "../../application/export/canonical-markdown-export";

export type NodeCanonicalMarkdownExportReceipt = Readonly<{
  finalDirectoryPath: string;
  directoryName: string;
  fileCount: number;
  byteLength: number;
  sourceManifestHash: string;
  bundleManifestHash: string;
}>;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

function validateDirectoryName(value: string): void {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    path.basename(value) !== value ||
    path.win32.basename(value) !== value
  ) {
    throw new Error("Canonical Markdown export directory name must be one safe segment");
  }
}

function relativeMarkdownSegments(relativePath: string): readonly string[] {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    !relativePath.endsWith(".md")
  ) {
    throw new Error("Canonical export file must use a safe relative Markdown path");
  }
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("Canonical export file must use a safe relative Markdown path");
  }
  return segments;
}

function validateBundle(bundle: PreparedCanonicalMarkdownExport): void {
  if (
    bundle.schemaVersion !== 1 ||
    bundle.direction !== "canonical-to-markdown" ||
    bundle.importSupported !== false
  ) {
    throw new Error("Canonical Markdown bundle must remain one-way export data");
  }
  validateDirectoryName(bundle.suggestedDirectoryName);
  const seen = new Set<string>();
  for (const file of bundle.files) {
    relativeMarkdownSegments(file.relativePath);
    if (seen.has(file.relativePath)) {
      throw new Error(`Canonical Markdown bundle contains duplicate path: ${file.relativePath}`);
    }
    seen.add(file.relativePath);
    const bytes = Buffer.from(file.content, "utf8");
    if (bytes.byteLength !== file.byteLength || sha256(bytes) !== file.sha256) {
      throw new Error(`Canonical Markdown bundle bytes do not match manifest: ${file.relativePath}`);
    }
  }
  const manifestHash = sha256(JSON.stringify(bundle.files.map((file) => ({
    relativePath: file.relativePath,
    byteLength: file.byteLength,
    sha256: file.sha256,
  }))));
  if (manifestHash !== bundle.bundleManifestHash) {
    throw new Error("Canonical Markdown bundle manifest hash does not match files");
  }
}

async function publishFile(finalPath: string, content: string, expectedSha256: string): Promise<number> {
  const bytes = Buffer.from(content, "utf8");
  const handle = await open(finalPath, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  const published = await readFile(finalPath);
  if (sha256(published) !== expectedSha256 || !published.equals(bytes)) {
    throw new Error("Published canonical Markdown does not match approved bytes");
  }
  return published.byteLength;
}

async function existingDirectory(pathValue: string): Promise<boolean> {
  try {
    return (await stat(pathValue)).isDirectory();
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}

export async function exportNodeCanonicalMarkdownBundle(input: Readonly<{
  baseDirectoryPath: string;
  bundle: PreparedCanonicalMarkdownExport;
}>): Promise<NodeCanonicalMarkdownExportReceipt> {
  if (!path.isAbsolute(input.baseDirectoryPath)) {
    throw new Error("Canonical Markdown export base path must be absolute");
  }
  const baseStatus = await stat(input.baseDirectoryPath);
  if (!baseStatus.isDirectory()) {
    throw new Error("Canonical Markdown export base path must be a directory");
  }
  validateBundle(input.bundle);
  const stagingPath = await mkdtemp(path.join(input.baseDirectoryPath, ".eum-export-stage-"));
  let published = false;
  try {
    let byteLength = 0;
    for (const file of input.bundle.files) {
      const segments = relativeMarkdownSegments(file.relativePath);
      const finalPath = path.join(stagingPath, ...segments);
      const resolved = path.resolve(finalPath);
      const stagingPrefix = `${path.resolve(stagingPath)}${path.sep}`;
      if (!resolved.startsWith(stagingPrefix)) {
        throw new Error("Canonical Markdown export path escaped its staging directory");
      }
      await mkdir(path.dirname(finalPath), { recursive: true });
      byteLength += await publishFile(finalPath, file.content, file.sha256);
    }

    let suffix = 1;
    let directoryName = input.bundle.suggestedDirectoryName;
    let finalDirectoryPath = path.join(input.baseDirectoryPath, directoryName);
    while (await existingDirectory(finalDirectoryPath)) {
      suffix += 1;
      directoryName = `${input.bundle.suggestedDirectoryName}-${suffix}`;
      finalDirectoryPath = path.join(input.baseDirectoryPath, directoryName);
    }
    await rename(stagingPath, finalDirectoryPath);
    published = true;
    return Object.freeze({
      finalDirectoryPath,
      directoryName,
      fileCount: input.bundle.files.length,
      byteLength,
      sourceManifestHash: input.bundle.sourceManifestHash,
      bundleManifestHash: input.bundle.bundleManifestHash,
    });
  } finally {
    if (!published) {
      await rm(stagingPath, { recursive: true, force: true });
    }
  }
}
