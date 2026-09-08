import type { Poc3AnchorRecord } from "../../../domain/poc-3-storage-ledger";
import type { Anchor,EntityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

export function createRecordMeta(now: string) {
  return Object.freeze({
    schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export function createAnchorLedgerRecord(
  workId: EntityId<"Work">,
  anchor: Anchor,
): Poc3AnchorRecord {
  return Object.freeze({
    kind: "anchor",
    ...anchor.meta,
    workId,
    documentId: anchor.documentId,
    originRevisionId: anchor.originRevisionId,
    resolvedRevisionId: anchor.resolvedRevisionId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    exactQuote: anchor.exactQuote,
    prefixContext: anchor.prefixContext,
    suffixContext: anchor.suffixContext,
    quoteHash: anchor.quoteHash,
    contextHash: anchor.contextHash,
    ...(anchor.lineageRef === undefined
      ? {}
      : { lineageRef: anchor.lineageRef }),
    status: anchor.status,
    resolutionEvidenceJson: JSON.stringify(
      anchor.resolutionEvidence,
    ),
  });
}

export function insertAnchorLedgerRecord(
  database: NodeSqliteDatabase,
  record: Poc3AnchorRecord,
): void {
  database.prepare(`
    INSERT INTO anchors (
      id, schema_version, revision, created_at, updated_at, retired_at,
      work_id, document_id, origin_revision_id, resolved_revision_id,
      start_offset, end_offset, exact_quote, prefix_context, suffix_context,
      quote_hash, context_hash, lineage_ref, status, resolution_evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.schemaVersion,
    record.revision,
    record.createdAt,
    record.updatedAt,
    record.retiredAt ?? null,
    record.workId,
    record.documentId,
    record.originRevisionId,
    record.resolvedRevisionId,
    record.startOffset,
    record.endOffset,
    record.exactQuote,
    record.prefixContext,
    record.suffixContext,
    record.quoteHash,
    record.contextHash,
    record.lineageRef ?? null,
    record.status,
    record.resolutionEvidenceJson,
  );
}

