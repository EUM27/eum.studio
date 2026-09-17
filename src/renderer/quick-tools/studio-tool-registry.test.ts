import { describe, expect, it, vi } from "vitest";
import { StudioToolRegistry, type StudioTool } from "./studio-tool-registry";

function command(run: () => void): StudioTool {
  return { id: "open-fragments", label: "파편 서랍", detail: "남겨 둔 문장", group: "집필", run };
}

describe("StudioToolRegistry", () => {
  it("uses the latest callback without notifying the shell about callback-only changes", () => {
    const registry = new StudioToolRegistry();
    const before = vi.fn();
    const after = vi.fn();
    const notified = vi.fn();
    registry.subscribe(notified);
    registry.publish("workspace", [command(before)]);
    const snapshot = registry.getSnapshot();
    registry.publish("workspace", [command(after)]);
    expect(registry.getSnapshot()).toBe(snapshot);
    expect(notified).toHaveBeenCalledTimes(1);
    expect(registry.run("open-fragments")).toBe(true);
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledOnce();
  });

  it("rejects a command disabled after it was displayed and removes commands with their workspace", () => {
    const registry = new StudioToolRegistry();
    const run = vi.fn();
    registry.publish("workspace", [command(run)]);
    registry.publish("workspace", [{ ...command(run), disabledReason: "저장 중입니다." }]);
    expect(registry.run("open-fragments")).toBe(false);
    expect(run).not.toHaveBeenCalled();
    registry.remove("workspace");
    expect(registry.getSnapshot()).toEqual([]);
    expect(registry.run("open-fragments")).toBe(false);
  });
});
