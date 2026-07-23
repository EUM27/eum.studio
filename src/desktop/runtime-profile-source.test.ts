import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { readRuntimeProfileValue } from "./runtime-profile-source";

describe("readRuntimeProfileValue", () => {
  it("reads either inline JSON or a caller-selected file without fallback", () => {
    const inline = { [randomUUID()]: randomUUID() };
    const fileValue = { [randomUUID()]: randomUUID() };
    const filePath = randomUUID();
    const readTextFile = vi.fn((receivedPath: string) => {
      expect(receivedPath).toBe(filePath);
      return JSON.stringify(fileValue);
    });

    expect(
      readRuntimeProfileValue({
        inlineJson: JSON.stringify(inline),
        filePath: undefined,
        readTextFile,
      }),
    ).toEqual(inline);
    expect(
      readRuntimeProfileValue({
        inlineJson: undefined,
        filePath,
        readTextFile,
      }),
    ).toEqual(fileValue);
    expect(readTextFile).toHaveBeenCalledOnce();
  });

  it("rejects ambiguous sources and exposes an explicit missing state", () => {
    expect(() =>
      readRuntimeProfileValue({
        inlineJson: JSON.stringify({}),
        filePath: randomUUID(),
        readTextFile: vi.fn(),
      }),
    ).toThrow(/both/i);
    expect(
      readRuntimeProfileValue({
        inlineJson: undefined,
        filePath: undefined,
        readTextFile: vi.fn(),
      }),
    ).toBeNull();
  });
});
