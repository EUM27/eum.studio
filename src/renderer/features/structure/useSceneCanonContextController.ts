import { useCallback,useEffect,useRef,useState } from "react";

import type { StructureBridge } from "../../../application/contracts/studio-bridge";
import type { SceneCanonContextProjection } from "../../../application/structure/scene-canon-context";
import type { EntityId } from "../../../domain/writing";

export function useSceneCanonContextController(input:Readonly<{
  activeWorkId:EntityId<"Work">|null;
  client:Pick<StructureBridge,"listSceneCanonContexts">;
}>) {
  const [contexts,setContexts]=useState<readonly SceneCanonContextProjection[]>([]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);
  const activeRef=useRef(input.activeWorkId);useEffect(()=>{activeRef.current=input.activeWorkId;},[input.activeWorkId]);
  const refresh=useCallback(async()=>{const workId=input.activeWorkId;if(workId===null)return false;setLoading(true);setError(null);try{const result=await input.client.listSceneCanonContexts({schemaVersion:1,workId});if(activeRef.current!==workId)return false;setContexts(result.contexts);return true;}catch(reason){if(activeRef.current===workId)setError(reason instanceof Error?reason.message:"장면별 별빛 연결을 불러오지 못했습니다.");return false;}finally{if(activeRef.current===workId)setLoading(false);}},[input.activeWorkId,input.client]);
  useEffect(()=>{let cancelled=false;void Promise.resolve().then(()=>{if(cancelled)return;setContexts([]);setError(null);if(input.activeWorkId!==null)void refresh();});return()=>{cancelled=true;};},[input.activeWorkId,refresh]);
  return {contexts,loading,error,refresh};
}
