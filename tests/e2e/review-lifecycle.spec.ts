import { MUSIC_SETTINGS_SAVE_WORK_CHANNEL, NARRATIVE_DIGEST_GENERATE_CHANNEL } from "../../src/application/contracts/studio-bridge";
import { localMediaPlaybackUrl } from "../../src/application/music/media-track";
import {
  electron, expect, mkdtemp, openStudioHome, path, randomUUID,
  removeVerifiedTemporaryDirectory, test, tmpdir, writeFile, type Page,
} from "./support/desktop-shell-suite";

type RunningDesktop = Awaited<ReturnType<typeof electron.launch>>;
async function withDesktop(run: (app: RunningDesktop, page: Page, root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "eum-review-lifecycle-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${path.join(root, "user-data")}`], cwd: process.cwd(),
    env: { ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0", EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(root, "workspace"), EUM_STUDIO_WINDOW_VISIBILITY: "hidden" },
  });
  try { await run(app, await app.firstWindow(), root); }
  finally { await app.close().catch(() => undefined); await removeVerifiedTemporaryDirectory(root); }
}

async function createWork(page: Page) {
  const title = randomUUID(); const documentTitle = randomUUID();
  await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "새 작품 만들기" });
  await dialog.getByLabel("작품 제목").fill(title);
  await dialog.getByLabel("첫 회차 제목").fill(documentTitle);
  await dialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    return catalog.works.find((work) => work.workId === catalog.activeWorkId)?.title;
  })).toBe(title);
  return { title, documentTitle };
}

async function openDigest(page: Page) {
  await page.getByRole("navigation", { name: "작품 작업면" }).getByRole("button", { name: "별빛", exact: true }).click();
  await page.getByRole("region", { name: "별빛 작업" }).getByRole("tab", { name: "이야기 흐름", exact: true }).click();
  return page.getByRole("region", { name: "이야기 흐름", exact: true });
}

test("loads the active Work's automatic analysis setting after opening another Work's settings", async () => {
  test.setTimeout(90_000);
  await withDesktop(async (_app, page) => {
    const a = await createWork(page); await openStudioHome(page);
    const b = await createWork(page);
    await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      const current = await window.eumStudio.settings.getWorkSceneAnalysis({ schemaVersion: 1, workId: catalog.activeWorkId });
      await window.eumStudio.settings.saveWorkSceneAnalysis({ schemaVersion: 1, workId: current.workId, expectedRevision: current.revision, settings: { enabled: true } });
    });
    await openStudioHome(page);
    await page.getByRole("button", { name: `${a.title} 작품 열기`, exact: true }).click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "앱 설정" });
    await settings.getByRole("tab", { name: "조수·장면 분석", exact: true }).click();
    await expect(settings.getByLabel("장면 전환·분할·회차 전환 시 요약과 작품 정보·연속성 후보 생성")).not.toBeChecked();
    await settings.getByRole("button", { name: "앱 설정 닫기", exact: true }).click();
    await openStudioHome(page);
    await page.getByRole("button", { name: `${b.title} 작품 열기`, exact: true }).click();
    await expect(page.getByLabel("자동 장면 분석 상태")).toHaveText("켜짐");
  });
});

test("retries a partially failed settings save with the committed revision in the real renderer", async () => {
  test.setTimeout(90_000);
  await withDesktop(async (app, page) => {
    await createWork(page);
    const original = await page.evaluate(() => window.eumStudio.settings.get());
    const failure = "Review fixture music write failed";
    await app.evaluate(({ ipcMain }, config) => {
      ipcMain.removeHandler(config.channel);
      ipcMain.handle(config.channel, () => { throw new Error(config.failure); });
    }, { channel: MUSIC_SETTINGS_SAVE_WORK_CHANNEL, failure });
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "앱 설정" });
    for (const increment of [1, 2]) {
      await settings.getByLabel("1회 기준 글자수").fill(String(original.settings.defaultEpisodeCharacters + increment));
      await settings.getByRole("button", { name: "저장", exact: true }).click();
      await expect(settings.getByRole("alert")).toContainText(failure);
      await expect.poll(async () => (await page.evaluate(() => window.eumStudio.settings.get())).revision).toBe(original.revision + increment);
      await expect(settings.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
    }
    await settings.getByRole("button", { name: "앱 설정 닫기", exact: true }).click();
  });
});

test("ignores an old manual digest permission response after changing Works in the real renderer", async () => {
  test.setTimeout(90_000);
  await withDesktop(async (app, page) => {
    const a = await createWork(page);
    await page.getByRole("textbox", { name: "원고", exact: true }).fill(randomUUID());
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await app.evaluate(({ ipcMain }, config) => {
      const host = globalThis as unknown as { digestReviewFixture: { called: boolean; release?: () => void } };
      host.digestReviewFixture = { called: false };
      ipcMain.removeHandler(config.channel);
      ipcMain.handle(config.channel, () => {
        host.digestReviewFixture.called = true;
        return new Promise((resolve) => { host.digestReviewFixture.release = () => resolve({ schemaVersion: 1, status: "permission-required", missing: [], destinationId: config.destinationId }); });
      });
    }, { channel: NARRATIVE_DIGEST_GENERATE_CHANNEL, destinationId: randomUUID() });
    let panel = await openDigest(page);
    await panel.getByRole("checkbox", { name: a.documentTitle, exact: true }).check();
    await panel.getByRole("button", { name: "이 범위로 생성", exact: true }).click();
    await expect.poll(() => app.evaluate(() => (globalThis as unknown as { digestReviewFixture: { called: boolean } }).digestReviewFixture.called)).toBe(true);
    await openStudioHome(page); await createWork(page);
    panel = await openDigest(page);
    await app.evaluate(() => (globalThis as unknown as { digestReviewFixture: { release: () => void } }).digestReviewFixture.release());
    await page.evaluate(async () => { await window.eumStudio.workspace.getCatalog(); await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
    await expect(panel.getByRole("button", { name: "이 범위를 허용하고 다시 생성", exact: true })).toHaveCount(0);
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "새로고침", exact: true })).toBeEnabled();
  });
});

test("refuses changed registered media bytes through the production media protocol", async () => {
  test.setTimeout(90_000);
  await withDesktop(async (app, page, root) => {
    await createWork(page);
    const source = path.join(root, `${randomUUID()}.mp3`);
    await writeFile(source, Buffer.from([0x49, 0x44, 0x33, 0x03]));
    await app.evaluate(({ dialog }, selected) => { Object.defineProperty(dialog, "showOpenDialog", { configurable: true, value: async () => ({ canceled: false, filePaths: [selected] }) }); }, source);
    await page.getByRole("button", { name: "선곡·재생목록 열기", exact: true }).click();
    const library = page.getByRole("dialog", { name: "음악 선곡과 재생목록", exact: true });
    await library.getByRole("button", { name: "원본 위치 연결", exact: true }).click();
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return null;
      const settings = await window.eumStudio.settings.getWorkMusic({ schemaVersion: 1, workId: catalog.activeWorkId });
      return settings.settings.localMedia[0] ?? null;
    })).not.toBeNull();
    const registered = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected a Work");
      return (await window.eumStudio.settings.getWorkMusic({ schemaVersion: 1, workId: catalog.activeWorkId })).settings.localMedia[0]!;
    });
    const url = localMediaPlaybackUrl(registered);
    expect(await app.evaluate(async ({ net }, address) => (await net.fetch(address)).status, url)).toBe(200);
    await writeFile(source, Buffer.from([0x49, 0x44, 0x33, 0x09]));
    expect(await app.evaluate(async ({ net }, address) => (await net.fetch(address)).status, url)).toBe(404);
    await library.getByRole("button", { name: "음악 창 닫기", exact: true }).click();
  });
});
