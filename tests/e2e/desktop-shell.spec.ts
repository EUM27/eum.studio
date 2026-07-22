import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import { parseManuscriptInputProfile } from "../../src/application/editor/manuscript-input-profile";
import { parseLongformFixtureManifest } from "../fixtures/longform/longform-fixture";

function readJsonFixture(...segments: string[]): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), ...segments), "utf8"),
  );
}

function readHangulCompositionText(): string {
  const manifest = parseLongformFixtureManifest(
    readJsonFixture(
      "tests",
      "fixtures",
      "longform",
      "poc-1-longform.manifest.json",
    ),
  );
  const match = manifest.content.units.join(" ").match(/\p{Script=Hangul}+/u);
  if (match === null) {
    throw new Error("Longform fixture must provide Hangul composition text");
  }
  return match[0];
}

test("launches a sandboxed shell with only the typed studio bridge", async () => {
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await expect(
      window.getByRole("heading", { name: "이음 스튜디오" }),
    ).toBeVisible();
    await expect(window.getByTestId("runtime-status")).toContainText(
      "연결됨",
    );

    const boundary = await window.evaluate(() => {
      const bridge = Reflect.get(globalThis, "eumStudio");
      return {
        bridgeType: typeof bridge,
        hasGenericSend:
          typeof bridge === "object" &&
          bridge !== null &&
          Reflect.has(bridge, "send"),
        requireType: typeof Reflect.get(globalThis, "require"),
      };
    });

    expect(boundary).toEqual({
      bridgeType: "object",
      hasGenericSend: false,
      requireType: "undefined",
    });
    expect(consoleErrors).toEqual([]);
  } finally {
    await electronApp.close();
  }
});

test("renders a writable CodeMirror manuscript surface", async () => {
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const insertedText = randomUUID();

    await expect(window.locator(".cm-editor")).toBeVisible();
    await expect(manuscript).toBeVisible();
    await manuscript.pressSequentially(insertedText);

    const hasVisibleFocusIndicator = await window
      .locator(".cm-editor")
      .evaluate((editor) => {
        const style = getComputedStyle(editor);
        return style.outlineStyle !== "none" || style.boxShadow !== "none";
      });
    expect(hasVisibleFocusIndicator).toBe(true);
    await expect(manuscript).toContainText(insertedText);
    await expect(window.getByTestId("manuscript-length")).toHaveText(
      String(insertedText.length),
    );
  } finally {
    await electronApp.close();
  }
});

test("undoes and redoes manuscript edits with the matching cursor", async () => {
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const prefix = randomUUID();
    const suffix = randomUUID();
    const insertedText = randomUUID();
    const cursorProbe = randomUUID();

    await manuscript.pressSequentially(`${prefix}${suffix}`);
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    await manuscript.pressSequentially(insertedText);
    await expect(manuscript).toHaveText(
      `${prefix}${insertedText}${suffix}`,
    );

    await manuscript.press("Control+Z");
    await expect(manuscript).toHaveText(`${prefix}${suffix}`);

    await manuscript.press("Control+Y");
    await expect(manuscript).toHaveText(
      `${prefix}${insertedText}${suffix}`,
    );

    await manuscript.pressSequentially(cursorProbe);
    await expect(manuscript).toHaveText(
      `${prefix}${insertedText}${cursorProbe}${suffix}`,
    );
  } finally {
    await electronApp.close();
  }
});

test("undoes and redoes a registered input rule as one edit", async () => {
  const inputProfile = parseManuscriptInputProfile(
    JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "tests",
          "fixtures",
          "editor",
          "poc-1-manuscript-input-profile.manifest.json",
        ),
        "utf8",
      ),
    ),
  );
  const pair = inputProfile.autoClosePairs[0];
  if (pair === undefined) {
    throw new Error("Input profile must provide an auto-close pair");
  }
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE: JSON.stringify(inputProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const prefix = randomUUID();

    await manuscript.pressSequentially(prefix);
    await manuscript.press("ArrowLeft");
    await manuscript.press("ArrowRight");
    await manuscript.pressSequentially(pair.open);
    await expect(manuscript).toHaveText(
      `${prefix}${pair.open}${pair.close}`,
    );

    await manuscript.press("Control+Z");
    await expect(manuscript).toHaveText(prefix);

    await manuscript.press("Control+Y");
    await expect(manuscript).toHaveText(
      `${prefix}${pair.open}${pair.close}`,
    );
  } finally {
    await electronApp.close();
  }
});

test("keeps Hangul IME composition intact through commit, undo, and redo", async () => {
  const compositionText = readHangulCompositionText();
  const baseInputProfile = parseManuscriptInputProfile(
    readJsonFixture(
      "tests",
      "fixtures",
      "editor",
      "poc-1-manuscript-input-profile.manifest.json",
    ),
  );
  const compositionCloser = randomUUID();
  const inputProfile = parseManuscriptInputProfile({
    ...baseInputProfile,
    autoClosePairs: [
      ...baseInputProfile.autoClosePairs,
      { open: compositionText, close: compositionCloser },
    ],
  });
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE: JSON.stringify(inputProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const session = await window.context().newCDPSession(window);
    const firstCandidate = Array.from(compositionText)[0];
    if (firstCandidate === undefined) {
      throw new Error("Hangul composition text must not be empty");
    }

    await manuscript.focus();
    await session.send("Input.imeSetComposition", {
      text: firstCandidate,
      selectionStart: firstCandidate.length,
      selectionEnd: firstCandidate.length,
      replacementStart: 0,
      replacementEnd: 0,
    });
    await expect(manuscript).toHaveText(firstCandidate);

    await session.send("Input.imeSetComposition", {
      text: compositionText,
      selectionStart: compositionText.length,
      selectionEnd: compositionText.length,
      replacementStart: 0,
      replacementEnd: 0,
    });
    await expect(manuscript).toHaveText(compositionText);

    await session.send("Input.insertText", { text: compositionText });
    await expect(manuscript).toHaveText(compositionText);
    await expect(manuscript).not.toContainText(compositionCloser);
    await expect(window.getByTestId("manuscript-length")).toHaveText(
      String(compositionText.length),
    );

    await manuscript.press("Control+Z");
    await expect(manuscript).toHaveText("");

    await manuscript.press("Control+Y");
    await expect(manuscript).toHaveText(compositionText);

    const cursorProbe = randomUUID();
    await manuscript.pressSequentially(cursorProbe);
    await expect(manuscript).toHaveText(`${compositionText}${cursorProbe}`);
    await session.detach();
  } finally {
    await electronApp.close();
  }
});

test("keeps keyboard and mouse selections within the exact character range", async () => {
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const keyboardPrefix = randomUUID();
    const keyboardTarget = randomUUID();
    const keyboardLine = `${keyboardPrefix}${keyboardTarget}`;

    await manuscript.pressSequentially(keyboardLine);
    for (let index = 0; index < keyboardTarget.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }

    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(keyboardTarget);
    await expect(window.getByTestId("manuscript-selection-length")).toHaveText(
      String(keyboardTarget.length),
    );

    const mouseLine = randomUUID();
    await manuscript.press("Control+A");
    await manuscript.pressSequentially(mouseLine);
    const from = randomInt(1, mouseLine.length - 2);
    const to = randomInt(from + 1, mouseLine.length - 1);
    const expectedMouseSelection = mouseLine.slice(from, to);
    const points = await window.locator(".cm-line").evaluate(
      (line, range) => {
        const textNode = line.firstChild;
        if (!(textNode instanceof Text)) {
          throw new Error("CodeMirror line text node is missing");
        }

        const pointAt = (offset: number) => {
          const characterRange = document.createRange();
          characterRange.setStart(textNode, offset);
          characterRange.setEnd(textNode, offset + 1);
          const rectangle = characterRange.getBoundingClientRect();
          return {
            x: rectangle.left,
            y: rectangle.top + rectangle.height / 2,
          };
        };

        return {
          start: pointAt(range.from),
          end: pointAt(range.to),
        };
      },
      { from, to },
    );

    await window.mouse.move(points.start.x, points.start.y);
    await window.mouse.down();
    await window.mouse.move(points.end.x, points.end.y, { steps: 4 });
    await window.mouse.up();

    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(expectedMouseSelection);
    await expect(window.getByTestId("manuscript-selection-length")).toHaveText(
      String(expectedMouseSelection.length),
    );
  } finally {
    await electronApp.close();
  }
});

test("applies registered pairs, skips existing closers, and types a midline ellipsis", async () => {
  const inputProfile = parseManuscriptInputProfile(
    JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "tests",
          "fixtures",
          "editor",
          "poc-1-manuscript-input-profile.manifest.json",
        ),
        "utf8",
      ),
    ),
  );
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE: JSON.stringify(inputProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    const manuscript = window.getByRole("textbox", { name: "원고" });

    for (const pair of inputProfile.autoClosePairs) {
      await manuscript.press("Control+A");
      await manuscript.press("Backspace");
      await manuscript.pressSequentially(pair.open);
      await expect(manuscript).toHaveText(`${pair.open}${pair.close}`);

      const content = randomUUID();
      await manuscript.pressSequentially(content);
      await expect(manuscript).toHaveText(
        `${pair.open}${content}${pair.close}`,
      );

      await manuscript.pressSequentially(pair.close);
      await expect(manuscript).toHaveText(
        `${pair.open}${content}${pair.close}`,
      );

      const suffix = randomUUID();
      await manuscript.pressSequentially(suffix);
      await expect(manuscript).toHaveText(
        `${pair.open}${content}${pair.close}${suffix}`,
      );
    }

    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    const ellipsisPrefix = randomUUID();
    await manuscript.pressSequentially(ellipsisPrefix);
    await manuscript.pressSequentially("...");
    await expect(manuscript).toHaveText(`${ellipsisPrefix}⋯`);
  } finally {
    await electronApp.close();
  }
});
