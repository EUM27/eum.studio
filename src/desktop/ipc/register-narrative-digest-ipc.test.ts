import { describe,expect,it,vi } from "vitest";

import { NARRATIVE_DIGEST_GENERATE_CHANNEL } from "../../application/contracts/bridge/narrative-digest-bridge";
import { registerNarrativeDigestIpc } from "./register-narrative-digest-ipc";

describe("registerNarrativeDigestIpc", () => {
  it("authorizes the sender and parses explicit generate commands", async () => {
    const handlers = new Map<string,(event: unknown,value: unknown) => unknown>();
    const authorizeSender = vi.fn();
    const runtime = {
      generateNarrativeDigest: vi.fn(async () => ({ schemaVersion: 1,status: "login-required" })),
      listNarrativeDigests: vi.fn(),regenerateNarrativeDigest: vi.fn(),
    };
    registerNarrativeDigestIpc({
      ipcMain: { handle: (channel: string,handler: unknown) => handlers.set(channel,handler as never) } as never,
      authorizeSender,runtime: runtime as never,
    });
    const event = {};
    await handlers.get(NARRATIVE_DIGEST_GENERATE_CHANNEL)!(event,{
      schemaVersion: 1,requestId: "request-1",workId: "work-1",conversationId: "conversation-1",
      scope: { kind: "work" },documentIds: ["document-1"],
    });
    expect(authorizeSender).toHaveBeenCalledWith(event);
    expect(runtime.generateNarrativeDigest).toHaveBeenCalledWith(expect.objectContaining({ documentIds: ["document-1"] }));
    expect(() => handlers.get(NARRATIVE_DIGEST_GENERATE_CHANNEL)!({}, {
      schemaVersion: 1,requestId: "request-1",workId: "work-1",conversationId: "conversation-1",
      scope: { kind: "work" },documentIds: [],
    })).toThrow(/non-empty explicit array/u);
  });
});
