import { describe, expect, it, vi } from "vitest";

import { CANON_MARKDOWN_EXPORT_CHANNEL } from "../../application/contracts/bridge/canon-bridge";
import { registerCanonIpc } from "./register-canon-ipc";

describe("registerCanonIpc", () => {
  it("authorizes and routes the strict one-way Markdown export command", async () => {
    const handlers = new Map<string, (event: unknown, value: unknown) => unknown>();
    const authorizeSender = vi.fn();
    const exportMarkdown = vi.fn(async () => ({
      schemaVersion: 1 as const,
      status: "cancelled" as const,
    }));
    registerCanonIpc({
      ipcMain: {
        handle: (channel: string, handler: unknown) => handlers.set(channel, handler as never),
      } as never,
      authorizeSender,
      runtime: {
        runCanonReview: vi.fn(),
        listCanonReviewCandidates: vi.fn(),
        updateCanonReviewItem: vi.fn(),
        resolveCanonReviewItemTarget: vi.fn(),
        decideCanonReviewItem: vi.fn(),
      },
      exportMarkdown,
    });

    const event = {};
    await expect(handlers.get(CANON_MARKDOWN_EXPORT_CHANNEL)!(event, {
      schemaVersion: 1,
      workId: "work-1",
    })).resolves.toEqual({ schemaVersion: 1, status: "cancelled" });
    expect(authorizeSender).toHaveBeenCalledWith(event);
    expect(exportMarkdown).toHaveBeenCalledWith({ schemaVersion: 1, workId: "work-1" });
    expect(() => handlers.get(CANON_MARKDOWN_EXPORT_CHANNEL)!({}, {
      schemaVersion: 1,
      workId: "work-1",
      importPath: "vault",
    })).toThrow(/fields/u);
  });
});
