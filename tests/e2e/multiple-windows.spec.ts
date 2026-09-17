import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  continueFromMain, createNamedEpisode, documentTreeButton, electron, expect,
  expectEditorText, mkdtemp, path, randomUUID, removeVerifiedTemporaryDirectory,
  test, tmpdir, writeFile,
} from "./support/desktop-shell-suite";

test("opens the same work in two independent windows and preserves both manuscripts after closing and restarting", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-multiple-windows-"));
  const userData = `--user-data-dir=${path.join(directory, "user-data")}`;
  const env = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const launch = () => electron.launch({ args: [".", userData], cwd: process.cwd(), env });
  let app = await launch();
  app.process().stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  const workTitle = randomUUID();
  const firstTitle = randomUUID();
  const secondTitle = randomUUID();
  const firstText = `첫 창 ${randomUUID()}`;
  const secondText = `둘째 창 ${randomUUID()}`;
  let succeeded = false;
  try {
    const first = await app.firstWindow();
    await first.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const dialog = first.getByRole("dialog", { name: "새 작품 만들기" });
    await dialog.getByLabel("작품 제목").fill(workTitle);
    await dialog.getByLabel("첫 회차 제목").fill(firstTitle);
    await dialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const firstEditor = first.getByRole("textbox", { name: "원고", exact: true });
    await firstEditor.fill(firstText);
    await expect(first.getByTestId("save-state")).toHaveText("저장됨");
    await createNamedEpisode(first, secondTitle);
    await documentTreeButton(first, firstTitle).click();
    await expect(first.getByTestId("manuscript-title")).toHaveText(firstTitle);
    const newWindow = app.waitForEvent("window");
    const executablePath = await app.evaluate(({ app: main }) => main.getPath("exe"));
    const secondProcess = spawn(executablePath, [".", userData], { cwd: process.cwd(), env, windowsHide: true });
    const [exitCode] = await once(secondProcess, "exit");
    expect(exitCode).toBe(0);
    const second = await newWindow;
    await continueFromMain(second);
    await documentTreeButton(second, secondTitle).click();
    await expect(second.getByTestId("manuscript-title")).toHaveText(secondTitle);
    const secondEditor = second.getByRole("textbox", { name: "원고", exact: true });
    await secondEditor.fill(secondText);
    await expect(second.getByTestId("save-state")).toHaveText("저장됨");
    await expect(first.getByTestId("manuscript-title")).toHaveText(firstTitle);
    await firstEditor.fill(`${firstText} 계속`);
    await expect(first.getByTestId("save-state")).toHaveText("저장됨");
    await expect(second.getByTestId("manuscript-title")).toHaveText(secondTitle);
    const firstWindow = await app.browserWindow(first);
    await firstWindow.evaluate((window) => window.close());
    await expect.poll(() => app.windows().length).toBe(1);
    await secondEditor.fill(`${secondText} 계속`);
    await expect(second.getByTestId("save-state")).toHaveText("저장됨");
    await app.close();
    app = await launch();
    const reopened = await app.firstWindow();
    await continueFromMain(reopened);
    await documentTreeButton(reopened, firstTitle).click();
    await expectEditorText(reopened.getByRole("textbox", { name: "원고", exact: true }), `${firstText} 계속`);
    await documentTreeButton(reopened, secondTitle).click();
    await expectEditorText(reopened.getByRole("textbox", { name: "원고", exact: true }), `${secondText} 계속`);
    succeeded = true;
  } finally {
    if (!succeeded && app.process().exitCode === null) {
      await app.evaluate(({ app: main }) => main.exit(0)).catch(() => undefined);
    } else {
      await app.close();
    }
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("refreshes the same episode between windows and keeps the first window alive when the second closes", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-shared-episode-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "user-data")}`],
    cwd: process.cwd(),
    env: { ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0", EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory, EUM_STUDIO_WINDOW_VISIBILITY: "visible" },
  });
  const mainProcessId = await app.evaluate(() => process.pid);
  app.process().stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  let succeeded = false;
  try {
    const first = await app.firstWindow();
    await first.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const dialog = first.getByRole("dialog", { name: "새 작품 만들기" });
    const title = randomUUID();
    await dialog.getByLabel("작품 제목").fill(randomUUID());
    await dialog.getByLabel("첫 회차 제목").fill(title);
    await dialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const firstEditor = first.getByRole("textbox", { name: "원고", exact: true });
    const text = `함께 여는 원고 ${randomUUID()}`;
    await firstEditor.fill(text);
    await expect(first.getByTestId("save-state")).toHaveText("저장됨");
    const newWindow = app.waitForEvent("window");
    const firstWindow = await app.browserWindow(first);
    await firstWindow.evaluate((window) => window.webContents.sendInputEvent({ type: "keyDown", keyCode: "N", modifiers: ["control", "shift"] }));
    const second = await newWindow;
    await continueFromMain(second);
    const secondEditor = second.getByRole("textbox", { name: "원고", exact: true });
    await expectEditorText(secondEditor, text);
    const secondWindow = await app.browserWindow(second);
    await firstWindow.evaluate((window) => window.focus());
    await firstEditor.fill(`${text} 첫 창에서 저장`);
    await expect(first.getByTestId("save-state")).toHaveText("저장됨");
    await secondWindow.evaluate((window) => window.focus());
    await expectEditorText(secondEditor, `${text} 첫 창에서 저장`);
    await secondEditor.fill(`${text} 두 번째 창에서도 저장`);
    await expect(second.getByTestId("save-state")).toHaveText("저장됨");
    await firstWindow.evaluate((window) => window.focus());
    await expectEditorText(firstEditor, `${text} 두 번째 창에서도 저장`);
    for (const [index, window] of [firstWindow, secondWindow].entries()) {
      const png = await window.evaluate(async (value) => (await value.capturePage()).toPNG().toString("base64"));
      await writeFile(test.info().outputPath(`shared-window-${index + 1}.png`), Buffer.from(png, "base64"));
    }
    await secondWindow.evaluate((window) => window.close());
    await expect.poll(() => app.windows().length).toBe(1);
    await firstEditor.fill(`${text} 남은 창에서 계속`);
    await expect(first.getByTestId("save-state")).toHaveText("저장됨");
    succeeded = true;
  } finally {
    if (!succeeded && app.process().exitCode === null) {
      process.kill(mainProcessId, "SIGKILL");
      await app.close().catch(() => undefined);
    } else {
      await app.close();
    }
    await removeVerifiedTemporaryDirectory(directory);
  }
});
