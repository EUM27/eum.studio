import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createSecureWebPreferences,
  isAllowedRendererNavigation,
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

  it("derives window visibility from runtime configuration", () => {
    expect(shouldShowMainWindow(undefined)).toBe(true);
    expect(shouldShowMainWindow("visible")).toBe(true);
    expect(shouldShowMainWindow("hidden")).toBe(false);
  });
});
