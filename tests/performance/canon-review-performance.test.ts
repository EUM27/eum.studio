import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parseCanonReviewModelPayload } from "../../src/application/canon/canon-review-model-output";
import {
  planCanonReviewItems,
  type CanonReviewSourceSnapshot,
} from "../../src/application/canon/canon-review-planner";
import { createLocalCanonService } from "../../src/desktop/canon/local-canon-runtime";
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
    documentCount: number;
    characterCount: number;
    loreEntryCount: number;
    candidateCount: number;
    plannerProposalCount: number;
  }>;
}>;

const now = "2026-08-29T03:00:00.000Z";

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
    targetSchemaVersion: 18,
  });
}

function meta(id: string) {
  return { id, schemaVersion: 18, revision: 1, createdAt: now, updatedAt: now } as const;
}

function percentile(values: readonly number[], ratio: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)] ?? 0;
}

describe("canon review Gate 1 performance", () => {
  it("records canonical search, 1000-Candidate projection, and planner timings", async () => {
    const profilePath = requiredPath("EUM_STUDIO_CANON_PERFORMANCE_PROFILE_PATH");
    const artifactPath = requiredPath("EUM_STUDIO_CANON_PERFORMANCE_ARTIFACT_PATH");
    const fixture = JSON.parse(await readFile(profilePath, "utf8")) as Profile;
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      fixtureUse: { measurementInputOnly: true, productLimit: false, userDefault: false },
    });
    const root = await mkdtemp(path.join(tmpdir(), "eum-canon-performance-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = "work-performance";
    const studioId = "studio-performance";
    const settingsId = "settings-performance";
    const activityPolicyId = "activity-performance";
    const focusPolicyId = "focus-performance";
    const sceneRuleSetId = "scene-rules-performance";
    let ledger = await openNodeSqliteLedger(storageProfile(databasePath));
    try {
      const records: Poc3LedgerRecord[] = [
        { kind: "studio", id: studioId, displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
        { kind: "work", ...meta(workId), studioId, title: "성능 측정", orderKey: "a", settingsId },
        { kind: "activityPolicy", ...meta(activityPolicyId), workId, idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
        { kind: "focusPolicy", ...meta(focusPolicyId), workId, phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
        { kind: "workSettings", id: settingsId, workId, sceneRuleSetId, activityPolicyId, focusPolicyId, railPreferencesJson: "{}", revision: 1 },
      ];
      for (let index = 0; index < fixture.measurement.documentCount; index += 1) {
        const documentId = `document-${index}`;
        const manuscriptId = `manuscript-${index}`;
        const revisionId = `revision-${index}`;
        const blobRef = `blob-${index}`;
        records.push(
          { kind: "document", ...meta(documentId), workId, title: `회차 ${index}`, orderKey: String(index).padStart(6, "0"), manuscriptId },
          { kind: "blobManifest", blobRef, checksumIdentity: "eum-studio-ledger-sha256-v1", checksumValue: `hash-${index}`, byteLength: 2, createdAt: now },
          { kind: "documentRevision", id: revisionId, workId, documentId, contentRef: blobRef, contentHash: `hash-${index}`, length: 2, cause: "measurement", createdAt: now, durableAt: now },
          { kind: "manuscript", id: manuscriptId, workId, documentId, currentRevisionId: revisionId, durableRevisionId: revisionId, updatedAt: now },
        );
      }
      for (let index = 0; index < fixture.measurement.characterCount; index += 1) {
        records.push({
          kind: "character",
          ...meta(`character-${index}`),
          workId,
          name: `인물 항목 ${String(index).padStart(4, "0")}`,
          aliases: [],
          role: "기록자",
          summary: "측정용 인물",
          appearance: "",
          personality: "",
          speech: "",
          goal: "",
          conflict: "",
          note: "",
        });
      }
      for (let index = 0; index < fixture.measurement.loreEntryCount; index += 1) {
        records.push({
          kind: "loreEntry",
          ...meta(`lore-${index}`),
          workId,
          title: `설정 항목 ${String(index).padStart(4, "0")}`,
          content: "측정용 설정",
          category: "측정",
          aliases: [],
          enabled: true,
        });
      }
      await ledger.transaction(async (transaction) => {
        for (const record of records) transaction.write(record);
      });
      ledger.close();

      const beforeCandidates = (await stat(databasePath)).size;
      const database = new DatabaseSync(databasePath);
      database.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
      try {
        const receiptId = "context-receipt-performance";
        database.prepare(`INSERT INTO assistant_context_receipts (
          id, schema_version, request_id, work_id, conversation_id, capability,
          destination_id, read_ranges_json, transmitted_ranges_json,
          read_character_count, transmitted_character_count, grant_ids_json, created_at
        ) VALUES (?, 1, ?, ?, ?, 'canon.review', 'performance', '[]', '[]', 2, 2, '[]', ?)`)
          .run(receiptId, "context-request-performance", workId, "conversation-performance", now);
        const candidate = database.prepare(`INSERT INTO assistant_canon_review_candidates (
          id, schema_version, revision, created_at, updated_at, retired_at,
          request_id, work_id, source_document_id, source_document_revision_id,
          source_from, source_to, provider_id, model_id, prompt_version,
          context_receipt_id, status
        ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, 'document-0', 'revision-0', 0, 2,
          'performance', 'performance', 'eum-canon-review-v1', ?, 'ready')`);
        const item = database.prepare(`INSERT INTO assistant_canon_review_items (
          id, schema_version, work_id, candidate_id, target_kind, operation,
          target_hint, target_id, matching_target_ids_json, expected_target_revision,
          assertion_basis, reason, status, applied_target_id, created_at, updated_at
        ) VALUES (?, 1, ?, ?, 'character', 'update', ?, ?, ?, 1,
          'explicit-evidence', '측정', 'pending', NULL, ?, ?)`);
        const field = database.prepare(`INSERT INTO assistant_canon_review_field_changes (
          work_id, candidate_id, item_id, field_name, before_json, after_json,
          selected, order_index
        ) VALUES (?, ?, ?, 'role', '"기록자"', '"정식 기록자"', 1, 0)`);
        const evidence = database.prepare(`INSERT INTO assistant_canon_review_evidence (
          id, schema_version, work_id, candidate_id, item_id, source_document_id,
          source_document_revision_id, source_from, source_to, exact_text,
          anchor_id, order_index
        ) VALUES (?, 1, ?, ?, ?, 'document-0', 'revision-0', 0, 2, '측정', NULL, 0)`);
        for (let index = 0; index < fixture.measurement.candidateCount; index += 1) {
          const candidateId = `candidate-${index}`;
          const itemId = `item-${index}`;
          const targetId = `character-${index % fixture.measurement.characterCount}`;
          candidate.run(candidateId, now, now, `canon-request-${index}`, workId, receiptId);
          item.run(itemId, workId, candidateId, `인물 ${index}`, targetId, JSON.stringify([targetId]), now, now);
          field.run(workId, candidateId, itemId);
          evidence.run(`evidence-${index}`, workId, candidateId, itemId);
        }
        database.exec("COMMIT");
      } catch (reason) {
        if (database.isTransaction) database.exec("ROLLBACK");
        database.close();
        throw reason;
      }
      database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      const afterCandidates = (await stat(databasePath)).size;
      ledger = await openNodeSqliteLedger(storageProfile(databasePath));
      const service = createLocalCanonService({
        database,
        ledger,
        schemaVersion: 18,
        anchorPolicy: Object.freeze({}) as never,
        describeAnchorEvidence: (() => {
          throw new Error("not used by list measurement");
        }) as never,
        getDocument: () => undefined,
        authorizeContext: (() => {
          throw new Error("not used by list measurement");
        }) as never,
      });
      const search = database.prepare(`
        SELECT id, name AS label FROM characters
        WHERE work_id = ? AND retired_at IS NULL AND (name LIKE ? OR summary LIKE ?)
        UNION ALL
        SELECT id, title AS label FROM lore_entries
        WHERE work_id = ? AND retired_at IS NULL AND (title LIKE ? OR content LIKE ?)
      `);
      const sourceRange = Object.freeze({
        documentId: entityId<"Document">("document-0"),
        documentRevisionId: entityId<"DocumentRevision">("revision-0"),
        from: 0,
        to: fixture.measurement.plannerProposalCount * 8,
      });
      const plannerSources: readonly CanonReviewSourceSnapshot[] = Object.freeze(
        Array.from({ length: fixture.measurement.plannerProposalCount }, (_, index) => Object.freeze({
          kind: "character" as const,
          id: `planner-character-${index}`,
          revision: 1,
          workId,
          retiredAt: null,
          fields: Object.freeze({
            name: `[C${String(index).padStart(4, "0")}]`, aliases: Object.freeze([]), role: "기록자",
            summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "",
          }),
        })),
      );
      const manuscript = plannerSources.map((source) =>
        source.kind === "character" ? source.fields.name : ""
      ).join(" ");
      const payload = parseCanonReviewModelPayload({
        proposals: plannerSources.map((source) => ({
          targetKind: "character",
          targetHint: source.kind === "character" ? source.fields.name : source.id,
          operationHint: "update",
          assertionBasis: "explicit-evidence",
          reason: "측정",
          fields: { role: "정식 기록자" },
          evidence: [{ paragraphId: "p1", quote: source.kind === "character" ? source.fields.name : source.id }],
        })),
      });
      const timings = {
        canonicalSearchMs: [] as number[],
        candidateProjectionMs: [] as number[],
        plannerMs: [] as number[],
      };
      for (let iteration = 0; iteration < fixture.measurement.iterationCount; iteration += 1) {
        let started = performance.now();
        const searchRows = search.all(workId, "%항목%", "%항목%", workId, "%항목%", "%항목%");
        timings.canonicalSearchMs.push(performance.now() - started);
        expect(searchRows).toHaveLength(
          fixture.measurement.characterCount + fixture.measurement.loreEntryCount,
        );

        started = performance.now();
        const candidates = service.list({ schemaVersion: 1, workId: entityId<"Work">(workId), status: "all" });
        timings.candidateProjectionMs.push(performance.now() - started);
        expect(candidates.candidates).toHaveLength(fixture.measurement.candidateCount);

        let itemSequence = 0;
        let evidenceSequence = 0;
        started = performance.now();
        const planned = planCanonReviewItems({
          workId,
          sourceRange,
          manuscript,
          payload,
          sources: plannerSources,
          pendingFieldChanges: [],
          itemIdFactory: { create: () => `planned-item-${iteration}-${itemSequence++}` },
          evidenceIdFactory: { create: () => `planned-evidence-${iteration}-${evidenceSequence++}` },
        });
        timings.plannerMs.push(performance.now() - started);
        expect(planned).toHaveLength(fixture.measurement.plannerProposalCount);
      }
      const summary = Object.fromEntries(Object.entries(timings).map(([name, values]) => [name, {
        raw: values,
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
      }]));
      const report = {
        schemaVersion: 1,
        fixtureUse: fixture.fixtureUse,
        environment: { platform: process.platform, architecture: process.arch, node: process.version },
        rowCounts: {
          documents: fixture.measurement.documentCount,
          characters: fixture.measurement.characterCount,
          loreEntries: fixture.measurement.loreEntryCount,
          candidates: fixture.measurement.candidateCount,
          candidateItems: fixture.measurement.candidateCount,
          plannerProposals: fixture.measurement.plannerProposalCount,
        },
        databaseBytes: { beforeCandidates, afterCandidates, growth: afterCandidates - beforeCandidates },
        timings: summary,
        rendererCommitCount: { measured: false, value: null, reason: "storage-and-application-harness" },
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
