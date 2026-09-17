import type { PublishingContractProjection } from "../../../application/publishing/publishing-contract-contract";
import { parsePublishingContractProjection } from "../../../application/publishing/publishing-contract-contract";
import type { PublishingEvidenceTargetKind } from "../../../application/publishing/publishing-evidence-link-contract";
import type { PublishingFormResponseProjection,PublishingFormTemplateProjection } from "../../../application/publishing/publishing-form-contract";
import { parsePublishingFormResponseProjection,parsePublishingFormTemplateProjection } from "../../../application/publishing/publishing-form-contract";
import type { PublishingMailCandidateProjection } from "../../../application/publishing/publishing-mail-candidate-contract";
import { parsePublishingMailCandidateProjection } from "../../../application/publishing/publishing-mail-candidate-contract";
import type { PublishingPartnerProjection } from "../../../application/publishing/publishing-partner-contract";
import { parsePublishingPartnerProjection } from "../../../application/publishing/publishing-partner-contract";
import type { PublishingPaymentProjection } from "../../../application/publishing/publishing-payment-contract";
import { parsePublishingPaymentProjection } from "../../../application/publishing/publishing-payment-contract";
import type { PublishingPublicationProjection } from "../../../application/publishing/publishing-publication-contract";
import { parsePublishingPublicationProjection } from "../../../application/publishing/publishing-publication-contract";
import type { PublishingSettlementProjection } from "../../../application/publishing/publishing-settlement-contract";
import { parsePublishingSettlementProjection } from "../../../application/publishing/publishing-settlement-contract";
import type { PublishingSourceProjection } from "../../../application/publishing/publishing-source-contract";
import { parsePublishingSourceProjection } from "../../../application/publishing/publishing-source-contract";
import type { PublishingSubmissionProjection,SubmissionPackageProjection } from "../../../application/publishing/publishing-submission-contract";
import { parsePublishingSubmissionProjection,parseSubmissionPackageProjection } from "../../../application/publishing/publishing-submission-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { parseStoredStringArray,readNullableIdentity,readNullableInteger,readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";

export type StoredPublishingPartnerRow = {
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly revision: number;
  readonly name: string;
  readonly parentPartnerId: EntityId<"PublishingPartner"> | null;
  readonly submissionMethod: string;
  readonly websiteUrl: string;
  readonly email: string;
  readonly genres: readonly string[];
  readonly requiredLength: string;
  readonly priority: string;
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type StoredPublishingFormTemplateRow = Omit<
  PublishingFormTemplateProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingFormResponseRow = Omit<
  PublishingFormResponseProjection,
  "schemaVersion"
>;

export type StoredPublishingSubmissionRow = Omit<
  PublishingSubmissionProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingContractRow = Omit<
  PublishingContractProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingPublicationRow = Omit<
  PublishingPublicationProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingSettlementRow = Omit<
  PublishingSettlementProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingPaymentRow = Omit<
  PublishingPaymentProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingSourceRow = Omit<
  PublishingSourceProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export type StoredPublishingMailCandidateRow = Omit<
  PublishingMailCandidateProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

export const PUBLISHING_EVIDENCE_TARGET_TABLES: Readonly<
  Record<PublishingEvidenceTargetKind, string>
> = Object.freeze({
  partner: "publishing_partners",
  submission: "publishing_submissions",
  contract: "publishing_contracts",
  publication: "publishing_publications",
  settlement: "publishing_settlements",
  payment: "publishing_payments",
});

export const ACTIVE_PUBLISHING_PARTNER_ROWS_SQL = `
SELECT
  id AS "partnerId",
  revision AS "revision",
  name AS "name",
  parent_partner_id AS "parentPartnerId",
  submission_method AS "submissionMethod",
  website_url AS "websiteUrl",
  email AS "email",
  genres_json AS "genresJson",
  required_length AS "requiredLength",
  priority AS "priority",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_partners
WHERE retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

export const PUBLISHING_PARTNER_ROW_BY_ID_SQL = `
SELECT
  id AS "partnerId",
  revision AS "revision",
  name AS "name",
  parent_partner_id AS "parentPartnerId",
  submission_method AS "submissionMethod",
  website_url AS "websiteUrl",
  email AS "email",
  genres_json AS "genresJson",
  required_length AS "requiredLength",
  priority AS "priority",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_partners
WHERE id = ?
`;

export const PUBLISHING_FORM_TEMPLATE_SELECT_SQL = `
SELECT
  id AS "templateId",
  revision AS "revision",
  scope AS "scope",
  partner_id AS "partnerId",
  source_template_id AS "sourceTemplateId",
  name AS "name",
  description AS "description",
  sections_json AS "sectionsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_form_templates
`;

export const ACTIVE_PUBLISHING_FORM_TEMPLATE_ROWS_SQL = `
${PUBLISHING_FORM_TEMPLATE_SELECT_SQL}
WHERE retired_at IS NULL
ORDER BY CASE scope WHEN 'base' THEN 0 ELSE 1 END, updated_at DESC, id ASC
`;

export const PUBLISHING_FORM_TEMPLATE_ROW_BY_ID_SQL = `
${PUBLISHING_FORM_TEMPLATE_SELECT_SQL}
WHERE id = ?
`;

export const PUBLISHING_FORM_RESPONSE_SELECT_SQL = `
SELECT
  id AS "responseId",
  revision AS "revision",
  work_id AS "workId",
  partner_id AS "partnerId",
  template_id AS "templateId",
  template_revision AS "templateRevision",
  answers_json AS "answersJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM publishing_form_responses
`;

export const PUBLISHING_FORM_RESPONSE_ROWS_SQL = `
${PUBLISHING_FORM_RESPONSE_SELECT_SQL}
WHERE (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

export const PUBLISHING_FORM_RESPONSE_ROW_BY_WORK_PARTNER_SQL = `
${PUBLISHING_FORM_RESPONSE_SELECT_SQL}
WHERE work_id = ? AND partner_id = ?
`;

export const PUBLISHING_SUBMISSION_SELECT_SQL = `
SELECT
  submission.id AS "submissionId",
  submission.revision AS "revision",
  submission.work_id AS "workId",
  submission.partner_id AS "partnerId",
  submission.title AS "title",
  submission.status AS "status",
  submission.submitted_on AS "submittedOn",
  submission.responded_on AS "respondedOn",
  submission.result AS "result",
  submission.note AS "note",
  submission.card_note AS "cardNote",
  submission.source_ids_json AS "sourceIdsJson",
  submission.created_at AS "createdAt",
  submission.updated_at AS "updatedAt",
  submission.retired_at AS "retiredAt",
  package.id AS "submissionPackageId",
  package.work_snapshot_id AS "workSnapshotId",
  package.work_title_snapshot AS "workTitleSnapshot",
  package.partner_name_snapshot AS "partnerNameSnapshot",
  package.manifest_hash AS "packageManifestHash",
  package.sealed_at AS "sealedAt",
  reference.document_id AS "documentId",
  reference.document_revision_id AS "documentRevisionId"
FROM publishing_submissions AS submission
JOIN submission_packages AS package
  ON package.id = submission.submission_package_id
  AND package.work_id = submission.work_id
  AND package.partner_id = submission.partner_id
LEFT JOIN work_snapshot_document_revisions AS reference
  ON reference.work_id = package.work_id
  AND reference.work_snapshot_id = package.work_snapshot_id
`;

export const ACTIVE_PUBLISHING_SUBMISSION_ROWS_SQL = `
${PUBLISHING_SUBMISSION_SELECT_SQL}
WHERE
  submission.retired_at IS NULL
  AND (? IS NULL OR submission.work_id = ?)
ORDER BY submission.updated_at DESC, submission.id ASC, reference.document_id ASC
`;

export const PUBLISHING_SUBMISSION_ROW_BY_ID_SQL = `
${PUBLISHING_SUBMISSION_SELECT_SQL}
WHERE submission.id = ?
ORDER BY reference.document_id ASC
`;

export const PUBLISHING_CONTRACT_SELECT_SQL = `
SELECT
  id AS "contractId",
  revision AS "revision",
  work_id AS "workId",
  partner_id AS "partnerId",
  submission_id AS "submissionId",
  title AS "title",
  work_title_snapshot AS "workTitleSnapshot",
  partner_name_snapshot AS "partnerNameSnapshot",
  status AS "status",
  signed_on AS "signedOn",
  starts_on AS "startsOn",
  ends_on AS "endsOn",
  rights_scope AS "rightsScope",
  advance_amount AS "advanceAmount",
  currency_code AS "currencyCode",
  revenue_share_note AS "revenueShareNote",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_contracts
`;

export const ACTIVE_PUBLISHING_CONTRACT_ROWS_SQL = `
${PUBLISHING_CONTRACT_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

export const PUBLISHING_CONTRACT_ROW_BY_ID_SQL = `
${PUBLISHING_CONTRACT_SELECT_SQL}
WHERE id = ?
`;

export const PUBLISHING_PUBLICATION_SELECT_SQL = `
SELECT
  id AS "publicationId",
  revision AS "revision",
  work_id AS "workId",
  contract_id AS "contractId",
  channel_partner_id AS "channelPartnerId",
  title AS "title",
  work_title_snapshot AS "workTitleSnapshot",
  channel_name_snapshot AS "channelNameSnapshot",
  status AS "status",
  format AS "format",
  scheduled_on AS "scheduledOn",
  starts_on AS "startsOn",
  ends_on AS "endsOn",
  published_unit_count AS "publishedUnitCount",
  planned_unit_count AS "plannedUnitCount",
  schedule_note AS "scheduleNote",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_publications
`;

export const ACTIVE_PUBLISHING_PUBLICATION_ROWS_SQL = `
${PUBLISHING_PUBLICATION_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

export const PUBLISHING_PUBLICATION_ROW_BY_ID_SQL = `
${PUBLISHING_PUBLICATION_SELECT_SQL}
WHERE id = ?
`;

export const PUBLISHING_SETTLEMENT_SELECT_SQL = `
SELECT
  id AS "settlementId",
  revision AS "revision",
  work_id AS "workId",
  publication_id AS "publicationId",
  title AS "title",
  work_title_snapshot AS "workTitleSnapshot",
  publication_title_snapshot AS "publicationTitleSnapshot",
  period_starts_on AS "periodStartsOn",
  period_ends_on AS "periodEndsOn",
  issued_on AS "issuedOn",
  review_status AS "reviewStatus",
  currency_code AS "currencyCode",
  reported_amount AS "reportedAmount",
  items_json AS "itemsJson",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_settlements
`;

export const ACTIVE_PUBLISHING_SETTLEMENT_ROWS_SQL = `
${PUBLISHING_SETTLEMENT_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

export const PUBLISHING_SETTLEMENT_ROW_BY_ID_SQL = `
${PUBLISHING_SETTLEMENT_SELECT_SQL}
WHERE id = ?
`;

export const PUBLISHING_PAYMENT_SELECT_SQL = `
SELECT
  id AS "paymentId",
  revision AS "revision",
  work_id AS "workId",
  settlement_id AS "settlementId",
  work_title_snapshot AS "workTitleSnapshot",
  settlement_title_snapshot AS "settlementTitleSnapshot",
  received_on AS "receivedOn",
  confirmed_on AS "confirmedOn",
  amount AS "amount",
  currency_code AS "currencyCode",
  match_status AS "matchStatus",
  payer_label AS "payerLabel",
  reference AS "reference",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_payments
`;

export const ACTIVE_PUBLISHING_PAYMENT_ROWS_SQL = `
${PUBLISHING_PAYMENT_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

export const PUBLISHING_PAYMENT_ROW_BY_ID_SQL = `
${PUBLISHING_PAYMENT_SELECT_SQL}
WHERE id = ?
`;

export const PUBLISHING_SOURCE_SELECT_SQL = `
SELECT
  id AS "sourceId",
  revision AS "revision",
  source_kind AS "kind",
  label AS "label",
  url AS "url",
  observed_at AS "observedAt",
  authority AS "authority",
  imported_fields_json AS "importedFieldsJson",
  created_at AS "createdAt",
  retired_at AS "retiredAt"
FROM publishing_sources
`;

export const ACTIVE_PUBLISHING_SOURCE_ROWS_SQL = `
${PUBLISHING_SOURCE_SELECT_SQL}
WHERE retired_at IS NULL
ORDER BY created_at DESC, id ASC
`;

export const PUBLISHING_SOURCE_ROW_BY_ID_SQL = `
${PUBLISHING_SOURCE_SELECT_SQL}
WHERE id = ?
`;

export const PUBLISHING_MAIL_CANDIDATE_SELECT_SQL = `
SELECT
  candidate.id AS "candidateId",
  candidate.revision AS "revision",
  candidate.source_id AS "sourceId",
  candidate.source_account_id AS "sourceAccountId",
  candidate.message_id AS "messageId",
  candidate.thread_id AS "threadId",
  candidate.sender AS "from",
  candidate.subject AS "subject",
  candidate.received_at AS "receivedAt",
  candidate.snippet AS "snippet",
  candidate.body_fingerprint AS "bodyFingerprint",
  candidate.submission_id AS "submissionId",
  submission.partner_id AS "partnerId",
  candidate.match_reason AS "matchReason",
  candidate.proposed_status AS "proposedStatus",
  candidate.proposed_result AS "proposedResult",
  candidate.proposed_responded_on AS "proposedRespondedOn",
  candidate.proposed_note AS "proposedNote",
  candidate.classification_connection_id AS "classificationConnectionId",
  candidate.classification_model AS "classificationModel",
  candidate.review_status AS "reviewStatus",
  candidate.created_at AS "createdAt",
  candidate.updated_at AS "updatedAt",
  candidate.retired_at AS "retiredAt"
FROM publishing_mail_candidates AS candidate
LEFT JOIN publishing_submissions AS submission
  ON submission.id = candidate.submission_id
`;

export const ACTIVE_PUBLISHING_MAIL_CANDIDATE_ROWS_SQL = `
${PUBLISHING_MAIL_CANDIDATE_SELECT_SQL}
WHERE candidate.retired_at IS NULL
ORDER BY candidate.received_at DESC, candidate.id ASC
`;

export const PUBLISHING_MAIL_CANDIDATE_ROW_BY_ID_SQL = `
${PUBLISHING_MAIL_CANDIDATE_SELECT_SQL}
WHERE candidate.id = ?
`;

export const PUBLISHING_MAIL_CANDIDATE_ROW_BY_SOURCE_SQL = `
${PUBLISHING_MAIL_CANDIDATE_SELECT_SQL}
WHERE candidate.source_account_id = ? AND candidate.message_id = ?
`;

export function parseStoredPublishingPartnerRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingPartnerRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    partnerId: entityId<"PublishingPartner">(
      readRequiredString(row, "partnerId", label),
    ),
    revision,
    name: readRequiredString(row, "name", label),
    parentPartnerId: readNullableIdentity<"PublishingPartner">(
      row,
      "parentPartnerId",
      label,
    ),
    submissionMethod: readString(row, "submissionMethod", label),
    websiteUrl: readString(row, "websiteUrl", label),
    email: readString(row, "email", label),
    genres: parseStoredStringArray(
      readRequiredString(row, "genresJson", label),
      `${label}.genresJson`,
    ),
    requiredLength: readString(row, "requiredLength", label),
    priority: readString(row, "priority", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingPartnerRow(
  row: StoredPublishingPartnerRow,
): PublishingPartnerProjection {
  return parsePublishingPartnerProjection({
    schemaVersion: 1,
    partnerId: row.partnerId,
    revision: row.revision,
    name: row.name,
    parentPartnerId: row.parentPartnerId,
    submissionMethod: row.submissionMethod,
    websiteUrl: row.websiteUrl,
    email: row.email,
    genres: row.genres,
    requiredLength: row.requiredLength,
    priority: row.priority,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingPartnerRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingPartnerRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_PARTNER_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingPartnerRow(
        row,
        `Publishing partner rows[${index}]`,
      )),
  );
}

export function readStoredPublishingPartnerRowById(
  database: NodeSqliteDatabase,
  partnerId: EntityId<"PublishingPartner">,
): StoredPublishingPartnerRow | null {
  const rows = database.prepare(PUBLISHING_PARTNER_ROW_BY_ID_SQL).all(partnerId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing partner lookup returned duplicate rows: ${partnerId}`);
  }
  return parseStoredPublishingPartnerRow(
    rows[0] ?? {},
    "Publishing partner lookup",
  );
}

export function parsePublishingFormJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

export function parseStoredPublishingFormTemplateRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingFormTemplateRow {
  const projection = parsePublishingFormTemplateProjection({
    schemaVersion: 1,
    templateId: readRequiredString(row, "templateId", label),
    revision: readRequiredInteger(row, "revision", label),
    scope: readRequiredString(row, "scope", label),
    partnerId: readNullableString(row, "partnerId", label),
    sourceTemplateId: readNullableString(row, "sourceTemplateId", label),
    name: readRequiredString(row, "name", label),
    description: readString(row, "description", label),
    sections: parsePublishingFormJson(
      readRequiredString(row, "sectionsJson", label),
      `${label}.sectionsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    templateId: projection.templateId,
    revision: projection.revision,
    scope: projection.scope,
    partnerId: projection.partnerId,
    sourceTemplateId: projection.sourceTemplateId,
    name: projection.name,
    description: projection.description,
    sections: projection.sections,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingFormTemplateRow(
  row: StoredPublishingFormTemplateRow,
): PublishingFormTemplateProjection {
  return parsePublishingFormTemplateProjection({
    schemaVersion: 1,
    templateId: row.templateId,
    revision: row.revision,
    scope: row.scope,
    partnerId: row.partnerId,
    sourceTemplateId: row.sourceTemplateId,
    name: row.name,
    description: row.description,
    sections: row.sections,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingFormTemplateRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingFormTemplateRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_FORM_TEMPLATE_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingFormTemplateRow(
        row,
        `Publishing form template rows[${index}]`,
      )),
  );
}

export function readStoredPublishingFormTemplateRowById(
  database: NodeSqliteDatabase,
  templateId: EntityId<"PublishingFormTemplate">,
): StoredPublishingFormTemplateRow | null {
  const rows = database.prepare(PUBLISHING_FORM_TEMPLATE_ROW_BY_ID_SQL).all(
    templateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing form template lookup returned duplicate rows: ${templateId}`);
  }
  return parseStoredPublishingFormTemplateRow(
    rows[0] ?? {},
    "Publishing form template lookup",
  );
}

export function parseStoredPublishingFormResponseRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingFormResponseRow {
  const projection = parsePublishingFormResponseProjection({
    schemaVersion: 1,
    responseId: readRequiredString(row, "responseId", label),
    revision: readRequiredInteger(row, "revision", label),
    workId: readRequiredString(row, "workId", label),
    partnerId: readRequiredString(row, "partnerId", label),
    templateId: readRequiredString(row, "templateId", label),
    templateRevision: readRequiredInteger(row, "templateRevision", label),
    answers: parsePublishingFormJson(
      readRequiredString(row, "answersJson", label),
      `${label}.answersJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    responseId: projection.responseId,
    revision: projection.revision,
    workId: projection.workId,
    partnerId: projection.partnerId,
    templateId: projection.templateId,
    templateRevision: projection.templateRevision,
    answers: projection.answers,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
  });
}

export function projectStoredPublishingFormResponseRow(
  row: StoredPublishingFormResponseRow,
): PublishingFormResponseProjection {
  return parsePublishingFormResponseProjection({
    schemaVersion: 1,
    responseId: row.responseId,
    revision: row.revision,
    workId: row.workId,
    partnerId: row.partnerId,
    templateId: row.templateId,
    templateRevision: row.templateRevision,
    answers: row.answers,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingFormResponseRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingFormResponseRow[] {
  return Object.freeze(
    database.prepare(PUBLISHING_FORM_RESPONSE_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingFormResponseRow(
        row,
        `Publishing form response rows[${index}]`,
      )),
  );
}

export function readStoredPublishingFormResponseRowByWorkPartner(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  partnerId: EntityId<"PublishingPartner">,
): StoredPublishingFormResponseRow | null {
  const rows = database
    .prepare(PUBLISHING_FORM_RESPONSE_ROW_BY_WORK_PARTNER_SQL)
    .all(workId, partnerId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Publishing form response lookup returned duplicate rows: ${workId}/${partnerId}`,
    );
  }
  return parseStoredPublishingFormResponseRow(
    rows[0] ?? {},
    "Publishing form response lookup",
  );
}

export function parseStoredPublishingSubmissionRows(
  rows: readonly Record<string, unknown>[],
  label: string,
): readonly StoredPublishingSubmissionRow[] {
  type GroupedRow = {
    readonly submissionId: EntityId<"PublishingSubmission">;
    readonly revision: number;
    readonly workId: EntityId<"Work">;
    readonly partnerId: EntityId<"PublishingPartner">;
    readonly title: string;
    readonly status: string;
    readonly submittedOn: string | null;
    readonly respondedOn: string | null;
    readonly result: string;
    readonly note: string;
    readonly cardNote: string;
    readonly sourceIds: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly retiredAt: string | null;
    readonly submissionPackageId: EntityId<"SubmissionPackage">;
    readonly workSnapshotId: EntityId<"WorkSnapshot">;
    readonly workTitleSnapshot: string;
    readonly partnerNameSnapshot: string;
    readonly packageManifestHash: string;
    readonly sealedAt: string;
    readonly documentRevisions: Array<{
      readonly documentId: EntityId<"Document">;
      readonly documentRevisionId: EntityId<"DocumentRevision">;
    }>;
  };

  const grouped = new Map<EntityId<"PublishingSubmission">, GroupedRow>();
  rows.forEach((row, index) => {
    const rowLabel = `${label}[${index}]`;
    const submissionId = entityId<"PublishingSubmission">(
      readRequiredString(row, "submissionId", rowLabel),
    );
    let entry = grouped.get(submissionId);
    if (entry === undefined) {
      const revision = readRequiredInteger(row, "revision", rowLabel);
      if (revision < 1) {
        throw new Error(`${rowLabel}.revision must be at least 1`);
      }
      entry = {
        submissionId,
        revision,
        workId: entityId<"Work">(
          readRequiredString(row, "workId", rowLabel),
        ),
        partnerId: entityId<"PublishingPartner">(
          readRequiredString(row, "partnerId", rowLabel),
        ),
        title: readString(row, "title", rowLabel),
        status: readString(row, "status", rowLabel),
        submittedOn: readNullableString(row, "submittedOn", rowLabel),
        respondedOn: readNullableString(row, "respondedOn", rowLabel),
        result: readString(row, "result", rowLabel),
        note: readString(row, "note", rowLabel),
        cardNote: readString(row, "cardNote", rowLabel),
        sourceIds: parseStoredStringArray(
          readRequiredString(row, "sourceIdsJson", rowLabel),
          `${rowLabel}.sourceIdsJson`,
        ),
        createdAt: readRequiredString(row, "createdAt", rowLabel),
        updatedAt: readRequiredString(row, "updatedAt", rowLabel),
        retiredAt: readNullableString(row, "retiredAt", rowLabel),
        submissionPackageId: entityId<"SubmissionPackage">(
          readRequiredString(row, "submissionPackageId", rowLabel),
        ),
        workSnapshotId: entityId<"WorkSnapshot">(
          readRequiredString(row, "workSnapshotId", rowLabel),
        ),
        workTitleSnapshot: readString(row, "workTitleSnapshot", rowLabel),
        partnerNameSnapshot: readRequiredString(
          row,
          "partnerNameSnapshot",
          rowLabel,
        ),
        packageManifestHash: readRequiredString(
          row,
          "packageManifestHash",
          rowLabel,
        ),
        sealedAt: readRequiredString(row, "sealedAt", rowLabel),
        documentRevisions: [],
      };
      grouped.set(submissionId, entry);
    }
    const documentId = row.documentId;
    const documentRevisionId = row.documentRevisionId;
    if (documentId === null && documentRevisionId === null) return;
    if (
      typeof documentId !== "string" ||
      documentId.length === 0 ||
      typeof documentRevisionId !== "string" ||
      documentRevisionId.length === 0
    ) {
      throw new Error(`${rowLabel} has an incomplete SubmissionPackage revision`);
    }
    entry.documentRevisions.push({
      documentId: entityId<"Document">(documentId),
      documentRevisionId: entityId<"DocumentRevision">(documentRevisionId),
    });
  });

  return Object.freeze([...grouped.values()].map((entry) => {
    const packageProjection: SubmissionPackageProjection =
      parseSubmissionPackageProjection({
        schemaVersion: 1,
        submissionPackageId: entry.submissionPackageId,
        workId: entry.workId,
        partnerId: entry.partnerId,
        workSnapshotId: entry.workSnapshotId,
        workTitleSnapshot: entry.workTitleSnapshot,
        partnerNameSnapshot: entry.partnerNameSnapshot,
        manifestHash: entry.packageManifestHash,
        sealedAt: entry.sealedAt,
        documentRevisions: entry.documentRevisions,
      });
    const projection = parsePublishingSubmissionProjection({
      schemaVersion: 1,
      submissionId: entry.submissionId,
      revision: entry.revision,
      workId: entry.workId,
      partnerId: entry.partnerId,
      title: entry.title,
      status: entry.status,
      submittedOn: entry.submittedOn,
      respondedOn: entry.respondedOn,
      result: entry.result,
      note: entry.note,
      cardNote: entry.cardNote,
      sourceIds: entry.sourceIds,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      package: packageProjection,
    });
    return Object.freeze({
      submissionId: projection.submissionId,
      revision: projection.revision,
      workId: projection.workId,
      partnerId: projection.partnerId,
      title: projection.title,
      status: projection.status,
      submittedOn: projection.submittedOn,
      respondedOn: projection.respondedOn,
      result: projection.result,
      note: projection.note,
      cardNote: projection.cardNote,
      sourceIds: projection.sourceIds,
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
      package: projection.package,
      retiredAt: entry.retiredAt,
    });
  }));
}

export function projectStoredPublishingSubmissionRow(
  row: StoredPublishingSubmissionRow,
): PublishingSubmissionProjection {
  return parsePublishingSubmissionProjection({
    schemaVersion: 1,
    submissionId: row.submissionId,
    revision: row.revision,
    workId: row.workId,
    partnerId: row.partnerId,
    title: row.title,
    status: row.status,
    submittedOn: row.submittedOn,
    respondedOn: row.respondedOn,
    result: row.result,
    note: row.note,
    cardNote: row.cardNote,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    package: row.package,
  });
}

export function readStoredPublishingSubmissionRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingSubmissionRow[] {
  return parseStoredPublishingSubmissionRows(
    database.prepare(ACTIVE_PUBLISHING_SUBMISSION_ROWS_SQL).all(
      workId,
      workId,
    ),
    "Publishing submission rows",
  );
}

export function readStoredPublishingSubmissionRowById(
  database: NodeSqliteDatabase,
  submissionId: EntityId<"PublishingSubmission">,
): StoredPublishingSubmissionRow | null {
  const rows = database.prepare(PUBLISHING_SUBMISSION_ROW_BY_ID_SQL).all(
    submissionId,
  );
  if (rows.length === 0) return null;
  const submissions = parseStoredPublishingSubmissionRows(
    rows,
    "Publishing submission lookup",
  );
  if (submissions.length !== 1) {
    throw new Error(`Publishing submission lookup returned duplicate rows: ${submissionId}`);
  }
  return submissions[0] ?? null;
}

export function parseStoredPublishingContractRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingContractRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const advanceAmountValue = row.advanceAmount;
  if (
    advanceAmountValue !== null &&
    (typeof advanceAmountValue !== "number" ||
      !Number.isFinite(advanceAmountValue) ||
      advanceAmountValue < 0)
  ) {
    throw new Error(`${label}.advanceAmount must be non-negative or null`);
  }
  const submissionIdValue = readNullableString(row, "submissionId", label);
  const projection = parsePublishingContractProjection({
    schemaVersion: 1,
    contractId: readRequiredString(row, "contractId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    partnerId: readRequiredString(row, "partnerId", label),
    submissionId: submissionIdValue,
    title: readString(row, "title", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    partnerNameSnapshot: readRequiredString(row, "partnerNameSnapshot", label),
    status: readString(row, "status", label),
    signedOn: readNullableString(row, "signedOn", label),
    startsOn: readNullableString(row, "startsOn", label),
    endsOn: readNullableString(row, "endsOn", label),
    rightsScope: readString(row, "rightsScope", label),
    advanceAmount: advanceAmountValue,
    currencyCode: readString(row, "currencyCode", label),
    revenueShareNote: readString(row, "revenueShareNote", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    contractId: projection.contractId,
    revision: projection.revision,
    workId: projection.workId,
    partnerId: projection.partnerId,
    submissionId: projection.submissionId,
    title: projection.title,
    workTitleSnapshot: projection.workTitleSnapshot,
    partnerNameSnapshot: projection.partnerNameSnapshot,
    status: projection.status,
    signedOn: projection.signedOn,
    startsOn: projection.startsOn,
    endsOn: projection.endsOn,
    rightsScope: projection.rightsScope,
    advanceAmount: projection.advanceAmount,
    currencyCode: projection.currencyCode,
    revenueShareNote: projection.revenueShareNote,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingContractRow(
  row: StoredPublishingContractRow,
): PublishingContractProjection {
  return parsePublishingContractProjection({
    schemaVersion: 1,
    contractId: row.contractId,
    revision: row.revision,
    workId: row.workId,
    partnerId: row.partnerId,
    submissionId: row.submissionId,
    title: row.title,
    workTitleSnapshot: row.workTitleSnapshot,
    partnerNameSnapshot: row.partnerNameSnapshot,
    status: row.status,
    signedOn: row.signedOn,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    rightsScope: row.rightsScope,
    advanceAmount: row.advanceAmount,
    currencyCode: row.currencyCode,
    revenueShareNote: row.revenueShareNote,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingContractRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingContractRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_CONTRACT_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingContractRow(
        row,
        `Publishing contract rows[${index}]`,
      )),
  );
}

export function readStoredPublishingContractRowById(
  database: NodeSqliteDatabase,
  contractId: EntityId<"PublishingContract">,
): StoredPublishingContractRow | null {
  const rows = database.prepare(PUBLISHING_CONTRACT_ROW_BY_ID_SQL).all(contractId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing contract lookup returned duplicate rows: ${contractId}`);
  }
  return parseStoredPublishingContractRow(rows[0] ?? {}, "Publishing contract lookup");
}

export function parseStoredPublishingPublicationRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingPublicationRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const projection = parsePublishingPublicationProjection({
    schemaVersion: 1,
    publicationId: readRequiredString(row, "publicationId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    contractId: readNullableString(row, "contractId", label),
    channelPartnerId: readNullableString(row, "channelPartnerId", label),
    title: readString(row, "title", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    channelNameSnapshot: readString(row, "channelNameSnapshot", label),
    status: readString(row, "status", label),
    format: readString(row, "format", label),
    scheduledOn: readNullableString(row, "scheduledOn", label),
    startsOn: readNullableString(row, "startsOn", label),
    endsOn: readNullableString(row, "endsOn", label),
    publishedUnitCount: readNullableInteger(row, "publishedUnitCount", label),
    plannedUnitCount: readNullableInteger(row, "plannedUnitCount", label),
    scheduleNote: readString(row, "scheduleNote", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    publicationId: projection.publicationId,
    revision: projection.revision,
    workId: projection.workId,
    contractId: projection.contractId,
    channelPartnerId: projection.channelPartnerId,
    title: projection.title,
    workTitleSnapshot: projection.workTitleSnapshot,
    channelNameSnapshot: projection.channelNameSnapshot,
    status: projection.status,
    format: projection.format,
    scheduledOn: projection.scheduledOn,
    startsOn: projection.startsOn,
    endsOn: projection.endsOn,
    publishedUnitCount: projection.publishedUnitCount,
    plannedUnitCount: projection.plannedUnitCount,
    scheduleNote: projection.scheduleNote,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingPublicationRow(
  row: StoredPublishingPublicationRow,
): PublishingPublicationProjection {
  return parsePublishingPublicationProjection({
    schemaVersion: 1,
    publicationId: row.publicationId,
    revision: row.revision,
    workId: row.workId,
    contractId: row.contractId,
    channelPartnerId: row.channelPartnerId,
    title: row.title,
    workTitleSnapshot: row.workTitleSnapshot,
    channelNameSnapshot: row.channelNameSnapshot,
    status: row.status,
    format: row.format,
    scheduledOn: row.scheduledOn,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    publishedUnitCount: row.publishedUnitCount,
    plannedUnitCount: row.plannedUnitCount,
    scheduleNote: row.scheduleNote,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingPublicationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingPublicationRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_PUBLICATION_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingPublicationRow(
        row,
        `Publishing publication rows[${index}]`,
      )),
  );
}

export function readStoredPublishingPublicationRowById(
  database: NodeSqliteDatabase,
  publicationId: EntityId<"PublishingPublication">,
): StoredPublishingPublicationRow | null {
  const rows = database.prepare(PUBLISHING_PUBLICATION_ROW_BY_ID_SQL).all(publicationId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing publication lookup returned duplicate rows: ${publicationId}`);
  }
  return parseStoredPublishingPublicationRow(
    rows[0] ?? {},
    "Publishing publication lookup",
  );
}

export function parseStoredPublishingSettlementRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingSettlementRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const reportedAmountValue = row.reportedAmount;
  if (
    reportedAmountValue !== null &&
    (typeof reportedAmountValue !== "number" || !Number.isFinite(reportedAmountValue))
  ) {
    throw new Error(`${label}.reportedAmount must be finite or null`);
  }
  let items: unknown;
  try {
    items = JSON.parse(readRequiredString(row, "itemsJson", label)) as unknown;
  } catch {
    throw new Error(`${label}.itemsJson must be JSON`);
  }
  const projection = parsePublishingSettlementProjection({
    schemaVersion: 1,
    settlementId: readRequiredString(row, "settlementId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    publicationId: readRequiredString(row, "publicationId", label),
    title: readString(row, "title", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    publicationTitleSnapshot: readString(row, "publicationTitleSnapshot", label),
    periodStartsOn: readNullableString(row, "periodStartsOn", label),
    periodEndsOn: readNullableString(row, "periodEndsOn", label),
    issuedOn: readNullableString(row, "issuedOn", label),
    reviewStatus: readString(row, "reviewStatus", label),
    currencyCode: readString(row, "currencyCode", label),
    reportedAmount: reportedAmountValue,
    items,
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    settlementId: projection.settlementId,
    revision: projection.revision,
    workId: projection.workId,
    publicationId: projection.publicationId,
    title: projection.title,
    workTitleSnapshot: projection.workTitleSnapshot,
    publicationTitleSnapshot: projection.publicationTitleSnapshot,
    periodStartsOn: projection.periodStartsOn,
    periodEndsOn: projection.periodEndsOn,
    issuedOn: projection.issuedOn,
    reviewStatus: projection.reviewStatus,
    currencyCode: projection.currencyCode,
    reportedAmount: projection.reportedAmount,
    items: projection.items,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingSettlementRow(
  row: StoredPublishingSettlementRow,
): PublishingSettlementProjection {
  return parsePublishingSettlementProjection({
    schemaVersion: 1,
    settlementId: row.settlementId,
    revision: row.revision,
    workId: row.workId,
    publicationId: row.publicationId,
    title: row.title,
    workTitleSnapshot: row.workTitleSnapshot,
    publicationTitleSnapshot: row.publicationTitleSnapshot,
    periodStartsOn: row.periodStartsOn,
    periodEndsOn: row.periodEndsOn,
    issuedOn: row.issuedOn,
    reviewStatus: row.reviewStatus,
    currencyCode: row.currencyCode,
    reportedAmount: row.reportedAmount,
    items: row.items,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingSettlementRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingSettlementRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_SETTLEMENT_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingSettlementRow(
        row,
        `Publishing settlement rows[${index}]`,
      )),
  );
}

export function readStoredPublishingSettlementRowById(
  database: NodeSqliteDatabase,
  settlementId: EntityId<"PublishingSettlement">,
): StoredPublishingSettlementRow | null {
  const rows = database.prepare(PUBLISHING_SETTLEMENT_ROW_BY_ID_SQL).all(settlementId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing settlement lookup returned duplicate rows: ${settlementId}`);
  }
  return parseStoredPublishingSettlementRow(
    rows[0] ?? {},
    "Publishing settlement lookup",
  );
}

export function parseStoredPublishingPaymentRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingPaymentRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const amountValue = row.amount;
  if (typeof amountValue !== "number" || !Number.isFinite(amountValue)) {
    throw new Error(`${label}.amount must be finite`);
  }
  const projection = parsePublishingPaymentProjection({
    schemaVersion: 1,
    paymentId: readRequiredString(row, "paymentId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    settlementId: readNullableString(row, "settlementId", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    settlementTitleSnapshot: readString(row, "settlementTitleSnapshot", label),
    receivedOn: readNullableString(row, "receivedOn", label),
    confirmedOn: readNullableString(row, "confirmedOn", label),
    amount: amountValue,
    currencyCode: readString(row, "currencyCode", label),
    matchStatus: readString(row, "matchStatus", label),
    payerLabel: readString(row, "payerLabel", label),
    reference: readString(row, "reference", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    paymentId: projection.paymentId,
    revision: projection.revision,
    workId: projection.workId,
    settlementId: projection.settlementId,
    workTitleSnapshot: projection.workTitleSnapshot,
    settlementTitleSnapshot: projection.settlementTitleSnapshot,
    receivedOn: projection.receivedOn,
    confirmedOn: projection.confirmedOn,
    amount: projection.amount,
    currencyCode: projection.currencyCode,
    matchStatus: projection.matchStatus,
    payerLabel: projection.payerLabel,
    reference: projection.reference,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingPaymentRow(
  row: StoredPublishingPaymentRow,
): PublishingPaymentProjection {
  return parsePublishingPaymentProjection({
    schemaVersion: 1,
    paymentId: row.paymentId,
    revision: row.revision,
    workId: row.workId,
    settlementId: row.settlementId,
    workTitleSnapshot: row.workTitleSnapshot,
    settlementTitleSnapshot: row.settlementTitleSnapshot,
    receivedOn: row.receivedOn,
    confirmedOn: row.confirmedOn,
    amount: row.amount,
    currencyCode: row.currencyCode,
    matchStatus: row.matchStatus,
    payerLabel: row.payerLabel,
    reference: row.reference,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingPaymentRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingPaymentRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_PAYMENT_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingPaymentRow(
        row,
        `Publishing payment rows[${index}]`,
      )),
  );
}

export function readStoredPublishingPaymentRowById(
  database: NodeSqliteDatabase,
  paymentId: EntityId<"PublishingPayment">,
): StoredPublishingPaymentRow | null {
  const rows = database.prepare(PUBLISHING_PAYMENT_ROW_BY_ID_SQL).all(paymentId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing payment lookup returned duplicate rows: ${paymentId}`);
  }
  return parseStoredPublishingPaymentRow(
    rows[0] ?? {},
    "Publishing payment lookup",
  );
}

export function parseStoredPublishingSourceRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingSourceRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  let importedFields: unknown;
  try {
    importedFields = JSON.parse(
      readRequiredString(row, "importedFieldsJson", label),
    ) as unknown;
  } catch {
    throw new Error(`${label}.importedFieldsJson must be JSON`);
  }
  const projection = parsePublishingSourceProjection({
    schemaVersion: 1,
    sourceId: readRequiredString(row, "sourceId", label),
    revision,
    kind: readString(row, "kind", label),
    label: readString(row, "label", label),
    url: readNullableString(row, "url", label),
    observedAt: readNullableString(row, "observedAt", label),
    authority: readString(row, "authority", label),
    importedFields,
    createdAt: readRequiredString(row, "createdAt", label),
  });
  return Object.freeze({
    sourceId: projection.sourceId,
    revision: projection.revision,
    kind: projection.kind,
    label: projection.label,
    url: projection.url,
    observedAt: projection.observedAt,
    authority: projection.authority,
    importedFields: projection.importedFields,
    createdAt: projection.createdAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingSourceRow(
  row: StoredPublishingSourceRow,
): PublishingSourceProjection {
  return parsePublishingSourceProjection({
    schemaVersion: 1,
    sourceId: row.sourceId,
    revision: row.revision,
    kind: row.kind,
    label: row.label,
    url: row.url,
    observedAt: row.observedAt,
    authority: row.authority,
    importedFields: row.importedFields,
    createdAt: row.createdAt,
  });
}

export function readStoredPublishingSourceRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingSourceRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_SOURCE_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingSourceRow(
        row,
        `Publishing source rows[${index}]`,
      )),
  );
}

export function readStoredPublishingSourceRowById(
  database: NodeSqliteDatabase,
  sourceId: EntityId<"PublishingSource">,
): StoredPublishingSourceRow | null {
  const rows = database.prepare(PUBLISHING_SOURCE_ROW_BY_ID_SQL).all(sourceId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing source lookup returned duplicate rows: ${sourceId}`);
  }
  return parseStoredPublishingSourceRow(
    rows[0] ?? {},
    "Publishing source lookup",
  );
}

export function parseStoredPublishingMailCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingMailCandidateRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const projection = parsePublishingMailCandidateProjection({
    schemaVersion: 1,
    candidateId: readRequiredString(row, "candidateId", label),
    revision,
    sourceId: readRequiredString(row, "sourceId", label),
    sourceAccountId: readRequiredString(row, "sourceAccountId", label),
    messageId: readRequiredString(row, "messageId", label),
    threadId: readRequiredString(row, "threadId", label),
    from: readString(row, "from", label),
    subject: readString(row, "subject", label),
    receivedAt: readRequiredString(row, "receivedAt", label),
    snippet: readString(row, "snippet", label),
    bodyFingerprint: readRequiredString(row, "bodyFingerprint", label),
    submissionId: readNullableString(row, "submissionId", label),
    partnerId: readNullableString(row, "partnerId", label),
    matchReason: readString(row, "matchReason", label),
    proposedStatus: readString(row, "proposedStatus", label),
    proposedResult: readString(row, "proposedResult", label),
    proposedRespondedOn: readNullableString(row, "proposedRespondedOn", label),
    proposedNote: readString(row, "proposedNote", label),
    classificationConnectionId: row.classificationConnectionId === null
      ? null
      : readString(row, "classificationConnectionId", label),
    classificationModel: readString(row, "classificationModel", label),
    reviewStatus: readRequiredString(row, "reviewStatus", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    candidateId: projection.candidateId,
    revision: projection.revision,
    sourceId: projection.sourceId,
    sourceAccountId: projection.sourceAccountId,
    messageId: projection.messageId,
    threadId: projection.threadId,
    from: projection.from,
    subject: projection.subject,
    receivedAt: projection.receivedAt,
    snippet: projection.snippet,
    bodyFingerprint: projection.bodyFingerprint,
    submissionId: projection.submissionId,
    partnerId: projection.partnerId,
    matchReason: projection.matchReason,
    proposedStatus: projection.proposedStatus,
    proposedResult: projection.proposedResult,
    proposedRespondedOn: projection.proposedRespondedOn,
    proposedNote: projection.proposedNote,
    classificationConnectionId: projection.classificationConnectionId,
    classificationModel: projection.classificationModel,
    reviewStatus: projection.reviewStatus,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

export function projectStoredPublishingMailCandidateRow(
  row: StoredPublishingMailCandidateRow,
): PublishingMailCandidateProjection {
  return parsePublishingMailCandidateProjection({
    schemaVersion: 1,
    candidateId: row.candidateId,
    revision: row.revision,
    sourceId: row.sourceId,
    sourceAccountId: row.sourceAccountId,
    messageId: row.messageId,
    threadId: row.threadId,
    from: row.from,
    subject: row.subject,
    receivedAt: row.receivedAt,
    snippet: row.snippet,
    bodyFingerprint: row.bodyFingerprint,
    submissionId: row.submissionId,
    partnerId: row.partnerId,
    matchReason: row.matchReason,
    proposedStatus: row.proposedStatus,
    proposedResult: row.proposedResult,
    proposedRespondedOn: row.proposedRespondedOn,
    proposedNote: row.proposedNote,
    classificationConnectionId: row.classificationConnectionId,
    classificationModel: row.classificationModel,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readStoredPublishingMailCandidateRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingMailCandidateRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_MAIL_CANDIDATE_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingMailCandidateRow(
        row,
        `Publishing mail candidate rows[${index}]`,
      )),
  );
}

export function readStoredPublishingMailCandidateRowById(
  database: NodeSqliteDatabase,
  candidateId: EntityId<"PublishingMailCandidate">,
): StoredPublishingMailCandidateRow | null {
  const rows = database.prepare(PUBLISHING_MAIL_CANDIDATE_ROW_BY_ID_SQL).all(
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing mail candidate lookup returned duplicate rows: ${candidateId}`);
  }
  return parseStoredPublishingMailCandidateRow(
    rows[0] ?? {},
    "Publishing mail candidate lookup",
  );
}

export function readStoredPublishingMailCandidateRowBySource(
  database: NodeSqliteDatabase,
  sourceAccountId: string,
  messageId: string,
): StoredPublishingMailCandidateRow | null {
  const rows = database.prepare(PUBLISHING_MAIL_CANDIDATE_ROW_BY_SOURCE_SQL).all(
    sourceAccountId,
    messageId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Publishing mail candidate source lookup returned duplicate rows: ${sourceAccountId}/${messageId}`,
    );
  }
  return parseStoredPublishingMailCandidateRow(
    rows[0] ?? {},
    "Publishing mail candidate source lookup",
  );
}

