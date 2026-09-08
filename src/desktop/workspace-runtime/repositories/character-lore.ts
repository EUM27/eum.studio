import type { CharacterRelationProjection,CharacterRelationRetirementReason } from "../../../application/characters/character-relation-contract";
import { parseCharacterRelationProjection } from "../../../application/characters/character-relation-contract";
import type { LoreCandidateProjection,LoreCandidateProposal } from "../../../application/lore/lore-candidate-contract";
import { parseLoreCandidateProposal } from "../../../application/lore/lore-candidate-contract";
import type { LoreEntryHistoryProjection } from "../../../application/lore/lore-entry-contract";
import type { LoreForeshadowLinkProjection,LoreForeshadowUnlinkReason } from "../../../application/lore/lore-foreshadow-link-contract";
import { parseLoreForeshadowLinkProjection } from "../../../application/lore/lore-foreshadow-link-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { parseStoredStringArray,readNullableIdentity,readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";

export type StoredCharacterRow = {
  readonly characterId: EntityId<"Character">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly role: string;
  readonly summary: string;
  readonly appearance: string;
  readonly personality: string;
  readonly speech: string;
  readonly goal: string;
  readonly conflict: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredCharacterEvidenceRow = {
  readonly evidenceId: EntityId<"CharacterEvidence">;
  readonly workId: EntityId<"Work">;
  readonly characterId: EntityId<"Character">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly createdAt: string;
};

export type StoredCharacterRelationRow = {
  readonly relationId: EntityId<"CharacterRelation">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly fromCharacterId: EntityId<"Character">;
  readonly toCharacterId: EntityId<"Character">;
  readonly kind: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly retirementReason: CharacterRelationRetirementReason | null;
};

export type StoredLoreEntryRow = {
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredLoreEntryEvidenceRow = {
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly createdAt: string;
};

export type StoredLoreEntryHistoryRow = {
  readonly historyId: EntityId<"LoreEntryHistory">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly workId: EntityId<"Work">;
  readonly entryRevision: number;
  readonly changeKind: LoreEntryHistoryProjection["changeKind"];
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly evidenceAnchorIds: readonly EntityId<"Anchor">[];
  readonly changedAt: string;
};

export type StoredLoreCandidateRow = {
  readonly candidateId: EntityId<"LoreCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly source: LoreCandidateProjection["source"];
  readonly certainty: LoreCandidateProjection["certainty"];
  readonly proposal: LoreCandidateProposal;
  readonly reason: string;
  readonly status: LoreCandidateProjection["status"];
  readonly approvedLoreEntryId: EntityId<"LoreEntry"> | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
};

export type StoredLoreForeshadowLinkRow = {
  readonly linkId: EntityId<"LoreForeshadowLink">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
  readonly unlinkReason: LoreForeshadowUnlinkReason | null;
};

export const ACTIVE_CHARACTER_ROWS_SQL = `
SELECT
  id AS "characterId",
  revision AS "revision",
  work_id AS "workId",
  name AS "name",
  aliases_json AS "aliasesJson",
  role AS "role",
  summary AS "summary",
  appearance AS "appearance",
  personality AS "personality",
  speech AS "speech",
  goal AS "goal",
  conflict AS "conflict",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM characters
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

export const CHARACTER_ROW_BY_ID_SQL = `
SELECT
  id AS "characterId",
  revision AS "revision",
  work_id AS "workId",
  name AS "name",
  aliases_json AS "aliasesJson",
  role AS "role",
  summary AS "summary",
  appearance AS "appearance",
  personality AS "personality",
  speech AS "speech",
  goal AS "goal",
  conflict AS "conflict",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM characters
WHERE work_id = ? AND id = ?
`;

export const CHARACTER_EVIDENCE_ROWS_SQL = `
SELECT
  e.id AS "evidenceId",
  e.work_id AS "workId",
  e.character_id AS "characterId",
  e.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  e.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  e.created_at AS "createdAt"
FROM character_evidence AS e
JOIN anchors AS a
  ON a.work_id = e.work_id
  AND a.document_id = e.source_document_id
  AND a.id = e.source_anchor_id
WHERE e.work_id = ? AND e.character_id = ?
ORDER BY e.created_at ASC, e.id ASC
`;

export const CHARACTER_RELATION_ROWS_SQL = `
SELECT
  id AS "relationId",
  revision AS "revision",
  work_id AS "workId",
  from_character_id AS "fromCharacterId",
  to_character_id AS "toCharacterId",
  kind AS "kind",
  description AS "description",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  retirement_reason AS "retirementReason"
FROM character_relations
WHERE work_id = ?
ORDER BY updated_at DESC, id ASC
`;

export const CHARACTER_RELATION_ROW_BY_ID_SQL = `
SELECT
  id AS "relationId",
  revision AS "revision",
  work_id AS "workId",
  from_character_id AS "fromCharacterId",
  to_character_id AS "toCharacterId",
  kind AS "kind",
  description AS "description",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  retirement_reason AS "retirementReason"
FROM character_relations
WHERE work_id = ? AND id = ?
`;

export const ACTIVE_LORE_ENTRY_ROWS_SQL = `
SELECT
  id AS "loreEntryId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  content AS "content",
  category AS "category",
  aliases_json AS "aliasesJson",
  enabled AS "enabled",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM lore_entries
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

export const LORE_ENTRY_ROW_BY_ID_SQL = `
SELECT
  id AS "loreEntryId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  content AS "content",
  category AS "category",
  aliases_json AS "aliasesJson",
  enabled AS "enabled",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM lore_entries
WHERE work_id = ? AND id = ?
`;

export const LORE_ENTRY_EVIDENCE_ROWS_SQL = `
SELECT
  lee.lore_entry_id AS "loreEntryId",
  lee.work_id AS "workId",
  lee.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  lee.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  lee.created_at AS "createdAt"
FROM lore_entry_evidence AS lee
JOIN anchors AS a
  ON a.work_id = lee.work_id
  AND a.document_id = lee.source_document_id
  AND a.id = lee.source_anchor_id
WHERE lee.work_id = ? AND lee.lore_entry_id = ?
ORDER BY lee.created_at ASC, lee.source_anchor_id ASC
`;

export const LORE_ENTRY_HISTORY_ROWS_SQL = `
SELECT
  id AS "historyId",
  lore_entry_id AS "loreEntryId",
  work_id AS "workId",
  entry_revision AS "entryRevision",
  change_kind AS "changeKind",
  title AS "title",
  content AS "content",
  category AS "category",
  aliases_json AS "aliasesJson",
  enabled AS "enabled",
  evidence_anchor_ids_json AS "evidenceAnchorIdsJson",
  changed_at AS "changedAt"
FROM lore_entry_history
WHERE work_id = ? AND lore_entry_id = ?
ORDER BY entry_revision DESC, id ASC
`;

export const LORE_FORESHADOW_LINK_SELECT_SQL = `
SELECT
  id AS "linkId",
  revision AS "revision",
  work_id AS "workId",
  lore_entry_id AS "loreEntryId",
  line_id AS "lineId",
  linked_at AS "linkedAt",
  unlinked_at AS "unlinkedAt",
  unlink_reason AS "unlinkReason"
FROM lore_foreshadow_links
`;

export const LORE_FORESHADOW_LINK_ROWS_SQL = `
${LORE_FORESHADOW_LINK_SELECT_SQL}
WHERE work_id = ? AND retired_at IS NULL
ORDER BY linked_at ASC, id ASC
`;

export const LORE_FORESHADOW_LINK_ROW_BY_ID_SQL = `
${LORE_FORESHADOW_LINK_SELECT_SQL}
WHERE work_id = ? AND id = ? AND retired_at IS NULL
`;

export const ACTIVE_LORE_FORESHADOW_LINK_BY_PAIR_SQL = `
${LORE_FORESHADOW_LINK_SELECT_SQL}
WHERE
  work_id = ?
  AND lore_entry_id = ?
  AND line_id = ?
  AND unlinked_at IS NULL
  AND retired_at IS NULL
`;

export const LORE_CANDIDATE_SELECT_SQL = `
SELECT
  id AS "candidateId",
  revision AS "revision",
  work_id AS "workId",
  source_document_id AS "sourceDocumentId",
  source_document_revision_id AS "sourceDocumentRevisionId",
  source_anchor_id AS "sourceAnchorId",
  exact_text AS "exactText",
  source AS "source",
  certainty AS "certainty",
  proposal_json AS "proposalJson",
  reason AS "reason",
  status AS "status",
  approved_lore_entry_id AS "approvedLoreEntryId",
  created_at AS "createdAt",
  reviewed_at AS "reviewedAt"
FROM lore_candidates
`;

export const LORE_CANDIDATE_ROWS_SQL = `
${LORE_CANDIDATE_SELECT_SQL}
WHERE work_id = ? AND retired_at IS NULL
ORDER BY created_at DESC, id ASC
`;

export const LORE_CANDIDATE_ROW_BY_ID_SQL = `
${LORE_CANDIDATE_SELECT_SQL}
WHERE work_id = ? AND id = ? AND retired_at IS NULL
`;

export function parseStoredCharacterRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    characterId: entityId<"Character">(
      readRequiredString(row, "characterId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    name: readRequiredString(row, "name", label),
    aliases: parseStoredStringArray(
      readRequiredString(row, "aliasesJson", label),
      `${label}.aliasesJson`,
    ),
    role: readString(row, "role", label),
    summary: readString(row, "summary", label),
    appearance: readString(row, "appearance", label),
    personality: readString(row, "personality", label),
    speech: readString(row, "speech", label),
    goal: readString(row, "goal", label),
    conflict: readString(row, "conflict", label),
    note: readString(row, "note", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredCharacterRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_CHARACTER_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterRow(
        row,
        `Character rows[${index}]`,
      )),
  );
}

export function readStoredCharacterRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  characterId: EntityId<"Character">,
): StoredCharacterRow | null {
  const rows = database.prepare(CHARACTER_ROW_BY_ID_SQL).all(
    workId,
    characterId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Character lookup returned duplicate rows: ${characterId}`);
  }
  return parseStoredCharacterRow(rows[0] ?? {}, "Character lookup");
}

export function parseStoredCharacterEvidenceRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterEvidenceRow {
  return Object.freeze({
    evidenceId: entityId<"CharacterEvidence">(
      readRequiredString(row, "evidenceId", label),
    ),
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    characterId: entityId<"Character">(
      readRequiredString(row, "characterId", label),
    ),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

export function readStoredCharacterEvidenceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  characterId: EntityId<"Character">,
): readonly StoredCharacterEvidenceRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_EVIDENCE_ROWS_SQL).all(workId, characterId)
      .map((row, index) => parseStoredCharacterEvidenceRow(
        row,
        `Character evidence rows[${index}]`,
      )),
  );
}

export function parseStoredCharacterRelationRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterRelationRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be positive`);
  }
  const retiredAt = readNullableString(row, "retiredAt", label);
  const retirementReason = readNullableString(row, "retirementReason", label);
  if (
    retirementReason !== null &&
    retirementReason !== "user" &&
    retirementReason !== "character-retired"
  ) {
    throw new Error(`${label}.retirementReason is unsupported`);
  }
  if ((retiredAt === null) !== (retirementReason === null)) {
    throw new Error(`${label} retirement state is inconsistent`);
  }
  return Object.freeze({
    relationId: entityId<"CharacterRelation">(
      readRequiredString(row, "relationId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    fromCharacterId: entityId<"Character">(
      readRequiredString(row, "fromCharacterId", label),
    ),
    toCharacterId: entityId<"Character">(
      readRequiredString(row, "toCharacterId", label),
    ),
    kind: readRequiredString(row, "kind", label),
    description: readString(row, "description", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt,
    retirementReason: retirementReason as CharacterRelationRetirementReason | null,
  });
}

export function projectStoredCharacterRelationRow(
  row: StoredCharacterRelationRow,
): CharacterRelationProjection {
  return parseCharacterRelationProjection({
    schemaVersion: 1,
    ...row,
  });
}

export function readStoredCharacterRelationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterRelationRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_RELATION_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterRelationRow(
        row,
        `Character relation rows[${index}]`,
      )),
  );
}

export function readStoredCharacterRelationRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  relationId: EntityId<"CharacterRelation">,
): StoredCharacterRelationRow | null {
  const rows = database.prepare(CHARACTER_RELATION_ROW_BY_ID_SQL).all(
    workId,
    relationId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Character relation lookup returned duplicates: ${relationId}`);
  }
  return parseStoredCharacterRelationRow(
    rows[0] ?? {},
    "Character relation lookup",
  );
}

export function parseStoredLoreEntryRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreEntryRow {
  const revision = readRequiredInteger(row, "revision", label);
  const enabled = readRequiredInteger(row, "enabled", label);
  if (revision < 1 || (enabled !== 0 && enabled !== 1)) {
    throw new Error(`${label} contains invalid lore entry metadata`);
  }
  return Object.freeze({
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    title: readRequiredString(row, "title", label),
    content: readString(row, "content", label),
    category: readString(row, "category", label),
    aliases: parseStoredStringArray(
      readRequiredString(row, "aliasesJson", label),
      `${label}.aliasesJson`,
    ),
    enabled: enabled === 1,
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function readStoredLoreEntryRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredLoreEntryRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_LORE_ENTRY_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredLoreEntryRow(
        row,
        `Lore entry rows[${index}]`,
      )),
  );
}

export function readStoredLoreEntryRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
): StoredLoreEntryRow | null {
  const rows = database.prepare(LORE_ENTRY_ROW_BY_ID_SQL).all(
    workId,
    loreEntryId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Lore entry lookup returned duplicate rows: ${loreEntryId}`);
  }
  return parseStoredLoreEntryRow(rows[0] ?? {}, "Lore entry lookup");
}

export function parseStoredLoreEntryEvidenceRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreEntryEvidenceRow {
  return Object.freeze({
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

export function readStoredLoreEntryEvidenceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
): readonly StoredLoreEntryEvidenceRow[] {
  return Object.freeze(
    database.prepare(LORE_ENTRY_EVIDENCE_ROWS_SQL).all(workId, loreEntryId)
      .map((row, index) => parseStoredLoreEntryEvidenceRow(
        row,
        `Lore entry evidence rows[${index}]`,
      )),
  );
}

export function parseStoredLoreEntryHistoryRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreEntryHistoryRow {
  const entryRevision = readRequiredInteger(row, "entryRevision", label);
  const enabled = readRequiredInteger(row, "enabled", label);
  const changeKind = readRequiredString(row, "changeKind", label);
  if (
    entryRevision < 1 ||
    (enabled !== 0 && enabled !== 1) ||
    !["created", "updated", "evidence-added", "retired"].includes(changeKind)
  ) {
    throw new Error(`${label} contains invalid lore history metadata`);
  }
  return Object.freeze({
    historyId: entityId<"LoreEntryHistory">(
      readRequiredString(row, "historyId", label),
    ),
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    entryRevision,
    changeKind: changeKind as StoredLoreEntryHistoryRow["changeKind"],
    title: readRequiredString(row, "title", label),
    content: readString(row, "content", label),
    category: readString(row, "category", label),
    aliases: parseStoredStringArray(
      readRequiredString(row, "aliasesJson", label),
      `${label}.aliasesJson`,
    ),
    enabled: enabled === 1,
    evidenceAnchorIds: Object.freeze(parseStoredStringArray(
      readRequiredString(row, "evidenceAnchorIdsJson", label),
      `${label}.evidenceAnchorIdsJson`,
    ).map((anchorId) => entityId<"Anchor">(anchorId))),
    changedAt: readRequiredString(row, "changedAt", label),
  });
}

export function readStoredLoreEntryHistoryRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
): readonly StoredLoreEntryHistoryRow[] {
  return Object.freeze(
    database.prepare(LORE_ENTRY_HISTORY_ROWS_SQL).all(workId, loreEntryId)
      .map((row, index) => parseStoredLoreEntryHistoryRow(
        row,
        `Lore entry history rows[${index}]`,
      )),
  );
}

export function parseStoredLoreForeshadowLinkRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreForeshadowLinkRow {
  const revision = readRequiredInteger(row, "revision", label);
  const unlinkedAt = readNullableString(row, "unlinkedAt", label);
  const unlinkReason = readNullableString(row, "unlinkReason", label);
  if (
    revision < 1 ||
    (
      unlinkReason !== null &&
      unlinkReason !== "user" &&
      unlinkReason !== "lore-retired" &&
      unlinkReason !== "foreshadow-retired"
    ) ||
    ((unlinkedAt === null) !== (unlinkReason === null))
  ) {
    throw new Error(`${label} contains invalid lore/foreshadow link metadata`);
  }
  return Object.freeze({
    linkId: entityId<"LoreForeshadowLink">(
      readRequiredString(row, "linkId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    lineId: entityId<"ForeshadowLine">(
      readRequiredString(row, "lineId", label),
    ),
    linkedAt: readRequiredString(row, "linkedAt", label),
    unlinkedAt,
    unlinkReason: unlinkReason as LoreForeshadowUnlinkReason | null,
  });
}

export function projectStoredLoreForeshadowLinkRow(
  row: StoredLoreForeshadowLinkRow,
): LoreForeshadowLinkProjection {
  return parseLoreForeshadowLinkProjection({
    schemaVersion: 1,
    ...row,
  });
}

export function readStoredLoreForeshadowLinkRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredLoreForeshadowLinkRow[] {
  return Object.freeze(
    database.prepare(LORE_FORESHADOW_LINK_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredLoreForeshadowLinkRow(
        row,
        `Lore/foreshadow link rows[${index}]`,
      )),
  );
}

export function readStoredLoreForeshadowLinkRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  linkId: EntityId<"LoreForeshadowLink">,
): StoredLoreForeshadowLinkRow | null {
  const rows = database.prepare(LORE_FORESHADOW_LINK_ROW_BY_ID_SQL).all(
    workId,
    linkId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Lore/foreshadow link lookup returned duplicate rows: ${linkId}`);
  }
  return parseStoredLoreForeshadowLinkRow(
    rows[0] ?? {},
    "Lore/foreshadow link lookup",
  );
}

export function readActiveLoreForeshadowLinkByPair(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
  lineId: EntityId<"ForeshadowLine">,
): StoredLoreForeshadowLinkRow | null {
  const rows = database.prepare(ACTIVE_LORE_FORESHADOW_LINK_BY_PAIR_SQL).all(
    workId,
    loreEntryId,
    lineId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Active lore/foreshadow link lookup returned duplicate rows: ${loreEntryId}/${lineId}`,
    );
  }
  return parseStoredLoreForeshadowLinkRow(
    rows[0] ?? {},
    "Active lore/foreshadow link lookup",
  );
}

export function parseStoredLoreCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreCandidateRow {
  const revision = readRequiredInteger(row, "revision", label);
  const source = readRequiredString(row, "source", label);
  const certainty = readRequiredString(row, "certainty", label);
  const status = readRequiredString(row, "status", label);
  const reviewedAt = readNullableString(row, "reviewedAt", label);
  const approvedLoreEntryId = readNullableIdentity<"LoreEntry">(
    row,
    "approvedLoreEntryId",
    label,
  );
  if (
    revision < 1 ||
    (source !== "user" && source !== "assistant") ||
    (certainty !== "explicit" && certainty !== "inferred") ||
    (status !== "pending" && status !== "approved" && status !== "rejected") ||
    ((status === "pending") !== (reviewedAt === null)) ||
    ((status === "approved") !== (approvedLoreEntryId !== null))
  ) {
    throw new Error(`${label} contains invalid lore Candidate metadata`);
  }
  let rawProposal: unknown;
  try {
    rawProposal = JSON.parse(
      readRequiredString(row, "proposalJson", label),
    ) as unknown;
  } catch {
    throw new Error(`${label}.proposalJson must be JSON`);
  }
  return Object.freeze({
    candidateId: entityId<"LoreCandidate">(
      readRequiredString(row, "candidateId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    source: source as StoredLoreCandidateRow["source"],
    certainty: certainty as StoredLoreCandidateRow["certainty"],
    proposal: parseLoreCandidateProposal(rawProposal),
    reason: readString(row, "reason", label),
    status: status as StoredLoreCandidateRow["status"],
    approvedLoreEntryId,
    createdAt: readRequiredString(row, "createdAt", label),
    reviewedAt,
  });
}

export function readStoredLoreCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredLoreCandidateRow[] {
  return Object.freeze(
    database.prepare(LORE_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredLoreCandidateRow(
        row,
        `Lore Candidate rows[${index}]`,
      )),
  );
}

export function readStoredLoreCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"LoreCandidate">,
): StoredLoreCandidateRow | null {
  const rows = database.prepare(LORE_CANDIDATE_ROW_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Lore Candidate lookup returned duplicate rows: ${candidateId}`);
  }
  return parseStoredLoreCandidateRow(
    rows[0] ?? {},
    "Lore Candidate lookup",
  );
}

