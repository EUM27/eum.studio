import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { StorageTransaction } from "../application/storage/storage-service";
import type { Poc3MigrationDecisionRecord } from "../domain/poc-3-storage-ledger";
import { openNodeSqliteLedger } from "../platform/storage/node-sqlite-ledger";
import { createLocalWorkspaceStorageProfiles } from "./local-workspace-runtime";

export type RecordLegacyLoreMigrationDecisionInput = {
  readonly targetRootDirectoryPath: string;
  readonly reportFileName: string;
  readonly decisionId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly commandKind: string;
  readonly decisionPayloadJson: string;
  readonly decidedAt: string;
  readonly actorRef: string;
};

export type RecordLegacyLoreMigrationDecisionReceipt = {
  readonly decisionId: string;
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly publication: "published" | "reused";
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(
  value: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const entry = value[field];
  if (typeof entry !== "string" || entry.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return entry;
}

function sameDecision(
  left: Poc3MigrationDecisionRecord,
  right: Poc3MigrationDecisionRecord,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function recordLegacyLoreMigrationDecision(
  input: RecordLegacyLoreMigrationDecisionInput,
): Promise<RecordLegacyLoreMigrationDecisionReceipt> {
  if (!isAbsolute(input.targetRootDirectoryPath)) {
    throw new Error("Migration decision target root must be absolute");
  }
  JSON.parse(input.decisionPayloadJson);
  const targetRoot = resolve(input.targetRootDirectoryPath);
  const report = readRecord(
    JSON.parse(
      await readFile(resolve(targetRoot, input.reportFileName), "utf8"),
    ),
    "Migration report",
  );
  const batchId = readString(report, "batchId", "Migration report");
  const sourceSnapshotId = readString(
    report,
    "sourceSnapshotId",
    "Migration report",
  );
  const record: Poc3MigrationDecisionRecord = Object.freeze({
    kind: "migrationDecision",
    id: input.decisionId,
    batchId,
    sourceSnapshotId,
    sourceCollection: input.sourceCollection,
    sourceIdentity: input.sourceIdentity,
    commandKind: input.commandKind,
    decisionPayloadJson: input.decisionPayloadJson,
    decidedAt: input.decidedAt,
    actorRef: input.actorRef,
  });
  const ledger = await openNodeSqliteLedger(
    createLocalWorkspaceStorageProfiles(targetRoot).ledgerProfile,
  );
  try {
    const existing = await ledger.getMigrationDecisionById(input.decisionId);
    if (existing !== null) {
      if (!sameDecision(existing, record)) {
        throw new Error("Migration decision identity already has another payload");
      }
      return Object.freeze({
        decisionId: input.decisionId,
        batchId,
        sourceSnapshotId,
        publication: "reused",
      });
    }
    await ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(record);
    });
    const stored = await ledger.getMigrationDecisionById(input.decisionId);
    if (stored === null || !sameDecision(stored, record)) {
      throw new Error("Migration decision round-trip differs from command");
    }
    return Object.freeze({
      decisionId: input.decisionId,
      batchId,
      sourceSnapshotId,
      publication: "published",
    });
  } finally {
    ledger.close();
  }
}
