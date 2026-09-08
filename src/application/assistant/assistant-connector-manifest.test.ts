import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createAssistantConnectorExecutor,
  parseAssistantConnectorManifestProfile,
} from "./assistant-connector-manifest";

describe("assistant connector manifest", () => {
  it("parses caller-owned connector identity, capabilities, and runtime fields without defaults", () => {
    const connectorKind = `connector-${randomUUID()}`;
    expect(parseAssistantConnectorManifestProfile({
      schemaVersion: 1,
      connectors: [{
        connectorKind,
        displayName: "사용자 등록 연결",
        capabilities: ["vocabulary-lookup"],
        contextTokenBudget: 8192,
        credentialPolicy: "required",
        runtimeConfig: {
          endpoint: "required",
          model: "required",
        },
      }],
    })).toEqual({
      schemaVersion: 1,
      connectors: [{
        connectorKind,
        displayName: "사용자 등록 연결",
        capabilities: ["vocabulary-lookup"],
        contextTokenBudget: 8192,
        credentialPolicy: "required",
        runtimeConfig: {
          endpoint: "required",
          model: "required",
        },
      }],
    });
  });

  it("keeps the credential inside one fake adapter call and returns a value-free execution receipt", async () => {
    const connectorKind = `connector-${randomUUID()}`;
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const credential = `secret-${randomUUID()}`;
    const endpoint = `https://${randomUUID()}.invalid/rpc`;
    const model = `model-${randomUUID()}`;
    const query = "엄정하다 유의어";
    const context = "그는 엄정한 표정을 지었다.";
    const execute = vi.fn(async () => ({
      schemaVersion: 1 as const,
      payload: {
        suggestions: [{ word: "근엄하다", nuance: "무게감", example: "" }],
        note: "",
      },
    }));
    const executor = createAssistantConnectorExecutor({
      manifestProfile: parseAssistantConnectorManifestProfile({
        schemaVersion: 1,
        connectors: [{
          connectorKind,
          displayName: "테스트 연결",
          capabilities: ["vocabulary-lookup"],
          contextTokenBudget: 8192,
          credentialPolicy: "required",
          runtimeConfig: { endpoint: "required", model: "required" },
        }],
      }),
      adapters: [{ connectorKind, execute }],
      readConnection: (requestedConnectionId) => {
        expect(requestedConnectionId).toBe(connectionId);
        return {
          connectionId,
          connectorKind,
          endpoint,
          model,
          credential,
        };
      },
      createReceiptId: () => entityId<"ConnectorReceipt">("receipt-a"),
      now: vi
        .fn()
        .mockReturnValueOnce("2026-08-10T03:00:00.000Z")
        .mockReturnValueOnce("2026-08-10T03:00:01.000Z"),
    });

    const result = await executor.execute({
      schemaVersion: 1,
      requestId: entityId<"AssistantConnectorRequest">("request-a"),
      connectionId,
      capability: "vocabulary-lookup",
      operation: "vocabulary-suggestions",
      requestFingerprint: `sha256:${randomUUID()}`,
      input: { query, context },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      schemaVersion: 1,
      requestId: "request-a",
      connectionId,
      operation: "vocabulary-suggestions",
      endpoint,
      model,
      credential,
      input: { query, context },
    });
    expect(result).toMatchObject({
      schemaVersion: 1,
      receipt: {
        receiptId: "receipt-a",
        connectionId,
        connectorKind,
        operation: "vocabulary-suggestions",
        requestFingerprint: expect.stringMatching(/^sha256:/u),
        resultState: "succeeded",
      },
      payload: {
        suggestions: [{ word: "근엄하다" }],
      },
    });
    expect(JSON.stringify(result)).not.toContain(credential);
    expect(JSON.stringify(result.receipt)).not.toContain(query);
    expect(JSON.stringify(result.receipt)).not.toContain(context);
  });
});
