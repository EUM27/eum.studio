import {
  randomUUID,
  mkdtemp,
  readFile,
  writeFile,
  tmpdir,
  createServer,
  path,
  DatabaseSync,
  expect,
  test,
  electron,
  openPublishingFromLibrary,
  openStudioWorkspace,
  continueFromMain,
  openStudioHome,
  openAssistantContext,
  openWorkSection,
  openStructureTab,
  openLoreCandidateInbox,
  activateDocumentFromTree,
  createNamedEpisode,
  readActiveDocumentId,
  expectEditorText,
  expectDialogFitsDesktop,
  removeVerifiedTemporaryDirectory,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";
test("creates and edits the shared publishing partner ledger across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-partners-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const parentName = `은하출판-${suffix}`;
  const partnerName = `별빛문고-${suffix}`;
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
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expectDialogFitsDesktop(dialog);
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();

    await dialog.getByLabel("투고처 이름").fill(parentName);
    await dialog.getByLabel("투고 방식").fill("이메일");
    await dialog.getByLabel("투고 링크").fill("https://publisher.example");
    await dialog.getByLabel("투고처 이메일").fill("contact@publisher.example");
    await dialog.getByLabel("투고처 장르").fill("장르소설");
    await dialog.getByLabel("투고 분량").fill("원고 3화");
    await dialog.getByLabel("투고처 우선순위").fill("검토 중");
    await dialog.getByLabel("투고처 메모").fill("공식 안내 확인");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(parentName);

    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("모 출판사").selectOption({ label: parentName });
    await dialog.getByLabel("투고 방식").fill("온라인 폼");
    await dialog
      .getByLabel("투고 링크")
      .fill("https://publisher.example/submission");
    await dialog.getByLabel("투고처 이메일").fill("story@publisher.example");
    await dialog.getByLabel("투고처 장르").fill("판타지\n로맨스");
    await dialog.getByLabel("투고 분량").fill("시놉시스와 원고 3화");
    await dialog.getByLabel("투고처 우선순위").fill("이번 달");
    await dialog.getByLabel("투고처 메모").fill("마감일 확인");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(parentName);

    await dialog.getByLabel("투고처 이메일").fill("novel@publisher.example");
    await dialog.getByLabel("투고처 메모").fill("담당 메일 갱신");
    await dialog.getByRole("button", { name: "변경 저장", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이메일"))
      .toHaveValue("novel@publisher.example");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();

    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(parentName);
    await expect(dialog.getByLabel("투고 방식")).toHaveValue("온라인 폼");
    await expect(dialog.getByLabel("투고 링크"))
      .toHaveValue("https://publisher.example/submission");
    await expect(dialog.getByLabel("투고처 이메일"))
      .toHaveValue("novel@publisher.example");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지\n로맨스");
    await expect(dialog.getByLabel("투고 분량"))
      .toHaveValue("시놉시스와 원고 3화");
    await expect(dialog.getByLabel("투고처 우선순위")).toHaveValue("이번 달");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("담당 메일 갱신");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("compares user-entered web research and persists only explicitly selected partner fields", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-research-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const partnerName = `자료검토출판-${suffix}`;
  const sourceLabel = `공식투고안내-${suffix}`;
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
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("투고 방식").fill("이메일");
    await dialog.getByLabel("투고 링크").fill("https://old.example/submission");
    await dialog.getByLabel("투고처 이메일").fill("old@example.test");
    await dialog.getByLabel("투고처 장르").fill("판타지");
    await dialog.getByLabel("투고처 메모").fill("기존 메모");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "웹 자료 검토", exact: true }).click();
    await dialog.getByLabel("웹 자료 비교 투고처").selectOption({ label: partnerName });
    await dialog.getByLabel("자료 표시명").fill(sourceLabel);
    await dialog.getByLabel("자료 URL").fill("https://publisher.example/submissions");
    await dialog.getByLabel("확인한 날짜").fill("2026-08-10");
    await dialog.getByLabel("자료 권위").fill("공식 홈페이지");
    await dialog.getByLabel("홈페이지").fill("https://publisher.example/submit");
    await dialog.getByLabel("이메일").fill("new@example.test");
    await dialog.getByLabel("장르 (한 줄에 하나)").fill("판타지\n로맨스");
    await dialog.getByLabel("메모").fill("새 메모");
    await dialog.getByRole("button", { name: "현재 값과 비교", exact: true }).click();

    const candidate = dialog.getByRole("region", { name: "웹 자료 비교 결과" });
    await expect(candidate).toBeVisible();
    await candidate.getByLabel("홈페이지 반영").check();
    await candidate.getByLabel("장르 반영").check();
    await expect(candidate.getByLabel("이메일 반영")).not.toBeChecked();
    await expect(candidate.getByLabel("메모 반영")).not.toBeChecked();
    await candidate.getByRole("button", { name: "선택 필드 반영", exact: true }).click();
    await expect(candidate).toHaveCount(0);

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel("투고 링크"))
      .toHaveValue("https://publisher.example/submit");
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("old@example.test");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지\n로맨스");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("기존 메모");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
    await expect(dialog.getByLabel("근거 종류")).toHaveValue("web");
    await expect(dialog.getByLabel("근거 권위")).toHaveValue("공식 홈페이지");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);
    await expect(dialog.getByLabel("투고 링크"))
      .toHaveValue("https://publisher.example/submit");
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("old@example.test");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지\n로맨스");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("기존 메모");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses publishing metadata only and seals assistant record Candidates after explicit approval", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-assistant-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `조수투고작-${suffix}`;
  const documentTitle = `첫회차-${suffix}`;
  const firstPartnerName = `첫투고처-${suffix}`;
  const secondPartnerName = `둘째투고처-${suffix}`;
  const connectionLabel = `투고조수-${suffix}`;
  const model = `publishing-model-${suffix}`;
  const manuscriptText = `조수에게 전송되면 안 되는 원고 ${randomUUID()}`;
  const queryStatement = `${workTitle}를 아직 보내지 않은 곳을 보여줘`;
  const recordStatement = `2026-08-09에 ${workTitle}를 ${firstPartnerName}과 ${secondPartnerName}에 보냈어`;
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
        readonly input: { readonly statement: string };
      };
      receivedRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        schemaVersion: 1,
        payload: body.input.statement === queryStatement
          ? {
              kind: "query-unsubmitted",
              workLabel: workTitle,
              partnerLabels: [],
              submittedOn: null,
            }
          : {
              kind: "record-submissions",
              workLabel: workTitle,
              partnerLabels: [firstPartnerName, secondPartnerName],
              submittedOn: "2026-08-09",
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
    throw new Error("Expected a local publishing assistant TCP address");
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

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
    await connectionDialog.getByRole("button", { name: "조수 연결 닫기" }).click();
    permissionDialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await permissionDialog.getByRole("button", { name: "조수 접근 권한 닫기" }).click();

    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(firstPartnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(secondPartnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "작업실 조수", exact: true }).click();
    await dialog.getByLabel("투고 작업실 조수 연결").selectOption({
      label: `${connectionLabel} · ${model}`,
    });
    const assistantStatement = dialog.getByLabel("투고 작업실 조수 요청");
    await assistantStatement.fill(queryStatement);
    await dialog.getByRole("button", { name: "요청 해석", exact: true }).click();
    const queryResult = dialog.getByRole("region", { name: "작업실 조수 조회 결과" });
    await expect(queryResult.getByText(firstPartnerName, { exact: true })).toBeVisible();
    await expect(queryResult.getByText(secondPartnerName, { exact: true })).toBeVisible();
    expect((await page.evaluate(async () =>
      window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null })
    )).submissions).toHaveLength(0);

    await assistantStatement.fill(recordStatement);
    await dialog.getByRole("button", { name: "요청 해석", exact: true }).click();
    const candidate = dialog.getByRole("region", { name: "작업실 조수 기록 후보" });
    await expect(candidate.getByText(workTitle, { exact: true })).toBeVisible();
    await expect(candidate.getByText(firstPartnerName, { exact: true })).toBeVisible();
    await expect(candidate.getByText(secondPartnerName, { exact: true })).toBeVisible();
    expect((await page.evaluate(async () =>
      window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null })
    )).submissions).toHaveLength(0);
    await candidate.getByRole("button", { name: "확인하고 저장", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText(
      "투고 이력 2건을 현재 원고 버전으로 저장했습니다.",
    );

    const persisted = await page.evaluate(async () => {
      const [submissions, sources] = await Promise.all([
        window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null }),
        window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      ]);
      return { submissions: submissions.submissions, sources: sources.sources };
    });
    expect(persisted.submissions).toHaveLength(2);
    expect(persisted.sources).toHaveLength(1);
    expect(persisted.sources[0]).toMatchObject({
      kind: "user-statement",
      label: recordStatement,
    });
    expect(persisted.submissions.every((submission) =>
      submission.sourceIds[0] === persisted.sources[0]?.sourceId &&
      submission.package.documentRevisions.length === 1
    )).toBe(true);

    await expect.poll(() => receivedRequests.length).toBe(2);
    for (const request of receivedRequests) {
      expect(request).toMatchObject({
        method: "POST",
        url: "/assistant",
        body: {
          schemaVersion: 1,
          operation: "publishing-intent",
          model,
          input: {
            currentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
            registry: {
              currentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
              works: [expect.objectContaining({ title: workTitle })],
              partners: expect.arrayContaining([
                expect.objectContaining({ name: firstPartnerName }),
                expect.objectContaining({ name: secondPartnerName }),
              ]),
              submissions: [],
            },
          },
        },
      });
      expect(request.headers.authorization).toBeUndefined();
      const serialized = JSON.stringify(request.body);
      expect(serialized).not.toContain(manuscriptText);
      expect(serialized).not.toContain("manuscript");
      expect(serialized).not.toContain("credential");
    }

    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expectEditorText(page.getByRole("textbox", { name: "원고" }), manuscriptText);
    const reopened = await page.evaluate(async () => {
      const [submissions, sources] = await Promise.all([
        window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null }),
        window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      ]);
      return { submissions: submissions.submissions, sources: sources.sources };
    });
    expect(reopened).toEqual(persisted);
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    const submissionHistory = dialog.getByRole("region", { name: "투고 이력 목록" });
    await expect(submissionHistory.getByText(firstPartnerName, { exact: true })).toBeVisible();
    await expect(submissionHistory.getByText(secondPartnerName, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(recordStatement);
    expect(receivedRequests).toHaveLength(2);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("seals a submission package while history and manuscript continue independently across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-submissions-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `투고작-${suffix}`;
  const documentTitle = `첫회차-${suffix}`;
  const partnerName = `출판사-${suffix}`;
  const submissionTitle = `투고기록-${suffix}`;
  const initialText = `제출 원고 ${randomUUID()}`;
  const laterText = ` 이후 수정 ${randomUUID()}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(initialText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("투고 방식").fill("온라인 접수");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고 기록", exact: true }).click();
    await dialog.getByLabel("투고 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("투고처 선택").selectOption({ label: partnerName });
    await dialog.getByLabel("투고 기록 제목").fill(submissionTitle);
    await dialog.getByLabel("투고 상태").fill("접수");
    await dialog.getByLabel("투고일").fill("2026-08-10");
    await dialog.getByLabel("투고 메모").fill("접수 번호 보관");
    await dialog
      .getByRole("button", { name: "현재 원고 버전으로 기록 추가", exact: true })
      .click();
    const packageRegion = dialog.getByRole("region", {
      name: "제출 당시 원고 봉인본",
    });
    await expect(packageRegion).toContainText("1개 문서");
    const sealedManifest = await packageRegion.locator("small").textContent();
    expect(sealedManifest).not.toBeNull();
    expect(sealedManifest?.length).toBeGreaterThan(0);

    await dialog.getByLabel("투고 상태").fill("회신 완료");
    await dialog.getByLabel("회신일").fill("2026-08-18");
    await dialog.getByLabel("투고 결과").fill("수정 요청");
    await dialog.getByLabel("투고 카드 메모").fill("장르 편집부");
    await dialog.getByLabel("투고 메모").fill("회신 원문 별도 보관");
    await dialog.getByRole("button", { name: "투고 이력 저장", exact: true }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 완료");
    await expect(packageRegion.locator("small")).toHaveText(sealedManifest ?? "");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(laterText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 완료");
    await expect(dialog.getByLabel("투고 결과")).toHaveValue("수정 요청");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("회신 원문 별도 보관");
    await expect(
      dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"),
    ).toHaveText(sealedManifest ?? "");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expect(dialog.getByLabel("투고 기록 제목")).toHaveValue(submissionTitle);
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 완료");
    await expect(dialog.getByLabel("회신일")).toHaveValue("2026-08-18");
    await expect(dialog.getByLabel("투고 결과")).toHaveValue("수정 요청");
    await expect(dialog.getByLabel("투고 카드 메모")).toHaveValue("장르 편집부");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("회신 원문 별도 보관");
    await expect(
      dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"),
    ).toHaveText(sealedManifest ?? "");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a contract linked to its matching submission across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-contracts-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `계약작-${suffix}`;
  const partnerName = `계약처-${suffix}`;
  const submissionTitle = `연결투고-${suffix}`;
  const contractTitle = `전자계약-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고 기록", exact: true }).click();
    await dialog.getByLabel("투고 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("투고처 선택").selectOption({ label: partnerName });
    await dialog.getByLabel("투고 기록 제목").fill(submissionTitle);
    await dialog
      .getByRole("button", { name: "현재 원고 버전으로 기록 추가", exact: true })
      .click();

    await dialog.getByRole("button", { name: "계약 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 계약", exact: true }).click();
    await dialog.getByLabel("계약 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("계약 거래처").selectOption({ label: partnerName });
    await dialog.getByLabel("계약 연결 투고").selectOption({ label: submissionTitle });
    await dialog.getByLabel("계약명").fill(contractTitle);
    await dialog.getByLabel("계약 상태").fill("체결");
    await dialog.getByLabel("계약 체결일").fill("2026-08-20");
    await dialog.getByLabel("계약 시작일").fill("2026-09-01");
    await dialog.getByLabel("계약 종료일").fill("2028-08-31");
    await dialog.getByLabel("계약 선급금").fill("1500000");
    await dialog.getByLabel("계약 통화").fill("KRW");
    await dialog.getByLabel("계약 권리 범위").fill("국내 전자 출판권");
    await dialog.getByLabel("계약 수익 배분 메모").fill("순매출 기준");
    await dialog.getByLabel("계약 메모").fill("원본 계약서는 별도 보관");
    await dialog.getByRole("button", { name: "계약 추가", exact: true }).click();
    await expect(dialog.getByLabel("계약명")).toHaveValue(contractTitle);
    await expect(dialog.getByRole("group", { name: "계약 소유 관계" }))
      .toContainText(submissionTitle);

    await dialog.getByLabel("계약 상태").fill("진행 중");
    await dialog.getByLabel("계약 체결일").fill("2026-08-21");
    await dialog.getByLabel("계약 종료일").fill("");
    await dialog.getByLabel("계약 선급금").fill("");
    await dialog.getByLabel("계약 권리 범위").fill("국내 전자·오디오 출판권");
    await dialog.getByLabel("계약 수익 배분 메모").fill("부속 합의 기준");
    await dialog.getByLabel("계약 메모").fill("부속 합의 확인");
    await dialog.getByRole("button", { name: "계약 변경 저장", exact: true }).click();
    await expect(dialog.getByLabel("계약 상태")).toHaveValue("진행 중");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "계약 원장", exact: true }).click();
    await expect(dialog.getByLabel("계약명")).toHaveValue(contractTitle);
    await expect(dialog.getByLabel("계약 상태")).toHaveValue("진행 중");
    await expect(dialog.getByLabel("계약 체결일")).toHaveValue("2026-08-21");
    await expect(dialog.getByLabel("계약 시작일")).toHaveValue("2026-09-01");
    await expect(dialog.getByLabel("계약 종료일")).toHaveValue("");
    await expect(dialog.getByLabel("계약 선급금")).toHaveValue("");
    await expect(dialog.getByLabel("계약 통화")).toHaveValue("KRW");
    await expect(dialog.getByLabel("계약 권리 범위"))
      .toHaveValue("국내 전자·오디오 출판권");
    await expect(dialog.getByLabel("계약 수익 배분 메모"))
      .toHaveValue("부속 합의 기준");
    await expect(dialog.getByLabel("계약 메모")).toHaveValue("부속 합의 확인");
    await expect(dialog.getByRole("group", { name: "계약 소유 관계" }))
      .toContainText(submissionTitle);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a publication with independent contract and channel links across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-publications-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `연재작-${suffix}`;
  const publisherName = `출판사-${suffix}`;
  const channelName = `연재관-${suffix}`;
  const contractTitle = `연재계약-${suffix}`;
  const publicationTitle = `주2회-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(publisherName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(channelName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "계약 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 계약", exact: true }).click();
    await dialog.getByLabel("계약 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("계약 거래처").selectOption({ label: publisherName });
    await dialog.getByLabel("계약명").fill(contractTitle);
    await dialog.getByRole("button", { name: "계약 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 발행·연재", exact: true }).click();
    await dialog.getByLabel("발행 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("발행 연결 계약").selectOption({ label: contractTitle });
    await dialog.getByLabel("발행 채널").selectOption({ label: channelName });
    await dialog.getByLabel("발행 단위 이름").fill(publicationTitle);
    await dialog.getByLabel("발행 상태").fill("연재 중");
    await dialog.getByLabel("발행 형태").fill("웹 연재");
    await dialog.getByLabel("발행 공개 예정일").fill("2026-09-01");
    await dialog.getByLabel("발행 시작일").fill("2026-09-03");
    await dialog.getByLabel("공개 단위 수").fill("12");
    await dialog.getByLabel("계획 단위 수").fill("40");
    await dialog.getByLabel("발행 일정 메모").fill("화·금 공개");
    await dialog.getByLabel("발행 메모").fill("채널 공지 확인");
    await dialog.getByRole("button", { name: "발행·연재 추가", exact: true }).click();
    await expect(dialog.getByLabel("발행 단위 이름")).toHaveValue(publicationTitle);
    await expect(dialog.getByLabel("발행 연결 계약").locator("option:checked"))
      .toHaveText(contractTitle);
    await expect(dialog.getByLabel("발행 채널").locator("option:checked"))
      .toHaveText(channelName);

    await dialog.getByLabel("발행 상태").fill("휴재");
    await dialog.getByLabel("발행 형태").fill("웹·앱 동시 연재");
    await dialog.getByLabel("발행 공개 예정일").fill("");
    await dialog.getByLabel("발행 시작일").fill("2026-09-04");
    await dialog.getByLabel("발행 종료일").fill("2026-12-31");
    await dialog.getByLabel("공개 단위 수").fill("13");
    await dialog.getByLabel("계획 단위 수").fill("");
    await dialog.getByLabel("발행 일정 메모").fill("복귀일 미정");
    await dialog.getByLabel("발행 메모").fill("13화까지 공개");
    await dialog
      .getByRole("button", { name: "발행·연재 변경 저장", exact: true })
      .click();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await expect(dialog.getByLabel("발행 단위 이름")).toHaveValue(publicationTitle);
    await expect(dialog.getByLabel("발행 연결 계약").locator("option:checked"))
      .toHaveText(contractTitle);
    await expect(dialog.getByLabel("발행 채널").locator("option:checked"))
      .toHaveText(channelName);
    await expect(dialog.getByLabel("발행 상태")).toHaveValue("휴재");
    await expect(dialog.getByLabel("발행 형태")).toHaveValue("웹·앱 동시 연재");
    await expect(dialog.getByLabel("발행 공개 예정일")).toHaveValue("");
    await expect(dialog.getByLabel("발행 시작일")).toHaveValue("2026-09-04");
    await expect(dialog.getByLabel("발행 종료일")).toHaveValue("2026-12-31");
    await expect(dialog.getByLabel("공개 단위 수")).toHaveValue("13");
    await expect(dialog.getByLabel("계획 단위 수")).toHaveValue("");
    await expect(dialog.getByLabel("발행 일정 메모")).toHaveValue("복귀일 미정");
    await expect(dialog.getByLabel("발행 메모")).toHaveValue("13화까지 공개");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a publication-owned settlement with signed line items across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-settlements-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `정산작-${suffix}`;
  const channelName = `정산채널-${suffix}`;
  const publicationTitle = `정산연재-${suffix}`;
  const settlementTitle = `9월정산-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(channelName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 발행·연재", exact: true }).click();
    await dialog.getByLabel("발행 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("발행 채널").selectOption({ label: channelName });
    await dialog.getByLabel("발행 단위 이름").fill(publicationTitle);
    await dialog.getByRole("button", { name: "발행·연재 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "정산서 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 정산서", exact: true }).click();
    await dialog.getByLabel("정산 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("정산 발행·연재").selectOption({ label: publicationTitle });
    await dialog.getByLabel("정산서 이름").fill(settlementTitle);
    await dialog.getByLabel("정산 기간 시작").fill("2026-09-01");
    await dialog.getByLabel("정산 기간 종료").fill("2026-09-30");
    await dialog.getByLabel("정산 발행일").fill("2026-10-10");
    await dialog.getByLabel("정산 검토 상태").fill("검토 중");
    await dialog.getByLabel("정산 보고 금액").fill("1250000");
    await dialog.getByLabel("정산 통화").fill("KRW");
    await dialog.getByLabel("정산 가감 항목명").fill("기본 배분");
    await dialog.getByLabel("정산 가감 금액").fill("1250000");
    await dialog.getByLabel("정산 가감 메모").fill("월 정산");
    await dialog.getByRole("button", { name: "항목 추가", exact: true }).click();
    await dialog.getByLabel("정산 메모").fill("원문 파일 별도 보관");
    await dialog.getByRole("button", { name: "정산서 추가", exact: true }).click();
    await expect(dialog.getByLabel("정산서 이름")).toHaveValue(settlementTitle);

    await dialog.getByLabel("정산 검토 상태").fill("확인 완료");
    await dialog.getByLabel("정산 발행일").fill("");
    await dialog.getByLabel("정산 보고 금액").fill("1240000");
    await dialog.getByLabel("정산 가감 항목명").fill("플랫폼 수수료 조정");
    await dialog.getByLabel("정산 가감 금액").fill("-10000");
    await dialog.getByLabel("정산 가감 메모").fill("명세서 반영");
    await dialog.getByRole("button", { name: "항목 추가", exact: true }).click();
    await dialog.getByLabel("정산 메모").fill("차액 확인 완료");
    await dialog.getByRole("button", { name: "정산서 변경 저장", exact: true }).click();
    const itemGroup = dialog.getByRole("group", { name: "가감 항목" });
    await expect(itemGroup).toContainText("기본 배분");
    await expect(itemGroup).toContainText("플랫폼 수수료 조정");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "정산서 원장", exact: true }).click();
    await expect(dialog.getByLabel("정산서 이름")).toHaveValue(settlementTitle);
    await expect(dialog.getByLabel("정산 발행·연재").locator("option:checked"))
      .toHaveText(publicationTitle);
    await expect(dialog.getByLabel("정산 검토 상태")).toHaveValue("확인 완료");
    await expect(dialog.getByLabel("정산 발행일")).toHaveValue("");
    await expect(dialog.getByLabel("정산 보고 금액")).toHaveValue("1240000");
    await expect(dialog.getByLabel("정산 통화")).toHaveValue("KRW");
    await expect(dialog.getByLabel("정산 메모")).toHaveValue("차액 확인 완료");
    const restoredItemGroup = dialog.getByRole("group", { name: "가감 항목" });
    await expect(restoredItemGroup).toContainText("기본 배분");
    await expect(restoredItemGroup).toContainText("1250000 KRW");
    await expect(restoredItemGroup).toContainText("플랫폼 수수료 조정");
    await expect(restoredItemGroup).toContainText("-10000 KRW");
    await expect(restoredItemGroup).toContainText("명세서 반영");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a settlement-linked payment with derived receivable across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-payments-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `입금작-${suffix}`;
  const channelName = `입금채널-${suffix}`;
  const publicationTitle = `입금연재-${suffix}`;
  const settlementTitle = `입금정산-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(channelName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 발행·연재", exact: true }).click();
    await dialog.getByLabel("발행 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("발행 채널").selectOption({ label: channelName });
    await dialog.getByLabel("발행 단위 이름").fill(publicationTitle);
    await dialog.getByRole("button", { name: "발행·연재 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "정산서 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 정산서", exact: true }).click();
    await dialog.getByLabel("정산 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("정산 발행·연재").selectOption({ label: publicationTitle });
    await dialog.getByLabel("정산서 이름").fill(settlementTitle);
    await dialog.getByLabel("정산 통화").fill("KRW");
    await dialog.getByLabel("정산 보고 금액").fill("1250000");
    await dialog.getByRole("button", { name: "정산서 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "입금 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 입금", exact: true }).click();
    await dialog.getByLabel("입금 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("입금 정산서").selectOption({ label: settlementTitle });
    await expect(dialog.getByLabel("입금 통화")).toHaveValue("KRW");
    await dialog.getByLabel("입금일").fill("2026-10-15");
    await dialog.getByLabel("입금액").fill("600000");
    await dialog.getByLabel("입금 매칭 상태").fill("부분 입금");
    await dialog.getByLabel("입금자").fill(channelName);
    await dialog.getByLabel("입금 거래 참조").fill("BANK-2026-10");
    await dialog.getByLabel("입금 메모").fill("1차 입금");
    await dialog.getByRole("button", { name: "입금 추가", exact: true }).click();
    const receivable = dialog.getByRole("region", { name: "미수금 요약" });
    await expect(receivable).toContainText("미수 650,000 KRW");
    await expect(receivable).toContainText("입금 600,000");

    await dialog.getByLabel("입금 확인일").fill("2026-10-16");
    await dialog.getByLabel("입금액").fill("590000");
    await dialog.getByLabel("입금 매칭 상태").fill("확인 완료");
    await dialog.getByLabel("입금자").fill("별빛 콘텐츠");
    await dialog.getByLabel("입금 거래 참조").fill("BANK-2026-10-R1");
    await dialog.getByLabel("입금 메모").fill("수수료 차감 확인");
    await dialog.getByRole("button", { name: "입금 변경 저장", exact: true }).click();
    await expect(receivable).toContainText("미수 660,000 KRW");
    await expect(receivable).toContainText("입금 590,000");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "입금 원장", exact: true }).click();
    await expect(dialog.getByLabel("입금 정산서").locator("option:checked"))
      .toHaveText(settlementTitle);
    await expect(dialog.getByLabel("입금일")).toHaveValue("2026-10-15");
    await expect(dialog.getByLabel("입금 확인일")).toHaveValue("2026-10-16");
    await expect(dialog.getByLabel("입금액")).toHaveValue("590000");
    await expect(dialog.getByLabel("입금 통화")).toHaveValue("KRW");
    await expect(dialog.getByLabel("입금 매칭 상태")).toHaveValue("확인 완료");
    await expect(dialog.getByLabel("입금자")).toHaveValue("별빛 콘텐츠");
    await expect(dialog.getByLabel("입금 거래 참조")).toHaveValue("BANK-2026-10-R1");
    await expect(dialog.getByLabel("입금 메모")).toHaveValue("수수료 차감 확인");
    await expect(dialog.getByRole("region", { name: "미수금 요약" }))
      .toContainText("미수 660,000 KRW");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates an immutable shared publishing source across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-sources-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `근거작-${suffix}`;
  const sourceLabel = `계약서 확인-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 근거", exact: true }).click();
    await dialog.getByLabel("근거 종류").fill("사용자 진술");
    await dialog.getByLabel("근거 표시명").fill(sourceLabel);
    await dialog.getByLabel("근거 URL").fill("https://example.test/contracts/source");
    await dialog.getByLabel("근거 확인 시각").fill("2026-10-16T12:30");
    await dialog.getByLabel("근거 권위").fill("직접 확인");
    await dialog.getByRole("button", { name: "근거 추가", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
    await expect(dialog.getByLabel("근거 종류")).toHaveValue("사용자 진술");
    await expect(dialog.getByLabel("근거 권위")).toHaveValue("직접 확인");
    await expect(dialog.getByText("이 근거는 자동 수정하지 않습니다.")).toBeVisible();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
    await expect(dialog.getByLabel("근거 종류")).toHaveValue("사용자 진술");
    await expect(dialog.getByLabel("근거 URL"))
      .toHaveValue("https://example.test/contracts/source");
    await expect(dialog.getByLabel("근거 확인 시각")).toHaveValue("2026-10-16T12:30");
    await expect(dialog.getByLabel("근거 권위")).toHaveValue("직접 확인");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("links and unlinks a shared publishing source by explicit user selection across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-evidence-links-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `근거연결작-${suffix}`;
  const partnerName = `근거투고처-${suffix}`;
  const sourceLabel = `공식안내-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 근거", exact: true }).click();
    await dialog.getByLabel("근거 종류").fill("공식 안내");
    await dialog.getByLabel("근거 표시명").fill(sourceLabel);
    await dialog.getByLabel("근거 권위").fill("직접 확인");
    await dialog.getByRole("button", { name: "근거 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    const evidenceCheckbox = dialog.getByLabel(`${sourceLabel} 근거 연결`);
    await expect(evidenceCheckbox).not.toBeChecked();
    await evidenceCheckbox.check();
    await dialog.getByRole("button", { name: "근거 연결 저장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).toBeChecked();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).toBeChecked();
    await dialog.getByLabel(`${sourceLabel} 근거 연결`).uncheck();
    await dialog.getByRole("button", { name: "근거 연결 저장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).not.toBeChecked();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).not.toBeChecked();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("imports explicitly mapped publishing partner CSV rows only after preview approval", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-partner-csv-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `CSV작-${suffix}`;
  const existingName = `기존출판-${suffix}`;
  const childName = `신규문고-${suffix}`;
  const csvPath = path.join(directory, "투고처.csv");
  await writeFile(csvPath, [
    "이름,모출판사,이메일,장르,원시열",
    `${existingName},,new@example.test,판타지,기존행`,
    `${childName},${existingName},child@example.test,로맨스,신규행`,
    ",,missing@example.test,,문제행",
  ].join("\r\n"), "utf8");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
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
    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({ canceled: false, filePaths: [selectedPath] }),
        });
      },
      csvPath,
    );
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(existingName);
    await dialog.getByLabel("투고처 이메일").fill("old@example.test");
    await dialog.getByLabel("투고처 메모").fill("기존 메모 유지");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "CSV 가져오기", exact: true }).click();
    await dialog.getByRole("button", { name: "CSV 파일 선택", exact: true }).click();
    await dialog.getByLabel("투고처 이름 CSV 열").selectOption({ label: "이름" });
    await dialog.getByLabel("모 출판사 CSV 열").selectOption({ label: "모출판사" });
    await dialog.getByLabel("이메일 CSV 열").selectOption({ label: "이메일" });
    await dialog.getByLabel("장르 CSV 열").selectOption({ label: "장르" });
    await dialog.getByRole("button", { name: "미리보기 만들기", exact: true }).click();
    const preview = dialog.getByRole("region", { name: "투고처 CSV 미리보기" });
    await expect(preview).toContainText("2개 반영 가능");
    await expect(preview).toContainText("1개 확인 필요");
    await preview.getByText("확인 필요한 행", { exact: true }).click();
    await expect(preview).toContainText("4행: 투고처 이름 없음");
    await preview.getByRole("button", { name: "2개 승인 반영", exact: true }).click();
    await expect(preview.getByRole("button", { name: "반영 완료", exact: true }))
      .toBeVisible();

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(existingName);
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("new@example.test");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("기존 메모 유지");
    await dialog.getByRole("button", { name: new RegExp(childName) }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(childName);
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(existingName);
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("child@example.test");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByText("투고처.csv · 2행", { exact: true })).toBeVisible();
    await expect(dialog.getByText("투고처.csv · 3행", { exact: true })).toBeVisible();
    await expect(dialog.getByText("투고처.csv · 4행", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(childName) }).click();
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(existingName);
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("child@example.test");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByText("투고처.csv · 2행", { exact: true })).toBeVisible();
    await expect(dialog.getByText("투고처.csv · 3행", { exact: true })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("imports explicitly mapped submission CSV rows with current sealed packages across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-submission-csv-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `투고CSV작-${suffix}`;
  const partnerName = `투고CSV문고-${suffix}`;
  const submissionTitle = `CSV투고-${suffix}`;
  const csvPath = path.join(directory, "투고 이력.csv");
  await writeFile(csvPath, [
    "작품,투고처,제목,투고일,상태,메모,원시열",
    `${workTitle},${partnerName},${submissionTitle},2026-08-10,접수,접수 번호 보관,보존값`,
    `없는 작품,${partnerName},제외행,2026-08-11,대기,,제외값`,
  ].join("\r\n"), "utf8");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
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
    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({ canceled: false, filePaths: [selectedPath] }),
        });
      },
      csvPath,
    );
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await page.getByRole("textbox", { name: "원고" }).pressSequentially("현재 제출 원고");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "CSV 가져오기", exact: true }).click();
    await dialog.getByRole("button", { name: "투고 이력 CSV 선택", exact: true }).click();
    await dialog.getByLabel("작품 이름 CSV 열").selectOption({ label: "작품" });
    await dialog.getByLabel("투고처 이름 CSV 열").last().selectOption({ label: "투고처" });
    await dialog.getByLabel("투고 제목 CSV 열").selectOption({ label: "제목" });
    await dialog.getByLabel("투고일 CSV 열").selectOption({ label: "투고일" });
    await dialog.getByLabel("상태 CSV 열").selectOption({ label: "상태" });
    await dialog.getByLabel("메모 CSV 열", { exact: true }).last()
      .selectOption({ label: "메모" });
    await dialog.getByRole("button", { name: "투고 이력 미리보기", exact: true }).click();
    const preview = dialog.getByRole("region", { name: "투고 이력 CSV 미리보기" });
    await expect(preview).toContainText("1개 반영 가능");
    await expect(preview).toContainText("1개 확인 필요");
    await preview.getByText("확인 필요한 행", { exact: true }).click();
    await expect(preview).toContainText("3행: 일치하는 작품 없음");
    await preview.getByRole("button", { name: "1개 승인 반영", exact: true }).click();
    await expect(preview.getByRole("button", { name: "반영 완료", exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 기록 제목")).toHaveValue(submissionTitle);
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("접수");
    await expect(dialog.getByLabel("투고일")).toHaveValue("2026-08-10");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("접수 번호 보관");
    const sealedPackage = dialog.getByRole("region", { name: "제출 당시 원고 봉인본" });
    await expect(sealedPackage).toContainText("1개 문서");
    const packageText = await sealedPackage.textContent();
    expect(packageText).toBeTruthy();

    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await dialog.getByRole("button", { name: /투고 이력\.csv · 2행/u }).click();
    await expect(dialog.getByRole("region", { name: "근거 상세" })).toContainText("보존값");
    await expect(dialog.getByText("투고 이력.csv · 3행", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("접수");
    await expect(dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }))
      .toHaveText(packageText ?? "");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByText("투고 이력.csv · 2행", { exact: true })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("reviews exact Work-owned lore Candidates without changing canonical lore before approval across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-candidates-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `검토 작품-${suffix}`;
  const documentTitle = `검토 회차-${suffix}`;
  const exactText = `북쪽 탑에서 종이 울렸다 ${randomUUID()}`;
  const manuscriptPrefix = `앞 문장 ${randomUUID()}\n`;
  const manuscriptSuffix = `\n뒤 문장 ${randomUUID()}`;
  const manuscriptText = `${manuscriptPrefix}${exactText}${manuscriptSuffix}`;
  const approvedTitle = `승인 별빛-${suffix}`;
  const rejectedTitle = `거절 별빛-${suffix}`;
  const staleTitle = `변경 별빛-${suffix}`;
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

  const selectExactTextFromEnd = async (manuscript: Locator) => {
    await manuscript.press("Control+End");
    for (let index = 0; index < manuscriptSuffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);
  };

  const createCandidate = async (
    page: Page,
    title: string,
  ) => {
    const dialog = await openLoreCandidateInbox(page);
    await dialog.getByLabel("후보 별빛 이름").fill(title);
    await dialog.getByLabel("후보 별빛 분류").fill("장소");
    await dialog.getByLabel("후보 별빛 내용").fill(`${title}의 확정 제안`);
    await dialog.getByLabel("별빛 후보 이유").fill("현재 선택에서 직접 기록");
    await dialog
      .getByRole("button", { name: "현재 선택을 후보로 담기", exact: true })
      .click();
    const card = dialog.locator(".lore-candidate-list li").filter({ hasText: title });
    await expect(card).toContainText(exactText);
    return { dialog, card };
  };

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

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactTextFromEnd(manuscript);

    let { dialog, card } = await createCandidate(page, approvedTitle);
    await openStructureTab(page, "개요");
    let structureDialog = page.getByRole("region", { name: "작품 구조" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("0");
    dialog = await openLoreCandidateInbox(page);
    card = dialog.locator(".lore-candidate-list li").filter({
      hasText: approvedTitle,
    });
    await card.getByRole("button", { name: "원문 열기", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);

    dialog = await openLoreCandidateInbox(page);
    card = dialog.locator(".lore-candidate-list li").filter({
      hasText: approvedTitle,
    });
    await card.getByRole("button", { name: "승인", exact: true }).click();
    await expect(card).toContainText("승인됨");
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("1");
    await openWorkSection(page, "쓰기");
    await selectExactTextFromEnd(manuscript);
    ({ dialog, card } = await createCandidate(page, rejectedTitle));
    await card.getByRole("button", { name: "거절", exact: true }).click();
    await expect(card).toContainText("거절됨");
    await openWorkSection(page, "쓰기");
    await selectExactTextFromEnd(manuscript);
    ({ dialog } = await createCandidate(page, staleTitle));
    await openWorkSection(page, "쓰기");
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(`\n변경 ${randomUUID()}`);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    dialog = await openLoreCandidateInbox(page);
    const staleCard = dialog.locator(".lore-candidate-list li").filter({
      hasText: staleTitle,
    });
    await expect(staleCard).toContainText("원문이 변경됨");
    await expect(
      staleCard.getByRole("button", { name: "승인", exact: true }),
    ).toBeDisabled();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    dialog = await openLoreCandidateInbox(page);
    await expect(
      dialog.locator(".lore-candidate-list li").filter({ hasText: approvedTitle }),
    ).toContainText("승인됨");
    await expect(
      dialog.locator(".lore-candidate-list li").filter({ hasText: rejectedTitle }),
    ).toContainText("거절됨");
    await expect(
      dialog.locator(".lore-candidate-list li").filter({ hasText: staleTitle }),
    ).toContainText("원문이 변경됨");
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("1");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens lore Candidate evidence across episodes with its exact selection", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-candidate-cross-episode-evidence-"),
  );
  const workTitle = randomUUID();
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const candidateTitle = `후보-${randomUUID()}`;
  const candidateCategory = `분류-${randomUUID()}`;
  const candidateContent = `내용-${randomUUID()}`;
  const candidateReason = `이유-${randomUUID()}`;
  const prefix = `${randomUUID()} 앞 `;
  const exactEvidence = `  ${randomUUID()} 교차 회차 별빛 후보 근거  `;
  const suffix = ` 뒤 ${randomUUID()}`;
  const episodeAManuscript = `${prefix}${exactEvidence}${suffix}`;
  const episodeBManuscript = `${randomUUID()} 다른 회차 원고 ${randomUUID()}`;
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
    for (let index = 0; index < exactEvidence.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactEvidence);

    let dialog = await openLoreCandidateInbox(page);
    await dialog.getByLabel("후보 별빛 이름").fill(candidateTitle);
    await dialog.getByLabel("후보 별빛 분류").fill(candidateCategory);
    await dialog.getByLabel("후보 별빛 내용").fill(candidateContent);
    await dialog.getByLabel("별빛 후보 이유").fill(candidateReason);
    const createCandidateButton = dialog.getByRole("button", {
      name: "현재 선택을 후보로 담기",
      exact: true,
    });
    await expect(createCandidateButton).toBeEnabled();
    await createCandidateButton.click();
    let card = dialog.locator(".lore-candidate-list li").filter({
      hasText: candidateTitle,
    });
    await expect(card).toContainText(exactEvidence);

    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, episodeAManuscript);
    await activateDocumentFromTree(page, episodeBTitle);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);

    dialog = await openLoreCandidateInbox(page);
    card = dialog.locator(".lore-candidate-list li").filter({
      hasText: candidateTitle,
    });
    await card.getByRole("button", { name: "원문 열기", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactEvidence);
    await expectEditorText(manuscript, episodeAManuscript);

    await activateDocumentFromTree(page, episodeBTitle);
    await expectEditorText(manuscript, episodeBManuscript);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shows only confirmed lore cues with exact pinned inspection across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-cues-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `별빛 신호 작품-${suffix}`;
  const documentTitle = `별빛 신호 회차-${suffix}`;
  const loreTitle = `북쪽 탑-${suffix}`;
  const loreAlias = `북탑-${suffix}`;
  const candidateTitle = `후보 탑-${suffix}`;
  const loreContent = `밤마다 종이 세 번 울린다 ${suffix}`;
  const manuscriptText = `${loreTitle}에는 종이 울렸다.\n${loreAlias}은 고요했다.\n${candidateTitle}은 아직 검토 중이다.`;
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

  const selectExactText = async (
    manuscript: Locator,
    exactText: string,
  ) => {
    const from = manuscriptText.indexOf(exactText);
    expect(from).toBeGreaterThanOrEqual(0);
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < from; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);
  };

  const cueButtons = (page: Page) =>
    page.locator(".cm-lore-cue-gutter").getByRole("button", {
      name: /별빛 \d+개 보기/u,
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
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactText(manuscript, loreTitle);

    await openStructureTab(page, "별빛");
    const loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog.getByLabel("별빛 이름").fill(loreTitle);
    await loreDialog.getByLabel("별빛 사용자 분류").fill("장소");
    await loreDialog.getByLabel("별빛 별칭").fill(loreAlias);
    await loreDialog.getByLabel("별빛 확정 내용").fill(loreContent);
    await loreDialog
      .getByRole("button", { name: "별빛 만들기", exact: true })
      .click();
    await expect(loreDialog.locator(".lore-history-panel")).toContainText("생성");
    await openWorkSection(page, "쓰기");
    await expect(cueButtons(page)).toHaveCount(2);
    await selectExactText(manuscript, candidateTitle);
    const candidateDialog = await openLoreCandidateInbox(page);
    await candidateDialog.getByLabel("후보 별빛 이름").fill(candidateTitle);
    await candidateDialog.getByLabel("후보 별빛 분류").fill("장소");
    await candidateDialog.getByLabel("후보 별빛 내용").fill("승인 전 후보 내용");
    await candidateDialog
      .getByRole("button", { name: "현재 선택을 후보로 담기", exact: true })
      .click();
    await openWorkSection(page, "쓰기");
    await expect(cueButtons(page)).toHaveCount(2);
    await selectExactText(manuscript, candidateTitle);
    const firstCue = cueButtons(page).first();
    await firstCue.hover();
    const tooltip = page.getByRole("tooltip", { name: "별빛 미리보기" });
    await expect(tooltip).toContainText(loreTitle);
    await expect(tooltip).not.toContainText(candidateTitle);
    await firstCue.click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(candidateTitle);

    let inspector = page.getByRole("region", { name: "별빛 검사기" });
    await expect(inspector).toContainText(loreTitle);
    await expect(inspector).toContainText(loreAlias);
    await expect(inspector).toContainText(loreContent);
    await expect(inspector).not.toContainText(candidateTitle);
    await inspector.getByRole("button", { name: /원고에서 보기/u }).first().click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(loreTitle);

    await page.keyboard.insertText("임시 변경");
    await expect(cueButtons(page)).toHaveCount(1);
    await manuscript.press("Control+z");
    await expectEditorText(manuscript, manuscriptText);
    await expect(cueButtons(page)).toHaveCount(2);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    await expect(cueButtons(page)).toHaveCount(2);
    await cueButtons(page).first().hover();
    await expect(page.getByRole("tooltip", { name: "별빛 미리보기" }))
      .toContainText(loreTitle);
    await cueButtons(page).first().click();
    inspector = page.getByRole("region", { name: "별빛 검사기" });
    await expect(inspector).toContainText(loreTitle);
    await expect(inspector).not.toContainText(candidateTitle);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("links and approves a metadata-only publishing mail candidate across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-mail-candidate-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `메일작-${suffix}`;
  const partnerName = `메일투고처-${suffix}`;
  const submissionTitle = `메일투고-${suffix}`;
  const subject = `회신-${suffix}`;
  const messageId = randomUUID();
  const sourceAccountId = randomUUID();
  const candidateId = randomUUID();
  const sourceId = randomUUID();
  const receivedAt = "2026-08-18T02:30:00.000Z";
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고 기록", exact: true }).click();
    await dialog.getByLabel("투고 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("투고처").selectOption({ label: partnerName });
    await dialog.getByLabel("투고 기록 제목").fill(submissionTitle);
    await dialog.getByLabel("투고 상태").fill("접수");
    await dialog.getByLabel("투고일").fill("2026-08-10");
    await dialog
      .getByRole("button", { name: "현재 원고 버전으로 기록 추가", exact: true })
      .click();
    const packageRegion = dialog.getByRole("region", { name: "제출 당시 원고 봉인본" });
    const sealedManifest = await packageRegion.locator("small").textContent();
    expect(sealedManifest).toBeTruthy();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();
    await electronApp.close();

    const database = new DatabaseSync(
      path.join(directory, "workspace", "workspace.sqlite3"),
    );
    try {
      database.exec("PRAGMA foreign_keys = ON");
      const createdAt = "2026-08-18T02:31:00.000Z";
      database.exec("BEGIN IMMEDIATE");
      database.prepare(`
        INSERT INTO publishing_sources (
          id, schema_version, revision, created_at, updated_at, retired_at,
          source_kind, label, url, observed_at, authority, imported_fields_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceId,
        1,
        1,
        createdAt,
        createdAt,
        null,
        "message/metadata",
        messageId,
        null,
        receivedAt,
        sourceAccountId,
        JSON.stringify({
          sourceAccountId,
          messageId,
          threadId: `thread-${suffix}`,
          from: "editor@publisher.example",
          subject,
          receivedAt,
          snippet: "수정 방향을 확인해 주세요.",
          bodyFingerprint: `fingerprint-${suffix}`,
        }),
      );
      database.prepare(`
        INSERT INTO publishing_mail_candidates (
          id, schema_version, revision, created_at, updated_at, retired_at,
          source_id, source_account_id, message_id, thread_id, sender, subject,
          received_at, snippet, body_fingerprint, submission_id, match_reason,
          proposed_status, proposed_result, proposed_responded_on, proposed_note,
          classification_connection_id, classification_model, review_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        candidateId,
        1,
        1,
        createdAt,
        createdAt,
        null,
        sourceId,
        sourceAccountId,
        messageId,
        `thread-${suffix}`,
        "editor@publisher.example",
        subject,
        receivedAt,
        "수정 방향을 확인해 주세요.",
        `fingerprint-${suffix}`,
        null,
        "사용자 검토 대기",
        "회신 완료",
        "수정 요청",
        "2026-08-18",
        "첫 회신 요약",
        null,
        "",
        "needs-link",
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    } finally {
      database.close();
    }

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    let candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard).toContainText("수정 방향을 확인해 주세요.");
    await expect(candidateCard).toContainText("투고 연결 필요");
    await candidateCard.getByLabel("메일 후보 투고 연결").selectOption({
      label: `${workTitle} · ${partnerName} · ${submissionTitle}`,
    });
    await candidateCard.getByRole("button", { name: "투고 연결", exact: true }).click();
    candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard).toContainText("승인 대기");
    await candidateCard.getByLabel("메일 제안 상태").fill("회신 확인");
    await candidateCard.getByLabel("메일 제안 결과").fill("수정 후 재검토");
    await candidateCard.getByLabel("메일 제안 회신일").fill("2026-08-19");
    await candidateCard.getByLabel("메일 제안 메모").fill("사용자가 확인한 회신 요약");
    await candidateCard.getByRole("button", { name: "제안 저장", exact: true }).click();
    candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard.getByLabel("메일 제안 메모"))
      .toHaveValue("사용자가 확인한 회신 요약");
    await candidateCard.getByRole("button", { name: "승인 반영", exact: true }).click();
    candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard).toContainText("반영 완료");

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 확인");
    await expect(dialog.getByLabel("회신일")).toHaveValue("2026-08-19");
    await expect(dialog.getByLabel("투고 결과")).toHaveValue("수정 후 재검토");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("사용자가 확인한 회신 요약");
    await expect(dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"))
      .toHaveText(sealedManifest ?? "");
    await expect(dialog.getByLabel(`${messageId} 근거 연결`)).toBeChecked();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    await expect(dialog.getByRole("article", { name: `${subject} 메일 후보` }))
      .toContainText("반영 완료");
    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 확인");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("사용자가 확인한 회신 요약");
    await expect(dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"))
      .toHaveText(sealedManifest ?? "");
    await expect(dialog.getByLabel(`${messageId} 근거 연결`)).toBeChecked();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("connects mail, runs the persisted app-open schedule, manually syncs, and restores state", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-mail-sync-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "mail-connection");
  const profilePath = path.join(directory, "mail-connectors.json");
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `메일동기화-${suffix}`;
  const partnerName = `회신처-${suffix}`;
  const partnerEmail = `editor-${suffix}@example.test`;
  const accountEmail = `writer-${suffix}@example.test`;
  const clientId = `desktop-client-${suffix}`;
  const accessToken = `access-${randomUUID()}`;
  const refreshToken = `refresh-${randomUUID()}`;
  const subject = `수동 회신-${suffix}`;
  const snippet = `확인할 회신 ${suffix}`;
  const body = `원장에 저장되면 안 되는 본문 ${randomUUID()}`;
  const messageId = `message-${suffix}`;
  const receivedRequests: string[] = [];
  let baseUrl = "";
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", baseUrl);
    receivedRequests.push(`${request.method ?? "GET"} ${requestUrl.pathname}${requestUrl.search}`);
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (requestUrl.pathname === "/authorize") {
        const redirectUri = requestUrl.searchParams.get("redirect_uri");
        const state = requestUrl.searchParams.get("state");
        if (redirectUri === null || state === null) {
          response.writeHead(400).end();
          return;
        }
        const callback = new URL(redirectUri);
        callback.searchParams.set("code", `code-${suffix}`);
        callback.searchParams.set("state", state);
        response.writeHead(302, { Location: callback.toString() });
        response.end();
        return;
      }
      if (requestUrl.pathname === "/token") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          scope: "mail.readonly",
        }));
        return;
      }
      if (requestUrl.pathname === "/mail/profile") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ emailAddress: accountEmail }));
        return;
      }
      if (requestUrl.pathname === "/mail/messages") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ messages: [{ id: messageId }] }));
        return;
      }
      if (requestUrl.pathname === `/mail/messages/${messageId}`) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          id: messageId,
          threadId: `thread-${suffix}`,
          internalDate: String(Date.parse("2026-08-10T10:30:00.000Z")),
          snippet,
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: partnerEmail },
              { name: "Subject", value: subject },
            ],
            body: { data: Buffer.from(body, "utf8").toString("base64url") },
          },
        }));
        return;
      }
      if (requestUrl.pathname === "/revoke") {
        response.writeHead(200).end();
        return;
      }
      response.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a local mail connector TCP address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  await writeFile(profilePath, JSON.stringify({
    schemaVersion: 1,
    connectors: [{
      connectorKind: "google-mail-oauth-v1",
      displayName: "테스트 메일 (읽기 전용)",
      authorizationEndpoint: `${baseUrl}/authorize`,
      tokenEndpoint: `${baseUrl}/token`,
      revocationEndpoint: `${baseUrl}/revoke`,
      apiBaseUrl: `${baseUrl}/mail`,
      scope: "mail.readonly",
    }],
  }), "utf8");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH: connectionRoot,
    EUM_STUDIO_PUBLISHING_MAIL_CONNECTOR_PROFILE_PATH: profilePath,
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
  const routeAuthorizationInsideElectron = async () => {
    await electronApp.evaluate(({ shell: electronShell }) => {
      const mutableShell = electronShell as typeof electronShell & {
        openExternal: (url: string) => Promise<void>;
      };
      mutableShell.openExternal = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Authorization route failed: ${response.status}`);
      };
    });
  };

  try {
    await routeAuthorizationInsideElectron();
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("이메일").fill(partnerEmail);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    await expect(dialog.getByLabel("메일 서비스")).toHaveValue("google-mail-oauth-v1");
    await dialog.getByLabel("메일 OAuth client ID").fill(clientId);
    await dialog.getByRole("button", { name: "메일 계정 연결", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "메일 계정 연결" }))
      .toContainText(accountEmail);
    const scheduleRegion = dialog.getByRole("region", { name: "메일 자동 확인 일정" });
    await scheduleRegion.getByLabel("자동 확인 시각").fill("00:00");
    await scheduleRegion.getByLabel("앱 실행 중 자동 확인").click();
    await expect(scheduleRegion.getByLabel("앱 실행 중 자동 확인")).toBeChecked();
    await expect(scheduleRegion).toContainText("마지막 확인 결과");
    await expect(scheduleRegion).toContainText("성공");
    const candidate = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidate).toContainText(snippet);
    await expect(candidate).toContainText("투고 연결 필요");
    await dialog.getByRole("button", { name: "지금 동기화", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("1건 확인 · 새 후보 0건");
    expect(receivedRequests.some((request) =>
      request.includes("/mail/messages?") &&
      decodeURIComponent(request).includes(`from:${partnerEmail}`)
    )).toBe(true);
    const storedConnection = await readFile(path.join(connectionRoot, "connection.json"), "utf8");
    expect(storedConnection).not.toContain(accessToken);
    expect(storedConnection).not.toContain(refreshToken);
    expect(storedConnection).toContain(accountEmail);
    const storedSchedule = await readFile(path.join(connectionRoot, "schedule.json"), "utf8");
    expect(storedSchedule).toContain('"enabled":true');
    expect(storedSchedule).toContain('"localTime":"00:00"');
    expect(storedSchedule).toContain('"lastAttemptStatus":"succeeded"');
    const databaseBytes = await readFile(path.join(workspaceRoot, "workspace.sqlite3"));
    expect(databaseBytes.includes(Buffer.from(body, "utf8"))).toBe(false);
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "메일 계정 연결" }))
      .toContainText(accountEmail);
    const restoredScheduleRegion = dialog.getByRole("region", { name: "메일 자동 확인 일정" });
    await expect(restoredScheduleRegion.getByLabel("앱 실행 중 자동 확인")).toBeChecked();
    await expect(restoredScheduleRegion.getByLabel("자동 확인 시각")).toHaveValue("00:00");
    await expect(restoredScheduleRegion).toContainText("성공");
    await expect(dialog.getByRole("article", { name: `${subject} 메일 후보` }))
      .toContainText(snippet);
    await dialog.getByRole("button", { name: "연결 해제", exact: true }).click();
    await expect(dialog.getByLabel("메일 OAuth client ID")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "메일 계정 연결", exact: true }))
      .toBeDisabled();
    expect(await readFile(path.join(connectionRoot, "schedule.json"), "utf8"))
      .toContain('"enabled":true');
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

