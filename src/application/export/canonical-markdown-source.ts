import type { CharacterProjection } from "../characters/character-contract";
import type { CharacterRelationProjection } from "../characters/character-relation-contract";
import type { CharacterKnowledgeProjection } from "../continuity/character-knowledge-contract";
import type { ContinuityThreadProjection } from "../continuity/continuity-thread-contract";
import type { ForeshadowLineProjection } from "../foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointProjection } from "../foreshadowing/foreshadow-point-contract";
import type { LoreEntryProjection } from "../lore/lore-entry-contract";
import type { LoreForeshadowLinkProjection } from "../lore/lore-foreshadow-link-contract";
import type { PlotThreadProjection } from "../plots/plot-contract";
import type { PlotEventLinkProjection } from "../plots/plot-event-link-contract";
import type { EventBlockProjection, EventSourceProjection } from "../structure/event-block-contract";
import type { SceneAnnotationProjection } from "../structure/scene-annotation-contract";
import type { SceneProjection } from "../structure/scene-projection";
import type { WorkspaceDocumentSummary, WorkspaceWorkSummary } from "../workspace/workspace-contract";
import type {
  CanonicalMarkdownEntitySource,
  CanonicalMarkdownExportSource,
  CanonicalMarkdownField,
  CanonicalMarkdownFieldValue,
  CanonicalMarkdownLink,
} from "./canonical-markdown-export";

const field = (label: string, value: CanonicalMarkdownFieldValue): CanonicalMarkdownField =>
  Object.freeze({ label, value });
const link = (
  label: string,
  targetKind: CanonicalMarkdownLink["targetKind"],
  targetId: string,
): CanonicalMarkdownLink => Object.freeze({ label, targetKind, targetId });

function evidenceLines(input: readonly Readonly<{
  exactText?: string;
  exactQuote?: string;
  documentId?: string;
  sourceDocumentId?: string;
  documentRevisionId?: string;
  sourceDocumentRevisionId?: string;
  integrity?: string;
}>[]): readonly string[] {
  return Object.freeze(input.map((entry) => {
    const documentId = entry.documentId ?? entry.sourceDocumentId ?? "unknown-document";
    const revisionId = entry.documentRevisionId ?? entry.sourceDocumentRevisionId ?? "unknown-revision";
    const exact = entry.exactText ?? entry.exactQuote ?? "";
    return `${documentId}@${revisionId} · ${entry.integrity ?? "recorded"} · ${exact}`;
  }));
}

function characterEntity(entry: CharacterProjection): CanonicalMarkdownEntitySource {
  return Object.freeze({
    kind: "character",
    entityId: entry.characterId,
    revision: entry.revision,
    title: entry.name,
    aliases: entry.aliases,
    status: entry.retiredAt === null ? "active" : "retired",
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("역할", entry.role),
      field("요약", entry.summary),
      field("외형", entry.appearance),
      field("성격", entry.personality),
      field("말투", entry.speech),
      field("목표", entry.goal),
      field("갈등", entry.conflict),
      field("메모", entry.note),
      field("원문 근거", evidenceLines(entry.evidences)),
    ]),
    links: Object.freeze([]),
  });
}

function relationEntity(entry: CharacterRelationProjection): CanonicalMarkdownEntitySource {
  return Object.freeze({
    kind: "character-relation",
    entityId: entry.relationId,
    revision: entry.revision,
    title: entry.kind || `${entry.fromCharacterId} → ${entry.toCharacterId}`,
    aliases: Object.freeze([]),
    status: entry.retiredAt === null ? "active" : "retired",
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("관계 종류", entry.kind),
      field("설명", entry.description),
      field("은퇴 사유", entry.retirementReason),
    ]),
    links: Object.freeze([
      link("출발 인물", "character", entry.fromCharacterId),
      link("도착 인물", "character", entry.toCharacterId),
    ]),
  });
}

function loreEntity(
  entry: LoreEntryProjection,
  links: readonly LoreForeshadowLinkProjection[],
): CanonicalMarkdownEntitySource {
  return Object.freeze({
    kind: "lore-entry",
    entityId: entry.loreEntryId,
    revision: entry.revision,
    title: entry.title,
    aliases: entry.aliases,
    status: entry.retiredAt !== null ? "retired" : entry.enabled ? "active" : "disabled",
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("분류", entry.category),
      field("내용", entry.content),
      field("활성", entry.enabled),
      field("원문 근거", evidenceLines(entry.evidences)),
    ]),
    links: Object.freeze(links
      .filter((candidate) => candidate.loreEntryId === entry.loreEntryId && candidate.unlinkedAt === null)
      .map((candidate) => link("연결 복선", "foreshadow-line", candidate.lineId))),
  });
}

function eventEntity(
  entry: EventBlockProjection,
  sources: readonly EventSourceProjection[],
): CanonicalMarkdownEntitySource {
  const eventSources = sources.filter((source) =>
    source.eventBlockId === entry.eventBlockId && source.retiredAt === null
  );
  return Object.freeze({
    kind: "event-block",
    entityId: entry.eventBlockId,
    revision: entry.revision,
    title: entry.title,
    aliases: Object.freeze([]),
    status: entry.retiredAt === null ? "active" : "retired",
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("메모", entry.note),
      field("정렬 키", entry.outlineOrderKey),
      field("원문 근거", evidenceLines(eventSources.flatMap((source) => source.anchors))),
    ]),
    links: Object.freeze(entry.parentEventId === null
      ? []
      : [link("상위 사건", "event-block", entry.parentEventId)]),
  });
}

function plotEntity(
  entry: PlotThreadProjection,
  links: readonly PlotEventLinkProjection[],
): CanonicalMarkdownEntitySource {
  return Object.freeze({
    kind: "plot-thread",
    entityId: entry.plotThreadId,
    revision: entry.revision,
    title: entry.title,
    aliases: Object.freeze([]),
    status: entry.retiredAt === null ? "active" : "retired",
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("단계", entry.stage),
      field("요약", entry.summary),
      field("메모", entry.note),
    ]),
    links: Object.freeze(links
      .filter((candidate) => candidate.plotBeatId === entry.plotThreadId && candidate.retiredAt === null)
      .map((candidate) => link(`연결 사건 · ${candidate.role}`, "event-block", candidate.eventBlockId))),
  });
}

function foreshadowEntity(
  entry: ForeshadowLineProjection,
  points: readonly ForeshadowPointProjection[],
  loreLinks: readonly LoreForeshadowLinkProjection[],
): CanonicalMarkdownEntitySource {
  const linePoints = points.filter((point) => point.lineId === entry.lineId);
  return Object.freeze({
    kind: "foreshadow-line",
    entityId: entry.lineId,
    revision: entry.revision,
    title: entry.title,
    aliases: Object.freeze([]),
    status: entry.retiredAt === null ? "active" : "retired",
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("메모", entry.note),
      field("복선 지점", linePoints.map((point) =>
        `${point.roleId} · ${point.sourceDocumentId}@${point.sourceDocumentRevisionId} · ${point.integrity} · ${point.exactText} · ${point.note}`
      )),
    ]),
    links: Object.freeze(loreLinks
      .filter((candidate) => candidate.lineId === entry.lineId && candidate.unlinkedAt === null)
      .map((candidate) => link("연결 설정", "lore-entry", candidate.loreEntryId))),
  });
}

function sceneEntities(
  scenes: readonly SceneProjection[],
  annotations: readonly SceneAnnotationProjection[],
): readonly CanonicalMarkdownEntitySource[] {
  const groups = new Map<string, SceneProjection[]>();
  for (const scene of scenes) {
    const sceneId = scene.sceneIdentity?.sceneId;
    if (sceneId === undefined) continue;
    const group = groups.get(sceneId) ?? [];
    group.push(scene);
    groups.set(sceneId, group);
  }
  return Object.freeze([...groups.entries()].map(([sceneId, entries]) => {
    const first = entries[0]!;
    const annotation = annotations
      .filter((candidate) => candidate.binding.sceneId === sceneId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const segments = first.sceneIdentity?.segments ?? [];
    const eventIds = [...new Set(entries.flatMap((entry) => entry.events.map((event) => event.eventBlockId)))];
    const characterIds = annotation?.characterIds ?? [];
    return Object.freeze({
      kind: "scene" as const,
      entityId: sceneId,
      revision: annotation?.revision ?? null,
      title: annotation?.title || `${first.documentTitle} 장면 ${first.sceneIndex + 1}`,
      aliases: Object.freeze([]),
      status: entries.some((entry) => entry.integrity !== "resolved") ? "needs-review" : "active",
      updatedAt: annotation?.updatedAt ?? first.documentRevisionId,
      fields: Object.freeze([
        field("회차 구간", segments.map((segment) =>
          `${segment.documentTitle} · ${segment.documentId}@${segment.documentRevisionId} · ${segment.range === null ? segment.integrity : `${segment.range.start}-${segment.range.end}`}`
        )),
        field("요약", annotation?.summary ?? ""),
        field("장소", annotation?.location ?? ""),
        field("시간", annotation?.time ?? ""),
        field("목표", annotation?.goal ?? ""),
        field("갈등", annotation?.conflict ?? ""),
        field("결과", annotation?.outcome ?? ""),
      ]),
      links: Object.freeze([
        ...eventIds.map((eventId) => link("장면 사건", "event-block", eventId)),
        ...characterIds.map((characterId) => link("등장 인물", "character", characterId)),
        ...(annotation?.povCharacterId === null || annotation?.povCharacterId === undefined
          ? []
          : [link("시점 인물", "character", annotation.povCharacterId)]),
      ]),
    });
  }));
}

function continuityEntity(entry: ContinuityThreadProjection): CanonicalMarkdownEntitySource {
  return Object.freeze({
    kind: "continuity-thread",
    entityId: entry.threadId,
    revision: entry.revision,
    title: entry.title,
    aliases: Object.freeze([]),
    status: entry.status,
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("종류", entry.kind),
      field("메모", entry.note),
      field("열림 근거", evidenceLines(entry.openedEvidence)),
      field("해결 근거", evidenceLines(entry.resolutionEvidence)),
    ]),
    links: Object.freeze(entry.subjectRefs.map((subject) =>
      link("관련 별빛", subject.kind, subject.id)
    )),
  });
}

function knowledgeEntity(entry: CharacterKnowledgeProjection): CanonicalMarkdownEntitySource {
  return Object.freeze({
    kind: "character-knowledge",
    entityId: entry.knowledgeId,
    revision: entry.revision,
    title: entry.statement,
    aliases: Object.freeze([]),
    status: entry.status,
    updatedAt: entry.updatedAt,
    fields: Object.freeze([
      field("서술", entry.statement),
      field("입장", entry.stance),
      field("진실 상태", entry.truthStatus),
      field("원문 근거", evidenceLines(entry.evidence)),
    ]),
    links: Object.freeze([
      link("인물", "character", entry.characterId),
      ...entry.aboutRefs.map((about) => link("대상 별빛", about.kind, about.id)),
      ...(entry.supersedesKnowledgeId === null
        ? []
        : [link("이전 지식", "character-knowledge", entry.supersedesKnowledgeId)]),
      ...(entry.supersededByKnowledgeId === null
        ? []
        : [link("후속 지식", "character-knowledge", entry.supersededByKnowledgeId)]),
    ]),
  });
}

export function projectCanonicalMarkdownExportSource(input: Readonly<{
  work: WorkspaceWorkSummary;
  documents: readonly WorkspaceDocumentSummary[];
  characters: readonly CharacterProjection[];
  characterRelations: readonly CharacterRelationProjection[];
  loreEntries: readonly LoreEntryProjection[];
  loreForeshadowLinks: readonly LoreForeshadowLinkProjection[];
  eventBlocks: readonly EventBlockProjection[];
  eventSources: readonly EventSourceProjection[];
  plotThreads: readonly PlotThreadProjection[];
  plotEventLinks: readonly PlotEventLinkProjection[];
  foreshadowLines: readonly ForeshadowLineProjection[];
  foreshadowPoints: readonly ForeshadowPointProjection[];
  scenes: readonly SceneProjection[];
  sceneAnnotations: readonly SceneAnnotationProjection[];
  continuityThreads: readonly ContinuityThreadProjection[];
  characterKnowledge: readonly CharacterKnowledgeProjection[];
}>): CanonicalMarkdownExportSource {
  return Object.freeze({
    schemaVersion: 1,
    workId: input.work.workId,
    workTitle: input.work.title,
    documents: Object.freeze(input.documents.map((document) => Object.freeze({
      documentId: document.documentId,
      title: document.title,
      documentRevisionId: document.currentRevisionId,
    }))),
    entities: Object.freeze([
      ...input.characters.map(characterEntity),
      ...input.characterRelations.map(relationEntity),
      ...input.loreEntries.map((entry) => loreEntity(entry, input.loreForeshadowLinks)),
      ...input.eventBlocks.map((entry) => eventEntity(entry, input.eventSources)),
      ...input.plotThreads.map((entry) => plotEntity(entry, input.plotEventLinks)),
      ...input.foreshadowLines.map((entry) =>
        foreshadowEntity(entry, input.foreshadowPoints, input.loreForeshadowLinks)
      ),
      ...sceneEntities(input.scenes, input.sceneAnnotations),
      ...input.continuityThreads.map(continuityEntity),
      ...input.characterKnowledge.map(knowledgeEntity),
    ]),
  });
}
