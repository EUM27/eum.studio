import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import type {
  AssistantContextAccessResult,
  AssistantContextRequest,
} from "../../application/assistant/assistant-context-permission";
import { NARRATIVE_DIGEST_PROMPT_VERSION } from "../../application/continuity/narrative-digest-contract";
import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { entityId } from "../../domain/writing";
import { openNodeSqliteLedger } from "../../platform/storage/node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "../../platform/storage/node-sqlite-ledger-profile";
import { createLocalContextPlanner } from "./local-context-planner";
import {
  createLocalNarrativeDigestService,
  type LocalNarrativeDigestService,
  type NarrativeDigestConnector,
  type NarrativeDigestDocumentTarget,
} from "./local-narrative-digest-runtime";

const firstText = "윤서는 북문 앞에서 오래된 열쇠를 들었다.";
const secondText = "민호는 그 열쇠가 함정이라고 경고했다.";
const baseInstant = "2026-08-29T00:00:00.000Z";

function meta(id: string) {
  return { id,schemaVersion: 22,revision: 1,createdAt: baseInstant,updatedAt: baseInstant } as const;
}

function records(): readonly Poc3LedgerRecord[] {
  return [
    { kind: "studio",id: "studio-1",displayName: "이음",locale: "ko-KR",timezone: "Asia/Seoul",settingsRevision: 1,createdAt: baseInstant },
    { kind: "work",...meta("work-1"),studioId: "studio-1",title: "작품",orderKey: "a",settingsId: "settings-1" },
    { kind: "activityPolicy",...meta("activity-1"),workId: "work-1",idleTimeout: 1,navigationGrace: 1,hiddenWindowPolicy: "pause",activityClassRulesJson: "{}",autoStartEnabled: false,autoResumeFromIdle: false,recoveryPolicy: "manual" },
    { kind: "focusPolicy",...meta("focus-1"),workId: "work-1",phaseDefinitionsJson: "[]",backgroundPolicy: "pause",musicStartPolicy: "manual",completionPolicy: "manual",visibility: "work" },
    { kind: "workSettings",id: "settings-1",workId: "work-1",sceneRuleSetId: "rules-1",activityPolicyId: "activity-1",focusPolicyId: "focus-1",railPreferencesJson: "{}",revision: 1 },
    { kind: "character",...meta("character-1"),workId: "work-1",name: "윤서",aliases: [],role: "주인공",summary: "열쇠를 찾았다",appearance: "",personality: "",speech: "",goal: "문을 연다",conflict: "",note: "" },
    { kind: "loreEntry",...meta("lore-1"),workId: "work-1",title: "북문 열쇠",content: "북문을 여는 오래된 열쇠",category: "개념",aliases: ["열쇠"],enabled: true },
    { kind: "sceneIdentity",...meta("scene-1"),schemaVersion:1,workId: "work-1" },
    { kind: "document",...meta("document-1"),workId: "work-1",title: "1화",orderKey: "a",manuscriptId: "manuscript-1" },
    { kind: "blobManifest",blobRef: "blob-1",checksumIdentity: "eum-studio-ledger-sha256-v1",checksumValue: "hash-1",byteLength: Buffer.byteLength(firstText),createdAt: baseInstant },
    { kind: "documentRevision",id: "revision-1",workId: "work-1",documentId: "document-1",contentRef: "blob-1",contentHash: "hash-1",length: firstText.length,cause: "test",createdAt: baseInstant,durableAt: baseInstant },
    { kind: "manuscript",id: "manuscript-1",workId: "work-1",documentId: "document-1",currentRevisionId: "revision-1",durableRevisionId: "revision-1",updatedAt: baseInstant },
    { kind: "document",...meta("document-2"),workId: "work-1",title: "2화",orderKey: "b",manuscriptId: "manuscript-2" },
    { kind: "blobManifest",blobRef: "blob-2",checksumIdentity: "eum-studio-ledger-sha256-v1",checksumValue: "hash-2",byteLength: Buffer.byteLength(secondText),createdAt: baseInstant },
    { kind: "documentRevision",id: "revision-2",workId: "work-1",documentId: "document-2",contentRef: "blob-2",contentHash: "hash-2",length: secondText.length,cause: "test",createdAt: baseInstant,durableAt: baseInstant },
    { kind: "manuscript",id: "manuscript-2",workId: "work-1",documentId: "document-2",currentRevisionId: "revision-2",durableRevisionId: "revision-2",updatedAt: baseInstant },
  ];
}

type Fixture = Readonly<{
  root: string;
  database: DatabaseSync;
  ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  documents: Map<string,NarrativeDigestDocumentTarget>;
  connectorExecute: Mock<NarrativeDigestConnector["execute"]>;
  authorizationRequests: AssistantContextRequest[];
  service: LocalNarrativeDigestService;
  createService(connector?: NarrativeDigestConnector, authorize?: (request: AssistantContextRequest) => AssistantContextAccessResult): LocalNarrativeDigestService;
}>;

const fixtures: Fixture[] = [];

async function fixture(options: Readonly<{ budget?: number }> = {}): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(),"eum-digest-service-"));
  const databasePath = path.join(root,"workspace.sqlite3");
  const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: { applySql: "PRAGMA journal_mode = WAL",verifySql: "PRAGMA journal_mode",expectedRows: [{ journal_mode: "wal" }] },
      synchronous: { applySql: "PRAGMA synchronous = FULL",verifySql: "PRAGMA synchronous",expectedRows: [{ synchronous: 2 }] },
      foreignKeys: { applySql: "PRAGMA foreign_keys = ON",verifySql: "PRAGMA foreign_keys",expectedRows: [{ foreign_keys: 1 }] },
    },
    targetSchemaVersion: 23,
  }));
  await ledger.transaction(async (transaction) => { for (const record of records()) transaction.write(record); });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  const documents = new Map<string,NarrativeDigestDocumentTarget>([
    ["document-1",{ workId: entityId("work-1"),documentId: entityId("document-1"),currentRevisionId: entityId("revision-1"),text: firstText }],
    ["document-2",{ workId: entityId("work-1"),documentId: entityId("document-2"),currentRevisionId: entityId("revision-2"),text: secondText }],
  ]);
  let contextIndex = 0;
  let digestIndex = 0;
  let instantIndex = 0;
  const planner = createLocalContextPlanner({
    database,
    ledger,
    createId: () => `context-${++contextIndex}`,
    now: () => `2026-08-29T00:01:${String(++instantIndex).padStart(2,"0")}.000Z`,
  });
  let executionIndex = 0;
  const connectorExecute = vi.fn<NarrativeDigestConnector["execute"]>(async () => ({
    providerId: "chatgpt-oauth",
    modelId: "gpt-test",
    promptVersion: NARRATIVE_DIGEST_PROMPT_VERSION,
    text: `요약 ${++executionIndex}`,
  }));
  const connector: NarrativeDigestConnector = {
    destinationId: "chatgpt-oauth",
    contextTokenBudget: options.budget ?? 32768,
    isConnected: () => true,
    execute: connectorExecute,
  };
  const authorizationRequests: AssistantContextRequest[] = [];
  const authorized = (request: AssistantContextRequest): AssistantContextAccessResult => {
    authorizationRequests.push(request);
    const receiptId = entityId<"AssistantContextReceipt">(`receipt-${request.requestId}`);
    const createdAt = `2026-08-29T00:02:${String(++instantIndex).padStart(2,"0")}.000Z`;
    database.prepare(`INSERT INTO assistant_context_receipts (
      id,schema_version,request_id,work_id,conversation_id,capability,destination_id,
      read_ranges_json,transmitted_ranges_json,read_character_count,
      transmitted_character_count,grant_ids_json,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      receiptId,1,request.requestId,request.workId,request.conversationId,request.capability,
      request.destinationId,JSON.stringify(request.readRanges),JSON.stringify(request.transmittedRanges),
      request.readRanges.reduce((sum,range) => sum+range.to-range.from,0),
      request.transmittedRanges.reduce((sum,range) => sum+range.to-range.from,0),"[]",createdAt,
    );
    return { allowed: true,receipt: {
      schemaVersion: 1,receiptId,requestId: request.requestId,workId: request.workId,
      conversationId: request.conversationId,capability: request.capability,destinationId: request.destinationId,
      readRanges: request.readRanges,transmittedRanges: request.transmittedRanges,
      readCharacterCount: request.readRanges.reduce((sum,range) => sum+range.to-range.from,0),
      transmittedCharacterCount: request.transmittedRanges.reduce((sum,range) => sum+range.to-range.from,0),grantIds: [],createdAt,
    } };
  };
  const createService = (selectedConnector: NarrativeDigestConnector | undefined = connector, authorize = authorized) =>
    createLocalNarrativeDigestService({
      database,ledger,contextPlanner: planner,connector: selectedConnector,
      getDocument: (documentId) => documents.get(documentId),authorizeContext: authorize,
      createId: () => `digest-${++digestIndex}`,
      now: () => `2026-08-29T00:03:${String(++instantIndex).padStart(2,"0")}.000Z`,
      measureNow: (() => { let value=0; return () => ++value; })(),
    });
  const service = createService();
  const result = Object.freeze({ root,database,ledger,documents,connectorExecute,authorizationRequests,service,createService });
  fixtures.push(result);
  return result;
}

afterEach(async () => {
  while (fixtures.length > 0) {
    const current = fixtures.pop()!;
    current.database.close(); current.ledger.close();
    await rm(current.root,{ recursive: true,force: true });
  }
});

const generation = (requestId: string) => ({
  schemaVersion: 1 as const,
  requestId: entityId<"NarrativeDigestRequest">(requestId),
  workId: entityId<"Work">("work-1"),
  conversationId: entityId<"AssistantConversation">("conversation-1"),
  scope: { kind: "work" as const },
  documentIds: [entityId<"Document">("document-1"),entityId<"Document">("document-2")],
});

describe("LocalNarrativeDigestService", () => {
  it("persists exact sources, projects stale without deleting text, regenerates immutably, and survives service restart", async () => {
    const current = await fixture();
    const generated = await current.service.generate(generation("request-1"));
    expect(generated).toMatchObject({ status: "generated",digest: { integrity: "current",text: "요약 1" } });
    expect(current.connectorExecute).toHaveBeenCalledOnce();
    expect(current.authorizationRequests[0]).toMatchObject({
      requiredLocalScope: "work",requiredExternalScope: "work",
    });
    expect(current.connectorExecute.mock.calls[0]?.[0]).toMatchObject({
      documents: [
        { documentId: "document-1",documentRevisionId: "revision-1",from: 0,to: firstText.length,text: firstText },
        { documentId: "document-2",documentRevisionId: "revision-2",from: 0,to: secondText.length,text: secondText },
      ],
      sceneSource: null,
      sourceManifest: {
        characters: [{ entityId: "character-1",revision: 1 }],
        loreEntries: [{ entityId: "lore-1",revision: 1 }],
      },
    });
    expect(current.database.prepare(`SELECT
      (SELECT COUNT(*) FROM narrative_digests) AS digests,
      (SELECT COUNT(*) FROM narrative_digest_documents) AS documents,
      (SELECT COUNT(*) FROM assistant_context_manifests) AS manifests,
      (SELECT COUNT(*) FROM assistant_context_activities) AS activities
    `).get()).toEqual({ digests: 1,documents: 2,manifests: 1,activities: 1 });

    current.database.prepare(`UPDATE characters SET revision=2,summary='열쇠를 잃었다',updated_at=? WHERE id='character-1'`).run("2026-08-29T01:00:00.000Z");
    const stale = current.createService().list({ schemaVersion: 1,workId: entityId("work-1") });
    expect(stale.digests[0]).toMatchObject({ integrity: "stale",text: "요약 1" });

    const regenerated = await current.createService().regenerate({
      schemaVersion: 1,requestId: entityId("request-2"),workId: entityId("work-1"),
      conversationId: entityId("conversation-1"),digestId: stale.digests[0]!.digestId,
    });
    expect(regenerated).toMatchObject({ status: "generated",digest: { integrity: "current",text: "요약 2",sourceManifest: { characters: [{ entityId: "character-1",revision: 2 }] } } });
    const history = current.createService().list({ schemaVersion: 1,workId: entityId("work-1") });
    expect(history.digests.map((digest) => [digest.text,digest.integrity])).toEqual([["요약 2","current"],["요약 1","stale"]]);
    expect(() => current.database.prepare(`UPDATE narrative_digests SET text='변조' WHERE id=?`).run(history.digests[0]!.digestId)).toThrow(/immutable/);
    expect(current.database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("uses chapter permission for a bounded non-work digest with one explicit Document", async () => {
    const current=await fixture();
    await expect(current.service.generate({
      ...generation("request-document"),
      scope:{ kind:"document",documentId:entityId<"Document">("document-1") },
      documentIds:[entityId<"Document">("document-1")],
    })).resolves.toMatchObject({ status:"generated" });
    expect(current.authorizationRequests[0]).toMatchObject({
      requiredLocalScope:"chapter",requiredExternalScope:"chapter",
    });
  });

  it("stores one exact Scene digest, includes linked Lore context, and deduplicates its source fingerprint", async () => {
    const current = await fixture();
    const sourceRange = {
      documentId: entityId<"Document">("document-1"),
      documentRevisionId: entityId<"DocumentRevision">("revision-1"),
      from: 0,
      to: 12,
    } as const;
    await expect(current.service.generateScene({
      schemaVersion: 1,
      requestId: entityId<"NarrativeDigestRequest">("scene-request-1"),
      workId: entityId<"Work">("work-1"),
      conversationId: entityId<"AssistantConversation">("conversation-1"),
      sceneId: entityId<"Scene">("scene-1"),
      sourceRange,
      trigger: "scene-transition",
    })).resolves.toMatchObject({
      status: "generated",
      digest: {
        scope: { kind: "scene", sceneId: "scene-1" },
        sceneSource: { ...sourceRange, trigger: "scene-transition" },
      },
    });
    expect(current.authorizationRequests[0]).toMatchObject({
      requiredLocalScope: "scene",
      requiredExternalScope: "scene",
      readRanges: [sourceRange],
    });
    expect(current.connectorExecute.mock.calls[0]?.[0]).toMatchObject({
      documents: [{ ...sourceRange, text: firstText.slice(0,12) }],
      sceneSource: { sceneId: "scene-1",...sourceRange },
      sourceManifest: { loreEntries: [{ entityId: "lore-1",revision: 1 }] },
    });
    await expect(current.service.generateScene({
      schemaVersion: 1,
      requestId: entityId<"NarrativeDigestRequest">("scene-request-2"),
      workId: entityId<"Work">("work-1"),
      conversationId: entityId<"AssistantConversation">("conversation-1"),
      sceneId: entityId<"Scene">("scene-1"),
      sourceRange,
      trigger: "episode-transition",
    })).resolves.toMatchObject({ status: "unchanged" });
    expect(current.connectorExecute).toHaveBeenCalledOnce();
    expect(current.database.prepare(`SELECT COUNT(*) AS count FROM narrative_digest_scene_sources`).get())
      .toEqual({ count: 1 });
  });

  it("stops before receipt and connector on required over-budget, and returns explicit login/permission states", async () => {
    const current = await fixture({ budget: 0 });
    current.database.prepare(`INSERT INTO assistant_entity_context_policies (
      id,schema_version,revision,created_at,updated_at,work_id,entity_kind,entity_id,mode
    ) VALUES ('policy-1',1,1,?,?,?,'character','character-1','required')`).run(baseInstant,baseInstant,"work-1");
    await expect(current.service.generate(generation("request-over-budget"))).rejects.toThrow(/required-context-over-budget/);
    expect(current.connectorExecute).not.toHaveBeenCalled();
    expect(current.database.prepare(`SELECT
      (SELECT COUNT(*) FROM assistant_context_receipts) AS receipts,
      (SELECT COUNT(*) FROM narrative_digests) AS digests
    `).get()).toEqual({ receipts: 0,digests: 0 });

    expect(await current.createService({
      destinationId: "chatgpt-oauth",contextTokenBudget: 32768,isConnected: () => false,execute: current.connectorExecute,
    }).generate(generation("request-login"))).toEqual({ schemaVersion: 1,status: "login-required" });
    const permission = await current.createService({
      destinationId: "chatgpt-oauth",contextTokenBudget: 32768,isConnected: () => true,execute: current.connectorExecute,
    },() => ({ allowed: false,reason: "permission-required",missing: ["local-read","external-transmit"] })).generate(generation("request-permission"));
    expect(permission).toMatchObject({ status: "permission-required",missing: ["local-read","external-transmit"] });
    expect(current.connectorExecute).not.toHaveBeenCalled();
  });
});
