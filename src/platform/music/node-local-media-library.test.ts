import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { localMediaPlaybackUrl } from "../../application/music/media-track";
import { openNodeLocalMediaLibrary } from "./node-local-media-library";
import * as descriptors from "./node-local-media-descriptor";

describe("Node local media library", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ));
  });

  it.each(["external-reference", "managed-copy"] as const)("blocks changed %s bytes after an earlier successful playback", async (storageMode) => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-local-media-changed-"));
    temporaryDirectories.push(directory);
    const selected = path.join(directory, `${randomUUID()}.mp3`);
    await writeFile(selected, Buffer.from([0x49, 0x44, 0x33, 0x03]));
    const library = await openNodeLocalMediaLibrary({ rootDirectoryPath: path.join(directory, "library"), checksum: { identity: "sha256", algorithm: "sha256" } });
    const [track] = await library.register({ workId: randomUUID(), storageMode, filePaths: [selected] });
    const url = localMediaPlaybackUrl(track!);
    const source = await library.resolvePlaybackUrl(url);
    const previous = await stat(source.filePath);
    await writeFile(source.filePath, Buffer.from([0x49, 0x44, 0x33, 0x09]));
    await utimes(source.filePath, previous.atime, previous.mtime);
    await expect(library.resolvePlaybackUrl(url)).rejects.toThrow("변경");
    expect(await library.inspect({ schemaVersion: 1, workId: track!.workId, mediaIds: [track!.mediaId] })).toMatchObject({ entries: [{ status: "changed" }] });
  });

  it("reuses successful verification for concurrent range requests to an unchanged file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-local-media-verified-"));
    temporaryDirectories.push(directory);
    const selected = path.join(directory, `${randomUUID()}.mp3`);
    await writeFile(selected, Buffer.from([0x49, 0x44, 0x33, 0x03]));
    const library = await openNodeLocalMediaLibrary({ rootDirectoryPath: path.join(directory, "library"), checksum: { identity: "sha256", algorithm: "sha256" } });
    const [track] = await library.register({ workId: randomUUID(), storageMode: "external-reference", filePaths: [selected] });
    const checksum = vi.spyOn(descriptors, "checksumLocalMediaFile");
    const url = localMediaPlaybackUrl(track!);
    const sources = await Promise.all([library.resolvePlaybackUrl(url), library.resolvePlaybackUrl(url)]);
    expect(sources.every((source) => source.filePath === selected)).toBe(true);
    await library.resolvePlaybackUrl(url);
    expect(checksum).toHaveBeenCalledTimes(1);
  });

  it("restores external references and managed copies without projecting paths", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-local-media-"));
    temporaryDirectories.push(directory);
    const sourceDirectory = path.join(directory, "sources");
    const rootDirectoryPath = path.join(directory, "library");
    await mkdir(sourceDirectory, { recursive: true });
    const mp3Path = path.join(sourceDirectory, "rain.mp3");
    const mp4Path = path.join(sourceDirectory, "scene.mp4");
    await writeFile(mp3Path, Buffer.from([0x49, 0x44, 0x33, 0x03]));
    await writeFile(mp4Path, Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74]));
    const ids = ["external-media", "managed-media"];
    const checksum = { identity: "test-sha256", algorithm: "sha256" } as const;
    const library = await openNodeLocalMediaLibrary({
      rootDirectoryPath,
      checksum,
      createId: () => ids.shift()!,
    });

    const [external] = await library.register({
      workId: "work-a",
      storageMode: "external-reference",
      filePaths: [mp3Path],
    });
    const [managed] = await library.register({
      workId: "work-a",
      storageMode: "managed-copy",
      filePaths: [mp4Path],
    });

    expect(external).toMatchObject({
      fileName: "rain.mp3",
      mediaKind: "audio",
      mediaType: "audio/mpeg",
      storageMode: "external-reference",
    });
    expect(managed).toMatchObject({
      fileName: "scene.mp4",
      mediaKind: "video",
      mediaType: "video/mp4",
      storageMode: "managed-copy",
    });
    expect(JSON.stringify([external, managed])).not.toContain(sourceDirectory);

    const reopened = await openNodeLocalMediaLibrary({
      rootDirectoryPath,
      checksum,
    });
    expect(await reopened.inspect({
      schemaVersion: 1,
      workId: external!.workId,
      mediaIds: [external!.mediaId, managed!.mediaId],
    })).toMatchObject({
      entries: [
        { mediaId: external!.mediaId, status: "available" },
        { mediaId: managed!.mediaId, status: "available" },
      ],
    });
    const externalSource = await reopened.resolvePlaybackUrl(
      localMediaPlaybackUrl(external!),
    );
    const managedSource = await reopened.resolvePlaybackUrl(
      localMediaPlaybackUrl(managed!),
    );
    expect(externalSource.filePath).toBe(mp3Path);
    expect(managedSource.filePath).not.toBe(mp4Path);
    expect(await readFile(managedSource.filePath)).toEqual(await readFile(mp4Path));
    expect(managedSource.filePath.startsWith(rootDirectoryPath)).toBe(true);

    const relocatedPath = path.join(sourceDirectory, "relocated-rain.mp3");
    await writeFile(relocatedPath, await readFile(mp3Path));
    await rm(mp3Path);
    expect(await reopened.inspect({
      schemaVersion: 1,
      workId: external!.workId,
      mediaIds: [external!.mediaId],
    })).toMatchObject({
      entries: [{ status: "disconnected" }],
    });
    const wrongPath = path.join(sourceDirectory, "wrong.mp3");
    await writeFile(wrongPath, Buffer.from([0x49, 0x44, 0x33, 0x09]));
    await expect(reopened.relink({
      schemaVersion: 1,
      workId: external!.workId,
      mediaId: external!.mediaId,
      filePath: wrongPath,
    })).rejects.toThrow("등록된 원본과 일치하지 않습니다");
    expect(await reopened.relink({
      schemaVersion: 1,
      workId: external!.workId,
      mediaId: external!.mediaId,
      filePath: relocatedPath,
    })).toMatchObject({ status: "available" });
    expect((await reopened.resolvePlaybackUrl(
      localMediaPlaybackUrl(external!),
    )).filePath).toBe(relocatedPath);
  });
});
