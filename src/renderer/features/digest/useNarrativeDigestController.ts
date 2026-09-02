import { useCallback,useEffect,useRef,useState } from "react";

import type {
  AssistantBridge,
  NarrativeDigestBridge,
} from "../../../application/contracts/studio-bridge";
import type {
  NarrativeDigestProjection,
  NarrativeDigestResult,
} from "../../../application/continuity/narrative-digest-contract";
import type { NarrativeDigestScope } from "../../../application/continuity/narrative-digest-manifest";
import type { SceneAnalysisRunProjection } from "../../../application/continuity/scene-analysis-run-contract";
import { entityId,type EntityId } from "../../../domain/writing";

type PendingAction = Readonly<{
  destinationId: string;
  requiredScope: "chapter" | "work";
  run(): Promise<NarrativeDigestResult>;
}>;

export type NarrativeDigestActionState = "idle" | "loading" | "generating" | "granting";

export function useNarrativeDigestController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: Pick<AssistantBridge,"grantContextPermission">;
  client: NarrativeDigestBridge;
  conversationId: EntityId<"AssistantConversation">;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const [digests,setDigests] = useState<readonly NarrativeDigestProjection[]>([]);
  const [sceneAnalysisRuns,setSceneAnalysisRuns] = useState<
    readonly SceneAnalysisRunProjection[]
  >([]);
  const [actionState,setActionState] = useState<NarrativeDigestActionState>("idle");
  const [error,setError] = useState<string | null>(null);
  const [message,setMessage] = useState<string | null>(null);
  const [permissionRequired,setPermissionRequired] = useState(false);
  const activeWorkIdRef = useRef(input.activeWorkId);
  const pendingRef = useRef<PendingAction | null>(null);
  useEffect(() => { activeWorkIdRef.current=input.activeWorkId; },[input.activeWorkId]);

  const refresh = useCallback(async () => {
    const workId=input.activeWorkId;
    if (workId===null) return false;
    setActionState("loading"); setError(null);
    try {
      const [result,runs]=await Promise.all([
        input.client.list({ schemaVersion: 1,workId }),
        input.client.listSceneAnalysisRuns({ schemaVersion: 1,workId }),
      ]);
      if (activeWorkIdRef.current!==workId) return false;
      setDigests(result.digests);
      setSceneAnalysisRuns(runs.runs);
      return true;
    } catch (reason) {
      if (activeWorkIdRef.current===workId) setError(reason instanceof Error?reason.message:"이야기 흐름을 불러오지 못했습니다.");
      return false;
    } finally { if (activeWorkIdRef.current===workId) setActionState("idle"); }
  },[input.activeWorkId,input.client]);

  useEffect(() => {
    let cancelled=false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setDigests([]); setSceneAnalysisRuns([]); setError(null); setMessage(null); setPermissionRequired(false); pendingRef.current=null;
      if (input.workLoadId!==null) await refresh();
    });
    return () => { cancelled=true; };
  },[input.workLoadId,refresh]);

  const resolveResult = useCallback(async (result: NarrativeDigestResult,pending: PendingAction) => {
    if (result.status==="generated"||result.status==="unchanged") {
      pendingRef.current=null; setPermissionRequired(false);
      setMessage(result.status==="unchanged"
        ? "같은 원본의 최신 이야기 흐름이 이미 있습니다."
        : result.digest.integrity==="current"?"새 이야기 흐름을 만들었습니다.":"생성 중 원본이 변경되어 기록을 이력으로 보존했습니다.");
      await refresh();
      return result.digest;
    }
    if (result.status==="permission-required") {
      pendingRef.current=Object.freeze({ ...pending,destinationId: result.destinationId });
      setPermissionRequired(true); setMessage(null);
      return null;
    }
    pendingRef.current=null; setPermissionRequired(false);
    setError(result.status==="login-required"?"연결된 이야기 흐름 조수가 없습니다.":`원문을 사용할 수 없습니다: ${result.reason}`);
    return null;
  },[refresh]);

  const generate = useCallback(async (scope: NarrativeDigestScope,documentIds: readonly EntityId<"Document">[]) => {
    const workId=input.activeWorkId;
    if (workId===null||documentIds.length===0) return null;
    setActionState("generating"); setError(null); setMessage(null);
    const run=() => input.client.generate({
      schemaVersion: 1,requestId: entityId<"NarrativeDigestRequest">(crypto.randomUUID()),
      workId,conversationId: input.conversationId,scope,documentIds,
    });
    const pending: PendingAction={
      destinationId:"",
      requiredScope: scope.kind==="work"||documentIds.length>1?"work":"chapter",
      run,
    };
    try { return await resolveResult(await run(),pending); }
    catch(reason){setError(reason instanceof Error?reason.message:"이야기 흐름을 만들지 못했습니다.");return null;}
    finally{setActionState("idle");}
  },[input.activeWorkId,input.client,input.conversationId,resolveResult]);

  const regenerate = useCallback(async (digest: NarrativeDigestProjection) => {
    const workId=input.activeWorkId;
    if (workId===null||digest.workId!==workId) return null;
    setActionState("generating"); setError(null); setMessage(null);
    const run=() => input.client.regenerate({
      schemaVersion: 1,requestId: entityId<"NarrativeDigestRequest">(crypto.randomUUID()),
      workId,conversationId: input.conversationId,digestId: digest.digestId,
    });
    const pending: PendingAction={
      destinationId:"",
      requiredScope:digest.scope.kind==="work"||digest.sourceManifest.documents.length>1?"work":"chapter",
      run,
    };
    try { return await resolveResult(await run(),pending); }
    catch(reason){setError(reason instanceof Error?reason.message:"이야기 흐름을 다시 만들지 못했습니다.");return null;}
    finally{setActionState("idle");}
  },[input.activeWorkId,input.client,input.conversationId,resolveResult]);

  const grantPermissionAndRetry = useCallback(async () => {
    const workId=input.activeWorkId;
    const pending=pendingRef.current;
    if (workId===null||pending===null||pending.destinationId.length===0) return null;
    setActionState("granting"); setError(null);
    try {
      const scope=pending.requiredScope;
      await input.assistantClient.grantContextPermission({
        schemaVersion: 1,workId,conversationId: input.conversationId,capability:"narrative.digest",
        destinationId: pending.destinationId,localScope: scope,externalScope: scope,duration:"conversation",
      });
      setPermissionRequired(false);
      return await resolveResult(await pending.run(),pending);
    } catch(reason){setError(reason instanceof Error?reason.message:"이야기 흐름 권한을 저장하지 못했습니다.");return null;}
    finally{setActionState("idle");}
  },[input.activeWorkId,input.assistantClient,input.conversationId,resolveResult]);

  return {
    digests,
    sceneAnalysisRuns,
    actionState,
    error,
    message,
    permissionRequired,
    refresh,
    generate,
    regenerate,
    grantPermissionAndRetry,
  };
}
