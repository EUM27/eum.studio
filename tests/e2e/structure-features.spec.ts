import {
  randomUUID,
  mkdir,
  mkdtemp,
  writeFile,
  tmpdir,
  createServer,
  path,
  expect,
  test,
  electron,
  openStudioWorkspace,
  installFakeYouTubePlayer,
  openStudioHome,
  openReviewRail,
  openWorkSection,
  openStructureTab,
  openReviewTab,
  openSchedule,
  openWorkDocumentFromHome,
  activateDocumentFromTree,
  createNamedEpisode,
  readActiveDocumentId,
  expectEditorText,
  removeVerifiedTemporaryDirectory,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";
test("manages work-owned foreshadow lines across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-foreshadow-lines-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const initialLineTitle = `약속-${randomUUID().slice(0, 8)}`;
  const updatedLineTitle = `회귀-${randomUUID().slice(0, 8)}`;
  const initialNote = `첫 단서 ${randomUUID()}`;
  const updatedNote = `두 번째 단서 ${randomUUID()}`;
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

    await openStructureTab(page, "복선");
    let dialog = page.getByRole("region", { name: "복선 라인" });
    await dialog.getByLabel("새 복선 이름").fill(initialLineTitle);
    await dialog.getByLabel("작가 메모").first().fill(initialNote);
    await dialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await expect(
      dialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(initialLineTitle);
    await expect(
      dialog.getByLabel("복선 작가 메모", { exact: true }),
    ).toHaveValue(initialNote);

    const lineTitleInput = dialog.getByLabel("복선 이름", { exact: true });
    await lineTitleInput.fill(updatedLineTitle);
    await lineTitleInput.press("Tab");
    await expect(lineTitleInput).toBeEnabled();
    const lineNoteInput = dialog.getByLabel("복선 작가 메모", {
      exact: true,
    });
    await lineNoteInput.fill(updatedNote);
    await lineNoteInput.press("Tab");
    await expect(lineNoteInput).toBeEnabled();
    await openWorkSection(page, "쓰기");

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
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(dialog).toContainText(
      "이 작품에 만든 복선 라인이 없습니다.",
    );

    await openStudioHome(page);
    await openWorkDocumentFromHome(page, firstWorkTitle, firstDocumentTitle);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(
      dialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(updatedLineTitle);
    await expect(
      dialog.getByLabel("복선 작가 메모", { exact: true }),
    ).toHaveValue(updatedNote);
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(
      dialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(updatedLineTitle);
    await expect(
      dialog.getByLabel("복선 작가 메모", { exact: true }),
    ).toHaveValue(updatedNote);

    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog
      .getByRole("button", { name: "라인 치우기", exact: true })
      .click();
    await expect(dialog).toContainText(
      "이 작품에 만든 복선 라인이 없습니다.",
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(dialog).toContainText(
      "이 작품에 만든 복선 라인이 없습니다.",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages Work-owned characters across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-characters-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const initialName = `윤서-${randomUUID().slice(0, 8)}`;
  const updatedName = `윤서-${randomUUID().slice(0, 8)}`;
  const initialRole = `기록자 ${randomUUID().slice(0, 8)}`;
  const updatedRole = `증언자 ${randomUUID().slice(0, 8)}`;
  const initialSummary = `첫 요약 ${randomUUID()}`;
  const updatedSummary = `수정 요약 ${randomUUID()}`;
  const initialNote = `첫 메모 ${randomUUID()}`;
  const updatedNote = `수정 메모 ${randomUUID()}`;
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

    await openStructureTab(page, "인물");
    let dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");
    await dialog.getByLabel("인물 이름", { exact: true }).fill(initialName);
    await dialog.getByLabel("인물 역할").fill(initialRole);
    await dialog.getByLabel("인물 요약").fill(initialSummary);
    await dialog.getByLabel("인물 작가 메모").fill(initialNote);
    await dialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(initialName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(initialRole);

    await dialog.getByLabel("인물 이름", { exact: true }).fill(updatedName);
    await dialog.getByLabel("인물 역할").fill(updatedRole);
    await dialog.getByLabel("인물 요약").fill(updatedSummary);
    await dialog.getByLabel("인물 작가 메모").fill(updatedNote);
    await dialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(updatedName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(updatedRole);
    await expect(dialog.getByLabel("인물 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("인물 작가 메모")).toHaveValue(updatedNote);
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
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");

    await openStudioHome(page);
    await openWorkDocumentFromHome(
      page,
      firstWorkTitle,
      firstDocumentTitle,
    );
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(updatedName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(updatedRole);
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(updatedName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(updatedRole);
    await expect(dialog.getByLabel("인물 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("인물 작가 메모")).toHaveValue(updatedNote);

    await dialog
      .getByRole("button", { name: "인물 치우기", exact: true })
      .click();
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens character evidence across episodes with its exact selection", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-character-cross-episode-evidence-"),
  );
  const workTitle = randomUUID();
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const characterName = `인물-${randomUUID()}`;
  const characterRole = `역할-${randomUUID()}`;
  const prefix = `${randomUUID()} 앞 `;
  const exactEvidence = `  ${randomUUID()} 교차 회차 인물 근거  `;
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

    await openStructureTab(page, "인물");
    let workspace = page.getByRole("region", { name: "인물 작업면" });
    await workspace.getByLabel("인물 이름", { exact: true }).fill(characterName);
    await workspace.getByLabel("인물 역할", { exact: true }).fill(characterRole);
    await workspace
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    const addEvidenceButton = workspace.getByRole("button", {
      name: "현재 선택 연결",
      exact: true,
    });
    await expect(addEvidenceButton).toBeEnabled();
    await addEvidenceButton.click();
    let evidenceSection = workspace.locator(".character-workspace-evidence");
    await expect(evidenceSection.locator("ul li")).toHaveCount(1);

    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, episodeAManuscript);
    await activateDocumentFromTree(page, episodeBTitle);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);

    await openStructureTab(page, "인물");
    workspace = page.getByRole("region", { name: "인물 작업면" });
    await expect(workspace.getByLabel("인물 이름", { exact: true }))
      .toHaveValue(characterName);
    evidenceSection = workspace.locator(".character-workspace-evidence");
    await evidenceSection
      .locator("ul li")
      .first()
      .getByRole("button")
      .click();
    await expect(workspace).toBeHidden();
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

test("uses local inspiration draws and keeps GPT scene work separate", async () => {
  test.setTimeout(240_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-character-oauth-extraction-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `캐릭터 추출 ${suffix}`;
  const documentTitle = `1화 ${suffix}`;
  const characterName = `윤서-${suffix}`;
  const characterAlias = `서린-${suffix}`;
  const generatedCharacterName = `도윤-${suffix}`;
  const generatedRole = `탐정-${suffix}`;
  const generatedPersonality = `집요함-${suffix}`;
  const generatedRelationship = `기록자와 협력-${suffix}`;
  const relatedCharacterName = `재헌-${suffix}`;
  const relationKind = `오래된 동료-${suffix}`;
  const relationDescription = `서로의 판단을 신뢰한다-${suffix}`;
  const generalMusicQuery = `집중 피아노 ${suffix}`;
  const sceneMusicQuery = `바깥 경보 긴장 ${suffix}`;
  const chatPrompt = `이 대화가 연결됐는지 답해줘 ${suffix}`;
  const chatResponse = `GPT 대화 응답 ${suffix}`;
  const vocabularyQuestion = `엄정하다와 비슷한 말 ${suffix}`;
  const vocabularySuggestion = `근엄하다-${suffix}`;
  const sceneDraftPlotTitle = `잠긴 문 플롯 ${suffix}`;
  const sceneDraftDocumentTitle = `장면 초안 회차 ${suffix}`;
  const generatedSceneDraft = `초안 문장 ${suffix}`;
  const editedSceneDraft = `\n수정한 장면 초안 ${suffix}\n`;
  const manuscriptText = [
    `${characterName}는 문 앞에서 상황을 기록했다.`,
    "문이 닫히고 방 안이 조용해졌다.",
    "밖에서 경보가 울리기 시작했다.",
  ].join("\n");
  const receivedRequests: Array<{
    readonly headers: Record<string, string | string[] | undefined>;
    readonly body: Record<string, unknown>;
  }> = [];
  const youtubeSearches: string[] = [];
  const upstream = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      request.method === "GET" &&
      requestUrl.pathname === "/youtube/v3/search"
    ) {
      youtubeSearches.push(requestUrl.searchParams.get("q") ?? "");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        items: Array.from({ length: 6 }, (_value, index) => ({
          id: { videoId: `queue-video-${index + 1}` },
          snippet: {
            title: `장면 큐 ${index + 1}`,
            channelTitle: "장면 작곡가",
            thumbnails: {
              medium: {
                url: `https://i.ytimg.com/vi/queue-video-${index + 1}/mqdefault.jpg`,
              },
            },
          },
        })),
      }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
      string,
      unknown
    >;
    receivedRequests.push({ headers: request.headers, body });
    const formatName = (
      body.text as { readonly format?: { readonly name?: unknown } } | undefined
    )?.format?.name;
    const output = formatName === undefined
      ? chatResponse
      : formatName === "eum_assistant_vocabulary_suggestions"
        ? JSON.stringify({
            suggestions: [{
              word: vocabularySuggestion,
              nuance: "무게감이 더 강함",
              example: "근엄한 표정으로 말했다.",
            }],
            note: "현재 질문에 대한 후보",
          })
      : JSON.stringify(formatName === "eum_scene_extraction"
        ? {
            scenes: [
              {
                title: "닫힌 방",
                fromParagraphId: "p1",
                toParagraphId: "p2",
                summary: "기록 뒤 문이 닫힌다.",
                povCharacter: characterName,
                location: "방",
                time: "",
                characters: [characterName],
                goal: "",
                conflict: "문이 닫힌다.",
                outcome: "",
              },
              {
                title: "바깥 경보",
                fromParagraphId: "p3",
                toParagraphId: "p3",
                summary: "밖에서 경보가 울린다.",
                povCharacter: "",
                location: "밖",
                time: "",
                characters: [],
                goal: "",
                conflict: "",
                outcome: "",
              },
            ],
          }
        : formatName === "eum_scene_draft"
          ? { draftText: generatedSceneDraft }
        : formatName === "eum_character_generation"
          ? {
              characters: [{
                name: generatedCharacterName,
                aliases: [],
                role: generatedRole,
                summary: "사건을 추적한다.",
                appearance: "",
                personality: generatedPersonality,
                speech: "",
                goal: "진상 규명",
                conflict: "",
                note: generatedRelationship,
              }],
            }
          : {
            characters: [{
              name: characterName,
              aliases: [characterAlias],
              role: "기록자",
              summary: "상황을 기록한다.",
              appearance: "",
              personality: "",
              speech: "",
              goal: "",
              conflict: "",
              note: "",
              evidences: [{ paragraphId: "p1", quote: characterName }],
            }],
            });
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end([
      "event: response.output_text.delta",
      `data: ${JSON.stringify({ delta: output })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"));
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", () => resolve());
  });
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a loopback character extraction server");
  }
  const oauthProfile = {
    schemaVersion: 1,
    providerId: "test-chatgpt-oauth",
    displayName: "GPT",
    issuer: "https://auth.openai.com",
    clientId: "test-client",
    authorizationPath: "/oauth/authorize",
    tokenPath: "/oauth/token",
    scopes: ["openid", "offline_access"],
    authorizeParameters: { originator: "test-originator" },
    callback: {
      listenHost: "127.0.0.1",
      redirectHost: "localhost",
      path: "/auth/callback",
      portRange: { start: 1455, end: 1475 },
    },
    upstream: {
      baseUrl: `http://127.0.0.1:${address.port}`,
      originator: "test-originator",
      clientVersion: "test-version",
      model: "test-model",
    },
  } as const;
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
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_CHATGPT_OAUTH_PROFILE: JSON.stringify(oauthProfile),
    EUM_STUDIO_YOUTUBE_MUSIC_PROFILE: JSON.stringify(youtubeProfile),
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
    const accountId = `account-${suffix}`;
    const jwt = (payload: Record<string, unknown>) =>
      `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
    const tokens = {
      accessToken: jwt({ exp: 4_000_000_000 }),
      refreshToken: `refresh-${suffix}`,
      idToken: jwt({
        email: `writer-${suffix}@example.test`,
        "https://api.openai.com/auth": {
          chatgpt_account_id: accountId,
          chatgpt_plan_type: "test",
        },
      }),
      accountId,
      email: `writer-${suffix}@example.test`,
      planType: "test",
    };
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData")
    );
    const encryptedBytes = await electronApp.evaluate(
      ({ safeStorage }, serializedTokens) =>
        Array.from(safeStorage.encryptString(serializedTokens)),
      JSON.stringify(tokens),
    );
    const youtubeEncryptedBytes = await electronApp.evaluate(
      ({ safeStorage }, apiKey) =>
        Array.from(safeStorage.encryptString(apiKey)),
      `youtube-key-${suffix}`,
    );
    await electronApp.close();
    const oauthRoot = path.join(userDataPath, "chatgpt-oauth-v1");
    await mkdir(oauthRoot, { recursive: true });
    await writeFile(
      path.join(oauthRoot, "connection.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        encryptedCredential: Buffer.from(encryptedBytes).toString("base64"),
        updatedAt: "2026-08-17T00:00:00.000Z",
      })}\n`,
      "utf8",
    );
    const youtubeRoot = path.join(userDataPath, "youtube-music-connection-v1");
    await mkdir(youtubeRoot, { recursive: true });
    await writeFile(
      path.join(youtubeRoot, "connection.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        encryptedApiKey: Buffer.from(youtubeEncryptedBytes).toString("base64"),
        updatedAt: "2026-08-17T00:00:00.000Z",
      })}\n`,
      "utf8",
    );

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await installFakeYouTubePlayer(page);
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    const settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog).toContainText("YouTube 음악 연결");
    await expect(settingsDialog).toContainText("API 키가 암호화 저장되어 있습니다.");
    await expect(settingsDialog).not.toContainText("Spotify");
    await settingsDialog.getByRole("button", {
      name: "앱 설정 닫기",
      exact: true,
    }).click();
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
    const musicPlayer = page.getByRole("region", { name: "음악 플레이어" });
    await expect(musicPlayer).toContainText("재생할 곡을 선택하세요");
    await expect(musicPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    })).toBeVisible();
    await expect(musicPlayer.getByRole("button", {
      name: "음악 설정 열기",
      exact: true,
    })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "조수", exact: true }))
      .toHaveCount(0);
    await expect(page.getByRole("button", { name: "음악", exact: true }))
      .toHaveCount(0);
    await openReviewRail(page);
    await page.getByRole("tab", { name: "조수", exact: true }).click();
    await expect(page.getByRole("button", {
      name: "어휘·표기·설정 도구",
      exact: true,
    })).toBeVisible();
    await page.getByRole("button", { name: "검토 레일 닫기", exact: true }).click();
    await musicPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const musicLibrary = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await musicLibrary.getByRole("tab", {
      name: "YouTube 검색 탭",
      exact: true,
    }).click();
    await musicLibrary.getByLabel("음악 검색어", { exact: true })
      .fill(generalMusicQuery);
    await musicLibrary.getByRole("button", { name: "검색", exact: true })
      .click();
    await expect.poll(() => youtubeSearches.length).toBe(1);
    expect(youtubeSearches[0]).toContain(generalMusicQuery);
    const generalMusicResults = musicLibrary.getByRole("region", {
      name: "검색 결과",
      exact: true,
    });
    const generalMusicResult = generalMusicResults.getByRole("listitem")
      .filter({ hasText: "장면 큐 1" }).first();
    await expect(generalMusicResult).toBeVisible();
    await generalMusicResult.getByRole("button", {
      name: "장면 큐 1 재생목록에 추가",
      exact: true,
    }).click();
    const secondMusicResult = generalMusicResults.getByRole("listitem")
      .filter({ hasText: "장면 큐 2" }).first();
    await secondMusicResult.getByRole("button", {
      name: "장면 큐 2 재생목록에 추가",
      exact: true,
    }).click();
    await musicLibrary.getByRole("tab", {
      name: "재생목록 탭",
      exact: true,
    }).click();
    await expect(musicLibrary.getByRole("region", {
      name: "재생목록",
      exact: true,
    })).toContainText("장면 큐 1");
    await musicLibrary.getByRole("tab", {
      name: "YouTube 검색 탭",
      exact: true,
    }).click();
    await generalMusicResult.getByRole("button", {
      name: "장면 큐 1 선호 영상 저장",
      exact: true,
    }).click();
    await expect(generalMusicResult.getByRole("button", {
      name: "장면 큐 1 선호 영상 해제",
      exact: true,
    })).toBeVisible();
    await generalMusicResult.getByRole("button", {
      name: "장면 큐 1 바로 재생",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual(["load:queue-video-1"]);
    await musicLibrary.getByLabel("음악 검색어", { exact: true })
      .fill(`${generalMusicQuery} 갱신`);
    await musicLibrary.getByRole("button", { name: "검색", exact: true })
      .click();
    await expect.poll(() => youtubeSearches.length).toBe(2);
    const thirdMusicResult = generalMusicResults.getByRole("listitem")
      .filter({ hasText: "장면 큐 3" }).first();
    await thirdMusicResult.getByRole("button", {
      name: "장면 큐 3 재생목록에 추가",
      exact: true,
    }).click();
    for (const index of [4, 5, 6]) {
      const result = generalMusicResults.getByRole("listitem")
        .filter({ hasText: `장면 큐 ${index}` }).first();
      await result.getByRole("button", {
        name: `장면 큐 ${index} 재생목록에 추가`,
        exact: true,
      }).click();
    }
    await musicLibrary.getByRole("tab", {
      name: "재생목록 탭",
      exact: true,
    }).click();
    const curatedQueue = musicLibrary.getByRole("region", {
      name: "재생목록",
      exact: true,
    });
    await expect(curatedQueue.getByRole("listitem")).toHaveCount(6);
    await expect(curatedQueue).toContainText("장면 큐 1");
    await expect(curatedQueue).toContainText("장면 큐 2");
    await expect(curatedQueue).toContainText("장면 큐 3");
    const queueTwo = curatedQueue.getByRole("listitem")
      .filter({ hasText: "장면 큐 2" });
    await queueTwo.getByRole("button", {
      name: "장면 큐 2 위로 이동",
      exact: true,
    }).click();
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return [];
      const settings = await window.eumStudio.settings.getWorkMusic({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return settings.settings.playlistTracks.slice(0, 2).map((track) =>
        "videoId" in track ? track.videoId : null
      );
    })).toEqual(["queue-video-2", "queue-video-1"]);
    const moveQueueTwoDown = queueTwo.getByRole("button", {
      name: "장면 큐 2 아래로 이동",
      exact: true,
    });
    await expect(moveQueueTwoDown).toBeEnabled();
    await moveQueueTwoDown.click();
    await expect.poll(() => curatedQueue.locator(
      ".music-library-scroll-list",
    ).evaluate((list) => ({
      clientHeight: list.clientHeight,
      overflowY: getComputedStyle(list).overflowY,
      scrollHeight: list.scrollHeight,
    }))).toMatchObject({ overflowY: "auto" });
    const compactLibraryBounds = await musicLibrary.boundingBox();
    if (compactLibraryBounds === null) {
      throw new Error("Expected compact music library bounds");
    }
    expect(compactLibraryBounds.width).toBeLessThanOrEqual(422);
    expect(compactLibraryBounds.height).toBeLessThanOrEqual(562);
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return [];
      const settings = await window.eumStudio.settings.getWorkMusic({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return settings.settings.playlistTracks.map((track) =>
        "videoId" in track ? track.videoId : null
      );
    })).toEqual(Array.from({ length: 6 }, (_value, index) =>
      `queue-video-${index + 1}`
    ));
    await musicLibrary.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();
    await page.setViewportSize({ width: 960, height: 900 });
    const topbarBounds = await page.locator(".app-topbar").boundingBox();
    const playlistEntryBounds = await musicPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).boundingBox();
    if (topbarBounds === null || playlistEntryBounds === null) {
      throw new Error("Expected the top bar and playlist entry to be visible");
    }
    expect(playlistEntryBounds.y).toBeGreaterThanOrEqual(topbarBounds.y);
    expect(playlistEntryBounds.y + playlistEntryBounds.height)
      .toBeLessThanOrEqual(topbarBounds.y + topbarBounds.height);
    await page.setViewportSize({ width: 1440, height: 900 });
    await musicPlayer.getByRole("button", {
      name: "음악 정지",
      exact: true,
    }).click();
    await page.evaluate(() => {
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls?.splice(0);
    });
    await page.getByRole("button", { name: "테마 변경", exact: true }).hover();
    await page.getByRole("group", { name: "테마 선택" })
      .getByRole("button", { name: "포커스D", exact: true })
      .click();
    await page.mouse.move(900, 700);
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const focusDialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await focusDialog.getByLabel("작업 시간(분)").fill("1");
    await focusDialog.getByLabel("휴식 시간(분)").fill("1");
    await focusDialog.getByLabel("작업 주기").fill("1");
    await focusDialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(page.getByTestId("pomodoro-timer")).toBeVisible();
    await page.getByRole("button", {
      name: "집중 화면 시작",
      exact: true,
    }).click();
    const focusPomodoroStatus = page.getByLabel("현재 집중 상태", {
      exact: true,
    });
    await expect(focusPomodoroStatus).toBeVisible();
    await expect(focusPomodoroStatus).toContainText("작업 모드");
    await page.locator(".manuscript-focus-toolbar-host").hover();
    await page.getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).toHaveLength(0);
    await page.getByTestId("pomodoro-timer").getByRole("button", {
      name: "종료",
      exact: true,
    }).click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+A");
    await expect(
      page.getByTestId("manuscript-selection-active"),
    ).toBeVisible();

    await openStructureTab(page, "인물");
    const workspace = page.getByRole("region", { name: "인물 작업면" });
    await expect(workspace).toBeVisible();
    const characterDraw = workspace.getByRole("complementary", {
      name: "인물 뽑기",
    });
    await characterDraw.getByRole("button", {
      name: "인물 다시 뽑기",
      exact: true,
    }).click();
    await expect(characterDraw.locator(".inspiration-draw-results > div"))
      .toHaveCount(5);
    await characterDraw.getByLabel("뽑힌 인물 이름").fill(characterName);
    await characterDraw.getByRole("button", {
      name: "인물 항목으로 저장",
      exact: true,
    }).click();
    await expect(workspace.getByLabel("인물 이름", { exact: true }))
      .toHaveValue(characterName);
    await workspace.getByLabel("인물 별칭", { exact: true }).fill(characterAlias);
    await workspace.getByLabel("인물 역할", { exact: true }).fill("기록자");
    await workspace.getByLabel("인물 요약", { exact: true })
      .fill("상황을 기록한다.");
    await workspace.getByRole("button", {
      name: "변경 저장",
      exact: true,
    }).click();

    await workspace.getByRole("button", {
      name: "인물 추가",
      exact: true,
    }).click();
    await workspace.getByLabel("인물 이름", { exact: true })
      .fill(generatedCharacterName);
    await workspace.getByLabel("인물 역할", { exact: true }).fill(generatedRole);
    await workspace.getByLabel("인물 성격과 가치관", { exact: true }).fill(
      generatedPersonality,
    );
    await workspace.getByRole("button", {
      name: "인물 만들기",
      exact: true,
    }).click();

    await workspace.getByRole("button", {
      name: "인물 추가",
      exact: true,
    }).click();
    await workspace.getByLabel("인물 이름", { exact: true })
      .fill(relatedCharacterName);
    await workspace.getByRole("button", {
      name: "인물 만들기",
      exact: true,
    }).click();
    await workspace
      .locator(".character-workspace-list")
      .getByRole("button")
      .filter({ hasText: characterName })
      .click();
    await workspace.getByLabel("관계 대상").selectOption({
      label: relatedCharacterName,
    });
    await workspace.getByLabel("관계 종류", { exact: true }).fill(
      relationKind,
    );
    await workspace.getByLabel("관계 설명", { exact: true }).fill(
      relationDescription,
    );
    await workspace.getByRole("button", {
      name: "관계 추가",
      exact: true,
    }).click();
    await expect(workspace.getByLabel(
      `${characterName} → ${relatedCharacterName} 관계 종류`,
    )).toHaveValue(relationKind);
    await expect(workspace.getByLabel(
      `${characterName} → ${relatedCharacterName} 관계 설명`,
    )).toHaveValue(relationDescription);

    expect(receivedRequests).toHaveLength(0);

    await openWorkSection(page, "쓰기");
    await manuscript.press("Control+A");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page.getByRole("button", {
      name: "선택에서 장면 분석",
      exact: true,
    }).click();
    const plotWorkspace = page.getByRole("region", { name: "구조 작업면" });
    await expect(plotWorkspace.getByRole("tab", {
      name: "장면",
      exact: true,
    })).toHaveAttribute("aria-selected", "true");
    const scenePanel = plotWorkspace.getByRole("region", { name: "장면 뽑기" });
    await scenePanel.getByRole("button", {
      name: "이번 선택 전송 허용",
      exact: true,
    }).click();
    await expect(scenePanel).toContainText("닫힌 방");
    await expect(scenePanel).toContainText("바깥 경보");
    const expectedSceneBoundary = manuscriptText.indexOf("밖에서");
    await expect(scenePanel).toContainText(
      `${expectedSceneBoundary.toLocaleString()}자`,
    );
    await scenePanel.getByRole("button", {
      name: "원고에서 분할선 미리보기",
      exact: true,
    }).click();
    const manuscriptBoundaryPreview = page.locator(
      ".cm-scene-boundary-preview",
    );
    await expect(manuscriptBoundaryPreview).toHaveCount(1);
    await expect(manuscriptBoundaryPreview).toContainText("닫힌 방 → 바깥 경보");
    await openStructureTab(page, "장면");
    const reviewPlotWorkspace = page.getByRole("region", { name: "구조 작업면" });
    await expect(reviewPlotWorkspace.getByRole("tab", {
      name: "장면",
      exact: true,
    })).toHaveAttribute("aria-selected", "true");
    const reviewScenePanel = reviewPlotWorkspace.getByRole("region", {
      name: "장면 뽑기",
    });
    await reviewScenePanel.getByRole("button", {
      name: "분할 승인",
      exact: true,
    }).click();
    await expect(reviewScenePanel).toContainText("분할 저장됨");
    await expect(manuscriptBoundaryPreview).toHaveCount(0);
    const annotationApproval = reviewScenePanel.getByRole("button", {
      name: "장면 정보 승인",
      exact: true,
    });
    await expect(annotationApproval).toHaveCount(2);
    await annotationApproval.first().click();
    await expect(annotationApproval).toHaveCount(1);
    await annotationApproval.first().click();
    await expect(reviewScenePanel.getByText("장면 정보 저장됨", { exact: true }))
      .toHaveCount(2);
    await expect(reviewScenePanel).toContainText("검토 완료");
    await expect(reviewPlotWorkspace.locator("[data-scene-annotation]"))
      .toHaveCount(2);
    await expect(reviewPlotWorkspace.locator(".scene-list-card")).toHaveCount(2);
    const sceneMusicPanels = reviewPlotWorkspace.locator(
      "[data-scene-music-queue]",
    );
    await expect(sceneMusicPanels).toHaveCount(2);
    const targetSceneMusicPanel = reviewPlotWorkspace
      .locator(".scene-list-card")
      .filter({ hasText: "바깥 경보" })
      .locator("[data-scene-music-queue]");
    await targetSceneMusicPanel.getByLabel("확인할 검색어").fill(
      sceneMusicQuery,
    );
    await targetSceneMusicPanel.getByRole("button", {
      name: "이 장면으로 음악 찾기",
      exact: true,
    }).click();
    await expect.poll(() => youtubeSearches.length).toBe(3);
    expect(youtubeSearches[2]).toContain(sceneMusicQuery);
    expect(youtubeSearches[2]).toContain("-shorts");
    await expect(targetSceneMusicPanel.locator("[data-scene-music-candidate]"))
      .toHaveCount(1);
    await expect(targetSceneMusicPanel.locator("[data-scene-music-option]"))
      .toHaveCount(2);
    await targetSceneMusicPanel.getByRole("button", {
      name: "선호 영상 저장: 장면 큐 4",
      exact: true,
    }).click();
    const favoriteVideos = reviewPlotWorkspace.getByRole("region", {
      name: "선호 영상",
      exact: true,
    });
    await expect(favoriteVideos).toContainText("장면 큐 4");
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return [];
      const settings = await window.eumStudio.settings.getWorkMusic({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return settings.settings.favoriteTracks.map((track) =>
        "videoId" in track ? track.videoId : null
      );
    })).toEqual(["queue-video-1", "queue-video-4"]);
    expect((await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:"))).toHaveLength(0);
    await targetSceneMusicPanel.getByRole("button", {
      name: "이 재생목록 저장",
      exact: true,
    }).last().click();
    await expect(targetSceneMusicPanel.getByRole("button", {
      name: "저장됨",
      exact: true,
    })).toBeVisible();
    expect((await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:"))).toHaveLength(0);
    await targetSceneMusicPanel.getByRole("button", {
      name: "재생목록 재생",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual(["load:queue-video-4"]);
    await expect(musicPlayer).toContainText("장면 큐 4");
    await musicPlayer.getByRole("button", {
      name: "다음 곡",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual(["load:queue-video-4", "load:queue-video-5"]);
    await musicPlayer.getByRole("button", {
      name: "음악 일시정지",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry === "pause").length).toBe(1);
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const selectedQueueFocusDialog = page.getByRole("dialog", {
      name: "집중 타이머 설정",
    });
    await selectedQueueFocusDialog.getByLabel("작업 시간(분)").fill("1");
    await selectedQueueFocusDialog.getByLabel("휴식 시간(분)").fill("1");
    await selectedQueueFocusDialog.getByLabel("작업 주기").fill("1");
    await selectedQueueFocusDialog.getByRole("button", {
      name: "시작",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual([
        "load:queue-video-4",
        "load:queue-video-5",
        "load:queue-video-4",
      ]);
    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0]?.headers["chatgpt-account-id"]).toBe(accountId);
    expect(receivedRequests[0]?.headers.originator).toBe("test-originator");
    const sceneInput = receivedRequests[0]?.body.input as Array<{
      readonly content: Array<{ readonly text: string }>;
    }>;
    expect(JSON.parse(sceneInput[0]!.content[0]!.text)).toEqual({
      paragraphs: manuscriptText.split("\n").map((text, index) => ({
        id: `p${index + 1}`,
        text,
      })),
    });

    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, sceneDraftDocumentTitle);
    await expect(page.getByTestId("manuscript-title"))
      .toHaveText(sceneDraftDocumentTitle);
    await manuscript.click();
    await openStructureTab(page, "플롯");
    const sceneDraftPlotWorkspace = page.getByRole("region", {
      name: "플롯 작업면",
    });
    const plotBoardWorkspace = sceneDraftPlotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await plotBoardWorkspace.getByLabel("플롯 제목").fill(sceneDraftPlotTitle);
    await plotBoardWorkspace.getByLabel("플롯 단계").fill("전환");
    await plotBoardWorkspace.getByLabel("플롯 요약").fill("잠긴 문을 연다.");
    await plotBoardWorkspace.getByRole("button", {
      name: "플롯 만들기",
      exact: true,
    }).click();
    await plotBoardWorkspace.getByRole("button", {
      name: "예정 사건 만들기",
      exact: true,
    }).click();
    const sceneDraftPanel = plotBoardWorkspace.getByRole("region", {
      name: "장면 초안",
    });
    await expect(sceneDraftPanel).toContainText("연결 사건 1개");
    await sceneDraftPanel.getByLabel(characterName, { exact: true }).check();
    await sceneDraftPanel.getByRole("button", {
      name: "장면 초안 생성",
      exact: true,
    }).click();
    const sceneDraftCandidate = sceneDraftPanel.locator(
      "[data-scene-draft-candidate]",
    ).filter({ hasText: sceneDraftPlotTitle });
    await expect(sceneDraftCandidate).toContainText(generatedSceneDraft);
    await expect(sceneDraftCandidate).toContainText(
      "0자 위치",
    );
    await expect(sceneDraftCandidate.locator(".scene-draft-diff"))
      .toContainText(`+ ${generatedSceneDraft}`);
    expect(await page.locator(
      ".manuscript-workspace-surface .cm-content",
    ).textContent()).not.toContain(generatedSceneDraft);
    expect(receivedRequests).toHaveLength(2);
    expect(receivedRequests[1]?.headers["chatgpt-account-id"]).toBe(accountId);
    const sceneDraftInput = receivedRequests[1]?.body.input as Array<{
      readonly content: Array<{ readonly text: string }>;
    }>;
    expect(JSON.parse(sceneDraftInput[0]!.content[0]!.text)).toEqual({
      plot: {
        title: sceneDraftPlotTitle,
        stage: "전환",
        summary: "잠긴 문을 연다.",
        note: "",
      },
      events: [{
        role: "primary",
        title: sceneDraftPlotTitle,
        note: "잠긴 문을 연다.",
      }],
      characters: [{
        name: characterName,
        aliases: [characterAlias],
        role: "기록자",
        summary: "상황을 기록한다.",
        appearance: expect.any(String),
        personality: expect.any(String),
        speech: expect.any(String),
        goal: "",
        conflict: "",
        note: "",
      }],
      settings: [],
    });
    const sceneDraftEditor = sceneDraftCandidate.getByLabel(
      `${sceneDraftPlotTitle} 장면 초안`,
    );
    await sceneDraftEditor.fill(editedSceneDraft);
    await sceneDraftCandidate.getByRole("button", {
      name: "후보 변경 저장",
      exact: true,
    }).click();
    await expect(sceneDraftCandidate.getByRole("button", {
      name: "이 위치에 삽입",
      exact: true,
    })).toBeEnabled();
    await sceneDraftCandidate.getByRole("button", {
      name: "이 위치에 삽입",
      exact: true,
    }).click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect.poll(async () => await manuscript.textContent())
      .toContain(editedSceneDraft.trim());

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await installFakeYouTubePlayer(page);
    await expect(page.getByRole("region", { name: "음악 플레이어" }))
      .toContainText("재생할 곡을 선택하세요");
    await page.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const reopenedMusicLibrary = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    const reopenedQueue = reopenedMusicLibrary.getByRole("region", {
      name: "재생목록",
      exact: true,
    });
    await expect(reopenedQueue.getByRole("listitem")).toHaveCount(6);
    await expect(reopenedQueue).toContainText("장면 큐 1");
    await expect(reopenedQueue).toContainText("장면 큐 6");
    await reopenedMusicLibrary.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();
    await openStructureTab(page, "인물");
    const reopenedWorkspace = page.getByRole("region", {
      name: "인물 작업면",
    });
    await expect(reopenedWorkspace.locator(".character-workspace-list"))
      .toContainText(generatedCharacterName);
    await reopenedWorkspace
      .locator(".character-workspace-list")
      .getByRole("button")
      .filter({ hasText: generatedCharacterName })
      .click();
    await expect(reopenedWorkspace.getByLabel("인물 이름", { exact: true })).toHaveValue(
      generatedCharacterName,
    );
    await reopenedWorkspace
      .locator(".character-workspace-list")
      .getByRole("button")
      .filter({ hasText: characterName })
      .click();
    await expect(reopenedWorkspace.getByLabel("인물 이름", { exact: true })).toHaveValue(
      characterName,
    );
    await expect(reopenedWorkspace.getByLabel(
      `${characterName} → ${relatedCharacterName} 관계 종류`,
    )).toHaveValue(relationKind);
    await openWorkSection(page, "쓰기");
    await activateDocumentFromTree(page, documentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    await openStructureTab(page, "장면");
    const reopenedPlotWorkspace = page.getByRole("region", {
      name: "구조 작업면",
    });
    await expect(reopenedPlotWorkspace.getByRole("region", {
      name: "장면 뽑기",
    })).toContainText("장면 정보 저장됨");
    await expect(reopenedPlotWorkspace.locator(".scene-list-card")).toHaveCount(2);
    await expect(reopenedPlotWorkspace.locator("[data-scene-annotation]"))
      .toHaveCount(2);
    const reopenedFavorites = reopenedPlotWorkspace.getByRole("region", {
      name: "선호 영상",
      exact: true,
    });
    await expect(reopenedFavorites).toContainText("장면 큐 4");
    await reopenedFavorites.getByRole("listitem")
      .filter({ hasText: "장면 큐 4" })
      .getByRole("button", { name: "재생", exact: true })
      .click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toContain("load:queue-video-4");
    const reopenedSceneMusicPanel = reopenedPlotWorkspace
      .locator(".scene-list-card")
      .filter({ hasText: "바깥 경보" })
      .locator("[data-scene-music-queue]");
    await expect(reopenedSceneMusicPanel).toContainText(sceneMusicQuery);
    await expect(reopenedSceneMusicPanel.getByRole("button", {
      name: "저장됨",
      exact: true,
    })).toBeVisible();
    await expect(reopenedSceneMusicPanel.getByRole("button", {
      name: "재생목록 재생",
      exact: true,
    })).toBeVisible();
    await reopenedPlotWorkspace.getByRole("tab", {
      name: "플롯",
      exact: true,
    }).click();
    const reopenedPlotBoard = reopenedPlotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await reopenedPlotBoard.getByRole("button")
      .filter({ hasText: sceneDraftPlotTitle }).first().click();
    const reopenedSceneDraftPanel = reopenedPlotBoard.getByRole("region", {
      name: "장면 초안",
    });
    await expect(reopenedSceneDraftPanel.locator("[data-scene-draft-candidate]"))
      .toContainText("원고 반영됨");
    await expect(reopenedSceneDraftPanel).toContainText(editedSceneDraft.trim());
    await openWorkSection(page, "쓰기");
    await activateDocumentFromTree(page, sceneDraftDocumentTitle);
    await expect.poll(async () => await page.getByRole("textbox", {
      name: "원고",
    }).textContent()).toContain(editedSceneDraft.trim());
    await openReviewRail(page);
    await page.getByRole("tab", { name: "조수", exact: true }).click();
    await page.getByRole("button", { name: "조수 대화 열기", exact: true }).click();
    const assistantChat = page.getByRole("dialog", {
      name: "GPT 조수 대화",
      exact: true,
    });
    await assistantChat.getByLabel("GPT에게 보낼 메시지", { exact: true })
      .fill(chatPrompt);
    await assistantChat.getByRole("button", {
      name: "GPT에게 보내기",
      exact: true,
    }).click();
    await expect(assistantChat).toContainText(chatResponse);
    await expect.poll(() => receivedRequests.length).toBe(3);
    const chatInput = receivedRequests[2]?.body.input as Array<{
      readonly role: string;
      readonly content: Array<{ readonly text: string }>;
    }>;
    expect(chatInput.at(-1)).toMatchObject({
      role: "user",
      content: [{ text: chatPrompt }],
    });
    await assistantChat.getByRole("button", {
      name: "원고 도구",
      exact: true,
    }).click();
    const assistantTools = page.getByRole("dialog", {
      name: "조수 접근 권한",
      exact: true,
    });
    await expect(assistantTools.getByLabel("어휘 제안 연결", { exact: true }))
      .toContainText("GPT");
    await assistantTools.getByLabel("어휘 제안 질문", { exact: true })
      .fill(vocabularyQuestion);
    await assistantTools.getByRole("button", {
      name: "제안 받기",
      exact: true,
    }).click();
    await expect(assistantTools.getByRole("region", {
      name: "어휘·유의어 제안 결과",
      exact: true,
    })).toContainText(vocabularySuggestion);
    await expect.poll(() => receivedRequests.length).toBe(4);
    expect((receivedRequests[3]?.body.text as {
      readonly format?: { readonly name?: string };
    }).format?.name).toBe("eum_assistant_vocabulary_suggestions");
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens a scene boundary preview across episodes without moving selection", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-scene-boundary-cross-episode-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `장면 작품-${suffix}`;
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const firstSceneTitle = `긴 장면-${randomUUID()}`;
  const secondSceneTitle = `마지막 장면-${randomUUID()}`;
  const paragraphCount = 72;
  const paragraphs = Array.from({ length: paragraphCount }, (_value, index) =>
    `문단 ${index + 1} ${randomUUID()} ${"긴 원고 문장 ".repeat(6)}`
  );
  const boundaryParagraph = paragraphs[paragraphCount - 1] ?? "";
  const episodeAManuscript = paragraphs.join("\n");
  const boundaryOffset = episodeAManuscript.lastIndexOf(boundaryParagraph);
  const episodeBManuscript = `${randomUUID()} 다른 회차 원고 ${randomUUID()}`;
  const receivedFormats: string[] = [];
  const readStoredDocumentText = (page: Page, documentId: string) =>
    page.evaluate(async (targetDocumentId) => {
      const profile =
        await window.eumStudio.editor.getManuscriptDocumentProfile();
      const document = profile.documents.find(
        (candidate) => candidate.documentId === targetDocumentId,
      );
      if (document === undefined) {
        throw new Error("Expected a stored manuscript document");
      }
      return document.initialText;
    }, documentId);
  const upstream = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      readonly text?: {
        readonly format?: { readonly name?: unknown };
      };
    };
    const formatName = body.text?.format?.name;
    receivedFormats.push(typeof formatName === "string" ? formatName : "");
    const output = JSON.stringify({
      scenes: [
        {
          title: firstSceneTitle,
          fromParagraphId: "p1",
          toParagraphId: `p${paragraphCount - 1}`,
          summary: `앞 장면 ${suffix}`,
          povCharacter: "",
          location: "",
          time: "",
          characters: [],
          goal: "",
          conflict: "",
          outcome: "",
        },
        {
          title: secondSceneTitle,
          fromParagraphId: `p${paragraphCount}`,
          toParagraphId: `p${paragraphCount}`,
          summary: `뒤 장면 ${suffix}`,
          povCharacter: "",
          location: "",
          time: "",
          characters: [],
          goal: "",
          conflict: "",
          outcome: "",
        },
      ],
    });
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end([
      "event: response.output_text.delta",
      `data: ${JSON.stringify({ delta: output })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"));
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", () => resolve());
  });
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a loopback scene extraction server");
  }
  const oauthProfile = {
    schemaVersion: 1,
    providerId: "test-chatgpt-oauth",
    displayName: "GPT",
    issuer: "https://auth.openai.com",
    clientId: "test-client",
    authorizationPath: "/oauth/authorize",
    tokenPath: "/oauth/token",
    scopes: ["openid", "offline_access"],
    authorizeParameters: { originator: "test-originator" },
    callback: {
      listenHost: "127.0.0.1",
      redirectHost: "localhost",
      path: "/auth/callback",
      portRange: { start: 1455, end: 1475 },
    },
    upstream: {
      baseUrl: `http://127.0.0.1:${address.port}`,
      originator: "test-originator",
      clientVersion: "test-version",
      model: "test-model",
    },
  } as const;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_CHATGPT_OAUTH_PROFILE: JSON.stringify(oauthProfile),
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
    const accountId = `account-${suffix}`;
    const jwt = (payload: Record<string, unknown>) =>
      `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
    const tokens = {
      accessToken: jwt({ exp: 4_000_000_000 }),
      refreshToken: `refresh-${suffix}`,
      idToken: jwt({
        email: `writer-${suffix}@example.test`,
        "https://api.openai.com/auth": {
          chatgpt_account_id: accountId,
          chatgpt_plan_type: "test",
        },
      }),
      accountId,
      email: `writer-${suffix}@example.test`,
      planType: "test",
    };
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData")
    );
    const encryptedBytes = await electronApp.evaluate(
      ({ safeStorage }, serializedTokens) =>
        Array.from(safeStorage.encryptString(serializedTokens)),
      JSON.stringify(tokens),
    );
    await electronApp.close();
    const oauthRoot = path.join(userDataPath, "chatgpt-oauth-v1");
    await mkdir(oauthRoot, { recursive: true });
    await writeFile(
      path.join(oauthRoot, "connection.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        encryptedCredential: Buffer.from(encryptedBytes).toString("base64"),
        updatedAt: "2026-08-24T00:00:00.000Z",
      })}\n`,
      "utf8",
    );

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
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
    for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
      await manuscript.pressSequentially(
        paragraphIndex === 0 ? paragraph : `\n${paragraph}`,
      );
    }
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const episodeADocumentId = await readActiveDocumentId(page);
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(episodeAManuscript);
    await manuscript.click();
    await manuscript.press("Control+A");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page
      .getByRole("button", { name: "선택에서 장면 분석", exact: true })
      .click();
    let scenePanel = page.getByRole("region", { name: "장면 뽑기" });
    await scenePanel
      .getByRole("button", { name: "이번 선택 전송 허용", exact: true })
      .click();
    await expect(scenePanel).toContainText(firstSceneTitle);
    await expect(scenePanel).toContainText(secondSceneTitle);
    await expect.poll(() => receivedFormats).toEqual(["eum_scene_extraction"]);
    const candidateProof = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work for scene Candidate proof");
      }
      const projection =
        await window.eumStudio.structure.listSceneExtractionCandidates({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        });
      const candidate = projection.candidates[0];
      const boundary = candidate?.boundaries.find(
        (entry) => entry.status === "pending",
      );
      if (candidate === undefined || boundary === undefined) {
        throw new Error("Expected one pending scene boundary Candidate");
      }
      return {
        candidateCount: projection.candidates.length,
        candidateId: candidate.candidateId,
        documentId: candidate.sourceRange.documentId,
        documentRevisionId: candidate.sourceRange.documentRevisionId,
        offset: boundary.offset,
        status: candidate.status,
      };
    });
    expect(candidateProof).toMatchObject({
      candidateCount: 1,
      documentId: episodeADocumentId,
      offset: boundaryOffset,
      status: "ready",
    });
    expect(candidateProof.candidateId).not.toHaveLength(0);
    expect(candidateProof.documentRevisionId).not.toHaveLength(0);
    expect(candidateProof.offset).toBeGreaterThan(0);

    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(episodeAManuscript);
    const editor = page.locator(".manuscript-editor");
    const readSelection = () => editor.evaluate((element) => ({
      anchor: Number(element.getAttribute("data-selection-anchor")),
      head: Number(element.getAttribute("data-selection-head")),
    }));
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await expect(manuscript).toBeFocused();
    await manuscript.press("Control+A");
    await manuscript.press("ArrowLeft");
    await expect.poll(readSelection).toEqual({ anchor: 0, head: 0 });
    await manuscript.press("ArrowRight");
    await expect.poll(readSelection).toEqual({ anchor: 1, head: 1 });
    const scroller = page.locator(".cm-scroller");
    await scroller.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBe(0);

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

    const tabStrip = page.locator(".document-tab-strip");
    const documentTab = (title: string) =>
      tabStrip.locator(".document-tab-item").filter({ hasText: title });
    await documentTab(episodeATitle)
      .locator(".document-tab-close")
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(documentTab(episodeATitle)).toHaveCount(0);
    const openTabCountBeforePreview = await tabStrip
      .locator(".document-tab-item")
      .count();

    await openStructureTab(page, "장면");
    scenePanel = page.getByRole("region", { name: "장면 뽑기" });
    await scenePanel
      .getByRole("button", {
        name: "원고에서 분할선 미리보기",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    await expect.poll(readSelection).toEqual({ anchor: 1, head: 1 });
    await expect(manuscript).toBeFocused();
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const preview = page.locator(".cm-scene-boundary-preview");
    await expect(preview).toHaveCount(1);
    await expect(preview).toContainText(
      `${firstSceneTitle} → ${secondSceneTitle}`,
    );
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(episodeAManuscript);
    await expect(documentTab(episodeATitle)).toHaveCount(1);
    await expect(
      documentTab(episodeATitle).locator(".document-tab-activate"),
    ).toHaveAttribute("aria-selected", "true");
    await expect(tabStrip.locator(".document-tab-item")).toHaveCount(
      openTabCountBeforePreview + 1,
    );
    await expect(documentTab(episodeBTitle)).toHaveCount(1);

    await activateDocumentFromTree(page, episodeBTitle);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);
    await activateDocumentFromTree(page, episodeATitle);
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(episodeAManuscript);
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens a stale scene draft target across episodes with current-offset clamp and unchanged diff", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-scene-draft-stale-cross-episode-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `장면 초안 작품-${suffix}`;
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const plotTitle = `끝 장면-${randomUUID()}`;
  const generatedSceneDraft = `생성된 장면 초안 ${randomUUID()}`;
  const oldEpisodeAManuscript =
    `이전 원고 ${randomUUID()} ${"오래된 원고 문장 ".repeat(700)}`;
  const currentEpisodeAManuscript = Array.from({ length: 48 }, (_value, index) =>
    `현재 문단 ${index + 1} ${randomUUID()} ${"짧은 원고 ".repeat(2)}`
  ).join("\n");
  const episodeBManuscript = `다른 회차 원고 ${randomUUID()}`;
  expect(currentEpisodeAManuscript.length).toBeLessThan(
    oldEpisodeAManuscript.length,
  );
  const receivedFormats: string[] = [];
  const readStoredDocumentText = (page: Page, documentId: string) =>
    page.evaluate(async (targetDocumentId) => {
      const profile =
        await window.eumStudio.editor.getManuscriptDocumentProfile();
      const document = profile.documents.find(
        (candidate) => candidate.documentId === targetDocumentId,
      );
      if (document === undefined) {
        throw new Error("Expected a stored manuscript document");
      }
      return document.initialText;
    }, documentId);
  const upstream = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      readonly text?: {
        readonly format?: { readonly name?: unknown };
      };
    };
    const formatName = body.text?.format?.name;
    receivedFormats.push(typeof formatName === "string" ? formatName : "");
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end([
      "event: response.output_text.delta",
      `data: ${JSON.stringify({
        delta: JSON.stringify({ draftText: generatedSceneDraft }),
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"));
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", () => resolve());
  });
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a loopback scene draft server");
  }
  const oauthProfile = {
    schemaVersion: 1,
    providerId: "test-chatgpt-oauth",
    displayName: "GPT",
    issuer: "https://auth.openai.com",
    clientId: "test-client",
    authorizationPath: "/oauth/authorize",
    tokenPath: "/oauth/token",
    scopes: ["openid", "offline_access"],
    authorizeParameters: { originator: "test-originator" },
    callback: {
      listenHost: "127.0.0.1",
      redirectHost: "localhost",
      path: "/auth/callback",
      portRange: { start: 1455, end: 1475 },
    },
    upstream: {
      baseUrl: `http://127.0.0.1:${address.port}`,
      originator: "test-originator",
      clientVersion: "test-version",
      model: "test-model",
    },
  } as const;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_CHATGPT_OAUTH_PROFILE: JSON.stringify(oauthProfile),
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
    const accountId = `account-${suffix}`;
    const jwt = (payload: Record<string, unknown>) =>
      `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
    const tokens = {
      accessToken: jwt({ exp: 4_000_000_000 }),
      refreshToken: `refresh-${suffix}`,
      idToken: jwt({
        email: `writer-${suffix}@example.test`,
        "https://api.openai.com/auth": {
          chatgpt_account_id: accountId,
          chatgpt_plan_type: "test",
        },
      }),
      accountId,
      email: `writer-${suffix}@example.test`,
      planType: "test",
    };
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData")
    );
    const encryptedBytes = await electronApp.evaluate(
      ({ safeStorage }, serializedTokens) =>
        Array.from(safeStorage.encryptString(serializedTokens)),
      JSON.stringify(tokens),
    );
    await electronApp.close();
    const oauthRoot = path.join(userDataPath, "chatgpt-oauth-v1");
    await mkdir(oauthRoot, { recursive: true });
    await writeFile(
      path.join(oauthRoot, "connection.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        encryptedCredential: Buffer.from(encryptedBytes).toString("base64"),
        updatedAt: "2026-08-24T00:00:00.000Z",
      })}\n`,
      "utf8",
    );

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
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
    await manuscript.click();
    await page.keyboard.insertText(oldEpisodeAManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const episodeADocumentId = await readActiveDocumentId(page);
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(oldEpisodeAManuscript);
    const editor = page.locator(".manuscript-editor");
    const readSelection = () => editor.evaluate((element) => ({
      anchor: Number(element.getAttribute("data-selection-anchor")),
      head: Number(element.getAttribute("data-selection-head")),
    }));
    await manuscript.click();
    await manuscript.press("Control+End");
    await expect.poll(readSelection).toEqual({
      anchor: oldEpisodeAManuscript.length,
      head: oldEpisodeAManuscript.length,
    });

    await openStructureTab(page, "플롯");
    let plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    let plotBoard = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await plotBoard.getByLabel("플롯 제목").fill(plotTitle);
    await plotBoard.getByLabel("플롯 단계").fill("전환");
    await plotBoard.getByLabel("플롯 요약").fill(`끝 장면 요약 ${suffix}`);
    await plotBoard
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotBoard
      .getByRole("button", { name: "예정 사건 만들기", exact: true })
      .click();
    let sceneDraftPanel = plotBoard.getByRole("region", {
      name: "장면 초안",
    });
    await sceneDraftPanel
      .getByRole("button", { name: "장면 초안 생성", exact: true })
      .click();
    let sceneDraftCandidate = sceneDraftPanel
      .locator("[data-scene-draft-candidate]")
      .filter({ hasText: plotTitle });
    await expect(sceneDraftCandidate).toContainText(generatedSceneDraft);
    await expect(sceneDraftCandidate).toContainText("검토 대기");
    await expect.poll(() => receivedFormats).toEqual(["eum_scene_draft"]);
    const initialCandidateProof = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work for scene draft proof");
      }
      const projection =
        await window.eumStudio.structure.listSceneDraftCandidates({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        });
      const candidate = projection.candidates[0];
      if (candidate === undefined) {
        throw new Error("Expected one scene draft Candidate");
      }
      return {
        candidateId: candidate.candidateId,
        documentId: candidate.target.documentId,
        documentRevisionId: candidate.target.documentRevisionId,
        integrity: candidate.integrity,
        offset: candidate.target.insertionOffset,
        status: candidate.status,
      };
    });
    expect(initialCandidateProof).toMatchObject({
      documentId: episodeADocumentId,
      integrity: "current",
      offset: oldEpisodeAManuscript.length,
      status: "ready",
    });
    expect(initialCandidateProof.candidateId).not.toHaveLength(0);
    expect(initialCandidateProof.documentRevisionId).not.toHaveLength(0);

    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await expect(manuscript).toBeFocused();
    await manuscript.press("Control+A");
    await expect.poll(async () => {
      const selection = await readSelection();
      return {
        from: Math.min(selection.anchor, selection.head),
        to: Math.max(selection.anchor, selection.head),
      };
    }).toEqual({ from: 0, to: oldEpisodeAManuscript.length });
    await page.keyboard.insertText(currentEpisodeAManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(currentEpisodeAManuscript);

    await openStructureTab(page, "플롯");
    plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    plotBoard = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    sceneDraftPanel = plotBoard.getByRole("region", { name: "장면 초안" });
    sceneDraftCandidate = sceneDraftPanel
      .locator("[data-scene-draft-candidate]")
      .filter({ hasText: plotTitle });
    const insertButton = sceneDraftCandidate.getByRole("button", {
      name: "이 위치에 삽입",
      exact: true,
    });
    await expect(insertButton).toBeEnabled();
    await insertButton.click();
    await expect(sceneDraftCandidate).toContainText("기준 변경됨");
    await expect(sceneDraftCandidate.getByRole("button", {
      name: "현재 원고와 비교",
      exact: true,
    })).toBeEnabled();
    const staleCandidateProof = await page.evaluate(async ({
      candidateId,
      documentId,
    }) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work for stale scene draft proof");
      }
      const [projection, profile] = await Promise.all([
        window.eumStudio.structure.listSceneDraftCandidates({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
        window.eumStudio.editor.getManuscriptDocumentProfile(),
      ]);
      const candidate = projection.candidates.find(
        (entry) => entry.candidateId === candidateId,
      );
      const document = profile.documents.find(
        (entry) => entry.documentId === documentId,
      );
      if (candidate === undefined || document === undefined) {
        throw new Error("Expected stale Candidate and current target Document");
      }
      return {
        currentLength: document.initialText.length,
        currentText: document.initialText,
        documentId: candidate.target.documentId,
        integrity: candidate.integrity,
        offset: candidate.target.insertionOffset,
        status: candidate.status,
      };
    }, {
      candidateId: initialCandidateProof.candidateId,
      documentId: episodeADocumentId,
    });
    expect(staleCandidateProof).toMatchObject({
      currentLength: currentEpisodeAManuscript.length,
      currentText: currentEpisodeAManuscript,
      documentId: episodeADocumentId,
      integrity: "stale",
      offset: oldEpisodeAManuscript.length,
      status: "ready",
    });
    expect(staleCandidateProof.offset).toBeGreaterThan(
      staleCandidateProof.currentLength,
    );
    const staleCardText = await sceneDraftCandidate.innerText();
    const staleDiffText = await sceneDraftCandidate
      .locator(".scene-draft-diff")
      .innerText();

    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.press("Control+Home");
    await expect.poll(readSelection).toEqual({ anchor: 0, head: 0 });
    const scroller = page.locator(".cm-scroller");
    await scroller.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBe(0);

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
    await expect.poll(() =>
      readStoredDocumentText(page, episodeBDocumentId)
    ).toBe(episodeBManuscript);

    const tabStrip = page.locator(".document-tab-strip");
    const documentTab = (title: string) =>
      tabStrip.locator(".document-tab-item").filter({ hasText: title });
    await documentTab(episodeATitle)
      .locator(".document-tab-close")
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(documentTab(episodeATitle)).toHaveCount(0);
    const openTabCountBeforeCompare = await tabStrip
      .locator(".document-tab-item")
      .count();

    await openStructureTab(page, "플롯");
    plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    plotBoard = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    sceneDraftPanel = plotBoard.getByRole("region", { name: "장면 초안" });
    sceneDraftCandidate = sceneDraftPanel
      .locator("[data-scene-draft-candidate]")
      .filter({ hasText: plotTitle });
    await expect(sceneDraftCandidate).toContainText("기준 변경됨");
    expect(await sceneDraftCandidate.innerText()).toBe(staleCardText);
    expect(await sceneDraftCandidate.locator(".scene-draft-diff").innerText())
      .toBe(staleDiffText);
    await sceneDraftCandidate.getByRole("button", {
      name: "현재 원고와 비교",
      exact: true,
    }).click();

    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(readSelection).toEqual({ anchor: 0, head: 0 });
    await expect(manuscript).toBeFocused();
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const scrollMetrics = await scroller.evaluate((element) => ({
      maximum: element.scrollHeight - element.clientHeight,
      top: element.scrollTop,
    }));
    expect(scrollMetrics.maximum).toBeGreaterThan(0);
    expect(scrollMetrics.maximum - scrollMetrics.top).toBeLessThanOrEqual(2);
    await expect.poll(() =>
      readStoredDocumentText(page, episodeADocumentId)
    ).toBe(currentEpisodeAManuscript);
    await expect.poll(() =>
      readStoredDocumentText(page, episodeBDocumentId)
    ).toBe(episodeBManuscript);
    await expect(documentTab(episodeATitle)).toHaveCount(1);
    await expect(
      documentTab(episodeATitle).locator(".document-tab-activate"),
    ).toHaveAttribute("aria-selected", "true");
    await expect(tabStrip.locator(".document-tab-item")).toHaveCount(
      openTabCountBeforeCompare + 1,
    );
    await expect(documentTab(episodeBTitle)).toHaveCount(1);

    await openStructureTab(page, "플롯");
    plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    plotBoard = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    sceneDraftPanel = plotBoard.getByRole("region", { name: "장면 초안" });
    sceneDraftCandidate = sceneDraftPanel
      .locator("[data-scene-draft-candidate]")
      .filter({ hasText: plotTitle });
    await expect(sceneDraftCandidate).toContainText("기준 변경됨");
    await expect(sceneDraftCandidate.getByRole("button", {
      name: "현재 원고와 비교",
      exact: true,
    })).toBeEnabled();
    expect(await sceneDraftCandidate.innerText()).toBe(staleCardText);
    expect(await sceneDraftCandidate.locator(".scene-draft-diff").innerText())
      .toBe(staleDiffText);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    await expect.poll(() => receivedFormats).toEqual(["eum_scene_draft"]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages Work-owned plots across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plots-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const initialTitle = `사라진 기록-${randomUUID().slice(0, 8)}`;
  const updatedTitle = `돌아온 기록-${randomUUID().slice(0, 8)}`;
  const initialStage = `조사 ${randomUUID().slice(0, 8)}`;
  const updatedStage = `회수 ${randomUUID().slice(0, 8)}`;
  const initialSummary = `첫 요약 ${randomUUID()}`;
  const updatedSummary = `수정 요약 ${randomUUID()}`;
  const initialNote = `첫 메모 ${randomUUID()}`;
  const updatedNote = `수정 메모 ${randomUUID()}`;
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

    await openStructureTab(page, "플롯");
    let dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");
    await dialog.getByLabel("플롯 제목").fill(initialTitle);
    await dialog.getByLabel("플롯 단계").fill(initialStage);
    await dialog.getByLabel("플롯 요약").fill(initialSummary);
    await dialog.getByLabel("플롯 작가 메모").fill(initialNote);
    await dialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(initialTitle);
    await expect(dialog.getByLabel("플롯 단계")).toHaveValue(initialStage);

    await dialog.getByLabel("플롯 제목").fill(updatedTitle);
    await dialog.getByLabel("플롯 단계").fill(updatedStage);
    await dialog.getByLabel("플롯 요약").fill(updatedSummary);
    await dialog.getByLabel("플롯 작가 메모").fill(updatedNote);
    await dialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(updatedTitle);
    await expect(dialog.getByLabel("플롯 단계")).toHaveValue(updatedStage);
    await expect(dialog.getByLabel("플롯 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("플롯 작가 메모")).toHaveValue(updatedNote);

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
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");

    await openStudioHome(page);
    await openWorkDocumentFromHome(page, firstWorkTitle, firstDocumentTitle);
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(updatedTitle);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(updatedTitle);
    await expect(dialog.getByLabel("플롯 단계")).toHaveValue(updatedStage);
    await expect(dialog.getByLabel("플롯 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("플롯 작가 메모")).toHaveValue(updatedNote);

    await dialog
      .getByRole("button", { name: "플롯 치우기", exact: true })
      .click();
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses the plot list, detail, and local event draw without changing manuscript", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-formal-plot-workspace-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `플롯 작업면 ${suffix}`;
  const documentTitle = `1화 ${suffix}`;
  const manuscriptText = `원고 문장은 플롯 카드 이동과 무관하다 ${suffix}`;
  const firstPlotTitle = `첫 플롯 ${suffix}`;
  const secondPlotTitle = `둘째 플롯 ${suffix}`;
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
    await page.setViewportSize({ width: 786, height: 538 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStructureTab(page, "플롯");
    let workspace = page.getByRole("region", { name: "플롯 작업면" });
    await expect(workspace).toBeVisible();
    const boardSurface = workspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await boardSurface.getByLabel("플롯 제목").fill(firstPlotTitle);
    await boardSurface.getByRole("button", {
      name: "플롯 만들기",
      exact: true,
    }).click();
    await boardSurface.getByRole("button", { name: "새 플롯", exact: true }).click();
    await boardSurface.getByLabel("플롯 제목").fill(secondPlotTitle);
    await boardSurface.getByRole("button", {
      name: "플롯 만들기",
      exact: true,
    }).click();
    const plotTitles = boardSurface.locator(
      ".plot-manager-list > ul > li > button strong",
    );
    await expect(plotTitles).toHaveText([secondPlotTitle, firstPlotTitle]);
    const eventDraw = workspace.getByRole("complementary", {
      name: "사건 뽑기",
    });
    const customEventKeyword = `비밀 서신 ${suffix}`;
    await eventDraw.getByLabel("사건 뽑기 키워드").fill(customEventKeyword);
    await eventDraw.getByRole("button", { name: "추가", exact: true }).click();
    await expect(eventDraw).toContainText(customEventKeyword);
    await eventDraw.getByRole("button", {
      name: "사건 다시 뽑기",
      exact: true,
    }).click();
    await expect(eventDraw.locator(".inspiration-draw-results > div"))
      .toHaveCount(3);

    await expect(workspace.getByRole("tab", {
      name: "사건 레일",
      exact: true,
    })).toHaveCount(0);
    await openWorkSection(page, "쓰기");
    await expect(page.getByRole("region", {
      name: "사건 레일",
    })).toBeVisible();
    await openStructureTab(page, "장면");
    workspace = page.getByRole("region", { name: "구조 작업면" });
    await expect(workspace.getByRole("region", {
      name: "현재 회차 장면",
    })).toBeVisible();

    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "플롯");
    workspace = page.getByRole("region", { name: "플롯 작업면" });
    await expect(workspace.locator(
      ".plot-manager-list > ul > li > button strong",
    )).toHaveText([secondPlotTitle, firstPlotTitle]);
    await expect(workspace.getByRole("complementary", {
      name: "사건 뽑기",
    })).toContainText(customEventKeyword);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses the fixed Work header across IA sections and preserves the mounted manuscript", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-ia-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `정보구조 작품-${suffix}`;
  const documentTitle = `정보구조 회차-${suffix}`;
  const manuscriptText = `작업면을 오가도 보존할 원고 ${suffix}`;
  const discardedPlotTitle = `버릴 플롯 초안-${suffix}`;
  const firstPlotTitle = `첫 구조 플롯-${suffix}`;
  const secondPlotTitle = `둘째 구조 플롯-${suffix}`;
  const discardedPartnerName = `버릴 투고처 초안-${suffix}`;
  const partnerName = `운영 투고처-${suffix}`;
  const submissionTitle = `운영 투고 기록-${suffix}`;
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

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const workNavigation = page.getByRole("navigation", { name: "작품 작업면" });
    await expect(workNavigation.getByRole("button")).toHaveText([
      "쓰기",
      "구조",
      "검토",
      "운영",
    ]);
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+A");
    await expect(page.getByTestId("manuscript-selection-active")).toBeVisible();

    await openStructureTab(page, "플롯");
    const plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    const plotTitle = plotWorkspace.getByLabel("플롯 제목");
    await plotTitle.fill(discardedPlotTitle);
    await plotWorkspace.getByRole("button", { name: "새 플롯", exact: true }).click();
    await expect(plotTitle).toHaveValue("");
    await expect(plotTitle).toBeFocused();
    await plotTitle.fill(firstPlotTitle);
    await plotWorkspace
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotWorkspace.getByRole("button", { name: "새 플롯", exact: true }).click();
    await plotWorkspace.getByLabel("플롯 제목").fill(secondPlotTitle);
    await plotWorkspace
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await expect(plotWorkspace.locator(".plot-manager-list strong"))
      .toContainText([secondPlotTitle, firstPlotTitle]);

    await openReviewTab(page, "후보 검토함");
    await expect(page.getByRole("region", { name: "후보 검토함" })).toBeVisible();
    await openWorkSection(page, "운영");
    const workOperations = page.getByRole("region", { name: "작품 운영 작업면" });
    await expect(workOperations).toBeVisible();
    await expect(workOperations).not.toContainText(
      "현재 작품으로 범위가 고정된 운영 진입점입니다.",
    );
    await expect(workOperations.getByRole("button")).toHaveText([
      "투고",
      "계약·발행",
      "정산·입금",
    ]);
    await workOperations.getByRole("button", { name: "투고", exact: true }).click();
    const publishingDialog = page.getByRole("dialog", { name: "투고" });
    await expect(
      publishingDialog.locator(".publishing-workspace-tabs button:visible"),
    ).toHaveText(["투고 이력", "투고처 원장"]);
    await publishingDialog.getByRole("button", {
      name: "투고처 원장",
      exact: true,
    }).click();
    const partnerNameInput = publishingDialog.getByLabel("투고처 이름");
    await partnerNameInput.fill(discardedPartnerName);
    await publishingDialog.getByRole("button", {
      name: "새 투고처",
      exact: true,
    }).click();
    await expect(partnerNameInput).toHaveValue("");
    await expect(partnerNameInput).toBeFocused();
    await partnerNameInput.fill(partnerName);
    await publishingDialog.getByRole("button", {
      name: "투고처 추가",
      exact: true,
    }).click();
    await expect(partnerNameInput).toHaveValue(partnerName);
    await expect(publishingDialog.getByRole("alert")).toHaveCount(0);
    await publishingDialog.getByRole("button", {
      name: "투고 이력",
      exact: true,
    }).click();
    await publishingDialog.getByRole("button", {
      name: "새 투고 기록",
      exact: true,
    }).click();
    await expect(publishingDialog.getByLabel("투고 작품"))
      .toHaveValue(/.+/u);
    await publishingDialog.getByLabel("투고처 선택")
      .selectOption({ label: partnerName });
    await publishingDialog.getByLabel("투고 기록 제목")
      .fill(submissionTitle);
    await publishingDialog.getByRole("button", {
      name: "현재 원고 버전으로 기록 추가",
      exact: true,
    }).click();
    await expect(publishingDialog).toContainText(submissionTitle);
    await publishingDialog.getByRole("button", {
      name: "투고 운영 닫기",
      exact: true,
    }).click();
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, manuscriptText);
    await expect(page.getByTestId("manuscript-selection-active")).toBeVisible();

    await page.getByRole("button", { name: "작업 일정 열기", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "작업 일정" })).toBeVisible();
    await page.getByRole("button", { name: "작업 일정 닫기", exact: true }).click();

    await openReviewRail(page);
    const inspectorTabs = page.getByRole("complementary", { name: "검토 레일" })
      .getByRole("tablist", { name: "검토 범위" });
    await expect(inspectorTabs.getByRole("tab")).toHaveText(["현재", "조수"]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("flushes the active manuscript before explicit completion and restores completion state", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-document-completion-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `완료 작품-${suffix}`;
  const documentTitle = `완료 회차-${suffix}`;
  const firstText = `완료 직전 원고 ${suffix}`;
  const editedText = ` 완료 뒤 수정 ${suffix}`;
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
    await page.setViewportSize({ width: 960, height: 720 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstText);
    await page.getByRole("button", { name: "회차 완료", exact: true }).click();
    await expect(page.getByText("✓ 완료됨", { exact: true })).toBeVisible();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("✓");

    const completed = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      const work = catalog.works.find((candidate) =>
        candidate.workId === catalog.activeWorkId
      );
      const document = work?.documents.find((candidate) =>
        candidate.documentId === catalog.activeDocumentId
      );
      return document ?? null;
    });
    expect(completed).not.toBeNull();
    expect(completed?.completion).toMatchObject({
      revision: 1,
      state: "current",
      completedDocumentRevisionId: completed?.currentRevisionId,
    });
    await expectEditorText(manuscript, firstText);

    await openSchedule(page);
    let scheduleDialog = page.getByRole("dialog", { name: "작업 일정" });
    await expect(
      scheduleDialog.getByText(`${documentTitle} 완료`, { exact: true }),
    ).toBeVisible();
    await scheduleDialog.getByRole("button", {
      name: "완료 당시 버전 보기",
      exact: true,
    }).click();
    const completedRevisionDialog = page.getByRole("dialog", {
      name: "완료 당시 버전",
    });
    await expect(completedRevisionDialog).toContainText(firstText);
    await completedRevisionDialog.getByRole("button", {
      name: "완료 당시 버전 닫기",
    }).click();
    await expect(
      scheduleDialog.getByRole("button", {
        name: `${documentTitle} 완료 취소`,
        exact: true,
      }),
    ).toHaveCount(0);
    await scheduleDialog.getByRole("button", {
      name: "작업 일정 닫기",
      exact: true,
    }).click();

    await page.getByRole("button", {
      name: "작품 목록으로 돌아가기",
      exact: true,
    }).click();
    const todayCompletions = page.locator(".today-completion-list");
    await expect(todayCompletions.getByText(documentTitle, { exact: false }))
      .toBeVisible();
    await todayCompletions.locator("li", { hasText: documentTitle })
      .getByRole("button", { name: "현재 회차 열기", exact: true })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });

    await manuscript.pressSequentially(editedText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect(page.getByText("△ 완료 후 수정됨", { exact: true }))
      .toBeVisible();
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("△");

    await page.getByRole("button", { name: "다시 완료", exact: true }).click();
    await expect(page.getByText("✓ 완료됨", { exact: true })).toBeVisible();
    await page.getByRole("button", {
      name: "회차 완료 메뉴 열기",
      exact: true,
    }).click();
    await page.getByRole("menuitem", { name: "완료 취소", exact: true }).click();
    await expect(page.getByRole("button", { name: "회차 완료", exact: true }))
      .toBeVisible();
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("○");

    await openSchedule(page);
    scheduleDialog = page.getByRole("dialog", { name: "작업 일정" });
    await expect(
      scheduleDialog.getByText(`${documentTitle} 완료`, { exact: true }),
    ).toHaveCount(0);
    await scheduleDialog.getByRole("button", {
      name: "작업 일정 닫기",
      exact: true,
    }).click();

    const beforeRestart = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      const work = catalog.works.find((candidate) =>
        candidate.workId === catalog.activeWorkId
      );
      const document = work?.documents.find((candidate) =>
        candidate.documentId === catalog.activeDocumentId
      );
      if (work === undefined || document === undefined) return null;
      const schedule = await window.eumStudio.schedule.listWork({
        schemaVersion: 1,
        workId: work.workId,
        range: { from: "2026-01-01", to: "2026-12-31" },
      });
      return { completion: document.completion, scheduleItems: schedule.items.length };
    });
    expect(beforeRestart).toMatchObject({
      completion: { revision: 3, state: "incomplete" },
      scheduleItems: 0,
    });

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, `${firstText}${editedText}`);
    await expect(page.getByRole("button", { name: "회차 완료", exact: true }))
      .toBeVisible();
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("○");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("replaces exact plot sources and returns to them across restart", async () => {
  test.setTimeout(120_000);
  const readCurrentManuscriptText = async (manuscript: Locator) =>
    manuscript.evaluate((editor) =>
      Array.from(editor.querySelectorAll(".cm-line"))
        .filter((line) => line.closest(".previous-flow-context") === null)
        .map((line) => line.textContent ?? "")
        .join("\n"),
    );
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-sources-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = `첫 회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째 회차-${randomUUID().slice(0, 8)}`;
  const plotTitle = `사라진 기록-${randomUUID().slice(0, 8)}`;
  const firstPrefix = `${randomUUID()} 앞\n`;
  const firstExactText = `첫 플롯 근거 ${randomUUID()}`;
  const firstSuffix = `\n뒤 ${randomUUID()}`;
  const firstManuscript = `${firstPrefix}${firstExactText}${firstSuffix}`;
  const secondPrefix = `${randomUUID()} 새 앞\n`;
  const secondExactText = `교체한 플롯 근거 ${randomUUID()}`;
  const secondSuffix = `\n새 뒤 ${randomUUID()}`;
  const secondManuscript = `${secondPrefix}${secondExactText}${secondSuffix}`;
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    const firstDocumentId = await readActiveDocumentId(page);
    await manuscript.click();
    await manuscript.pressSequentially(firstManuscript);
    await expect.poll(() => readCurrentManuscriptText(manuscript))
      .toBe(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < firstSuffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < firstExactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(firstExactText);

    await openStructureTab(page, "플롯");
    let dialog = page.getByRole("region", { name: "플롯 작업면" });
    await dialog.getByLabel("플롯 제목").fill(plotTitle);
    await dialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "현재 선택 연결", exact: true })
      .click();
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(firstExactText, { useInnerText: true });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" })).toContainText(
      firstDocumentTitle,
    );
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    const secondDocumentId = await readActiveDocumentId(page);
    expect(secondDocumentId).not.toBe(firstDocumentId);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect.poll(() => readCurrentManuscriptText(manuscript))
      .toBe(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < secondSuffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < secondExactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(secondExactText);

    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await dialog
      .getByRole("button", { name: "현재 선택으로 교체", exact: true })
      .click();
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(secondExactText, { useInnerText: true });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" })).toContainText(
      secondDocumentTitle,
    );
    await openWorkSection(page, "쓰기");
    await activateDocumentFromTree(page, firstDocumentTitle);
    await electronApp.close();

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(secondExactText, { useInnerText: true });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" })).toContainText(
      secondDocumentTitle,
    );
    await dialog
      .getByRole("button", { name: "원문 열기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(secondExactText);
    await expect.poll(() => readCurrentManuscriptText(manuscript))
      .toBe(secondManuscript);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("derives one Work structure overview and navigates its exact sources", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-structure-"),
  );
  const workTitle = `구조 작품-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `첫 회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째 회차-${randomUUID().slice(0, 8)}`;
  const characterName = `기록자-${randomUUID().slice(0, 8)}`;
  const plotTitle = `사라진 기록-${randomUUID().slice(0, 8)}`;
  const eventTitle = `발견 사건-${randomUUID().slice(0, 8)}`;
  const prefix = `${randomUUID()} 앞\n`;
  const exactSource = `정확한 구조 근거 ${randomUUID()}`;
  const suffix = `\n뒤 ${randomUUID()}`;
  const manuscriptText = `${prefix}${exactSource}${suffix}`;
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    const firstDocumentId = await readActiveDocumentId(page);
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactSource.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactSource);

    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("플롯 제목").fill(plotTitle);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "현재 선택 연결", exact: true })
      .click();
    await expect(plotDialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(exactSource, { useInnerText: true });
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog
      .getByRole("button", { name: "등록", exact: true })
      .click();
    await manuscript.press("ArrowRight");
    await page
      .getByRole("button", { name: "장면 추가", exact: true })
      .click();

    await openStructureTab(page, "인물");
    let characterDialog = page.getByRole("region", { name: "인물 작업면" });
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(characterName);
    await characterDialog.getByLabel("인물 역할").fill("기록자");
    await characterDialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    const secondDocumentId = await readActiveDocumentId(page);

    await openStructureTab(page, "개요");
    let structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await expect(structureDialog).toContainText(workTitle);
    for (const [testId, count] of [
      ["structure-total-documents", "2"],
      ["structure-total-characters", "1"],
      ["structure-total-plots", "1"],
      ["structure-total-plot-sources", "1"],
      ["structure-total-events", "1"],
      ["structure-total-scenes", "3"],
    ] as const) {
      await expect(structureDialog.getByTestId(testId).locator("strong"))
        .toHaveText(count);
    }
    await expect(structureDialog).toContainText(firstDocumentTitle);
    await expect(structureDialog).toContainText(secondDocumentTitle);
    await expect(structureDialog).toContainText(characterName);
    await expect(structureDialog).toContainText(plotTitle);
    await expect(structureDialog).toContainText(exactSource);
    await expect(structureDialog).toContainText(eventTitle);

    await structureDialog
      .getByRole("button", { name: `${characterName} 인물 열기`, exact: true })
      .click();
    characterDialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(characterDialog.getByLabel("인물 이름", { exact: true })).toHaveValue(
      characterName,
    );
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await structureDialog
      .getByRole("button", { name: `${plotTitle} 플롯 열기`, exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(plotTitle);
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await structureDialog
      .getByRole("region", { name: "회차 구조" })
      .getByRole("button", { name: new RegExp(firstDocumentTitle) })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await activateDocumentFromTree(page, secondDocumentTitle);
    expect(await readActiveDocumentId(page)).toBe(secondDocumentId);

    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await structureDialog
      .getByRole("button", { name: `${plotTitle} 원문 열기`, exact: true })
      .click();
    await expect(structureDialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactSource);
    expect(await readActiveDocumentId(page)).toBe(firstDocumentId);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages Work-owned lore with exact evidence and history across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-entries-"),
  );
  const workTitle = `별빛 작품-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `첫 회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째 회차-${randomUUID().slice(0, 8)}`;
  const initialTitle = `북쪽 탑-${randomUUID().slice(0, 8)}`;
  const updatedTitle = `종이 울리는 탑-${randomUUID().slice(0, 8)}`;
  const initialContent = `첫 확정 내용 ${randomUUID()}`;
  const updatedContent = `수정 확정 내용 ${randomUUID()}`;
  const category = `장소-${randomUUID().slice(0, 8)}`;
  const firstPrefix = `${randomUUID()} 앞\n`;
  const firstExactText = `첫 별빛 근거 ${randomUUID()}`;
  const firstSuffix = `\n뒤 ${randomUUID()}`;
  const firstManuscript = `${firstPrefix}${firstExactText}${firstSuffix}`;
  const secondPrefix = `${randomUUID()} 새 앞\n`;
  const secondExactText = `둘째 별빛 근거 ${randomUUID()}`;
  const secondSuffix = `\n새 뒤 ${randomUUID()}`;
  const secondManuscript = `${secondPrefix}${secondExactText}${secondSuffix}`;
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

  const selectExactTextFromEnd = async (
    manuscript: Locator,
    exactText: string,
    suffix: string,
  ) => {
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    const firstDocumentId = await readActiveDocumentId(page);
    await manuscript.click();
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactTextFromEnd(manuscript, firstExactText, firstSuffix);

    await openStructureTab(page, "개요");
    let structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("0");
    await openStructureTab(page, "별빛");
    let loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await expect(loreDialog).toContainText("이 작품에 등록한 별빛이 없습니다.");
    await loreDialog.getByLabel("별빛 이름").fill(initialTitle);
    await loreDialog.getByLabel("별빛 사용자 분류").fill(category);
    await loreDialog.getByLabel("별빛 별칭").fill("북탑\n종탑");
    await loreDialog.getByLabel("별빛 확정 내용").fill(initialContent);
    await expect(
      loreDialog.getByLabel("현재 선택을 첫 근거로 포함"),
    ).toBeChecked();
    await loreDialog
      .getByRole("button", { name: "별빛 만들기", exact: true })
      .click();
    await expect(loreDialog.getByLabel("별빛 이름")).toHaveValue(initialTitle);
    await expect(loreDialog.locator(".lore-evidence-panel blockquote"))
      .toHaveText(firstExactText, { useInnerText: true });
    await expect(loreDialog.locator(".lore-evidence-panel"))
      .toContainText(firstDocumentTitle);
    await expect(loreDialog.locator(".lore-history-panel")).toContainText("생성");

    await loreDialog.getByLabel("별빛 이름").fill(updatedTitle);
    await loreDialog.getByLabel("별빛 확정 내용").fill(updatedContent);
    await loreDialog.getByLabel("별빛 활성").uncheck();
    await loreDialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    await expect(loreDialog.getByLabel("별빛 이름")).toHaveValue(updatedTitle);
    await expect(loreDialog.getByLabel("별빛 확정 내용"))
      .toHaveValue(updatedContent);
    await expect(loreDialog.locator(".lore-history-panel"))
      .toContainText("내용 변경");
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactTextFromEnd(manuscript, secondExactText, secondSuffix);

    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("1");
    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog
      .getByRole("button", { name: "현재 선택을 근거로 추가", exact: true })
      .click();
    await expect(loreDialog.locator(".lore-evidence-panel blockquote"))
      .toHaveCount(2);
    await expect(loreDialog.locator(".lore-evidence-panel"))
      .toContainText(secondExactText);
    await expect(loreDialog.locator(".lore-history-panel"))
      .toContainText("원고 근거 추가");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await expect(loreDialog.getByLabel("별빛 이름")).toHaveValue(updatedTitle);
    await expect(loreDialog.getByLabel("별빛 사용자 분류")).toHaveValue(category);
    await expect(loreDialog.getByLabel("별빛 별칭")).toHaveValue("북탑\n종탑");
    await expect(loreDialog.getByLabel("별빛 확정 내용"))
      .toHaveValue(updatedContent);
    await expect(loreDialog.getByLabel("별빛 활성")).not.toBeChecked();
    await expect(loreDialog.locator(".lore-evidence-panel blockquote"))
      .toHaveCount(2);
    await expect(loreDialog.locator(".lore-history-panel li")).toHaveCount(3);

    const firstEvidence = loreDialog
      .locator(".lore-evidence-panel li")
      .filter({ hasText: firstExactText });
    await firstEvidence
      .getByRole("button", { name: "원문 열기", exact: true })
      .click();
    await expect(loreDialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(firstExactText);
    expect(await readActiveDocumentId(page)).toBe(firstDocumentId);

    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog
      .getByRole("button", { name: "별빛 치우기", exact: true })
      .click();
    await expect(loreDialog).toContainText("이 작품에 등록한 별빛이 없습니다.");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("links Work-owned lore and foreshadow lines from both management surfaces across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-foreshadow-links-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `연결 작품-${suffix}`;
  const documentTitle = `첫 회차-${suffix}`;
  const loreTitle = `북쪽 탑-${suffix}`;
  const lineTitle = `세 번의 종소리-${suffix}`;
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

    await openStructureTab(page, "복선");
    let foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    await foreshadowDialog.getByLabel("새 복선 이름").fill(lineTitle);
    await foreshadowDialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await expect(
      foreshadowDialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(
      lineTitle,
    );
    await openStructureTab(page, "별빛");
    let loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog.getByLabel("별빛 이름").fill(loreTitle);
    await loreDialog.getByLabel("별빛 확정 내용").fill("종이 세 번 울린다.");
    await loreDialog
      .getByRole("button", { name: "별빛 만들기", exact: true })
      .click();
    const loreLinks = loreDialog.getByRole("region", {
      name: "별빛과 연결된 복선",
    });
    await loreLinks.getByLabel("연결할 복선").selectOption({ label: lineTitle });
    await loreLinks
      .getByRole("button", { name: "복선 연결", exact: true })
      .click();
    await expect(loreLinks).toContainText(lineTitle);
    await expect(loreLinks.getByRole("button", { name: "연결 해제" }))
      .toHaveCount(1);
    await openStructureTab(page, "복선");
    foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    let foreshadowLoreLinks = foreshadowDialog.getByRole("region", {
      name: `${lineTitle} 연결된 별빛`,
    });
    await expect(foreshadowLoreLinks).toContainText(loreTitle);
    await foreshadowLoreLinks
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(foreshadowLoreLinks).toContainText(
      "아직 연결한 별빛이 없습니다.",
    );
    await foreshadowLoreLinks
      .getByLabel(`${lineTitle} 연결할 별빛`)
      .selectOption({ label: loreTitle });
    await foreshadowLoreLinks
      .getByRole("button", { name: "별빛 연결", exact: true })
      .click();
    await expect(foreshadowLoreLinks).toContainText(loreTitle);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);

    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await expect(
      loreDialog.getByRole("region", { name: "별빛과 연결된 복선" }),
    ).toContainText(lineTitle);
    await loreDialog
      .getByRole("button", { name: "별빛 치우기", exact: true })
      .click();
    await expect(loreDialog).toContainText("이 작품에 등록한 별빛이 없습니다.");
    await openStructureTab(page, "복선");
    foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    await expect(
      foreshadowDialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(
      lineTitle,
    );
    foreshadowLoreLinks = foreshadowDialog.getByRole("region", {
      name: `${lineTitle} 연결된 별빛`,
    });
    await expect(foreshadowLoreLinks).toContainText(
      "먼저 이 작품에 별빛을 만드세요.",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("connects exact foreshadow points and derives payoff across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-foreshadow-points-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const lineTitle = `종소리-${randomUUID().slice(0, 8)}`;
  const prefix = `${randomUUID()} 앞\n`;
  const exactPointText = `  ${randomUUID()} 종소리가 세 번 울렸다.  `;
  const suffix = `\n뒤 ${randomUUID()}`;
  const manuscriptText = `${prefix}${exactPointText}${suffix}`;
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
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactPointText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactPointText);

    await openStructureTab(page, "복선");
    let dialog = page.getByRole("region", { name: "복선 라인" });
    await dialog.getByLabel("새 복선 이름").fill(lineTitle);
    await dialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    const roleSelect = dialog.getByLabel("지점 역할");
    const captureButton = dialog.getByRole("button", {
      name: "선택 지점 연결",
      exact: true,
    });

    await roleSelect.selectOption("plant");
    await dialog.getByLabel("지점 메모").fill("첫 배치");
    await captureButton.click();
    await expect(dialog.locator(".foreshadow-point-list")).toContainText(
      "배치",
    );
    await expect(dialog.locator(".foreshadow-point-list pre").first())
      .toHaveText(exactPointText, { useInnerText: true });
    await expect(dialog.locator(".foreshadow-line-resolution"))
      .toHaveText("미회수");

    await expect(captureButton).toBeEnabled();
    await roleSelect.selectOption("reinforcement");
    await dialog.getByLabel("지점 메모").fill("강화 단서");
    await captureButton.click();
    await expect(dialog.locator(".foreshadow-point-list")).toContainText(
      "강화",
    );

    await expect(captureButton).toBeEnabled();
    await roleSelect.selectOption("payoff");
    await dialog.getByLabel("지점 메모").fill("회수 지점");
    await captureButton.click();
    await expect(dialog.locator(".foreshadow-point-list")).toContainText(
      "회수",
    );
    await expect(dialog.locator(".foreshadow-line-resolution"))
      .toHaveText("회수 완료");
    await expect(dialog.locator(".foreshadow-point-list > li")).toHaveCount(3);
    await openWorkSection(page, "쓰기");
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
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(dialog.locator(".foreshadow-point-list > li")).toHaveCount(3);
    await expect(dialog.locator(".foreshadow-line-resolution"))
      .toHaveText("회수 완료");
    await expect(dialog.locator(".foreshadow-point-list pre").first())
      .toHaveText(exactPointText, { useInnerText: true });
    await dialog
      .getByRole("button", { name: "원문 열기", exact: true })
      .first()
      .click();
    await expect(dialog).toBeHidden();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactPointText);
    await expectEditorText(manuscript, manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens a foreshadow point source across episodes with its exact selection", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-foreshadow-cross-episode-source-"),
  );
  const workTitle = randomUUID();
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const lineTitle = `복선-${randomUUID()}`;
  const pointNote = `메모-${randomUUID()}`;
  const prefix = `${randomUUID()} 앞 `;
  const exactPointText = `  ${randomUUID()} 교차 회차 복선  `;
  const suffix = ` 뒤 ${randomUUID()}`;
  const episodeAManuscript = `${prefix}${exactPointText}${suffix}`;
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
    for (let index = 0; index < exactPointText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactPointText);

    await openStructureTab(page, "복선");
    let dialog = page.getByRole("region", { name: "복선 라인" });
    await dialog.getByLabel("새 복선 이름").fill(lineTitle);
    await dialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await dialog.getByLabel("지점 역할").selectOption("plant");
    await dialog.getByLabel("지점 메모").fill(pointNote);
    const captureButton = dialog.getByRole("button", {
      name: "선택 지점 연결",
      exact: true,
    });
    await expect(captureButton).toBeEnabled();
    await captureButton.click();
    const point = dialog.locator(".foreshadow-point-list > li").first();
    await expect(dialog.locator(".foreshadow-point-list > li")).toHaveCount(1);
    await expect(point.locator("pre")).toHaveText(exactPointText, {
      useInnerText: true,
    });

    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, episodeAManuscript);
    await activateDocumentFromTree(page, episodeBTitle);
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeBDocumentId,
    );
    await expectEditorText(manuscript, episodeBManuscript);

    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await dialog
      .locator(".foreshadow-point-list > li")
      .first()
      .getByRole("button", { name: "원문 열기", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactPointText);
    await expectEditorText(manuscript, episodeAManuscript);

    await activateDocumentFromTree(page, episodeBTitle);
    await expectEditorText(manuscript, episodeBManuscript);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

