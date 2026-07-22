import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  RUNTIME_INFO_CHANNEL,
  type RuntimeInfo,
} from "../application/contracts/studio-bridge";
import { parseManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import {
  createSecureWebPreferences,
  isAllowedRendererNavigation,
  shouldShowMainWindow,
} from "./window-policy";

let mainWindow: BrowserWindow | null = null;

function registerApplicationHandlers(): void {
  ipcMain.handle(RUNTIME_INFO_CHANNEL, (): RuntimeInfo => {
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      architecture: process.arch,
    };
  });
  ipcMain.handle(MANUSCRIPT_INPUT_PROFILE_CHANNEL, () => {
    const serializedProfile =
      process.env.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE;
    const value =
      serializedProfile === undefined
        ? {
            schemaVersion: 1,
            autoClosePairs: [],
            textReplacements: [],
          }
        : JSON.parse(serializedProfile);
    return parseManuscriptInputProfile(value);
  });
}

async function createMainWindow(): Promise<BrowserWindow> {
  const preloadPath = path.join(__dirname, "../preload/index.js");
  const rendererFile = path.join(
    __dirname,
    "../../dist-renderer/index.html",
  );
  const configuredRendererUrl = process.env.EUM_STUDIO_RENDERER_URL;
  const rendererTarget =
    configuredRendererUrl ?? pathToFileURL(rendererFile).toString();

  const window = new BrowserWindow({
    show: false,
    webPreferences: createSecureWebPreferences(preloadPath),
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, requestedTarget) => {
    if (!isAllowedRendererNavigation(requestedTarget, rendererTarget)) {
      event.preventDefault();
    }
  });
  window.once("ready-to-show", () => {
    if (shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)) {
      window.show();
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  if (configuredRendererUrl === undefined) {
    await window.loadFile(rendererFile);
  } else {
    await window.loadURL(configuredRendererUrl);
  }

  return window;
}

app.enableSandbox();

app.whenReady().then(async () => {
  registerApplicationHandlers();
  mainWindow = await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
