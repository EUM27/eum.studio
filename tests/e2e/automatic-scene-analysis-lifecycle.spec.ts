import {
  ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL,
  NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL,
} from "../../src/application/contracts/studio-bridge";
import {
  electron, expect, mkdtemp, openStudioHome, path, randomUUID,
  removeVerifiedTemporaryDirectory, test, tmpdir,
} from "./support/desktop-shell-suite";

for (const outcome of ["failed", "login-required"] as const) {
  test(`isolates a delayed analysis ${outcome} after switching Works in the real renderer`, async () => {
    test.setTimeout(90_000);
    const directory = await mkdtemp(path.join(tmpdir(), "eum-analysis-lifecycle-"));
    const app = await electron.launch({
      args: [".", `--user-data-dir=${path.join(directory, "user-data")}`], cwd: process.cwd(),
      env: { ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
        EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
        EUM_STUDIO_WINDOW_VISIBILITY: "hidden" },
    });
    try {
      const page = await app.firstWindow();
      await page.setViewportSize({ width: 1280, height: 800 });
      const oauth = await page.evaluate(() => window.eumStudio.assistant.getChatGptOAuthStatus());
      // Delay the external-analysis boundary only. The packaged React controller,
      // editor, scene finalization, persistence and Work navigation remain real.
      await app.evaluate(({ ipcMain }, config) => {
        const host = globalThis as unknown as { analysisFixture: { calls: number; settled: boolean; release?: () => void } };
        host.analysisFixture = { calls: 0, settled: false };
        ipcMain.removeHandler(config.statusChannel);
        ipcMain.handle(config.statusChannel, () => ({ ...config.oauth, connected: true }));
        ipcMain.removeHandler(config.analysisChannel);
        ipcMain.handle(config.analysisChannel, () => {
          host.analysisFixture.calls += 1;
          return new Promise((resolve, reject) => {
            host.analysisFixture.release = () => {
              host.analysisFixture.settled = true;
              if (config.outcome === "failed") reject(new Error("Delayed analysis failure"));
              else resolve({ schemaVersion: 1, status: "login-required" });
            };
          });
        });
      }, { oauth, outcome, statusChannel: ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL, analysisChannel: NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL });
      await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
      let create = page.getByRole("dialog", { name: "새 작품 만들기" });
      await create.getByLabel("작품 제목").fill(randomUUID());
      await create.getByLabel("첫 회차 제목").fill(randomUUID());
      await create.getByRole("button", { name: "작품 만들기", exact: true }).click();
      const enableAnalysis = async () => {
        await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
        const settings = page.getByRole("dialog", { name: "앱 설정" });
        await settings.getByRole("tab", { name: "조수·장면 분석", exact: true }).click();
        await settings.getByLabel("장면 전환·분할·회차 전환 시 요약과 작품 정보·연속성 후보 생성").check();
        await settings.getByRole("button", { name: "저장", exact: true }).click();
        await expect(settings).toBeHidden();
      };
      await enableAnalysis();
      const manuscript = page.getByRole("textbox", { name: "원고", exact: true });
      await manuscript.fill(`${randomUUID()} ${randomUUID()}`);
      await expect(page.getByTestId("save-state")).toHaveText("저장됨");
      await manuscript.press("Control+Home");
      await manuscript.press("ArrowRight");
      const caret = await manuscript.locator(".cm-line").first().evaluate((line) => {
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        let offset = Math.floor((line.textContent?.length ?? 0) / 2);
        let node = walker.nextNode();
        while (node instanceof Text) {
          if (offset < node.length) {
            const range = document.createRange();
            range.setStart(node, offset); range.setEnd(node, offset + 1);
            const rect = range.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
          offset -= node.length; node = walker.nextNode();
        }
        throw new Error("Expected manuscript split point");
      });
      await page.mouse.click(caret.x, caret.y, { button: "right" });
      await page.getByRole("menu", { name: "원고 우클릭 메뉴" })
        .getByRole("menuitem", { name: "장면 나누기", exact: true }).click();
      await expect.poll(() => app.evaluate(() => (globalThis as unknown as { analysisFixture: { calls: number } }).analysisFixture.calls)).toBe(1);
      await expect(page.getByLabel("자동 장면 분석 상태")).toHaveText("분석 중");
      await openStudioHome(page);
      await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
      create = page.getByRole("dialog", { name: "새 작품 만들기" });
      await create.getByLabel("작품 제목").fill(randomUUID());
      await create.getByLabel("첫 회차 제목").fill(randomUUID());
      await create.getByRole("button", { name: "작품 만들기", exact: true }).click();
      await enableAnalysis();
      await expect(page.getByLabel("자동 장면 분석 상태")).toHaveText("켜짐");
      await app.evaluate(() => (globalThis as unknown as { analysisFixture: { release: () => void } }).analysisFixture.release());
      await page.evaluate(async () => {
        await window.eumStudio.workspace.getCatalog();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      await expect(page.getByLabel("자동 장면 분석 상태")).toHaveText("켜짐");
      await expect(page.locator(".automatic-scene-analysis-status").getByRole("button", { name: "다시 시도" })).toHaveCount(0);
      expect(await app.evaluate(() => {
        const { calls, settled } = (globalThis as unknown as { analysisFixture: { calls: number; settled: boolean } }).analysisFixture;
        return { calls, settled };
      }))
        .toMatchObject({ calls: 1, settled: true });
    } finally {
      await app.close().catch(() => undefined);
      await removeVerifiedTemporaryDirectory(directory);
    }
  });
}
