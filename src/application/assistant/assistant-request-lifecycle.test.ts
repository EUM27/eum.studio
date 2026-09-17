import { expect, it } from "vitest";
import { withAssistantRequestLifetime } from "./assistant-request-lifecycle";

it("checks the elapsed monotonic deadline when synchronous response work blocks the timer callback", async () => {
  const timeoutMs = 10;
  await expect(withAssistantRequestLifetime({ timeoutMs, execute: async () => {
    const started = performance.now();
    while (performance.now() - started < timeoutMs * 2) { /* Simulate bounded synchronous response decoding. */ }
    return { payload: "late" };
  } })).rejects.toMatchObject({ code: "timeout" });
});
