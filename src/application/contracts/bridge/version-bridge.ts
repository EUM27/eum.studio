import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionContentProjection,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseReadDocumentRevisionCommand,
  parseRestoreDocumentRevisionCommand,
  parseRestoreDocumentRevisionResult,
  parseWorkSnapshotListProjection,
  parseWorkSnapshotProjection,
  type CreateWorkSnapshotCommand,
  type DocumentRevisionContentProjection,
  type DocumentRevisionListProjection,
  type ListDocumentRevisionsCommand,
  type ListWorkSnapshotsCommand,
  type ReadDocumentRevisionCommand,
  type RestoreDocumentRevisionCommand,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../../revisions/work-version-contract";
import {
  parseCompareWorkSnapshotCommand,
  parseWorkSnapshotComparisonProjection,
  type CompareWorkSnapshotCommand,
  type WorkSnapshotComparisonProjection,
} from "../../revisions/work-snapshot-comparison";
import {
  parsePlanWorkSnapshotSceneSelectionCommand,
  parseWorkSnapshotSceneSelectionPlan,
  type PlanWorkSnapshotSceneSelectionCommand,
  type WorkSnapshotSceneSelectionPlan,
} from "../../revisions/work-snapshot-scene-plan";

export const VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL =
  "studio:version:list-document-revisions";
export const VERSION_READ_DOCUMENT_REVISION_CHANNEL =
  "studio:version:read-document-revision";
export const VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL =
  "studio:version:restore-document-revision";
export const VERSION_CREATE_WORK_SNAPSHOT_CHANNEL =
  "studio:version:create-work-snapshot";
export const VERSION_LIST_WORK_SNAPSHOTS_CHANNEL =
  "studio:version:list-work-snapshots";
export const VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL =
  "studio:version:compare-work-snapshot";
export const VERSION_PLAN_WORK_SNAPSHOT_SCENES_CHANNEL =
  "studio:version:plan-work-snapshot-scenes";

export type VersionBridgeChannel =
  | typeof VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL
  | typeof VERSION_READ_DOCUMENT_REVISION_CHANNEL
  | typeof VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL
  | typeof VERSION_CREATE_WORK_SNAPSHOT_CHANNEL
  | typeof VERSION_LIST_WORK_SNAPSHOTS_CHANNEL
  | typeof VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL
  | typeof VERSION_PLAN_WORK_SNAPSHOT_SCENES_CHANNEL;

export type VersionBridgePayload =
  | ListDocumentRevisionsCommand
  | RestoreDocumentRevisionCommand
  | CreateWorkSnapshotCommand
  | ListWorkSnapshotsCommand
  | CompareWorkSnapshotCommand
  | PlanWorkSnapshotSceneSelectionCommand;

export type VersionBridge = Readonly<{
  compareWorkSnapshot: (
    command: CompareWorkSnapshotCommand,
  ) => Promise<WorkSnapshotComparisonProjection>;
  planWorkSnapshotScenes: (
    command: PlanWorkSnapshotSceneSelectionCommand,
  ) => Promise<WorkSnapshotSceneSelectionPlan>;
  listDocumentRevisions: (
    command: ListDocumentRevisionsCommand,
  ) => Promise<DocumentRevisionListProjection>;
  readDocumentRevision: (
    command: ReadDocumentRevisionCommand,
  ) => Promise<DocumentRevisionContentProjection>;
  restoreDocumentRevision: (
    command: RestoreDocumentRevisionCommand,
  ) => Promise<RestoreDocumentRevisionResult>;
  createWorkSnapshot: (
    command: CreateWorkSnapshotCommand,
  ) => Promise<WorkSnapshotProjection>;
  listWorkSnapshots: (
    command: ListWorkSnapshotsCommand,
  ) => Promise<WorkSnapshotListProjection>;
}>;

export type VersionBridgeInvoke = (
  channel: VersionBridgeChannel,
  payload?: VersionBridgePayload,
) => Promise<unknown>;

export function createVersionBridge(invoke: VersionBridgeInvoke): VersionBridge {
  return Object.freeze({
    compareWorkSnapshot: async (input) => {
      const command = parseCompareWorkSnapshotCommand(input);
      const value = await invoke(VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL, command);
      try {
        return parseWorkSnapshotComparisonProjection(value);
      } catch {
        throw new Error("Invalid WorkSnapshot comparison");
      }
    },
    planWorkSnapshotScenes: async (input) => {
      const command=parsePlanWorkSnapshotSceneSelectionCommand(input);
      const value=await invoke(VERSION_PLAN_WORK_SNAPSHOT_SCENES_CHANNEL,command);
      try{return parseWorkSnapshotSceneSelectionPlan(value);}catch{throw new Error("Invalid WorkSnapshot Scene selection plan");}
    },
    listDocumentRevisions: async (input) => {
      const command = parseListDocumentRevisionsCommand(input);
      const value = await invoke(
        VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
        command,
      );
      try {
        return parseDocumentRevisionListProjection(value);
      } catch {
        throw new Error("Invalid Document revision list");
      }
    },
    readDocumentRevision: async (input) => {
      const command = parseReadDocumentRevisionCommand(input);
      const value = await invoke(VERSION_READ_DOCUMENT_REVISION_CHANNEL, command);
      try {
        return parseDocumentRevisionContentProjection(value);
      } catch {
        throw new Error("Invalid Document revision content");
      }
    },
    restoreDocumentRevision: async (input) => {
      const command = parseRestoreDocumentRevisionCommand(input);
      const value = await invoke(
        VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
        command,
      );
      try {
        return parseRestoreDocumentRevisionResult(value);
      } catch {
        throw new Error("Invalid Document revision restore result");
      }
    },
    createWorkSnapshot: async (input) => {
      const command = parseCreateWorkSnapshotCommand(input);
      const value = await invoke(VERSION_CREATE_WORK_SNAPSHOT_CHANNEL, command);
      try {
        return parseWorkSnapshotProjection(value);
      } catch {
        throw new Error("Invalid WorkSnapshot creation result");
      }
    },
    listWorkSnapshots: async (input) => {
      const command = parseListWorkSnapshotsCommand(input);
      const value = await invoke(VERSION_LIST_WORK_SNAPSHOTS_CHANNEL, command);
      try {
        return parseWorkSnapshotListProjection(value);
      } catch {
        throw new Error("Invalid WorkSnapshot list");
      }
    },
  });
}
