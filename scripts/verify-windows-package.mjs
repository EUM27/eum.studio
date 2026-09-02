import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

import { _electron as electron } from "playwright";

const projectRoot = resolve(import.meta.dirname, "..");
const packageDirectoryName =
  process.env.EUM_STUDIO_WINDOWS_PACKAGE_DIRECTORY_NAME?.trim() ||
  "eum-studio-win-x64";
if (
  basename(packageDirectoryName) !== packageDirectoryName ||
  packageDirectoryName === "." ||
  packageDirectoryName === ".."
) {
  throw new Error("Windows package directory name must be one path segment");
}
const packageRoot = resolve(projectRoot, "out", packageDirectoryName);
const executablePath = resolve(packageRoot, "이음 스튜디오.exe");
const packageManifestPath = resolve(packageRoot, "package-manifest.json");

for (const [path, label] of [
  [executablePath, "Standalone executable"],
  [packageManifestPath, "Standalone package manifest"],
]) {
  const details = await stat(path).catch(() => null);
  if (details === null || !details.isFile()) {
    throw new Error(`${label} is missing: ${path}`);
  }
}

const manifest = JSON.parse(await readFile(packageManifestPath, "utf8"));
const temporaryRoot = await mkdtemp(join(tmpdir(), "eum-studio-standalone-"));
let application = null;
try {
  const workspaceRoot = join(temporaryRoot, "workspace");
  const userDataRoot = join(temporaryRoot, "user-data");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
    EUM_STUDIO_HARDWARE_ACCELERATION: "disabled",
  };
  application = await electron.launch({
    executablePath,
    cwd: temporaryRoot,
    args: [`--user-data-dir=${userDataRoot}`],
    env: runtimeEnvironment,
  });
  const page = await application.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  const renderer = await page.evaluate(async () => ({
    title: globalThis.document.title,
    url: globalThis.window.location.href,
    hasBridge: typeof globalThis.window.eumStudio === "object",
    catalog: await globalThis.window.eumStudio.workspace.getCatalog(),
  }));
  const titlebarRegions = await page.evaluate(() => {
    const readRegion = (selector) => {
      const element = globalThis.document.querySelector(selector);
      if (element === null) {
        throw new Error(`Missing titlebar region: ${selector}`);
      }
      const style = globalThis.getComputedStyle(element);
      return (
        style.getPropertyValue("-webkit-app-region") ||
        style.webkitAppRegion ||
        ""
      ).trim();
    };
    return {
      topbar: readRegion(".app-topbar"),
      mark: readRegion(".app-topbar-mark"),
      music: readRegion(".app-topbar-music"),
      button: readRegion(".app-topbar-button"),
    };
  });
  const main = await application.evaluate(({ app }) => ({
    isPackaged: app.isPackaged,
    execPath: globalThis.process.execPath,
    resourcesPath: globalThis.process.resourcesPath,
    defaultApp: globalThis.process.defaultApp === true,
  }));
  if (renderer.title !== "이음 스튜디오") {
    throw new Error(`Unexpected standalone title: ${renderer.title}`);
  }
  if (!renderer.url.startsWith("file://")) {
    throw new Error(`Standalone renderer did not use file://: ${renderer.url}`);
  }
  if (!renderer.hasBridge || renderer.catalog.canCreateFirstWork !== true) {
    throw new Error("Standalone preload/workspace bootstrap did not complete");
  }
  if (
    titlebarRegions.topbar !== "drag" ||
    titlebarRegions.mark !== "drag" ||
    titlebarRegions.music !== "drag" ||
    titlebarRegions.button !== "no-drag"
  ) {
    throw new Error(
      `Unexpected standalone titlebar regions: ${JSON.stringify(titlebarRegions)}`,
    );
  }
  if (!main.isPackaged || main.defaultApp) {
    throw new Error("Electron did not recognize the standalone application package");
  }
  if (resolve(main.execPath) !== executablePath) {
    throw new Error(`Standalone executable mismatch: ${main.execPath}`);
  }
  const browserWindow = await application.browserWindow(page);
  const rendererProcessId = await browserWindow.evaluate((window) =>
    window.webContents.getOSProcessId()
  );
  await browserWindow.evaluate((window) =>
    window.webContents.forcefullyCrashRenderer()
  );
  const recoveryDeadline = Date.now() + 20_000;
  let rendererRecovery = null;
  while (Date.now() < recoveryDeadline) {
    const state = await browserWindow.evaluate((window) => ({
      crashed: window.webContents.isCrashed(),
      processId: window.webContents.getOSProcessId(),
      visible: window.isVisible(),
    }));
    if (!state.crashed && state.processId !== rendererProcessId) {
      const bodyText = await browserWindow.evaluate((window) =>
        window.webContents.executeJavaScript(
          "document.body?.innerText ?? ''",
          true,
        )
      );
      if (String(bodyText).includes("작품이 없습니다.")) {
        rendererRecovery = state;
        break;
      }
    }
    await delay(100);
  }
  if (rendererRecovery === null) {
    throw new Error("Standalone renderer did not recover after process termination");
  }
  const secondInstance = spawn(
    executablePath,
    [`--user-data-dir=${userDataRoot}`],
    {
      cwd: temporaryRoot,
      env: runtimeEnvironment,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  const secondInstanceExit = await Promise.race([
    once(secondInstance, "exit").then(([code, signal]) => ({ code, signal })),
    delay(10_000, null),
  ]);
  if (secondInstanceExit === null) {
    secondInstance.kill("SIGKILL");
    throw new Error("Standalone second instance did not return to the primary app");
  }
  if (application.process().exitCode !== null) {
    throw new Error("Standalone primary app exited during second-instance activation");
  }
  process.stdout.write(`${JSON.stringify({
    executablePath,
    packageManifestPath,
    packageTree: manifest.tree,
    renderer: {
      title: renderer.title,
      protocol: new URL(renderer.url).protocol,
      hasBridge: renderer.hasBridge,
      canCreateFirstWork: renderer.catalog.canCreateFirstWork,
    },
    titlebarRegions,
    main,
    rendererRecovery,
    secondInstanceExit,
  }, null, 2)}\n`);
} finally {
  if (application !== null) {
    await application.close().catch(() => undefined);
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
