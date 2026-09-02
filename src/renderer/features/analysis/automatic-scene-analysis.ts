import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { NarrativeDigestSceneTrigger } from "../../../application/continuity/narrative-digest-manifest";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  SceneProjection,
  SceneProjectionList,
} from "../../../application/structure/scene-projection";
import { entityId,type EntityId } from "../../../domain/writing";

export type AutomaticSceneAnalysisExecutionStatus =
  | "completed"
  | "unchanged"
  | "skipped-disabled"
  | "skipped-invalid-scene"
  | "skipped-disconnected"
  | "permission-required"
  | "stale";

export async function executeAutomaticSceneAnalysis(input: Readonly<{
  enabled:boolean;
  requestedScene:SceneProjection;
  trigger:NarrativeDigestSceneTrigger;
  activeWorkId:EntityId<"Work">|null;
  assistantClient:Pick<StudioBridge["assistant"],"getChatGptOAuthStatus">;
  conversationId:EntityId<"AssistantConversation">;
  digestClient:Pick<StudioBridge["narrativeDigest"],"runSceneAnalysis">;
  documents:readonly ManuscriptDocumentSource[];
  persistDocument(document:ManuscriptDocumentSource):Promise<void>;
  refreshDigests():Promise<unknown>;
  refreshCanonCandidates():Promise<unknown>;
  refreshSceneProjection(workId:EntityId<"Work">):Promise<SceneProjectionList>;
  structureClient:Pick<StudioBridge["structure"],"finalizeSceneCanonCheck">;
}>):Promise<AutomaticSceneAnalysisExecutionStatus>{
  const scene=input.requestedScene;
  if(!input.enabled)return "skipped-disabled";
  if(input.activeWorkId===null||scene.workId!==input.activeWorkId)return "skipped-invalid-scene";
  const requestedKey=sceneAnalysisOccurrenceKey(scene);
  if(scene.range===null||scene.integrity!=="resolved")return "skipped-invalid-scene";
  const status=await input.assistantClient.getChatGptOAuthStatus();
  if(!status.connected)return "skipped-disconnected";
  const document=input.documents.find((entry)=>entry.documentId===scene.documentId);
  if(document===undefined)return "skipped-invalid-scene";
  await input.persistDocument(document);
  const latest=await input.refreshSceneProjection(scene.workId);
  const exact=latest.scenes.find((candidate)=>
    (sceneAnalysisOccurrenceKey(candidate)===requestedKey||(
      candidate.documentId===scene.documentId&&candidate.sceneKey===scene.sceneKey
    ))&&
    candidate.range!==null&&candidate.integrity==="resolved"
  );
  if(exact===undefined||exact.range===null)return "stale";
  const finalized=await input.structureClient.finalizeSceneCanonCheck({
    schemaVersion:1,
    workId:exact.workId,
    sceneKey:exact.sceneKey,
    documentId:exact.documentId,
    documentRevisionId:exact.documentRevisionId,
    from:exact.range.start,
    to:exact.range.end,
  });
  const result=await input.digestClient.runSceneAnalysis({
    schemaVersion:1,
    digestRequestId:entityId<"NarrativeDigestRequest">(crypto.randomUUID()),
    canonRequestId:entityId<"CanonReviewRequest">(crypto.randomUUID()),
    workId:exact.workId,
    conversationId:input.conversationId,
    sceneId:finalized.sceneId,
    sourceRange:finalized.sourceRange,
    trigger:input.trigger,
  });
  if(result.status==="disabled")return "skipped-disabled";
  if(result.status==="login-required"||result.status==="lore-login-required"){
    if("digest" in result)await input.refreshDigests();
    return "skipped-disconnected";
  }
  if(result.status==="permission-required"||result.status==="lore-permission-required"){
    if("digest" in result)await input.refreshDigests();
    return "permission-required";
  }
  if(result.status==="context-rejected"||result.status==="lore-context-rejected"){
    if("digest" in result)await input.refreshDigests();
    return "stale";
  }
  await Promise.all([input.refreshDigests(),input.refreshCanonCandidates()]);
  if(result.status==="lore-failed"){
    throw new Error(result.run.lastError??"별빛 검토를 저장하지 못했습니다.");
  }
  if(result.status==="unchanged")return "unchanged";
  return "completed";
}

export function sceneAnalysisOccurrenceKey(scene: SceneProjection): string {
  const sceneId = scene.sceneIdentity?.sceneId;
  return sceneId === undefined
    ? `pending:${scene.workId}:${scene.documentId}:${scene.sceneKey}`
    : `${sceneId}:${scene.documentId}:${scene.sceneKey}`;
}

export function deriveAutomaticSceneTransition(
  previous: SceneProjection | null,
  nextDocument: Pick<ManuscriptDocumentSource,"documentId">,
  next: SceneProjection | null,
): Readonly<{
  scene: SceneProjection;
  trigger: "scene-transition"|"episode-transition";
}> | null {
  if (
    previous === null ||
    sceneAnalysisOccurrenceKey(previous) ===
      (next === null ? null : sceneAnalysisOccurrenceKey(next))
  ) return null;
  return Object.freeze({
    scene: previous,
    trigger: previous.documentId === nextDocument.documentId
      ? "scene-transition"
      : "episode-transition",
  });
}

export function resolveSceneAtPosition(
  projection: SceneProjectionList | null,
  document: Pick<ManuscriptDocumentSource, "workId" | "documentId">,
  offset: number,
): SceneProjection | null {
  if (
    projection === null ||
    projection.workId !== document.workId ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) return null;
  const candidates = projection.scenes.filter((scene) =>
    scene.documentId === document.documentId &&
    scene.integrity === "resolved" &&
    scene.range !== null &&
    scene.range.start <= offset &&
    (offset < scene.range.end ||
      (offset === scene.range.end && scene.range.end === scene.range.start)) &&
    scene.range.start < scene.range.end
  );
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length > 1) {
    return [...candidates].sort((left,right) =>
      left.range!.start-right.range!.start || left.sceneKey.localeCompare(right.sceneKey)
    )[0] ?? null;
  }
  const ending = projection.scenes
    .filter((scene) =>
      scene.documentId === document.documentId &&
      scene.integrity === "resolved" &&
      scene.range !== null &&
      scene.range.end === offset &&
      scene.range.start < scene.range.end
    )
    .sort((left,right) => right.range!.start-left.range!.start);
  return ending[0] ?? null;
}

export function selectSplitSceneResults(
  projection: SceneProjectionList,
  documentId: ManuscriptDocumentSource["documentId"],
  offset: number,
): readonly SceneProjection[] {
  const probes = [Math.max(0,offset-1),offset];
  const selected = probes.flatMap((probe) => {
    const documentScene = projection.scenes.find((scene) =>
      scene.documentId === documentId &&
      scene.integrity === "resolved" &&
      scene.range !== null &&
      scene.range.start <= probe &&
      probe < scene.range.end &&
      scene.range.start < scene.range.end
    );
    return documentScene === undefined ? [] : [documentScene];
  });
  const identities = new Set<string>();
  return Object.freeze(selected.filter((scene) => {
    const key = sceneAnalysisOccurrenceKey(scene);
    if (identities.has(key)) return false;
    identities.add(key);
    return true;
  }));
}
