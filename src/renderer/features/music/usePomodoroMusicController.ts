import { useCallback } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { MusicTrackProjection } from "../../../application/music/media-track";
import {
  selectedSceneMusicQueueOption,
  type SceneMusicQueueCandidate,
} from "../../../application/music/scene-music-queue-contract";
import type { WorkMusicSettingsProjection } from "../../../application/music/work-music-settings";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";

export function usePomodoroMusicController(input: Readonly<{
  listSceneMusicQueueCandidates: (
    workId: EntityId<"Work">,
  ) => Promise<readonly SceneMusicQueueCandidate[]>;
  playMusicQueue: (tracks: readonly MusicTrackProjection[]) => void;
  readDocumentState: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptDocumentStateSummary | null | undefined;
  replaceSceneMusicQueueCandidates: (
    candidates: readonly SceneMusicQueueCandidate[],
  ) => void;
  replaceSceneProjection: (projection: SceneProjectionList) => void;
  structureClient: Pick<StudioBridge["structure"], "listSceneProjection">;
  workMusicSettings: WorkMusicSettingsProjection | null;
}>) {
  return useCallback(async (document: ManuscriptDocumentSource) => {
    if (
      input.workMusicSettings?.workId !== document.workId ||
      !input.workMusicSettings.settings.autoPlayOnPomodoroStart
    ) return;
    const editorState = input.readDocumentState(document);
    const selection =
      editorState?.selection.ranges[editorState.selection.mainIndex];
    if (selection === undefined) return;
    const [currentScenes, currentQueueCandidates] = await Promise.all([
      input.structureClient.listSceneProjection({
        schemaVersion: 1,
        workId: document.workId,
      }),
      input.listSceneMusicQueueCandidates(document.workId),
    ]);
    input.replaceSceneProjection(currentScenes);
    input.replaceSceneMusicQueueCandidates(currentQueueCandidates);
    const cursor = selection.head;
    const documentScenes = currentScenes.scenes.filter((scene) =>
      scene.documentId === document.documentId &&
      scene.integrity === "resolved" &&
      scene.range !== null &&
      scene.range.start <= cursor
    );
    const currentScene = documentScenes.find((scene) =>
      scene.range !== null && cursor < scene.range.end
    ) ?? documentScenes.at(-1);
    const selectedCandidate = currentScene === undefined
      ? undefined
      : currentQueueCandidates.find((candidate) =>
          candidate.sceneKey === currentScene.sceneKey &&
          candidate.status === "selected" &&
          candidate.integrity === "current"
        );
    const selectedOption = selectedCandidate === undefined
      ? null
      : selectedSceneMusicQueueOption(selectedCandidate);
    if (selectedOption !== null) input.playMusicQueue(selectedOption.tracks);
  }, [input]);
}
