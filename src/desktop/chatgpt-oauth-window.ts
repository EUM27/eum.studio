import type {
  BrowserWindow,
  BrowserWindowConstructorOptions,
} from "electron";

export type ChatGptOAuthWindowHandle = {
  close(): void;
  focus(): void;
  isDestroyed(): boolean;
  loadURL(url: string): Promise<void>;
  onceClosed(listener: () => void): void;
};

export function createChatGptOAuthWindowOptions(
  parent?: BrowserWindow,
): BrowserWindowConstructorOptions {
  return {
    autoHideMenuBar: true,
    ...(parent === undefined ? {} : { parent }),
    show: true,
    title: "GPT 로그인",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };
}

export function createChatGptOAuthWindowLauncher(input: {
  readonly createWindow: () => ChatGptOAuthWindowHandle;
}): {
  open(url: string): Promise<void>;
} {
  let activeWindow: ChatGptOAuthWindowHandle | null = null;

  return {
    async open(url: string): Promise<void> {
      if (activeWindow !== null && !activeWindow.isDestroyed()) {
        activeWindow.close();
      }

      const window = input.createWindow();
      activeWindow = window;
      window.onceClosed(() => {
        if (activeWindow === window) activeWindow = null;
      });
      await window.loadURL(url);
      if (!window.isDestroyed()) window.focus();
    },
  };
}
