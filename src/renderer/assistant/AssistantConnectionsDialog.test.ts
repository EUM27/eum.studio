import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  AssistantConnectionsDialog,
  createAssistantCredentialChange,
} from "./AssistantConnectionsDialog";

describe("AssistantConnectionsDialog", () => {
  it("shows a distinct empty editor until the user starts a new connection", () => {
    const markup = renderToStaticMarkup(createElement(
      AssistantConnectionsDialog,
      {
        actionState: "idle",
        connections: [],
        connectorProfile: {
          schemaVersion: 1,
          connectors: [{
            connectorKind: "eum-structured-json-v1",
            displayName: "사용자 지정 구조화 JSON",
            capabilities: ["vocabulary-lookup"],
            credentialPolicy: "optional",
            runtimeConfig: { endpoint: "required", model: "required" },
          }],
        },
        error: null,
        onClose: () => undefined,
        onDelete: () => undefined,
        onSave: () => undefined,
      },
    ));

    expect(markup).toContain("연결을 선택하거나 새로 만드세요");
    expect(markup).not.toContain('aria-label="연결 종류"');
  });

  it("shows only user-defined connection metadata and credential status", () => {
    const secret = "must-not-render";
    const markup = renderToStaticMarkup(
      createElement(AssistantConnectionsDialog, {
        actionState: "idle",
        connectorProfile: {
          schemaVersion: 1,
          connectors: [{
            connectorKind: "eum-structured-json-v1",
            displayName: "사용자 지정 구조화 JSON",
            capabilities: ["vocabulary-lookup"],
            credentialPolicy: "optional",
            runtimeConfig: { endpoint: "required", model: "required" },
          }],
        },
        connections: [{
          schemaVersion: 1,
          connectionId: entityId<"AssistantConnection">("connection-a"),
          revision: 2,
          connectorKind: "eum-structured-json-v1",
          label: "내 연결",
          endpoint: "https://example.invalid/rpc",
          model: "writer-model",
          credentialConfigured: true,
          createdAt: "2026-08-10T01:00:00.000Z",
          updatedAt: "2026-08-10T01:01:00.000Z",
        }],
        error: null,
        onClose: () => undefined,
        onDelete: () => undefined,
        onSave: () => undefined,
      }),
    );

    expect(markup).toContain("조수 연결");
    expect(markup).toContain("사용자 지정 구조화 JSON");
    expect(markup).toContain("내 연결");
    expect(markup).toContain("https://example.invalid/rpc");
    expect(markup).toContain("writer-model");
    expect(markup).toContain("자격 증명 저장됨");
    expect(markup).toContain("새 값을 입력할 때만 교체");
    expect(markup).not.toContain(secret);
    expect(markup).not.toContain("OpenAI");
    expect(markup).not.toContain("Anthropic");
  });

  it("changes credentials only through an explicit keep, replace, or remove choice", () => {
    expect(createAssistantCredentialChange({
      credentialValue: "",
      removeCredential: false,
    })).toEqual({ mode: "keep" });
    expect(createAssistantCredentialChange({
      credentialValue: "secret-value",
      removeCredential: false,
    })).toEqual({ mode: "replace", value: "secret-value" });
    expect(createAssistantCredentialChange({
      credentialValue: "",
      removeCredential: true,
    })).toEqual({ mode: "remove" });
  });
});
