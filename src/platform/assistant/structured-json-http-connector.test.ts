import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { createStructuredJsonHttpConnector } from "./structured-json-http-connector";

describe("structured JSON HTTP assistant connector", () => {
  it("posts only the selected operation input to the exact user endpoint and returns its structured payload", async () => {
    const endpoint = `https://${randomUUID()}.invalid/assistant`;
    const credential = `secret-${randomUUID()}`;
    const query = "엄정하다 유의어";
    const context = "그는 엄정한 표정을 지었다.";
    const responsePayload = {
      suggestions: [{
        word: "근엄하다",
        nuance: "무게감이 더 강함",
        example: "근엄한 표정으로 회의를 열었다.",
      }],
      note: "문맥상 격식 있는 표현입니다.",
    };
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, payload: responsePayload }),
    }));
    const connector = createStructuredJsonHttpConnector({ fetch });

    await expect(connector.execute({
      schemaVersion: 1,
      requestId: entityId<"AssistantConnectorRequest">("request-a"),
      connectionId: entityId<"AssistantConnection">("connection-a"),
      operation: "vocabulary-suggestions",
      endpoint,
      model: "user-model",
      credential,
      input: { query, context },
    })).resolves.toEqual({
      schemaVersion: 1,
      payload: responsePayload,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify({
        schemaVersion: 1,
        operation: "vocabulary-suggestions",
        model: "user-model",
        input: { query, context },
      }),
    });
  });
});
