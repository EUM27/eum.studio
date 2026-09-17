import { createHash,randomUUID } from "node:crypto";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { CompareWorkSnapshotCommand,MaterializedWorkSnapshotDocument,WorkSnapshotComparisonProjection } from "../../../application/revisions/work-snapshot-comparison";
import { deriveWorkSnapshotComparison,parseCompareWorkSnapshotCommand } from "../../../application/revisions/work-snapshot-comparison";
import type { PlanWorkSnapshotSceneSelectionCommand,WorkSnapshotSceneSelectionPlan } from "../../../application/revisions/work-snapshot-scene-plan";
import { parsePlanWorkSnapshotSceneSelectionCommand,parseWorkSnapshotSceneSelectionPlan } from "../../../application/revisions/work-snapshot-scene-plan";
import type { CreateWorkSnapshotCommand,DocumentRevisionContentProjection,DocumentRevisionListProjection,ListDocumentRevisionsCommand,ListWorkSnapshotsCommand,ReadDocumentRevisionCommand,RestoreDocumentRevisionCommand,RestoreDocumentRevisionResult,WorkSnapshotListProjection,WorkSnapshotProjection } from "../../../application/revisions/work-version-contract";
import { parseCreateWorkSnapshotCommand,parseDocumentRevisionContentProjection,parseDocumentRevisionListProjection,parseListDocumentRevisionsCommand,parseListWorkSnapshotsCommand,parseReadDocumentRevisionCommand,parseRestoreDocumentRevisionCommand,parseRestoreDocumentRevisionResult,parseWorkSnapshotListProjection } from "../../../application/revisions/work-version-contract";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import { DOCUMENT_REVISION_ROWS_SQL,readRevisionEditorStateJson,WORK_SNAPSHOT_ROWS_SQL,WORK_STRUCTURE_REVISION_ROWS_SQL } from "../repositories/revisions";
import { readNullableIdentity,readRequiredInteger,readRequiredString } from "../repositories/scalars";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";
import type { SceneGeometryService } from "./scene-geometry";
import type { WorkspaceService } from "./workspace";

/** Owns manuscript history commands and their existing transaction boundaries. */
export class ManuscriptHistoryService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #revisionStore: RevisionStore;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #workspace: Pick<WorkspaceService, "reload">;
  readonly #scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly revisionStore: RevisionStore;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly workspace: Pick<WorkspaceService, "reload">;
    readonly scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#revisionStore = input.revisionStore;
    this.#ledger = input.ledger;
    this.#infrastructure = input.infrastructure;
    this.#workspace = input.workspace;
    this.#scene_geometry = input.scene_geometry;
  }

  listDocumentRevisions(
    value: unknown,
  ): Promise<DocumentRevisionListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListDocumentRevisionsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listDocumentRevisionsSerially(command),
    );
  }

  readDocumentRevision(
    value: unknown,
  ): Promise<DocumentRevisionContentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseReadDocumentRevisionCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#readDocumentRevisionSerially(command)
    );
  }

  restoreDocumentRevision(
    value: unknown,
  ): Promise<RestoreDocumentRevisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseRestoreDocumentRevisionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#restoreDocumentRevisionSerially(command);
    });

    return execution;
  }

  createWorkSnapshot(value: unknown): Promise<WorkSnapshotProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateWorkSnapshotCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createWorkSnapshotSerially(command);
    });

    return execution;
  }

  listWorkSnapshots(value: unknown): Promise<WorkSnapshotListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListWorkSnapshotsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listWorkSnapshotsSerially(command),
    );
  }

  compareWorkSnapshot(value: unknown): Promise<WorkSnapshotComparisonProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCompareWorkSnapshotCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#compareWorkSnapshotSerially(command),
    );
  }

  planWorkSnapshotSceneSelection(value:unknown):Promise<WorkSnapshotSceneSelectionPlan>{
    this.#infrastructure.assertOpen();const command=parsePlanWorkSnapshotSceneSelectionCommand(value);
    return this.#operations.readBarrier().then(()=>
      this.#planWorkSnapshotSceneSelectionSerially(command)
    );
  }

  #listDocumentRevisionsSerially(
    command: ListDocumentRevisionsCommand,
  ): DocumentRevisionListProjection {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const revisions = this.#database
      .prepare(DOCUMENT_REVISION_ROWS_SQL)
      .all(command.workId, command.documentId)
      .map((row, index) => {
        const label = `Document revision rows[${index}]`;
        const isCurrent = readRequiredInteger(row, "isCurrent", label);
        if (isCurrent !== 0 && isCurrent !== 1) {
          throw new Error(`${label}.isCurrent must be zero or one`);
        }
        return {
          schemaVersion: 1,
          revisionId: readRequiredString(row, "revisionId", label),
          workId: readRequiredString(row, "workId", label),
          documentId: readRequiredString(row, "documentId", label),
          parentRevisionId: readNullableIdentity<"DocumentRevision">(
            row,
            "parentRevisionId",
            label,
          ),
          length: readRequiredInteger(row, "length", label),
          cause: readRequiredString(row, "cause", label),
          createdAt: readRequiredString(row, "createdAt", label),
          durableAt: readRequiredString(row, "durableAt", label),
          isCurrent: isCurrent === 1,
        };
      });
    return parseDocumentRevisionListProjection({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      revisions,
    });
  }

  async #readDocumentRevisionSerially(
    command: ReadDocumentRevisionCommand,
  ): Promise<DocumentRevisionContentProjection> {
    const revisions = this.#listDocumentRevisionsSerially(command);
    const revision = revisions.revisions.find(
      (candidate) => candidate.revisionId === command.revisionId,
    );
    if (revision === undefined) {
      throw new Error(
        `DocumentRevision is outside its Document: ${command.revisionId}`,
      );
    }
    return parseDocumentRevisionContentProjection({
      schemaVersion: 1,
      revision,
      text: await this.#revisionStore.materialize(command.revisionId),
    });
  }

  async #restoreDocumentRevisionSerially(
    command: RestoreDocumentRevisionCommand,
  ): Promise<RestoreDocumentRevisionResult> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const revisions = this.#listDocumentRevisionsSerially(command);
    if (
      !revisions.revisions.some(
        (revision) => revision.revisionId === command.targetRevisionId,
      )
    ) {
      throw new Error(
        `DocumentRevision is outside its Document: ${command.targetRevisionId}`,
      );
    }
    const restoredText = await this.#revisionStore.materialize(
      command.targetRevisionId,
    );
    const restoredEditorStateJson = readRevisionEditorStateJson(
      this.#database,
      {
        revisionId: command.targetRevisionId,
        workId: command.workId,
        documentId: command.documentId,
      },
    );
    const restoredAt = new Date().toISOString();
    const restored = await this.#revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: command.workId,
      documentId: command.documentId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: restoredText,
      ...(restoredEditorStateJson === undefined
        ? {}
        : { editorStateJson: restoredEditorStateJson }),
      cause: JSON.stringify({
        kind: "restore-document-revision",
        targetRevisionId: command.targetRevisionId,
      }),
      createdAt: restoredAt,
      durableAt: restoredAt,
    });
    target.baseRevisionId = restored.id;
    target.currentRevisionId = restored.id;
    target.nextSequence = 0;
    target.text = restoredText;
    await this.#workspace.reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
    });
    return parseRestoreDocumentRevisionResult({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      targetRevisionId: command.targetRevisionId,
      restoredRevisionId: restored.id,
    });
  }

  async #createWorkSnapshotSerially(
    command: CreateWorkSnapshotCommand,
  ): Promise<WorkSnapshotProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const documentRevisions = [...this.#state.documentTargets.values()]
      .filter((target) => target.workId === command.workId)
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map((target) => ({
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
      }));
    const structureRevisionRefs = this.#database
      .prepare(WORK_STRUCTURE_REVISION_ROWS_SQL)
      .all(
        command.workId,
        command.workId,
        command.workId,
        command.workId,
        command.workId,
        command.workId,
      )
      .map((row, index) => {
        const label = `Work structure revision rows[${index}]`;
        return {
          entityKind: readRequiredString(row, "entityKind", label),
          entityId: readRequiredString(row, "entityId", label),
          revision: readRequiredInteger(row, "revision", label),
        };
      });
    const sceneProjection=await this.#scene_geometry.listSceneProjectionSerially({schemaVersion:1,workId:command.workId});
    const sceneSegmentsById=new Map<string,Record<string,unknown>>();
    for(const scene of sceneProjection.scenes){for(const segment of scene.sceneIdentity?.segments??[]){if(segment.range===null||segment.integrity!=="resolved")continue;sceneSegmentsById.set(segment.segmentId,{entityKind:"SceneSnapshotSegment",entityId:segment.segmentId,revision:1,sceneId:segment.sceneId,documentId:segment.documentId,documentRevisionId:segment.documentRevisionId,documentTitle:segment.documentTitle,documentIndex:segment.documentIndex,from:segment.range.start,to:segment.range.end});}}
    const structureSnapshotEntries=[...structureRevisionRefs,{entityKind:"SceneSnapshotManifest",entityId:command.workId,revision:1},...[...sceneSegmentsById.values()].sort((a,b)=>String(a.entityId).localeCompare(String(b.entityId)))];
    const structureRevisionRefsJson = JSON.stringify(structureSnapshotEntries);
    const manifest = JSON.stringify({
      schemaVersion: 1,
      workId: command.workId,
      documentRevisions,
      structureRevisionRefs:structureSnapshotEntries,
    });
    const manifestHash = createHash(
      LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    )
      .update(manifest, "utf8")
      .digest("hex");
    const createdAt = new Date().toISOString();
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "workSnapshot",
        id: workSnapshotId,
        workId: command.workId,
        documentRevisions,
        structureRevisionRefsJson,
        manifestHash,
        label: command.label,
        cause: "manual",
        createdAt,
      });
    });
    const snapshots = this.#listWorkSnapshotsSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = snapshots.snapshots.find(
      (snapshot) => snapshot.workSnapshotId === workSnapshotId,
    );
    if (created === undefined) {
      throw new Error(`Stored WorkSnapshot is missing: ${workSnapshotId}`);
    }
    return created;
  }

  #listWorkSnapshotsSerially(
    command: ListWorkSnapshotsCommand,
  ): WorkSnapshotListProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = this.#database
      .prepare(WORK_SNAPSHOT_ROWS_SQL)
      .all(command.workId);
    const snapshots = new Map<
      EntityId<"WorkSnapshot">,
      {
        readonly schemaVersion: 1;
        readonly workSnapshotId: EntityId<"WorkSnapshot">;
        readonly workId: EntityId<"Work">;
        readonly label: string;
        readonly cause: string;
        readonly manifestHash: string;
        readonly createdAt: string;
        readonly documentRevisions: Array<{
          readonly documentId: EntityId<"Document">;
          readonly documentRevisionId: EntityId<"DocumentRevision">;
        }>;
      }
    >();
    rows.forEach((row, index) => {
      const label = `Work snapshot rows[${index}]`;
      const workSnapshotId = entityId<"WorkSnapshot">(
        readRequiredString(row, "workSnapshotId", label),
      );
      let snapshot = snapshots.get(workSnapshotId);
      if (snapshot === undefined) {
        snapshot = {
          schemaVersion: 1,
          workSnapshotId,
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          label: readRequiredString(row, "label", label),
          cause: readRequiredString(row, "cause", label),
          manifestHash: readRequiredString(row, "manifestHash", label),
          createdAt: readRequiredString(row, "createdAt", label),
          documentRevisions: [],
        };
        snapshots.set(workSnapshotId, snapshot);
      }
      const documentId = row.documentId;
      const documentRevisionId = row.documentRevisionId;
      if (documentId === null && documentRevisionId === null) {
        return;
      }
      if (
        typeof documentId !== "string" ||
        documentId.length === 0 ||
        typeof documentRevisionId !== "string" ||
        documentRevisionId.length === 0
      ) {
        throw new Error(`${label} has an incomplete DocumentRevision entry`);
      }
      snapshot.documentRevisions.push({
        documentId: entityId<"Document">(documentId),
        documentRevisionId: entityId<"DocumentRevision">(
          documentRevisionId,
        ),
      });
    });
    return parseWorkSnapshotListProjection({
      schemaVersion: 1,
      workId: command.workId,
      snapshots: [...snapshots.values()],
    });
  }

  async #compareWorkSnapshotSerially(
    command: CompareWorkSnapshotCommand,
  ): Promise<WorkSnapshotComparisonProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const snapshot = this.#listWorkSnapshotsSerially({
      schemaVersion: 1,
      workId: command.workId,
    }).snapshots.find(
      (candidate) => candidate.workSnapshotId === command.workSnapshotId,
    );
    if (snapshot === undefined) {
      throw new Error(
        `Unknown WorkSnapshot for Work: ${command.workSnapshotId}/${command.workId}`,
      );
    }
    const titleRows = this.#database
      .prepare(`
        SELECT id AS "documentId", title
        FROM documents
        WHERE work_id = ?
      `)
      .all(command.workId);
    const titleByDocument = new Map<EntityId<"Document">, string>();
    titleRows.forEach((row, index) => {
      const label = `WorkSnapshot comparison Document rows[${index}]`;
      const documentId = entityId<"Document">(
        readRequiredString(row, "documentId", label),
      );
      if (titleByDocument.has(documentId)) {
        throw new Error(`Duplicate Document for WorkSnapshot comparison: ${documentId}`);
      }
      titleByDocument.set(
        documentId,
        readRequiredString(row, "title", label),
      );
    });
    const materialize = async (input: {
      readonly documentId: EntityId<"Document">;
      readonly documentRevisionId: EntityId<"DocumentRevision">;
      readonly title: string;
    }): Promise<MaterializedWorkSnapshotDocument> => {
      const revision = await this.#revisionStore.getRevision(
        input.documentRevisionId,
      );
      if (revision === null || revision.documentId !== input.documentId) {
        throw new Error(
          `WorkSnapshot revision is outside Document: ${input.documentRevisionId}/${input.documentId}`,
        );
      }
      return Object.freeze({
        ...input,
        text: await this.#revisionStore.materialize(input.documentRevisionId),
      });
    };
    const snapshotDocuments = await Promise.all(
      snapshot.documentRevisions.map((reference) => {
        const title = titleByDocument.get(reference.documentId);
        if (title === undefined) {
          throw new Error(
            `WorkSnapshot Document is outside Work: ${reference.documentId}`,
          );
        }
        return materialize({ ...reference, title });
      }),
    );
    const currentDocuments = await Promise.all(
      work.documents.map((document) => {
        const target = this.#state.documentTargets.get(document.documentId);
        if (target === undefined || target.workId !== command.workId) {
          throw new Error(
            `Current WorkSnapshot comparison target is outside Work: ${document.documentId}`,
          );
        }
        return materialize({
          documentId: document.documentId,
          documentRevisionId: target.currentRevisionId,
          title: document.title,
        });
      }),
    );
    return deriveWorkSnapshotComparison({
      command,
      snapshot,
      snapshotDocuments,
      currentDocuments,
    });
  }

  async #planWorkSnapshotSceneSelectionSerially(
    command:PlanWorkSnapshotSceneSelectionCommand,
  ):Promise<WorkSnapshotSceneSelectionPlan>{
    if(!this.#state.catalog.works.some((work)=>work.workId===command.workId))throw new Error(`Unknown Work: ${command.workId}`);
    const rows=this.#database.prepare(`SELECT label,structure_revision_refs_json AS "structureJson" FROM work_snapshots WHERE work_id=? AND id=?`).all(command.workId,command.workSnapshotId);
    if(rows.length!==1)throw new Error(`Unknown WorkSnapshot for Work: ${command.workSnapshotId}/${command.workId}`);
    const row=rows[0]!,slotName=readRequiredString(row,"label","WorkSnapshot Scene plan");
    const structureJson=readRequiredString(row,"structureJson","WorkSnapshot Scene plan");
    let entries:unknown;try{entries=JSON.parse(structureJson);}catch{throw new Error("WorkSnapshot structure manifest is invalid JSON");}
    if(!Array.isArray(entries))throw new Error("WorkSnapshot structure manifest must be an array");
    const records=entries.filter((entry):entry is Record<string,unknown>=>typeof entry==="object"&&entry!==null&&!Array.isArray(entry));
    const snapshotSceneMetadataAvailable=records.some((entry)=>entry.entityKind==="SceneSnapshotManifest");
    type StoredSegment=Readonly<{sceneId:EntityId<"Scene">;documentId:EntityId<"Document">;documentRevisionId:EntityId<"DocumentRevision">;documentTitle:string;from:number;to:number}>;
    const snapshotSegments:StoredSegment[]=records.filter((entry)=>entry.entityKind==="SceneSnapshotSegment").map((entry,index)=>{const label=`WorkSnapshot Scene segment[${index}]`;const from=readRequiredInteger(entry,"from",label),to=readRequiredInteger(entry,"to",label);if(from<0||to<from)throw new Error(`${label} range is invalid`);return Object.freeze({sceneId:entityId<"Scene">(readRequiredString(entry,"sceneId",label)),documentId:entityId<"Document">(readRequiredString(entry,"documentId",label)),documentRevisionId:entityId<"DocumentRevision">(readRequiredString(entry,"documentRevisionId",label)),documentTitle:readRequiredString(entry,"documentTitle",label),from,to});});
    const currentProjection=await this.#scene_geometry.listSceneProjectionSerially({schemaVersion:1,workId:command.workId});
    const currentBySegment=new Map<string,StoredSegment>();
    for(const scene of currentProjection.scenes){for(const segment of scene.sceneIdentity?.segments??[]){if(segment.range===null||segment.integrity!=="resolved")continue;currentBySegment.set(segment.segmentId,Object.freeze({sceneId:segment.sceneId,documentId:segment.documentId,documentRevisionId:segment.documentRevisionId,documentTitle:segment.documentTitle,from:segment.range.start,to:segment.range.end}));}}
    const currentSegments=[...currentBySegment.values()];
    const materialized=new Map<string,string>();
    const projectSegments=async(segments:readonly StoredSegment[])=>Promise.all([...segments].sort((a,b)=>String(a.documentId).localeCompare(String(b.documentId))||a.from-b.from).map(async(segment)=>{let text=materialized.get(segment.documentRevisionId);if(text===undefined){const revision=await this.#revisionStore.getRevision(segment.documentRevisionId);if(revision===null||revision.documentId!==segment.documentId)throw new Error(`WorkSnapshot Scene revision is outside Document: ${segment.documentRevisionId}`);text=await this.#revisionStore.materialize(segment.documentRevisionId);materialized.set(segment.documentRevisionId,text);}if(segment.to>text.length)throw new Error(`WorkSnapshot Scene range is outside revision: ${segment.sceneId}`);return{documentId:segment.documentId,documentRevisionId:segment.documentRevisionId,documentTitle:segment.documentTitle,range:{from:segment.from,to:segment.to},excerpt:text.slice(segment.from,segment.to)};}));
    const snapshotByScene=new Map<EntityId<"Scene">,StoredSegment[]>(),currentByScene=new Map<EntityId<"Scene">,StoredSegment[]>();
    for(const segment of snapshotSegments){const group=snapshotByScene.get(segment.sceneId)??[];group.push(segment);snapshotByScene.set(segment.sceneId,group);}for(const segment of currentSegments){const group=currentByScene.get(segment.sceneId)??[];group.push(segment);currentByScene.set(segment.sceneId,group);}
    const sceneIds=[...new Set([...snapshotByScene.keys(),...currentByScene.keys()])].sort((a,b)=>String(a).localeCompare(String(b)));
    const selected=new Set(command.selectedSceneIds);for(const sceneId of selected){if(!sceneIds.includes(sceneId))throw new Error(`Selected WorkSnapshot Scene is unavailable: ${sceneId}`);}
    const scenes=[];for(const sceneId of sceneIds){const previous=snapshotByScene.get(sceneId)??[],current=currentByScene.get(sceneId)??[];const fingerprint=(segments:readonly StoredSegment[])=>JSON.stringify([...segments].sort((a,b)=>String(a.documentId).localeCompare(String(b.documentId))||a.from-b.from).map((segment)=>[segment.documentId,segment.documentRevisionId,segment.from,segment.to]));const status=!snapshotSceneMetadataAvailable?"snapshot-structure-unavailable" as const:previous.length===0?"added-after-snapshot" as const:current.length===0?"removed-after-snapshot" as const:fingerprint(previous)===fingerprint(current)?"unchanged" as const:"changed" as const;if(status==="snapshot-structure-unavailable"&&selected.has(sceneId))throw new Error(`Selected WorkSnapshot Scene has no snapshot structure metadata: ${sceneId}`);scenes.push({sceneId,status,selected:selected.has(sceneId),snapshotSegments:await projectSegments(previous),currentSegments:await projectSegments(current)});}
    return parseWorkSnapshotSceneSelectionPlan({schemaVersion:1,workId:command.workId,workSnapshotId:command.workSnapshotId,slotName,mode:"read-only-selection-plan",automaticMergeAllowed:false,canApply:false,applyCommand:null,snapshotSceneMetadataAvailable,scenes});
  }
}

