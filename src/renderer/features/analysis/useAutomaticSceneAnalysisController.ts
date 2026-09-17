import { useCallback,useEffect,useLayoutEffect,useRef,useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  NarrativeDigestSceneTrigger,
} from "../../../application/continuity/narrative-digest-manifest";
import type {
  SceneProjection,
  SceneProjectionList,
} from "../../../application/structure/scene-projection";
import type { EntityId } from "../../../domain/writing";
import type { useCanonReviewController } from "../canon/useCanonReviewController";
import {
  resolveSceneAtPosition,
  executeAutomaticSceneAnalysis,
  deriveAutomaticSceneTransition,
  selectSplitSceneResults,
} from "./automatic-scene-analysis";

export type AutomaticSceneAnalysisState =
  | "idle"
  | "running"
  | "skipped-disconnected"
  | "permission-required"
  | "stale"
  | "failed";

export function useAutomaticSceneAnalysisController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: Pick<StudioBridge["assistant"],"getChatGptOAuthStatus">;
  canonReviewController: Pick<ReturnType<typeof useCanonReviewController>,"refreshCandidates">;
  conversationId: EntityId<"AssistantConversation">;
  digestClient: Pick<StudioBridge["narrativeDigest"],"runSceneAnalysis">;
  documents: readonly ManuscriptDocumentSource[];
  persistDocument(document: ManuscriptDocumentSource): Promise<void>;
  refreshDigests(): Promise<unknown>;
  refreshContinuityCandidates(): Promise<unknown>;
  refreshSceneProjection(workId: EntityId<"Work">): Promise<SceneProjectionList>;
  sceneProjection: SceneProjectionList | null;
  settingsClient: Pick<StudioBridge["settings"],"getWorkSceneAnalysis">;
  settingsEnabled: boolean|null;
  settingsRevision: number;
  structureClient: Pick<StudioBridge["structure"],"finalizeSceneCanonCheck">;
}>) {
  const inputRef=useRef(input);
  const [loadedSettings,setLoadedSettings]=useState<Readonly<{
    workId:EntityId<"Work">;enabled:boolean;
  }>|null>(null);
  const [state,setState]=useState<AutomaticSceneAnalysisState>("idle");
  const [canRetry,setCanRetry]=useState(false);
  const [storedError,setStoredError]=useState<Readonly<{
    workId:EntityId<"Work">;message:string;
  }>|null>(null);
  const [statusWorkId,setStatusWorkId]=useState(input.activeWorkId);
  if(statusWorkId!==input.activeWorkId){
    setStatusWorkId(input.activeWorkId);
    setState("idle");setCanRetry(false);setStoredError(null);
  }
  const activeSceneRef=useRef<SceneProjection|null>(null);
  const retryRequestRef=useRef<Readonly<{
    scene:SceneProjection;trigger:NarrativeDigestSceneTrigger;
  }>|null>(null);
  const queueRef=useRef<Promise<void>>(Promise.resolve());
  const scopeRef=useRef({workId:input.activeWorkId,generation:0});
  const nextRequestRef=useRef(0);
  const activeRequestRef=useRef<number|null>(null);

  useLayoutEffect(()=>{
    const scope={workId:input.activeWorkId,generation:scopeRef.current.generation+1};
    scopeRef.current=scope;
    activeRequestRef.current=null;
    activeSceneRef.current=null;
    retryRequestRef.current=null;
    queueRef.current=Promise.resolve();
    return()=>{
      scopeRef.current={workId:null,generation:scope.generation+1};
      activeRequestRef.current=null;
    };
  },[input.activeWorkId]);

  useEffect(()=>{
    let cancelled=false;
    const workId=input.activeWorkId;
    if(workId===null)return()=>{cancelled=true;};
    if(input.settingsEnabled!==null)return()=>{cancelled=true;};
    void input.settingsClient.getWorkSceneAnalysis({schemaVersion:1,workId}).then(
      (projection)=>{
        if(!cancelled&&projection.workId===workId){
          setLoadedSettings({workId,enabled:projection.settings.enabled});
          setStoredError(null);
        }
      },
      (reason)=>{
        if(!cancelled)setStoredError({
          workId,
          message:reason instanceof Error?reason.message:"자동 장면 분석 설정을 불러오지 못했습니다.",
        });
      },
    );
    return()=>{cancelled=true;};
  },[input.activeWorkId,input.settingsClient,input.settingsEnabled,input.settingsRevision]);

  const effectiveEnabled=input.settingsEnabled??(
    loadedSettings?.workId===input.activeWorkId?loadedSettings.enabled:false
  );
  const enabledRef=useRef(effectiveEnabled);
  useLayoutEffect(()=>{
    inputRef.current=input;
    enabledRef.current=effectiveEnabled;
  },[effectiveEnabled,input]);

  const analyze=useCallback(async(
    requestedScene:SceneProjection,
    trigger:NarrativeDigestSceneTrigger,
    scope:typeof scopeRef.current,
    requestId:number,
  )=>{
    const current=inputRef.current;
    if(scopeRef.current!==scope||scope.workId!==requestedScene.workId||current.activeWorkId!==scope.workId)return;
    activeRequestRef.current=requestId;
    const isCurrent=()=>scopeRef.current===scope&&activeRequestRef.current===requestId&&
      inputRef.current.activeWorkId===scope.workId;
    setState("running");setCanRetry(false);setStoredError(null);
    try{
      const result=await executeAutomaticSceneAnalysis({
        enabled:enabledRef.current,
        isCurrent,
        requestedScene,
        trigger,
        activeWorkId:current.activeWorkId,
        assistantClient:current.assistantClient,
        conversationId:current.conversationId,
        digestClient:current.digestClient,
        documents:current.documents,
        persistDocument:current.persistDocument,
        refreshDigests:current.refreshDigests,
        refreshCanonCandidates:current.canonReviewController.refreshCandidates,
        refreshContinuityCandidates:current.refreshContinuityCandidates,
        refreshSceneProjection:current.refreshSceneProjection,
        structureClient:current.structureClient,
      });
      if(!isCurrent())return;
      setState(result==="skipped-disconnected"?"skipped-disconnected"
        :result==="permission-required"?"permission-required"
        :result==="stale"?"stale":"idle");
      retryRequestRef.current=(
        result==="skipped-disconnected"||
        result==="permission-required"||
        result==="stale"
      )?{scene:requestedScene,trigger}:null;
      setCanRetry(retryRequestRef.current!==null);
    }catch(reason){
      if(!isCurrent())return;
      setState("failed");
      retryRequestRef.current={scene:requestedScene,trigger};
      setCanRetry(true);
      if(current.activeWorkId!==null)setStoredError({
        workId:current.activeWorkId,
        message:reason instanceof Error?reason.message:"장면 분석을 저장하지 못했습니다.",
      });
    }
  },[]);

  const schedule=useCallback((scene:SceneProjection,trigger:NarrativeDigestSceneTrigger)=>{
    const scope=scopeRef.current;
    if(scope.workId!==scene.workId)return;
    const requestId=++nextRequestRef.current;
    const execution=queueRef.current.then(()=>analyze(scene,trigger,scope,requestId));
    queueRef.current=execution.then(()=>undefined,()=>undefined);
  },[analyze]);

  const retry=useCallback(()=>{
    const request=retryRequestRef.current;
    if(request!==null){setCanRetry(false);schedule(request.scene,request.trigger);}
  },[schedule]);

  const observePosition=useCallback((
    document:ManuscriptDocumentSource,
    offset:number,
  )=>{
    const current=inputRef.current;
    const next=resolveSceneAtPosition(current.sceneProjection,document,offset);
    const previous=activeSceneRef.current;
    const transition=deriveAutomaticSceneTransition(previous,document,next);
    if(transition!==null)schedule(transition.scene,transition.trigger);
    activeSceneRef.current=next;
  },[schedule]);

  const analyzeSplit=useCallback((
    projection:SceneProjectionList,
    documentId:EntityId<"Document">,
    offset:number,
  )=>{
    const scenes=selectSplitSceneResults(projection,documentId,offset);
    for(const scene of scenes)schedule(scene,"scene-split");
    const document=inputRef.current.documents.find((entry)=>entry.documentId===documentId);
    if(document!==undefined){
      activeSceneRef.current=resolveSceneAtPosition(projection,document,offset);
    }
  },[schedule]);

  const error=storedError?.workId===input.activeWorkId?storedError.message:null;
  return {
    enabled:effectiveEnabled,
    state,
    error,
    canRetry:canRetry&&state!=="running",
    retry,
    observePosition,
    analyzeSplit,
  };
}
