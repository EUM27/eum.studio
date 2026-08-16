import type {
  AssistantConnectorAdapter,
} from "../../application/assistant/assistant-connector-manifest";

type FetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};

type FetchImplementation = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (command.credential !== null) {
        headers.Authorization = `Bearer ${command.credential}`;
      }
      const response = await fetchImplementation(command.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          schemaVersion: 1,
          operation: command.operation,
          model: command.model,
          input: command.input,
        }),
      });
      if (!response.ok) {
        throw new Error(`Assistant connector request failed with status ${response.status}`);
      }
      return parseResponse(await response.json());
    },
  });
}
