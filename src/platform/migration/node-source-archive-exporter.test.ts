import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { exportNodeSourceArchive } from "./node-source-archive-exporter";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("node source archive exporter", () => {
  it("publishes exact source bytes and connector metadata without credential values", async () => {
    const operationRoot = await mkdtemp(
      join(tmpdir(), `eum-source-archive-${randomUUID()}-`),
    );
    cleanupRoots.push(operationRoot);
    const sourceRoot = join(operationRoot, "legacy-source");
    const archiveParent = join(operationRoot, "archives");
    await mkdir(join(sourceRoot, "data"), { recursive: true });
    await mkdir(archiveParent, { recursive: true });

    const liveBytes = Uint8Array.from([
      0xef, 0xbb, 0xbf, 0x7b, 0x22, 0x6b, 0x22, 0x3a, 0x31, 0x7d,
    ]);
    const backupBytes = new TextEncoder().encode(
      '{"backup":true}\r\n',
    );
    const credentialSecret = "never-copy-this-refresh-token";
    const livePath = join(sourceRoot, "data", "lorebooks.json");
    const backupPath = join(
      sourceRoot,
      "data",
      "lorebooks.json.bak",
    );
    const credentialPath = join(
      sourceRoot,
      "data",
      "spotify-auth.json",
    );
    await writeFile(livePath, liveBytes);
    await writeFile(backupPath, backupBytes);
    await writeFile(credentialPath, credentialSecret, "utf8");

    const liveChecksumBefore = sha256(await readFile(livePath));
    const backupChecksumBefore = sha256(await readFile(backupPath));
    const temporaryArchiveRootPath = join(
      archiveParent,
      "capture.staging",
    );
    const finalArchiveRootPath = join(
      archiveParent,
      "capture",
    );
    const report = await exportNodeSourceArchive({
      sourceProfileId: "legacy-eum-editor-test",
      format: {
        identity: "eum-source-archive",
        version: "1",
      },
      checksum: {
        identity: "sha256",
        algorithm: "sha256",
      },
      clock: { now: () => "2026-08-07T00:00:00.000Z" },
      captures: [
        {
          sourcePath: livePath,
          sourceLocator: "data/lorebooks.json",
          archiveEntrySegments: ["raw", "lorebooks.json"],
        },
        {
          sourcePath: backupPath,
          sourceLocator: "data/lorebooks.json.bak",
          archiveEntrySegments: ["raw", "lorebooks.json.bak"],
        },
      ],
      connectorProbes: [
        {
          sourcePath: credentialPath,
          connectorKind: "spotify",
          credentialKind: "oauth-token-envelope",
        },
        {
          sourcePath: join(sourceRoot, "data", "gmail-auth.json"),
          connectorKind: "gmail",
          credentialKind: "oauth-token-envelope",
        },
      ],
      manifestEntrySegments: ["manifest.json"],
      temporaryArchiveRootPath,
      finalArchiveRootPath,
    });

    expect(report.publication).toBe("published");
    expect(
      await readFile(join(finalArchiveRootPath, "raw", "lorebooks.json")),
    ).toEqual(Buffer.from(liveBytes));
    expect(
      await readFile(
        join(finalArchiveRootPath, "raw", "lorebooks.json.bak"),
      ),
    ).toEqual(Buffer.from(backupBytes));
    expect(sha256(await readFile(livePath))).toBe(liveChecksumBefore);
    expect(sha256(await readFile(backupPath))).toBe(backupChecksumBefore);
    expect(report.manifest.snapshots).toHaveLength(2);
    expect(report.manifest.connectorMetadata).toEqual([
      {
        connectorKind: "spotify",
        credentialKind: "oauth-token-envelope",
        present: true,
      },
      {
        connectorKind: "gmail",
        credentialKind: "oauth-token-envelope",
        present: false,
      },
    ]);
    const manifestText = await readFile(
      join(finalArchiveRootPath, "manifest.json"),
      "utf8",
    );
    expect(manifestText).not.toContain(credentialSecret);
    expect(manifestText).not.toContain(credentialPath);
    await expect(readFile(temporaryArchiveRootPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
