export type AssistantChatMessage = Readonly<{
  role: "user" | "assistant";
  text: string;
}>;

export type RunAssistantChatCommand = Readonly<{
  schemaVersion: 1;
  messages: readonly AssistantChatMessage[];
}>;

export type AssistantChatResult = Readonly<{
  schemaVersion: 1;
  providerId: string;
  modelId: string;
  message: AssistantChatMessage & Readonly<{ role: "assistant" }>;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((field) => !allowed.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

export function parseAssistantChatMessage(
  value: unknown,
  label = "AssistantChatMessage",
): AssistantChatMessage {
  const input = record(value, label);
  exact(input, ["role", "text"], label);
  if (input.role !== "user" && input.role !== "assistant") {
    throw new Error(`${label}.role is not supported`);
  }
  return Object.freeze({
    role: input.role,
    text: nonEmptyText(input.text, `${label}.text`),
  });
}

export function parseRunAssistantChatCommand(
  value: unknown,
): RunAssistantChatCommand {
  const input = record(value, "RunAssistantChatCommand");
  exact(input, ["schemaVersion", "messages"], "RunAssistantChatCommand");
  if (input.schemaVersion !== 1) {
    throw new Error("RunAssistantChatCommand.schemaVersion must be 1");
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("RunAssistantChatCommand.messages must not be empty");
  }
  const messages = Object.freeze(input.messages.map((message, index) =>
    parseAssistantChatMessage(
      message,
      `RunAssistantChatCommand.messages[${index}]`,
    )
  ));
  if (messages.at(-1)?.role !== "user") {
    throw new Error("RunAssistantChatCommand must end with a user message");
  }
  return Object.freeze({ schemaVersion: 1, messages });
}

export function parseAssistantChatResult(value: unknown): AssistantChatResult {
  const input = record(value, "AssistantChatResult");
  exact(
    input,
    ["schemaVersion", "providerId", "modelId", "message"],
    "AssistantChatResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("AssistantChatResult.schemaVersion must be 1");
  }
  const message = parseAssistantChatMessage(
    input.message,
    "AssistantChatResult.message",
  );
  if (message.role !== "assistant") {
    throw new Error("AssistantChatResult.message must be an assistant message");
  }
  return Object.freeze({
    schemaVersion: 1,
    providerId: nonEmptyText(input.providerId, "AssistantChatResult.providerId"),
    modelId: nonEmptyText(input.modelId, "AssistantChatResult.modelId"),
    message: Object.freeze({ role: "assistant", text: message.text }),
  });
}
