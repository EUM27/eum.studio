import {
  electron,
  expect,
  expectEditorText,
  path,
  randomUUID,
  test,
  type Page,
} from "./support/desktop-shell-suite";

async function openTool(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: "전체 도구 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빠른 도구", exact: true });
  const search = dialog.getByRole("combobox", { name: "작품, 회차 또는 명령 검색", exact: true });
  await search.fill(label);
  await dialog.getByRole("option").filter({ has: page.getByText(label, { exact: true }) }).click();
  await expect(dialog).toBeHidden();
}

test("discovers work tools from Home and writing while preserving selection, settings drafts, and durable text", async () => {
  test.setTimeout(120_000);
  const directory = test.info().outputPath("workspace");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const args = [".", `--user-data-dir=${path.join(directory, "user-data")}`];
  const executablePath = process.env.EUM_STUDIO_E2E_EXECUTABLE_PATH;
  if (executablePath !== undefined && !path.isAbsolute(executablePath)) {
    throw new Error("The selected E2E executable path must be absolute");
  }
  const launchOptions = {
    args, cwd: process.cwd(), env: runtimeEnvironment,
    ...(executablePath === undefined ? {} : { executablePath }),
  };
  let app = await electron.launch(launchOptions);
  const selectedText = randomUUID();
  const text = `${selectedText}\n${randomUUID()}`;
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  try {
    let page = await app.firstWindow();
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(page.getByRole("region", { name: "작업실 시작하기" })).toBeVisible();
    await page.getByRole("button", { name: "첫 작품 만들기", exact: true }).click();
    const create = page.getByRole("dialog", { name: "새 작품 만들기" });
    await create.getByLabel("작품 제목").fill(workTitle);
    await create.getByLabel("첫 회차 제목").fill(documentTitle);
    await create.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고", exact: true });
    await manuscript.fill(text);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+Home");
    await manuscript.press("Shift+End");
    await openTool(page, "파편 서랍");
    const fragments = page.getByRole("dialog", { name: "파편 서랍", exact: true });
    await expect(fragments.getByRole("button", { name: "선택을 복사", exact: true })).toBeEnabled();
    await fragments.getByRole("button", { name: "선택을 복사", exact: true }).click();
    await expect(fragments.locator(".fragment-card pre")).toHaveText(selectedText);
    await fragments.getByRole("button", { name: "파편 서랍 닫기", exact: true }).click();
    await expectEditorText(manuscript, text);

    await manuscript.focus();
    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "빠른 도구", exact: true });
    const search = palette.getByRole("combobox", { name: "작품, 회차 또는 명령 검색", exact: true });
    await search.fill("존재하지 않는 기능");
    await expect(palette.getByText("일치하는 항목이 없습니다.", { exact: true })).toBeVisible();
    await palette.getByRole("button", { name: "전체 도구 보기", exact: true }).click();
    await expect(search).toBeFocused();
    await search.fill("집필 기록");
    await search.press("Enter");
    await expect(page.getByRole("tab", { name: "집필 기록", exact: true })).toHaveAttribute("aria-selected", "true");
    const records = page.locator(".records-content");
    await expect(records).toBeVisible();
    expect(await records.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await openTool(page, "확정된 별빛");
    const canon = page.getByRole("region", { name: "별빛 작업", exact: true });
    await expect(canon.getByRole("button", { name: "인물 추가·관리", exact: true })).toBeVisible();
    await expect(canon.getByRole("tab", { name: "문맥·활동", exact: true })).toBeInViewport();
    expect(await canon.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await page.getByRole("button", { name: "홈 열기", exact: true }).click();
    await openTool(page, "인물 관리");
    await expect(page.getByRole("tab", { name: "인물", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".character-workspace")).toBeVisible();

    await openTool(page, "앱 설정");
    const settings = page.getByRole("dialog", { name: "앱 설정", exact: true });
    const count = settings.getByLabel("1회 기준 글자수", { exact: true });
    const editedValue = String(Number(await count.inputValue()) + 1);
    await count.fill(editedValue);
    await settings.getByRole("tab", { name: "음악", exact: true }).click();
    await expect(settings.getByLabel("회차 전환 시 자동 선곡")).toBeVisible();
    await settings.getByRole("tab", { name: "음악", exact: true }).press("ArrowLeft");
    await expect(settings.getByRole("tab", { name: "조수·장면 분석", exact: true })).toHaveAttribute("aria-selected", "true");
    const checkbox = settings.getByRole("checkbox");
    expect(await checkbox.evaluate((element) => element.getBoundingClientRect().width < element.parentElement!.getBoundingClientRect().width / 4)).toBe(true);
    await settings.getByRole("tab", { name: "집필 기준", exact: true }).click();
    await expect(count).toHaveValue(editedValue);
    await settings.getByRole("button", { name: "저장", exact: true }).click();
    await expect(settings).toBeHidden();

    await openTool(page, "원고로 돌아가기");
    await expectEditorText(manuscript, text);
    await manuscript.focus();
    await page.keyboard.press("Control+K");
    await expect(palette).toBeVisible();
    await page.keyboard.press("Control+K");
    await page.keyboard.press("Escape");
    await expect(manuscript).toBeFocused();
    await expectEditorText(manuscript, text);

    await app.close();
    app = await electron.launch(launchOptions);
    page = await app.firstWindow();
    await page.getByRole("button", { name: /이어쓰기$/u }).first().click();
    await expectEditorText(page.getByRole("textbox", { name: "원고", exact: true }), text);
    await openTool(page, "앱 설정");
    await expect(page.getByRole("dialog", { name: "앱 설정" }).getByLabel("1회 기준 글자수", { exact: true })).toHaveValue(editedValue);
  } finally {
    await app.close();
  }
});
