import {
  randomInt,
  randomUUID,
  readFileSync,
  mkdir,
  mkdtemp,
  readFile,
  tmpdir,
  path,
  DatabaseSync,
  expect,
  test,
  electron,
  parseManuscriptInputProfile,
  getPreviousEpisodeFlowPreviewText,
  applyChangeBatch,
  DURABLE_TEXT_REPRESENTATION_V1,
  parseCanonicalChangeBatch,
  parseChangeBatch,
  scanJournalFrames,
  createNodeCryptoJournalChecksumAdapter,
  readJsonFixture,
  readHangulCompositionText,
  openStudioWorkspace,
  continueFromMain,
  openStudioHome,
  documentTreeButton,
  activateDocumentFromTree,
  createNamedEpisode,
  readActiveDocumentId,
  expectEditorText,
  selectElectronRuntimeHashAlgorithm,
  removeVerifiedTemporaryDirectory,
  createDocumentSwitchProfile,
  createStartupRecoveryFixture,
  createResumeRecoveryFixture,
  type Locator,
  type Page,
} from "./support/desktop-shell-suite";
test("returns a durable receipt through the typed Electron save command", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), randomUUID()));
  const journalPath = path.join(directory, randomUUID());
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const nextSequence = randomInt(0, 10_000);
  const insertedText = randomUUID();
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: document.documentId,
    documents: [document],
  };
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm,
    documentSequences: [
      {
        documentId: document.documentId,
        nextSequence,
      },
    ],
  };
  const batch = parseChangeBatch({
    schemaVersion: 1,
    textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: document.workId,
    documentId: document.documentId,
    baseRevisionId: document.documentRevisionId,
    sequence: nextSequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: document.initialText.length,
    afterTextLengthUtf16:
      document.initialText.length + insertedText.length,
    changes: [
      {
        fromUtf16: document.initialText.length,
        toUtf16: document.initialText.length,
        insertedText,
      },
    ],
  });
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify(journalProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const receipt = await page.evaluate(
      (changeBatch) =>
        window.eumStudio.editor.saveChangeBatch(changeBatch),
      batch,
    );
    const adapter =
      createNodeCryptoJournalChecksumAdapter(
        checksumAlgorithm,
      );
    const scan = await scanJournalFrames(
      await readFile(journalPath),
      (adapterId) =>
        adapterId === adapter.id ? adapter : null,
    );

    expect(scan.tail).toBeNull();
    expect(scan.records).toHaveLength(1);
    expect(
      parseCanonicalChangeBatch(
        scan.records[0]?.payload ?? new Uint8Array(),
      ),
    ).toEqual(batch);
    expect(receipt).toMatchObject({
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      frameStartByteOffset:
        scan.records[0]?.frameStartByteOffset,
      frameEndByteOffset:
        scan.records[0]?.frameEndByteOffset,
    });
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("saves editor batches on blur and shows only durable receipt state as saved", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), randomUUID()));
  const journalPath = path.join(directory, randomUUID());
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const nextSequence = randomInt(0, 10_000);
  const insertedText = randomUUID();
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: document.documentId,
    documents: [document],
  };
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm,
    documentSequences: [
      {
        documentId: document.documentId,
        nextSequence,
      },
    ],
  };
  const batchingProfile = {
    schemaVersion: 1,
    maxTransactionsPerBatch:
      insertedText.length + randomInt(8, 64),
    maxDelayMs: randomInt(30_000, 60_000),
  };
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify(journalProfile),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify(batchingProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole("textbox", {
      name: "원고",
    });
    const saveState = page.getByTestId("save-state");

    await expect(saveState).toHaveText("저장됨");
    await manuscript.click();
    await manuscript.press("End");
    await manuscript.pressSequentially(insertedText);
    await expect(saveState).toHaveText("편집 중");

    await page
      .getByTestId("manuscript-title")
      .click();
    await expect(saveState).toHaveText("저장됨");

    const adapter =
      createNodeCryptoJournalChecksumAdapter(
        checksumAlgorithm,
      );
    const scan = await scanJournalFrames(
      await readFile(journalPath),
      (adapterId) =>
        adapterId === adapter.id ? adapter : null,
    );
    expect(scan.tail).toBeNull();
    expect(scan.records.length).toBeGreaterThanOrEqual(1);
    const batches = scan.records.map((record) =>
      parseCanonicalChangeBatch(record.payload)
    );
    batches.forEach((batch, index) => {
      expect(batch).toMatchObject({
        workId: document.workId,
        documentId: document.documentId,
        baseRevisionId: document.documentRevisionId,
        sequence: nextSequence + index,
      });
    });
    expect(batches.reduce<string>(
      (text, batch) => applyChangeBatch(text, batch),
      document.initialText,
    )).toBe(
      document.initialText + insertedText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("flushes pending editor changes before a graceful window close completes", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), randomUUID()),
  );
  const journalPath = path.join(
    directory,
    randomUUID(),
  );
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const nextSequence = randomInt(0, 10_000);
  const insertedText = randomUUID();
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify({
          schemaVersion: 1,
          initialDocumentId:
            document.documentId,
          documents: [document],
        }),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify({
          schemaVersion: 1,
          journalPath,
          checksumAlgorithm,
          documentSequences: [
            {
              documentId:
                document.documentId,
              nextSequence,
            },
          ],
        }),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify({
          schemaVersion: 1,
          maxTransactionsPerBatch:
            insertedText.length +
            randomInt(8, 64),
          maxDelayMs:
            randomInt(30_000, 60_000),
        }),
      EUM_STUDIO_WINDOW_VISIBILITY:
        "hidden",
      EUM_STUDIO_HARDWARE_ACCELERATION:
        "disabled",
      EUM_STUDIO_DISABLE_SANDBOX:
        "1",
    },
  });
  let closed = false;

  try {
    const page =
      await openStudioWorkspace(electronApp);
    const manuscript =
      page.getByRole("textbox", {
        name: "원고",
        exact: true,
      });
    await manuscript.click();
    await manuscript.press("End");
    await manuscript.pressSequentially(
      insertedText,
    );
    await expect(
      page.getByTestId("save-state"),
    ).toHaveText("편집 중");

    const closeObserved =
      electronApp.waitForEvent("close");
    await electronApp.evaluate(
      ({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close();
      },
    );
    await closeObserved;
    closed = true;

    const bytes = await readFile(
      journalPath,
    ).catch(() => new Uint8Array());
    const adapter =
      createNodeCryptoJournalChecksumAdapter(
        checksumAlgorithm,
      );
    const scan = await scanJournalFrames(
      bytes,
      (adapterId) =>
        adapterId === adapter.id
          ? adapter
          : null,
    );
    expect(scan.tail).toBeNull();
    expect(scan.records.length).toBeGreaterThanOrEqual(1);
    const batches = scan.records.map((record) =>
      parseCanonicalChangeBatch(record.payload)
    );
    batches.forEach((batch, index) => {
      expect(batch).toMatchObject({
        workId: document.workId,
        documentId: document.documentId,
        baseRevisionId: document.documentRevisionId,
        sequence: nextSequence + index,
      });
    });
    const replayedText = batches.reduce<string>(
      (text, batch) => applyChangeBatch(text, batch),
      document.initialText,
    );
    expect(replayedText).toBe(
      document.initialText + insertedText,
    );
  } finally {
    if (!closed) {
      await electronApp.close();
    }
    await removeVerifiedTemporaryDirectory(
      directory,
    );
  }
});

test("shows a failed save state when the durable journal append fails", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), randomUUID()));
  const journalPath = path.join(directory, randomUUID());
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const insertedText = randomUUID();
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: document.documentId,
    documents: [document],
  };
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm,
    documentSequences: [
      {
        documentId: document.documentId,
        nextSequence: randomInt(0, 10_000),
      },
    ],
  };
  const batchingProfile = {
    schemaVersion: 1,
    maxTransactionsPerBatch:
      insertedText.length + randomInt(8, 64),
    maxDelayMs: randomInt(30_000, 60_000),
  };
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify(journalProfile),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify(batchingProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole("textbox", {
      name: "원고",
    });
    const saveState = page.getByTestId("save-state");

    await expect(saveState).toHaveText("저장됨");
    await mkdir(journalPath);
    await manuscript.click();
    await manuscript.press("End");
    await manuscript.pressSequentially(insertedText);
    await expect(saveState).toHaveText("편집 중");

    await page
      .getByTestId("manuscript-title")
      .click();
    await expect(saveState).toHaveText("실패");
    await expect(saveState).not.toHaveText("저장됨");
  } finally {
    const closed = electronApp.waitForEvent("close");
    await electronApp.evaluate(({ app }) => {
      app.exit();
    });
    await closed;
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the baseline read-only until the user previews and explicitly applies startup recovery", async () => {
  const fixture =
    await createStartupRecoveryFixture();
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
      JSON.stringify(
        fixture.documentProfile,
      ),
    EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
      JSON.stringify(
        fixture.journalProfile,
      ),
    EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
      JSON.stringify(
        fixture.batchingProfile,
      ),
    EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE:
      JSON.stringify(fixture.applyProfile),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole(
      "textbox",
      { name: "원고", exact: true },
    );
    const saveState =
      page.getByTestId("save-state");

    await expect(
      page.getByRole("heading", {
        name: "복구 미리보기",
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("recovery-preview"),
    ).toHaveValue(fixture.recoveredText);
    await expect(manuscript).toHaveText(
      fixture.document.initialText,
    );
    await expect(manuscript).toHaveAttribute(
      "aria-readonly",
      "true",
    );
    await expect(manuscript).toHaveAttribute(
      "contenteditable",
      "false",
    );
    await expect(saveState).toHaveText(
      "복구 적용 대기",
    );

    await page
      .getByRole("button", {
        name: "복구 적용",
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "복구 미리보기",
      }),
    ).toHaveCount(0);
    await expect(manuscript).toHaveText(
      fixture.recoveredText,
    );
    await expect(manuscript).toHaveAttribute(
      "contenteditable",
      "true",
    );
    await expect(manuscript).not.toHaveAttribute(
      "aria-readonly",
      "true",
    );
    await expect(saveState).toHaveText("저장됨");
    expect(
      new TextDecoder(
        DURABLE_TEXT_REPRESENTATION_V1
          .hashAndAnchorInputEncoding,
      ).decode(
        await readFile(fixture.contentPath),
      ),
    ).toBe(fixture.recoveredText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    const restartedPage =
      await openStudioWorkspace(electronApp);
    const restartedManuscript =
      restartedPage.getByRole("textbox", {
        name: "원고",
        exact: true,
      });
    await expect(
      restartedPage.getByRole("heading", {
        name: "복구 미리보기",
      }),
    ).toHaveCount(0);
    await expect(restartedManuscript).toHaveText(
      fixture.recoveredText,
    );
    await expect(
      restartedManuscript,
    ).toHaveAttribute(
      "contenteditable",
      "true",
    );
    await expect(
      restartedPage.getByTestId(
        "save-state",
      ),
    ).toHaveText("저장됨");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(
      fixture.directory,
    );
  }
});

test("replays a published manuscript and restores its exact cursor selection after a full restart", async () => {
  const fixture =
    await createResumeRecoveryFixture();
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
      JSON.stringify(
        fixture.documentProfile,
      ),
    EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
      JSON.stringify(
        fixture.journalProfile,
      ),
    EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
      JSON.stringify(
        fixture.batchingProfile,
      ),
    EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE:
      JSON.stringify(
        fixture.applyProfile,
      ),
    EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE:
      JSON.stringify(
        fixture.resumeCheckpointProfile,
      ),
    EUM_STUDIO_WINDOW_VISIBILITY:
      "hidden",
  };
  let electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const readDirectionalSelection = async (
    manuscript: Locator,
  ) => {
    return manuscript.evaluate((editor) => {
      const host = editor.closest(
        ".manuscript-editor",
      );
      if (
        !(host instanceof HTMLElement)
      ) {
        return null;
      }
      const anchor = Number.parseInt(
        host.dataset.selectionAnchor ??
          "",
        10,
      );
      const head = Number.parseInt(
        host.dataset.selectionHead ?? "",
        10,
      );
      if (
        !Number.isSafeInteger(anchor) ||
        !Number.isSafeInteger(head)
      ) {
        return null;
      }
      const text = editor.textContent ?? "";
      return {
        anchor,
        head,
        text: text.slice(
          Math.min(anchor, head),
          Math.max(anchor, head),
        ),
      };
    });
  };

  try {
    const page =
      await openStudioWorkspace(electronApp);
    const manuscript =
      page.getByRole("textbox", {
        name: "원고",
        exact: true,
      });
    await expect(manuscript).toHaveText(
      fixture.originContent,
    );
    await expect
      .poll(() =>
        readDirectionalSelection(
          manuscript,
        ),
      )
      .toEqual({
        ...fixture.originSelection,
        text: fixture.selectedText,
      });

    await page
      .getByRole("button", {
        name: "복구 적용",
      })
      .click();
    await expect(manuscript).toHaveText(
      fixture.recoveredText,
    );
    await expect(
      page.evaluate(() =>
        window.eumStudio.editor.getManuscriptResumeCheckpoint(),
      ),
    ).resolves.toMatchObject({
      status: "resolved",
      selection:
        fixture.recoveredSelection,
    });
    await expect
      .poll(() =>
        readDirectionalSelection(
          manuscript,
        ),
      )
      .toEqual({
        ...fixture.recoveredSelection,
        text: fixture.selectedText,
      });

    await electronApp.close();
    electronApp = await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    const restartedPage =
      await openStudioWorkspace(electronApp);
    const restartedManuscript =
      restartedPage.getByRole(
        "textbox",
        {
          name: "원고",
          exact: true,
        },
      );
    await expect(
      restartedManuscript,
    ).toHaveText(
      fixture.recoveredText,
    );
    await expect
      .poll(() =>
        readDirectionalSelection(
          restartedManuscript,
        ),
      )
      .toEqual({
        ...fixture.recoveredSelection,
        text: fixture.selectedText,
      });
  } finally {
    await electronApp
      .close()
      .catch(() => undefined);
    await removeVerifiedTemporaryDirectory(
      fixture.directory,
    );
  }
});

test("shows a read-only recovery issue without an apply action when the active journal cannot be read", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), randomUUID()),
  );
  const journalPath = path.join(
    directory,
    randomUUID(),
  );
  await mkdir(journalPath);
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify({
          schemaVersion: 1,
          initialDocumentId:
            document.documentId,
          documents: [document],
        }),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify({
          schemaVersion: 1,
          journalPath,
          checksumAlgorithm,
          documentSequences: [
            {
              documentId:
                document.documentId,
              nextSequence: randomInt(
                0,
                10_000,
              ),
            },
          ],
        }),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify({
          schemaVersion: 1,
          maxTransactionsPerBatch:
            randomInt(1, 32),
          maxDelayMs: randomInt(
            0,
            60_000,
          ),
        }),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole(
      "textbox",
      { name: "원고", exact: true },
    );

    await expect(
      page.getByRole("heading", {
        name: "복구 확인 필요",
      }),
    ).toBeVisible();
    await expect(manuscript).toHaveText(
      document.initialText,
    );
    await expect(manuscript).toHaveAttribute(
      "aria-readonly",
      "true",
    );
    await expect(
      page.getByTestId("save-state"),
    ).toHaveText("복구 확인 필요");
    await expect(
      page.getByRole("button", {
        name: "복구 적용",
      }),
    ).toHaveCount(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(
      directory,
    );
  }
});

test("holds durable saves through Hangul composition and appends only after commit", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), randomUUID()));
  const journalPath = path.join(directory, randomUUID());
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const compositionText = readHangulCompositionText();
  const document = {
    workId: randomUUID(),
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: "",
  };
  const nextSequence = randomInt(0, 10_000);
  const batchingDelayMs = randomInt(60, 120);
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: document.documentId,
    documents: [document],
  };
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm,
    documentSequences: [
      {
        documentId: document.documentId,
        nextSequence,
      },
    ],
  };
  const batchingProfile = {
    schemaVersion: 1,
    maxTransactionsPerBatch: randomInt(1, 8),
    maxDelayMs: batchingDelayMs,
  };
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify(journalProfile),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify(batchingProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole("textbox", {
      name: "원고",
    });
    const saveState = page.getByTestId("save-state");
    const session = await page.context().newCDPSession(page);

    await expect(saveState).toHaveText("저장됨");
    await manuscript.focus();
    await session.send("Input.imeSetComposition", {
      text: compositionText,
      selectionStart: compositionText.length,
      selectionEnd: compositionText.length,
      replacementStart: 0,
      replacementEnd: 0,
    });
    await expect(manuscript).toHaveText(compositionText);
    await expect(saveState).toHaveText("편집 중");
    await page.waitForTimeout(batchingDelayMs * 2);
    await expect(saveState).toHaveText("편집 중");
    const journalBeforeCommit = await readFile(journalPath).then(
      () => "present",
      (error: NodeJS.ErrnoException) => error.code,
    );
    expect(journalBeforeCommit).toBe("ENOENT");

    await session.send("Input.insertText", {
      text: compositionText,
    });
    await expect(manuscript).toHaveText(compositionText);
    await expect(saveState).toHaveText("저장됨");

    const adapter =
      createNodeCryptoJournalChecksumAdapter(
        checksumAlgorithm,
      );
    const scan = await scanJournalFrames(
      await readFile(journalPath),
      (adapterId) =>
        adapterId === adapter.id ? adapter : null,
    );
    expect(scan.tail).toBeNull();
    expect(scan.records).toHaveLength(1);
    const batch = parseCanonicalChangeBatch(
      scan.records[0]?.payload ?? new Uint8Array(),
    );
    expect(batch).toMatchObject({
      workId: document.workId,
      documentId: document.documentId,
      baseRevisionId: document.documentRevisionId,
      sequence: nextSequence,
    });
    expect(applyChangeBatch(document.initialText, batch)).toBe(
      compositionText,
    );
    await session.detach();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("flushes the current document batch before a document switch", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), randomUUID()));
  const journalPath = path.join(directory, randomUUID());
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const documentProfile =
    createDocumentSwitchProfile(randomUUID());
  const [firstDocument, secondDocument] =
    documentProfile.documents;
  const firstNextSequence = randomInt(0, 10_000);
  const secondNextSequence = randomInt(0, 10_000);
  const edit = randomUUID();
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm,
    documentSequences: [
      {
        documentId: firstDocument.documentId,
        nextSequence: firstNextSequence,
      },
      {
        documentId: secondDocument.documentId,
        nextSequence: secondNextSequence,
      },
    ],
  };
  const batchingProfile = {
    schemaVersion: 1,
    maxTransactionsPerBatch:
      edit.length + randomInt(8, 64),
    maxDelayMs: randomInt(30_000, 60_000),
  };
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify(journalProfile),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify(batchingProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const manuscript = page.getByRole("textbox", {
      name: "원고",
    });
    const saveState = page.getByTestId("save-state");

    await expect(saveState).toHaveText("저장됨");
    await manuscript.click();
    await manuscript.press("End");
    await manuscript.pressSequentially(edit);
    await expect(saveState).toHaveText("편집 중");

    await activateDocumentFromTree(page, secondDocument.label);
    expect(await readActiveDocumentId(page)).toBe(secondDocument.documentId);
    await expectEditorText(manuscript, secondDocument.initialText);
    await expect(saveState).toHaveText("저장됨");

    const adapter =
      createNodeCryptoJournalChecksumAdapter(
        checksumAlgorithm,
      );
    let previousRecordCount: number | null = null;
    let stableRecordReads = 0;
    await expect
      .poll(async () => {
        try {
          const scan = await scanJournalFrames(
            await readFile(journalPath),
            (adapterId) =>
              adapterId === adapter.id ? adapter : null,
          );
          if (scan.tail !== null || scan.records.length < 1) {
            previousRecordCount = null;
            stableRecordReads = 0;
            return stableRecordReads;
          }
          stableRecordReads = scan.records.length === previousRecordCount
            ? stableRecordReads + 1
            : 1;
          previousRecordCount = scan.records.length;
          return stableRecordReads;
        } catch {
          previousRecordCount = null;
          stableRecordReads = 0;
          return stableRecordReads;
        }
      })
      .toBeGreaterThanOrEqual(2);
    const scan = await scanJournalFrames(
      await readFile(journalPath),
      (adapterId) =>
        adapterId === adapter.id ? adapter : null,
    );
    expect(scan.tail).toBeNull();
    expect(scan.records.length).toBeGreaterThanOrEqual(1);
    const batches = scan.records.map((record) =>
      parseCanonicalChangeBatch(record.payload)
    );
    batches.forEach((batch, index) => {
      expect(batch).toMatchObject({
        workId: firstDocument.workId,
        documentId: firstDocument.documentId,
        baseRevisionId: firstDocument.documentRevisionId,
        sequence: firstNextSequence + index,
      });
    });
    const replayedText = batches.reduce(
      (text, batch) => applyChangeBatch(text, batch),
      firstDocument.initialText,
    );
    expect(replayedText).toBe(
      firstDocument.initialText + edit,
    );

    await activateDocumentFromTree(page, firstDocument.label);
    await expect(saveState).toHaveText("저장됨");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
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
    const window = await openStudioWorkspace(electronApp);
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
    await expect(
      window.getByTestId("manuscript-character-count"),
    ).toHaveText(
      String(insertedText.length),
    );
  } finally {
    await electronApp.close();
  }
});

test("shows user character statistics instead of UTF-16 editor offsets", async () => {
  const combinedCharacter = `${randomUUID()[0]}${String.fromCodePoint(0x0301)}`;
  const joinedEmoji = String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb);
  const initialText = `${randomUUID()}${combinedCharacter}${joinedEmoji} \n${randomUUID()}`;
  const documentProfile = createDocumentSwitchProfile(initialText);
  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      initialText,
    ),
    ({ segment }) => segment,
  );
  const withoutWhitespace = segments.filter(
    (segment) => !/^\p{White_Space}/u.test(segment),
  );
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);

    expect(initialText.length).toBeGreaterThan(segments.length);
    await expect(
      window.getByTestId("manuscript-character-count"),
    ).toHaveText(String(segments.length));
    await expect(
      window.getByTestId("manuscript-character-count-without-whitespace"),
    ).toHaveText(String(withoutWhitespace.length));
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
    const window = await openStudioWorkspace(electronApp);
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
    const window = await openStudioWorkspace(electronApp);
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
    const window = await openStudioWorkspace(electronApp);
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
    await expect(
      window.getByTestId("manuscript-character-count"),
    ).toHaveText(
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

test("keeps each document state and scroll independent across switches", async () => {
  const documentProfile = createDocumentSwitchProfile();
  const [firstDocument, secondDocument] = documentProfile.documents;
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const firstDocumentButton = documentTreeButton(window, firstDocument.label);
    const secondDocumentButton = documentTreeButton(window, secondDocument.label);
    const scroller = window.locator(".cm-scroller");
    const manuscriptCharacterCount = window.getByTestId(
      "manuscript-character-count",
    );
    const readCurrentManuscriptText = () =>
      manuscript.evaluate((editor) =>
        Array.from(editor.querySelectorAll(":scope > .cm-line"))
          .map((line) => line.textContent ?? "")
          .join("\n"),
      );
    const firstEdit = randomUUID();
    const secondEdit = randomUUID();

    await expect(window.getByTestId("current-document")).toHaveText(
      firstDocument.label,
    );
    await expect(manuscriptCharacterCount).toHaveText(
      String(firstDocument.initialText.length),
    );
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(firstEdit);
    await expect(manuscriptCharacterCount).toHaveText(
      String(firstDocument.initialText.length + firstEdit.length),
    );
    for (let index = 0; index < firstEdit.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    const firstScrollTop = await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
      return element.scrollTop;
    });
    expect(firstScrollTop).toBeGreaterThan(0);

    await secondDocumentButton.click();
    await expect.poll(readCurrentManuscriptText).toBe(secondDocument.initialText);
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(secondEdit);
    await expect.poll(readCurrentManuscriptText).toBe(
      `${secondDocument.initialText}${secondEdit}`,
    );

    await firstDocumentButton.click();
    await expect(manuscriptCharacterCount).toHaveText(
      String(firstDocument.initialText.length + firstEdit.length),
    );
    await manuscript.focus();
    await expect
      .poll(() =>
        manuscript.evaluate(
          () => globalThis.getSelection()?.toString() ?? "",
        ),
      )
      .toBe(firstEdit);
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    await manuscript.press("Control+Z");
    await expect(manuscriptCharacterCount).toHaveText(
      String(firstDocument.initialText.length),
    );
    await manuscript.press("Control+Y");
    await expect(manuscriptCharacterCount).toHaveText(
      String(firstDocument.initialText.length + firstEdit.length),
    );

    await secondDocumentButton.click();
    await expect.poll(readCurrentManuscriptText).toBe(
      `${secondDocument.initialText}${secondEdit}`,
    );
    await manuscript.press("Control+Z");
    await expect.poll(readCurrentManuscriptText).toBe(secondDocument.initialText);
  } finally {
    await electronApp.close();
  }
});

test("shows only the immediate previous episode flow without changing manuscript state", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-previous-flow-"),
  );
  const earlierText = Array.from(
    { length: randomInt(8, 12) },
    () => `${randomUUID()}.`,
  ).join(" ");
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const previousEnding = randomUUID();
  const latestEnding = randomUUID();
  const secondDocumentEdit = randomUUID();
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const manuscript = window.getByRole("textbox", { name: "원고" });
    const flow = window.getByRole("region", { name: "이전 화 흐름" });
    const manuscriptCharacterCount = window.getByTestId(
      "manuscript-character-count",
    );

    await expect(manuscript).toBeVisible();
    await expect(flow).toHaveCount(0);
    const firstDocumentId = await readActiveDocumentId(window);
    const firstDocumentText =
      `${earlierText}\n\n${previousEnding}.\n${latestEnding}\t—기호!`;
    await manuscript.pressSequentially(firstDocumentText);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(window, secondDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    expect(await readActiveDocumentId(window)).not.toBe(firstDocumentId);
    await expect(flow).toBeVisible();
    await expect(flow).toHaveAttribute(
      "data-source-document-id",
      firstDocumentId,
    );
    await expect(flow.locator("strong")).toHaveText(firstDocumentTitle);
    await expect(flow).toContainText(previousEnding);
    await expect(flow).toContainText(latestEnding);
    await expect(manuscriptCharacterCount).toHaveText("0");
    const expectedFlowLines = getPreviousEpisodeFlowPreviewText(
      firstDocumentText,
    ).split("\n");
    await expect.poll(() =>
      flow.locator(".previous-flow-context-line").evaluateAll((lines) =>
        lines.map((line) => line.textContent ?? "")
      )
    ).toEqual(expectedFlowLines);

    const manuscriptContent = window.locator(".manuscript-editor .cm-content");
    await expect(manuscriptContent).toHaveAttribute(
      "data-has-previous-flow",
      "true",
    );
    await window
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await window.locator(".manuscript-focus-toolbar-host").hover();
    const manuscriptFocusToolbar = window.getByRole("region", {
      name: "집중 화면 도구",
    });
    await manuscriptFocusToolbar
      .getByRole("button", { name: "커서 따라가기", exact: true })
      .click();
    await expect.poll(() => flow.evaluate((element) => {
      const scroller = element.closest<HTMLElement>(".cm-scroller");
      if (scroller === null) {
        throw new Error("The manuscript scroller is missing");
      }
      const topGap = element.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;
      return topGap >= 0 && topGap < 80;
    })).toBe(true);
    await window.locator(".manuscript-focus-toolbar-host").hover();
    await manuscriptFocusToolbar
      .getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();

    await manuscript.click();
    await manuscript.pressSequentially(secondDocumentEdit);
    await expect(manuscriptCharacterCount).toHaveText(
      String(secondDocumentEdit.length),
    );
    await manuscript.press("Control+Z");
    await expect(manuscriptCharacterCount).toHaveText("0");
    await expect(flow).toContainText(latestEnding);

    await activateDocumentFromTree(window, firstDocumentTitle);
    await expect(flow).toHaveCount(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("loads ordered episodes while scrolling and restores the exact reading line after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-continuous-reading-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const thirdDocumentTitle = randomUUID();
  const createManuscript = (title: string) =>
    Array.from(
      { length: randomInt(72, 88) },
      (_, index) => `${title} ${index + 1} ${randomUUID()}`,
    ).join("\n");
  const firstManuscript = createManuscript(firstDocumentTitle);
  const secondManuscript = createManuscript(secondDocumentTitle);
  const thirdManuscript = createManuscript(thirdDocumentTitle);
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
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await window.keyboard.insertText(firstManuscript);
    await expect(window.getByTestId("manuscript-character-count")).toHaveText(
      String(firstManuscript.length),
    );
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    for (const [title, text] of [
      [secondDocumentTitle, secondManuscript],
      [thirdDocumentTitle, thirdManuscript],
    ] as const) {
      await createNamedEpisode(window, title);
      await expect(window.getByTestId("manuscript-title")).toHaveText(title);
      manuscript = window.getByRole("textbox", { name: "원고" });
      await expect(window.getByTestId("manuscript-character-count")).toHaveText(
        "0",
      );
      await manuscript.click();
      await window.keyboard.insertText(text);
      await expect(window.getByTestId("manuscript-character-count")).toHaveText(
        String(text.length),
      );
      await expect(window.getByTestId("save-state")).toHaveText("저장됨");
    }

    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await window
      .getByRole("button", { name: "연속 읽기", exact: true })
      .click();
    let dialog = window.getByRole("dialog", { name: "연속 읽기" });
    let readingRegion = dialog.getByRole("region", {
      name: "연속 읽기 본문",
    });
    await expect(dialog).toContainText("1 / 3회차");
    await expect(
      dialog.getByText(firstDocumentTitle, { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText(secondDocumentTitle, { exact: true }),
    ).toHaveCount(0);

    await readingRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(dialog).toContainText("2 / 3회차");
    await expect(
      dialog.getByText(secondDocumentTitle, { exact: true }),
    ).toBeVisible();
    await readingRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(dialog).toContainText("3 / 3회차");
    const thirdDocument = dialog
      .locator(".continuous-reading-document")
      .filter({ hasText: thirdDocumentTitle });
    await expect(thirdDocument).toBeVisible();
    await expect(
      thirdDocument.locator("[data-reading-text-offset]"),
    ).toHaveCount(thirdManuscript.split("\n").length);
    const targetLine = thirdDocument
      .locator("[data-reading-text-offset]")
      .nth(12);
    await targetLine.evaluate((line) => {
      const container = line.closest<HTMLElement>(".continuous-reading-scroll");
      if (container === null) {
        throw new Error("The continuous reading scroll container is missing");
      }
      container.scrollTop +=
        line.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const targetOffset = await thirdDocument
      .locator("[data-reading-text-offset]")
      .evaluateAll((lines) => {
        const container = lines[0]?.closest<HTMLElement>(
          ".continuous-reading-scroll",
        );
        if (container === null || container === undefined) return null;
        const containerTop = container.getBoundingClientRect().top;
        return (
          lines.find(
            (line) => line.getBoundingClientRect().bottom > containerTop,
          )?.getAttribute("data-reading-text-offset") ?? null
        );
      });
    expect(targetOffset).not.toBeNull();
    await dialog
      .getByRole("button", { name: "연속 읽기 닫기", exact: true })
      .click();
    await expect(dialog).toBeHidden();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await openStudioWorkspace(electronApp);
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await window
      .getByRole("button", { name: "연속 읽기", exact: true })
      .click();
    dialog = window.getByRole("dialog", { name: "연속 읽기" });
    readingRegion = dialog.getByRole("region", {
      name: "연속 읽기 본문",
    });
    await expect(dialog).toContainText("3 / 3회차");
    const restoredLine = dialog
      .locator(".continuous-reading-document")
      .filter({ hasText: thirdDocumentTitle })
      .locator(`[data-reading-text-offset="${targetOffset}"]`);
    await expect(restoredLine).toBeVisible();
    await expect
      .poll(() =>
        restoredLine.evaluate((line) => {
          const container = line.closest<HTMLElement>(
            ".continuous-reading-scroll",
          );
          if (container === null) return Number.POSITIVE_INFINITY;
          return Math.abs(
            line.getBoundingClientRect().top -
              container.getBoundingClientRect().top,
          );
        }),
      )
      .toBeLessThan(3);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates untitled episodes without requiring a title", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-untitled-episodes-"),
  );
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(randomUUID());
    await expect(
      createWorkDialog.getByRole("button", {
        name: "작품 만들기",
        exact: true,
      }),
    ).toBeEnabled();
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const documentButtons = documentRail.locator(
      ".document-tree-document .document-tree-open",
    );
    await expect(documentButtons).toHaveText(["○제목없음"]);
    await expect(documentButtons.first()).toHaveAttribute("aria-current", "page");

    await window
      .getByRole("button", { name: "새 회차", exact: true })
      .click();

    await expect(documentButtons).toHaveText([
      "○제목없음",
      "○제목없음",
    ]);
    await expect(documentButtons.first()).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(documentButtons.nth(1)).toHaveAttribute("aria-current", "page");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("renames the active work and episode without changing manuscript state", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-rename-workspace-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const renamedWorkTitle = randomUUID();
  const renamedDocumentTitle = randomUUID();
  const manuscriptText = randomUUID();
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
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await window
      .getByRole("button", { name: "작품 이름 변경", exact: true })
      .click();
    const workRenameForm = window.locator(
      'form[aria-label="작품 이름 변경"]',
    );
    await workRenameForm.getByLabel("작품 새 이름").fill(renamedWorkTitle);
    await workRenameForm
      .getByRole("button", { name: "저장", exact: true })
      .click();
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    await expect(
      documentRail.getByRole("heading", { name: renamedWorkTitle, exact: true }),
    ).toBeVisible();
    await documentTreeButton(window, documentTitle).dblclick();
    const documentTitleInput = documentRail.getByRole("textbox", {
      name: "회차 제목",
      exact: true,
    });
    await expect(documentTitleInput).toHaveValue("");
    await documentTitleInput.press("Escape");
    await expect(documentTitleInput).toHaveCount(0);
    await expect(documentTreeButton(window, documentTitle)).toBeVisible();
    await documentTreeButton(window, documentTitle).dblclick();
    await expect(documentTitleInput).toHaveValue("");
    await window.getByTestId("manuscript-title").click();
    await expect(documentTitleInput).toHaveCount(0);
    await expect(documentTreeButton(window, documentTitle)).toBeVisible();
    await documentTreeButton(window, documentTitle).dblclick();
    await expect(documentTitleInput).toHaveValue("");
    await documentTitleInput.fill(renamedDocumentTitle);
    await documentTitleInput.press("Enter");
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      renamedDocumentTitle,
    );
    await expect(
      window
        .getByRole("complementary", { name: "문서 레일" })
        .locator(".document-tree-document .document-tree-title"),
    ).toHaveText([renamedDocumentTitle]);
    await expect(documentRail.getByRole("button", {
      name: "회차 이름 변경",
      exact: true,
    })).toHaveCount(0);
    await expect(documentRail.getByRole("combobox", {
      name: `${renamedDocumentTitle} 폴더 위치`,
      exact: true,
    })).toHaveCount(0);
    await expect(manuscript).toHaveText(manuscriptText);

    await manuscript.press("Control+Z");
    await expect(window.getByTestId("manuscript-character-count")).toHaveText(
      "0",
    );
    await manuscript.press("Control+Y");
    await expect(manuscript).toHaveText(manuscriptText);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await continueFromMain(window);
    await expect(
      window
        .getByRole("complementary", { name: "문서 레일" })
        .getByRole("heading", { name: renamedWorkTitle, exact: true }),
    ).toBeVisible();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      renamedDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toHaveText(manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("reorders episodes without changing manuscript state", async () => {
  test.setTimeout(120_000);
  const readManuscriptText = async (manuscript: Locator) =>
    manuscript.evaluate((editor) =>
      Array.from(editor.children)
        .filter((child) => child.classList.contains("cm-line"))
        .map((line) => line.textContent ?? "")
        .join("\n"),
    );
  const dragBetween = async (
    page: Page,
    source: Locator,
    target: Locator,
    targetYRatio = 0.5,
  ): Promise<void> => {
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (sourceBox === null || targetBox === null) {
      throw new Error("Document drag target is not visible");
    }
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height * targetYRatio,
      { steps: 5 },
    );
  };
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-reorder-episodes-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const thirdDocumentTitle = randomUUID();
  const firstManuscript = `${randomUUID()} 첫 회차 끝.`;
  const secondManuscript = `${randomUUID()} 둘째 회차 원고.`;
  const thirdManuscript = `${randomUUID()} 셋째 회차 끝.`;
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
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(window, secondDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(secondManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(window, thirdDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      thirdDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(thirdManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(thirdManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    const reorderRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const thirdDocumentButton = documentTreeButton(window, thirdDocumentTitle);
    const secondDocumentButton = documentTreeButton(window, secondDocumentTitle);
    await dragBetween(window, thirdDocumentButton, secondDocumentButton, 0.2);
    await expect(reorderRail.getByRole("region", { name: "회차 폴더" }))
      .toHaveAttribute("data-document-drag-active", "true");
    await expect(secondDocumentButton.locator("xpath=.."))
      .toHaveClass(/is-document-drop-before/u);
    await window.mouse.up();
    await expect(reorderRail.locator(
      ".document-tree-document .document-tree-title",
    )).toHaveText([
      firstDocumentTitle,
      thirdDocumentTitle,
      secondDocumentTitle,
    ]);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      thirdDocumentTitle,
    );
    await secondDocumentButton.click();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    const flow = window.getByRole("region", { name: "이전 화 흐름" });
    await expect(flow.locator("strong")).toHaveText(thirdDocumentTitle);
    await expect(flow).toContainText(thirdManuscript);
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const documentButtons = documentRail.locator(
      ".document-tree-document .document-tree-title",
    );
    await expect(documentButtons).toHaveText([
      firstDocumentTitle,
      thirdDocumentTitle,
      secondDocumentTitle,
    ]);
    await documentTreeButton(window, thirdDocumentTitle).click();
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(thirdManuscript);
    await manuscript.press("Control+Z");
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await manuscript.press("Control+Y");
    await expect.poll(() => readManuscriptText(manuscript)).toBe(thirdManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await continueFromMain(window);
    const reopenedDocumentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    await expect(
      reopenedDocumentRail.locator(
        ".document-tree-document .document-tree-title",
      ),
    ).toHaveText([
      firstDocumentTitle,
      thirdDocumentTitle,
      secondDocumentTitle,
    ]);
    await documentTreeButton(window, thirdDocumentTitle).click();
    await expect
      .poll(() =>
        readManuscriptText(window.getByRole("textbox", { name: "원고" })),
      )
      .toBe(thirdManuscript);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("organizes episodes in folders without changing manuscript state", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-episode-folders-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const rootFolderTitle = randomUUID();
  const renamedRootFolderTitle = randomUUID();
  const childFolderTitle = randomUUID();
  const firstManuscript = `${randomUUID()} 첫 회차 원고.`;
  const secondManuscript = `${randomUUID()} 둘째 회차 원고.`;
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
  const readManuscriptText = async (manuscript: Locator) =>
    manuscript.evaluate((editor) =>
      Array.from(editor.querySelectorAll(".cm-line"))
        .filter((line) => line.closest(".previous-flow-context") === null)
        .map((line) => line.textContent ?? "")
        .join("\n"),
    );
  const dragEpisode = async (
    page: Page,
    source: Locator,
    target: Locator,
    targetYRatio = 0.5,
  ): Promise<void> => {
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (sourceBox === null || targetBox === null) {
      throw new Error("Episode drag target is not visible");
    }
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height * targetYRatio,
      { steps: 5 },
    );
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");
    await createNamedEpisode(window, secondDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await expect(manuscript).toBeEditable();
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(secondManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    let folderRegion = window.getByRole("region", { name: "회차 폴더" });
    await folderRegion
      .getByRole("button", { name: "폴더 추가", exact: true })
      .click();
    await expect(folderRegion.getByRole("form", {
      name: "새 폴더 만들기",
    })).toHaveCount(0);
    let rootFolderRow = folderRegion
      .locator(".document-tree-folder")
      .filter({ hasText: "제목없음" })
      .first();
    await expect(rootFolderRow).toBeVisible();
    await rootFolderRow.hover();
    await rootFolderRow.getByRole("button", {
      name: "제목없음 폴더 이름 변경",
      exact: true,
    }).click();
    let renameFolder = folderRegion.getByRole("form", {
      name: "제목없음 폴더 이름 변경",
    });
    await renameFolder.getByLabel("폴더 새 이름").fill(rootFolderTitle);
    await renameFolder.getByRole("button", { name: "저장", exact: true })
      .click();
    rootFolderRow = folderRegion
      .locator(".document-tree-folder")
      .filter({ hasText: rootFolderTitle })
      .first();
    await rootFolderRow.hover();
    await rootFolderRow
      .getByRole("button", {
        name: `${rootFolderTitle} 하위 폴더 추가`,
        exact: true,
      })
      .click();
    await expect(folderRegion.getByRole("form", {
      name: "새 폴더 만들기",
    })).toHaveCount(0);
    let rootFolderGroup = rootFolderRow.locator("xpath=..");
    let childFolderRow = rootFolderGroup
      .locator(".document-tree-folder")
      .filter({ hasText: "제목없음" })
      .last();
    await expect(childFolderRow).toBeVisible();
    await childFolderRow.hover();
    await childFolderRow.getByRole("button", {
      name: "제목없음 폴더 이름 변경",
      exact: true,
    }).click();
    renameFolder = folderRegion.getByRole("form", {
      name: "제목없음 폴더 이름 변경",
    });
    await renameFolder.getByLabel("폴더 새 이름").fill(childFolderTitle);
    await renameFolder.getByRole("button", { name: "저장", exact: true })
      .click();
    rootFolderRow = folderRegion
      .locator(".document-tree-folder")
      .filter({ hasText: rootFolderTitle })
      .first();
    rootFolderGroup = rootFolderRow.locator("xpath=..");
    childFolderRow = rootFolderGroup
      .locator(".document-tree-folder")
      .filter({ hasText: childFolderTitle })
      .last();

    const firstDocumentButton = documentTreeButton(window, firstDocumentTitle);
    await dragEpisode(window, firstDocumentButton, childFolderRow);
    await expect(childFolderRow).toHaveClass(/is-document-folder-drop-target/u);
    await window.mouse.up();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    await dragEpisode(
      window,
      documentTreeButton(window, secondDocumentTitle),
      childFolderRow,
    );
    await window.mouse.up();
    let childFolderGroup = childFolderRow.locator("xpath=..");
    let childDocumentButtons = childFolderGroup.locator(
      ":scope > .document-tree-children > .document-tree-document .document-tree-open",
    );
    await expect(childDocumentButtons.locator(".document-tree-title")).toHaveText([
      firstDocumentTitle,
      secondDocumentTitle,
    ]);
    await dragEpisode(
      window,
      childDocumentButtons.nth(1),
      childDocumentButtons.nth(0),
      0.2,
    );
    await expect(childDocumentButtons.nth(0).locator("xpath=.."))
      .toHaveClass(/is-document-drop-before/u);
    await window.mouse.up();
    childDocumentButtons = childFolderGroup.locator(
      ":scope > .document-tree-children > .document-tree-document .document-tree-open",
    );
    await expect(childDocumentButtons.locator(".document-tree-title")).toHaveText([
      secondDocumentTitle,
      firstDocumentTitle,
    ]);
    await expect(folderRegion.getByRole("combobox")).toHaveCount(0);
    await expect(folderRegion.getByRole("button", {
      name: "회차 이름 변경",
      exact: true,
    })).toHaveCount(0);

    await rootFolderRow.hover();
    await rootFolderRow
      .getByRole("button", {
        name: `${rootFolderTitle} 폴더 이름 변경`,
        exact: true,
      })
      .click();
    renameFolder = folderRegion.getByRole("form", {
      name: `${rootFolderTitle} 폴더 이름 변경`,
    });
    await renameFolder.getByLabel("폴더 새 이름").fill(renamedRootFolderTitle);
    await renameFolder
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(folderRegion).toContainText(renamedRootFolderTitle);
    rootFolderRow = folderRegion
      .locator(".document-tree-folder")
      .filter({ hasText: renamedRootFolderTitle })
      .first();

    await documentTreeButton(window, firstDocumentTitle).click();
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await manuscript.press("Control+Z");
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await manuscript.press("Control+Y");
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    window.once("dialog", (dialog) => dialog.accept());
    await rootFolderRow.hover();
    await rootFolderRow
      .getByRole("button", {
        name: `${renamedRootFolderTitle} 폴더 삭제`,
        exact: true,
      })
      .click();
    await expect(folderRegion).not.toContainText(renamedRootFolderTitle);
    childFolderRow = folderRegion
      .locator(".document-tree-folder")
      .filter({ hasText: childFolderTitle })
      .first();
    childFolderGroup = childFolderRow.locator("xpath=..");
    await expect(childFolderGroup.locator(
      ":scope > .document-tree-children > .document-tree-document .document-tree-title",
    )).toHaveText([secondDocumentTitle, firstDocumentTitle]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await continueFromMain(window);
    folderRegion = window.getByRole("region", { name: "회차 폴더" });
    await expect(folderRegion).toContainText(childFolderTitle);
    await expect(folderRegion).not.toContainText(renamedRootFolderTitle);
    await activateDocumentFromTree(window, secondDocumentTitle);
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(secondManuscript);
    childFolderRow = folderRegion
      .locator(".document-tree-folder")
      .filter({ hasText: childFolderTitle })
      .first();
    await expect(childFolderRow.locator("xpath=..").locator(
      ":scope > .document-tree-children > .document-tree-document .document-tree-title",
    )).toHaveText([secondDocumentTitle, firstDocumentTitle]);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("switches among episodes from the document tree and restores the active episode", async () => {
  test.setTimeout(70_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-episode-tabs-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const thirdDocumentTitle = randomUUID();
  const firstManuscript = `${randomUUID()} 첫 회차 원고.`;
  const secondManuscript = `${randomUUID()} 둘째 회차 원고.`;
  const thirdManuscript = `${randomUUID()} 셋째 회차 원고.`;
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
  const readManuscriptText = async (manuscript: Locator) =>
    manuscript.evaluate((editor) =>
      Array.from(editor.querySelectorAll(".cm-line"))
        .filter((line) => line.closest(".previous-flow-context") === null)
        .map((line) => line.textContent ?? "")
        .join("\n"),
    );
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await expect(
      window
        .getByRole("region", { name: "회차 폴더" })
        .locator(".document-tree-open")
        .filter({ hasText: firstDocumentTitle }),
    ).toHaveAttribute("aria-current", "page");
    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(window, secondDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(secondManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(window, thirdDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      thirdDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await manuscript.click();
    await manuscript.pressSequentially(thirdManuscript);
    await expect.poll(() => readManuscriptText(manuscript)).toBe(thirdManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await expect(
      window
        .getByRole("region", { name: "회차 폴더" })
        .locator(".document-tree-open")
        .filter({ hasText: thirdDocumentTitle }),
    ).toHaveAttribute("aria-current", "page");

    await activateDocumentFromTree(window, firstDocumentTitle);
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await manuscript.press("Control+Z");
    await expect.poll(() => readManuscriptText(manuscript)).toBe("");
    await manuscript.press("Control+Y");
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);

    await activateDocumentFromTree(window, secondDocumentTitle);
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(secondManuscript);

    await activateDocumentFromTree(window, thirdDocumentTitle);
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(thirdManuscript);

    await activateDocumentFromTree(window, firstDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await continueFromMain(window);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readManuscriptText(manuscript)).toBe(firstManuscript);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps repeated episode switching bounded and the editor writable", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-episode-switch-stability-"),
  );
  const workTitle = randomUUID();
  const documentTitles = Array.from({ length: 4 }, () => randomUUID());
  const databasePath = path.join(directory, "workspace.sqlite3");
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
  const readCheckpointCount = (): number => {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = database.prepare(`
        SELECT COUNT(*) AS count
        FROM resume_checkpoints
      `).get() as { readonly count: number };
      return row.count;
    } finally {
      database.close();
    }
  };
  const waitForCheckpointQuiescence = async (): Promise<number> => {
    let previous = -1;
    let stableReads = 0;
    let latest = -1;
    await expect.poll(() => {
      latest = readCheckpointCount();
      if (latest === previous) {
        stableReads += 1;
      } else {
        previous = latest;
        stableReads = 0;
      }
      return stableReads;
    }, {
      intervals: [50, 100, 150, 200],
      timeout: 5_000,
    }).toBeGreaterThanOrEqual(2);
    return latest;
  };
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(documentTitles[0]!);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    for (const title of documentTitles.slice(1)) {
      await createNamedEpisode(window, title);
    }
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      documentTitles[3]!,
    );
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");
    const checkpointsBeforeSwitches = await waitForCheckpointQuiescence();
    const switchTargets = Array.from(
      { length: 48 },
      (_, index) => documentTitles[index % 3]!,
    );
    for (const title of switchTargets) {
      await activateDocumentFromTree(window, title);
    }

    await expect(window.getByTestId("manuscript-title")).toHaveText(
      documentTitles[2]!,
    );
    await expect(documentTreeButton(window, documentTitles[3]!)).toBeEnabled();
    const checkpointsAfterSwitches = await waitForCheckpointQuiescence();
    expect(
      checkpointsAfterSwitches - checkpointsBeforeSwitches,
    ).toBeGreaterThanOrEqual(1);
    expect(
      checkpointsAfterSwitches - checkpointsBeforeSwitches,
    ).toBeLessThanOrEqual(switchTargets.length);

    const thirdText = `${randomUUID()} 세 번째 회차 입력`;
    const fourthText = `${randomUUID()} 네 번째 회차 입력`;
    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(thirdText);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await activateDocumentFromTree(window, documentTitles[3]!);
    manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(fourthText);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await activateDocumentFromTree(window, documentTitles[2]!);
    await expectEditorText(
      window.getByRole("textbox", { name: "원고" }),
      thirdText,
    );
    await activateDocumentFromTree(window, documentTitles[3]!);
    await expectEditorText(
      window.getByRole("textbox", { name: "원고" }),
      fourthText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("retires a work without deleting its manuscript data", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-retire-work-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const firstManuscript = `첫 작품 원고 ${randomUUID()}`;
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const secondManuscript = `보존할 원고 ${randomUUID()}`;
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
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(window);
    await window
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = window.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(secondManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");
    await openStudioHome(window);

    window.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain(secondWorkTitle);
      expect(dialog.message()).toContain("원고와 기록은 복구를 위해 보존됩니다.");
      await dialog.accept();
    });
    await window
      .getByRole("button", {
        name: `${secondWorkTitle} 작품 삭제`,
        exact: true,
      })
      .click();
    await expect(
      window.getByRole("button", {
        name: `${secondWorkTitle} 작품 삭제`,
        exact: true,
      }),
    ).toHaveCount(0);
    const firstWorkCard = window.locator(".library-work-card").filter({
      hasText: firstWorkTitle,
    });
    await expect(firstWorkCard).toBeVisible();
    await firstWorkCard
      .getByRole("button", { name: `${firstWorkTitle} 작품 열기`, exact: true })
      .click();
    await expect(window.getByRole("textbox", { name: "원고" })).toHaveText(
      firstManuscript,
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    await expect(
      window.getByRole("button", {
        name: `${secondWorkTitle} 작품 삭제`,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      window.getByRole("button", {
        name: `${firstWorkTitle} 작품 삭제`,
        exact: true,
      }),
    ).toBeVisible();

    window.once("dialog", (dialog) => dialog.accept());
    await window
      .getByRole("button", {
        name: `${firstWorkTitle} 작품 삭제`,
        exact: true,
      })
      .click();
    await expect(window.getByRole("button", { name: "전체 0", exact: true }))
      .toBeVisible();
    await expect(
      window.getByRole("button", {
        name: "새 작품 작품과 첫 회차 만들기",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      window.getByRole("button", { name: "작품 만들기", exact: true }),
    ).toBeVisible();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await expect(window.getByRole("button", { name: "전체 0", exact: true }))
      .toBeVisible();
    await expect(
      window.getByRole("button", {
        name: "새 작품 작품과 첫 회차 만들기",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("retires an episode while preserving its manuscript data", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-retire-episode-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const firstManuscript = `첫 회차 원고 ${randomUUID()}`;
  const secondManuscript = `보존할 회차 원고 ${randomUUID()}`;
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

  const retireDocumentByTitle = async (page: Page, title: string) =>
    page.evaluate(async (documentTitle) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      const work = catalog.works.find((candidate) =>
        candidate.documents.some((document) => document.title === documentTitle)
      );
      const document = work?.documents.find(
        (candidate) => candidate.title === documentTitle,
      );
      if (work === undefined || document === undefined) {
        throw new Error(`Missing document to retire: ${documentTitle}`);
      }
      return window.eumStudio.workspace.retireDocument({
        schemaVersion: 1,
        workId: work.workId,
        documentId: document.documentId,
      });
    }, title);

  const exitWithoutWorkspaceLifecycle = async () => {
    const closed = electronApp.waitForEvent("close");
    await electronApp.evaluate(({ app }) => {
      app.exit();
    });
    await closed;
  };

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
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(page, secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await retireDocumentByTitle(page, secondDocumentTitle);
    await exitWithoutWorkspaceLifecycle();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    let workCard = page.locator(".library-work-card").filter({ hasText: workTitle });
    await expect(workCard.getByRole("combobox").locator("option")).toHaveText([
      "1개 회차",
      firstDocumentTitle,
    ]);
    await workCard
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    await expectEditorText(
      page.getByRole("textbox", { name: "원고" }),
      firstManuscript,
    );

    await openStudioHome(page);
    await retireDocumentByTitle(page, firstDocumentTitle);
    await exitWithoutWorkspaceLifecycle();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    workCard = page.locator(".library-work-card").filter({ hasText: workTitle });
    const emptyDocumentSelect = workCard.getByRole("combobox", {
      name: `${workTitle} 회차 선택`,
      exact: true,
    });
    await expect(emptyDocumentSelect).toBeDisabled();
    await expect(emptyDocumentSelect.locator("option")).toHaveText(["회차 없음"]);

    await workCard
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    await expect(
      page.getByText("이 작품에는 회차가 없습니다.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "새 회차", exact: true })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText("제목없음");
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the active episode unchanged until Hangul composition commits", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-composition-switch-"),
  );
  const compositionText = readHangulCompositionText();
  const documentProfile = createDocumentSwitchProfile("");
  const [firstDocument, secondDocument] = documentProfile.documents;
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const session = await window.context().newCDPSession(window);

    await manuscript.focus();
    await session.send("Input.imeSetComposition", {
      text: compositionText,
      selectionStart: compositionText.length,
      selectionEnd: compositionText.length,
      replacementStart: 0,
      replacementEnd: 0,
    });
    await expect(manuscript).toHaveText(compositionText);

    await window
      .getByRole("region", { name: "회차 폴더" })
      .locator(".document-tree-open")
      .filter({ hasText: secondDocument.label })
      .evaluate((button: HTMLElement) => button.click());
    await expect.poll(() => readActiveDocumentId(window)).toBe(
      firstDocument.documentId,
    );
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      firstDocument.label,
    );
    await expect(manuscript).toHaveText(compositionText);

    await session.send("Input.insertText", { text: compositionText });
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocument.label,
    );
    expect(await readActiveDocumentId(window)).toBe(secondDocument.documentId);
    await expectEditorText(manuscript, secondDocument.initialText);

    await activateDocumentFromTree(window, firstDocument.label);
    await expectEditorText(manuscript, compositionText);
    await manuscript.press("Control+Z");
    await expect(manuscript).toHaveText("");
    await session.detach();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("cancels a queued switch when composition returns to its document", async () => {
  const compositionText = readHangulCompositionText();
  const documentProfile = createDocumentSwitchProfile("");
  const [firstDocument, secondDocument] = documentProfile.documents;
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const session = await window.context().newCDPSession(window);
    const cursorProbe = randomUUID();

    await manuscript.focus();
    await session.send("Input.imeSetComposition", {
      text: compositionText,
      selectionStart: compositionText.length,
      selectionEnd: compositionText.length,
      replacementStart: 0,
      replacementEnd: 0,
    });
    const documentTree = window.getByRole("region", { name: "회차 폴더" });
    await documentTree
      .locator(".document-tree-open")
      .filter({ hasText: secondDocument.label })
      .evaluate((button: HTMLElement) => button.click());
    await documentTree
      .locator(".document-tree-open")
      .filter({ hasText: firstDocument.label })
      .evaluate((button: HTMLElement) => button.click());

    await session.send("Input.insertText", { text: compositionText });
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(cursorProbe);
    await expectEditorText(manuscript, `${compositionText}${cursorProbe}`);

    await activateDocumentFromTree(window, secondDocument.label);
    await expectEditorText(manuscript, secondDocument.initialText);
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
    const window = await openStudioWorkspace(electronApp);
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
    await expect(
      window.getByTestId("manuscript-selection-active"),
    ).toBeVisible();

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
    await expect(
      window.getByTestId("manuscript-selection-active"),
    ).toBeVisible();
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
    const window = await openStudioWorkspace(electronApp);
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

test("keeps the document sidebar and review overlay independent without hiding writing status", async () => {
  const documentProfile = createDocumentSwitchProfile();
  const [firstDocument, secondDocument] = documentProfile.documents;
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const reviewRail = window.getByRole("complementary", {
      name: "검토 레일",
    });
    const readCurrentManuscriptText = () =>
      manuscript.evaluate((editor) =>
        Array.from(editor.querySelectorAll(":scope > .cm-line"))
          .map((line) => line.textContent ?? "")
          .join("\n"),
      );

    await expect(documentRail).toBeVisible();
    await expect(reviewRail).toBeHidden();
    await expect(manuscript).toBeVisible();
    await expect(window.getByTestId("current-work")).toHaveAttribute(
      "title",
      firstDocument.workId,
    );
    await expect(window.getByTestId("current-document")).toHaveText(
      firstDocument.label,
    );
    await expect(window.getByTestId("save-state")).toBeVisible();
    await expect(
      window.getByRole("button", { name: "기록 시작", exact: true }),
    ).toBeVisible();
    await expect(
      window.getByRole("button", { name: "집중 시작", exact: true }),
    ).toBeVisible();

    const centerWidthBeforeReview = await window
      .locator(".workspace-center")
      .evaluate((element) => element.getBoundingClientRect().width);
    await window.getByRole("button", { name: "검토 레일 열기" }).click();
    await expect(reviewRail).toBeVisible();
    await expect(documentRail).toBeVisible();
    const inspectorTabs = reviewRail.getByRole("tablist", {
      name: "검토 범위",
    });
    await expect(inspectorTabs).toBeVisible();
    await expect(
      inspectorTabs.getByRole("tab", { name: "현재", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      reviewRail.getByRole("tabpanel", { name: "현재" }),
    ).toBeVisible();
    await expect(inspectorTabs.getByRole("tab")).toHaveCount(2);
    await inspectorTabs.getByRole("tab", { name: "조수", exact: true }).click();
    await expect(reviewRail.getByRole("tabpanel", { name: "조수" }))
      .toBeVisible();
    await inspectorTabs
      .getByRole("tab", { name: "현재", exact: true })
      .click();
    const reviewRailLayout = await window.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>(".workspace-body");
      const center = document.querySelector<HTMLElement>(".workspace-center");
      const rail = document.querySelector<HTMLElement>(".workspace-rail-right");
      const panel = document.querySelector<HTMLElement>(
        ".review-inspector-panel",
      );
      if (
        workspace === null ||
        center === null ||
        rail === null ||
        panel === null
      ) {
        throw new Error("Expected the open review rail layout");
      }
      const action = rail.querySelector<HTMLElement>(
        ".review-inspector-section-stack:not([hidden]) .create-event-button",
      );
      if (action === null) {
        throw new Error("Expected a review rail action");
      }
      const actionStyle = getComputedStyle(action);
      return {
        actionBorderRadius: Number.parseFloat(actionStyle.borderTopLeftRadius),
        actionWidth: action.getBoundingClientRect().width,
        centerWidth: center.getBoundingClientRect().width,
        railClientWidth: panel.clientWidth,
        railOverflowY: getComputedStyle(panel).overflowY,
        railPosition: getComputedStyle(rail).position,
        railScrollWidth: panel.scrollWidth,
        railWidth: rail.getBoundingClientRect().width,
        workspaceWidth: workspace.getBoundingClientRect().width,
      };
    });
    expect(reviewRailLayout.centerWidth).toBeCloseTo(
      centerWidthBeforeReview,
      0,
    );
    expect(reviewRailLayout.railPosition).toBe("absolute");
    expect(reviewRailLayout.centerWidth).toBeGreaterThan(
      reviewRailLayout.railWidth * 2,
    );
    expect(reviewRailLayout.railWidth).toBeLessThan(
      reviewRailLayout.workspaceWidth / 3,
    );
    expect(reviewRailLayout.railScrollWidth).toBeLessThanOrEqual(
      reviewRailLayout.railClientWidth,
    );
    expect(reviewRailLayout.railOverflowY).toBe("auto");
    expect(reviewRailLayout.actionBorderRadius).toBeGreaterThan(0);
    expect(reviewRailLayout.actionWidth).toBeGreaterThan(0);
    expect(reviewRailLayout.actionWidth).toBeLessThanOrEqual(
      reviewRailLayout.railClientWidth,
    );
    await manuscript.click();
    await expect(manuscript).toBeFocused();
    await window.getByRole("button", { name: "검토 레일 닫기" }).focus();
    await window.keyboard.press("Enter");
    await expect(reviewRail).toBeHidden();
    await expect(manuscript).toBeVisible();

    await documentTreeButton(window, secondDocument.label).click();
    await expect(window.getByTestId("current-document")).toHaveText(
      secondDocument.label,
    );
    await expect.poll(readCurrentManuscriptText).toBe(secondDocument.initialText);

    await window
      .getByRole("button", { name: "검토 레일 열기" })
      .click();
    await expect(reviewRail).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

