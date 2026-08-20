import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseSceneExtractionCandidate } from "../../application/structure/scene-extraction-contract";
import { SceneExtractionPanel } from "./SceneExtractionPanel";

describe("SceneExtractionPanel", () => {
  it("shows exact range, scene previews, and explicit boundary decisions", () => {
    const markup = renderToStaticMarkup(createElement(SceneExtractionPanel, {
      actionState: "idle",
      annotations: [],
      candidates: [parseSceneExtractionCandidate({
        schemaVersion: 1,
        candidateId: "candidate-a",
        revision: 1,
        workId: "work-a",
        sourceRange: {
          documentId: "document-a",
          documentRevisionId: "revision-a",
          from: 0,
          to: 20,
        },
        providerId: "provider-a",
        modelId: "model-a",
        promptVersion: "scene-extraction-v1",
        status: "ready",
        scenes: [
          {
            sceneItemId: "scene-a",
            title: "닫힌 방",
            fromParagraphId: "p1",
            toParagraphId: "p1",
            range: { documentId: "document-a", documentRevisionId: "revision-a", from: 0, to: 9 },
            summary: "문이 닫힌다.",
            povCharacterId: null,
            location: "방",
            time: "",
            characterIds: [],
            goal: "",
            conflict: "",
            outcome: "",
            annotationStatus: "pending",
            sceneAnnotationId: null,
          },
          {
            sceneItemId: "scene-b",
            title: "경보",
            fromParagraphId: "p2",
            toParagraphId: "p2",
            range: { documentId: "document-a", documentRevisionId: "revision-a", from: 10, to: 20 },
            summary: "경보가 울린다.",
            povCharacterId: null,
            location: "",
            time: "",
            characterIds: [],
            goal: "",
            conflict: "",
            outcome: "",
            annotationStatus: "pending",
            sceneAnnotationId: null,
          },
        ],
        boundaries: [{
          boundaryId: "boundary-a",
          fromSceneItemId: "scene-a",
          toSceneItemId: "scene-b",
          offset: 10,
          status: "pending",
          sceneOverrideId: null,
        }],
        contextReceiptId: "receipt-a",
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-17T00:00:00.000Z",
      })],
      characters: [],
      error: null,
      oauthStatus: {
        schemaVersion: 1,
        revision: 1,
        providerId: "runtime-chatgpt",
        displayName: "GPT",
        modelId: "runtime-model",
        connected: true,
        email: null,
        planType: null,
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
      onDecide: () => undefined,
      onDecideAnnotation: () => undefined,
      onOpenSettings: () => undefined,
      onPreviewCandidate: () => undefined,
      onRequestPermission: () => undefined,
      onRun: () => undefined,
      permissionRequired: false,
      projection: null,
      selection: {
        documentId: "document-a",
        documentTitle: "1화",
        documentRevisionId: "revision-a",
        from: 0,
        to: 20,
      },
    }));

    expect(markup).toContain('aria-label="장면 뽑기"');
    expect(markup).toContain("분석 범위 · 1화 0–20");
    expect(markup).toContain("닫힌 방");
    expect(markup).toContain("경보");
    expect(markup).toContain("분할 승인");
    expect(markup).toContain("앞 장면과 합치기");
    expect(markup).toContain("원고에서 분할선 미리보기");
    expect(markup).toContain("장면 정보 승인");
    expect(markup).toContain("분할·병합 경계를 먼저 결정하세요.");
  });
});
