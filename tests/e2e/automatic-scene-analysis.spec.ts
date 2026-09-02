import { once } from "node:events";

import {
  DatabaseSync,
  createServer,
  electron,
  expect,
  mkdir,
  mkdtemp,
  path,
  randomUUID,
  removeVerifiedTemporaryDirectory,
  test,
  tmpdir,
  writeFile,
  type Page,
  type RunningElectronApp,
} from "./support/desktop-shell-suite";

function diagnostics(app:RunningElectronApp):void{
  app.process().stderr?.on("data",(chunk)=>
    process.stderr.write(`[automatic-scene-analysis-e2e stderr] ${String(chunk)}`));
}

async function closeElectron(app:RunningElectronApp):Promise<void>{
  const child=app.process();
  const closed=await Promise.race([
    app.close().then(()=>true,()=>true),
    new Promise<false>((resolve)=>setTimeout(()=>resolve(false),8_000)),
  ]);
  if(!closed&&child.exitCode===null&&child.signalCode===null){
    const exit=once(child,"exit").catch(()=>undefined);
    child.kill("SIGKILL");await exit;
  }
}

async function openDigestTab(page:Page):Promise<void>{
  await page.getByRole("navigation",{name:"작품 작업면"})
    .getByRole("button",{name:"별빛",exact:true}).click();
  const workspace=page.getByRole("region",{name:"별빛 작업"});
  await workspace.getByRole("tab",{name:"이야기 흐름",exact:true}).click();
}

test("automatically saves exact Scene summaries and Lore candidates only after the Work feature is enabled",async()=>{
  test.setTimeout(180_000);
  const directory=await mkdtemp(path.join(tmpdir(),"eum-auto-scene-analysis-"));
  const suffix=randomUUID().slice(0,8);
  const loreTitle=`별빛문-${suffix}`;
  const summaryText=`장면 자동 요약 ${suffix}`;
  const updatedLore=`두 장면에서 상태가 달라진다 ${suffix}`;
  const formats:string[]=[];
  const upstream=createServer(async(request,response)=>{
    const chunks:Buffer[]=[];
    for await(const chunk of request){
      chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    }
    const body=JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string,unknown>;
    const format=(body.text as {format?:{name?:unknown}}|undefined)?.format?.name;
    if(typeof format==="string")formats.push(format);
    const output=format==="eum_narrative_digest"
      ?JSON.stringify({text:summaryText})
      :format==="eum_canon_review"
        ?JSON.stringify({proposals:[{
            targetKind:"lore-entry",targetHint:loreTitle,operationHint:"update",
            assertionBasis:"explicit-evidence",reason:"장면에서 개념이 직접 언급된다.",
            fields:[{field:"content",value:updatedLore}],
            evidence:[{paragraphId:"p1",quote:loreTitle}],
          }]})
        :JSON.stringify({});
    response.writeHead(200,{"content-type":"text/event-stream"});
    response.end([
      "event: response.output_text.delta",
      `data: ${JSON.stringify({delta:output})}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"));
  });
  await new Promise<void>((resolve,reject)=>{
    upstream.once("error",reject);
    upstream.listen(0,"127.0.0.1",()=>resolve());
  });
  const address=upstream.address();
  if(address===null||typeof address==="string")throw new Error("Expected loopback server");
  const oauthProfile={
    schemaVersion:1,providerId:"openai-chatgpt-oauth",displayName:"GPT",
    issuer:"https://auth.openai.com",clientId:"test-client",
    authorizationPath:"/oauth/authorize",tokenPath:"/oauth/token",
    scopes:["openid","offline_access"],authorizeParameters:{originator:"test-originator"},
    callback:{listenHost:"127.0.0.1",redirectHost:"localhost",path:"/auth/callback",portRange:{start:1455,end:1475}},
    upstream:{baseUrl:`http://127.0.0.1:${address.port}`,originator:"test-originator",clientVersion:"test-version",model:"test-model"},
  } as const;
  const env={
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE:"0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH:directory,
    EUM_STUDIO_WINDOW_VISIBILITY:"hidden",
    EUM_STUDIO_DISABLE_SANDBOX:"1",
    EUM_STUDIO_CHATGPT_OAUTH_PROFILE:JSON.stringify(oauthProfile),
  };
  const args=[".",`--user-data-dir=${path.join(directory,"electron-user-data")}`];
  let app=await electron.launch({args,cwd:process.cwd(),env});diagnostics(app);
  let complete=false;
  try{
    const accountId=`account-${suffix}`;
    const jwt=(payload:Record<string,unknown>)=>
      `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
    const tokens={
      accessToken:jwt({exp:4_000_000_000}),refreshToken:`refresh-${suffix}`,
      idToken:jwt({email:`writer-${suffix}@example.test`,"https://api.openai.com/auth":{chatgpt_account_id:accountId,chatgpt_plan_type:"test"}}),
      accountId,email:`writer-${suffix}@example.test`,planType:"test",
    };
    const userDataPath=await app.evaluate(({app:electronApp})=>electronApp.getPath("userData"));
    const encrypted=await app.evaluate(({safeStorage},serialized)=>
      Array.from(safeStorage.encryptString(serialized)),JSON.stringify(tokens));
    await closeElectron(app);
    const oauthRoot=path.join(userDataPath,"chatgpt-oauth-v1");await mkdir(oauthRoot,{recursive:true});
    await writeFile(path.join(oauthRoot,"connection.json"),`${JSON.stringify({
      schemaVersion:1,revision:1,
      encryptedCredential:Buffer.from(encrypted).toString("base64"),
      updatedAt:"2026-08-30T00:00:00.000Z",
    })}\n`,`utf8`);

    app=await electron.launch({args,cwd:process.cwd(),env});diagnostics(app);
    const page=await app.firstWindow();await page.setViewportSize({width:1280,height:800});
    await page.getByRole("button",{name:"작품 만들기",exact:true}).click();
    const create=page.getByRole("dialog",{name:"새 작품 만들기"});
    await create.getByLabel("작품 제목").fill(`자동 장면 분석 ${suffix}`);
    await create.getByLabel("첫 회차 제목").fill(`1화 ${suffix}`);
    await create.getByRole("button",{name:"작품 만들기",exact:true}).click();
    const first=`${loreTitle}은 첫 장면에서 빛났다. `;
    const second=`${loreTitle}은 둘째 장면에서 닫혔다.`;
    const manuscript=page.getByRole("textbox",{name:"원고"});
    await manuscript.pressSequentially(first+second);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page.evaluate(async({title})=>{
      const catalog=await window.eumStudio.workspace.getCatalog();
      if(catalog.activeWorkId===null)throw new Error("Expected Work");
      await window.eumStudio.loreEntries.create({
        schemaVersion:1,workId:catalog.activeWorkId,title,
        content:"봉인된 문",category:"개념",aliases:[],enabled:true,evidence:null,
      });
    },{title:loreTitle});

    await page.getByRole("button",{name:"앱 설정 열기",exact:true}).click();
    const settings=page.getByRole("dialog",{name:"앱 설정"});
    const toggle=settings.getByLabel("장면 전환·분할·회차 전환 시 분석 요약과 별빛 후보 저장");
    await expect(toggle).not.toBeChecked();await toggle.check();
    await settings.getByRole("button",{name:"저장",exact:true}).click();
    await expect(settings).toHaveCount(0);
    await expect.poll(async()=>page.evaluate(async()=>{
      const catalog=await window.eumStudio.workspace.getCatalog();
      if(catalog.activeWorkId===null)return false;
      return (await window.eumStudio.settings.getWorkSceneAnalysis({
        schemaVersion:1,workId:catalog.activeWorkId,
      })).settings.enabled;
    })).toBe(true);
    const automaticStatus=page.locator('[aria-label="자동 장면 분석 상태"]');
    await expect(automaticStatus).toBeVisible();
    await expect(automaticStatus).toHaveText("켜짐");

    const point=await manuscript.locator(".cm-line").first().evaluate((line,offset)=>{
      const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);
      let remaining=offset;let node=walker.nextNode();
      while(node instanceof Text){
        if(remaining<node.length){
          const range=document.createRange();range.setStart(node,remaining);
          range.setEnd(node,Math.min(remaining+1,node.length));
          const rect=range.getBoundingClientRect();
          return{x:rect.left+Math.max(1,rect.width/2),y:rect.top+rect.height/2};
        }
        remaining-=node.length;node=walker.nextNode();
      }
      throw new Error("Split offset is unavailable");
    },first.length);
    await page.mouse.click(point.x,point.y,{button:"right"});
    await page.getByRole("menu",{name:"원고 우클릭 메뉴"})
      .getByRole("menuitem",{name:"장면 나누기",exact:true}).click();

    await expect.poll(async()=>page.evaluate(async()=>{
      const catalog=await window.eumStudio.workspace.getCatalog();
      if(catalog.activeWorkId===null)return{scenes:0,stableScenes:0,grants:0};
      const [scenes,context]=await Promise.all([
        window.eumStudio.structure.listSceneProjection({schemaVersion:1,workId:catalog.activeWorkId}),
        window.eumStudio.assistant.listContextState({
          schemaVersion:1,workId:catalog.activeWorkId,conversationId:crypto.randomUUID() as never,
        }),
      ]);
      return{
        scenes:scenes.scenes.length,
        stableScenes:scenes.scenes.filter((scene)=>scene.sceneIdentity?.sceneId!==undefined).length,
        grants:context.grants.filter((grant)=>
          grant.duration==="work"&&
          (grant.capability==="narrative.digest"||grant.capability==="canon.review")&&
          grant.revokedAt===null
        ).length,
      };
    }),{timeout:10_000}).toMatchObject({scenes:2,grants:2});
    const statusAfterSplit=await automaticStatus.textContent();
    await expect.poll(()=>formats.length,{
      timeout:10_000,
      message:`automatic Scene analysis should start; renderer status was ${statusAfterSplit}`,
    }).toBeGreaterThan(0);

    await expect.poll(async()=>page.evaluate(async()=>{
      const catalog=await window.eumStudio.workspace.getCatalog();
      if(catalog.activeWorkId===null)return{digests:0,candidates:0,runs:0};
      const [digests,candidates,runs]=await Promise.all([
        window.eumStudio.narrativeDigest.list({schemaVersion:1,workId:catalog.activeWorkId}),
        window.eumStudio.canon.listCandidates({schemaVersion:1,workId:catalog.activeWorkId,status:"actionable"}),
        window.eumStudio.narrativeDigest.listSceneAnalysisRuns({schemaVersion:1,workId:catalog.activeWorkId}),
      ]);
      return{
        digests:digests.digests.filter((digest)=>digest.scope.kind==="scene").length,
        candidates:candidates.candidates.length,
        runs:runs.runs.length,
      };
    }),{timeout:60_000}).toMatchObject({digests:2,candidates:1,runs:2});
    expect(formats.filter((format)=>format==="eum_narrative_digest")).toHaveLength(2);
    expect(formats.filter((format)=>format==="eum_canon_review")).toHaveLength(2);
    const saved=await page.evaluate(async()=>{
      const catalog=await window.eumStudio.workspace.getCatalog();
      if(catalog.activeWorkId===null)throw new Error("Expected Work");
      const projection=await window.eumStudio.narrativeDigest.list({schemaVersion:1,workId:catalog.activeWorkId});
      return projection.digests.filter((digest)=>digest.scope.kind==="scene")
        .map((digest)=>({text:digest.text,trigger:digest.sceneSource?.trigger,from:digest.sceneSource?.from,to:digest.sceneSource?.to}));
    });
    expect(saved).toHaveLength(2);
    expect(saved.every((digest)=>digest.text===summaryText&&digest.trigger==="scene-split"&&digest.from!<digest.to!)).toBe(true);
    await openDigestTab(page);
    const panel=page.getByRole("region",{name:"이야기 흐름",exact:true});
    await expect(panel).toContainText("장면 분석");await expect(panel).toContainText(summaryText);
    await expect(panel).toContainText("장면 분할");
    await expect(panel).toContainText("별빛 후보 저장");
    await expect(panel).toContainText("별빛 변경 없음");
    complete=true;
  }finally{
    await closeElectron(app).catch(()=>undefined);
    await new Promise<void>((resolve)=>upstream.close(()=>resolve()));
    if(complete){
      const database=new DatabaseSync(path.join(directory,"workspace.sqlite3"),{readOnly:true});
      try{
        expect(database.prepare(`SELECT
          (SELECT COUNT(*) FROM narrative_digest_scene_sources) AS sceneSources,
          (SELECT COUNT(*) FROM scene_analysis_runs) AS sceneAnalysisRuns,
          (SELECT COUNT(*) FROM work_scene_analysis_settings WHERE enabled=1) AS enabledSettings,
          (SELECT target_schema_version FROM storage_ledger_identity) AS schemaVersion,
          (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations
        `).get()).toEqual({
          sceneSources:2,
          sceneAnalysisRuns:2,
          enabledSettings:1,
          schemaVersion:24,
          foreignKeyViolations:0,
        });
      }finally{database.close();}
    }
    await removeVerifiedTemporaryDirectory(directory);
  }
});
