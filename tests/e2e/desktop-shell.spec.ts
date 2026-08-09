import {
  createHash,
  randomInt,
  randomUUID,
} from "node:crypto";
import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  expect,
  test,
  type Locator,
} from "@playwright/test";
import { _electron as electron } from "playwright";

import { parseManuscriptInputProfile } from "../../src/application/editor/manuscript-input-profile";
import {
  CreateAnchor,
} from "../../src/application/anchors/create-anchor";
import {
  CaptureResumeCheckpoint,
} from "../../src/application/checkpoints/capture-resume-checkpoint";
import { applyChangeBatch } from "../../src/application/persistence/apply-change-batch";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  encodeDurableText,
  parseCanonicalChangeBatch,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "../../src/application/persistence/change-batch";
import { appendJournalPayloadDurably } from "../../src/platform/journal/append-only-journal";
import { scanJournalFrames } from "../../src/platform/journal/journal-frame";
import { createNodeCryptoJournalChecksumAdapter } from "../../src/platform/journal/node-crypto-journal-checksum";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../../src/platform/anchors/node-crypto-anchor-evidence";
import {
  createPocResumeCheckpointCaptureTransaction,
} from "../../src/platform/checkpoints/poc-resume-checkpoint-publication";
import {
  createJsonPocResumeCheckpointPublicationCodec,
} from "../../src/platform/checkpoints/poc-resume-checkpoint-json-codec";
import {
  InMemoryRevisionStore,
} from "../../src/platform/revisions/in-memory-revision-store";
import {
  createWritingCatalog,
  entityId,
  type DocumentRevision,
  type ResumeCheckpoint,
  type Work,
} from "../../src/domain/writing";
import { parseLongformFixtureManifest } from "../fixtures/longform/longform-fixture";

process.env.EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE = "1";

function readJsonFixture(...segments: string[]): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), ...segments), "utf8"),
  );
}

function readHangulCompositionText(): string {
  const manifest = parseLongformFixtureManifest(
    readJsonFixture(
      "tests",
      "fixtures",
      "longform",
      "poc-1-longform.manifest.json",
    ),
  );
  const match = manifest.content.units.join(" ").match(/\p{Script=Hangul}+/u);
  if (match === null) {
    throw new Error("Longform fixture must provide Hangul composition text");
  }
  return match[0];
}

type RunningElectronApp = Awaited<
  ReturnType<typeof electron.launch>
>;

async function openStudioWorkspace(
  electronApp: RunningElectronApp,
) {
  const page = await electronApp.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", {
    name: "이어쓰기",
    exact: true,
  }).click();
  await expect(
    page.getByRole("textbox", { name: "원고" }),
  ).toBeVisible();
  return page;
}

async function selectElectronRuntimeHashAlgorithm(): Promise<string> {
  const discoveryApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });
  try {
    const electronAlgorithms = await discoveryApp.evaluate(() => {
      const crypto = process.getBuiltinModule("node:crypto");
      return crypto.getHashes().filter((algorithm) => {
        try {
          crypto.createHash(algorithm).digest();
          return true;
        } catch {
          return false;
        }
      });
    });
    const compatibleAlgorithms = electronAlgorithms.filter(
      (algorithm) => {
        try {
          createHash(algorithm).digest();
          return true;
        } catch {
          return false;
        }
      },
    );
    if (compatibleAlgorithms.length === 0) {
      throw new Error(
        "Electron and test Node.js runtimes expose no common hash algorithm",
      );
    }
    return compatibleAlgorithms[
      randomInt(0, compatibleAlgorithms.length)
    ] as string;
  } finally {
    await discoveryApp.close();
  }
}

async function removeVerifiedTemporaryDirectory(
  directory: string,
): Promise<void> {
  const temporaryRoot = path.resolve(tmpdir());
  const resolvedDirectory = path.resolve(directory);
  if (
    resolvedDirectory === temporaryRoot ||
    !resolvedDirectory.startsWith(temporaryRoot)
  ) {
    throw new Error(
      "Refusing to remove a directory outside the OS temporary root",
    );
  }
  await rm(resolvedDirectory, { recursive: true, force: true });
}

function createDocumentSwitchProfile(
  firstInitialText = Array.from(
    { length: randomInt(96, 128) },
    () => randomUUID(),
  ).join("\n"),
) {
  const workId = randomUUID();
  const firstDocument = {
    workId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: firstInitialText,
  };
  const secondDocument = {
    workId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  return {
    schemaVersion: 1,
    initialDocumentId: firstDocument.documentId,
    documents: [firstDocument, secondDocument],
  } as const;
}

async function createStartupRecoveryFixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), randomUUID()),
  );
  const journalPath = path.join(
    directory,
    randomUUID(),
  );
  const checksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const workId = randomUUID();
  const documentId = randomUUID();
  const baseRevisionId = randomUUID();
  const initialText = randomUUID();
  const insertedText = randomUUID();
  const nextSequence = randomInt(0, 10_000);
  const document = {
    workId,
    documentId,
    documentRevisionId: baseRevisionId,
    label: randomUUID(),
    initialText,
  };
  const batch = parseChangeBatch({
    schemaVersion: 1,
    textRepresentation:
      DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId,
    documentId,
    baseRevisionId,
    sequence: nextSequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: initialText.length,
    afterTextLengthUtf16:
      initialText.length + insertedText.length,
    changes: [
      {
        fromUtf16: initialText.length,
        toUtf16: initialText.length,
        insertedText,
      },
    ],
  });
  const appendReceipt =
    await appendJournalPayloadDurably({
      journalPath,
      payload:
        serializeCanonicalChangeBatch(batch),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          checksumAlgorithm,
        ),
    });
  const timestamp = new Date().toISOString();
  const contentPath = path.join(
    directory,
    randomUUID(),
  );
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: documentId,
    documents: [document],
  } as const;
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm,
    documentSequences: [
      {
        documentId,
        nextSequence,
      },
    ],
  } as const;
  const batchingProfile = {
    schemaVersion: 1,
    maxTransactionsPerBatch: randomInt(1, 32),
    maxDelayMs: randomInt(0, 60_000),
  } as const;
  const applyProfile = {
    schemaVersion: 1,
    compactionId: randomUUID(),
    expectedSourceJournalEndByteOffset:
      appendReceipt.frameEndByteOffset,
    expectedSafeReplayThroughByteOffset:
      appendReceipt.frameEndByteOffset,
    contentChecksumAlgorithm:
      checksumAlgorithm,
    sourceJournalPath: journalPath,
    nextJournalPath: path.join(
      directory,
      randomUUID(),
    ),
    publicationTemporaryPath: path.join(
      directory,
      randomUUID(),
    ),
    publicationPath: path.join(
      directory,
      randomUUID(),
    ),
    revisions: [
      {
        workId,
        documentId,
        expectedBaseRevisionId:
          baseRevisionId,
        revisionId: randomUUID(),
        cause: randomUUID(),
        createdAt: timestamp,
        durableAt: timestamp,
        contentPath,
      },
    ],
  } as const;
  return {
    directory,
    document,
    documentProfile,
    journalProfile,
    batchingProfile,
    applyProfile,
    contentPath,
    recoveredText: initialText + insertedText,
  };
}

async function createResumeRecoveryFixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), randomUUID()),
  );
  const recordedAt =
    new Date().toISOString();
  const work: Work = {
    meta: {
      id:
        entityId<"Work">(
          randomUUID(),
        ),
      schemaVersion: randomInt(1, 32),
      revision: randomInt(0, 32),
      createdAt: recordedAt,
      updatedAt: recordedAt,
    },
    studioId:
      entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId:
      entityId<"WorkSettings">(
        randomUUID(),
      ),
  };
  const document = {
    meta: {
      id:
        entityId<"Document">(
          randomUUID(),
        ),
      schemaVersion: randomInt(1, 32),
      revision: randomInt(0, 32),
      createdAt: recordedAt,
      updatedAt: recordedAt,
    },
    workId: work.meta.id,
    title: randomUUID(),
    orderKey: randomUUID(),
    manuscriptId:
      entityId<"Manuscript">(
        randomUUID(),
      ),
  };
  const catalog = createWritingCatalog({
    works: [work],
    documents: [document],
  });
  const contentChecksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const publicationChecksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const anchorEvidenceChecksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const revisionStore =
    new InMemoryRevisionStore({
      catalog,
      describeContent: (content) => ({
        contentRef: randomUUID(),
        contentHash:
          createHash(
            contentChecksumAlgorithm,
          )
            .update(
              encodeDurableText(content),
            )
            .digest("hex"),
        length: content.length,
      }),
    });
  const prefix = randomUUID();
  const selectedText =
    randomUUID().slice(
      0,
      randomInt(4, 12),
    );
  const suffix = randomUUID();
  const originContent =
    `${prefix}${selectedText}${suffix}`;
  const selectionStart = prefix.length;
  const selectionEnd =
    selectionStart + selectedText.length;
  const originRevision =
    await revisionStore.append({
      revisionId:
        entityId<"DocumentRevision">(
          randomUUID(),
        ),
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content: originContent,
      cause: randomUUID(),
      createdAt: recordedAt,
      durableAt: recordedAt,
    });
  const createAnchor = new CreateAnchor({
    catalog,
    revisionStore,
    describeEvidence:
      createNodeCryptoAnchorEvidenceDescriptor(
        anchorEvidenceChecksumAlgorithm,
      ),
  });
  const policy = {
    schemaVersion: 1 as const,
    version: randomUUID(),
    contextOffsetLength:
      Math.max(prefix.length, suffix.length),
  };
  const cursorAnchor =
    await createAnchor.execute({
      meta: {
        id:
          entityId<"Anchor">(
            randomUUID(),
          ),
        schemaVersion: randomInt(1, 32),
        revision: randomInt(0, 32),
        createdAt: recordedAt,
        updatedAt: recordedAt,
      },
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId:
        originRevision.id,
      startOffset: selectionStart,
      endOffset: selectionStart,
      policy,
      commandRef: randomUUID(),
      actorRef: randomUUID(),
    });
  const selectionAnchor =
    await createAnchor.execute({
      meta: {
        id:
          entityId<"Anchor">(
            randomUUID(),
          ),
        schemaVersion: randomInt(1, 32),
        revision: randomInt(0, 32),
        createdAt: recordedAt,
        updatedAt: recordedAt,
      },
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId:
        originRevision.id,
      startOffset: selectionStart,
      endOffset: selectionEnd,
      policy,
      commandRef: randomUUID(),
      actorRef: randomUUID(),
    });
  const checkpoint: ResumeCheckpoint = {
    meta: {
      id:
        entityId<"ResumeCheckpoint">(
          randomUUID(),
        ),
      schemaVersion: randomInt(1, 32),
      revision: randomInt(0, 32),
      createdAt: recordedAt,
      updatedAt: recordedAt,
    },
    workId: work.meta.id,
    documentId: document.meta.id,
    documentRevisionId:
      originRevision.id,
    cursorAnchorId:
      cursorAnchor.meta.id,
    selectionAnchorId:
      selectionAnchor.meta.id,
    workspaceMode: randomUUID(),
    capturedAt: recordedAt,
  };
  const codecId = randomUUID();
  const checkpointStoragePlan = {
    publicationId:
      entityId<"ResumeCheckpointPublication">(
        randomUUID(),
      ),
    publicationTemporaryPath:
      path.join(
        directory,
        randomUUID(),
      ),
    publicationPath: path.join(
      directory,
      randomUUID(),
    ),
  };
  const checkpointTransaction =
    createPocResumeCheckpointCaptureTransaction({
      works: [work],
      checkpoints: [],
      anchors: [
        cursorAnchor,
        selectionAnchor,
      ],
      revisionStore,
      storagePlan:
        checkpointStoragePlan,
      codec:
        createJsonPocResumeCheckpointPublicationCodec(
          codecId,
        ),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          publicationChecksumAlgorithm,
        ),
    });
  await new CaptureResumeCheckpoint({
    catalog,
    revisionStore,
    transaction:
      checkpointTransaction,
  }).execute({
    checkpoint,
    expectedWorkRevision:
      work.meta.revision,
    expectedResumeCheckpointId: null,
    expectedCurrentDocumentRevisionId:
      originRevision.id,
  });

  const leading = randomUUID();
  const recoveredText =
    `${leading}${originContent}`;
  const journalPath = path.join(
    directory,
    randomUUID(),
  );
  const journalChecksumAlgorithm =
    await selectElectronRuntimeHashAlgorithm();
  const nextSequence = randomInt(
    0,
    10_000,
  );
  const batch = parseChangeBatch({
    schemaVersion: 1,
    textRepresentation:
      DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: work.meta.id,
    documentId: document.meta.id,
    baseRevisionId:
      originRevision.id,
    sequence: nextSequence,
    createdAt: recordedAt,
    beforeTextLengthUtf16:
      originContent.length,
    afterTextLengthUtf16:
      recoveredText.length,
    changes: [
      {
        fromUtf16: 0,
        toUtf16: 0,
        insertedText: leading,
      },
    ],
  });
  const appendReceipt =
    await appendJournalPayloadDurably({
      journalPath,
      payload:
        serializeCanonicalChangeBatch(batch),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          journalChecksumAlgorithm,
        ),
    });
  const targetRevisionId =
    entityId<"DocumentRevision">(
      randomUUID(),
    );
  const targetContentPath =
    path.join(
      directory,
      randomUUID(),
    );
  const targetRevisionCause =
    randomUUID();
  const targetRevision:
    DocumentRevision = {
    id: targetRevisionId,
    documentId: document.meta.id,
    parentRevisionId:
      originRevision.id,
    contentRef: targetContentPath,
    contentHash:
      createHash(
        contentChecksumAlgorithm,
      )
        .update(
          encodeDurableText(
            recoveredText,
          ),
        )
        .digest("hex"),
    length: recoveredText.length,
    cause: targetRevisionCause,
    createdAt: recordedAt,
    durableAt: recordedAt,
  };
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId:
      document.meta.id,
    documents: [
      {
        workId: work.meta.id,
        documentId:
          document.meta.id,
        documentRevisionId:
          originRevision.id,
        label: document.title,
        initialText: originContent,
      },
    ],
  } as const;
  const journalProfile = {
    schemaVersion: 1,
    journalPath,
    checksumAlgorithm:
      journalChecksumAlgorithm,
    documentSequences: [
      {
        documentId:
          document.meta.id,
        nextSequence,
      },
    ],
  } as const;
  const batchingProfile = {
    schemaVersion: 1,
    maxTransactionsPerBatch:
      randomInt(1, 32),
    maxDelayMs:
      randomInt(0, 60_000),
  } as const;
  const applyProfile = {
    schemaVersion: 1,
    compactionId: randomUUID(),
    expectedSourceJournalEndByteOffset:
      appendReceipt.frameEndByteOffset,
    expectedSafeReplayThroughByteOffset:
      appendReceipt.frameEndByteOffset,
    contentChecksumAlgorithm,
    sourceJournalPath: journalPath,
    nextJournalPath: path.join(
      directory,
      randomUUID(),
    ),
    publicationTemporaryPath:
      path.join(
        directory,
        randomUUID(),
      ),
    publicationPath: path.join(
      directory,
      randomUUID(),
    ),
    revisions: [
      {
        workId: work.meta.id,
        documentId:
          document.meta.id,
        expectedBaseRevisionId:
          originRevision.id,
        revisionId:
          targetRevisionId,
        cause: targetRevisionCause,
        createdAt: recordedAt,
        durableAt: recordedAt,
        contentPath:
          targetContentPath,
      },
    ],
  } as const;
  const resumeCheckpointProfile = {
    schemaVersion: 1,
    codecId,
    publicationChecksumAlgorithm,
    anchorEvidenceChecksumAlgorithm,
    storagePlan:
      checkpointStoragePlan,
    works: [work],
    documents: [document],
    revisions: [
      {
        revision: originRevision,
        content: originContent,
      },
      {
        revision: targetRevision,
        content: recoveredText,
      },
    ],
    publicationRevisionHeads: [
      {
        documentId:
          document.meta.id,
        revisionId:
          originRevision.id,
      },
    ],
    baselineCheckpoints: [],
    anchors: [
      cursorAnchor,
      selectionAnchor,
    ],
  } as const;
  return {
    directory,
    documentProfile,
    journalProfile,
    batchingProfile,
    applyProfile,
    resumeCheckpointProfile,
    originContent,
    recoveredText,
    selectedText,
    originSelection: {
      anchor: selectionEnd,
      head: selectionStart,
    },
    recoveredSelection: {
      anchor:
        leading.length +
        selectionEnd,
      head:
        leading.length +
        selectionStart,
    },
  };
}

test("uses one collapsible left sidebar without stretching main controls", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-sidebar-layout-"),
  );
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    const mainLayout = await page.locator(".library-section").evaluate(
      (element) => {
        const heading = element.querySelector<HTMLElement>(
          ".library-heading-row h2",
        );
        const actions = element.querySelector<HTMLElement>(".library-actions");
        const buttons = Array.from(
          element.querySelectorAll<HTMLElement>(".library-actions button"),
        );
        if (heading === null || actions === null) {
          throw new Error("Main library layout is missing");
        }
        const headingRect = heading.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        return {
          headingHeight: headingRect.height,
          headingWidth: headingRect.width,
          actionButtonWidths: buttons.map(
            (button) => button.getBoundingClientRect().width,
          ),
          actionsWidth: actionsRect.width,
          bodyClientHeight: element.parentElement?.clientHeight ?? 0,
          bodyScrollHeight: element.parentElement?.scrollHeight ?? 0,
        };
      },
    );
    expect(mainLayout.headingWidth).toBeGreaterThan(mainLayout.headingHeight);
    expect(
      mainLayout.actionButtonWidths.every(
        (width) => width < mainLayout.actionsWidth,
      ),
    ).toBe(true);
    expect(mainLayout.bodyScrollHeight).toBeLessThanOrEqual(
      mainLayout.bodyClientHeight,
    );

    await page.setViewportSize({ width: 1344, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(randomUUID());
    await createWorkDialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await expect(page.locator(".sidebar .workspace-rail-left")).toHaveCount(1);
    await expect(
      page.locator(".workspace-body > .workspace-rail-left"),
    ).toHaveCount(0);

    const expandedSidebarWidth = await page.locator(".sidebar").evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    await page
      .getByRole("button", { name: "사이드바 접기", exact: true })
      .click();
    const expandButton = page.getByRole("button", {
      name: "사이드바 펼치기",
      exact: true,
    });
    await expect(expandButton).toBeVisible();
    const collapsedSidebarWidth = await page.locator(".sidebar").evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(collapsedSidebarWidth).toBeLessThan(expandedSidebarWidth);
    await expandButton.click();
    await expect(page.locator(".sidebar .workspace-rail-left")).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates the first local Work and reopens its saved manuscript after restart", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-first-work-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const manuscriptText = randomUUID();
  const revisedSuffix = `-${randomUUID()}`;
  const snapshotLabel = `초고 기준-${randomUUID().slice(0, 8)}`;
  const eventTitle = randomUUID();
  const focusPhase = `초고-${randomUUID().slice(0, 8)}`;
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
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(
      page.getByRole("heading", { name: "메인", exact: true }),
    ).toBeVisible();
    const mainPageDimensions = await page.locator(".main-page-body").evaluate(
      (element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }),
    );
    expect(mainPageDimensions.scrollHeight).toBeLessThanOrEqual(
      mainPageDimensions.clientHeight,
    );
    const navigation = page.getByRole("navigation", { name: "주요 화면" });
    await expect(navigation.getByRole("button")).toHaveCount(2);
    for (const label of ["메인", "새 작품"]) {
      await expect(
        navigation.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
    for (const removedLabel of [
      "보관함",
      "오늘",
      "일주일",
      "모든 작업",
      "프로젝트",
      "작업 일지",
      "기록실",
      "언젠가",
      "우선순위 뷰",
      "반복 작업",
    ]) {
      await expect(
        navigation.getByRole("button", {
          name: removedLabel,
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "새 작품 만들기" }),
    ).toBeVisible();
    await page.getByLabel("작품 제목").fill(workTitle);
    await page.getByLabel("첫 회차 제목").fill(documentTitle);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toBeVisible();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const snapshotRegion = page.getByRole("region", { name: "작품 스냅샷" });
    await snapshotRegion.getByLabel("작품 스냅샷 이름").fill(snapshotLabel);
    await snapshotRegion
      .getByRole("button", { name: "생성", exact: true })
      .click();
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();
    await manuscript.pressSequentially(revisedSuffix);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const versionRegion = page.getByRole("region", { name: "문서 버전" });
    await versionRegion
      .getByRole("button", { name: "새로고침", exact: true })
      .click();
    await versionRegion.getByRole("button", { name: /버전으로 복원/ }).first().click();
    await expect(manuscript).toHaveText(manuscriptText);
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();
    await manuscript.press("Control+A");
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", {
      name: "사건으로 등록",
    });
    await expect(eventDialog).toContainText(manuscriptText);
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog
      .getByRole("button", { name: "등록", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "현재 회차 사건" })
        .getByRole("button", { name: new RegExp(eventTitle) }),
    ).toBeVisible();
    await manuscript.press("ArrowRight");
    await page
      .getByRole("button", { name: "장면 경계 추가", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "현재 회차 장면 경계" })
        .getByRole("button", { name: /장면 경계 1/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await expect(page.getByTestId("writing-session-timer")).toBeVisible();
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const focusDialog = page.getByRole("dialog", { name: "집중 시작" });
    await focusDialog.getByLabel("집중 단계").fill(focusPhase);
    await focusDialog.getByLabel("집중 시간(분)").fill("37");
    await focusDialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(page.getByTestId("focus-cycle-timer")).toContainText(focusPhase);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    const restartedPage = await electronApp.firstWindow();
    await expect(
      restartedPage.getByText(workTitle, { exact: true }).first(),
    ).toBeVisible();
    await restartedPage
      .getByRole("button", { name: "이어쓰기", exact: true })
      .click();
    await expect(
      restartedPage.getByRole("textbox", { name: "원고" }),
    ).toHaveText(manuscriptText);
    await expect(
      restartedPage.getByTestId("manuscript-title"),
    ).toHaveText(documentTitle);
    await expect(
      restartedPage
        .getByRole("region", { name: "작품 스냅샷" })
        .getByText(snapshotLabel, { exact: true }),
    ).toBeVisible();
    await expect(restartedPage.getByTestId("writing-session-timer")).toBeVisible();
    await expect(restartedPage.getByTestId("focus-cycle-timer")).toContainText(
      focusPhase,
    );
    await restartedPage
      .getByRole("region", { name: "현재 회차 사건" })
      .getByRole("button", { name: new RegExp(eventTitle) })
      .click();
    await expect
      .poll(() =>
        restartedPage
          .getByRole("textbox", { name: "원고" })
          .evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      )
      .toBe(manuscriptText);
    await restartedPage
      .getByRole("region", { name: "현재 회차 장면 경계" })
      .getByRole("button", { name: /장면 경계 1/ })
      .click();
    await expect
      .poll(() =>
        restartedPage.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({
        anchor: manuscriptText.length,
        head: manuscriptText.length,
      });
    await restartedPage
      .getByTestId("focus-cycle-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await expect(
      restartedPage.getByRole("button", { name: "집중 시작", exact: true }),
    ).toBeVisible();
    await restartedPage
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await expect(
      restartedPage.getByRole("button", { name: "기록 시작", exact: true }),
    ).toBeVisible();
    await restartedPage
      .getByRole("navigation", { name: "주요 화면" })
      .getByRole("button", { name: "메인", exact: true })
      .click();
    const recordsOverview = restartedPage.getByRole("region", {
      name: "집필 기록",
    });
    const completedRecord = recordsOverview.getByRole("button", {
      name: new RegExp(`${workTitle}.*${documentTitle}`),
    });
    await expect(completedRecord).toBeVisible();
    await completedRecord.click();
    await expect(
      restartedPage.getByRole("textbox", { name: "원고" }),
    ).toHaveText(manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

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
    const window = await openStudioWorkspace(electronApp);
    const consoleErrors: string[] = [];
    window.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await expect(
      window.getByTestId("manuscript-title"),
    ).toBeVisible();
    await expect(
      window.getByText("장편 편집기 POC", { exact: true }),
    ).toHaveCount(0);
    await expect(window.getByTestId("runtime-status")).toContainText(
      "연결됨",
    );
    const menuBarAutoHide = await electronApp.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isMenuBarAutoHide() ?? false,
    );
    expect(menuBarAutoHide).toBe(true);

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
    expect(scan.records).toHaveLength(1);
    const batch =
      parseCanonicalChangeBatch(
        scan.records[0]?.payload ??
          new Uint8Array(),
      );
    expect(batch.sequence).toBe(
      nextSequence,
    );
    expect(
      applyChangeBatch(
        document.initialText,
        batch,
      ),
    ).toBe(
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
    const documentSwitch = page.getByRole("combobox", {
      name: "문서 전환",
    });
    const saveState = page.getByTestId("save-state");

    await expect(saveState).toHaveText("저장됨");
    await manuscript.click();
    await manuscript.press("End");
    await manuscript.pressSequentially(edit);
    await expect(saveState).toHaveText("편집 중");

    await documentSwitch.selectOption(secondDocument.documentId);
    await expect(documentSwitch).toHaveValue(
      secondDocument.documentId,
    );
    await expect(manuscript).toHaveText(
      secondDocument.initialText,
    );
    await expect(saveState).toHaveText("저장됨");

    const adapter =
      createNodeCryptoJournalChecksumAdapter(
        checksumAlgorithm,
      );
    await expect
      .poll(async () => {
        try {
          const scan = await scanJournalFrames(
            await readFile(journalPath),
            (adapterId) =>
              adapterId === adapter.id ? adapter : null,
          );
          return scan.records.length;
        } catch {
          return 0;
        }
      })
      .toBe(1);
    const scan = await scanJournalFrames(
      await readFile(journalPath),
      (adapterId) =>
        adapterId === adapter.id ? adapter : null,
    );
    expect(scan.tail).toBeNull();
    const batch = parseCanonicalChangeBatch(
      scan.records[0]?.payload ?? new Uint8Array(),
    );
    expect(batch).toMatchObject({
      workId: firstDocument.workId,
      documentId: firstDocument.documentId,
      baseRevisionId: firstDocument.documentRevisionId,
      sequence: firstNextSequence,
    });
    expect(applyChangeBatch(firstDocument.initialText, batch)).toBe(
      firstDocument.initialText + edit,
    );

    await documentSwitch.selectOption(firstDocument.documentId);
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
    const documentSwitch = window.getByRole("combobox", {
      name: "문서 전환",
    });
    const scroller = window.locator(".cm-scroller");
    const manuscriptCharacterCount = window.getByTestId(
      "manuscript-character-count",
    );
    const firstEdit = randomUUID();
    const secondEdit = randomUUID();

    await expect(documentSwitch).toHaveValue(firstDocument.documentId);
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

    await documentSwitch.selectOption(secondDocument.documentId);
    await expect(manuscript).toHaveText(secondDocument.initialText);
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(secondEdit);
    await expect(manuscript).toHaveText(
      `${secondDocument.initialText}${secondEdit}`,
    );

    await documentSwitch.selectOption(firstDocument.documentId);
    await expect(manuscriptCharacterCount).toHaveText(
      String(firstDocument.initialText.length + firstEdit.length),
    );
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

    await documentSwitch.selectOption(secondDocument.documentId);
    await expect(manuscript).toHaveText(
      `${secondDocument.initialText}${secondEdit}`,
    );
    await manuscript.press("Control+Z");
    await expect(manuscript).toHaveText(secondDocument.initialText);
  } finally {
    await electronApp.close();
  }
});

test("defers a document switch until Hangul composition commits", async () => {
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
    const documentSwitch = window.getByRole("combobox", {
      name: "문서 전환",
    });
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

    await documentSwitch.selectOption(secondDocument.documentId);
    await expect(documentSwitch).toHaveValue(secondDocument.documentId);
    await expect(manuscript).toHaveText(compositionText);

    await session.send("Input.insertText", { text: compositionText });
    await expect(manuscript).toHaveText(secondDocument.initialText);

    await documentSwitch.selectOption(firstDocument.documentId);
    await expect(manuscript).toHaveText(compositionText);
    await manuscript.press("Control+Z");
    await expect(manuscript).toHaveText("");
    await session.detach();
  } finally {
    await electronApp.close();
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
    const documentSwitch = window.getByRole("combobox", {
      name: "문서 전환",
    });
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
    await documentSwitch.selectOption(secondDocument.documentId);
    await documentSwitch.selectOption(firstDocument.documentId);

    await session.send("Input.insertText", { text: compositionText });
    await manuscript.pressSequentially(cursorProbe);
    await expect(manuscript).toHaveText(`${compositionText}${cursorProbe}`);

    await documentSwitch.selectOption(secondDocument.documentId);
    await expect(manuscript).toHaveText(secondDocument.initialText);
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

test("closes and restores both workspace rails independently without hiding writing status", async () => {
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

    await expect(documentRail).toBeVisible();
    await expect(reviewRail).toBeVisible();
    await window
      .getByRole("button", { name: "문서 레일 닫기" })
      .click();
    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeVisible();
    await expect(manuscript).toBeVisible();
    await expect(window.getByTestId("current-work")).toHaveText(
      firstDocument.workId,
    );
    await expect(window.getByTestId("current-document")).toHaveText(
      firstDocument.label,
    );
    await expect(window.getByTestId("save-state")).toBeVisible();
    await expect(window.getByTestId("focus-summary")).toBeVisible();

    await window
      .getByRole("button", { name: "검토 레일 닫기" })
      .focus();
    await window.keyboard.press("Enter");
    await expect(reviewRail).toBeHidden();
    await expect(manuscript).toBeVisible();

    await window
      .getByRole("button", { name: "문서 레일 열기" })
      .focus();
    await window.keyboard.press("Enter");
    await expect(documentRail).toBeVisible();
    await window
      .getByRole("combobox", { name: "문서 전환" })
      .selectOption(secondDocument.documentId);
    await expect(window.getByTestId("current-document")).toHaveText(
      secondDocument.label,
    );
    await expect(manuscript).toHaveText(secondDocument.initialText);

    await window
      .getByRole("button", { name: "검토 레일 열기" })
      .click();
    await expect(reviewRail).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test("uses one narrow rail overlay and preserves manual closed state when widened", async () => {
  const documentProfile = createDocumentSwitchProfile();
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
    await window.setViewportSize({
      width: randomInt(480, 620),
      height: randomInt(680, 820),
    });
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const reviewRail = window.getByRole("complementary", {
      name: "검토 레일",
    });

    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeHidden();
    await window
      .getByRole("button", { name: "문서 레일 열기" })
      .click();
    await expect(documentRail).toBeVisible();
    await expect(reviewRail).toBeHidden();

    await window
      .getByRole("button", { name: "검토 레일 열기" })
      .click();
    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeVisible();
    await window
      .getByRole("button", { name: "검토 레일 닫기" })
      .click();

    await window.setViewportSize({
      width: randomInt(1120, 1320),
      height: randomInt(680, 820),
    });
    await expect(documentRail).toBeVisible();
    await expect(reviewRail).toBeHidden();
    await expect(
      window.getByRole("button", { name: "검토 레일 열기" }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test("searches labels and manuscripts only inside the active Work", async () => {
  const firstWorkId = randomUUID();
  const secondWorkId = randomUUID();
  const query = randomUUID().slice(0, 8);
  const firstInitialDocument = {
    workId: firstWorkId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: randomUUID(),
  };
  const firstMatchingDocument = {
    workId: firstWorkId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText: `${randomUUID()}${query}${randomUUID()}`,
  };
  const foreignMatchingDocument = {
    workId: secondWorkId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: `${query}${randomUUID()}`,
    initialText: `${query}${query}`,
  };
  const documentProfile = {
    schemaVersion: 1,
    initialDocumentId: firstInitialDocument.documentId,
    documents: [
      firstInitialDocument,
      firstMatchingDocument,
      foreignMatchingDocument,
    ],
  };
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
    const searchInput = window.getByRole("searchbox", {
      name: "원고 검색",
    });
    const documentSwitch = window.getByRole("combobox", {
      name: "문서 전환",
    });

    await searchInput.fill(query);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 1개 일치",
    );
    await expect(
      window.getByRole("button", {
        name: firstMatchingDocument.label,
      }),
    ).toBeVisible();
    await expect(
      window.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toHaveCount(0);

    await window
      .getByRole("button", {
        name: firstMatchingDocument.label,
      })
      .click();
    await expect(documentSwitch).toHaveValue(
      firstMatchingDocument.documentId,
    );

    await documentSwitch.selectOption(
      foreignMatchingDocument.documentId,
    );
    await expect(searchInput).toHaveValue("");
    await expect(
      window.getByTestId("search-result-summary"),
    ).toHaveCount(0);
    await searchInput.fill(query);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 3개 일치",
    );
    await expect(
      window.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toBeVisible();
    await expect(
      window.getByRole("button", {
        name: firstMatchingDocument.label,
      }),
    ).toHaveCount(0);

    const manuscript = window.getByRole("textbox", { name: "원고" });
    const editedQuery = randomUUID();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(editedQuery);
    await expect(
      window.getByTestId("search-result-summary"),
    ).toHaveCount(0);
    await searchInput.fill(editedQuery);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 1개 일치",
    );
    await expect(
      window.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
