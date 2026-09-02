import { entityId,type EntityId } from "../../domain/writing";

export type SceneCanonContinuityProjection=Readonly<{
  threadId:EntityId<"ContinuityThread">;revision:number;title:string;status:"open"|"resolved"|"dismissed";
}>;
export type SceneCanonKnowledgeProjection=Readonly<{
  knowledgeId:EntityId<"CharacterKnowledge">;revision:number;characterId:EntityId<"Character">;statement:string;
  stance:"knows"|"believes"|"suspects"|"denies"|"unaware";truthStatus:"true"|"false"|"unknown";status:"active"|"superseded"|"retired";
}>;
export type SceneLineageReferenceReview=Readonly<{
  lineageOperationId:EntityId<"SceneLineageOperation">;operation:"split"|"merge";
  parentSceneIds:readonly EntityId<"Scene">[];childSceneIds:readonly EntityId<"Scene">[];
  sourceSceneId:EntityId<"Scene">;candidateSceneIds:readonly EntityId<"Scene">[];
  referenceKind:"continuity-thread"|"character-knowledge";referenceId:string;
  status:"current"|"needs-review";
}>;
export type SceneCanonContextProjection=Readonly<{
  schemaVersion:1;workId:EntityId<"Work">;sceneId:EntityId<"Scene">;
  continuity:readonly SceneCanonContinuityProjection[];knowledge:readonly SceneCanonKnowledgeProjection[];
  lineageReviews:readonly SceneLineageReferenceReview[];
}>;
export type SceneCanonContextListProjection=Readonly<{
  schemaVersion:1;workId:EntityId<"Work">;contexts:readonly SceneCanonContextProjection[];
}>;
export type ListSceneCanonContextsCommand=Readonly<{schemaVersion:1;workId:EntityId<"Work">}>;
export type FinalizeSceneCanonCheckCommand=Readonly<{
  schemaVersion:1;workId:EntityId<"Work">;sceneKey:string;documentId:EntityId<"Document">;
  documentRevisionId:EntityId<"DocumentRevision">;from:number;to:number;
}>;
export type SceneCanonCheckProjection=Readonly<{
  schemaVersion:1;workId:EntityId<"Work">;sceneId:EntityId<"Scene">;sceneKey:string;
  sourceRange:Readonly<{documentId:EntityId<"Document">;documentRevisionId:EntityId<"DocumentRevision">;from:number;to:number}>;
}>;

export type SceneLineageOperationInput=Readonly<{
  lineageOperationId:EntityId<"SceneLineageOperation">;operation:"split"|"merge";
  parentSceneIds:readonly EntityId<"Scene">[];childSceneIds:readonly EntityId<"Scene">[];
}>;
export type SceneReferenceInput=Readonly<{
  referenceKind:"continuity-thread"|"character-knowledge";referenceId:string;sceneId:EntityId<"Scene">;
}>;

function nonEmpty(value:unknown,label:string):string{if(typeof value!=="string"||value.trim().length===0)throw new Error(`${label} must be non-empty text`);return value.trim();}
function positive(value:unknown,label:string):number{if(typeof value!=="number"||!Number.isSafeInteger(value)||value<1)throw new Error(`${label} must be a positive integer`);return value;}
function record(value:unknown,label:string):Record<string,unknown>{if(typeof value!=="object"||value===null||Array.isArray(value))throw new Error(`${label} must be an object`);return value as Record<string,unknown>;}
function exact(input:Record<string,unknown>,fields:readonly string[],label:string):void{const set=new Set(fields);if(Object.keys(input).length!==set.size||Object.keys(input).some((field)=>!set.has(field)))throw new Error(`${label} fields do not match the schema`);}
function ids<TEntity extends string>(value:unknown,label:string):readonly EntityId<TEntity>[] {if(!Array.isArray(value))throw new Error(`${label} must be an array`);const result=value.map((entry,index)=>entityId<TEntity>(nonEmpty(entry,`${label}[${index}]`)));if(new Set(result).size!==result.length)throw new Error(`${label} contains duplicates`);return Object.freeze(result);}

export function deriveSceneLineageReferenceReviews(
  operations:readonly SceneLineageOperationInput[],references:readonly SceneReferenceInput[],
):readonly SceneLineageReferenceReview[]{
  const reviews=operations.flatMap((operation)=>references.flatMap((reference)=>{
    if(!operation.parentSceneIds.includes(reference.sceneId))return[];
    const broadens=operation.operation==="merge"&&operation.parentSceneIds.length>1;
    const status=operation.childSceneIds.length===1&&operation.childSceneIds[0]===reference.sceneId&&!broadens?"current" as const:"needs-review" as const;
    return[Object.freeze({...operation,sourceSceneId:reference.sceneId,candidateSceneIds:Object.freeze([...operation.childSceneIds]),referenceKind:reference.referenceKind,referenceId:reference.referenceId,status})];
  }));
  return Object.freeze(reviews.sort((a,b)=>String(a.lineageOperationId).localeCompare(String(b.lineageOperationId))||a.referenceKind.localeCompare(b.referenceKind)||a.referenceId.localeCompare(b.referenceId)));
}

export function parseListSceneCanonContextsCommand(value:unknown):ListSceneCanonContextsCommand{const input=record(value,"ListSceneCanonContextsCommand");exact(input,["schemaVersion","workId"],"ListSceneCanonContextsCommand");if(input.schemaVersion!==1)throw new Error("ListSceneCanonContextsCommand.schemaVersion must be 1");return Object.freeze({schemaVersion:1,workId:entityId<"Work">(nonEmpty(input.workId,"ListSceneCanonContextsCommand.workId"))});}

export function parseFinalizeSceneCanonCheckCommand(value:unknown):FinalizeSceneCanonCheckCommand{const label="FinalizeSceneCanonCheckCommand",input=record(value,label);exact(input,["schemaVersion","workId","sceneKey","documentId","documentRevisionId","from","to"],label);if(input.schemaVersion!==1||typeof input.from!=="number"||typeof input.to!=="number"||!Number.isSafeInteger(input.from)||!Number.isSafeInteger(input.to)||input.from<0||input.to<=input.from)throw new Error(`${label} is invalid`);return Object.freeze({schemaVersion:1,workId:entityId<"Work">(nonEmpty(input.workId,`${label}.workId`)),sceneKey:nonEmpty(input.sceneKey,`${label}.sceneKey`),documentId:entityId<"Document">(nonEmpty(input.documentId,`${label}.documentId`)),documentRevisionId:entityId<"DocumentRevision">(nonEmpty(input.documentRevisionId,`${label}.documentRevisionId`)),from:input.from,to:input.to});}

export function parseSceneCanonCheckProjection(value:unknown):SceneCanonCheckProjection{const label="SceneCanonCheckProjection",input=record(value,label);exact(input,["schemaVersion","workId","sceneId","sceneKey","sourceRange"],label);if(input.schemaVersion!==1)throw new Error(`${label}.schemaVersion must be 1`);const range=record(input.sourceRange,`${label}.sourceRange`);exact(range,["documentId","documentRevisionId","from","to"],`${label}.sourceRange`);if(typeof range.from!=="number"||typeof range.to!=="number"||!Number.isSafeInteger(range.from)||!Number.isSafeInteger(range.to)||range.from<0||range.to<=range.from)throw new Error(`${label}.sourceRange is invalid`);return Object.freeze({schemaVersion:1,workId:entityId<"Work">(nonEmpty(input.workId,`${label}.workId`)),sceneId:entityId<"Scene">(nonEmpty(input.sceneId,`${label}.sceneId`)),sceneKey:nonEmpty(input.sceneKey,`${label}.sceneKey`),sourceRange:Object.freeze({documentId:entityId<"Document">(nonEmpty(range.documentId,`${label}.sourceRange.documentId`)),documentRevisionId:entityId<"DocumentRevision">(nonEmpty(range.documentRevisionId,`${label}.sourceRange.documentRevisionId`)),from:range.from,to:range.to})});}

export function parseSceneCanonContextListProjection(value:unknown):SceneCanonContextListProjection{
  const input=record(value,"SceneCanonContextListProjection");exact(input,["schemaVersion","workId","contexts"],"SceneCanonContextListProjection");if(input.schemaVersion!==1||!Array.isArray(input.contexts))throw new Error("SceneCanonContextListProjection is invalid");const workId=entityId<"Work">(nonEmpty(input.workId,"SceneCanonContextListProjection.workId"));
  const contexts=input.contexts.map((raw,index)=>{const row=record(raw,`SceneCanonContext[${index}]`);exact(row,["schemaVersion","workId","sceneId","continuity","knowledge","lineageReviews"],`SceneCanonContext[${index}]`);if(row.schemaVersion!==1||row.workId!==workId||!Array.isArray(row.continuity)||!Array.isArray(row.knowledge)||!Array.isArray(row.lineageReviews))throw new Error(`SceneCanonContext[${index}] is invalid`);
    const continuity=row.continuity.map((rawEntry,entryIndex)=>{const entry=record(rawEntry,`continuity[${entryIndex}]`);exact(entry,["threadId","revision","title","status"],`continuity[${entryIndex}]`);if(entry.status!=="open"&&entry.status!=="resolved"&&entry.status!=="dismissed")throw new Error("Scene continuity status is invalid");return Object.freeze({threadId:entityId<"ContinuityThread">(nonEmpty(entry.threadId,"threadId")),revision:positive(entry.revision,"revision"),title:nonEmpty(entry.title,"title"),status:entry.status});});
    const knowledge=row.knowledge.map((rawEntry,entryIndex)=>{const entry=record(rawEntry,`knowledge[${entryIndex}]`);exact(entry,["knowledgeId","revision","characterId","statement","stance","truthStatus","status"],`knowledge[${entryIndex}]`);if(!["knows","believes","suspects","denies","unaware"].includes(String(entry.stance))||!["true","false","unknown"].includes(String(entry.truthStatus))||!["active","superseded","retired"].includes(String(entry.status)))throw new Error("Scene knowledge state is invalid");return Object.freeze({knowledgeId:entityId<"CharacterKnowledge">(nonEmpty(entry.knowledgeId,"knowledgeId")),revision:positive(entry.revision,"revision"),characterId:entityId<"Character">(nonEmpty(entry.characterId,"characterId")),statement:nonEmpty(entry.statement,"statement"),stance:entry.stance as SceneCanonKnowledgeProjection["stance"],truthStatus:entry.truthStatus as SceneCanonKnowledgeProjection["truthStatus"],status:entry.status as SceneCanonKnowledgeProjection["status"]});});
    const lineageReviews=row.lineageReviews.map((rawEntry,entryIndex)=>{const entry=record(rawEntry,`lineageReviews[${entryIndex}]`);exact(entry,["lineageOperationId","operation","parentSceneIds","childSceneIds","sourceSceneId","candidateSceneIds","referenceKind","referenceId","status"],`lineageReviews[${entryIndex}]`);if((entry.operation!=="split"&&entry.operation!=="merge")||(entry.referenceKind!=="continuity-thread"&&entry.referenceKind!=="character-knowledge")||(entry.status!=="current"&&entry.status!=="needs-review"))throw new Error("Scene lineage review is invalid");return Object.freeze({lineageOperationId:entityId<"SceneLineageOperation">(nonEmpty(entry.lineageOperationId,"lineageOperationId")),operation:entry.operation,parentSceneIds:ids<"Scene">(entry.parentSceneIds,"parentSceneIds"),childSceneIds:ids<"Scene">(entry.childSceneIds,"childSceneIds"),sourceSceneId:entityId<"Scene">(nonEmpty(entry.sourceSceneId,"sourceSceneId")),candidateSceneIds:ids<"Scene">(entry.candidateSceneIds,"candidateSceneIds"),referenceKind:entry.referenceKind,referenceId:nonEmpty(entry.referenceId,"referenceId"),status:entry.status});});
    return Object.freeze({schemaVersion:1 as const,workId,sceneId:entityId<"Scene">(nonEmpty(row.sceneId,"sceneId")),continuity:Object.freeze(continuity),knowledge:Object.freeze(knowledge),lineageReviews:Object.freeze(lineageReviews)});
  });
  if(new Set(contexts.map((context)=>context.sceneId)).size!==contexts.length)throw new Error("SceneCanonContextListProjection contains duplicate Scenes");return Object.freeze({schemaVersion:1,workId,contexts:Object.freeze(contexts)});
}
