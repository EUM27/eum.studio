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
import {
  parseCanonReviewModelPayload,
  type CanonReviewConnectorInput,
  type CanonReviewExecution,
} from "../../application/canon/canon-review-model-output";
import { CANON_REVIEW_PROMPT_VERSION } from "../../application/canon/canon-review-contract";
import { CANON_ENTITY_KINDS } from "../../application/canon/canon-entity-ref";
import {
  parseContinuityReviewModelPayload,
  type ContinuityReviewConnectorInput,
  type ContinuityReviewExecution,
} from "../../application/continuity/continuity-review-model-output";
import { CONTINUITY_REVIEW_PROMPT_VERSION } from "../../application/continuity/continuity-review-contract";
import {
  NARRATIVE_DIGEST_PROMPT_VERSION,
  parseNarrativeDigestConnectorExecution,
  type NarrativeDigestConnectorExecution,
  type NarrativeDigestConnectorInput,
} from "../../application/continuity/narrative-digest-contract";
import {
  SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
  parseSceneInformationUpdateExecution,
  type SceneInformationUpdateConnectorInput,
  type SceneInformationUpdateExecution,
} from "../../application/continuity/scene-information-update-contract";
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

const CANON_REVIEW_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "targetKind",
          "targetHint",
          "operationHint",
          "assertionBasis",
          "reason",
          "fields",
          "evidence",
        ],
        properties: {
          targetKind: {
            type: "string",
            enum: [
              "character",
              "character-relation",
              "lore-entry",
              "character-knowledge",
            ],
          },
          targetHint: { type: "string", minLength: 1 },
          operationHint: {
            type: "string",
            enum: ["create", "update", "unresolved"],
          },
          assertionBasis: {
            type: "string",
            enum: ["explicit-evidence", "model-inference"],
          },
          reason: { type: "string", minLength: 1 },
          fields: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "value"],
              properties: {
                field: {
                  type: "string",
                  enum: [
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
                    "fromCharacterId",
                    "toCharacterId",
                    "kind",
                    "description",
                    "title",
                    "content",
                    "category",
                    "enabled",
                    "characterId",
                    "statement",
                    "stance",
                    "truthStatus",
                    "aboutRefKeys",
                  ],
                },
                value: {
                  anyOf: [
                    { type: "string" },
                    { type: "boolean" },
                    { type: "array", items: { type: "string", minLength: 1 } },
                  ],
                },
              },
            },
          },
          evidence: {
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

const CANON_REVIEW_INSTRUCTIONS = [
  "Review only the supplied manuscript paragraphs for persistent canonical changes.",
  "Every result is a review candidate; never claim that a canonical record or manuscript was changed.",
  "Return only the requested target kinds and never propose deletion or retirement.",
  "Mark a proposal explicit-evidence only when its lasting field value is directly stated by an exact quote.",
  "Mark suppositions, lies, dreams, plans, and uncertain interpretation as model-inference.",
  "For update proposals, return only fields whose changed values are supported by the supplied paragraphs.",
  "For create proposals, return every field required by that target kind without inventing a value.",
  "Use targetHint for local matching; choose unresolved when the target is ambiguous.",
  "For relation endpoints, use only character IDs present in characterReferences.",
  "For CharacterKnowledge, use only supplied character IDs and canonical kind:id reference keys. A changed stance or truth status is a superseding state candidate, never an in-place fact rewrite.",
  "Do not invent an entity ID, relation, fact, or field outside the supplied input.",
  "Every proposal must cite one or more verbatim quotes that occur exactly once in the referenced paragraph.",
  "Return fields as an array of unique field/value objects and JSON matching the provided schema.",
].join("\n");

function parseCanonReviewWirePayload(value: unknown) {
  const input = record(value, "Canon review response");
  if (
    Object.keys(input).length !== 1 ||
    !Array.isArray(input.proposals)
  ) {
    throw new Error("Canon review response fields do not match the schema");
  }
  return parseCanonReviewModelPayload({
    proposals: input.proposals.map((entry, proposalIndex) => {
      const proposal = record(entry, `Canon review proposal[${proposalIndex}]`);
      const fields = proposal.fields;
      if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error(`Canon review proposal[${proposalIndex}].fields must be non-empty`);
      }
      const fieldEntries = fields.map((fieldEntry, fieldIndex) => {
        const field = record(
          fieldEntry,
          `Canon review proposal[${proposalIndex}].fields[${fieldIndex}]`,
        );
        if (
          Object.keys(field).length !== 2 ||
          typeof field.field !== "string" ||
          !("value" in field)
        ) {
          throw new Error(
            `Canon review proposal[${proposalIndex}].fields[${fieldIndex}] is invalid`,
          );
        }
        return [field.field, field.value] as const;
      });
      if (new Set(fieldEntries.map(([field]) => field)).size !== fieldEntries.length) {
        throw new Error(`Canon review proposal[${proposalIndex}] has duplicate fields`);
      }
      return {
        ...proposal,
        fields: Object.fromEntries(fieldEntries),
      };
    }),
  });
}

const CONTINUITY_REVIEW_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "assertionBasis",
          "kind",
          "title",
          "note",
          "subjectRefs",
          "reason",
          "evidence",
        ],
        properties: {
          assertionBasis: {
            type: "string",
            enum: ["explicit-evidence", "model-inference"],
          },
          kind: {
            type: "string",
            enum: [
              "promise",
              "open-question",
              "temporary-state",
              "inventory",
              "location",
              "injury",
              "relationship-state",
              "constraint",
              "other",
            ],
          },
          title: { type: "string", minLength: 1 },
          note: { type: "string" },
          subjectRefs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "id"],
              properties: {
                kind: {
                  type: "string",
                  enum: [
                    "character",
                    "character-relation",
                    "lore-entry",
                    "event-block",
                    "plot-thread",
                    "foreshadow-line",
                    "scene",
                  ],
                },
                id: { type: "string", minLength: 1 },
              },
            },
          },
          reason: { type: "string", minLength: 1 },
          evidence: {
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

const CONTINUITY_REVIEW_INSTRUCTIONS = [
  "Review only the supplied manuscript paragraphs for unresolved continuity that should persist into later writing.",
  "Every result is an unapproved review candidate; never claim that a Continuity thread, canonical record, or manuscript was changed.",
  "Do not duplicate a planned Plot thread, Foreshadow line, or long-term Character goal as a Continuity proposal.",
  "Use only subject entity kind and ID pairs present in subjectReferences; an empty subjectRefs array is valid.",
  "Mark direct promises, questions, temporary states, inventory, locations, injuries, relationship states, and constraints as explicit-evidence only when directly stated.",
  "Mark uncertain interpretations as model-inference and do not turn them into facts.",
  "Never merge a proposal with an existing item, invent an entity ID, or propose deletion or retirement.",
  "Every proposal must cite one or more verbatim quotes that occur exactly once in the referenced paragraph.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

const NARRATIVE_DIGEST_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string", minLength: 1 },
  },
});

const NARRATIVE_DIGEST_INSTRUCTIONS = [
  "Summarize only the supplied selected manuscript documents and canonical sources.",
  "Respect the supplied work, document, scene, character, or relationship scope exactly.",
  "For a scene scope, summarize only the exact supplied scene excerpt and use canonical sources only to connect established concepts and facts.",
  "Treat canonical sources as context, and do not invent facts, entity IDs, events, motives, or outcomes absent from the input.",
  "Do not claim to modify the manuscript or canonical records; this output is a derived snapshot.",
  "Return concise Korean prose in the text field unless the supplied manuscript is clearly written in another language.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

function parseNarrativeDigestWirePayload(value: unknown): Readonly<{ text: string }> {
  const payload = record(value,"ChatGPT NarrativeDigest response");
  if (Object.keys(payload).length !== 1 || typeof payload.text !== "string" || payload.text.trim().length === 0) {
    throw new Error("ChatGPT NarrativeDigest response fields do not match the schema");
  }
  return Object.freeze({ text: payload.text.trim() });
}

const SCENE_INFORMATION_UPDATE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["digest", "canon", "continuity", "reviewedEntities"],
  properties: {
    digest: NARRATIVE_DIGEST_SCHEMA,
    canon: CANON_REVIEW_SCHEMA,
    continuity: CONTINUITY_REVIEW_SCHEMA,
    reviewedEntities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entity", "outcome", "reason"],
        properties: {
          entity: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "id"],
            properties: {
              kind: { type: "string", enum: [...CANON_ENTITY_KINDS] },
              id: { type: "string", minLength: 1 },
            },
          },
          outcome: {
            type: "string",
            enum: ["changed", "unchanged", "insufficient-evidence"],
          },
          reason: { type: "string", minLength: 1 },
        },
      },
    },
  },
});

const SCENE_INFORMATION_UPDATE_INSTRUCTIONS = [
  "Analyze one already-durable manuscript scene once and return one integrated information-update result.",
  "The digest is a derived summary. Canon and continuity entries are unapproved candidates. Never claim to have changed the manuscript or any canonical record.",
  "Use only the supplied scene paragraphs, canonical sources, character references, and subject references. Never invent an entity ID.",
  "Canon proposals may cover Character, CharacterRelation, LoreEntry, and CharacterKnowledge. Return only lasting changes supported by exact evidence; do not propose deletion or retirement.",
  "A CharacterKnowledge proposal must distinguish the character stance from objective truth. A changed stance or truth status proposes a superseding state.",
  "Continuity proposals contain only unresolved state that must persist into later writing and must not duplicate an existing PlotThread, ForeshadowLine, or long-term Character goal.",
  "Every proposal cites a verbatim quote that appears exactly once in its paragraph. Mark uncertain interpretation as model-inference.",
  "For every supplied canonical source that was actually evaluated, emit one reviewedEntities row with changed, unchanged, or insufficient-evidence. Do not emit applied or success states.",
  "Return JSON matching the provided schema, with no markdown or explanation.",
].join("\n");

function parseSceneInformationUpdateWirePayload(value: unknown) {
  const payload = record(value, "Scene information update response");
  const expected = new Set(["digest", "canon", "continuity", "reviewedEntities"]);
  if (
    Object.keys(payload).length !== expected.size ||
    Object.keys(payload).some((field) => !expected.has(field)) ||
    !Array.isArray(payload.reviewedEntities)
  ) {
    throw new Error("Scene information update response fields do not match the schema");
  }
  return Object.freeze({
    digest: parseNarrativeDigestWirePayload(payload.digest),
    canon: parseCanonReviewWirePayload(payload.canon),
    continuity: parseContinuityReviewModelPayload(payload.continuity),
    reviewedEntities: payload.reviewedEntities,
  });
}

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
  reviewCanon(input: CanonReviewConnectorInput): Promise<CanonReviewExecution>;
  reviewContinuity(
    input: ContinuityReviewConnectorInput,
  ): Promise<ContinuityReviewExecution>;
  generateNarrativeDigest(
    input: NarrativeDigestConnectorInput,
  ): Promise<NarrativeDigestConnectorExecution>;
  updateSceneInformation(
    input: SceneInformationUpdateConnectorInput,
  ): Promise<SceneInformationUpdateExecution>;
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

    async reviewCanon(
      reviewInput: CanonReviewConnectorInput,
    ): Promise<CanonReviewExecution> {
      const payload = parseCanonReviewWirePayload(
        await requestStructuredAssistantPayload({
          formatName: "eum_canon_review",
          schema: CANON_REVIEW_SCHEMA,
          instructions: CANON_REVIEW_INSTRUCTIONS,
          payload: Object.freeze({
            requestedTargetKinds: reviewInput.requestedTargetKinds,
            paragraphs: reviewInput.paragraphs.map((paragraph) => ({
              id: paragraph.paragraphId,
              text: paragraph.text,
            })),
            characterReferences: reviewInput.characterReferences,
          }),
          errorLabel: "ChatGPT canon review",
        }),
      );
      return Object.freeze({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: CANON_REVIEW_PROMPT_VERSION,
        payload,
      });
    },

    async reviewContinuity(
      reviewInput: ContinuityReviewConnectorInput,
    ): Promise<ContinuityReviewExecution> {
      const payload = parseContinuityReviewModelPayload(
        await requestStructuredAssistantPayload({
          formatName: "eum_continuity_review",
          schema: CONTINUITY_REVIEW_SCHEMA,
          instructions: CONTINUITY_REVIEW_INSTRUCTIONS,
          payload: Object.freeze({
            paragraphs: reviewInput.paragraphs.map((paragraph) => ({
              id: paragraph.paragraphId,
              text: paragraph.text,
            })),
            subjectReferences: reviewInput.subjectReferences,
          }),
          errorLabel: "ChatGPT Continuity review",
        }),
      );
      return Object.freeze({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: CONTINUITY_REVIEW_PROMPT_VERSION,
        payload,
      });
    },

    async generateNarrativeDigest(
      digestInput: NarrativeDigestConnectorInput,
    ): Promise<NarrativeDigestConnectorExecution> {
      const payload = parseNarrativeDigestWirePayload(
        await requestStructuredAssistantPayload({
          formatName: "eum_narrative_digest",
          schema: NARRATIVE_DIGEST_SCHEMA,
          instructions: NARRATIVE_DIGEST_INSTRUCTIONS,
          payload: Object.freeze({
            scope: digestInput.scope,
            sourceManifest: digestInput.sourceManifest,
            documents: digestInput.documents,
            sceneSource: digestInput.sceneSource,
            canonicalSources: digestInput.canonicalSources,
          }),
          errorLabel: "ChatGPT NarrativeDigest",
        }),
      );
      return parseNarrativeDigestConnectorExecution({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: NARRATIVE_DIGEST_PROMPT_VERSION,
        text: payload.text,
      });
    },

    async updateSceneInformation(
      updateInput: SceneInformationUpdateConnectorInput,
    ): Promise<SceneInformationUpdateExecution> {
      const payload = parseSceneInformationUpdateWirePayload(
        await requestStructuredAssistantPayload({
          formatName: "eum_scene_information_update",
          schema: SCENE_INFORMATION_UPDATE_SCHEMA,
          instructions: SCENE_INFORMATION_UPDATE_INSTRUCTIONS,
          payload: Object.freeze({
            scope: updateInput.digest.scope,
            sourceManifest: updateInput.digest.sourceManifest,
            documents: updateInput.digest.documents,
            sceneSource: updateInput.digest.sceneSource,
            canonicalSources: updateInput.digest.canonicalSources,
            requestedTargetKinds: updateInput.canon.requestedTargetKinds,
            paragraphs: updateInput.canon.paragraphs.map((paragraph) => ({
              id: paragraph.paragraphId,
              text: paragraph.text,
            })),
            characterReferences: updateInput.canon.characterReferences,
            subjectReferences: updateInput.continuity.subjectReferences,
          }),
          errorLabel: "ChatGPT Scene information update",
        }),
      );
      return parseSceneInformationUpdateExecution({
        providerId: input.profile.providerId,
        modelId: input.profile.upstream.model,
        promptVersion: SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
        ...payload,
      });
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
