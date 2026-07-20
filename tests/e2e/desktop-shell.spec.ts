import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

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
