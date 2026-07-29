import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export const MANUSCRIPT_RESUME_INVALID_REASONS =
  Object.freeze([
    "invalid-frame",
    "codec-error",
    "identity-conflict",
    "revision-conflict",
    "ownership-conflict",
    "revision-source-conflict",
    "anchor-integrity-conflict",
    "selection-shape-conflict",
  ] as const);

export type ManuscriptResumeInvalidReason =
  (typeof MANUSCRIPT_RESUME_INVALID_REASONS)[number];

export type ManuscriptResumeCheckpointProjection =
  | {
      readonly schemaVersion: 1;
      readonly status: "unavailable";
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "missing";
      readonly workId: EntityId<"Work">;
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "resolved";
      readonly workId: EntityId<"Work">;
      readonly documentId:
        EntityId<"Document">;
      readonly targetRevisionId:
        EntityId<"DocumentRevision">;
      readonly selection: {
        readonly anchor: number;
        readonly head: number;
      };
    }
  | {
      readonly schemaVersion: 1;
      readonly status:
        | "needsReview"
        | "broken";
      readonly workId: EntityId<"Work">;
      readonly documentId:
        EntityId<"Document">;
      readonly targetRevisionId:
        EntityId<"DocumentRevision">;
      readonly move: null;
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "invalid";
      readonly workId: EntityId<"Work">;
      readonly reason:
        ManuscriptResumeInvalidReason;
      readonly move: null;
    };

function readRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Manuscript resume projection must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function assertFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): void {
  const expected = new Set(fields);
  if (
    Object.keys(value).length !==
      expected.size ||
    Object.keys(value).some(
      (field) => !expected.has(field),
    )
  ) {
    throw new Error(
      "Manuscript resume projection fields do not match its status",
    );
  }
}

function readId<TEntity extends string>(
  value: unknown,
  field: string,
): EntityId<TEntity> {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string`,
    );
  }
  return entityId<TEntity>(value);
}

function readOffset(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${field} must be a non-negative safe integer`,
    );
  }
  return value;
}

export function parseManuscriptResumeCheckpointProjection(
  value: unknown,
): ManuscriptResumeCheckpointProjection {
  const input = readRecord(value);
  if (input.schemaVersion !== 1) {
    throw new Error(
      "Manuscript resume projection schemaVersion must be 1",
    );
  }
  if (input.status === "unavailable") {
    assertFields(
      input,
      ["schemaVersion", "status"],
    );
    return Object.freeze({
      schemaVersion: 1,
      status: "unavailable",
    });
  }
  const workId = readId<"Work">(
    input.workId,
    "workId",
  );
  if (input.status === "missing") {
    assertFields(
      input,
      ["schemaVersion", "status", "workId"],
    );
    return Object.freeze({
      schemaVersion: 1,
      status: "missing",
      workId,
    });
  }
  if (input.status === "invalid") {
    assertFields(input, [
      "schemaVersion",
      "status",
      "workId",
      "reason",
      "move",
    ]);
    if (
      input.move !== null ||
      !MANUSCRIPT_RESUME_INVALID_REASONS.some(
        (reason) =>
          reason === input.reason,
      )
    ) {
      throw new Error(
        "Invalid manuscript resume issue",
      );
    }
    return Object.freeze({
      schemaVersion: 1,
      status: "invalid",
      workId,
      reason:
        input.reason as ManuscriptResumeInvalidReason,
      move: null,
    });
  }
  const documentId = readId<"Document">(
    input.documentId,
    "documentId",
  );
  const targetRevisionId =
    readId<"DocumentRevision">(
      input.targetRevisionId,
      "targetRevisionId",
    );
  if (
    input.status === "needsReview" ||
    input.status === "broken"
  ) {
    assertFields(input, [
      "schemaVersion",
      "status",
      "workId",
      "documentId",
      "targetRevisionId",
      "move",
    ]);
    if (input.move !== null) {
      throw new Error(
        "Unresolved manuscript resume projection cannot move",
      );
    }
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      workId,
      documentId,
      targetRevisionId,
      move: null,
    });
  }
  if (input.status === "resolved") {
    assertFields(input, [
      "schemaVersion",
      "status",
      "workId",
      "documentId",
      "targetRevisionId",
      "selection",
    ]);
    const selection = readRecord(
      input.selection,
    );
    assertFields(selection, [
      "anchor",
      "head",
    ]);
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId,
      documentId,
      targetRevisionId,
      selection: Object.freeze({
        anchor: readOffset(
          selection.anchor,
          "selection.anchor",
        ),
        head: readOffset(
          selection.head,
          "selection.head",
        ),
      }),
    });
  }
  throw new Error(
    `Unsupported manuscript resume status: ${String(
      input.status,
    )}`,
  );
}
