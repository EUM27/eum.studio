import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../../domain/writing";
import {
  loadPublishingControllerState,
  type PublishingClient,
} from "./publishing-client";
import {
  applyPublishingEvidenceUpdate,
  prependPublishingRecord,
  publishingActionIsIdle,
  publishingRouteForClose,
  publishingRouteForOpen,
  reconcilePublishingSelection,
  replacePublishingRecord,
} from "./publishing-state";

function createLoadClient(failure?: Error) {
  const results = Object.freeze([
    Object.freeze({ schemaVersion: 1, partners: Object.freeze([{ partnerId: "partner-1" }]) }),
    Object.freeze({ schemaVersion: 1, submissions: Object.freeze([{ submissionId: "submission-1" }]) }),
    Object.freeze({ schemaVersion: 1, templates: Object.freeze([{ templateId: "template-1" }]) }),
    Object.freeze({ schemaVersion: 1, responses: Object.freeze([{ responseId: "response-1" }]) }),
    Object.freeze({ schemaVersion: 1, contracts: Object.freeze([{ contractId: "contract-1" }]) }),
    Object.freeze({ schemaVersion: 1, publications: Object.freeze([{ publicationId: "publication-1" }]) }),
    Object.freeze({ schemaVersion: 1, settlements: Object.freeze([{ settlementId: "settlement-1" }]) }),
    Object.freeze({ schemaVersion: 1, payments: Object.freeze([{ paymentId: "payment-1" }]) }),
    Object.freeze({ schemaVersion: 1, sources: Object.freeze([{ sourceId: "source-1" }]) }),
    Object.freeze({ schemaVersion: 1, candidates: Object.freeze([{ candidateId: "candidate-1" }]) }),
    Object.freeze({ schemaVersion: 1, status: "connected" }),
    Object.freeze({ schemaVersion: 1, enabled: true }),
    Object.freeze({ schemaVersion: 1, connections: Object.freeze([{ connectionId: "assistant-1" }]) }),
  ]);
  const calls = {
    partners: vi.fn(async () => results[0]),
    submissions: vi.fn(async () => results[1]),
    templates: vi.fn(async () => results[2]),
    responses: vi.fn(async () => results[3]),
    contracts: failure === undefined
      ? vi.fn(async () => results[4])
      : vi.fn(() => Promise.reject(failure)),
    publications: vi.fn(async () => results[5]),
    settlements: vi.fn(async () => results[6]),
    payments: vi.fn(async () => results[7]),
    sources: vi.fn(async () => results[8]),
    mailCandidates: vi.fn(async () => results[9]),
    mailConnection: vi.fn(async () => results[10]),
    mailSchedule: vi.fn(async () => results[11]),
    assistantConnections: vi.fn(async () => results[12]),
  };
  const client = {
    publishingPartners: { list: calls.partners },
    publishingSubmissions: { list: calls.submissions },
    publishingFormTemplates: { list: calls.templates },
    publishingFormResponses: { list: calls.responses },
    publishingContracts: { list: calls.contracts },
    publishingPublications: { list: calls.publications },
    publishingSettlements: { list: calls.settlements },
    publishingPayments: { list: calls.payments },
    publishingSources: { list: calls.sources },
    publishingMailCandidates: { list: calls.mailCandidates },
    publishingMailConnection: { status: calls.mailConnection },
    publishingMailSchedule: { status: calls.mailSchedule },
    assistant: { listConnections: calls.assistantConnections },
  } as unknown as PublishingClient;
  return { calls, client, results };
}

describe("publishing controller helpers", () => {
  it("loads all thirteen authoritative projections atomically with the exact Work filters", async () => {
    const { calls, client, results } = createLoadClient();
    const workId = entityId<"Work">("work-1");

    await expect(loadPublishingControllerState(client, workId))
      .resolves.toEqual(results);
    expect(calls.partners).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(calls.submissions).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    expect(calls.templates).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(calls.responses).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    expect(calls.contracts).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    expect(calls.publications).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    expect(calls.settlements).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    expect(calls.payments).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    expect(calls.sources).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(calls.mailCandidates).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(calls.mailConnection).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(calls.mailSchedule).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(calls.assistantConnections).toHaveBeenCalledWith();
  });

  it("rejects the whole thirteen-query load without a partial result", async () => {
    const failure = new Error("contract ledger failed");
    const { calls, client } = createLoadClient(failure);

    await expect(loadPublishingControllerState(client, null)).rejects.toBe(failure);
    expect(Object.values(calls).every((query) => query.mock.calls.length === 1))
      .toBe(true);
  });

  it("reconciles all seven selected ledger identities in the existing order", () => {
    const ledgers = [
      ["partner", "partnerId"],
      ["submission", "submissionId"],
      ["contract", "contractId"],
      ["publication", "publicationId"],
      ["settlement", "settlementId"],
      ["payment", "paymentId"],
      ["source", "sourceId"],
    ] as const;

    for (const [label, idField] of ledgers) {
      const records = Object.freeze([
        Object.freeze({ [idField]: `${label}-1` }),
        Object.freeze({ [idField]: `${label}-2` }),
      ]);
      const getId = (record: Readonly<Record<string, string>>) => record[idField]!;
      expect(reconcilePublishingSelection(`${label}-2`, records, getId))
        .toBe(`${label}-2`);
      expect(reconcilePublishingSelection("stale", records, getId))
        .toBe(`${label}-1`);
      expect(reconcilePublishingSelection("stale", [], getId)).toBeNull();
    }
  });

  it("keeps one shared gate and preserves persistent ledgers across close and reopen", () => {
    const partners = Object.freeze([{ partnerId: "partner-1", revision: 2 }]);
    const selectedPartnerId = "partner-1";
    const opened = {
      partners,
      selectedPartnerId,
      ...publishingRouteForOpen("contracts", entityId<"Work">("work-1")),
    };
    const close = publishingRouteForClose("idle");
    expect(close).not.toBeNull();
    const closed = { ...opened, ...close };
    const reopened = {
      ...closed,
      ...publishingRouteForOpen("settlements", null),
    };

    expect(publishingActionIsIdle("idle")).toBe(true);
    expect(publishingActionIsIdle("loading")).toBe(false);
    expect(publishingActionIsIdle("creating")).toBe(false);
    expect(publishingRouteForClose("updating")).toBeNull();
    expect(closed.showPublishingPartners).toBe(false);
    expect(reopened.showPublishingPartners).toBe(true);
    expect(reopened.partners).toBe(partners);
    expect(reopened.selectedPartnerId).toBe(selectedPartnerId);
  });

  it("preserves returned revisions and representative cross-ledger updates", () => {
    type PartnerRecord = Readonly<{
      partnerId: string;
      revision: number;
      sourceIds: readonly string[];
      updatedAt: string;
      name: string;
    }>;
    const oldPartner: PartnerRecord = Object.freeze({
      partnerId: "partner-1",
      revision: 2,
      sourceIds: Object.freeze(["source-old"]),
      updatedAt: "old",
      name: "before",
    });
    const evidence = Object.freeze({
      schemaVersion: 1 as const,
      targetKind: "partner" as const,
      targetId: "partner-1",
      revision: 3,
      sourceIds: Object.freeze([entityId<"PublishingSource">("source-new")]),
      updatedAt: "new",
    });
    const linked = applyPublishingEvidenceUpdate(oldPartner, evidence);
    const updatedPartner: PartnerRecord = Object.freeze({
      ...linked,
      revision: 4,
      name: "after",
    });
    const partners = replacePublishingRecord(
      Object.freeze([oldPartner]),
      updatedPartner,
      (partner) => partner.partnerId,
    );
    const oldSources = Object.freeze([{ sourceId: "source-old", revision: 1 }]);
    const newSource = Object.freeze({ sourceId: "source-new", revision: 1 });
    const sources = prependPublishingRecord(oldSources, newSource);

    expect(linked).toMatchObject({
      revision: 3,
      sourceIds: ["source-new"],
      updatedAt: "new",
      name: "before",
    });
    expect(partners).toEqual([updatedPartner]);
    expect(sources).toEqual([newSource, ...oldSources]);
    expect(oldPartner).toMatchObject({ revision: 2, name: "before" });
  });

  it("keeps the injected hook unconditional and free of direct window access", () => {
    const controllerSource = readFileSync(
      new URL("./usePublishingController.ts", import.meta.url),
      "utf8",
    );
    const shellSource = readFileSync(
      new URL("../../StudioShell.tsx", import.meta.url),
      "utf8",
    );

    expect(controllerSource).not.toContain("window.");
    expect(controllerSource.match(/\buseState(?:<|\()/gu)).toHaveLength(26);
    expect(shellSource.match(/usePublishingController\(window\.eumStudio\)/gu))
      .toHaveLength(1);
    expect(shellSource.indexOf("usePublishingController(window.eumStudio)"))
      .toBeLessThan(shellSource.indexOf("<PublishingFeature"));
    expect(shellSource).not.toContain("setPublishingPartnerActionState");
    expect(shellSource).not.toContain("setSelectedPublishingPartnerId");
  });
});
