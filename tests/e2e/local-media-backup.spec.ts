import { randomUUID } from "node:crypto";
import {
  electron,
  expect,
  mkdir,
  mkdtemp,
  openStudioHome,
  openStudioWorkspace,
  path,
  readFile,
  readdir,
  removeVerifiedTemporaryDirectory,
  rm,
  test,
  tmpdir,
  writeFile,
} from "./support/desktop-shell-suite";

test("creates a media-excluded backup through the UI after complete backup fails and reopens its restored manuscript", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-manuscript-backup-e2e-"));
  const sourceWorkspacePath = path.join(directory, "source");
  const mediaPath = path.join(directory, `${randomUUID()}.mp3`);
  const completePath = path.join(directory, "complete");
  const bundlePath = path.join(directory, "manuscript-only");
  const targetPath = path.join(directory, "restored");
  const manuscript = `${randomUUID()} 미디어 없이도 보존되는 원고`;
  await writeFile(mediaPath, Buffer.concat([Buffer.from("ID3"), Buffer.alloc(1024, 0x31)]));
  let electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "source-user")}`],
    cwd: process.cwd(),
    env: { ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: sourceWorkspacePath,
      EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS: JSON.stringify([mediaPath]),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden" },
  });
  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const create = page.getByRole("dialog", { name: "새 작품 만들기" });
    await create.getByLabel("작품 제목").fill(randomUUID());
    await create.getByLabel("첫 회차 제목").fill(randomUUID());
    await create.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await page.getByRole("textbox", { name: "원고", exact: true }).fill(manuscript);
    await page.getByRole("region", { name: "음악 플레이어" })
      .getByRole("button", { name: "선곡·재생목록 열기", exact: true }).click();
    const library = page.getByRole("dialog", { name: "음악 선곡과 재생목록", exact: true });
    await library.getByRole("button", { name: "원본 위치 연결", exact: true }).click();
    await library.getByRole("tab", { name: "내 미디어 탭", exact: true }).click();
    await expect(library.getByRole("region", { name: "내 미디어", exact: true }).getByRole("listitem")).toHaveCount(1);
    await library.getByRole("button", { name: "음악 창 닫기", exact: true }).click();
    await writeFile(mediaPath, randomUUID());
    await electronApp.evaluate(({ dialog }, filePath) => {
      Object.defineProperty(dialog, "showSaveDialog", { configurable: true, value: async () => ({ canceled: false, filePath }) });
    }, completePath);
    await openStudioHome(page);
    await page.getByRole("button", { name: "작품 도구 열기", exact: true }).click();
    await page.getByRole("menu", { name: "작품 도구" }).getByRole("menuitem", { name: "백업", exact: true }).click();
    const backup = page.getByRole("dialog", { name: "백업" });
    await backup.getByRole("button", { name: "새 백업", exact: true }).click();
    await expect(backup.getByRole("alert")).toContainText("백업을 만들지 못했습니다.");
    await expect(backup).not.toContainText("백업 생성 완료");
    await electronApp.evaluate(({ dialog }, filePath) => {
      Object.defineProperty(dialog, "showSaveDialog", { configurable: true, value: async () => ({ canceled: false, filePath }) });
    }, bundlePath);
    await backup.getByLabel("백업 범위").selectOption("manuscript-only");
    await expect(backup).toContainText("음악·영상 파일과 재연결 정보는 포함하지 않습니다.");
    await backup.getByRole("button", { name: "새 백업", exact: true }).click();
    await expect(backup).toContainText("백업 생성 완료");
    await expect(backup.getByRole("status")).toContainText("미디어 미포함");
    await electronApp.evaluate(({ dialog }, selected) => {
      Object.defineProperty(dialog, "showOpenDialog", { configurable: true, value: async () => ({ canceled: false, filePaths: [selected.bundlePath] }) });
      Object.defineProperty(dialog, "showSaveDialog", { configurable: true, value: async () => ({ canceled: false, filePath: selected.targetPath }) });
    }, { bundlePath, targetPath });
    await backup.getByRole("button", { name: "새 위치에 복원", exact: true }).click();
    await expect(backup).toContainText("새 위치 복원 완료");
    await expect(backup.getByRole("status")).toContainText("미디어 미포함");
    await electronApp.close();
    electronApp = await electron.launch({
      args: [".", `--user-data-dir=${path.join(directory, "restored-user")}`],
      cwd: process.cwd(),
      env: { ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
        EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: targetPath, EUM_STUDIO_WINDOW_VISIBILITY: "hidden" },
    });
    page = await openStudioWorkspace(electronApp);
    await expect(page.getByRole("textbox", { name: "원고", exact: true })).toHaveText(manuscript);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("backs up managed MP3/MP4 and reconnects a missing external file after empty-location restore", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-media-backup-e2e-"),
  );
  const sourceWorkspacePath = path.join(directory, "source-workspace");
  const sourceFilesPath = path.join(directory, "sources");
  const userDataPath = path.join(directory, "source-user-data");
  const bundlePath = path.join(directory, "verified-backup");
  const restoredWorkspacePath = path.join(directory, "restored-workspace");
  await mkdir(sourceFilesPath, { recursive: true });
  const mp3Path = path.join(sourceFilesPath, "linked-track.mp3");
  const mp4Path = path.join(sourceFilesPath, "managed-video.mp4");
  const mp3Bytes = Buffer.concat([
    Buffer.from("ID3"),
    Buffer.alloc(2048, 0x31),
  ]);
  const mp4Bytes = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    Buffer.alloc(2048, 0x42),
  ]);
  await writeFile(mp3Path, mp3Bytes);
  await writeFile(mp4Path, mp4Bytes);
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: sourceWorkspacePath,
    EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS: JSON.stringify([
      mp3Path,
      mp4Path,
    ]),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: [".", `--user-data-dir=${userDataPath}`],
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill("미디어 백업 작품");
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const player = page.getByRole("region", { name: "음악 플레이어" });
    await player.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const library = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await library.getByRole("button", {
      name: "원본 위치 연결",
      exact: true,
    }).click();
    await library.getByRole("button", {
      name: "앱에 가져오기",
      exact: true,
    }).click();
    await library.getByRole("tab", {
      name: "내 미디어 탭",
      exact: true,
    }).click();
    const localMedia = library.getByRole("region", {
      name: "내 미디어",
      exact: true,
    });
    await expect(localMedia.getByRole("listitem")).toHaveCount(4);
    await expect(localMedia).toContainText("연결됨");
    await expect(localMedia).toContainText("백업 포함");
    await library.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();

    await electronApp.evaluate(
      ({ dialog }, selectedBundlePath) => {
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: selectedBundlePath,
          }),
        });
      },
      bundlePath,
    );
    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 도구 열기", exact: true })
      .click();
    await page
      .getByRole("menu", { name: "작품 도구" })
      .getByRole("menuitem", { name: "백업", exact: true })
      .click();
    const backupDialog = page.getByRole("dialog", { name: "백업" });
    await expect(backupDialog).toContainText("앱에 가져온 MP3·MP4");
    await backupDialog.getByRole("button", {
      name: "새 백업",
      exact: true,
    }).click();
    await expect(backupDialog).toContainText("백업 생성 완료");
    await expect(
      backupDialog.locator("dt", { hasText: "가져온 미디어" })
        .locator("..").locator("dd"),
    ).toHaveText("2");
    await expect(
      backupDialog.locator("dt", { hasText: "외부 연결" })
        .locator("..").locator("dd"),
    ).toHaveText("2");
    expect(await readdir(path.join(bundlePath, "local-media", "files")))
      .toHaveLength(2);
    const mediaManifest = JSON.parse(
      await readFile(
        path.join(bundlePath, "local-media", "manifest.json"),
        "utf8",
      ),
    );
    expect(mediaManifest.entries).toHaveLength(4);
    expect(mediaManifest.entries.every(
      (entry: { integrity?: { checksumValue?: string } }) =>
        typeof entry.integrity?.checksumValue === "string" &&
        entry.integrity.checksumValue.length > 0,
    )).toBe(true);

    await rm(mp3Path);
    await electronApp.evaluate(
      ({ dialog }, paths) => {
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePaths: [paths.bundlePath],
          }),
        });
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: paths.targetPath,
          }),
        });
      },
      { bundlePath, targetPath: restoredWorkspacePath },
    );
    await backupDialog.getByRole("button", {
      name: "새 위치에 복원",
      exact: true,
    }).click();
    await expect(backupDialog).toContainText("새 위치 복원 완료");
    await expect(
      backupDialog.locator("dt", { hasText: "연결 끊김" })
        .locator("..").locator("dd"),
    ).toHaveText("1");
    expect(
      await readdir(
        path.join(restoredWorkspacePath, "local-media-library-v1", "files"),
      ),
    ).toHaveLength(2);

    await electronApp.close();
    const relocatedMp3Path = path.join(sourceFilesPath, "relocated-track.mp3");
    await writeFile(relocatedMp3Path, mp3Bytes);
    electronApp = await electron.launch({
      args: [
        ".",
        `--user-data-dir=${path.join(directory, "restored-user-data")}`,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
        EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
        EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: restoredWorkspacePath,
        EUM_STUDIO_LOCAL_MEDIA_RELINK_PATH: relocatedMp3Path,
        EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
      },
    });
    page = await openStudioWorkspace(electronApp);
    const restoredPlayer = page.getByRole("region", {
      name: "음악 플레이어",
    });
    await restoredPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const restoredLibrary = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await restoredLibrary.getByRole("tab", {
      name: "내 미디어 탭",
      exact: true,
    }).click();
    const restoredLocalMedia = restoredLibrary.getByRole("region", {
      name: "내 미디어",
      exact: true,
    });
    const disconnectedMp3 = restoredLocalMedia.getByRole("listitem")
      .filter({ hasText: "linked-track.mp3" })
      .filter({ hasText: "원본 위치 연결" });
    await expect(disconnectedMp3).toContainText("연결 끊김");
    await expect(disconnectedMp3.getByRole("button", {
      name: "linked-track 바로 재생",
      exact: true,
    })).toBeDisabled();
    await disconnectedMp3.getByRole("button", {
      name: "linked-track 다시 연결",
      exact: true,
    }).click();
    await expect(disconnectedMp3).toContainText("연결됨");
    await expect(disconnectedMp3.getByRole("button", {
      name: "linked-track 바로 재생",
      exact: true,
    })).toBeEnabled();
    await expect(disconnectedMp3.getByRole("button", {
      name: "linked-track 다시 연결",
      exact: true,
    })).toHaveCount(0);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
