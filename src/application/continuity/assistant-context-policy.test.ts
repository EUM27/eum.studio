import { describe, expect, it } from "vitest";

import {
  parseAssistantEntityContextPolicyList,
  parseAssistantEntityContextPolicyProjection,
  parseListAssistantEntityContextPoliciesCommand,
  parseSaveAssistantEntityContextPolicyCommand,
} from "./assistant-context-policy";

describe("Assistant entity context policy contracts", () => {
  it("parses required, relevant, and withheld modes with exact fields", () => {
    const policy = parseAssistantEntityContextPolicyProjection({
      schemaVersion: 1,
      workId: "work-1",
      entity: { kind: "character", id: "character-1" },
      revision: 2,
      mode: "withheld",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    expect(policy).toMatchObject({ mode: "withheld", revision: 2 });
    expect(parseSaveAssistantEntityContextPolicyCommand({
      schemaVersion: 1,
      workId: "work-1",
      entity: { kind: "character", id: "character-1" },
      expectedRevision: 2,
      mode: "required",
    })).toMatchObject({ mode: "required", expectedRevision: 2 });
    expect(parseListAssistantEntityContextPoliciesCommand({
      schemaVersion: 1,
      workId: "work-1",
    })).toMatchObject({ workId: "work-1" });
    expect(parseAssistantEntityContextPolicyList({
      schemaVersion: 1,
      workId: "work-1",
      policies: [policy],
    }).policies).toHaveLength(1);
  });

  it("rejects unsupported modes, extra fields, and cross-Work list entries", () => {
    expect(() => parseAssistantEntityContextPolicyProjection({
      schemaVersion: 1,
      workId: "work-1",
      entity: { kind: "character", id: "character-1" },
      revision: 1,
      mode: "always",
      updatedAt: "2026-08-29T00:00:00.000Z",
    })).toThrow(/mode/u);
    expect(() => parseListAssistantEntityContextPoliciesCommand({
      schemaVersion: 1,
      workId: "work-1",
      fallback: true,
    })).toThrow(/fields/u);
    expect(() => parseAssistantEntityContextPolicyList({
      schemaVersion: 1,
      workId: "work-1",
      policies: [{
        schemaVersion: 1,
        workId: "work-2",
        entity: { kind: "character", id: "character-1" },
        revision: 1,
        mode: "relevant",
        updatedAt: "2026-08-29T00:00:00.000Z",
      }],
    })).toThrow(/Work/u);
  });
});
