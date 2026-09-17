import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  createNamedEpisode,
  expectEditorText,
  openReviewRail,
  openStudioWorkspace,
  readActiveDocumentId,
  removeVerifiedTemporaryDirectory,
} from "../support/desktop-shell-driver";

process.env.EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE = "1";

test("copies an exact manuscript selection into the work fragment shelf", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-fragment-shelf-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const prefix = `${randomUUID()} 앞 `;
  const exactFragment = `  ${randomUUID()} 파편  `;
  const suffix = ` 뒤 ${randomUUID()}`;
  const manuscriptText = `${prefix}${exactFragment}${suffix}`;
  const fragmentTitle = `보관-${randomUUID().slice(0, 8)}`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactFragment.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(exactFragment);

    await openReviewRail(page);
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    let shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await expect(shelf.getByRole("button", { name: "선택을 복사" }))
      .toBeEnabled();
    await shelf.getByLabel("새 파편 종류").selectOption("sentence");
    await shelf.getByRole("button", { name: "선택을 복사" }).click();
    await expect(shelf.locator(".fragment-card pre")).toHaveText(
      exactFragment,
      { useInnerText: true },
    );
    await expectEditorText(manuscript, manuscriptText);

    const titleInput = shelf.getByLabel("파편 제목");
    await titleInput.fill(fragmentTitle);
    await titleInput.press("Tab");
    await shelf.getByRole("button", { name: "상단 고정" }).click();
    await expect(
      shelf.getByRole("button", { name: "고정 해제" }),
    ).toBeVisible();
    await shelf.getByRole("button", { name: "파편 서랍 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    await openReviewRail(page);
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await expect(shelf.getByLabel("파편 제목")).toHaveValue(fragmentTitle);
    await expect(shelf.locator(".fragment-card pre")).toHaveText(
      exactFragment,
      { useInnerText: true },
    );
    await expect(
      shelf.getByRole("button", { name: "고정 해제" }),
    ).toBeVisible();
    await shelf.getByRole("button", { name: "원문 열기" }).click();
    await expect(shelf).toBeHidden();
    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(exactFragment);
    await expectEditorText(manuscript, manuscriptText);

    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    shelf = page.getByRole("dialog", { name: "파편 서랍" });
    page.once("dialog", (dialog) => dialog.accept());
    await shelf
      .getByRole("button", { name: "서랍에서 치우기" })
      .click();
    await expect(shelf).toContainText("이 작품에 보관한 파편이 없습니다.");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openReviewRail(page);
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await expect(shelf).toContainText("이 작품에 보관한 파편이 없습니다.");
    await expectEditorText(
      page.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens a fragment source across episodes with its exact selection", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-fragment-cross-episode-source-"),
  );
  const workTitle = randomUUID();
  const episodeATitle = `A-${randomUUID()}`;
  const episodeBTitle = `B-${randomUUID()}`;
  const prefix = `${randomUUID()} 앞 `;
  const exactFragment = `  ${randomUUID()} 교차 회차 파편  `;
  const suffix = ` 뒤 ${randomUUID()}`;
  const episodeAManuscript = `${prefix}${exactFragment}${suffix}`;
  const episodeBManuscript = `${randomUUID()} 다른 회차 원고 ${randomUUID()}`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(episodeATitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(episodeAManuscript);
    await expectEditorText(manuscript, episodeAManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const episodeADocumentId = await readActiveDocumentId(page);

    await createNamedEpisode(page, episodeBTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, "");
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(episodeBManuscript);
    await expectEditorText(manuscript, episodeBManuscript);
    await page.getByTestId("manuscript-title").click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const episodeBDocumentId = await readActiveDocumentId(page);
    expect(episodeBDocumentId).not.toBe(episodeADocumentId);

    const documentRail = page.getByRole("complementary", {
      name: "문서 레일",
    });
    await documentRail
      .locator(".document-tree-document .document-tree-open")
      .filter({ hasText: episodeATitle })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expectEditorText(manuscript, episodeAManuscript);

    await manuscript.click();
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactFragment.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(exactFragment);

    await openReviewRail(page);
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    let shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await expect(shelf.getByRole("button", { name: "선택을 복사" }))
      .toBeEnabled();
    await shelf.getByLabel("새 파편 종류").selectOption("sentence");
    await shelf.getByRole("button", { name: "선택을 복사" }).click();
    await expect(shelf.locator(".fragment-card pre")).toHaveText(
      exactFragment,
      { useInnerText: true },
    );
    await shelf.getByRole("button", { name: "파편 서랍 닫기" }).click();

    await documentRail
      .locator(".document-tree-document .document-tree-open")
      .filter({ hasText: episodeBTitle })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeBTitle,
    );
    await expectEditorText(manuscript, episodeBManuscript);

    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await shelf.getByRole("button", { name: "원문 열기" }).click();
    await expect(shelf).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      episodeATitle,
    );
    await expect.poll(() => readActiveDocumentId(page)).toBe(
      episodeADocumentId,
    );
    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(exactFragment);
    await expectEditorText(manuscript, episodeAManuscript);

    await documentRail
      .locator(".document-tree-document .document-tree-open")
      .filter({ hasText: episodeBTitle })
      .click();
    await expectEditorText(manuscript, episodeBManuscript);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("moves an exact selection to the fragment shelf and inserts it at the cursor", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-fragment-transfer-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const prefix = `${randomUUID()} 앞 `;
  const exactFragment = `  ${randomUUID()} 이동할 파편  `;
  const suffix = ` 뒤 ${randomUUID()}`;
  const originalManuscript = `${prefix}${exactFragment}${suffix}`;
  const movedManuscript = `${prefix}${suffix}`;
  const insertedManuscript = `${movedManuscript}${exactFragment}`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(originalManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactFragment.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect
      .poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(exactFragment);

    await openReviewRail(page);
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    let shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await shelf.getByRole("button", { name: "선택을 이동" }).click();
    await expect(shelf.locator(".fragment-card pre")).toHaveText(
      exactFragment,
      { useInnerText: true },
    );
    await expectEditorText(manuscript, movedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await shelf.getByRole("button", { name: "파편 서랍 닫기" }).click();

    await manuscript.press("Control+End");
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await expect(
      shelf.getByRole("button", { name: "커서에 삽입" }),
    ).toBeEnabled();
    await shelf.getByRole("button", { name: "커서에 삽입" }).click();
    await expect(shelf).toBeHidden();
    await expectEditorText(manuscript, insertedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await manuscript.press("Control+Z");
    await expectEditorText(manuscript, movedManuscript);
    await manuscript.press("Control+Y");
    await expectEditorText(manuscript, insertedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, insertedManuscript);
    await openReviewRail(page);
    await page
      .getByRole("button", { name: "파편 서랍 열기", exact: true })
      .click();
    shelf = page.getByRole("dialog", { name: "파편 서랍" });
    await expect(shelf.locator(".fragment-card pre")).toHaveText(
      exactFragment,
      { useInnerText: true },
    );
    await expect(shelf).toContainText("1회 사용");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

