import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../platform/storage/node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "../../platform/storage/node-sqlite-ledger-profile";
import {
  createLocalCharacterKnowledgeService,
  type CharacterKnowledgeDocumentTarget,
  type LocalCharacterKnowledgeService,
} from "./local-character-knowledge-runtime";

const now = "2026-08-29T00:00:00.000Z";
const manuscript = "윤서는 열쇠가 북문을 연다고 믿었다.";

function meta(id: string) {
  return { id, schemaVersion: 20, revision: 1, createdAt: now, updatedAt: now } as const;
}

function workspaceRecords(): readonly Poc3LedgerRecord[] {
  return [
    { kind: "studio", id: "studio-1", displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
    { kind: "work", ...meta("work-1"), studioId: "studio-1", title: "작품", orderKey: "a", settingsId: "settings-1" },
    { kind: "activityPolicy", ...meta("activity-1"), workId: "work-1", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta("focus-1"), workId: "work-1", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: "settings-1", workId: "work-1", sceneRuleSetId: "rules-1", activityPolicyId: "activity-1", focusPolicyId: "focus-1", railPreferencesJson: "{}", revision: 1 },
    { kind: "character", ...meta("character-1"), workId: "work-1", name: "윤서", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
    { kind: "document", ...meta("document-1"), workId: "work-1", title: "1화", orderKey: "a", manuscriptId: "manuscript-1" },
    { kind: "blobManifest", blobRef: "blob-1", checksumIdentity: "eum-studio-ledger-sha256-v1", checksumValue: "hash-1", byteLength: Buffer.byteLength(manuscript), createdAt: now },
    { kind: "documentRevision", id: "revision-1", workId: "work-1", documentId: "document-1", contentRef: "blob-1", contentHash: "hash-1", length: manuscript.length, cause: "test", createdAt: now, durableAt: now },
    { kind: "manuscript", id: "manuscript-1", workId: "work-1", documentId: "document-1", currentRevisionId: "revision-1", durableRevisionId: "revision-1", updatedAt: now },
    { kind: "work", ...meta("work-2"), studioId: "studio-1", title: "다른 작품", orderKey: "b", settingsId: "settings-2" },
    { kind: "activityPolicy", ...meta("activity-2"), workId: "work-2", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta("focus-2"), workId: "work-2", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: "settings-2", workId: "work-2", sceneRuleSetId: "rules-2", activityPolicyId: "activity-2", focusPolicyId: "focus-2", railPreferencesJson: "{}", revision: 1 },
    { kind: "character", ...meta("character-outside"), workId: "work-2", name: "외부", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
  ];
}

type Fixture = Readonly<{
  root: string;
  database: DatabaseSync;
  ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  service: LocalCharacterKnowledgeService;
  documents: Map<string, CharacterKnowledgeDocumentTarget>;
}>;

const fixtures: Fixture[] = [];

async function createFixture(options: Readonly<{ fixedId?: string }> = {}): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "eum-knowledge-service-"));
  const databasePath = path.join(root, "workspace.sqlite3");
  const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
      synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
      foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
    },
    targetSchemaVersion: 20,
  }));
  await ledger.transaction(async (transaction) => {
    for (const record of workspaceRecords()) transaction.write(record);
  });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  const documents = new Map<string, CharacterKnowledgeDocumentTarget>([[
    "document-1",
    Object.freeze({
      workId: "work-1" as never,
      documentId: "document-1" as never,
      currentRevisionId: "revision-1" as never,
      text: manuscript,
    }),
  ]]);
  let idIndex = 0;
  let instantIndex = 0;
  const service = createLocalCharacterKnowledgeService({
    database,
    ledger,
    schemaVersion: 20,
    anchorPolicy: { schemaVersion: 1, version: "test-anchor-v1", contextOffsetLength: 8 },
    describeAnchorEvidence: createNodeCryptoAnchorEvidenceDescriptor("sha256"),
    getDocument: (documentId) => documents.get(documentId),
    createId: () => options.fixedId ?? `knowledge-generated-${++idIndex}`,
    now: () => `2026-08-29T00:00:${String(++instantIndex).padStart(2, "0")}.000Z`,
  });
  const fixture = Object.freeze({ root, database, ledger, service, documents });
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  while (fixtures.length > 0) {
    const fixture = fixtures.pop()!;
    fixture.database.close();
    fixture.ledger.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

describe("LocalCharacterKnowledgeService", () => {
  it("creates exact evidence, updates content, supersedes state, and retires without overwriting lineage", async () => {
    const fixture = await createFixture();
    const created = await fixture.service.create({
      schemaVersion: 1,
      workId: "work-1" as never,
      characterId: "character-1" as never,
      statement: "열쇠는 북문을 연다",
      stance: "believes",
      truthStatus: "false",
      aboutRefs: [{ kind: "character", id: "character-1" as never }],
      evidenceRange: { documentId: "document-1" as never, documentRevisionId: "revision-1" as never, from: 0, to: 2 },
    });
    expect(created).toMatchObject({ revision: 1, stance: "believes", truthStatus: "false", status: "active" });
    expect(created.evidence[0]).toMatchObject({ exactText: "윤서", integrity: "resolved", range: { from: 0, to: 2 } });

    const updated = await fixture.service.update({
      schemaVersion: 1,
      workId: "work-1" as never,
      knowledgeId: created.knowledgeId,
      expectedRevision: 1,
      statement: "열쇠가 북문을 연다",
      aboutRefs: [],
    });
    expect(updated).toMatchObject({ revision: 2, stance: "believes", truthStatus: "false" });

    const successor = await fixture.service.supersede({
      schemaVersion: 1,
      workId: "work-1" as never,
      knowledgeId: created.knowledgeId,
      expectedRevision: 2,
      statement: "열쇠는 남문을 연다",
      stance: "knows",
      truthStatus: "true",
      aboutRefs: [],
      evidenceRange: null,
    });
    expect(successor).toMatchObject({ revision: 1, status: "active", supersedesKnowledgeId: created.knowledgeId });
    const all = await fixture.service.list({ schemaVersion: 1, workId: "work-1" as never, characterId: null, status: "all" });
    const predecessor = all.entries.find((entry) => entry.knowledgeId === created.knowledgeId)!;
    expect(predecessor).toMatchObject({ revision: 3, status: "superseded", supersededByKnowledgeId: successor.knowledgeId, statement: "열쇠가 북문을 연다", stance: "believes", truthStatus: "false" });

    const pov = await fixture.service.projectPov({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never });
    expect(pov.objectiveFacts.map((entry) => entry.knowledgeId)).toEqual([successor.knowledgeId]);
    expect(pov.povKnown.map((entry) => entry.knowledgeId)).toEqual([successor.knowledgeId]);

    const retired = await fixture.service.retire({
      schemaVersion: 1,
      workId: "work-1" as never,
      knowledgeId: successor.knowledgeId,
      expectedRevision: 1,
      reason: "사용자 정리",
    });
    expect(retired).toMatchObject({ revision: 2, status: "retired" });
    await expect(fixture.service.projectPov({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never }))
      .resolves.toMatchObject({ objectiveFacts: [], povKnown: [], povFalseBeliefs: [], povUnavailable: [] });
  });

  it("separates important unawareness and false beliefs in POV context", async () => {
    const fixture = await createFixture();
    const falseBelief = await fixture.service.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "북문은 안전하다", stance: "believes", truthStatus: "false", aboutRefs: [], evidenceRange: null });
    const unavailable = await fixture.service.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "북문에 함정이 있다", stance: "unaware", truthStatus: "true", aboutRefs: [], evidenceRange: null });
    const pov = await fixture.service.projectPov({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never });
    expect(pov.povFalseBeliefs.map((entry) => entry.knowledgeId)).toEqual([falseBelief.knowledgeId]);
    expect(pov.povUnavailable.map((entry) => entry.knowledgeId)).toEqual([unavailable.knowledgeId]);
    expect(pov.objectiveFacts.map((entry) => entry.knowledgeId)).toEqual([unavailable.knowledgeId]);
  });

  it("rejects outside-Work targets, stale revisions, and stale exact ranges", async () => {
    const fixture = await createFixture();
    await expect(fixture.service.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-outside" as never, statement: "외부", stance: "knows", truthStatus: "unknown", aboutRefs: [], evidenceRange: null }))
      .rejects.toThrow(/outside Work/u);
    await expect(fixture.service.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "외부 참조", stance: "knows", truthStatus: "unknown", aboutRefs: [{ kind: "character", id: "character-outside" as never }], evidenceRange: null }))
      .rejects.toThrow(/outside Work/u);
    await expect(fixture.service.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "오래된 근거", stance: "knows", truthStatus: "unknown", aboutRefs: [], evidenceRange: { documentId: "document-1" as never, documentRevisionId: "revision-old" as never, from: 0, to: 2 } }))
      .rejects.toThrow(/stale/u);
  });

  it("requires explicit supersession for a new state of the same active statement", async () => {
    const fixture = await createFixture();
    await fixture.service.create({
      schemaVersion: 1,
      workId: "work-1" as never,
      characterId: "character-1" as never,
      statement: "열쇠는 북문을 연다",
      stance: "believes",
      truthStatus: "false",
      aboutRefs: [],
      evidenceRange: null,
    });
    await expect(fixture.service.create({
      schemaVersion: 1,
      workId: "work-1" as never,
      characterId: "character-1" as never,
      statement: "열쇠는 북문을 연다",
      stance: "knows",
      truthStatus: "true",
      aboutRefs: [],
      evidenceRange: null,
    })).rejects.toThrow(/supersession/u);
    const all = await fixture.service.list({
      schemaVersion: 1,
      workId: "work-1" as never,
      characterId: "character-1" as never,
      status: "all",
    });
    expect(all.entries).toHaveLength(1);
  });

  it("leaves the predecessor active when a successor transaction cannot commit", async () => {
    const fixture = await createFixture({ fixedId: "fixed-id" });
    const created = await fixture.service.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "초기", stance: "suspects", truthStatus: "unknown", aboutRefs: [], evidenceRange: null });
    await expect(fixture.service.supersede({ schemaVersion: 1, workId: "work-1" as never, knowledgeId: created.knowledgeId, expectedRevision: 1, statement: "새 상태", stance: "knows", truthStatus: "true", aboutRefs: [], evidenceRange: null }))
      .rejects.toThrow();
    const current = await fixture.service.list({ schemaVersion: 1, workId: "work-1" as never, characterId: null, status: "all" });
    expect(current.entries).toHaveLength(1);
    expect(current.entries[0]).toMatchObject({ knowledgeId: created.knowledgeId, revision: 1, status: "active", supersededByKnowledgeId: null });
  });
});
