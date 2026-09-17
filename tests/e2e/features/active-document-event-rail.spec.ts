import {
  randomUUID,
  mkdtemp,
  tmpdir,
  path,
  expect,
  test,
  electron,
  continueFromMain,
  createNamedEpisode,
  removeVerifiedTemporaryDirectory,
} from "../support/desktop-shell-suite";

test("collapses the event rail when structure exists only in another document", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-active-document-event-rail-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `현재 회차 사건 레일-${suffix}`;
  const firstDocumentTitle = `구조 있는 회차-${suffix}`;
  const secondDocumentTitle = `빈 회차-${suffix}`;
  const eventTitle = `첫 회차 사건-${suffix}`;
  const manuscriptText = `첫 회차 사건 근거 ${suffix}`;
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page.evaluate(async ({ title, exactQuote }) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (
        catalog.activeWorkId === null ||
        catalog.activeDocumentId === null
      ) {
        throw new Error("Expected an active Work and Document");
      }
      await window.eumStudio.structure.createEventBlock({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        documentId: catalog.activeDocumentId,
        selection: { anchor: 0, head: exactQuote.length },
        exactQuote,
        title,
        note: "",
      });
    }, { title: eventTitle, exactQuote: manuscriptText });
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await continueFromMain(page);

    let eventRail = page.getByRole("region", { name: "사건 레일" });
    await expect(eventRail.getByRole("button", {
      name: "사건 레일 접기",
      exact: true,
    })).toBeVisible();
    await expect(eventRail).toContainText(eventTitle);

    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    eventRail = page.getByRole("region", { name: "사건 레일" });
    await expect(eventRail.getByRole("button", {
      name: "사건 레일 펼치기",
      exact: true,
    })).toBeVisible();
    await expect(eventRail.locator(".bottom-event-rail-content")).toHaveCount(0);

    const documentRail = page.getByRole("complementary", { name: "문서 레일" });
    await documentRail.getByRole("button", {
      name: new RegExp(`${firstDocumentTitle}$`, "u"),
    }).click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await expect(eventRail.getByRole("button", {
      name: "사건 레일 접기",
      exact: true,
    })).toBeVisible();
    await expect(eventRail).toContainText(eventTitle);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
