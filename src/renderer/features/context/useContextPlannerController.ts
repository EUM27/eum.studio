import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AssistantBridge,
  ContextPlannerBridge,
} from "../../../application/contracts/studio-bridge";
import type { AssistantCapability } from "../../../application/assistant/assistant-context-permission";
import type { AssistantConnectorManifestEntry } from "../../../application/assistant/assistant-connector-manifest";
import type {
  AssistantContextActivityProjection,
  AssistantContextManifestProjection,
  AssistantContextPlanProjection,
} from "../../../application/continuity/assistant-context-manifest";
import type {
  AssistantContextMode,
  AssistantEntityContextPolicyProjection,
} from "../../../application/continuity/assistant-context-policy";
import type { EntityId } from "../../../domain/writing";
import { createContextPlannerClient } from "./context-planner-client";

export type ContextPlannerActionState = "idle" | "loading" | "saving" | "planning";

export function useContextPlannerController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: Pick<AssistantBridge, "getConnectorProfile">;
  client: ContextPlannerBridge;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const client = useMemo(() => createContextPlannerClient({
    assistant: input.assistantClient,
    context: input.client,
  }), [input.assistantClient, input.client]);
  const [policies, setPolicies] = useState<readonly AssistantEntityContextPolicyProjection[]>([]);
  const [manifests, setManifests] = useState<readonly AssistantContextManifestProjection[]>([]);
  const [activities, setActivities] = useState<readonly AssistantContextActivityProjection[]>([]);
  const [connectors, setConnectors] = useState<readonly AssistantConnectorManifestEntry[]>([]);
  const [plan, setPlan] = useState<AssistantContextPlanProjection | null>(null);
  const [actionState, setActionState] = useState<ContextPlannerActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeWorkIdRef = useRef(input.activeWorkId);

  useEffect(() => { activeWorkIdRef.current = input.activeWorkId; }, [input.activeWorkId]);

  const refresh = useCallback(async (): Promise<boolean> => {
    const workId = input.activeWorkId;
    if (workId === null) return false;
    setActionState("loading");
    setError(null);
    try {
      const [policyList, manifestList, activityList, connectorProfile] = await Promise.all([
        client.listPolicies({ schemaVersion: 1, workId }),
        client.listManifests({ schemaVersion: 1, workId }),
        client.listActivities({ schemaVersion: 1, workId }),
        client.getConnectorProfile(),
      ]);
      if (activeWorkIdRef.current !== workId) return false;
      setPolicies(policyList.policies);
      setManifests(manifestList.manifests);
      setActivities(activityList.activities);
      setConnectors(connectorProfile.connectors);
      return true;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : "AI 문맥 정보를 불러오지 못했습니다.");
      }
      return false;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [client, input.activeWorkId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setPolicies([]); setManifests([]); setActivities([]); setConnectors([]);
      setPlan(null); setError(null); setMessage(null);
      if (input.workLoadId !== null) await refresh();
    });
    return () => { cancelled = true; };
  }, [input.workLoadId, refresh]);

  const savePolicy = useCallback(async (
    policy: AssistantEntityContextPolicyProjection,
    mode: AssistantContextMode,
  ) => {
    setActionState("saving"); setError(null); setMessage(null);
    try {
      const saved = await client.savePolicy({
        schemaVersion: 1,
        workId: policy.workId,
        entity: policy.entity,
        expectedRevision: policy.revision === 0 ? null : policy.revision,
        mode,
      });
      setPolicies((current) => current.map((entry) =>
        entry.entity.kind === saved.entity.kind && entry.entity.id === saved.entity.id
          ? saved
          : entry
      ));
      setMessage(mode === "withheld" ? "이 별빛을 AI 자동 문맥에서 제외했습니다." : "AI 문맥 정책을 저장했습니다.");
      return saved;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 문맥 정책을 저장하지 못했습니다.");
      return null;
    } finally {
      setActionState("idle");
    }
  }, [client]);

  const runPlan = useCallback(async (request: Readonly<{
    connectorKind: string;
    capability: AssistantCapability;
    povCharacterId: EntityId<"Character"> | null;
    userQuery: string;
  }>) => {
    const workId = input.activeWorkId;
    if (workId === null) return null;
    const connector = connectors.find((entry) =>
      entry.connectorKind === request.connectorKind &&
      entry.capabilities.includes(request.capability)
    );
    if (connector === undefined) {
      setError("선택한 capability를 제공하는 connector manifest를 찾지 못했습니다.");
      return null;
    }
    setActionState("planning"); setError(null); setMessage(null);
    try {
      const result = await client.plan({
        schemaVersion: 1,
        workId,
        capability: request.capability,
        sourceRange: null,
        sceneId: null,
        povCharacterId: request.povCharacterId,
        userQuery: request.userQuery,
        tokenBudget: connector.contextTokenBudget,
      });
      setPlan(result);
      setMessage(result.status === "planned"
        ? "결정적 문맥 plan을 만들었습니다."
        : "필수 문맥이 connector 예산을 초과했습니다.");
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 문맥 plan을 만들지 못했습니다.");
      return null;
    } finally {
      setActionState("idle");
    }
  }, [client, connectors, input.activeWorkId]);

  return {
    policies, manifests, activities, connectors, plan,
    actionState, error, message, refresh, savePolicy, runPlan,
  };
}
