import {
  randomUUID,
  mkdtemp,
  readFile,
  tmpdir,
  path,
  DatabaseSync,
  expect,
  test,
  electron,
  entityId,
  openStudioWorkspace,
  installFakePomodoroAlertAudio,
  continueFromMain,
  openStudioHome,
  openReviewRail,
  openWorkSection,
  openStructureTab,
  openReviewTab,
  openWritingRecords,
  activateDocumentFromTree,
  createNamedEpisode,
  expectEditorText,
  expectDialogFitsDesktop,
  removeVerifiedTemporaryDirectory,
  type Page,
} from "./support/desktop-shell-suite";
test("edits and restores exact manuscript formatting in the local workspace", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-formatting-"),
  );
  const manuscriptText = "가나다라마바사";
  const formattedText = manuscriptText.slice(1, 4);
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

  const readFormattedTextStyle = (page: Awaited<ReturnType<typeof electronApp.firstWindow>>) =>
    page.locator(".manuscript-editor .cm-line span").evaluateAll(
      (elements, expectedText) => {
        const element = elements.find(
          (candidate) => candidate.textContent === expectedText,
        );
        if (!(element instanceof HTMLElement)) {
          throw new Error("The exact formatted manuscript range is missing");
        }
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontStyle: style.fontStyle,
          fontWeight: style.fontWeight,
          textDecorationLine: style.textDecorationLine,
        };
      },
      formattedText,
    );

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await dialog.getByLabel("작품 제목").fill(randomUUID());
    await dialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await dialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Home");
    await manuscript.press("ArrowRight");
    for (let index = 0; index < formattedText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    await expect(page.getByLabel("본문 글꼴", { exact: true }).locator("option")).toHaveText([
      "마루부리",
      "리디바탕",
      "나눔명조",
      "프리텐다드",
      "나눔고딕",
    ]);
    await page.getByRole("button", { name: "굵게", exact: true }).click();
    await page.getByRole("button", { name: "기울임", exact: true }).click();
    await page.getByRole("button", { name: "밑줄", exact: true }).click();
    await page.getByLabel("본문 글꼴", { exact: true }).selectOption("ridibatang");
    await page.getByLabel("글자 크기", { exact: true }).selectOption("24");
    await expect(
      page.getByRole("button", { name: "글자색 기본값", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "강조색 없음", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "글자색", exact: true })
      .click();
    await page.getByLabel("글자색 선택값", { exact: true }).evaluate(
      (element, value) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("The manuscript text color control is missing");
        }
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        if (setter === undefined) {
          throw new Error("The native color value setter is missing");
        }
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      },
      "#7d2f2f",
    );
    await page
      .getByRole("button", { name: "강조색", exact: true })
      .click();
    await page.getByLabel("강조색 선택값", { exact: true }).evaluate(
      (element, value) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("The manuscript highlight color control is missing");
        }
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        if (setter === undefined) {
          throw new Error("The native highlight value setter is missing");
        }
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      },
      "#fff0a8",
    );
    await page
      .getByRole("button", { name: "강조색 적용", exact: true })
      .click();
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const additionalFormattingDialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await expect(additionalFormattingDialog).toBeVisible();
    const additionalFormattingGeometry = await additionalFormattingDialog
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          centerX: rect.left + rect.width / 2,
          clientWidth: element.clientWidth,
          left: rect.left,
          right: rect.right,
          scrollWidth: element.scrollWidth,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        };
      });
    expect(
      Math.abs(
        additionalFormattingGeometry.centerX -
          additionalFormattingGeometry.viewportWidth / 2,
      ),
    ).toBeLessThanOrEqual(2);
    expect(additionalFormattingGeometry.left).toBeGreaterThanOrEqual(0);
    expect(additionalFormattingGeometry.right).toBeLessThanOrEqual(
      additionalFormattingGeometry.viewportWidth,
    );
    expect(additionalFormattingGeometry.bottom).toBeLessThanOrEqual(
      additionalFormattingGeometry.viewportHeight,
    );
    expect(additionalFormattingGeometry.scrollWidth).toBeLessThanOrEqual(
      additionalFormattingGeometry.clientWidth + 1,
    );
    await page.getByRole("button", { name: "가운데 정렬", exact: true }).click();
    await page.getByLabel("행간", { exact: true }).selectOption("2.2");
    await page.getByLabel("문단 간격", { exact: true }).selectOption("8");
    await page.getByLabel("자간", { exact: true }).selectOption("0.02");
    const manuscriptWidth = page.getByLabel("본문 폭", { exact: true });
    const defaultMeasuredWidth = await page
      .locator(".manuscript-editor .cm-content")
      .evaluate((element) => element.getBoundingClientRect().width);
    await manuscriptWidth.focus();
    await manuscriptWidth.press("Home");
    await expect(page.locator(".manuscript-width-control output")).toHaveText(
      "480px",
    );
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect
      .poll(() =>
        page
          .locator(".manuscript-editor .cm-content")
          .getAttribute("style"),
      )
      .toContain("480px");

    const narrowedMeasuredWidth = await page
      .locator(".manuscript-editor .cm-content")
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(narrowedMeasuredWidth).toBeLessThan(defaultMeasuredWidth - 150);
    expect(narrowedMeasuredWidth).toBeCloseTo(480, 0);

    await expect
      .poll(() => readFormattedTextStyle(page))
      .toMatchObject({
        backgroundColor: "rgb(255, 240, 168)",
        color: "rgb(125, 47, 47)",
        fontSize: "24px",
        fontStyle: "italic",
        fontWeight: "700",
        textDecorationLine: "underline",
      });
    expect((await readFormattedTextStyle(page)).fontFamily).toContain("RIDIBatang");
    await expect(page.locator(".manuscript-editor .cm-line")).toHaveCSS(
      "text-align",
      "center",
    );
    await expect(page.locator(".manuscript-editor .cm-line")).toHaveCSS(
      "padding-top",
      "8px",
    );
    await expect(page.locator(".manuscript-editor .cm-content")).toHaveCSS(
      "line-height",
      "52.8px",
    );
    await expect(page.locator(".manuscript-editor .cm-content")).toHaveCSS(
      "letter-spacing",
      "0.48px",
    );

    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(page.locator(".manuscript-width-control output")).toHaveText(
      "720px",
    );
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(page.locator(".manuscript-width-control output")).toHaveText(
      "480px",
    );
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await continueFromMain(page);
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveText(
      manuscriptText,
    );
    await expect
      .poll(() => readFormattedTextStyle(page))
      .toMatchObject({
        backgroundColor: "rgb(255, 240, 168)",
        color: "rgb(125, 47, 47)",
        fontSize: "24px",
        fontStyle: "italic",
        fontWeight: "700",
        textDecorationLine: "underline",
      });
    expect((await readFormattedTextStyle(page)).fontFamily).toContain("RIDIBatang");
    await expect
      .poll(() =>
        page
          .locator(".manuscript-editor .cm-content")
          .getAttribute("style"),
      )
      .toContain("480px");
    await expect(page.locator(".manuscript-editor .cm-line")).toHaveCSS(
      "text-align",
      "center",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("formats manuscript blank lines from the additional formatting tools", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-blank-line-formatting-"),
  );
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
  const source = "첫 줄\n둘째 줄\n\n\n셋째 줄";
  const oneBlankLine = "첫 줄\n\n둘째 줄\n\n셋째 줄";
  const twoBlankLines = "첫 줄\n\n\n둘째 줄\n\n\n셋째 줄";
  const noBlankLines = "첫 줄\n둘째 줄\n셋째 줄";
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
    await createWorkDialog.getByLabel("작품 제목").fill(randomUUID());
    await createWorkDialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially("첫 줄");
    await manuscript.press("Enter");
    await manuscript.pressSequentially("둘째 줄");
    await manuscript.press("Enter");
    await manuscript.press("Enter");
    await manuscript.press("Enter");
    await manuscript.pressSequentially("셋째 줄");
    await expectEditorText(manuscript, source);

    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const formattingDialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await formattingDialog
      .getByRole("button", { name: "1줄 띄우기", exact: true })
      .click();
    await expectEditorText(manuscript, oneBlankLine);
    await manuscript.press("Control+z");
    await expectEditorText(manuscript, source);
    await manuscript.press("Control+y");
    await expectEditorText(manuscript, oneBlankLine);

    await formattingDialog
      .getByRole("button", { name: "2줄 띄우기", exact: true })
      .click();
    await expectEditorText(manuscript, twoBlankLines);
    await manuscript.press("Control+z");
    await expectEditorText(manuscript, oneBlankLine);
    await formattingDialog
      .getByRole("button", { name: "2줄 띄우기", exact: true })
      .click();
    await expectEditorText(manuscript, twoBlankLines);

    await formattingDialog
      .getByRole("button", { name: "빈줄 제거", exact: true })
      .click();
    await expectEditorText(manuscript, noBlankLines);
    await manuscript.press("Control+z");
    await expectEditorText(manuscript, twoBlankLines);
    await manuscript.press("Control+y");
    await expectEditorText(manuscript, noBlankLines);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expectEditorText(
      page.getByRole("textbox", { name: "원고" }),
      noBlankLines,
    );
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shares manuscript layout across every episode and restores it after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-layout-e2e-"),
  );
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
  const workTitle = randomUUID();
  const firstTitle = `1화-${randomUUID().slice(0, 8)}`;
  const secondTitle = `2화-${randomUUID().slice(0, 8)}`;
  const expectedSettings = {
    fontFamilyId: "pretendard",
    fontSizePx: 20,
    contentWidthPx: 480,
    lineHeight: 1.75,
    paragraphSpacingPx: 8,
    letterSpacingEm: 0.02,
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const expectSharedLayout = async (page: Page) => {
    await expect(page.getByLabel("본문 글꼴", { exact: true })).toHaveValue(
      expectedSettings.fontFamilyId,
    );
    await expect(page.getByLabel("글자 크기", { exact: true })).toHaveValue(
      String(expectedSettings.fontSizePx),
    );
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveCSS(
      "font-size",
      `${expectedSettings.fontSizePx}px`,
    );
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveCSS(
      "font-family",
      /Pretendard/u,
    );
    const dialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await expect(dialog.getByLabel("행간", { exact: true })).toHaveValue(
      String(expectedSettings.lineHeight),
    );
    await expect(dialog.getByLabel("문단 간격", { exact: true })).toHaveValue(
      String(expectedSettings.paragraphSpacingPx),
    );
    await expect(dialog.getByLabel("자간", { exact: true })).toHaveValue(
      String(expectedSettings.letterSpacingEm),
    );
    await expect(dialog.locator(".manuscript-width-control output")).toHaveText(
      `${expectedSettings.contentWidthPx}px`,
    );
  };

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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await page.getByLabel("본문 글꼴", { exact: true })
      .selectOption(expectedSettings.fontFamilyId);
    await page.getByLabel("글자 크기", { exact: true })
      .selectOption(String(expectedSettings.fontSizePx));

    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const firstLayoutDialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await firstLayoutDialog.getByLabel("행간", { exact: true })
      .selectOption(String(expectedSettings.lineHeight));
    await firstLayoutDialog.getByLabel("문단 간격", { exact: true })
      .selectOption(String(expectedSettings.paragraphSpacingPx));
    await firstLayoutDialog.getByLabel("자간", { exact: true })
      .selectOption(String(expectedSettings.letterSpacingEm));
    const width = firstLayoutDialog.getByLabel("본문 폭", { exact: true });
    await width.focus();
    await width.press("Home");
    await expectSharedLayout(page);
    await firstLayoutDialog
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();

    await expect.poll(() => {
      try {
        const database = new DatabaseSync(
          path.join(directory, "workspace.sqlite3"),
          { readOnly: true },
        );
        try {
          const row = database.prepare(`
            SELECT settings_json AS settingsJson
            FROM work_manuscript_layout_settings
          `).get() as { readonly settingsJson?: unknown } | undefined;
          return typeof row?.settingsJson === "string"
            ? JSON.parse(row.settingsJson)
            : null;
        } finally {
          database.close();
        }
      } catch {
        return null;
      }
    }).toEqual(expectedSettings);

    await createNamedEpisode(page, secondTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(secondTitle);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expectSharedLayout(page);
    await page
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expectSharedLayout(page);
    await page
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();
    await activateDocumentFromTree(page, firstTitle);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expectSharedLayout(page);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("preflights an exact selection and exports the approved text", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-preflight-"),
  );
  const exportPath = path.join(directory, `${randomUUID()}.txt`);
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
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const source = "앞줄\n선택\t원고  \n뒷줄";
  const approvedSelection = "선택  원고";
  const approvedManuscript = `앞줄\n${approvedSelection}\n뒷줄`;
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
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

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(source);
    await manuscript.press("Control+Home");
    await manuscript.press("ArrowDown");
    await manuscript.press("End");
    await manuscript.press("Shift+Home");
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "원고 점검" }).click();

    let preflightDialog = page.getByRole("dialog", { name: "원고 점검" });
    await expectDialogFitsDesktop(preflightDialog);
    await expect(preflightDialog.getByLabel("선택 범위")).toBeChecked();
    await expect(
      preflightDialog.locator(".preflight-findings").getByText("탭 문자"),
    ).toBeVisible();
    await preflightDialog.getByLabel("탭 문자").selectOption("spaces");
    await preflightDialog.getByLabel("탭 공백 수").fill("2");
    await preflightDialog
      .getByRole("button", { name: "이 작품에 설정 저장" })
      .click();
    await expect(preflightDialog).toContainText(
      "이 작품의 점검 설정을 저장했습니다.",
    );
    await preflightDialog
      .getByRole("button", { name: "미리보기 만들기" })
      .click();
    await expect(
      preflightDialog.getByRole("textbox", { name: "점검 결과" }),
    ).toHaveValue(approvedSelection);
    await expectEditorText(manuscript, source);

    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: selectedPath,
          }),
        });
      },
      exportPath,
    );
    await preflightDialog
      .getByRole("button", { name: "TXT 내보내기" })
      .click();
    await expect(preflightDialog).toContainText("TXT 내보내기를 완료했습니다.");
    expect(await readFile(exportPath, "utf8")).toBe(approvedSelection);

    await preflightDialog
      .getByRole("button", { name: "이 변경 적용" })
      .click();
    await expect(preflightDialog).toBeHidden();
    await expectEditorText(manuscript, approvedManuscript);
    await page.getByRole("button", { name: "실행 취소" }).click();
    await expectEditorText(manuscript, source);
    await page.getByRole("button", { name: "다시 실행" }).click();
    await expectEditorText(manuscript, approvedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    const restartedManuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(restartedManuscript, approvedManuscript);
    await restartedManuscript.click();
    await restartedManuscript.press("Control+End");
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "원고 점검" }).click();
    preflightDialog = page.getByRole("dialog", { name: "원고 점검" });
    await expect(preflightDialog.getByLabel("현재 회차 전체")).toBeChecked();
    await expect(preflightDialog.getByLabel("탭 문자")).toHaveValue("spaces");
    await expect(preflightDialog.getByLabel("탭 공백 수")).toHaveValue("2");
    await preflightDialog
      .getByLabel("모든 문단 사이에 빈 줄 한 줄 추가")
      .check();
    await preflightDialog
      .getByRole("button", { name: "미리보기 만들기" })
      .click();
    const manuscriptWithBlankLines = `앞줄\n\n${approvedSelection}\n\n뒷줄`;
    await expect(
      preflightDialog.getByRole("textbox", { name: "점검 결과" }),
    ).toHaveValue(manuscriptWithBlankLines);
    await preflightDialog
      .getByRole("button", { name: "이 변경 적용" })
      .click();
    await expect
      .poll(async () =>
        (
          await restartedManuscript.locator(".cm-line").allTextContents()
        ).join("\n"),
      )
      .toBe(manuscriptWithBlankLines);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("downloads selected episodes as one TXT in the actual episode order", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-bulk-export-"),
  );
  const exportPath = path.join(directory, `${randomUUID()}.txt`);
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
  const workTitle = "순서 검증 작품";
  const episodes = [
    { title: "2화", text: "둘째 원고" },
    { title: "10화", text: "열째 원고" },
    { title: "1화", text: "첫째 원고" },
  ] as const;
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(episodes[0].title);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(episodes[0].text);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    for (const episode of episodes.slice(1)) {
      await createNamedEpisode(page, episode.title);
      await manuscript.pressSequentially(episode.text);
      await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    }

    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "전체 다운로드", exact: true })
      .click();
    const exportDialog = page.getByRole("dialog", {
      name: "전체 다운로드",
    });
    await expectDialogFitsDesktop(exportDialog);
    await expect(
      exportDialog.locator(".manuscript-bulk-export-selection label span"),
    ).toHaveText(episodes.map((episode) => episode.title));
    await expect(exportDialog.getByLabel("2화", { exact: true })).toBeChecked();
    await expect(exportDialog.getByLabel("10화", { exact: true })).toBeChecked();
    await expect(exportDialog.getByLabel("1화", { exact: true })).toBeChecked();
    await exportDialog.getByLabel("10화", { exact: true }).uncheck();

    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: selectedPath,
          }),
        });
      },
      exportPath,
    );
    await exportDialog
      .getByRole("button", { name: "선택한 회차 다운로드", exact: true })
      .click();
    await expect(exportDialog).toContainText(
      "2개 회차를 하나의 TXT로 다운로드했습니다.",
    );
    expect(await readFile(exportPath, "utf8")).toBe(
      `${episodes[0].text}\n\n${episodes[2].text}`,
    );
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates the first local Work and reopens its saved manuscript after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-first-work-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const manuscriptText = randomUUID();
  const revisedSuffix = `-${randomUUID()}`;
  const snapshotLabel = `초고 기준-${randomUUID().slice(0, 8)}`;
  const eventTitle = randomUUID();
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
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
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(
      page.getByRole("heading", { name: "홈", exact: true }),
    ).toBeVisible();
    const mainPageDimensions = await page.locator(".main-page-body").evaluate(
      (element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }),
    );
    expect(mainPageDimensions.scrollHeight).toBeLessThanOrEqual(
      mainPageDimensions.clientHeight,
    );
    const navigation = page.getByRole("navigation", { name: "주요 화면" });
    await expect(navigation.getByRole("button")).toHaveCount(2);
    for (const label of ["빠른 도구 열기", "메인"]) {
      await expect(
        navigation.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      navigation.getByRole("button", { name: "내 작품", exact: true }),
    ).toHaveCount(0);
    for (const removedLabel of [
      "보관함",
      "오늘",
      "일주일",
      "모든 작업",
      "프로젝트",
      "작업 일지",
      "기록실",
      "언젠가",
      "우선순위 뷰",
      "반복 작업",
    ]) {
      await expect(
        navigation.getByRole("button", {
          name: removedLabel,
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await expect(createWorkDialog).toBeVisible();
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toBeVisible();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openReviewTab(page, "버전");
    const snapshotRegion = page.getByRole("region", { name: "명명된 기준점 슬롯" });
    await snapshotRegion.getByLabel("기준점 슬롯 이름").fill(snapshotLabel);
    await snapshotRegion
      .getByRole("button", { name: "이 슬롯에 기준점 만들기", exact: true })
      .click();
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();
    const snapshotRevisionProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null || catalog.activeDocumentId === null) {
        throw new Error("Expected active Work and Document after snapshot");
      }
      return window.eumStudio.version.listDocumentRevisions({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        documentId: catalog.activeDocumentId,
      });
    });
    expect(
      snapshotRevisionProjection.revisions.find((revision) => revision.isCurrent)
        ?.length,
    ).toBe(manuscriptText.length);
    await openWorkSection(page, "쓰기");
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(revisedSuffix);
    await expectEditorText(manuscript, `${manuscriptText}${revisedSuffix}`);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openReviewTab(page, "버전");
    const versionRegion = page.getByRole("region", { name: "문서 버전" });
    await versionRegion
      .getByRole("button", { name: "새로고침", exact: true })
      .click();
    const revisedRevisionProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null || catalog.activeDocumentId === null) {
        throw new Error("Expected active Work and Document before restore");
      }
      return window.eumStudio.version.listDocumentRevisions({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        documentId: catalog.activeDocumentId,
      });
    });
    expect(
      revisedRevisionProjection.revisions.find((revision) => revision.isCurrent)
        ?.length,
    ).toBe(manuscriptText.length + revisedSuffix.length);
    expect(
      revisedRevisionProjection.revisions.some(
        (revision) =>
          !revision.isCurrent && revision.length === manuscriptText.length,
      ),
    ).toBe(true);
    await versionRegion
      .locator(".version-history-entry")
      .filter({ hasText: `${manuscriptText.length}자` })
      .getByRole("button", { name: /버전으로 복원/ })
      .first()
      .click();
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, manuscriptText);
    await openReviewTab(page, "버전");
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await manuscript.press("Control+A");
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", {
      name: "사건으로 등록",
    });
    await expect(eventDialog).toContainText(manuscriptText);
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog
      .getByRole("button", { name: "등록", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "사건 레일" })
        .getByRole("button", { name: new RegExp(eventTitle) }),
    ).toBeVisible();
    await manuscript.press("ArrowRight");
    await page
      .getByRole("button", { name: "장면 추가", exact: true })
      .click();
    await openStructureTab(page, "장면");
    await expect(
      page
        .getByRole("region", { name: "현재 회차 장면" })
        .getByRole("button", { name: /장면 2/ }),
    ).toBeVisible();
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await expect(page.getByTestId("writing-session-timer")).toBeVisible();
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const focusDialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await focusDialog.getByLabel("작업 시간(분)").fill("37");
    await focusDialog.getByLabel("휴식 시간(분)").fill("5");
    await focusDialog.getByLabel("작업 주기").fill("4");
    await focusDialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(page.getByTestId("pomodoro-timer")).toContainText("작업 1/4");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    const restartedPage = await electronApp.firstWindow();
    await restartedPage.setViewportSize({ width: 1280, height: 800 });
    await expect(
      restartedPage.getByText(workTitle, { exact: true }).first(),
    ).toBeVisible();
    await continueFromMain(restartedPage);
    await restartedPage
      .getByRole("button", { name: "검토 레일 열기", exact: true })
      .click();
    await expectEditorText(
      restartedPage.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
    await expect(
      restartedPage.getByTestId("manuscript-title"),
    ).toHaveText(documentTitle);
    await expect(restartedPage.getByTestId("writing-session-timer")).toBeVisible();
    await expect(restartedPage.getByTestId("pomodoro-timer")).toContainText(
      "작업 1/4",
    );
    await expect(
      restartedPage
        .getByTestId("pomodoro-timer")
        .getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await openReviewTab(restartedPage, "버전");
    await expect(
      restartedPage
        .getByRole("region", { name: "명명된 기준점 슬롯" })
        .getByText(snapshotLabel, { exact: true }),
    ).toBeVisible();
    await openWorkSection(restartedPage, "쓰기");
    await openReviewRail(restartedPage);
    await restartedPage.getByRole("tab", { name: "현재", exact: true }).click();
    await restartedPage
      .getByRole("region", { name: "사건 레일" })
      .getByRole("button", { name: new RegExp(eventTitle) })
      .click();
    await expect
      .poll(() =>
        restartedPage.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({ anchor: 0, head: manuscriptText.length });
    await openStructureTab(restartedPage, "장면");
    await restartedPage
      .getByRole("region", { name: "현재 회차 장면" })
      .getByRole("button", { name: /장면 2/ })
      .click();
    await expect
      .poll(() =>
        restartedPage.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({
        anchor: manuscriptText.length,
        head: manuscriptText.length,
      });
    await restartedPage
      .getByTestId("pomodoro-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await expect(
      restartedPage.getByRole("button", { name: "집중 시작", exact: true }),
    ).toBeVisible();
    await expect(
      restartedPage.getByRole("button", { name: "기록 시작", exact: true }),
    ).toBeVisible();
    await openStudioHome(restartedPage);
    await continueFromMain(restartedPage);
    const recordsDialog = await openWritingRecords(restartedPage);
    await expect(recordsDialog).toContainText(workTitle);
    await expect(recordsDialog.getByTestId("records-total-sessions")).toHaveText(
      /세션\s*[1-9]\d*회/u,
    );
    await recordsDialog
      .getByRole("button", {
        name: `${documentTitle} 기록 회차 열기`,
        exact: true,
      })
      .click();
    await expectEditorText(
      restartedPage.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("automatically resumes a restored paused work timer on manuscript input", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-pomodoro-auto-resume-e2e-"),
  );
  const workTitle = `자동재개-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
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
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const workIdValue = await page
      .getByTestId("current-work")
      .getAttribute("title");
    if (workIdValue === null) throw new Error("Expected Work identity");
    const workId = entityId<"Work">(workIdValue);

    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await dialog.getByLabel("작업 시간(분)").fill("1");
    await dialog.getByLabel("휴식 시간(분)").fill("1");
    await dialog.getByLabel("작업 주기").fill("1");
    await dialog.getByRole("button", { name: "시작", exact: true }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    const timer = page.getByTestId("pomodoro-timer");
    await expect(timer.getByRole("button", { name: "재개", exact: true }))
      .toBeVisible();
    await expect.poll(() => page.evaluate(
      (targetWorkId) => window.eumStudio.activity.getPomodoro({
        schemaVersion: 1,
        workId: targetWorkId,
      }),
      workId,
    )).toMatchObject({
      status: "paused",
      activePhase: { phase: "work", state: "paused" },
    });

    await page.getByRole("textbox", { name: "원고" })
      .pressSequentially("첫 입력 자동 재개");
    await expect.poll(() => page.evaluate(
      (targetWorkId) => window.eumStudio.activity.getPomodoro({
        schemaVersion: 1,
        workId: targetWorkId,
      }),
      workId,
    )).toMatchObject({
      status: "running",
      activePhase: { phase: "work", state: "running" },
    });
    await expect(timer.getByRole("button", { name: "일시정지", exact: true }))
      .toBeVisible();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("runs and restores one Work Pomodoro lifecycle without music", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-pomodoro-e2e-"),
  );
  const workTitle = `집중-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
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
    await installFakePomodoroAlertAudio(page);
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

    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await expect(dialog.getByText(/음악|소리/u)).toHaveCount(0);
    await dialog.getByLabel("작업 시간(분)").fill("1");
    await dialog.getByLabel("휴식 시간(분)").fill("1");
    await dialog.getByLabel("작업 주기").fill("2");
    await expect(dialog.getByLabel("단계 자동 전환")).not.toBeChecked();
    await dialog.getByRole("button", { name: "시작", exact: true }).click();

    const runningWorkIdValue = await page
      .getByTestId("current-work")
      .getAttribute("title");
    if (runningWorkIdValue === null) {
      throw new Error("Expected running Work identity");
    }
    const runningWorkId = entityId<"Work">(runningWorkIdValue);
    const readPomodoro = () =>
      page.evaluate(
        (workId) => window.eumStudio.activity.getPomodoro({
          schemaVersion: 1,
          workId,
        }),
        runningWorkId,
      );
    let timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("작업 1/2");
    let sessionFeedback = page.getByTestId("session-feedback");
    await expect(sessionFeedback).toBeVisible();
    await expect(sessionFeedback).toHaveAttribute("data-pomodoro-phase", "work");
    await expect(timer).toContainText("완료 0회");
    await expect(
      sessionFeedback.locator(".session-feedback-phase > span"),
    ).toHaveCSS("color", "rgb(217, 119, 6)");
    await sessionFeedback
      .getByRole("button", { name: "세션 피드백 펼치기", exact: true })
      .click();
    await expect(sessionFeedback).toContainText("오늘 세션");
    await expect(sessionFeedback).toContainText("세션 평균");
    await sessionFeedback.getByLabel("세션 메모").fill("작업 중 메모");
    await sessionFeedback
      .getByRole("button", { name: "메모 저장", exact: true })
      .click();
    await expect.poll(readPomodoro).toMatchObject({
      activePhase: { note: "작업 중 메모" },
    });
    await timer.getByRole("button", { name: "일시정지", exact: true }).click();
    await expect.poll(readPomodoro).toMatchObject({
      status: "paused",
      activePhase: { phase: "work", cycleNumber: 1 },
    });
    await expect(
      timer.getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await expect.poll(readPomodoro).toMatchObject({
      status: "running",
      activePhase: { phase: "work", cycleNumber: 1 },
    });
    await timer.getByRole("button", { name: "종료", exact: true }).click();
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await dialog.getByLabel("작업 시간(분)").fill(".1");
    await dialog.getByLabel("휴식 시간(분)").fill(".1");
    await dialog.getByLabel("작업 주기").fill("2");
    await expect(dialog.getByLabel("단계 자동 전환")).not.toBeChecked();
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("작업 1/2");
    await page
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    let focusPomodoroStatus = page.getByTestId("focus-pomodoro-status");
    await expect(focusPomodoroStatus).toBeVisible();
    await expect(focusPomodoroStatus).toHaveAttribute(
      "data-pomodoro-phase",
      "work",
    );
    await expect(focusPomodoroStatus).toContainText("작업 모드");
    await expect(focusPomodoroStatus).toContainText("작업 1/2 · 완료 0회");
    await expect(focusPomodoroStatus).toHaveCSS(
      "color",
      "rgb(217, 119, 6)",
    );
    await expect(focusPomodoroStatus).toHaveAttribute(
      "data-pomodoro-phase",
      "break",
      { timeout: 10_000 },
    );
    await expect(focusPomodoroStatus).toContainText("휴식 모드");
    await expect(focusPomodoroStatus).toContainText("휴식 1/2 · 완료 1회");
    await expect(focusPomodoroStatus).toHaveCSS(
      "color",
      "rgb(47, 158, 97)",
    );
    await page.keyboard.press("Escape");
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("휴식 1/2");
    sessionFeedback = page.getByTestId("session-feedback");
    await expect(sessionFeedback).toHaveAttribute("data-pomodoro-phase", "break");
    await expect(timer).toContainText("완료 1회");
    await expect(
      sessionFeedback.locator(".session-feedback-phase > span"),
    ).toHaveCSS("color", "rgb(47, 158, 97)");
    await expect(
      sessionFeedback.locator(".session-feedback-progress > span"),
    ).toHaveCSS("background-color", "rgb(47, 158, 97)");
    let phaseAlert = page.getByTestId("pomodoro-phase-alert");
    await expect(phaseAlert).toHaveAttribute("data-pomodoro-phase", "break");
    await expect(phaseAlert).toContainText("휴식 시간입니다");
    await expect(phaseAlert).toContainText("작업 1/2회 완료");
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __pomodoroAlertSoundCount?: number })
        .__pomodoroAlertSoundCount ?? 0
    )).toBe(1);
    await phaseAlert
      .getByRole("button", { name: "집중 단계 알림 닫기", exact: true })
      .click();
    await expect(phaseAlert).toBeHidden();
    await expect(
      timer.getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          (workId) => window.eumStudio.activity.getPomodoro({
            schemaVersion: 1,
            workId,
          }),
          runningWorkId,
        ),
      )
      .toMatchObject({
        activePhase: {
          state: "running",
          phase: "break",
          pauseReason: null,
        },
      });

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await installFakePomodoroAlertAudio(page);
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("휴식 1/2");
    await expect(page.getByTestId("pomodoro-phase-alert")).toHaveCount(0);
    const restoredWorkIdValue = await page
      .getByTestId("current-work")
      .getAttribute("title");
    if (restoredWorkIdValue === null) {
      throw new Error("Expected restored Work identity");
    }
    const restoredWorkId = entityId<"Work">(restoredWorkIdValue);
    const restoredPomodoro = await page.evaluate(
      (workId) => window.eumStudio.activity.getPomodoro({
        schemaVersion: 1,
        workId,
      }),
      restoredWorkId,
    );
    expect(restoredPomodoro.activePhase).toMatchObject({
      state: "paused",
      pauseReason: "restore",
    });
    await expect(timer).toHaveAttribute(
      "title",
      "이전 실행에서 안전하게 일시정지되었습니다.",
    );
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await page
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    focusPomodoroStatus = page.getByTestId("focus-pomodoro-status");
    await expect(focusPomodoroStatus).toHaveAttribute(
      "data-pomodoro-phase",
      "work",
      { timeout: 9_000 },
    );
    await expect(focusPomodoroStatus).toContainText("작업 모드");
    await expect(focusPomodoroStatus).toContainText("작업 2/2 · 완료 1회");
    await page.keyboard.press("Escape");
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("작업 2/2");
    sessionFeedback = page.getByTestId("session-feedback");
    await expect(sessionFeedback).toHaveAttribute("data-pomodoro-phase", "work");
    await expect(timer).toContainText("완료 1회");
    await expect(
      sessionFeedback.locator(".session-feedback-phase > span"),
    ).toHaveCSS("color", "rgb(217, 119, 6)");
    phaseAlert = page.getByTestId("pomodoro-phase-alert");
    await expect(phaseAlert).toHaveAttribute("data-pomodoro-phase", "work");
    await expect(phaseAlert).toContainText("작업을 재개할 시간입니다");
    await expect(phaseAlert).toContainText("작업 1/2회 완료");
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __pomodoroAlertSoundCount?: number })
        .__pomodoroAlertSoundCount ?? 0
    )).toBe(1);
    await phaseAlert
      .getByRole("button", { name: "집중 단계 알림 닫기", exact: true })
      .click();
    await expect(
      timer.getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await expect(page.getByTestId("pomodoro-completed")).toContainText(
      "집중 주기 완료 2/2",
      { timeout: 7_000 },
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expect(page.getByTestId("pomodoro-completed")).toContainText(
      "집중 주기 완료 2/2",
    );
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await expect(dialog.getByLabel("작업 시간(분)")).toHaveValue("0.1");
    await expect(dialog.getByLabel("휴식 시간(분)")).toHaveValue("0.1");
    await expect(dialog.getByLabel("작업 주기")).toHaveValue("2");
    await expect(dialog.getByLabel("단계 자동 전환")).not.toBeChecked();
    await expect(dialog.getByText(/음악|소리/u)).toHaveCount(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("compares one immutable WorkSnapshot across current Documents", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-snapshot-comparison-"),
  );
  const workTitle = `비교-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `첫회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째회차-${randomUUID().slice(0, 8)}`;
  const thirdDocumentTitle = `새회차-${randomUUID().slice(0, 8)}`;
  const firstText = `첫 원고 ${randomUUID()}`;
  const secondText = `둘째 원고 ${randomUUID()}`;
  const changedSuffix = ` 수정 ${randomUUID()}`;
  const thirdText = `새 원고 ${randomUUID()}`;
  const snapshotLabel = `초고 기준-${randomUUID().slice(0, 8)}`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(firstText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(page, secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openReviewTab(page, "버전");
    const snapshotRegion = page.getByRole("region", { name: "명명된 기준점 슬롯" });
    await snapshotRegion.getByLabel("기준점 슬롯 이름").fill(snapshotLabel);
    await snapshotRegion
      .getByRole("button", { name: "이 슬롯에 기준점 만들기", exact: true })
      .click();
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();

    await expect(
      snapshotRegion.getByRole("button", {
        name: `${snapshotLabel} 현재 기준점 비교`,
        exact: true,
      }),
    ).toBeEnabled();
    await openWorkSection(page, "쓰기");
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(changedSuffix);
    await expect(page.getByTestId("manuscript-character-count")).toHaveText(
      String(secondText.length + changedSuffix.length),
    );
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await createNamedEpisode(page, thirdDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(thirdText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openReviewTab(page, "버전");
    await snapshotRegion
      .getByRole("button", {
        name: `${snapshotLabel} 현재 기준점 비교`,
        exact: true,
      })
      .click();
    const comparisonDialog = page.getByRole("dialog", {
      name: "작품 스냅샷 비교",
    });
    await expect(comparisonDialog).toBeVisible();
    const summary = comparisonDialog.getByRole("region", {
      name: "스냅샷 비교 합계",
    });
    await expect(summary).toContainText(
      `스냅샷 ${(firstText.length + secondText.length).toLocaleString()}자`,
    );
    await expect(summary).toContainText(
      `현재 ${(firstText.length + secondText.length + changedSuffix.length + thirdText.length).toLocaleString()}자`,
    );
    await expect(
      comparisonDialog.getByRole("row").filter({ hasText: firstDocumentTitle }),
    ).toContainText("같음");
    await expect(
      comparisonDialog.getByRole("row").filter({ hasText: secondDocumentTitle }),
    ).toContainText("변경됨");
    await expect(
      comparisonDialog.getByRole("row").filter({ hasText: thirdDocumentTitle }),
    ).toContainText("스냅샷 뒤 추가");
    await expect(comparisonDialog).not.toContainText(firstText);
    await expect(comparisonDialog).not.toContainText(secondText);
    await expect(comparisonDialog).not.toContainText(thirdText);
    await comparisonDialog
      .getByRole("button", { name: "작품 스냅샷 비교 닫기", exact: true })
      .click();
    await expect(comparisonDialog).toBeHidden();
    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, thirdText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("derives Work records from the WritingSession ledger and returns to its exact Document", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-records-"),
  );
  const workTitle = `기록-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
  const manuscriptText = `집필 원장 ${randomUUID()}`;
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

    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await expect(page.getByTestId("writing-session-timer")).toBeVisible();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "기록 시작", exact: true }),
    ).toBeVisible();

    await openStudioHome(page);
    const recordsDialog = await openWritingRecords(page);
    await expect(recordsDialog).toContainText(workTitle);
    await expect(recordsDialog.getByTestId("records-total-sessions")).toContainText(
      "1회",
    );
    await expect(recordsDialog.getByTestId("records-total-delta")).toContainText(
      `+${manuscriptText.length}자`,
    );
    await expect(
      recordsDialog.getByRole("heading", { name: "일별 흐름", exact: true }),
    ).toBeVisible();
    await expect(
      recordsDialog.getByRole("heading", { name: "회차별 기록", exact: true }),
    ).toBeVisible();
    await expect(
      recordsDialog.getByRole("heading", { name: "최근 세션", exact: true }),
    ).toBeVisible();

    await recordsDialog
      .getByRole("button", {
        name: `${documentTitle} 기록 회차 열기`,
        exact: true,
      })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveText(
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists Work writing goals and derives progress after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-record-goals-"),
  );
  const workTitle = `목표-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
  const manuscriptText = `목표 집필 ${randomUUID()}`;
  const dailyCharacterGoal = manuscriptText.length + 100;
  const weeklyCharacterGoal = manuscriptText.length + 500;
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

    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await openStudioHome(page);
    let recordsDialog = await openWritingRecords(page);
    await recordsDialog.getByRole("spinbutton", { name: "오늘 집중" }).fill("45");
    await recordsDialog
      .getByRole("spinbutton", { name: "오늘 글자" })
      .fill(String(dailyCharacterGoal));
    await recordsDialog
      .getByRole("spinbutton", { name: "이번 주 집중" })
      .fill("180");
    await recordsDialog
      .getByRole("spinbutton", { name: "이번 주 글자" })
      .fill(String(weeklyCharacterGoal));
    await recordsDialog
      .getByRole("button", { name: "목표 저장", exact: true })
      .click();
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "오늘 글자" }),
    ).toHaveValue(String(dailyCharacterGoal));
    await expect(recordsDialog).toContainText(
      `+${manuscriptText.length} / ${dailyCharacterGoal}자`,
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    recordsDialog = await openWritingRecords(page);
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "오늘 집중" }),
    ).toHaveValue("45");
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "오늘 글자" }),
    ).toHaveValue(String(dailyCharacterGoal));
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "이번 주 집중" }),
    ).toHaveValue("180");
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "이번 주 글자" }),
    ).toHaveValue(String(weeklyCharacterGoal));
    await expect(recordsDialog).toContainText(
      `+${manuscriptText.length} / ${weeklyCharacterGoal}자`,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists Work episode readthrough rates across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-readthrough-"),
  );
  const workTitle = `연독-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `1화-${randomUUID().slice(0, 5)}`;
  const secondDocumentTitle = `2화-${randomUUID().slice(0, 5)}`;
  const thirdDocumentTitle = `3화-${randomUUID().slice(0, 5)}`;
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
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await createNamedEpisode(page, secondDocumentTitle);
    await createNamedEpisode(page, thirdDocumentTitle);

    await openStudioHome(page);
    let recordsDialog = await openWritingRecords(page);
    let calculator = recordsDialog.getByRole("region", {
      name: "연독률 계산기",
    });
    await calculator.getByLabel(`${firstDocumentTitle} 조회수`).fill("1000");
    await calculator.getByLabel(`${secondDocumentTitle} 조회수`).fill("800");
    await calculator.getByLabel(`${thirdDocumentTitle} 조회수`).fill("600");
    await calculator
      .getByRole("button", { name: "연독률 저장", exact: true })
      .click();
    await expect(
      calculator.getByLabel(`${thirdDocumentTitle} 조회수`),
    ).toHaveValue("600");
    await expect(calculator).toContainText("80%");
    await expect(calculator).toContainText("75%");
    await expect(calculator).toContainText("60%");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    recordsDialog = await openWritingRecords(page);
    calculator = recordsDialog.getByRole("region", {
      name: "연독률 계산기",
    });
    await expect(
      calculator.getByLabel(`${firstDocumentTitle} 조회수`),
    ).toHaveValue("1000");
    await expect(
      calculator.getByLabel(`${secondDocumentTitle} 조회수`),
    ).toHaveValue("800");
    await expect(
      calculator.getByLabel(`${thirdDocumentTitle} 조회수`),
    ).toHaveValue("600");
    await expect(calculator).toContainText("80%");
    await expect(calculator).toContainText("75%");
    await expect(calculator).toContainText("60%");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("exports only the selected Work records period as JSON and CSV", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-record-export-"),
  );
  const firstWorkTitle = `제외-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `제외회차-${randomUUID().slice(0, 8)}`;
  const secondWorkTitle = `내보낼작품-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `내보낼회차-${randomUUID().slice(0, 8)}`;
  const jsonPath = path.join(directory, "records.json");
  const csvPath = path.join(directory, "records.csv");
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();

    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();

    await openStudioHome(page);
    const recordsDialog = await openWritingRecords(page);
    await expect(recordsDialog).toContainText(secondWorkTitle);
    const today = await page.evaluate(() => {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    });
    await recordsDialog.getByLabel("기록 시작일").fill(today);
    await recordsDialog.getByLabel("기록 종료일").fill(today);

    await electronApp.evaluate(
      ({ dialog }, selectedPaths) => {
        let index = 0;
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: selectedPaths[index++],
          }),
        });
      },
      [jsonPath, csvPath],
    );

    await recordsDialog
      .getByRole("button", { name: "JSON 내보내기", exact: true })
      .click();
    await expect(recordsDialog).toContainText("1개 세션을 내보냈습니다.");
    const jsonText = await readFile(jsonPath, "utf8");
    const jsonValue = JSON.parse(jsonText) as {
      schemaVersion: number;
      work: { workId: string; title: string };
      period: { fromDate: string; toDate: string };
      sessions: Array<{ documentTitle: string }>;
    };
    expect(jsonText).toBe(`${JSON.stringify(jsonValue, null, 2)}\n`);
    expect(jsonValue.schemaVersion).toBe(1);
    expect(jsonValue.work.title).toBe(secondWorkTitle);
    expect(jsonValue.period).toEqual({ fromDate: today, toDate: today });
    expect(jsonValue.sessions).toEqual([
      expect.objectContaining({ documentTitle: secondDocumentTitle }),
    ]);
    expect(jsonText).not.toContain(firstWorkTitle);
    expect(jsonText).not.toContain(firstDocumentTitle);

    await recordsDialog
      .getByRole("button", { name: "CSV 내보내기", exact: true })
      .click();
    await expect
      .poll(() =>
        readFile(csvPath, "utf8").catch(() => null),
      )
      .not.toBeNull();
    const csvText = await readFile(csvPath, "utf8");
    expect(csvText.startsWith(
      "sessionId,documentId,documentTitle,state,startedAt,endedAt,activeDurationMs,characterDelta,note\r\n",
    )).toBe(true);
    expect(csvText.endsWith("\r\n")).toBe(true);
    expect(csvText.split("\r\n")).toHaveLength(3);
    expect(csvText).toContain(secondDocumentTitle);
    expect(csvText).not.toContain(firstDocumentTitle);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

