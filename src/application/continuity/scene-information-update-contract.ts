import type {
  CanonReviewConnectorInput,
  CanonReviewModelPayload,
} from "../canon/canon-review-model-output";
import { parseCanonReviewModelPayload } from "../canon/canon-review-model-output";
import {
  parseCanonEntityRef,
  type CanonEntityRef,
} from "../canon/canon-entity-ref";
import type {
  ContinuityReviewConnectorInput,
  ContinuityReviewModelPayload,
} from "./continuity-review-model-output";
import { parseContinuityReviewModelPayload } from "./continuity-review-model-output";
import type { NarrativeDigestConnectorInput } from "./narrative-digest-contract";

export const SCENE_INFORMATION_UPDATE_PROMPT_VERSION =
  "eum-scene-information-update-v1" as const;

export const SCENE_INFORMATION_REVIEW_OUTCOMES = [
  "changed",
  "unchanged",
  "insufficient-evidence",
] as const;

export type SceneInformationReviewOutcome =
  (typeof SCENE_INFORMATION_REVIEW_OUTCOMES)[number];

export type SceneInformationReviewedEntity = Readonly<{
  entity: CanonEntityRef;
  outcome: SceneInformationReviewOutcome;
  reason: string;
}>;

export type SceneInformationUpdateConnectorInput = Readonly<{
  digest: NarrativeDigestConnectorInput;
  canon: CanonReviewConnectorInput;
  continuity: ContinuityReviewConnectorInput;
}>;

export type SceneInformationUpdateExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof SCENE_INFORMATION_UPDATE_PROMPT_VERSION;
  digest: Readonly<{ text: string }>;
  canon: CanonReviewModelPayload;
  continuity: ContinuityReviewModelPayload;
  reviewedEntities: readonly SceneInformationReviewedEntity[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function parseReviewedEntity(
  value: unknown,
  label: string,
): SceneInformationReviewedEntity {
  const input = record(value, label);
  exact(input, ["entity", "outcome", "reason"], label);
  if (!(SCENE_INFORMATION_REVIEW_OUTCOMES as readonly unknown[]).includes(input.outcome)) {
    throw new Error(`${label}.outcome is unsupported`);
  }
  return Object.freeze({
    entity: parseCanonEntityRef(input.entity, `${label}.entity`),
    outcome: input.outcome as SceneInformationReviewOutcome,
    reason: text(input.reason, `${label}.reason`),
  });
}

export function parseSceneInformationReviewedEntities(
  value: unknown,
  label = "SceneInformationReviewedEntities",
): readonly SceneInformationReviewedEntity[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const reviewedEntities = Object.freeze(value.map((entry, index) =>
    parseReviewedEntity(entry, `${label}[${index}]`)
  ));
  const reviewKeys = reviewedEntities.map((entry) =>
    `${entry.entity.kind}:${entry.entity.id}`
  );
  if (new Set(reviewKeys).size !== reviewKeys.length) {
    throw new Error(`${label} contains duplicate entities`);
  }
  return reviewedEntities;
}

export function assertSceneInformationReviewedEntityScope(
  reviewedEntities: readonly SceneInformationReviewedEntity[],
  suppliedEntityKeys: readonly string[],
): void {
  const supplied = new Set(suppliedEntityKeys);
  const outsideScope = reviewedEntities.find((entry) =>
    !supplied.has(`${entry.entity.kind}:${entry.entity.id}`)
  );
  if (outsideScope !== undefined) {
    throw new Error(
      `Scene information update reviewed an entity outside its supplied scope: ${outsideScope.entity.kind}:${outsideScope.entity.id}`,
    );
  }
}

export function parseSceneInformationUpdateExecution(
  value: unknown,
): SceneInformationUpdateExecution {
  const label = "SceneInformationUpdateExecution";
  const input = record(value, label);
  exact(input, [
    "providerId",
    "modelId",
    "promptVersion",
    "digest",
    "canon",
    "continuity",
    "reviewedEntities",
  ], label);
  if (input.promptVersion !== SCENE_INFORMATION_UPDATE_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  const digest = record(input.digest, `${label}.digest`);
  exact(digest, ["text"], `${label}.digest`);
  const reviewedEntities = parseSceneInformationReviewedEntities(
    input.reviewedEntities,
    `${label}.reviewedEntities`,
  );
  return Object.freeze({
    providerId: text(input.providerId, `${label}.providerId`),
    modelId: text(input.modelId, `${label}.modelId`),
    promptVersion: SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
    digest: Object.freeze({ text: text(digest.text, `${label}.digest.text`) }),
    canon: parseCanonReviewModelPayload(input.canon),
    continuity: parseContinuityReviewModelPayload(input.continuity),
    reviewedEntities,
  });
}
