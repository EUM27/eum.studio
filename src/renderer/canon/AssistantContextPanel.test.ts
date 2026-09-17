import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { AssistantContextPanel } from "./AssistantContextPanel";

describe("AssistantContextPanel", () => {
  it("renders policy, connector-owned budget, revisions, exclusions, and privacy-safe activity", () => {
    const workId = entityId<"Work">("work-1");
    const characterId = entityId<"Character">("character-1");
    const entity = { kind: "character" as const, id: characterId };
    const controller = {
      policies: [{ schemaVersion: 1, workId, entity, revision: 1, mode: "withheld", updatedAt: "2026-08-29T00:00:00.000Z" }],
      manifests: [{ schemaVersion: 1, manifestId: "manifest-1", receiptId: "receipt-1", workId, entries: [{ kind: "entity", entity, entityRevision: 2, inclusionReason: "required-policy" }], excluded: [{ kind: "entity", entity: { kind: "lore-entry", id: "lore-1" }, entityRevision: 1, reason: "withheld-policy" }], estimatedTokenCount: 4, createdAt: "2026-08-29T00:00:00.000Z" }],
      activities: [{ schemaVersion: 1, activityId: "activity-1", workId, receiptId: "receipt-1", manifestId: "manifest-1", capability: "canon.review", destinationId: "provider-1", providerId: "provider-1", modelId: "model-1", startedAt: "2026-08-29T00:00:00.000Z", completedAt: "2026-08-29T00:00:01.000Z", stageDurationsMs: { plan: 3, authorize: 2, connector: 10, persist: 1 }, readRanges: [{ documentId: "document-1", documentRevisionId: "revision-1", from: 2, to: 8 }], transmittedRanges: [], readCharacterCount: 6, transmittedCharacterCount: 0, candidateCount: 1 }],
      connectors: [{ connectorKind: "connector-1", displayName: "사용자 연결", capabilities: ["canon.review"], contextTokenBudget: 8192, credentialPolicy: "required", runtimeConfig: { endpoint: "required", model: "required" } }],
      plan: { schemaVersion: 1, status: "planned", workId, capability: "canon.review", tokenBudget: 8192, estimatedTokenCount: 4, entries: [{ kind: "entity", entity, entityRevision: 2, inclusionReason: "required-policy" }], excluded: [{ kind: "entity", entity: { kind: "lore-entry", id: "lore-1" }, entityRevision: 1, reason: "withheld-policy" }] },
      actionState: "idle", error: null, message: null,
      refresh: vi.fn(), savePolicy: vi.fn(), runPlan: vi.fn(),
    };
    const markup = renderToStaticMarkup(createElement(AssistantContextPanel, {
      characters: [{ characterId, name: "윤서", retiredAt: null } as never],
      controller: controller as never,
      entityOptions: [{ key: `character:${characterId}`, entity, label: "인물 · 윤서" }],
    }));
    expect(markup).toContain("AI에 제공하지 않음");
    expect(markup).toContain("사용자 연결 · 예산 8192");
    expect(markup).toContain("필수 정책 · revision 2");
    expect(markup).toContain("provider-1 / model-1");
    expect(markup).toContain("읽은 원고 document-1 · 2–8 · revision revision-1");
    expect(markup).toContain("Candidate 1개");
    expect(markup).not.toMatch(/api.?key|hidden reasoning|원고 전체|prompt/iu);
  });
});
