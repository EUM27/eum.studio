import { createHash,randomUUID } from "node:crypto";
import { once } from "node:events";

import {
  createNarrativeDigestSourceManifestHash,
  parseNarrativeDigestSourceManifest,
} from "../../src/application/continuity/narrative-digest-manifest";
import {
  mkdtemp,tmpdir,path,DatabaseSync,expect,test,electron,continueFromMain,
  removeVerifiedTemporaryDirectory,type Page,
} from "./support/desktop-shell-suite";

type RunningElectron = Awaited<ReturnType<typeof electron.launch>>;

function diagnostics(app: RunningElectron): void {
  app.process().stderr?.on("data",(chunk)=>process.stderr.write(`[digest-e2e electron stderr] ${String(chunk)}`));
}

async function closeElectron(app: RunningElectron): Promise<void> {
  const child=app.process();
  const closed=await Promise.race([app.close().then(()=>true,()=>true),new Promise<false>((resolve)=>setTimeout(()=>resolve(false),8_000))]);
  if(!closed&&child.exitCode===null&&child.signalCode===null){const exit=once(child,"exit").catch(()=>undefined);child.kill("SIGKILL");await exit;}
}

async function openDigestTab(page: Page): Promise<void> {
  await page.getByRole("navigation",{name:"작품 작업면"}).getByRole("button",{name:"별빛",exact:true}).click();
  const workspace=page.getByRole("region",{name:"별빛 작업"});
  await workspace.getByRole("tab",{name:"이야기 흐름",exact:true}).click();
  await expect(workspace.getByRole("tab",{name:"이야기 흐름",exact:true})).toHaveAttribute("aria-selected","true");
}

type Seed = Readonly<{
  workId: string;
  documentId: string;
  documentRevisionId: string;
  documentLength: number;
  entries: readonly Readonly<Record<string,unknown>>[];
  excluded: readonly Readonly<Record<string,unknown>>[];
}>;

function seedDigest(databasePath: string,seed: Seed,text: string): void {
  const refs=(kind: string)=>seed.entries.flatMap((entry)=>{
    const entity=entry.entity as {kind?:unknown;id?:unknown}|undefined;
    return entry.kind==="entity"&&entity?.kind===kind&&typeof entity.id==="string"&&typeof entry.entityRevision==="number"
      ?[{entityId:entity.id,revision:entry.entityRevision}]:[];
  });
  const sourceManifest=parseNarrativeDigestSourceManifest({
    schemaVersion:1,scope:{kind:"work"},promptVersion:"eum-narrative-digest-v1",
    documents:[{documentId:seed.documentId,documentRevisionId:seed.documentRevisionId}],
    eventBlocks:refs("event-block"),characters:refs("character"),characterRelations:refs("character-relation"),
    loreEntries:refs("lore-entry"),continuityThreads:refs("continuity-thread"),characterKnowledge:refs("character-knowledge"),
  });
  const sourceManifestHash=createNarrativeDigestSourceManifestHash(sourceManifest,(canonical)=>createHash("sha256").update(canonical).digest("hex"));
  const database=new DatabaseSync(databasePath);
  try {
    const receiptId=randomUUID(); const manifestId=randomUUID(); const digestId=randomUUID(); const activityId=randomUUID();
    const range=[{documentId:seed.documentId,documentRevisionId:seed.documentRevisionId,from:0,to:seed.documentLength}];
    database.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    database.prepare(`INSERT INTO assistant_context_receipts (
      id,schema_version,request_id,work_id,conversation_id,capability,destination_id,
      read_ranges_json,transmitted_ranges_json,read_character_count,transmitted_character_count,grant_ids_json,created_at
    ) VALUES (?,1,?,?,?,'narrative.digest','chatgpt-oauth',?,?,?,?,?,'2026-08-29T07:00:00.000Z')`).run(
      receiptId,randomUUID(),seed.workId,randomUUID(),JSON.stringify(range),JSON.stringify(range),seed.documentLength,seed.documentLength,"[]",
    );
    database.prepare(`INSERT INTO assistant_context_manifests (
      id,schema_version,receipt_id,work_id,entries_json,excluded_json,estimated_token_count,created_at
    ) VALUES (?,1,?,?,?,?,?,'2026-08-29T07:00:00.000Z')`).run(
      manifestId,receiptId,seed.workId,JSON.stringify(seed.entries),JSON.stringify(seed.excluded),seed.entries.length,
    );
    database.prepare(`INSERT INTO narrative_digests (
      id,schema_version,work_id,scope_kind,scope_document_id,scope_first_character_id,scope_second_character_id,
      source_manifest_json,source_manifest_hash,text,provider_id,model_id,prompt_version,context_receipt_id,created_at
    ) VALUES (?,1,?,'work',NULL,NULL,NULL,?,?,?,?,?,'eum-narrative-digest-v1',?,'2026-08-29T07:00:01.000Z')`).run(
      digestId,seed.workId,JSON.stringify(sourceManifest),sourceManifestHash,text,"e2e-provider","e2e-model",receiptId,
    );
    database.prepare(`INSERT INTO narrative_digest_documents VALUES (?,?,?,?,0)`).run(seed.workId,digestId,seed.documentId,seed.documentRevisionId);
    database.prepare(`INSERT INTO assistant_context_activities (
      id,schema_version,work_id,receipt_id,manifest_id,capability,destination_id,provider_id,model_id,
      started_at,completed_at,plan_duration_ms,authorize_duration_ms,connector_duration_ms,persist_duration_ms,
      read_ranges_json,transmitted_ranges_json,read_character_count,transmitted_character_count,candidate_count
    ) VALUES (?,1,?,?,?,'narrative.digest','chatgpt-oauth','e2e-provider','e2e-model',
      '2026-08-29T07:00:00.000Z','2026-08-29T07:00:01.000Z',1,1,1,1,?,?,?,?,0)`).run(
      activityId,seed.workId,receiptId,manifestId,JSON.stringify(range),JSON.stringify(range),seed.documentLength,seed.documentLength,
    );
    database.exec("COMMIT");
  } catch(error){if(database.isTransaction)database.exec("ROLLBACK");throw error;} finally{database.close();}
}

test("shows packaged NarrativeDigest current/stale history, explicit scope, regenerate failure safety, and restart",async()=>{
  test.setTimeout(150_000);
  const directory=await mkdtemp(path.join(tmpdir(),"eum-studio-digest-e2e-"));
  const suffix=randomUUID().slice(0,8); const digestText=`윤서는 북문에서 열쇠를 찾았다 ${suffix}.`;
  const args=[".",`--user-data-dir=${path.join(directory,"electron-user-data")}`];
  const env={...process.env,EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE:"0",EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH:directory,EUM_STUDIO_WINDOW_VISIBILITY:"hidden",EUM_STUDIO_DISABLE_SANDBOX:"1"};
  let app=await electron.launch({args,cwd:process.cwd(),env}); diagnostics(app); let complete=false;
  try {
    let page=await app.firstWindow(); await page.setViewportSize({width:1280,height:800});
    await page.getByRole("button",{name:"작품 만들기",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"새 작품 만들기"});
    await dialog.getByLabel("작품 제목").fill(`이야기 작품 ${suffix}`); await dialog.getByLabel("첫 회차 제목").fill(`1화 ${suffix}`);
    await dialog.getByRole("button",{name:"작품 만들기",exact:true}).click();
    const manuscript=page.getByRole("textbox",{name:"원고"}); await manuscript.pressSequentially(`윤서는 북문 앞에서 열쇠를 들었다 ${suffix}.`);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const seed=await page.evaluate(async()=>{
      const catalog=await window.eumStudio.workspace.getCatalog();
      const profile=await window.eumStudio.editor.getManuscriptDocumentProfile();
      if(catalog.activeWorkId===null||catalog.activeDocumentId===null)throw new Error("Expected active Work/Document");
      const document=profile.documents.find((entry)=>entry.documentId===catalog.activeDocumentId);
      if(document===undefined||document.documentRevisionId===null)throw new Error("Expected current Document profile");
      await window.eumStudio.characters.create({schemaVersion:1,workId:catalog.activeWorkId,name:"윤서",aliases:[],role:"주인공",summary:"열쇠를 찾았다",appearance:"",personality:"",speech:"",goal:"",conflict:"",note:""});
      const plan=await window.eumStudio.contextPlanner.plan({schemaVersion:1,workId:catalog.activeWorkId,capability:"narrative.digest",sourceRange:null,sceneId:null,povCharacterId:null,userQuery:"",tokenBudget:32768});
      if(plan.status!=="planned")throw new Error("Expected digest context plan");
      return {workId:catalog.activeWorkId,documentId:document.documentId,documentRevisionId:document.documentRevisionId,documentLength:document.initialText.length,entries:plan.entries,excluded:plan.excluded};
    });
    await closeElectron(app); seedDigest(path.join(directory,"workspace.sqlite3"),seed,digestText);
    app=await electron.launch({args,cwd:process.cwd(),env}); diagnostics(app); page=await app.firstWindow(); await page.setViewportSize({width:1280,height:800});
    await continueFromMain(page); await openDigestTab(page);
    const panel=page.getByRole("region",{name:"이야기 흐름",exact:true});
    await expect(panel).toContainText(digestText); await expect(panel).toContainText("현재");
    await expect(panel.getByRole("radio",{name:"작품 전체",exact:true})).toBeVisible(); await expect(panel.getByRole("radio",{name:"회차별",exact:true})).toBeVisible();
    await expect(panel.getByRole("radio",{name:"인물별",exact:true})).toBeVisible(); await expect(panel.getByRole("radio",{name:"관계별",exact:true})).toBeVisible();
    await page.evaluate(async()=>{const catalog=await window.eumStudio.workspace.getCatalog();if(catalog.activeWorkId===null)throw new Error("Expected Work");await window.eumStudio.characters.create({schemaVersion:1,workId:catalog.activeWorkId,name:"민호",aliases:[],role:"조력자",summary:"함정을 경고한다",appearance:"",personality:"",speech:"",goal:"",conflict:"",note:""});});
    await panel.getByRole("button",{name:"새로고침",exact:true}).click();
    await expect(panel).toContainText("원본 변경 후 다시 생성 필요"); await expect(panel).toContainText(digestText);
    await panel.getByRole("button",{name:"현재 원본으로 다시 생성",exact:true}).click();
    await expect(panel).toContainText("연결된 이야기 흐름 조수가 없습니다."); await expect(panel).toContainText(digestText);
    const bounds=await page.locator(".narrative-digest-layout").evaluate((element)=>{const rect=element.getBoundingClientRect();return{right:rect.right,bottom:rect.bottom,width:window.innerWidth,height:window.innerHeight};});
    expect(bounds.right).toBeLessThanOrEqual(bounds.width+1); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height+1);
    await closeElectron(app); app=await electron.launch({args,cwd:process.cwd(),env}); diagnostics(app); page=await app.firstWindow(); await page.setViewportSize({width:1280,height:800});
    await continueFromMain(page); await openDigestTab(page); await expect(page.getByRole("region",{name:"이야기 흐름",exact:true})).toContainText("원본 변경 후 다시 생성 필요");
    complete=true;
  } finally {
    await closeElectron(app).catch(()=>undefined);
    if(complete){const audit=new DatabaseSync(path.join(directory,"workspace.sqlite3"),{readOnly:true});try{expect(audit.prepare(`SELECT (SELECT COUNT(*) FROM narrative_digests) AS digests,(SELECT COUNT(*) FROM narrative_digest_documents) AS documents,(SELECT COUNT(*) FROM assistant_context_activities WHERE capability='narrative.digest') AS activities,(SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations`).get()).toEqual({digests:1,documents:1,activities:1,foreignKeyViolations:0});}finally{audit.close();}}
    await removeVerifiedTemporaryDirectory(directory);
  }
});
