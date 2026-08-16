import { describe, expect, it } from "vitest";

import {
  createChatGptOAuthWindowLauncher,
  createChatGptOAuthWindowOptions,
} from "./chatgpt-oauth-window";

describe("ChatGPT OAuth window", () => {
  it("loads the authorization URL in a visible secure window", async () => {
    const loadedUrls: string[] = [];
    let focused = 0;
    const launcher = createChatGptOAuthWindowLauncher({
      createWindow: () => ({
        close: () => undefined,
        focus: () => {
          focused += 1;
        },
        isDestroyed: () => false,
        loadURL: async (url) => {
          loadedUrls.push(url);
        },
        onceClosed: () => undefined,
      }),
    });

    await launcher.open("https://auth.openai.com/oauth/authorize?state=current");

    expect(loadedUrls).toEqual([
      "https://auth.openai.com/oauth/authorize?state=current",
    ]);
    expect(focused).toBe(1);
    expect(createChatGptOAuthWindowOptions()).toMatchObject({
      autoHideMenuBar: true,
      show: true,
      title: "GPT 로그인",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
  });

  it("closes the expired authorization window before reopening", async () => {
    let firstClosed = 0;
    let created = 0;
    const launcher = createChatGptOAuthWindowLauncher({
      createWindow: () => {
        created += 1;
        return {
          close: () => {
            if (created === 1) firstClosed += 1;
          },
          focus: () => undefined,
          isDestroyed: () => false,
          loadURL: async () => undefined,
          onceClosed: () => undefined,
        };
      },
    });

    await launcher.open("https://auth.openai.com/oauth/authorize?state=expired");
    await launcher.open("https://auth.openai.com/oauth/authorize?state=current");

    expect(firstClosed).toBe(1);
    expect(created).toBe(2);
  });
});
