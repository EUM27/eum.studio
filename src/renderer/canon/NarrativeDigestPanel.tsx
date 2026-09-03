import { useMemo,useState } from "react";

import type { CharacterProjection } from "../../application/characters/character-contract";
import type { SceneAnalysisRunProjection } from "../../application/continuity/scene-analysis-run-contract";
import type { NarrativeDigestSceneSource,NarrativeDigestScope } from "../../application/continuity/narrative-digest-manifest";
import type { EntityId } from "../../domain/writing";
import type { useNarrativeDigestController } from "../features/digest/useNarrativeDigestController";

export type NarrativeDigestDocumentOption = Readonly<{
  documentId: EntityId<"Document">;
  label: string;
}>;

export type NarrativeDigestPanelController = ReturnType<typeof useNarrativeDigestController>;

const SCOPE_LABELS = Object.freeze({ work:"작품 전체",document:"회차별",character:"인물별",relationship:"관계별" });
const SCENE_TRIGGER_LABELS = Object.freeze({
  "scene-transition":"장면 전환",
  "scene-split":"장면 분할",
  "episode-transition":"회차 전환",
  manual:"수동",
});
const LORE_STATUS_LABELS = Object.freeze({
  pending:"별빛 대기",
  candidate:"별빛 후보 저장",
  "no-change":"별빛 변경 없음",
  "login-required":"별빛 연결 필요",
  "permission-required":"별빛 권한 필요",
  "context-rejected":"별빛 원본 변경",
  failed:"별빛 실패",
});

function sceneAnalysisSummary(run: SceneAnalysisRunProjection|undefined): string {
  if (run===undefined) return "";
  const update=run.informationUpdate;
  if (update===null) return ` · ${LORE_STATUS_LABELS[run.loreStatus]}`;
  const changedCount=update.reviewedEntities.filter((entry)=>entry.outcome==="changed").length;
  const status=update.status==="complete"?"통합 정보 갱신 완료"
    :update.status==="partial"?"통합 정보 갱신 일부 저장"
    :"통합 정보 갱신 실패";
  const canon=update.canonCandidateId===null?"작품 정보 변경 없음":"작품 정보 후보 있음";
  const continuity=update.continuityCandidateId===null?"연속성 변경 없음":"연속성 후보 있음";
  return ` · ${status} · 검토 ${update.reviewedEntities.length}건(변화 ${changedCount}건) · ${canon} · ${continuity}`;
}

function scopeSummary(scope: NarrativeDigestScope,documents: ReadonlyMap<string,string>,characters: ReadonlyMap<string,string>,sceneSource: NarrativeDigestSceneSource|null): string {
  if (scope.kind==="work") return "작품 전체";
  if (scope.kind==="document") return `회차 · ${documents.get(scope.documentId)??scope.documentId}`;
  if (scope.kind==="scene") return sceneSource===null
    ?"장면"
    :`장면 · ${documents.get(sceneSource.documentId)??"회차"} · ${sceneSource.from.toLocaleString()}–${sceneSource.to.toLocaleString()}자`;
  if (scope.kind==="character") return `인물 · ${characters.get(scope.characterId)??scope.characterId}`;
  return `관계 · ${characters.get(scope.firstCharacterId)??scope.firstCharacterId} ↔ ${characters.get(scope.secondCharacterId)??scope.secondCharacterId}`;
}

export function NarrativeDigestPanel(input: Readonly<{
  characters: readonly CharacterProjection[];
  controller: NarrativeDigestPanelController;
  documents: readonly NarrativeDigestDocumentOption[];
}>) {
  const [scopeKind,setScopeKind]=useState<keyof typeof SCOPE_LABELS>("work");
  const [selectedDocuments,setSelectedDocuments]=useState<readonly string[]>([]);
  const [scopeDocumentId,setScopeDocumentId]=useState("");
  const [firstCharacterId,setFirstCharacterId]=useState("");
  const [secondCharacterId,setSecondCharacterId]=useState("");
  const activeCharacters=input.characters.filter((character)=>character.retiredAt===null);
  const documentLabels=useMemo(()=>new Map(input.documents.map((document)=>[document.documentId,document.label])),[input.documents]);
  const characterLabels=useMemo(()=>new Map(activeCharacters.map((character)=>[character.characterId,character.name])),[activeCharacters]);
  const sceneAnalysisRuns=useMemo(()=>new Map(
    input.controller.sceneAnalysisRuns.map((run)=>[run.digestId,run]),
  ),[input.controller.sceneAnalysisRuns]);
  const scope: NarrativeDigestScope|null=scopeKind==="work"?{kind:"work"}
    :scopeKind==="document"&&scopeDocumentId!==""?{kind:"document",documentId:scopeDocumentId as EntityId<"Document">}
    :scopeKind==="character"&&firstCharacterId!==""?{kind:"character",characterId:firstCharacterId as EntityId<"Character">}
    :scopeKind==="relationship"&&firstCharacterId!==""&&secondCharacterId!==""&&firstCharacterId!==secondCharacterId
      ?{kind:"relationship",firstCharacterId:firstCharacterId as EntityId<"Character">,secondCharacterId:secondCharacterId as EntityId<"Character">}:null;
  const canGenerate=scope!==null&&selectedDocuments.length>0&&(scope.kind!=="document"||selectedDocuments.includes(scope.documentId));

  return <section aria-label="이야기 흐름" className="narrative-digest-panel">
    <header className="narrative-digest-heading"><div><span className="canon-eyebrow">Derived snapshot</span><h2>이야기 지금까지</h2></div><button disabled={input.controller.actionState!=="idle"} onClick={()=>void input.controller.refresh()} type="button">새로고침</button></header>
    <p className="narrative-digest-principle">원고와 별빛을 바꾸지 않는 파생 요약입니다. 범위와 회차를 직접 고른 뒤 생성합니다.</p>
    {(input.controller.error!==null||input.controller.message!==null)&&<p className={input.controller.error===null?"canon-feedback":"canon-feedback is-error"} role={input.controller.error===null?"status":"alert"}>{input.controller.error??input.controller.message}</p>}
    {input.controller.permissionRequired&&<div className="canon-permission" role="alert"><p>선택한 회차와 별빛 문맥을 조수에게 전송할 권한이 필요합니다.</p><button disabled={input.controller.actionState!=="idle"} onClick={()=>void input.controller.grantPermissionAndRetry()} type="button">이 범위를 허용하고 다시 생성</button></div>}
    <div className="narrative-digest-layout">
      <form className="narrative-digest-form" onSubmit={(event)=>{event.preventDefault();if(scope!==null)void input.controller.generate(scope,selectedDocuments as readonly EntityId<"Document">[]);}}>
        <fieldset><legend>요약 범위</legend><div className="narrative-digest-scope-options">{(Object.keys(SCOPE_LABELS) as (keyof typeof SCOPE_LABELS)[]).map((kind)=><label key={kind}><input checked={scopeKind===kind} name="digest-scope" onChange={()=>setScopeKind(kind)} type="radio"/>{SCOPE_LABELS[kind]}</label>)}</div></fieldset>
        {scopeKind==="document"&&<label>기준 회차<select aria-label="기준 회차" onChange={(event)=>setScopeDocumentId(event.target.value)} value={scopeDocumentId}><option value="">직접 선택</option>{input.documents.map((document)=><option key={document.documentId} value={document.documentId}>{document.label}</option>)}</select></label>}
        {(scopeKind==="character"||scopeKind==="relationship")&&<label>{scopeKind==="relationship"?"첫 인물":"기준 인물"}<select aria-label={scopeKind==="relationship"?"첫 인물":"기준 인물"} onChange={(event)=>setFirstCharacterId(event.target.value)} value={firstCharacterId}><option value="">직접 선택</option>{activeCharacters.map((character)=><option key={character.characterId} value={character.characterId}>{character.name}</option>)}</select></label>}
        {scopeKind==="relationship"&&<label>둘째 인물<select aria-label="둘째 인물" onChange={(event)=>setSecondCharacterId(event.target.value)} value={secondCharacterId}><option value="">직접 선택</option>{activeCharacters.map((character)=><option key={character.characterId} value={character.characterId}>{character.name}</option>)}</select></label>}
        <fieldset><legend>포함할 회차</legend><div className="narrative-digest-document-options">{input.documents.map((document)=><label key={document.documentId}><input checked={selectedDocuments.includes(document.documentId)} onChange={(event)=>setSelectedDocuments((current)=>event.target.checked?[...current,document.documentId]:current.filter((id)=>id!==document.documentId))} type="checkbox"/>{document.label}</label>)}</div></fieldset>
        <button disabled={!canGenerate||input.controller.actionState!=="idle"} type="submit">{input.controller.actionState==="generating"?"생성 중…":"이 범위로 생성"}</button>
      </form>
      <section aria-label="이야기 흐름 이력" className="narrative-digest-history"><header><h3>생성 이력</h3><span>{input.controller.digests.length}개</span></header>{input.controller.digests.length===0?<p className="canon-empty">아직 생성한 이야기 흐름이 없습니다.</p>:input.controller.digests.map((digest)=>{const run=sceneAnalysisRuns.get(digest.digestId);return <article className={digest.integrity==="stale"?"narrative-digest-card is-stale":"narrative-digest-card"} key={digest.digestId}><header><div><strong>{scopeSummary(digest.scope,documentLabels,characterLabels,digest.sceneSource)}</strong><small>{new Date(digest.createdAt).toLocaleString("ko-KR")}</small></div><span>{digest.integrity==="current"?"현재":"원본 변경"}</span></header>{digest.integrity==="stale"&&<p className="narrative-digest-stale">원본 변경 후 다시 생성 필요</p>}<p>{digest.text}</p><footer><span>{digest.scope.kind==="scene"?`장면 분석 · ${SCENE_TRIGGER_LABELS[digest.sceneSource?.trigger??"manual"]}${sceneAnalysisSummary(run)}`:`${digest.sourceManifest.documents.length}개 회차`} · {digest.providerId} / {digest.modelId}</span>{digest.integrity==="stale"&&digest.scope.kind!=="scene"&&<button disabled={input.controller.actionState!=="idle"} onClick={()=>void input.controller.regenerate(digest)} type="button">현재 원본으로 다시 생성</button>}</footer></article>;})}</section>
    </div>
  </section>;
}
