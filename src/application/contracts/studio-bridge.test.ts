import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  RUNTIME_INFO_CHANNEL,
  createStudioBridge,
  isRuntimeInfo,
} from "./studio-bridge";

describe("studio bridge contract", () => {
  it("wraps the allowlisted runtime query without exposing a generic sender", async () => {
    const runtimeInfo = {
      appName: randomUUID(),
      appVersion: randomUUID(),
      platform: randomUUID(),
      architecture: randomUUID(),
    };
    const invoke = vi.fn().mockResolvedValue(runtimeInfo);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.system.getRuntimeInfo()).resolves.toEqual(runtimeInfo);
    expect(invoke).toHaveBeenCalledWith(RUNTIME_INFO_CHANNEL);
    expect("send" in bridge).toBe(false);
    expect("invoke" in bridge).toBe(false);
  });

  it("rejects malformed main-process responses", async () => {
    const bridge = createStudioBridge(async () => ({ appName: randomUUID() }));

    await expect(bridge.system.getRuntimeInfo()).rejects.toThrow(
      "Invalid runtime information",
    );
  });

  it("accepts only complete string-valued runtime information", () => {
    expect(
      isRuntimeInfo({
        appName: randomUUID(),
        appVersion: randomUUID(),
        platform: randomUUID(),
        architecture: randomUUID(),
      }),
    ).toBe(true);
    expect(isRuntimeInfo(null)).toBe(false);
    expect(isRuntimeInfo({})).toBe(false);
  });
});
