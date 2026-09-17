import {
  randomInt,
  randomUUID,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  tmpdir,
  createServer,
  path,
  DatabaseSync,
  expect,
  test,
  electron,
  openStudioWorkspace,
  installFakeYouTubePlayer,
  continueFromMain,
  openStudioHome,
  openWorkSection,
  openStructureTab,
  openReviewTab,
  openSchedule,
  readActiveDocumentId,
  expectEditorText,
  removeVerifiedTemporaryDirectory,
  createDocumentSwitchProfile,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";
test("opens a home work episode from the native document dropdown", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-home-document-select-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("첫 회차 원고");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    await openStudioHome(page);
    const documentSelect = page.locator(".work-document-select");
    await expect(documentSelect).toHaveCount(1);
    await expect(documentSelect).toHaveValue(
      documentProfile.documents[0].documentId,
    );
    await expect(documentSelect.locator("option")).toHaveCount(3);
    await expect(page.locator(".document-list")).toHaveCount(0);

    await documentSelect.selectOption(documentProfile.documents[1].documentId);
    await expect(page.getByTestId("current-document")).toHaveText(
      documentProfile.documents[1].label,
    );
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("centers the manuscript surface in the manuscript focus screen", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-focus-center-e2e-"),
  );
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(
        createDocumentSwitchProfile("중앙 원고"),
      ),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const initialCharacterCount = Number.parseInt(
      await window.getByTestId("manuscript-character-count").innerText(),
      10,
    );
    await window
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(window.locator(".writing-workspace-manuscript-focus")).toBeVisible();
    const manuscriptFocusCharacterCount = window.getByTestId(
      "manuscript-focus-document-character-count",
    );
    await expect(manuscriptFocusCharacterCount).toHaveText(
      `현재 회차 ${initialCharacterCount}자`,
    );
    const floatingTypography = await window.evaluate(() => {
      const fontSize = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (element === null) {
          throw new Error(`Missing manuscript focus toolbar element: ${selector}`);
        }
        return globalThis.getComputedStyle(element).fontSize;
      };
      return {
        status: fontSize(".manuscript-focus-document-character-count"),
        title: fontSize(".manuscript-focus-toolbar-title strong"),
        control: fontSize(".manuscript-focus-width-control"),
        button: fontSize(".manuscript-focus-toolbar button"),
      };
    });
    expect(floatingTypography).toEqual({
      status: "12px",
      title: "13px",
      control: "12px",
      button: "12px",
    });

    const manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially("끝");
    await expect(manuscriptFocusCharacterCount).toHaveText(
      `현재 회차 ${initialCharacterCount + 1}자`,
    );

    const focusLayout = await window.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".studio-app-shell");
      const workspace = document.querySelector<HTMLElement>(".workspace");
      const content = document.querySelector<HTMLElement>(
        ".manuscript-editor .cm-content",
      );
      if (shell === null || workspace === null || content === null) {
        throw new Error("The manuscript focus layout is incomplete");
      }
      const shellBounds = shell.getBoundingClientRect();
      const workspaceBounds = workspace.getBoundingClientRect();
      const contentBounds = content.getBoundingClientRect();
      return {
        contentCenterDelta:
          contentBounds.left + contentBounds.width / 2 -
          (shellBounds.left + shellBounds.width / 2),
        sidebarWidth: getComputedStyle(shell)
          .getPropertyValue("--eum-sidebar-width")
          .trim(),
        workspaceLeftDelta: workspaceBounds.left - shellBounds.left,
        workspaceRightDelta: shellBounds.right - workspaceBounds.right,
      };
    });
    expect(focusLayout.sidebarWidth).toBe("0px");
    expect(Math.abs(focusLayout.workspaceLeftDelta)).toBeLessThan(1);
    expect(Math.abs(focusLayout.workspaceRightDelta)).toBeLessThan(1);
    expect(Math.abs(focusLayout.contentCenterDelta)).toBeLessThan(1);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("enters and exits the manuscript focus screen without hiding status", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-focus-screen-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("기존 원고");
  let electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const toolbar = window.getByRole("toolbar", {
      name: "원고 편집 도구",
    });

    await expect(documentRail).toBeVisible();
    await expect(toolbar).toBeVisible();
    const feedbackPanel = window.getByTestId("session-feedback");
    const feedbackDragHandle = window.getByRole("button", {
      name: "집중 세션 위치 이동",
      exact: true,
    });
    const feedbackHandleBounds = await feedbackDragHandle.boundingBox();
    if (feedbackHandleBounds === null) {
      throw new Error("The session feedback drag handle is missing");
    }
    await window.mouse.move(
      feedbackHandleBounds.x + feedbackHandleBounds.width / 2,
      feedbackHandleBounds.y + feedbackHandleBounds.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(240, 180, { steps: 4 });
    await window.mouse.up();
    await expect(feedbackPanel).toHaveClass(/is-moved/u);
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("eum_session_feedback_position")
    )).not.toBeNull();
    await window
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(window.locator(".sidebar")).toBeHidden();
    await expect(window.locator(".app-topbar")).toBeHidden();
    await expect(documentRail).toBeHidden();
    await expect(toolbar).toBeHidden();
    await expect(manuscript).toBeVisible();
    await expect(window.getByTestId("session-feedback")).toBeHidden();
    await expect(window.getByTestId("save-state")).toBeVisible();

    const manuscriptFocusToolbar = window.getByRole("region", {
      name: "집중 화면 도구",
    });
    await expect.poll(() => manuscriptFocusToolbar.evaluate((element) =>
      getComputedStyle(element).opacity
    )).toBe("0");
    await window.locator(".manuscript-focus-toolbar-host").hover();
    await expect.poll(() => manuscriptFocusToolbar.evaluate((element) =>
      getComputedStyle(element).opacity
    )).toBe("1");
    const manuscriptFocusDragHandle = window.getByRole("button", {
      name: "집중 화면 도구 위치 이동",
      exact: true,
    });
    const manuscriptFocusHandleBounds = await manuscriptFocusDragHandle.boundingBox();
    if (manuscriptFocusHandleBounds === null) {
      throw new Error("The manuscript focus toolbar drag handle is missing");
    }
    await window.mouse.move(
      manuscriptFocusHandleBounds.x + manuscriptFocusHandleBounds.width / 2,
      manuscriptFocusHandleBounds.y + manuscriptFocusHandleBounds.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(180, 120, { steps: 4 });
    await window.mouse.up();
    await expect(window.locator(".manuscript-focus-floating-surface"))
      .toHaveClass(/is-moved/u);
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("eum_manuscript_focus_toolbar_position")
    )).not.toBeNull();
    const visibleSaveStatus = await window.getByTestId("save-state").innerText();
    await expect(manuscriptFocusToolbar).toContainText(visibleSaveStatus);

    const manuscriptFocusCanvas = window.locator(
      '.manuscript-editor-canvas[data-manuscript-focus="true"]',
    );
    const widthControl = manuscriptFocusToolbar.getByLabel("집중 화면 원고 폭");
    await widthControl.focus();
    await widthControl.press("ArrowRight");
    await expect.poll(() => manuscriptFocusCanvas.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--manuscript-focus-width").trim()
    )).toBe("705px");

    const manuscriptContent = manuscript;
    const initialFontSize = await manuscriptContent.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    );
    await manuscriptFocusToolbar.getByRole("button", {
      name: "집중 화면 확대",
      exact: true,
    }).click();
    await expect.poll(() => manuscriptContent.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )).toBeGreaterThan(initialFontSize);

    await manuscriptFocusToolbar.getByRole("button", {
      name: "현재 문단",
      exact: true,
    }).click();
    await expect(manuscriptFocusCanvas).toHaveAttribute("data-current-paragraph-highlight", "true");
    await manuscriptFocusToolbar.getByRole("button", {
      name: "커서 따라가기",
      exact: true,
    }).click();
    await expect(manuscriptFocusCanvas).toHaveAttribute("data-cursor-follow", "true");
    const cursorViewportControl = manuscriptFocusToolbar.getByLabel("커서 위치", {
      exact: true,
    });
    await expect(cursorViewportControl).toHaveValue("40");
    await cursorViewportControl.fill("30");
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("eum_manuscript_focus_cursor_viewport_percent")
    )).toBe("30");
    await manuscript.click();
    await manuscript.press("Control+End");
    await window.keyboard.insertText("\n첫 줄\n둘째 줄\n셋째 줄");
    const readCursorEyeLineRatio = () =>
      window.locator(".manuscript-editor .cm-line.cm-activeLine").evaluate(
        (activeLine) => {
          const scroller = activeLine.closest<HTMLElement>(".cm-scroller");
          if (scroller === null) {
            throw new Error("The manuscript scroller is missing");
          }
          const cursorRect = activeLine.getBoundingClientRect();
          const scrollerRect = scroller.getBoundingClientRect();
          return (
            cursorRect.top + cursorRect.height / 2 - scrollerRect.top
          ) / scrollerRect.height;
        },
      );
    await expect.poll(async () => {
      const ratio = await readCursorEyeLineRatio();
      return ratio > 0.25 && ratio < 0.35;
    }).toBe(true);
    await window.keyboard.insertText("\n계속 입력");
    await expect.poll(async () => {
      const ratio = await readCursorEyeLineRatio();
      return ratio > 0.25 && ratio < 0.35;
    }).toBe(true);
    await window.locator(".manuscript-focus-toolbar-host").hover();
    await cursorViewportControl.fill("65");
    await expect.poll(async () => {
      const ratio = await readCursorEyeLineRatio();
      return ratio > 0.6 && ratio < 0.7;
    }).toBe(true);

    const cursorFollowSelectionPoints = await window.locator(".cm-line").evaluateAll(
      (lines) => {
        const findLine = (text: string) => {
          const line = lines.find((candidate) => candidate.textContent === text);
          if (!(line instanceof HTMLElement) || !(line.firstChild instanceof Text)) {
            throw new Error(`Missing CodeMirror line: ${text}`);
          }
          return line.firstChild;
        };
        const pointAt = (textNode: Text, offset: number) => {
          const range = document.createRange();
          range.setStart(textNode, offset);
          range.setEnd(textNode, offset + 1);
          const rectangle = range.getBoundingClientRect();
          return {
            x: rectangle.left,
            y: rectangle.top + rectangle.height / 2,
          };
        };
        return {
          start: pointAt(findLine("첫 줄"), 0),
          end: pointAt(findLine("둘째 줄"), 2),
        };
      },
    );
    const scrollTopBeforePointerSelection = await manuscript.evaluate(
      (element) => element.closest<HTMLElement>(".cm-scroller")?.scrollTop ?? -1,
    );
    await window.mouse.move(
      cursorFollowSelectionPoints.start.x,
      cursorFollowSelectionPoints.start.y,
    );
    await window.mouse.down();
    await window.mouse.move(
      cursorFollowSelectionPoints.end.x,
      cursorFollowSelectionPoints.end.y,
      { steps: 4 },
    );
    await window.mouse.up();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? "")
    ).toBe("첫 줄\n둘째");
    const scrollTopAfterPointerSelection = await manuscript.evaluate(
      (element) => element.closest<HTMLElement>(".cm-scroller")?.scrollTop ?? -1,
    );
    expect(Math.abs(
      scrollTopAfterPointerSelection - scrollTopBeforePointerSelection,
    )).toBeLessThan(2);

    await window.keyboard.press("Escape");
    await expect(documentRail).toBeVisible();
    await expect(toolbar).toBeVisible();

    await window.keyboard.press("Escape");
    await expect(documentRail).toBeVisible();
    await window.keyboard.press("Control+Shift+Enter");
    await expect(documentRail).toBeHidden();
    await window.locator(".manuscript-focus-toolbar-host").hover();
    await window
      .getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();
    await expect(documentRail).toBeVisible();
    await expect(toolbar).toBeVisible();

    await electronApp.close();
    electronApp = await electron.launch({
      args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
      cwd: process.cwd(),
      env: {
        ...process.env,
        EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
          JSON.stringify(documentProfile),
        EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
      },
    });
    const reopened = await openStudioWorkspace(electronApp);
    await expect(reopened.getByTestId("session-feedback"))
      .toHaveClass(/is-moved/u);
    await reopened
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(reopened.locator(".manuscript-focus-floating-surface"))
      .toHaveClass(/is-moved/u);
    await reopened.locator(".manuscript-focus-toolbar-host").hover();
    const reopenedManuscriptFocusToolbar = reopened.getByRole("region", {
      name: "집중 화면 도구",
    });
    await expect(
      reopenedManuscriptFocusToolbar.getByRole("button", { name: "커서 따라가기", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      reopenedManuscriptFocusToolbar.getByLabel("커서 위치", { exact: true }),
    ).toHaveValue("65");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("restores the complete manuscript focus contract", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-focus-contract-e2e-"),
  );
  const userDataDirectory = path.join(directory, "electron-user-data");
  const preferencesDirectory = path.join(
    userDataDirectory,
    "ui-preferences-v2",
  );
  const preferencesPath = path.join(preferencesDirectory, "preferences.json");
  const documentProfile = createDocumentSwitchProfile("기존 원고");
  await mkdir(preferencesDirectory, { recursive: true });
  await writeFile(preferencesPath, `${JSON.stringify({
    schemaVersion: 2,
    revision: 9,
    themeKey: "focus-dark-theme",
    manuscriptFocus: {
      manuscriptWidthPx: 810,
      textScalePercent: 120,
      highlightCurrentParagraph: true,
      cursorFollowEnabled: true,
      cursorViewportPercent: 45,
    },
  })}\n`, "utf8");
  const electronArguments = [".", `--user-data-dir=${userDataDirectory}`];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
      JSON.stringify(documentProfile),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    await expect(window.locator(".studio-app-shell")).toHaveAttribute(
      "data-starlight-theme",
      "focus-dark-theme",
    );
    await window
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await window.locator(".manuscript-focus-toolbar-host").hover();
    const toolbar = window.getByRole("region", { name: "집중 화면 도구" });
    await expect(toolbar.getByLabel("집중 화면 원고 폭", { exact: true }))
      .toHaveValue("810");
    await expect(toolbar.getByRole("group", { name: "집중 화면 확대" }))
      .toContainText("120%");
    await expect(toolbar.getByRole("button", { name: "현재 문단", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(toolbar.getByRole("button", {
      name: "커서 따라가기",
      exact: true,
    })).toHaveAttribute("aria-pressed", "true");
    await expect(toolbar.getByLabel("커서 위치", { exact: true }))
      .toHaveValue("45");

    expect(JSON.parse(await readFile(preferencesPath, "utf8"))).toEqual({
      schemaVersion: 2,
      revision: 9,
      themeKey: "focus-dark-theme",
      manuscriptFocus: {
        manuscriptWidthPx: 810,
        textScalePercent: 120,
        highlightCurrentParagraph: true,
        cursorFollowEnabled: true,
        cursorViewportPercent: 45,
      },
    });

  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("records manuscript-focus time in the WritingSession activity ledger", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-focus-time-ledger-"),
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

  const readFocusSession = () => {
    try {
      const database = new DatabaseSync(
        path.join(directory, "workspace.sqlite3"),
        { readOnly: true },
      );
      try {
        return database.prepare(`
          SELECT
            sessions.id,
            sessions.state,
            intervals.started_at AS startedAt,
            intervals.ended_at AS endedAt
          FROM writing_sessions AS sessions
          LEFT JOIN activity_intervals AS intervals
            ON intervals.session_id = sessions.id
          ORDER BY sessions.created_at DESC
          LIMIT 1
        `).get() as
          | {
              readonly id: string;
              readonly state: string;
              readonly startedAt: string | null;
              readonly endedAt: string | null;
            }
          | undefined;
      } finally {
        database.close();
      }
    } catch {
      return undefined;
    }
  };
  const readActiveSessionId = (page: Page) =>
    page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return null;
      const activity = await window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return activity.activeSessionId;
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
    await createWorkDialog.getByLabel("작품 제목").fill(randomUUID());
    await createWorkDialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await page
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(page.locator(".writing-workspace-manuscript-focus")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.locator(".activity-status-error").allTextContents())
      .toEqual([]);
    await expect.poll(() => readActiveSessionId(page)).not.toBeNull();
    await expect.poll(() => readFocusSession()?.state ?? null).toBe("active");
    await page.waitForTimeout(1_200);
    await page.keyboard.press("Escape");
    await expect(page.locator(".app-topbar")).toBeVisible();
    await expect.poll(() => readFocusSession()?.state ?? null).toBe("completed");
    const recorded = readFocusSession();
    expect(recorded?.startedAt).not.toBeNull();
    expect(recorded?.endedAt).not.toBeNull();
    expect(
      Date.parse(recorded?.endedAt ?? "") -
        Date.parse(recorded?.startedAt ?? ""),
    ).toBeGreaterThanOrEqual(1_000);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shows the home manuscript preview and protects only existing text during focused forward writing", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-forward-writing-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile(
    "기존  원고\n둘째 줄\t—기호!\n\n마지막 문장…",
  );
  const firstDocument = documentProfile.documents[0]!;
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 800 });
    await expect(
      window.getByRole("heading", { name: "홈", exact: true }),
    ).toBeVisible();
    await expect.poll(() =>
      window
        .getByLabel("마지막 원고 미리보기", { exact: true })
        .locator(".resume-strip-preview-line")
        .evaluateAll((lines) => lines.map((line) => line.textContent ?? ""))
    ).toEqual(firstDocument.initialText.split("\n"));
    await continueFromMain(window);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toBeVisible();
    const readText = () =>
      manuscript.evaluate((editor) =>
        Array.from(editor.querySelectorAll(":scope > .cm-line"))
          .map((line) => line.textContent ?? "")
          .join("\n"),
      );
    await expect.poll(readText).toBe(firstDocument.initialText);

    await window.getByLabel("본문 글꼴", { exact: true }).selectOption("pretendard");
    await window.getByLabel("글자 크기", { exact: true }).selectOption("20");
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const formattingDialog = window.getByRole("dialog", {
      name: "추가 서식 도구",
    });
    await formattingDialog.getByLabel("행간", { exact: true }).selectOption("1.5");
    await formattingDialog.getByLabel("문단 간격", { exact: true }).selectOption("8");
    await formattingDialog.getByLabel("자간", { exact: true }).selectOption("0.02");
    await formattingDialog.getByLabel("본문 폭", { exact: true }).fill("640");
    await formattingDialog
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();
    await openStudioHome(window);
    const formattedPreview = window.getByLabel("마지막 원고 미리보기", {
      exact: true,
    });
    await expect(formattedPreview).toHaveCSS("font-family", /Pretendard/u);
    await expect(formattedPreview).toHaveCSS("font-size", "20px");
    await expect(formattedPreview).toHaveCSS("max-width", "640px");
    await expect(formattedPreview).toHaveAttribute("data-line-height", "1.5");
    await expect(formattedPreview).toHaveAttribute("data-paragraph-spacing", "8");
    await expect(formattedPreview).toHaveAttribute("data-letter-spacing", "0.02");
    await continueFromMain(window);
    await expect(manuscript).toBeVisible();

    await window
      .getByRole("button", { name: "수정금지 집필 시작", exact: true })
      .click();
    const dialog = window.getByRole("dialog", {
      name: "수정금지 집필 설정",
    });
    await expect(dialog.getByLabel("목표 글자 수")).toHaveValue("");
    await dialog.getByLabel("목표 글자 수").fill("4");
    await dialog.getByRole("button", { name: "시작", exact: true }).click();

    const writingWorkspace = window.locator(".writing-workspace");
    await expect(writingWorkspace).toHaveClass(/writing-workspace-manuscript-focus/u);
    await expect(writingWorkspace).toHaveClass(/writing-workspace-forward-writing/u);
    await expect(window.locator(".forward-writing-composer")).toHaveCount(0);
    await expect(window.locator(".session-feedback-panel")).toBeHidden();
    const manuscriptFocusStatus = window.getByLabel("현재 집중 상태", { exact: true });
    await expect(manuscriptFocusStatus).toBeVisible();
    await expect(manuscriptFocusStatus).toContainText("수정금지 집필");
    await expect(manuscriptFocusStatus).toContainText("목표까지 4자");
    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    await expect.poll(readText).toBe(firstDocument.initialText);

    await manuscript.press("Control+Home");
    await manuscript.pressSequentially("새");
    await expect.poll(readText).toBe(`새${firstDocument.initialText}`);
    await manuscript.press("Backspace");
    await expect.poll(readText).toBe(firstDocument.initialText);

    await manuscript.press("Control+End");
    await manuscript.pressSequentially("새 문단");
    await expect.poll(readText).toBe(`${firstDocument.initialText}새 문단`);
    await expect(manuscriptFocusStatus).toContainText("목표 달성 · 4자");

    await window.locator(".manuscript-focus-toolbar-host").hover();
    await window
      .getByRole("button", { name: "수정금지 종료", exact: true })
      .click();
    await expect(writingWorkspace).not.toHaveClass(/writing-workspace-manuscript-focus/u);
    await expect(writingWorkspace).not.toHaveClass(/writing-workspace-forward-writing/u);
    await manuscript.click();
    await manuscript.press("Control+Home");
    await manuscript.pressSequentially("추가");
    await expect.poll(readText).toBe(
      `추가${firstDocument.initialText}새 문단`,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shows sentence and repeated-word heatmaps with manuscript analysis", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-analysis-e2e-"),
  );
  const manuscriptText = `${"별빛 ".repeat(6)}끝.\n${"가".repeat(81)}.`;
  const documentProfile = createDocumentSwitchProfile(manuscriptText);
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const heatmap = window.getByLabel("히트맵", { exact: true });

    await heatmap.selectOption("sentence");
    await expect(
      window.locator(".manuscript-editor .cm-editor"),
    ).toHaveAttribute("data-heatmap-mode", "sentence");
    await expect(window.locator(".manuscript-heatmap-extreme")).toHaveCount(1);
    await heatmap.selectOption("word");
    await expect(
      window.locator(".manuscript-heatmap-word-dense"),
    ).toHaveCount(6);
    await expectEditorText(manuscript, manuscriptText);

    await window
      .getByRole("button", { name: "원고 분석", exact: true })
      .click();
    const dialog = window.getByRole("dialog", { name: "원고 분석" });
    await expect(dialog).toContainText("별빛");
    await expect(dialog).toContainText("문장 길이");
    await expect(dialog).toContainText("반복 어휘 밀도");
    await dialog
      .getByRole("button", { name: "원고 분석 닫기", exact: true })
      .click();
    await window
      .getByRole("button", { name: "원고 분석", exact: true })
      .click();
    const reopenedDialog = window.getByRole("dialog", { name: "원고 분석" });
    await expect(reopenedDialog).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(reopenedDialog).toBeHidden();
    await expectEditorText(manuscript, manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses the bundled curved quotes and evolving bracket input profile", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-bundled-input-profile-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("");
  const runtimeEnvironment = { ...process.env };
  delete runtimeEnvironment.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE;
  delete runtimeEnvironment.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE_PATH;
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...runtimeEnvironment,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });

    await manuscript.pressSequentially("\"");
    await expectEditorText(manuscript, "“”");
    await manuscript.pressSequentially("인용");
    await manuscript.pressSequentially("\"");
    await expectEditorText(manuscript, "“인용”");

    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    await manuscript.pressSequentially("(");
    await expectEditorText(manuscript, "()");
    await manuscript.pressSequentially("(");
    await expectEditorText(manuscript, "【】");
    await manuscript.pressSequentially("(");
    await expectEditorText(manuscript, "〖〗");

    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    await manuscript.pressSequentially("...");
    await expectEditorText(manuscript, "⋯");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens manuscript search with Ctrl+F and replaces one or all matches", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-search-replace-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile(
    "고양이는 창가에 앉았다.\n고양이는 다시 창가를 보았다.",
  );
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expectEditorText(
      manuscript,
      "고양이는 창가에 앉았다.\n고양이는 다시 창가를 보았다.",
    );

    await manuscript.press("Control+f");
    const searchPanel = window.locator(".manuscript-editor .cm-search");
    await expect(searchPanel).toBeVisible();
    await searchPanel.getByLabel("검색", { exact: true }).fill("고양이");
    await searchPanel.getByLabel("바꾸기", { exact: true }).fill("강아지");
    await searchPanel.getByRole("button", { name: "다음", exact: true })
      .click();
    await searchPanel.getByRole("button", { name: "바꾸기", exact: true })
      .click();
    await expectEditorText(
      manuscript,
      "강아지는 창가에 앉았다.\n고양이는 다시 창가를 보았다.",
    );
    await searchPanel.getByRole("button", {
      name: "모두 바꾸기",
      exact: true,
    }).click();
    await expectEditorText(
      manuscript,
      "강아지는 창가에 앉았다.\n강아지는 다시 창가를 보았다.",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("runs selected, one-track, full, and random-repeat playback through the full queue", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-playback-modes-e2e-"),
  );
  const searches: string[] = [];
  const upstream = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && requestUrl.pathname === "/youtube/v3/search") {
      searches.push(requestUrl.searchParams.get("q") ?? "");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        items: [1, 2, 3].map((index) => ({
          id: { videoId: `mode-video-${index}` },
          snippet: {
            title: `모드 곡 ${index}`,
            channelTitle: "모드 테스트",
            thumbnails: {},
          },
        })),
      }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", () => resolve());
  });
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a loopback YouTube server");
  }
  const userDataPath = path.join(directory, "electron-user-data");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${userDataPath}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
      EUM_STUDIO_YOUTUBE_MUSIC_PROFILE: JSON.stringify({
        schemaVersion: 1,
        providerId: "youtube",
        displayName: "YouTube",
        searchApiBaseUrl: `http://127.0.0.1:${address.port}/youtube/v3`,
        iframeApiUrl: "https://www.youtube.com/iframe_api",
        watchBaseUrl: "https://www.youtube.com/watch",
        playerReferer: "https://eum-studio/",
        searchLimit: 6,
        videosPerOption: 3,
        requestTimeoutMs: 10_000,
      }),
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await installFakeYouTubePlayer(page);
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(randomUUID());
    await createWorkDialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    const settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await settingsDialog.getByRole("tab", { name: "음악", exact: true }).click();
    await settingsDialog.getByLabel("YouTube Data API 키").fill("mode-key");
    await settingsDialog.getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();

    const player = page.getByRole("region", { name: "음악 플레이어" });
    await player.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const library = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    const libraryBounds = await library.boundingBox();
    if (libraryBounds === null) throw new Error("Expected music palette bounds");
    expect(libraryBounds.width).toBeLessThanOrEqual(422);
    expect(libraryBounds.height).toBeLessThanOrEqual(562);
    await library.getByRole("tab", {
      name: "YouTube 검색 탭",
      exact: true,
    }).click();
    await library.getByLabel("음악 검색어", { exact: true }).fill("모드 재생");
    await library.getByRole("button", { name: "검색", exact: true }).click();
    await expect.poll(() => searches.length).toBe(1);
    expect(searches[0]).toContain("모드 재생");
    const results = library.getByRole("region", {
      name: "검색 결과",
      exact: true,
    });
    for (const index of [1, 2, 3]) {
      await results.getByRole("button", {
        name: `모드 곡 ${index} 재생목록에 추가`,
        exact: true,
      }).click();
    }
    await library.getByRole("tab", {
      name: "재생목록 탭",
      exact: true,
    }).click();
    const queue = library.getByRole("region", {
      name: "재생목록",
      exact: true,
    });
    await expect(queue.getByRole("listitem")).toHaveCount(3);

    const secondTrack = queue.getByRole("listitem").filter({
      hasText: "모드 곡 2",
    });
    await secondTrack.getByRole("button", {
      name: "모드 곡 2 위로 이동",
      exact: true,
    }).click();
    await expect(queue.getByRole("listitem").first()).toContainText("모드 곡 2");
    await secondTrack.getByRole("button", {
      name: "모드 곡 2 아래로 이동",
      exact: true,
    }).click();
    await expect(queue.getByRole("listitem").nth(1)).toContainText("모드 곡 2");

    const loadCalls = async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:"));
    const clearCalls = async () => page.evaluate(() => {
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls?.splice(0);
    });
    const endTrack = async () => page.evaluate(() => {
      (window as unknown as { __youtubePlayerEnd?: () => void })
        .__youtubePlayerEnd?.();
    });

    await clearCalls();
    await queue.getByRole("button", {
      name: "모드 곡 2 바로 재생",
      exact: true,
    }).click();
    await expect.poll(loadCalls).toEqual(["load:mode-video-2"]);
    await player.getByRole("button", { name: "다음 곡", exact: true }).click();
    await expect.poll(loadCalls).toEqual([
      "load:mode-video-2",
      "load:mode-video-3",
    ]);

    let repeatButton = player.getByRole("button", {
      name: "반복 끔",
      exact: true,
    });
    await repeatButton.click();
    repeatButton = player.getByRole("button", {
      name: "전체 반복",
      exact: true,
    });
    await repeatButton.click();
    repeatButton = player.getByRole("button", {
      name: "한 곡 반복",
      exact: true,
    });
    await clearCalls();
    await queue.getByRole("button", {
      name: "모드 곡 1 바로 재생",
      exact: true,
    }).click();
    await expect.poll(loadCalls).toEqual(["load:mode-video-1"]);
    await endTrack();
    await expect.poll(loadCalls).toEqual([
      "load:mode-video-1",
      "load:mode-video-1",
    ]);

    await repeatButton.click();
    await player.getByRole("button", { name: "반복 끔", exact: true }).click();
    await clearCalls();
    await queue.getByRole("button", {
      name: "모드 곡 3 바로 재생",
      exact: true,
    }).click();
    await expect.poll(loadCalls).toEqual(["load:mode-video-3"]);
    await endTrack();
    await expect.poll(loadCalls).toEqual([
      "load:mode-video-3",
      "load:mode-video-1",
    ]);

    await clearCalls();
    await queue.getByRole("button", {
      name: "모드 곡 1 바로 재생",
      exact: true,
    }).click();
    await expect.poll(loadCalls).toEqual(["load:mode-video-1"]);
    await page.evaluate(() => {
      Math.random = () => 0;
    });
    await player.getByRole("button", {
      name: "랜덤 전체 반복 켜기",
      exact: true,
    }).click();
    const randomRepeat = player.getByRole("button", {
      name: "랜덤 전체 반복 끄기",
      exact: true,
    });
    await expect(randomRepeat).toHaveAttribute("aria-pressed", "true");
    await expect(randomRepeat).not.toHaveCSS("box-shadow", "none");
    await endTrack();
    await expect.poll(loadCalls).toEqual([
      "load:mode-video-1",
      "load:mode-video-3",
    ]);
    await endTrack();
    await expect.poll(loadCalls).toEqual([
      "load:mode-video-1",
      "load:mode-video-3",
      "load:mode-video-2",
    ]);
    await endTrack();
    await expect.poll(loadCalls).toEqual([
      "load:mode-video-1",
      "load:mode-video-3",
      "load:mode-video-2",
      "load:mode-video-3",
    ]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the playlist entry on one top-bar row at the 150-percent CSS viewport", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-playlist-topbar-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("선곡목록 배율 확인");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    await page.setViewportSize({ width: 960, height: 720 });
    const topbar = page.locator(".app-topbar");
    const playlistEntry = page.getByRole("region", { name: "음악 플레이어" })
      .getByRole("button", {
        name: "선곡·재생목록 열기",
        exact: true,
      });
    await expect(playlistEntry).toBeVisible();
    const topbarBounds = await topbar.boundingBox();
    const playlistBounds = await playlistEntry.boundingBox();
    if (topbarBounds === null || playlistBounds === null) {
      throw new Error("Expected visible top bar and playlist entry bounds");
    }
    expect(playlistBounds.y).toBeGreaterThanOrEqual(topbarBounds.y);
    expect(playlistBounds.y + playlistBounds.height)
      .toBeLessThanOrEqual(topbarBounds.y + topbarBounds.height);
    await expect(playlistEntry).toHaveCSS("white-space", "nowrap");
    await playlistEntry.click();
    const musicDialog = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await expect(musicDialog).toBeVisible();
    const playAll = musicDialog.getByRole("button", {
      name: "전체 재생",
      exact: true,
    });
    await expect(playAll).toBeVisible();
    const dialogLayout = await musicDialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const playAllButton = element.querySelector<HTMLButtonElement>(
        'button[aria-label="전체 재생"]',
      );
      const playAllBounds = playAllButton?.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        playAllBottom: playAllBounds?.bottom ?? Number.NaN,
        playAllTop: playAllBounds?.top ?? Number.NaN,
        top: bounds.top,
        viewportHeight: window.innerHeight,
        width: bounds.width,
      };
    });
    expect(dialogLayout.width).toBeLessThanOrEqual(422);
    expect(dialogLayout.height).toBeLessThanOrEqual(562);
    expect(dialogLayout.top).toBeGreaterThanOrEqual(0);
    expect(dialogLayout.bottom).toBeLessThanOrEqual(dialogLayout.viewportHeight);
    expect(dialogLayout.playAllTop).toBeGreaterThanOrEqual(0);
    expect(dialogLayout.playAllBottom).toBeLessThanOrEqual(
      dialogLayout.viewportHeight,
    );
    await musicDialog.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();
    await expect(musicDialog).toBeHidden();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("mixes YouTube with linked and managed MP3/MP4 files in the compact player", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-local-media-e2e-"),
  );
  const sourceDirectory = path.join(directory, "source-media");
  await mkdir(sourceDirectory, { recursive: true });
  const mp3Path = path.join(sourceDirectory, "linked-track.mp3");
  const mp4Path = path.join(sourceDirectory, "managed-video.mp4");
  const mp3Bytes = Buffer.from(
    "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMQAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAALAAAFMwA3Nzc3Nzc3NzdLS0tLS0tLS0tfX19fX19fX19zc3Nzc3Nzc3OHh4eHh4eHh4ebm5ubm5ubm5uvr6+vr6+vr6/Dw8PDw8PDw8PX19fX19fX19fr6+vr6+vr6+v///////////8AAAAATGF2YzYyLjI4AAAAAAAAAAAAAAAAJAQvAAAAAAAABTMXaM+kAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVf/7EsQpg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVf/7EMRTg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//sSxH0DwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//sQxKcDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFX/+xLE0IPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EsTVg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sSxNWDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=",
    "base64",
  );
  const mp4Bytes = Buffer.from(
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAYfbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAfQAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAnB0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAfQAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAgAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAH0AAAAAAABAAAAAAHobWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAFABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABk21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAVNzdGJsAAAAt3N0c2QAAAAAAAAAAQAAAKdhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAIABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBQsAK/+EAFWdCwArZCWwEQAAAAwBAAAAFA8SJkgEABWjLg8sgAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAKsAAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAUAAAQAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUAAAKGAAAACgAAAAoAAAAJAAAACQAAACRzdGNvAAAAAAAAAAUAAAZkAAAI/gAACRgAAAkyAAAJTwAAAtl0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAfQAAAAAAAAAAAAAAAEBAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAH0AAAEAAABAAAAAAJRbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAACsRAAAWiJVxAAAAAAALWhkbHIAAAAAAAAAAHNvdW4AAAAAAAAAAAAAAABTb3VuZEhhbmRsZXIAAAAB/G1pbmYAAAAQc21oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABwHN0YmwAAAB+c3RzZAAAAAAAAAABAAAAbm1wNGEAAAAAAAAAAQAAAAAAAAAAAAEAEAAAAACsRAAAAAAANmVzZHMAAAAAA4CAgCUAAgAEgICAF0AVAAAAAAB9AAAABoIFgICABRIIVuUABoCAgAECAAAAFGJ0cnQAAAAAAAB9AAAABoIAAAAgc3R0cwAAAAAAAAACAAAAFgAABAAAAAABAAACIgAAAExzdHNjAAAAAAAAAAUAAAABAAAAAQAAAAEAAAACAAAABQAAAAEAAAADAAAABAAAAAEAAAAFAAAABQAAAAEAAAAGAAAABAAAAAEAAABwc3RzegAAAAAAAAAAAAAAFwAAABUAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAKHN0Y28AAAAAAAAABgAABk8AAAjqAAAJCAAACSIAAAk7AAAJWAAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAAXAAAAAQAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAxAAAACGZyZWUAAAMhbWRhdN4CAExhdmM2Mi4yOC4xMDEAAjBADgAAAnEGBf//bdxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjUgcjMyMjMgMDQ4MGNiMCAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjUgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAADWWIhA/yYoAAw+yddeABGCAHARggBwEYIAcBGCAHARggBwAAAAZBmjgf5YABGCAHARggBwEYIAcBGCAHAAAABkGaVAf5YAEYIAcBGCAHARggBwEYIAcAAAAFQZpgO8sBGCAHARggBwEYIAcBGCAHARggBwAAAAVBmoA3ywEYIAcBGCAHARggBwEYIAc=",
    "base64",
  );
  await writeFile(mp3Path, mp3Bytes);
  await writeFile(mp4Path, mp4Bytes);
  const youtubeSearches: string[] = [];
  const upstream = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && requestUrl.pathname === "/youtube/v3/search") {
      youtubeSearches.push(requestUrl.searchParams.get("q") ?? "");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        items: [{
          id: { videoId: "mixed-youtube-track" },
          snippet: {
            title: "혼합 큐 YouTube",
            channelTitle: "테스트 채널",
            thumbnails: {},
          },
        }],
      }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", () => resolve());
  });
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a loopback YouTube server");
  }
  const youtubeProfile = {
    schemaVersion: 1,
    providerId: "youtube",
    displayName: "YouTube",
    searchApiBaseUrl: `http://127.0.0.1:${address.port}/youtube/v3`,
    iframeApiUrl: "https://www.youtube.com/iframe_api",
    watchBaseUrl: "https://www.youtube.com/watch",
    playerReferer: "https://eum-studio/",
    searchLimit: 6,
    videosPerOption: 3,
    requestTimeoutMs: 10_000,
  } as const;
  const userDataPath = path.join(directory, "electron-user-data");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS: JSON.stringify([mp3Path, mp4Path]),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_YOUTUBE_MUSIC_PROFILE: JSON.stringify(youtubeProfile),
  };
  const electronArguments = [".", `--user-data-dir=${userDataPath}`];
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await installFakeYouTubePlayer(page);
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

    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    const settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await settingsDialog.getByRole("tab", { name: "음악", exact: true }).click();
    await settingsDialog.getByLabel("YouTube Data API 키").fill("mixed-test-key");
    await settingsDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(settingsDialog).toBeHidden();

    let player = page.getByRole("region", { name: "음악 플레이어" });
    await player.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    let library = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await library.getByRole("button", {
      name: "원본 위치 연결",
      exact: true,
    }).click();
    await library.getByRole("tab", {
      name: "내 미디어 탭",
      exact: true,
    }).click();
    const localMedia = library.getByRole("region", {
      name: "내 미디어",
      exact: true,
    });
    await expect(localMedia.getByRole("listitem")).toHaveCount(2);
    await expect(localMedia).toContainText("원본 위치 연결");

    await library.getByRole("button", {
      name: "앱에 가져오기",
      exact: true,
    }).click();
    await expect(localMedia.getByRole("listitem")).toHaveCount(4);
    await expect(localMedia).toContainText("앱에 가져오기");

    await library.getByRole("tab", {
      name: "YouTube 검색 탭",
      exact: true,
    }).click();
    await library.getByLabel("음악 검색어", { exact: true })
      .fill("혼합 재생 테스트");
    await library.getByRole("button", { name: "검색", exact: true }).click();
    await expect.poll(() => youtubeSearches.length).toBe(1);
    const youtubeResult = library.getByRole("region", {
      name: "검색 결과",
      exact: true,
    }).getByRole("listitem").filter({ hasText: "혼합 큐 YouTube" });
    await youtubeResult.getByRole("button", {
      name: "혼합 큐 YouTube 재생목록에 추가",
      exact: true,
    }).click();

    await library.getByRole("tab", {
      name: "내 미디어 탭",
      exact: true,
    }).click();
    const linkedMp3 = localMedia.getByRole("listitem")
      .filter({ hasText: "linked-track.mp3" })
      .filter({ hasText: "원본 위치 연결" });
    const localMediaElement = page.locator(".music-mini-local-media");
    await page.evaluate(() => {
      const testWindow = window as unknown as { __localMediaPlayCount?: number };
      testWindow.__localMediaPlayCount = 0;
      document.addEventListener("play", (event) => {
        if (
          event.target instanceof HTMLMediaElement &&
          event.target.classList.contains("music-mini-local-media")
        ) {
          testWindow.__localMediaPlayCount =
            (testWindow.__localMediaPlayCount ?? 0) + 1;
        }
      }, true);
    });
    await linkedMp3.getByRole("button", {
      name: "linked-track 바로 재생",
      exact: true,
    }).click();
    await expect(player).toContainText("linked-track");
    await expect(localMediaElement).toHaveAttribute(
      "src",
      /^eum-media:\/\/library\//u,
    );
    const localMediaUrl = await localMediaElement.getAttribute("src");
    const streamed = await page.evaluate(async (url) => {
      const response = await fetch(url!, {
        headers: { Range: "bytes=0-127" },
      });
      return {
        acceptRanges: response.headers.get("accept-ranges"),
        bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        contentRange: response.headers.get("content-range"),
        contentType: response.headers.get("content-type"),
        status: response.status,
      };
    }, localMediaUrl);
    expect(streamed).toMatchObject({
      acceptRanges: "bytes",
      contentRange: `bytes 0-127/${mp3Bytes.length}`,
      contentType: "audio/mpeg",
      status: 206,
    });
    expect(streamed.bytes).toEqual(Array.from(mp3Bytes.subarray(0, 128)));
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __localMediaPlayCount?: number })
        .__localMediaPlayCount ?? 0
    )).toBeGreaterThan(0);
    expect(await localMediaElement.evaluate((media) =>
      (media as HTMLMediaElement).error?.code ?? null
    ))
      .toBeNull();
    const managedMp4 = localMedia.getByRole("listitem")
      .filter({ hasText: "managed-video.mp4" })
      .filter({ hasText: "앱에 가져오기" });
    const playCountBeforeMp4 = await page.evaluate(() =>
      (window as unknown as { __localMediaPlayCount?: number })
        .__localMediaPlayCount ?? 0
    );
    await managedMp4.getByRole("button", {
      name: "managed-video 바로 재생",
      exact: true,
    }).click();
    await expect(player).toContainText("managed-video");
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __localMediaPlayCount?: number })
        .__localMediaPlayCount ?? 0
    )).toBeGreaterThan(playCountBeforeMp4);
    await expect(player.getByRole("button", {
      name: "동영상 표시",
      exact: true,
    })).toBeEnabled();
    const managedMediaUrl = await localMediaElement.getAttribute("src");
    expect(managedMediaUrl).toMatch(/^eum-media:\/\/library\//u);
    expect(managedMediaUrl).not.toBe(localMediaUrl);
    const streamedVideo = await page.evaluate(async (url) => {
      const response = await fetch(url!, {
        headers: { Range: "bytes=0-127" },
      });
      return {
        bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        contentRange: response.headers.get("content-range"),
        contentType: response.headers.get("content-type"),
        status: response.status,
      };
    }, managedMediaUrl);
    expect(streamedVideo).toMatchObject({
      contentRange: `bytes 0-127/${mp4Bytes.length}`,
      contentType: "video/mp4",
      status: 206,
    });
    expect(streamedVideo.bytes).toEqual(Array.from(mp4Bytes.subarray(0, 128)));
    expect(await localMediaElement.evaluate((media) =>
      (media as HTMLMediaElement).error?.code ?? null
    ))
      .toBeNull();
    await linkedMp3.getByRole("button", {
      name: "linked-track 재생목록에 추가",
      exact: true,
    }).click();
    await managedMp4.getByRole("button", {
      name: "managed-video 재생목록에 추가",
      exact: true,
    }).click();
    await library.getByRole("tab", {
      name: "재생목록 탭",
      exact: true,
    }).click();
    const mixedQueue = library.getByRole("region", {
      name: "재생목록",
      exact: true,
    });
    await expect(mixedQueue.getByRole("listitem")).toHaveCount(3);
    await mixedQueue.getByRole("button", { name: "전체 재생", exact: true })
      .click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toContain("load:mixed-youtube-track");
    await library.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();
    const playCountBeforeNext = await page.evaluate(() =>
      (window as unknown as { __localMediaPlayCount?: number })
        .__localMediaPlayCount ?? 0
    );
    await player.getByRole("button", { name: "다음 곡", exact: true }).click();
    await expect(player).toContainText("linked-track");
    await localMediaElement.evaluate((media) => {
      (media as HTMLMediaElement).loop = true;
    });
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __localMediaPlayCount?: number })
        .__localMediaPlayCount ?? 0
    )).toBeGreaterThan(playCountBeforeNext);
    await expect.poll(() => localMediaElement.evaluate((media) => ({
      paused: (media as HTMLMediaElement).paused,
      readyState: (media as HTMLMediaElement).readyState,
    }))).toMatchObject({
      paused: false,
      readyState: 4,
    });

    await player.getByRole("button", {
      name: "음악 일시정지",
      exact: true,
    }).click();
    expect(await localMediaElement.evaluate((media) =>
      (media as HTMLMediaElement).paused
    )).toBe(true);
    await expect(player.getByRole("button", {
      name: "음악 재생",
      exact: true,
    })).toBeVisible();
    await localMediaElement.evaluate((media) => {
      media.dispatchEvent(new Event("canplay"));
    });
    expect(await localMediaElement.evaluate((media) =>
      (media as HTMLMediaElement).paused
    )).toBe(true);
    await expect(player.getByRole("button", {
      name: "음악 재생",
      exact: true,
    })).toBeVisible();

    const mediaRoot = path.join(directory, "local-media-library-v1");
    await expect.poll(async () =>
      (await readdir(path.join(mediaRoot, "entries"))).length
    ).toBe(4);
    expect((await readdir(path.join(mediaRoot, "files"))).length).toBe(2);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await installFakeYouTubePlayer(page);
    player = page.getByRole("region", { name: "음악 플레이어" });
    await player.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    library = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await expect(library.getByRole("region", {
      name: "재생목록",
      exact: true,
    }).getByRole("listitem")).toHaveCount(3);
    await library.getByRole("tab", {
      name: "내 미디어 탭",
      exact: true,
    }).click();
    const restoredLocalMedia = library.getByRole("region", {
      name: "내 미디어",
      exact: true,
    });
    await expect(restoredLocalMedia.getByRole("listitem")).toHaveCount(4);
    const removableManagedMedia = restoredLocalMedia.getByRole("listitem")
      .filter({ hasText: "managed-video.mp4" })
      .filter({ hasText: "앱에 가져오기" });
    await removableManagedMedia.getByRole("button", {
      name: "managed-video 등록 삭제",
      exact: true,
    }).click();
    await expect(restoredLocalMedia.getByRole("listitem")).toHaveCount(3);
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("applies the active dark theme to every promoted IA surface", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-promoted-theme-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("새 작업면 테마 확인");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    await page.setViewportSize({ width: 960, height: 720 });
    await page.getByRole("button", { name: "테마 변경", exact: true }).hover();
    await page.getByRole("group", { name: "테마 선택" })
      .getByRole("button", { name: "노르딕", exact: true })
      .click();
    await expect(page.locator(".studio-app-shell"))
      .toHaveAttribute("data-starlight-theme", "nord-theme");

    const brightBySurface: Record<string, string[]> = {};
    const audit = async (label: string, surface: Locator): Promise<void> => {
      await expect(surface).toBeVisible();
      const bright = await surface.evaluate((root) => {
        const elements = [root, ...root.querySelectorAll<HTMLElement>("*")];
        return elements.flatMap((element) => {
          if (
            element instanceof SVGElement ||
            element instanceof HTMLImageElement
          ) {
            return [];
          }
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (
            rect.width < 4 ||
            rect.height < 4 ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          ) {
            return [];
          }
          const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/u
            .exec(style.backgroundColor);
          if (match === null || Number(match[4] ?? 1) < 0.9) return [];
          const red = Number(match[1]);
          const green = Number(match[2]);
          const blue = Number(match[3]);
          const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          if (luminance < 242) return [];
          const className = typeof element.className === "string"
            ? element.className.trim().replace(/\s+/gu, ".")
            : "";
          return [`${element.tagName.toLowerCase()}${className ? `.${className}` : ""}=${style.backgroundColor}`];
        }).slice(0, 80);
      });
      if (bright.length > 0) brightBySurface[label] = bright;
    };

    for (const tab of ["개요", "플롯", "사건", "장면", "인물", "복선", "별빛"] as const) {
      await openStructureTab(page, tab);
      await audit(
        `구조/${tab}`,
        page.getByRole("region", { name: "구조 작업면" }),
      );
    }
    for (const tab of ["집필 기록", "원고 점검", "후보 검토함", "버전"] as const) {
      await openReviewTab(page, tab);
      await audit(
        `검토/${tab}`,
        page.getByRole("region", { name: "검토 작업면" }),
      );
    }

    await openWorkSection(page, "운영");
    const operations = page.getByRole("region", { name: "작품 운영 작업면" });
    await audit("운영", operations);
    await operations.getByRole("button", { name: /^투고/u }).click();
    const publishing = page.getByRole("dialog", { name: "투고" });
    await audit("운영/투고", publishing);
    await publishing.getByRole("button", {
      name: "투고 운영 닫기",
      exact: true,
    }).click();

    await openWorkSection(page, "쓰기");
    await openSchedule(page);
    const schedule = page.getByRole("dialog", { name: "작업 일정" });
    await audit("일정", schedule);
    await schedule.getByRole("button", { name: "일정", exact: true }).click();
    const scheduleItem = page.getByRole("dialog", { name: "일정 추가" });
    await audit("일정/추가", scheduleItem);
    await scheduleItem.getByRole("button", {
      name: "일정 추가 닫기",
      exact: true,
    }).click();
    await schedule.getByRole("button", {
      name: "작업 일정 닫기",
      exact: true,
    }).click();

    await page.getByRole("button", {
      name: "작품 목록으로 돌아가기",
      exact: true,
    }).click();
    await audit("오늘", page.locator(".today-schedule-panel"));

    await page.getByRole("button", {
      name: "전체 일정 열기",
      exact: true,
    }).click();
    const todaySchedule = page.getByRole("dialog", { name: "작업 일정" });
    await expect(todaySchedule).toBeVisible();
    await todaySchedule.getByRole("button", { name: "일정", exact: true }).click();
    const nestedScheduleItem = page.getByRole("dialog", { name: "일정 추가" });
    await expect(nestedScheduleItem).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nestedScheduleItem).toBeHidden();
    await expect(todaySchedule).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(todaySchedule).toBeHidden();

    expect(brightBySurface).toEqual({});
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("selects and restores the exact 14-theme 별빛 서재 palette", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-dark-writing-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("어두운 화면 원고");
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let window = await openStudioWorkspace(electronApp);
    let shell = window.locator(".studio-app-shell");
    let editor = window.locator(".manuscript-editor .cm-scroller");
    let content = window.getByRole("textbox", { name: "원고" });

    await window
      .getByRole("button", { name: "테마 변경", exact: true })
      .hover();
    const themeDialog = window.getByRole("group", { name: "테마 선택" });
    await expect(themeDialog).toBeVisible();
    const themeButtons = themeDialog.locator(".starlight-theme-grid button");
    await expect(themeButtons).toHaveCount(14);
    await expect(themeButtons).toHaveText([
      /라이트/,
      /크림/,
      /세피아/,
      /소프트/,
      /뉴트럴/,
      /베이지/,
      /포커스L/,
      /다크/,
      /미드나잇/,
      /그레이/,
      /소프트D/,
      /웜다크/,
      /노르딕/,
      /포커스D/,
    ]);
    await themeDialog
      .getByRole("button", { name: "노르딕", exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-starlight-theme", "nord-theme");
    await expect(shell).toHaveCSS("background-color", "rgb(46, 52, 64)");
    await expect(editor).toHaveCSS("background-color", "rgb(46, 52, 64)");
    await expect(content).toHaveCSS("color", "rgb(236, 239, 244)");
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("starlight_theme"),
    )).toBe("nord-theme");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await openStudioWorkspace(electronApp);
    shell = window.locator(".studio-app-shell");
    editor = window.locator(".manuscript-editor .cm-scroller");
    content = window.getByRole("textbox", { name: "원고" });
    await expect(shell).toHaveAttribute("data-starlight-theme", "nord-theme");
    await expect(editor).toHaveCSS("background-color", "rgb(46, 52, 64)");
    await expectEditorText(content, "어두운 화면 원고");

    await window
      .getByRole("button", { name: "밝은 화면 켜기", exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-starlight-theme", "light-mode");
    await expect(shell).toHaveCSS("background-color", "rgb(253, 252, 250)");
    await expect(editor).toHaveCSS("background-color", "rgb(253, 252, 250)");
    await expect(content).toHaveCSS("color", "rgb(26, 26, 26)");
    await expect(
      window.getByRole("button", { name: "어두운 화면 켜기", exact: true }),
    ).toBeVisible();

    await window
      .getByRole("button", { name: "어두운 화면 켜기", exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-starlight-theme", "dark-mode");
    await expect(shell).toHaveCSS("background-color", "rgb(28, 28, 30)");
    await expect(editor).toHaveCSS("background-color", "rgb(28, 28, 30)");
    await expect(content).toHaveCSS("color", "rgb(245, 245, 247)");
    await expectEditorText(content, "어두운 화면 원고");

    await window.getByRole("button", { name: "테마 변경", exact: true }).hover();
    await window.getByRole("group", { name: "테마 선택" })
      .getByRole("button", { name: "포커스D", exact: true })
      .click();
    await expect(shell).toHaveAttribute(
      "data-starlight-theme",
      "focus-dark-theme",
    );
    await window.mouse.move(900, 700);
    const structureButton = window
      .getByRole("navigation", { name: "작품 작업면" })
      .getByRole("button", { name: "구조", exact: true });
    await structureButton.focus();
    await openStructureTab(window, "플롯");
    const plotWorkspace = window.getByRole("region", { name: "구조 작업면" });
    await expect(plotWorkspace).toBeVisible();
    expect(await plotWorkspace.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");
    await openStructureTab(window, "장면");
    expect(await plotWorkspace.locator(".work-subsection-panel").evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )).not.toBe("rgb(255, 255, 255)");

    await openStructureTab(window, "개요");
    const structureOverview = window.getByRole("region", {
      name: "작품 구조 개요",
      exact: true,
    });
    const structureCard = structureOverview.locator(".work-structure-panel").first();
    await expect(structureCard).toBeVisible();
    expect(await structureCard.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");
    expect(await structureOverview.locator(".work-structure-body").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    )).toBe(true);

    await openStructureTab(window, "복선");
    const foreshadowContent = window.locator(".foreshadow-line-content");
    await expect(foreshadowContent).toBeVisible();
    expect(await foreshadowContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openStructureTab(window, "별빛");
    const loreContent = window.locator(".lore-manager-content");
    await expect(loreContent).toBeVisible();
    expect(await loreContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openReviewTab(window, "집필 기록");
    const recordsContent = window.locator(".records-content");
    await expect(recordsContent).toBeVisible();
    expect(await recordsContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openReviewTab(window, "후보 검토함");
    const loreCandidateContent = window.locator(".lore-candidate-content");
    await expect(loreCandidateContent).toBeVisible();
    expect(await loreCandidateContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openWorkSection(window, "쓰기");
    await expect(structureOverview).toBeHidden();
    await window.getByRole("button", {
      name: "집중 화면 시작",
      exact: true,
    }).click();
    const manuscriptFocusHost = window.locator(".manuscript-focus-toolbar-host");
    await expect(manuscriptFocusHost).toBeVisible();
    await manuscriptFocusHost.hover();
    const manuscriptFocusToolbar = window.getByRole("region", {
      name: "집중 화면 도구",
      exact: true,
    });
    await expect(manuscriptFocusToolbar).toBeVisible();
    await expect(manuscriptFocusToolbar).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await window.getByLabel("집중 화면 원고 폭", { exact: true }).fill("760");
    await window.getByRole("button", { name: "집중 화면 확대", exact: true })
      .click();
    await window.getByRole("button", { name: "현재 문단", exact: true }).click();
    await window.getByRole("button", { name: "커서 따라가기", exact: true }).click();
    await window.getByLabel("커서 위치", { exact: true }).fill("30");
    await window.getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await openStudioWorkspace(electronApp);
    shell = window.locator(".studio-app-shell");
    await expect(shell).toHaveAttribute(
      "data-starlight-theme",
      "focus-dark-theme",
    );
    await window.getByRole("button", {
      name: "집중 화면 시작",
      exact: true,
    }).click();
    await window.locator(".manuscript-focus-toolbar-host").hover();
    await expect(window.getByLabel("집중 화면 원고 폭", { exact: true }))
      .toHaveValue("760");
    await expect(window.getByRole("group", { name: "집중 화면 확대" }))
      .toContainText("110%");
    await expect(window.getByRole("button", { name: "현재 문단", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(window.getByRole("button", { name: "커서 따라가기", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(window.getByLabel("커서 위치", { exact: true }))
      .toHaveValue("30");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("previews and applies a caller-selected UTF-8 manuscript text file", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-import-e2e-"),
  );
  const importPath = path.join(directory, "가져올 원고.txt");
  const importedText = "첫 줄\r\n둘째 줄\r셋째 줄";
  const normalizedText = "첫 줄\n둘째 줄\n셋째 줄";
  await writeFile(importPath, importedText, "utf8");
  const documentProfile = createDocumentSwitchProfile("기존 원고");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_TEXT_IMPORT_PATH: importPath,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, "기존 원고");
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await window
      .getByRole("button", { name: "TXT 가져오기", exact: true })
      .click();

    const dialog = window.getByRole("dialog", { name: "원고 TXT 가져오기" });
    await expect(dialog).toContainText("가져올 원고.txt");
    await expect(dialog.getByRole("region", { name: "가져올 원고 미리보기" }))
      .toContainText("첫 줄\n둘째 줄\n셋째 줄");
    await expect(dialog).not.toContainText(directory);
    await expectEditorText(manuscript, "기존 원고");

    await dialog
      .getByRole("button", { name: "현재 원고 교체", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expectEditorText(manuscript, normalizedText);
    await manuscript.press("Control+Z");
    await expectEditorText(manuscript, "기존 원고");
    await manuscript.press("Control+Y");
    await expectEditorText(manuscript, normalizedText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("hides the editor sidebar in manual compact state across viewport changes", async () => {
  const documentProfile = createDocumentSwitchProfile();
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-sidebar-compact-e2e-"),
  );
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    await window.setViewportSize({
      width: randomInt(480, 620),
      height: randomInt(680, 820),
    });
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const reviewRail = window.getByRole("complementary", {
      name: "검토 레일",
    });

    await expect(documentRail).toBeVisible();
    await expect(reviewRail).toBeHidden();
    await window
      .getByRole("button", { name: "사이드바 접기" })
      .click();
    await expect(window.locator(".studio-app-shell")).toHaveClass(/is-compact/u);
    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeHidden();

    await window
      .getByRole("button", { name: "검토 레일 열기" })
      .click();
    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeVisible();
    await window
      .getByRole("button", { name: "검토 레일 닫기" })
      .click();

    await window.setViewportSize({
      width: randomInt(1120, 1320),
      height: randomInt(680, 820),
    });
    await expect(window.locator(".studio-app-shell")).toHaveClass(/is-compact/u);
    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeHidden();
    const expandSidebar = window.getByRole("button", {
      name: "사이드바 펼치기",
    });
    await expect(expandSidebar).toBeVisible();
    await expandSidebar.click();
    await expect(window.locator(".studio-app-shell")).not.toHaveClass(
      /is-compact/u,
    );
    await expect(documentRail).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("searches labels and manuscripts only inside the active Work", async () => {
  const firstWorkId = randomUUID();
  const secondWorkId = randomUUID();
  const query = randomUUID().slice(0, 8);
  const firstInitialDocument = {
    workId: firstWorkId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const firstMatchingDocument = {
    workId: firstWorkId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: `${randomUUID()}${query}${randomUUID()}`,
  };
  const foreignMatchingDocument = {
    workId: secondWorkId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: `${query}${randomUUID()}`,
    initialText: `${query}${query}`,
  };
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: firstInitialDocument.documentId,
    documents: [
      firstInitialDocument,
      firstMatchingDocument,
      foreignMatchingDocument,
    ],
  };
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const searchInput = window.getByRole("searchbox", {
      name: "원고 검색",
    });
    await searchInput.fill(query);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 1개 일치",
    );
    let searchResults = window.getByRole("region", {
      name: "원고 검색 결과",
    });
    await expect(
      searchResults.getByRole("button", {
        name: firstMatchingDocument.label,
      }),
    ).toBeVisible();
    await expect(
      searchResults.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toHaveCount(0);

    await searchResults
      .getByRole("button", {
        name: firstMatchingDocument.label,
      })
      .click();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      firstMatchingDocument.label,
    );
    expect(await readActiveDocumentId(window)).toBe(
      firstMatchingDocument.documentId,
    );

    await openStudioHome(window);
    const foreignWorkCard = window.locator(".library-work-card").filter({
      hasText: foreignMatchingDocument.label,
    });
    await foreignWorkCard
      .getByRole("combobox")
      .selectOption({ label: foreignMatchingDocument.label });
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      foreignMatchingDocument.label,
    );
    expect(await readActiveDocumentId(window)).toBe(
      foreignMatchingDocument.documentId,
    );
    await expect(searchInput).toHaveValue("");
    await expect(
      window.getByTestId("search-result-summary"),
    ).toHaveCount(0);
    await searchInput.fill(query);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 3개 일치",
    );
    searchResults = window.getByRole("region", {
      name: "원고 검색 결과",
    });
    await expect(
      searchResults.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toBeVisible();
    await expect(
      searchResults.getByRole("button", {
        name: firstMatchingDocument.label,
      }),
    ).toHaveCount(0);

    const manuscript = window.getByRole("textbox", { name: "원고" });
    const editedQuery = randomUUID();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(editedQuery);
    await expect(
      window.getByTestId("search-result-summary"),
    ).toHaveCount(0);
    await searchInput.fill(editedQuery);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 1개 일치",
    );
    searchResults = window.getByRole("region", {
      name: "원고 검색 결과",
    });
    await expect(
      searchResults.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

