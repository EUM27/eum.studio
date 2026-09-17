import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe,expect,it } from "vitest";
import { deriveSceneLineageReferenceReviews,type SceneLineageOperationInput,type SceneReferenceInput } from "../../src/application/structure/scene-canon-context";
import { entityId } from "../../src/domain/writing";
import fixture from "../fixtures/scene-canon-performance-profile.json";

function percentile(values:readonly number[],fraction:number):number{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*fraction)-1))]!;}
describe("Scene Canon performance",()=>{it("measures stable Scene lineage reference review projection",async()=>{
  const operations:SceneLineageOperationInput[]=Array.from({length:fixture.measurement.sceneCount},(_,index)=>{const source=entityId<"Scene">(`scene-${String(index).padStart(4,"0")}`);return{lineageOperationId:entityId(`operation-${String(index).padStart(4,"0")}`),operation:"split",parentSceneIds:[source],childSceneIds:[source,entityId<"Scene">(`scene-${String(index).padStart(4,"0")}-child`)]};});
  const references:SceneReferenceInput[]=Array.from({length:fixture.measurement.referenceCount},(_,index)=>({referenceKind:index%2===0?"continuity-thread":"character-knowledge",referenceId:`reference-${String(index).padStart(4,"0")}`,sceneId:operations[index%operations.length]!.parentSceneIds[0]!}));
  const timings:number[]=[];let reviewCount=0;for(let iteration=0;iteration<fixture.measurement.iterationCount;iteration+=1){const started=performance.now();const reviews=deriveSceneLineageReferenceReviews(iteration%2===0?operations:[...operations].reverse(),references);timings.push(performance.now()-started);reviewCount=reviews.length;expect(reviews.every((review)=>review.status==="needs-review")).toBe(true);}
  const report={schemaVersion:1,fixtureUse:fixture.fixtureUse,environment:{platform:process.platform,architecture:process.arch,node:process.version},rowCounts:{scenes:fixture.measurement.sceneCount,references:fixture.measurement.referenceCount,lineageReviews:reviewCount},timings:{lineageReviewProjectionMs:{raw:timings,p50:percentile(timings,0.5),p95:percentile(timings,0.95)}},automaticReferenceMutations:0,databaseBytes:{measured:false,growth:null,reason:"pure-application-harness"},rendererCommitCount:{measured:false,value:null,reason:"application-harness"}};
  const artifactPath=path.resolve("docs/verification/canon-continuity-gates-2-8/gate-6-scene-canon-performance.json");await mkdir(path.dirname(artifactPath),{recursive:true});await writeFile(artifactPath,`${JSON.stringify(report,null,2)}\n`,"utf8");expect(JSON.parse(await readFile(artifactPath,"utf8"))).toEqual(report);
});});
