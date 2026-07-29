import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createSecureWebPreferences,
  isAllowedRendererNavigation,
  isTrustedRendererIpcSender,
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
});
