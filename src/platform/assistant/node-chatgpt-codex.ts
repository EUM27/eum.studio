import {
  CHARACTER_EXTRACTION_PROMPT_VERSION,
  parseCharacterExtractionModelPayload,
  type CharacterExtractionModelPayload,
  type CharacterExtractionParagraph,
} from "../../application/characters/character-extraction-contract";
import {
  CHARACTER_GENERATION_PROMPT_VERSION,
  parseCharacterGenerationModelPayload,
  type CharacterGenerationBrief,
  type CharacterGenerationModelPayload,
} from "../../application/characters/character-generation-contract";
import type { ChatGptOAuthProfile } from "../../application/assistant/chatgpt-oauth";
import type {
  AssistantChatMessage,
  AssistantChatResult,
} from "../../application/assistant/assistant-chat";
import {
  parseAssistantVocabularySuggestionPayload,
  type AssistantVocabularySuggestionPayload,
} from "../../application/assistant/assistant-vocabulary-suggestion";
import {
  parseAssistantExternalSettingReviewPayload,
  type AssistantExternalSettingReviewPayload,
} from "../../application/assistant/assistant-external-setting-review";
import type {
  AssistantSettingReviewSource,
} from "../../application/assistant/assistant-setting-review";
import {
  SCENE_EXTRACTION_PROMPT_VERSION,
  parseSceneExtractionModelPayload,
  type SceneExtractionModelPayload,
  type SceneExtractionParagraph,
} from "../../application/structure/scene-extraction-contract";
import {
  SCENE_DRAFT_PROMPT_VERSION,
  parseSceneDraftModelPayload,
  type SceneDraftContext,
  type SceneDraftModelPayload,
} from "../../application/structure/scene-draft-contract";
import type {
  ChatGptOAuthConnectionStore,
  ChatGptOAuthTokens,
} from "./node-chatgpt-oauth";

type FetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type FetchImplementation = (
  input: string,
  init?: Readonly<{
    method?: "GET" | "POST";
    headers?: Readonly<Record<string, string>>;
    body?: string;
  }>,
) => Promise<FetchResponse>;

export type ChatGptCharacterExtractionExecution = {
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof CHARACTER_EXTRACTION_PROMPT_VERSION;
  readonly payload: CharacterExtractionModelPayload;
};

export type ChatGptCharacterGenerationExecution = {
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof CHARACTER_GENERATION_PROMPT_VERSION;
  readonly payload: CharacterGenerationModelPayload;
};

export type ChatGptSceneExtractionExecution = {
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof SCENE_EXTRACTION_PROMPT_VERSION;
  readonly payload: SceneExtractionModelPayload;
};

export type ChatGptSceneDraftExecution = {
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof SCENE_DRAFT_PROMPT_VERSION;
  readonly payload: SceneDraftModelPayload;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  const segments = token.split(".");
  if (segments.length !== 3) return {};
  try {
    return record(
      JSON.parse(
        Buffer.from(segments[1] ?? "", "base64url").toString("utf8"),
      ),
      "ChatGPT OAuth JWT claims",
    );
  } catch {
    return {};
  }
}

function tokenIsFresh(accessToken: string, now: number): boolean {
  const expiry = decodeJwtClaims(accessToken).exp;
  return typeof expiry === "number" && Number.isFinite(expiry) && expiry * 1000 > now;
}

function accountIdFromIdToken(idToken: string): string | null {
  const claims = decodeJwtClaims(idToken);
  const authorization = claims["https://api.openai.com/auth"];
  if (
    typeof authorization !== "object" ||
    authorization === null ||
    Array.isArray(authorization)
  ) {
    return null;
  }
  const accountId = (authorization as Record<string, unknown>)
    .chatgpt_account_id;
  return typeof accountId === "string" && accountId.length > 0
    ? accountId
    : null;
}

function collectResponseText(body: string): string {
  let text = "";
  let completedText = "";
  for (const frame of body.split(/\r?\n\r?\n/u)) {
    let event = "";
    const data: string[] = [];
    for (const line of frame.split(/\r?\n/u)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    const serialized = data.join("\n");
    if (serialized.length === 0 || serialized === "[DONE]") continue;
    try {
      const parsed = record(JSON.parse(serialized), "ChatGPT response event");
      if (
        event === "response.output_text.delta" &&
        typeof parsed.delta === "string"
      ) {
        text += parsed.delta;
      }
      const response = parsed.response;
      if (
        event === "response.completed" &&
        typeof response === "object" &&
        response !== null &&
        !Array.isArray(response) &&
        typeof (response as Record<string, unknown>).output_text === "string"
      ) {
        completedText = (response as Record<string, unknown>).output_text as string;
      }
    } catch {
      // Ignore malformed frames while retaining verified text events.
    }
  }
  return completedText || text;
}

const CHARACTER_EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["characters"],
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "aliases",
          "role",
          "summary",
          "appearance",
          "personality",
          "speech",
          "goal",
          "conflict",
          "note",
          "evidences",
        ],
        properties: {
          name: { type: "string", minLength: 1 },
          aliases: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          role: { type: "string" },
          summary: { type: "string" },
          appearance: { type: "string" },
          personality: { type: "string" },
          speech: { type: "string" },
          goal: { type: "string" },
          conflict: { type: "string" },
          note: { type: "string" },
          evidences: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["paragraphId", "quote"],
              properties: {
                paragraphId: { type: "string", minLength: 1 },
                quote: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  },
});

const CHARACTER_EXTRACTION_INSTRUCTIONS = [
  "Extract character candidates only from the supplied manuscript paragraphs.",
  "Return only characters explicitly named in the supplied text.",
  "Do not invent a character, relationship, fact, role, or profile detail.",
  "Use an empty string or empty array when a field is not explicit in the text.",
  "Do not merge similar names or aliases. Each returned item is only a review candidate.",
  "Every candidate must cite one or more exact quotes copied verbatim from one supplied paragraph.",
  "Each evidence quote must occur exactly once inside its referenced paragraph.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

const CHARACTER_GENERATION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["characters"],
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "aliases",
          "role",
          "summary",
          "appearance",
          "personality",
          "speech",
          "goal",
          "conflict",
          "note",
        ],
        properties: {
          name: { type: "string", minLength: 1 },
          aliases: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          role: { type: "string" },
          summary: { type: "string" },
          appearance: { type: "string" },
          personality: { type: "string" },
          speech: { type: "string" },
          goal: { type: "string" },
          conflict: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
});

const CHARACTER_GENERATION_INSTRUCTIONS = [
  "Create character-setting draft candidates only from the supplied user brief.",
  "Treat every returned character as a review candidate, never as an approved canonical record.",
  "Do not claim manuscript evidence, existing relationships, or facts outside the supplied brief.",
  "Keep relationship ideas in the note field as draft text; never return database IDs.",
  "Use an empty string or empty array when the brief does not support a field.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

const SCENE_EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["scenes"],
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "fromParagraphId",
          "toParagraphId",
          "summary",
          "povCharacter",
          "location",
          "time",
          "characters",
          "goal",
          "conflict",
          "outcome",
        ],
        properties: {
          title: { type: "string", minLength: 1 },
          fromParagraphId: { type: "string", minLength: 1 },
          toParagraphId: { type: "string", minLength: 1 },
          summary: { type: "string" },
          povCharacter: { type: "string" },
          location: { type: "string" },
          time: { type: "string" },
          characters: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          goal: { type: "string" },
          conflict: { type: "string" },
          outcome: { type: "string" },
        },
      },
    },
  },
});

const SCENE_EXTRACTION_INSTRUCTIONS = [
  "Divide only the supplied manuscript paragraphs into ordered scene candidates.",
  "Use the supplied paragraph IDs for every scene start and end.",
  "Scenes must be ordered, non-overlapping, and may split only between paragraphs.",
  "Do not invent plot facts, characters, places, times, goals, conflicts, or outcomes.",
  "Use an empty string or empty array when information is not explicit in the text.",
  "Character names must be copied from the supplied text; never return database IDs.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

const SCENE_DRAFT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["draftText"],
  properties: {
    draftText: { type: "string", minLength: 1 },
  },
});

const SCENE_DRAFT_INSTRUCTIONS = [
  "Write one editable Korean prose scene draft from only the supplied plot context.",
  "Use only the supplied linked events and explicitly selected characters and settings.",
  "Do not invent a named character, established setting fact, prior event, or relationship.",
  "Do not mention database identities, revisions, schemas, or the drafting process.",
  "Return a review candidate, never instructions that claim the manuscript was changed.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

const ASSISTANT_VOCABULARY_SUGGESTION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "note"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "nuance", "example"],
        properties: {
          word: { type: "string", minLength: 1 },
          nuance: { type: "string" },
          example: { type: "string" },
        },
      },
    },
    note: { type: "string" },
  },
});

const ASSISTANT_VOCABULARY_SUGGESTION_INSTRUCTIONS = [
  "Answer the user's vocabulary question using only the supplied question and optional exact manuscript context.",
  "Return word suggestions as review candidates; never claim that the manuscript was changed.",
  "Explain nuance briefly and keep each example short.",
  "Do not invent manuscript facts outside the supplied context.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

const ASSISTANT_SETTING_REFERENCE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["kind", "entityId", "revision"],
  properties: {
    kind: { type: "string", enum: ["character", "plot", "foreshadow"] },
    entityId: { type: "string", minLength: 1 },
    revision: { type: "integer", minimum: 1 },
  },
});

const ASSISTANT_CONTEXT_RANGE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["documentId", "documentRevisionId", "from", "to"],
  properties: {
    documentId: { type: "string", minLength: 1 },
    documentRevisionId: { type: "string", minLength: 1 },
    from: { type: "integer", minimum: 0 },
    to: { type: "integer", minimum: 0 },
  },
});

const ASSISTANT_EXTERNAL_SETTING_REVIEW_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["reply", "proposals", "reviewNotes"],
  properties: {
    reply: { type: "string" },
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "action",
          "settingKind",
          "target",
          "label",
          "field",
          "value",
          "evidenceRange",
          "certainty",
        ],
        properties: {
          action: { type: "string", enum: ["create", "update"] },
          settingKind: {
            type: "string",
            enum: ["character", "plot", "foreshadow"],
          },
          target: {
            anyOf: [ASSISTANT_SETTING_REFERENCE_SCHEMA, { type: "null" }],
          },
          label: { type: "string", minLength: 1 },
          field: { type: "string", minLength: 1 },
          value: { type: "string", minLength: 1 },
          evidenceRange: {
            anyOf: [ASSISTANT_CONTEXT_RANGE_SCHEMA, { type: "null" }],
          },
          certainty: { type: "string", enum: ["explicit", "inferred"] },
        },
      },
    },
    reviewNotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "message", "references"],
        properties: {
          kind: { type: "string", enum: ["duplicate", "conflict", "category"] },
          message: { type: "string", minLength: 1 },
          references: {
            type: "array",
            items: ASSISTANT_SETTING_REFERENCE_SCHEMA,
          },
        },
      },
    },
  },
});

const ASSISTANT_EXTERNAL_SETTING_REVIEW_INSTRUCTIONS = [
  "Review only the supplied manuscript excerpt and the supplied canonical setting records.",
  "Return proposals and review notes as candidates; never claim that a canonical setting or manuscript was changed.",
  "For an update proposal, copy one supplied setting reference exactly into target.",
  "For a create proposal, use target null.",
  "Use evidenceRange null unless an exact range from the supplied manuscript range can be stated safely.",
  "Do not introduce an entity, fact, or reference that is absent from the supplied input.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

export function createNodeChatGptCodexClient(input: {
  readonly profile: ChatGptOAuthProfile;
  readonly store: ChatGptOAuthConnectionStore;
  readonly fetch?: FetchImplementation;
  readonly now?: () => number;
}): {
  listModels(): Promise<readonly string[]>;
  chat(messages: readonly AssistantChatMessage[]): Promise<AssistantChatResult>;
  suggestVocabulary(input: Readonly<{
    query: string;
    context: string | null;
  }>): Promise<AssistantVocabularySuggestionPayload>;
  reviewSettings(input: Readonly<{
    query: string;
    manuscript: Readonly<{
      documentId: string;
      documentRevisionId: string;
      from: number;
      to: number;
      text: string;
    }>;
    settings: readonly AssistantSettingReviewSource[];
  }>): Promise<AssistantExternalSettingReviewPayload>;
  extractCharacters(
    paragraphs: readonly CharacterExtractionParagraph[],
  ): Promise<ChatGptCharacterExtractionExecution>;
  generateCharacters(
    brief: CharacterGenerationBrief,
  ): Promise<ChatGptCharacterGenerationExecution>;
  extractScenes(
    paragraphs: readonly SceneExtractionParagraph[],
  ): Promise<ChatGptSceneExtractionExecution>;
  draftScene(
    context: SceneDraftContext,
  ): Promise<ChatGptSceneDraftExecution>;
} {
  const fetchImplementation =
    input.fetch ?? (globalThis.fetch as FetchImplementation);
  const now = input.now ?? Date.now;

  async function refreshTokens(
    tokens: ChatGptOAuthTokens,
  ): Promise<ChatGptOAuthTokens> {
    const response = await fetchImplementation(
      new URL(input.profile.tokenPath, input.profile.issuer).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: tokens.refreshToken,
          client_id: input.profile.clientId,
        }),
      },
    );
    const payload = record(
      await response.json().catch(() => ({})),
      "ChatGPT OAuth refresh response",
    );
    if (!response.ok) {
      throw new Error(`ChatGPT OAuth token refresh failed (${response.status})`);
    }
    const accessToken = typeof payload.access_token === "string"
      ? payload.access_token
      : tokens.accessToken;
    const refreshToken = typeof payload.refresh_token === "string"
      ? payload.refresh_token
      : tokens.refreshToken;
    const idToken = typeof payload.id_token === "string"
      ? payload.id_token
      : tokens.idToken;
    const refreshed = Object.freeze({
      accessToken,
      refreshToken,
      idToken,
      accountId: accountIdFromIdToken(idToken) ?? tokens.accountId,
      email: tokens.email,
      planType: tokens.planType,
    });
    await input.store.saveTokens(refreshed);
    return refreshed;
  }

  async function currentTokens(): Promise<ChatGptOAuthTokens> {
    const tokens = input.store.readTokens();
    if (tokens === null) {
      throw new Error("ChatGPT OAuth login is required");
    }
    return tokenIsFresh(tokens.accessToken, now())
      ? tokens
      : refreshTokens(tokens);
  }

  async function upstreamFetch(
    path: string,
    init?: Readonly<{
      method?: "GET" | "POST";
      headers?: Readonly<Record<string, string>>;
      body?: string;
    }>,
  ): Promise<FetchResponse> {
    const tokens = await currentTokens();
    const accountId = tokens.accountId ?? accountIdFromIdToken(tokens.idToken);
    if (accountId === null) {
      throw new Error("ChatGPT OAuth account identity is unavailable");
    }
    return fetchImplementation(`${input.profile.upstream.baseUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${tokens.accessToken}`,
        "chatgpt-account-id": accountId,
        "OpenAI-Beta": "responses=experimental",
        originator: input.profile.upstream.originator,
      },
    });
  }

  async function requestStructuredAssistantPayload(request: Readonly<{
    formatName: string;
    schema: Readonly<Record<string, unknown>>;
    instructions: string;
    payload: Readonly<Record<string, unknown>>;
    errorLabel: string;
  }>): Promise<unknown> {
    const response = await upstreamFetch("/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: input.profile.upstream.model,
        instructions: request.instructions,
        input: [{
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: JSON.stringify(request.payload),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: request.formatName,
            strict: true,
            schema: request.schema,
          },
        },
        stream: true,
        store: false,
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`${request.errorLabel} failed (${response.status})`);
    }
    const responseText = collectResponseText(body).trim();
    if (responseText.length === 0) {
      throw new Error(`${request.errorLabel} returned no text`);
    }
    return JSON.parse(responseText);
  }

  return Object.freeze({
    async listModels(): Promise<readonly string[]> {
      const response = await upstreamFetch(
        `/models?client_version=${encodeURIComponent(
          input.profile.upstream.clientVersion,
        )}`,
      );
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ChatGPT model request failed (${response.status})`);
      }
      const payload = record(JSON.parse(body), "ChatGPT model response");
      if (!Array.isArray(payload.models)) {
        throw new Error("ChatGPT model response has no model list");
      }
      const models = payload.models.map((entry, index) => {
        const model = record(entry, `ChatGPT model response[${index}]`);
        if (typeof model.slug !== "string" || model.slug.length === 0) {
          throw new Error(`ChatGPT model response[${index}].slug is missing`);
        }
        return model.slug;
      });
      return Object.freeze([...new Set(models)]);
    },

    async chat(
      messages: readonly AssistantChatMessage[],
    ): Promise<AssistantChatResult> {
      const response = await upstreamFetch("/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: input.profile.upstream.model,
          input: messages.map((message) => ({
            type: "message",
            role: message.role,
            content: [{
              type: message.role === "assistant" ? "output_text" : "input_text",
              text: message.text,
            }],
          })),
          stream: true,
          store: false,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ChatGPT conversation failed (${response.status})`);
      }
      const responseText = collectResponseText(body).trim();
      if (responseText.length === 0) {
        throw new Error("ChatGPT conversation returned no text");
      }
      return Object.freeze({
        schemaVersion: 1,
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        message: Object.freeze({ role: "assistant", text: responseText }),
      });
    },

    async suggestVocabulary(input): Promise<AssistantVocabularySuggestionPayload> {
      return parseAssistantVocabularySuggestionPayload(
        await requestStructuredAssistantPayload({
          formatName: "eum_assistant_vocabulary_suggestions",
          schema: ASSISTANT_VOCABULARY_SUGGESTION_SCHEMA,
          instructions: ASSISTANT_VOCABULARY_SUGGESTION_INSTRUCTIONS,
          payload: Object.freeze({
            query: input.query,
            context: input.context,
          }),
          errorLabel: "ChatGPT vocabulary suggestion",
        }),
      );
    },

    async reviewSettings(input): Promise<AssistantExternalSettingReviewPayload> {
      return parseAssistantExternalSettingReviewPayload(
        await requestStructuredAssistantPayload({
          formatName: "eum_assistant_setting_review",
          schema: ASSISTANT_EXTERNAL_SETTING_REVIEW_SCHEMA,
          instructions: ASSISTANT_EXTERNAL_SETTING_REVIEW_INSTRUCTIONS,
          payload: Object.freeze({
            query: input.query,
            manuscript: input.manuscript,
            settings: input.settings,
          }),
          errorLabel: "ChatGPT setting review",
        }),
      );
    },

    async extractCharacters(
      paragraphs: readonly CharacterExtractionParagraph[],
    ): Promise<ChatGptCharacterExtractionExecution> {
      const response = await upstreamFetch("/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: input.profile.upstream.model,
          instructions: CHARACTER_EXTRACTION_INSTRUCTIONS,
          input: [{
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({
                paragraphs: paragraphs.map((paragraph) => ({
                  id: paragraph.paragraphId,
                  text: paragraph.text,
                })),
              }),
            }],
          }],
          text: {
            format: {
              type: "json_schema",
              name: "eum_character_extraction",
              strict: true,
              schema: CHARACTER_EXTRACTION_SCHEMA,
            },
          },
          stream: true,
          store: false,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ChatGPT character extraction failed (${response.status})`);
      }
      const responseText = collectResponseText(body).trim();
      if (responseText.length === 0) {
        throw new Error("ChatGPT character extraction returned no text");
      }
      return Object.freeze({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: CHARACTER_EXTRACTION_PROMPT_VERSION,
        payload: parseCharacterExtractionModelPayload(JSON.parse(responseText)),
      });
    },

    async generateCharacters(
      brief: CharacterGenerationBrief,
    ): Promise<ChatGptCharacterGenerationExecution> {
      const response = await upstreamFetch("/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: input.profile.upstream.model,
          instructions: CHARACTER_GENERATION_INSTRUCTIONS,
          input: [{
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({ brief }),
            }],
          }],
          text: {
            format: {
              type: "json_schema",
              name: "eum_character_generation",
              strict: true,
              schema: CHARACTER_GENERATION_SCHEMA,
            },
          },
          stream: true,
          store: false,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ChatGPT character generation failed (${response.status})`);
      }
      const responseText = collectResponseText(body).trim();
      if (responseText.length === 0) {
        throw new Error("ChatGPT character generation returned no text");
      }
      return Object.freeze({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: CHARACTER_GENERATION_PROMPT_VERSION,
        payload: parseCharacterGenerationModelPayload(JSON.parse(responseText)),
      });
    },

    async extractScenes(
      paragraphs: readonly SceneExtractionParagraph[],
    ): Promise<ChatGptSceneExtractionExecution> {
      const response = await upstreamFetch("/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: input.profile.upstream.model,
          instructions: SCENE_EXTRACTION_INSTRUCTIONS,
          input: [{
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({
                paragraphs: paragraphs.map((paragraph) => ({
                  id: paragraph.paragraphId,
                  text: paragraph.text,
                })),
              }),
            }],
          }],
          text: {
            format: {
              type: "json_schema",
              name: "eum_scene_extraction",
              strict: true,
              schema: SCENE_EXTRACTION_SCHEMA,
            },
          },
          stream: true,
          store: false,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ChatGPT scene extraction failed (${response.status})`);
      }
      const responseText = collectResponseText(body).trim();
      if (responseText.length === 0) {
        throw new Error("ChatGPT scene extraction returned no text");
      }
      return Object.freeze({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: SCENE_EXTRACTION_PROMPT_VERSION,
        payload: parseSceneExtractionModelPayload(JSON.parse(responseText)),
      });
    },

    async draftScene(
      context: SceneDraftContext,
    ): Promise<ChatGptSceneDraftExecution> {
      const response = await upstreamFetch("/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: input.profile.upstream.model,
          instructions: SCENE_DRAFT_INSTRUCTIONS,
          input: [{
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({
                plot: {
                  title: context.plot.title,
                  stage: context.plot.stage,
                  summary: context.plot.summary,
                  note: context.plot.note,
                },
                events: context.events.map((event) => ({
                  role: event.role,
                  title: event.title,
                  note: event.note,
                })),
                characters: context.characters.map((character) => ({
                  name: character.name,
                  aliases: character.aliases,
                  role: character.role,
                  summary: character.summary,
                  appearance: character.appearance,
                  personality: character.personality,
                  speech: character.speech,
                  goal: character.goal,
                  conflict: character.conflict,
                  note: character.note,
                })),
                settings: context.settings.map((setting) => ({
                  title: setting.title,
                  content: setting.content,
                  category: setting.category,
                  aliases: setting.aliases,
                })),
              }),
            }],
          }],
          text: {
            format: {
              type: "json_schema",
              name: "eum_scene_draft",
              strict: true,
              schema: SCENE_DRAFT_SCHEMA,
            },
          },
          stream: true,
          store: false,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ChatGPT scene drafting failed (${response.status})`);
      }
      const responseText = collectResponseText(body).trim();
      if (responseText.length === 0) {
        throw new Error("ChatGPT scene drafting returned no text");
      }
      return Object.freeze({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: SCENE_DRAFT_PROMPT_VERSION,
        payload: parseSceneDraftModelPayload(JSON.parse(responseText)),
      });
    },
  });
}
