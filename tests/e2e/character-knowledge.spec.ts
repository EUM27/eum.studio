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
    process.stderr.write(`[knowledge-e2e electron stdout] ${String(chunk)}`);
  });
  app.process().stderr?.on("data", (chunk) => {
    process.stderr.write(`[knowledge-e2e electron stderr] ${String(chunk)}`);
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

async function openKnowledgeTab(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "작품 작업면" })
    .getByRole("button", { name: "별빛", exact: true }).click();
  const workspace = page.getByRole("region", { name: "별빛 작업" });
  await workspace.getByRole("tab", { name: "인물 지식", exact: true }).click();
  await expect(workspace.getByRole("tab", { name: "인물 지식", exact: true }))
    .toHaveAttribute("aria-selected", "true");
}

test("runs packaged CharacterKnowledge exact evidence, supersession, POV, and restart flows", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-studio-knowledge-e2e-"));
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `지식 작품 ${suffix}`;
  const documentTitle = `회차 ${suffix}`;
  const prefix = "윤서는 ";
  const exactText = `열쇠가 북문을 연다고 믿었다 ${suffix}`;
  const manuscriptText = `${prefix}${exactText}.`;
  const falseStatement = `열쇠는 북문을 연다 ${suffix}`;
  const trueStatement = `열쇠는 남문을 연다 ${suffix}`;
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
    await page.evaluate(async () => {
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
        goal: "",
        conflict: "",
        note: "",
      });
    });

    await closeElectron(electronApp);
    electronApp = await electron.launch({ args: argumentsList, cwd: process.cwd(), env: environment });
    attachElectronDiagnostics(electronApp);
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await continueFromMain(page);
    const resumedManuscript = page.getByRole("textbox", { name: "원고" });
    await selectExactRange(resumedManuscript, prefix.length, exactText);
    await rightClickOffset(page, resumedManuscript, prefix.length + 1);
    await page.getByRole("menu", { name: "원고 우클릭 메뉴" })
      .getByRole("menuitem", { name: "인물 지식으로 저장", exact: true }).click();

    const workspace = page.getByRole("region", { name: "별빛 작업" });
    await expect(workspace.getByRole("tab", { name: "인물 지식", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    const composer = page.getByRole("region", { name: "선택 원문을 인물 지식으로 저장" });
    await expect(composer).toContainText(exactText);
    const createForm = page.getByRole("form", { name: "선택 인물 지식 저장" });
    await createForm.getByLabel("대상 인물").selectOption({ label: "윤서" });
    await createForm.getByLabel("내용").fill(falseStatement);
    await createForm.getByLabel("인물의 인식").selectOption("believes");
    await createForm.getByLabel("객관적 사실 여부").selectOption("false");
    await createForm.getByRole("button", { name: "인물 지식 저장", exact: true }).click();
    await expect(workspace).toContainText("인물 지식을 저장했습니다.");
    await expect(workspace).toContainText(falseStatement);
    await expect(workspace).toContainText("객관적으로 거짓");
    await expect(workspace).toContainText(exactText);

    const supersedeForm = page.getByRole("form", { name: "인물 지식 새 상태" });
    await supersedeForm.getByLabel("내용").fill(trueStatement);
    await supersedeForm.getByLabel("인물의 인식").selectOption("knows");
    await supersedeForm.getByLabel("객관적 사실 여부").selectOption("true");
    await supersedeForm.getByRole("button", {
      name: "이전 상태 보존 후 새 상태 만들기",
      exact: true,
    }).click();
    await expect(workspace).toContainText("이전 상태를 보존하고 새 인식 상태를 만들었습니다.");
    await expect(workspace).toContainText(trueStatement);
    await expect(workspace).toContainText("객관적 사실");

    const povForm = page.getByRole("form", { name: "POV 인물 선택" });
    await povForm.getByLabel("POV 인물").selectOption({ label: "윤서" });
    await povForm.getByRole("button", { name: "문맥 보기", exact: true }).click();
    const povColumn = page.getByRole("complementary", { name: "POV 지식 문맥" });
    await expect(povColumn).toContainText("작품의 객관적 사실");
    await expect(povColumn).toContainText("POV 인물이 아는 정보");
    await expect(povColumn).toContainText(trueStatement);

    const layout = await page.locator(".character-knowledge-grid").evaluate((element) => {
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
    electronApp = await electron.launch({ args: argumentsList, cwd: process.cwd(), env: environment });
    attachElectronDiagnostics(electronApp);
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await continueFromMain(page);
    await openKnowledgeTab(page);
    const restartedWorkspace = page.getByRole("region", { name: "별빛 작업" });
    await expect(restartedWorkspace).toContainText(trueStatement);
    await restartedWorkspace.getByLabel("상태", { exact: true }).selectOption("history");
    await expect(restartedWorkspace).toContainText(falseStatement);
    await expect.poll(() => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return null;
      const characters = await window.eumStudio.characters.list({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      const character = characters.characters.find((entry) => entry.name === "윤서");
      if (character === undefined) return null;
      const pov = await window.eumStudio.characterKnowledge.projectPov({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        characterId: character.characterId,
      });
      return {
        objective: pov.objectiveFacts.length,
        known: pov.povKnown.length,
        falseBeliefs: pov.povFalseBeliefs.length,
        unavailable: pov.povUnavailable.length,
      };
    })).toEqual({ objective: 1, known: 1, falseBeliefs: 0, unavailable: 0 });
    flowCompleted = true;
  } finally {
    await closeElectron(electronApp).catch(() => undefined);
    if (flowCompleted) {
      const audit = new DatabaseSync(path.join(directory, "workspace.sqlite3"), { readOnly: true });
      try {
        const counts = audit.prepare(`
          SELECT
            (SELECT COUNT(*) FROM character_knowledge) AS knowledge,
            (SELECT COUNT(*) FROM character_knowledge_history) AS history,
            (SELECT COUNT(*) FROM character_knowledge_evidence) AS evidence,
            (SELECT COUNT(*)
              FROM character_knowledge_evidence AS evidence_row
              JOIN anchors AS anchor ON anchor.id = evidence_row.anchor_id
              WHERE anchor.exact_quote = ?) AS exactAnchors,
            (SELECT COUNT(*) FROM character_knowledge WHERE status = 'active') AS active,
            (SELECT COUNT(*) FROM character_knowledge WHERE status = 'superseded') AS superseded,
            (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations
        `).get(exactText) as Record<string, number>;
        expect(counts).toEqual({
          knowledge: 2,
          history: 3,
          evidence: 1,
          exactAnchors: 1,
          active: 1,
          superseded: 1,
          foreignKeyViolations: 0,
        });
      } finally {
        audit.close();
      }
    }
    await removeVerifiedTemporaryDirectory(directory);
  }
});
