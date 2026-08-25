import {
  randomUUID,
  readFileSync,
  mkdtemp,
  readFile,
  tmpdir,
  createServer,
  path,
  expect,
  test,
  electron,
  openStudioWorkspace,
  openStudioHome,
  openAssistantContext,
  openWorkSection,
  openStructureTab,
  openSchedule,
  activateDocumentFromTree,
  createNamedEpisode,
  readActiveDocumentId,
  expectEditorText,
  expectDialogFitsDesktop,
  removeVerifiedTemporaryDirectory,
  type Locator,
} from "./support/desktop-shell-suite";
test("launches a sandboxed shell with only the typed studio bridge", async () => {
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const consoleErrors: string[] = [];
    window.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await expect(
      window.getByTestId("manuscript-title"),
    ).toBeVisible();
    await expect(
      window.getByText("장편 편집기 POC", { exact: true }),
    ).toHaveCount(0);
    await expect(window.getByTestId("runtime-status")).toHaveAttribute(
      "data-runtime-status",
      "ready",
    );
    const menuBarAutoHide = await electronApp.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isMenuBarAutoHide() ?? false,
    );
    expect(menuBarAutoHide).toBe(true);

    const boundary = await window.evaluate(() => {
      const bridge = Reflect.get(globalThis, "eumStudio");
      return {
        bridgeType: typeof bridge,
        hasGenericSend:
          typeof bridge === "object" &&
          bridge !== null &&
          Reflect.has(bridge, "send"),
        requireType: typeof Reflect.get(globalThis, "require"),
      };
    });

    expect(boundary).toEqual({
      bridgeType: "object",
      hasGenericSend: false,
      requireType: "undefined",
    });
    expect(consoleErrors).toEqual([]);
  } finally {
    await electronApp.close();
  }
});

test("creates, edits, completes, and reopens the active Work schedule from the main screen", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-main-schedule-"),
  );
  const workTitle = `일정 작품 ${randomUUID().slice(0, 8)}`;
  const taskLabel = `검토 ${randomUUID().slice(0, 8)}`;
  const routineLabel = `매일 집필 ${randomUUID().slice(0, 8)}`;
  const ddayLabel = `공모 마감 ${randomUUID().slice(0, 8)}`;
  const editedDdayLabel = `${ddayLabel} 수정`;
  const dateKey = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate(),
    ).padStart(2, "0")}`;
  const todayValue = new Date();
  const today = dateKey(todayValue);
  const deadlineValue = new Date(
    todayValue.getFullYear(),
    todayValue.getMonth(),
    todayValue.getDate() + 5,
  );
  const deadline = dateKey(deadlineValue);
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
    await page.setViewportSize({ width: 1344, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await openStudioHome(page);
    await openSchedule(page);
    await expect(
      page.getByRole("heading", { name: "일정", exact: true }),
    ).toBeVisible();
    await expectDialogFitsDesktop(
      page.getByRole("dialog", { name: "작업 일정" }),
    );

    const quickActions = page.locator(".schedule-quick-actions");
    await quickActions
      .getByRole("button", { name: "일정", exact: true })
      .click();
    let scheduleDialog = page.getByRole("dialog", { name: "일정 추가" });
    await scheduleDialog.getByLabel("이름").fill(taskLabel);
    await scheduleDialog.getByLabel("날짜").fill(today);
    await scheduleDialog.getByLabel("시간").fill("09:30");
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      page.locator(".schedule-agenda-list").getByText(taskLabel, {
        exact: true,
      }),
    ).toBeVisible();

    await quickActions
      .getByRole("button", { name: "루틴", exact: true })
      .click();
    scheduleDialog = page.getByRole("dialog", { name: "루틴 추가" });
    await scheduleDialog.getByLabel("이름").fill(routineLabel);
    await scheduleDialog.getByLabel("시작 날짜").fill(today);
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      page.locator(".schedule-agenda-list").getByText(routineLabel, {
        exact: true,
      }),
    ).toBeVisible();

    await quickActions
      .getByRole("button", { name: "D-DAY", exact: true })
      .click();
    scheduleDialog = page.getByRole("dialog", { name: "D-DAY 추가" });
    await scheduleDialog.getByLabel("마감 이름").fill(ddayLabel);
    await scheduleDialog.getByLabel("날짜").fill(deadline);
    await scheduleDialog.getByLabel("시간").fill("18:00");
    await scheduleDialog.getByLabel("목표 기준").selectOption("episodeCount");
    await scheduleDialog.getByLabel("추가할 회차 수").fill("5");
    await scheduleDialog.getByLabel("현재 완료 회차").fill("2");
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    const ddayEntry = page
      .locator(".schedule-dday-list > button")
      .filter({ hasText: ddayLabel });
    await expect(ddayEntry).toBeVisible();
    await expect(ddayEntry).toContainText("추가 5회차 · 기준 2회차");

    await page
      .getByRole("button", { name: `${taskLabel} 완료`, exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `${taskLabel} 완료 취소`,
        exact: true,
      }),
    ).toBeVisible();

    await ddayEntry.click();
    scheduleDialog = page.getByRole("dialog", { name: "D-DAY 수정" });
    await scheduleDialog.getByLabel("마감 이름").fill(editedDdayLabel);
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      page.locator(".schedule-dday-list").getByText(editedDdayLabel, {
        exact: true,
      }),
    ).toBeVisible();

    await page.setViewportSize({ width: 786, height: 538 });
    const horizontalLayout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      dashboardClientWidth:
        document.querySelector<HTMLElement>(".library-home")
          ?.clientWidth ?? 0,
      dashboardScrollWidth:
        document.querySelector<HTMLElement>(".library-home")
          ?.scrollWidth ?? 0,
    }));
    expect(horizontalLayout.documentWidth).toBeLessThanOrEqual(
      horizontalLayout.viewport,
    );
    expect(horizontalLayout.dashboardScrollWidth).toBeLessThanOrEqual(
      horizontalLayout.dashboardClientWidth,
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1344, height: 900 });
    await openSchedule(page);
    await expect(
      page.getByRole("heading", { name: "일정", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `${taskLabel} 완료 취소`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".schedule-agenda-list").getByText(routineLabel, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".schedule-dday-list").getByText(editedDdayLabel, {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists the episode character setting and refreshes D-DAY progress", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-app-settings-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `진척 작품 ${suffix}`;
  const ddayLabel = `연재 목표 ${suffix}`;
  const dateKey = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate(),
    ).padStart(2, "0")}`;
  const deadlineValue = new Date();
  deadlineValue.setDate(deadlineValue.getDate() + 7);
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_APP_SETTINGS_PROFILE: JSON.stringify({
      schemaVersion: 1,
      defaultEpisodeCharacters: {
        defaultValue: 4,
        minValue: 1,
        maxValue: 100,
      },
    }),
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
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially("가나다라");
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("4");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await createNamedEpisode(page, "2화");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText("2화");
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("0");
    await manuscript.click();
    await manuscript.pressSequentially("마바");
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("2");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(page);
    await openSchedule(page);
    await expect(
      page.getByText("글자 수 환산 1회차 기준 4자", { exact: true }),
    ).toBeVisible();
    await page
      .locator(".schedule-quick-actions")
      .getByRole("button", { name: "D-DAY", exact: true })
      .click();
    const scheduleDialog = page.getByRole("dialog", { name: "D-DAY 추가" });
    await scheduleDialog.getByLabel("마감 이름").fill(ddayLabel);
    await scheduleDialog.getByLabel("날짜").fill(dateKey(deadlineValue));
    await scheduleDialog.getByLabel("목표 기준").selectOption("episodeCount");
    await scheduleDialog.getByLabel("추가할 회차 수").fill("2");
    await scheduleDialog.getByLabel("현재 완료 회차").fill("0");
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    const ddayEntry = page
      .locator(".schedule-dday-list > button")
      .filter({ hasText: ddayLabel });
    await expect(ddayEntry).toContainText("추가 완료 1/2회차 · 1회차 남음");

    await page
      .getByRole("button", { name: "작업 일정 닫기", exact: true })
      .click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    let settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toHaveValue("4");
    await settingsDialog.getByLabel("1회 기준 글자수").fill("2");
    await settingsDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();
    await openSchedule(page);
    await expect(
      page.getByText("글자 수 환산 1회차 기준 2자", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".schedule-dday-list > button").filter({ hasText: ddayLabel }),
    ).toContainText("추가 완료 2/2회차 · 목표 달성");

    await page
      .getByRole("button", { name: "작업 일정 닫기", exact: true })
      .click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toHaveValue("2");
    await expect(settingsDialog).not.toContainText("provider");
    await expect(settingsDialog).toContainText("YouTube 음악 연결");
    await expect(settingsDialog).not.toContainText("백업");
    await page.setViewportSize({ width: 786, height: 538 });
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>(".app-settings-dialog");
      if (dialog === null) throw new Error("App settings dialog is missing");
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        dialogClientWidth: dialog.clientWidth,
        dialogScrollWidth: dialog.scrollWidth,
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.dialogScrollWidth).toBeLessThanOrEqual(layout.dialogClientWidth);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSchedule(page);
    await expect(
      page.getByText("글자 수 환산 1회차 기준 2자", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".schedule-dday-list > button").filter({ hasText: ddayLabel }),
    ).toContainText("추가 완료 2/2회차 · 목표 달성");
    await page
      .getByRole("button", { name: "작업 일정 닫기", exact: true })
      .click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toHaveValue("2");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("switches Works with Ctrl+K and restores the exact per-Work quick memo", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-quick-tools-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const firstWorkTitle = `정원 ２ ${suffix}`;
  const firstDocumentTitle = `２화 재회 ${suffix}`;
  const secondWorkTitle = `바다 ${suffix}`;
  const secondDocumentTitle = `3화 이별 ${suffix}`;
  const firstManuscript = `첫 작품 원고 ${randomUUID()}`;
  const secondManuscript = `둘째 작품 원고 ${randomUUID()}`;
  const quickMemo = `  확인 ${randomUUID()}\n둘째 줄  `;
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
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("0");
    await manuscript.pressSequentially(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await page.keyboard.press("Control+K");
    let quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await expect(quickTools).toBeVisible();
    const quickSearch = quickTools.getByRole("searchbox", {
      name: "작품, 회차 또는 명령 검색",
    });
    const results = quickTools.getByRole("option");
    await expect(results.first()).toHaveAttribute("aria-selected", "true");
    await quickSearch.press("ArrowDown");
    await expect(results.nth(1)).toHaveAttribute("aria-selected", "true");
    await quickSearch.press("ArrowUp");
    await expect(results.first()).toHaveAttribute("aria-selected", "true");

    await quickTools
      .getByRole("button", { name: "빠른 메모 열기", exact: true })
      .click();
    const memo = quickTools.getByLabel(`${secondWorkTitle} 빠른 메모`);
    await expect(memo).toBeVisible();
    await memo.fill(quickMemo);
    const saveMemo = quickTools.getByRole("button", {
      name: "메모 저장",
      exact: true,
    });
    await saveMemo.click();
    await expect(saveMemo).toBeDisabled();
    await expect(quickTools.getByText("저장된 메모 없음", { exact: true }))
      .toHaveCount(0);

    await quickSearch.fill("2화");
    await expect(quickTools.getByRole("option")).toHaveCount(1);
    await expect(quickTools.getByRole("option").first()).toContainText(
      firstDocumentTitle,
    );
    await quickSearch.press("Enter");
    await expect(quickTools).toBeHidden();
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, firstManuscript);
    await expect(manuscript).not.toContainText(quickMemo.trim());

    await page.keyboard.press("Control+K");
    quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .fill(secondDocumentTitle);
    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .press("Enter");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, secondManuscript);
    await expect(manuscript).not.toContainText(quickMemo.trim());

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(
      page.getByRole("button", { name: "빠른 도구 열기", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Control+K");
    quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await quickTools
      .getByRole("button", { name: "빠른 메모 열기", exact: true })
      .click();
    await expect(quickTools.getByLabel(`${secondWorkTitle} 빠른 메모`))
      .toHaveValue(quickMemo);
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>(".quick-tools-dialog");
      if (dialog === null) throw new Error("Quick tools dialog is missing");
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        dialogClientWidth: dialog.clientWidth,
        dialogScrollWidth: dialog.scrollWidth,
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.dialogScrollWidth).toBeLessThanOrEqual(layout.dialogClientWidth);

    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .fill(secondDocumentTitle);
    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .press("Enter");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, secondManuscript);
    await expect(manuscript).not.toContainText(quickMemo.trim());
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists a Work-scoped exact vocabulary Candidate and its permission", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-context-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const destinationId = "local-exact-vocabulary-search";
  const query = "서늘한";
  const manuscriptText = `${query} 복도와 ${query} 창문 ${randomUUID()}`;
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
    await page.setViewportSize({ width: 1280, height: 900 });
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
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+Home");
    for (let index = 0; index < query.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    let permissionDialog = await openAssistantContext(page);
    await expect(permissionDialog.getByLabel("기능 목적지"))
      .toHaveValue(destinationId);
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    let permissionLedger = permissionDialog.getByRole("region", {
      name: "조수 권한 목록",
    });
    await expect(permissionLedger.getByText(destinationId, { exact: true }))
      .toBeVisible();
    await expect(
      permissionLedger.getByText(
        "로컬 작품 전체 · 외부 전송하지 않음 · 이 작품",
        { exact: true },
      ),
    ).toBeVisible();
    await permissionDialog
      .getByRole("button", { name: "선택 어휘 검색", exact: true })
      .click();
    const candidateLedger = permissionDialog.getByRole("region", {
      name: "어휘 검색 결과",
    });
    await expect(
      candidateLedger.locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expect(candidateLedger.getByText("2곳", { exact: true })).toBeVisible();
    const receiptLedger = permissionDialog.getByRole("region", {
      name: "조수 접근 기록",
    });
    await expect(
      receiptLedger.getByText(
        `읽기 ${manuscriptText.length.toLocaleString()}자 · 전송 0자`,
        { exact: true },
      ),
    ).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
    await candidateLedger
      .getByRole("button", {
        name: `1. ${documentTitle} 0–${query.length}`,
        exact: true,
      })
      .click();
    await expect(permissionDialog).toBeHidden();
    await expect
      .poll(() =>
        page.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({ anchor: 0, head: query.length });
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    permissionDialog = await openAssistantContext(page);
    permissionLedger = permissionDialog.getByRole("region", {
      name: "조수 권한 목록",
    });
    await expect(permissionLedger.getByText(destinationId, { exact: true }))
      .toBeVisible();
    const reopenedCandidateLedger = permissionDialog.getByRole("region", {
      name: "어휘 검색 결과",
    });
    await expect(
      reopenedCandidateLedger.locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expect(
      reopenedCandidateLedger.getByText("2곳", { exact: true }),
    ).toBeVisible();
    await permissionLedger
      .getByRole("button", { name: "철회", exact: true })
      .click();
    await expect(permissionLedger.getByText(/철회됨/u)).toBeVisible();

    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    permissionDialog = await openAssistantContext(page);
    permissionLedger = permissionDialog.getByRole("region", {
      name: "조수 권한 목록",
    });
    await expect(permissionLedger.getByText(destinationId, { exact: true }))
      .toBeVisible();
    await expect(permissionLedger.getByText(/철회됨/u)).toBeVisible();
    await expect(permissionLedger.getByRole("button", { name: "철회" }))
      .toHaveCount(0);
    await expect(
      permissionDialog
        .getByRole("region", { name: "어휘 검색 결과" })
        .locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expectEditorText(
      page.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens assistant vocabulary occurrences across episodes and blocks stale revisions", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-vocabulary-cross-episode-"),
  );
  const workTitle = randomUUID();
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const query = `어휘-${randomUUID()}`;
  const prefix = `${randomUUID()} 앞 `;
  const suffix = ` 뒤 ${randomUUID()}`;
  const episodeAManuscript = `${prefix}${query}${suffix}`;
  const episodeBManuscript = `${randomUUID()} 다른 회차 원고 ${randomUUID()}`;
  const revisionEdit = `\n${randomUUID()} revision 변경`;
  const editedEpisodeAManuscript = `${episodeAManuscript}${revisionEdit}`;
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
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const vocabularyOccurrence = (dialog: Locator) => {
    const ledger = dialog.getByRole("region", { name: "어휘 검색 결과" });
    const candidate = ledger.locator("li").filter({ hasText: query }).first();
    return candidate
      .locator(".assistant-vocabulary-occurrence-list")
      .getByRole("button")
      .filter({ hasText: episodeATitle })
      .first();
  };

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(episodeATitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(episodeAManuscript);
    await expectEditorText(manuscript, episodeAManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const episodeADocumentId = await readActiveDocumentId(page);

    await createNamedEpisode(page, episodeBTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, "");
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(episodeBManuscript);
    await expectEditorText(manuscript, episodeBManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const episodeBDocumentId = await readActiveDocumentId(page);
    expect(episodeBDocumentId).not.toBe(episodeADocumentId);

    await activateDocumentFromTree(page, episodeATitle);
    await expectEditorText(manuscript, episodeAManuscript);
    await manuscript.click();
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < query.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(query);

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    await permissionDialog
      .getByRole("button", { name: "선택 어휘 검색", exact: true })
      .click();
    const candidateLedger = permissionDialog.getByRole("region", {
      name: "어휘 검색 결과",
    });
    await expect(
      candidateLedger.locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expect(candidateLedger.getByText("1곳", { exact: true })).toBeVisible();
    await expect(vocabularyOccurrence(permissionDialog)).toBeVisible();
    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();

    await activateDocumentFromTree(page, episodeBTitle);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);
    const tabStrip = page.locator(".document-tab-strip");
    const documentTab = (title: string) =>
      tabStrip.locator(".document-tab-item").filter({ hasText: title });
    await expect(
      documentTab(episodeBTitle).locator(".document-tab-activate"),
    ).toHaveAttribute("aria-selected", "true");
    await documentTab(episodeATitle)
      .locator(".document-tab-close")
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(documentTab(episodeATitle)).toHaveCount(0);

    permissionDialog = await openAssistantContext(page);
    await vocabularyOccurrence(permissionDialog).click();
    await expect(permissionDialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(query);
    await expectEditorText(manuscript, episodeAManuscript);
    await expect(
      documentTab(episodeATitle).locator(".document-tab-activate"),
    ).toHaveAttribute("aria-selected", "true");
    await expect(documentTab(episodeBTitle)).toHaveCount(1);

    await activateDocumentFromTree(page, episodeBTitle);
    await expectEditorText(manuscript, episodeBManuscript);
    await activateDocumentFromTree(page, episodeATitle);
    await expectEditorText(manuscript, episodeAManuscript);
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(revisionEdit);
    await expectEditorText(manuscript, editedEpisodeAManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await activateDocumentFromTree(page, episodeBTitle);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);
    permissionDialog = await openAssistantContext(page);
    await vocabularyOccurrence(permissionDialog).click();
    await expect(permissionDialog.getByRole("alert")).toHaveText(
      "저장된 어휘 위치의 원고 revision이 변경되었습니다.",
    );
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeBTitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);
    await expect(
      documentTab(episodeBTitle).locator(".document-tab-activate"),
    ).toHaveAttribute("aria-selected", "true");

    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await activateDocumentFromTree(page, episodeATitle);
    await expectEditorText(manuscript, editedEpisodeAManuscript);
    await activateDocumentFromTree(page, episodeBTitle);
    await expectEditorText(manuscript, episodeBManuscript);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists exact-selection notation Candidates without changing the manuscript", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-notation-review-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const forbiddenTerm = `금칙-${randomUUID()}`;
  const destinationId = "local-selected-notation-review";
  const manuscriptText = `범위 밖 ${forbiddenTerm}\n선택 ${forbiddenTerm} 끝`;
  const selectionFrom = manuscriptText.lastIndexOf(forbiddenTerm);
  const selectionTo = selectionFrom + forbiddenTerm.length;
  const basePreflightProfile = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "config", "manuscript-preflight.json"),
      "utf8",
    ),
  ) as {
    schemaVersion: 1;
    defaults: Record<string, unknown>;
    limits: Record<string, unknown>;
  };
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_MANUSCRIPT_PREFLIGHT_PROFILE: JSON.stringify({
      ...basePreflightProfile,
      defaults: {
        ...basePreflightProfile.defaults,
        forbiddenTerms: [forbiddenTerm],
        forbiddenCaseSensitive: true,
      },
    }),
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
    await page.setViewportSize({ width: 1280, height: 900 });
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
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+Home");
    for (let index = 0; index < selectionFrom; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < forbiddenTerm.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByLabel("기능 목적지").selectOption(
      destinationId,
    );
    await expect(permissionDialog.getByLabel("로컬 읽기"))
      .toHaveValue("selection");
    await expect(permissionDialog.getByLabel("외부 전송"))
      .toHaveValue("none");
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    await permissionDialog
      .getByRole("button", { name: "선택 표기 점검", exact: true })
      .click();

    let candidateLedger = permissionDialog.getByRole("region", {
      name: "표기 점검 결과",
    });
    const findingButtonName =
      `금칙어 · ${forbiddenTerm} ${selectionFrom}–${selectionTo}`;
    await expect(candidateLedger.getByText("1곳", { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByRole("button", {
      name: findingButtonName,
      exact: true,
    })).toBeVisible();
    const receiptLedger = permissionDialog.getByRole("region", {
      name: "조수 접근 기록",
    });
    await expect(receiptLedger.getByText(
      `읽기 ${forbiddenTerm.length.toLocaleString()}자 · 전송 0자`,
      { exact: true },
    )).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);

    await candidateLedger.getByRole("button", {
      name: findingButtonName,
      exact: true,
    }).click();
    await expect(permissionDialog).toBeHidden();
    await expect
      .poll(() =>
        page.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({ anchor: selectionFrom, head: selectionTo });
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    permissionDialog = await openAssistantContext(page);
    candidateLedger = permissionDialog.getByRole("region", {
      name: "표기 점검 결과",
    });
    await expect(candidateLedger.getByRole("button", {
      name: findingButtonName,
      exact: true,
    })).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists assistant connections without returning or writing plaintext credentials", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-connections-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const connectionLabel = `connection-${randomUUID()}`;
  const updatedLabel = `updated-${randomUUID()}`;
  const endpoint = `https://${randomUUID()}.invalid/rpc`;
  const model = `model-${randomUUID()}`;
  const credential = `credential-${randomUUID()}`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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
    await page.setViewportSize({ width: 1280, height: 900 });
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

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    let connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption(
      "eum-structured-json-v1",
    );
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog
      .getByRole("textbox", { name: "자격 증명", exact: true })
      .fill(credential);
    await connectionDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(connectionLabel);
    await expect(
      connectionDialog.getByRole("textbox", {
        name: "자격 증명",
        exact: true,
      }),
    ).toHaveValue("");
    const rendererProjection = await page.evaluate(async () =>
      JSON.stringify(await window.eumStudio.assistant.listConnections()),
    );
    expect(rendererProjection).not.toContain(credential);
    expect(
      await readFile(path.join(connectionRoot, "connections.json"), "utf8"),
    ).not.toContain(credential);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    permissionDialog = await openAssistantContext(page);
    await permissionDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await expect(connectionDialog.getByLabel("연결 종류")).toHaveValue(
      "eum-structured-json-v1",
    );
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(connectionLabel);
    await expect(connectionDialog.getByLabel("Endpoint")).toHaveValue(endpoint);
    await expect(connectionDialog.getByLabel("Model")).toHaveValue(model);
    await expect(
      connectionDialog.getByRole("textbox", {
        name: "자격 증명",
        exact: true,
      }),
    ).toHaveValue("");
    await connectionDialog.getByLabel("연결 이름").fill(updatedLabel);
    await connectionDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(updatedLabel);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    permissionDialog = await openAssistantContext(page);
    await permissionDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(updatedLabel);
    await connectionDialog
      .getByRole("button", { name: "삭제", exact: true })
      .click();
    await expect(connectionDialog.getByText("저장된 연결이 없습니다."))
      .toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(async () =>
          (await window.eumStudio.assistant.listConnections()).connections.length,
        ),
      )
      .toBe(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("sends only an approved exact selection to a user connector and reopens the vocabulary suggestion Candidate", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-vocabulary-suggestion-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const connectionLabel = `connection-${randomUUID()}`;
  const model = `model-${randomUUID()}`;
  const query = `query-${randomUUID()}`;
  const selectedText = `selection-${randomUUID()}`;
  const manuscriptText = `outside-${randomUUID()} ${selectedText} tail-${randomUUID()}`;
  const suggestionWord = `suggestion-${randomUUID()}`;
  const suggestionNuance = `nuance-${randomUUID()}`;
  const suggestionExample = `example-${randomUUID()}`;
  const suggestionNote = `note-${randomUUID()}`;
  const receivedRequests: Array<{
    readonly method: string | undefined;
    readonly url: string | undefined;
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly body: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      receivedRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        schemaVersion: 1,
        payload: {
          suggestions: [{
            word: suggestionWord,
            nuance: suggestionNuance,
            example: suggestionExample,
          }],
          note: suggestionNote,
        },
      }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const serverAddress = server.address();
  if (serverAddress === null || typeof serverAddress === "string") {
    throw new Error("Expected a local connector TCP address");
  }
  const endpoint = `http://127.0.0.1:${serverAddress.port}/assistant`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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
    await page.setViewportSize({ width: 1280, height: 900 });
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
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const selectionFrom = manuscriptText.indexOf(selectedText);
    const selectionTo = selectionFrom + selectedText.length;
    await manuscript.press("Control+Home");
    for (let index = 0; index < selectionFrom; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < selectedText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    const connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption(
      "eum-structured-json-v1",
    );
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 없음/u }),
    ).toContainText(connectionLabel);
    await connectionDialog
      .getByRole("button", { name: "닫기", exact: true })
      .click();

    permissionDialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await expect(permissionDialog).toBeVisible();
    await permissionDialog.getByLabel("어휘 제안 연결").selectOption({
      label: `${connectionLabel} · ${model}`,
    });
    await permissionDialog.getByLabel("어휘 제안 질문").fill(query);
    await permissionDialog
      .getByLabel("현재 원고의 정확한 선택 범위 함께 보내기")
      .check();
    await permissionDialog
      .getByRole("button", { name: "선택 전송 권한 승인", exact: true })
      .click();
    await expect(
      permissionDialog.getByRole("button", { name: "제안 받기", exact: true }),
    ).toBeEnabled();
    await permissionDialog
      .getByRole("button", { name: "제안 받기", exact: true })
      .click();

    const candidateLedger = permissionDialog.getByRole("region", {
      name: "어휘·유의어 제안 결과",
    });
    await expect(candidateLedger.getByText(suggestionWord, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(suggestionNuance, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(suggestionExample, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(suggestionNote, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(
      `${documentTitle} ${selectionFrom}–${selectionTo}`,
      { exact: false },
    )).toBeVisible();
    const receiptLedger = permissionDialog.getByRole("region", {
      name: "조수 접근 기록",
    });
    await expect(receiptLedger.getByText(
      `읽기 ${selectedText.length.toLocaleString()}자 · 전송 ${selectedText.length.toLocaleString()}자`,
      { exact: true },
    )).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
    await expect.poll(() => receivedRequests.length).toBe(1);
    expect(receivedRequests[0]).toMatchObject({
      method: "POST",
      url: "/assistant",
      body: {
        schemaVersion: 1,
        operation: "vocabulary-suggestions",
        model,
        input: { query, context: selectedText },
      },
    });
    expect(receivedRequests[0]?.headers.authorization).toBeUndefined();
    expect(JSON.stringify(receivedRequests[0]?.body)).not.toContain(
      manuscriptText.slice(0, selectionFrom),
    );
    expect(JSON.stringify(receivedRequests[0]?.body)).not.toContain(
      manuscriptText.slice(selectionTo),
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    permissionDialog = await openAssistantContext(page);
    const reopenedCandidateLedger = permissionDialog.getByRole("region", {
      name: "어휘·유의어 제안 결과",
    });
    await expect(
      reopenedCandidateLedger.getByText(suggestionWord, { exact: true }),
    ).toBeVisible();
    await expect(
      reopenedCandidateLedger.getByText(connectionLabel, { exact: false }),
    ).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
    expect(receivedRequests).toHaveLength(1);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("sends only the approved current chapter and current Work settings to a user connector and reopens read-only setting proposals", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-external-setting-review-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const workTitle = randomUUID();
  const firstDocumentTitle = `현재-${randomUUID()}`;
  const secondDocumentTitle = `제외-${randomUUID()}`;
  const connectionLabel = `setting-connection-${randomUUID()}`;
  const model = `setting-model-${randomUUID()}`;
  const query = `setting-query-${randomUUID()}`;
  const characterName = `해린-${randomUUID()}`;
  const originalRole = `항해사-${randomUUID()}`;
  const proposedRole = `왕실 항해사-${randomUUID()}`;
  const firstManuscript = `${characterName}은 왕실 항해사로 불렸다. ${randomUUID()}`;
  const excludedManuscript = `다른 회차 비밀 ${randomUUID()}`;
  const replyText = `검토 응답 ${randomUUID()}`;
  const reviewNote = `역할 충돌 ${randomUUID()}`;
  const evidenceFrom = firstManuscript.indexOf(characterName);
  const evidenceTo = evidenceFrom + characterName.length;
  const receivedRequests: Array<{
    readonly method: string | undefined;
    readonly url: string | undefined;
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly body: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        schemaVersion: 1;
        operation: string;
        model: string;
        input: {
          query: string;
          manuscript: {
            documentId: string;
            documentRevisionId: string;
            from: number;
            to: number;
            text: string;
          };
          settings: Array<{
            kind: "character" | "plot" | "foreshadow";
            entityId: string;
            revision: number;
            label: string;
            fields: Array<{ field: string; value: string }>;
          }>;
        };
      };
      receivedRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
      });
      const character = body.input.settings.find((setting) =>
        setting.kind === "character" && setting.label === characterName
      );
      if (character === undefined) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "missing character" }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        schemaVersion: 1,
        payload: {
          reply: replyText,
          proposals: [{
            action: "update",
            settingKind: "character",
            target: {
              kind: character.kind,
              entityId: character.entityId,
              revision: character.revision,
            },
            label: character.label,
            field: "role",
            value: proposedRole,
            evidenceRange: {
              documentId: body.input.manuscript.documentId,
              documentRevisionId: body.input.manuscript.documentRevisionId,
              from: evidenceFrom,
              to: evidenceTo,
            },
            certainty: "explicit",
          }],
          reviewNotes: [{
            kind: "conflict",
            message: reviewNote,
            references: [{
              kind: character.kind,
              entityId: character.entityId,
              revision: character.revision,
            }],
          }],
        },
      }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const serverAddress = server.address();
  if (serverAddress === null || typeof serverAddress === "string") {
    throw new Error("Expected a local connector TCP address");
  }
  const endpoint = `http://127.0.0.1:${serverAddress.port}/assistant`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStructureTab(page, "인물");
    let characterDialog = page.getByRole("region", { name: "인물 구조" });
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(characterName);
    await characterDialog.getByLabel("인물 역할").fill(originalRole);
    await characterDialog.getByRole("button", { name: "인물 만들기", exact: true }).click();
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    await expect(page.getByTestId("manuscript-character-count")).toHaveText(
      "0",
    );
    await manuscript.click();
    await manuscript.pressSequentially(excludedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await activateDocumentFromTree(page, firstDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, firstManuscript);

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByRole("button", { name: "연결 설정", exact: true }).click();
    const connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption("eum-structured-json-v1");
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(connectionDialog.getByRole("button", { name: /자격 증명 없음/u }))
      .toContainText(connectionLabel);
    await connectionDialog.getByRole("button", { name: "닫기", exact: true }).click();

    permissionDialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await permissionDialog.getByLabel("외부 설정 검토 연결").selectOption({
      label: `${connectionLabel} · ${model}`,
    });
    await permissionDialog.getByLabel("외부 설정 검토 질문").fill(query);
    await permissionDialog
      .getByRole("button", { name: "회차·설정 전송 권한 승인", exact: true })
      .click();
    await expect(
      permissionDialog.getByRole("button", { name: "외부 검토 받기", exact: true }),
    ).toBeEnabled();
    await permissionDialog
      .getByRole("button", { name: "외부 검토 받기", exact: true })
      .click();

    const candidateLedger = permissionDialog.getByRole("region", {
      name: "외부 설정 검토 결과",
    });
    await expect(candidateLedger.getByText(proposedRole, { exact: false })).toBeVisible();
    await expect(candidateLedger.getByText(replyText, { exact: true })).toBeVisible();
    await expect(candidateLedger.getByText(reviewNote, { exact: true })).toBeVisible();
    await expect(candidateLedger.getByText("설정 전송 1개", { exact: false })).toBeVisible();
    await expect(candidateLedger.getByRole("button", {
      name: `원고 근거 ${evidenceFrom}–${evidenceTo} 열기`,
      exact: true,
    })).toBeVisible();
    await expectEditorText(manuscript, firstManuscript);
    await expect.poll(() => receivedRequests.length).toBe(1);
    expect(receivedRequests[0]).toMatchObject({
      method: "POST",
      url: "/assistant",
      body: {
        schemaVersion: 1,
        operation: "setting-review",
        model,
        input: {
          query,
          manuscript: {
            from: 0,
            to: firstManuscript.length,
            text: firstManuscript,
          },
          settings: [{
            kind: "character",
            label: characterName,
            fields: expect.arrayContaining([
              { field: "role", value: originalRole },
            ]),
          }],
        },
      },
    });
    expect(receivedRequests[0]?.headers.authorization).toBeUndefined();
    expect(JSON.stringify(receivedRequests[0]?.body)).not.toContain(excludedManuscript);

    await candidateLedger.getByRole("button", {
      name: /검토 당시 인물 r1 열기/u,
    }).click();
    characterDialog = page.getByRole("region", { name: "인물 구조" });
    await expect(characterDialog.getByLabel("인물 역할")).toHaveValue(originalRole);
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, firstManuscript);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, firstManuscript);
    permissionDialog = await openAssistantContext(page);
    const reopenedCandidateLedger = permissionDialog.getByRole("region", {
      name: "외부 설정 검토 결과",
    });
    await expect(reopenedCandidateLedger.getByText(proposedRole, { exact: false }))
      .toBeVisible();
    await expect(reopenedCandidateLedger.getByText(connectionLabel, { exact: false }))
      .toBeVisible();
    await expectEditorText(manuscript, firstManuscript);
    expect(receivedRequests).toHaveLength(1);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens and persists exact duplicate and field conflict setting references without changing settings", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-setting-review-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const duplicateName = `해린-${randomUUID()}`;
  const duplicatePlotTitle = `푸른 문-${randomUUID()}`;
  const duplicateForeshadowTitle = `돌아올 약속-${randomUUID()}`;
  const characterRoles = ["첫 인물", "두 번째 인물"] as const;
  const plotStages = ["초반", "후반"] as const;
  const foreshadowNotes = ["첫 메모", "두 번째 메모"] as const;
  const destinationId = "local-exact-setting-review";
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
    await page.setViewportSize({ width: 1280, height: 900 });
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

    await openStructureTab(page, "인물");
    let characterDialog = page.getByRole("region", { name: "인물 구조" });
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(duplicateName);
    await characterDialog.getByLabel("인물 역할").fill(characterRoles[0]);
    await characterDialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await characterDialog
      .getByRole("button", { name: "인물 추가", exact: true })
      .click();
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(duplicateName);
    await characterDialog.getByLabel("인물 역할").fill(characterRoles[1]);
    await characterDialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("플롯 제목").fill(duplicatePlotTitle);
    await plotDialog.getByLabel("플롯 단계").fill(plotStages[0]);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "새 플롯", exact: true })
      .click();
    await plotDialog.getByLabel("플롯 제목").fill(duplicatePlotTitle);
    await plotDialog.getByLabel("플롯 단계").fill(plotStages[1]);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await openStructureTab(page, "복선");
    let foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    const createForeshadowRegion = foreshadowDialog.locator(
      ".foreshadow-line-create",
    );
    await createForeshadowRegion.getByLabel("새 복선 이름")
      .fill(duplicateForeshadowTitle);
    await createForeshadowRegion.getByLabel("작가 메모")
      .fill(foreshadowNotes[0]);
    await createForeshadowRegion
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await createForeshadowRegion.getByLabel("새 복선 이름")
      .fill(duplicateForeshadowTitle);
    await createForeshadowRegion.getByLabel("작가 메모")
      .fill(foreshadowNotes[1]);
    await createForeshadowRegion
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByLabel("기능 목적지").selectOption(
      destinationId,
    );
    await expect(
      permissionDialog.getByRole("combobox", { name: "기능", exact: true }),
    ).toHaveValue("lore-review");
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    await permissionDialog
      .getByRole("button", { name: "설정 검토", exact: true })
      .click();
    const findingLedger = permissionDialog.getByRole("region", {
      name: "설정 검토 결과",
    });
    await expect(findingLedger.getByText(`“${duplicateName}”`, { exact: true }))
      .toHaveCount(2);
    await expect(
      findingLedger.getByText(`“${duplicatePlotTitle}”`, { exact: true }),
    ).toHaveCount(2);
    await expect(
      findingLedger.getByText(`“${duplicateForeshadowTitle}”`, { exact: true }),
    ).toHaveCount(2);
    await expect(findingLedger.getByText("2개", { exact: true })).toHaveCount(6);
    await expect(
      findingLedger.getByText("인물 안의 역할 값이 서로 다름", { exact: true }),
    ).toBeVisible();
    await expect(
      findingLedger.getByText("플롯 안의 단계 값이 서로 다름", { exact: true }),
    ).toBeVisible();
    await expect(
      findingLedger.getByText("복선 안의 메모 값이 서로 다름", { exact: true }),
    ).toBeVisible();
    const settingReceiptLedger = permissionDialog.getByRole("region", {
      name: "설정 검토 접근 기록",
    });
    await expect(
      settingReceiptLedger.getByText("읽기 6개 · 외부 전송 0개", {
        exact: true,
      }),
    ).toBeVisible();

    const reopenPermissionDialog = async () => {
      return openAssistantContext(page);
    };

    const openedCharacterRoles: string[] = [];
    for (let index = 1; index <= 2; index += 1) {
      await permissionDialog.getByRole("button", {
        name: `“${duplicateName}” 역할 충돌 인물 ${index} 열기`,
        exact: true,
      }).click();
      characterDialog = page.getByRole("region", { name: "인물 구조" });
      openedCharacterRoles.push(
        await characterDialog.getByLabel("인물 역할").inputValue(),
      );
      if (index < 2) permissionDialog = await reopenPermissionDialog();
    }
    expect(openedCharacterRoles.sort()).toEqual([...characterRoles].sort());

    permissionDialog = await reopenPermissionDialog();
    const openedPlotStages: string[] = [];
    for (let index = 1; index <= 2; index += 1) {
      await permissionDialog.getByRole("button", {
        name: `“${duplicatePlotTitle}” 단계 충돌 플롯 ${index} 열기`,
        exact: true,
      }).click();
      plotDialog = page.getByRole("region", { name: "플롯 작업면" });
      openedPlotStages.push(
        await plotDialog.getByLabel("플롯 단계").inputValue(),
      );
      if (index < 2) permissionDialog = await reopenPermissionDialog();
    }
    expect(openedPlotStages.sort()).toEqual([...plotStages].sort());

    permissionDialog = await reopenPermissionDialog();
    const openedForeshadowNotes: string[] = [];
    for (let index = 1; index <= 2; index += 1) {
      await permissionDialog.getByRole("button", {
        name: `“${duplicateForeshadowTitle}” 메모 충돌 복선 ${index} 열기`,
        exact: true,
      }).click();
      foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
      const selectedLine = foreshadowDialog.locator(
        '.foreshadow-line-card[aria-current="true"]',
      );
      await expect(selectedLine).toHaveCount(1);
      openedForeshadowNotes.push(
        await selectedLine.getByLabel("복선 작가 메모").inputValue(),
      );
      if (index < 2) permissionDialog = await reopenPermissionDialog();
    }
    expect(openedForeshadowNotes.sort()).toEqual([...foreshadowNotes].sort());

    permissionDialog = await reopenPermissionDialog();

    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    const restoredCharacterProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      return window.eumStudio.characters.list({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(
      restoredCharacterProjection.characters.filter(
        (character) => character.name === duplicateName,
      ),
    ).toHaveLength(2);
    permissionDialog = await openAssistantContext(page);
    const reopenedFindingLedger = permissionDialog.getByRole("region", {
      name: "설정 검토 결과",
    });
    await expect(
      reopenedFindingLedger.getByText(`“${duplicateName}”`, { exact: true }),
    ).toHaveCount(2);
    await expect(
      reopenedFindingLedger.getByText(
        "인물 안의 역할 값이 서로 다름",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      permissionDialog
        .getByRole("region", { name: "설정 검토 접근 기록" })
        .getByText("읽기 6개 · 외부 전송 0개", { exact: true }),
    ).toBeVisible();
    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await openStructureTab(page, "플롯");
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(
      plotDialog.locator(".plot-manager-list > ul > li").filter({
        hasText: duplicatePlotTitle,
      }),
    ).toHaveCount(2);
    const restoredPlotRows = plotDialog.locator(
      ".plot-manager-list > ul > li",
    );
    await expect(restoredPlotRows.filter({ hasText: plotStages[0] }))
      .toHaveCount(1);
    await expect(restoredPlotRows.filter({ hasText: plotStages[1] }))
      .toHaveCount(1);
    await openStructureTab(page, "복선");
    foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    expect(await foreshadowDialog
      .locator('input[aria-label="복선 이름"]')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLInputElement).value)
      ))
      .toEqual([duplicateForeshadowTitle, duplicateForeshadowTitle]);
    expect(await foreshadowDialog
      .locator('textarea[aria-label="복선 작가 메모"]')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLTextAreaElement).value).sort()
      ))
      .toEqual([...foreshadowNotes].sort());
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

