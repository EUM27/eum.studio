import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

import { exportNodeManuscriptText } from "./node-manuscript-text-export";

it("writes and verifies the exact approved UTF-8 manuscript text", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-text-export-"),
  );
  const finalPath = path.join(directory, `${randomUUID()}.txt`);
  const text = `${randomUUID()} 한글 원고\r\n둘째 줄`;
  try {
    const receipt = await exportNodeManuscriptText({ finalPath, text });

    expect(receipt).toEqual({
      finalPath,
      byteLength: Buffer.byteLength(text, "utf8"),
    });
    expect(await readFile(finalPath, "utf8")).toBe(text);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
