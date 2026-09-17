import type {
  ManuscriptEditorDocumentState,
  ManuscriptFormattingRange,
  ManuscriptParagraphAlignmentEntry,
} from "../editor/manuscript-formatting";
import type { SceneProjection } from "./scene-projection";
import type { EntityId } from "../../domain/writing";
import type { SceneDeletionTarget } from "./scene-trash-contract";

export type SceneDeletionPlanDocument = Readonly<{
  documentId: EntityId<"Document">;
  documentTitle: string;
  documentRevisionId: EntityId<"DocumentRevision">;
  text: string;
}>;

export type PlannedSceneDeletionDocument = Readonly<{
  documentId: EntityId<"Document">;
  documentTitle: string;
  expectedDocumentRevisionId: EntityId<"DocumentRevision">;
  sceneKey: string;
  sceneRange: Readonly<{ start: number; end: number }>;
  deletionRange: Readonly<{ start: number; end: number }>;
  removedBoundaryAnchorId: EntityId<"Anchor"> | null;
  sceneContent: string;
  deletedText: string;
  nextText: string;
  firstExcerpt: string;
  lastExcerpt: string;
}>;

export type SceneDeletionPlan = Readonly<{
  targetScenes: readonly SceneProjection[];
  documents: readonly PlannedSceneDeletionDocument[];
}>;

function excerptSentences(text: string): readonly string[] {
  return [...text.matchAll(/[^.!?。！？\r\n]+[.!?。！？]*/gu)]
    .map((match) => match[0].trim())
    .filter((sentence) => sentence.length > 0);
}

function assertResolvedScene(scene: SceneProjection): asserts scene is SceneProjection & {
  readonly range: Readonly<{ start: number; end: number }>;
} {
  if (
    scene.integrity !== "resolved" ||
    scene.range === null ||
    scene.range.end <= scene.range.start
  ) {
    throw new Error(`Scene deletion target is unresolved: ${scene.sceneKey}`);
  }
}

function selectIdentityDeletionScenes(
  clicked: SceneProjection & {
    readonly sceneIdentity: NonNullable<SceneProjection["sceneIdentity"]>;
  },
  scenes: readonly SceneProjection[],
): readonly SceneProjection[] {
  const sceneId = clicked.sceneIdentity.sceneId;
  const attachedScenes = scenes.filter(
    (scene) => scene.sceneIdentity?.sceneId === sceneId,
  );
  const segments = clicked.sceneIdentity.segments;
  if (segments.length === 0) return attachedScenes;

  const segmentByDocument = new Map<
    EntityId<"Document">,
    (typeof segments)[number]
  >();
  for (const segment of segments) {
    if (segmentByDocument.has(segment.documentId)) {
      throw new Error("Scene deletion has ambiguous segments in one Document");
    }
    segmentByDocument.set(segment.documentId, segment);
  }

  return [...segmentByDocument.values()].map((segment) => {
    const attachedInDocument = attachedScenes.filter(
      (scene) => scene.documentId === segment.documentId,
    );
    if (attachedInDocument.length > 1) {
      throw new Error("Scene deletion has ambiguous segments in one Document");
    }
    if (attachedInDocument.length === 1) return attachedInDocument[0]!;

    const resolvedCandidates = scenes.filter(
      (scene) =>
        scene.documentId === segment.documentId &&
        scene.integrity === "resolved" &&
        scene.range !== null &&
        scene.range.end > scene.range.start,
    );
    const matchingCandidates = segment.range === null
      ? resolvedCandidates
      : resolvedCandidates.filter((scene) =>
          scene.range!.start < segment.range!.end &&
          segment.range!.start < scene.range!.end
        );
    if (matchingCandidates.length !== 1) {
      throw new Error(
        `Scene deletion has an unresolved episode segment: ${segment.documentId}`,
      );
    }
    return matchingCandidates[0]!;
  });
}

export function resolveSceneDeletionTarget(input: Readonly<{
  requestedScenes: readonly SceneProjection[];
  scenes: readonly SceneProjection[];
}>): SceneDeletionTarget {
  const requestedScenes = input.requestedScenes.filter(
    (scene, index, candidates) =>
      scene.range !== null &&
      candidates.findIndex(
        (candidate) => candidate.sceneKey === scene.sceneKey,
      ) === index,
  );
  const first = requestedScenes[0];
  if (first === undefined) {
    throw new Error("Scene deletion selection is empty");
  }
  const identityIds = [...new Set(requestedScenes.flatMap((scene) =>
    scene.sceneIdentity === undefined ? [] : [scene.sceneIdentity.sceneId]
  ))];
  if (identityIds.length > 1) {
    throw new Error("Scene deletion selection contains different identities");
  }
  const sceneId = identityIds[0] ?? null;
  if (sceneId === null) {
    return Object.freeze({
      sceneId: null,
      documentId: first.documentId,
      sceneKey: first.sceneKey,
    });
  }
  const carrier = requestedScenes.find(
    (scene) => scene.sceneIdentity?.sceneId === sceneId,
  );
  if (carrier?.sceneIdentity === undefined) {
    throw new Error("Scene deletion identity carrier is unavailable");
  }
  const deletionScenes = selectIdentityDeletionScenes(
    carrier as SceneProjection & {
      readonly sceneIdentity: NonNullable<SceneProjection["sceneIdentity"]>;
    },
    input.scenes,
  );
  const deletionSceneKeys = new Set(
    deletionScenes.map((scene) => scene.sceneKey),
  );
  if (requestedScenes.some((scene) => !deletionSceneKeys.has(scene.sceneKey))) {
    throw new Error("Scene deletion selection contains different identities");
  }
  return Object.freeze({
    sceneId,
    documentId: carrier.documentId,
    sceneKey: carrier.sceneKey,
  });
}

export function planSceneDeletion(input: Readonly<{
  target: SceneDeletionTarget;
  scenes: readonly SceneProjection[];
  documents: readonly SceneDeletionPlanDocument[];
}>): SceneDeletionPlan {
  const clicked = input.scenes.find((scene) =>
    scene.documentId === input.target.documentId &&
    scene.sceneKey === input.target.sceneKey
  );
  if (clicked === undefined) {
    throw new Error(`Unknown Scene deletion target: ${input.target.sceneKey}`);
  }
  if ((clicked.sceneIdentity?.sceneId ?? null) !== input.target.sceneId) {
    throw new Error("Scene deletion target identity changed");
  }
  const targetScenes = input.target.sceneId === null
    ? [clicked]
    : selectIdentityDeletionScenes(
        clicked as SceneProjection & {
          readonly sceneIdentity: NonNullable<SceneProjection["sceneIdentity"]>;
        },
        input.scenes,
      );
  if (targetScenes.length === 0) {
    throw new Error("Scene deletion target has no current segments");
  }
  const documentIds = targetScenes.map((scene) => scene.documentId);
  if (new Set(documentIds).size !== documentIds.length) {
    throw new Error("Scene deletion has ambiguous segments in one Document");
  }
  const planned = targetScenes
    .map((targetScene) => {
      assertResolvedScene(targetScene);
      const document = input.documents.find(
        (candidate) => candidate.documentId === targetScene.documentId,
      );
      if (
        document === undefined ||
        document.documentRevisionId !== targetScene.documentRevisionId ||
        targetScene.range.end > document.text.length
      ) {
        throw new Error(`Scene deletion Document changed: ${targetScene.documentId}`);
      }
      const documentScenes = input.scenes
        .filter((scene) => scene.documentId === targetScene.documentId)
        .sort(
          (left, right) =>
            (left.range?.start ?? Number.MAX_SAFE_INTEGER) -
              (right.range?.start ?? Number.MAX_SAFE_INTEGER) ||
            left.sceneKey.localeCompare(right.sceneKey),
        );
      const targetIndex = documentScenes.findIndex(
        (scene) => scene.sceneKey === targetScene.sceneKey,
      );
      if (targetIndex < 0) throw new Error("Scene deletion order is unavailable");
      const previous = documentScenes[targetIndex - 1];
      const next = documentScenes[targetIndex + 1];
      let deletionRange = targetScene.range;
      let removedBoundaryAnchorId: EntityId<"Anchor"> | null = null;
      if (next?.range !== null && next?.range !== undefined) {
        deletionRange = Object.freeze({
          start: targetScene.range.start,
          end: next.range.start,
        });
        removedBoundaryAnchorId = targetScene.endAnchorId;
      } else if (previous?.range !== null && previous?.range !== undefined) {
        deletionRange = Object.freeze({
          start: previous.range.end,
          end: targetScene.range.end,
        });
        removedBoundaryAnchorId = targetScene.startAnchorId;
      }
      if (
        deletionRange.start < 0 ||
        deletionRange.end <= deletionRange.start ||
        deletionRange.end > document.text.length
      ) {
        throw new Error(`Scene deletion envelope is invalid: ${targetScene.sceneKey}`);
      }
      const sceneContent = document.text.slice(
        targetScene.range.start,
        targetScene.range.end,
      );
      const deletedText = document.text.slice(
        deletionRange.start,
        deletionRange.end,
      );
      const excerpts = excerptSentences(sceneContent);
      if (sceneContent.length === 0 || excerpts.length === 0) {
        throw new Error("An empty Scene cannot be moved to trash");
      }
      return Object.freeze({
        documentId: document.documentId,
        documentTitle: document.documentTitle,
        expectedDocumentRevisionId: document.documentRevisionId,
        sceneKey: targetScene.sceneKey,
        sceneRange: Object.freeze({ ...targetScene.range }),
        deletionRange,
        removedBoundaryAnchorId,
        sceneContent,
        deletedText,
        nextText:
          document.text.slice(0, deletionRange.start) +
          document.text.slice(deletionRange.end),
        firstExcerpt: excerpts[0] as string,
        lastExcerpt: excerpts[excerpts.length - 1] as string,
      });
    })
    .sort(
      (left, right) =>
        left.documentId.localeCompare(right.documentId) ||
        left.deletionRange.start - right.deletionRange.start,
    );
  return Object.freeze({
    targetScenes: Object.freeze(targetScenes),
    documents: Object.freeze(planned),
  });
}

function mapOffsetAfterDeletion(offset: number, from: number, to: number): number {
  if (offset <= from) return offset;
  if (offset >= to) return offset - (to - from);
  return from;
}

function lineStartAt(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  return text.lastIndexOf("\n", Math.max(0, clamped - 1)) + 1;
}

export function deleteManuscriptEditorStateRange(input: Readonly<{
  text: string;
  state: ManuscriptEditorDocumentState;
  range: Readonly<{ start: number; end: number }>;
}>): ManuscriptEditorDocumentState {
  const { start, end } = input.range;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > input.text.length
  ) {
    throw new Error("Formatting deletion range must stay inside the manuscript");
  }
  const nextText = input.text.slice(0, start) + input.text.slice(end);
  const ranges = input.state.ranges.flatMap((range): readonly ManuscriptFormattingRange[] => {
    const from = mapOffsetAfterDeletion(range.from, start, end);
    const to = mapOffsetAfterDeletion(range.to, start, end);
    return from < to ? [Object.freeze({ ...range, from, to })] : [];
  });
  const alignmentsByOffset = new Map<number, ManuscriptParagraphAlignmentEntry>();
  for (const alignment of input.state.paragraphAlignments) {
    const mapped = lineStartAt(
      nextText,
      mapOffsetAfterDeletion(alignment.at, start, end),
    );
    alignmentsByOffset.set(mapped, Object.freeze({ ...alignment, at: mapped }));
  }
  return Object.freeze({
    ...input.state,
    ranges: Object.freeze(ranges),
    paragraphAlignments: Object.freeze(
      [...alignmentsByOffset.values()].sort((left, right) => left.at - right.at),
    ),
  });
}
