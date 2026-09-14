import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { exportNodeManuscriptText } from "./node-manuscript-text-export";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, open: vi.fn(actual.open), rename: vi.fn(actual.rename), readFile: vi.fn(actual.readFile) };
});

afterEach(() => vi.restoreAllMocks());

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

it.each(["write", "sync", "readback", "replace"] as const)(
  "preserves an existing TXT byte for byte when %s fails",
  async (stage) => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-text-preserve-"));
    const finalPath = path.join(directory, `${randomUUID()}.txt`);
    const original = Buffer.from(`${randomUUID()} 기존 원고\r\n`, "utf8");
    const failure = Object.assign(new Error(stage), { code: "ENOSPC" });
    await writeFile(finalPath, original);
    try {
      if (stage === "write" || stage === "sync") {
        const actual = await vi.importActual<typeof fs>("node:fs/promises");
        vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
          const handle = await actual.open(...args);
          vi.spyOn(handle, stage === "write" ? "writeFile" : "sync")
            .mockRejectedValueOnce(failure);
          return handle;
        });
      } else if (stage === "readback") {
        vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from(randomUUID()));
      } else {
        vi.mocked(fs.rename).mockRejectedValueOnce(failure);
      }
      await expect(exportNodeManuscriptText({ finalPath, text: randomUUID() })).rejects.toThrow();
      expect(await readFile(finalPath)).toEqual(original);
      expect(await readdir(directory)).toEqual([path.basename(finalPath)]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it("replaces an existing file only with exact verified UTF-8 bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-text-replace-"));
  const finalPath = path.join(directory, `${randomUUID()}.txt`);
  const text = `${randomUUID()} 한글\r\n\u0000마지막`;
  try {
    await writeFile(finalPath, randomUUID());
    await exportNodeManuscriptText({ finalPath, text });
    expect(await readFile(finalPath)).toEqual(Buffer.from(text, "utf8"));
    expect(await readdir(directory)).toEqual([path.basename(finalPath)]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.runIf(process.platform === "win32")("preserves TXT when another Windows process denies delete sharing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-text-lock-"));
  const finalPath = path.join(directory, `${randomUUID()}.txt`);
  const original = Buffer.from(randomUUID());
  await writeFile(finalPath, original);
  const holder = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "$h = [IO.File]::Open($env:EUM_EXPORT_LOCK_FILE, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); try { [Console]::Out.WriteLine('locked'); [Console]::Out.Flush(); [Console]::In.ReadLine() | Out-Null } finally { $h.Dispose() }",
  ], { windowsHide: true, env: { ...process.env, EUM_EXPORT_LOCK_FILE: finalPath }, stdio: "pipe" });
  try {
    const [ready] = await once(holder.stdout, "data");
    expect(String(ready).trim()).toBe("locked");
    await expect(exportNodeManuscriptText({ finalPath, text: randomUUID() })).rejects.toThrow();
    expect(await readFile(finalPath)).toEqual(original);
    expect(await readdir(directory)).toEqual([path.basename(finalPath)]);
  } finally {
    holder.stdin.end("release\n");
    await once(holder, "exit");
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
