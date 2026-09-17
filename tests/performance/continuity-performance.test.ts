import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parseContinuityReviewModelPayload } from "../../src/application/continuity/continuity-review-model-output";
import { planContinuityReviewItems } from "../../src/application/continuity/continuity-review-planner";
import { createLocalContinuityService } from "../../src/desktop/continuity/local-continuity-runtime";
import type { Poc3LedgerRecord } from "../../src/domain/poc-3-storage-ledger";
import { entityId } from "../../src/domain/writing";
import { openNodeSqliteLedger } from "../../src/platform/storage/node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "../../src/platform/storage/node-sqlite-ledger-profile";

type Profile = Readonly<{
  schemaVersion: 1;
  fixtureUse: Readonly<{
    measurementInputOnly: true;
    productLimit: false;
    userDefault: false;
  }>;
  measurement: Readonly<{
    iterationCount: number;
    threadCount: number;
    candidateCount: number;
    plannerProposalCount: number;
  }>;
}>;

const now = "2026-08-29T07:00:00.000Z";

function requiredPath(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return path.resolve(value);
}

function storageProfile(databasePath: string) {
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

function percentile(values: readonly number[], ratio: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)] ?? 0;
}

describe("Continuity Gate 2 performance", () => {
  it("measures 1,000 Threads, 1,000 Candidates, and deterministic planning", async () => {
    const profilePath = requiredPath("EUM_STUDIO_CONTINUITY_PERFORMANCE_PROFILE_PATH");
    const artifactPath = requiredPath("EUM_STUDIO_CONTINUITY_PERFORMANCE_ARTIFACT_PATH");
    const fixture = JSON.parse(await readFile(profilePath, "utf8")) as Profile;
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      fixtureUse: { measurementInputOnly: true, productLimit: false, userDefault: false },
      measurement: { threadCount: 1000, candidateCount: 1000 },
    });
    const root = await mkdtemp(path.join(tmpdir(), "eum-continuity-performance-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = "work-performance";
    let ledger = await openNodeSqliteLedger(storageProfile(databasePath));
    try {
      const records: Poc3LedgerRecord[] = [
        { kind: "studio", id: "studio-performance", displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
        { kind: "work", ...meta(workId), studioId: "studio-performance", title: "성능 측정", orderKey: "a", settingsId: "settings-performance" },
        { kind: "activityPolicy", ...meta("activity-performance"), workId, idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
        { kind: "focusPolicy", ...meta("focus-performance"), workId, phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
        { kind: "workSettings", id: "settings-performance", workId, sceneRuleSetId: "scene-rules-performance", activityPolicyId: "activity-performance", focusPolicyId: "focus-performance", railPreferencesJson: "{}", revision: 1 },
        { kind: "document", ...meta("document-performance"), workId, title: "측정 회차", orderKey: "a", manuscriptId: "manuscript-performance" },
        { kind: "blobManifest", blobRef: "blob-performance", checksumIdentity: "eum-studio-ledger-sha256-v1", checksumValue: "hash-performance", byteLength: 2, createdAt: now },
        { kind: "documentRevision", id: "revision-performance", workId, documentId: "document-performance", contentRef: "blob-performance", contentHash: "hash-performance", length: 2, cause: "measurement", createdAt: now, durableAt: now },
        { kind: "manuscript", id: "manuscript-performance", workId, documentId: "document-performance", currentRevisionId: "revision-performance", durableRevisionId: "revision-performance", updatedAt: now },
      ];
      await ledger.transaction(async (transaction) => {
        for (const record of records) transaction.write(record);
      });
      ledger.close();
      const beforeRows = (await stat(databasePath)).size;
      const database = new DatabaseSync(databasePath);
      database.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
      try {
        database.prepare(`INSERT INTO assistant_context_receipts (
          id, schema_version, request_id, work_id, conversation_id, capability,
          destination_id, read_ranges_json, transmitted_ranges_json,
          read_character_count, transmitted_character_count, grant_ids_json, created_at
        ) VALUES ('receipt-performance', 1, 'request-performance', ?, 'conversation-performance',
          'continuity.review', 'performance', '[]', '[]', 2, 2, '[]', ?)`)
          .run(workId, now);
        const thread = database.prepare(`INSERT INTO continuity_threads (
          id, schema_version, revision, created_at, updated_at, work_id,
          kind, title, note, status, opened_at, resolved_at
        ) VALUES (?, 1, 1, ?, ?, ?, 'promise', ?, '', 'open', ?, NULL)`);
        const history = database.prepare(`INSERT INTO continuity_thread_history (
          id, schema_version, work_id, thread_id, transition_kind,
          revision_before, revision_after, resolution_mode, reason,
          evidence_anchor_ids_json, created_at
        ) VALUES (?, 1, ?, ?, 'created', NULL, 1, NULL, '', '[]', ?)`);
        for (let index = 0; index < fixture.measurement.threadCount; index += 1) {
          const threadId = `thread-${index}`;
          thread.run(threadId, now, now, workId, `연속성 ${String(index).padStart(4, "0")}`, now);
          history.run(`history-${index}`, workId, threadId, now);
        }
        const candidate = database.prepare(`INSERT INTO assistant_continuity_review_candidates (
          id, schema_version, revision, created_at, updated_at, retired_at,
          request_id, work_id, source_document_id, source_document_revision_id,
          source_from, source_to, provider_id, model_id, prompt_version,
          context_receipt_id, status
        ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, 'document-performance',
          'revision-performance', 0, 2, 'performance', 'performance',
          'eum-continuity-review-v1', 'receipt-performance', 'ready')`);
        const item = database.prepare(`INSERT INTO assistant_continuity_review_items (
          id, schema_version, work_id, candidate_id, assertion_basis, thread_kind,
          title, note, subject_refs_json, reason, potential_duplicate_thread_ids_json,
          status, applied_thread_id, created_at, updated_at
        ) VALUES (?, 1, ?, ?, 'explicit-evidence', 'open-question', ?, '', '[]',
          '측정', '[]', 'pending', NULL, ?, ?)`);
        const evidence = database.prepare(`INSERT INTO assistant_continuity_review_evidence (
          id, schema_version, work_id, candidate_id, item_id, source_document_id,
          source_document_revision_id, source_from, source_to, exact_text,
          anchor_id, order_index
        ) VALUES (?, 1, ?, ?, ?, 'document-performance', 'revision-performance',
          0, 2, '측정', NULL, 0)`);
        for (let index = 0; index < fixture.measurement.candidateCount; index += 1) {
          const candidateId = `candidate-${index}`;
          const itemId = `item-${index}`;
          candidate.run(candidateId, now, now, `candidate-request-${index}`, workId);
          item.run(itemId, workId, candidateId, `질문 ${String(index).padStart(4, "0")}`, now, now);
          evidence.run(`candidate-evidence-${index}`, workId, candidateId, itemId);
        }
        database.exec("COMMIT");
      } catch (reason) {
        if (database.isTransaction) database.exec("ROLLBACK");
        database.close();
        throw reason;
      }
      database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      const afterRows = (await stat(databasePath)).size;
      ledger = await openNodeSqliteLedger(storageProfile(databasePath));
      const service = createLocalContinuityService({
        database,
        ledger,
        schemaVersion: 19,
        anchorPolicy: Object.freeze({}) as never,
        describeAnchorEvidence: (() => {
          throw new Error("not used by projection measurement");
        }) as never,
        getDocument: () => undefined,
        authorizeContext: (() => {
          throw new Error("not used by projection measurement");
        }) as never,
      });
      const tokens = Array.from(
        { length: fixture.measurement.plannerProposalCount },
        (_, index) => `[Q${String(index).padStart(4, "0")}]`,
      );
      const manuscript = tokens.join(" ");
      const paragraphs = Object.freeze([Object.freeze({
        paragraphId: "p1",
        text: manuscript,
        from: 0,
        to: manuscript.length,
      })]);
      const payload = parseContinuityReviewModelPayload({
        proposals: tokens.map((token) => ({
          assertionBasis: "explicit-evidence",
          kind: "open-question",
          title: `질문 ${token}`,
          note: "",
          subjectRefs: [],
          reason: "측정",
          evidence: [{ paragraphId: "p1", quote: token }],
        })),
      });
      const sourceRange = Object.freeze({
        documentId: entityId<"Document">("document-performance"),
        documentRevisionId: entityId<"DocumentRevision">("revision-performance"),
        from: 0,
        to: manuscript.length,
      });
      const timings = {
        threadProjectionMs: [] as number[],
        candidateProjectionMs: [] as number[],
        plannerMs: [] as number[],
      };
      for (let iteration = 0; iteration < fixture.measurement.iterationCount; iteration += 1) {
        let started = performance.now();
        const overview = await service.list({
          schemaVersion: 1,
          workId: entityId<"Work">(workId),
          status: "all",
        });
        timings.threadProjectionMs.push(performance.now() - started);
        expect(overview.threads).toHaveLength(fixture.measurement.threadCount);

        started = performance.now();
        const candidates = service.listCandidates({
          schemaVersion: 1,
          workId: entityId<"Work">(workId),
          status: "all",
        });
        timings.candidateProjectionMs.push(performance.now() - started);
        expect(candidates.candidates).toHaveLength(fixture.measurement.candidateCount);

        let itemIndex = 0;
        let evidenceIndex = 0;
        started = performance.now();
        const planned = planContinuityReviewItems({
          proposals: payload.proposals,
          paragraphs,
          sourceRange,
          allowedSubjectRefs: [],
          activeThreads: [],
          pendingItems: [],
          itemIdFactory: { create: () => `planned-item-${iteration}-${itemIndex++}` },
          evidenceIdFactory: { create: () => `planned-evidence-${iteration}-${evidenceIndex++}` },
        });
        timings.plannerMs.push(performance.now() - started);
        expect(planned).toHaveLength(fixture.measurement.plannerProposalCount);
      }
      const report = {
        schemaVersion: 1,
        fixtureUse: fixture.fixtureUse,
        environment: { platform: process.platform, architecture: process.arch, node: process.version },
        rowCounts: {
          threads: fixture.measurement.threadCount,
          history: fixture.measurement.threadCount,
          candidates: fixture.measurement.candidateCount,
          candidateItems: fixture.measurement.candidateCount,
          plannerProposals: fixture.measurement.plannerProposalCount,
        },
        databaseBytes: { beforeRows, afterRows, growth: afterRows - beforeRows },
        timings: Object.fromEntries(Object.entries(timings).map(([name, values]) => [name, {
          raw: values,
          p50: percentile(values, 0.5),
          p95: percentile(values, 0.95),
        }])),
        rendererCommitCount: {
          measured: false,
          value: null,
          reason: "storage-and-application-harness",
        },
      };
      await mkdir(path.dirname(artifactPath), { recursive: true });
      await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      expect(JSON.parse(await readFile(artifactPath, "utf8"))).toEqual(report);
      database.close();
    } finally {
      ledger.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
