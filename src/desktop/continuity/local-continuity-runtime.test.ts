import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import type { AssistantContextRange } from "../../application/assistant/assistant-context-permission";
import type {
  ContinuityReviewConnectorInput,
  ContinuityReviewExecution,
} from "../../application/continuity/continuity-review-model-output";
import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../platform/storage/node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "../../platform/storage/node-sqlite-ledger-profile";
import {
  createLocalContinuityService,
  type ContinuityDocumentTarget,
  type LocalContinuityService,
} from "./local-continuity-runtime";

const baseInstant = "2026-08-29T00:00:00.000Z";
const manuscript = "윤서는 북문에서 다시 만나자고 약속했다.";
const sourceRange = Object.freeze({
  documentId: "document-1" as never,
  documentRevisionId: "revision-1" as never,
  from: 0,
  to: manuscript.length,
}) satisfies AssistantContextRange;

function meta(id: string, workSchemaVersion = 19) {
  return {
    id,
    schemaVersion: workSchemaVersion,
    revision: 1,
    createdAt: baseInstant,
    updatedAt: baseInstant,
  } as const;
}

function workspaceRecords(): readonly Poc3LedgerRecord[] {
  return [
    {
      kind: "studio",
      id: "studio-1",
      displayName: "이음",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      settingsRevision: 1,
      createdAt: baseInstant,
    },
    {
      kind: "work",
      ...meta("work-1"),
      studioId: "studio-1",
      title: "작품",
      orderKey: "a",
      settingsId: "settings-1",
    },
    {
      kind: "activityPolicy",
      ...meta("activity-1"),
      workId: "work-1",
      idleTimeout: 1,
      navigationGrace: 1,
      hiddenWindowPolicy: "pause",
      activityClassRulesJson: "{}",
      autoStartEnabled: false,
      autoResumeFromIdle: false,
      recoveryPolicy: "manual",
    },
    {
      kind: "focusPolicy",
      ...meta("focus-1"),
      workId: "work-1",
      phaseDefinitionsJson: "[]",
      backgroundPolicy: "pause",
      musicStartPolicy: "manual",
      completionPolicy: "manual",
      visibility: "work",
    },
    {
      kind: "workSettings",
      id: "settings-1",
      workId: "work-1",
      sceneRuleSetId: "scene-rules-1",
      activityPolicyId: "activity-1",
      focusPolicyId: "focus-1",
      railPreferencesJson: "{}",
      revision: 1,
    },
    {
      kind: "character",
      ...meta("character-1"),
      workId: "work-1",
      name: "윤서",
      aliases: [],
      role: "기록관",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "잃어버린 기록을 되찾는다",
      conflict: "",
      note: "",
    },
    {
      kind: "plotThread",
      ...meta("plot-1"),
      workId: "work-1",
      title: "북문으로 향하기",
      stage: "planned",
      summary: "북문에 도착한다.",
      note: "",
    },
    {
      kind: "foreshadowLine",
      ...meta("foreshadow-1"),
      workId: "work-1",
      title: "잠긴 문",
      note: "열쇠의 주인을 밝힌다.",
    },
    {
      kind: "document",
      ...meta("document-1"),
      workId: "work-1",
      title: "1화",
      orderKey: "a",
      manuscriptId: "manuscript-1",
    },
    {
      kind: "blobManifest",
      blobRef: "blob-1",
      checksumIdentity: "eum-studio-ledger-sha256-v1",
      checksumValue: "hash-1",
      byteLength: Buffer.byteLength(manuscript),
      createdAt: baseInstant,
    },
    {
      kind: "documentRevision",
      id: "revision-1",
      workId: "work-1",
      documentId: "document-1",
      contentRef: "blob-1",
      contentHash: "hash-1",
      length: manuscript.length,
      cause: "test",
      createdAt: baseInstant,
      durableAt: baseInstant,
    },
    {
      kind: "manuscript",
      id: "manuscript-1",
      workId: "work-1",
      documentId: "document-1",
      currentRevisionId: "revision-1",
      durableRevisionId: "revision-1",
      updatedAt: baseInstant,
    },
    {
      kind: "work",
      ...meta("work-2"),
      studioId: "studio-1",
      title: "다른 작품",
      orderKey: "b",
      settingsId: "settings-2",
    },
    {
      kind: "activityPolicy",
      ...meta("activity-2"),
      workId: "work-2",
      idleTimeout: 1,
      navigationGrace: 1,
      hiddenWindowPolicy: "pause",
      activityClassRulesJson: "{}",
      autoStartEnabled: false,
      autoResumeFromIdle: false,
      recoveryPolicy: "manual",
    },
    {
      kind: "focusPolicy",
      ...meta("focus-2"),
      workId: "work-2",
      phaseDefinitionsJson: "[]",
      backgroundPolicy: "pause",
      musicStartPolicy: "manual",
      completionPolicy: "manual",
      visibility: "work",
    },
    {
      kind: "workSettings",
      id: "settings-2",
      workId: "work-2",
      sceneRuleSetId: "scene-rules-2",
      activityPolicyId: "activity-2",
      focusPolicyId: "focus-2",
      railPreferencesJson: "{}",
      revision: 1,
    },
    {
      kind: "character",
      ...meta("character-outside"),
      workId: "work-2",
      name: "외부 인물",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
    },
  ];
}

type Fixture = {
  readonly root: string;
  readonly database: DatabaseSync;
  readonly ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  readonly documents: Map<string, ContinuityDocumentTarget>;
  readonly service: LocalContinuityService;
  readonly setExecution: (next: ContinuityReviewExecution) => void;
  readonly getConnectorInput: () => ContinuityReviewConnectorInput | null;
};
const fixtures: Fixture[] = [];

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "eum-continuity-service-"));
  const databasePath = path.join(root, "workspace.sqlite3");
  const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: {
        applySql: "PRAGMA journal_mode = WAL",
        verifySql: "PRAGMA journal_mode",
        expectedRows: [{ journal_mode: "wal" }],
      },
      synchronous: {
        applySql: "PRAGMA synchronous = FULL",
        verifySql: "PRAGMA synchronous",
        expectedRows: [{ synchronous: 2 }],
      },
      foreignKeys: {
        applySql: "PRAGMA foreign_keys = ON",
        verifySql: "PRAGMA foreign_keys",
        expectedRows: [{ foreign_keys: 1 }],
      },
    },
    targetSchemaVersion: 19,
  }));
  await ledger.transaction(async (transaction) => {
    for (const record of workspaceRecords()) transaction.write(record);
  });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.prepare(`
    INSERT INTO assistant_context_receipts (
      id, schema_version, request_id, work_id, conversation_id,
      capability, destination_id, read_ranges_json, transmitted_ranges_json,
      read_character_count, transmitted_character_count, grant_ids_json, created_at
    ) VALUES (?, 1, ?, ?, ?, 'continuity.review', ?, ?, ?, ?, ?, '[]', ?)
  `).run(
    "receipt-1",
    "context-request-1",
    "work-1",
    "conversation-1",
    "connector-1",
    JSON.stringify([sourceRange]),
    JSON.stringify([sourceRange]),
    manuscript.length,
    manuscript.length,
    baseInstant,
  );
  const documents = new Map<string, ContinuityDocumentTarget>([[
    "document-1",
    Object.freeze({
      workId: "work-1" as never,
      documentId: "document-1" as never,
      currentRevisionId: "revision-1" as never,
      text: manuscript,
    }),
  ]]);
  let execution: ContinuityReviewExecution = Object.freeze({
    providerId: "provider-1",
    modelId: "model-1",
    promptVersion: "eum-continuity-review-v1",
    payload: Object.freeze({ proposals: Object.freeze([]) }),
  });
  let connectorInput: ContinuityReviewConnectorInput | null = null;
  let idIndex = 0;
  let instantIndex = 0;
  const service = createLocalContinuityService({
    database,
    ledger,
    schemaVersion: 19,
    anchorPolicy: {
      schemaVersion: 1,
      version: "test-anchor-v1",
      contextOffsetLength: 8,
    },
    describeAnchorEvidence: createNodeCryptoAnchorEvidenceDescriptor("sha256"),
    getDocument: (documentId) => documents.get(documentId),
    authorizeContext: (request) => Object.freeze({
      allowed: true,
      receipt: Object.freeze({
        schemaVersion: 1,
        receiptId: "receipt-1" as never,
        requestId: request.requestId,
        workId: request.workId,
        conversationId: request.conversationId,
        capability: request.capability,
        destinationId: request.destinationId,
        readRanges: request.readRanges,
        transmittedRanges: request.transmittedRanges,
        readCharacterCount: manuscript.length,
        transmittedCharacterCount: manuscript.length,
        grantIds: Object.freeze([]),
        createdAt: baseInstant,
      }),
    }),
    connector: {
      destinationId: "connector-1",
      isConnected: () => true,
      execute: async (input) => {
        connectorInput = input;
        return execution;
      },
    },
    createId: () => `generated-${++idIndex}`,
    now: () => new Date(Date.parse(baseInstant) + (++instantIndex * 1000)).toISOString(),
  });
  const fixture = {
    root,
    database,
    ledger,
    documents,
    service,
    setExecution(next: ContinuityReviewExecution) {
      execution = next;
    },
    getConnectorInput() {
      return connectorInput;
    },
  };
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    fixture.database.close();
    fixture.ledger.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

function createCommand(title: string, withEvidence = true) {
  return Object.freeze({
    schemaVersion: 1 as const,
    workId: "work-1" as never,
    kind: "promise" as const,
    title,
    note: "다음 회차에서 확인",
    subjectRefs: Object.freeze([{
      kind: "character" as const,
      id: "character-1" as never,
    }]),
    openedEvidenceRange: withEvidence
      ? Object.freeze({ ...sourceRange, from: 0, to: 2 })
      : null,
  });
}

function reviewCommand(requestId: string) {
  return Object.freeze({
    schemaVersion: 1 as const,
    requestId: requestId as never,
    workId: "work-1" as never,
    conversationId: "conversation-1" as never,
    sourceRange,
  });
}

function proposalExecution(title = "북문에서 다시 만나기"): ContinuityReviewExecution {
  return Object.freeze({
    providerId: "provider-1",
    modelId: "model-1",
    promptVersion: "eum-continuity-review-v1",
    payload: Object.freeze({
      proposals: Object.freeze([Object.freeze({
        assertionBasis: "explicit-evidence" as const,
        kind: "promise" as const,
        title,
        note: "다음 회차에서 확인",
        subjectRefs: Object.freeze([{
          kind: "character" as const,
          id: "character-1" as never,
        }]),
        reason: "약속이 직접 서술됨",
        evidence: Object.freeze([Object.freeze({
          paragraphId: "p1",
          quote: "다시 만나자",
        })]),
      })]),
    }),
  });
}

describe("LocalContinuityService", () => {
  it("persists manual CRUD/evidence/history and projects existing sources without copying them", async () => {
    const fixture = await createFixture();
    const created = await fixture.service.create(createCommand("북문 약속"));
    expect(created).toMatchObject({
      revision: 1,
      status: "open",
      openedEvidence: [{ exactText: "윤서", integrity: "resolved" }],
      history: [{ kind: "created", revisionAfter: 1 }],
    });

    const updated = await fixture.service.update({
      schemaVersion: 1,
      workId: created.workId,
      threadId: created.threadId,
      expectedRevision: created.revision,
      kind: "promise",
      title: "수정된 북문 약속",
      note: "직접 수정",
      subjectRefs: created.subjectRefs,
    });
    const resolved = await fixture.service.resolve({
      schemaVersion: 1,
      workId: updated.workId,
      threadId: updated.threadId,
      expectedRevision: updated.revision,
      resolutionMode: "manual",
      resolutionEvidenceRange: null,
      reason: "사용자가 직접 확인함",
    });
    expect(resolved).toMatchObject({
      revision: 3,
      status: "resolved",
      resolutionEvidence: [],
      history: [
        { kind: "created" },
        { kind: "updated" },
        { kind: "resolved", resolutionMode: "manual" },
      ],
    });

    const evidenceThread = await fixture.service.create(
      createCommand("열쇠 확인", false),
    );
    const evidenceResolved = await fixture.service.resolve({
      schemaVersion: 1,
      workId: evidenceThread.workId,
      threadId: evidenceThread.threadId,
      expectedRevision: evidenceThread.revision,
      resolutionMode: "evidence",
      resolutionEvidenceRange: Object.freeze({ ...sourceRange, from: 2, to: 4 }),
      reason: "근거로 해결",
    });
    expect(evidenceResolved.resolutionEvidence).toMatchObject([
      { exactText: "는 ", integrity: "resolved" },
    ]);

    const dismissedSource = await fixture.service.create(
      createCommand("dismiss 대상", false),
    );
    const dismissed = await fixture.service.dismiss({
      schemaVersion: 1,
      workId: dismissedSource.workId,
      threadId: dismissedSource.threadId,
      expectedRevision: dismissedSource.revision,
      reason: "더는 추적하지 않음",
    });
    expect(dismissed).toMatchObject({ status: "dismissed" });

    const overview = await fixture.service.list({
      schemaVersion: 1,
      workId: "work-1" as never,
      status: "all",
    });
    expect(overview.projectedSources.map((entry) => entry.sourceKind)).toEqual([
      "plot-thread",
      "foreshadow-line",
      "character-goal",
    ]);
    expect(fixture.database.prepare(
      "SELECT COUNT(*) AS count FROM continuity_threads",
    ).get()).toEqual({ count: 3 });

    await expect(fixture.service.create({
      ...createCommand("다른 작품 참조", false),
      subjectRefs: [{ kind: "character", id: "character-outside" as never }],
    })).rejects.toThrow(/outside Work/u);
    expect(fixture.database.prepare(
      "SELECT COUNT(*) AS count FROM continuity_threads",
    ).get()).toEqual({ count: 3 });
  });

  it("keeps AI output as an editable Candidate and requires current duplicate acknowledgement", async () => {
    const fixture = await createFixture();
    fixture.setExecution(proposalExecution());
    const prepared = fixture.service.prepareReview(reviewCommand("review-1"));
    expect("result" in prepared).toBe(false);
    if ("result" in prepared) throw new Error("expected prepared review");
    const result = await fixture.service.recordReview(prepared, await prepared.execute());
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") throw new Error("expected Candidate");
    expect(fixture.getConnectorInput()).toMatchObject({
      requestedRange: sourceRange,
      paragraphs: [{ paragraphId: "p1", text: manuscript }],
      subjectReferences: [{ entity: { kind: "character", id: "character-1" } }],
    });
    expect(fixture.database.prepare(
      "SELECT COUNT(*) AS count FROM continuity_threads",
    ).get()).toEqual({ count: 0 });

    const edited = await fixture.service.updateItem({
      schemaVersion: 1,
      workId: result.candidate.workId,
      candidateId: result.candidate.candidateId,
      expectedCandidateRevision: result.candidate.revision,
      itemId: result.candidate.items[0]!.itemId,
      draft: {
        ...result.candidate.items[0]!.draft,
        note: "사용자 편집 메모",
      },
    });
    const duplicate = await fixture.service.create(createCommand(
      result.candidate.items[0]!.draft.title,
      false,
    ));
    const guarded = await fixture.service.decide({
      schemaVersion: 1,
      workId: edited.workId,
      candidateId: edited.candidateId,
      expectedCandidateRevision: edited.revision,
      itemId: edited.items[0]!.itemId,
      decision: "approve",
      acknowledgedDuplicateThreadIds: [],
    });
    expect(guarded).toMatchObject({
      status: "duplicate-review-required",
      missingDuplicateThreadIds: [duplicate.threadId],
    });
    const applied = await fixture.service.decide({
      schemaVersion: 1,
      workId: edited.workId,
      candidateId: edited.candidateId,
      expectedCandidateRevision: edited.revision,
      itemId: edited.items[0]!.itemId,
      decision: "approve",
      acknowledgedDuplicateThreadIds: [duplicate.threadId],
    });
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied") throw new Error("expected approval");
    expect(applied.receipt.threadId).not.toBe(duplicate.threadId);
    expect(applied.candidate.items[0]).toMatchObject({
      status: "approved",
      draft: { note: "사용자 편집 메모" },
      evidence: [{ anchorId: expect.any(String) }],
    });
  });

  it("records no-change, rejection, and source-stale outcomes without canonical writes", async () => {
    const fixture = await createFixture();
    const emptyPrepared = fixture.service.prepareReview(reviewCommand("review-empty"));
    if ("result" in emptyPrepared) throw new Error("expected prepared review");
    expect(await fixture.service.recordReview(
      emptyPrepared,
      await emptyPrepared.execute(),
    )).toEqual({ schemaVersion: 1, status: "no-change" });

    fixture.setExecution(proposalExecution("거절할 제안"));
    const rejectPrepared = fixture.service.prepareReview(reviewCommand("review-reject"));
    if ("result" in rejectPrepared) throw new Error("expected prepared review");
    const rejectCandidate = await fixture.service.recordReview(
      rejectPrepared,
      await rejectPrepared.execute(),
    );
    if (rejectCandidate.status !== "candidate") throw new Error("expected Candidate");
    const rejected = await fixture.service.decide({
      schemaVersion: 1,
      workId: rejectCandidate.candidate.workId,
      candidateId: rejectCandidate.candidate.candidateId,
      expectedCandidateRevision: rejectCandidate.candidate.revision,
      itemId: rejectCandidate.candidate.items[0]!.itemId,
      decision: "reject",
      acknowledgedDuplicateThreadIds: [],
    });
    expect(rejected.status).toBe("rejected");

    fixture.setExecution(proposalExecution("stale 제안"));
    const stalePrepared = fixture.service.prepareReview(reviewCommand("review-stale"));
    if ("result" in stalePrepared) throw new Error("expected prepared review");
    const staleCandidate = await fixture.service.recordReview(
      stalePrepared,
      await stalePrepared.execute(),
    );
    if (staleCandidate.status !== "candidate") throw new Error("expected Candidate");
    fixture.documents.set("document-1", Object.freeze({
      ...fixture.documents.get("document-1")!,
      currentRevisionId: "revision-changed" as never,
      text: `${manuscript} 변경`,
    }));
    const stale = await fixture.service.decide({
      schemaVersion: 1,
      workId: staleCandidate.candidate.workId,
      candidateId: staleCandidate.candidate.candidateId,
      expectedCandidateRevision: staleCandidate.candidate.revision,
      itemId: staleCandidate.candidate.items[0]!.itemId,
      decision: "approve",
      acknowledgedDuplicateThreadIds: [],
    });
    expect(stale).toMatchObject({ status: "source-stale", candidate: { status: "stale" } });
    expect(fixture.database.prepare(
      "SELECT COUNT(*) AS count FROM continuity_threads",
    ).get()).toEqual({ count: 0 });
  });

  it("rolls back the Thread, Anchor, evidence, and Candidate decision together", async () => {
    const fixture = await createFixture();
    fixture.setExecution(proposalExecution("롤백 제안"));
    const prepared = fixture.service.prepareReview(reviewCommand("review-rollback"));
    if ("result" in prepared) throw new Error("expected prepared review");
    const candidate = await fixture.service.recordReview(prepared, await prepared.execute());
    if (candidate.status !== "candidate") throw new Error("expected Candidate");
    fixture.database.exec(`
      CREATE TRIGGER continuity_test_abort_decision
      BEFORE INSERT ON assistant_continuity_review_decisions
      BEGIN
        SELECT RAISE(ABORT, 'forced decision failure');
      END
    `);
    await expect(fixture.service.decide({
      schemaVersion: 1,
      workId: candidate.candidate.workId,
      candidateId: candidate.candidate.candidateId,
      expectedCandidateRevision: candidate.candidate.revision,
      itemId: candidate.candidate.items[0]!.itemId,
      decision: "approve",
      acknowledgedDuplicateThreadIds: [],
    })).rejects.toThrow(/forced decision failure/u);
    expect(fixture.database.prepare(
      "SELECT COUNT(*) AS count FROM continuity_threads",
    ).get()).toEqual({ count: 0 });
    expect(fixture.database.prepare(
      "SELECT COUNT(*) AS count FROM anchors",
    ).get()).toEqual({ count: 0 });
    expect(fixture.database.prepare(`
      SELECT revision, status FROM assistant_continuity_review_candidates
    `).get()).toEqual({ revision: 1, status: "ready" });
  });
});
