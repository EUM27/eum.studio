import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";

type RunningElectron = Awaited<ReturnType<typeof electron.launch>>;

function attachDiagnostics(app: RunningElectron): void {
  app.process().stdout?.on("data", (chunk) => {
    process.stderr.write(`[window-lifecycle stdout] ${String(chunk)}`);
  });
  app.process().stderr?.on("data", (chunk) => {
    process.stderr.write(`[window-lifecycle stderr] ${String(chunk)}`);
  });
}

async function closeElectron(app: RunningElectron): Promise<void> {
  const child = app.process();
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (!closed && child.exitCode === null && child.signalCode === null) {
    const exit = once(child, "exit").catch(() => undefined);
    child.kill("SIGKILL");
    await exit;
  }
}

test("recovers the main window after its renderer exits and then releases the process", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(path.join(os.tmpdir(), "eum-window-lifecycle-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
      EUM_STUDIO_WINDOW_VISIBILITY: "visible",
      EUM_STUDIO_DISABLE_SANDBOX: "1",
    },
  });
  attachDiagnostics(app);
  let completed = false;
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("button", { name: "작품 만들기", exact: true }))
      .toBeVisible();
    const window = await app.browserWindow(page);
    const rendererProcessId = await window.evaluate((value) =>
      value.webContents.getOSProcessId()
    );

    await window.evaluate((value) => value.webContents.forcefullyCrashRenderer());

    await expect.poll(async () => window.evaluate((value) => ({
      crashed: value.webContents.isCrashed(),
      processId: value.webContents.getOSProcessId(),
      visible: value.isVisible(),
    })).then((state) =>
      !state.crashed &&
      state.visible &&
      state.processId !== rendererProcessId
    ), { timeout: 20_000 }).toBe(true);
    const recovered = await window.evaluate((value) => ({
      crashed: value.webContents.isCrashed(),
      processId: value.webContents.getOSProcessId(),
    }));
    expect(recovered.crashed).toBe(false);
    expect(recovered.processId).not.toBe(rendererProcessId);

    await expect.poll(() => window.evaluate((value) =>
      value.webContents.executeJavaScript(
        "document.body?.innerText ?? ''",
        true,
      ) as Promise<string>
    ), { timeout: 20_000 }).toContain("작품이 없습니다.");

    const child = app.process();
    const exited = once(child, "exit");
    await window.evaluate((value) => value.close());
    await Promise.race([
      exited,
      new Promise<never>((_resolve, reject) => setTimeout(
        () => reject(new Error("Electron main remained after its recovered window closed")),
        15_000,
      )),
    ]);
    completed = true;
  } finally {
    if (!completed) await closeElectron(app).catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
