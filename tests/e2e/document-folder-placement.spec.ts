import {
  continueFromMain,
  createNamedEpisode,
  documentTreeButton,
  electron,
  expect,
  expectEditorText,
  mkdtemp,
  path,
  randomUUID,
  readActiveDocumentId,
  removeVerifiedTemporaryDirectory,
  test,
  tmpdir,
  writeFile,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";

async function openFolderWorkspace() {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-folder-placement-"));
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const launch = () => electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });
  let app = await launch();
  const close = async () => {
    await app.close();
    await removeVerifiedTemporaryDirectory(directory);
  };
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await dialog.getByLabel("작품 제목").fill(workTitle);
    await dialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await dialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(firstDocumentTitle);
    return {
      page,
      firstDocumentTitle,
      close,
      captureScreenshot: async (page: Page, fileName: string) => {
        // Electron's capturer paints hidden packaged windows without showing them.
        const browserWindow = await app.browserWindow(page);
        const png = await browserWindow.evaluate(async (window) => {
          const image = await window.capturePage(undefined, {
            stayHidden: true,
            stayAwake: true,
          });
          if (image.isEmpty()) throw new Error("The window capture is empty");
          return image.toPNG().toString("base64");
        });
        await writeFile(test.info().outputPath(fileName), Buffer.from(png, "base64"));
      },
      restart: async () => {
        await app.close();
        app = await launch();
        const reopened = await app.firstWindow();
        await reopened.setViewportSize({ width: 1280, height: 900 });
        await continueFromMain(reopened);
        return reopened;
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

function folderRow(page: Page, folderId: string): Locator {
  return page.locator(`.document-tree-folder[data-document-folder-id="${folderId}"]`);
}

function folderDocuments(page: Page, folderId: string): Locator {
  return folderRow(page, folderId).locator("xpath=..")
    .locator(":scope > .document-tree-children > .document-tree-document");
}

async function createFolder(page: Page, parentId?: string): Promise<string> {
  const rows = page.locator(".document-tree-folder");
  const previousCount = await rows.count();
  if (parentId === undefined) {
    await page.getByRole("button", { name: "폴더 추가", exact: true }).click();
  } else {
    const parent = folderRow(page, parentId);
    await parent.hover();
    await parent.getByRole("button", { name: /하위 폴더 추가$/u }).click();
  }
  await expect(rows).toHaveCount(previousCount + 1);
  const id = await rows.last().getAttribute("data-document-folder-id");
  if (id === null) throw new Error("The created folder has no identity");
  return id;
}

async function dragTo(
  page: Page,
  source: Locator,
  target: Locator,
  targetYRatio = 0.5,
): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  if (sourceBounds === null || targetBounds === null) {
    throw new Error("The document drop location is not visible");
  }
  await page.mouse.move(
    sourceBounds.x + sourceBounds.width / 2,
    sourceBounds.y + sourceBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBounds.x + targetBounds.width / 2,
    targetBounds.y + targetBounds.height * targetYRatio,
    { steps: 5 },
  );
}

test("creates documents directly in collapsed and nested folders and restores their location", async () => {
  test.setTimeout(120_000);
  const workspace = await openFolderWorkspace();
  let page = workspace.page;
  const manuscriptText = `${randomUUID()} 폴더에서 만든 원고.`;
  try {
    const parentId = await createFolder(page);
    let parent = folderRow(page, parentId);
    await parent.getByRole("button", { name: /폴더 접기$/u }).click();
    await parent.hover();
    const createInFolder = parent.getByRole("button", { name: /폴더에 새 문서 추가$/u });
    await expect(createInFolder).toBeVisible();
    await createInFolder.click();
    await expect(folderDocuments(page, parentId)).toHaveCount(1);
    await expect(parent.getByRole("button", { name: /폴더 접기$/u })).toBeVisible();
    const parentDocumentId = await folderDocuments(page, parentId)
      .getAttribute("data-document-id");
    await expect.poll(() => readActiveDocumentId(page)).toBe(parentDocumentId);
    const manuscript = page.getByRole("textbox", { name: "원고", exact: true });
    await expectEditorText(manuscript, "");
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expectEditorText(manuscript, manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const childId = await createFolder(page, parentId);
    const child = folderRow(page, childId);
    await child.hover();
    await child.getByRole("button", { name: /폴더에 새 문서 추가$/u }).click();
    await expect(folderDocuments(page, childId)).toHaveCount(1);
    const childDocumentId = await folderDocuments(page, childId)
      .getAttribute("data-document-id");
    await expect.poll(() => readActiveDocumentId(page)).toBe(childDocumentId);
    await expect(folderDocuments(page, parentId)).toHaveCount(1);

    // The existing top-level control still creates at the work root.
    await page.getByRole("button", { name: "새 회차", exact: true }).click();
    const rootRows = page.locator(".document-tree > .document-tree-document");
    await expect(rootRows).toHaveCount(2);
    const newRootDocumentId = await rootRows.last().getAttribute("data-document-id");
    await expect.poll(() => readActiveDocumentId(page)).toBe(newRootDocumentId);

    page = await workspace.restart();
    parent = folderRow(page, parentId);
    await expect(folderDocuments(page, parentId)).toHaveAttribute("data-document-id", parentDocumentId!);
    await expect(folderDocuments(page, childId)).toHaveAttribute("data-document-id", childDocumentId!);
    await expect(page.locator(".document-tree > .document-tree-document")).toHaveCount(2);
    await folderDocuments(page, parentId).locator(".document-tree-open").click();
    await expectEditorText(page.getByRole("textbox", { name: "원고", exact: true }), manuscriptText);
    await parent.hover();
    await workspace.captureScreenshot(page, "folder-document-create.png");
  } finally {
    await workspace.close();
  }
});

test("drops documents before and after documents across folder boundaries without changing manuscript state", async () => {
  test.setTimeout(180_000);
  const workspace = await openFolderWorkspace();
  let page = workspace.page;
  const titles = [
    workspace.firstDocumentTitle,
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ] as const;
  const manuscriptText = `${randomUUID()} 이동해도 보존되는 원고.`;
  const documentTitles = (folderId: string) => folderDocuments(page, folderId).locator(".document-tree-title");
  try {
    const manuscript = page.getByRole("textbox", { name: "원고", exact: true });
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expectEditorText(manuscript, manuscriptText);
    for (const title of titles.slice(1)) await createNamedEpisode(page, title);
    const parentId = await createFolder(page);
    for (const title of titles.slice(3)) {
      await dragTo(page, documentTreeButton(page, title), folderRow(page, parentId));
      await page.mouse.up();
      await expect(documentTitles(parentId)).toContainText([title]);
    }
    await expect(documentTitles(parentId)).toHaveText(titles.slice(3));
    await documentTreeButton(page, titles[0]).click();
    await expectEditorText(page.getByRole("textbox", { name: "원고", exact: true }), manuscriptText);

    await dragTo(page, documentTreeButton(page, titles[0]), documentTreeButton(page, titles[4]), 0.2);
    await expect(documentTreeButton(page, titles[4]).locator("xpath=.."))
      .toHaveClass(/is-document-drop-before/u);
    await workspace.captureScreenshot(page, "cross-folder-drop-preview.png");
    await page.mouse.up();
    await expect(documentTitles(parentId)).toHaveText([titles[3], titles[0], titles[4]]);
    await expect(page.getByTestId("manuscript-title")).toHaveText(titles[0]);

    await dragTo(page, documentTreeButton(page, titles[1]), documentTreeButton(page, titles[3]), 0.8);
    await expect(documentTreeButton(page, titles[3]).locator("xpath=.."))
      .toHaveClass(/is-document-drop-after/u);
    await page.mouse.up();
    await expect(documentTitles(parentId)).toHaveText([titles[3], titles[1], titles[0], titles[4]]);

    await dragTo(page, documentTreeButton(page, titles[4]), documentTreeButton(page, titles[2]), 0.8);
    await page.mouse.up();
    await expect(page.locator(".document-tree > .document-tree-document .document-tree-title"))
      .toHaveText([titles[2], titles[4]]);
    const childId = await createFolder(page, parentId);
    await dragTo(page, documentTreeButton(page, titles[1]), folderRow(page, childId));
    await page.mouse.up();
    await expect(documentTitles(childId)).toHaveText([titles[1]]);
    await dragTo(page, documentTreeButton(page, titles[0]), documentTreeButton(page, titles[1]), 0.2);
    await page.mouse.up();
    await expect(documentTitles(childId)).toHaveText([titles[0], titles[1]]);
    await dragTo(page, documentTreeButton(page, titles[1]), documentTreeButton(page, titles[0]), 0.2);
    await page.mouse.up();
    await expect(documentTitles(childId)).toHaveText([titles[1], titles[0]]);
    await expect(documentTitles(parentId)).toHaveText([titles[3]]);

    await dragTo(page, documentTreeButton(page, titles[2]), page.getByRole("textbox", { name: "원고", exact: true }));
    await page.mouse.up();
    await expect(documentTitles(childId)).toHaveText([titles[1], titles[0]]);
    await expect(page.getByTestId("manuscript-title")).toHaveText(titles[0]);
    const editor = page.getByRole("textbox", { name: "원고", exact: true });
    await editor.press("Control+Z");
    await expectEditorText(editor, "");
    await editor.press("Control+Y");
    await expectEditorText(editor, manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    page = await workspace.restart();
    await expect(documentTitles(childId)).toHaveText([titles[1], titles[0]]);
    await expect(documentTitles(parentId)).toHaveText([titles[3]]);
    await expect(page.locator(".document-tree > .document-tree-document .document-tree-title"))
      .toHaveText([titles[2], titles[4]]);
    await expectEditorText(page.getByRole("textbox", { name: "원고", exact: true }), manuscriptText);
  } finally {
    await workspace.close();
  }
});
