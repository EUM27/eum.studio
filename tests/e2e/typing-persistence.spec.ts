import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { electron } from "./support/desktop-shell-suite";

async function removeTemporaryWorkspace(directory: string): Promise<void> {
  const resolved = await realpath(directory).catch(() => path.resolve(directory));
  const temporaryRoot = `${path.resolve(tmpdir())}${path.sep}`;
  if (!resolved.startsWith(temporaryRoot)) {
    throw new Error(`Refusing to remove non-temporary workspace: ${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
}

test("persists continuous typing and restores every character", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-typing-persistence-"),
  );
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });
  const sample = "ㅎ".repeat(40);

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(randomUUID());
    await createWorkDialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const before = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null || catalog.activeDocumentId === null) {
        throw new Error("Expected an active local workspace document");
      }
      const [profile, revisions] = await Promise.all([
        window.eumStudio.editor.getManuscriptPersistenceProfile(),
        window.eumStudio.version.listDocumentRevisions({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
          documentId: catalog.activeDocumentId,
        }),
      ]);
      return {
        workId: catalog.activeWorkId,
        documentId: catalog.activeDocumentId,
        profile,
        revisionCount: revisions.revisions.length,
      };
    });
    expect(before.profile?.batching).toEqual({
      schemaVersion: 1,
      maxTransactionsPerBatch: 1,
      maxDelayMs: 0,
    });

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    const inputLatenciesMs: number[] = [];
    for (let index = 0; index < sample.length; index += 1) {
      const startedAt = performance.now();
      await page.keyboard.insertText(sample[index]!);
      expect(await manuscript.textContent()).toBe(sample.slice(0, index + 1));
      inputLatenciesMs.push(performance.now() - startedAt);
    }
    const sortedInputLatenciesMs = [...inputLatenciesMs].sort(
      (left, right) => left - right,
    );
    const p95InputLatencyMs = sortedInputLatenciesMs[
      Math.ceil(sortedInputLatenciesMs.length * 0.95) - 1
    ]!;
    const typingLatency = {
      sampleLength: sample.length,
      p50Ms: sortedInputLatenciesMs[Math.floor(
        sortedInputLatenciesMs.length * 0.5,
      )],
      p95Ms: p95InputLatencyMs,
      maxMs: sortedInputLatenciesMs.at(-1),
    };
    console.info(`[typing-latency] ${JSON.stringify(typingLatency)}`);
    await test.info().attach("typing-latency.json", {
      body: Buffer.from(JSON.stringify(typingLatency, null, 2)),
      contentType: "application/json",
    });
    expect(p95InputLatencyMs).toBeLessThan(50);
    await expect(page.getByTestId("manuscript-character-count"))
      .toHaveText(String(sample.length));
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const after = await page.evaluate(async ({ workId, documentId }) =>
      window.eumStudio.version.listDocumentRevisions({
        schemaVersion: 1,
        workId,
        documentId,
      }), {
      workId: before.workId,
      documentId: before.documentId,
    });
    const revisionDelta = after.revisions.length - before.revisionCount;
    expect(revisionDelta).toBeGreaterThanOrEqual(1);
    expect(revisionDelta).toBeLessThanOrEqual(sample.length);
    expect(after.revisions.find((revision) => revision.isCurrent)?.length)
      .toBe(sample.length);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    const restored = await page.evaluate(async ({ workId, documentId }) => {
      const revisions = await window.eumStudio.version.listDocumentRevisions({
        schemaVersion: 1,
        workId,
        documentId,
      });
      const current = revisions.revisions.find((revision) => revision.isCurrent);
      if (current === undefined) throw new Error("Expected current revision");
      return window.eumStudio.version.readDocumentRevision({
        schemaVersion: 1,
        workId,
        documentId,
        revisionId: current.revisionId,
      });
    }, {
      workId: before.workId,
      documentId: before.documentId,
    });
    expect(restored.text).toBe(sample);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeTemporaryWorkspace(directory);
  }
});
