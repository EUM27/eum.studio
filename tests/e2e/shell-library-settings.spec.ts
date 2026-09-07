import {
  randomUUID,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  tmpdir,
  path,
  expect,
  test,
  electron,
  openStudioHome,
  openAssistantContext,
  openWorkSection,
  openWritingRecords,
  expectDialogFitsDesktop,
  removeVerifiedTemporaryDirectory,
} from "./support/desktop-shell-suite";
test("uses one collapsible left sidebar without stretching main controls", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-sidebar-layout-"),
  );
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(page.locator(".studio-app-shell")).toHaveAttribute(
      "data-ui-model",
      "eum-studio-desktop",
    );
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page.locator(".library-home")).toHaveAttribute(
      "data-layout",
      "eum-studio-library",
    );
    await expect(page.locator(".main-dashboard-real")).toHaveCount(0);
    await expect(page.locator(".dashboard-workspace-tools")).toHaveCount(0);
    await expect(page.locator(".continue-panel")).toHaveCount(0);
    await expect(page.locator(".workspace-notice")).toHaveCount(0);
    await expect(page.locator(".records-overview")).toHaveCount(0);
    await expect(page.locator(".main-page-header .eyebrow")).toHaveCount(0);
    await expect(page.locator(".main-page-header .page-description")).toHaveCount(0);
    await expect(page.locator(".app-topbar")).toBeVisible();
    const nativeCaptionSeparation = await page.evaluate(() => {
      const settings = document.querySelector<HTMLElement>(
        ".app-topbar-settings",
      );
      const controlsOverlay = (
        navigator as Navigator & {
          readonly windowControlsOverlay?: {
            getTitlebarAreaRect(): DOMRect;
          };
        }
      ).windowControlsOverlay;
      if (settings === null || controlsOverlay === undefined) {
        return null;
      }
      const settingsRect = settings.getBoundingClientRect();
      const titlebarArea = controlsOverlay.getTitlebarAreaRect();
      return {
        settingsRight: settingsRect.right,
        titlebarAreaRight: titlebarArea.right,
      };
    });
    expect(nativeCaptionSeparation).not.toBeNull();
    expect(nativeCaptionSeparation?.settingsRight).toBeLessThanOrEqual(
      (nativeCaptionSeparation?.titlebarAreaRight ?? 0) - 6,
    );
    await expect(page.locator(".sidebar-footer")).toHaveCount(0);
    const mainLayout = await page.locator(".library-home").evaluate(
      (element) => {
        const heading = element.querySelector<HTMLElement>(".library-tabs");
        const actions = element.querySelector<HTMLElement>(".library-actions");
        const buttons = Array.from(
          element.querySelectorAll<HTMLElement>(".library-actions button"),
        );
        if (heading === null || actions === null) {
          throw new Error("Main library layout is missing");
        }
        const headingRect = heading.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        return {
          headingHeight: headingRect.height,
          headingWidth: headingRect.width,
          actionButtonWidths: buttons.map(
            (button) => button.getBoundingClientRect().width,
          ),
          actionsWidth: actionsRect.width,
          bodyClientHeight: element.parentElement?.clientHeight ?? 0,
          bodyScrollHeight: element.parentElement?.scrollHeight ?? 0,
        };
      },
    );
    expect(mainLayout.headingWidth).toBeGreaterThan(mainLayout.headingHeight);
    expect(
      mainLayout.actionButtonWidths.every(
        (width) => width < mainLayout.actionsWidth,
      ),
    ).toBe(true);
    expect(mainLayout.bodyScrollHeight).toBeLessThanOrEqual(
      mainLayout.bodyClientHeight,
    );

    await page.keyboard.press("Control+K");
    const quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await expect(quickTools).toBeVisible();
    const quickToolsLayout = await quickTools.evaluate((dialog) => {
      const header = dialog.querySelector<HTMLElement>(".quick-tools-header");
      const body = dialog.querySelector<HTMLElement>(".quick-tools-body");
      const search = dialog.querySelector<HTMLElement>(".quick-tool-search-field");
      const close = dialog.querySelector<HTMLElement>(".dialog-close");
      if (header === null || body === null || search === null || close === null) {
        throw new Error("Quick tools visual structure is incomplete");
      }
      const dialogRect = dialog.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      return {
        display: getComputedStyle(dialog).display,
        width: dialogRect.width,
        headerBeforeBody: headerRect.bottom <= bodyRect.top + 1,
        searchWidth: searchRect.width,
        closeInside:
          closeRect.left >= dialogRect.left &&
          closeRect.right <= dialogRect.right &&
          closeRect.top >= dialogRect.top &&
          closeRect.bottom <= dialogRect.bottom,
      };
    });
    expect(quickToolsLayout.display).toBe("grid");
    expect(quickToolsLayout.width).toBeGreaterThan(520);
    expect(quickToolsLayout.width).toBeLessThan(900);
    expect(quickToolsLayout.headerBeforeBody).toBe(true);
    expect(quickToolsLayout.searchWidth).toBeGreaterThan(400);
    expect(quickToolsLayout.closeInside).toBe(true);
    await quickTools
      .getByRole("button", { name: "빠른 도구 닫기", exact: true })
      .click();
    await expect(quickTools).toBeHidden();

    await page
      .getByRole("button", { name: "앱 설정 열기", exact: true })
      .click();
    const settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toBeVisible();
    const settingsLayout = await settingsDialog.evaluate((dialog) => {
      const header = dialog.querySelector<HTMLElement>(":scope > header");
      const form = dialog.querySelector<HTMLElement>(":scope > form");
      const input = dialog.querySelector<HTMLElement>("input");
      const close = header?.querySelector<HTMLElement>("button") ?? null;
      const footer = dialog.querySelector<HTMLElement>("footer");
      if (
        header === null ||
        form === null ||
        input === null ||
        close === null ||
        footer === null
      ) {
        throw new Error("App settings visual structure is incomplete");
      }
      const dialogRect = dialog.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        width: dialogRect.width,
        headerDisplay: getComputedStyle(header).display,
        headerBeforeForm: headerRect.bottom <= formRect.top + 1,
        inputWidth: inputRect.width,
        footerInside: footerRect.bottom <= dialogRect.bottom + 1,
        closeInside:
          closeRect.left >= dialogRect.left &&
          closeRect.right <= dialogRect.right &&
          closeRect.top >= dialogRect.top &&
          closeRect.bottom <= dialogRect.bottom,
      };
    });
    expect(settingsLayout.width).toBeGreaterThanOrEqual(360);
    expect(settingsLayout.width).toBeLessThan(560);
    expect(settingsLayout.headerDisplay).toBe("flex");
    expect(settingsLayout.headerBeforeForm).toBe(true);
    expect(settingsLayout.inputWidth).toBeGreaterThan(300);
    expect(settingsLayout.footerInside).toBe(true);
    expect(settingsLayout.closeInside).toBe(true);
    await settingsDialog
      .getByRole("button", { name: "앱 설정 닫기", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();

    await page.setViewportSize({ width: 1344, height: 900 });
    const workTitle = randomUUID();
    const documentTitle = randomUUID();
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await expect(page.locator(".writing-workspace")).toHaveAttribute(
      "data-ui-model",
      "eum-studio-editor",
    );
    await expect(page.locator(".manuscript-header")).toHaveClass(
      /manuscript-header-embedded/u,
    );
    await expect(page.locator(".manuscript-editor-canvas-heading")).toHaveCount(0);
    await expect(page.getByTestId("runtime-status")).toHaveText("");
    await expect(
      page.getByTestId("runtime-status").locator(".runtime-dot"),
    ).toHaveCount(1);
    await expect(
      page
        .locator(".manuscript-header")
        .getByRole("button", { name: "작품 이름 변경", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".manuscript-header")
        .getByRole("button", { name: "회차 이름 변경", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".document-switch-label")).toHaveCount(0);
    await expect(page.locator(".document-order-actions")).toHaveCount(0);
    await expect(page.locator(".create-document-form")).toHaveCount(0);
    await expect(
      page.locator(".sidebar .workspace-rail-header h3"),
    ).toHaveText(workTitle);
    await expect(
      page
        .locator(".sidebar .workspace-rail-header")
        .getByRole("button", { name: "작품 이름 변경", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".sidebar .document-tree-document .document-tree-open")
        .filter({ hasText: documentTitle }),
    ).toBeVisible();
    await expect(
      page
        .locator(".sidebar .document-tree-document")
        .getByRole("button", { name: "회차 이름 변경", exact: true }),
    ).toHaveCount(0);
    const editorShellLayout = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>(
        ".sidebar .workspace-rail-left",
      );
      const activeEpisode = document.querySelector<HTMLElement>(
        ".sidebar .document-tree-open.is-active",
      );
      const manuscript = document.querySelector<HTMLElement>(
        ".manuscript-editor .cm-content",
      );
      const canvas = document.querySelector<HTMLElement>(
        ".manuscript-editor-canvas",
      );
      const search = document.querySelector<HTMLElement>(
        ".sidebar .manuscript-search",
      );
      const tree = document.querySelector<HTMLElement>(
        ".sidebar .document-folder-tree",
      );
      const workTitleHeading = document.querySelector<HTMLElement>(
        ".sidebar .workspace-rail-title h3",
      );
      const workTitleEdit = document.querySelector<HTMLElement>(
        '.sidebar .workspace-rail-title [aria-label="작품 이름 변경"]',
      );
      if (
        rail === null ||
        activeEpisode === null ||
        manuscript === null ||
        canvas === null ||
        search === null ||
        tree === null ||
        workTitleHeading === null ||
        workTitleEdit === null
      ) {
        throw new Error("Studio editor shell is incomplete");
      }
      const railRect = rail.getBoundingClientRect();
      const episodeRect = activeEpisode.getBoundingClientRect();
      const manuscriptRect = manuscript.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        episodeOffset: episodeRect.top - railRect.top,
        manuscriptHeight: manuscriptRect.height,
        manuscriptWidth: manuscriptRect.width,
        manuscriptLeft: manuscriptRect.left,
        manuscriptRight: manuscriptRect.right,
        canvasHeight: canvasRect.height,
        canvasWidth: canvasRect.width,
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        centerLeft: canvas.parentElement?.getBoundingClientRect().left ?? 0,
        centerRight: canvas.parentElement?.getBoundingClientRect().right ?? 0,
        searchBeforeTree:
          search.getBoundingClientRect().top < tree.getBoundingClientRect().top,
        workTitleCenterY:
          workTitleHeading.getBoundingClientRect().top +
          workTitleHeading.getBoundingClientRect().height / 2,
        workTitleEditCenterY:
          workTitleEdit.getBoundingClientRect().top +
          workTitleEdit.getBoundingClientRect().height / 2,
      };
    });
    expect(editorShellLayout.episodeOffset).toBeLessThan(260);
    expect(
      Math.abs(
        editorShellLayout.workTitleCenterY -
          editorShellLayout.workTitleEditCenterY,
      ),
    ).toBeLessThan(2);
    expect(editorShellLayout.canvasHeight).toBeGreaterThan(600);
    expect(editorShellLayout.manuscriptHeight).toBeGreaterThan(200);
    expect(editorShellLayout.manuscriptWidth).toBeLessThanOrEqual(820);
    expect(Math.abs(
      (editorShellLayout.manuscriptLeft - editorShellLayout.canvasLeft) -
      (editorShellLayout.canvasRight - editorShellLayout.manuscriptRight),
    )).toBeLessThan(20);
    expect(editorShellLayout.searchBeforeTree).toBe(true);

    await openStudioHome(page);
    await page.setViewportSize({ width: 886, height: 594 });
    const libraryVerticalRhythm = await page.locator(".library-section").evaluate(
      (element) => {
        const toolbar = element.querySelector<HTMLElement>(".library-heading-row");
        const cards = element.querySelector<HTMLElement>(".library-work-list");
        if (toolbar === null || cards === null) {
          throw new Error("Library layout is incomplete");
        }
        return cards.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom;
      },
    );
    expect(libraryVerticalRhythm).toBeGreaterThanOrEqual(14);
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(
      page
        .getByRole("navigation", { name: "주요 화면" })
        .getByRole("button", { name: "내 작품", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(".sidebar-utility-navigation").getByRole("button", {
        name: "앱 설정 열기",
        exact: true,
      }),
    ).toHaveCount(0);
    const mainFitsViewportWidth = await page.locator(".main-page-body").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    );
    expect(mainFitsViewportWidth).toBe(true);
    await page.locator(".library-work-card").filter({ hasText: workTitle })
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    const recordsPanel = await openWritingRecords(page);
    await expect(recordsPanel.getByRole("region", { name: "연독률 계산기" }))
      .toBeVisible();
    await openStudioHome(page);
    const workCard = page.locator(".library-work-card").filter({
      hasText: workTitle,
    });
    await workCard
      .getByRole("combobox", { name: `${workTitle} 회차 선택`, exact: true })
      .selectOption({ label: documentTitle });
    await openWorkSection(page, "쓰기");
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();

    await page.setViewportSize({ width: 1344, height: 900 });
    await expect(page.locator(".sidebar .workspace-rail-left")).toHaveCount(1);
    await expect(
      page.locator(".workspace-body > .workspace-rail-left"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "문서 레일 닫기", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "문서 레일 열기", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".workspace-rail-right")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "검토 레일 열기", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "오늘 목표", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("daily-goal-status")).toContainText(
      "오늘 0분",
    );
    await expect(page.getByTestId("daily-goal-status")).toContainText("0자");
    await page.getByRole("button", { name: "오늘 목표", exact: true }).click();
    const dailyGoalDialog = page.getByRole("dialog", { name: "오늘 목표" });
    await expectDialogFitsDesktop(dailyGoalDialog);
    await expect(dailyGoalDialog).toContainText(
      "집중 시간과 글자 수는 집필 기록에서 자동 집계",
    );
    await dailyGoalDialog
      .getByRole("button", { name: "오늘 목표 닫기", exact: true })
      .click();
    await expect(page.getByLabel("행간", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expect(page.getByLabel("행간", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();
    await expect(page.getByLabel("행간", { exact: true })).toHaveCount(0);

    await page
      .getByRole("button", { name: "사이드바 접기", exact: true })
      .click();
    const expandButton = page.getByRole("button", {
      name: "사이드바 펼치기",
      exact: true,
    });
    await expect(expandButton).toBeVisible();
    await expect(page.locator(".studio-app-shell")).toHaveClass(/is-compact/u);
    const compactControlsDoNotOverlap = await page.evaluate(() => {
      const expand = document.querySelector<HTMLElement>(
        '[aria-label="사이드바 펼치기"]',
      );
      const main = document.querySelector<HTMLElement>(
        ".manuscript-header",
      );
      if (expand === null || main === null) {
        return false;
      }
      const expandRect = expand.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return expandRect.bottom <= mainRect.top;
    });
    expect(compactControlsDoNotOverlap).toBe(true);
    await expandButton.click();
    await expect(page.locator(".studio-app-shell")).not.toHaveClass(/is-compact/u);
    await expect(page.locator(".sidebar .workspace-rail-left")).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the settings control outside the native window close area", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-native-caption-layout-"),
  );
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(
      page.getByRole("button", { name: "앱 설정 열기", exact: true }),
    ).toBeVisible();
    const separation = await page.evaluate(() => {
      const settings = document.querySelector<HTMLElement>(
        ".app-topbar-settings",
      );
      const controlsOverlay = (
        navigator as Navigator & {
          readonly windowControlsOverlay?: {
            getTitlebarAreaRect(): DOMRect;
          };
        }
      ).windowControlsOverlay;
      if (settings === null || controlsOverlay === undefined) {
        throw new Error("The native window-controls overlay is unavailable");
      }
      const settingsRect = settings.getBoundingClientRect();
      const titlebarArea = controlsOverlay.getTitlebarAreaRect();
      return {
        gap: titlebarArea.right - settingsRect.right,
        settingsRight: settingsRect.right,
        titlebarAreaRight: titlebarArea.right,
      };
    });
    expect(separation.gap).toBeGreaterThanOrEqual(6);
    expect(separation.settingsRight).toBeLessThan(separation.titlebarAreaRight);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists YouTube connection status and Work-owned music settings", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-music-settings-"),
  );
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

  try {
    const page = await electronApp.firstWindow();
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog
      .getByLabel("작품 제목")
      .fill(`음악 설정 ${randomUUID()}`);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();

    await page
      .getByRole("button", { name: "앱 설정 열기", exact: true })
      .click();
    let settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await settingsDialog.getByRole("tab", { name: "음악", exact: true }).click();
    await expect(settingsDialog.getByText("YouTube 음악 연결")).toBeVisible();
    await expect(settingsDialog.getByText("현재 작품 음악")).toBeVisible();
    await settingsDialog
      .getByLabel("YouTube Data API 키")
      .fill(`youtube-${randomUUID()}`);
    await settingsDialog
      .getByLabel("회차 전환 시 자동 선곡")
      .check();
    await settingsDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();

    await page
      .getByRole("button", { name: "앱 설정 열기", exact: true })
      .click();
    settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await settingsDialog.getByRole("tab", { name: "음악", exact: true }).click();
    await expect(
      settingsDialog.getByLabel("회차 전환 시 자동 선곡"),
    ).toBeChecked();
    await expect(settingsDialog.getByLabel("YouTube Data API 키"))
      .toHaveValue("");
    await expect(settingsDialog.getByLabel("YouTube Data API 키"))
      .toHaveAttribute("placeholder", /연결됨/u);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages responsive Work cards, names, and persistent favorites from Home", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-home-work-management-"),
  );
  const originalTitle = `한 줄로 보이는 긴 작품 제목 ${randomUUID()}`;
  const renamedTitle = `변경한 작품 제목 ${randomUUID()}`;
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

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createDialog.getByLabel("작품 제목").fill(originalTitle);
    await createDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await openStudioHome(page);

    await expect(
      page.getByRole("navigation", { name: "주요 화면" })
        .getByRole("button", { name: "내 작품", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".work-create-card")).toHaveCount(0);

    const card = page.locator(".library-work-card").filter({ hasText: originalTitle });
    await expect(card).toBeVisible();
    const layout = await card.evaluate((element) => {
      const title = element.querySelector<HTMLElement>(".work-card-title");
      const actions = element.querySelector<HTMLElement>(".work-card-actions");
      const cardRect = element.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      return {
        titleWhiteSpace: title === null ? null : getComputedStyle(title).whiteSpace,
        actionsInsideCard:
          actionsRect !== undefined && actionsRect.right <= cardRect.right + 1,
      };
    });
    expect(layout).toEqual({ titleWhiteSpace: "nowrap", actionsInsideCard: true });

    await card.getByRole("button", {
      name: `${originalTitle} 즐겨찾기`,
      exact: true,
    }).click();
    await page.getByRole("button", { name: "즐겨찾기 1", exact: true }).click();
    await expect(card).toBeVisible();

    await card.getByRole("button", {
      name: `${originalTitle} 작품 이름 변경`,
      exact: true,
    }).click();
    const renameDialog = page.getByRole("dialog", { name: "작품 이름 변경" });
    await renameDialog.getByLabel("작품 제목").fill(renamedTitle);
    await renameDialog.getByRole("button", { name: "변경", exact: true }).click();
    const renamedCard = page.locator(".library-work-card").filter({
      hasText: renamedTitle,
    });
    await expect(renamedCard).toBeVisible();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "즐겨찾기 1", exact: true }).click();
    const restoredCard = page.locator(".library-work-card").filter({ hasText: renamedTitle });
    await expect(restoredCard).toBeVisible();
    await restoredCard.getByRole("button", {
      name: `${renamedTitle} 즐겨찾기 해제`,
      exact: true,
    }).click();
    await expect(page.getByText("즐겨찾기한 작품이 없습니다.", { exact: true }))
      .toBeVisible();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps editor utility dialogs inside one styled desktop surface", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-editor-dialog-layout-"),
  );
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

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill("대화상자 화면 검증");
    await createWorkDialog.getByLabel("첫 회차 제목").fill("제목없음");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "검토 레일 열기", exact: true })
      .click();

    const cases = [
      ["파편 서랍 열기", "파편 서랍", "파편 서랍 닫기"],
    ] as const;

    for (const [openName, dialogName, closeName] of cases) {
      const openButton = page.getByRole("button", {
        name: openName,
        exact: true,
      });
      await expect(openButton).toBeEnabled();
      await openButton.click();
      const dialog = page.getByRole("dialog", { name: dialogName });
      await expectDialogFitsDesktop(dialog);
      await dialog
        .getByRole("button", { name: closeName, exact: true })
        .click();
      await expect(dialog).toBeHidden();
    }

    const assistantContextDialog = await openAssistantContext(page);
    await assistantContextDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    const assistantConnectionsDialog = page.getByRole("dialog", {
      name: "조수 연결",
    });
    await expectDialogFitsDesktop(assistantConnectionsDialog);
    await assistantConnectionsDialog
      .getByRole("button", { name: "조수 연결 닫기", exact: true })
      .click();
    if (await assistantContextDialog.isVisible()) {
      await assistantContextDialog
        .getByRole("button", { name: "조수 접근 권한 닫기", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "검토 레일 닫기", exact: true })
      .click();

    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "연속 읽기", exact: true }).click();
    const continuousReadingDialog = page.getByRole("dialog", {
      name: "연속 읽기",
    });
    await expectDialogFitsDesktop(continuousReadingDialog);
    await continuousReadingDialog
      .getByRole("button", { name: "연속 읽기 닫기", exact: true })
      .click();
    await expect(continuousReadingDialog).toBeHidden();

    await page.getByRole("button", { name: "원고 점검", exact: true }).click();
    const preflightDialog = page.getByRole("dialog", { name: "원고 점검" });
    await expectDialogFitsDesktop(preflightDialog);
    await preflightDialog
      .getByRole("button", { name: "원고 점검 닫기", exact: true })
      .click();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("requires an explicit browser export for the read-only import rehearsal", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-import-rehearsal-"),
  );
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

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 도구 열기", exact: true })
      .click();
    await page
      .getByRole("menu", { name: "작품 도구" })
      .getByRole("menuitem", { name: "가져오기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "기존 작업 가져오기",
    });
    await expect(dialog).toContainText("직접 내보낸 브라우저 데이터 JSON");
    await expect(dialog).toContainText("현재 작업실에는 합치지 않습니다");
    await expect(dialog.getByRole("button", {
      name: "읽기 전용 리허설 실행",
      exact: true,
    })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("runs one explicit browser-export import rehearsal without exposing source values", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-browser-import-"),
  );
  const sourceRootPath = path.join(directory, "legacy-source");
  const sourceDataPath = path.join(sourceRootPath, "data");
  const targetRootPath = path.join(directory, "rehearsal-target");
  const browserBundlePath = path.join(directory, "browser-export.json");
  const workId = randomUUID();
  const documentId = randomUUID();
  const manuscript = `legacy-${randomUUID()}`;
  const browserManuscript = `browser-${randomUUID()}`;
  const browserSecret = `secret-${randomUUID()}`;
  const payload = {
    library: {
      works: [{
        id: workId,
        title: "가져오기 검증 작품",
        description: "",
        episodeIds: [documentId],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      }],
      episodes: [{
        id: documentId,
        workId,
        title: "1화",
        index: 1,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      }],
      episodeFolders: [],
    },
    manuscripts: { [documentId]: manuscript },
    recentWork: {},
    factTemplatesByEpisode: {},
    books: [],
    entries: [],
    sessionLogs: [],
  };
  await mkdir(sourceDataPath, { recursive: true });
  await writeFile(
    path.join(sourceDataPath, "lorebooks.json"),
    JSON.stringify(payload),
    "utf8",
  );
  await writeFile(
    path.join(sourceDataPath, "lorebooks.json.bak"),
    JSON.stringify(payload),
    "utf8",
  );
  const browserBundle = {
    formatIdentity: "eum-browser-source-export",
    formatVersion: "1",
    exportedAt: "2026-08-10T00:00:00.000Z",
    sourceOrigin: "http://localhost",
    localStorageEntries: [
      {
        key: "eum-editor:library:v2",
        value: JSON.stringify(payload.library),
      },
      {
        key: `eum-editor:manuscript:v2:${documentId}`,
        value: browserManuscript,
      },
      {
        key: "eum-editor:ai-provider-settings:v1",
        value: JSON.stringify({ apiKeys: { other: browserSecret } }),
      },
    ],
    indexedDatabases: [
      {
        databaseName: "eum-work-store",
        version: 1,
        stores: [
          {
            storeName: "works",
            records: [{ key: workId, value: { id: workId } }],
          },
          {
            storeName: "backups",
            records: [{
              key: "backup-a",
              value: { id: "backup-a", workId },
            }],
          },
        ],
      },
      {
        databaseName: "eum-publishing-store",
        version: 1,
        stores: [{
          storeName: "publishing-state",
          records: [{ key: "current", value: { submissions: [] } }],
        }],
      },
    ],
  };
  await writeFile(browserBundlePath, JSON.stringify(browserBundle), "utf8");
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    await electronApp.evaluate(
      ({ dialog }, paths) => {
        let openIndex = 0;
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePaths: [paths.openPaths[openIndex++]],
          }),
        });
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: paths.targetPath,
          }),
        });
      },
      {
        openPaths: [sourceRootPath, browserBundlePath],
        targetPath: targetRootPath,
      },
    );
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 도구 열기", exact: true })
      .click();
    await page
      .getByRole("menu", { name: "작품 도구" })
      .getByRole("menuitem", { name: "가져오기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "기존 작업 가져오기",
    });
    await dialog.getByRole("button", {
      name: "읽기 전용 리허설 실행",
      exact: true,
    }).click();
    await expect(dialog).toContainText("가져오기 리허설 완료");
    await expect(
      dialog.locator("dt", { hasText: "브라우저 항목" })
        .locator("..").locator("dd"),
    ).toHaveText("6");

    const reportPath = path.join(
      targetRootPath,
      "rehearsal-workspace",
      "migration-report.json",
    );
    const reportText = await readFile(reportPath, "utf8");
    expect(reportText).not.toContain(manuscript);
    expect(reportText).not.toContain(browserManuscript);
    expect(reportText).not.toContain(browserSecret);
    expect(reportText).not.toContain(browserBundlePath);
    expect(JSON.parse(reportText).browserSourceReceipt.coverage).toEqual({
      sourceEntryCount: 6,
      capturedEntryCount: 6,
      uncoveredEntryCount: 0,
    });
    expect(
      await readFile(
        path.join(
          targetRootPath,
          "source-archive",
          "raw",
          "browser-source-export.json",
        ),
      ),
    ).toEqual(await readFile(browserBundlePath));
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

