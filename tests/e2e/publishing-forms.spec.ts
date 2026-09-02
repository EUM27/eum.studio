import {
  randomUUID,
  mkdtemp,
  tmpdir,
  path,
  expect,
  test,
  electron,
  openPublishingFromLibrary,
  openStudioHome,
  expectDialogFitsDesktop,
  removeVerifiedTemporaryDirectory,
} from "./support/desktop-shell-suite";

test("builds a base publishing form, customizes one partner, and restores Work answers", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-forms-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `양식작품-${suffix}`;
  const partnerName = `양식투고처-${suffix}`;
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
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("첫 회차");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();

    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expectDialogFitsDesktop(dialog);
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "투고 양식", exact: true }).click();
    await dialog.getByRole("button", { name: "기본 템플릿 만들기", exact: true }).click();
    await expect(dialog.getByLabel("투고 양식 이름"))
      .toHaveValue("기본 투고 양식");
    await expect(dialog.getByLabel("작가 정보 항목 1 이름")).toHaveValue("필명");
    await expect(dialog.getByLabel("작품 정보 항목 2 이름")).toHaveValue("로그라인");

    await dialog.getByRole("button", { name: "구역 추가", exact: true }).click();
    const addedSectionName = dialog.getByLabel("구역 3 이름");
    await addedSectionName.fill("추가 요구 정보");
    const addedSection = dialog.locator(".publishing-form-section-card").nth(2);
    await addedSection.getByRole("button", { name: "항목 추가", exact: true }).click();
    await addedSection.getByLabel("추가 요구 정보 항목 1 이름")
      .fill("선택형 정보");
    await addedSection.getByLabel("선택형 정보 입력 종류")
      .selectOption("select");
    await addedSection.getByLabel("선택형 정보 선택값")
      .fill("첫 선택\n둘째 선택");
    await addedSection.getByLabel("선택형 정보 필수 항목").check();
    await dialog.getByRole("button", { name: "양식 저장", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "양식 저장", exact: true }))
      .toBeEnabled();

    await dialog.getByRole("button", { name: new RegExp(partnerName, "u") }).click();
    await dialog.getByRole("button", {
      name: "기본 템플릿에서 만들기",
      exact: true,
    }).click();
    await expect(dialog.getByLabel("작가 정보 항목 1 이름")).toHaveValue("필명");
    await expect(dialog.getByLabel("추가 요구 정보 항목 1 이름"))
      .toHaveValue("선택형 정보");

    await dialog.getByLabel("작가 정보 항목 1 이름").fill("필명 또는 작가명");
    await dialog.getByRole("button", { name: "양식 저장", exact: true }).click();
    await expect(dialog.getByLabel("작가 정보 항목 1 이름"))
      .toHaveValue("필명 또는 작가명");

    await dialog.getByLabel("필명 또는 작가명", { exact: true }).fill("은하");
    await dialog.getByLabel(/선택형 정보 · 필수/u).selectOption("둘째 선택");
    await dialog.getByRole("button", { name: "작성값 저장", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "작성값 저장", exact: true }))
      .toBeEnabled();

    const beforeRestart = await page.evaluate(async () => {
      const [templates, responses] = await Promise.all([
        window.eumStudio.publishingFormTemplates.list({ schemaVersion: 1 }),
        window.eumStudio.publishingFormResponses.list({ schemaVersion: 1, workId: null }),
      ]);
      return { templates: templates.templates, responses: responses.responses };
    });
    expect(beforeRestart.templates).toHaveLength(2);
    expect(beforeRestart.templates.find((template) => template.scope === "base")
      ?.sections.flatMap((section) => section.fields.map((field) => field.label)))
      .toContain("필명");
    expect(beforeRestart.templates.find((template) => template.scope === "partner")
      ?.sections.flatMap((section) => section.fields.map((field) => field.label)))
      .toContain("필명 또는 작가명");
    expect(beforeRestart.responses).toHaveLength(1);
    expect(beforeRestart.responses[0]?.answers.map((answer) => answer.value))
      .toContain("은하");
    expect(beforeRestart.responses[0]?.answers.map((answer) => answer.value))
      .toContain("둘째 선택");

    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고 양식", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(partnerName, "u") }).click();
    await expect(dialog.getByLabel("필명 또는 작가명", { exact: true }))
      .toHaveValue("은하");
    await expect(dialog.getByLabel(/선택형 정보 · 필수/u))
      .toHaveValue("둘째 선택");
    const afterRestart = await page.evaluate(async () => {
      const [templates, responses] = await Promise.all([
        window.eumStudio.publishingFormTemplates.list({ schemaVersion: 1 }),
        window.eumStudio.publishingFormResponses.list({ schemaVersion: 1, workId: null }),
      ]);
      return { templates: templates.templates, responses: responses.responses };
    });
    expect(afterRestart).toEqual(beforeRestart);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});
