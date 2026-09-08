import { describe, expect, it } from "vitest";
import { WorkspaceOperationCoordinator } from "./operation-coordinator";
import { BackupService } from "./services/backup";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe("workspace operation coordinator", () => {
  it("finishes a queued mutation before a later transfer without a circular save wait", async () => {
    const operations = new WorkspaceOperationCoordinator();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const events: string[] = [];
    let calls = 0;
    const backup = new BackupService({
      operations,
      infrastructure: { assertOpen() {} },
      backupService: {
        getStatus: async () => ({ schemaVersion: 1, lastVerified: null }),
        restoreBundle: async () => { throw new Error("Unused restore fixture"); },
        createBundle: async () => {
          if (++calls === 1) { firstStarted.resolve(); await releaseFirst.promise; }
          events.push(`mutation-${calls}`);
          return {} as Awaited<ReturnType<BackupService["createBackupBundle"]>>;
        },
      },
    });
    const first = backup.createBackupBundle("first fixture");
    await firstStarted.promise;
    const second = backup.createBackupBundle("second fixture");
    const transfer = operations.enqueueTransfer(() => { events.push("transfer"); });
    const save = operations.enqueueSave(() => { events.push("save"); });
    releaseFirst.resolve();
    await Promise.all([first, second, transfer, save]);
    expect(events).toEqual(["mutation-1", "mutation-2", "transfer", "save"]);
  });

  it("keeps saves moving while a mutation waits on the current save tail", async () => {
    const operations = new WorkspaceOperationCoordinator();
    const releaseFirstSave = deferred();
    const firstSaveStarted = deferred();
    const mutationEntered = deferred();
    const events: string[] = [];
    const first = operations.enqueueSave(async () => {
      firstSaveStarted.resolve();
      await releaseFirstSave.promise;
      events.push("first-save");
    });
    await firstSaveStarted.promise;
    const mutation = operations.enqueueMutation(async () => {
      mutationEntered.resolve();
      await operations.saveTail;
      events.push("mutation");
    });
    const second = operations.enqueueSave(() => { events.push("second-save"); });
    await mutationEntered.promise;
    expect(events).toEqual([]);
    releaseFirstSave.resolve();
    await Promise.all([first, second, mutation]);
    expect(events).toEqual(["first-save", "second-save", "mutation"]);
  });

  it("waits for both write lanes when reading without installing a new tail", async () => {
    const operations = new WorkspaceOperationCoordinator();
    const releaseSave = deferred();
    const releaseMutation = deferred();
    const saving = operations.enqueueSave(() => releaseSave.promise);
    const mutating = operations.enqueueMutation(() => releaseMutation.promise);
    const saveTail = operations.saveTail;
    const mutationTail = operations.mutationTail;
    let readFinished = false;
    const reading = operations.readBarrier().then(() => { readFinished = true; });
    expect(operations.saveTail).toBe(saveTail);
    expect(operations.mutationTail).toBe(mutationTail);
    releaseSave.resolve();
    await saving;
    expect(readFinished).toBe(false);
    releaseMutation.resolve();
    await Promise.all([mutating, reading]);
    expect(readFinished).toBe(true);
  });

  it("makes a range transfer a shared barrier for later saves and mutations", async () => {
    const operations = new WorkspaceOperationCoordinator();
    const releaseSave = deferred();
    const releaseMutation = deferred();
    const releaseTransfer = deferred();
    const transferStarted = deferred();
    const events: string[] = [];
    const saving = operations.enqueueSave(() => releaseSave.promise);
    const mutating = operations.enqueueMutation(() => releaseMutation.promise);
    const transfer = operations.enqueueTransfer(async () => {
      events.push("transfer-start");
      transferStarted.resolve();
      await releaseTransfer.promise;
      events.push("transfer-end");
    });
    expect(operations.saveTail).toBe(operations.mutationTail);
    const laterSave = operations.enqueueSave(() => { events.push("later-save"); });
    const laterMutation = operations.enqueueMutation(() => { events.push("later-mutation"); });
    releaseSave.resolve();
    await saving;
    expect(events).toEqual([]);
    releaseMutation.resolve();
    await mutating;
    await transferStarted.promise;
    expect(events).toEqual(["transfer-start"]);
    releaseTransfer.resolve();
    await Promise.all([transfer, laterSave, laterMutation]);
    expect(events.slice(0, 2)).toEqual(["transfer-start", "transfer-end"]);
    expect(new Set(events.slice(2))).toEqual(new Set(["later-save", "later-mutation"]));
  });

  it("settles failed writes so both lanes can accept later work", async () => {
    const operations = new WorkspaceOperationCoordinator();
    const failure = new Error("recording failed");
    await expect(operations.enqueueSave(() => { throw failure; })).rejects.toBe(failure);
    expect(await operations.enqueueSave(() => "saved")).toBe("saved");
    await expect(operations.enqueueMutation(() => { throw failure; })).rejects.toBe(failure);
    expect(await operations.enqueueMutation(() => "changed")).toBe("changed");
    await expect(operations.enqueueTransfer(() => { throw failure; })).rejects.toBe(failure);
    expect(await operations.enqueueSave(() => "saved-after-transfer")).toBe("saved-after-transfer");
    expect(await operations.enqueueMutation(() => "changed-after-transfer")).toBe("changed-after-transfer");
  });

  it("allows saving during external analysis and recovers its independent lane after failure", async () => {
    const operations = new WorkspaceOperationCoordinator();
    const analysisStarted = deferred();
    const releaseAnalysis = deferred();
    const failure = new Error("analysis failed");
    const analysis = operations.enqueueAnalysis(async () => {
      await operations.readBarrier();
      analysisStarted.resolve();
      await releaseAnalysis.promise;
      throw failure;
    });
    const rejected = expect(analysis).rejects.toBe(failure);
    await analysisStarted.promise;
    expect(await operations.enqueueSave(() => "saved-during-analysis")).toBe("saved-during-analysis");
    let nextAnalysisStarted = false;
    const nextAnalysis = operations.enqueueAnalysis(() => { nextAnalysisStarted = true; });
    expect(nextAnalysisStarted).toBe(false);
    releaseAnalysis.resolve();
    await rejected;
    await nextAnalysis;
    expect(nextAnalysisStarted).toBe(true);
  });
});
