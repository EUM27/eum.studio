import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { Poc3LedgerRecord } from "../../src/domain/poc-3-storage-ledger";
import { openNodeSqliteLedger } from "../../src/platform/storage/node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "../../src/platform/storage/node-sqlite-ledger-profile";

const now = "2026-08-29T06:00:00.000Z";
const workerSource = String.raw`
const { DatabaseSync } = require("node:sqlite");
const input = JSON.parse(process.argv[1]);
const mode = process.argv[2];
const database = new DatabaseSync(input.databasePath);
database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; BEGIN IMMEDIATE");
database.prepare("INSERT INTO continuity_threads (id, schema_version, revision, created_at, updated_at, work_id, kind, title, note, status, opened_at, resolved_at) VALUES (?, 1, 1, ?, ?, ?, 'promise', '북문 약속', '', 'open', ?, NULL)")
  .run(input.threadId, input.decidedAt, input.decidedAt, input.workId, input.decidedAt);
database.prepare("INSERT INTO anchors (id, schema_version, revision, created_at, updated_at, retired_at, work_id, document_id, origin_revision_id, resolved_revision_id, start_offset, end_offset, exact_quote, prefix_context, suffix_context, quote_hash, context_hash, lineage_ref, status, resolution_evidence_json) VALUES (?, 19, 1, ?, ?, NULL, ?, ?, ?, ?, 0, 2, '윤서', '', '', 'quote-hash', 'context-hash', NULL, 'resolved', '{}')")
  .run(input.anchorId, input.decidedAt, input.decidedAt, input.workId, input.documentId, input.documentRevisionId, input.documentRevisionId);
database.prepare("INSERT INTO continuity_thread_evidence (id, schema_version, work_id, thread_id, phase, source_document_id, source_document_revision_id, source_from, source_to, exact_text, anchor_id, order_index, created_at) VALUES (?, 1, ?, ?, 'opened', ?, ?, 0, 2, '윤서', ?, 0, ?)")
  .run(input.threadEvidenceId, input.workId, input.threadId, input.documentId, input.documentRevisionId, input.anchorId, input.decidedAt);
database.prepare("INSERT INTO continuity_thread_history (id, schema_version, work_id, thread_id, transition_kind, revision_before, revision_after, resolution_mode, reason, evidence_anchor_ids_json, created_at) VALUES (?, 1, ?, ?, 'created', NULL, 1, NULL, 'Candidate approval', ?, ?)")
  .run(input.transitionId, input.workId, input.threadId, JSON.stringify([input.anchorId]), input.decidedAt);
database.prepare("UPDATE assistant_continuity_review_evidence SET anchor_id = ? WHERE id = ? AND anchor_id IS NULL")
  .run(input.anchorId, input.evidenceId);
database.prepare("UPDATE assistant_continuity_review_items SET status = 'approved', applied_thread_id = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
  .run(input.threadId, input.decidedAt, input.itemId);
database.prepare("UPDATE assistant_continuity_review_candidates SET revision = 2, status = 'completed', updated_at = ? WHERE id = ? AND revision = 1")
  .run(input.decidedAt, input.candidateId);
database.prepare("INSERT INTO assistant_continuity_review_decisions (id, schema_version, work_id, candidate_id, item_id, decision, outcome, thread_id, thread_revision_after, source_document_revision_id, created_at) VALUES (?, 1, ?, ?, ?, 'approve', 'applied', ?, 1, ?, ?)")
  .run(input.decisionId, input.workId, input.candidateId, input.itemId, input.threadId, input.documentRevisionId, input.decidedAt);
if (mode === "commit") database.exec("COMMIT");
if (process.send) process.send({ type: mode === "commit" ? "committed" : "transaction-open" });
setInterval(() => undefined, 1000);
`;

function profile(databasePath: string) {
  return parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
      synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
      foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
    },
    targetSchemaVersion: 19,
  });
}

function meta(id: string) {
  return { id, schemaVersion: 19, revision: 1, createdAt: now, updatedAt: now } as const;
}

async function seed(databasePath: string, ids: Record<string, string>) {
  const ledger = await openNodeSqliteLedger(profile(databasePath));
  const records: Poc3LedgerRecord[] = [
    { kind: "studio", id: ids.studioId!, displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
    { kind: "work", ...meta(ids.workId!), studioId: ids.studioId!, title: "process", orderKey: "a", settingsId: ids.settingsId! },
    { kind: "activityPolicy", ...meta(ids.activityPolicyId!), workId: ids.workId!, idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta(ids.focusPolicyId!), workId: ids.workId!, phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: ids.settingsId!, workId: ids.workId!, sceneRuleSetId: ids.sceneRuleSetId!, activityPolicyId: ids.activityPolicyId!, focusPolicyId: ids.focusPolicyId!, railPreferencesJson: "{}", revision: 1 },
    { kind: "document", ...meta(ids.documentId!), workId: ids.workId!, title: "1화", orderKey: "a", manuscriptId: ids.manuscriptId! },
    { kind: "blobManifest", blobRef: ids.blobRef!, checksumIdentity: "eum-studio-ledger-sha256-v1", checksumValue: ids.blobHash!, byteLength: 2, createdAt: now },
    { kind: "documentRevision", id: ids.documentRevisionId!, workId: ids.workId!, documentId: ids.documentId!, contentRef: ids.blobRef!, contentHash: ids.blobHash!, length: 2, cause: "test", createdAt: now, durableAt: now },
    { kind: "manuscript", id: ids.manuscriptId!, workId: ids.workId!, documentId: ids.documentId!, currentRevisionId: ids.documentRevisionId!, durableRevisionId: ids.documentRevisionId!, updatedAt: now },
  ];
  await ledger.transaction(async (transaction) => {
    for (const record of records) transaction.write(record);
  });
  ledger.close();
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
    database.prepare(`INSERT INTO assistant_context_receipts (
      id, schema_version, request_id, work_id, conversation_id, capability,
      destination_id, read_ranges_json, transmitted_ranges_json,
      read_character_count, transmitted_character_count, grant_ids_json, created_at
    ) VALUES (?, 1, ?, ?, ?, 'continuity.review', 'process', '[]', '[]', 2, 2, '[]', ?)`)
      .run(ids.contextReceiptId!, ids.contextRequestId!, ids.workId!, ids.conversationId!, now);
    database.prepare(`INSERT INTO assistant_continuity_review_candidates (
      id, schema_version, revision, created_at, updated_at, retired_at,
      request_id, work_id, source_document_id, source_document_revision_id,
      source_from, source_to, provider_id, model_id, prompt_version,
      context_receipt_id, status
    ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, ?, ?, 0, 2, 'process', 'process',
      'eum-continuity-review-v1', ?, 'ready')`)
      .run(ids.candidateId!, now, now, ids.continuityRequestId!, ids.workId!, ids.documentId!, ids.documentRevisionId!, ids.contextReceiptId!);
    database.prepare(`INSERT INTO assistant_continuity_review_items (
      id, schema_version, work_id, candidate_id, assertion_basis, thread_kind,
      title, note, subject_refs_json, reason, potential_duplicate_thread_ids_json,
      status, applied_thread_id, created_at, updated_at
    ) VALUES (?, 1, ?, ?, 'explicit-evidence', 'promise', '북문 약속', '', '[]',
      '직접 서술', '[]', 'pending', NULL, ?, ?)`)
      .run(ids.itemId!, ids.workId!, ids.candidateId!, now, now);
    database.prepare(`INSERT INTO assistant_continuity_review_evidence (
      id, schema_version, work_id, candidate_id, item_id, source_document_id,
      source_document_revision_id, source_from, source_to, exact_text,
      anchor_id, order_index
    ) VALUES (?, 1, ?, ?, ?, ?, ?, 0, 2, '윤서', NULL, 0)`)
      .run(ids.evidenceId!, ids.workId!, ids.candidateId!, ids.itemId!, ids.documentId!, ids.documentRevisionId!);
    database.exec("COMMIT");
  } finally {
    database.close();
  }
}

function readState(databasePath: string, ids: Record<string, string>) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const candidate = database.prepare("SELECT revision, status FROM assistant_continuity_review_candidates WHERE id = ?")
      .get(ids.candidateId!) as Record<string, unknown>;
    const item = database.prepare("SELECT status, applied_thread_id AS appliedThreadId FROM assistant_continuity_review_items WHERE id = ?")
      .get(ids.itemId!) as Record<string, unknown>;
    const candidateEvidence = database.prepare("SELECT anchor_id AS anchorId FROM assistant_continuity_review_evidence WHERE id = ?")
      .get(ids.evidenceId!) as Record<string, unknown>;
    const counts = database.prepare(`SELECT
      (SELECT COUNT(*) FROM continuity_threads) AS threads,
      (SELECT COUNT(*) FROM continuity_thread_history) AS history,
      (SELECT COUNT(*) FROM continuity_thread_evidence) AS evidence,
      (SELECT COUNT(*) FROM anchors) AS anchors,
      (SELECT COUNT(*) FROM assistant_continuity_review_decisions) AS decisions,
      (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations`)
      .get() as Record<string, unknown>;
    return { candidate, item, candidateEvidence, counts };
  } finally {
    database.close();
  }
}

function waitForMessage(child: ChildProcess, type: string, deadline: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), Math.max(1, deadline - Date.now()));
    const cleanup = () => {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    const onMessage = (message: unknown) => {
      if (typeof message === "object" && message !== null && Reflect.get(message, "type") === type) {
        cleanup();
        resolve();
      }
    };
    const onExit = () => {
      cleanup();
      reject(new Error(`Worker exited before ${type}`));
    };
    child.on("message", onMessage);
    child.on("exit", onExit);
  });
}

async function runAndKill(
  input: Record<string, string>,
  mode: "commit" | "rollback",
  deadline: number,
) {
  const child = spawn(process.execPath, ["-e", workerSource, JSON.stringify(input), mode], {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    windowsHide: true,
  });
  try {
    await waitForMessage(child, mode === "commit" ? "committed" : "transaction-open", deadline);
    const exit = once(child, "exit");
    expect(child.kill("SIGKILL")).toBe(true);
    await exit;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

describe("Continuity Candidate approval process termination", () => {
  it("reopens in a complete pre-commit or post-commit state", async () => {
    const deadline = Number(process.env.EUM_STUDIO_CONTINUITY_PROCESS_DEADLINE_EPOCH_MS);
    const artifactPath = process.env.EUM_STUDIO_CONTINUITY_PROCESS_ARTIFACT_PATH;
    if (!Number.isSafeInteger(deadline) || deadline <= Date.now()) {
      throw new Error("EUM_STUDIO_CONTINUITY_PROCESS_DEADLINE_EPOCH_MS must be a future safe integer");
    }
    if (artifactPath === undefined || artifactPath.length === 0) {
      throw new Error("EUM_STUDIO_CONTINUITY_PROCESS_ARTIFACT_PATH is required");
    }
    const root = await mkdtemp(path.join(tmpdir(), "eum-continuity-process-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const ids = Object.fromEntries([
      "studioId", "workId", "settingsId", "activityPolicyId", "focusPolicyId",
      "sceneRuleSetId", "documentId", "manuscriptId", "blobRef", "blobHash",
      "documentRevisionId", "contextReceiptId", "contextRequestId", "conversationId",
      "candidateId", "continuityRequestId", "itemId", "evidenceId", "threadId",
      "anchorId", "threadEvidenceId", "transitionId", "decisionId",
    ].map((key) => [key, randomUUID()])) as Record<string, string>;
    const workerInput = {
      ...ids,
      databasePath,
      decidedAt: "2026-08-29T06:01:00.000Z",
    };
    try {
      await seed(databasePath, ids);
      await runAndKill(workerInput, "rollback", deadline);
      const reopened = await openNodeSqliteLedger(profile(databasePath));
      reopened.close();
      const before = readState(databasePath, ids);
      expect(before).toEqual({
        candidate: { revision: 1, status: "ready" },
        item: { status: "pending", appliedThreadId: null },
        candidateEvidence: { anchorId: null },
        counts: { threads: 0, history: 0, evidence: 0, anchors: 0, decisions: 0, foreignKeyViolations: 0 },
      });

      await runAndKill(workerInput, "commit", deadline);
      const committed = await openNodeSqliteLedger(profile(databasePath));
      committed.close();
      const after = readState(databasePath, ids);
      expect(after).toEqual({
        candidate: { revision: 2, status: "completed" },
        item: { status: "approved", appliedThreadId: ids.threadId },
        candidateEvidence: { anchorId: ids.anchorId },
        counts: { threads: 1, history: 1, evidence: 1, anchors: 1, decisions: 1, foreignKeyViolations: 0 },
      });
      await mkdir(path.dirname(artifactPath), { recursive: true });
      await writeFile(artifactPath, `${JSON.stringify({
        schemaVersion: 1,
        scenario: "continuity-approval-process-kill",
        rollbackKillState: before,
        committedKillState: after,
      }, null, 2)}\n`, "utf8");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
