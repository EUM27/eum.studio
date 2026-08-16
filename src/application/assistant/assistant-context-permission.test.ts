import { randomInt, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  authorizeAssistantContextRequest,
  createAssistantContextReceipt,
  parseAssistantContextPermissionGrant,
  parseAssistantContextReceipt,
  parseAssistantContextRequest,
} from "./assistant-context-permission";

function fixture() {
  const workId = randomUUID();
  const documentId = randomUUID();
  const documentRevisionId = randomUUID();
  const conversationId = randomUUID();
  const destinationId = `destination:${randomUUID()}`;
  const requestId = randomUUID();
  const grantId = randomUUID();
  const from = randomInt(1, 20);
  const to = from + randomInt(1, 20);
  const createdAt = new Date().toISOString();
  const range = { documentId, documentRevisionId, from, to };
  const request = {
    schemaVersion: 1,
    requestId,
    workId,
    conversationId,
    capability: "vocabulary-lookup",
    destinationId,
    requiredLocalScope: "selection",
    requiredExternalScope: "selection",
    readRanges: [range],
    transmittedRanges: [range],
  } as const;
  const grant = {
    schemaVersion: 1,
    grantId,
    revision: 1,
    workId,
    conversationId,
    capability: "vocabulary-lookup",
    destinationId,
    localScope: "selection",
    externalScope: "selection",
    duration: "once",
    createdAt,
    revokedAt: null,
    consumedAt: null,
  } as const;
  const document = {
    workId,
    documentId,
    documentRevisionId,
    length: to + randomInt(1, 20),
  } as const;
  return { request, grant, document, createdAt };
}

describe("assistant context permission", () => {
  it("authorizes one exact selection and creates a value-free range receipt", () => {
    const source = fixture();
    const request = parseAssistantContextRequest(source.request);
    const grant = parseAssistantContextPermissionGrant(source.grant);
    const authorization = authorizeAssistantContextRequest({
      request,
      grants: [grant],
      documents: [source.document],
    });

    expect(authorization).toMatchObject({
      allowed: true,
      grantIds: [grant.grantId],
      consumedGrantIds: [grant.grantId],
    });
    if (!authorization.allowed) throw new Error("authorization must succeed");
    const receipt = createAssistantContextReceipt({
      authorization,
      receiptId: randomUUID(),
      createdAt: source.createdAt,
    });

    expect(receipt.readRanges).toEqual(request.readRanges);
    expect(receipt.transmittedRanges).toEqual(request.transmittedRanges);
    expect(receipt.readCharacterCount).toBe(
      request.readRanges[0]!.to - request.readRanges[0]!.from,
    );
    expect(parseAssistantContextReceipt(receipt)).toEqual(receipt);
    expect(JSON.stringify(receipt)).not.toMatch(/manuscript|content|text/ui);
  });

  it("does not reuse a grant across Work, destination, capability, or conversation", () => {
    const source = fixture();
    const mismatches = [
      { workId: randomUUID() },
      { destinationId: `destination:${randomUUID()}` },
      { capability: "lore-review" as const },
      { conversationId: randomUUID() },
    ];

    for (const mismatch of mismatches) {
      const request = { ...source.request, ...mismatch };
      const authorization = authorizeAssistantContextRequest({
        request,
        grants: [source.grant],
        documents: [{ ...source.document, workId: request.workId }],
      });
      expect(authorization).toMatchObject({
        allowed: false,
        reason: "permission-required",
      });
    }
  });

  it("keeps source ownership, revision, and bounds exact after permission", () => {
    const source = fixture();
    const cases = [
      {
        document: { ...source.document, workId: randomUUID() },
        reason: "outside-work",
      },
      {
        document: {
          ...source.document,
          documentRevisionId: randomUUID(),
        },
        reason: "stale-context",
      },
      {
        document: {
          ...source.document,
          length: source.request.readRanges[0]!.to - 1,
        },
        reason: "invalid-range",
      },
    ] as const;

    for (const item of cases) {
      expect(authorizeAssistantContextRequest({
        request: source.request,
        grants: [source.grant],
        documents: [item.document],
      })).toMatchObject({ allowed: false, reason: item.reason });
    }
  });

  it("never expands an exact selection or allows transmission outside the read range", () => {
    const source = fixture();
    const range = source.request.readRanges[0]!;
    expect(() => parseAssistantContextRequest({
      ...source.request,
      transmittedRanges: [{ ...range, from: range.from - 1 }],
    })).toThrow(/inside readRanges/u);
    expect(() => parseAssistantContextRequest({
      ...source.request,
      readRanges: [range, { ...range, from: range.to, to: range.to + 1 }],
    })).toThrow(/one exact range/u);
  });

  it("reuses a Work grant across conversations but not a consumed once grant", () => {
    const source = fixture();
    const workGrant = {
      ...source.grant,
      grantId: randomUUID(),
      conversationId: null,
      duration: "work",
    } as const;
    const otherConversationRequest = {
      ...source.request,
      conversationId: randomUUID(),
    };
    expect(authorizeAssistantContextRequest({
      request: otherConversationRequest,
      grants: [workGrant],
      documents: [source.document],
    })).toMatchObject({ allowed: true, consumedGrantIds: [] });

    expect(authorizeAssistantContextRequest({
      request: source.request,
      grants: [{ ...source.grant, consumedAt: new Date().toISOString() }],
      documents: [source.document],
    })).toMatchObject({
      allowed: false,
      reason: "permission-required",
    });
  });
});
