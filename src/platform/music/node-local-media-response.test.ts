import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createNodeLocalMediaResponse } from "./node-local-media-response";

describe("Node local media response", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ));
  });

  it("streams an exact byte range with media response headers", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-media-response-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "track.mp3");
    const bytes = Buffer.from(Array.from({ length: 256 }, (_value, index) => index));
    await writeFile(filePath, bytes);

    const response = await createNodeLocalMediaResponse({
      filePath,
      mediaType: "audio/mpeg",
      method: "GET",
      rangeHeader: "bytes=32-95",
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 32-95/256");
    expect(response.headers.get("content-length")).toBe("64");
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes.subarray(32, 96));
  });

  it("streams the complete file when no byte range is requested", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-media-response-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "track.mp4");
    const bytes = Buffer.from([1, 2, 3, 4]);
    await writeFile(filePath, bytes);

    const response = await createNodeLocalMediaResponse({
      filePath,
      mediaType: "video/mp4",
      method: "GET",
      rangeHeader: null,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("4");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
});
