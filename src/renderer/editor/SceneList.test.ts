import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import type { SceneProjectionList } from "../../application/structure/scene-projection";
import { SceneList } from "./SceneList";

const createdAt = "2026-08-16T00:00:00.000Z";
const workId = entityId<"Work">("work-scene-list");
const documentId = entityId<"Document">("document-scene-list");
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

describe("SceneList", () => {
  it("shows final scenes, automatic membership, manual exceptions, and unassigned events", () => {
    const markup = renderToStaticMarkup(createElement(SceneList, {
      projection,
      activeDocumentId: documentId,
      busy: false,
      onOpenScene: vi.fn(),
      onSplitScene: vi.fn(),
      onMergeWithPrevious: vi.fn(),
      onSetEventOverride: vi.fn(),
      onUpdateRuleSet: vi.fn(),
    }));

    expect(markup).toContain("장면 1");
    expect(markup).toContain("0–17");
    expect(markup).toContain("자동 소속 사건");
    expect(markup).toContain("자동 소속");
    expect(markup).toContain("수동 제외 사건");
    expect(markup).toContain("제외 해제");
    expect(markup).toContain("미배정 예정 사건");
    expect(markup).toContain("이 장면에 포함");
    expect(markup).not.toContain("SceneOverride");
  });

  it("exposes the configured parser instead of fixing a delimiter in product code", () => {
    const markup = renderToStaticMarkup(createElement(SceneList, {
      projection,
      activeDocumentId: documentId,
      busy: false,
      onOpenScene: vi.fn(),
      onSplitScene: vi.fn(),
      onMergeWithPrevious: vi.fn(),
      onSetEventOverride: vi.fn(),
      onUpdateRuleSet: vi.fn(),
    }));

    expect(markup).toContain("장면 규칙 설정");
    expect(markup).toContain("별표 구분선");
    expect(markup).toContain("^\\s*\\*\\*\\*\\s*$");
    expect(markup).toContain("규칙 저장");
  });
});
