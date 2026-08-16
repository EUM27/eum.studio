import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseAssistantConnectionListProjection,
  parseDeleteAssistantConnectionCommand,
  parseSaveAssistantConnectionCommand,
} from "./assistant-connection";

describe("assistant connection contract", () => {
  it("accepts a user-defined connection without inventing a provider or model", () => {
    const connectionId = randomUUID();
    const label = `connection-${randomUUID()}`;
    const endpoint = `https://${randomUUID()}.invalid/rpc`;
    const model = `model-${randomUUID()}`;
    const connectorKind = `connector-${randomUUID()}`;
    const credential = `credential-${randomUUID()}`;

    expect(parseSaveAssistantConnectionCommand({
      schemaVersion: 1,
      connectionId,
      expectedRevision: 0,
      connectorKind,
      label,
      endpoint,
      model,
      credential: { mode: "replace", value: credential },
    })).toEqual({
      schemaVersion: 1,
      connectionId,
      expectedRevision: 0,
      connectorKind,
      label,
      endpoint,
      model,
      credential: { mode: "replace", value: credential },
    });
  });

  it("projects credential status without a field that can return the credential", () => {
    const connectionId = randomUUID();
    const createdAt = new Date().toISOString();
    const projection = parseAssistantConnectionListProjection({
      schemaVersion: 1,
      connections: [{
        schemaVersion: 1,
        connectionId,
        revision: 1,
        connectorKind: `connector-${randomUUID()}`,
        label: `connection-${randomUUID()}`,
        endpoint: `https://${randomUUID()}.invalid/rpc`,
        model: `model-${randomUUID()}`,
        credentialConfigured: true,
        createdAt,
        updatedAt: createdAt,
      }],
    });

    expect(projection.connections[0]).toMatchObject({
      connectionId,
      credentialConfigured: true,
    });
    expect(JSON.stringify(projection)).not.toMatch(/credential-/u);
    expect(projection.connections[0]).not.toHaveProperty("credential");
  });

  it("keeps replacement, retention, removal, and deletion explicit", () => {
    const base = {
      schemaVersion: 1,
      connectionId: randomUUID(),
      expectedRevision: 1,
      connectorKind: `connector-${randomUUID()}`,
      label: `connection-${randomUUID()}`,
      endpoint: `https://${randomUUID()}.invalid/rpc`,
      model: `model-${randomUUID()}`,
    } as const;

    expect(parseSaveAssistantConnectionCommand({
      ...base,
      credential: { mode: "keep" },
    }).credential).toEqual({ mode: "keep" });
    expect(parseSaveAssistantConnectionCommand({
      ...base,
      credential: { mode: "remove" },
    }).credential).toEqual({ mode: "remove" });
    expect(parseDeleteAssistantConnectionCommand({
      schemaVersion: 1,
      connectionId: base.connectionId,
      expectedRevision: 1,
    })).toEqual({
      schemaVersion: 1,
      connectionId: base.connectionId,
      expectedRevision: 1,
    });
  });
});
