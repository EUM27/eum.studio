import { cp, readFile } from "node:fs/promises";
import {
  continueFromMain, electron, expect, mkdtemp, path, randomUUID,
  removeVerifiedTemporaryDirectory, test, tmpdir, writeFile, type Page,
} from "./support/desktop-shell-suite";

const player = (page: Page) => page.getByRole("region", { name: "음악 플레이어", exact: true });
const media = (page: Page) => page.locator(".music-mini-local-media");
const nativePlaying = (page: Page) => media(page).evaluate((element) => {
  const audio = element as HTMLMediaElement;
  return !audio.paused && audio.currentSrc.length > 0 ? 1 : 0;
});

test("shares one real player, previous and next controls, bulk media selection and playback handoff", async () => {
  test.setTimeout(180_000);
  const fixtureRoot = path.join(process.cwd(), "tests", "fixtures", "music");
  const fixture = JSON.parse(await readFile(path.join(fixtureRoot, "shared-player.manifest.json"), "utf8")) as { audioFile: string; trackTitles: string[]; durationSeconds: number };
  const directory = await mkdtemp(path.join(tmpdir(), "eum-shared-music-"));
  const mediaPaths = await Promise.all(fixture.trackTitles.map(async (title) => {
    const target = path.join(directory, `${title}.mp3`);
    await cp(path.join(fixtureRoot, fixture.audioFile), target);
    return target;
  }));
  const env = { ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0", EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"), EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS: JSON.stringify(mediaPaths), EUM_STUDIO_WINDOW_VISIBILITY: "hidden" };
  const launch = () => electron.launch({ args: [".", `--user-data-dir=${path.join(directory, "user-data")}`], cwd: process.cwd(), env });
  let app = await launch();
  let mainPid = await app.evaluate(() => process.pid);
  app.process().stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  let succeeded = false;
  try {
    const first = await app.firstWindow();
    await first.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const create = first.getByRole("dialog", { name: "새 작품 만들기" });
    await create.getByLabel("작품 제목").fill(randomUUID());
    await create.getByLabel("첫 회차 제목").fill(randomUUID());
    await create.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await expect(player(first)).toHaveAttribute("data-playback-owner", "true");
    const firstWindow = await app.browserWindow(first);
    const opened = app.waitForEvent("window");
    await firstWindow.evaluate((window) => window.webContents.sendInputEvent({ type: "keyDown", keyCode: "N", modifiers: ["control", "shift"] }));
    const second = await opened;
    await continueFromMain(second);
    await expect(player(second)).toHaveAttribute("data-playback-owner", "false");

    await player(first).getByRole("button", { name: "선곡·재생목록 열기", exact: true }).click();
    const library = first.getByRole("dialog", { name: "음악 선곡과 재생목록" });
    await library.getByRole("button", { name: "원본 위치 연결", exact: true }).click();
    await library.getByRole("tab", { name: "내 미디어 탭", exact: true }).click();
    await expect(library.getByRole("region", { name: "내 미디어", exact: true }).getByRole("listitem")).toHaveCount(fixture.trackTitles.length);
    const middleTitle = fixture.trackTitles[1]!;
    const lastTitle = fixture.trackTitles[2]!;
    await library.getByRole("button", { name: `${middleTitle} 바로 재생`, exact: true }).click();
    await expect(player(first)).toContainText(middleTitle);
    await expect(player(second)).toContainText(middleTitle);
    await expect.poll(async () => (await nativePlaying(first)) + (await nativePlaying(second))).toBe(1);
    await player(second).getByRole("button", { name: "다음 곡", exact: true }).click();
    await expect(player(first)).toContainText(lastTitle);
    await expect(player(second)).toContainText(lastTitle);
    await expect.poll(() => nativePlaying(first)).toBe(1);
    // Previous must select the preceding song even after this song has progressed.
    const seekOffset = fixture.durationSeconds / 2;
    await second.evaluate((value) => window.eumStudio.musicPlayback.shared!.command({ type: "seek", value }), seekOffset);
    await expect.poll(() => media(first).evaluate((element) => (element as HTMLMediaElement).currentTime)).toBeGreaterThanOrEqual(seekOffset);
    await player(second).getByRole("button", { name: "이전 곡", exact: true }).click();
    await expect(player(first)).toContainText(middleTitle);
    await expect(player(second)).toContainText(middleTitle);

    await library.getByRole("checkbox", { name: `${fixture.trackTitles[0]} 선택`, exact: true }).check();
    await expect(library.getByRole("checkbox", { name: "내 미디어 전체 선택", exact: true })).toHaveJSProperty("indeterminate", true);
    await library.getByRole("checkbox", { name: "내 미디어 전체 선택", exact: true }).check();
    await library.getByRole("button", { name: "선택 곡 재생목록에 추가", exact: true }).click();
    await library.getByRole("tab", { name: "재생목록 탭", exact: true }).click();
    await expect(library.getByRole("region", { name: "재생목록", exact: true }).getByRole("listitem")).toHaveCount(fixture.trackTitles.length);
    await player(second).getByRole("button", { name: "선곡·재생목록 열기", exact: true }).click();
    const secondLibrary = second.getByRole("dialog", { name: "음악 선곡과 재생목록" });
    await expect(secondLibrary.getByRole("region", { name: "재생목록", exact: true }).getByRole("listitem")).toHaveCount(fixture.trackTitles.length);
    await secondLibrary.getByRole("button", { name: "음악 창 닫기", exact: true }).click();
    await player(second).getByRole("button", { name: "음악 일시정지", exact: true }).click();
    await expect.poll(() => nativePlaying(first)).toBe(0);
    await expect(player(first).getByRole("button", { name: "음악 재생", exact: true })).toBeVisible();
    const nextVolume = Math.max(0, Number(await player(first).locator('input[aria-label="음량"]').inputValue()) - 1);
    await second.evaluate((value) => window.eumStudio.musicPlayback.shared!.command({ type: "volume", value }), nextVolume);
    await expect(player(first).locator('input[aria-label="음량"]')).toHaveValue(String(nextVolume));
    await expect(player(second).locator('input[aria-label="음량"]')).toHaveValue(String(nextVolume));
    await library.getByRole("tab", { name: "내 미디어 탭", exact: true }).click();
    await expect(library.getByRole("checkbox", { name: "내 미디어 전체 선택", exact: true })).toBeVisible();
    await first.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const capture = await firstWindow.evaluate(async (window) => (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString("base64"));
    await writeFile(test.info().outputPath("bulk-media-selection.png"), Buffer.from(capture, "base64"));
    await library.getByRole("button", { name: "음악 창 닫기", exact: true }).click();
    await firstWindow.evaluate((window) => window.close());
    await expect.poll(() => app.windows().length).toBe(1);
    await expect(player(second)).toHaveAttribute("data-playback-owner", "true");
    await expect(player(second)).toContainText(middleTitle);
    await expect.poll(() => media(second).evaluate((element) => (element as HTMLMediaElement).readyState)).toBeGreaterThanOrEqual(2);
    expect(await nativePlaying(second)).toBe(0);
    await player(second).getByRole("button", { name: "음악 재생", exact: true }).click();
    await expect.poll(() => nativePlaying(second)).toBe(1);
    expect(await media(second).evaluate((element) => (element as HTMLMediaElement).error)).toBeNull();
    const secondWindow = await app.browserWindow(second);
    const thirdOpened = app.waitForEvent("window");
    await secondWindow.evaluate((window) => window.webContents.sendInputEvent({ type: "keyDown", keyCode: "N", modifiers: ["control", "shift"] }));
    const third = await thirdOpened;
    await continueFromMain(third);
    await expect(player(third)).toContainText(middleTitle);
    await expect(player(third)).toHaveAttribute("data-playback-owner", "false");
    await secondWindow.evaluate((window) => window.close());
    await expect.poll(() => app.windows().length).toBe(1);
    await expect(player(third)).toHaveAttribute("data-playback-owner", "true");
    await expect.poll(() => nativePlaying(third)).toBe(1);
    await expect.poll(() => media(third).evaluate((element) => (element as HTMLMediaElement).currentTime)).toBeGreaterThan(0);
    await player(third).getByRole("button", { name: "음악 정지", exact: true }).click();
    await app.close();
    app = await launch();
    mainPid = await app.evaluate(() => process.pid);
    const reopened = await app.firstWindow();
    await continueFromMain(reopened);
    await player(reopened).getByRole("button", { name: "선곡·재생목록 열기", exact: true }).click();
    await expect(reopened.getByRole("dialog", { name: "음악 선곡과 재생목록" }).getByRole("region", { name: "재생목록", exact: true }).getByRole("listitem")).toHaveCount(fixture.trackTitles.length);
    succeeded = true;
  } finally {
    if (!succeeded) { try { process.kill(mainPid, "SIGKILL"); } catch { /* already exited */ } }
    await app.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
