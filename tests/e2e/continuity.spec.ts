import {
  randomUUID,
  mkdtemp,
  tmpdir,
  path,
  DatabaseSync,
  expect,
  test,
  electron,
  continueFromMain,
  removeVerifiedTemporaryDirectory,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";
import { once } from "node:events";

type RunningElectron = Awaited<ReturnType<typeof electron.launch>>;

function attachElectronDiagnostics(app: RunningElectron): void {
  app.process().stdout?.on("data", (chunk) => {
    process.stderr.write(`[continuity-e2e electron stdout] ${String(chunk)}`);
  });
  app.process().stderr?.on("data", (chunk) => {
    process.stderr.write(`[continuity-e2e electron stderr] ${String(chunk)}`);
  });
}

async function closeElectron(app: RunningElectron): Promise<void> {
  const child = app.process();
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (!closed && child.exitCode === null && child.signalCode === null) {
    const exit = once(child, "exit").catch(() => undefined);
    child.kill("SIGKILL");
    await exit;
  }
}

async function selectExactRange(
  manuscript: Locator,
  from: number,
  exactText: string,
): Promise<void> {
  await manuscript.click();
  await manuscript.press("Control+Home");
  for (let index = 0; index < from; index += 1) await manuscript.press("ArrowRight");
  for (let index = 0; index < exactText.length; index += 1) {
    await manuscript.press("Shift+ArrowRight");
  }
  await expect.poll(() => manuscript.evaluate(() =>
    globalThis.getSelection()?.toString() ?? ""
  )).toBe(exactText);
}

async function rightClickOffset(
  page: Page,
  manuscript: Locator,
  offset: number,
): Promise<void> {
  const point = await manuscript.locator(".cm-line").first().evaluate(
    (line, targetOffset) => {
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let textNode: Text | null = null;
      let localOffset = targetOffset;
      while (walker.nextNode()) {
        const candidate = walker.currentNode;
        if (!(candidate instanceof Text)) continue;
        if (localOffset <= candidate.length) {
          textNode = candidate;
          break;
        }
        localOffset -= candidate.length;
      }
      if (textNode === null) throw new Error("CodeMirror text offset is unavailable");
      const range = document.createRange();
      range.setStart(textNode, localOffset);
      range.setEnd(textNode, Math.min(localOffset + 1, textNode.length));
      const rectangle = range.getBoundingClientRect();
      return {
        x: rectangle.left + Math.max(1, rectangle.width / 2),
        y: rectangle.top + rectangle.height / 2,
      };
    },
    offset,
  );
  await page.mouse.click(point.x, point.y, { button: "right" });
}

async function openContinuityTab(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "작품 작업면" })
    .getByRole("button", { name: "별빛", exact: true }).click();
  const workspace = page.getByRole("region", { name: "별빛 작업" });
  await workspace.getByRole("tab", { name: "연속성", exact: true }).click();
  await expect(workspace.getByRole("tab", { name: "연속성", exact: true }))
    .toHaveAttribute("aria-selected", "true");
}

function seedContinuityCandidate(input: Readonly<{
  databasePath: string;
  exactText: string;
  from: number;
  title: string;
}>) {
  const database = new DatabaseSync(input.databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
    const target = database.prepare(`
      SELECT
        work.id AS "workId", document.id AS "documentId",
        manuscript.current_revision_id AS "documentRevisionId"
      FROM works AS work
      JOIN documents AS document ON document.work_id = work.id
      JOIN manuscripts AS manuscript ON manuscript.document_id = document.id
      WHERE work.retired_at IS NULL AND document.retired_at IS NULL
      ORDER BY work.created_at, document.created_at LIMIT 1
    `).get() as Readonly<{
      workId: string;
      documentId: string;
      documentRevisionId: string;
    }> | undefined;
    if (target === undefined) throw new Error("Continuity E2E target is unavailable");
    const receiptId = randomUUID();
    const candidateId = randomUUID();
    const itemId = randomUUID();
    const now = "2026-08-29T05:00:00.000Z";
    const sourceRange = [{
      documentId: target.documentId,
      documentRevisionId: target.documentRevisionId,
      from: input.from,
      to: input.from + input.exactText.length,
    }];
    database.prepare(`
      INSERT INTO assistant_context_receipts (
        id, schema_version, request_id, work_id, conversation_id,
        capability, destination_id, read_ranges_json, transmitted_ranges_json,
        read_character_count, transmitted_character_count, grant_ids_json, created_at
      ) VALUES (?, 1, ?, ?, ?, 'continuity.review', ?, ?, ?, ?, ?, '[]', ?)
    `).run(
      receiptId,
      randomUUID(),
      target.workId,
      randomUUID(),
      "e2e-continuity",
      JSON.stringify(sourceRange),
      JSON.stringify(sourceRange),
      input.exactText.length,
      input.exactText.length,
      now,
    );
    database.prepare(`
      INSERT INTO assistant_continuity_review_candidates (
        id, schema_version, revision, created_at, updated_at, retired_at,
        request_id, work_id, source_document_id, source_document_revision_id,
        source_from, source_to, provider_id, model_id, prompt_version,
        context_receipt_id, status
      ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')
    `).run(
      candidateId,
      now,
      now,
      randomUUID(),
      target.workId,
      target.documentId,
      target.documentRevisionId,
      input.from,
      input.from + input.exactText.length,
      "e2e-provider",
      "e2e-model",
      "eum-continuity-review-v1",
      receiptId,
    );
    database.prepare(`
      INSERT INTO assistant_continuity_review_items (
        id, schema_version, work_id, candidate_id, assertion_basis,
        thread_kind, title, note, subject_refs_json, reason,
        potential_duplicate_thread_ids_json, status, applied_thread_id,
        created_at, updated_at
      ) VALUES (?, 1, ?, ?, 'explicit-evidence', 'open-question', ?, ?, '[]', ?,
        '[]', 'pending', NULL, ?, ?)
    `).run(
      itemId,
      target.workId,
      candidateId,
      input.title,
      "원고에서 직접 확인된 질문",
      "질문이 원문에 직접 남아 있다.",
      now,
      now,
    );
    database.prepare(`
      INSERT INTO assistant_continuity_review_evidence (
        id, schema_version, work_id, candidate_id, item_id,
        source_document_id, source_document_revision_id, source_from,
        source_to, exact_text, anchor_id, order_index
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
    `).run(
      randomUUID(),
      target.workId,
      candidateId,
      itemId,
      target.documentId,
      target.documentRevisionId,
      input.from,
      input.from + input.exactText.length,
      input.exactText,
    );
    database.exec("COMMIT");
  } catch (reason) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw reason;
  } finally {
    database.close();
  }
}

test("runs the packaged Continuity manual, integrated-source, Candidate, and restart flows", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-studio-continuity-e2e-"));
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `연속성 작품 ${suffix}`;
  const documentTitle = `회차 ${suffix}`;
  const prefix = "윤서는 ";
  const exactText = `북문에서 다시 만나자 ${suffix}`;
  const manuscriptText = `${prefix}${exactText}고 약속했다. 열쇠의 주인은 누구인가.`;
  const manualTitle = `북문 약속 ${suffix}`;
  const candidateTitle = `열쇠 질문 ${suffix}`;
  const argumentsList = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const environment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
  };
  let electronApp = await electron.launch({
    args: argumentsList,
    cwd: process.cwd(),
    env: environment,
  });
  attachElectronDiagnostics(electronApp);
  let flowCompleted = false;
  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await page.evaluate(async ({ plotTitle, foreshadowTitle }) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected active Work");
      await window.eumStudio.characters.create({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
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
      });
      await window.eumStudio.plots.create({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        title: plotTitle,
        stage: "planned",
        summary: "북문으로 향한다.",
        note: "",
      });
      await window.eumStudio.foreshadowing.createLine({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        title: foreshadowTitle,
        note: "잠긴 문을 회수한다.",
      });
    }, {
      plotTitle: `북문 플롯 ${suffix}`,
      foreshadowTitle: `잠긴 문 ${suffix}`,
    });

    await selectExactRange(manuscript, prefix.length, exactText);
    await rightClickOffset(page, manuscript, prefix.length + 1);
    const contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await contextMenu.getByRole("menuitem", {
      name: "열린 연속성으로 저장",
      exact: true,
    }).click();
    let continuityWorkspace = page.getByRole("region", { name: "별빛 작업" });
    await expect(continuityWorkspace.getByRole("tab", { name: "연속성" }))
      .toHaveAttribute("aria-selected", "true");
    const composer = page.getByRole("region", { name: "연속성 메모 만들기" });
    await expect(composer).toContainText(exactText);
    await composer.getByLabel("제목").fill(manualTitle);
    await composer.getByLabel("메모").fill("다음 회차에서 확인");
    await composer.getByRole("button", { name: "연속성 메모 저장", exact: true }).click();
    await expect(continuityWorkspace).toContainText("연속성 메모를 저장했습니다.");
    await expect(continuityWorkspace).toContainText(manualTitle);
    await expect(continuityWorkspace).toContainText("원본: 플롯");
    await expect(continuityWorkspace).toContainText("원본: 복선");
    await expect(continuityWorkspace).toContainText("원본: 인물 목표");
    const radar = page.getByRole("region", { name: "연속성 레이더" });
    await expect(radar).toContainText("A · 구조 분석");
    await expect(radar).toContainText(manualTitle);
    await expect(radar).toContainText(documentTitle);
    await expect(radar.getByRole("button", { name: "원문 열기", exact: true }))
      .toBeVisible();
    const radarLayout = await radar.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(radarLayout.left).toBeGreaterThanOrEqual(0);
    expect(radarLayout.top).toBeGreaterThanOrEqual(0);
    expect(radarLayout.right).toBeLessThanOrEqual(radarLayout.viewportWidth + 1);
    expect(radarLayout.bottom).toBeLessThanOrEqual(radarLayout.viewportHeight + 1);
    expect(radarLayout.scrollWidth).toBeLessThanOrEqual(radarLayout.clientWidth + 1);
    const layout = await page.locator(".continuity-main-grid").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.top).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

    await closeElectron(electronApp);
    seedContinuityCandidate({
      databasePath: path.join(directory, "workspace.sqlite3"),
      exactText: "열쇠의 주인은 누구인가",
      from: manuscriptText.indexOf("열쇠의 주인은 누구인가"),
      title: candidateTitle,
    });
    electronApp = await electron.launch({
      args: argumentsList,
      cwd: process.cwd(),
      env: environment,
    });
    attachElectronDiagnostics(electronApp);
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await continueFromMain(page);
    await openContinuityTab(page);
    continuityWorkspace = page.getByRole("region", { name: "별빛 작업" });
    const candidatePanel = page.getByRole("region", { name: "AI 정밀 분석" });
    await expect(candidatePanel).toContainText("B · 선택형 AI");
    await expect(candidatePanel).toContainText("승인 전 Candidate로만 보관됩니다.");
    await expect(candidatePanel).toContainText(candidateTitle);
    await candidatePanel.getByRole("button", { name: "새 메모로 승인", exact: true }).click();
    await expect(continuityWorkspace).toContainText("연속성 제안을 새 메모로 승인했습니다.");
    await expect.poll(() => page.evaluate(async (expectedTitle) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return false;
      const projection = await window.eumStudio.continuity.list({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        status: "all",
      });
      return projection.threads.some((thread) => thread.title === expectedTitle);
    }, candidateTitle)).toBe(true);

    await closeElectron(electronApp);
    electronApp = await electron.launch({
      args: argumentsList,
      cwd: process.cwd(),
      env: environment,
    });
    attachElectronDiagnostics(electronApp);
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await continueFromMain(page);
    await openContinuityTab(page);
    await expect(page.getByRole("region", { name: "별빛 작업" })).toContainText(manualTitle);
    await expect(page.getByRole("region", { name: "별빛 작업" })).toContainText(candidateTitle);
    flowCompleted = true;
  } finally {
    await closeElectron(electronApp).catch(() => undefined);
    if (flowCompleted) {
      const databasePath = path.join(directory, "workspace.sqlite3");
      const audit = new DatabaseSync(databasePath, { readOnly: true });
      try {
        const counts = audit.prepare(`
          SELECT
            (SELECT COUNT(*) FROM continuity_threads) AS threads,
            (SELECT COUNT(*) FROM continuity_thread_history) AS history,
            (SELECT COUNT(*) FROM continuity_thread_evidence) AS evidence,
            (SELECT COUNT(*) FROM assistant_continuity_review_decisions) AS decisions,
            (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations
        `).get() as Record<string, number>;
        expect(counts.threads).toBe(2);
        expect(counts.history).toBe(2);
        expect(counts.evidence).toBe(2);
        expect(counts.decisions).toBe(1);
        expect(counts.foreignKeyViolations).toBe(0);
      } finally {
        audit.close();
      }
    }
    await removeVerifiedTemporaryDirectory(directory);
  }
});
