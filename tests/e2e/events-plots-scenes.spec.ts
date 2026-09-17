import {
  randomUUID,
  mkdtemp,
  tmpdir,
  path,
  expect,
  test,
  electron,
  openStudioWorkspace,
  continueFromMain,
  openReviewRail,
  openWorkSection,
  openStructureTab,
  createNamedEpisode,
  expectEditorText,
  readHangulCompositionText,
  readEditorText,
  removeVerifiedTemporaryDirectory,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";
test("keeps an anchorless event while its exact source is linked, replaced, retired, and restarted", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-event-source-e2e-"),
  );
  const workTitle = `사건 근거 작품-${randomUUID().slice(0, 8)}`;
  const documentTitle = `사건 근거 회차-${randomUUID().slice(0, 8)}`;
  const eventTitle = `예정 사건-${randomUUID().slice(0, 8)}`;
  const prefix = "도입부 ";
  const firstQuote = `첫 근거 ${randomUUID().slice(0, 8)}`;
  const middle = " 사이 문장 ";
  const secondQuote = `교체 근거 ${randomUUID().slice(0, 8)}`;
  const manuscriptText = `${prefix}${firstQuote}${middle}${secondQuote} 마무리`;
  const firstFrom = prefix.length;
  const secondFrom = prefix.length + firstQuote.length + middle.length;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const selectExactRange = async (
    manuscript: Locator,
    from: number,
    text: string,
  ) => {
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < from; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < text.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(text);
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByLabel("사건 메모").fill("원고 연결 전 사건");
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();

    await openStructureTab(page, "사건");
    let eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    let eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await expect(eventRow).toContainText("원고 미연결");
    await openWorkSection(page, "쓰기");
    await selectExactRange(manuscript, firstFrom, firstQuote);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "현재 선택 연결", exact: true })
      .click();
    await expect(eventRow).toContainText(`${firstFrom}–${firstFrom + firstQuote.length}`);

    const linkedProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(linkedProjection.eventBlocks).toHaveLength(1);
    expect(linkedProjection.eventSources).toHaveLength(1);
    expect(linkedProjection.eventSources[0]?.anchors[0]?.exactQuote).toBe(firstQuote);
    const linkedSourceId = linkedProjection.eventSources[0]!.eventSourceId;

    await openWorkSection(page, "쓰기");
    await selectExactRange(manuscript, secondFrom, secondQuote);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "현재 선택으로 교체", exact: true })
      .click();
    await expect(eventRow).toContainText(
      `${secondFrom}–${secondFrom + secondQuote.length}`,
    );
    const replacedProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(replacedProjection.eventSources).toHaveLength(1);
    expect(replacedProjection.eventSources[0]?.eventSourceId).not.toBe(linkedSourceId);
    expect(replacedProjection.eventSources[0]?.anchors[0]?.exactQuote).toBe(secondQuote);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow.getByRole("button", { name: new RegExp(eventTitle) }).click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(secondQuote);

    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "원고 근거 해제", exact: true })
      .click();
    await expect(eventRow).toContainText("원고 미연결");
    const retiredProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(retiredProjection.eventBlocks).toHaveLength(1);
    expect(retiredProjection.eventSources).toEqual([]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "사건");
    eventRow = page
      .getByRole("region", { name: "현재 회차 사건" })
      .locator("li")
      .filter({ hasText: eventTitle });
    await expect(eventRow).toContainText("원고 미연결");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps exact-selection event creation after the EventSource split", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-exact-event-source-e2e-"),
  );
  const workTitle = `선택 사건 작품-${randomUUID().slice(0, 8)}`;
  const documentTitle = `선택 사건 회차-${randomUUID().slice(0, 8)}`;
  const eventTitle = `선택 사건-${randomUUID().slice(0, 8)}`;
  const prefix = "앞 문장 ";
  const exactQuote = `정확한 사건 근거 ${randomUUID().slice(0, 8)}`;
  const manuscriptText = `${prefix}${exactQuote} 뒤 문장`;
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

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+Home");
    for (let index = 0; index < prefix.length; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < exactQuote.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactQuote);

    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByLabel("사건 메모").fill("선택 생성 회귀");
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();

    const projection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    const eventBlock = projection.eventBlocks.find(
      (candidate) => candidate.title === eventTitle,
    );
    expect(eventBlock).toBeDefined();
    expect(eventBlock).not.toHaveProperty("rangeGroupId");
    const source = projection.eventSources.find(
      (candidate) => candidate.eventBlockId === eventBlock?.eventBlockId,
    );
    expect(source?.role).toBe("primary");
    expect(source?.anchors[0]?.exactQuote).toBe(exactQuote);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    await page
      .getByRole("region", { name: "현재 회차 사건" })
      .getByRole("button", { name: new RegExp(eventTitle) })
      .click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactQuote);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps bidirectional plot/event links, independent titles, unlinking, and restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-event-link-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `플롯 사건 작품-${suffix}`;
  const documentTitle = `플롯 사건 회차-${suffix}`;
  const eventTitle = `첫 사건-${suffix}`;
  const changedPlotTitle = `독립 플롯-${suffix}`;
  const supportingEventTitle = `보조 사건-${suffix}`;
  const plannedPlotTitle = `예정 플롯-${suffix}`;
  const exactPlotTitle = `선택 플롯-${suffix}`;
  const prefix = "도입 ";
  const firstQuote = `첫 사건 근거 ${suffix}`;
  const middle = " 사이 ";
  const secondQuote = `플롯 생성 근거 ${suffix}`;
  const manuscriptText = `${prefix}${firstQuote}${middle}${secondQuote} 마무리`;
  const firstFrom = prefix.length;
  const secondFrom = prefix.length + firstQuote.length + middle.length;
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

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const selectRange = async (from: number, text: string) => {
      await manuscript.click();
      await manuscript.press("Control+Home");
      for (let index = 0; index < from; index += 1) {
        await manuscript.press("ArrowRight");
      }
      for (let index = 0; index < text.length; index += 1) {
        await manuscript.press("Shift+ArrowRight");
      }
      await expect.poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      ).toBe(text);
    };

    await selectRange(firstFrom, firstQuote);
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    let eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByLabel("사건 메모").fill("플롯으로 복사할 사건 메모");
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();

    await openStructureTab(page, "사건");
    let eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    let eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "플롯으로 만들기", exact: true })
      .click();
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(eventTitle);
    let linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await expect(linkRegion).toContainText(eventTitle);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await expect(
      eventRow.getByRole("button", { name: "연결 플롯 열기", exact: true }),
    ).toBeVisible();
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    const afterReuse = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      const [plots, links] = await Promise.all([
        window.eumStudio.plots.list({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
        window.eumStudio.plots.listEventLinks({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
      ]);
      return { plots: plots.plots, links: links.links };
    });
    expect(afterReuse.plots).toHaveLength(1);
    expect(afterReuse.links).toHaveLength(1);

    await plotDialog.getByLabel("플롯 제목").fill(changedPlotTitle);
    await plotDialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await expect(linkRegion.getByText("제목이 서로 다름", { exact: true }))
      .toBeVisible();
    await expect(linkRegion).toContainText(eventTitle);
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    eventDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await eventDialog.getByLabel("사건 제목").fill(supportingEventTitle);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(eventDialog).toBeHidden();
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("연결할 사건").selectOption({
      label: supportingEventTitle,
    });
    await plotDialog.getByLabel("사건 연결 역할").selectOption("supporting");
    await plotDialog
      .getByRole("button", { name: "사건 연결", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    let supportingLinkRow = linkRegion.locator("li").filter({
      hasText: supportingEventTitle,
    });
    await expect(supportingLinkRow).toContainText("보조 사건");
    await supportingLinkRow
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(supportingLinkRow).toHaveCount(0);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    await expect(
      eventRegion.locator("li").filter({ hasText: supportingEventTitle }),
    ).toBeVisible();

    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("연결할 사건").selectOption({
      label: supportingEventTitle,
    });
    await plotDialog.getByLabel("사건 연결 역할").selectOption("supporting");
    await plotDialog
      .getByRole("button", { name: "사건 연결", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    supportingLinkRow = linkRegion.locator("li").filter({
      hasText: supportingEventTitle,
    });
    await expect(supportingLinkRow).toBeVisible();

    await plotDialog.getByRole("button", { name: "새 플롯", exact: true }).click();
    await plotDialog.getByLabel("플롯 제목").fill(plannedPlotTitle);
    await plotDialog.getByLabel("플롯 요약").fill("예정 사건 메모");
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "예정 사건 만들기", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await expect(linkRegion).toContainText(plannedPlotTitle);
    await openWorkSection(page, "쓰기");
    await selectRange(secondFrom, secondQuote);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByRole("button", { name: "새 플롯", exact: true }).click();
    await plotDialog.getByLabel("플롯 제목").fill(exactPlotTitle);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "현재 선택으로 사건 만들기", exact: true })
      .click();
    const beforeRestart = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      const [events, links] = await Promise.all([
        window.eumStudio.structure.listEventBlocks({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
        window.eumStudio.plots.listEventLinks({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
      ]);
      return { events, links: links.links };
    });
    expect(beforeRestart.links).toHaveLength(4);
    expect(beforeRestart.events.eventBlocks.find(
      (event) => event.title === eventTitle,
    )?.title).toBe(eventTitle);
    const exactEvent = beforeRestart.events.eventBlocks.find(
      (event) => event.title === exactPlotTitle,
    );
    expect(beforeRestart.events.eventSources.find(
      (source) => source.eventBlockId === exactEvent?.eventBlockId,
    )?.anchors[0]?.exactQuote).toBe(secondQuote);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(changedPlotTitle);
    const restartedPrimaryLinkRow = plotDialog
      .getByRole("region", { name: "플롯 연결 사건" })
      .locator("li")
      .filter({ hasText: eventTitle });
    await expect(
      restartedPrimaryLinkRow.getByText("제목이 서로 다름", { exact: true }),
    ).toBeVisible();
    const restartedLinks = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      return window.eumStudio.plots.listEventLinks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(restartedLinks.links).toHaveLength(4);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the movable plot board as the primary plot workspace and persists moves", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-primary-plot-board-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `주 플롯 작업면-${suffix}`;
  const documentTitle = `주 플롯 회차-${suffix}`;
  const firstPlotTitle = `첫 이동 플롯-${suffix}`;
  const secondPlotTitle = `둘째 이동 플롯-${suffix}`;
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

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await openStructureTab(page, "플롯");
    let plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    let plotSurface = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    let boardRegion = plotSurface.getByRole("region", { name: "플롯 보드" });
    await expect(boardRegion).toBeVisible();
    await expect(boardRegion).toContainText("카드를 끌어 순서를 옮기고");

    await plotSurface.getByLabel("플롯 제목").fill(firstPlotTitle);
    await plotSurface
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotSurface
      .getByRole("button", { name: "새 플롯", exact: true })
      .click();
    await plotSurface.getByLabel("플롯 제목").fill(secondPlotTitle);
    await plotSurface
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();

    let boardCards = boardRegion.locator(
      ".plot-board-lane > ol > li[data-plot-placement-id]",
    );
    let boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardCardTitles).toHaveText([firstPlotTitle, secondPlotTitle]);

    const primaryPanelBounds = await plotSurface
      .locator(".plot-manager-list")
      .boundingBox();
    const detailPanelBounds = await plotSurface
      .locator(".plot-manager-detail")
      .boundingBox();
    if (primaryPanelBounds === null || detailPanelBounds === null) {
      throw new Error("Expected visible plot workspace panels");
    }
    expect(primaryPanelBounds.width).toBeGreaterThan(detailPanelBounds.width);

    const dragSource = boardCards.nth(1).locator(".plot-board-card-select");
    const dragTarget = boardCards.nth(0).locator(".plot-board-card-select");
    const dragSourceBounds = await dragSource.boundingBox();
    const dragTargetBounds = await dragTarget.boundingBox();
    if (dragSourceBounds === null || dragTargetBounds === null) {
      throw new Error("Expected visible movable plot cards");
    }
    await page.mouse.move(
      dragSourceBounds.x + dragSourceBounds.width / 2,
      dragSourceBounds.y + dragSourceBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      dragTargetBounds.x + dragTargetBounds.width / 2,
      dragTargetBounds.y + dragTargetBounds.height * 0.25,
      { steps: 4 },
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "true");
    await page.mouse.up();
    await expect(boardCardTitles).toHaveText([secondPlotTitle, firstPlotTitle]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "플롯");
    plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    plotSurface = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    boardRegion = plotSurface.getByRole("region", { name: "플롯 보드" });
    boardCards = boardRegion.locator(
      ".plot-board-lane > ol > li[data-plot-placement-id]",
    );
    boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardRegion).toBeVisible();
    await expect(boardCardTitles).toHaveText([secondPlotTitle, firstPlotTitle]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("moves default plot board placements without moving exact manuscript evidence and keeps the order after restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-board-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = "플롯 보드 작품-" + suffix;
  const documentTitle = "플롯 보드 회차-" + suffix;
  const firstEventTitle = "첫 보드 사건-" + suffix;
  const secondEventTitle = "둘째 보드 사건-" + suffix;
  const prefix = "도입 ";
  const firstQuote = "첫 보드 근거 " + suffix;
  const middle = " 사이 ";
  const secondQuote = "둘째 보드 근거 " + suffix;
  const manuscriptText = prefix + firstQuote + middle + secondQuote + " 마무리";
  const firstFrom = prefix.length;
  const secondFrom = prefix.length + firstQuote.length + middle.length;
  const electronArguments = [
    ".",
    "--user-data-dir=" + path.join(directory, "electron-user-data"),
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

  const selectExactRange = async (
    manuscript: Locator,
    from: number,
    text: string,
  ) => {
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < from; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < text.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(text);
  };
  const createSelectedEvent = async (
    page: Page,
    manuscript: Locator,
    from: number,
    quote: string,
    title: string,
  ) => {
    await selectExactRange(manuscript, from, quote);
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(title);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(eventDialog).toBeHidden();
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await createSelectedEvent(
      page,
      manuscript,
      firstFrom,
      firstQuote,
      firstEventTitle,
    );
    await createSelectedEvent(
      page,
      manuscript,
      secondFrom,
      secondQuote,
      secondEventTitle,
    );

    await openStructureTab(page, "사건");
    let eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    let firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    let secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await firstEventRow
      .getByRole("button", { name: "플롯으로 만들기", exact: true })
      .click();
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await secondEventRow
      .getByRole("button", { name: "플롯으로 만들기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    let boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    let boardCards = boardRegion.locator(".plot-board-lane > ol > li");
    await expect(boardCards).toHaveCount(2);
    await expect(boardCards.nth(0)).toContainText(firstEventTitle);
    await expect(boardCards.nth(1)).toContainText(secondEventTitle);

    await boardCards.nth(1)
      .getByRole("button", { name: "앞으로 이동", exact: true })
      .click();
    await expect(boardCards.nth(0)).toContainText(secondEventTitle);
    await expect(boardCards.nth(1)).toContainText(firstEventTitle);
    const linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await linkRegion
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(linkRegion).toContainText("이 플롯에 연결된 사건이 없습니다.");
    await expect(boardCards).toHaveCount(2);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await firstEventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    boardCards = boardRegion.locator(".plot-board-lane > ol > li");
    await expect(boardCards).toHaveCount(2);
    await expect(boardCards.nth(0)).toContainText(secondEventTitle);
    await expect(boardCards.nth(1)).toContainText(firstEventTitle);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await expect(
      secondEventRow.getByRole("button", { name: "플롯으로 만들기", exact: true }),
    ).toBeVisible();
    await firstEventRow.getByRole("button", { name: new RegExp(firstEventTitle) }).click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(firstQuote);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("drags plot placements with local preview, cancellation, keyboard movement, and conflict rollback", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-drag-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `플롯 드래그 작품-${suffix}`;
  const documentTitle = `플롯 드래그 회차-${suffix}`;
  const plotTitles = [
    `첫 드래그 플롯-${suffix}`,
    `둘째 드래그 플롯-${suffix}`,
    `셋째 드래그 플롯-${suffix}`,
    `넷째 드래그 플롯-${suffix}`,
    `다섯째 드래그 플롯-${suffix}`,
    `여섯째 드래그 플롯-${suffix}`,
    `일곱째 드래그 플롯-${suffix}`,
  ] as const;
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

  const readBoard = async (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.plots.getDefaultBoard({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });
  const pointerPosition = async (
    locator: Locator,
    verticalFraction = 0.5,
  ) => {
    const bounds = await locator.boundingBox();
    if (bounds === null) throw new Error("Expected a visible plot card");
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height * verticalFraction,
    };
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });

    for (const [index, title] of plotTitles.entries()) {
      if (index > 0) {
        await plotDialog
          .getByRole("button", { name: "새 플롯", exact: true })
          .click();
      }
      await plotDialog.getByLabel("플롯 제목").fill(title);
      await plotDialog
        .getByRole("button", { name: "플롯 만들기", exact: true })
        .click();
      await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(title);
    }

    let boardRegion = plotDialog.getByRole("region", {
      name: "플롯 보드",
      exact: true,
    });
    let boardCards = boardRegion.locator("[data-plot-placement-id]");
    let boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardCardTitles).toHaveText(plotTitles);
    const plotList = plotDialog.getByRole("region", { name: "플롯 목록" });
    await plotList.evaluate((element) => {
      element.scrollTop = 0;
    });

    const boardBeforeThreshold = await readBoard(page);
    let sourceSelect = boardCards.nth(2).locator(".plot-board-card-select");
    let sourcePoint = await pointerPosition(sourceSelect);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(sourcePoint.x + 5, sourcePoint.y);
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(0);
    await page.mouse.up();
    const boardAfterThreshold = await readBoard(page);
    expect(boardAfterThreshold.revision).toBe(boardBeforeThreshold.revision);
    expect(boardAfterThreshold.lanes[0]?.placements.map(
      (placement) => placement.plotBeat.title,
    )).toEqual(plotTitles);

    await plotList.evaluate((element) => {
      element.scrollTop = 0;
    });
    sourceSelect = boardCards.nth(0).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    const listBounds = await plotList.boundingBox();
    if (listBounds === null) throw new Error("Expected the plot list to be visible");
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(
      sourcePoint.x,
      listBounds.y + listBounds.height - 5,
      { steps: 4 },
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "true");
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    const plotListScroll = await plotList.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }));
    if (plotListScroll.scrollHeight > plotListScroll.clientHeight) {
      expect(plotListScroll.scrollTop).toBeGreaterThan(0);
    }
    await page.keyboard.press("Escape");
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(0);
    await page.mouse.up();
    const boardAfterEscape = await readBoard(page);
    expect(boardAfterEscape.revision).toBe(boardBeforeThreshold.revision);

    await plotList.evaluate((element) => {
      element.scrollTop = 0;
    });
    sourceSelect = boardCards.nth(2).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    let targetSelect = boardCards.nth(0).locator(".plot-board-card-select");
    let targetPoint = await pointerPosition(targetSelect, 0.25);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await sourceSelect.dispatchEvent("pointercancel", {
      bubbles: true,
      pointerId: 1,
    });
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await page.mouse.up();
    const boardAfterPointerCancel = await readBoard(page);
    expect(boardAfterPointerCancel.revision).toBe(boardBeforeThreshold.revision);

    sourceSelect = boardCards.nth(2).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    targetSelect = boardCards.nth(0).locator(".plot-board-card-select");
    targetPoint = await pointerPosition(targetSelect, 0.25);
    const boardBeforeDrop = await readBoard(page);
    const movedBeforeDrop = boardBeforeDrop.lanes[0]?.placements.find(
      (placement) => placement.plotBeat.title === plotTitles[2],
    );
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
    await expect(boardRegion).toHaveAttribute("data-drag-active", "true");
    await expect(sourceSelect.locator("xpath=..")).toHaveClass(
      /is-drag-preview-source/u,
    );
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await page.mouse.up();
    const expectedAfterDrop = [
      plotTitles[2],
      plotTitles[0],
      plotTitles[1],
      ...plotTitles.slice(3),
    ];
    await expect(boardCardTitles).toHaveText(expectedAfterDrop);
    const boardAfterDrop = await readBoard(page);
    const movedAfterDrop = boardAfterDrop.lanes[0]?.placements.find(
      (placement) => placement.plotBeat.title === plotTitles[2],
    );
    expect(boardAfterDrop.revision).toBe(boardBeforeDrop.revision + 1);
    expect(movedAfterDrop?.revision).toBe((movedBeforeDrop?.revision ?? 0) + 1);
    for (const placement of boardBeforeDrop.lanes[0]?.placements ?? []) {
      if (placement.plotBeat.title === plotTitles[2]) continue;
      expect(boardAfterDrop.lanes[0]?.placements.find(
        (candidate) => candidate.plotPlacementId === placement.plotPlacementId,
      )?.revision).toBe(placement.revision);
    }

    const firstPlotCard = boardCards.filter({ hasText: plotTitles[0] });
    const boardBeforeKeyboard = await readBoard(page);
    await firstPlotCard.locator(".plot-board-card-select").press("Alt+ArrowDown");
    const expectedAfterKeyboard = [
      plotTitles[2],
      plotTitles[1],
      plotTitles[0],
      ...plotTitles.slice(3),
    ];
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);
    const boardAfterKeyboard = await readBoard(page);
    expect(boardAfterKeyboard.revision).toBe(boardBeforeKeyboard.revision + 1);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "플롯");
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    boardRegion = plotDialog.getByRole("region", {
      name: "플롯 보드",
      exact: true,
    });
    boardCards = boardRegion.locator("[data-plot-placement-id]");
    boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);

    const staleBoard = await readBoard(page);
    const staleLane = staleBoard.lanes[0];
    if (staleLane === undefined) throw new Error("Expected a default plot lane");
    const externallyMoved = staleLane.placements.find(
      (placement) => placement.plotBeat.title === plotTitles[0],
    );
    const staleFirst = staleLane.placements[0];
    if (externallyMoved === undefined || staleFirst === undefined) {
      throw new Error("Expected plot placements for the conflict fixture");
    }
    const authoritativeAfterExternalMove = await page.evaluate(
      async ({
        workId,
        boardId,
        laneId,
        placementId,
        afterPlacementId,
        placementRevision,
        boardRevision,
      }) => window.eumStudio.plots.movePlacement({
        schemaVersion: 1,
        workId,
        plotPlacementId: placementId,
        targetBoardId: boardId,
        targetLaneId: laneId,
        afterPlacementId,
        expectedPlacementRevision: placementRevision,
        expectedBoardRevision: boardRevision,
      }),
      {
        workId: staleBoard.workId,
        boardId: staleBoard.plotBoardId,
        laneId: staleLane.plotLaneId,
        placementId: externallyMoved.plotPlacementId,
        afterPlacementId: staleFirst.plotPlacementId,
        placementRevision: externallyMoved.revision,
        boardRevision: staleBoard.revision,
      },
    );
    expect(authoritativeAfterExternalMove.lanes[0]?.placements.map(
      (placement) => placement.plotBeat.title,
    )).toEqual([
      plotTitles[0],
      plotTitles[2],
      plotTitles[1],
      ...plotTitles.slice(3),
    ]);
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);

    sourceSelect = boardCards.nth(0).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    targetSelect = boardCards.nth(1).locator(".plot-board-card-select");
    targetPoint = await pointerPosition(targetSelect, 0.75);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await page.mouse.up();
    await expect(plotDialog.getByRole("alert")).toHaveText(
      "플롯 배치 순서가 달라졌습니다. 다시 열어 확인하세요.",
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(0);
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);
    const boardAfterConflict = await readBoard(page);
    expect(boardAfterConflict.revision).toBe(authoritativeAfterExternalMove.revision);
    expect(boardAfterConflict.lanes[0]?.placements.map(
      (placement) => placement.plotBeat.title,
    )).toEqual(
      authoritativeAfterExternalMove.lanes[0]?.placements.map(
        (placement) => placement.plotBeat.title,
      ),
    );
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("places overlapping plots on an unsnapped normalized story-time map and preserves them across restart", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-story-time-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `시간 지도 작품-${suffix}`;
  const documentTitle = `시간 지도 회차-${suffix}`;
  const plotTitles = [
    `첫 시간 플롯-${suffix}`,
    `둘째 시간 플롯-${suffix}`,
    `셋째 시간 플롯-${suffix}`,
  ] as const;
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

  const readBoard = async (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.plots.getDefaultBoard({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });
  const dragToFraction = async (
    page: Page,
    source: Locator,
    track: Locator,
    fraction: number,
  ) => {
    const sourceBounds = await source.boundingBox();
    const trackBounds = await track.boundingBox();
    if (sourceBounds === null || trackBounds === null) {
      throw new Error("Expected visible story-time drag surfaces");
    }
    const sourcePoint = {
      x: sourceBounds.x + sourceBounds.width / 2,
      y: sourceBounds.y + sourceBounds.height / 2,
    };
    const targetPoint = {
      x: trackBounds.x + trackBounds.width * fraction,
      y: trackBounds.y + Math.min(trackBounds.height / 2, 48),
    };
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });

    for (const [index, title] of plotTitles.entries()) {
      if (index > 0) {
        await plotDialog
          .getByRole("button", { name: "새 플롯", exact: true })
          .click();
      }
      await plotDialog.getByLabel("플롯 제목").fill(title);
      await plotDialog
        .getByRole("button", { name: "플롯 만들기", exact: true })
        .click();
      await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(title);
    }

    let boardRegion = plotDialog.getByRole("region", {
      name: "플롯 보드",
      exact: true,
    });
    const boardBefore = await readBoard(page);
    const orderBefore = boardBefore.lanes[0]!.placements.map((placement) => ({
      id: placement.plotPlacementId,
      orderKey: placement.orderKey,
      revision: placement.revision,
    }));
    await boardRegion
      .getByRole("button", { name: "시간 지도", exact: true })
      .click();
    await expect(boardRegion).toHaveAttribute("data-board-view", "time-map");
    let track = boardRegion.locator('[data-story-time-track="true"]');
    await expect(track).toBeVisible();
    await expect
      .poll(async () =>
        Number(await track.getAttribute("data-story-time-point-footprint")),
      )
      .toBeGreaterThan(0);
    await expect(
      boardRegion.locator('[data-story-time-unassigned="true"]'),
    ).toHaveCount(3);

    const firstUnassigned = boardRegion
      .locator('[data-story-time-unassigned="true"]')
      .filter({ hasText: plotTitles[0] });
    await dragToFraction(page, firstUnassigned, track, 0.37416666666666665);
    const firstPreview = boardRegion.locator(
      '[data-story-time-preview="true"]',
    );
    await expect(firstPreview).toHaveCount(1);
    const firstPreviewValue = Number(
      await firstPreview.getAttribute("data-story-time"),
    );
    expect(firstPreviewValue).toBeGreaterThan(37);
    expect(firstPreviewValue).toBeLessThan(38);
    expect(Number.isInteger(firstPreviewValue)).toBe(false);
    const boardDuringFirstDrag = await readBoard(page);
    expect(boardDuringFirstDrag.revision).toBe(boardBefore.revision);
    expect(boardDuringFirstDrag.lanes[0]!.placements[0]!.storyTime).toBeNull();
    await page.mouse.up();
    await expect.poll(async () =>
      (await readBoard(page)).lanes[0]!.placements[0]!.storyTime,
    ).toBe(firstPreviewValue);

    const firstBoardAfterDrop = await readBoard(page);
    expect(firstBoardAfterDrop.revision).toBe(boardBefore.revision + 1);
    expect(firstBoardAfterDrop.lanes[0]!.placements[0]!.revision).toBe(
      orderBefore[0]!.revision + 1,
    );
    expect(firstBoardAfterDrop.lanes[0]!.placements[1]!.revision).toBe(
      orderBefore[1]!.revision,
    );

    const secondUnassigned = boardRegion
      .locator('[data-story-time-unassigned="true"]')
      .filter({ hasText: plotTitles[1] });
    await expect(secondUnassigned).toBeEnabled();
    await dragToFraction(page, secondUnassigned, track, 0.37416666666666665);
    const secondPreview = boardRegion.locator(
      '[data-story-time-preview="true"]',
    );
    await expect(secondPreview).toHaveCount(1);
    const secondPreviewValue = Number(
      await secondPreview.getAttribute("data-story-time"),
    );
    expect(Number.isInteger(secondPreviewValue)).toBe(false);
    await page.mouse.up();
    await expect.poll(async () =>
      (await readBoard(page)).lanes[0]!.placements[1]!.storyTime,
    ).toBe(secondPreviewValue);
    await expect(
      boardRegion.locator('[data-story-time-stack-level="0"]'),
    ).toHaveCount(1);
    await expect(
      boardRegion.locator('[data-story-time-stack-level="1"]'),
    ).toHaveCount(1);

    const thirdUnassigned = boardRegion
      .locator('[data-story-time-unassigned="true"]')
      .filter({ hasText: plotTitles[2] });
    await expect(thirdUnassigned).toBeEnabled();
    await dragToFraction(page, thirdUnassigned, track, 0.73125);
    const thirdPreview = boardRegion.locator(
      '[data-story-time-preview="true"]',
    );
    await expect(thirdPreview).toHaveCount(1);
    const thirdPreviewValue = Number(
      await thirdPreview.getAttribute("data-story-time"),
    );
    expect(Number.isInteger(thirdPreviewValue)).toBe(false);
    await page.mouse.up();
    await expect.poll(async () =>
      (await readBoard(page)).lanes[0]!.placements[2]!.storyTime,
    ).toBe(thirdPreviewValue);

    const boardAfterDrops = await readBoard(page);
    expect(boardAfterDrops.revision).toBe(boardBefore.revision + 3);
    expect(boardAfterDrops.lanes[0]!.placements.map((placement) => ({
      id: placement.plotPlacementId,
      orderKey: placement.orderKey,
    }))).toEqual(orderBefore.map(({ id, orderKey }) => ({ id, orderKey })));
    expect(boardAfterDrops.lanes[0]!.placements.map(
      (placement) => placement.storyTime,
    )).toEqual([firstPreviewValue, secondPreviewValue, thirdPreviewValue]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "플롯");
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    boardRegion = plotDialog.getByRole("region", {
      name: "플롯 보드",
      exact: true,
    });
    await boardRegion
      .getByRole("button", { name: "시간 지도", exact: true })
      .click();
    track = boardRegion.locator('[data-story-time-track="true"]');
    await expect(track).toBeVisible();
    await expect(
      boardRegion.locator('[data-story-time-unassigned="true"]'),
    ).toHaveCount(0);
    await expect(
      boardRegion.locator('[data-story-time-stack-level="1"]'),
    ).toHaveCount(1);
    expect((await readBoard(page)).lanes[0]!.placements.map(
      (placement) => placement.storyTime,
    )).toEqual([firstPreviewValue, secondPreviewValue, thirdPreviewValue]);

    const staleBoard = await readBoard(page);
    const staleFirst = staleBoard.lanes[0]!.placements[0]!;
    const authoritative = await page.evaluate(
      async ({
        workId,
        plotPlacementId,
        plotBoardId,
        expectedPlacementRevision,
        expectedBoardRevision,
      }) => window.eumStudio.plots.setStoryTime({
        schemaVersion: 1,
        workId,
        plotPlacementId,
        plotBoardId,
        storyTime: 82.8125,
        storyTimeEnd: null,
        expectedPlacementRevision,
        expectedBoardRevision,
      }),
      {
        workId: staleBoard.workId,
        plotPlacementId: staleFirst.plotPlacementId,
        plotBoardId: staleBoard.plotBoardId,
        expectedPlacementRevision: staleFirst.revision,
        expectedBoardRevision: staleBoard.revision,
      },
    );
    expect(authoritative.lanes[0]!.placements[0]!.storyTime).toBe(82.8125);

    const staleSecondCard = boardRegion
      .locator('.plot-story-time-card')
      .filter({ hasText: plotTitles[1] });
    await dragToFraction(page, staleSecondCard, track, 0.6125);
    await expect(
      boardRegion.locator('[data-story-time-preview="true"]'),
    ).toHaveCount(1);
    await page.mouse.up();
    await expect(plotDialog.getByRole("alert")).toHaveText(
      "플롯 이야기 시간이 달라졌습니다. 다시 열어 확인하세요.",
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await expect(staleSecondCard).toHaveAttribute(
      "data-story-time",
      String(secondPreviewValue),
    );
    const boardAfterConflict = await readBoard(page);
    expect(boardAfterConflict).toEqual(authoritative);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    expect((await readBoard(page)).lanes[0]!.placements.map(
      (placement) => placement.storyTime,
    )).toEqual([82.8125, secondPreviewValue, thirdPreviewValue]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("adds scenes and events from the manuscript right-click menu", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-context-menu-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `원고 우클릭 ${suffix}`;
  const documentTitle = `회차 ${suffix}`;
  const prefix = "도입 ";
  const exactText = `사건 범위 ${suffix}`;
  const manuscriptText = `${prefix}${exactText} 마무리`;
  const eventTitle = `우클릭 사건 ${suffix}`;
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
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const rightClickOffset = async (
    page: Page,
    manuscript: Locator,
    offset: number,
  ) => {
    const point = await manuscript.locator(".cm-line").first().evaluate(
      (line, targetOffset) => {
        const textNode = line.firstChild;
        if (!(textNode instanceof Text)) {
          throw new Error("CodeMirror line text node is missing");
        }
        const range = document.createRange();
        range.setStart(textNode, targetOffset);
        range.setEnd(textNode, Math.min(targetOffset + 1, textNode.length));
        const rectangle = range.getBoundingClientRect();
        return {
          x: rectangle.left + Math.max(1, rectangle.width / 2),
          y: rectangle.top + rectangle.height / 2,
        };
      },
      offset,
    );
    await page.mouse.click(point.x, point.y, { button: "right" });
  };

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await rightClickOffset(page, manuscript, prefix.length + 1);
    let contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await expect(contextMenu).toBeVisible();
    await contextMenu.getByRole("menuitem", {
      name: "장면 추가",
      exact: true,
    }).click();
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return 0;
      return (await window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      })).scenes.length;
    })).toBe(2);
    const secondSceneRange = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      const projection = await window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      const scene = projection.scenes[1];
      if (scene?.range === null || scene?.range === undefined) {
        throw new Error("Expected a resolved second Scene range");
      }
      return scene.range;
    });
    await openStructureTab(page, "장면");
    const sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    const sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    await sceneCards.nth(1).locator(".scene-list-open-button").click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    await expect.poll(() => page.locator(".manuscript-editor").evaluate(
      (element) => ({
        anchor: Number(element.getAttribute("data-selection-anchor")),
        head: Number(element.getAttribute("data-selection-head")),
      }),
    )).toEqual({
      anchor: secondSceneRange.start,
      head: secondSceneRange.end,
    });
    await expectEditorText(manuscript, manuscriptText);

    await manuscript.press("Control+Home");
    for (let index = 0; index < prefix.length; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await rightClickOffset(page, manuscript, prefix.length + 1);
    contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await contextMenu.getByRole("menuitem", {
      name: "사건 추가",
      exact: true,
    }).click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await expect(eventDialog).toContainText(exactText);
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.getByRole("region", { name: "사건 레일" }))
      .toContainText(eventTitle);

    await manuscript.press("ArrowRight");
    await rightClickOffset(page, manuscript, prefix.length + 1);
    contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await contextMenu.getByRole("menuitem", {
      name: "사건 추가",
      exact: true,
    }).click();
    const plannedDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await expect(plannedDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(plannedDialog).toBeHidden();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens and closes an empty Work event rail", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-empty-event-rail-e2e-"),
  );
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "1",
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const eventRail = page.getByRole("region", { name: "사건 레일" });
    const toggle = eventRail.getByRole("button", {
      name: "사건 레일 펼치기",
      exact: true,
    });
    await expect(toggle).toBeEnabled();
    const collapsedHeight = await eventRail.evaluate(
      (element) => element.getBoundingClientRect().height,
    );

    await toggle.click();
    await expect(eventRail).toHaveClass(/is-expanded/u);
    await expect(eventRail).toContainText("저장된 사건이 없습니다.");
    await expect(eventRail.getByRole("button", {
      name: "사건 레일 접기",
      exact: true,
    })).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => eventRail.evaluate(
      (element) => element.getBoundingClientRect().height,
    )).toBeGreaterThan(collapsedHeight);

    await eventRail.getByRole("button", {
      name: "사건 레일 접기",
      exact: true,
    }).click();
    await expect(eventRail).not.toHaveClass(/is-expanded/u);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("renders the Work-global event rail below the editor with exact navigation", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-event-rail-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `사건 레일 작품-${suffix}`;
  const firstDocumentTitle = `첫 회차-${suffix}`;
  const secondDocumentTitle = `둘째 회차-${suffix}`;
  const firstEventTitle = `첫 원고 사건-${suffix}`;
  const secondEventTitle = `둘째 원고 사건-${suffix}`;
  const plannedEventTitle = `예정 사건-${suffix}`;
  const firstPrefix = "첫 회차 도입 ";
  const firstQuote = `첫 회차 정확 근거 ${suffix}`;
  const firstText = `${firstPrefix}${firstQuote} 마무리`;
  const secondPrefix = "";
  const secondQuote = `둘째 회차 정확 근거 ${suffix}`;
  const secondText = `${secondQuote} 끝`;
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

  const readSelectedManuscriptText = async (manuscript: Locator) => {
    const host = manuscript.locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' manuscript-editor ')]",
    );
    const [text, selection] = await Promise.all([
      readEditorText(manuscript),
      host.evaluate((element) => ({
        anchor: Number((element as HTMLElement).dataset.selectionAnchor),
        head: Number((element as HTMLElement).dataset.selectionHead),
      })),
    ]);
    return text.slice(
      Math.min(selection.anchor, selection.head),
      Math.max(selection.anchor, selection.head),
    );
  };

  const selectExactRange = async (
    page: Page,
    manuscript: Locator,
    from: number,
    text: string,
  ) => {
    const points = await manuscript.locator(".cm-line").first().evaluate(
      (line, range) => {
        const textNode = line.firstChild;
        if (!(textNode instanceof Text)) {
          throw new Error("CodeMirror line text node is missing");
        }
        const pointAt = (offset: number) => {
          const characterRange = document.createRange();
          characterRange.setStart(textNode, offset);
          characterRange.setEnd(textNode, offset + 1);
          const rectangle = characterRange.getBoundingClientRect();
          return {
            x: rectangle.left,
            y: rectangle.top + rectangle.height / 2,
          };
        };
        return {
          start: pointAt(range.from),
          end: pointAt(range.to),
        };
      },
      { from, to: from + text.length },
    );
    await page.mouse.move(points.start.x, points.start.y);
    await page.mouse.down();
    await page.mouse.move(points.end.x, points.end.y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => readSelectedManuscriptText(manuscript)).toBe(text);
  };
  const createSelectedEvent = async (
    page: Page,
    manuscript: Locator,
    from: number,
    quote: string,
    title: string,
  ) => {
    await selectExactRange(page, manuscript, from, quote);
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await dialog.getByLabel("사건 제목").fill(title);
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  const readRail = async (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.structure.listEventRail({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await manuscript.click();
    await manuscript.pressSequentially(firstText);
    await expectEditorText(manuscript, firstText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await createSelectedEvent(
      page,
      manuscript,
      firstPrefix.length,
      firstQuote,
      firstEventTitle,
    );

    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondText);
    await expectEditorText(manuscript, secondText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page.evaluate(
      async ({ title, exactQuote, from }) => {
        const catalog = await window.eumStudio.workspace.getCatalog();
        if (
          catalog.activeWorkId === null ||
          catalog.activeDocumentId === null
        ) {
          throw new Error("Expected an active Work and Document");
        }
        return window.eumStudio.structure.createEventBlock({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
          documentId: catalog.activeDocumentId,
          selection: { anchor: from, head: from + exactQuote.length },
          exactQuote,
          title,
          note: "",
        });
      },
      {
        title: secondEventTitle,
        exactQuote: secondQuote,
        from: secondPrefix.length,
      },
    );

    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    const plannedDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await plannedDialog.getByLabel("사건 제목").fill(plannedEventTitle);
    await plannedDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(plannedDialog).toBeHidden();

    let eventRegion = page.getByRole("region", { name: "사건 레일" });
    const eventCards = eventRegion.locator(".bottom-event-card");
    await expect(eventCards).toHaveCount(3);
    await expect(eventCards).toHaveText([
      new RegExp(firstEventTitle),
      new RegExp(secondEventTitle),
      new RegExp(plannedEventTitle),
    ]);
    const firstEventCard = eventCards.filter({ hasText: firstEventTitle });
    const secondEventCard = eventCards.filter({ hasText: secondEventTitle });
    const plannedEventCard = eventCards.filter({ hasText: plannedEventTitle });
    await expect(firstEventCard).toContainText(firstDocumentTitle);
    await expect(secondEventCard).toContainText(secondDocumentTitle);
    await expect(plannedEventCard).toContainText("미배치");
    await expect(plannedEventCard).toHaveAttribute(
      "data-source-navigable",
      "false",
    );
    await expect(plannedEventCard).toHaveAttribute("draggable", "true");
    await expect(plannedEventCard).toBeEnabled();

    await plannedEventCard.dragTo(firstEventCard, {
      targetPosition: { x: 2, y: 12 },
    });
    await expect(eventCards).toHaveText([
      new RegExp(plannedEventTitle),
      new RegExp(firstEventTitle),
      new RegExp(secondEventTitle),
    ]);

    await firstEventCard.click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(firstDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readSelectedManuscriptText(manuscript)).toBe(
      firstQuote,
    );
    await secondEventCard.click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readSelectedManuscriptText(manuscript)).toBe(
      secondQuote,
    );
    const railProjection = await readRail(page);
    expect(railProjection.eventBlocks).toHaveLength(3);
    expect(railProjection.eventBlocks.map((event) => event.title)).toEqual([
      plannedEventTitle,
      firstEventTitle,
      secondEventTitle,
    ]);
    expect(railProjection.manuscriptEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([firstEventTitle, secondEventTitle]);
    expect(railProjection.unpositionedEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([plannedEventTitle]);
    expect(railProjection.plotEventLinks).toHaveLength(0);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    eventRegion = page.getByRole("region", { name: "사건 레일" });
    await expect(eventRegion.locator(".bottom-event-card")).toHaveText([
      new RegExp(plannedEventTitle),
      new RegExp(firstEventTitle),
      new RegExp(secondEventTitle),
    ]);
    const restartedRail = await readRail(page);
    expect(restartedRail.eventSources.map(
      (source) => source.anchors[0]?.exactQuote,
    )).toEqual(expect.arrayContaining([firstQuote, secondQuote]));
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("projects final scenes from configured rules, folded overrides, and event exceptions across restart", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-scene-projection-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `장면 projection 작품-${suffix}`;
  const documentTitle = `장면 회차-${suffix}`;
  const firstEventTitle = `첫 장면 사건-${suffix}`;
  const secondEventTitle = `둘째 장면 사건-${suffix}`;
  const plannedEventTitle = `미배정 예정 사건-${suffix}`;
  const firstQuote = `첫 사건 ${suffix}`;
  const secondQuote = `둘째 사건 ${suffix}`;
  const manuscriptText = `${firstQuote}\n***\n${secondQuote}`;
  const separatorFrom = manuscriptText.indexOf("***");
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

  const readProjection = (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.structure.listSceneProjection({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expectEditorText(manuscript, manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const createSelectedEvent = async (
      from: number,
      quote: string,
      title: string,
    ) => {
      await manuscript.click();
      await manuscript.press("Control+Home");
      for (let index = 0; index < from; index += 1) {
        await manuscript.press("ArrowRight");
      }
      for (let index = 0; index < quote.length; index += 1) {
        await manuscript.press("Shift+ArrowRight");
      }
      await expect.poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? "")
      ).toBe(quote);
      await page
        .getByRole("button", { name: "사건으로 등록", exact: true })
        .click();
      const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
      await eventDialog.getByLabel("사건 제목").fill(title);
      await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
      await expect(eventDialog).toBeHidden();
    };
    await createSelectedEvent(0, firstQuote, firstEventTitle);
    await createSelectedEvent(
      `${firstQuote}\n***\n`.length,
      secondQuote,
      secondEventTitle,
    );
    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    const plannedDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await plannedDialog.getByLabel("사건 제목").fill(plannedEventTitle);
    await plannedDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(plannedDialog).toBeHidden();
    await expect.poll(async () => (await readProjection(page)).scenes.length)
      .toBe(2);
    await openStructureTab(page, "장면");

    let sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    let sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    await expect(sceneCards.nth(0)).toContainText(firstEventTitle);
    await expect(sceneCards.nth(0)).toContainText("자동 소속");
    await expect(sceneCards.nth(1)).toContainText(secondEventTitle);
    await expect(sceneRegion.locator(".scene-unassigned-summary"))
      .toContainText(plannedEventTitle);

    await sceneRegion.getByText("장면 규칙 설정", { exact: true }).click();
    let rulePattern = sceneRegion.getByLabel("장면 규칙 1 정규식");
    await expect(rulePattern).toHaveValue("^\\s*\\*\\*\\*\\s*$");
    await rulePattern.fill("^\\s*---\\s*$");
    await sceneRegion
      .getByRole("button", { name: "규칙 저장", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(1);
    rulePattern = sceneRegion.getByLabel("장면 규칙 1 정규식");
    await rulePattern.fill("^\\s*\\*\\*\\*\\s*$");
    await sceneRegion
      .getByRole("button", { name: "규칙 저장", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(2);

    await sceneCards.nth(1)
      .getByRole("button", { name: "앞 장면과 병합", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(1);
    await expect(sceneRegion.getByRole("button", {
      name: "현재 위치에서 분할",
      exact: true,
    })).toHaveCount(0);
    const splitAtExactSeparator = async () => {
      await openWorkSection(page, "쓰기");
      manuscript = page.getByRole("textbox", { name: "원고" });
      await manuscript.click();
      await manuscript.press("Control+End");
      const splitPoint = await manuscript.locator(".cm-line").nth(1).evaluate(
        (line) => {
          const textNode = document.createTreeWalker(
            line,
            NodeFilter.SHOW_TEXT,
          ).nextNode();
          if (!(textNode instanceof Text)) {
            throw new Error("CodeMirror scene separator text node is missing");
          }
          const range = document.createRange();
          range.setStart(textNode, 0);
          range.setEnd(textNode, Math.min(1, textNode.length));
          const rectangle = range.getBoundingClientRect();
          return {
            x: rectangle.left + Math.max(1, rectangle.width / 2),
            y: rectangle.top + rectangle.height / 2,
          };
        },
      );
      await page.mouse.click(splitPoint.x, splitPoint.y, { button: "right" });
      await page.getByRole("menu", { name: "원고 우클릭 메뉴" })
        .getByRole("menuitem", { name: "장면 나누기", exact: true })
        .click();
      await openStructureTab(page, "장면");
    };
    await splitAtExactSeparator();
    sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    await expect(sceneCards.nth(0)).toContainText(firstEventTitle);
    await expect(sceneCards.nth(1)).toContainText(secondEventTitle);
    await expect(sceneCards.nth(0)).toContainText("수동 조정 반영");

    const secondSceneUnassigned = sceneCards.nth(1)
      .locator(".scene-unassigned-events");
    await secondSceneUnassigned.locator("summary").click();
    await secondSceneUnassigned.locator("li")
      .filter({ hasText: plannedEventTitle })
      .getByRole("button", { name: "이 장면에 포함", exact: true })
      .click();
    await expect(sceneCards.nth(1)).toContainText(plannedEventTitle);
    await expect(sceneCards.nth(1)).toContainText("수동 포함");

    await sceneCards.nth(0)
      .getByRole("button", { name: "수동 제외", exact: true })
      .click();
    await expect(sceneCards.nth(0).locator(".scene-excluded-events"))
      .toContainText(firstEventTitle);
    await expect(sceneCards.nth(0))
      .toContainText("제외 해제");

    await sceneCards.nth(1)
      .getByRole("button", { name: "앞 장면과 병합", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(1);
    let metadataReview = sceneRegion.locator(".scene-metadata-review-summary");
    const revealMetadataReview = async () => {
      await metadataReview.evaluate((element) => {
        if (!(element instanceof HTMLDetailsElement)) {
          throw new Error("Scene metadata review details are unavailable");
        }
        element.open = true;
      });
    };
    await expect(metadataReview.locator("summary"))
      .toHaveText("장면 연결 재검토 2건");
    await revealMetadataReview();
    await metadataReview
      .getByRole("button", { name: "제안 장면 1에 연결", exact: true })
      .first()
      .click();
    await expect(metadataReview.locator("summary"))
      .toHaveText("장면 연결 재검토 1건");
    await revealMetadataReview();
    await metadataReview
      .getByRole("button", { name: "제안 장면 1에 연결", exact: true })
      .click();
    await expect(metadataReview).toHaveCount(0);
    await expect(sceneCards.nth(0)).toContainText(plannedEventTitle);
    await expect(sceneCards.nth(0)).toContainText("제외 해제");

    await splitAtExactSeparator();
    sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    metadataReview = sceneRegion.locator(".scene-metadata-review-summary");
    await expect(metadataReview.locator("summary"))
      .toHaveText("장면 연결 재검토 2건");
    await revealMetadataReview();
    await metadataReview
      .getByRole("button", { name: "연결 해제", exact: true })
      .first()
      .click();
    await expect(metadataReview.locator("summary"))
      .toHaveText("장면 연결 재검토 1건");
    await revealMetadataReview();
    await metadataReview
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(metadataReview).toHaveCount(0);

    const beforeRestart = await readProjection(page);
    expect(beforeRestart.status).toBe("clean");
    expect(beforeRestart.ruleSet).toMatchObject({
      revision: 3,
      boundaryRules: [{ pattern: "^\\s*\\*\\*\\*\\s*$", flags: "u" }],
    });
    expect(beforeRestart.scenes).toHaveLength(2);
    expect(beforeRestart.sceneEventOverrides).toHaveLength(2);
    expect(beforeRestart.sceneEventOverrides.every(
      (eventOverride) => eventOverride.binding.status === "detached",
    )).toBe(true);
    expect(beforeRestart.scenes[0]?.excludedEvents).toEqual([]);
    expect(beforeRestart.scenes[0]?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: firstEventTitle, membership: "automatic" }),
    ]));
    expect(beforeRestart.scenes[1]?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: secondEventTitle, membership: "automatic" }),
    ]));
    expect(beforeRestart.scenes[1]?.events).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ title: plannedEventTitle }),
    ]));

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "장면");
    sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    await expect(sceneCards.nth(0).locator(".scene-excluded-events"))
      .toHaveCount(0);
    expect(await readProjection(page)).toEqual(beforeRestart);

    await sceneCards.nth(1).locator(".scene-list-open-button").click();
    await expect.poll(() =>
      page.locator(".manuscript-editor").evaluate((element) => ({
        anchor: Number(element.getAttribute("data-selection-anchor")),
        head: Number(element.getAttribute("data-selection-head")),
      })),
    ).toEqual({ anchor: separatorFrom, head: manuscriptText.length });
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("blocks SceneOverride creation during Hangul IME composition and allows split after commit", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-scene-ime-guard-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `장면 IME 작품-${suffix}`;
  const documentTitle = `장면 IME 회차-${suffix}`;
  const manuscriptText = `앞 장면 ${suffix} 뒤 장면 ${suffix}`;
  const splitOffset = manuscriptText.indexOf(" 뒤 장면");
  const compositionText = readHangulCompositionText();
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  const readSceneState = (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    const [overrides, projection] = await Promise.all([
      window.eumStudio.structure.listSceneOverrides({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      }),
      window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      }),
    ]);
    return { overrides, projection };
  });
  const readPointAtOffset = (
    manuscript: Locator,
    offset: number,
  ) => manuscript.locator(".cm-line").first().evaluate((line, targetOffset) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let remaining = targetOffset;
    let textNode = walker.nextNode();
    while (textNode instanceof Text) {
      if (remaining < textNode.length) {
        const range = document.createRange();
        range.setStart(textNode, remaining);
        range.setEnd(textNode, Math.min(remaining + 1, textNode.length));
        const rectangle = range.getBoundingClientRect();
        return {
          x: rectangle.left + Math.max(1, rectangle.width / 2),
          y: rectangle.top + rectangle.height / 2,
        };
      }
      remaining -= textNode.length;
      textNode = walker.nextNode();
    }
    throw new Error(`CodeMirror offset is unavailable: ${targetOffset}`);
  }, offset);

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await manuscript.focus();
    await manuscript.press("Control+End");
    const session = await page.context().newCDPSession(page);
    await session.send("Input.imeSetComposition", {
      text: compositionText,
      selectionStart: compositionText.length,
      selectionEnd: compositionText.length,
      replacementStart: 0,
      replacementEnd: 0,
    });
    await expect(manuscript).toContainText(compositionText);
    const composingPoint = await readPointAtOffset(manuscript, splitOffset);
    await manuscript.evaluate((content, point) => {
      content.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
      }));
    }, composingPoint);
    await expect(page.getByRole("menu", { name: "원고 우클릭 메뉴" }))
      .toHaveCount(0);
    let sceneState = await readSceneState(page);
    expect(sceneState.overrides.sceneOverrides).toHaveLength(0);
    expect(sceneState.projection.scenes).toHaveLength(1);

    await session.send("Input.insertText", { text: compositionText });
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const committedPoint = await readPointAtOffset(manuscript, splitOffset);
    await page.mouse.click(committedPoint.x, committedPoint.y, { button: "right" });
    await page.getByRole("menu", { name: "원고 우클릭 메뉴" })
      .getByRole("menuitem", { name: "장면 나누기", exact: true })
      .click();
    await expect.poll(async () =>
      (await readSceneState(page)).projection.scenes.length
    ).toBe(2);
    sceneState = await readSceneState(page);
    expect(sceneState.overrides.sceneOverrides).toHaveLength(1);
    expect(sceneState.overrides.sceneOverrides[0]).toMatchObject({
      operation: "split",
      boundaries: [{ range: { from: splitOffset, to: splitOffset } }],
    });
    await session.detach();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("deletes a Scene through preview, undoes with Ctrl+Z, and restores from trash after restart", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-scene-trash-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `장면 휴지통 작품-${suffix}`;
  const documentTitle = `장면 휴지통 회차-${suffix}`;
  const eventTitle = `삭제 장면 사건-${suffix}`;
  const deletedSceneText = `삭제할 장면 ${suffix}`;
  const retainedSceneText = `남길 장면 ${suffix}`;
  const manuscriptText = `${deletedSceneText}\n***\n${retainedSceneText}`;
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

  const openScenes = async (page: Page) => {
    await openStructureTab(page, "장면");
    const region = page.getByRole("region", { name: "현재 회차 장면" });
    return {
      region,
      cards: region.locator(".scene-list-card"),
    };
  };

  const confirmFirstSceneDeletion = async (page: Page) => {
    const { cards } = await openScenes(page);
    await expect(cards).toHaveCount(2);
    await cards.nth(0).getByRole("button", { name: "장면 삭제", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "장면 삭제 미리보기" });
    await expect(dialog).toContainText(deletedSceneText);
    await expect(dialog).toContainText(eventTitle);
    await dialog.getByRole("button", { name: "휴지통으로 이동", exact: true }).click();
    await expect(dialog).toBeHidden();
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expectEditorText(manuscript, manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const addPlannedEvent = page.getByRole("button", {
      name: "예정 사건 추가",
      exact: true,
    });
    await addPlannedEvent.evaluate((element) =>
      element.scrollIntoView({ block: "center" })
    );
    await addPlannedEvent.evaluate((element) => {
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error("Planned event setup button is unavailable");
      }
      element.click();
    });
    const eventDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(eventDialog).toBeHidden();
    let sceneSurface = await openScenes(page);
    await expect(sceneSurface.cards).toHaveCount(2);
    const firstUnassigned = sceneSurface.cards.nth(0).locator(".scene-unassigned-events");
    await firstUnassigned.locator("summary").click();
    await firstUnassigned.locator("li")
      .filter({ hasText: eventTitle })
      .getByRole("button", { name: "이 장면에 포함", exact: true })
      .click();
    await expect(sceneSurface.cards.nth(0)).toContainText(eventTitle);

    await confirmFirstSceneDeletion(page);
    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, retainedSceneText);
    await manuscript.press("Control+z");
    await expectEditorText(manuscript, manuscriptText);

    sceneSurface = await openScenes(page);
    await expect(sceneSurface.cards).toHaveCount(2);
    await expect(sceneSurface.cards.nth(0)).toContainText(eventTitle);
    await confirmFirstSceneDeletion(page);
    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, retainedSceneText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    sceneSurface = await openScenes(page);
    await expect(sceneSurface.cards).toHaveCount(1);
    const trash = sceneSurface.region.locator(".scene-trash-summary");
    await expect(trash.locator("summary")).toHaveText("장면 휴지통 1건");
    await trash.locator("summary").click();
    await trash.getByRole("button", { name: "복원", exact: true }).click();
    await expect(trash.locator("summary")).toHaveText("장면 휴지통 0건");
    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    sceneSurface = await openScenes(page);
    await expect(sceneSurface.cards).toHaveCount(2);
    await expect(sceneSurface.cards.nth(0)).toContainText(eventTitle);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
