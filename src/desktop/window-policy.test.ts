import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createSecureWebPreferences,
  canActivateMainWindow,
  isAllowedRendererNavigation,
  isTrustedRendererIpcSender,
  shouldRecoverMainWindowRenderer,
  shouldDisableHardwareAcceleration,
  shouldShowMainWindow,
} from "./window-policy";

describe("desktop window policy", () => {
  it("creates an explicitly sandboxed renderer without Node integration", () => {
    const preloadPath = `${randomUUID()}.cjs`;

    expect(createSecureWebPreferences(preloadPath)).toEqual({
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });

  it("allows only the configured renderer target", () => {
    const trustedTarget = `file:///${randomUUID()}/index.html`;
    const externalTarget = `https://${randomUUID()}.invalid/`;

    expect(isAllowedRendererNavigation(trustedTarget, trustedTarget)).toBe(true);
    expect(isAllowedRendererNavigation(externalTarget, trustedTarget)).toBe(false);
  });

  it("trusts IPC only from the configured main-window top frame and origin", () => {
    const trustedTarget = `https://${randomUUID()}.invalid/${randomUUID()}`;
    const trustedWebContentsId =
      Number.parseInt(
        randomUUID().slice(0, 6),
        16,
      );
    const valid = {
      senderWebContentsId:
        trustedWebContentsId,
      trustedWebContentsId,
      senderFrameUrl: trustedTarget,
      senderMainFrameUrl:
        trustedTarget,
      configuredRendererTarget:
        trustedTarget,
    };

    expect(
      isTrustedRendererIpcSender(valid),
    ).toBe(true);
    expect(
      isTrustedRendererIpcSender({
        ...valid,
        senderWebContentsId:
          trustedWebContentsId + 1,
      }),
    ).toBe(false);
    expect(
      isTrustedRendererIpcSender({
        ...valid,
        senderFrameUrl:
          `https://${randomUUID()}.invalid/${randomUUID()}`,
      }),
    ).toBe(false);
    expect(
      isTrustedRendererIpcSender({
        ...valid,
        senderMainFrameUrl:
          `https://${randomUUID()}.invalid/${randomUUID()}`,
      }),
    ).toBe(false);
  });

  it("derives window visibility from runtime configuration", () => {
    expect(shouldShowMainWindow(undefined)).toBe(true);
    expect(shouldShowMainWindow("visible")).toBe(true);
    expect(shouldShowMainWindow("hidden")).toBe(false);
  });

  it("keeps hardware acceleration enabled unless the runtime disables it", () => {
    expect(shouldDisableHardwareAcceleration(undefined)).toBe(false);
    expect(shouldDisableHardwareAcceleration("enabled")).toBe(false);
    expect(shouldDisableHardwareAcceleration("disabled")).toBe(true);
  });

  it("recovers only the current main renderer outside shutdown and an existing recovery", () => {
    const recoverable = {
      failedWindowIsCurrent: true,
      isQuitting: false,
      recoveryInProgress: false,
      windowDestroyed: false,
      webContentsDestroyed: false,
    };

    expect(shouldRecoverMainWindowRenderer(recoverable)).toBe(true);
    expect(shouldRecoverMainWindowRenderer({
      ...recoverable,
      failedWindowIsCurrent: false,
    })).toBe(false);
    expect(shouldRecoverMainWindowRenderer({
      ...recoverable,
      isQuitting: true,
    })).toBe(false);
    expect(shouldRecoverMainWindowRenderer({
      ...recoverable,
      recoveryInProgress: true,
    })).toBe(false);
    expect(shouldRecoverMainWindowRenderer({
      ...recoverable,
      windowDestroyed: true,
    })).toBe(false);
    expect(shouldRecoverMainWindowRenderer({
      ...recoverable,
      webContentsDestroyed: true,
    })).toBe(false);
  });

  it("activates only a live main window with a healthy renderer", () => {
    expect(canActivateMainWindow({
      windowDestroyed: false,
      webContentsDestroyed: false,
      rendererCrashed: false,
    })).toBe(true);
    expect(canActivateMainWindow({
      windowDestroyed: true,
      webContentsDestroyed: false,
      rendererCrashed: false,
    })).toBe(false);
    expect(canActivateMainWindow({
      windowDestroyed: false,
      webContentsDestroyed: true,
      rendererCrashed: false,
    })).toBe(false);
    expect(canActivateMainWindow({
      windowDestroyed: false,
      webContentsDestroyed: false,
      rendererCrashed: true,
    })).toBe(false);
  });
});
