import {
  randomUUID, mkdtemp, tmpdir, path, DatabaseSync, expect, test, electron,
  continueFromMain, removeVerifiedTemporaryDirectory, type Page,
} from "./support/desktop-shell-suite";
import { once } from "node:events";

type RunningElectron = Awaited<ReturnType<typeof electron.launch>>;

function diagnostics(app: RunningElectron): void {
  app.process().stderr?.on("data", (chunk) => process.stderr.write(`[context-e2e electron stderr] ${String(chunk)}`));
}

async function closeElectron(app: RunningElectron): Promise<void> {
  const child = app.process();
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (!closed && child.exitCode === null && child.signalCode === null) {
    const exit = once(child, "exit").catch(() => undefined);
    child.kill("SIGKILL"); await exit;
  }
}

async function openContextTab(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "작품 작업면" })
    .getByRole("button", { name: "별빛", exact: true }).click();
  const workspace = page.getByRole("region", { name: "별빛 작업" });
  await workspace.getByRole("tab", { name: "문맥·활동", exact: true }).click();
  await expect(workspace.getByRole("tab", { name: "문맥·활동", exact: true }))
    .toHaveAttribute("aria-selected", "true");
}

function seedContextActivity(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    const row = database.prepare(`
      SELECT work.id AS "workId", character.id AS "characterId",
        character.revision AS "characterRevision", lore.id AS "loreId",
        lore.revision AS "loreRevision", document.id AS "documentId",
        manuscript.current_revision_id AS "documentRevisionId"
      FROM works AS work
      JOIN characters AS character ON character.work_id=work.id AND character.retired_at IS NULL
      JOIN lore_entries AS lore ON lore.work_id=work.id AND lore.retired_at IS NULL
      JOIN documents AS document ON document.work_id=work.id AND document.retired_at IS NULL
      JOIN manuscripts AS manuscript ON manuscript.document_id=document.id
      WHERE work.retired_at IS NULL LIMIT 1
    `).get() as Readonly<{
      workId: string;
      characterId: string;
      characterRevision: number;
      loreId: string;
      loreRevision: number;
      documentId: string;
      documentRevisionId: string;
    }> | undefined;
    if (row === undefined) throw new Error("Context E2E seed target unavailable");
    const receiptId = randomUUID();
    const manifestId = randomUUID();
    const range = [{ documentId: row.documentId, documentRevisionId: row.documentRevisionId, from: 0, to: 4 }];
    database.prepare(`INSERT INTO assistant_context_receipts (
      id,schema_version,request_id,work_id,conversation_id,capability,destination_id,
      read_ranges_json,transmitted_ranges_json,read_character_count,
      transmitted_character_count,grant_ids_json,created_at
    ) VALUES (?,1,?,?,?,'vocabulary-lookup','e2e-provider',?,?,4,0,'[]',?)`).run(
      receiptId, randomUUID(), row.workId, randomUUID(), JSON.stringify(range), "[]",
      "2026-08-29T06:00:00.000Z",
    );
    const entries = [{
      kind: "entity", entity: { kind: "character", id: row.characterId },
      entityRevision: row.characterRevision, inclusionReason: "required-policy",
    }];
    const excluded = [{
      kind: "entity", entity: { kind: "lore-entry", id: row.loreId },
      entityRevision: row.loreRevision, reason: "over-budget",
    }];
    database.prepare(`INSERT INTO assistant_context_manifests (
      id,schema_version,receipt_id,work_id,entries_json,excluded_json,
      estimated_token_count,created_at
    ) VALUES (?,1,?,?,?,?,4,?)`).run(
      manifestId, receiptId, row.workId, JSON.stringify(entries), JSON.stringify(excluded),
      "2026-08-29T06:00:00.000Z",
    );
    database.prepare(`INSERT INTO assistant_context_activities (
      id,schema_version,work_id,receipt_id,manifest_id,capability,destination_id,
      provider_id,model_id,started_at,completed_at,plan_duration_ms,
      authorize_duration_ms,connector_duration_ms,persist_duration_ms,
      read_ranges_json,transmitted_ranges_json,read_character_count,
      transmitted_character_count,candidate_count
    ) VALUES (?,1,?,?,?,'vocabulary-lookup','e2e-provider','e2e-provider',
      'e2e-model','2026-08-29T06:00:00.000Z','2026-08-29T06:00:01.000Z',
      3,2,10,1,?,'[]',4,0,2)`).run(
      randomUUID(), row.workId, receiptId, manifestId, JSON.stringify(range),
    );
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

test("runs packaged context policy, deterministic budget, activity, and restart flows", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-studio-context-e2e-"));
  const suffix = randomUUID().slice(0, 8);
  const loreTitle = `거대한 설정 ${suffix}`;
  const args = [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`];
  const env = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
  };
  let app = await electron.launch({ args, cwd: process.cwd(), env });
  diagnostics(app);
  let complete = false;
  try {
    let page = await app.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await dialog.getByLabel("작품 제목").fill(`문맥 작품 ${suffix}`);
    await dialog.getByLabel("첫 회차 제목").fill(`1화 ${suffix}`);
    await dialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially("윤서는 북문을 조사했다.");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page.evaluate(async ({ title, large }) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected active Work");
      await window.eumStudio.characters.create({
        schemaVersion: 1, workId: catalog.activeWorkId, name: "윤서", aliases: [],
        role: "기록관", summary: "북문을 조사한다", appearance: "", personality: "",
        speech: "", goal: "", conflict: "", note: "",
      });
      await window.eumStudio.loreEntries.create({
        schemaVersion: 1, workId: catalog.activeWorkId, title,
        content: large, category: "장소", aliases: [], enabled: true,
        evidence: null,
      });
    }, { title: loreTitle, large: "거대한 설정 ".repeat(8_000) });

    await closeElectron(app);
    app = await electron.launch({ args, cwd: process.cwd(), env }); diagnostics(app);
    page = await app.firstWindow(); await page.setViewportSize({ width: 1280, height: 800 });
    await continueFromMain(page); await openContextTab(page);
    const workspace = page.getByRole("region", { name: "별빛 작업" });
    await workspace.getByLabel("인물 · 윤서 문맥 정책").selectOption("required");
    await expect(workspace).toContainText("AI 문맥 정책을 저장했습니다.");
    const form = page.getByRole("form", { name: "문맥 plan 실행" });
    await form.getByLabel("POV 인물").selectOption({ label: "윤서" });
    await form.getByRole("button", { name: "문맥 plan 만들기", exact: true }).click();
    await expect(workspace).toContainText("결정적 문맥 plan을 만들었습니다.");
    await expect(workspace).toContainText("필수 정책 · revision 1");
    await workspace.getByLabel(`별빛 · ${loreTitle} 문맥 정책`).selectOption("required");
    await form.getByRole("button", { name: "문맥 plan 만들기", exact: true }).click();
    await expect(workspace).toContainText("필수 문맥이 예산을 초과했습니다.");

    const bounds = await page.locator(".assistant-context-grid").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { right: rect.right, bottom: rect.bottom, width: window.innerWidth, height: window.innerHeight };
    });
    expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);

    await closeElectron(app);
    seedContextActivity(path.join(directory, "workspace.sqlite3"));
    app = await electron.launch({ args, cwd: process.cwd(), env }); diagnostics(app);
    page = await app.firstWindow(); await page.setViewportSize({ width: 1280, height: 800 });
    await continueFromMain(page); await openContextTab(page);
    const activity = page.getByRole("complementary", { name: "AI 문맥 활동" });
    await expect(activity).toContainText("1개 포함 · 1개 제외");
    await expect(activity).toContainText("vocabulary-lookup · e2e-provider / e2e-model");
    await expect(activity).toContainText("읽음 4자 · 전송 0자 · Candidate 2개");
    await expect(activity).toContainText("읽은 원고");
    await expect(activity).not.toContainText("거대한 설정 거대한 설정");
    complete = true;
  } finally {
    await closeElectron(app).catch(() => undefined);
    if (complete) {
      const audit = new DatabaseSync(path.join(directory, "workspace.sqlite3"), { readOnly: true });
      try {
        expect(audit.prepare(`SELECT
          (SELECT COUNT(*) FROM assistant_entity_context_policies) AS policies,
          (SELECT COUNT(*) FROM assistant_context_manifests) AS manifests,
          (SELECT COUNT(*) FROM assistant_context_activities) AS activities,
          (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations
        `).get()).toEqual({ policies: 2, manifests: 1, activities: 1, foreignKeyViolations: 0 });
      } finally { audit.close(); }
    }
    await removeVerifiedTemporaryDirectory(directory);
  }
});
