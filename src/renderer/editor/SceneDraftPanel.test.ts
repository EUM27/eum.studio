import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import type { PlotThreadProjection } from "../../application/plots/plot-contract";
import type { SceneDraftCandidate } from "../../application/structure/scene-draft-contract";
import { SceneDraftPanel } from "./SceneDraftPanel";

const createdAt = "2026-08-17T00:00:00.000Z";
const workId = entityId<"Work">("work-a");
const plot: PlotThreadProjection = {
  schemaVersion: 1,
  plotThreadId: entityId<"PlotThread">("plot-a"),
  revision: 2,
  workId,
  title: "닫힌 문",
  stage: "전환",
  summary: "문을 열어야 한다.",
  note: "",
  createdAt,
  updatedAt: createdAt,
  retiredAt: null,
};

const candidate: SceneDraftCandidate = {
  schemaVersion: 1,
  candidateId: entityId<"SceneDraftCandidate">("candidate-a"),
  revision: 1,
  workId,
  context: {
    plot,
    events: [{
      plotEventLinkId: entityId<"PlotEventLink">("link-a"),
      linkRevision: 1,
      role: "primary",
      eventBlockId: entityId<"EventBlock">("event-a"),
      eventRevision: 1,
      title: "문이 잠김",
      note: "",
    }],
    characters: [],
    settings: [],
  },
  target: {
    documentId: entityId<"Document">("document-a"),
    documentRevisionId: entityId<"DocumentRevision">("revision-a"),
    insertionOffset: 17,
  },
  providerId: "provider-a",
  modelId: "model-a",
  promptVersion: "scene-draft-v1",
  generatedText: "윤서는 문을 밀었다.",
  draftText: "윤서는 문을 밀었다.",
  status: "ready",
  integrity: "current",
  appliedDocumentRevisionId: null,
  createdAt,
  updatedAt: createdAt,
};

const callbacks = {
  onApply: vi.fn(),
  onCompare: vi.fn(),
  onGenerate: vi.fn(),
  onOpenSettings: vi.fn(),
  onRegenerate: vi.fn(),
  onUpdate: vi.fn(),
};

describe("SceneDraftPanel", () => {
  it("keeps the scene draft action visible with a GPT connection guide", () => {
    const markup = renderToStaticMarkup(createElement(SceneDraftPanel, {
      actionState: "idle",
      candidates: [],
      characters: [],
      documentLabels: {},
      error: null,
      linkedEventCount: 0,
      oauthStatus: null,
      plot,
      settings: [],
      ...callbacks,
    }));
    expect(markup).toContain("장면 초안 생성");
    expect(markup).toContain("GPT 연결 후");
    expect(markup).toContain("AI 연결 설정");
  });

  it("shows an editable Candidate, exact insertion location, and insertion diff", () => {
    const markup = renderToStaticMarkup(createElement(SceneDraftPanel, {
      actionState: "idle",
      candidates: [candidate],
      characters: [],
      documentLabels: { "document-a": "1화" },
      error: null,
      linkedEventCount: 1,
      oauthStatus: {
        schemaVersion: 1,
        revision: 1,
        providerId: "runtime-chatgpt",
        displayName: "GPT",
        modelId: "runtime-model",
        connected: true,
        email: null,
        planType: null,
        updatedAt: createdAt,
      },
      plot,
      settings: [],
      ...callbacks,
    }));
    expect(markup).toContain("1화 · 17자 위치");
    expect(markup).toContain("+ 윤서는 문을 밀었다.");
    expect(markup).toContain("후보 변경 저장");
    expect(markup).toContain("이 위치에 삽입");
    expect(markup).toContain("문이 잠김");
  });
});
