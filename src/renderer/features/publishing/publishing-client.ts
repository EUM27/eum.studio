import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { EntityId } from "../../../domain/writing";

export type PublishingClient = {
  readonly publishingPartners: StudioBridge["publishingPartners"];
  readonly publishingSubmissions: StudioBridge["publishingSubmissions"];
  readonly publishingContracts: StudioBridge["publishingContracts"];
  readonly publishingPublications: StudioBridge["publishingPublications"];
  readonly publishingSettlements: StudioBridge["publishingSettlements"];
  readonly publishingPayments: StudioBridge["publishingPayments"];
  readonly publishingSources: StudioBridge["publishingSources"];
  readonly publishingResearch: StudioBridge["publishingResearch"];
  readonly publishingAssistant: StudioBridge["publishingAssistant"];
  readonly publishingEvidence: StudioBridge["publishingEvidence"];
  readonly publishingImports: StudioBridge["publishingImports"];
  readonly publishingMailCandidates: StudioBridge["publishingMailCandidates"];
  readonly publishingMailConnection: StudioBridge["publishingMailConnection"];
  readonly publishingMailSchedule: StudioBridge["publishingMailSchedule"];
  readonly assistant: Pick<StudioBridge["assistant"], "listConnections">;
};

export function loadPublishingControllerState(
  client: PublishingClient,
  workId: EntityId<"Work"> | null,
) {
  return Promise.all([
    client.publishingPartners.list({ schemaVersion: 1 }),
    client.publishingSubmissions.list({ schemaVersion: 1, workId }),
    client.publishingContracts.list({ schemaVersion: 1, workId }),
    client.publishingPublications.list({ schemaVersion: 1, workId }),
    client.publishingSettlements.list({ schemaVersion: 1, workId }),
    client.publishingPayments.list({ schemaVersion: 1, workId }),
    client.publishingSources.list({ schemaVersion: 1 }),
    client.publishingMailCandidates.list({ schemaVersion: 1 }),
    client.publishingMailConnection.status({ schemaVersion: 1 }),
    client.publishingMailSchedule.status({ schemaVersion: 1 }),
    client.assistant.listConnections(),
  ]);
}
