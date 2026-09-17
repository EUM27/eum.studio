import historyFixture from "../fixtures/editor/manuscript-history.manifest.json";
import {
  randomUUID,
  expectEditorText,
  test,
  electron,
  openStudioWorkspace,
  documentTreeButton,
} from "./support/desktop-shell-suite";

test("retains every manuscript undo and redo across repeated keyboard and toolbar round trips", async () => {
  test.setTimeout(historyFixture.e2eTimeoutMs);
  const workId = randomUUID();
  const documents = Array.from({ length: 2 }, () => ({
    workId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  }));
  const [firstDocument, secondDocument] = documents;
  if (firstDocument === undefined || secondDocument === undefined) {
    throw new Error("History regression requires two documents");
  }
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify({
        schemaVersion: 1,
        initialDocumentId: firstDocument.documentId,
        documents,
      }),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole("textbox", { name: "원고", exact: true });
    const edits = Array.from(
      { length: historyFixture.editCount },
      () => randomUUID().slice(0, 1),
    );
    await manuscript.press("Control+End");
    for (const edit of edits) {
      await page.keyboard.insertText(edit);
      // Actual cursor movement keeps consecutive input groups independent.
      await manuscript.press("ArrowLeft");
      await manuscript.press("ArrowRight");
    }
    const completedText = firstDocument.initialText + edits.join("");
    await expectEditorText(manuscript, completedText);

    for (let round = 0; round < historyFixture.roundTrips; round += 1) {
      for (let remaining = edits.length - 1; remaining >= 0; remaining -= 1) {
        if (round === 0) {
          await manuscript.press("Control+Z");
        } else {
          const button = page.getByRole("button", { name: "실행 취소", exact: true });
          // Exercise the pointer path once, then activate the same real button
          // with Enter to avoid frame-throttled pointer waits in a hidden window.
          if (remaining === edits.length - 1) await button.click();
          else await button.press("Enter");
        }
        await expectEditorText(manuscript,
          firstDocument.initialText + edits.slice(0, remaining).join(""),
        );
      }

      await documentTreeButton(page, secondDocument.label).click();
      await expectEditorText(manuscript, secondDocument.initialText);
      await documentTreeButton(page, firstDocument.label).click();
      await expectEditorText(manuscript, firstDocument.initialText);

      for (let restored = 1; restored <= edits.length; restored += 1) {
        if (round === 0) {
          await manuscript.press("Control+Y");
        } else {
          const button = page.getByRole("button", { name: "다시 실행", exact: true });
          // Exercise the pointer path once, then activate the same real button
          // with Enter to avoid frame-throttled pointer waits in a hidden window.
          if (restored === 1) await button.click();
          else await button.press("Enter");
        }
        await expectEditorText(manuscript,
          firstDocument.initialText + edits.slice(0, restored).join(""),
        );
      }
    }

    const cursorProbe = randomUUID();
    await page.keyboard.insertText(cursorProbe);
    await expectEditorText(manuscript, completedText + cursorProbe);
    await manuscript.press("Control+Z");
    await expectEditorText(manuscript, completedText);
    const branchEdit = randomUUID();
    await page.keyboard.insertText(branchEdit);
    await manuscript.press("Control+Y");
    await expectEditorText(manuscript, completedText + branchEdit);

    await documentTreeButton(page, secondDocument.label).click();
    await expectEditorText(manuscript, secondDocument.initialText);
  } finally {
    await electronApp.close();
  }
});
