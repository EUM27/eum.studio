import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

test("uses the configured YouTube key for live search and prepares the real IFrame player", async () => {
  const connectionPath = process.env.EUM_STUDIO_LIVE_YOUTUBE_CONNECTION_PATH;
  test.skip(
    connectionPath === undefined || connectionPath.length === 0,
    "Set EUM_STUDIO_LIVE_YOUTUBE_CONNECTION_PATH for the opt-in live smoke test.",
  );
  const resolvedConnectionPath = path.resolve(connectionPath!);
  const liveUserDataPath = path.dirname(path.dirname(resolvedConnectionPath));
  const directory = await mkdtemp(path.join(tmpdir(), "eum-studio-youtube-live-"));
  const profile = JSON.parse(
    await readFile(path.join(process.cwd(), "config", "youtube-music.json"), "utf8"),
  ) as unknown;
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${liveUserDataPath}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
      EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: path.join(directory, "assistant"),
      EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH: path.join(directory, "mail"),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const videos = await electronApp.evaluate(async (
      { safeStorage },
      input,
    ) => {
      const moduleApi = process.getBuiltinModule("node:module") as {
        createRequire(filename: string): (id: string) => unknown;
      };
      const requireModule = moduleApi.createRequire(input.connectionModulePath);
      const connectionModule = requireModule(input.connectionModulePath) as {
        openNodeYouTubeMusicConnectionStore: (options: unknown) => Promise<{
          readApiKey(): string | null;
        }>;
      };
      const profileModule = requireModule(input.profileModulePath) as {
        parseYouTubeMusicProfile: (value: unknown) => unknown;
      };
      const searchModule = requireModule(input.searchModulePath) as {
        createNodeYouTubeMusicSearchClient: (options: unknown) => {
          searchVideos(query: string, limit: number): Promise<readonly {
            readonly videoId: string;
            readonly title: string;
            readonly channel: string;
          }[]>;
        };
      };
      const store = await connectionModule.openNodeYouTubeMusicConnectionStore({
        rootDirectoryPath: input.connectionRootPath,
        cipher: {
          isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
          encryptString: (plainText: string) => safeStorage.encryptString(plainText),
          decryptString: (encrypted: Uint8Array) =>
            safeStorage.decryptString(Buffer.from(encrypted)),
        },
      });
      const parsedProfile = profileModule.parseYouTubeMusicProfile(input.profile);
      const client = searchModule.createNodeYouTubeMusicSearchClient({
        profile: parsedProfile,
        store,
      });
      const results = await client.searchVideos(input.query, 3);
      return results.map((video) => ({
        videoId: video.videoId,
        title: video.title,
        channel: video.channel,
      }));
    }, {
      connectionModulePath: path.join(
        process.cwd(),
        "dist-electron",
        "platform",
        "music",
        "node-youtube-music-connection-store.js",
      ),
      profileModulePath: path.join(
        process.cwd(),
        "dist-electron",
        "application",
        "music",
        "youtube-music.js",
      ),
      searchModulePath: path.join(
        process.cwd(),
        "dist-electron",
        "platform",
        "music",
        "node-youtube-music-search.js",
      ),
      connectionRootPath: path.dirname(resolvedConnectionPath),
      profile,
      query: "집중 작업 ambient music",
    });
    expect(videos.length).toBeGreaterThan(0);

    const page = await electronApp.firstWindow();
    const iframeResult = await page.evaluate(async (videoId) => {
      const youtubeWindow = window as unknown as {
        YT?: {
          Player: new (
            element: HTMLElement,
            options: {
              readonly width: string;
              readonly height: string;
              readonly videoId: string;
              readonly playerVars: { readonly playsinline: number };
              readonly events: {
                readonly onReady: () => void;
                readonly onError: (event: { readonly data: number }) => void;
              };
            },
          ) => unknown;
        };
        onYouTubeIframeAPIReady?: () => void;
      };
      if (youtubeWindow.YT?.Player === undefined) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          const timeout = window.setTimeout(
            () => reject(new Error("YouTube IFrame API load timed out")),
            15_000,
          );
          youtubeWindow.onYouTubeIframeAPIReady = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          script.addEventListener("error", () => {
            window.clearTimeout(timeout);
            reject(new Error("YouTube IFrame API script failed"));
          }, { once: true });
          script.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(script);
        });
      }
      const host = document.createElement("div");
      host.style.width = "356px";
      host.style.height = "200px";
      document.body.appendChild(host);
      return new Promise<{ ready: boolean; errorCode: number | null }>((resolve) => {
        let ready = false;
        let errorCode: number | null = null;
        const finish = () => resolve({ ready, errorCode });
        window.setTimeout(finish, 3_000);
        const Player = youtubeWindow.YT!.Player;
        new Player(host, {
          width: "356",
          height: "200",
          videoId,
          playerVars: { playsinline: 1 },
          events: {
            onReady: () => {
              ready = true;
            },
            onError: (event) => {
              errorCode = event.data;
            },
          },
        });
      });
    }, videos[0]!.videoId);
    expect(iframeResult).toEqual({ ready: true, errorCode: null });
  } finally {
    await electronApp.close();
    await rm(directory, { recursive: true, force: true });
  }
});
