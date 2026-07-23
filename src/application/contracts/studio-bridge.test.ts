import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
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

  it("wraps the allowlisted manuscript input profile query", async () => {
    const inputProfile = {
      schemaVersion: 1,
      autoClosePairs: [
        {
          open: randomUUID(),
          close: randomUUID(),
        },
      ],
      textReplacements: [
        {
          trigger: randomUUID(),
          replacement: randomUUID(),
        },
      ],
    } as const;
    const invoke = vi.fn().mockResolvedValue(inputProfile);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.editor.getManuscriptInputProfile()).resolves.toEqual(
      inputProfile,
    );
    expect(invoke).toHaveBeenCalledWith(MANUSCRIPT_INPUT_PROFILE_CHANNEL);
  });

  it("wraps the allowlisted manuscript document profile query", async () => {
    const document = {
      workId: randomUUID(),
      documentId: randomUUID(),
      documentRevisionId: randomUUID(),
      label: randomUUID(),
      initialText: randomUUID(),
    };
    const documentProfile = {
      schemaVersion: 1,
      initialDocumentId: document.documentId,
      documents: [document],
    };
    const invoke = vi.fn().mockResolvedValue(documentProfile);
    const bridge = createStudioBridge(invoke);
    const readDocumentProfile = Reflect.get(
      bridge.editor,
      "getManuscriptDocumentProfile",
    );

    expect(readDocumentProfile).toBeTypeOf("function");
    if (typeof readDocumentProfile !== "function") {
      return;
    }
    await expect(readDocumentProfile()).resolves.toEqual(documentProfile);
    expect(invoke).toHaveBeenCalledWith(
      "studio:editor:get-manuscript-document-profile",
    );
  });

  it("rejects a malformed manuscript input profile response", async () => {
    const bridge = createStudioBridge(async () => ({ schemaVersion: 1 }));

    await expect(bridge.editor.getManuscriptInputProfile()).rejects.toThrow(
      "Invalid manuscript input profile",
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
