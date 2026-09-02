import { entityId,type EntityId } from "../../domain/writing";
import type { WorkSnapshotProjection } from "./work-version-contract";

export type WorkSnapshotSlotProjection=Readonly<{
  slotName:string;current:WorkSnapshotProjection;history:readonly WorkSnapshotProjection[];
}>;
export type PlanWorkSnapshotSceneSelectionCommand=Readonly<{
  schemaVersion:1;workId:EntityId<"Work">;workSnapshotId:EntityId<"WorkSnapshot">;selectedSceneIds:readonly EntityId<"Scene">[];
}>;
export type WorkSnapshotSceneSegmentComparison=Readonly<{
  documentId:EntityId<"Document">;documentRevisionId:EntityId<"DocumentRevision">;documentTitle:string;
  range:Readonly<{from:number;to:number}>;excerpt:string;
}>;
export type WorkSnapshotSceneSelectionItem=Readonly<{
  sceneId:EntityId<"Scene">;status:"unchanged"|"changed"|"added-after-snapshot"|"removed-after-snapshot"|"snapshot-structure-unavailable";
  selected:boolean;snapshotSegments:readonly WorkSnapshotSceneSegmentComparison[];currentSegments:readonly WorkSnapshotSceneSegmentComparison[];
}>;
export type WorkSnapshotSceneSelectionPlan=Readonly<{
  schemaVersion:1;workId:EntityId<"Work">;workSnapshotId:EntityId<"WorkSnapshot">;slotName:string;
  mode:"read-only-selection-plan";automaticMergeAllowed:false;canApply:false;applyCommand:null;
  snapshotSceneMetadataAvailable:boolean;scenes:readonly WorkSnapshotSceneSelectionItem[];
}>;

function record(value:unknown,label:string):Record<string,unknown>{if(typeof value!=="object"||value===null||Array.isArray(value))throw new Error(`${label} must be an object`);return value as Record<string,unknown>;}
function exact(input:Record<string,unknown>,fields:readonly string[],label:string):void{const set=new Set(fields);if(Object.keys(input).length!==set.size||Object.keys(input).some((field)=>!set.has(field)))throw new Error(`${label} fields do not match the schema`);}
function text(value:unknown,label:string):string{if(typeof value!=="string"||value.trim().length===0)throw new Error(`${label} must be non-empty text`);return value.trim();}
function integer(value:unknown,label:string):number{if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} must be a non-negative integer`);return value;}

export function deriveWorkSnapshotSlots(snapshots:readonly WorkSnapshotProjection[]):readonly WorkSnapshotSlotProjection[]{
  const groups=new Map<string,WorkSnapshotProjection[]>();for(const snapshot of snapshots){const slotName=snapshot.label.trim();if(slotName.length===0)throw new Error("WorkSnapshot slot name must be non-empty");const group=groups.get(slotName)??[];group.push(snapshot);groups.set(slotName,group);}
  const slots=[...groups.entries()].map(([slotName,entries])=>{const sorted=[...entries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||String(b.workSnapshotId).localeCompare(String(a.workSnapshotId)));return Object.freeze({slotName,current:sorted[0]!,history:Object.freeze(sorted.slice(1))});});
  return Object.freeze(slots.sort((a,b)=>b.current.createdAt.localeCompare(a.current.createdAt)||a.slotName.localeCompare(b.slotName)));
}

export function parsePlanWorkSnapshotSceneSelectionCommand(value:unknown):PlanWorkSnapshotSceneSelectionCommand{const label="PlanWorkSnapshotSceneSelectionCommand",input=record(value,label);exact(input,["schemaVersion","workId","workSnapshotId","selectedSceneIds"],label);if(input.schemaVersion!==1||!Array.isArray(input.selectedSceneIds))throw new Error(`${label} is invalid`);const selectedSceneIds=input.selectedSceneIds.map((entry,index)=>entityId<"Scene">(text(entry,`${label}.selectedSceneIds[${index}]`)));if(new Set(selectedSceneIds).size!==selectedSceneIds.length)throw new Error(`${label}.selectedSceneIds contains duplicates`);return Object.freeze({schemaVersion:1,workId:entityId<"Work">(text(input.workId,`${label}.workId`)),workSnapshotId:entityId<"WorkSnapshot">(text(input.workSnapshotId,`${label}.workSnapshotId`)),selectedSceneIds:Object.freeze(selectedSceneIds)});}

function segment(value:unknown,label:string):WorkSnapshotSceneSegmentComparison{const input=record(value,label);exact(input,["documentId","documentRevisionId","documentTitle","range","excerpt"],label);const range=record(input.range,`${label}.range`);exact(range,["from","to"],`${label}.range`);const from=integer(range.from,`${label}.range.from`),to=integer(range.to,`${label}.range.to`);if(to<from)throw new Error(`${label}.range is reversed`);if(typeof input.excerpt!=="string")throw new Error(`${label}.excerpt must be text`);return Object.freeze({documentId:entityId<"Document">(text(input.documentId,`${label}.documentId`)),documentRevisionId:entityId<"DocumentRevision">(text(input.documentRevisionId,`${label}.documentRevisionId`)),documentTitle:text(input.documentTitle,`${label}.documentTitle`),range:Object.freeze({from,to}),excerpt:input.excerpt});}

export function parseWorkSnapshotSceneSelectionPlan(value:unknown):WorkSnapshotSceneSelectionPlan{const label="WorkSnapshotSceneSelectionPlan",input=record(value,label);exact(input,["schemaVersion","workId","workSnapshotId","slotName","mode","automaticMergeAllowed","canApply","applyCommand","snapshotSceneMetadataAvailable","scenes"],label);if(input.schemaVersion!==1||input.mode!=="read-only-selection-plan"||input.automaticMergeAllowed!==false||input.canApply!==false||input.applyCommand!==null||typeof input.snapshotSceneMetadataAvailable!=="boolean"||!Array.isArray(input.scenes))throw new Error(`${label} must remain read-only`);const scenes=input.scenes.map((raw,index)=>{const row=record(raw,`${label}.scenes[${index}]`);exact(row,["sceneId","status","selected","snapshotSegments","currentSegments"],`${label}.scenes[${index}]`);if(!["unchanged","changed","added-after-snapshot","removed-after-snapshot","snapshot-structure-unavailable"].includes(String(row.status))||typeof row.selected!=="boolean"||!Array.isArray(row.snapshotSegments)||!Array.isArray(row.currentSegments))throw new Error(`${label}.scenes[${index}] is invalid`);return Object.freeze({sceneId:entityId<"Scene">(text(row.sceneId,`${label}.scenes[${index}].sceneId`)),status:row.status as WorkSnapshotSceneSelectionItem["status"],selected:row.selected,snapshotSegments:Object.freeze(row.snapshotSegments.map((entry,segmentIndex)=>segment(entry,`${label}.scenes[${index}].snapshotSegments[${segmentIndex}]`))),currentSegments:Object.freeze(row.currentSegments.map((entry,segmentIndex)=>segment(entry,`${label}.scenes[${index}].currentSegments[${segmentIndex}]`)))});});if(new Set(scenes.map((scene)=>scene.sceneId)).size!==scenes.length)throw new Error(`${label} contains duplicate Scenes`);const selected=new Set(scenes.filter((scene)=>scene.selected).map((scene)=>scene.sceneId));if(selected.size!==scenes.filter((scene)=>scene.selected).length)throw new Error(`${label} selection is invalid`);return Object.freeze({schemaVersion:1,workId:entityId<"Work">(text(input.workId,`${label}.workId`)),workSnapshotId:entityId<"WorkSnapshot">(text(input.workSnapshotId,`${label}.workSnapshotId`)),slotName:text(input.slotName,`${label}.slotName`),mode:"read-only-selection-plan",automaticMergeAllowed:false,canApply:false,applyCommand:null,snapshotSceneMetadataAvailable:input.snapshotSceneMetadataAvailable,scenes:Object.freeze(scenes)});}
