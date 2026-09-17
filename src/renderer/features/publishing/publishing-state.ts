import type { PublishingEvidenceLinksProjection } from "../../../application/publishing/publishing-evidence-link-contract";
import type { EntityId } from "../../../domain/writing";
import type { PublishingPartnerDialogActionState } from "../../publishing/PublishingPartnerDialog";
import type { WorkOperationsSection } from "../../workspace/WorkOperationsWorkspace";

export function publishingActionIsIdle(
  actionState: PublishingPartnerDialogActionState,
): actionState is "idle" {
  return actionState === "idle";
}

export function publishingRouteForOpen(
  initialSection: WorkOperationsSection,
  workScopeId: EntityId<"Work"> | null,
) {
  return Object.freeze({
    showPublishingPartners: true,
    publishingInitialSection: initialSection,
    publishingWorkScopeId: workScopeId,
    publishingPartnerActionState: "loading" as const,
    publishingPartnerError: null,
  });
}

export function publishingRouteForClose(
  actionState: PublishingPartnerDialogActionState,
) {
  return publishingActionIsIdle(actionState)
    ? Object.freeze({
        showPublishingPartners: false,
        publishingPartnerError: null,
      })
    : null;
}

export function reconcilePublishingSelection<T>(
  current: string | null,
  records: readonly T[],
  getId: (record: T) => string,
): string | null {
  return records.some((record) => getId(record) === current)
    ? current
    : records[0] === undefined
      ? null
      : getId(records[0]);
}

export function replacePublishingRecord<T>(
  current: readonly T[],
  updated: T,
  getId: (record: T) => string,
): readonly T[] {
  const updatedId = getId(updated);
  return Object.freeze(current.map((record) =>
    getId(record) === updatedId ? updated : record));
}

export function prependPublishingRecord<T>(
  current: readonly T[],
  created: T,
): readonly T[] {
  return Object.freeze([created, ...current]);
}

export function applyPublishingEvidenceUpdate<T extends {
  readonly revision: number;
  readonly sourceIds: readonly string[];
  readonly updatedAt: string;
}>(
  record: T,
  updated: PublishingEvidenceLinksProjection,
): T {
  return {
    ...record,
    revision: updated.revision,
    sourceIds: updated.sourceIds,
    updatedAt: updated.updatedAt,
  };
}
