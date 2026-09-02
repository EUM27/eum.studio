import {
  deriveSceneLineageReferenceReviews,
  parseSceneCanonContextListProjection,
  type ListSceneCanonContextsCommand,
  type SceneCanonContextListProjection,
  type SceneLineageOperationInput,
  type SceneReferenceInput,
} from "../../application/structure/scene-canon-context";
import { entityId } from "../../domain/writing";

type Statement=Readonly<{all(...parameters:readonly unknown[]):readonly Record<string,unknown>[]}>;
export type SceneCanonContextDatabase=Readonly<{prepare(sql:string):Statement}>;
function text(row:Record<string,unknown>,field:string,label:string):string{const value=row[field];if(typeof value!=="string"||value.length===0)throw new Error(`${label}.${field} must be text`);return value;}
function integer(row:Record<string,unknown>,field:string,label:string):number{const value=row[field];if(typeof value!=="number"||!Number.isSafeInteger(value))throw new Error(`${label}.${field} must be integer`);return value;}

export function listLocalSceneCanonContexts(database:SceneCanonContextDatabase,command:ListSceneCanonContextsCommand):SceneCanonContextListProjection{
  if(database.prepare(`SELECT id FROM works WHERE id=? AND retired_at IS NULL`).all(command.workId).length!==1)throw new Error(`Unknown Work: ${command.workId}`);
  const sceneIds=database.prepare(`SELECT id FROM scene_identities WHERE work_id=? AND retired_at IS NULL ORDER BY id`).all(command.workId).map((row)=>entityId<"Scene">(text(row,"id","Scene identity")));
  const continuity=database.prepare(`SELECT ref.entity_id AS "sceneId",thread.id AS "threadId",thread.revision,thread.title,thread.status FROM continuity_thread_entity_refs ref JOIN continuity_threads thread ON thread.work_id=ref.work_id AND thread.id=ref.thread_id WHERE ref.work_id=? AND ref.entity_kind='scene' ORDER BY ref.entity_id,thread.updated_at DESC,thread.id`).all(command.workId);
  const knowledge=database.prepare(`SELECT ref.entity_id AS "sceneId",knowledge.id AS "knowledgeId",knowledge.revision,knowledge.character_id AS "characterId",knowledge.statement,knowledge.stance,knowledge.truth_status AS "truthStatus",knowledge.status FROM character_knowledge_entity_refs ref JOIN character_knowledge knowledge ON knowledge.work_id=ref.work_id AND knowledge.id=ref.knowledge_id WHERE ref.work_id=? AND ref.entity_kind='scene' ORDER BY ref.entity_id,knowledge.updated_at DESC,knowledge.id`).all(command.workId);
  const operationRows=database.prepare(`SELECT id,operation FROM scene_lineage_operations WHERE work_id=? AND retired_at IS NULL AND operation IN ('split','merge') ORDER BY created_at,id`).all(command.workId);
  const memberRows=database.prepare(`SELECT lineage_operation_id AS "operationId",scene_id AS "sceneId",role,ordinal FROM scene_lineage_members WHERE work_id=? AND retired_at IS NULL ORDER BY lineage_operation_id,role,ordinal`).all(command.workId);
  const operations:SceneLineageOperationInput[]=operationRows.map((row)=>{const operationId=entityId<"SceneLineageOperation">(text(row,"id","Lineage operation"));const members=memberRows.filter((member)=>member.operationId===operationId);return Object.freeze({lineageOperationId:operationId,operation:text(row,"operation","Lineage operation") as "split"|"merge",parentSceneIds:Object.freeze(members.filter((member)=>member.role==="parent").map((member)=>entityId<"Scene">(text(member,"sceneId","Lineage parent")))),childSceneIds:Object.freeze(members.filter((member)=>member.role==="child").map((member)=>entityId<"Scene">(text(member,"sceneId","Lineage child"))))});});
  const references:SceneReferenceInput[]=[
    ...continuity.map((row)=>({
      referenceKind:"continuity-thread" as const,
      referenceId:text(row,"threadId","Continuity reference"),
      sceneId:entityId<"Scene">(text(row,"sceneId","Continuity reference")),
    })),
    ...knowledge.map((row)=>({
      referenceKind:"character-knowledge" as const,
      referenceId:text(row,"knowledgeId","Knowledge reference"),
      sceneId:entityId<"Scene">(text(row,"sceneId","Knowledge reference")),
    })),
  ];
  const reviews=deriveSceneLineageReferenceReviews(operations,references);
  return parseSceneCanonContextListProjection({schemaVersion:1,workId:command.workId,contexts:sceneIds.map((sceneId)=>({schemaVersion:1,workId:command.workId,sceneId,continuity:continuity.filter((row)=>row.sceneId===sceneId).map((row)=>({threadId:text(row,"threadId","Continuity row"),revision:integer(row,"revision","Continuity row"),title:text(row,"title","Continuity row"),status:text(row,"status","Continuity row")})),knowledge:knowledge.filter((row)=>row.sceneId===sceneId).map((row)=>({knowledgeId:text(row,"knowledgeId","Knowledge row"),revision:integer(row,"revision","Knowledge row"),characterId:text(row,"characterId","Knowledge row"),statement:text(row,"statement","Knowledge row"),stance:text(row,"stance","Knowledge row"),truthStatus:text(row,"truthStatus","Knowledge row"),status:text(row,"status","Knowledge row")})),lineageReviews:reviews.filter((review)=>review.candidateSceneIds.includes(sceneId)||review.sourceSceneId===sceneId)}))});
}
