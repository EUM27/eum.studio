import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { entityId } from "../domain/writing";
import { openLocalWorkspaceRuntime, type LocalWorkspaceRuntimeOptions } from "./local-workspace-runtime";
import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import { parseManuscriptFormattingProfile } from "../application/editor/manuscript-formatting";
import { parseLocalWorkspaceDefaults } from "../application/workspace/local-workspace-defaults";
import { parseAppSettingsProfile } from "../application/settings/app-settings";
import { parseMusicSettingsProfile } from "../application/music/work-music-settings";
import { parseLocalWorkspaceBackupProfile } from "../application/storage/local-workspace-backup-profile";

function options(rootDirectoryPath: string): LocalWorkspaceRuntimeOptions {
  const config = (name: string): unknown => JSON.parse(readFileSync(path.join(process.cwd(), "config", `${name}.json`), "utf8"));
  const documentId = randomUUID();
  return { rootDirectoryPath, localMediaLibraryRootDirectoryPath: path.join(rootDirectoryPath, "media"), studioDisplayName: randomUUID(), locale: "ko-KR", timezone: "Asia/Seoul",
    batchingPolicy: { schemaVersion: 1, maxTransactionsPerBatch: 1, maxDelayMs: 0 },
    formattingProfile: parseManuscriptFormattingProfile(config("manuscript-formatting")),
    appSettingsProfile: parseAppSettingsProfile(config("app-settings")),
    musicSettingsProfile: parseMusicSettingsProfile(config("music-settings")),
    defaults: parseLocalWorkspaceDefaults(config("local-workspace-defaults")),
    backupProfile: parseLocalWorkspaceBackupProfile(config("local-workspace-backup")),
    emptyDocumentProfile: parseManuscriptDocumentProfile({ schemaVersion: 1, initialDocumentId: documentId, documents: [{ workId: randomUUID(), documentId, documentRevisionId: randomUUID(), label: randomUUID(), initialText: "" }] }),
  };
}

it("cancels a queued request without network access and suppresses late active completion and receipts", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-assistant-lifetime-"));
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const execute = vi.fn<NonNullable<LocalWorkspaceRuntimeOptions["executeAssistantVocabularySuggestion"]>>(async (input) => {
    await wait; // Deliberately ignore abort to verify the runtime boundary as well as transport cooperation.
    return { receipt: { schemaVersion: 1, receiptId: entityId<"ConnectorReceipt">(randomUUID()), requestId: entityId<"AssistantConnectorRequest">(input.requestId), connectionId: input.connectionId, connectorKind: randomUUID(), operation: "vocabulary-suggestions", requestFingerprint: randomUUID(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), resultState: "succeeded" }, payload: { suggestions: [], note: "late response" } };
  });
  const runtime = await openLocalWorkspaceRuntime({ ...options(directory), executeAssistantVocabularySuggestion: execute });
  try {
    const work = await runtime.createFirstWork({ schemaVersion: 1, title: randomUUID(), firstDocumentTitle: randomUUID() });
    const command = { schemaVersion: 1 as const, workId: work.workId, requestId: randomUUID(), conversationId: randomUUID(), connectionId: randomUUID(), query: randomUUID(), sourceRange: null };
    const running = runtime.runAssistantVocabularySuggestion(command);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    const queuedCommand = { ...command, requestId: randomUUID() };
    const queued = runtime.runAssistantVocabularySuggestion(queuedCommand);
    expect(runtime.cancelAssistantRequest({ schemaVersion: 1, workId: entityId<"Work">(randomUUID()), requestId: command.requestId }).status).toBe("not-running");
    expect(runtime.cancelAssistantRequest({ schemaVersion: 1, workId: work.workId, requestId: queuedCommand.requestId }).status).toBe("cancelled");
    await expect(queued).resolves.toMatchObject({ status: "failed", reason: "cancelled" });
    expect(runtime.cancelAssistantRequest({ schemaVersion: 1, workId: work.workId, requestId: command.requestId }).status).toBe("cancelled");
    await expect(running).resolves.toMatchObject({ status: "failed", reason: "cancelled" });
    const state = await runtime.listAssistantContextState({ schemaVersion: 1, workId: work.workId, conversationId: command.conversationId });
    expect(state.vocabularySuggestionCandidates).toHaveLength(0);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].signal.aborted).toBe(true);
    release();
    await wait;
    await new Promise<void>((resolve) => setImmediate(resolve));
    const after = await runtime.listAssistantContextState({ schemaVersion: 1, workId: work.workId, conversationId: command.conversationId });
    expect(after.vocabularySuggestionCandidates).toHaveLength(0);
    expect(after.receipts).toHaveLength(0);
  } finally { release(); runtime.close(); await rm(directory, { recursive: true, force: true }); }
});

it("returns a typed invalid-response result for a malformed operation payload without storing a candidate", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-assistant-invalid-payload-"));
  const runtime = await openLocalWorkspaceRuntime({ ...options(directory), executeAssistantVocabularySuggestion: async (input) => ({
    receipt: { schemaVersion: 1, receiptId: entityId<"ConnectorReceipt">(randomUUID()), requestId: entityId<"AssistantConnectorRequest">(input.requestId), connectionId: input.connectionId, connectorKind: randomUUID(), operation: "vocabulary-suggestions", requestFingerprint: randomUUID(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), resultState: "succeeded" },
    payload: { private: randomUUID() },
  }) });
  try {
    const work = await runtime.createFirstWork({ schemaVersion: 1, title: randomUUID(), firstDocumentTitle: randomUUID() });
    const conversationId = randomUUID();
    await expect(runtime.runAssistantVocabularySuggestion({ schemaVersion: 1, workId: work.workId, requestId: randomUUID(), conversationId, connectionId: randomUUID(), query: randomUUID(), sourceRange: null })).resolves.toEqual({ schemaVersion: 1, status: "failed", reason: "invalid-response" });
    const state = await runtime.listAssistantContextState({ schemaVersion: 1, workId: work.workId, conversationId });
    expect(state.vocabularySuggestionCandidates).toHaveLength(0);
  } finally { runtime.close(); await rm(directory, { recursive: true, force: true }); }
});
