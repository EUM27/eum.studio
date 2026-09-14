import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { createAssistantConnectorExecutor } from "../../application/assistant/assistant-connector-manifest";
import { createStructuredJsonHttpConnector } from "./structured-json-http-connector";

const policy = { timeoutMs: 100, maxResponseBytes: 128 };
function command() {
  return {
    schemaVersion: 1 as const,
    requestId: entityId<"AssistantConnectorRequest">(randomUUID()),
    connectionId: entityId<"AssistantConnection">(randomUUID()),
    operation: "vocabulary-suggestions" as const,
    endpoint: `https://${randomUUID()}.invalid`, model: randomUUID(),
    credential: randomUUID(), input: { query: randomUUID() }, requestPolicy: policy,
  };
}
afterEach(() => vi.useRealTimers());

describe("structured HTTP request lifetime", () => {
  it("aborts a real silent loopback server at the configured deadline", async () => {
    const server = createServer((_request, response) => { response.on("close", () => closed()); });
    let closed!: () => void;
    const closedPromise = new Promise<void>((resolve) => { closed = resolve; });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("TCP address unavailable");
    try {
      const pending = createStructuredJsonHttpConnector().execute({ ...command(), endpoint: `http://127.0.0.1:${address.port}` });
      await expect(pending).rejects.toMatchObject({ code: "timeout" });
      await closedPromise;
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 2000);

  it("forwards cancellation to the transport and distinguishes it from timeout", async () => {
    const cancellation = new AbortController();
    let transportSignal: AbortSignal | null = null;
    const connector = createStructuredJsonHttpConnector({ fetch: async (_url, init) => {
      transportSignal = init.signal;
      return new Promise<Response>((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("private transport details")), { once: true }));
    } });
    const result = connector.execute({ ...command(), signal: cancellation.signal });
    cancellation.abort();
    await expect(result).rejects.toMatchObject({ code: "cancelled", message: "조수 요청을 취소했습니다." });
    expect((transportSignal as AbortSignal | null)?.aborted).toBe(true);
  });

  it("rejects a chunked body over the actual byte budget and cancels its reader", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(policy.maxResponseBytes)); controller.enqueue(new Uint8Array(1)); },
      cancel,
    });
    const connector = createStructuredJsonHttpConnector({ fetch: async () => new Response(stream) });
    await expect(connector.execute(command())).rejects.toMatchObject({ code: "response-too-large" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    [503, "private upstream details", "server-error"],
    [200, "private non-json body", "invalid-response"],
    [200, '{"schemaVersion":1,"payload":{},"extra":true}', "invalid-response"],
  ])("returns a safe failure for status %s and malformed payload", async (status, body, code) => {
    const connector = createStructuredJsonHttpConnector({ fetch: async () => new Response(body, { status }) });
    const error = await connector.execute(command()).catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain(body);
  });

  it("fails closed when an HTTP policy is absent", async () => {
    const fetch = vi.fn(async () => Response.json({ schemaVersion: 1, payload: {} }));
    const { requestPolicy: _policy, ...withoutPolicy } = command();
    expect(_policy).toEqual(policy);
    await expect(createStructuredJsonHttpConnector({ fetch }).execute(withoutPolicy)).rejects.toMatchObject({ code: "configuration-error" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a signal-ignoring adapter cannot return success or allocate a receipt after cancellation", async () => {
    const request = command();
    let complete!: (value: { schemaVersion: 1; payload: unknown }) => void;
    const adapterResult = new Promise<{ schemaVersion: 1; payload: unknown }>((resolve) => { complete = resolve; });
    const createReceiptId = vi.fn(() => entityId<"ConnectorReceipt">(randomUUID()));
    const cancellation = new AbortController();
    const executor = createAssistantConnectorExecutor({
      manifestProfile: { schemaVersion: 1, connectors: [{ connectorKind: "eum-structured-json-v1", displayName: randomUUID(), capabilities: ["vocabulary-lookup"], contextTokenBudget: 128, credentialPolicy: "optional", runtimeConfig: { endpoint: "required", model: "required" }, requestPolicy: policy }] },
      adapters: [{ connectorKind: "eum-structured-json-v1", execute: () => adapterResult }],
      readConnection: () => ({ ...request, connectorKind: "eum-structured-json-v1" }),
      createReceiptId, now: () => new Date().toISOString(),
    });
    const pending = executor.execute({ ...request, capability: "vocabulary-lookup", requestFingerprint: randomUUID(), signal: cancellation.signal });
    cancellation.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    complete({ schemaVersion: 1, payload: {} });
    await adapterResult;
    expect(createReceiptId).not.toHaveBeenCalled();
  });
});
