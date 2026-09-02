import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  createDocumentSwitchProfile,
  openStudioWorkspace,
  removeVerifiedTemporaryDirectory,
} from "./support/desktop-shell-suite";

const DARK_THEME_NAMES = Object.freeze([
  "다크",
  "미드나잇",
  "그레이",
  "소프트D",
  "웜다크",
  "노르딕",
  "포커스D",
] as const);

async function measureDarkControlContrast(page: Page) {
  return page.evaluate(() => {
    type Color = Readonly<{
      red: number;
      green: number;
      blue: number;
      alpha: number;
    }>;

    const parseColor = (value: string): Color => {
      const match = /rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/u.exec(
        value,
      );
      if (match !== null) {
        return Object.freeze({
          red: Number(match[1]),
          green: Number(match[2]),
          blue: Number(match[3]),
          alpha: Number(match[4] ?? 1),
        });
      }
      const srgbMatch = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/u.exec(
        value,
      );
      if (srgbMatch === null) {
        throw new Error(`Unsupported computed color: ${value}`);
      }
      return Object.freeze({
        red: Number(srgbMatch[1]) * 255,
        green: Number(srgbMatch[2]) * 255,
        blue: Number(srgbMatch[3]) * 255,
        alpha: Number(srgbMatch[4] ?? 1),
      });
    };
    const blend = (foreground: Color, background: Color): Color =>
      Object.freeze({
        red:
          foreground.red * foreground.alpha +
          background.red * (1 - foreground.alpha),
        green:
          foreground.green * foreground.alpha +
          background.green * (1 - foreground.alpha),
        blue:
          foreground.blue * foreground.alpha +
          background.blue * (1 - foreground.alpha),
        alpha: 1,
      });
    const effectiveBackground = (element: HTMLElement): Color => {
      const layers: Color[] = [];
      for (
        let current: HTMLElement | null = element;
        current !== null;
        current = current.parentElement
      ) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (color.alpha > 0) layers.push(color);
      }
      return layers.reverse().reduce(
        (background, foreground) => blend(foreground, background),
        Object.freeze({ red: 255, green: 255, blue: 255, alpha: 1 }),
      );
    };
    const luminance = (color: Color): number => {
      const [red, green, blue] = [color.red, color.green, color.blue].map(
        (value) => {
          const normalized = value / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        },
      );
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };
    const contrast = (foreground: Color, background: Color): number => {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };
    const measure = (selector: string): number => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing dark-theme contrast target: ${selector}`);
      }
      const background = effectiveBackground(element);
      const foreground = blend(
        parseColor(getComputedStyle(element).color),
        background,
      );
      return Number(contrast(foreground, background).toFixed(2));
    };

    return Object.freeze({
      activeDocument: measure(".document-tree-open.is-active"),
      activeWorkSection: measure(".work-primary-navigation button.is-active"),
      formattingToolbar: measure(
        '.formatting-toolbar-group button[aria-label="굵게"]',
      ),
      topbar: measure('.app-topbar-button[aria-label="홈 열기"]'),
    });
  });
}

test("keeps primary controls readable across every dark theme", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-dark-theme-contrast-e2e-"),
  );
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(
        createDocumentSwitchProfile("어두운 테마 대비 확인 원고"),
      ),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    for (const themeName of DARK_THEME_NAMES) {
      await page
        .getByRole("button", { name: "테마 변경", exact: true })
        .click();
      await page
        .getByRole("group", { name: "테마 선택" })
        .getByRole("button", { name: themeName, exact: true })
        .click();

      const measurements = await measureDarkControlContrast(page);
      for (const [surface, ratio] of Object.entries(measurements)) {
        expect(
          ratio,
          `${themeName} ${surface} contrast was ${ratio}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
