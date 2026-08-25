import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

export type RunningElectronApp = Awaited<ReturnType<typeof electron.launch>>;

export async function continueFromMain(page: Page): Promise<void> {
  await page.getByRole("button", { name: /이어쓰기$/u }).first().click();
}

export async function openStudioWorkspace(electronApp: RunningElectronApp) {
  const page = await electronApp.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  await continueFromMain(page);
  await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
  return page;
}

export async function openReviewRail(page: Page): Promise<void> {
  const reviewRail = page.getByRole("complementary", { name: "검토 레일" });
  if (!(await reviewRail.isVisible())) {
    await page
      .getByRole("button", { name: "검토 레일 열기", exact: true })
      .click();
  }
  await expect(reviewRail).toBeVisible();
}

export async function createNamedEpisode(
  page: Page,
  title: string,
): Promise<void> {
  await page.getByRole("button", { name: "새 회차", exact: true }).click();
  await expect(page.getByTestId("manuscript-title")).toHaveText("제목없음");
  const documentRail = page.getByRole("complementary", { name: "문서 레일" });
  await documentRail.getByRole("button", { name: /제목없음$/u }).dblclick();
  const titleInput = documentRail.getByRole("textbox", {
    name: "회차 제목",
    exact: true,
  });
  await titleInput.fill(title);
  await titleInput.press("Enter");
  await expect(page.getByTestId("manuscript-title")).toHaveText(title);
}

export async function readActiveDocumentId(page: Page): Promise<string> {
  const documentId = await page
    .locator(".workspace-center")
    .getAttribute("data-active-document-id");
  if (documentId === null || documentId.length === 0) {
    throw new Error("Expected an active Document identity");
  }
  return documentId;
}

export async function readEditorText(editor: Locator): Promise<string> {
  return editor.evaluate((element) =>
    Array.from(element.querySelectorAll(":scope > .cm-line"))
      .map((line) => line.textContent ?? "")
      .join("\n")
  );
}

export async function expectEditorText(
  editor: Locator,
  expected: string,
): Promise<void> {
  await expect.poll(() => readEditorText(editor)).toBe(expected);
}

export async function removeVerifiedTemporaryDirectory(
  directory: string,
): Promise<void> {
  const temporaryRoot = path.resolve(tmpdir());
  const resolvedDirectory = path.resolve(directory);
  if (
    resolvedDirectory === temporaryRoot ||
    !resolvedDirectory.startsWith(temporaryRoot)
  ) {
    throw new Error("Refusing to remove a directory outside the OS temporary root");
  }
  await rm(resolvedDirectory, { recursive: true, force: true });
}
