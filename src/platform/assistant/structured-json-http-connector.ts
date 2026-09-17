import type {
  AssistantConnectorAdapter,
} from "../../application/assistant/assistant-connector-manifest";
import { AssistantRequestError, parseAssistantRequestPolicy, throwIfAssistantRequestAborted, waitForAssistantRequest, withAssistantRequestLifetime } from "../../application/assistant/assistant-request-lifecycle";

type FetchResponse = Pick<Response, "ok" | "headers" | "body">;

type FetchImplementation = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly signal: AbortSignal;
  },
) => Promise<FetchResponse>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function parseResponse(value: unknown): Readonly<{
  schemaVersion: 1;
  payload: unknown;
}> {
  const input = record(value, "Structured JSON assistant response");
  if (
    Object.keys(input).length !== 2 ||
    input.schemaVersion !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "payload")
  ) {
    throw new Error("Structured JSON assistant response fields do not match the schema");
  }
  return Object.freeze({ schemaVersion: 1, payload: input.payload });
}

export function createStructuredJsonHttpConnector(input?: {
  readonly fetch?: FetchImplementation;
}): AssistantConnectorAdapter {
  const fetchImplementation: FetchImplementation =
    input?.fetch ?? (globalThis.fetch as FetchImplementation);
  return Object.freeze({
    connectorKind: "eum-structured-json-v1",
    async execute(command) {
      const policy = parseAssistantRequestPolicy(command.requestPolicy);
      return withAssistantRequestLifetime({
        ...(command.signal === undefined ? {} : { signal: command.signal }),
        timeoutMs: policy.timeoutMs,
        execute: async (signal) => {
          try {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (command.credential !== null) {
              headers.Authorization = `Bearer ${command.credential}`;
            }
            const response = await fetchImplementation(command.endpoint, {
              method: "POST",
              signal,
              headers,
              body: JSON.stringify({
                schemaVersion: 1,
                operation: command.operation,
                model: command.model,
                input: command.input,
              }),
            });
            if (!response.ok) {
              void response.body?.cancel().catch(() => undefined);
              throw new AssistantRequestError("server-error");
            }
            const declaredLength = response.headers.get("content-length");
            if (declaredLength !== null && Number(declaredLength) > policy.maxResponseBytes) {
              void response.body?.cancel().catch(() => undefined);
              throw new AssistantRequestError("response-too-large");
            }
            if (response.body === null) throw new AssistantRequestError("invalid-response");
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let length = 0;
            let complete = false;
            try {
              while (true) {
                const chunk = await waitForAssistantRequest(reader.read(), signal);
                throwIfAssistantRequestAborted(signal);
                if (chunk.done) { complete = true; break; }
                length += chunk.value.byteLength;
                if (length > policy.maxResponseBytes) throw new AssistantRequestError("response-too-large");
                chunks.push(chunk.value);
              }
            } finally {
              if (!complete) void reader.cancel().catch(() => undefined);
              reader.releaseLock();
            }
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
            try {
              return parseResponse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
            } catch { throw new AssistantRequestError("invalid-response"); }
          } catch (error) {
            throwIfAssistantRequestAborted(signal);
            if (error instanceof AssistantRequestError) throw error;
            throw new AssistantRequestError("network-error");
          }
        },
      });
    },
  });
}
