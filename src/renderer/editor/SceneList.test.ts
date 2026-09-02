import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import type { SceneProjectionList } from "../../application/structure/scene-projection";
import type { SceneAnnotationProjection } from "../../application/structure/scene-annotation-contract";
import type { SceneMusicQueueCandidate } from "../../application/music/scene-music-queue-contract";
import { SceneList } from "./SceneList";

const createdAt = "2026-08-16T00:00:00.000Z";
const workId = entityId<"Work">("work-scene-list");
const documentId = entityId<"Document">("document-scene-list");
const sceneId = entityId<"Scene">("scene-identity-list");
const automaticEventId = entityId<"EventBlock">("event-automatic");
const excludedEventId = entityId<"EventBlock">("event-excluded");
const unassignedEventId = entityId<"EventBlock">("event-unassigned");

const projection: SceneProjectionList = Object.freeze({
  schemaVersion: 1,
  workId,
  status: "clean",
  ruleSet: Object.freeze({
    schemaVersion: 1,
    sceneRuleSetId: entityId<"SceneRuleSet">("scene-rules"),
    revision: 2,
    workId,
    displayName: "별표 구분선",
    boundaryRules: Object.freeze([
      Object.freeze({
        boundaryRuleId: "asterisk-divider",
        kind: "line-regexp" as const,
        pattern: "^\\s*\\*\\*\\*\\s*$",
        flags: "u",
      }),
    ]),
    normalizationPolicy: "preserve",
    enabled: true,
    createdAt,
    updatedAt: createdAt,
  }),
  scenes: Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      sceneKey: "scene-final-1",
      workId,
      documentId,
      documentRevisionId: entityId<"DocumentRevision">("revision-scene-list"),
      documentTitle: "첫 회차",
      documentIndex: 0,
      sceneIndex: 1,
      startAnchorId: entityId<"Anchor">("scene-start"),
      endAnchorId: entityId<"Anchor">("scene-end"),
      range: Object.freeze({ start: 0, end: 17 }),
      integrity: "resolved" as const,
      source: "rule" as const,
      events: Object.freeze([
        Object.freeze({
          eventBlockId: automaticEventId,
          title: "자동 소속 사건",
          sourceState: "resolved" as const,
          membership: "automatic" as const,
          sceneEventOverrideId: null,
          sceneEventOverrideRevision: null,
        }),
      ]),
      excludedEvents: Object.freeze([
        Object.freeze({
          eventBlockId: excludedEventId,
          title: "수동 제외 사건",
          sourceState: "resolved" as const,
          sceneEventOverrideId: entityId<"SceneEventOverride">("scene-event-exclude"),
          sceneEventOverrideRevision: 1,
        }),
      ]),
      sceneIdentity: Object.freeze({
        sceneId,
        segments: Object.freeze([]),
      }),
    }),
  ]),
  unassignedEvents: Object.freeze([
    Object.freeze({
      eventBlockId: unassignedEventId,
      title: "미배정 예정 사건",
      sourceState: "unlinked" as const,
    }),
  ]),
  sceneEventOverrides: Object.freeze([]),
});

const annotation: SceneAnnotationProjection = Object.freeze({
  schemaVersion: 1,
  sceneAnnotationId: entityId<"SceneAnnotation">("annotation-a"),
  revision: 1,
  workId,
  sceneKey: "scene-final-1",
  binding: Object.freeze({
    schemaVersion: 1,
    sceneMetadataBindingId: entityId<"SceneMetadataBinding">("binding-a"),
    revision: 1,
    workId,
    metadataKind: "annotation",
    metadataId: "annotation-a",
    sourceSceneKey: "scene-final-1",
    sceneId,
    status: "current",
    proposedSceneId: null,
    lineageOperationId: null,
    createdAt,
    updatedAt: createdAt,
  }),
  documentId,
  documentRevisionId: entityId<"DocumentRevision">("revision-scene-list"),
  sourceCandidateId: entityId<"SceneExtractionCandidate">("candidate-a"),
  sourceSceneItemId: entityId<"SceneExtractionItem">("scene-item-a"),
  title: "닫힌 방",
  summary: "문이 닫힌 뒤 대화가 멈춘다.",
  povCharacterId: null,
  location: "방",
  time: "밤",
  characterIds: Object.freeze([]),
  goal: "",
  conflict: "문이 닫힌다.",
  outcome: "",
  createdAt,
  updatedAt: createdAt,
});

const musicCandidate: SceneMusicQueueCandidate = Object.freeze({
  schemaVersion: 1,
  candidateId: entityId<"SceneMusicQueueCandidate">("music-candidate-a"),
  revision: 1,
  workId,
  sceneKey: "old-scene-fingerprint",
  binding: Object.freeze({
    schemaVersion: 1,
    sceneMetadataBindingId: entityId<"SceneMetadataBinding">("binding-music-a"),
    revision: 1,
    workId,
    metadataKind: "music-queue",
    metadataId: "music-candidate-a",
    sourceSceneKey: "old-scene-fingerprint",
    sceneId,
    status: "current",
    proposedSceneId: null,
    lineageOperationId: null,
    createdAt,
    updatedAt: createdAt,
  }),
  sceneAnnotationId: annotation.sceneAnnotationId,
  sceneAnnotationRevision: annotation.revision,
  providerId: "youtube",
  query: "stable scene identity queue",
  status: "selected",
  integrity: "current",
  options: Object.freeze([Object.freeze({
    optionId: entityId<"SceneMusicQueueOption">("music-option-a"),
    tracks: Object.freeze([Object.freeze({
      providerId: "youtube",
      videoId: "video-a",
      title: "장면 음악",
      channel: "작곡가",
      thumbnailUrl: null,
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    })]),
  })]),
  selectedOptionId: entityId<"SceneMusicQueueOption">("music-option-a"),
  createdAt,
  updatedAt: createdAt,
});

const musicProps = {
  favoriteMusicVideos: [],
  musicQueueCandidates: [],
  musicQueueBusy: false,
  musicConnected: true,
  musicPlaybackAvailable: true,
  sceneTrashEntries: [],
  onOpenMusicSettings: vi.fn(),
  onPlayFavoriteMusicVideo: vi.fn(),
  onRebindSceneMetadata: vi.fn(),
  onRestoreSceneTrash: vi.fn(),
  onSearchSceneMusic: vi.fn(),
  onSelectSceneMusicQueue: vi.fn(),
  onToggleFavoriteMusicVideo: vi.fn(),
  onPlaySceneMusicQueue: vi.fn(),
} as const;

describe("SceneList", () => {
  it("shows final scenes, automatic membership, manual exceptions, and unassigned events", () => {
    const markup = renderToStaticMarkup(createElement(SceneList, {
      projection,
      annotations: [annotation],
      activeDocumentId: documentId,
      busy: false,
      ...musicProps,
      musicQueueCandidates: [musicCandidate],
      sceneCanonContexts: [{
        schemaVersion: 1,workId,sceneId,
        continuity: [{ threadId: entityId<"ContinuityThread">("thread-scene"),revision: 1,title: "문을 다시 열기",status: "open" }],
        knowledge: [{ knowledgeId: entityId<"CharacterKnowledge">("knowledge-scene"),revision: 1,characterId: entityId<"Character">("character-scene"),statement: "문이 잠겼다",stance: "knows",truthStatus: "true",status: "active" }],
        lineageReviews: [{ lineageOperationId: entityId<"SceneLineageOperation">("lineage-split"),operation: "split",parentSceneIds: [sceneId],childSceneIds: [sceneId,entityId<"Scene">("scene-child")],sourceSceneId: sceneId,candidateSceneIds: [sceneId,entityId<"Scene">("scene-child")],referenceKind: "continuity-thread",referenceId: "thread-scene",status: "needs-review" }],
      }],
      onReviewSceneCanon: vi.fn(),
      onOpenSceneContinuity: vi.fn(),
      onOpenSceneKnowledge: vi.fn(),
      onOpenScene: vi.fn(),
      onMergeWithPrevious: vi.fn(),
      onDeleteScene: vi.fn(),
      onSetEventOverride: vi.fn(),
      onUpdateRuleSet: vi.fn(),
    }));

    expect(markup).toContain("장면 1");
    expect(markup).toContain("닫힌 방");
    expect(markup).toContain("문이 닫힌 뒤 대화가 멈춘다.");
    expect(markup).toContain("0–17");
    expect(markup).toContain("자동 소속 사건");
    expect(markup).toContain("자동 소속");
    expect(markup).toContain("수동 제외 사건");
    expect(markup).toContain("제외 해제");
    expect(markup).toContain("미배정 예정 사건");
    expect(markup).toContain("이 장면에 포함");
    expect(markup).toContain("이 장면 별빛 점검");
    expect(markup).toContain("연속성 1건 보기");
    expect(markup).toContain("지식 변화 1건 보기");
    expect(markup).toContain("문을 다시 열기");
    expect(markup).toContain("문이 잠겼다");
    expect(markup).toContain("분할·병합 뒤 별빛 연결 검토 필요");
    expect(markup).toContain("자동 계승하지 않았습니다.");
    expect(markup).toContain("이 장면으로 음악 찾기");
    expect(markup).toContain("선호 영상");
    expect(markup).toContain("닫힌 방 방 밤 문이 닫힌다.");
    expect(markup).toContain("stable scene identity queue");
    expect(markup).not.toContain("현재 위치에서 분할");
    expect(markup).not.toContain("SceneOverride");
  });

  it("exposes the configured parser instead of fixing a delimiter in product code", () => {
    const markup = renderToStaticMarkup(createElement(SceneList, {
      projection,
      annotations: [],
      activeDocumentId: documentId,
      busy: false,
      ...musicProps,
      onOpenScene: vi.fn(),
      onMergeWithPrevious: vi.fn(),
      onDeleteScene: vi.fn(),
      onSetEventOverride: vi.fn(),
      onUpdateRuleSet: vi.fn(),
    }));

    expect(markup).toContain("장면 규칙 설정");
    expect(markup).toContain("별표 구분선");
    expect(markup).toContain("^\\s*\\*\\*\\*\\s*$");
    expect(markup).toContain("규칙 저장");
  });

  it("shows review metadata counts without attaching it to a current Scene card", () => {
    const reviewAnnotation: SceneAnnotationProjection = Object.freeze({
      ...annotation,
      binding: Object.freeze({
        ...annotation.binding,
        revision: 2,
        status: "needsReview",
        proposedSceneId: sceneId,
        lineageOperationId: entityId<"SceneLineageOperation">("lineage-a"),
      }),
    });
    const markup = renderToStaticMarkup(createElement(SceneList, {
      projection,
      annotations: [reviewAnnotation],
      activeDocumentId: documentId,
      busy: false,
      ...musicProps,
      onOpenScene: vi.fn(),
      onMergeWithPrevious: vi.fn(),
      onDeleteScene: vi.fn(),
      onSetEventOverride: vi.fn(),
      onUpdateRuleSet: vi.fn(),
    }));

    expect(markup).toContain("장면 연결 재검토 1건");
    expect(markup).toContain("제안 장면 1에 연결");
    expect(markup).toContain("연결 해제");
    expect(markup).not.toContain("문이 닫힌 뒤 대화가 멈춘다.");
  });

  it("shows active Scene trash with explicit restore availability", () => {
    const markup = renderToStaticMarkup(createElement(SceneList, {
      projection,
      annotations: [],
      activeDocumentId: documentId,
      busy: false,
      ...musicProps,
      sceneTrashEntries: [{
        schemaVersion: 1,
        sceneTrashEntryId: entityId<"SceneTrashEntry">("trash-a"),
        revision: 1,
        workId,
        sceneId,
        sourceSceneKey: "old-scene-key",
        sceneRuleSetRevision: 2,
        status: "active",
        documents: [{
          sceneTrashDocumentId:
            entityId<"SceneTrashDocument">("trash-document-a"),
          documentId,
          documentTitle: "첫 회차",
          ordinal: 0,
          beforeRevisionId: entityId<"DocumentRevision">("before-trash"),
          deletedRevisionId: entityId<"DocumentRevision">("after-trash"),
          restoredRevisionId: null,
          sceneRange: { start: 0, end: 4 },
          deletionRange: { start: 0, end: 8 },
          deletedUtf16Length: 8,
          firstExcerpt: "삭제된 첫 문장",
          lastExcerpt: "삭제된 마지막 문장",
        }],
        metadata: [],
        canRestore: true,
        conflictReason: null,
        deletedAt: createdAt,
        restoredAt: null,
      }],
      onOpenScene: vi.fn(),
      onMergeWithPrevious: vi.fn(),
      onDeleteScene: vi.fn(),
      onSetEventOverride: vi.fn(),
      onUpdateRuleSet: vi.fn(),
    }));

    expect(markup).toContain("장면 휴지통 1건");
    expect(markup).toContain("삭제된 첫 문장");
    expect(markup).toContain("복원");
  });
});
