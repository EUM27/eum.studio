import { describe, expect, it, vi } from "vitest";

import { parseChatGptOAuthProfile } from "../../application/assistant/chatgpt-oauth";
import { createNodeChatGptCodexClient } from "./node-chatgpt-codex";
import type {
  ChatGptOAuthConnectionStatus,
} from "../../application/assistant/chatgpt-oauth";
import type {
  ChatGptOAuthConnectionStore,
  ChatGptOAuthTokens,
} from "./node-chatgpt-oauth";

function jwt(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("node ChatGPT Codex client", () => {
  it("refreshes server-side OAuth tokens and returns a strict character payload", async () => {
    const profile = parseChatGptOAuthProfile({
      schemaVersion: 1,
      providerId: "provider-a",
      displayName: "GPT",
      issuer: "https://auth.example.invalid",
      clientId: "runtime-client",
      authorizationPath: "/oauth/authorize",
      tokenPath: "/oauth/token",
      scopes: ["openid", "offline_access"],
      authorizeParameters: { originator: "runtime-originator" },
      callback: {
        listenHost: "127.0.0.1",
        redirectHost: "localhost",
        path: "/auth/callback",
        portRange: { start: 1455, end: 1475 },
      },
      upstream: {
        baseUrl: "https://chatgpt.example.invalid/backend-api/codex",
        originator: "runtime-originator",
        clientVersion: "runtime-version",
        model: "runtime-model",
      },
    });
    let tokens: ChatGptOAuthTokens | null = {
      accessToken: jwt({ exp: 1 }),
      refreshToken: "refresh-secret",
      idToken: jwt({}),
      accountId: "account-a",
      email: null,
      planType: null,
    };
    const saveTokens = vi.fn(async (next: ChatGptOAuthTokens) => {
      tokens = next;
      return {
        schemaVersion: 1,
        revision: 2,
        providerId: "provider-a",
        displayName: "GPT",
        modelId: "runtime-model",
        connected: true,
        email: null,
        planType: null,
        updatedAt: "2026-08-17T00:00:00.000Z",
      } satisfies ChatGptOAuthConnectionStatus;
    });
    const store: ChatGptOAuthConnectionStore = {
      getStatus: () => ({
        schemaVersion: 1,
        revision: 1,
        providerId: "provider-a",
        displayName: "GPT",
        modelId: "runtime-model",
        connected: tokens !== null,
        email: null,
        planType: null,
        updatedAt: null,
      }),
      readTokens: () => tokens,
      saveTokens,
    };
    const modelPayload = JSON.stringify({
      characters: [{
        name: "윤서",
        aliases: [],
        role: "기록자",
        summary: "",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "",
        evidences: [{ paragraphId: "p1", quote: "윤서" }],
      }],
    });
    const scenePayload = JSON.stringify({
      scenes: [{
        title: "첫 장면",
        fromParagraphId: "p1",
        toParagraphId: "p2",
        summary: "",
        povCharacter: "윤서",
        location: "",
        time: "",
        characters: ["윤서"],
        goal: "",
        conflict: "",
        outcome: "",
      }],
    });
    const generationPayload = JSON.stringify({
      characters: [{
        name: "도윤",
        aliases: [],
        role: "탐정",
        summary: "사건을 추적한다.",
        appearance: "",
        personality: "집요함",
        speech: "",
        goal: "진상 규명",
        conflict: "",
        note: "기록자와 협력하는 관계 초안",
      }],
    });
    const sceneDraftPayload = JSON.stringify({
      draftText: "윤서는 닫힌 문 앞에서 경보음을 들었다.",
    });
    const vocabularyPayload = JSON.stringify({
      suggestions: [{
        word: "근엄하다",
        nuance: "무게감이 더 강함",
        example: "근엄한 표정으로 말했다.",
      }],
      note: "문맥에 맞는 후보입니다.",
    });
    const settingReviewPayload = JSON.stringify({
      reply: "현재 설정과 원고를 함께 검토했습니다.",
      proposals: [],
      reviewNotes: [],
    });
    const fetch = vi.fn(async (url: string, init?: {
      readonly headers?: Readonly<Record<string, string>>;
      readonly body?: string;
    }) => {
      if (url.endsWith("/oauth/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: jwt({ exp: 4_000_000_000 }),
            refresh_token: "refreshed-secret",
            id_token: jwt({
              "https://api.openai.com/auth": {
                chatgpt_account_id: "account-a",
              },
            }),
          }),
          text: async () => "",
        };
      }
      expect(init?.headers).toMatchObject({
        Authorization: expect.stringMatching(/^Bearer /u),
        "chatgpt-account-id": "account-a",
        originator: "runtime-originator",
      });
      const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "runtime-model",
        stream: true,
        store: false,
      });
      const formatName = (
        body.text as { readonly format?: { readonly name?: unknown } } | undefined
      )?.format?.name;
      const responsePayload = formatName === undefined
        ? "실제 대화 응답"
        : formatName === "eum_assistant_vocabulary_suggestions"
          ? vocabularyPayload
        : formatName === "eum_assistant_setting_review"
          ? settingReviewPayload
        : formatName === "eum_scene_extraction"
        ? scenePayload
        : formatName === "eum_scene_draft"
          ? sceneDraftPayload
        : formatName === "eum_character_generation"
          ? generationPayload
          : modelPayload;
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => [
          "event: response.output_text.delta",
          `data: ${JSON.stringify({ delta: responsePayload })}`,
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
      };
    });
    const client = createNodeChatGptCodexClient({
      profile,
      store,
      fetch,
      now: () => Date.parse("2026-08-17T00:00:00.000Z"),
    });

    await expect(client.chat([
      { role: "user", text: "질문" },
      { role: "assistant", text: "이전 답변" },
      { role: "user", text: "다음 질문" },
    ])).resolves.toMatchObject({
      providerId: "provider-a",
      modelId: "runtime-model",
      message: { role: "assistant", text: "실제 대화 응답" },
    });
    await expect(client.suggestVocabulary({
      query: "엄정하다와 비슷한 말",
      context: "그는 엄정한 표정을 지었다.",
    })).resolves.toMatchObject({
      suggestions: [{ word: "근엄하다" }],
    });
    await expect(client.reviewSettings({
      query: "설정 충돌을 확인해줘",
      manuscript: {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 0,
        to: 12,
        text: "윤서는 문 앞에 섰다.",
      },
      settings: [{
        workId: "work-a" as never,
        kind: "character",
        entityId: "character-a",
        revision: 1,
        label: "윤서",
        fields: [{ field: "role", value: "기록자" }],
      }],
    })).resolves.toMatchObject({
      reply: "현재 설정과 원고를 함께 검토했습니다.",
    });

    const result = await client.extractCharacters([{
      paragraphId: "p1",
      from: 0,
      to: 6,
      text: "윤서가 섰다.",
    }]);

    expect(result).toMatchObject({
      providerId: "provider-a",
      modelId: "runtime-model",
      payload: { characters: [{ name: "윤서" }] },
    });
    await expect(client.generateCharacters({
      role: "탐정",
      personality: "집요함",
      relationships: "기록자와 협력",
      genre: "미스터리",
    })).resolves.toMatchObject({
      providerId: "provider-a",
      modelId: "runtime-model",
      payload: { characters: [{ name: "도윤", role: "탐정" }] },
    });
    await expect(client.extractScenes([
      { paragraphId: "p1", from: 0, to: 6, text: "윤서가 섰다." },
      { paragraphId: "p2", from: 7, to: 12, text: "문이 닫혔다." },
    ])).resolves.toMatchObject({
      providerId: "provider-a",
      modelId: "runtime-model",
      payload: { scenes: [{ title: "첫 장면", fromParagraphId: "p1" }] },
    });
    await expect(client.draftScene({
      plot: {
        plotThreadId: "plot-a" as never,
        revision: 1,
        title: "닫힌 문",
        stage: "전환",
        summary: "문을 연다.",
        note: "",
      },
      events: [{
        plotEventLinkId: "link-a" as never,
        linkRevision: 1,
        role: "primary",
        eventBlockId: "event-a" as never,
        eventRevision: 1,
        title: "문이 잠김",
        note: "",
      }],
      characters: [],
      settings: [],
    })).resolves.toMatchObject({
      providerId: "provider-a",
      modelId: "runtime-model",
      payload: { draftText: "윤서는 닫힌 문 앞에서 경보음을 들었다." },
    });
    expect(saveTokens).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(8);
  });
});
