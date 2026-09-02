import { createHash } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { describe,expect,it } from "vitest";

import {
  createNarrativeDigestSourceManifestHash,
  parseNarrativeDigestSourceManifest,
  projectNarrativeDigestIntegrity,
} from "../../src/application/continuity/narrative-digest-manifest";
import fixture from "../fixtures/narrative-digest-performance-profile.json";

function percentile(values: readonly number[],fraction: number): number {
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*fraction)-1))]!;
}

describe("NarrativeDigest performance",()=>{
  it("measures deterministic large source hashing and stale projection",async()=>{
    const versions=Array.from({length:fixture.measurement.entityCountPerKind},(_,index)=>({entityId:`entity-${String(index).padStart(4,"0")}`,revision:1+(index%7)}));
    const documents=Array.from({length:fixture.measurement.documentCount},(_,index)=>({documentId:`document-${String(index).padStart(4,"0")}`,documentRevisionId:`revision-${String(index).padStart(4,"0")}`}));
    const source=parseNarrativeDigestSourceManifest({schemaVersion:1,scope:{kind:"work"},promptVersion:"eum-narrative-digest-v1",documents,eventBlocks:versions,characters:versions.map((row)=>({...row,entityId:`character-${row.entityId}`})),characterRelations:versions.map((row)=>({...row,entityId:`relation-${row.entityId}`})),loreEntries:versions.map((row)=>({...row,entityId:`lore-${row.entityId}`})),continuityThreads:versions.map((row)=>({...row,entityId:`continuity-${row.entityId}`})),characterKnowledge:versions.map((row)=>({...row,entityId:`knowledge-${row.entityId}`}))});
    const changed=parseNarrativeDigestSourceManifest({...source,documents:source.documents.map((document,index)=>index===source.documents.length-1?{...document,documentRevisionId:`${document.documentRevisionId}-changed`}:document)});
    const hash=(manifest: typeof source)=>createNarrativeDigestSourceManifestHash(manifest,(canonical)=>createHash("sha256").update(canonical).digest("hex"));
    const hashMs:number[]=[]; const staleMs:number[]=[]; let canonicalHash="";
    for(let iteration=0;iteration<fixture.measurement.iterationCount;iteration+=1){
      const started=performance.now(); const currentHash=hash(source); hashMs.push(performance.now()-started);
      if(canonicalHash==="")canonicalHash=currentHash; expect(currentHash).toBe(canonicalHash);
      const staleStarted=performance.now(); expect(projectNarrativeDigestIntegrity(currentHash,hash(changed))).toBe("stale"); staleMs.push(performance.now()-staleStarted);
    }
    const report={schemaVersion:1,fixtureUse:fixture.fixtureUse,environment:{platform:process.platform,architecture:process.arch,node:process.version},rowCounts:{documents:source.documents.length,eventBlocks:source.eventBlocks.length,characters:source.characters.length,characterRelations:source.characterRelations.length,loreEntries:source.loreEntries.length,continuityThreads:source.continuityThreads.length,characterKnowledge:source.characterKnowledge.length,totalCanonicalSources:source.eventBlocks.length+source.characters.length+source.characterRelations.length+source.loreEntries.length+source.continuityThreads.length+source.characterKnowledge.length},timings:{sourceManifestHashMs:{raw:hashMs,p50:percentile(hashMs,0.5),p95:percentile(hashMs,0.95)},staleProjectionWithRehashMs:{raw:staleMs,p50:percentile(staleMs,0.5),p95:percentile(staleMs,0.95)}},deterministicHash:true,changedDocumentRevisionProjectsStale:true,databaseBytes:{measured:false,growth:null,reason:"pure-application-harness"},rendererCommitCount:{measured:false,value:null,reason:"application-harness"}};
    const artifactPath=path.resolve("docs/verification/canon-continuity-gates-2-8/gate-5-narrative-digest-performance.json");
    await mkdir(path.dirname(artifactPath),{recursive:true}); await writeFile(artifactPath,`${JSON.stringify(report,null,2)}\n`,"utf8");
    expect(JSON.parse(await readFile(artifactPath,"utf8"))).toEqual(report);
  });
});
